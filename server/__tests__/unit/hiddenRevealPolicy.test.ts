import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    allowsServerRevealOnlyOpponentHiddenAttack,
    isAdventureCategory,
    shouldPreserveDiscovererTurnAfterOpponentHiddenReveal,
    shouldPreserveDiscovererTurnWhenAiRevealsUserHiddenStone,
    skipPendingCaptureForAdventureHiddenReveal,
    useTowerStyleHiddenRevealAnimatingResolution,
} from '../../modes/hiddenRevealPolicy.js';
import { aiUserId } from '../../aiPlayer.js';

const base = (overrides: Partial<LiveGameSession>): LiveGameSession =>
    ({
        id: 'g1',
        mode: GameMode.Hidden,
        isAiGame: true,
        blackPlayerId: 'user-1',
        whitePlayerId: aiUserId,
        currentPlayer: Player.White,
        settings: { boardSize: 9, hiddenStoneCount: 2 },
        ...overrides,
    }) as LiveGameSession;

describe('hiddenRevealPolicy', () => {
    it('adventure skips pending capture on hidden reveal', () => {
        expect(skipPendingCaptureForAdventureHiddenReveal(base({ gameCategory: GameCategory.Adventure }))).toBe(true);
        expect(skipPendingCaptureForAdventureHiddenReveal(base({ isSinglePlayer: true }))).toBe(false);
    });

    it('singleplayer and tower preserve discoverer turn after opponent hidden reveal', () => {
        expect(shouldPreserveDiscovererTurnAfterOpponentHiddenReveal(base({ isSinglePlayer: true }))).toBe(true);
        expect(
            shouldPreserveDiscovererTurnAfterOpponentHiddenReveal(base({ gameCategory: GameCategory.Tower })),
        ).toBe(true);
        expect(
            shouldPreserveDiscovererTurnAfterOpponentHiddenReveal(base({ gameCategory: GameCategory.Adventure })),
        ).toBe(false);
    });

    it('guild war AI revealing user hidden preserves discoverer turn', () => {
        expect(
            shouldPreserveDiscovererTurnWhenAiRevealsUserHiddenStone(
                base({ gameCategory: 'guildwar' as any }),
                Player.White,
                false,
            ),
        ).toBe(true);
    });

    it('adventure uses tower-style hidden reveal animating resolution when AI present', () => {
        expect(
            useTowerStyleHiddenRevealAnimatingResolution(base({ gameCategory: GameCategory.Adventure })),
        ).toBe(true);
    });

    it('isAdventureCategory detects adventure only', () => {
        expect(isAdventureCategory(base({ gameCategory: GameCategory.Adventure }))).toBe(true);
        expect(isAdventureCategory(base({ gameCategory: GameCategory.Tower }))).toBe(false);
    });

    it('allows server reveal-only attack for PVE academy/tower/adventure and human PVP', () => {
        expect(
            allowsServerRevealOnlyOpponentHiddenAttack(
                base({ gameCategory: GameCategory.Adventure, isAiGame: true }),
            ),
        ).toBe(true);
        expect(
            allowsServerRevealOnlyOpponentHiddenAttack(
                base({ isSinglePlayer: true, gameCategory: GameCategory.SinglePlayer }),
            ),
        ).toBe(true);
        expect(
            allowsServerRevealOnlyOpponentHiddenAttack(
                base({ gameCategory: GameCategory.Tower, isAiGame: true }),
            ),
        ).toBe(true);
        expect(
            allowsServerRevealOnlyOpponentHiddenAttack(
                base({
                    gameCategory: GameCategory.Normal as any,
                    isAiGame: false,
                    blackPlayerId: 'u1',
                    whitePlayerId: 'u2',
                }),
            ),
        ).toBe(true);
    });
});
