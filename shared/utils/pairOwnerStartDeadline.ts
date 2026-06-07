import type { PairRoomState } from '../types/api.js';
import { PAIR_OWNER_START_DEADLINE_MS } from '../constants/pairOwnerStart.js';

function isPetAiSeatId(userId: string | undefined | null): boolean {
    return Boolean(userId && String(userId).startsWith('pet-ai-'));
}

function collectPairRoomHumanUserIds(room: PairRoomState): Set<string> {
    const ids = new Set<string>();
    if (room.ownerId) ids.add(room.ownerId);
    if (room.partnerId && !isPetAiSeatId(room.partnerId)) ids.add(room.partnerId);
    for (const m of room.extraPairMembers ?? []) {
        if (m?.id && !isPetAiSeatId(m.id)) ids.add(m.id);
    }
    for (const m of [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])]) {
        const kind = String(m?.kind ?? '').toLowerCase();
        if (m?.id && (kind === 'user' || kind === '' || kind === 'player')) ids.add(m.id);
    }
    return ids;
}

function pairLobbySlotReadyStrict(room: PairRoomState, userId: string): boolean {
    if (room.partnerId === userId) return room.partnerReady === true;
    const ex = room.extraPairMembers?.find((e) => e.id === userId);
    return ex ? ex.ready === true : false;
}

function pairLobbyEffectiveHumanReady(room: PairRoomState, userId: string): boolean {
    if (!userId || userId === room.ownerId) return true;
    const rows = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
    const tMember = rows.find((m) => m.id === userId);
    const slot = pairLobbySlotReadyStrict(room, userId);
    if (tMember?.ready === true || slot) return true;
    if (tMember?.ready === false && !slot) return false;
    return slot;
}

export function pairLobbyAllNonOwnerHumansReady(room: PairRoomState): boolean {
    for (const id of collectPairRoomHumanUserIds(room)) {
        if (id === room.ownerId) continue;
        if (!pairLobbyEffectiveHumanReady(room, id)) return false;
    }
    return true;
}

export function pairLobbyHasAnyNonOwnerHuman(room: PairRoomState): boolean {
    for (const id of collectPairRoomHumanUserIds(room)) {
        if (id !== room.ownerId) return true;
    }
    return false;
}

function userInPairRoomMembership(room: PairRoomState, userId: string): boolean {
    if (room.ownerId === userId || room.partnerId === userId) return true;
    if ((room.extraPairMembers ?? []).some((m) => m.id === userId)) return true;
    for (const m of [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])]) {
        if (m && String(m.kind).toLowerCase() === 'user' && m.id === userId) return true;
    }
    return false;
}

export function pairRoomSupportsOwnerStartTimeout(room: PairRoomState): boolean {
    if (room.phase === 'in_game' || room.phase === 'matching' || room.phase === 'match_pending') return false;
    if (room.pairRankedPetProposal || room.pairDuoRankedLobbyProposal) return false;
    if (room.roomKind === 'arena_ai' || room.roomKind === 'ai_duel') return false;
    if (room.pairPetMatchingQueuedAt) return false;
    return pairLobbyHasAnyNonOwnerHuman(room);
}

export function recordPairGuestJoinOrder(room: PairRoomState, guestUserId: string): void {
    if (!guestUserId || guestUserId === room.ownerId || isPetAiSeatId(guestUserId)) return;
    if (!room.pairGuestJoinOrder) room.pairGuestJoinOrder = [];
    if (!room.pairGuestJoinOrder.includes(guestUserId)) room.pairGuestJoinOrder.push(guestUserId);
}

export function removePairGuestJoinOrder(room: PairRoomState, userId: string): void {
    if (!room.pairGuestJoinOrder?.length) return;
    room.pairGuestJoinOrder = room.pairGuestJoinOrder.filter((id) => id !== userId);
    if (!room.pairGuestJoinOrder.length) delete room.pairGuestJoinOrder;
}

export function pickFirstJoinedPairRoomGuestSuccessor(
    room: PairRoomState,
    leavingOwnerId: string,
): string | null {
    const tryPick = (id: string | undefined | null): string | null => {
        if (!id || id === leavingOwnerId || isPetAiSeatId(id)) return null;
        if (id === room.ownerId || !userInPairRoomMembership(room, id)) return null;
        return id;
    };
    for (const id of room.pairGuestJoinOrder ?? []) {
        const picked = tryPick(id);
        if (picked) return picked;
    }
    const partnerPick = tryPick(room.partnerId);
    if (partnerPick) return partnerPick;
    for (const m of room.extraPairMembers ?? []) {
        const picked = tryPick(m.id);
        if (picked) return picked;
    }
    return null;
}

export function syncPairOwnerStartDeadline(room: PairRoomState, nowMs: number): void {
    if (
        !pairRoomSupportsOwnerStartTimeout(room) ||
        !pairLobbyHasAnyNonOwnerHuman(room) ||
        !pairLobbyAllNonOwnerHumansReady(room)
    ) {
        delete room.pairOwnerStartDeadlineAt;
        return;
    }
    if (!room.pairOwnerStartDeadlineAt) {
        room.pairOwnerStartDeadlineAt = nowMs + PAIR_OWNER_START_DEADLINE_MS;
    }
}

export function clearPairOwnerStartDeadline(room: PairRoomState): void {
    delete room.pairOwnerStartDeadlineAt;
}

export function pairOwnerStartDeadlineExpired(room: PairRoomState, nowMs: number): boolean {
    return (
        typeof room.pairOwnerStartDeadlineAt === 'number' &&
        nowMs >= room.pairOwnerStartDeadlineAt &&
        pairRoomSupportsOwnerStartTimeout(room) &&
        pairLobbyAllNonOwnerHumansReady(room)
    );
}
