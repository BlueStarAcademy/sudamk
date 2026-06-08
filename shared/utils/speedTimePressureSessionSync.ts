import type { LiveGameSession } from '../types/index.js';
import { GameMode, Player } from '../types/enums.js';
import { getSpeedTurnPenaltyPointsFromElapsedSec } from './speedTimePressureDisplay.js';
import { getSpeedPerMoveSeconds } from './gameTimeControl.js';

export function isSessionSpeedTimePressureMode(session: LiveGameSession): boolean {
    return (
        session.mode === GameMode.Speed ||
        (session.mode === GameMode.Mix && Boolean(session.settings?.mixedModes?.includes(GameMode.Speed)))
    );
}

type SpeedPenaltyBag = { black?: number; white?: number };

function getCommittedTurnPenaltyBag(session: LiveGameSession): SpeedPenaltyBag {
    return ((session.settings as any)?.__speedTurnPenaltyCommitted ?? {}) as SpeedPenaltyBag;
}

/** 현재 수 경과 초 (turnStartTime 기준). AI 좌석은 0. */
export function getSpeedCurrentTurnElapsedSec(
    session: LiveGameSession,
    nowMs: number,
    aiUserId: string,
): { blackElapsed: number; whiteElapsed: number } {
    if (session.gameStatus !== 'playing' || typeof session.turnStartTime !== 'number') {
        return { blackElapsed: 0, whiteElapsed: 0 };
    }
    const elapsed = Math.max(0, (nowMs - session.turnStartTime) / 1000);
    if (session.currentPlayer === Player.Black) {
        if (session.isAiGame && session.blackPlayerId === aiUserId) {
            return { blackElapsed: 0, whiteElapsed: 0 };
        }
        return { blackElapsed: elapsed, whiteElapsed: 0 };
    }
    if (session.currentPlayer === Player.White) {
        if (session.isAiGame && session.whitePlayerId === aiUserId) {
            return { blackElapsed: 0, whiteElapsed: 0 };
        }
        return { blackElapsed: 0, whiteElapsed: elapsed };
    }
    return { blackElapsed: 0, whiteElapsed: 0 };
}

/** 확정 + 라이브 턴 페널티 점수 (플레이어별 → 상대에게 줄 점수) */
export function getSpeedTurnPenaltySnapshot(
    session: LiveGameSession,
    nowMs: number,
    aiUserId: string,
): { blackPenaltyPoints: number; whitePenaltyPoints: number } {
    const committed = getCommittedTurnPenaltyBag(session);
    const committedBlack = Math.max(0, Number(committed.black ?? 0));
    const committedWhite = Math.max(0, Number(committed.white ?? 0));
    const { blackElapsed, whiteElapsed } = getSpeedCurrentTurnElapsedSec(session, nowMs, aiUserId);
    return {
        blackPenaltyPoints: committedBlack + getSpeedTurnPenaltyPointsFromElapsedSec(blackElapsed),
        whitePenaltyPoints: committedWhite + getSpeedTurnPenaltyPointsFromElapsedSec(whiteElapsed),
    };
}

/** @deprecated 수 단위 규칙 — {@link getSpeedTurnPenaltySnapshot} */
export function getSpeedTimePressureConsumptionSnapshot(
    session: LiveGameSession,
    nowMs: number,
    aiUserId: string,
): { blackConsumed: number; whiteConsumed: number } {
    const { blackElapsed, whiteElapsed } = getSpeedCurrentTurnElapsedSec(session, nowMs, aiUserId);
    return { blackConsumed: blackElapsed, whiteConsumed: whiteElapsed };
}

export function getSpeedTimeBonusPointsDesired(
    session: LiveGameSession,
    nowMs: number,
    aiUserId: string,
): { blackBonus: number; whiteBonus: number } {
    const { blackPenaltyPoints, whitePenaltyPoints } = getSpeedTurnPenaltySnapshot(session, nowMs, aiUserId);
    if (session.isAiGame) {
        const humanIsBlack = session.blackPlayerId !== aiUserId && session.whitePlayerId === aiUserId;
        const humanIsWhite = session.whitePlayerId !== aiUserId && session.blackPlayerId === aiUserId;
        const humanPenalty = humanIsBlack ? blackPenaltyPoints : humanIsWhite ? whitePenaltyPoints : 0;
        if (humanIsBlack) {
            return { blackBonus: 0, whiteBonus: humanPenalty };
        }
        if (humanIsWhite) {
            return { blackBonus: humanPenalty, whiteBonus: 0 };
        }
        return { blackBonus: whitePenaltyPoints, whiteBonus: blackPenaltyPoints };
    }
    return { blackBonus: whitePenaltyPoints, whiteBonus: blackPenaltyPoints };
}

/**
 * 대국 중: 수당 10초 초과 페널티를 상대 `captures`에 반영
 * (이미 `captures`에 넣은 만큼은 settings.__speedTimePressureGranted에 기록).
 */
export function syncSpeedTimePressureCaptures(
    game: LiveGameSession,
    nowMs: number,
    aiUserId: string,
): boolean {
    if (!isSessionSpeedTimePressureMode(game) || game.gameStatus !== 'playing') return false;
    if (!game.captures) {
        game.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    }
    const desired = getSpeedTimeBonusPointsDesired(game, nowMs, aiUserId);
    const grant = ((game.settings as any).__speedTimePressureGranted ??= {}) as { black?: number; white?: number };
    const prevB = Math.max(0, Number(grant.black ?? 0));
    const prevW = Math.max(0, Number(grant.white ?? 0));
    const dB = Math.max(0, desired.blackBonus - prevB);
    const dW = Math.max(0, desired.whiteBonus - prevW);
    if (dB === 0 && dW === 0) return false;
    if (dB > 0) {
        game.captures[Player.Black] = (game.captures[Player.Black] ?? 0) + dB;
        grant.black = prevB + dB;
    }
    if (dW > 0) {
        game.captures[Player.White] = (game.captures[Player.White] ?? 0) + dW;
        grant.white = prevW + dW;
    }
    return true;
}

/** 수 종료 시: 해당 수 페널티 확정 + 라이브 captures 동기화 */
export function commitSpeedTurnPenalty(
    game: LiveGameSession,
    player: Player,
    turnElapsedSec: number,
    aiUserId: string,
): void {
    if (!isSessionSpeedTimePressureMode(game)) return;
    const penalty = getSpeedTurnPenaltyPointsFromElapsedSec(turnElapsedSec);
    if (penalty > 0) {
        const bag = (((game.settings as any).__speedTurnPenaltyCommitted ??= {}) as SpeedPenaltyBag);
        if (player === Player.Black) {
            bag.black = Math.max(0, Number(bag.black ?? 0)) + penalty;
        } else if (player === Player.White) {
            bag.white = Math.max(0, Number(bag.white ?? 0)) + penalty;
        }
    }
    syncSpeedTimePressureCaptures(game, Date.now(), aiUserId);
}

/** @deprecated — {@link commitSpeedTurnPenalty} */
export function addSpeedConsumedSeconds(
    game: LiveGameSession,
    player: Player,
    consumedSec: number,
    aiUserId: string,
): void {
    commitSpeedTurnPenalty(game, player, consumedSec, aiUserId);
}

/** 스피드 수 종료 시 메인 시계 차감 + 수당 페널티 확정 */
export function applySpeedMoveClockEnd(
    game: LiveGameSession,
    playerWhoMoved: Player,
    nowMs: number,
    aiUserId: string,
): number {
    const turnElapsed =
        typeof game.turnStartTime === 'number' ? Math.max(0, (nowMs - game.turnStartTime) / 1000) : 0;
    const timeKey = playerWhoMoved === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
    const prevMain = Math.max(0, Number((game as any)[timeKey] ?? 0));
    (game as any)[timeKey] = Math.max(0, prevMain - turnElapsed);
    const isAiTurn =
        game.isAiGame &&
        ((playerWhoMoved === Player.Black && game.blackPlayerId === aiUserId) ||
            (playerWhoMoved === Player.White && game.whitePlayerId === aiUserId));
    if (!isAiTurn) {
        commitSpeedTurnPenalty(game, playerWhoMoved, turnElapsed, aiUserId);
    }
    return turnElapsed;
}

/** 다음 수 시작: 수당 10초 turnDeadline 설정 */
export function applySpeedNextTurnClockStart(game: LiveGameSession, nowMs: number): void {
    const perMoveSec = getSpeedPerMoveSeconds(game as any);
    game.turnStartTime = nowMs;
    game.turnDeadline = nowMs + perMoveSec * 1000;
}

/**
 * 클라이언트 착수 직후: 서버 PLACE_STONE과 동일하게 수 페널티·메인 시계를 반영한다.
 */
export function applySpeedTimePressureAfterClientMove(
    game: LiveGameSession,
    movePlayer: Player,
    moveEndedAtMs: number,
    aiUserId: string,
): void {
    if (!isSessionSpeedTimePressureMode(game) || game.gameStatus !== 'playing') return;
    applySpeedMoveClockEnd(game, movePlayer, moveEndedAtMs, aiUserId);
}
