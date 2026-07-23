import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import {
    isAdventureEncounterMonsterTurn,
    resolveAdventureEncounterHumanPlayerEnum,
    resolveAdventureEncounterRemainingMs,
} from '../../../shared/utils/adventureEncounterUi.js';
import { syncAdventureEncounterDeadlineDuringMonsterTurn } from '../../modes/standard.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { GameCategory } from '../../../shared/types/enums.js';

const AI = 'ai-player-01';

describe('resolveAdventureEncounterHumanPlayerEnum', () => {
    it('treats dungeon-bot seat as monster even when id is not ai-player-01', () => {
        expect(
            resolveAdventureEncounterHumanPlayerEnum(
                {
                    blackPlayerId: 'user-1',
                    whitePlayerId: 'dungeon-bot-abc',
                    player1: { id: 'user-1' },
                },
                AI,
            ),
        ).toBe(Player.Black);
    });

    it('falls back to player1 seat when both sides look non-AI', () => {
        expect(
            resolveAdventureEncounterHumanPlayerEnum(
                {
                    blackPlayerId: 'user-1',
                    whitePlayerId: 'user-2',
                    player1: { id: 'user-1' },
                },
                AI,
            ),
        ).toBe(Player.Black);
    });
});

describe('adventure encounter remaining ms (UI)', () => {
    const base = {
        gameCategory: 'adventure' as const,
        gameStatus: 'playing' as const,
        blackPlayerId: 'user-1',
        whitePlayerId: AI,
        player1: { id: 'user-1' },
        adventureEncounterDeadlineMs: 1_000_000,
    };

    it('counts down on human turn', () => {
        const rem = resolveAdventureEncounterRemainingMs(
            { ...base, currentPlayer: Player.Black },
            900_000,
            AI,
        );
        expect(rem).toBe(100_000);
    });

    it('uses frozen remaining on monster turn and does not wall-clock drain', () => {
        const session = {
            ...base,
            currentPlayer: Player.White,
            adventureEncounterFrozenHumanMsRemaining: 55_000,
            adventureEncounterDeadlineMs: 1_000_000,
        };
        expect(resolveAdventureEncounterRemainingMs(session, 990_000, AI)).toBe(55_000);
        expect(resolveAdventureEncounterRemainingMs(session, 999_000, AI)).toBe(55_000);
        expect(isAdventureEncounterMonsterTurn(session, AI)).toBe(true);
    });
});

describe('syncAdventureEncounterDeadlineDuringMonsterTurn', () => {
    it('freezes human remaining and extends deadline on AI turn', () => {
        const now = 1_000_000;
        const game = {
            gameCategory: GameCategory.Adventure,
            gameStatus: 'playing',
            currentPlayer: Player.White,
            blackPlayerId: 'user-1',
            whitePlayerId: AI,
            player1: { id: 'user-1' },
            adventureEncounterDeadlineMs: now + 40_000,
        } as LiveGameSession;

        syncAdventureEncounterDeadlineDuringMonsterTurn(game, now);
        expect(game.adventureEncounterFrozenHumanMsRemaining).toBe(40_000);
        expect(game.adventureEncounterDeadlineMs).toBe(now + 40_000);

        syncAdventureEncounterDeadlineDuringMonsterTurn(game, now + 5_000);
        expect(game.adventureEncounterFrozenHumanMsRemaining).toBe(40_000);
        expect(game.adventureEncounterDeadlineMs).toBe(now + 5_000 + 40_000);
    });

    it('clears frozen when human turn resumes', () => {
        const now = 2_000_000;
        const game = {
            gameCategory: GameCategory.Adventure,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'user-1',
            whitePlayerId: AI,
            player1: { id: 'user-1' },
            adventureEncounterDeadlineMs: now + 30_000,
            adventureEncounterFrozenHumanMsRemaining: 30_000,
        } as LiveGameSession;

        syncAdventureEncounterDeadlineDuringMonsterTurn(game, now);
        expect(game.adventureEncounterFrozenHumanMsRemaining).toBeUndefined();
        expect(game.adventureEncounterDeadlineMs).toBe(now + 30_000);
    });
});
