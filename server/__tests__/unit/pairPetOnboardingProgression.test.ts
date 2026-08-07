import { describe, expect, it } from 'vitest';
import {
    adventureCompanionFlatScoreBonusFromPetMeta,
} from '../../../shared/utils/adventureCompanion.js';
import { effectiveAdventureAttackApCostForUser } from '../../../shared/utils/pairPetArenaApDiscount.js';
import {
    hasCompletedPetEquipStep,
    hasCompletedPetHintStep,
    hasCompletedTrainingStep,
    markPairPetOnboardingEquipped,
    markPairPetOnboardingPetHintPlaced,
    markPairPetOnboardingTrainingStarted,
    resolvePairPetOnboardingStep,
} from '../../../shared/utils/pairPetOnboarding.js';
import { PAIR_TRAINING_UNLOCK_WINS } from '../../../shared/constants/pairTraining.js';
import type { User } from '../../../shared/types/index.js';

function baseUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u1',
        inventory: [],
        pairPetOnboarding: {},
        ...overrides,
    } as User;
}

describe('pair pet onboarding', () => {
    it('starts at equip and advances through hint then training', () => {
        const u = baseUser();
        expect(resolvePairPetOnboardingStep(u)).toBe('equip');
        markPairPetOnboardingEquipped(u);
        expect(hasCompletedPetEquipStep(u)).toBe(true);
        expect(resolvePairPetOnboardingStep(u)).toBe('petHint');
        markPairPetOnboardingPetHintPlaced(u);
        expect(hasCompletedPetHintStep(u)).toBe(true);
        expect(resolvePairPetOnboardingStep(u)).toBe('training');
        markPairPetOnboardingTrainingStarted(u);
        expect(hasCompletedTrainingStep(u)).toBe(true);
        expect(resolvePairPetOnboardingStep(u)).toBe('done');
    });

    it('unlocks skill training slot at 0 pair wins', () => {
        expect(PAIR_TRAINING_UNLOCK_WINS[0]).toBe(0);
    });
});

describe('adventure companion', () => {
    it('scales flat score bonus by pet level', () => {
        expect(adventureCompanionFlatScoreBonusFromPetMeta({ level: 1 } as any)).toBe(0);
        expect(adventureCompanionFlatScoreBonusFromPetMeta({ level: 10 } as any)).toBe(1);
        expect(adventureCompanionFlatScoreBonusFromPetMeta({ level: 25 } as any)).toBe(2);
        expect(adventureCompanionFlatScoreBonusFromPetMeta({ level: 40 } as any)).toBe(3);
    });

    it('applies strategic AP-1 specialization to adventure attack cost', () => {
        const user = baseUser({
            equippedPairPetTemplateId: 'pair-pet-1',
            equippedPairPetInventoryItemId: 'inv-1',
            inventory: [
                {
                    id: 'inv-1',
                    name: 'pet',
                    description: '',
                    type: 'material',
                    slot: null,
                    level: 10,
                    stars: 0,
                    isEquipped: false,
                    createdAt: 0,
                    image: '/images/pets/pet1.webp',
                    grade: 'Normal' as any,
                    quantity: 1,
                    templateId: 'pair-pet-1',
                    pairPetMeta: {
                        level: 10,
                        xp: 0,
                        grade: 'Normal',
                        specialization: { kind: 'strategicArenaApMinusOne' },
                    } as any,
                },
            ],
        });
        expect(effectiveAdventureAttackApCostForUser(user, 3)).toBe(2);
    });
});
