import { describe, expect, it } from 'vitest';
import {
    adventureKataLevelForMonsterLevel,
    refreshAdventureKataServerLevelOnSession,
    resolveAdventureMonsterLevelFromSession,
} from '../../../shared/utils/adventureKataSession.js';
import type { LiveGameSession } from '../../../shared/types/index.js';

describe('adventureKataSession', () => {
    it('resolves monster level from session top-level or settings backup', () => {
        expect(resolveAdventureMonsterLevelFromSession({ adventureMonsterLevel: 7, settings: {} })).toBe(7);
        expect(
            resolveAdventureMonsterLevelFromSession({
                settings: { adventureMonsterLevel: 9 } as LiveGameSession['settings'],
            }),
        ).toBe(9);
    });

    it('refreshes kataServerLevel from the code-planned table each call', () => {
        const game = {
            gameCategory: 'adventure',
            adventureMonsterLevel: 7,
            settings: { kataServerLevel: -25, goAiBotLevel: 2 },
        } as unknown as LiveGameSession;

        expect(refreshAdventureKataServerLevelOnSession(game)).toBe(-27);
        expect((game.settings as { kataServerLevel?: number }).kataServerLevel).toBe(-27);
        expect((game.settings as { adventureMonsterLevel?: number }).adventureMonsterLevel).toBe(7);
    });

    it('maps monster level 1 to -31', () => {
        expect(adventureKataLevelForMonsterLevel(1)).toBe(-31);
    });
});
