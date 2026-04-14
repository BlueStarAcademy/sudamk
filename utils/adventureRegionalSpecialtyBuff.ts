import type {
    AdventureProfile,
    AdventureRegionalSpecialtyBuffEntry,
    AdventureRegionalSpecialtyBuffKind,
} from '../types/entities.js';
import { ADVENTURE_STAGES, getAdventureUnderstandingTierFromXp } from '../constants/adventureConstants.js';
import { normalizeAdventureProfile } from './adventureUnderstanding.js';

export type { AdventureRegionalSpecialtyBuffEntry, AdventureRegionalSpecialtyBuffKind };

/** 변경·강화 공통 골드 */
export const ADVENTURE_REGIONAL_BUFF_ACTION_GOLD = 1000;

/** @deprecated */
export const ADVENTURE_REGIONAL_BUFF_CHANGE_BASE_GOLD = ADVENTURE_REGIONAL_BUFF_ACTION_GOLD;
/** @deprecated */
export const ADVENTURE_REGIONAL_BUFF_CHANGE_EXTRA_GOLD_PER_EXTRA_UNLOCKED = 0;

export function computeAdventureRegionalBuffChangeCostGold(): number {
    return ADVENTURE_REGIONAL_BUFF_ACTION_GOLD;
}

const LEGACY_KIND_MAP: Record<string, AdventureRegionalSpecialtyBuffKind> = {
    adv_gold_pct: 'regional_win_gold_10pct',
    map_monster_dwell_pct: 'regional_monster_dwell_plus10pct',
    capture_opponent_target_plus1: 'regional_capture_target_plus1',
    hidden_scan_plus1: 'regional_hidden_scan_plus1',
    missile_plus1: 'regional_missile_plus1',
};

export const ADVENTURE_REGIONAL_SPECIALTY_KINDS: readonly AdventureRegionalSpecialtyBuffKind[] = [
    'regional_win_gold_10pct',
    'regional_equip_drop_3pct',
    'regional_material_drop_5pct',
    'regional_capture_target_plus1',
    'regional_time_limit_plus20pct',
    'regional_monster_respawn_minus10pct',
    'regional_monster_dwell_plus10pct',
    'regional_hidden_scan_plus1',
    'regional_base_start_score_plus1',
    'regional_classic_start_score_plus1',
    'regional_missile_plus1',
] as const;

type KindMeta = {
    maxStacks: number;
    enhanceable: boolean;
    stepPct?: number;
    stepFlat?: number;
};

const KIND_META: Record<AdventureRegionalSpecialtyBuffKind, KindMeta> = {
    regional_win_gold_10pct: { maxStacks: 5, enhanceable: true, stepPct: 10 },
    regional_equip_drop_3pct: { maxStacks: 5, enhanceable: true, stepPct: 3 },
    regional_material_drop_5pct: { maxStacks: 5, enhanceable: true, stepPct: 5 },
    regional_capture_target_plus1: { maxStacks: 5, enhanceable: true, stepFlat: 1 },
    regional_time_limit_plus20pct: { maxStacks: 5, enhanceable: true, stepPct: 20 },
    regional_monster_respawn_minus10pct: { maxStacks: 5, enhanceable: true, stepPct: 10 },
    regional_monster_dwell_plus10pct: { maxStacks: 5, enhanceable: true, stepPct: 10 },
    regional_hidden_scan_plus1: { maxStacks: 3, enhanceable: true, stepFlat: 1 },
    regional_base_start_score_plus1: { maxStacks: 5, enhanceable: true, stepFlat: 1 },
    regional_classic_start_score_plus1: { maxStacks: 5, enhanceable: true, stepFlat: 1 },
    regional_missile_plus1: { maxStacks: 1, enhanceable: false, stepFlat: 1 },
};

export function getRegionalBuffMaxStacks(kind: AdventureRegionalSpecialtyBuffKind): number {
    return KIND_META[kind]?.maxStacks ?? 1;
}

export function isRegionalBuffEnhanceable(kind: AdventureRegionalSpecialtyBuffKind): boolean {
    return KIND_META[kind]?.enhanceable ?? false;
}

export function enhancementPointsGrantedTotalForTier(tier: number): number {
    const t = Math.max(0, Math.min(4, Math.floor(tier)));
    return (t * (t + 1)) / 2;
}

export function slotCountForUnderstandingTier(tier: number): number {
    const t = Math.max(0, Math.min(4, Math.floor(tier)));
    return Math.min(5, t + 1);
}

function pointsSpentOnEntry(e: AdventureRegionalSpecialtyBuffEntry): number {
    if (!isRegionalBuffEnhanceable(e.kind)) return 0;
    const st = Math.max(1, Math.floor(e.stacks ?? 1));
    return Math.max(0, st - 1);
}

function migrateKind(raw: string): AdventureRegionalSpecialtyBuffKind {
    if (raw in KIND_META) return raw as AdventureRegionalSpecialtyBuffKind;
    return LEGACY_KIND_MAP[raw] ?? 'regional_win_gold_10pct';
}

export function migrateRegionalBuffEntry(raw: Partial<AdventureRegionalSpecialtyBuffEntry> & { kind?: string }): AdventureRegionalSpecialtyBuffEntry {
    const kind = migrateKind(String(raw.kind ?? 'regional_win_gold_10pct'));
    const max = getRegionalBuffMaxStacks(kind);
    let stacks = Math.max(1, Math.floor((raw as any).stacks ?? 1));
    if (!Number.isFinite(stacks)) stacks = 1;
    stacks = Math.min(max, stacks);
    return { kind, stacks };
}

export function rollRandomRegionalBuffEntry(): AdventureRegionalSpecialtyBuffEntry {
    const pool = ADVENTURE_REGIONAL_SPECIALTY_KINDS;
    const kind = pool[Math.floor(Math.random() * pool.length)]!;
    return { kind, stacks: 1 };
}

function listForStage(p: AdventureProfile, stageId: string): AdventureRegionalSpecialtyBuffEntry[] {
    return (p.regionalSpecialtyBuffsByStageId?.[stageId] ?? []).map((e) => migrateRegionalBuffEntry(e as any));
}

function buildStageListWithEmptyFirstSlot(
    source: AdventureRegionalSpecialtyBuffEntry[],
    need: number,
): AdventureRegionalSpecialtyBuffEntry[] {
    const n = Math.max(0, Math.floor(need));
    if (n <= 0) return [];
    const out: AdventureRegionalSpecialtyBuffEntry[] = new Array(n);
    // 슬롯 1은 기본으로 비워 두고, 유저가 "변경" 버튼으로 직접 뽑는다.
    for (let i = 1; i < n; i++) {
        const cur = source[i];
        out[i] = cur ? migrateRegionalBuffEntry(cur as any) : rollRandomRegionalBuffEntry();
    }
    return out;
}

/** 스테이지별 남은 강화 포인트(티어로 받은 총량 − 슬롯 강화 소모는 `stacks`로 복원 가능) */
export function getRegionalEnhancePointsRemaining(profile: AdventureProfile | null | undefined, stageId: string): number {
    const p = normalizeAdventureProfile(profile);
    const xp = p.understandingXpByStage?.[stageId] ?? 0;
    const tier = getAdventureUnderstandingTierFromXp(xp);
    const grant = enhancementPointsGrantedTotalForTier(tier);
    const stored = p.regionalBuffEnhancePointsByStageId?.[stageId];
    if (typeof stored === 'number' && Number.isFinite(stored)) {
        return Math.max(0, Math.min(grant, Math.floor(stored)));
    }
    const spentImplicit = listForStage(p, stageId).reduce((a, e) => a + pointsSpentOnEntry(e), 0);
    return Math.max(0, grant - spentImplicit);
}

/**
 * 슬롯 수·강화 포인트 클램프(기존 데이터 마이그레이션 포함). 기존 슬롯 효과는 유지하고 부족분만 채움.
 */
export function syncRegionalSpecialtySlotsAndPoints(profile: AdventureProfile): AdventureProfile {
    const p = normalizeAdventureProfile(profile);
    const byStage: NonNullable<AdventureProfile['regionalSpecialtyBuffsByStageId']> = {
        ...(p.regionalSpecialtyBuffsByStageId ?? {}),
    };
    const pts: NonNullable<AdventureProfile['regionalBuffEnhancePointsByStageId']> = {
        ...(p.regionalBuffEnhancePointsByStageId ?? {}),
    };

    for (const s of ADVENTURE_STAGES) {
        const sid = s.id;
        const xp = p.understandingXpByStage?.[sid] ?? 0;
        const tier = getAdventureUnderstandingTierFromXp(xp);
        const need = slotCountForUnderstandingTier(tier);
        const grant = enhancementPointsGrantedTotalForTier(tier);
        const prev = listForStage(p, sid);
        const list = buildStageListWithEmptyFirstSlot(prev, need);
        byStage[sid] = list;
        const spent = list.reduce((a, e) => a + pointsSpentOnEntry(e), 0);
        const cur = pts[sid];
        if (typeof cur !== 'number' || !Number.isFinite(cur)) {
            pts[sid] = Math.max(0, grant - spent);
        } else {
            pts[sid] = Math.max(0, Math.min(grant, Math.floor(cur)));
        }
    }

    return {
        ...p,
        regionalSpecialtyBuffsByStageId: byStage,
        regionalBuffEnhancePointsByStageId: pts,
    };
}

export function applyRegionalSpecialtyBuffTierGrants(
    profile: AdventureProfile,
    stageId: string,
    xpBefore: number,
    xpAfter: number,
): AdventureProfile {
    let p = normalizeAdventureProfile(profile);
    const t0 = getAdventureUnderstandingTierFromXp(xpBefore);
    const t1 = getAdventureUnderstandingTierFromXp(xpAfter);
    if (t1 <= t0) return syncRegionalSpecialtySlotsAndPoints(p);

    const byStage = { ...(p.regionalSpecialtyBuffsByStageId ?? {}) };
    const pts = { ...(p.regionalBuffEnhancePointsByStageId ?? {}) };
    const list = [...(byStage[stageId] ?? [])].map((e) => migrateRegionalBuffEntry(e as any));

    for (let t = t0 + 1; t <= t1; t++) {
        pts[stageId] = (pts[stageId] ?? 0) + t;
    }
    const need = slotCountForUnderstandingTier(t1);
    byStage[stageId] = buildStageListWithEmptyFirstSlot(list, need);

    p = { ...p, regionalSpecialtyBuffsByStageId: byStage, regionalBuffEnhancePointsByStageId: pts };
    return syncRegionalSpecialtySlotsAndPoints(p);
}

function sumStacksForKind(list: AdventureRegionalSpecialtyBuffEntry[], kind: AdventureRegionalSpecialtyBuffKind): number {
    return list.filter((e) => e.kind === kind).reduce((a, e) => a + Math.max(1, Math.floor(e.stacks ?? 1)), 0);
}

export function getRegionalStageBuffList(profile: AdventureProfile | null | undefined, stageId: string): AdventureRegionalSpecialtyBuffEntry[] {
    return listForStage(normalizeAdventureProfile(profile), stageId);
}

export function getRegionalWinGoldBonusPercentForStage(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_win_gold_10pct') * 10;
}

export function getRegionalEquipmentDropBonusPercentForStage(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_equip_drop_3pct') * 3;
}

export function getRegionalMaterialDropBonusPercentForStage(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_material_drop_5pct') * 5;
}

export function getRegionalCaptureOpponentTargetBonus(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_capture_target_plus1');
}

export function getRegionalHiddenScanBonus(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_hidden_scan_plus1');
}

export function getRegionalMissileBonus(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_missile_plus1');
}

/** 인카운터 제한시간 배율 (1 + 합계%) */
export function getRegionalAdventureEncounterDurationMultiplier(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    const pct = sumStacksForKind(list, 'regional_time_limit_plus20pct') * 20;
    return 1 + pct / 100;
}

export function getRegionalClassicOrStandardHeadStartPoints(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_classic_start_score_plus1');
}

export function getRegionalBaseHeadStartPoints(profile: AdventureProfile | null | undefined, stageId: string): number {
    const list = getRegionalStageBuffList(profile, stageId);
    return sumStacksForKind(list, 'regional_base_start_score_plus1');
}

/** 몬스터 맵 체류 시간 배율 */
export function getRegionalMapMonsterDwellMultiplierForStage(
    profile: AdventureProfile | null | undefined,
    stageId: string,
): number {
    const list = getRegionalStageBuffList(profile, stageId);
    const pct = sumStacksForKind(list, 'regional_monster_dwell_plus10pct') * 10;
    return 1 + pct / 100;
}

/** 출현 대기(off) 구간 배율 — 값이 작을수록 대기가 짧아짐 */
export function getRegionalMapMonsterRespawnOffMultiplierForStage(
    profile: AdventureProfile | null | undefined,
    stageId: string,
): number {
    const list = getRegionalStageBuffList(profile, stageId);
    const redPct = Math.min(50, sumStacksForKind(list, 'regional_monster_respawn_minus10pct') * 10);
    return Math.max(0.5, 1 - redPct / 100);
}

export function labelRegionalSpecialtyBuffEntry(e: AdventureRegionalSpecialtyBuffEntry): string {
    const ent = migrateRegionalBuffEntry(e);
    const st = Math.max(1, Math.floor(ent.stacks ?? 1));
    const max = getRegionalBuffMaxStacks(ent.kind);
    switch (ent.kind) {
        case 'regional_win_gold_10pct':
            return `승리 시 골드 +${st * 10}% (최대 ${max * 10}%)`;
        case 'regional_equip_drop_3pct':
            return `장비 획득 확률 +${st * 3}% (최대 ${max * 3}%)`;
        case 'regional_material_drop_5pct':
            return `재료 획득 확률 +${st * 5}% (최대 ${max * 5}%)`;
        case 'regional_capture_target_plus1':
            return `[따내기 바둑] 상대 목표 점수 +${st} (최대 +${max})`;
        case 'regional_time_limit_plus20pct':
            return `제한 시간 +${st * 20}% (최대 +${max * 20}%)`;
        case 'regional_monster_respawn_minus10pct':
            return `몬스터 출현 대기 시간 -${Math.min(50, st * 10)}% (최대 -50%)`;
        case 'regional_monster_dwell_plus10pct':
            return `몬스터 머무는 시간 +${st * 10}% (최대 +${max * 10}%)`;
        case 'regional_hidden_scan_plus1':
            return `[히든 바둑] 스캔 아이템 +${st} (최대 +${max})`;
        case 'regional_base_start_score_plus1':
            return `[베이스 바둑] 시작 시 +${st}점 (최대 +${max}점)`;
        case 'regional_classic_start_score_plus1':
            return `[클래식 바둑] 시작 시 +${st}점 (최대 +${max}점)`;
        case 'regional_missile_plus1':
            return `[미사일 바둑] 미사일 아이템 +1 (강화 불가)`;
        default:
            return '';
    }
}
