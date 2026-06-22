import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { LiveGameSession, User } from '../../../shared/types/entities.js';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import { createDefaultUser } from '../../initialData.js';
import {
    chargeActionPointsOnInGameStart,
    chargeActionPointsOnPveVictory,
    resolveActionPointChargePolicy,
} from '../../utils/actionPointSpendTiming.js';

vi.mock('../../db.js', () => ({
    getUser: vi.fn(),
    updateUser: vi.fn(),
}));

const baseUser = (id: string): User => {
    const u = createDefaultUser(id, id, id);
    u.actionPoints = { current: 10, max: 30 };
    u.isAdmin = false;
    return u;
};

describe('resolveActionPointChargePolicy', () => {
    it('returns on_pve_victory for singleplayer and tower', () => {
        expect(resolveActionPointChargePolicy({ isSinglePlayer: true, gameCategory: GameCategory.SinglePlayer })).toBe(
            'on_pve_victory',
        );
        expect(resolveActionPointChargePolicy({ gameCategory: GameCategory.Tower })).toBe('on_pve_victory');
    });

    it('returns on_in_game_start for adventure, AI, and PVP', () => {
        expect(
            resolveActionPointChargePolicy({
                gameCategory: GameCategory.Adventure,
                isAiGame: true,
            }),
        ).toBe('on_in_game_start');
        expect(resolveActionPointChargePolicy({ isAiGame: true, gameCategory: GameCategory.Normal })).toBe(
            'on_in_game_start',
        );
        expect(
            resolveActionPointChargePolicy({
                gameCategory: GameCategory.Normal,
                isAiGame: false,
                settings: {},
            }),
        ).toBe('on_in_game_start');
    });
});

describe('chargeActionPointsOnPveVictory', () => {
    it('deducts AP only on victory for singleplayer', async () => {
        const user = baseUser('sp-user');
        const game = {
            id: 'sp-game-1',
            isSinglePlayer: true,
            gameCategory: GameCategory.SinglePlayer,
            singlePlayerStartActionPointCost: 2,
        } as LiveGameSession;

        const charged = await chargeActionPointsOnPveVictory(user, game, 2);
        expect(charged).toBe(2);
        expect(user.actionPoints.current).toBe(8);
        expect(game.actionPointsChargedOnVictory).toBe(true);
    });

    it('does not double-charge on repeat calls', async () => {
        const user = baseUser('sp-user-2');
        const game = {
            id: 'sp-game-2',
            isSinglePlayer: true,
            gameCategory: GameCategory.SinglePlayer,
            actionPointsChargedOnVictory: true,
        } as LiveGameSession;

        const charged = await chargeActionPointsOnPveVictory(user, game, 2);
        expect(charged).toBe(0);
        expect(user.actionPoints.current).toBe(10);
    });
});

describe('chargeActionPointsOnInGameStart', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const db = await import('../../db.js');
        vi.mocked(db.updateUser).mockResolvedValue(undefined);
    });

    it('deducts AP when PVP game enters playing', async () => {
        const p1 = baseUser('p1');
        const p2 = baseUser('p2');
        const db = await import('../../db.js');
        vi.mocked(db.getUser).mockImplementation((id: string) => {
            if (id === 'p1') return Promise.resolve(p1);
            if (id === 'p2') return Promise.resolve(p2);
            return Promise.resolve(null);
        });

        const game = {
            id: 'pvp-game-1',
            mode: GameMode.Standard,
            gameCategory: GameCategory.Normal,
            gameStatus: 'playing',
            isAiGame: false,
            isRankedGame: false,
            player1: p1,
            player2: p2,
            blackPlayerId: 'p1',
            whitePlayerId: 'p2',
            settings: {},
            currentPlayer: Player.Black,
        } as LiveGameSession;

        const result = await chargeActionPointsOnInGameStart(game);
        expect(result.charged).toBe(true);
        expect(p1.actionPoints.current).toBeLessThan(10);
        expect(p2.actionPoints.current).toBeLessThan(10);
        expect(game.actionPointsChargedAtStart).toBe(true);
    });

    it('skips charge for singleplayer sessions', async () => {
        const user = baseUser('sp-only');
        const game = {
            id: 'sp-game-3',
            isSinglePlayer: true,
            gameCategory: GameCategory.SinglePlayer,
            gameStatus: 'playing',
            player1: user,
            player2: { id: 'ai' },
            settings: {},
        } as LiveGameSession;

        const result = await chargeActionPointsOnInGameStart(game);
        expect(result.charged).toBe(false);
        expect(user.actionPoints.current).toBe(10);
    });
});
