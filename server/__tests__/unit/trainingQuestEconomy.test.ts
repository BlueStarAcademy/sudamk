import { describe, expect, it } from 'vitest';
import {
    buildMissionLevels,
    claimedCyclesFromAmount,
    coerceAccumulatedCollectionToCycleXp,
    requiredEnhanceXpForLevel,
    totalEnhanceXpBetweenLevels,
    upgradeGoldCostForLevel,
    type FacilityTierParams,
} from '../../../shared/utils/trainingQuestEconomy.js';
import {
    getEnhanceStoneLootTable,
    getEquipmentBoxLootTable,
    mergeLootResults,
    rollProductionLoot,
} from '../../../shared/utils/trainingQuestLoot.js';
import { SINGLE_PLAYER_MISSIONS } from '../../../shared/constants/singlePlayerConstants.js';

describe('trainingQuestEconomy', () => {
    const goldParams: FacilityTierParams = {
        id: 't',
        name: 't',
        description: 'd',
        unlockUserLevel: 2,
        rewardType: 'gold',
        image: '/',
        tier: 1,
        tierGoldBase: 8,
        baseIntervalMin: 15,
        baseAmount: 5,
        baseCap: 40,
    };

    it('builds 10 levels with no fully dead consecutive levels', () => {
        const levels = buildMissionLevels(goldParams);
        expect(levels).toHaveLength(10);
        for (let i = 1; i < levels.length; i++) {
            const prev = levels[i - 1]!;
            const cur = levels[i]!;
            const changed =
                cur.productionRateMinutes < prev.productionRateMinutes ||
                cur.rewardAmount !== prev.rewardAmount ||
                cur.maxCapacity !== prev.maxCapacity;
            expect(changed).toBe(true);
        }
    });

    it('uses legacy-style enhance XP and gold cost', () => {
        // floor(40/5)=8 cycles/full → Lv1→2 = 80, Lv2→3 = 160
        expect(requiredEnhanceXpForLevel({ maxCapacity: 40, rewardAmount: 5 }, 1)).toBe(80);
        expect(requiredEnhanceXpForLevel({ maxCapacity: 40, rewardAmount: 5 }, 2)).toBe(160);
        expect(upgradeGoldCostForLevel({ maxCapacity: 40 }, 'gold')).toBe(200);
        expect(upgradeGoldCostForLevel({ maxCapacity: 2 }, 'diamonds')).toBe(2000);
    });

    it('converts claimed amount to cycles', () => {
        expect(claimedCyclesFromAmount(50, 5)).toBe(10);
        expect(claimedCyclesFromAmount(3, 1)).toBe(3);
    });

    it('coerces legacy gold-denominated XP to cycles for gold facilities', () => {
        const levels = buildMissionLevels(goldParams);
        const xpToMax = totalEnhanceXpBetweenLevels(levels, 1);
        expect(xpToMax).toBeGreaterThan(0);

        // 레거시: 수령 골드 5만 → 사이클 환산
        const legacyGold = 50_000;
        const coerced = coerceAccumulatedCollectionToCycleXp({
            accumulatedCollection: legacyGold,
            rewardAmountPerCycle: levels[0]!.rewardAmount,
            levels,
        });
        expect(coerced.converted).toBe(true);
        expect(coerced.value).toBe(Math.floor(legacyGold / levels[0]!.rewardAmount));
        expect(coerced.value).toBeLessThanOrEqual(xpToMax);

        // 이미 사이클 단위면 유지
        const alreadyCycles = coerceAccumulatedCollectionToCycleXp({
            accumulatedCollection: 120,
            rewardAmountPerCycle: levels[0]!.rewardAmount,
            levels,
            enhanceXpUnit: 'cycles',
        });
        expect(alreadyCycles.converted).toBe(false);
        expect(alreadyCycles.value).toBe(120);

        // 작은 사이클 값(옛 Lv1 골드 필요량 미만)은 환산하지 않음
        const small = coerceAccumulatedCollectionToCycleXp({
            accumulatedCollection: 80,
            rewardAmountPerCycle: levels[0]!.rewardAmount,
            levels,
        });
        expect(small.converted).toBe(false);
        expect(small.value).toBe(80);

        // 옛 Lv1→2 골드 필요량 이상은 환산 (만렙 합보다 작아도)
        const legacyOneLevel = levels[0]!.maxCapacity * 10;
        const mid = coerceAccumulatedCollectionToCycleXp({
            accumulatedCollection: legacyOneLevel,
            rewardAmountPerCycle: levels[0]!.rewardAmount,
            levels,
        });
        expect(mid.converted).toBe(true);
        expect(mid.value).toBe(Math.floor(legacyOneLevel / levels[0]!.rewardAmount));
    });

    it('all gold facilities convert legacy banks; amount=1 facilities do not need convert', () => {
        for (const mission of SINGLE_PLAYER_MISSIONS) {
            const lv1 = mission.levels[0]!;
            const xpToMax = totalEnhanceXpBetweenLevels(mission.levels, 1);
            const legacyBank = lv1.maxCapacity * 10 * 15;
            const coerced = coerceAccumulatedCollectionToCycleXp({
                accumulatedCollection: legacyBank,
                rewardAmountPerCycle: lv1.rewardAmount,
                levels: mission.levels,
            });

            if (mission.rewardType === 'gold') {
                expect(lv1.rewardAmount).toBeGreaterThan(1);
                expect(legacyBank).toBeGreaterThan(xpToMax);
                expect(coerced.converted).toBe(true);
                expect(coerced.value).toBe(Math.floor(legacyBank / lv1.rewardAmount));
                expect(coerced.value).toBeLessThan(xpToMax);
            } else {
                // 다이아·강화석·상자: 1회 1개라 재화량=사이클 — 환산 불필요
                expect(lv1.rewardAmount).toBe(1);
                expect(coerced.converted).toBe(false);
                expect(coerced.value).toBe(legacyBank);
            }
        }
    });

    it('crystal garden legacy bank cannot instantly fund max enhance after coerce', () => {
        const crystal = SINGLE_PLAYER_MISSIONS.find((m) => m.id === 'mission_study_joseki');
        expect(crystal).toBeTruthy();
        const levels = crystal!.levels;
        const lv1 = levels[0]!;
        const xpToMax = totalEnhanceXpBetweenLevels(levels, 1);
        const legacyGold = lv1.maxCapacity * 10 * 20;
        expect(legacyGold).toBeGreaterThan(xpToMax);

        const coerced = coerceAccumulatedCollectionToCycleXp({
            accumulatedCollection: legacyGold,
            rewardAmountPerCycle: lv1.rewardAmount,
            levels,
        });
        expect(coerced.converted).toBe(true);
        expect(coerced.value).toBe(Math.floor(legacyGold / lv1.rewardAmount));
        expect(coerced.value).toBeLessThan(xpToMax);
    });
});

describe('trainingQuestLoot', () => {
    it('excludes equipment box VI before facility level 5', () => {
        for (let lv = 1; lv <= 4; lv++) {
            const table = getEquipmentBoxLootTable(lv);
            expect(table.some((e) => e.itemId === '장비 상자 VI')).toBe(false);
        }
        const at5 = getEquipmentBoxLootTable(5);
        expect(at5.some((e) => e.itemId === '장비 상자 VI')).toBe(true);
    });

    it('stone table always has positive weights that sum > 0', () => {
        const table = getEnhanceStoneLootTable(1);
        expect(table.length).toBeGreaterThan(0);
        expect(table.reduce((s, e) => s + e.weight, 0)).toBeGreaterThan(0);
    });

    it('rolls expected number of loot results', () => {
        let i = 0;
        const rng = () => {
            i += 1;
            return (i % 10) / 10;
        };
        const rolls = rollProductionLoot('enhance_stone', 1, 3, rng);
        expect(rolls).toHaveLength(3);
        const merged = mergeLootResults(rolls);
        expect(merged.reduce((s, r) => s + r.quantity, 0)).toBeGreaterThanOrEqual(3);
    });
});

describe('SINGLE_PLAYER_MISSIONS unlock levels', () => {
    it('has 8 facilities with planned user levels', () => {
        expect(SINGLE_PLAYER_MISSIONS).toHaveLength(8);
        expect(SINGLE_PLAYER_MISSIONS.map((m) => m.unlockUserLevel)).toEqual([2, 4, 7, 10, 13, 16, 20, 25]);
        expect(SINGLE_PLAYER_MISSIONS.some((m) => m.rewardType === 'enhance_stone')).toBe(true);
        expect(SINGLE_PLAYER_MISSIONS.some((m) => m.rewardType === 'equipment_box')).toBe(true);
    });

    it('Lv1→10 ideal claim time stays within long legacy-style guardrail', () => {
        const dayMs = 24 * 60 * 60 * 1000;
        for (const mission of SINGLE_PLAYER_MISSIONS) {
            let totalMinutes = 0;
            for (let level = 1; level <= 9; level++) {
                const levelInfo = mission.levels[level - 1]!;
                const xpNeeded = requiredEnhanceXpForLevel(levelInfo, level);
                totalMinutes += xpNeeded * levelInfo.productionRateMinutes;
            }
            const days = (totalMinutes * 60 * 1000) / dayMs;
            // 개선 전 체감: 수 주 단위 (연속 수령 기준)
            expect(days).toBeGreaterThanOrEqual(20);
            expect(days).toBeLessThanOrEqual(90);
        }
    });

    it('later gold tiers have higher gold per hour at Lv1', () => {
        const goldMissions = SINGLE_PLAYER_MISSIONS.filter((m) => m.rewardType === 'gold');
        const rate = (m: (typeof goldMissions)[number]) => {
            const lv = m.levels[0]!;
            return (lv.rewardAmount / lv.productionRateMinutes) * 60;
        };
        for (let i = 1; i < goldMissions.length; i++) {
            expect(rate(goldMissions[i]!)).toBeGreaterThan(rate(goldMissions[i - 1]!));
        }
    });
});
