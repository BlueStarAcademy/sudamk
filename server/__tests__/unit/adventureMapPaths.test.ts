import { describe, expect, it } from 'vitest';
import {
    ADVENTURE_MAP_PATHS,
    adventureMapPathLength,
    pointOnAdventureMapPath,
    sampleAdventureMapPathPosition,
} from '../../../shared/utils/adventureMapPaths.js';

describe('adventureMapPaths', () => {
    it('interpolates along polyline endpoints', () => {
        const wp = ADVENTURE_MAP_PATHS.neighborhood_hill.waypoints;
        const a = pointOnAdventureMapPath(wp, 0);
        const b = pointOnAdventureMapPath(wp, 1);
        expect(a.xPct).toBe(wp[0]!.xPct);
        expect(a.yPct).toBe(wp[0]!.yPct);
        expect(b.xPct).toBeCloseTo(wp[wp.length - 1]!.xPct, 10);
        expect(b.yPct).toBeCloseTo(wp[wp.length - 1]!.yPct, 10);
        expect(adventureMapPathLength(wp)).toBeGreaterThan(10);
    });

    it('samples within corridor for every stage', () => {
        const rng = () => 0.37;
        for (const stageId of Object.keys(ADVENTURE_MAP_PATHS) as (keyof typeof ADVENTURE_MAP_PATHS)[]) {
            const p = sampleAdventureMapPathPosition(stageId, rng);
            expect(p.xPct).toBeGreaterThan(10);
            expect(p.xPct).toBeLessThan(95);
            expect(p.yPct).toBeGreaterThan(60);
            expect(p.yPct).toBeLessThan(98);
        }
    });
});
