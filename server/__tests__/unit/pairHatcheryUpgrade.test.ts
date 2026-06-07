import { describe, expect, it } from 'vitest';
import {
    PAIR_HATCHERY_MAIN_SLOT_INDEX,
    PAIR_HATCHERY_VIP_SLOT_INDEX,
    findPairHatcherySessionAtSlot,
    getPairHatcheryHighestUpgradeTier,
    getPairHatcheryMainSlotEffectiveDef,
    getPairHatcherySlotDef,
    normalizePairPetHatcherySessions,
    normalizePairPetHatcheryUpgradeTiers,
    resolvePairHatcheryRewardSlotIndex,
    rollHatchPetLevelFromRule,
} from '../../../shared/constants/pairHatchery.js';
import type { User } from '../../../types/index.js';

describe('pairHatchery upgrade model', () => {
    it('migrates legacy 4-slot unlock flags to 3 upgrade tiers', () => {
        expect(normalizePairPetHatcheryUpgradeTiers([true, true, false, true])).toEqual([true, false, true]);
    });

    it('migrates legacy 5-slot sessions to main + vip', () => {
        const legacy = [
            { slotIndex: 0, startedAt: 1000, eggItemId: 'egg-a' },
            null,
            { slotIndex: 2, startedAt: 2000, eggItemId: 'egg-b' },
            null,
            { slotIndex: 4, startedAt: 3000, eggItemId: 'egg-vip' },
        ];
        const norm = normalizePairPetHatcherySessions(legacy);
        expect(norm[PAIR_HATCHERY_MAIN_SLOT_INDEX]?.eggItemId).toBe('egg-a');
        expect(norm[PAIR_HATCHERY_VIP_SLOT_INDEX]?.eggItemId).toBe('egg-vip');
    });

    it('applies highest unlocked upgrade to main slot effective def', () => {
        const user = {
            pairPetHatcherySlotUnlocked: [true, true, false],
        } as User;
        expect(getPairHatcheryHighestUpgradeTier(user)).toBe(2);
        const eff = getPairHatcheryMainSlotEffectiveDef(user);
        expect(eff.upgradeTier).toBe(2);
        expect(eff.upgradeLabel).toBe('강화 II');
        expect(eff.durationMs).toBe(50 * 60 * 1000);
    });

    it('keeps new VIP session at index 1 when legacy 5-slot padding has no index-4 VIP', () => {
        const padded = [
            null,
            { slotIndex: PAIR_HATCHERY_VIP_SLOT_INDEX, startedAt: 5000, eggItemId: 'egg-vip-new' },
            null,
            null,
            null,
        ];
        const norm = normalizePairPetHatcherySessions(padded);
        expect(norm[PAIR_HATCHERY_MAIN_SLOT_INDEX]).toBeNull();
        expect(norm[PAIR_HATCHERY_VIP_SLOT_INDEX]?.eggItemId).toBe('egg-vip-new');
    });

    it('does not treat truncated 3-slot VIP row as main slot', () => {
        const truncated = [
            null,
            { slotIndex: PAIR_HATCHERY_VIP_SLOT_INDEX, startedAt: 6000, eggItemId: 'egg-vip-trunc' },
            null,
        ];
        const norm = normalizePairPetHatcherySessions(truncated);
        expect(norm[PAIR_HATCHERY_MAIN_SLOT_INDEX]).toBeNull();
        expect(norm[PAIR_HATCHERY_VIP_SLOT_INDEX]?.eggItemId).toBe('egg-vip-trunc');
    });

    it('keeps VIP at index 1 when session.slotIndex is missing (new 2-slot layout)', () => {
        const raw = [null, { startedAt: 8000, eggItemId: 'egg-vip-no-si' }];
        const norm = normalizePairPetHatcherySessions(raw);
        expect(norm[PAIR_HATCHERY_MAIN_SLOT_INDEX]).toBeNull();
        expect(norm[PAIR_HATCHERY_VIP_SLOT_INDEX]?.eggItemId).toBe('egg-vip-no-si');
        expect(norm[PAIR_HATCHERY_VIP_SLOT_INDEX]?.slotIndex).toBe(PAIR_HATCHERY_VIP_SLOT_INDEX);
    });

    it('prefers new VIP at index 1 over stale legacy VIP at index 4', () => {
        const raw = [
            null,
            { slotIndex: PAIR_HATCHERY_VIP_SLOT_INDEX, startedAt: 9000, eggItemId: 'egg-vip-new' },
            null,
            null,
            { slotIndex: 4, startedAt: 3000, eggItemId: 'egg-vip-stale' },
        ];
        const norm = normalizePairPetHatcherySessions(raw);
        expect(norm[PAIR_HATCHERY_MAIN_SLOT_INDEX]).toBeNull();
        expect(norm[PAIR_HATCHERY_VIP_SLOT_INDEX]?.eggItemId).toBe('egg-vip-new');
    });

    it('resolves VIP reward level from session.slotIndex when array index was legacy-misplaced', () => {
        const misplaced = normalizePairPetHatcherySessions([
            { slotIndex: PAIR_HATCHERY_VIP_SLOT_INDEX, startedAt: 7000, eggItemId: 'egg-vip-mis' },
            null,
        ]);
        expect(misplaced[PAIR_HATCHERY_MAIN_SLOT_INDEX]).toBeNull();
        expect(misplaced[PAIR_HATCHERY_VIP_SLOT_INDEX]?.eggItemId).toBe('egg-vip-mis');

        const found = findPairHatcherySessionAtSlot(misplaced, PAIR_HATCHERY_VIP_SLOT_INDEX);
        expect(found?.rewardSlotIndex).toBe(PAIR_HATCHERY_VIP_SLOT_INDEX);

        const vipDef = getPairHatcherySlotDef(found!.rewardSlotIndex);
        expect(rollHatchPetLevelFromRule(vipDef!.levelRule)).toBe(10);
        expect(resolvePairHatcheryRewardSlotIndex(found!.session, found!.arrayIndex)).toBe(
            PAIR_HATCHERY_VIP_SLOT_INDEX,
        );
    });
});
