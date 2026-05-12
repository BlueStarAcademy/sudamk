import type { LiveGameSession } from '../../types/index.js';
import { GameMode, Player } from '../../types/enums.js';
import { aiUserId } from '../aiPlayer.js';
import { hasTimeControl, shouldEnforceTimeControl } from '../modes/shared.js';
import { applyPveSpeedTimePressureGraceToLiveUsedSec } from '../../shared/utils/speedTimePveGrace.js';

/** `finalizeAnalysisResult` 스피드 분기와 동일 */
export const SPEED_TIME_PRESSURE_SECONDS_PER_POINT = 10;

/**
 * 착수·패스 직후 시계(남은 시간·turnDeadline)·`__speedBonusConsumedSec` 반영 여부.
 * PVP는 패배까지 강제, AI/싱글/페어 AI 등 스피드는 패배 없이도 피셔 막대·10초당 상대 점수용 시계를 유지한다.
 */
export function shouldRunGoClockAccountingForSession(game: LiveGameSession): boolean {
    if (!hasTimeControl(game.settings)) return false;
    if (shouldEnforceTimeControl(game)) return true;
    return isSessionSpeedTimePressureMode(game);
}

export function isSessionSpeedTimePressureMode(session: LiveGameSession): boolean {
    return (
        session.mode === GameMode.Speed ||
        (session.mode === GameMode.Mix && Boolean(session.settings?.mixedModes?.includes(GameMode.Speed)))
    );
}

/** `finalizeAnalysisResult`와 동일한 누적 소비(committed + 라이브 턴, AI 좌석 라이브 제외) */
export function getSpeedTimePressureConsumptionSnapshot(
    session: LiveGameSession,
    nowMs: number,
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
    liveBlackTurnUsed = applyPveSpeedTimePressureGraceToLiveUsedSec(session as any, Player.Black, liveBlackTurnUsed, aiUserId);
    liveWhiteTurnUsed = applyPveSpeedTimePressureGraceToLiveUsedSec(session as any, Player.White, liveWhiteTurnUsed, aiUserId);
    return {
        blackConsumed: committedBlackConsumed + liveBlackTurnUsed,
        whiteConsumed: committedWhiteConsumed + liveWhiteTurnUsed,
    };
}

/**
 * 스피드 시간 압박으로 상대에게 줄 보너스 집 수(계가 timeBonus와 동일 의미).
 * - PVP: 흑 보너스 = floor(백 소비/10), 백 보너스 = floor(흑 소비/10)
 * - AI: 인간 소비만 AI(상대) 쪽 보너스로 반영
 */
export function getSpeedTimeBonusPointsDesired(
    session: LiveGameSession,
    nowMs: number,
): { blackBonus: number; whiteBonus: number } {
    const { blackConsumed, whiteConsumed } = getSpeedTimePressureConsumptionSnapshot(session, nowMs);
    if (session.isAiGame) {
        const humanIsBlack = session.blackPlayerId !== aiUserId && session.whitePlayerId === aiUserId;
        const humanIsWhite = session.whitePlayerId !== aiUserId && session.blackPlayerId === aiUserId;
        const humanConsumed = humanIsBlack ? blackConsumed : humanIsWhite ? whiteConsumed : 0;
        const aiBonus = Math.floor(humanConsumed / SPEED_TIME_PRESSURE_SECONDS_PER_POINT);
        if (humanIsBlack) {
            return { blackBonus: 0, whiteBonus: aiBonus };
        }
        if (humanIsWhite) {
            return { blackBonus: aiBonus, whiteBonus: 0 };
        }
        return {
            blackBonus: Math.floor(whiteConsumed / SPEED_TIME_PRESSURE_SECONDS_PER_POINT),
            whiteBonus: Math.floor(blackConsumed / SPEED_TIME_PRESSURE_SECONDS_PER_POINT),
        };
    }
    return {
        blackBonus: Math.floor(whiteConsumed / SPEED_TIME_PRESSURE_SECONDS_PER_POINT),
        whiteBonus: Math.floor(blackConsumed / SPEED_TIME_PRESSURE_SECONDS_PER_POINT),
    };
}

/**
 * 대국 중: 누적 사용 시간 10초마다 상대 `captures`에 +1 (이미 `captures`에 넣은 만큼은 settings.__speedTimePressureGranted에 기록).
 * @returns captures 또는 grant가 바뀌었으면 true
 */
export function syncSpeedTimePressureCaptures(game: LiveGameSession, nowMs: number): boolean {
    if (!isSessionSpeedTimePressureMode(game) || game.gameStatus !== 'playing') return false;
    if (!game.captures) {
        game.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    }
    const desired = getSpeedTimeBonusPointsDesired(game, nowMs);
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
