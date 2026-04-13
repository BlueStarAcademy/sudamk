import type {
    AdventureProfile,
    AdventureRegionalSpecialtyBuffEntry,
    AdventureRegionalSpecialtyBuffKind,
} from '../types/entities.js';
import { getAdventureUnderstandingTierFromXp } from '../constants/adventureConstants.js';
import { normalizeAdventureProfile } from './adventureUnderstanding.js';

export type { AdventureRegionalSpecialtyBuffEntry, AdventureRegionalSpecialtyBuffKind };

export const ADVENTURE_REGIONAL_SPECIALTY_KINDS: readonly AdventureRegionalSpecialtyBuffKind[] = [
    'adv_gold_pct',
    'map_monster_dwell_pct',
    'capture_opponent_target_plus1',
    'hidden_scan_plus1',
    'missile_plus1',
] as const;

/** @deprecated 일일 리롤 제거됨 — 호환용 */
export const ADVENTURE_REGIONAL_BUFF_REROLL_COST_GOLD = 1000;
/** @deprecated 일일 리롤 제거됨 */
export const ADVENTURE_REGIONAL_BUFF_REROLLS_PER_DAY = 3;

/** 효과 변경: 잠긴 슬롯만 유지하고 나머지를 바꿀 때 기본 골드 */
export const ADVENTURE_REGIONAL_BUFF_CHANGE_BASE_GOLD = 1000;
/** 변경 대상(잠금 해제) 슬롯이 하나 더 늘어날 때마다 추가 골드 */
export const ADVENTURE_REGIONAL_BUFF_CHANGE_EXTRA_GOLD_PER_EXTRA_UNLOCKED = 500;

/** 잠금 개수·총 슬롯 수로 효과 변경 비용 계산 (서버·클라이언트 동일) */
export function computeAdventureRegionalBuffChangeCostGold(totalBuffs: number, lockedCount: number): number {
    if (totalBuffs <= 0) return 0;
    const unlocked = totalBuffs - lockedCount;
    if (unlocked <= 0) return 0;
    return (
        ADVENTURE_REGIONAL_BUFF_CHANGE_BASE_GOLD +
        Math.max(0, unlocked - 1) * ADVENTURE_REGIONAL_BUFF_CHANGE_EXTRA_GOLD_PER_EXTRA_UNLOCKED
    );
}

/** 모험 골드 +% (스택당) */
export const ADVENTURE_REGIONAL_SPECIALTY_GOLD_PCT_PER_STACK = 5;
/** 맵 몬스터 체류 시간 +% (스택당) */
export const ADVENTURE_REGIONAL_SPECIALTY_MAP_DWELL_PCT_PER_STACK = 10;

export function defaultPercentForRegionalSpecialtyKind(kind: AdventureRegionalSpecialtyBuffKind): number | undefined {
    if (kind === 'adv_gold_pct') return ADVENTURE_REGIONAL_SPECIALTY_GOLD_PCT_PER_STACK;
    if (kind === 'map_monster_dwell_pct') return ADVENTURE_REGIONAL_SPECIALTY_MAP_DWELL_PCT_PER_STACK;
    return undefined;
}

export function utcCalendarDateString(d = new Date()): string {
    return d.toISOString().slice(0, 10);
}

function pickRandomUnseenKind(existing: Set<AdventureRegionalSpecialtyBuffKind>): AdventureRegionalSpecialtyBuffKind | null {
    const unseen = ADVENTURE_REGIONAL_SPECIALTY_KINDS.filter((k) => !existing.has(k));
    if (unseen.length === 0) return null;
    return unseen[Math.floor(Math.random() * unseen.length)]!;
}

/** `replaceIndex`를 제외한 슬롯의 종류 집합을 보며, 우선 아직 없는 종류로 교체용 종류를 고름 */
export function pickReplacementRegionalKind(
    workingList: AdventureRegionalSpecialtyBuffEntry[],
    replaceIndex: number,
): AdventureRegionalSpecialtyBuffKind {
    const otherKinds = new Set<AdventureRegionalSpecialtyBuffKind>();
    for (let j = 0; j < workingList.length; j++) {
        if (j !== replaceIndex) otherKinds.add(workingList[j]!.kind);
    }
    const unseen = ADVENTURE_REGIONAL_SPECIALTY_KINDS.filter((k) => !otherKinds.has(k));
    if (unseen.length > 0) {
        return unseen[Math.floor(Math.random() * unseen.length)]!;
    }
    const cur = workingList[replaceIndex]!.kind;
    const pool = ADVENTURE_REGIONAL_SPECIALTY_KINDS.filter((k) => k !== cur);
    const pickFrom = pool.length > 0 ? pool : [...ADVENTURE_REGIONAL_SPECIALTY_KINDS];
    return pickFrom[Math.floor(Math.random() * pickFrom.length)]!;
}

/** 티어가 오른 횟수만큼, 아직 없는 종류 위주로 지역 특화 효과를 추가 */
export function applyRegionalSpecialtyBuffTierGrants(
    profile: AdventureProfile,
    stageId: string,
    xpBefore: number,
    xpAfter: number,
): AdventureProfile {
    const t0 = getAdventureUnderstandingTierFromXp(xpBefore);
    const t1 = getAdventureUnderstandingTierFromXp(xpAfter);
    const steps = Math.max(0, t1 - t0);
    if (steps === 0) return profile;

    const p = normalizeAdventureProfile(profile);
    const byStage = { ...(p.regionalSpecialtyBuffsByStageId ?? {}) };
    const list = [...(byStage[stageId] ?? [])];

    for (let s = 0; s < steps; s++) {
        const kinds = new Set(list.map((e) => e.kind));
        const pick = pickRandomUnseenKind(kinds);
        if (!pick) break;
        list.push({ kind: pick, valuePercent: defaultPercentForRegionalSpecialtyKind(pick) });
    }

    byStage[stageId] = list;
    return { ...p, regionalSpecialtyBuffsByStageId: byStage };
}

export function countRegionalBuffKindForStage(
    profile: AdventureProfile | null | undefined,
    stageId: string,
    kind: AdventureRegionalSpecialtyBuffKind,
): number {
    const p = normalizeAdventureProfile(profile);
    const list = p.regionalSpecialtyBuffsByStageId?.[stageId] ?? [];
    return list.filter((e) => e.kind === kind).length;
}

export function sumRegionalAdvGoldPercentForProfile(profile: AdventureProfile | null | undefined): number {
    const p = normalizeAdventureProfile(profile);
    let sum = 0;
    for (const list of Object.values(p.regionalSpecialtyBuffsByStageId ?? {})) {
        for (const e of list ?? []) {
            if (e.kind === 'adv_gold_pct') {
                sum += e.valuePercent ?? ADVENTURE_REGIONAL_SPECIALTY_GOLD_PCT_PER_STACK;
            }
        }
    }
    return sum;
}

/** 해당 스테이지 맵에서 몬스터 체류 시간 배율 (1 + 합계%) */
export function getRegionalMapMonsterDwellMultiplierForStage(
    profile: AdventureProfile | null | undefined,
    stageId: string,
): number {
    const n = countRegionalBuffKindForStage(profile, stageId, 'map_monster_dwell_pct');
    if (n <= 0) return 1;
    const pctEach = ADVENTURE_REGIONAL_SPECIALTY_MAP_DWELL_PCT_PER_STACK;
    return 1 + (n * pctEach) / 100;
}

export function getRegionalHiddenScanBonus(profile: AdventureProfile | null | undefined, stageId: string): number {
    return countRegionalBuffKindForStage(profile, stageId, 'hidden_scan_plus1');
}

export function getRegionalMissileBonus(profile: AdventureProfile | null | undefined, stageId: string): number {
    return countRegionalBuffKindForStage(profile, stageId, 'missile_plus1');
}

export function getRegionalCaptureOpponentTargetBonus(profile: AdventureProfile | null | undefined, stageId: string): number {
    return countRegionalBuffKindForStage(profile, stageId, 'capture_opponent_target_plus1');
}

export function labelRegionalSpecialtyBuffEntry(e: AdventureRegionalSpecialtyBuffEntry): string {
    switch (e.kind) {
        case 'adv_gold_pct':
            return `모험 골드 +${e.valuePercent ?? ADVENTURE_REGIONAL_SPECIALTY_GOLD_PCT_PER_STACK}%`;
        case 'map_monster_dwell_pct':
            return `몬스터 유지시간 +${e.valuePercent ?? ADVENTURE_REGIONAL_SPECIALTY_MAP_DWELL_PCT_PER_STACK}%`;
        case 'capture_opponent_target_plus1':
            return '따내기 모드 상대 목표 +1';
        case 'hidden_scan_plus1':
            return '히든바둑 스캔 아이템 +1';
        case 'missile_plus1':
            return '미사일 바둑 미사일 아이템 +1';
        default:
            return '';
    }
}
