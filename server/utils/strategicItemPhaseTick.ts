import { GameCategory } from '../../types/enums.js';
import type { LiveGameSession } from '../../types/index.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

const STRATEGIC_ITEM_PHASE_STATUSES = new Set([
    'hidden_placing',
    'scanning',
    'scanning_animating',
    'missile_selecting',
    'missile_animating',
    'hidden_reveal_animating',
]);

/**
 * AI 디스패치·큐 처리 중에도 아이템 데드라인/애니 종료를 진행시키기 위한 경량 틱.
 * updateStrategicGameState 전체를 돌리지 않고 hidden/missile 상태머신만 갱신한다.
 */
export async function tickStrategicItemPhaseIfNeeded(
    game: LiveGameSession,
    now: number,
): Promise<boolean> {
    if (!STRATEGIC_ITEM_PHASE_STATUSES.has(String(game.gameStatus ?? ''))) {
        return false;
    }

    const policy = resolveArenaSessionPolicy(game);
    let hiddenChanged = false;
    let missileChanged = false;

    if (policy.kind === GameCategory.SinglePlayer) {
        const { updateSinglePlayerHiddenState } = await import('../modes/singlePlayerHidden.js');
        hiddenChanged = await updateSinglePlayerHiddenState(game, now);
        const { updateMissileState } = await import('../modes/missile.js');
        missileChanged = updateMissileState(game, now);
    } else if (policy.kind === GameCategory.Tower) {
        const { updateTowerPlayerHiddenState } = await import('../modes/towerPlayerHidden.js');
        hiddenChanged = await updateTowerPlayerHiddenState(game, now);
        const { updateMissileState } = await import('../modes/missile.js');
        missileChanged = updateMissileState(game, now);
    } else {
        const { updateHiddenState } = await import('../modes/hidden.js');
        const { updateMissileState } = await import('../modes/missile.js');
        hiddenChanged = await updateHiddenState(game, now);
        missileChanged = updateMissileState(game, now);
    }

    const itemTimeoutStateChanged = (game as { _itemTimeoutStateChanged?: boolean })._itemTimeoutStateChanged;
    const itemPhaseStateChanged = (game as { _itemPhaseStateChanged?: boolean })._itemPhaseStateChanged;
    if (itemTimeoutStateChanged) {
        (game as { _itemTimeoutStateChanged?: boolean })._itemTimeoutStateChanged = false;
    }
    if (itemPhaseStateChanged) {
        (game as { _itemPhaseStateChanged?: boolean })._itemPhaseStateChanged = false;
    }

    if (hiddenChanged || missileChanged || itemTimeoutStateChanged || itemPhaseStateChanged) {
        const { broadcastItemPhaseSnapshot } = await import('./broadcastItemPhaseSnapshot.js');
        await broadcastItemPhaseSnapshot(game);
        return true;
    }
    return false;
}
