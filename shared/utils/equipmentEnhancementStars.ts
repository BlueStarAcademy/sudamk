import type { InventoryItem } from '../types/entities.js';
import { ItemGrade, CoreStat } from '../types/enums.js';
import { MAIN_ENHANCEMENT_STEP_MULTIPLIER, CORE_STATS_DATA } from '../constants/index.js';
import { applySuccessfulEnhancementTick, getEnhancementStepBonusMultiplier } from './equipmentEnhancementTick.js';

/** 관리자·API 페이로드 등에서 강화 단계(0~10) 정수로 정규화 (문자열 등 대응) */
export function parseEquipmentStarsFromPayload(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.floor(n)));
}

export function isMailAttachmentEquipment(item: InventoryItem): boolean {
    if (item.type === 'equipment') return true;
    if (item.type === 'consumable' || item.type === 'material') return false;
    return item.slot != null;
}

/** 문자열 → 32비트 시드 (결정론 강화 롤용) */
export function hashStringToSeed32(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** 동일 시드 키 → 재현 가능한 [0,1) 난수 스트림 (관리자 우편·수령 보정용) */
export function createSeededRandom(seedKey: string): () => number {
    let state = hashStringToSeed32(seedKey) || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export type ApplyEnhancementStarsOptions = {
    /** 기본 Math.random. 관리자 우편 등에서는 createSeededRandom 권장 */
    rng?: () => number;
};

/**
 * +0 상태(템플릿에서 막 생성된 주옵·부옵·특수·신화)에서 시작해, ENHANCE_ITEM 성공과 동일한 틱을 `stars`번 순서대로 적용.
 * 주옵은 매 틱마다 인게임과 같이 누적 증가한다.
 */
export function applyEnhancementStarsToEquipmentItem(
    item: InventoryItem,
    stars: number,
    options?: ApplyEnhancementStarsOptions
): void {
    if (!isMailAttachmentEquipment(item) || !item.options?.main?.baseValue) return;
    const clamped = Math.max(0, Math.min(10, Math.floor(Number(stars)) || 0));
    const rng = options?.rng ?? Math.random;

    const main = item.options.main;
    const baseValue = Number(main.baseValue);
    if (!Number.isFinite(baseValue)) return;
    const statName = CORE_STATS_DATA[main.type as CoreStat]?.name || main.type;

    item.stars = 0;
    main.value = baseValue;
    main.display = `${statName} +${main.value}${main.isPercentage ? '%' : ''}`;

    for (let n = 0; n < clamped; n++) {
        applySuccessfulEnhancementTick(item, rng);
    }

    main.display = `${statName} +${main.value}${main.isPercentage ? '%' : ''}`;
}

/** +0~+10 주옵 기대값 (MAIN_ENHANCEMENT_STEP_MULTIPLIER·단계 보너스와 동일) */
export function computeEnhancedMainValueAtStars(baseValue: number, grade: ItemGrade, stars: number): number {
    const s = Math.max(0, Math.min(10, Math.floor(stars)));
    const multipliers = MAIN_ENHANCEMENT_STEP_MULTIPLIER[grade];
    let enhancedIncreaseTotal = 0;
    for (let i = 0; i < s; i++) {
        const idx = Math.max(0, Math.min(9, i));
        const stepBonusMultiplier = getEnhancementStepBonusMultiplier(i + 1);
        enhancedIncreaseTotal += Math.round(baseValue * (multipliers?.[idx] ?? 1)) * stepBonusMultiplier;
    }
    return parseFloat((baseValue + enhancedIncreaseTotal).toFixed(2));
}

/**
 * 주옵션이 이미 `stars`에 맞게 강화된 값인지 (우편 수령 시 부옵션 이중 적용 방지용)
 */
export function isEquipmentMainAlreadyEnhancedForStars(item: InventoryItem): boolean {
    const main = item.options?.main;
    if (!main?.baseValue || main.value == null || Number.isNaN(Number(main.value))) return false;
    const starCount = Math.max(0, Math.min(10, Math.floor(Number(item.stars ?? 0))));
    if (starCount <= 0) return false;
    const expected = computeEnhancedMainValueAtStars(main.baseValue, item.grade ?? ItemGrade.Normal, starCount);
    const current = Number(main.value);
    return Math.abs(current - expected) < 0.51;
}

/** 주옵션 수치로부터 강화 단계(0~10) 역추정 (직렬화 등으로 stars 필드가 없을 때) */
export function inferStarsFromEquipmentMain(item: InventoryItem): number | null {
    const main = item.options?.main;
    if (!main?.baseValue || main.value == null || Number.isNaN(Number(main.value))) return null;
    const baseValue = main.baseValue;
    const current = Number(main.value);
    const grade = item.grade ?? ItemGrade.Normal;
    for (let s = 0; s <= 10; s++) {
        const v = computeEnhancedMainValueAtStars(baseValue, grade, s);
        if (Math.abs(v - current) < 0.51) return s;
    }
    return null;
}

/** 우편 첨부 UI용: stars 필드 우선, 없으면 주옵션으로 역추정 */
export function getMailEquipmentDisplayStars(item: InventoryItem): number {
    if (!isMailAttachmentEquipment(item)) return 0;
    const raw = item.stars;
    if (raw != null && Number.isFinite(Number(raw))) {
        return Math.max(0, Math.min(10, Math.floor(Number(raw))));
    }
    return inferStarsFromEquipmentMain(item) ?? 0;
}
