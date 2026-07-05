import { describe, expect, it } from 'vitest';
import { buildDefaultKataServerRuntimeSnapshot } from '../../../shared/utils/kataServerRuntimeDefaults.js';
import { adventureKataLevelFromSnapshot, towerKataLevelFromSnapshot } from '../../../shared/utils/kataServerRuntimeResolvers.js';
import { adventureMonsterLevelToKataServerLevel } from '../../../shared/utils/strategicAiDifficulty.js';
import { getTowerKataServerLevelByFloor } from '../../../shared/utils/towerKataServerLevel.js';

describe('adventureKataLevelFromSnapshot', () => {
    it('uses the adventure monster level mapping from the runtime snapshot', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();

        expect(adventureKataLevelFromSnapshot(runtime, 1)).toBe(-31);
        expect(adventureKataLevelFromSnapshot(runtime, 20)).toBe(-18);
        expect(adventureKataLevelFromSnapshot(runtime, 50)).toBe(1);
    });

    it('falls back to the planned monster-level table when a runtime key is missing', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();
        delete runtime.adventureKataByMonsterLevel['20'];

        expect(adventureKataLevelFromSnapshot(runtime, 20)).toBe(adventureMonsterLevelToKataServerLevel(20));
    });

    it('preserves explicit runtime overrides', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();
        runtime.adventureKataByMonsterLevel['20'] = -5;

        expect(adventureKataLevelFromSnapshot(runtime, 20)).toBe(-5);
    });
});

describe('towerKataLevelFromSnapshot', () => {
    it('uses the tower floor mapping from the runtime snapshot', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();

        expect(towerKataLevelFromSnapshot(runtime, 1)).toBe(-30);
        expect(towerKataLevelFromSnapshot(runtime, 20)).toBe(-25);
        expect(towerKataLevelFromSnapshot(runtime, 100)).toBe(-1);
    });

    it('falls back to the planned floor table when a runtime key is missing', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();
        delete runtime.towerKataByFloor['80'];

        expect(towerKataLevelFromSnapshot(runtime, 80)).toBe(getTowerKataServerLevelByFloor(80));
    });

    it('preserves explicit runtime overrides', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();
        runtime.towerKataByFloor['80'] = -12;

        expect(towerKataLevelFromSnapshot(runtime, 80)).toBe(-12);
    });
});
