import { describe, it, expect } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { resolveBasePlacementSeatColors } from '../../../shared/utils/basePlacementSeatColors.js';

const baseSession = (): LiveGameSession =>
    ({
        player1: { id: 'p1', nickname: 'P1' } as any,
        player2: { id: 'p2', nickname: 'P2' } as any,
        blackPlayerId: null,
        whitePlayerId: null,
    }) as LiveGameSession;

describe('resolveBasePlacementSeatColors', () => {
    it('uses provisional black seat during capture_bidding when final seats are empty', () => {
        const session = baseSession();
        session.gameStatus = 'capture_bidding';
        session.basePlacementBlackPlayerId = 'p2';
        session.basePlacementWhitePlayerId = 'p1';

        const colors = resolveBasePlacementSeatColors(session);
        expect(colors.baseStonesP1Player).toBe(Player.White);
        expect(colors.baseStonesP2Player).toBe(Player.Black);
    });

    it('prefers committed black seat when both exist', () => {
        const session = baseSession();
        session.gameStatus = 'base_game_start_confirmation';
        session.blackPlayerId = 'p1';
        session.whitePlayerId = 'p2';
        session.basePlacementBlackPlayerId = 'p2';
        session.basePlacementWhitePlayerId = 'p1';

        const colors = resolveBasePlacementSeatColors(session);
        expect(colors.baseStonesP1Player).toBe(Player.Black);
        expect(colors.baseStonesP2Player).toBe(Player.White);
    });
});
