import type { LiveGameSession } from '../../types/index.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

/**
 * PVE 히든 공개 연출(`hidden_reveal_animating`)이 만료됐으면 item phase tick으로 정산한다.
 * gameActions·AI 큐·워치독에서 공통 사용.
 */
export async function finalizePveHiddenRevealIfExpired(
    game: LiveGameSession,
    now: number,
): Promise<boolean> {
    if (String(game.gameStatus) !== 'hidden_reveal_animating') return false;
    const revealEnd = game.revealAnimationEndTime ?? 0;
    if (revealEnd <= 0 || now < revealEnd) return false;

    const policy = resolveArenaSessionPolicy(game);
    if (policy.matchAxis === 'pvp') return false;

    const { tickStrategicItemPhaseIfNeeded } = await import('./strategicItemPhaseTick.js');
    return tickStrategicItemPhaseIfNeeded(game, now);
}
