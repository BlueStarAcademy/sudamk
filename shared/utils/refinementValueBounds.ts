import type { SubOptionDefinition } from '../constants/items.js';
import type { SpecialStat } from '../types/enums.js';
import { computeSpecialSubRollBoundsAfterMilestones } from './specialStatMilestones.js';

/**
 * 부옵 강화 틱(4칸 꽉 찬 뒤): range[0] += baseLow*m, range[1] += baseHigh*m (m ∈ {1,2}).
 * 최초 부옵: 상점 생성은 [bl,bh], 강화로 신규 줄 때는 [bl*m0, bh*m0] (m0∈{1,2}).
 * n번 해당 부옵이 추가 강화된 뒤(= enhancements === n):
 * - range[0] ∈ [bl*(1+n), 2*bl*(1+n)]
 * - range[1] ∈ [bh*(1+n), 2*bh*(1+n)]
 * (각 스텝에서 최소 +bl/+bh, 최대 +2bl/+2bh이므로)
 */
export function combatSubBoundsAfterEnhancements(
    baseLow: number,
    baseHigh: number,
    enhancements: number
): { minLow: number; maxLow: number; minHigh: number; maxHigh: number } {
    const n = Math.max(0, Math.min(50, Math.floor(Number(enhancements) || 0)));
    const bl = Number(baseLow);
    const bh = Number(baseHigh);
    if (!Number.isFinite(bl) || !Number.isFinite(bh) || bh < bl) {
        return { minLow: 0, maxLow: 0, minHigh: 0, maxHigh: 0 };
    }
    return {
        minLow: Math.round(bl * (1 + n)),
        maxLow: Math.round(2 * bl * (1 + n)),
        minHigh: Math.round(bh * (1 + n)),
        maxHigh: Math.round(2 * bh * (1 + n)),
    };
}

const SLACK = 2;

/**
 * 저장된 range가 깨졌을 때 풀 정의로 복구. 정상이면 저장값을 축별로 클램프만 한다.
 */
export function resolveCombatSubValueRefinementRange(
    stored: [number, number],
    poolDef: Pick<SubOptionDefinition, 'range'>,
    enhancements: number
): [number, number] | null {
    const bl = Number(poolDef.range[0]);
    const bh = Number(poolDef.range[1]);
    if (!Number.isFinite(bl) || !Number.isFinite(bh) || bh < bl) return null;

    const b = combatSubBoundsAfterEnhancements(bl, bh, enhancements);
    if (b.maxHigh < b.minLow) return [bl, bh];

    const s0 = Math.floor(Number(stored[0]));
    const s1 = Math.floor(Number(stored[1]));

    const inEnvelope =
        Number.isFinite(s0) &&
        Number.isFinite(s1) &&
        s1 >= s0 &&
        s0 >= b.minLow - SLACK &&
        s0 <= b.maxLow + SLACK &&
        s1 >= b.minHigh - SLACK &&
        s1 <= b.maxHigh + SLACK;

    if (!inEnvelope) {
        return [b.minLow, b.maxHigh];
    }

    const c0 = Math.max(b.minLow, Math.min(b.maxLow, s0));
    const c1 = Math.max(b.minHigh, Math.min(b.maxHigh, s1));
    if (c1 < c0) {
        return [b.minLow, b.maxHigh];
    }
    return [c0, c1];
}

/**
 * 특수 옵션: +4/+7/+10 강화(별)마다 타입별 고정 증가. `enhancements`는 그 마일스톤 적용 횟수(보통 0~3).
 * 허용 수치 구간은 `computeSpecialSubRollBoundsAfterMilestones(기본 range, stat, enhancements)`.
 */
export function resolveSpecialSubValueRefinementRange(
    stored: [number, number],
    poolDef: Pick<SubOptionDefinition, 'range'>,
    milestones: number,
    stat: SpecialStat
): [number, number] | null {
    const bl = Number(poolDef.range[0]);
    const bh = Number(poolDef.range[1]);
    if (!Number.isFinite(bl) || !Number.isFinite(bh) || bh < bl) return null;

    const n = Math.max(0, Math.min(50, Math.floor(Number(milestones) || 0)));
    const [low, high] = computeSpecialSubRollBoundsAfterMilestones([bl, bh], stat, n);
    if (high < low) return [bl, bh];

    const s0 = Math.floor(Number(stored[0]));
    const s1 = Math.floor(Number(stored[1]));

    const inEnvelope =
        Number.isFinite(s0) &&
        Number.isFinite(s1) &&
        s1 >= s0 &&
        s0 >= low - SLACK &&
        s1 <= high + SLACK &&
        s0 <= high + SLACK &&
        s1 >= low - SLACK;

    if (!inEnvelope) {
        return [low, high];
    }

    const c0 = Math.max(low, Math.min(high, s0));
    const c1 = Math.max(low, Math.min(high, s1));
    if (c1 < c0) return [low, high];
    return [c0, c1];
}
