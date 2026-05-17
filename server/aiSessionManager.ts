import { Player, type LiveGameSession, GameMode } from '../types/index.js';
import {
    buildPairAiSchedulingKey,
    getCurrentPairTurnSeat,
    isPairAiSeat,
    isPairClassicGame,
    normalizePairTurnIndex,
} from '../shared/utils/pairGameTurn.js';

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
    /** 페어 4인 수순: `moveCount:turnIndex:participantId` — 같은 길이에서도 좌석별로 구분 */
    lastProcessedPairSchedulingKey?: string;
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
export function shouldProcessAiTurn(
    gameId: string,
    currentMoveCount: number,
    pairSchedulingKey?: string | null,
): boolean {
    const session = ensureSession(gameId);

    // 세션 수순이 game.moveHistory보다 앞서 있으면(낡은 스냅샷으로 makeAiMove가 호출된 경우) currentMoveCount-1로 내리면
    // shouldProcessAiTurn이 다시 true가 되어 동일 국면에 AI가 중복 착수할 수 있음 → 스냅샷 길이에만 맞추고 스킵
    if (session.lastProcessedMoveCount > currentMoveCount) {
        session.lastProcessedMoveCount = currentMoveCount;
        session.lastProcessedPairSchedulingKey = undefined;
        return false;
    }

    if (pairSchedulingKey) {
        if (session.lastProcessedPairSchedulingKey === pairSchedulingKey) {
            return false;
        }
        return true;
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
export function finishAiProcessing(
    gameId: string,
    newMoveCount: number,
    pairSchedulingKey?: string | null,
): void {
    const session = ensureSession(gameId);
    session.isProcessing = false;
    session.processingStartedAt = undefined;
    session.lastProcessedMoveCount = newMoveCount;
    session.lastProcessedPairSchedulingKey = pairSchedulingKey ?? undefined;
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

    const pairClassic = isPairClassicGame(game.settings, game.mode);
    const pairCurrentSeat = pairClassic ? getCurrentPairTurnSeat(game.settings) : null;
    const pairSchedulingKey = pairClassic ? buildPairAiSchedulingKey(game.settings, moveCount) : null;
    const isAiGame = game.isAiGame || game.blackPlayerId === aiPlayerId || game.whitePlayerId === aiPlayerId;
    const aiControlledBlack =
        game.blackPlayerId === aiPlayerId ||
        (game.blackPlayerId != null && String(game.blackPlayerId).startsWith('dungeon-bot-'));
    const aiControlledWhite =
        game.whitePlayerId === aiPlayerId ||
        (game.whitePlayerId != null && String(game.whitePlayerId).startsWith('dungeon-bot-'));
    const aiShouldMove =
        game.currentPlayer !== Player.None &&
        (Boolean(pairCurrentSeat && isPairAiSeat(pairCurrentSeat)) ||
            (isAiGame &&
                ((game.currentPlayer === Player.Black && aiControlledBlack) ||
                    (game.currentPlayer === Player.White && aiControlledWhite))));

    if (aiShouldMove && !options.allowAdvanceOnAiTurn) {
        const pairSeatNeedsTurn =
            pairSchedulingKey != null && pairSchedulingKey !== session.lastProcessedPairSchedulingKey;
        if (session.lastProcessedMoveCount >= moveCount) {
            if (pairSeatNeedsTurn) {
                return;
            }
            if (session.lastProcessedMoveCount > moveCount) {
                session.lastProcessedMoveCount = moveCount;
                session.lastProcessedPairSchedulingKey = undefined;
                return;
            }
            session.lastProcessedMoveCount = Math.max(-1, moveCount - 1);
            session.lastProcessedPairSchedulingKey = undefined;
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

/** makeAiMove: 페어 AI 착수 전·후 turnIndex 비교용 */
export function getPairTurnIndexForSession(game: LiveGameSession): number | null {
    if (!isPairClassicGame(game.settings, game.mode) || !game.settings?.pairGame) return null;
    return normalizePairTurnIndex(game.settings.pairGame);
}
