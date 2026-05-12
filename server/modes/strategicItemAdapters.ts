import type { LiveGameSession } from '../../shared/types/entities.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

export async function updateStrategicPveItemState(game: LiveGameSession, now: number): Promise<void> {
    const policy = resolveArenaSessionPolicy(game);
    if (policy.kind === 'singleplayer') {
        const { updateSinglePlayerHiddenState } = await import('./singlePlayerHidden.js');
        const { updateSinglePlayerMissileState } = await import('./singlePlayerMissile.js');
        await updateSinglePlayerHiddenState(game as any, now);
        const missileStateChanged = await updateSinglePlayerMissileState(game as any, now);
        if (missileStateChanged) (game as any)._missileStateChanged = true;
        return;
    }
    if (policy.kind === 'tower') {
        const { updateTowerPlayerHiddenState } = await import('./towerPlayerHidden.js');
        await updateTowerPlayerHiddenState(game as any, now);
    }
}

