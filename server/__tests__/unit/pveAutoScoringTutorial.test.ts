import { describe, expect, it } from 'vitest';
import { PVE_TUTORIAL_LESSONS } from '../../../shared/constants/pveTutorials.js';

describe('sp_auto_scoring tutorial board', () => {
    const lesson = PVE_TUTORIAL_LESSONS.sp_auto_scoring;

    it('matches the provided 7x7 facing shape with equal stone counts', () => {
        expect(lesson.boardSize).toBe(7);
        const black = lesson.initialStones.filter((s) => s.color === 'B').length;
        const white = lesson.initialStones.filter((s) => s.color === 'W').length;
        expect(black).toBe(white);
        expect(black).toBe(9);
    });

    it('fills facing dame then reveals territory in steps', () => {
        expect(lesson.demoPlacements).toEqual([
            { x: 3, y: 2, color: 'B' },
            { x: 4, y: 4, color: 'W' },
        ]);
        expect(lesson.practiceTargets).toEqual([
            { x: 3, y: 2 },
            { x: 4, y: 4 },
        ]);
        expect(lesson.scoringTerritorySteps?.length).toBe(2);

        const occupied = new Set(lesson.initialStones.map((s) => `${s.x},${s.y}`));
        for (const p of lesson.demoPlacements) {
            expect(occupied.has(`${p.x},${p.y}`)).toBe(false);
        }
        const finalTerr = lesson.scoringTerritorySteps![1]!;
        expect(finalTerr.some((t) => t.color === 'B')).toBe(true);
        expect(finalTerr.some((t) => t.color === 'W')).toBe(true);
    });
});
