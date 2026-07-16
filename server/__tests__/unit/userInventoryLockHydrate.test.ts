import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCachedUser = vi.fn();

vi.mock('../../gameCache.js', () => ({
    getCachedUser: (...args: unknown[]) => getCachedUser(...args),
}));

describe('hydrateUserFromLatestInventory', () => {
    beforeEach(() => {
        getCachedUser.mockReset();
    });

    it('copies blacksmith level/xp so a queued combine sees the previous level-up', async () => {
        const { hydrateUserFromLatestInventory } = await import('../../utils/userInventoryLock.js');
        const user = {
            id: 'u1',
            blacksmithLevel: 1,
            blacksmithXp: 10,
            inventory: [],
            gold: 100,
            diamonds: 0,
        } as any;

        getCachedUser.mockResolvedValue({
            id: 'u1',
            blacksmithLevel: 2,
            blacksmithXp: 5,
            inventory: [{ id: 'new' }],
            equipment: {},
            equipmentPresets: [],
            gold: 100,
            diamonds: 0,
        });

        await hydrateUserFromLatestInventory(user);

        expect(user.blacksmithLevel).toBe(2);
        expect(user.blacksmithXp).toBe(5);
        expect(user.inventory).toEqual([{ id: 'new' }]);
    });
});
