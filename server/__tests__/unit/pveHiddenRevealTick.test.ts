import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, Player, type LiveGameSession } from '../../../types/index.js';

vi.mock('../../modes/hidden.js', () => ({
    updateHiddenState: vi.fn(async (game: LiveGameSession) => {
        if (game.gameStatus === 'hidden_reveal_animating' && (game.revealAnimationEndTime ?? 0) <= Date.now()) {
            game.gameStatus = 'playing';
            game.animation = null;
            game.revealAnimationEndTime = undefined;
            return true;
        }
        return false;
    }),
}));
vi.mock('../../modes/missile.js', () => ({
    updateMissileState: vi.fn(() => false),
}));
vi.mock('./broadcastItemPhaseSnapshot.js', () => ({
    broadcastItemPhaseSnapshot: vi.fn().mockResolvedValue(undefined),
}));

describe('finalizePveHiddenRevealIfExpired', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('ticks adventure hidden reveal when animation deadline passed', async () => {
        const game = {
            id: 'adv-reveal-1',
            gameCategory: 'adventure',
            isAiGame: true,
            mode: GameMode.Hidden,
            gameStatus: 'hidden_reveal_animating',
            revealAnimationEndTime: Date.now() - 100,
            currentPlayer: Player.White,
            blackPlayerId: 'user-1',
            whitePlayerId: 'ai-player-01',
            moveHistory: [],
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
            settings: { boardSize: 9 },
        } as LiveGameSession;

        const { finalizePveHiddenRevealIfExpired } = await import('../../utils/pveHiddenRevealTick.js');
        const changed = await finalizePveHiddenRevealIfExpired(game, Date.now());
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
    });

    it('no-ops when reveal animation still active', async () => {
        const game = {
            id: 'adv-reveal-2',
            gameCategory: 'adventure',
            isAiGame: true,
            mode: GameMode.Hidden,
            gameStatus: 'hidden_reveal_animating',
            revealAnimationEndTime: Date.now() + 5000,
            settings: { boardSize: 9 },
        } as LiveGameSession;

        const { finalizePveHiddenRevealIfExpired } = await import('../../utils/pveHiddenRevealTick.js');
        const changed = await finalizePveHiddenRevealIfExpired(game, Date.now());
        expect(changed).toBe(false);
        expect(game.gameStatus).toBe('hidden_reveal_animating');
    });
});
