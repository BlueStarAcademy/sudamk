import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import type { GameSettings, LiveGameSession } from '../types/entities.js';
import type { UserStatusInfo } from '../types/api.js';
import { GameMode } from '../types/enums.js';
import type { ArenaChannel } from '../types/api.js';

export const ARENA_CHANNEL_LABEL: Record<ArenaChannel, string> = {
    strategic: '전략',
    pair: '페어',
    playful: '놀이',
};

export function normalizeArenaChannel(value: unknown): ArenaChannel | null {
    return value === 'strategic' || value === 'pair' || value === 'playful' ? value : null;
}

export function arenaChannelForGameMode(mode: GameMode | null | undefined): Exclude<ArenaChannel, 'pair'> | null {
    if (mode == null) return null;
    if (SPECIAL_GAME_MODES.some((m) => m.mode === mode)) return 'strategic';
    if (PLAYFUL_GAME_MODES.some((m) => m.mode === mode)) return 'playful';
    return null;
}

export function arenaChannelForSettings(settings: Pick<GameSettings, 'pairGame'> | null | undefined): ArenaChannel | null {
    const pairGame = settings?.pairGame as { lobbyChannel?: unknown } | undefined;
    return normalizeArenaChannel(pairGame?.lobbyChannel);
}

export function arenaChannelForGameSession(
    session: Pick<LiveGameSession, 'mode' | 'settings'> | null | undefined,
): ArenaChannel | null {
    if (!session) return null;
    return arenaChannelForSettings(session.settings) ?? arenaChannelForGameMode(session.mode);
}

export function arenaChannelForUserStatus(status: UserStatusInfo | null | undefined): ArenaChannel | null {
    if (!status) return null;
    if (status.arenaChannel) return status.arenaChannel;
    if (status.inPairLobby) return 'pair';
    if (status.waitingLobby) return status.waitingLobby;
    return arenaChannelForGameMode(status.mode);
}

import type { ArenaLobbyIntent } from './arenaLobbyDestination.js';
import { arenaLobbyHash } from './arenaLobbyDestination.js';

export function arenaChannelRoute(
    channel: ArenaChannel,
    intent: ArenaLobbyIntent = 'pvp',
): string {
    return arenaLobbyHash({ intent, channel });
}
