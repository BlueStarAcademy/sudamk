import { describe, expect, it } from 'vitest';
import { getTopAdventureCodexMonsterByWins } from '../../../utils/adventureTopCodexMonster.js';

describe('getTopAdventureCodexMonsterByWins', () => {
    it('picks highest win count', () => {
        const top = getTopAdventureCodexMonsterByWins({
            codexDefeatCounts: { hill_01: 3, hill_02: 7 },
            codexDefeatCountReachedAtByCodexId: { hill_01: 100, hill_02: 200 },
        });
        expect(top?.codexId).toBe('hill_02');
        expect(top?.wins).toBe(7);
    });

    it('tie-breaks by earlier reachedAt', () => {
        const top = getTopAdventureCodexMonsterByWins({
            codexDefeatCounts: { hill_01: 5, hill_02: 5 },
            codexDefeatCountReachedAtByCodexId: { hill_01: 100, hill_02: 300 },
        });
        expect(top?.codexId).toBe('hill_01');
    });
});
