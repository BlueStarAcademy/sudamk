import { Player, type LiveGameSession, GameMode } from '../types/index.js';

/** 놀이바둑: moveHistory를 사용하지 않으므로 syncAiSession에서 moveCount로 lastProcessedMoveCount를 덮어쓰면 다음 AI 턴이 막힘 */
const PLAYFUL_MODES_NO_MOVE_HISTORY: GameMode[] = [
    GameMode.Alkkagi,
    GameMode.Curling,
    GameMode.Dice,
    GameMode.Omok,
    GameMode.Ttamok,
    GameMode.Thief,
];

interface AiSession {
    gameId: string;
    /**
     * 현재 AI가 수를 계산 중인지 여부
     * true면 다른 계산을 시작하지 않도록 차단
     */
    isProcessing: boolean;
    /** isProcessing이 true가 된 시각 (장시간 미해제 시 강제 리셋용) */
    processingStartedAt?: number;
    /**
     * 마지막으로 AI가 처리한 수의 개수 (moveHistory 길이)
     * 동일한 값 이하일 경우 이미 처리된 턴으로 간주하여 중복 계산을 방지
     */
    lastProcessedMoveCount: number;
    /**
     * 최근 업데이트 타임스탬프 (ms)
     * 오래된 세션을 정리할 때 사용
     */
    lastUpdatedAt: number;
}

const AI_SESSION_TTL_MS = 10 * 60 * 1000; // 10분
const aiSessions = new Map<string, AiSession>();

function cleanupExpiredSessions(now = Date.now()): void {
    for (const [gameId, session] of aiSessions.entries()) {
        if (now - session.lastUpdatedAt > AI_SESSION_TTL_MS) {
            aiSessions.delete(gameId);
        }
    }
}

function ensureSession(gameId: string): AiSession {
    cleanupExpiredSessions();

    let session = aiSessions.get(gameId);
    if (!session) {
        session = {
            gameId,
            isProcessing: false,
            processingStartedAt: undefined,
            lastProcessedMoveCount: -1,
            lastUpdatedAt: Date.now(),
        };
        aiSessions.set(gameId, session);
    } else {
        session.lastUpdatedAt = Date.now();
    }

    return session;
}

/**
 * 현재 턴을 처리해야 하는지 여부를 반환
 * - 마지막으로 처리한 moveHistory 길이보다 현재 길이가 큰 경우에만 true
 * - 단, 한 번도 처리한 적 없으면(lastProcessedMoveCount === 0) 허용 (알까기/컬링 등 배치 단계는 moveHistory가 0)
 */
export function shouldProcessAiTurn(gameId: string, currentMoveCount: number): boolean {
    const session = ensureSession(gameId);

    // 메인루프/캐시 불일치로 lastProcessed만 앞서가면 "이미 처리됨"으로 AI가 영구 정지할 수 있음 → 실제 수순에 맞게 되돌림
    if (session.lastProcessedMoveCount > currentMoveCount) {
        session.lastProcessedMoveCount = Math.max(0, currentMoveCount - 1);
    }

    if (session.lastProcessedMoveCount > 0 && currentMoveCount <= session.lastProcessedMoveCount) {
        return false;
    }

    return true;
}

/**
 * 세션을 "처리 중" 상태로 전환
 * 이미 다른 계산이 진행 중이면 false를 반환
 */
const AI_PROCESSING_STALE_MS = 45_000;

export function startAiProcessing(gameId: string): boolean {
    const session = ensureSession(gameId);
    const now = Date.now();

    if (session.isProcessing) {
        const elapsed = session.processingStartedAt ? now - session.processingStartedAt : AI_PROCESSING_STALE_MS;
        if (elapsed >= AI_PROCESSING_STALE_MS) {
            console.warn(`[AI Session] Stale isProcessing (${elapsed}ms) for ${gameId}, resetting`);
            session.isProcessing = false;
            session.processingStartedAt = undefined;
        } else {
            return false;
        }
    }

    session.isProcessing = true;
    session.processingStartedAt = now;
    session.lastUpdatedAt = now;
    return true;
}

/**
 * AI 계산이 정상적으로 끝났음을 표시하며 moveHistory 길이를 기록
 */
export function finishAiProcessing(gameId: string, newMoveCount: number): void {
    const session = ensureSession(gameId);
    session.isProcessing = false;
    session.processingStartedAt = undefined;
    session.lastProcessedMoveCount = newMoveCount;
    session.lastUpdatedAt = Date.now();
}

/**
 * AI 계산이 실패했을 때 호출하여 잠금만 해제
 */
export function cancelAiProcessing(gameId: string): void {
    const session = ensureSession(gameId);
    session.isProcessing = false;
    session.processingStartedAt = undefined;
    session.lastUpdatedAt = Date.now();
}

export function isAiProcessing(gameId: string): boolean {
    const s = aiSessions.get(gameId);
    return !!s?.isProcessing;
}

/**
 * 다른 경로(메인 루프 setImmediate 등)가 startAiProcessing을 잡고 있을 때
 * 인라인 makeAiMove가 즉시 return 하며 AI가 스킵되는 레이스를 줄이기 위해 대기한다.
 */
export async function waitUntilAiProcessingReleased(gameId: string, maxMs: number): Promise<void> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        if (!isAiProcessing(gameId)) return;
        await new Promise<void>((r) => setTimeout(r, 25));
    }
}

/**
 * 게임이 종료되었을 때 세션 제거
 */
export function clearAiSession(gameId: string): void {
    aiSessions.delete(gameId);
}

/**
 * 외부에서 세션을 강제로 최신 moveHistory에 맞춰 동기화할 때 사용
 * (예: 최신 게임 상태가 DB에서 갱신된 경우)
 */
interface SyncOptions {
    /**
     * AI 차례이더라도 moveHistory 기반으로 lastProcessedMoveCount를 강제로 갱신해야 할 때 사용
     * (예: 외부에서 AI 수가 이미 반영된 최신 게임 상태를 가져온 경우)
     */
    allowAdvanceOnAiTurn?: boolean;
}

export function syncAiSession(game: LiveGameSession, aiPlayerId: string, options: SyncOptions = {}): void {
    const session = ensureSession(game.id);
    const moveCount = game.moveHistory?.length ?? 0;
    session.lastUpdatedAt = Date.now();

    const isAiGame = game.isAiGame || game.blackPlayerId === aiPlayerId || game.whitePlayerId === aiPlayerId;
    const aiControlledBlack =
        game.blackPlayerId === aiPlayerId ||
        (game.blackPlayerId != null && String(game.blackPlayerId).startsWith('dungeon-bot-'));
    const aiControlledWhite =
        game.whitePlayerId === aiPlayerId ||
        (game.whitePlayerId != null && String(game.whitePlayerId).startsWith('dungeon-bot-'));
    const aiShouldMove = isAiGame &&
        game.currentPlayer !== Player.None &&
        ((game.currentPlayer === Player.Black && aiControlledBlack) ||
         (game.currentPlayer === Player.White && aiControlledWhite));

    if (aiShouldMove && !options.allowAdvanceOnAiTurn) {
        // AI 차례의 stale state가 들어와도 lastProcessedMoveCount를 뒤로 되감지 않는다.
        // 되감으면 방금 처리한 AI 수가 저장/브로드캐스트되기 전에 같은 국면으로 다시 GnuGo를 호출할 수 있다.
        //
        // 예외: 동기화/인간 턴 처리 등으로 lastProcessedMoveCount === moveCount 인 채 AI 차례가 되면
        // shouldProcessAiTurn이 영구 false → 모험·AI 대국에서 봇이 안 두는 현상. 한 수만큼만 되돌린다.
        if (session.lastProcessedMoveCount >= moveCount) {
            session.lastProcessedMoveCount = Math.max(-1, moveCount - 1);
            cancelAiProcessing(game.id);
            console.warn(
                `[AI Session] Repaired lastProcessed>=moveCount for game ${game.id} (AI to move, moveCount=${moveCount})`,
            );
        }
        return;
    }

    // 놀이바둑(알까기, 컬링 등)은 moveHistory를 쓰지 않음. 여기서 moveCount(0)로 덮어쓰면
    // shouldProcessAiTurn(gameId, 0)이 0 <= 0으로 false가 되어 AI가 영원히 호출되지 않음 → 동기화 생략
    if (PLAYFUL_MODES_NO_MOVE_HISTORY.includes(game.mode)) {
        return;
    }

    if (moveCount !== session.lastProcessedMoveCount) {
        session.lastProcessedMoveCount = moveCount;
    }
}

