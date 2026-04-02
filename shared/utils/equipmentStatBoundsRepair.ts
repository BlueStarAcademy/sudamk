import type { InventoryItem, ItemOption } from '../types/entities.js';
import { ItemGrade, CoreStat, SpecialStat, type EquipmentSlot } from '../types/enums.js';
import {
    MAIN_STAT_DEFINITIONS,
    CORE_STATS_DATA,
    GRADE_SUB_OPTION_RULES,
    SUB_OPTION_POOLS,
    SPECIAL_STATS_DATA,
    resolveCombatSubPoolDefinition,
} from '../constants/index.js';
import { computeEnhancedMainValueAtStars, hashStringToSeed32 } from './equipmentEnhancementStars.js';
import { combatSubBoundsAfterEnhancements, resolveCombatSubValueRefinementRange } from './refinementValueBounds.js';

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
        const baseValue = Number.isFinite(Number(main.baseValue)) ? Number(main.baseValue) : fallbackBase;
        if (Number.isFinite(baseValue) && Number.isFinite(fallbackBase)) {
            if (!Number.isFinite(Number(main.baseValue))) {
                main.baseValue = fallbackBase;
            }
            const ceiling = computeEnhancedMainValueAtStars(baseValue, grade, 10);
            const tol = Math.max(4, Math.ceil(ceiling * MAIN_SLACK_RATIO));
            const expected = computeEnhancedMainValueAtStars(baseValue, grade, stars);
            const cur = Number(main.value);
            const broken =
                !Number.isFinite(cur) ||
                cur > ceiling + tol ||
                cur < baseValue - 1 ||
                (stars === 0 && Math.abs(cur - baseValue) > 0.51);
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

    item.options.specialSubs = item.options.specialSubs.map((sub, sidx) => {
        const subDef = SPECIAL_STATS_DATA[sub.type as SpecialStat];
        if (!subDef) return sub;
        const enh = sub.enhancements ?? 0;
        const bl = Number(subDef.range[0]);
        const bh = Number(subDef.range[1]);
        const low = Math.round(bl * (1 + enh));
        const high = Math.round(bh * (1 + enh));
        let v = Number(sub.value);
        const broken = !Number.isFinite(v) || v > high + 15 || v < low - 15;
        if (broken) {
            v = deterministicIntInclusive(low, high, `${item.id}|ss|${sidx}|${String(sub.type)}|${enh}`);
        } else {
            v = Math.max(low, Math.min(high, Math.round(v)));
        }
        return {
            ...sub,
            value: v,
            range: [low, high] as [number, number],
            display: `${subDef.name} +${v}${subDef.isPercentage ? '%' : ''} [${low}~${high}]`,
        };
    });

    item.options.mythicSubs = item.options.mythicSubs.map((m) => {
        const v = Number(m.value);
        const safe = Number.isFinite(v) ? Math.max(0, Math.min(9999, Math.floor(v))) : 0;
        return { ...m, value: safe };
    });

    return item;
}
