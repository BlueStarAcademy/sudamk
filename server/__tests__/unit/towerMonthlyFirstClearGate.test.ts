import { describe, expect, it } from 'vitest';
import {
    isTowerFirstClearAttemptOnFloor,
    shouldGrantTowerFirstClearRewards,
    towerSummaryHasGrantedRewards,
} from '../../../utils/towerPreGameDisplay.js';

describe('tower monthly first-clear gate', () => {
    it('grants when monthlyTowerFloor is below the floor even if lifetime towerFloor is higher', () => {
        // Migration / missed monthly reset: towerFloor=40, monthlyTowerFloor=0
        expect(isTowerFirstClearAttemptOnFloor(0, 1)).toBe(true);
        expect(isTowerFirstClearAttemptOnFloor(0, 15)).toBe(true);
    });

    it('does not grant for floors already cleared this month', () => {
        expect(isTowerFirstClearAttemptOnFloor(10, 10)).toBe(false);
        expect(isTowerFirstClearAttemptOnFloor(10, 9)).toBe(false);
        expect(isTowerFirstClearAttemptOnFloor(10, 11)).toBe(true);
    });

    it('treats null/undefined monthly floor as 0', () => {
        expect(isTowerFirstClearAttemptOnFloor(undefined, 1)).toBe(true);
        expect(isTowerFirstClearAttemptOnFloor(null, 1)).toBe(true);
    });
});

describe('shouldGrantTowerFirstClearRewards', () => {
    it('prefers session eligible flag over monthly watermark', () => {
        expect(
            shouldGrantTowerFirstClearRewards({
                userMonthlyTowerFloor: 20,
                sessionFloor: 10,
                towerFirstClearRewardEligible: true,
                towerStartActionPointCost: 0,
            }),
        ).toBe(true);
        expect(
            shouldGrantTowerFirstClearRewards({
                userMonthlyTowerFloor: 0,
                sessionFloor: 5,
                towerFirstClearRewardEligible: false,
                towerStartActionPointCost: 0,
            }),
        ).toBe(false);
    });

    it('grants when start AP cost > 0 even if monthly watermark looks cleared', () => {
        expect(
            shouldGrantTowerFirstClearRewards({
                userMonthlyTowerFloor: 15,
                sessionFloor: 15,
                towerFirstClearRewardEligible: false,
                towerStartActionPointCost: 2,
            }),
        ).toBe(true);
    });

    it('falls back to monthly watermark for legacy sessions without the flag', () => {
        expect(
            shouldGrantTowerFirstClearRewards({
                userMonthlyTowerFloor: 4,
                sessionFloor: 5,
                towerFirstClearRewardEligible: undefined,
                towerStartActionPointCost: 0,
            }),
        ).toBe(true);
        expect(
            shouldGrantTowerFirstClearRewards({
                userMonthlyTowerFloor: 5,
                sessionFloor: 5,
                towerFirstClearRewardEligible: undefined,
                towerStartActionPointCost: 0,
            }),
        ).toBe(false);
    });
});

describe('towerSummaryHasGrantedRewards', () => {
    it('is false for empty loss/retry summaries', () => {
        expect(towerSummaryHasGrantedRewards(undefined)).toBe(false);
        expect(
            towerSummaryHasGrantedRewards({
                gold: 0,
                xp: { change: 0 },
                items: [],
            }),
        ).toBe(false);
    });

    it('is true when any reward slot is present', () => {
        expect(towerSummaryHasGrantedRewards({ gold: 500, xp: { change: 0 }, items: [] })).toBe(true);
        expect(towerSummaryHasGrantedRewards({ gold: 0, xp: { change: 60 }, items: [] })).toBe(true);
        expect(
            towerSummaryHasGrantedRewards({
                gold: 0,
                xp: { change: 0 },
                items: [{ name: '스캔', quantity: 1 } as any],
            }),
        ).toBe(true);
    });
});
