import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { LiveGameSession, AnalysisResult, Player, Point, RecommendedMove } from '../types/index.js';
import { getStoneCapturePointValueForScoring } from '../shared/utils/scoringStonePoints.js';
import { getGongbaeEmptyPointKeys } from '../shared/utils/koreanTerritoryFromBoard.js';
import * as types from '../types/index.js';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import * as os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 프로젝트 루트 기준으로 경로 설정 (process.cwd() 사용)
const PROJECT_ROOT = process.cwd();

// Railway 환경 감지
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY || false;
const isLinux = process.platform === 'linux';
const isRailwayLinux = isRailway && isLinux;

const CPU_COUNT = Math.max(1, os.cpus()?.length ?? 1);

function parsePositiveIntEnv(name: string): number | undefined {
    const raw = (process.env[name] ?? '').trim();
    if (!raw) return undefined;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return n;
}

function clampInt(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function defaultBatchSizeForCpu(cpuCount: number): number {
    if (cpuCount >= 64) return 64;
    if (cpuCount >= 32) return 32;
    if (cpuCount >= 16) return 16;
    return 8;
}

// 환경 변수로 KataGo 경로 설정 가능
// Railway Linux 환경에서는 Linux binary 우선 사용
const defaultKataGoPath = isRailwayLinux 
    ? path.resolve(PROJECT_ROOT, 'katago/katago')  // Linux: 확장자 없음
    : path.resolve(PROJECT_ROOT, 'katago/katago.exe');  // Windows: .exe

const KATAGO_PATH = process.env.KATAGO_PATH || defaultKataGoPath;
const MODEL_PATH = process.env.KATAGO_MODEL_PATH || path.resolve(PROJECT_ROOT, 'katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz');
const CONFIG_PATH = path.resolve(__dirname, './temp_katago_config.cfg');
const KATAGO_HOME_PATH = process.env.KATAGO_HOME_PATH || path.resolve(__dirname, './katago_home');

// KataGo 설정 - 환경 변수로 조정 가능
// 정확도는 유지하면서 속도만 올리기 위해, 기본값은 CPU 코어 수 기반으로 자동 산정합니다.
// (환경 변수로 명시하면 항상 그 값을 우선합니다)
const KATAGO_NUM_ANALYSIS_THREADS =
    parsePositiveIntEnv('KATAGO_NUM_ANALYSIS_THREADS') ??
    clampInt(Math.floor(CPU_COUNT / 4), isRailway ? 2 : 1, 8);

const KATAGO_NUM_SEARCH_THREADS =
    parsePositiveIntEnv('KATAGO_NUM_SEARCH_THREADS') ??
    clampInt(Math.floor(CPU_COUNT / 2), isRailway ? 4 : 2, 32);

const KATAGO_MAX_VISITS = parseInt(process.env.KATAGO_MAX_VISITS || (isRailway ? '500' : '1000'), 10);

const KATAGO_NN_MAX_BATCH_SIZE =
    parsePositiveIntEnv('KATAGO_NN_MAX_BATCH_SIZE') ??
    defaultBatchSizeForCpu(CPU_COUNT);

console.log(`[KataGo] CPU tuning: CPU_COUNT=${CPU_COUNT}, NUM_ANALYSIS_THREADS=${KATAGO_NUM_ANALYSIS_THREADS}, NUM_SEARCH_THREADS=${KATAGO_NUM_SEARCH_THREADS}, NN_MAX_BATCH_SIZE=${KATAGO_NN_MAX_BATCH_SIZE}`);

// KataGo HTTP API URL (Railway에서는 별도 KataGo 서비스 도메인을 여기에 설정)
// 주의: Railway 멀티서비스 구조에서 "자동 도메인 추론"은 백엔드 자기 자신을 가리키는
// 오동작을 유발할 수 있으므로 사용하지 않습니다. (반드시 KATAGO_API_URL을 명시적으로 설정)
const IS_LOCAL = process.env.NODE_ENV !== 'production';
let KATAGO_API_URL: string | undefined = process.env.KATAGO_API_URL?.trim();

// 프로토콜이 없으면 자동으로 https:// 추가
if (KATAGO_API_URL && !KATAGO_API_URL.match(/^https?:\/\//)) {
    KATAGO_API_URL = `https://${KATAGO_API_URL}`;
}

const USE_HTTP_API = !!KATAGO_API_URL && KATAGO_API_URL.trim() !== '';

// HTTP keep-alive: scoring 호출 시 TLS/커넥션 재수립 비용을 줄여 "대기시간"만 단축 (정확도 영향 없음)
const HTTP_KEEPALIVE_AGENT = new http.Agent({ keepAlive: true });
const HTTPS_KEEPALIVE_AGENT = new https.Agent({ keepAlive: true });

const LETTERS = "ABCDEFGHJKLMNOPQRST";

const pointToKataGoMove = (p: Point, boardSize: number): string => {
    if (p.x === -1 || p.y === -1) {
        return 'pass';
    }
    if (p.x >= 0 && p.x < LETTERS.length) {
        return `${LETTERS[p.x]}${boardSize - p.y}`;
    }
    return 'pass';
};

const kataGoMoveToPoint = (move: string, boardSize: number): Point => {
    if (move.toLowerCase() === 'pass') {
        return { x: -1, y: -1 };
    }
    const letter = move.charAt(0).toUpperCase();
    const x = LETTERS.indexOf(letter);
    const y = boardSize - parseInt(move.substring(1), 10);

    // Safeguard against malformed move strings from KataGo that could result in y being NaN.
    if (isNaN(y)) {
        console.error(`[KataGo Service] Failed to parse move string: "${move}". It might be an unexpected format. Treating as a pass.`);
        return { x: -1, y: -1 };
    }
    return { x, y };
};

const kataGoResponseToAnalysisResult = (session: LiveGameSession, response: any, isWhitesTurn: boolean): AnalysisResult => {
    const { boardSize } = session.settings;
    const { rootInfo = {}, moveInfos = [], ownership = null } = response;

    const ownershipMap: number[][] = Array(boardSize).fill(0).map(() => Array(boardSize).fill(0));
    const deadStones: Point[] = [];
    
    let blackTerritory = 0;
    let whiteTerritory = 0;

    const bs = session.boardState;
    const canKorean =
        bs &&
        Array.isArray(bs) &&
        bs.length === boardSize &&
        (bs[0]?.length ?? 0) === boardSize;
    const gongbaeEmptyKeys = canKorean ? getGongbaeEmptyPointKeys(bs, boardSize) : new Set<string>();

    if (ownership && Array.isArray(ownership) && ownership.length > 0) {
        const ownershipBoardSize = Math.sqrt(ownership.length);

        // Check if the returned ownership map is a perfect square and large enough.
        // This handles cases where KataGo might incorrectly return a 19x19 map for a smaller board.
        if (Number.isInteger(ownershipBoardSize) && ownershipBoardSize >= boardSize) {
            // 빈 점: Kata 소유권 임계값(기존과 동일, 미완성 집·형세 유지).
            // 공배: BFS로 '흑·백에 모두 닿는' 빈 연결 성분 안에서만, 소유권이 애매한 칸(|prob|≤임계)만 집·오버레이에서 제외.
            // (성분 전체를 무조건 공배로 두면 큰 빈 공간이 흑·백에 한 번씩 닿을 때 전부 0이 되어 영토 표시가 사라짐)
            const TERRITORY_THRESHOLD = 0.75;
            const DEAD_STONE_THRESHOLD = parseFloat(process.env.KATAGO_DEAD_STONE_THRESHOLD || '0.55');
            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    // Index into the (potentially larger) ownership grid from KataGo
                    const index = y * ownershipBoardSize + x;
                    
                    let ownerProbRaw = ownership[index];
                    let ownerProb = (typeof ownerProbRaw === 'number' && isFinite(ownerProbRaw)) ? ownerProbRaw : 0;
                    
                    // KataGo reports ownership from Black's perspective (reportAnalysisWinratesAs=BLACK in config).
                    // Positive = black will own, negative = white will own. Do NOT flip by turn.
                    ownershipMap[y][x] = Math.round(ownerProb * 10);
                    
                    const stoneOnBoard = session.boardState[y][x];

                    if (stoneOnBoard === Player.None) {
                        const inGongbaeComponent = gongbaeEmptyKeys.has(`${x},${y}`);
                        const strongBlack = ownerProb > TERRITORY_THRESHOLD;
                        const strongWhite = ownerProb < -TERRITORY_THRESHOLD;
                        if (inGongbaeComponent && !strongBlack && !strongWhite) {
                            ownershipMap[y][x] = 0;
                        } else if (strongBlack) {
                            blackTerritory += 1;
                        } else if (strongWhite) {
                            whiteTerritory += 1;
                        }
                    } else if (
                        (stoneOnBoard === Player.Black && ownerProb < -DEAD_STONE_THRESHOLD) ||
                        (stoneOnBoard === Player.White && ownerProb > DEAD_STONE_THRESHOLD)
                    ) {
                        deadStones.push({ x, y });
                    }
                }
            }
        }
    }

    for (const p of deadStones) {
        const c = session.boardState?.[p.y]?.[p.x];
        if (c === types.Player.White) ownershipMap[p.y][p.x] = 10;
        else if (c === types.Player.Black) ownershipMap[p.y][p.x] = -10;
    }
    
    const blackDeadScore = deadStones
        .filter((s) => session.boardState[s.y][s.x] === Player.Black)
        .reduce((acc, s) => acc + getStoneCapturePointValueForScoring(session, s, Player.Black), 0);
    const whiteDeadScore = deadStones
        .filter((s) => session.boardState[s.y][s.x] === Player.White)
        .reduce((acc, s) => acc + getStoneCapturePointValueForScoring(session, s, Player.White), 0);
    const whiteDeadCount = deadStones.filter((s) => session.boardState[s.y][s.x] === Player.White).length;
    const blackDeadCount = deadStones.filter((s) => session.boardState[s.y][s.x] === Player.Black).length;

    const blackLiveCaptures = session.captures[Player.Black] || 0;
    const whiteLiveCaptures = session.captures[Player.White] || 0;

    const komi = session.finalKomi ?? session.settings.komi;

    // territory 필드는 빈 집만 (finalizeAnalysisResult가 사석 칸 수를 더함).
    // 한국식 집 계가 총점: (빈 집+상대 사석 자리) + 따낸 돌(사석) + …
    const blackTerritoryWithDeadCells = Math.round(blackTerritory) + whiteDeadCount;
    const whiteTerritoryWithDeadCells = Math.round(whiteTerritory) + blackDeadCount;
    const scoreDetails = {
        black: { 
            territory: Math.round(blackTerritory), 
            captures: blackLiveCaptures, // "captures" now means live captures
            liveCaptures: blackLiveCaptures, 
            deadStones: whiteDeadScore, 
            baseStoneBonus: 0, hiddenStoneBonus: 0, timeBonus: 0, itemBonus: 0, 
            total: blackTerritoryWithDeadCells + blackLiveCaptures + whiteDeadScore 
        },
        white: { 
            territory: Math.round(whiteTerritory), 
            captures: whiteLiveCaptures, // "captures" now means live captures
            liveCaptures: whiteLiveCaptures, 
            deadStones: blackDeadScore, 
            komi, baseStoneBonus: 0, hiddenStoneBonus: 0, timeBonus: 0, itemBonus: 0, 
            total: whiteTerritoryWithDeadCells + whiteLiveCaptures + blackDeadScore + komi
        },
    };
    
    const recommendedMoves: RecommendedMove[] = (moveInfos || [])
        .slice(0, 3)
        .map((info: any, i: number) => {
            const winrate = info.winrate || 0;
            const scoreLead = info.scoreLead || 0;
            return {
                ...kataGoMoveToPoint(info.move, boardSize),
                winrate: (winrate || 0) * 100,
                scoreLead: scoreLead || 0,
                order: i + 1,
            };
        });
    
    const winrateNum = Number(rootInfo.winrate);
    const scoreLeadNum = Number(rootInfo.scoreLead);
    // KataGo rootInfo is from Black's perspective (reportAnalysisWinratesAs=BLACK)
    const winRateBlack = isFinite(winrateNum) ? winrateNum * 100 : 50;
    const finalScoreLead = isFinite(scoreLeadNum) ? scoreLeadNum : 0;
    
    let winRateChange = 0;
    const prevAnalysis = session.previousAnalysisResult?.[session.player1.id] ?? session.previousAnalysisResult?.[session.player2.id];
    if (prevAnalysis) {
        const prevWinrateFloat = prevAnalysis.winRateBlack / 100;
        if (isFinite(prevWinrateFloat)) {
            winRateChange = (winRateBlack / 100 - prevWinrateFloat) * 100;
        }
    }
    
    return {
        winRateBlack,
        winRateChange: winRateChange,
        scoreLead: finalScoreLead,
        deadStones,
        ownershipMap:
            canKorean || (ownership && Array.isArray(ownership) && ownership.length > 0) ? ownershipMap : null,
        recommendedMoves,
        areaScore: { black: scoreDetails.black.total, white: scoreDetails.white.total },
        scoreDetails,
        blackConfirmed: [], whiteConfirmed: [], blackRight: [], whiteRight: [], blackLikely: [], whiteLikely: [],
    };
};

class KataGoManager {
    private process: ChildProcess | null = null;
    private pendingQueries = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void, timeout: any }>();
    private stdoutBuffer = '';
    private isStarting = false;
    private readyPromise: Promise<void> | null = null;

    constructor() {
        // Eager start removed. Will be started lazily on first query.
    }

    // 서버 시작 시 미리 초기화할 수 있도록 public 메서드로 변경
    public async ensureStarted(): Promise<void> {
        // HTTP API 모드를 사용하는 경우, /api/katago/analyze 엔드포인트에서만 로컬 프로세스가 필요하므로
        // 서버 시작 시에는 초기화하지 않음 (lazy initialization)
        // 하지만 엔드포인트가 호출되면 query() 메서드에서 자동으로 초기화됨
        if (USE_HTTP_API) {
            console.log('[KataGo] HTTP API mode detected, skipping eager initialization. Local process will be initialized on-demand if /api/katago/analyze is called.');
            return;
        }
        
        if (!this.process && !this.isStarting && !this.readyPromise) {
            try {
                await this.start();
            } catch (error: any) {
                // 초기화 실패는 로그만 남기고 계속 진행 (KataGo 없이도 서버는 동작 가능)
                console.error('[KataGo] Failed to start engine during initialization:', error.message);
            }
        } else if (this.readyPromise) {
            // 이미 시작 중이면 대기
            try {
                await this.readyPromise;
            } catch (error: any) {
                console.error('[KataGo] Engine initialization promise rejected:', error.message);
            }
        }
    }

    private start(): Promise<void> {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.isStarting = true;
        this.readyPromise = new Promise<void>((resolve, reject) => {

            // 여러 경로 시도 (환경 변수 > 프로젝트 루트 katago 폴더 > 대체 경로들)
            let actualKataGoPath = KATAGO_PATH;
            let actualModelPath = MODEL_PATH;
            
            // 프로젝트 루트의 katago 폴더 경로 (Windows와 Linux 모두 지원)
            const projectKatagoPathWin = path.resolve(PROJECT_ROOT, 'katago/katago.exe');
            const projectKatagoPathLinux = path.resolve(PROJECT_ROOT, 'katago/katago');
            const projectModelPath = path.resolve(PROJECT_ROOT, 'katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz');
            
            // Railway Linux 환경에서는 Linux 경로 우선, 그 외에는 플랫폼에 따라 우선순위 결정
            const pathsToTry = [
                // 1. 환경 변수로 명시적으로 설정된 경로 (최우선)
                ...(process.env.KATAGO_PATH ? [KATAGO_PATH] : []),
                // 2. Railway Linux 환경: Linux 경로 우선
                ...(isRailwayLinux ? [
                    projectKatagoPathLinux,
                    path.resolve(__dirname, '../katago/katago'),
                    path.resolve(__dirname, '../../katago/katago'),
                    '/app/katago/katago',  // Railway 표준 경로
                ] : []),
                // 3. 일반 Linux 환경: Linux 경로 우선
                ...(isLinux && !isRailway ? [
                    projectKatagoPathLinux,
                    path.resolve(__dirname, '../katago/katago'),
                    path.resolve(__dirname, '../../katago/katago'),
                ] : []),
                // 4. Windows 환경: Windows 경로 우선
                ...(!isLinux ? [
                    projectKatagoPathWin,
                    path.resolve(__dirname, '../katago/katago.exe'),
                    path.resolve(__dirname, '../../katago/katago.exe'),
                    'C:\\katago\\katago.exe',
                    'D:\\katago\\katago.exe',
                ] : []),
                // 5. 플랫폼 무관 대체 경로들
                projectKatagoPathLinux,
                projectKatagoPathWin,
                path.resolve(__dirname, '../katago/katago'),
                path.resolve(__dirname, '../katago/katago.exe'),
                path.resolve(__dirname, '../../katago/katago'),
                path.resolve(__dirname, '../../katago/katago.exe'),
            ];
            
            const modelPathsToTry = [
                // 1. 환경 변수로 명시적으로 설정된 경로 (최우선)
                ...(process.env.KATAGO_MODEL_PATH ? [MODEL_PATH] : []),
                // 2. 프로젝트 루트의 katago 폴더 (가장 일반적인 위치)
                projectModelPath,
                // 3. 기타 대체 경로들
                path.resolve(__dirname, '../katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz'),
                path.resolve(__dirname, '../../katago/kata1-b28c512nbt-s9853922560-d5031756885.bin.gz'),
            ];
            
            // KataGo 실행 파일 찾기
            let foundKataGo = false;
            for (const tryPath of pathsToTry) {
                if (fs.existsSync(tryPath)) {
                    actualKataGoPath = tryPath;
                    console.log(`[KataGo] Engine found at: ${actualKataGoPath}`);
                    foundKataGo = true;
                    break;
                }
            }
            
            if (!foundKataGo) {
                const errorMsg = `[KataGo] Engine not found. Tried paths:\n${pathsToTry.map(p => `  - ${p}`).join('\n')}\n\nPlease set KATAGO_PATH environment variable or place katago.exe in one of the expected locations.`;
                console.error(errorMsg);
                this.isStarting = false;
                this.readyPromise = null;
                return reject(new Error(errorMsg));
            }
            
            // 모델 파일 찾기
            let foundModel = false;
            for (const tryPath of modelPathsToTry) {
                if (fs.existsSync(tryPath)) {
                    actualModelPath = tryPath;
                    foundModel = true;
                    break;
                }
            }
            
            // 모델 파일이 없으면 런타임에 다운로드 시도
            if (!foundModel) {
                console.log('[KataGo] Model file not found locally, attempting to download...');
                const modelDir = path.resolve(PROJECT_ROOT, 'katago');
                const modelFilename = path.basename(projectModelPath);
                const modelPath = path.resolve(modelDir, modelFilename);
                
                // 모델 디렉토리 생성
                if (!fs.existsSync(modelDir)) {
                    fs.mkdirSync(modelDir, { recursive: true });
                }
                
                // 모델 파일 다운로드 (Promise 내부에서 동기적으로 import 사용)
                // IMPORTANT:
                // - KataGo Training의 모델 경로는 `/uploaded/networks/models/kata1/<file>.bin.gz` 형태입니다.
                // - 단일 고정 URL은 시간이 지나면 없어질 수 있으므로, 실패 시 "Latest network"를 자동으로 추출해 fallback 합니다.
                // - 403 방지: User-Agent 없으면 media.katagotraining.org가 차단하는 경우가 있음
                import('https').then((https) => {
                    const requestOptions = {
                        headers: {
                            'User-Agent': 'KataGo-NodeService/1.0 (https://github.com/lightvector/KataGo)',
                            'Accept': 'application/octet-stream,text/html',
                            // 일부 환경에서 media.katagotraining.org가 직접 다운로드를 제한할 수 있어 referer/origin을 함께 설정
                            'Referer': 'https://katagotraining.org/networks/',
                            'Origin': 'https://katagotraining.org',
                        },
                    };

                    const extractLatestNetworkUrl = (html: string): string | null => {
                        const m = html.match(/Latest network:\s*\[[^\]]+\]\((https:\/\/media\.katagotraining\.org\/uploaded\/networks\/models\/kata1\/[^)]+\.bin\.gz)\)/i);
                        return m?.[1] ?? null;
                    };

                    const fetchLatestNetworkUrl = (): Promise<string | null> => {
                        return new Promise((resolveLatest) => {
                            const req = https.request('https://katagotraining.org/networks/', { method: 'GET', headers: requestOptions.headers }, (res) => {
                                const chunks: Buffer[] = [];
                                res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
                                res.on('end', () => {
                                    try {
                                        const html = Buffer.concat(chunks).toString('utf8');
                                        resolveLatest(extractLatestNetworkUrl(html));
                                    } catch {
                                        resolveLatest(null);
                                    }
                                });
                            });
                            req.on('error', () => resolveLatest(null));
                            req.end();
                        });
                    };

                    const downloadWithRedirects = (urlStr: string, redirectsLeft: number): Promise<void> => {
                        return new Promise((resolveDl, rejectDl) => {
                            let urlObj: URL;
                            try {
                                urlObj = new URL(urlStr);
                            } catch (e: any) {
                                rejectDl(new Error(`Invalid URL: ${urlStr}`));
                                return;
                            }

                            const isHttps = urlObj.protocol === 'https:';
                            const httpModule = isHttps ? https : http;
                            const req = httpModule.request(
                                urlObj,
                                { method: 'GET', headers: requestOptions.headers },
                                (res: any) => {
                                    const status = res.statusCode ?? 0;
                                    if ([301, 302, 303, 307, 308].includes(status) && redirectsLeft > 0 && res.headers?.location) {
                                        res.resume();
                                        const nextUrl = new URL(res.headers.location, urlObj).toString();
                                        downloadWithRedirects(nextUrl, redirectsLeft - 1).then(resolveDl).catch(rejectDl);
                                        return;
                                    }
                                    if (status !== 200) {
                                        res.resume();
                                        rejectDl(new Error(`HTTP ${status}`));
                                        return;
                                    }
                                    const writeStream = fs.createWriteStream(modelPath);
                                    res.pipe(writeStream);
                                    writeStream.on('finish', () => {
                                        writeStream.close();
                                        resolveDl();
                                    });
                                    writeStream.on('error', (err) => {
                                        writeStream.close();
                                        rejectDl(err);
                                    });
                                }
                            );
                            req.on('error', rejectDl);
                            req.end();
                        });
                    };

                    const preferredModelUrlFromEnv = (process.env.KATAGO_MODEL_URL || '').trim();
                    const preferredModelUrl = preferredModelUrlFromEnv !== ''
                        ? preferredModelUrlFromEnv
                        : `https://media.katagotraining.org/uploaded/networks/models/kata1/${encodeURIComponent(modelFilename)}`;

                    (async () => {
                        const candidateUrls: string[] = [preferredModelUrl];
                        const latestUrl = await fetchLatestNetworkUrl();
                        if (latestUrl && !candidateUrls.includes(latestUrl)) candidateUrls.push(latestUrl);

                        let lastErr: any = null;
                        for (const url of candidateUrls) {
                            try {
                                console.log(`[KataGo] Downloading model from ${url}...`);
                                await downloadWithRedirects(url, 3);
                                actualModelPath = modelPath;
                                foundModel = true;
                                console.log('[KataGo] Model downloaded successfully');
                                this.continueKataGoStart(actualKataGoPath, actualModelPath, resolve, reject);
                                return;
                            } catch (e: any) {
                                lastErr = e;
                                if (fs.existsSync(modelPath)) {
                                    try { fs.unlinkSync(modelPath); } catch {}
                                }
                                console.warn(`[KataGo] Model download failed from ${url}: ${e?.message || e}`);
                            }
                        }

                        const errorMsg = `[KataGo] Model file not found and download failed. Tried paths:\n${modelPathsToTry.map(p => `  - ${p}`).join('\n')}\n\nDownload error: ${lastErr?.message || String(lastErr)}\n\nPlease set KATAGO_MODEL_PATH or KATAGO_MODEL_URL, or place the model file in one of the expected locations.`;
                        console.error(errorMsg);
                        this.isStarting = false;
                        this.readyPromise = null;
                        reject(new Error(errorMsg));
                    })();
                }).catch((importError: any) => {
                    const errorMsg = `[KataGo] Failed to import https module: ${importError.message}`;
                    console.error(errorMsg);
                    this.isStarting = false;
                    this.readyPromise = null;
                    reject(new Error(errorMsg));
                });
                return; // 다운로드가 완료될 때까지 대기
            }
            
            // 모델 파일을 찾았거나 다운로드 완료 후 KataGo 시작
            this.continueKataGoStart(actualKataGoPath, actualModelPath, resolve, reject);
        });
        
        return this.readyPromise;
    }

    private continueKataGoStart(actualKataGoPath: string, actualModelPath: string, resolve: () => void, reject: (error: Error) => void) {
            
            try {
                if (!fs.existsSync(KATAGO_HOME_PATH)) {
                    fs.mkdirSync(KATAGO_HOME_PATH, { recursive: true });
                }
            } catch (e: any) {
                const errorMsg = `[KataGo] Failed to create home directory at ${KATAGO_HOME_PATH}: ${e.message}`;
                console.error(errorMsg);
                this.isStarting = false;
                this.readyPromise = null;
                return reject(new Error(errorMsg));
            }

            const configContent = `
logFile = ./katago_analysis_log.txt
homeDataDir = ${KATAGO_HOME_PATH.replace(/\\/g, '/')}
reportAnalysisWinratesAs = BLACK
nnMaxBatchSize = ${KATAGO_NN_MAX_BATCH_SIZE}
analysisPVLen = 10
numAnalysisThreads = ${KATAGO_NUM_ANALYSIS_THREADS}
numSearchThreads = ${KATAGO_NUM_SEARCH_THREADS}
maxVisits = ${KATAGO_MAX_VISITS}
            `.trim();

            try {
                fs.writeFileSync(CONFIG_PATH, configContent);
            } catch (e: any) {
                const errorMsg = `[KataGo] Failed to write temporary config file: ${e.message}`;
                console.error(errorMsg);
                this.isStarting = false;
                this.readyPromise = null;
                return reject(new Error(errorMsg));
            }

            try {
                this.process = spawn(actualKataGoPath, [
                    'analysis', 
                    '-model', actualModelPath, 
                    '-config', CONFIG_PATH,
                ], {
                    cwd: KATAGO_HOME_PATH,
                    env: {
                        ...process.env,
                        // Railway/컨테이너 환경에서는 FUSE(/dev/fuse, fusermount)가 없어 AppImage가 exit 127로 죽는 경우가 많음.
                        // AppImage를 강제로 extract-and-run 모드로 실행해서 FUSE 의존성을 제거한다.
                        APPIMAGE_EXTRACT_AND_RUN: process.env.APPIMAGE_EXTRACT_AND_RUN || '1',
                    }
                });
            } catch (e: any) {
                const errorMsg = `[KataGo] Failed to spawn process: ${e.message}`;
                console.error(errorMsg);
                this.isStarting = false;
                this.readyPromise = null;
                return reject(new Error(errorMsg));
            }

            this.process.on('spawn', () => {
                // KataGo가 실제로 준비될 때까지 약간의 대기 시간 필요
                setTimeout(() => {
                    this.isStarting = false;
                    resolve();
                }, 2000); // 2초 대기
            });

            this.process.stdout?.on('data', (data) => {
                this.processStdoutData(data);
            });
            this.process.stderr?.on('data', (data) => {
                const stderrText = data.toString();
                // 중요하지 않은 메시지 필터링
                if (!stderrText.includes('INFO:') && !stderrText.includes('WARNING:')) {
                    console.error(`[KataGo STDERR] ${stderrText}`);
                }
            });
            
            this.process.on('exit', (code, signal) => {
                const errorMsg = `[KataGo] Process exited with code ${code}, signal ${signal}.`;
                console.error(errorMsg);
                this.cleanup();
                this.readyPromise = null; // Allow restart
                reject(new Error(errorMsg));
            });
            
            this.process.on('error', (err) => {
                const errorMsg = `[KataGo] Process error: ${err.message}`;
                console.error(errorMsg);
                this.cleanup();
                this.readyPromise = null;
                reject(new Error(errorMsg));
            });
    }

    private cleanup() {
        this.isStarting = false;
        this.process = null;
        this.pendingQueries.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error("KataGo process exited."));
        });
        this.pendingQueries.clear();
    }

    private processStdoutData(data: any) {
        this.stdoutBuffer += data.toString();
        let newlineIndex;
        while ((newlineIndex = this.stdoutBuffer.indexOf('\n')) !== -1) {
            const line = this.stdoutBuffer.substring(0, newlineIndex);
            this.stdoutBuffer = this.stdoutBuffer.substring(newlineIndex + 1);
            if (line.trim()) {
                try {
                    const response = JSON.parse(line);
                    const query = this.pendingQueries.get(response.id);
                    if (query) {
                        clearTimeout(query.timeout);
                        query.resolve(response);
                        this.pendingQueries.delete(response.id);
                    } else {
                        // 응답받았지만 대기 중인 쿼리가 없는 경우 (이미 타임아웃됨)
                        // 조용히 무시
                    }
                } catch (e) {
                    // JSON 파싱 실패는 일반적인 로그 라인이거나 에러 메시지일 수 있음
                    // 중요한 메시지만 로깅
                    if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
                        console.error('[KataGo] Error line from stdout:', line);
                    } else if (line.includes('id') && line.includes('query')) {
                        // JSON처럼 보이지만 파싱 실패한 경우 로깅
                        console.warn('[KataGo] Failed to parse response line:', line.substring(0, 100));
                    }
                }
            }
        }
    }

    public async query(analysisQuery: any): Promise<any> {
        // HTTP API 모드일 때는 로컬 프로세스를 사용하지 않음
        if (USE_HTTP_API) {
            const errorMsg = 'KataGo is configured to use HTTP API mode. Local process queries are not allowed.';
            console.error(`[KataGo] ${errorMsg}`);
            return Promise.reject(new Error(errorMsg));
        }
        
        if (!this.process) {
            try {
                await this.start();
            } catch (e: any) {
                // If start() fails (e.g., file not found), reject the query.
                console.error('[KataGo] Failed to start:', e);
                return Promise.reject(e);
            }
        }

        // 프로세스가 준비되지 않았으면 대기
        if (!this.process || !this.process.stdin) {
            console.error('[KataGo] Process or stdin is not available.');
            return Promise.reject(new Error('KataGo process is not ready.'));
        }

        // stdin을 변수에 미리 저장 (null 체크 완료)
        const stdin = this.process.stdin;
        if (!stdin) {
            return Promise.reject(new Error('KataGo stdin is not available.'));
        }

        return new Promise((resolve, reject) => {
            const id = analysisQuery.id;
            
            const timeout = setTimeout(() => {
                console.error(`[KataGo] Query ${id} timed out after 300 seconds.`);
                this.pendingQueries.delete(id);
                reject(new Error(`KataGo query ${id} timed out after 300 seconds.`));
            }, 300000); // 300초(5분)로 증가 (계가에 더 많은 시간 필요)
            
            this.pendingQueries.set(id, { resolve, reject, timeout });
            
            try {
                const queryString = JSON.stringify(analysisQuery) + '\n';
                const written = stdin.write(queryString, (err) => {
                    if (err) {
                        console.error('[KataGo] Write to stdin error:', err);
                        clearTimeout(timeout);
                        this.pendingQueries.delete(id);
                        reject(err);
                    }
                });
                
                if (!written) {
                    // 버퍼가 가득 찬 경우 (조용히 처리)
                    stdin.once('drain', () => {
                        // 버퍼가 비워짐
                    });
                }
            } catch (err: any) {
                console.error('[KataGo] Error writing to stdin:', err);
                clearTimeout(timeout);
                this.pendingQueries.delete(id);
                reject(err);
            }
        });
    }
}

let kataGoManager: KataGoManager | null = null;

export const getKataGoManager = (): KataGoManager => {
    if (!kataGoManager) {
        kataGoManager = new KataGoManager();
    }
    return kataGoManager;
};

// 서버 시작 시 KataGo 엔진을 미리 초기화하는 함수
export const initializeKataGo = async (): Promise<void> => {
    // 환경 변수 로드 확인 (디버깅용)
    const rawKataGoUrl = process.env.KATAGO_API_URL;
    console.log(`[KataGo] Initialization check:`);
    console.log(`[KataGo]   - IS_LOCAL=${IS_LOCAL}`);
    console.log(`[KataGo]   - NODE_ENV=${process.env.NODE_ENV}`);
    console.log(`[KataGo]   - Raw KATAGO_API_URL from env: ${rawKataGoUrl || 'not set'}`);
    console.log(`[KataGo]   - Processed KATAGO_API_URL: ${KATAGO_API_URL || 'not set'}`);
    console.log(`[KataGo]   - USE_HTTP_API=${USE_HTTP_API}`);
    
    // HTTP API를 사용하는 경우 프로세스 초기화 불필요
    // 자기 자신의 /api/katago/analyze 엔드포인트로 연결 테스트하는 것은 순환 참조를 일으킬 수 있으므로 제거
    if (USE_HTTP_API) {
        if (!KATAGO_API_URL) {
            console.error(`[KataGo] WARNING: USE_HTTP_API is true but KATAGO_API_URL is not set!`);
            console.error(`[KataGo] Please set KATAGO_API_URL environment variable.`);
            console.error(`[KataGo] Auto-scoring will fall back to manual scoring if KataGo is unavailable.`);
        } else {
            console.log(`[KataGo] ✓ Using HTTP API: ${KATAGO_API_URL}`);
            console.log(`[KataGo] HTTP API mode: KataGo analysis will be performed via HTTP requests to ${KATAGO_API_URL}`);
            console.log(`[KataGo] HTTP API is ready for analysis requests.`);
        }
        // 연결 테스트는 제거 (첫 실제 분석 요청 시 자동으로 테스트됨)
        return;
    }

    // 로컬 환경에서도 로컬 프로세스를 사용할 수 있도록 허용
    // (로컬에 KataGo binary와 모델 파일이 있는 경우)
    if (IS_LOCAL) {
        console.log('[KataGo] Local environment detected. Will attempt to use local KataGo process if available.');
    }

    // 메인 게임 서버(Railway)만 해당. 전용 KataGo 컨테이너는 KATAGO_STANDALONE_SERVICE=true 로 이 경고를 끈다.
    const isStandaloneKatagoWorker = String(process.env.KATAGO_STANDALONE_SERVICE || '').toLowerCase() === 'true';
    if (
        !isStandaloneKatagoWorker &&
        (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY) &&
        process.env.NODE_ENV === 'production'
    ) {
        console.warn(
            '[KataGo] Railway 프로덕션(게임 서버): 계가를 빠르게 하려면 메인 서비스에 KATAGO_API_URL을 Railway KataGo 서비스 공개 URL로 설정하세요 ' +
                '(예: https://your-katago.up.railway.app). 비워 두면 이 인스턴스에서 로컬 엔진을 띄우며 대부분의 웹 인스턴스에서는 계가가 실패하거나 매우 느립니다.'
        );
    }
    console.log('[KataGo] Attempting to initialize local KataGo process...');
    try {
        const manager = getKataGoManager();
        await manager.ensureStarted();
        console.log('[KataGo] Engine ready. Local process initialized successfully.');
    } catch (error: any) {
        console.error('[KataGo] Failed to initialize local process:', error.message);
        console.error('[KataGo] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('[KataGo] If you want to use HTTP API instead, set KATAGO_API_URL environment variable.');
        // 초기화 실패해도 서버는 계속 실행 (KataGo 없이도 서버는 동작 가능)
    }
};

/** 계가 전용 KataGo 한도. 프리컴퓨트·REQUEST_SCORING·getGameResult 본 분석에 동일 적용 (옵션 누락 시 KATAGO_MAX_TIME_SEC 기본 20초가 들어가 체감 지연 발생 방지). */
export function getScoringKataGoLimits(): { maxVisits: number; maxTimeSec: number } {
    const visitsRaw = (process.env.KATAGO_SCORING_MAX_VISITS || '').trim();
    const timeRaw = (process.env.KATAGO_SCORING_MAX_TIME_SEC || '').trim();
    let maxVisits = visitsRaw ? parseInt(visitsRaw, 10) : 120;
    let maxTimeSec = timeRaw ? parseInt(timeRaw, 10) : 3;
    if (!Number.isFinite(maxVisits) || maxVisits <= 0) maxVisits = 120;
    if (!Number.isFinite(maxTimeSec) || maxTimeSec <= 0) maxTimeSec = 3;
    return { maxVisits, maxTimeSec };
}

export const analyzeGame = async (
    session: LiveGameSession,
    options?: {
        maxVisits?: number;
        maxTimeSec?: number;
        includePolicy?: boolean;
        includeOwnership?: boolean;
    }
): Promise<AnalysisResult> => {
    const isScoringRequest =
        options?.includePolicy === false && (options?.includeOwnership !== false);
    const isBaseMode =
        session.mode === types.GameMode.Base ||
        (session.mode === types.GameMode.Mix && Boolean(session.settings.mixedModes?.includes(types.GameMode.Base)));
    const isAdventureBase = isBaseMode && (session as any).gameCategory === 'adventure';
    const resolveBaseStoneColor = (owner: 'p1' | 'p2'): 'B' | 'W' => {
        if (isAdventureBase) {
            return owner === 'p1' ? 'B' : 'W';
        }
        const blackPlayerId = session.blackPlayerId;
        if (owner === 'p1') {
            return session.player1.id === blackPlayerId ? 'B' : 'W';
        }
        return session.player2.id === blackPlayerId ? 'B' : 'W';
    };

    // 계가/분석은 모드와 무관하게 항상 "최종 바둑판 상태"를 단일 진실 소스로 사용한다.
    // (수순 재구성(moveHistory) 경로는 히든/베이스/포획/특수 연출에서 최종 형상과 어긋날 수 있음)
    const useBoardStateForAnalysis = true;

    let query: any;
    let isCurrentPlayerWhite: boolean;

    if (useBoardStateForAnalysis) {
        // For these modes, send the current board state directly.
        // 미리 배치된 돌(baseStones)과 히든돌도 포함하여 정확한 계가 수행
        const initialStones: [string, string][] = [];
        const processedPoints = new Set<string>();
        
        // 1. 현재 보드 상태의 모든 돌 추가
        for (let y = 0; y < session.settings.boardSize; y++) {
            for (let x = 0; x < session.settings.boardSize; x++) {
                if (session.boardState[y][x] !== types.Player.None) {
                    const pointKey = `${x},${y}`;
                    processedPoints.add(pointKey);
                    initialStones.push([
                        session.boardState[y][x] === types.Player.Black ? 'B' : 'W',
                        pointToKataGoMove({ x, y }, session.settings.boardSize)
                    ]);
                }
            }
        }
        
        // 2. 베이스 돌 추가 (미리 배치된 돌, moveHistory에 없을 수 있음)
        const baseStones_p1 = (session as any).baseStones_p1 || [];
        const baseStones_p2 = (session as any).baseStones_p2 || [];
        for (const stone of baseStones_p1) {
            const pointKey = `${stone.x},${stone.y}`;
            if (!processedPoints.has(pointKey)) {
                processedPoints.add(pointKey);
                initialStones.push([
                    resolveBaseStoneColor('p1'),
                    pointToKataGoMove({ x: stone.x, y: stone.y }, session.settings.boardSize)
                ]);
            }
        }
        
        for (const stone of baseStones_p2) {
            const pointKey = `${stone.x},${stone.y}`;
            if (!processedPoints.has(pointKey)) {
                processedPoints.add(pointKey);
                initialStones.push([
                    resolveBaseStoneColor('p2'),
                    pointToKataGoMove({ x: stone.x, y: stone.y }, session.settings.boardSize)
                ]);
            }
        }
        
        // 3. 히든돌 처리: moveHistory에 있지만 boardState에 반영되지 않은 경우를 대비
        // (히든돌은 이미 boardState에 반영되어 있으므로 추가 처리 불필요)
        // 단, moveHistory를 기반으로 한 분석에서 누락될 수 있으므로 확인
        
        isCurrentPlayerWhite = session.currentPlayer === types.Player.White;

        query = {
            id: `query-${randomUUID()}`,
            initialStones: initialStones,
            initialPlayer: isCurrentPlayerWhite ? 'W' : 'B',
            moves: [], // No moves, since we provided the final state.
            rules: "korean",
            komi: session.finalKomi ?? session.settings.komi,
            boardXSize: session.settings.boardSize,
            boardYSize: session.settings.boardSize,
            maxVisits: options?.maxVisits ?? parseInt(process.env.KATAGO_MAX_VISITS || '500', 10),
            includePolicy: options?.includePolicy ?? true,
            includeOwnership: options?.includeOwnership ?? true,
            overrideSettings: { maxTime: options?.maxTimeSec ?? parseInt(process.env.KATAGO_MAX_TIME_SEC || '20', 10) },
        };
    } else {
        // For standard games, send the move history.
        // 베이스 돌과 히든돌도 고려하여 정확한 계가 수행
        const moves: [string, string][] = [];
        const processedPoints = new Set<string>();
        
        // 1. 베이스 돌을 먼저 추가 (게임 시작 전에 배치된 돌)
        const baseStones_p1 = (session as any).baseStones_p1 || [];
        const baseStones_p2 = (session as any).baseStones_p2 || [];
        for (const stone of baseStones_p1) {
            const pointKey = `${stone.x},${stone.y}`;
            processedPoints.add(pointKey);
            moves.push([
                resolveBaseStoneColor('p1'),
                pointToKataGoMove({ x: stone.x, y: stone.y }, session.settings.boardSize)
            ]);
        }
        
        for (const stone of baseStones_p2) {
            const pointKey = `${stone.x},${stone.y}`;
            processedPoints.add(pointKey);
            moves.push([
                resolveBaseStoneColor('p2'),
                pointToKataGoMove({ x: stone.x, y: stone.y }, session.settings.boardSize)
            ]);
        }
        
        // 2. moveHistory의 모든 수 추가 (히든돌 포함)
        for (const move of session.moveHistory) {
            if (move.x === -1 && move.y === -1) continue; // 패스는 제외
            const pointKey = `${move.x},${move.y}`;
            // 이미 베이스 돌로 처리된 위치는 제외 (중복 방지)
            if (!processedPoints.has(pointKey)) {
                processedPoints.add(pointKey);
                moves.push([
                    move.player === Player.Black ? 'B' : 'W',
                    pointToKataGoMove({ x: move.x, y: move.y }, session.settings.boardSize)
                ]);
            }
        }
        
        isCurrentPlayerWhite = moves.length % 2 !== 0;

        query = {
            id: `query-${randomUUID()}`,
            moves: moves,
            rules: "korean",
            komi: session.finalKomi ?? session.settings.komi,
            boardXSize: session.settings.boardSize,
            boardYSize: session.settings.boardSize,
            maxVisits: options?.maxVisits ?? parseInt(process.env.KATAGO_MAX_VISITS || '500', 10),
            includePolicy: options?.includePolicy ?? true,
            includeOwnership: options?.includeOwnership ?? true,
            overrideSettings: { maxTime: options?.maxTimeSec ?? parseInt(process.env.KATAGO_MAX_TIME_SEC || '20', 10) },
        };
    }

    /** 계가·REQUEST_SCORING 등: policy 끄고 ownership만 쓰는 호출 → 짧은 HTTP 타임아웃·적은 재시도 */
    const isScoringHttpProfile = isScoringRequest;
    const engineBudgetSec = options?.maxTimeSec
        ?? (isScoringHttpProfile
            ? getScoringKataGoLimits().maxTimeSec
            : parseInt(process.env.KATAGO_MAX_TIME_SEC || '20', 10));

    const scoringHttpTimeoutParsed = parseInt(process.env.KATAGO_SCORING_HTTP_TIMEOUT_MS || '', 10);
    const httpTransportOpts: { timeoutMs: number; maxRetries: number; retryDelayMs: number } = isScoringHttpProfile
        ? {
              // 원격 KataGo는 엔진 maxTime 외에 네트워크·콜드스타트·ownership 직렬화 시간이 붙음.
              // 예전 공식(엔진 3초 → 5.5초 HTTP)은 Railway 등에서 타임아웃·socket hang up을 유발해 계가가 멈춤.
              timeoutMs:
                  Number.isFinite(scoringHttpTimeoutParsed) && scoringHttpTimeoutParsed > 0
                      ? scoringHttpTimeoutParsed
                      : Math.min(35000, Math.max(8000, engineBudgetSec * 1000 + 5000)),
              maxRetries: Math.max(0, Math.min(3, parseInt(process.env.KATAGO_SCORING_HTTP_RETRIES || '1', 10))),
              retryDelayMs: Math.max(100, parseInt(process.env.KATAGO_SCORING_HTTP_RETRY_DELAY_MS || '400', 10)),
          }
        : {
              timeoutMs: parseInt(process.env.KATAGO_HTTP_TIMEOUT_MS || '35000', 10),
              maxRetries: Math.max(0, Math.min(5, parseInt(process.env.KATAGO_HTTP_RETRIES || '2', 10))),
              retryDelayMs: Math.max(200, parseInt(process.env.KATAGO_HTTP_RETRY_DELAY_MS || '1000', 10)),
          };

    // HTTP API를 사용하는 경우 queryKataGoViaHttp 함수 정의 (재시도 로직 포함)
    const queryKataGoViaHttp = async (
        analysisQuery: any,
        apiUrl: string | undefined,
        retryCount: number,
        clientOpts: { timeoutMs: number; maxRetries: number; retryDelayMs: number }
    ): Promise<any> => {
        const MAX_RETRIES = clientOpts.maxRetries;
        const RETRY_DELAY_MS = clientOpts.retryDelayMs;

        let urlToUse = apiUrl || KATAGO_API_URL || (analysisQuery.__fallbackUrl ? analysisQuery.__fallbackUrl : undefined);
        if (!urlToUse) {
            throw new Error('KATAGO_API_URL is not set. Please configure KATAGO_API_URL environment variable.');
        }
        
        // 프로토콜이 없으면 자동으로 https:// 추가 (Railway는 HTTPS를 사용)
        if (!urlToUse.match(/^https?:\/\//)) {
            urlToUse = `https://${urlToUse}`;
            console.log(`[KataGo HTTP] Added missing protocol to URL: ${urlToUse}`);
        }
        
        // __fallbackUrl을 제거 (실제 쿼리에는 포함하지 않음)
        const cleanQuery = { ...analysisQuery };
        delete cleanQuery.__fallbackUrl;
        
        console.log(`[KataGo HTTP] Sending analysis query to ${urlToUse}, queryId=${cleanQuery.id}, attempt=${retryCount + 1}/${MAX_RETRIES + 1}, httpTimeoutMs=${clientOpts.timeoutMs}`);
        
        try {
            const response = await new Promise<any>((resolve, reject) => {
                let url: URL;
                try {
                    url = new URL(urlToUse);
                } catch (error: any) {
                    return reject(new Error(`Invalid KATAGO_API_URL format: ${urlToUse}. Error: ${error.message}`));
                }
                const isHttps = url.protocol === 'https:';
                const httpModule = isHttps ? https : http;
                
                const postData = JSON.stringify(cleanQuery);
                
                const timeoutMs = clientOpts.timeoutMs;
                const timeoutSeconds = timeoutMs / 1000;
                
                const options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    timeout: timeoutMs,
                    agent: isHttps ? HTTPS_KEEPALIVE_AGENT : HTTP_KEEPALIVE_AGENT,
                };
                
                const req = httpModule.request(url, options, (res) => {
                    let responseData = '';
                    
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });
                    
                    res.on('end', () => {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                const parsed = JSON.parse(responseData);
                                console.log(`[KataGo HTTP] ✓ Success! Received response for queryId=${cleanQuery.id}`);
                                console.log(`[KataGo HTTP] Status code: ${res.statusCode}, Response size: ${responseData.length} bytes`);
                                console.log(`[KataGo HTTP] Response has rootInfo: ${!!parsed.rootInfo}, has ownership: ${!!parsed.ownership}`);
                                resolve(parsed);
                            } catch (parseError) {
                                console.error(`[KataGo HTTP] ✗ Failed to parse JSON response for queryId=${cleanQuery.id}`);
                                console.error(`[KataGo HTTP] Parse error:`, parseError);
                                console.error(`[KataGo HTTP] Response data (first 500 chars): ${responseData.substring(0, 500)}`);
                                reject(new Error(`Failed to parse KataGo API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
                            }
                        } else {
                            console.error(`[KataGo HTTP] ✗ API returned error status ${res.statusCode} for queryId=${cleanQuery.id}`);
                            console.error(`[KataGo HTTP] Response data (first 500 chars): ${responseData.substring(0, 500)}`);
                            reject(new Error(`KataGo API returned status ${res.statusCode}: ${responseData.substring(0, 500)}`));
                        }
                    });
                });
                
                req.on('error', (error) => {
                    console.error(`[KataGo HTTP] Request error for queryId=${cleanQuery.id}:`, error);
                    console.error(`[KataGo HTTP] Error details: message=${error.message}, code=${(error as any).code}, stack=${error instanceof Error ? error.stack : 'N/A'}`);
                    reject(new Error(`KataGo API request failed: ${error.message}`));
                });
                
                req.on('timeout', () => {
                    console.error(`[KataGo HTTP] Request timeout for queryId=${cleanQuery.id} after ${timeoutSeconds} seconds`);
                    req.destroy();
                    reject(new Error(`KataGo API request timed out after ${timeoutSeconds} seconds`));
                });
                
                req.write(postData);
                req.end();
            });
            
            return response;
        } catch (error: any) {
            // 재시도 가능한 에러인지 확인 (네트워크 에러, 타임아웃, 상대가 먼저 끊은 소켓 등)
            const msg = String(error?.message ?? '');
            const code = (error as any)?.code as string | undefined;
            const isRetryableError =
                msg.includes('timeout') ||
                msg.includes('ECONNREFUSED') ||
                msg.includes('ENOTFOUND') ||
                msg.includes('ETIMEDOUT') ||
                msg.includes('socket hang up') ||
                msg.includes('ECONNRESET') ||
                code === 'ECONNREFUSED' ||
                code === 'ENOTFOUND' ||
                code === 'ETIMEDOUT' ||
                code === 'ECONNRESET' ||
                code === 'EPIPE' ||
                code === 'ECONNABORTED';
            
            if (isRetryableError && retryCount < MAX_RETRIES) {
                console.warn(`[KataGo HTTP] Retryable error occurred (attempt ${retryCount + 1}/${MAX_RETRIES + 1}): ${error.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return queryKataGoViaHttp(analysisQuery, apiUrl, retryCount + 1, clientOpts);
            }
            
            // 재시도 불가능하거나 최대 재시도 횟수 초과
            throw error;
        }
    };

    try {
        console.log(`[KataGo] ========================================`);
        console.log(`[KataGo] Starting analysis query for game ${session.id}`);
        console.log(`[KataGo] Game details: isSinglePlayer=${session.isSinglePlayer}, stageId=${session.stageId}, mode=${session.mode}`);
        console.log(`[KataGo] Query details: boardSize=${query.boardXSize}x${query.boardYSize}, moves=${query.moves?.length || 0}, initialStones=${(query as any).initialStones?.length || 0}`);
        console.log(`[KataGo] Limits: maxVisits=${query.maxVisits ?? 'n/a'}, maxTime=${query.overrideSettings?.maxTime ?? 'n/a'}s, includeOwnership=${!!query.includeOwnership}, includePolicy=${!!query.includePolicy}`);
        console.log(`[KataGo] Configuration: USE_HTTP_API=${USE_HTTP_API}, KATAGO_API_URL=${KATAGO_API_URL || 'not set'}, IS_LOCAL=${IS_LOCAL}`);
        console.log(`[KataGo] KataGo config: NUM_ANALYSIS_THREADS=${KATAGO_NUM_ANALYSIS_THREADS}, NUM_SEARCH_THREADS=${KATAGO_NUM_SEARCH_THREADS}, MAX_VISITS=${KATAGO_MAX_VISITS}, NN_MAX_BATCH_SIZE=${KATAGO_NN_MAX_BATCH_SIZE}`);
        console.log(`[KataGo] ========================================`);
        
        // 쿼리 검증
        if (!query.boardXSize || !query.boardYSize) {
            throw new Error(`Invalid board size: ${query.boardXSize}x${query.boardYSize}`);
        }
        if ((query.moves?.length || 0) === 0 && ((query as any).initialStones?.length || 0) === 0) {
            console.warn(`[KataGo] Warning: Empty moves and initialStones for game ${session.id}, but continuing analysis`);
        }
        
        let response: any;
        
        // HTTP API를 사용하는 경우
        if (USE_HTTP_API) {
            if (!KATAGO_API_URL) {
                console.error(`[KataGo] ERROR: KATAGO_API_URL is not configured!`);
                throw new Error('KATAGO_API_URL is not configured. Please set KATAGO_API_URL environment variable.');
            }
            console.log(`[KataGo] Using HTTP API: ${KATAGO_API_URL}`);
            const startTime = Date.now();
            try {
                response = await queryKataGoViaHttp(query, undefined, 0, httpTransportOpts);
                const duration = Date.now() - startTime;
                console.log(`[KataGo] KataGo HTTP 호출 소요: ${(duration / 1000).toFixed(2)}초 (${duration}ms)`);
            } catch (httpError: any) {
                const duration = Date.now() - startTime;
                console.error(`[KataGo] HTTP API request failed after ${(duration / 1000).toFixed(2)}초 (${duration}ms):`, httpError.message);
                throw httpError;
            }
        } else {
            // 로컬 환경에서도 로컬 KataGo 프로세스를 사용할 수 있도록 허용
            // (로컬에 KataGo binary와 모델 파일이 있는 경우)
            if (IS_LOCAL) {
                // 로컬 환경에서 KATAGO_API_URL이 설정되어 있으면 HTTP API 사용
                if (KATAGO_API_URL) {
                    console.log(`[KataGo] Local environment detected. Using HTTP API: ${KATAGO_API_URL}`);
                    const startTime = Date.now();
                    response = await queryKataGoViaHttp(query, KATAGO_API_URL, 0, httpTransportOpts);
                    const duration = Date.now() - startTime;
                    console.log(`[KataGo] KataGo HTTP 호출 소요: ${(duration / 1000).toFixed(2)}초 (${duration}ms)`);
                } else {
                    // 로컬 환경에서 KATAGO_API_URL이 없으면 로컬 프로세스 사용 시도
                    console.log(`[KataGo] Local environment detected. Attempting to use local KataGo process...`);
                    try {
                        const startTime = Date.now();
                        response = await getKataGoManager().query(query);
                        const duration = Date.now() - startTime;
                        console.log(`[KataGo] 계가 로컬 프로세스 소요: ${(duration / 1000).toFixed(2)}초 (${duration}ms)`);
                    } catch (localError: any) {
                        console.error(`[KataGo] Failed to use local KataGo process: ${localError.message}`);
                        console.error(`[KataGo] To use HTTP API instead, set KATAGO_API_URL environment variable.`);
                        throw localError;
                    }
                }
            } else {
                // 배포 환경에서 로컬 프로세스 사용
                console.log(`[KataGo] Using local KataGo process (not HTTP API)`);
                const startTime = Date.now();
                response = await getKataGoManager().query(query);
                const duration = Date.now() - startTime;
                console.log(`[KataGo] 계가 로컬 프로세스 소요: ${(duration / 1000).toFixed(2)}초 (${duration}ms)`);
            }
        }

        console.log(`[KataGo] Analysis query completed for game ${session.id}`);
        return kataGoResponseToAnalysisResult(session, response, isCurrentPlayerWhite);
    } catch (error) {
        console.error('[KataGo] Analysis query failed:', error);
        console.error('[KataGo] Error details:', error instanceof Error ? error.message : String(error));
        console.error('[KataGo] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // 수동 계가 폴백 없음: 무조건 KataGo 결과만 사용. 실패 시 호출자가 재시도하거나 에러 처리.
        throw error;
    }
};