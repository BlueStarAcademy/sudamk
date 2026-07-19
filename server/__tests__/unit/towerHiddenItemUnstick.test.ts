import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { updateTowerPlayerHiddenState } from '../../modes/towerPlayerHidden.js';

describe('updateTowerPlayerHiddenState unstick', () => {
    it('recovers hidden_placing when itemUseDeadline is missing', async () => {
        const game = {
            id: 'tower-unstick-hidden',
            gameCategory: GameCategory.Tower,
            mode: GameMode.Hidden,
            gameStatus: 'hidden_placing',
            currentPlayer: Player.Black,
            player1: { id: 'human-1', nickname: 'H' },
            player2: { id: 'ai-player-01', nickname: 'AI' },
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            settings: { boardSize: 9, hiddenStoneCount: 2 },
            hidden_stones_p1: 2,
            hidden_stones_p2: 0,
            itemUseDeadline: undefined,
            pausedTurnTimeLeft: 30,
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
            moveHistory: [],
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        } as unknown as LiveGameSession;

        await updateTowerPlayerHiddenState(game, Date.now());

        expect(game.gameStatus).toBe('playing');
        expect(game.itemUseDeadline).toBeUndefined();
        expect((game as any).hidden_stones_p1).toBe(1);
        expect((game as any)._itemTimeoutStateChanged).toBe(true);
    });

    it('recovers scanning when itemUseDeadline is missing without consuming scan count', async () => {
        const game = {
            id: 'tower-unstick-scan',
            gameCategory: GameCategory.Tower,
            mode: GameMode.Hidden,
            gameStatus: 'scanning',
            currentPlayer: Player.Black,
            player1: { id: 'human-1', nickname: 'H' },
            player2: { id: 'ai-player-01', nickname: 'AI' },
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            settings: { boardSize: 9, scanCount: 2 },
            scans_p1: 2,
            itemUseDeadline: undefined,
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
            moveHistory: [],
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        } as unknown as LiveGameSession;

        await updateTowerPlayerHiddenState(game, Date.now());

        expect(game.gameStatus).toBe('playing');
        expect((game as any).scans_p1).toBe(2);
        expect((game as any)._itemTimeoutStateChanged).toBe(true);
    });
});
