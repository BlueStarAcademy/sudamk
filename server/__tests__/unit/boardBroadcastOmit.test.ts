import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { shouldOmitBoardStateInBroadcast } from '../../utils/boardBroadcastOmit.js';

function session(overrides: Partial<LiveGameSession>): LiveGameSession {
    return {
        id: 'omit-test',
        mode: GameMode.Standard,
        settings: { boardSize: 9 },
        ...overrides,
    } as LiveGameSession;
}

describe('shouldOmitBoardStateInBroadcast', () => {
    it('keeps board for singleplayer and tower (client scoring snapshot)', () => {
        expect(shouldOmitBoardStateInBroadcast(session({ isSinglePlayer: true, gameCategory: GameCategory.SinglePlayer }))).toBe(
            false,
        );
        expect(shouldOmitBoardStateInBroadcast(session({ gameCategory: GameCategory.Tower, isAiGame: true }))).toBe(false);
    });

    it('keeps board for adventure/guildwar Kata PVE', () => {
        expect(shouldOmitBoardStateInBroadcast(session({ gameCategory: GameCategory.Adventure, isAiGame: true }))).toBe(false);
        expect(shouldOmitBoardStateInBroadcast(session({ gameCategory: 'guildwar' as any, isAiGame: true }))).toBe(false);
    });

    it('omits board for human PVP', () => {
        expect(
            shouldOmitBoardStateInBroadcast(
                session({
                    gameCategory: GameCategory.Normal,
                    isAiGame: false,
                    isSinglePlayer: false,
                    blackPlayerId: 'u1',
                    whitePlayerId: 'u2',
                }),
            ),
        ).toBe(true);
    });
});
