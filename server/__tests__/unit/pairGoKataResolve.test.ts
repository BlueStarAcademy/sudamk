import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import { buildDefaultKataServerRuntimeSnapshot } from '../../../shared/utils/kataServerRuntimeDefaults.js';
import {
    isPairGoPetKataSeat,
    resolvePairGoKataLevelForSeat,
    resolvePairGoPetKataStatsSixForSeat,
} from '../../../shared/utils/pairGoKataResolve.js';
import { pairPetKataLevelForTotalPly } from '../../../shared/constants/pairArena.js';
import type { PairGameTurnSeat } from '../../../shared/utils/pairGameTurn.js';

const petSeat: PairGameTurnSeat = {
    seatId: 'black2',
    player: Player.Black,
    order: 2,
    participantId: 'pet-ai-u1',
    name: 'Pet',
    kind: 'pet',
    teamId: 'teamA',
    slot: 'ownerPet',
};

const aiSeat: PairGameTurnSeat = {
    seatId: 'white1',
    player: Player.White,
    order: 1,
    participantId: 'pair-opponent-ai',
    name: 'AI',
    kind: 'ai',
    teamId: 'teamB',
    slot: 'opponentAi',
};

describe('pairGoKataResolve', () => {
    it('identifies pet kata seats', () => {
        expect(isPairGoPetKataSeat(petSeat)).toBe(true);
        expect(isPairGoPetKataSeat(aiSeat)).toBe(false);
    });

    it('uses petKataStatsByParticipantId for pet seats, not strategic fallback', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();
        const petSix = {
            concentration: 180,
            thinkingSpeed: 175,
            judgment: 170,
            calculation: 165,
            combatPower: 160,
            stability: 155,
        };
        const settings = {
            boardSize: 19 as const,
            komi: 6.5,
            timeLimit: 10,
            byoyomiTime: 30,
            byoyomiCount: 3,
            pairGame: {
                roomId: 'r1',
                pairMode: 'pvp' as const,
                teamA: { name: 'A', members: [] },
                teamB: { name: 'B', members: [] },
                petKataStatsByParticipantId: { 'pet-ai-u1': petSix },
            },
        };
        const expected = pairPetKataLevelForTotalPly(19, 1, petSix, runtime.pairPet);
        const level = resolvePairGoKataLevelForSeat({
            settings,
            seat: petSeat,
            totalPly: 1,
            goAiProfileLevel: 9,
            kataRuntime: runtime,
            configuredKataLevel: -5,
        });
        expect(level).toBe(expected);
        expect(level).not.toBe(-5);
    });

    it('uses strategic fallback for non-pet AI seats without fixed level', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();
        const settings = {
            boardSize: 19 as const,
            komi: 6.5,
            timeLimit: 10,
            byoyomiTime: 30,
            byoyomiCount: 3,
            pairGame: {
                roomId: 'r1',
                pairMode: 'ai' as const,
                teamA: { name: 'A', members: [] },
                teamB: { name: 'B', members: [] },
                petKataStatsByParticipantId: {
                    'pet-ai-u1': {
                        concentration: 180,
                        thinkingSpeed: 175,
                        judgment: 170,
                        calculation: 165,
                        combatPower: 160,
                        stability: 155,
                    },
                },
            },
        };
        const level = resolvePairGoKataLevelForSeat({
            settings,
            seat: aiSeat,
            totalPly: 1,
            goAiProfileLevel: 5,
            kataRuntime: runtime,
        });
        expect(level).toBe(runtime.strategicLobbyKataByStep['5']);
    });

    it('prefers stored pet stats over default six', () => {
        const stored = {
            concentration: 130,
            thinkingSpeed: 125,
            judgment: 120,
            calculation: 115,
            combatPower: 110,
            stability: 105,
        };
        const settings = {
            pairGame: {
                petKataStatsByParticipantId: { 'pet-ai-u1': stored },
            },
        };
        expect(resolvePairGoPetKataStatsSixForSeat(settings, petSeat)).toEqual(stored);
    });
});
