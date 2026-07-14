import { describe, expect, it } from 'vitest';
import {
    ADVENTURE_MAP_WANDER_POINT_COUNT,
    buildAdventureMapMonsterWanderPoints,
    buildAdventureMapMonsterWanderStyle,
} from '../../../shared/utils/adventureMapMonsterWander.js';

describe('adventureMapMonsterWander', () => {
    it('builds six path-offset points with meaningful travel on a stage path', () => {
        const points = buildAdventureMapMonsterWanderPoints(
            'm-patrol-a',
            800,
            480,
            'neighborhood_hill',
            { xPct: 54, yPct: 82 },
        );
        expect(points).toHaveLength(ADVENTURE_MAP_WANDER_POINT_COUNT);

        let travel = 0;
        for (let i = 0; i < points.length; i++) {
            const a = points[i]!;
            const b = points[(i + 1) % points.length]!;
            travel += Math.hypot(b.x - a.x, b.y - a.y);
        }
        expect(travel).toBeGreaterThan(40);
        for (const p of points) {
            expect(Math.abs(p.x)).toBeLessThan(220);
            expect(Math.abs(p.y)).toBeLessThan(160);
        }
    });

    it('varies patterns across monster ids', () => {
        const a = buildAdventureMapMonsterWanderPoints('m-a', 800, 480, 'lake_park', {
            xPct: 40,
            yPct: 82,
        });
        const b = buildAdventureMapMonsterWanderPoints('m-b', 800, 480, 'lake_park', {
            xPct: 40,
            yPct: 82,
        });
        const same =
            a.every((p, i) => Math.abs(p.x - b[i]!.x) < 0.01 && Math.abs(p.y - b[i]!.y) < 0.01);
        expect(same).toBe(false);
    });

    it('marks walking and exposes bob style when travel is large enough', () => {
        const style = buildAdventureMapMonsterWanderStyle('m-walk', 900, 520, 'zoo', {
            xPct: 50,
            yPct: 84,
        });
        expect(style.walking).toBe(true);
        expect(style.wanderStyle['--w5x' as string]).toBeTruthy();
        expect(style.faceStyle['--face5' as string]).toMatch(/^-?1$/);
        expect(style.bobStyle.animationDuration).toMatch(/ms$/);
    });
});
