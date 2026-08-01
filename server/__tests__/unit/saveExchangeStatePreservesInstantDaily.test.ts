import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateUser = vi.fn();
const broadcastUserUpdate = vi.fn();
const getCachedUser = vi.fn();

vi.mock('../../db.js', () => ({
    updateUser: (...args: unknown[]) => updateUser(...args),
}));

vi.mock('../../socket.js', () => ({
    broadcastUserUpdate: (...args: unknown[]) => broadcastUserUpdate(...args),
}));

vi.mock('../../gameCache.js', () => ({
    getCachedUser: (...args: unknown[]) => getCachedUser(...args),
}));

describe('SAVE_EXCHANGE_STATE preserves instantDaily', () => {
    beforeEach(() => {
        updateUser.mockReset().mockResolvedValue(undefined);
        broadcastUserUpdate.mockReset();
        getCachedUser.mockReset().mockResolvedValue(null);
    });

    it('does not wipe daily instant-exchange usage when history is auto-persisted', async () => {
        const { handleUserAction } = await import('../../actions/userActions.js');
        const instantDaily = {
            lastResetDayKST: Date.UTC(2026, 6, 5),
            goldSpent: 500_000,
            diamondsSpent: 0,
        };
        const user = {
            id: 'u-exchange',
            inventory: [],
            gold: 0,
            diamonds: 10,
            exchangeState: {
                listings: [],
                settlements: [],
                history: ['old'],
                currencyOrders: [],
                currencyReceipts: [],
                instantDaily,
            },
        } as any;

        const result = await handleUserAction(
            {} as any,
            {
                type: 'SAVE_EXCHANGE_STATE',
                userId: user.id,
                payload: {
                    listings: [],
                    settlements: [],
                    history: ['[바로환전] 한도 도달', 'old'],
                },
            } as any,
            user,
        );

        expect(result.error).toBeUndefined();
        expect(user.exchangeState.instantDaily).toEqual(instantDaily);
        expect(user.exchangeState.history[0]).toContain('한도 도달');
        expect(updateUser).toHaveBeenCalledWith(user);
    });
});
