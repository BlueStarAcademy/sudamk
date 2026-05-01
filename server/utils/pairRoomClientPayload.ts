import type { PairRoomState } from '../../types/index.js';

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
        out[id] = { ...room, listOccupiedHumans: countPairRoomHumansForClientList(room) };
    }
    return out;
}
