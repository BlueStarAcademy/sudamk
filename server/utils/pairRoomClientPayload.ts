import type { PairRoomState } from '../../types/index.js';

/** 페어 AI 2인 팀 초대 전용 방(구형 duo_match + pairMode ai 포함) */
export function isPairAiDuoInviteOnlyRoom(room: PairRoomState): boolean {
    const pairMode = room.pairMode ?? room.mode;
    const channel = room.lobbyChannel ?? 'pair';
    return Boolean(
        room.pairAiDuoInviteShell ||
            (room.roomKind === 'duo_match' && pairMode === 'ai' && channel === 'pair'),
    );
}

function withPairAiDuoInviteShellFlag(room: PairRoomState): PairRoomState {
    if (isPairAiDuoInviteOnlyRoom(room)) {
        return { ...room, pairAiDuoInviteShell: true };
    }
    return room;
}

/** 목록·브로드캐스트용 — 클라이언트가 팀 페이로드 없이도 착석 수를 그릴 수 있게 함 */
export function countPairRoomHumansForClientList(room: PairRoomState): number {
    const members = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
    const userMembers = members.filter((m) => String(m.kind || '').toLowerCase() === 'user');
    if (userMembers.length > 0) {
        return new Set(userMembers.map((m) => m.id)).size;
    }
    let n = 1;
    if (room.partnerId && !String(room.partnerId).startsWith('pet-ai-')) n += 1;
    return n;
}

export function enrichPairRoomsForClientPayload(
    pairRooms: Record<string, PairRoomState> | undefined,
): Record<string, PairRoomState & { listOccupiedHumans: number }> {
    const src = pairRooms || {};
    const out: Record<string, PairRoomState & { listOccupiedHumans: number }> = {};
    for (const [id, room] of Object.entries(src)) {
        const normalized = withPairAiDuoInviteShellFlag(room);
        out[id] = { ...normalized, listOccupiedHumans: countPairRoomHumansForClientList(normalized) };
    }
    return out;
}
