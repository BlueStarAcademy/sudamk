import type { ArenaChannel, ArenaLobbyIntent } from '../types/api.js';
import { APP_HOME_HASH } from '../types/navigation.js';
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
    | 'team_pair'
    | 'arena_ai';

export const ARENA_LOBBY_INTENT_LABEL: Record<ArenaLobbyIntent, string> = {
    pvp: 'PVP',
    ai: 'AI',
};

export const ARENA_LOBBY_DESTINATION_TITLE: Record<ArenaChannel, Record<ArenaLobbyIntent, string>> = {
    strategic: { pvp: '랭크·일반 매칭', ai: 'AI 대전' },
    pair: { pvp: '페어 매칭', ai: '페어 AI 대전' },
    playful: { pvp: '놀이터', ai: '놀이터 AI' },
    friendly: { pvp: '친선전', ai: '친선전 (봇)' },
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
        channel === 'strategic' || channel === 'pair' || channel === 'playful' || channel === 'friendly'
            ? channel
            : null;
    if (!normalizedIntent || !normalizedChannel) return null;
    return { intent: normalizedIntent, channel: normalizedChannel };
}

/**
 * 홈 입장카드에 없는 로비 목적지를 홈 정렬 목적지로 접는다.
 * - `#/ai/pair`·`#/ai/playful`·`#/ai/friendly` → `#/ai/strategic`
 * - `#/pvp/pair` → `#/pvp/friendly`
 */
export function canonicalizeHomeAlignedLobbyDestination(
    dest: ArenaLobbyDestination,
): ArenaLobbyDestination {
    /** AI 대전 카드 제거 — 모든 AI intent는 친선전 PVP로 */
    if (dest.intent === 'ai') {
        return { intent: 'pvp', channel: 'friendly' };
    }
    if (dest.intent === 'pvp' && dest.channel === 'pair') {
        return { intent: 'pvp', channel: 'friendly' };
    }
    return dest;
}

export function arenaLobbyHash(
    dest: ArenaLobbyDestination & { queue?: 'ranked' | 'normal' },
): string {
    const canonical = canonicalizeHomeAlignedLobbyDestination(dest);
    const base = `#/${canonical.intent}/${canonical.channel}`;
    if (canonical.channel === 'strategic' && canonical.intent === 'pvp' && dest.queue) {
        return `${base}?queue=${dest.queue}`;
    }
    return base;
}

/** `#/pvp/strategic?queue=normal` 등에서 큐 종류 파싱 */
export function parseStrategicMatchQueueFromHash(hash: string): 'ranked' | 'normal' | null {
    const q = hash.includes('?') ? hash.split('?')[1] : '';
    if (!q) return null;
    const params = new URLSearchParams(q);
    const queue = params.get('queue');
    return queue === 'ranked' || queue === 'normal' ? queue : null;
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
            return ['duo_match'];
        case 'playful':
            /** 놀이터 방만들기: 유저대결 + AI대결 */
            return ['duo_match', 'arena_ai'];
        case 'friendly':
            return ['duo_match', 'friendly_2p', 'team_pair', 'friendly_4p'];
        case 'pair':
            return ['friendly_4p', 'friendly_2p', 'team_pair'];
    }
}

/** AI 로비에서 허용되는 roomKind */
export function aiRoomKindsForChannel(channel: ArenaChannel): RoomKind[] {
    switch (channel) {
        case 'strategic':
            /** 1:1(arena_ai) — 팀페어는 친선 상대 슬롯 AI로 대체, duo_match는 레거시 가시성 */
            return ['arena_ai', 'duo_match'];
        case 'playful':
            /** 홈 기준 놀이터 AI 제거 — 레거시 방 가시성만 유지 */
            return ['duo_match', 'arena_ai'];
        case 'friendly':
            return ['arena_ai', 'duo_match', 'ai_duel'];
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

/** AI 팀페어(사람+사람 vs AI+AI) 초대 전용 방 — 페어·전략 채널(레거시) */
export function isPairAiDuoInviteOnlyRoom(room: PairRoomLobbyVisibility): boolean {
    const pairMode = room.pairMode ?? room.mode;
    const channel = room.lobbyChannel ?? 'pair';
    return Boolean(
        room.pairAiDuoInviteShell ||
            (room.roomKind === 'duo_match' &&
                pairMode === 'ai' &&
                (channel === 'pair' || channel === 'strategic')),
    );
}

/** 친선 1:1·팀페어: 상대 슬롯에 로비 AI를 넣을 수 있는지 (4인 친선은 인간만) */
export function pairRoomAllowsFriendlyOpponentAiSeats(room: {
    roomKind: string;
    lobbyChannel?: string | null;
    pairMode?: string | null;
    mode?: string | null;
    pairAiDuoInviteShell?: boolean;
}): boolean {
    const pairMode = room.pairMode ?? room.mode;
    if (pairMode === 'ai') return false;
    if (room.pairAiDuoInviteShell) return false;
    const channel = room.lobbyChannel ?? 'pair';
    if (room.roomKind === 'duo_match' && channel === 'friendly') return true;
    if (room.roomKind === 'team_pair' && (channel === 'friendly' || channel === 'pair')) return true;
    return false;
}

/** 팀페어: 방장 teamA 빈 슬롯에 장착 펫을 넣어 인간+펫 vs AI로 경기 */
export function pairRoomAllowsFriendlyOwnerPetSeats(room: {
    roomKind: string;
    lobbyChannel?: string | null;
    pairMode?: string | null;
    mode?: string | null;
    pairAiDuoInviteShell?: boolean;
}): boolean {
    const pairMode = room.pairMode ?? room.mode;
    if (pairMode === 'ai') return false;
    if (room.pairAiDuoInviteShell) return false;
    if (room.roomKind !== 'team_pair') return false;
    const channel = room.lobbyChannel ?? 'pair';
    return channel === 'friendly' || channel === 'pair';
}

export const LOBBY_AI_SEAT_ID_PREFIX = 'lobby-ai-b-';

export function lobbyAiSeatParticipantId(index: 0 | 1): string {
    return `${LOBBY_AI_SEAT_ID_PREFIX}${index}`;
}

export function isLobbyAiSeatParticipantId(id: string | null | undefined): boolean {
    return Boolean(id && String(id).startsWith(LOBBY_AI_SEAT_ID_PREFIX));
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
    const isOwnRoom = Boolean(viewerUserId && room.ownerId && room.ownerId === viewerUserId);
    /**
     * 놀이터는 유저대결·AI대결을 한 목록에서 운영한다.
     * 내가 만든/참가 중인 방은 intent 불일치여도 방목록에 남겨 둔다.
     */
    const skipIntentPairModeFilter = dest.channel === 'playful' || isOwnRoom;
    if (!skipIntentPairModeFilter) {
        if (dest.intent === 'pvp' && pairMode === 'ai') return false;
        if (dest.intent === 'ai' && pairMode === 'pvp') return false;
    }
    if (viewerUserId) {
        if (room.pairPetRankedQueueShell && room.ownerId !== viewerUserId) return false;
        if (isPairAiDuoInviteOnlyRoom(room) && room.ownerId !== viewerUserId) return false;
    }
    return true;
}

/**
 * 게임 세션 종료·복귀 hash.
 * 랭킹/일반/친선/AI/놀이터는 홈 퀵패널로 이전되어 전용 로비 해시 대신 홈으로 복귀한다.
 * (guildwar·tower·adventure·singleplayer 등은 호출부에서 별도 처리)
 */
export function arenaLobbyHashFromSession(_session: {
    isAiGame?: boolean;
    mode?: GameMode | null;
    settings?: Pick<GameSettings, 'pairGame'> | null;
}): string {
    return APP_HOME_HASH;
}
