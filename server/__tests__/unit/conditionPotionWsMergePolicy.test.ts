import { describe, expect, it } from 'vitest';
import { ItemGrade, type InventoryItem } from '../../../types/index.js';
import {
    CONDITION_POTION_USE_GUARD_MS,
    sanitizeConditionPotionUserUpdatePatch,
} from '../../../shared/conditionPotion/wsMergePolicy.js';

const potion = (name: string, quantity: number): InventoryItem =>
    ({
        id: `item-${name}`,
        name,
        description: '',
        type: 'consumable',
        quantity,
        slot: null,
        image: '',
        grade: ItemGrade.Normal,
        createdAt: 0,
        isEquipped: false,
        level: 1,
        stars: 0,
    }) as InventoryItem;

describe('conditionPotionWsMergePolicy', () => {
    it('keeps optimistic use patch even when count drops', () => {
        const prev = [potion('컨디션회복제(소)', 1)];
        const patch = { inventory: [] as InventoryItem[], gold: 400 };
        const kept = sanitizeConditionPotionUserUpdatePatch(patch, {
            lastHttpActionType: 'USE_CONDITION_POTION',
            useInFlight: true,
            prevInventory: prev,
            useCommittedAt: Date.now(),
            updateSource: 'USE_CONDITION_POTION-optimistic',
        });
        expect(kept.inventory).toEqual([]);
    });

    it('strips stale INITIAL_STATE inventory after use committed window context', () => {
        const prev: InventoryItem[] = [];
        const patch = { inventory: [potion('컨디션회복제(소)', 1)], gold: 900 };
        const stripped = sanitizeConditionPotionUserUpdatePatch(patch, {
            lastHttpActionType: 'SAVE_TOURNAMENT_PROGRESS',
            useInFlight: false,
            prevInventory: prev,
            useCommittedAt: Date.now(),
            updateSource: 'INITIAL_STATE',
        });
        expect(stripped.inventory).toBeUndefined();
        expect(stripped.gold).toBeUndefined();
    });

    it('allows stale fewer strip during buy sync', () => {
        const prev = [potion('컨디션회복제(소)', 3)];
        const patch = {
            inventory: [potion('컨디션회복제(소)', 1)],
            gold: 500,
        };
        const stripped = sanitizeConditionPotionUserUpdatePatch(patch, {
            lastHttpActionType: 'BUY_CONDITION_POTION',
            useInFlight: false,
            prevInventory: prev,
            useCommittedAt: null,
            updateSource: 'USER_UPDATE-websocket',
        });
        expect(stripped.inventory).toBeUndefined();
    });

    it('keeps authoritative USE_CONDITION_POTION-http inventory even when count drops', () => {
        const prev = [potion('컨디션회복제(소)', 2)];
        const patch = { inventory: [potion('컨디션회복제(소)', 1)], gold: 400 };
        const kept = sanitizeConditionPotionUserUpdatePatch(patch, {
            lastHttpActionType: 'USE_CONDITION_POTION',
            useInFlight: false,
            prevInventory: prev,
            useCommittedAt: Date.now(),
            updateSource: 'USE_CONDITION_POTION-http',
        });
        expect(kept.inventory).toEqual(patch.inventory);
        expect(kept.gold).toBe(400);
    });
});
