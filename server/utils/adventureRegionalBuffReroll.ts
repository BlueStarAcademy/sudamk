import type {
    AdventureRegionalSpecialtyBuffEntry,
    AdventureRegionalSpecialtyBuffKind,
    User,
} from '../../types/index.js';
import {
    ADVENTURE_REGIONAL_BUFF_ACTION_GOLD,
    enhancementPointsGrantedTotalForTier,
    getRegionalBuffMaxStacks,
    isRegionalBuffEnhanceable,
    migrateRegionalBuffEntry,
    rollRandomRegionalBuffEntryExcluding,
    syncRegionalSpecialtySlotsAndPoints,
} from '../../utils/adventureRegionalSpecialtyBuff.js';
import { getAdventureUnderstandingTierFromXp } from '../../constants/adventureConstants.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';

function usedKindsExceptSlot(
    list: (AdventureRegionalSpecialtyBuffEntry | undefined)[],
    exceptIndex: number,
): Set<AdventureRegionalSpecialtyBuffKind> {
    const s = new Set<AdventureRegionalSpecialtyBuffKind>();
    list.forEach((e, idx) => {
        if (idx === exceptIndex || !e?.kind) return;
        s.add(e.kind);
    });
    return s;
}

function stageTier(user: User, stageId: string): number {
    const xp = Math.max(0, Math.floor((user.adventureProfile?.understandingXpByStage ?? {})[stageId] ?? 0));
    return getAdventureUnderstandingTierFromXp(xp);
}

/**
 * 단일 슬롯 효과 변경(리롤).
 * 빈(사용 가능) 슬롯에 첫 효과를 넣을 때는 무료이며, 이미 효과가 있는 슬롯을 바꿀 때는 골드를 소모한다.
 * 강화가 있었던 경우(stacks>1) 1단계로 초기화하고 사용했던 강화 포인트를 환급한다.
 */
export function changeSingleRegionalSlotBuff(user: User, stageId: string, slotIndex: number): string | null {
    let p = normalizeAdventureProfile(user.adventureProfile);
    p = syncRegionalSpecialtySlotsAndPoints(p);
    const rawStageList = [...(p.regionalSpecialtyBuffsByStageId?.[stageId] ?? [])];
    const list: (AdventureRegionalSpecialtyBuffEntry | undefined)[] = rawStageList.map((e) =>
        e != null && typeof e === 'object' && String((e as { kind?: unknown }).kind ?? '').trim() !== ''
            ? migrateRegionalBuffEntry(e as any)
            : undefined,
    );
    const n = list.length;
    if (n <= 0) return '해당 지역에 교체할 효과가 없습니다.';
    if (slotIndex < 0 || slotIndex >= n) return '잘못된 슬롯입니다.';

    const tier = stageTier(user, stageId);
    const grant = enhancementPointsGrantedTotalForTier(tier);
    const curPts = Math.max(0, Math.floor(p.regionalBuffEnhancePointsByStageId?.[stageId] ?? 0));

    const rawAtSlot = list[slotIndex];
    const isEmptySlot =
        rawAtSlot == null ||
        typeof rawAtSlot !== 'object' ||
        !rawAtSlot.kind ||
        String(rawAtSlot.kind).trim() === '';

    if (isEmptySlot) {
        const next = list.slice();
        next[slotIndex] = rollRandomRegionalBuffEntryExcluding(usedKindsExceptSlot(next, slotIndex));
        user.adventureProfile = {
            ...p,
            regionalSpecialtyBuffsByStageId: { ...p.regionalSpecialtyBuffsByStageId, [stageId]: next },
            regionalBuffEnhancePointsByStageId: { ...p.regionalBuffEnhancePointsByStageId, [stageId]: curPts },
        };
        user.adventureProfile = syncRegionalSpecialtySlotsAndPoints(user.adventureProfile);
        return null;
    }

    if ((user.gold ?? 0) < ADVENTURE_REGIONAL_BUFF_ACTION_GOLD) {
        return `골드가 부족합니다. (필요: ${ADVENTURE_REGIONAL_BUFF_ACTION_GOLD.toLocaleString()})`;
    }

    const ent = migrateRegionalBuffEntry(rawAtSlot as any);
    const refund = isRegionalBuffEnhanceable(ent.kind) ? Math.max(0, Math.floor(ent.stacks ?? 1) - 1) : 0;
    const nextPts = Math.min(grant, curPts + refund);

    const next = list.slice() as (AdventureRegionalSpecialtyBuffEntry | undefined)[];
    next[slotIndex] = rollRandomRegionalBuffEntryExcluding(usedKindsExceptSlot(next, slotIndex));

    user.gold = (user.gold ?? 0) - ADVENTURE_REGIONAL_BUFF_ACTION_GOLD;
    user.adventureProfile = {
        ...p,
        regionalSpecialtyBuffsByStageId: { ...p.regionalSpecialtyBuffsByStageId, [stageId]: next },
        regionalBuffEnhancePointsByStageId: { ...p.regionalBuffEnhancePointsByStageId, [stageId]: nextPts },
    };
    user.adventureProfile = syncRegionalSpecialtySlotsAndPoints(user.adventureProfile);
    return null;
}

/** 단일 슬롯 강화. 1000 골드 + 강화 포인트 1 */
export function enhanceSingleRegionalSlotBuff(user: User, stageId: string, slotIndex: number): string | null {
    let p = normalizeAdventureProfile(user.adventureProfile);
    p = syncRegionalSpecialtySlotsAndPoints(p);
    const rawStageListEnh = [...(p.regionalSpecialtyBuffsByStageId?.[stageId] ?? [])];
    const list: (AdventureRegionalSpecialtyBuffEntry | undefined)[] = rawStageListEnh.map((e) =>
        e != null && typeof e === 'object' && String((e as { kind?: unknown }).kind ?? '').trim() !== ''
            ? migrateRegionalBuffEntry(e as any)
            : undefined,
    );
    const n = list.length;
    if (n <= 0) return '해당 지역에 강화할 효과가 없습니다.';
    if (slotIndex < 0 || slotIndex >= n) return '잘못된 슬롯입니다.';
    if ((user.gold ?? 0) < ADVENTURE_REGIONAL_BUFF_ACTION_GOLD) {
        return `골드가 부족합니다. (필요: ${ADVENTURE_REGIONAL_BUFF_ACTION_GOLD.toLocaleString()})`;
    }

    const raw = list[slotIndex];
    if (!raw) return '빈 슬롯입니다. 먼저 효과를 변경(뽑기)해 주세요.';
    const ent = migrateRegionalBuffEntry(raw as any);
    if (!isRegionalBuffEnhanceable(ent.kind)) {
        return '이 효과는 강화할 수 없습니다.';
    }
    const max = getRegionalBuffMaxStacks(ent.kind);
    const st = Math.max(1, Math.floor(ent.stacks ?? 1));
    if (st >= max) return '이미 최대 강화입니다.';

    const tier = stageTier(user, stageId);
    const grant = enhancementPointsGrantedTotalForTier(tier);
    const curPts = Math.max(0, Math.floor(p.regionalBuffEnhancePointsByStageId?.[stageId] ?? 0));
    if (curPts < 1) return '강화 포인트가 부족합니다.';

    const next = [...list];
    next[slotIndex] = { ...ent, stacks: st + 1 };

    user.gold = (user.gold ?? 0) - ADVENTURE_REGIONAL_BUFF_ACTION_GOLD;
    user.adventureProfile = {
        ...p,
        regionalSpecialtyBuffsByStageId: { ...p.regionalSpecialtyBuffsByStageId, [stageId]: next },
        regionalBuffEnhancePointsByStageId: {
            ...p.regionalBuffEnhancePointsByStageId,
            [stageId]: curPts - 1,
        },
    };
    user.adventureProfile = syncRegionalSpecialtySlotsAndPoints(user.adventureProfile);
    return null;
}
