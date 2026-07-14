import { describe, it, expect } from 'vitest';
import { ItemGrade } from '../../../shared/types/enums.js';
import type { InventoryItem } from '../../../shared/types/entities.js';
import { normalizeInventoryEquipmentItem } from '../../../shared/utils/inventoryLegacyNormalize.js';

describe('normalizeInventoryEquipmentItem equipment image', () => {
    it('maps legacy .png DB path to EQUIPMENT_POOL WebP', () => {
        const raw: InventoryItem = {
            id: 'eq-1',
            name: '푸른 바람 부채',
            description: 'legacy fan image fixture',
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
            description: 'legacy board image fixture',
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
        expect(out.name).toBe('신룡 바둑판');
    });

    it('renames legacy transcendent 천룡 names to 신룡 set (mythic 천룡 untouched)', () => {
        const rawTrans: InventoryItem = {
            id: 'eq-3',
            name: '천룡 바둑판',
            description: 'legacy cheollyong name on transcendent',
            type: 'equipment',
            slot: 'board',
            grade: ItemGrade.Transcendent,
            image: '/images/equipments/Board7.webp',
            stars: 0,
            level: 1,
            quantity: 1,
            isEquipped: false,
            createdAt: 1,
        };
        const outTrans = normalizeInventoryEquipmentItem(rawTrans);
        expect(outTrans.name).toBe('신룡 바둑판');
        expect(outTrans.image).toBe('/images/equipments/Board7.webp');

        const rawMythic: InventoryItem = {
            id: 'eq-4',
            name: '천룡 바둑판',
            description: 'mythic cheollyong stays',
            type: 'equipment',
            slot: 'board',
            grade: ItemGrade.Mythic,
            image: '/images/equipments/Board6.webp',
            stars: 0,
            level: 1,
            quantity: 1,
            isEquipped: false,
            createdAt: 1,
        };
        const outMythic = normalizeInventoryEquipmentItem(rawMythic);
        expect(outMythic.name).toBe('천룡 바둑판');
        expect(outMythic.image).toBe('/images/equipments/Board6.webp');
    });
});
