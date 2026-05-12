import type { LiveGameSession } from '../../shared/types/entities.js';
import { GameCategory } from '../../shared/types/enums.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

export function getArenaActionPolicy(session: LiveGameSession) {
    return resolveArenaSessionPolicy(session);
}

export function isPolicyPveLike(session: LiveGameSession): boolean {
    const policy = getArenaActionPolicy(session);
    return policy.matchAxis !== 'pvp';
}

export function isPolicyTower(session: LiveGameSession): boolean {
    return getArenaActionPolicy(session).kind === GameCategory.Tower;
}

export function isPolicySinglePlayer(session: LiveGameSession): boolean {
    return getArenaActionPolicy(session).kind === GameCategory.SinglePlayer;
}

export function requiresPolicyClientSync(session: LiveGameSession): boolean {
    return getArenaActionPolicy(session).requiresClientSyncBeforeAction;
}

