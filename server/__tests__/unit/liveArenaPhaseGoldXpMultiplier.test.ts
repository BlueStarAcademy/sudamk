import { describe, expect, it } from 'vitest';
import { GameMode, GameCategory } from '../../../shared/types/index.js';
import { resolveLiveArenaPhaseGoldXpMultiplier } from '../../../shared/utils/liveArenaPhaseGoldXpMultiplier.js';

describe('resolveLiveArenaPhaseGoldXpMultiplier', () => {
    it('returns 0.3 / 0.6 / 1.0 by total ply on 19-line (same bands as pairPetKataPhase)', () => {
        const base = {
            mode: GameMode.Standard,
            gameCategory: GameCategory.Normal,
            isSinglePlayer: false,
            settings: {
                boardSize: 19 as const,
                komi: 0.5,
                timeLimit: 10,
                byoyomiTime: 0,
                byoyomiCount: 0,
                pairGame: { lobbyChannel: 'strategic' as const } as any,
            },
        };
        expect(resolveLiveArenaPhaseGoldXpMultiplier({ ...base, moveHistory: Array(30) as any })).toBe(0.3);
        expect(resolveLiveArenaPhaseGoldXpMultiplier({ ...base, moveHistory: Array(90) as any })).toBe(0.6);
        expect(resolveLiveArenaPhaseGoldXpMultiplier({ ...base, moveHistory: Array(130) as any })).toBe(1.0);
    });

    it('returns null for playful channel', () => {
        expect(
            resolveLiveArenaPhaseGoldXpMultiplier({
                mode: GameMode.Standard,
                gameCategory: GameCategory.Normal,
                isSinglePlayer: false,
                settings: {
                    boardSize: 19 as const,
                    komi: 0.5,
                    timeLimit: 10,
                    byoyomiTime: 0,
                    byoyomiCount: 0,
                    pairGame: { lobbyChannel: 'playful' as const } as any,
                },
                moveHistory: Array(200) as any,
            }),
        ).toBeNull();
    });

    it('returns null for adventure', () => {
        expect(
            resolveLiveArenaPhaseGoldXpMultiplier({
                mode: GameMode.Standard,
                gameCategory: 'adventure' as any,
                isSinglePlayer: false,
                settings: { boardSize: 19 as const, komi: 0.5, timeLimit: 10, byoyomiTime: 0, byoyomiCount: 0 },
                moveHistory: Array(200) as any,
            }),
        ).toBeNull();
    });
});
