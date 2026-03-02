/**
 * GnuGo Service
 * 
 * Provides GnuGo AI engine integration using GTP (Go Text Protocol)
 * GnuGo is used as the primary AI for game moves, with goAiBot as fallback
 */

import { spawn, ChildProcess } from 'child_process';
import { Point } from '../types/index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GTP coordinate letters (19x19 board)
const LETTERS = "ABCDEFGHJKLMNOPQRST";

// GnuGo command path (default to system 'gnugo' command, can be overridden)
const GNUGO_PATH = process.env.GNUGO_PATH || 'gnugo';
const GNUGO_LEVEL = parseInt(process.env.GNUGO_LEVEL || '10', 10); // Level 1-10 (10 is strongest)

/** GTP setup/play 명령 타임아웃(ms). 수순이 길 때 play가 느려질 수 있음. */
const GTP_PLAY_TIMEOUT_MS = Math.max(2000, parseInt(process.env.GNUGO_PLAY_TIMEOUT_MS || '6000', 10));
/** GTP genmove 타임아웃(ms). */
const GTP_GENMOVE_TIMEOUT_MS = Math.max(10000, parseInt(process.env.GNUGO_GENMOVE_TIMEOUT_MS || '20000', 10));

// HTTP API URL for GnuGo service (Railway deployment)
// 주의: Railway 멀티서비스 구조에서 자동 도메인 추론은 백엔드 자기 자신을 가리킬 수 있어
// 반드시 GNUGO_API_URL을 명시적으로 설정하는 것을 권장합니다.
const IS_LOCAL = process.env.NODE_ENV !== 'production';
let GNUGO_API_URL: string | undefined = process.env.GNUGO_API_URL?.trim();

// 프로토콜이 없으면 자동으로 https:// 추가
if (GNUGO_API_URL && !GNUGO_API_URL.match(/^https?:\/\//)) {
    GNUGO_API_URL = `https://${GNUGO_API_URL}`;
}
const USE_HTTP_API = !!GNUGO_API_URL && GNUGO_API_URL.trim() !== '';

/** 동시에 처리할 GnuGo 프로세스 수. 2 이상이면 풀 사용, 동시 요청이 느려지지 않음. */
const GNUGO_POOL_SIZE = Math.max(1, parseInt(process.env.GNUGO_POOL_SIZE || '4', 10));

interface GnuGoManager {
    process: ChildProcess | null;
    isStarting: boolean;
    isReady: boolean;
    lastError: Error | null;
    /** 풀 사용 시 동시 처리 가능 개수 */
    poolSize?: number;
}

interface GenerateMoveRequest {
    boardState: number[][];
    boardSize: number;
    player: 'black' | 'white' | string;
    moveHistory: Array<{ x: number; y: number; player: number }>;
    /** GnuGo level 1-10 (optional, per-request override) */
    level?: number;
}

// Singleton manager instance
let gnuGoManager: GnuGoManager = {
    process: null,
    isStarting: false,
    isReady: false,
    lastError: null
};

// 프로세스 풀: 동시 N개 요청 처리 (국면 겹침 없음)
const processPool: ChildProcess[] = [];
const availablePool: ChildProcess[] = [];
const waitQueue: Array<(p: ChildProcess) => void> = [];

function removeFromPool(proc: ChildProcess): void {
    const idx = processPool.indexOf(proc);
    if (idx !== -1) processPool.splice(idx, 1);
    const availIdx = availablePool.indexOf(proc);
    if (availIdx !== -1) availablePool.splice(availIdx, 1);
}

function acquireProcess(): Promise<ChildProcess> {
    while (availablePool.length > 0) {
        const p = availablePool.pop()!;
        if (!p.killed) return Promise.resolve(p);
        removeFromPool(p);
    }
    return new Promise<ChildProcess>((resolve) => {
        waitQueue.push((p: ChildProcess) => resolve(p));
    });
}

function releaseProcess(proc: ChildProcess): void {
    if (proc.killed) {
        removeFromPool(proc);
    } else {
        availablePool.push(proc);
    }
    if (waitQueue.length > 0 && availablePool.length > 0) {
        const next = waitQueue.shift()!;
        const p = availablePool.pop()!;
        next(p);
    }
}

/**
 * Convert point to GTP coordinate format
 * GTP uses letters (A-T, skipping I) for columns and numbers (1-19) for rows
 */
function pointToGtpCoord(point: Point, boardSize: number): string {
    if (point.x === -1 || point.y === -1) {
        return 'pass';
    }
    if (point.x >= 0 && point.x < LETTERS.length && point.y >= 0 && point.y < boardSize) {
        const letter = LETTERS[point.x];
        const row = boardSize - point.y; // GTP uses 1-19 from bottom, we use 0-18 from top
        return `${letter}${row}`;
    }
    return 'pass';
}

/**
 * Convert GTP coordinate to point.
 * boardSize가 9인데 row 16 등이 오면 GnuGo가 boardsize를 안 쓴 것이므로 에러를 던져 호출자가 폴백하도록 함.
 */
function gtpCoordToPoint(coord: string, boardSize: number): Point {
    const normalized = coord.trim().toUpperCase();
    if (normalized === 'PASS' || normalized === '') {
        return { x: -1, y: -1 };
    }
    const letter = normalized.charAt(0);
    const x = LETTERS.indexOf(letter);
    if (x === -1) {
        throw new Error(`Invalid GTP coordinate letter: ${letter} (boardSize=${boardSize})`);
    }
    const rowStr = normalized.substring(1);
    const row = parseInt(rowStr, 10);
    if (isNaN(row) || row < 1 || row > boardSize) {
        throw new Error(`Invalid GTP coordinate row: ${rowStr} for boardSize=${boardSize} (GnuGo may not have received boardsize ${boardSize})`);
    }
    if (x >= boardSize) {
        throw new Error(`Invalid GTP column: ${letter} for boardSize=${boardSize}`);
    }
    const y = boardSize - row;
    return { x, y };
}

/**
 * Convert board state and move history to GTP commands.
 * 9x9 등 19가 아닌 크기에서는 반드시 boardsize를 먼저 보내야 GnuGo가 올바른 좌표로 응답함.
 */
function boardStateToGtpCommands(
    boardState: number[][],
    boardSize: number,
    moveHistory: Array<{ x: number; y: number; player: number }>,
    currentPlayer: 'black' | 'white' | string
): string[] {
    const commands: string[] = [];
    commands.push(`boardsize ${boardSize}`);
    commands.push('clear_board');
    
    // Play moves from history
    for (const move of moveHistory) {
        if (move.x === -1 || move.y === -1) {
            // Pass
            const color = move.player === 1 ? 'black' : 'white'; // Assuming 1=Black, 2=White
            commands.push(`play ${color} pass`);
        } else {
            const color = move.player === 1 ? 'black' : 'white';
            const coord = pointToGtpCoord({ x: move.x, y: move.y }, boardSize);
            if (coord !== 'pass') {
                commands.push(`play ${color} ${coord}`);
            }
        }
    }
    
    return commands;
}

/**
 * Send GTP command and get response
 */
function sendGtpCommand(process: ChildProcess, command: string, timeout: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!process.stdin || !process.stdout) {
            reject(new Error('GnuGo process stdio not available'));
            return;
        }
        
        let response = '';
        let responseComplete = false;
        
        const timeoutId = setTimeout(() => {
            if (!responseComplete) {
                responseComplete = true;
                reject(new Error(`GTP command timeout: ${command}`));
            }
        }, timeout);
        
        const dataHandler = (data: Buffer) => {
            const text = data.toString();
            response += text;
            
            // GTP responses end with empty line after the response
            if (text.includes('\n\n') || text.match(/^=\s*\n$/m)) {
                clearTimeout(timeoutId);
                if (!responseComplete) {
                    responseComplete = true;
                    process.stdout?.removeListener('data', dataHandler);
                    resolve(response);
                }
            }
        };
        
        process.stdout.once('data', dataHandler);
        
        // Send command
        process.stdin.write(command + '\n', (err) => {
            if (err) {
                clearTimeout(timeoutId);
                if (!responseComplete) {
                    responseComplete = true;
                    process.stdout?.removeListener('data', dataHandler);
                    reject(err);
                }
            }
        });
    });
}

/**
 * Initialize GnuGo process(es) - 풀 사용 시 동시 N개 요청 처리
 */
export async function initializeGnuGo(): Promise<void> {
    if (processPool.length > 0 && processPool.some(p => !p.killed)) {
        console.log('[GnuGo Service] GnuGo pool already running');
        return;
    }
    if (gnuGoManager.isStarting) {
        console.log('[GnuGo Service] GnuGo initialization already in progress');
        return;
    }

    gnuGoManager.isStarting = true;
    gnuGoManager.lastError = null;
    processPool.length = 0;
    availablePool.length = 0;
    waitQueue.length = 0;

    const poolSize = GNUGO_POOL_SIZE;
    console.log(`[GnuGo Service] Starting GnuGo pool: ${GNUGO_PATH}, size=${poolSize}, level=${GNUGO_LEVEL}`);

    try {
        for (let i = 0; i < poolSize; i++) {
            const proc = spawn(GNUGO_PATH, ['--mode', 'gtp', '--level', GNUGO_LEVEL.toString()], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            proc.on('error', (error) => {
                console.error(`[GnuGo Service] Process ${i} error:`, error);
                gnuGoManager.lastError = error as Error;
                removeFromPool(proc);
            });
            proc.on('exit', (code, signal) => {
                console.log(`[GnuGo Service] Process ${i} exited: code=${code}, signal=${signal}`);
                removeFromPool(proc);
                gnuGoManager.process = processPool[0] ?? null;
                if (processPool.length === 0) gnuGoManager.isReady = false;
            });
            proc.stderr?.on('data', (data) => {
                const text = data.toString();
                if (text.includes('error') || text.includes('Error')) console.warn(`[GnuGo Service] stderr [${i}]:`, text.trim());
            });

            await new Promise(r => setTimeout(r, 200));
            try {
                await sendGtpCommand(proc, 'version', 3000);
            } catch (e: any) {
                console.warn(`[GnuGo Service] Process ${i} version check failed:`, e?.message);
                proc.kill();
                continue;
            }
            processPool.push(proc);
            availablePool.push(proc);
        }

        gnuGoManager.process = processPool[0] ?? null;
        gnuGoManager.isReady = processPool.length > 0;
        gnuGoManager.poolSize = processPool.length;
        gnuGoManager.isStarting = false;
        console.log(`[GnuGo Service] ✅ GnuGo pool initialized: ${processPool.length} process(es)`);
    } catch (error: any) {
        console.error('[GnuGo Service] Failed to initialize GnuGo pool:', error);
        gnuGoManager.lastError = error;
        gnuGoManager.isReady = false;
        gnuGoManager.isStarting = false;
    }
}

/**
 * Generate move using GnuGo via HTTP API
 */
async function generateGnuGoMoveViaHttp(request: GenerateMoveRequest, apiUrl?: string): Promise<Point> {
    const urlToUse = apiUrl || GNUGO_API_URL;
    if (!urlToUse) {
        throw new Error('GNUGO_API_URL is not set');
    }
    
    const url = new URL(urlToUse);
    const httpModule = url.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
        const body: Record<string, unknown> = {
            boardState: request.boardState,
            boardSize: request.boardSize,
            player: request.player,
            moveHistory: request.moveHistory
        };
        if (request.level !== undefined && request.level >= 1 && request.level <= 10) {
            body.level = request.level;
        }
        const requestData = JSON.stringify(body);
        
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            },
            timeout: 5000
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        reject(new Error(`GnuGo API error: ${res.statusCode} - ${data}`));
                        return;
                    }
                    
                    const response = JSON.parse(data);
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    
                    if (!response.move || typeof response.move.x === 'undefined' || typeof response.move.y === 'undefined') {
                        reject(new Error('Invalid GnuGo API response'));
                        return;
                    }
                    
                    resolve(response.move);
                } catch (error: any) {
                    reject(new Error(`Failed to parse GnuGo API response: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('GnuGo API request timeout'));
        });
        
        req.write(requestData);
        req.end();
    });
}

/**
 * Generate move using GnuGo (supports both local process and HTTP API)
 */
export async function generateGnuGoMove(request: GenerateMoveRequest): Promise<Point> {
    const { boardState, boardSize, player, moveHistory } = request;
    
    // Try HTTP API first if available
    if (USE_HTTP_API && GNUGO_API_URL) {
        try {
            console.log(`[GnuGo Service] Using HTTP API: ${GNUGO_API_URL}`);
            return await generateGnuGoMoveViaHttp(request);
        } catch (error: any) {
            const msg = error?.message || String(error);
            console.warn('[GnuGo Service] HTTP API failed:', msg);
            if (msg.includes('ECONNREFUSED') || msg.includes('timeout') || msg.includes('ENOTFOUND')) {
                console.warn('[GnuGo Service] GnuGo 서비스 연결 실패. GNUGO_API_URL 확인: ' + (GNUGO_API_URL ? '설정됨' : '미설정'));
            }
            // Fall through to local process (로컬 없으면 goAiBot fallback으로 전달)
        }
    }
    
    // Use local process pool
    if (!gnuGoManager.isReady || processPool.length === 0) {
        throw new Error('GnuGo is not ready and HTTP API is not available');
    }

    const process = await acquireProcess();
    try {
        const color = player.toLowerCase() === 'white' ? 'white' : 'black';
        const setupCommands = boardStateToGtpCommands(boardState, boardSize, moveHistory, color);
        for (const cmd of setupCommands) {
            await sendGtpCommand(process, cmd, GTP_PLAY_TIMEOUT_MS);
        }
        const levelToUse = (request as GenerateMoveRequest).level;
        if (levelToUse !== undefined && levelToUse >= 1 && levelToUse <= 10) {
            await sendGtpCommand(process, `level ${levelToUse}`, GTP_PLAY_TIMEOUT_MS);
        }
        const genMoveResponse = await sendGtpCommand(process, `genmove ${color}`, GTP_GENMOVE_TIMEOUT_MS);
        const match = genMoveResponse.match(/^=\s*([A-T]\d+|pass)/im);
        if (!match) throw new Error(`Invalid genmove response: ${genMoveResponse}`);
        const point = gtpCoordToPoint(match[1], boardSize);
        return point;
    } catch (error: any) {
        console.error('[GnuGo Service] Error generating move:', error);
        gnuGoManager.lastError = error;
        throw error;
    } finally {
        releaseProcess(process);
    }
}

/**
 * Get GnuGo manager instance
 */
export function getGnuGoManager(): GnuGoManager {
    return gnuGoManager;
}

/**
 * Check if GnuGo is available (HTTP API or local process pool)
 * 전략바둑 대기실 AI봇: GNUGO_API_URL이 설정되어 있으면 원격 GnuGo 서비스를 사용하고,
 * 설정이 없거나 API 호출이 실패하면 내부 goAiBot(휴리스틱)으로 자동 대체됩니다.
 */
export function isGnuGoAvailable(): boolean {
    if (USE_HTTP_API && GNUGO_API_URL) return true;
    return gnuGoManager.isReady && processPool.length > 0 && processPool.some(p => !p.killed);
}

/** 전략바둑/싱글플레이에서 GnuGo 사용 가능 여부 요약 (로그·디버깅용) */
export function getGnuGoStatusSummary(): { available: boolean; reason: string } {
    if (USE_HTTP_API && GNUGO_API_URL) {
        return { available: true, reason: `HTTP API 사용: ${GNUGO_API_URL}` };
    }
    if (gnuGoManager.isReady && processPool.length > 0) {
        return { available: true, reason: '로컬 GnuGo 프로세스 풀 사용' };
    }
    return {
        available: false,
        reason: process.env.GNUGO_API_URL
            ? 'GNUGO_API_URL 설정됐으나 서비스 연결 실패 가능성 (타임아웃/다운 시 내부 AI로 대체)'
            : 'GNUGO_API_URL 미설정 — 전략바둑 AI는 내부 goAiBot(휴리스틱)만 사용',
    };
}

