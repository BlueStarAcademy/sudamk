import { describe, expect, it } from 'vitest';
import { isTowerFirstClearAttemptOnFloor } from '../../../utils/towerPreGameDisplay.js';

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
