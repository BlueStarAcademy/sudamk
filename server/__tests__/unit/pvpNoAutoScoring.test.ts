import { describe, it, expect } from 'vitest';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { GameMode, GameCategory, Player } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';
import { resolveArenaFixedScoringTurnLimit } from '../../utils/arenaTurnPolicy.js';
import {
    humanPvpAllowsMoveCountAutoScoring,
    isHumanOneVsOnePvpStrategic,
} from '../../modes/pvpStrategicPipeline.js';

function makeHumanPvpGame(): LiveGameSession {
    const p1 = createDefaultUser('p1', 'p1', 'P1');
    const p2 = createDefaultUser('p2', 'p2', 'P2');
    return {
        id: 'game-pvp-1',
        mode: GameMode.Standard,
        settings: { boardSize: 19, komi: 6.5, scoringTurnLimit: 200, timeLimit: 5 },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        boardState: Array(19).fill(0).map(() => Array(19).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null,
        winReason: null,
        createdAt: Date.now(),
        lastMove: null,
        passCount: 0,
        round: 0,
        turnInRound: 0,
        koInfo: null,
        gameCategory: GameCategory.Normal,
        isAiGame: false,
    } as LiveGameSession;
}

describe('human PVP auto-scoring guards', () => {
    it('isHumanOneVsOnePvpStrategic detects 1v1 PVP', () => {
        expect(isHumanOneVsOnePvpStrategic(makeHumanPvpGame())).toBe(true);
    });

    it('resolveArenaFixedScoringTurnLimit returns undefined for human PVP even with scoringTurnLimit in settings', async () => {
        const limit = await resolveArenaFixedScoringTurnLimit(makeHumanPvpGame());
        expect(limit).toBeUndefined();
    });

    it('resolveArenaFixedScoringTurnLimit honors ranked scoringTurnLimit for human PVP', async () => {
        const game = makeHumanPvpGame();
        game.isRankedGame = true;
        game.settings = { boardSize: 19, komi: 6.5, scoringTurnLimit: 200, timeLimit: 5 };
        const limit = await resolveArenaFixedScoringTurnLimit(game);
        expect(limit).toBe(200);
        expect(humanPvpAllowsMoveCountAutoScoring(game)).toBe(true);
    });

    it('AI game still resolves turn limit', async () => {
        const game = makeHumanPvpGame();
        game.isAiGame = true;
        game.settings.scoringTurnLimit = 80;
        const limit = await resolveArenaFixedScoringTurnLimit(game);
        expect(limit).toBe(80);
    });
});
