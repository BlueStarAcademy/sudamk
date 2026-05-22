import { describe, expect, it } from 'vitest';
import type { User } from '../../../types/index.js';
import { recordActionPointSpend, recordActionPointRestore } from '../../../shared/utils/actionPointRegen.js';

const baseUser = (): User =>
    ({
        id: 'u1',
        isAdmin: false,
        actionPoints: { current: 30, max: 30 },
        lastActionPointUpdate: 0,
    }) as User;

describe('recordActionPointSpend', () => {
    it('starts regen timer when spending from full', () => {
        const user = baseUser();
        const now = 1_000_000;
        recordActionPointSpend(user, 5, now);
        expect(user.actionPoints.current).toBe(25);
        expect(user.lastActionPointUpdate).toBe(now);
    });

    it('preserves in-progress regen timer when spending while below max', () => {
        const user = baseUser();
        user.actionPoints.current = 20;
        user.lastActionPointUpdate = 900_000;
        recordActionPointSpend(user, 3, 1_000_000);
        expect(user.actionPoints.current).toBe(17);
        expect(user.lastActionPointUpdate).toBe(900_000);
    });
});

describe('recordActionPointRestore', () => {
    it('clears timer when restore reaches max', () => {
        const user = baseUser();
        user.actionPoints.current = 28;
        user.lastActionPointUpdate = 900_000;
        recordActionPointRestore(user, 2);
        expect(user.actionPoints.current).toBe(30);
        expect(user.lastActionPointUpdate).toBe(0);
    });

    it('does not reset timer when restore stays below max', () => {
        const user = baseUser();
        user.actionPoints.current = 10;
        user.lastActionPointUpdate = 900_000;
        recordActionPointRestore(user, 3);
        expect(user.actionPoints.current).toBe(13);
        expect(user.lastActionPointUpdate).toBe(900_000);
    });
});
