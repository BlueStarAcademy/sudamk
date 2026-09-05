import { describe, expect, it } from 'vitest';
import { PAIR_WELCOME_EGG_TEMPLATE_ID } from '../../../shared/constants/petLobby.js';
import { PAIR_WELCOME_EGG_HATCH_DURATION_MS } from '../../../shared/constants/pairHatchery.js';
import {
    FIRST_RUN_FIRST_STAGE_ID,
    FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS,
    FIRST_RUN_WALKTHROUGH_GUIDE_ID,
    firstRunGuideAnchorForStep,
    isFirstRunGuideComplete,
    isFirstRunGuideEligible,
    resolveFirstRunGuideProgress,
    resolveFirstRunGuideStep,
    shouldSuppressScreenGuideForFirstRun,
    type FirstRunGuideUiContext,
    type FirstRunGuideUser,
} from '../../../shared/utils/firstRunGuide.js';
import { markPairPetOnboardingWalkthroughCompleted } from '../../../shared/utils/pairPetOnboarding.js';
import type { InventoryItem, User } from '../../../shared/types/index.js';

function egg(id: string, welcome = true): InventoryItem {
    return {
        id,
        name: welcome ? '(특)신비로운 알' : '신비로운알',
        description: '',
        type: 'material',
        slot: null,
        level: 1,
        stars: 0,
        isEquipped: false,
        createdAt: 0,
        image: '/images/pets/egg-special.webp',
        grade: 'Normal' as InventoryItem['grade'],
        quantity: 1,
        templateId: welcome ? PAIR_WELCOME_EGG_TEMPLATE_ID : 'pair-egg-mystery',
    };
}

function pet(id: string): InventoryItem {
    return {
        id,
        name: 'pet',
        description: '',
        type: 'material',
        slot: null,
        level: 10,
        stars: 0,
        isEquipped: false,
        createdAt: 0,
        image: '/images/pets/pet1.webp',
        grade: 'Normal' as InventoryItem['grade'],
        quantity: 1,
        templateId: 'pair-pet-1',
    };
}

function user(overrides: Partial<FirstRunGuideUser> = {}): FirstRunGuideUser {
    return {
        nickname: '초보',
        inventory: [egg('egg-1')],
        pairPetOnboarding: {},
        dismissedScreenGuides: [],
        clearedSinglePlayerStages: [],
        ...overrides,
    };
}

const ui = (overrides: Partial<FirstRunGuideUiContext> = {}): FirstRunGuideUiContext => ({
    welcomeAcknowledged: false,
    petPanelOpen: false,
    hatchConfirmOpen: false,
    obtainModalOpen: false,
    singlePlayerLobbyOpen: false,
    selectedStageId: null,
    inSinglePlayerGame: false,
    gameStatusPlaying: false,
    petHintOverlayActive: false,
    pveBlockingModalOpen: false,
    now: 1_000,
    ...overrides,
});

describe('first run guide progress', () => {
    it('starts at needHatch for a nicknamed user with a welcome egg', () => {
        expect(resolveFirstRunGuideProgress(user())).toBe('needHatch');
        expect(isFirstRunGuideEligible(user())).toBe(true);
    });

    it('ignores temporary nicknames', () => {
        expect(resolveFirstRunGuideProgress(user({ nickname: 'user_ab12cd34' }))).toBe('done');
    });

    it('treats existing academy progress as complete', () => {
        expect(resolveFirstRunGuideProgress(user({ clearedSinglePlayerStages: ['입문-1'] }))).toBe('done');
        expect(isFirstRunGuideComplete(user({ clearedSinglePlayerStages: ['입문-1'] }))).toBe(true);
    });

    it('treats dismissed walkthrough as complete', () => {
        expect(
            resolveFirstRunGuideProgress(user({ dismissedScreenGuides: [FIRST_RUN_WALKTHROUGH_GUIDE_ID] })),
        ).toBe('done');
    });

    it('advances through hatch wait, claim, equip, then adventure', () => {
        const startedAt = 1_000;
        const hatching = user({
            inventory: [],
            pairPetHatcherySessions: [
                { slotIndex: 0, startedAt, eggTemplateId: PAIR_WELCOME_EGG_TEMPLATE_ID },
            ],
        });
        expect(resolveFirstRunGuideProgress(hatching, startedAt + 1_000)).toBe('hatching');
        expect(
            resolveFirstRunGuideProgress(hatching, startedAt + PAIR_WELCOME_EGG_HATCH_DURATION_MS),
        ).toBe('claimReady');

        const hatched = user({ inventory: [pet('p1')] });
        expect(resolveFirstRunGuideProgress(hatched)).toBe('needEquip');

        const equipped = user({
            inventory: [pet('p1')],
            equippedPairPetTemplateId: 'pair-pet-1',
            equippedPairPetInventoryItemId: 'p1',
        });
        expect(resolveFirstRunGuideProgress(equipped)).toBe('needAdventure');
    });

    it('completes when walkthroughCompletedAt is set', () => {
        const u = user() as User;
        markPairPetOnboardingWalkthroughCompleted(u, 50);
        expect(isFirstRunGuideComplete(u)).toBe(true);
        expect(resolveFirstRunGuideProgress(u)).toBe('done');
    });
});

describe('first run guide steps', () => {
    it('walks hatch UI from welcome to confirm', () => {
        const u = user();
        expect(resolveFirstRunGuideStep(u, ui())).toBe('welcome');
        expect(resolveFirstRunGuideStep(u, ui({ welcomeAcknowledged: true }))).toBe('openPet');
        expect(resolveFirstRunGuideStep(u, ui({ welcomeAcknowledged: true, petPanelOpen: true }))).toBe('startHatch');
        expect(
            resolveFirstRunGuideStep(u, ui({ welcomeAcknowledged: true, petPanelOpen: true, hatchConfirmOpen: true })),
        ).toBe('confirmHatch');
    });

    it('spotlights claim then equip then academy', () => {
        const hatching = user({
            inventory: [],
            pairPetHatcherySessions: [
                {
                    slotIndex: 0,
                    startedAt: 1_000,
                    eggTemplateId: PAIR_WELCOME_EGG_TEMPLATE_ID,
                },
            ],
        });
        expect(
            resolveFirstRunGuideStep(hatching, ui({ petPanelOpen: true, now: 1_000 + PAIR_WELCOME_EGG_HATCH_DURATION_MS })),
        ).toBe('claimPet');
        expect(
            resolveFirstRunGuideStep(hatching, ui({ petPanelOpen: false, now: 1_000 + PAIR_WELCOME_EGG_HATCH_DURATION_MS })),
        ).toBe('openPet');

        const hatched = user({ inventory: [pet('p1')] });
        expect(resolveFirstRunGuideStep(hatched, ui({ obtainModalOpen: true }))).toBe('equipPet');

        const equipped = user({
            inventory: [pet('p1')],
            equippedPairPetTemplateId: 'pair-pet-1',
            equippedPairPetInventoryItemId: 'p1',
        });
        expect(resolveFirstRunGuideStep(equipped, ui())).toBe('openAdventure');
        expect(resolveFirstRunGuideStep(equipped, ui({ singlePlayerLobbyOpen: true }))).toBe('selectFirstStage');
        expect(
            resolveFirstRunGuideStep(
                equipped,
                ui({ singlePlayerLobbyOpen: true, selectedStageId: FIRST_RUN_FIRST_STAGE_ID }),
            ),
        ).toBe('startFirstStage');
        expect(firstRunGuideAnchorForStep('startFirstStage')).toBe('sp-stage-enter');

        expect(
            resolveFirstRunGuideStep(equipped, ui({ inSinglePlayerGame: true, gameStatusPlaying: false })),
        ).toBe('waitGameReady');
        expect(
            resolveFirstRunGuideStep(
                equipped,
                ui({ inSinglePlayerGame: true, gameStatusPlaying: true, pveBlockingModalOpen: true }),
            ),
        ).toBe('waitGameReady');
        expect(
            resolveFirstRunGuideStep(equipped, ui({ inSinglePlayerGame: true, gameStatusPlaying: true })),
        ).toBe('pressPetHint');
        expect(firstRunGuideAnchorForStep('pressPetHint')).toBe('pet-hint-button');
        expect(
            resolveFirstRunGuideStep(
                equipped,
                ui({ inSinglePlayerGame: true, gameStatusPlaying: true, petHintOverlayActive: true }),
            ),
        ).toBe('placePetHint');
        expect(firstRunGuideAnchorForStep('placePetHint')).toBe('pet-hint-board');
    });

    it('suppresses overlapping screen guides while the walkthrough is active', () => {
        expect(shouldSuppressScreenGuideForFirstRun('home', user())).toBe(true);
        expect(shouldSuppressScreenGuideForFirstRun('petManagement', user())).toBe(true);
        expect(shouldSuppressScreenGuideForFirstRun('tower', user())).toBe(false);
        expect(shouldSuppressScreenGuideForFirstRun('home', user({ clearedSinglePlayerStages: ['입문-1'] }))).toBe(false);
    });

    it('lists the admin sequence-preview steps in walkthrough order', () => {
        expect([...FIRST_RUN_GUIDE_SEQUENCE_PREVIEW_STEPS]).toEqual([
            'welcome',
            'openPet',
            'startHatch',
            'confirmHatch',
            'waitHatch',
            'claimPet',
            'equipPet',
            'openAdventure',
            'selectFirstStage',
            'startFirstStage',
            'pressPetHint',
            'placePetHint',
        ]);
    });
});
