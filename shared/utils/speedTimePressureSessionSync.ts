import type { LiveGameSession } from '../types/index.js';
import { GameMode, Player } from '../types/enums.js';
import { getSpeedTimePressureBonusPointsFromConsumedSec } from './speedTimePressureDisplay.js';

export function isSessionSpeedTimePressureMode(session: LiveGameSession): boolean {
    return (
        session.mode === GameMode.Speed ||
        (session.mode === GameMode.Mix && Boolean(session.settings?.mixedModes?.includes(GameMode.Speed)))
    );
}

/** `finalizeAnalysisResult`·UI·클라 착수와 동일한 누적 소비(committed + 라이브 턴, AI 좌석 라이브 제외) */
export function getSpeedTimePressureConsumptionSnapshot(
    session: LiveGameSession,
    nowMs: number,
    aiUserId: string,
): { blackConsumed: number; whiteConsumed: number } {
    const speedConsumed = ((session.settings as any)?.__speedBonusConsumedSec ?? {}) as { black?: number; white?: number };
    const committedBlackConsumed = Math.max(0, Number(speedConsumed.black ?? 0));
    const committedWhiteConsumed = Math.max(0, Number(speedConsumed.white ?? 0));
    let liveBlackTurnUsed =
        session.currentPlayer === Player.Black && typeof session.turnDeadline === 'number'
            ? Math.max(
                  0,
                  Math.max(0, Number(session.blackTimeLeft ?? 0)) - Math.max(0, (session.turnDeadline - nowMs) / 1000),
              )
            : 0;
    let liveWhiteTurnUsed =
        session.currentPlayer === Player.White && typeof session.turnDeadline === 'number'
            ? Math.max(
                  0,
                  Math.max(0, Number(session.whiteTimeLeft ?? 0)) - Math.max(0, (session.turnDeadline - nowMs) / 1000),
              )
            : 0;
    if (session.isAiGame) {
        if (session.blackPlayerId === aiUserId) liveBlackTurnUsed = 0;
        if (session.whitePlayerId === aiUserId) liveWhiteTurnUsed = 0;
    }
    return {
        blackConsumed: committedBlackConsumed + liveBlackTurnUsed,
        whiteConsumed: committedWhiteConsumed + liveWhiteTurnUsed,
    };
}

export function getSpeedTimeBonusPointsDesired(
    session: LiveGameSession,
    nowMs: number,
    aiUserId: string,
): { blackBonus: number; whiteBonus: number } {
    const { blackConsumed, whiteConsumed } = getSpeedTimePressureConsumptionSnapshot(session, nowMs, aiUserId);
    if (session.isAiGame) {
        const humanIsBlack = session.blackPlayerId !== aiUserId && session.whitePlayerId === aiUserId;
        const humanIsWhite = session.whitePlayerId !== aiUserId && session.blackPlayerId === aiUserId;
        const humanConsumed = humanIsBlack ? blackConsumed : humanIsWhite ? whiteConsumed : 0;
        const aiBonus = getSpeedTimePressureBonusPointsFromConsumedSec(humanConsumed);
        if (humanIsBlack) {
            return { blackBonus: 0, whiteBonus: aiBonus };
        }
        if (humanIsWhite) {
            return { blackBonus: aiBonus, whiteBonus: 0 };
        }
        return {
            blackBonus: getSpeedTimePressureBonusPointsFromConsumedSec(whiteConsumed),
            whiteBonus: getSpeedTimePressureBonusPointsFromConsumedSec(blackConsumed),
        };
    }
    return {
        blackBonus: getSpeedTimePressureBonusPointsFromConsumedSec(whiteConsumed),
        whiteBonus: getSpeedTimePressureBonusPointsFromConsumedSec(blackConsumed),
    };
}

/**
 * 대국 중: 누적 사용 시간 10초마다 상대 `captures`에 +1
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

export function addSpeedConsumedSeconds(
    game: LiveGameSession,
    player: Player,
    consumedSec: number,
    aiUserId: string,
): void {
    if (consumedSec <= 0 || !isSessionSpeedTimePressureMode(game)) return;
    const bag = (((game.settings as any).__speedBonusConsumedSec ??= {}) as { black?: number; white?: number });
    if (player === Player.Black) {
        bag.black = Math.max(0, Number(bag.black ?? 0)) + consumedSec;
    } else if (player === Player.White) {
        bag.white = Math.max(0, Number(bag.white ?? 0)) + consumedSec;
    }
    syncSpeedTimePressureCaptures(game, Date.now(), aiUserId);
}

/**
 * 클라이언트 착수 직후: 서버 PLACE_STONE과 동일하게 턴 소비 시간을 누적하고 상대 captures를 동기화한다.
 */
export function applySpeedTimePressureAfterClientMove(
    game: LiveGameSession,
    movePlayer: Player,
    moveEndedAtMs: number,
    aiUserId: string,
): void {
    if (!isSessionSpeedTimePressureMode(game) || game.gameStatus !== 'playing') return;
    const timeKey = movePlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
    const prevTime = Math.max(0, Number((game as any)[timeKey] ?? 0));
    if (typeof game.turnDeadline === 'number') {
        const timeRemaining = Math.max(0, (game.turnDeadline - moveEndedAtMs) / 1000);
        addSpeedConsumedSeconds(game, movePlayer, Math.max(0, prevTime - timeRemaining), aiUserId);
        return;
    }
    if (typeof (game as any).pausedTurnTimeLeft === 'number') {
        const resumed = Math.max(0, Number((game as any).pausedTurnTimeLeft ?? 0));
        addSpeedConsumedSeconds(game, movePlayer, Math.max(0, prevTime - resumed), aiUserId);
    }
}
