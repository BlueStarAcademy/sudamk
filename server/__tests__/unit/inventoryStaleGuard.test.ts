import { describe, expect, it } from 'vitest';
import { ItemGrade } from '../../../types/enums.js';
import type { InventoryItem } from '../../../types/index.js';
import { stripReappearedRemovedInventoryItems } from '../../../shared/utils/inventoryStaleGuard.js';

const eq = (id: string): InventoryItem =>
    ({
        id,
        name: 'Sword',
        type: 'equipment',
        slot: 'weapon',
        grade: ItemGrade.Rare,
        level: 1,
        stars: 0,
        isEquipped: false,
        createdAt: 1,
        image: '',
        description: '',
    }) as InventoryItem;

describe('stripReappearedRemovedInventoryItems', () => {
    it('drops removed ids that reappear in a stale patch', () => {
        const prev = [eq('new-item')];
        const patch = [eq('new-item'), eq('old-a'), eq('old-b')];
        const removed = new Set(['old-a', 'old-b', 'old-c']);
        const next = stripReappearedRemovedInventoryItems(prev, patch, removed);
        expect(next?.map((i) => i.id)).toEqual(['new-item']);
    });

    it('keeps removed ids still present in prev (no false strip)', () => {
        const prev = [eq('keep-me')];
        const patch = [eq('keep-me')];
        const removed = new Set(['keep-me']);
        const next = stripReappearedRemovedInventoryItems(prev, patch, removed);
        expect(next?.map((i) => i.id)).toEqual(['keep-me']);
    });
});
