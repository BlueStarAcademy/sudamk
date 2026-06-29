import { describe, expect, it } from 'vitest';
import { TOWER_STAGES } from '../../../constants/towerConstants.js';

function stageForFloor(floor: number) {
    const stage = TOWER_STAGES.find((s) => s.id === `tower-${floor}`);
    if (!stage) throw new Error(`missing tower-${floor}`);
    return stage;
}

describe('tower first-clear rewards', () => {
    it('applies gold by floor band', () => {
        const expectations: Array<[number, number]> = [
            [1, 500],
            [20, 500],
            [21, 750],
            [35, 750],
            [36, 1000],
            [50, 1000],
            [51, 1250],
            [65, 1250],
            [66, 1500],
            [80, 1500],
            [81, 2000],
            [90, 2000],
            [91, 2500],
            [100, 2500],
        ];
        for (const [floor, gold] of expectations) {
            expect(stageForFloor(floor).rewards.firstClear.gold).toBe(gold);
        }
    });

    it('doubles first-clear exp', () => {
        expect(stageForFloor(1).rewards.firstClear.exp).toBe(60);
        expect(stageForFloor(11).rewards.firstClear.exp).toBe(100);
        expect(stageForFloor(36).rewards.firstClear.exp).toBe(160);
        expect(stageForFloor(66).rewards.firstClear.exp).toBe(300);
        expect(stageForFloor(100).rewards.firstClear.exp).toBe(600);
    });

    it('keeps milestone item rewards alongside gold', () => {
        const floor5 = stageForFloor(5).rewards.firstClear;
        expect(floor5.gold).toBe(500);
        expect(floor5.items).toEqual([{ itemId: '골드 꾸러미 I', quantity: 1 }]);

        const floor100 = stageForFloor(100).rewards.firstClear;
        expect(floor100.gold).toBe(2500);
        expect(floor100.items).toEqual([{ itemId: '장비상자6', quantity: 1 }]);
    });
});
