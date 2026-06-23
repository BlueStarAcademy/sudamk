import type { PairRoomState, VolatileState } from '../../types.js';
import { UserStatus } from '../../types/enums.js';

function collectPairRoomHumanMemberIds(room: PairRoomState): string[] {
    const ids = new Set<string>();
    if (room.ownerId) ids.add(room.ownerId);
    if (room.partnerId && !String(room.partnerId).startsWith('pet-ai-')) {
        ids.add(room.partnerId);
    }
    for (const member of room.extraPairMembers ?? []) {
        if (member?.id && !String(member.id).startsWith('pet-ai-')) {
            ids.add(member.id);
        }
    }
    return [...ids];
}

/** 경기 종료·대기실 복귀 후 방 멤버의 stale `in-game` 상태를 대기로 되돌린다. */
export function restorePairRoomMemberLobbyStatuses(
    volatileState: VolatileState,
    room: PairRoomState,
): boolean {
    if (!volatileState.userStatuses || room.phase === 'in_game') return false;
    const channel = room.lobbyChannel ?? 'pair';
    const lobbyIntent = room.pairMode === 'ai' ? 'ai' : 'pvp';
    let changed = false;
    for (const userId of collectPairRoomHumanMemberIds(room)) {
        const status = volatileState.userStatuses[userId];
        if (!status || status.status !== UserStatus.InGame) continue;
        status.status = UserStatus.Waiting;
        delete status.gameId;
        status.arenaChannel = channel;
        status.lobbyIntent = lobbyIntent;
        if (channel === 'strategic' || channel === 'playful') {
            status.waitingLobby = channel;
            delete status.inPairLobby;
        } else {
            status.inPairLobby = true;
            delete status.waitingLobby;
        }
        changed = true;
    }
    return changed;
}

function isSyntheticPairPartnerId(id: string | undefined): boolean {
    if (!id) return false;
    const s = String(id);
    return s.startsWith('pet-ai-') || s.startsWith('pair-');
}

/** `resetPairRoomReadinessAfterLobbyConfigChange`와 동일 기준 — 인간 손님은 항상 미준비 */
function resolvePartnerReadyAfterGameReset(room: PairRoomState): boolean {
    const pid = room.partnerId;
    if (pid && !isSyntheticPairPartnerId(pid)) return false;
    if (pid && isSyntheticPairPartnerId(pid)) return true;
    return room.roomKind === 'friendly_4p';
}

/** 경기 종료·대기실 복귀 시 페어 방 준비 상태를 초기화한다(손님은 다시 준비 버튼 필요). */
export function resetPairRoomAfterGame(room: PairRoomState): void {
    room.matchStartedAt = undefined;
    room.phase = 'waiting';
    room.ownerReady = false;
    room.partnerReady = resolvePartnerReadyAfterGameReset(room);
    if (room.extraPairMembers?.length) {
        room.extraPairMembers = room.extraPairMembers.map((m) => ({ ...m, ready: false }));
    }
    for (const team of [room.teamA, room.teamB]) {
        for (const member of team?.members ?? []) {
            if (member.id === room.ownerId) {
                member.ready = false;
            } else if (member.id === room.partnerId) {
                member.ready = room.partnerReady;
            } else if (member.kind === 'ai' || member.kind === 'pet') {
                member.ready = true;
            } else {
                member.ready = false;
            }
        }
    }
}

export function pairRoomHumanMemberIdSet(room: PairRoomState): Set<string> {
    return new Set(collectPairRoomHumanMemberIds(room));
}
