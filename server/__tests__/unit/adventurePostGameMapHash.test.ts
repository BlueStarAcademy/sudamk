import { describe, expect, it } from 'vitest';
import {
    adventurePostGameMapHash,
    resolveAdventureStageIdForMapReturn,
} from '../../../constants/adventureConstants.js';

describe('adventurePostGameMapHash', () => {
    it('uses adventureStageId when present', () => {
        expect(
            adventurePostGameMapHash({
                adventureStageId: 'lake_park',
                adventureMonsterCodexId: 'lake_01',
            }),
        ).toBe('#/adventure/lake_park');
    });

    it('recovers stage from monster codex when stage id is missing', () => {
        expect(resolveAdventureStageIdForMapReturn({ adventureMonsterCodexId: 'hill_03' })).toBe(
            'neighborhood_hill',
        );
        expect(adventurePostGameMapHash({ adventureMonsterCodexId: 'hill_03' })).toBe(
            '#/adventure/neighborhood_hill',
        );
    });

    it('falls back to adventure lobby hash when nothing resolves', () => {
        expect(adventurePostGameMapHash({})).toBe('#/adventure');
    });
});
