import { describe, expect, it } from 'vitest';
import type { User } from '../../../types/index.js';
import { ItemGrade } from '../../../types/enums.js';
import {
    collectActiveExchangeListedItemIds,
    reconcileExchangeListedInventoryFlags,
} from '../../../shared/utils/exchangeInventorySync.js';

const baseUser = (): User =>
    ({
        id: 'u1',
        inventory: [
            {
                id: 'eq-new',
                name: 'Test Sword',
                type: 'equipment',
                slot: 'weapon',
                grade: ItemGrade.Rare,
                level: 1,
                stars: 0,
                isEquipped: false,
                createdAt: 1,
                image: '',
                description: '',
            },
        ],
        exchangeState: {
            listings: [
                {
                    id: 'listing-1',
                    itemId: 'eq-new',
                    status: 'listed',
                    sellerId: 'u1',
                },
            ],
            settlements: [],
            history: [],
        },
    }) as User;

describe('reconcileExchangeListedInventoryFlags', () => {
    it('sets isExchangeListed when listing exists but flag missing (combine-then-list race)', () => {
        const user = baseUser();
        const reconciled = reconcileExchangeListedInventoryFlags(user);
        expect(reconciled.inventory[0].isExchangeListed).toBe(true);
    });

    it('clears isExchangeListed when no active listings reference the item', () => {
        const user = baseUser();
        user.inventory[0].isExchangeListed = true;
        user.exchangeState = { listings: [], settlements: [], history: [] };
        const reconciled = reconcileExchangeListedInventoryFlags(user);
        expect(reconciled.inventory[0].isExchangeListed).toBeUndefined();
    });

    it('collectActiveExchangeListedItemIds returns listed equipment ids only', () => {
        const ids = collectActiveExchangeListedItemIds(baseUser());
        expect(ids.has('eq-new')).toBe(true);
        expect(ids.size).toBe(1);
    });
});
