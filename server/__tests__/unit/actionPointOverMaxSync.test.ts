import { describe, expect, it, vi } from 'vitest';
import type { User } from '../../../types/index.js';
import { syncActionPointsStateAfterEquipmentChange } from '../../effectService.js';

vi.mock('../../db.js', () => ({
    getGuild: vi.fn().mockResolvedValue(null),
}));

const baseUser = (): User =>
    ({
        id: 'u1',
        isAdmin: false,
        actionPoints: { current: 50, max: 30 },
        lastActionPointUpdate: 123,
        equipment: {},
        inventory: [],
        mannerScore: 200,
    }) as User;

describe('syncActionPointsStateAfterEquipmentChange', () => {
    it('does not clamp current when over max', async () => {
        const user = baseUser();
        await syncActionPointsStateAfterEquipmentChange(user);
        expect(user.actionPoints.current).toBe(50);
        expect(user.lastActionPointUpdate).toBe(0);
    });

    it('still fills timer when below max after sync', async () => {
        const user = baseUser();
        user.actionPoints.current = 10;
        user.lastActionPointUpdate = 0;
        await syncActionPointsStateAfterEquipmentChange(user);
        expect(user.actionPoints.current).toBe(10);
        expect(user.lastActionPointUpdate).toBeGreaterThan(0);
    });
});
