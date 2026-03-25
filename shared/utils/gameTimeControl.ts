import { GameMode } from '../types/enums.js';

/**
 * 스피드 모드 또는 길드 전쟁(메인 시계 + timeIncrement)처럼 피셔식 증가가 적용되는지.
 */
export function isFischerStyleTimeControl(session: {
    mode: GameMode;
    settings?: { timeIncrement?: number; mixedModes?: GameMode[] };
    gameCategory?: string;
}): boolean {
    if (session.mode === GameMode.Speed) return true;
    if (session.mode === GameMode.Mix && session.settings?.mixedModes?.includes(GameMode.Speed)) return true;
    if (session.gameCategory === 'guildwar' && (session.settings?.timeIncrement ?? 0) > 0) return true;
    return false;
}

export function getFischerIncrementSeconds(session: Parameters<typeof isFischerStyleTimeControl>[0]): number {
    return isFischerStyleTimeControl(session) ? (session.settings?.timeIncrement ?? 0) : 0;
}
