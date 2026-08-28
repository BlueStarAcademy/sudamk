import { describe, expect, it } from 'vitest';
import { buildDefaultKataServerRuntimeSnapshot } from '../../../shared/utils/kataServerRuntimeDefaults.js';
import { adventureKataLevelFromSnapshot, towerKataLevelFromSnapshot } from '../../../shared/utils/kataServerRuntimeResolvers.js';
import { adventureMonsterLevelToKataServerLevel } from '../../../shared/utils/strategicAiDifficulty.js';
import { getTowerKataServerLevelByFloor } from '../../../shared/utils/towerKataServerLevel.js';

describe('adventureMonsterLevelToKataServerLevel', () => {
    it('matches the planned monster-level kata ladder', () => {
        const cases: [number, number][] = [
            [1, -31],
            [2, -30],
            [3, -30],
            [5, -29],
            [6, -27],
            [9, -27],
            [10, -25],
            [15, -20],
            [19, -15],
            [20, -12],
            [25, -10],
            [29, -7],
            [30, -5],
            [35, -3],
            [40, -2],
            [45, -1],
            [46, 1],
            [50, 1],
        ];
        for (const [lv, kata] of cases) {
            expect(adventureMonsterLevelToKataServerLevel(lv)).toBe(kata);
        }
    });
});

describe('adventureKataLevelFromSnapshot', () => {
    it('uses the adventure monster level mapping from the runtime snapshot', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();

        expect(adventureKataLevelFromSnapshot(runtime, 1)).toBe(-31);
        expect(adventureKataLevelFromSnapshot(runtime, 7)).toBe(-27);
        expect(adventureKataLevelFromSnapshot(runtime, 20)).toBe(-12);
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

describe('getTowerKataServerLevelByFloor', () => {
    it('matches the planned tower floor kata ladder', () => {
        const cases: [number, number][] = [
            [1, -30],
            [10, -30],
            [11, -28],
            [20, -28],
            [21, -26],
            [34, -26],
            [35, -25],
            [36, -22],
            [49, -22],
            [50, -20],
            [51, -19],
            [64, -19],
            [65, -18],
            [66, -15],
            [79, -15],
            [80, -12],
            [81, -10],
            [89, -10],
            [90, -7],
            [91, -5],
            [99, -5],
            [100, -3],
        ];
        for (const [floor, kata] of cases) {
            expect(getTowerKataServerLevelByFloor(floor)).toBe(kata);
        }
    });
});

describe('towerKataLevelFromSnapshot', () => {
    it('uses the tower floor mapping from the runtime snapshot', () => {
        const runtime = buildDefaultKataServerRuntimeSnapshot();

        expect(towerKataLevelFromSnapshot(runtime, 1)).toBe(-30);
        expect(towerKataLevelFromSnapshot(runtime, 20)).toBe(-28);
        expect(towerKataLevelFromSnapshot(runtime, 35)).toBe(-25);
        expect(towerKataLevelFromSnapshot(runtime, 100)).toBe(-3);
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
