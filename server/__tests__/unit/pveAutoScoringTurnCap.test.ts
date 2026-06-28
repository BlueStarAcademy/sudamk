import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/enums.js';
import type { LiveGameSession } from '../../../types/index.js';

vi.mock('../../db.js', () => ({
    saveGame: vi.fn(async () => undefined),
}));

vi.mock('../../socket.js', () => ({
    broadcastToGameParticipants: vi.fn(),
}));

vi.mock('../../gameModes.js', () => ({
    getGameResult: vi.fn(async () => undefined),
}));

vi.mock('../../utils/broadcastPlayingBeforeScoring.js', () => ({
    broadcastPlayingSnapshotBeforeScoring: vi.fn(async () => undefined),
}));

vi.mock('../../utils/deferGetGameResultForScoringOverlay.js', () => ({
    deferGetGameResultForScoringOverlay: vi.fn(),
}));

import { maybeEnterPveAutoScoringAtTurnCap } from '../../utils/pveAutoScoringTurnCap.js';
import * as db from '../../db.js';
import { deferGetGameResultForScoringOverlay } from '../../utils/deferGetGameResultForScoringOverlay.js';

function towerGameAtCap(validMoves: number): LiveGameSession {
    const moveHistory = Array.from({ length: validMoves }, (_, i) => ({
        x: i % 9,
        y: Math.floor(i / 9) % 9,
        player: i % 2 === 0 ? Player.Black : Player.White,
    }));
    return {
        id: 'tower-game-test',
        mode: GameMode.Standard,
        isSinglePlayer: false,
        gameCategory: GameCategory.Tower,
        isAiGame: true,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        settings: { boardSize: 9, autoScoringTurns: 40 },
        moveHistory,
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        player1: { id: 'user-1' } as any,
        player2: { id: 'ai-player-01' } as any,
        blackPlayerId: 'user-1',
        whitePlayerId: 'ai-player-01',
    } as LiveGameSession;
}

describe('maybeEnterPveAutoScoringAtTurnCap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('enters scoring when valid moves reached autoScoringTurns cap', async () => {
        const game = towerGameAtCap(40);
        const entered = await maybeEnterPveAutoScoringAtTurnCap(game, 'test');
        expect(entered).toBe(true);
        expect(game.gameStatus).toBe('scoring');
        expect(db.saveGame).toHaveBeenCalled();
        expect(deferGetGameResultForScoringOverlay).toHaveBeenCalledWith(game.id, 'test');
    });

    it('does not enter scoring when moves remain under cap', async () => {
        const game = towerGameAtCap(39);
        const entered = await maybeEnterPveAutoScoringAtTurnCap(game, 'test');
        expect(entered).toBe(false);
        expect(game.gameStatus).toBe('playing');
        expect(db.saveGame).not.toHaveBeenCalled();
    });
});
