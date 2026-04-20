import type { InventoryItem, ItemOption } from '../types/entities.js';
import { ItemGrade, CoreStat, SpecialStat, MythicStat, type EquipmentSlot } from '../types/enums.js';
import {
    MAIN_STAT_DEFINITIONS,
    CORE_STATS_DATA,
    GRADE_SUB_OPTION_RULES,
    SUB_OPTION_POOLS,
    SPECIAL_STATS_DATA,
    MYTHIC_STATS_DATA,
    resolveCombatSubPoolDefinition,
} from '../constants/index.js';
import { mythicStatPoolForItemGrade } from './specialOptionGearEffects.js';
import { computeEnhancedMainValueAtStars, hashStringToSeed32 } from './equipmentEnhancementStars.js';
import { combatSubBoundsAfterEnhancements, resolveCombatSubValueRefinementRange } from './refinementValueBounds.js';
import {
    coerceSpecialStatType,
    computeSpecialSubRollBoundsAfterMilestones,
    formatSpecialSubItemDisplay,
    milestoneTierCountFromStars,
} from './specialStatMilestones.js';

const MAIN_SLACK_RATIO = 0.12;

/** 동일 장비·슬롯이면 항상 같은 복구값 (로그인마다 바뀌지 않음) */
function deterministicIntInclusive(lo: number, hi: number, seedKey: string): number {
    const a = Math.floor(Number(lo));
    const b = Math.floor(Number(hi));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return a;
    const span = b - a + 1;
    return a + (hashStringToSeed32(seedKey) % span);
}

function rebuildMainDisplay(main: ItemOption): void {
    const statName = CORE_STATS_DATA[main.type as CoreStat]?.name ?? String(main.type);
    const pct = main.isPercentage ? '%' : '';
    main.display = `${statName} +${main.value}${pct}`;
}

/**
 * 신화·초월 등 획득 직후에도 나타날 수 있는 비정상 수치(문자열 이어붙기 파싱·DB 깨짐)를
 * 등급·슬롯·강화 단계 기준 허용 범위로 되돌린다.
 */
export function repairEquipmentStatBounds(item: InventoryItem): InventoryItem {
    if (!item || item.type !== 'equipment' || !item.options || !item.slot || !item.grade) {
        return item;
    }
    if (!item.options.combatSubs) item.options.combatSubs = [];
    if (!item.options.specialSubs) item.options.specialSubs = [];
    if (!item.options.mythicSubs) item.options.mythicSubs = [];

    const slot = item.slot as EquipmentSlot;
    const grade = item.grade as ItemGrade;
    const stars = Math.max(0, Math.min(10, Math.floor(Number(item.stars) || 0)));
    const gradeDef = MAIN_STAT_DEFINITIONS[slot]?.options[grade];
    const main = item.options.main;
    if (main && gradeDef) {
        const fallbackBase = Number(gradeDef.value);
        // 바지·바둑통·바둑돌: 저장된 base가 등급 정의와 다르면(마이그레이션 누락·Undo 등) 로드 시 정의로 맞춤.
        // 기존 로직은 옛 base로 천장을 잡아 '정상'으로 보고 value를 유지하는 문제가 있었다.
        const flatMainSlots: EquipmentSlot[] = ['bottom', 'bowl', 'stones'];
        if (
            flatMainSlots.includes(slot) &&
            Number.isFinite(fallbackBase) &&
            main.isPercentage !== true
        ) {
            const curBase = Number(main.baseValue);
            if (!Number.isFinite(curBase) || Math.abs(curBase - fallbackBase) > 1e-6) {
                main.baseValue = fallbackBase;
                const snapped = computeEnhancedMainValueAtStars(fallbackBase, grade, stars);
                main.value = parseFloat(snapped.toFixed(2));
                rebuildMainDisplay(main);
            }
        }

        const baseValue = Number.isFinite(Number(main.baseValue)) ? Number(main.baseValue) : fallbackBase;
        if (Number.isFinite(baseValue) && Number.isFinite(fallbackBase)) {
            if (!Number.isFinite(Number(main.baseValue))) {
                main.baseValue = fallbackBase;
            }
            const ceiling = computeEnhancedMainValueAtStars(baseValue, grade, 10);
            const tol = Math.max(4, Math.ceil(ceiling * MAIN_SLACK_RATIO));
            const expected = computeEnhancedMainValueAtStars(baseValue, grade, stars);
            const cur = Number(main.value);
            // 주옵 강화는 난수 없음 → base·등급·별 수가 맞으면 value는 항상 expected와 일치해야 함.
            // (구버전 base로 강화 후 base만 마이그레이션된 경우 value가 천장 범위 안에 있어도 틀릴 수 있음 → 도감과 불일치)
            const broken =
                !Number.isFinite(cur) ||
                cur > ceiling + tol ||
                cur < baseValue - 1 ||
                (stars === 0 && Math.abs(cur - baseValue) > 0.51) ||
                (stars > 0 && Math.abs(cur - expected) > 0.51);
            if (broken) {
                main.value = parseFloat(expected.toFixed(2));
                rebuildMainDisplay(main);
            }
        }
    }

    const combatTier = GRADE_SUB_OPTION_RULES[grade]?.combatTier;
    if (combatTier != null) {
        const pool = SUB_OPTION_POOLS[slot][combatTier];
        if (pool?.length) {
            item.options.combatSubs = item.options.combatSubs.map((sub, idx) => {
                const subDef = resolveCombatSubPoolDefinition(pool, sub.type as CoreStat, sub.isPercentage);
                if (!subDef) return sub;
                const enh = sub.enhancements ?? 0;
                const b = combatSubBoundsAfterEnhancements(subDef.range[0], subDef.range[1], enh);
                const slack = 25;
                const stored: [number, number] = sub.range
                    ? [Number(sub.range[0]), Number(sub.range[1])]
                    : [subDef.range[0], subDef.range[1]];
                const rng =
                    resolveCombatSubValueRefinementRange(stored, subDef, enh) ?? [b.minLow, b.maxHigh];
                const r0 = Math.floor(rng[0]);
                const r1 = Math.floor(rng[1]);
                let v = Number(sub.value);
                const outsideEnvelope =
                    !Number.isFinite(v) || v > b.maxHigh + slack || v < b.minLow - slack;
                const outsideRollRange = Number.isFinite(v) && (v < r0 - 1 || v > r1 + 1);
                if (outsideEnvelope || outsideRollRange) {
                    v = deterministicIntInclusive(r0, r1, `${item.id}|cs|${idx}|${String(sub.type)}|${enh}`);
                } else {
                    v = Math.max(r0, Math.min(r1, Math.round(v)));
                }
                const nm = CORE_STATS_DATA[sub.type as CoreStat]?.name ?? String(sub.type);
                const pct = sub.isPercentage ? '%' : '';
                return {
                    ...sub,
                    value: v,
                    range: [r0, r1] as [number, number],
                    display: `${nm} +${v}${pct} [${r0}~${r1}]`,
                };
            });
        }
    }

    const allSpecial = Object.values(SpecialStat);
    item.options.specialSubs = item.options.specialSubs.map((sub, sidx) => {
        let stat = coerceSpecialStatType(sub.type) ?? (sub.type as SpecialStat);
        let subDef = SPECIAL_STATS_DATA[stat];
        if (!subDef) {
            const pick = allSpecial[hashStringToSeed32(`${item.id}|ssmap|${sidx}`) % allSpecial.length];
            stat = pick;
            subDef = SPECIAL_STATS_DATA[stat];
        }
        const m = milestoneTierCountFromStars(stars);
        const baseRange = [subDef.range[0], subDef.range[1]] as [number, number];
        const [low, high] = computeSpecialSubRollBoundsAfterMilestones(baseRange, stat, m);
        let v = Number(sub.value);
        const broken = !Number.isFinite(v) || v > high + 2 || v < low - 2;
        if (broken) {
            v = deterministicIntInclusive(low, high, `${item.id}|ss|${sidx}|${String(stat)}|${m}`);
        } else {
            v = Math.max(low, Math.min(high, subDef.isPercentage ? parseFloat(v.toFixed(2)) : Math.round(v)));
        }
        const next: ItemOption = {
            ...sub,
            type: stat,
            value: v,
            range: baseRange,
            enhancements: m,
            display: formatSpecialSubItemDisplay(
                { type: stat, value: v, range: baseRange, enhancements: m },
                subDef
            ),
        };
        return next;
    });

    item.options.mythicSubs = item.options.mythicSubs.map((m, midx) => {
        const v = Number(m.value);
        const safe = Number.isFinite(v) ? Math.max(0, Math.min(9999, Math.floor(v))) : 0;
        let t = m.type as MythicStat;
        const pool = mythicStatPoolForItemGrade(grade);
        const defCur = MYTHIC_STATS_DATA[t as MythicStat];
        if (!defCur || !pool.includes(t)) {
            const pick =
                pool.length > 0
                    ? pool[Math.abs(hashStringToSeed32(`${item.id}|mythicSub|${midx}`)) % pool.length]!
                    : MythicStat.GuildBossRewardGradeUp;
            t = pick;
            const def = MYTHIC_STATS_DATA[t];
            return {
                ...m,
                type: t,
                value: def.value([0, 0]),
                isPercentage: false,
                display: def.name,
                enhancements: 0,
            };
        }
        const def = MYTHIC_STATS_DATA[t];
        return { ...m, type: t, value: safe, display: def.name };
    });

    // 등급별 허용 스페셜 옵션 줄 수:
    // - normal~legendary: 0줄
    // - mythic: 1줄
    // - transcendent: 1줄
    // 레거시/비정상 데이터로 에픽 이하에 스페셜 옵션이 섞인 경우 로드 시 정리한다.
    const mythicRule = GRADE_SUB_OPTION_RULES[grade]?.mythicCount ?? [0, 0];
    const maxMythicLines = Math.max(0, Math.floor(Number(mythicRule[1]) || 0));
    if (item.options.mythicSubs.length > maxMythicLines) {
        item.options.mythicSubs = item.options.mythicSubs.slice(0, maxMythicLines);
    }

    return item;
}
