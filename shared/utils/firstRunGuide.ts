import type { InventoryItem, User } from '../types/entities.js';
import {
    hatcheryEndsAt,
    normalizePairPetHatcherySessions,
} from '../constants/pairHatchery.js';
import { isPairEggItem, isPairPetMaterial } from '../constants/petLobby.js';
import {
    countOwnedPairPets,
    getPairPetOnboarding,
    hasCompletedPetEquipStep,
} from './pairPetOnboarding.js';

export const FIRST_RUN_WALKTHROUGH_GUIDE_ID = 'first_run_walkthrough' as const;
export const FIRST_RUN_FIRST_STAGE_ID = '입문-1';

export const FIRST_RUN_SUPPRESSED_SCREEN_GUIDE_IDS = [
    'home',
    'petManagement',
    'singlePlayerAcademy',
] as const;

export type FirstRunGuideAnchorId =
    | 'quick-pet'
    | 'hatchery-slot'
    | 'hatchery-start'
    | 'hatchery-confirm'
    | 'hatchery-claim'
    | 'equip-rep'
    | 'home-stage'
    | 'sp-stage-입문-1'
    | 'sp-stage-enter';

export type FirstRunGuideProgress =
    | 'done'
    | 'needHatch'
    | 'hatching'
    | 'claimReady'
    | 'needEquip'
    | 'needAdventure';

export type FirstRunGuideStep =
    | 'welcome'
    | 'openPet'
    | 'startHatch'
    | 'confirmHatch'
    | 'waitHatch'
    | 'claimPet'
    | 'equipPet'
    | 'openAdventure'
    | 'selectFirstStage'
    | 'startFirstStage'
    | 'done';

export type FirstRunGuideUser = Pick<
    User,
    | 'nickname'
    | 'inventory'
    | 'equippedPairPetTemplateId'
    | 'equippedPairPetInventoryItemId'
    | 'pairPetTrainingSlots'
    | 'pairPetHatcherySessions'
    | 'pairPetOnboarding'
    | 'dismissedScreenGuides'
    | 'clearedSinglePlayerStages'
>;

export type FirstRunGuideUiContext = {
    welcomeAcknowledged: boolean;
    petPanelOpen: boolean;
    hatchConfirmOpen: boolean;
    obtainModalOpen: boolean;
    singlePlayerLobbyOpen: boolean;
    selectedStageId: string | null;
    now: number;
};

function hasRealNickname(user: Pick<FirstRunGuideUser, 'nickname'>): boolean {
    const nick = user.nickname;
    return typeof nick === 'string' && nick.length > 0 && !nick.startsWith('user_');
}

function hasAnyClearedSinglePlayerStage(user: Pick<FirstRunGuideUser, 'clearedSinglePlayerStages'>): boolean {
    return Array.isArray(user.clearedSinglePlayerStages) && user.clearedSinglePlayerStages.length > 0;
}

function isWalkthroughDismissed(user: Pick<FirstRunGuideUser, 'dismissedScreenGuides'>): boolean {
    const guides = Array.isArray(user.dismissedScreenGuides) ? user.dismissedScreenGuides : [];
    return guides.includes(FIRST_RUN_WALKTHROUGH_GUIDE_ID);
}

export function isFirstRunGuideComplete(user: FirstRunGuideUser): boolean {
    const ob = getPairPetOnboarding(user);
    if (ob.walkthroughCompletedAt) return true;
    if (isWalkthroughDismissed(user)) return true;
    if (hasAnyClearedSinglePlayerStage(user)) return true;
    return false;
}

function hasHatchableEgg(user: Pick<FirstRunGuideUser, 'inventory'>): boolean {
    return (user.inventory ?? []).some((it) => isPairEggItem(it) && (it.quantity ?? 1) >= 1);
}

function activeHatcherySessions(user: Pick<FirstRunGuideUser, 'pairPetHatcherySessions'>) {
    return normalizePairPetHatcherySessions(user.pairPetHatcherySessions).filter(
        (s): s is NonNullable<typeof s> => s != null,
    );
}

export function firstUnequippedPairPet(
    user: Pick<FirstRunGuideUser, 'inventory' | 'equippedPairPetInventoryItemId'>,
): InventoryItem | null {
    const equippedId = user.equippedPairPetInventoryItemId ?? null;
    for (const it of user.inventory ?? []) {
        if (!isPairPetMaterial(it) || isPairEggItem(it) || (it.quantity ?? 1) < 1) continue;
        if (equippedId && it.id === equippedId) continue;
        return it;
    }
    return null;
}

export function resolveFirstRunGuideProgress(
    user: FirstRunGuideUser,
    now = Date.now(),
): FirstRunGuideProgress {
    if (!hasRealNickname(user) || isFirstRunGuideComplete(user)) return 'done';
    if (hasCompletedPetEquipStep(user)) return 'needAdventure';
    if (countOwnedPairPets(user) > 0) return 'needEquip';

    const sessions = activeHatcherySessions(user);
    if (sessions.length > 0) {
        const claimReady = sessions.some(
            (session) => now >= hatcheryEndsAt(session.startedAt, session.slotIndex, session, user),
        );
        return claimReady ? 'claimReady' : 'hatching';
    }
    if (hasHatchableEgg(user)) return 'needHatch';
    return 'done';
}

export function isFirstRunGuideEligible(user: FirstRunGuideUser | null | undefined): boolean {
    if (!user) return false;
    return resolveFirstRunGuideProgress(user) !== 'done';
}

export function shouldSuppressScreenGuideForFirstRun(
    guideId: string,
    user: FirstRunGuideUser | null | undefined,
): boolean {
    if (!user) return false;
    if (!FIRST_RUN_SUPPRESSED_SCREEN_GUIDE_IDS.includes(guideId as (typeof FIRST_RUN_SUPPRESSED_SCREEN_GUIDE_IDS)[number])) {
        return false;
    }
    return isFirstRunGuideEligible(user);
}

export function resolveFirstRunGuideStep(
    user: FirstRunGuideUser | null | undefined,
    ui: FirstRunGuideUiContext,
): FirstRunGuideStep {
    if (!user) return 'done';
    const progress = resolveFirstRunGuideProgress(user, ui.now);
    if (progress === 'done') return 'done';

    if (progress === 'needAdventure') {
        if (!ui.singlePlayerLobbyOpen) return 'openAdventure';
        if (ui.selectedStageId !== FIRST_RUN_FIRST_STAGE_ID) return 'selectFirstStage';
        return 'startFirstStage';
    }

    if (progress === 'needEquip') {
        return 'equipPet';
    }

    if (progress === 'claimReady') {
        if (!ui.petPanelOpen) return 'openPet';
        return 'claimPet';
    }

    if (progress === 'hatching') {
        if (!ui.petPanelOpen) return 'openPet';
        return 'waitHatch';
    }

    if (!ui.welcomeAcknowledged && !ui.petPanelOpen) return 'welcome';
    if (!ui.petPanelOpen) return 'openPet';
    if (ui.hatchConfirmOpen) return 'confirmHatch';
    return 'startHatch';
}

export function firstRunGuideAnchorForStep(step: FirstRunGuideStep): FirstRunGuideAnchorId | null {
    switch (step) {
        case 'openPet':
            return 'quick-pet';
        case 'startHatch':
            return 'hatchery-start';
        case 'confirmHatch':
            return 'hatchery-confirm';
        case 'waitHatch':
            return 'hatchery-slot';
        case 'claimPet':
            return 'hatchery-claim';
        case 'equipPet':
            return 'equip-rep';
        case 'openAdventure':
            return 'home-stage';
        case 'selectFirstStage':
            return 'sp-stage-입문-1';
        case 'startFirstStage':
            return 'sp-stage-enter';
        default:
            return null;
    }
}
