import { describe, it, expect } from 'vitest';
import { ItemGrade } from '../../../shared/types/enums.js';
import type { InventoryItem } from '../../../shared/types/entities.js';
import { normalizeInventoryEquipmentItem } from '../../../shared/utils/inventoryLegacyNormalize.js';

describe('normalizeInventoryEquipmentItem equipment image', () => {
    it('maps legacy .png DB path to EQUIPMENT_POOL WebP', () => {
        const raw: InventoryItem = {
            id: 'eq-1',
            name: '푸른 바람 부채',
            type: 'equipment',
            slot: 'fan',
            grade: ItemGrade.Normal,
            image: '/images/equipments/Fan1.png',
            stars: 0,
            level: 1,
            quantity: 1,
            isEquipped: false,
            createdAt: 1,
        };
        const out = normalizeInventoryEquipmentItem(raw);
        expect(out.image).toBe('/images/equipments/Fan1.webp');
    });

    it('adds leading slash to match pool canonical path', () => {
        const raw: InventoryItem = {
            id: 'eq-2',
            name: '신룡 바둑판',
            type: 'equipment',
            slot: 'board',
            grade: ItemGrade.Transcendent,
            image: 'images/equipments/Board7.png',
            stars: 0,
            level: 1,
            quantity: 1,
            isEquipped: false,
            createdAt: 1,
        };
        const out = normalizeInventoryEquipmentItem(raw);
        expect(out.image).toBe('/images/equipments/Board7.webp');
    });
});
