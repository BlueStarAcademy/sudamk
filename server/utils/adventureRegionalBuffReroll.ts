import type { User } from '../../types/index.js';
import {
    computeAdventureRegionalBuffChangeCostGold,
    defaultPercentForRegionalSpecialtyKind,
    pickReplacementRegionalKind,
} from '../../utils/adventureRegionalSpecialtyBuff.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';

/**
 * 지역 특화 효과: 잠긴 인덱스는 유지, 나머지 슬롯만 골드로 무작위 교체.
 * - 효과 1개: 전부 교체(잠금 없음)
 * - 효과 2개 이상: 최소 1개는 잠금(🔒), 최소 1개는 변경 대상(🔓)
 */
export function changeAdventureRegionalSpecialtyBuffs(
    user: User,
    stageId: string,
    lockedIndices: number[],
): string | null {
    const p = normalizeAdventureProfile(user.adventureProfile);
    const list = [...(p.regionalSpecialtyBuffsByStageId?.[stageId] ?? [])];
    const n = list.length;
    if (n === 0) {
        return '해당 지역에 교체할 효과가 없습니다.';
    }

    const locked = new Set(
        (lockedIndices ?? [])
            .map((i) => (Number.isInteger(i) ? i : -1))
            .filter((i) => i >= 0 && i < n),
    );

    if (n >= 2) {
        if (locked.size === 0) {
            return '효과가 둘 이상일 때는 최소 하나는 잠가 두어야 합니다.';
        }
        if (locked.size >= n) {
            return '변경할 효과를 최소 하나 선택해 주세요. (잠금 해제된 항목이 있어야 합니다)';
        }
    } else {
        if (locked.size > 0) {
            locked.clear();
        }
    }

    const lockedCount = n >= 2 ? locked.size : 0;
    const cost = computeAdventureRegionalBuffChangeCostGold(n, lockedCount);
    if ((user.gold ?? 0) < cost) {
        return `골드가 부족합니다. (필요: ${cost.toLocaleString()})`;
    }

    const working = list.map((e) => ({ ...e }));
    const sortedUnlock = [];
    for (let i = 0; i < n; i++) {
        if (!locked.has(i)) sortedUnlock.push(i);
    }
    sortedUnlock.sort((a, b) => a - b);

    for (const idx of sortedUnlock) {
        const pick = pickReplacementRegionalKind(working, idx);
        working[idx] = { kind: pick, valuePercent: defaultPercentForRegionalSpecialtyKind(pick) };
    }

    user.gold = (user.gold ?? 0) - cost;
    user.adventureProfile = {
        ...p,
        regionalSpecialtyBuffsByStageId: { ...p.regionalSpecialtyBuffsByStageId, [stageId]: working },
    };
    return null;
}
