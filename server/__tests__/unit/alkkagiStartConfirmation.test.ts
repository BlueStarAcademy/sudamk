import { describe, expect, it } from 'vitest';
import { GameMode, Player, AlkkagiPlacementType } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { handleAlkkagiAction, updateAlkkagiState } from '../../modes/alkkagi.js';
import { updatePlayfulGameState } from '../../modes/playful.js';

function makePvpAlkkagiSession(): LiveGameSession {
    const p1 = { id: 'user-p1', nickname: 'P1' } as LiveGameSession['player1'];
    const p2 = { id: 'user-p2', nickname: 'P2' } as LiveGameSession['player2'];
    return {
        id: 'alkkagi-pvp-1',
        mode: GameMode.Alkkagi,
        gameStatus: 'alkkagi_start_confirmation',
        isAiGame: false,
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        preGameConfirmations: { [p1.id]: false, [p2.id]: false },
        revealEndTime: Date.now() + 30_000,
        settings: {
            alkkagiPlacementType: AlkkagiPlacementType.TurnByTurn,
            alkkagiStoneCount: 5,
        },
        alkkagiStones: [],
        alkkagiStones_p1: [],
        alkkagiStones_p2: [],
        alkkagiStonesPlacedThisRound: { [p1.id]: 0, [p2.id]: 0 },
    } as LiveGameSession;
}

describe('alkkagi PVP start confirmation', () => {
    it('transitions to placement when both players confirm via updateAlkkagiState', () => {
        const game = makePvpAlkkagiSession();
        game.preGameConfirmations![game.player1.id] = true;
        game.preGameConfirmations![game.player2.id] = true;

        updateAlkkagiState(game, Date.now());

        expect(game.gameStatus).toBe('alkkagi_placement');
        expect(game.currentPlayer).toBe(Player.Black);
        expect(game.preGameConfirmations).toEqual({});
        expect(game.revealEndTime).toBeUndefined();
    });

    it('handleAlkkagiAction records confirmation; updatePlayfulGameState advances when both ready', async () => {
        const game = makePvpAlkkagiSession();
        const now = Date.now();

        await handleAlkkagiAction({} as any, game, { type: 'CONFIRM_ALKKAGI_START', userId: game.player1.id } as any, game.player1);
        expect(game.gameStatus).toBe('alkkagi_start_confirmation');
        expect(game.preGameConfirmations?.[game.player1.id]).toBe(true);

        await handleAlkkagiAction({} as any, game, { type: 'CONFIRM_ALKKAGI_START', userId: game.player2.id } as any, game.player2);
        expect(game.preGameConfirmations?.[game.player2.id]).toBe(true);

        await updatePlayfulGameState(game, now);

        expect(game.gameStatus).toBe('alkkagi_placement');
        expect(game.currentPlayer).toBe(Player.Black);
    });
});
