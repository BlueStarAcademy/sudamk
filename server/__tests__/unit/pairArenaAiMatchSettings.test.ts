import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../types/index.js';
import {
    isPairArenaAiMatchSession,
    transformPairArenaAiMatchSettings,
} from '../../../shared/utils/pairArenaAiMatchSettings.js';

describe('isPairArenaAiMatchSession', () => {
    it('detects pair AI vs AI team', () => {
        expect(
            isPairArenaAiMatchSession({
                settings: {
                    pairGame: {
                        pairMode: 'ai',
                        teamB: { members: [{ id: 'pair-opponent-ai' }] },
                    },
                },
            }),
        ).toBe(true);
    });

    it('rejects pair pvp', () => {
        expect(
            isPairArenaAiMatchSession({
                settings: { pairGame: { pairMode: 'pvp' } },
            }),
        ).toBe(false);
    });
});

describe('transformPairArenaAiMatchSettings', () => {
    it('zeros main clock and sets scoring turn limit on pair channel', () => {
        const out = transformPairArenaAiMatchSettings(
            GameMode.Standard,
            { boardSize: 19, timeLimit: 10, byoyomiTime: 30, byoyomiCount: 3, komi: 6.5 },
            'pair',
        );
        expect(out.timeLimit).toBe(0);
        expect(out.scoringTurnLimit).toBeGreaterThan(0);
    });
});
