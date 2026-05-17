import type { LiveGameSession, User } from '../types/entities.js';
import { getPairPetDefinition } from '../constants/petLobby.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';
import {
    isPairAiOpponentSyntheticDisplayParticipant,
    resolvePairAiOpponentPetSyntheticDisplayLevel,
} from './strategicAiDifficulty.js';
import { pairTurnSeatIdShortLabel, type PairGameTurnSeat } from './pairGameTurn.js';

function pairSeatOwnerUser(
    session: Pick<LiveGameSession, 'player1' | 'player2'>,
    seat: PairGameTurnSeat,
): User | null {
    const pid = seat.participantId;
    if (session.player1.id === pid) return session.player1;
    if (session.player2.id === pid) return session.player2;
    if (pid.startsWith('pet-ai-')) {
        const uid = pid.slice('pet-ai-'.length);
        if (session.player1.id === uid) return session.player1;
        if (session.player2.id === uid) return session.player2;
    }
    return null;
}

/** 전광판·턴 안내: `Lv.N` + 표시 이름 */
export function resolvePairTurnSeatTickerDisplay(
    session: Pick<LiveGameSession, 'id' | 'settings' | 'player1' | 'player2'>,
    seat: PairGameTurnSeat,
): { level: number; name: string } {
    const owner = pairSeatOwnerUser(session, seat);
    if (seat.kind === 'user') {
        const level = Math.max(1, Number(owner?.userLevel ?? 1) || 1);
        return { level, name: owner?.nickname?.trim() || seat.name || '유저' };
    }

    if (owner) {
        const row = getEquippedPairPetInventoryRow(owner);
        const def = row?.templateId ? getPairPetDefinition(row.templateId) : null;
        const meta = row ? resolvePairPetMetaFromInventoryRow(row) : null;
        const level = Math.max(1, Number(meta?.level ?? 1) || 1);
        return { level, name: def?.displayName ?? row?.name ?? seat.name ?? '펫' };
    }

    if (isPairAiOpponentSyntheticDisplayParticipant(seat.participantId)) {
        const level = resolvePairAiOpponentPetSyntheticDisplayLevel(
            session.id,
            session.settings,
            seat.participantId,
        );
        const fallbackIndex = seat.participantId === 'pair-opponent-pet' ? 1 : 0;
        const def = getPairPetDefinition(`pair-pet-${fallbackIndex + 1}`);
        return { level, name: def?.displayName ?? seat.name ?? '펫' };
    }

    return { level: 1, name: seat.name || '펫' };
}

/** 예: `[백2] Lv.12 펫이름 님의 차례입니다.` */
export function formatPairTurnTickerMessage(
    session: Pick<LiveGameSession, 'id' | 'settings' | 'player1' | 'player2'>,
    seat: PairGameTurnSeat,
): string {
    const seatLabel = pairTurnSeatIdShortLabel(seat.seatId);
    const { level, name } = resolvePairTurnSeatTickerDisplay(session, seat);
    return `[${seatLabel}] Lv.${level} ${name} 님의 차례입니다.`;
}
