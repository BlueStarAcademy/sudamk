import { Player } from '../types/enums.js';

/** PVE 스피드: 유저 턴 진입 직후 막대가 끝에서 느껴지는 보정 — 턴당 1초는 상대 시간 보너스 누적에서 제외 */
export const PVE_SPEED_TIME_PRESSURE_GRACE_SEC = 1;

export type SpeedTimePveGraceSessionShape = {
    isAiGame?: boolean;
    isSinglePlayer?: boolean;
    gameCategory?: string;
    blackPlayerId?: string;
    whitePlayerId?: string;
};

/** `PlayerPanel`의 `isPveLikeSpeedSession`과 동일 범위 */
export function isPveLikeSpeedTimePressureSession(s: SpeedTimePveGraceSessionShape): boolean {
    const cat = String(s.gameCategory ?? '');
    return (
        Boolean(s.isAiGame) ||
        Boolean(s.isSinglePlayer) ||
        cat === 'tower' ||
        (cat === 'guildwar' && Boolean(s.isAiGame)) ||
        cat === 'adventure'
    );
}

export function isHumanSeatForSpeedTimePressure(s: SpeedTimePveGraceSessionShape, player: Player, aiUserId: string): boolean {
    return (
        (player === Player.Black && s.blackPlayerId !== aiUserId) ||
        (player === Player.White && s.whitePlayerId !== aiUserId)
    );
}

export function applyPveSpeedTimePressureGraceToLiveUsedSec(
    s: SpeedTimePveGraceSessionShape,
    player: Player,
    liveUsedSec: number,
    aiUserId: string,
): number {
    if (!isPveLikeSpeedTimePressureSession(s)) return liveUsedSec;
    if (!isHumanSeatForSpeedTimePressure(s, player, aiUserId)) return liveUsedSec;
    return Math.max(0, liveUsedSec - PVE_SPEED_TIME_PRESSURE_GRACE_SEC);
}
