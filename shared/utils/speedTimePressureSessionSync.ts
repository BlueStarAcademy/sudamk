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

/**
 * 서버 틱 전에 클라가 보여줄, 아직 `captures`에 넣지 않은 시간 보너스.
 * PVP·PVE 공통: `getSpeedTimeBonusPointsDesired - __speedTimePressureGranted`.
 */
export function getSpeedLiveCaptureBonusDelta(
    session: LiveGameSession,
    playerEnum: Player,
    nowMs: number,
    aiUserId: string,
): number {
    if (!isSessionSpeedTimePressureMode(session) || session.gameStatus !== 'playing') return 0;
    if (playerEnum !== Player.Black && playerEnum !== Player.White) return 0;
    const desired = getSpeedTimeBonusPointsDesired(session, nowMs, aiUserId);
    const grant = ((session.settings as any).__speedTimePressureGranted ?? {}) as SpeedPenaltyBag;
    const want = playerEnum === Player.Black ? desired.blackBonus : desired.whiteBonus;
    const got =
        playerEnum === Player.Black
            ? Math.max(0, Number(grant.black ?? 0))
            : Math.max(0, Number(grant.white ?? 0));
    return Math.max(0, want - got);
}

/** 수 종료 시: 해당 수 페널티 확정 + 라이브 captures 동기화 */
export function commitSpeedTurnPenalty(
    game: LiveGameSession,
    player: Player,
    turnElapsedSec: number,
    aiUserId: string,
    nowMs: number = Date.now(),
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
    // 종료된 수의 경과는 committed에 넣었음. turnStartTime을 그대로 두면 라이브 경과가 한 번 더 더해져 +2가 된다.
    const prevTurnStartTime = game.turnStartTime;
    game.turnStartTime = undefined;
    try {
        syncSpeedTimePressureCaptures(game, nowMs, aiUserId);
    } finally {
        game.turnStartTime = prevTurnStartTime;
    }
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
        commitSpeedTurnPenalty(game, playerWhoMoved, turnElapsed, aiUserId, nowMs);
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
 * 스피드 수당 10초 turnDeadline — 초읽기/메인 시간패 경로와 혼동되면 10초마다 시간패가 난다.
 */
export function isSpeedPerMoveAllowanceDeadline(session: LiveGameSession): boolean {
    if (!isSessionSpeedTimePressureMode(session)) return false;
    if (typeof session.turnStartTime !== 'number' || typeof session.turnDeadline !== 'number') return false;
    const perMoveSec = getSpeedPerMoveSeconds(session as any);
    const windowMs = session.turnDeadline - session.turnStartTime;
    return windowMs > 0 && windowMs <= perMoveSec * 1000 + 1500;
}

/**
 * turnDeadline 경과를 시간패로 처리해야 하는지.
 * 스피드 모드는 메인 시계 소진(`updateStrategicGameState` 별도 경로)만 시간패이며,
 * 수당 10초 만료는 상대 +1점만 부여한다.
 */
export function shouldTreatTurnDeadlineExpiryAsTimeForfeit(session: LiveGameSession): boolean {
    if (isSessionSpeedTimePressureMode(session)) return false;
    if (isSpeedPerMoveAllowanceDeadline(session)) return false;
    return true;
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

/** 낙관적 착수: 수 페널티 확정 후 상대 수당 10초 시계를 가득 찬 상태로 바로 연다. */
export function applySpeedClocksAfterOptimisticClientMove(
    game: LiveGameSession,
    movePlayer: Player,
    nowMs: number,
    aiUserId: string,
): void {
    if (!isSessionSpeedTimePressureMode(game) || game.gameStatus !== 'playing') return;
    applySpeedMoveClockEnd(game, movePlayer, nowMs, aiUserId);
    applySpeedNextTurnClockStart(game, nowMs);
}

type SpeedLiveClockFields = Pick<
    LiveGameSession,
    'turnStartTime' | 'turnDeadline' | 'blackTimeLeft' | 'whiteTimeLeft'
>;

/**
 * PVP 스피드: 같은 수 중에 늦은 GAME_UPDATE가 turnStartTime을 미래로 밀면
 * 수당 10초·메인 시계가 되감긴다. 이미 흐르고 있는 시계는 더 이른 시작 시각을 유지한다.
 */
export function mergeSpeedLiveClocksOnClient(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): Partial<SpeedLiveClockFields> {
    if (!existing) return {};
    if (!isSessionSpeedTimePressureMode(incoming) && !isSessionSpeedTimePressureMode(existing)) return {};
    const perMoveMs = getSpeedPerMoveSeconds(incoming as any) * 1000;
    const sameTurn =
        incoming.gameStatus === 'playing' &&
        existing.gameStatus === 'playing' &&
        incoming.currentPlayer === existing.currentPlayer &&
        (incoming.moveHistory?.length ?? 0) === (existing.moveHistory?.length ?? 0);

    const pickStart = (): number | undefined => {
        const inc = incoming.turnStartTime;
        const ext = existing.turnStartTime;
        if (sameTurn && typeof inc === 'number' && Number.isFinite(inc) && typeof ext === 'number' && Number.isFinite(ext)) {
            return Math.min(inc, ext);
        }
        if (typeof inc === 'number' && Number.isFinite(inc)) return inc;
        if (typeof ext === 'number' && Number.isFinite(ext)) return ext;
        return undefined;
    };

    const pickMain = (key: 'blackTimeLeft' | 'whiteTimeLeft'): number | undefined => {
        const inc = incoming[key];
        const ext = existing[key];
        if (
            sameTurn &&
            typeof inc === 'number' &&
            Number.isFinite(inc) &&
            inc > 0 &&
            typeof ext === 'number' &&
            Number.isFinite(ext) &&
            ext > 0
        ) {
            return Math.min(inc, ext);
        }
        if (typeof inc === 'number' && Number.isFinite(inc) && inc > 0) return inc;
        if (typeof ext === 'number' && Number.isFinite(ext) && ext > 0) return ext;
        const fallback = incoming[key] ?? existing[key];
        return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : undefined;
    };

    const turnStartTime = pickStart();
    return {
        blackTimeLeft: pickMain('blackTimeLeft'),
        whiteTimeLeft: pickMain('whiteTimeLeft'),
        turnStartTime,
        turnDeadline:
            typeof turnStartTime === 'number' && Number.isFinite(turnStartTime)
                ? turnStartTime + perMoveMs
                : typeof incoming.turnDeadline === 'number'
                  ? incoming.turnDeadline
                  : existing.turnDeadline,
    };
}
