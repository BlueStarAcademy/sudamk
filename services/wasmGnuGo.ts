/**
 * WASM GnuGo: 브라우저에서 GnuGo(gnugo.js) 로드 후 AI 수 생성
 * AI 대국 입장 시 최초 1회 로드해 클라이언트에서만 수를 두도록 함.
 */

const GNUGO_SCRIPT_URL =
    typeof window !== 'undefined' && (window as any).__GNUGO_WASM_URL
        ? (window as any).__GNUGO_WASM_URL
        : 'https://cdn.jsdelivr.net/gh/dna2ai/gnugo.js@main/dist/gnugo.js';

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
        const baseUrl = GNUGO_SCRIPT_URL.substring(0, GNUGO_SCRIPT_URL.lastIndexOf('/') + 1);
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
                    reject(new Error('GnuGo WASM init callback but API not found'));
                }
            },
        };
        const script = document.createElement('script');
        script.src = GNUGO_SCRIPT_URL;
        script.async = true;
        script.onerror = () => reject(new Error('Failed to load GnuGo WASM script'));
        script.onload = () => {
            const M = window.Module;
            if (!M) return;
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
    });
    return moduleReady;
}

/** 클라이언트에서 WASM GnuGo 사용 가능 여부 (로드 완료 후 true) */
export function isAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).__wasmGnuGoReady;
}

/** Electron 또는 WASM GnuGo가 있으면 클라이언트 측 AI 사용 가능 */
export function shouldUseClientSideAi(): boolean {
    if (typeof window === 'undefined') return false;
    // 기본 정책:
    // - Electron(설치형)에서는 로컬 Gnugo 사용 가능 → 클라이언트 AI 허용
    // - 브라우저 WASM(dna2ai/gnugo.js)은 pass/색지정 등 한계로 국면 재현이 완전하지 않아
    //   기본적으로 서버 Gnugo(또는 서버 검증) 경로를 우선하도록 비활성화.
    //   필요 시 디버그/실험 목적으로 전역 플래그로 강제 활성화 가능.
    const hasElectron = !!(window as any).electron;
    const forceWasm = (window as any).__ENABLE_WASM_GNUGO_AI === true;
    return hasElectron || (forceWasm && isAvailable());
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
 * NOTE: dna2ai/gnugo.js wrapper does not expose "pass", "undo", nor explicit color-play.
 * - `_moveTo(i,j)` always plays for the internal `to_move` and then flips.
 * - `_genNextStep()` generates a move for the internal `to_move` and then flips.
 * Because of that limitation, we can only safely use WASM in positions that:
 * - have no pass in history,
 * - start from standard initial position (handicap=0),
 * - and have moveHistory with strictly alternating colors starting with Black.
 * Otherwise, the engine state cannot be reproduced reliably, which will desync with server rules.
 */
function canReplayExactlyWithWasm(moveHistory: Array<{ x: number; y: number; player: number }>): { ok: boolean; reason?: string } {
    // No pass supported by wrapper (there is no API to push a pass into SGF/to_move).
    if (moveHistory.some((m) => m.x === -1 && m.y === -1)) {
        return { ok: false, reason: 'pass-not-supported' };
    }
    // Require explicit alternating 1(B),2(W),1(B)...
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
 * WASM GnuGo로 다음 수 계산. moveHistory에 패가 있으면 에러 반환(엔진이 패를 지원하지 않음).
 */
export async function getWasmGnuGoMove(request: WasmGnuGoRequest): Promise<WasmGnuGoResult> {
    const { boardSize, moveHistory = [] } = request;
    const size = Math.max(9, Math.min(19, boardSize || 19));
    const komi = 0.5;

    const replayCheck = canReplayExactlyWithWasm(moveHistory);
    if (!replayCheck.ok) {
        // Let caller fall back to server AI.
        return { error: `WASM GnuGo cannot reproduce history reliably (${replayCheck.reason})` };
    }

    try {
        const Mod = (await getModulePromise()) as GnuGoWasmModule;
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

        // Ensure the engine's to_move matches the requested genmove color.
        // With strict alternating history (starting Black), to_move is:
        // - Black if even number of moves played
        // - White if odd number of moves played
        const desiredToMove = normalizePlayerStr(request.player);
        const engineToMoveAfterReplay = (moveHistory.length % 2 === 0) ? 'black' : 'white';
        if (desiredToMove !== engineToMoveAfterReplay) {
            const finalize = Mod._finalizeGoGame || (Mod as any).finalizeGoGame;
            if (typeof finalize === 'function') finalize();
            return { error: `WASM GnuGo cannot set side-to-move (wanted=${desiredToMove}, derived=${engineToMoveAfterReplay})` };
        }

        for (const m of moveHistory) {
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
                // Wrapper doesn't support pass; if it made no change we treat as "no move".
                return { error: 'WASM GnuGo returned no move (pass/unknown)' };
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
