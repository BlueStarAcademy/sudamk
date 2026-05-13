import { normalizePairListRoomKind, type PairLobbyChannel, type PairLobbyRoomKind } from './pairLobbyGameSettingRows.js';

export type PairInviteRoomLike = {
    roomKind?: PairLobbyRoomKind | string;
    title?: string;
    lobbyChannel?: PairLobbyChannel;
    partnerId?: string;
};

/** `PairWaitingLobby`의 `pairLobbyListDisplayRoomKind`와 동일한 휴리스틱(초대 모달·요약용) */
export function pairInviteDisplayRoomKind(
    room: PairInviteRoomLike,
    channelFallback: PairLobbyChannel = 'pair',
): PairLobbyRoomKind | undefined {
    const n = normalizePairListRoomKind(room);
    if (n) return n;
    const ch = room.lobbyChannel ?? channelFallback;
    if (ch === 'strategic' || ch === 'playful') {
        if (room.partnerId && String(room.partnerId).startsWith('pet-ai-')) return 'arena_ai';
        return 'duo_match';
    }
    if (/님의\s*4인\s*페어방/i.test(String(room.title || ''))) return 'friendly_4p';
    return undefined;
}

/** `PairWaitingLobby`의 `roomKindLabel`과 동일 규칙 */
export function pairInviteRoomKindLabel(kind: PairLobbyRoomKind | undefined, lobbyChannel: PairLobbyChannel): string {
    if (!kind) return '';
    if (kind === 'arena_ai') return 'AI와 대결';
    if (kind === 'ai_duel') return '펫 페어';
    if (lobbyChannel === 'pair' && kind === 'duo_match') return '2인 AI대전';
    if (lobbyChannel === 'strategic' || lobbyChannel === 'playful') {
        if (kind === 'duo_match') return '친선전';
        if (kind === 'friendly_4p') return '4인 친선';
        if (kind === 'friendly_2p') return '2인 친선';
    }
    if (kind === 'friendly_4p') return '4인 친선';
    if (kind === 'friendly_2p') return '2인 친선';
    return String(kind);
}
