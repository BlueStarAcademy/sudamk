import type { User } from '../types/entities.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';
import { isPairEggItem, isPairPetMaterial } from '../constants/petLobby.js';
import { normalizePairPetTrainingSlots } from '../constants/pairTraining.js';

export type PairPetOnboardingState = {
    /** 대표펫 최초 장착 시각 */
    equippedAt?: number | null;
    /** 펫 힌트 자리 착점 완료 시각 */
    petHintPlacedAt?: number | null;
    /** 기술수련(슬롯0) 파견 완료 시각 */
    trainingStartedAt?: number | null;
};

export type PairPetOnboardingStep = 'equip' | 'petHint' | 'training' | 'done';

export function normalizePairPetOnboarding(raw: unknown): PairPetOnboardingState {
    if (!raw || typeof raw !== 'object') return {};
    const o = raw as Record<string, unknown>;
    const num = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    };
    return {
        equippedAt: num(o.equippedAt),
        petHintPlacedAt: num(o.petHintPlacedAt),
        trainingStartedAt: num(o.trainingStartedAt),
    };
}

export function getPairPetOnboarding(user: Pick<User, 'pairPetOnboarding'>): PairPetOnboardingState {
    return normalizePairPetOnboarding(user.pairPetOnboarding);
}

/** 장착 플래그가 없어도 실제 대표펫이 있으면 equipped로 간주 */
export function hasCompletedPetEquipStep(user: Pick<User, 'pairPetOnboarding' | 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId' | 'pairPetTrainingSlots'>): boolean {
    const ob = getPairPetOnboarding(user);
    if (ob.equippedAt) return true;
    return getEquippedPairPetInventoryRow(user) != null;
}

export function hasCompletedPetHintStep(user: Pick<User, 'pairPetOnboarding' | 'dismissedScreenGuides'>): boolean {
    const ob = getPairPetOnboarding(user);
    if (ob.petHintPlacedAt) return true;
    const guides = Array.isArray(user.dismissedScreenGuides) ? user.dismissedScreenGuides : [];
    return guides.includes('sp_tutorial_pet_hint');
}

export function hasCompletedTrainingStep(user: Pick<User, 'pairPetOnboarding' | 'pairPetTrainingSlots'>): boolean {
    const ob = getPairPetOnboarding(user);
    if (ob.trainingStartedAt) return true;
    const slots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
    return slots.some((s) => s != null);
}

export function resolvePairPetOnboardingStep(
    user: Pick<
        User,
        | 'pairPetOnboarding'
        | 'inventory'
        | 'equippedPairPetTemplateId'
        | 'equippedPairPetInventoryItemId'
        | 'pairPetTrainingSlots'
        | 'dismissedScreenGuides'
    >,
): PairPetOnboardingStep {
    if (!hasCompletedPetEquipStep(user)) return 'equip';
    if (!hasCompletedPetHintStep(user)) return 'petHint';
    if (!hasCompletedTrainingStep(user)) return 'training';
    return 'done';
}

export function countOwnedPairPets(
    user: Pick<User, 'inventory'>,
): number {
    return (user.inventory ?? []).filter(
        (it) => isPairPetMaterial(it) && !isPairEggItem(it) && (it.quantity ?? 1) >= 1,
    ).length;
}

export function markPairPetOnboardingEquipped(user: User, at = Date.now()): void {
    const cur = getPairPetOnboarding(user);
    if (cur.equippedAt) return;
    user.pairPetOnboarding = { ...cur, equippedAt: at };
}

export function markPairPetOnboardingPetHintPlaced(user: User, at = Date.now()): void {
    const cur = getPairPetOnboarding(user);
    if (cur.petHintPlacedAt) return;
    user.pairPetOnboarding = { ...cur, petHintPlacedAt: at };
}

export function markPairPetOnboardingTrainingStarted(user: User, at = Date.now()): void {
    const cur = getPairPetOnboarding(user);
    if (cur.trainingStartedAt) return;
    user.pairPetOnboarding = { ...cur, trainingStartedAt: at };
}
