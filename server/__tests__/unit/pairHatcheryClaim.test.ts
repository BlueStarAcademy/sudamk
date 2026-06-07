import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../../../types/index.js';
import {
    readObtainedPetFromHatcheryActionResult,
    resolveHatcheryAwardedPetRow,
} from '../../../shared/utils/pairHatcheryClaim.js';

const existingPet: InventoryItem = {
    id: 'item-existing-pet',
    name: 'AI 펫·테스트',
    description: '',
    type: 'material',
    slot: null,
    level: 10,
    stars: 0,
    isEquipped: false,
    createdAt: 1000,
    image: '/images/pet.webp',
    grade: 'normal' as InventoryItem['grade'],
    quantity: 1,
    templateId: 'pair-pet-test',
    pairPetMeta: { level: 10, xp: 0, disposition: { kind: 'all', pct: 5 }, specialization: { kind: 'trainingXp', pct: 0 }, levelUpCoreBonuses: {}, rpsAttribute: 1 },
};

describe('pairHatcheryClaim', () => {
    it('resolveHatcheryAwardedPetRow uses finalItemsToAdd id, not same-template existing row', () => {
        const preparedPet: InventoryItem = {
            ...existingPet,
            id: 'item-prepared-never-stored',
            level: 1,
            pairPetMeta: { ...existingPet.pairPetMeta!, level: 1 },
        };
        const addedPet: InventoryItem = {
            ...preparedPet,
            id: 'item-new-hatch',
            createdAt: 9000,
        };
        const merged = {
            finalItemsToAdd: [addedPet],
            updatedInventory: [existingPet, addedPet],
        };
        const awarded = resolveHatcheryAwardedPetRow(merged, preparedPet);
        expect(awarded.id).toBe('item-new-hatch');
        expect(awarded.pairPetMeta?.level).toBe(1);
    });

    it('readObtainedPetFromHatcheryActionResult ignores obtainedPet when id was already in inventory', () => {
        const newPet: InventoryItem = { ...existingPet, id: 'item-brand-new', level: 1, pairPetMeta: { ...existingPet.pairPetMeta!, level: 1 } };
        const res = {
            obtainedPet: existingPet,
            updatedUser: { inventory: [existingPet, newPet] },
        };
        const before = new Set(['item-existing-pet']);
        const read = readObtainedPetFromHatcheryActionResult(res, before);
        expect(read?.id).toBe('item-brand-new');
        expect(read?.pairPetMeta?.level).toBe(1);
    });
});
