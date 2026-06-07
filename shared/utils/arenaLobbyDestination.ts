import type { ArenaChannel, ArenaLobbyIntent } from '../types/api.js';
import { arenaChannelForGameMode, arenaChannelForSettings } from './arenaChannel.js';
import type { GameMode } from '../types/enums.js';
import type { GameSettings } from '../types/entities.js';

export type { ArenaLobbyIntent };

export type ArenaLobbyDestination = {
    intent: ArenaLobbyIntent;
    channel: ArenaChannel;
};

export type RoomKind =
    | 'ai_duel'
    | 'duo_match'
    | 'friendly_4p'
    | 'friendly_2p'
    | 'arena_ai';

export const ARENA_LOBBY_INTENT_LABEL: Record<ArenaLobbyIntent, string> = {
    pvp: 'PVP',
    ai: 'AI',
};

export const ARENA_LOBBY_DESTINATION_TITLE: Record<ArenaChannel, Record<ArenaLobbyIntent, string>> = {
    strategic: { pvp: '전략바둑 PVP 경기장', ai: '전략바둑 AI 대전' },
    pair: { pvp: '페어 PVP 경기장', ai: '페어 AI 대전' },
    playful: { pvp: '놀이바둑 PVP 경기장', ai: '놀이바둑 AI 대전' },
};

export function normalizeArenaLobbyIntent(value: unknown): ArenaLobbyIntent | null {
    return value === 'pvp' || value === 'ai' ? value : null;
}

export function normalizeArenaLobbyDestination(
    intent: unknown,
    channel: unknown,
): ArenaLobbyDestination | null {
    const normalizedIntent = normalizeArenaLobbyIntent(intent);
    const normalizedChannel =
        channel === 'strategic' || channel === 'pair' || channel === 'playful' ? channel : null;
    if (!normalizedIntent || !normalizedChannel) return null;
    return { intent: normalizedIntent, channel: normalizedChannel };
}

export function arenaLobbyHash(dest: ArenaLobbyDestination): string {
    return `#/${dest.intent}/${dest.channel}`;
}

/** @deprecated Picker removed — defaults to strategic lobby */
export function arenaLobbyPickerHash(intent: ArenaLobbyIntent): string {
    return arenaLobbyHash({ intent, channel: 'strategic' });
}

export function parseArenaLobbyHash(hash: string): ArenaLobbyDestination | null {
    const path = hash.replace(/^#\/?/, '').split('?')[0];
    const [segment, channel] = path.split('/');
    return normalizeArenaLobbyDestination(segment, channel);
}

/** PVP 로비에서 허용되는 roomKind */
export function pvpRoomKindsForChannel(channel: ArenaChannel): RoomKind[] {
    switch (channel) {
        case 'strategic':
        case 'playful':
            return ['duo_match'];
        case 'pair':
            return ['friendly_4p', 'friendly_2p'];
    }
}

/** AI 로비에서 허용되는 roomKind */
export function aiRoomKindsForChannel(channel: ArenaChannel): RoomKind[] {
    switch (channel) {
        case 'strategic':
        case 'playful':
            return ['arena_ai'];
        case 'pair':
            return ['duo_match', 'ai_duel'];
    }
}

export function roomKindsForLobbyDestination(dest: ArenaLobbyDestination): RoomKind[] {
    return dest.intent === 'pvp' ? pvpRoomKindsForChannel(dest.channel) : aiRoomKindsForChannel(dest.channel);
}

export function isRoomKindAllowedForLobby(
    roomKind: RoomKind,
    dest: ArenaLobbyDestination,
): boolean {
    return roomKindsForLobbyDestination(dest).includes(roomKind);
}

export type PairRoomLobbyVisibility = {
    roomKind: RoomKind;
    pairMode?: 'pvp' | 'ai';
    mode?: 'pvp' | 'ai';
    lobbyChannel?: ArenaChannel;
    pairAiDuoInviteShell?: boolean;
    pairPetRankedQueueShell?: boolean;
    ownerId?: string;
};

/** 페어 방의 로비 intent — 초대 수락·복귀 네비게이션용 */
export function arenaLobbyIntentFromPairRoom(
    room: Pick<PairRoomLobbyVisibility, 'pairMode' | 'mode' | 'roomKind'> | null | undefined,
): ArenaLobbyIntent {
    if (!room) return 'pvp';
    const pairMode = room.pairMode ?? room.mode;
    if (pairMode === 'ai') return 'ai';
    if (pairMode === 'pvp') return 'pvp';
    if (room.roomKind === 'arena_ai') return 'ai';
    return 'pvp';
}

/** 페어 AI 2인 팀 초대 전용 방(구형 duo_match + pairMode ai 포함) */
export function isPairAiDuoInviteOnlyRoom(room: PairRoomLobbyVisibility): boolean {
    const pairMode = room.pairMode ?? room.mode;
    const channel = room.lobbyChannel ?? 'pair';
    return Boolean(
        room.pairAiDuoInviteShell ||
            (room.roomKind === 'duo_match' && pairMode === 'ai' && channel === 'pair'),
    );
}

/**
 * PVP 페어 방과 달리 AI 로비 껍데기 방은 화면 이동 시 나가기 확인을 띄우지 않는다.
 * (`arena_ai`, `ai_duel`, 페어 2인 AI 초대 전용 `duo_match` 등)
 */
export function pairRoomRequiresLeaveConfirmation(room: PairRoomLobbyVisibility): boolean {
    const intent = arenaLobbyIntentFromPairRoom(room);
    if (intent !== 'ai') return true;
    if (room.roomKind === 'arena_ai' || room.roomKind === 'ai_duel') return false;
    if (isPairAiDuoInviteOnlyRoom(room)) return false;
    return true;
}

/** 로비 intent·채널 기준 방 목록·슬롯 그리드 노출 여부 */
export function isPairRoomVisibleInLobbyIntent(
    room: PairRoomLobbyVisibility,
    dest: ArenaLobbyDestination,
    viewerUserId?: string,
): boolean {
    if (!roomKindsForLobbyDestination(dest).includes(room.roomKind)) return false;
    const pairMode = room.pairMode ?? room.mode ?? 'pvp';
    if (dest.intent === 'pvp' && pairMode === 'ai') return false;
    if (dest.intent === 'ai' && pairMode === 'pvp') return false;
    if (viewerUserId) {
        if (room.pairPetRankedQueueShell && room.ownerId !== viewerUserId) return false;
        if (isPairAiDuoInviteOnlyRoom(room) && room.ownerId !== viewerUserId) return false;
    }
    return true;
}

/** 게임 세션 종료·복귀 hash — AI/PVP intent와 채널을 세션에서 유도 */
export function arenaLobbyHashFromSession(session: {
    isAiGame?: boolean;
    mode?: GameMode | null;
    settings?: Pick<GameSettings, 'pairGame'> | null;
}): string {
    const settings = session.settings as Pick<GameSettings, 'pairGame'> | null | undefined;
    const channel =
        arenaChannelForSettings(settings ?? undefined) ??
        arenaChannelForGameMode(session.mode ?? undefined) ??
        'strategic';
    const pairMode = settings?.pairGame?.pairMode;
    let intent: ArenaLobbyIntent =
        pairMode === 'ai' ? 'ai' : pairMode === 'pvp' ? 'pvp' : session.isAiGame ? 'ai' : 'pvp';
    return arenaLobbyHash({ intent, channel });
}
