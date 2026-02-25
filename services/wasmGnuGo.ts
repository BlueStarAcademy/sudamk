/**
 * WASM GnuGo: 브라우저에서 GnuGo(gnugo.js) 로드 후 AI 수 생성
 * AI 대국 입장 시 최초 1회 로드해 클라이언트에서만 수를 두도록 함.
 */

const GNUGO_CDN_URL = 'https://cdn.jsdelivr.net/gh/dna2ai/gnugo.js@main/dist/gnugo.js';
/** Try local build first (public/gnugo/ or public/gnugo/dist/); fallback to CDN. Override with __GNUGO_WASM_URL (see docs/WASM_GNUGO_PASS.md). */
const GNUGO_SCRIPT_URLS: string[] =
    typeof window !== 'undefined' && (window as any).__GNUGO_WASM_URL
        ? [(window as any).__GNUGO_WASM_URL]
        : ['/gnugo/gnugo.js', '/gnugo/dist/gnugo.js', GNUGO_CDN_URL];

export interface WasmGnuGoRequest {
    boardState: number[][];
    boardSize: number;
    player: string;
    moveHistory: Array<{ x: number; y: number; player: number }>;
    level?: number;
}

export interface WasmGnuGoResult {
    move?: { x: number; y: number };
    error?: string;
}

declare global {
    interface Window {
        Module?: {
            onRuntimeInitialized?: () => void;
            locateFile?: (path: string, prefix: string) => string;
            _initializeGoGame?: (boardSize: number, komi: number, handicap: number, seed: number) => void;
            _finalizeGoGame?: () => void;
            _getBoard?: (i: number, j: number) => number;
            _isLastMove?: (i: number, j: number) => number;
            _genNextStep?: () => number;
            _moveTo?: (i: number, j: number) => number;
            /** Optional: play a pass for current side (required to replay history that contains passes). */
            _playPass?: () => number;
            then?: (cb: (mod: any) => void) => void;
        };
    }
}

let moduleReady: Promise<typeof window.Module> | null = null;

function getModulePromise(): Promise<typeof window.Module> {
    if (moduleReady) return moduleReady;
    moduleReady = new Promise<typeof window.Module>((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('window not available'));
            return;
        }
        const urls = [...GNUGO_SCRIPT_URLS];
        let index = 0;
        const tryNext = (): void => {
            if (index >= urls.length) {
                reject(new Error('Failed to load GnuGo WASM from any URL'));
                return;
            }
            const scriptUrl = urls[index];
            const baseUrl = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
            const prevModule = window.Module;
            window.Module = {
                ...(prevModule || {}),
                locateFile(path: string, prefix: string): string {
                    if (path.endsWith('.wasm')) return baseUrl + path;
                    return prefix + path;
                },
                onRuntimeInitialized() {
                    if (window.Module && (window.Module._initializeGoGame || (window.Module as any)._initializeGoGame)) {
                        resolve(window.Module);
                    } else {
                        index++;
                        tryNext();
                    }
                },
            };
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.onerror = () => {
                index++;
                tryNext();
            };
            script.onload = () => {
                const M = window.Module;
                if (!M) {
                    index++;
                    tryNext();
                    return;
                }
                if ((M as any).then != null) {
                    (M as any).then(() => resolve(M));
                    return;
                }
                if (M._initializeGoGame != null || (M as any).initializeGoGame != null) {
                    resolve(M);
                    return;
                }
                (M as any).onRuntimeInitialized = () => resolve(M);
            };
            document.head.appendChild(script);
        };
        tryNext();
    });
    return moduleReady;
}

/** 클라이언트에서 WASM GnuGo 사용 가능 여부 (로드 완료 후 true) */
export function isAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).__wasmGnuGoReady;
}

/** Electron 또는 WASM GnuGo가 로드되면 클라이언트 측 AI 사용 가능 (WASM은 패 포함 국면에서 lightGoAi로 폴백) */
export function shouldUseClientSideAi(): boolean {
    if (typeof window === 'undefined') return false;
    const hasElectron = !!(window as any).electron;
    // 브라우저: WASM 로드 시 클라이언트 AI 사용. 미로드 시에도 lightGoAi로 대국 가능하므로 웹에서는 항상 true (서버 부하 없음)
    const webWantsClientAi = typeof (window as any).electron === 'undefined';
    return hasElectron || (webWantsClientAi || isAvailable());
}

export function setWasmGnuGoReady(ready: boolean): void {
    if (typeof window !== 'undefined') (window as any).__wasmGnuGoReady = ready;
}

/**
 * GnuGo WASM 모듈 로드 (AI 대국 입장 시 최초 1회 호출 권장)
 */
export function loadWasmGnuGo(): Promise<boolean> {
    return getModulePromise()
        .then((mod) => {
            if (mod && (mod._initializeGoGame || (mod as any)._initializeGoGame)) {
                setWasmGnuGoReady(true);
                return true;
            }
            setWasmGnuGoReady(false);
            return false;
        })
        .catch(() => {
            setWasmGnuGoReady(false);
            return false;
        });
}

type GnuGoWasmModule = NonNullable<typeof window.Module> & {
    _initializeGoGame?: (boardSize: number, komi: number, handicap: number, seed: number) => void;
    _finalizeGoGame?: () => void;
    _getBoard?: (i: number, j: number) => number;
    _isLastMove?: (i: number, j: number) => number;
    _genNextStep?: () => number;
    _moveTo?: (i: number, j: number) => number;
    _playPass?: () => number;
};

// dna2ai/gnugo.js wrapper uses board[i][j] where i=row, j=col. In our app boardState[y][x].
function toEngineIJ(x: number, y: number): { i: number; j: number } {
    return { i: y, j: x };
}

function fromEngineIJ(i: number, j: number): { x: number; y: number } {
    return { x: j, y: i };
}

function normalizePlayerStr(p: string): 'black' | 'white' {
    return p?.toLowerCase() === 'white' ? 'white' : 'black';
}

/**
 * NOTE: Standard dna2ai/gnugo.js does not expose "pass"; if the wrapper exposes _playPass(),
 * we can replay history that contains passes and keep WASM level.
 * - `_moveTo(i,j)` always plays for the internal `to_move` and then flips.
 * - `_genNextStep()` generates a move for the internal `to_move` and then flips.
 * - When _playPass is present, we call it for each pass in history so the engine state matches.
 * We require: handicap=0, moveHistory strictly alternating (Black first).
 */
function canReplayExactlyWithWasm(
    moveHistory: Array<{ x: number; y: number; player: number }>,
    hasPlayPass: boolean
): { ok: boolean; reason?: string } {
    if (moveHistory.some((m) => m.x === -1 && m.y === -1) && !hasPlayPass) {
        return { ok: false, reason: 'pass-not-supported' };
    }
    for (let k = 0; k < moveHistory.length; k++) {
        const expected = k % 2 === 0 ? 1 : 2;
        const actual = moveHistory[k]?.player;
        if (actual !== expected) {
            return { ok: false, reason: 'non-alternating-history' };
        }
    }
    return { ok: true };
}

function applyLevelIfPossible(_mod: GnuGoWasmModule, _level?: number): void {
    // dna2ai wrapper does not expose a level setter. We keep the parameter for API parity.
}

/**
 * WASM GnuGo로 다음 수 계산. 패가 포함된 수순은 래퍼에 _playPass가 있을 때만 재현 가능.
 */
export async function getWasmGnuGoMove(request: WasmGnuGoRequest): Promise<WasmGnuGoResult> {
    const { boardSize, moveHistory = [] } = request;
    const size = Math.max(9, Math.min(19, boardSize || 19));
    const komi = 0.5;

    try {
        const Mod = (await getModulePromise()) as GnuGoWasmModule;
        const playPass = Mod._playPass ?? (Mod as any).playPass;
        const hasPlayPass = typeof playPass === 'function';
        const replayCheck = canReplayExactlyWithWasm(moveHistory, hasPlayPass);
        if (!replayCheck.ok) {
            return { error: `WASM GnuGo cannot reproduce history reliably (${replayCheck.reason})` };
        }

        const init = Mod._initializeGoGame || (Mod as any).initializeGoGame;
        const moveTo = Mod._moveTo || (Mod as any).moveTo;
        const genNext = Mod._genNextStep || (Mod as any).genNextStep;
        const getBoard = Mod._getBoard || (Mod as any).getBoard;
        const isLastMove = Mod._isLastMove || (Mod as any).isLastMove;

        if (!init || !moveTo || !genNext || !getBoard || !isLastMove) {
            return { error: 'GnuGo WASM API not found' };
        }

        init(size, komi, 0, Date.now());
        applyLevelIfPossible(Mod, request.level);

        const desiredToMove = normalizePlayerStr(request.player);
        const engineToMoveAfterReplay = (moveHistory.length % 2 === 0) ? 'black' : 'white';
        if (desiredToMove !== engineToMoveAfterReplay) {
            const finalize = Mod._finalizeGoGame || (Mod as any).finalizeGoGame;
            if (typeof finalize === 'function') finalize();
            return { error: `WASM GnuGo cannot set side-to-move (wanted=${desiredToMove}, derived=${engineToMoveAfterReplay})` };
        }

        for (const m of moveHistory) {
            if (m.x === -1 && m.y === -1) {
                if (!hasPlayPass) return { error: 'WASM GnuGo cannot replay pass (no _playPass)' };
                const ret = playPass!();
                if (ret !== 0) return { error: `Replay pass failed: ${ret}` };
                continue;
            }
            if (m.x < 0 || m.y < 0 || m.x >= size || m.y >= size) continue;
            const { i, j } = toEngineIJ(m.x, m.y);
            const ret = moveTo(i, j);
            if (ret !== 0) return { error: `Replay move failed at (${m.x},${m.y}) [i=${i},j=${j}]: ${ret}` };
        }

        const before: number[][] = [];
        for (let i = 0; i < size; i++) {
            before[i] = [];
            for (let j = 0; j < size; j++) before[i][j] = getBoard(i, j);
        }

        genNext();

        let moveX = -1;
        let moveY = -1;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (isLastMove(i, j)) {
                    const p = fromEngineIJ(i, j);
                    moveX = p.x;
                    moveY = p.y;
                    break;
                }
            }
            if (moveX >= 0) break;
        }
        if (moveX < 0 && moveY < 0) {
            let changed = false;
            for (let i = 0; i < size && !changed; i++)
                for (let j = 0; j < size && !changed; j++)
                    if (getBoard(i, j) !== before[i][j]) changed = true;
            if (!changed) {
                const finalize = Mod._finalizeGoGame || (Mod as any).finalizeGoGame;
                if (typeof finalize === 'function') finalize();
                // Engine passed: return pass so caller keeps WASM level (PASS_TURN).
                return { move: { x: -1, y: -1 } };
            }
        }
        const finalize = Mod._finalizeGoGame || (Mod as any).finalizeGoGame;
        if (typeof finalize === 'function') finalize();
        return { move: { x: moveX, y: moveY } };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: msg };
    }
}
