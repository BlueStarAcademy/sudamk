import { describe, expect, it } from 'vitest';
import { CoreStat, GameMode } from '../../../shared/types/enums.js';
import {
    ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID,
    applyUserProgressionArenaLocks,
    getBadukAbilitySnapshotFromStats,
    getFriendlyModeCompletions,
    isAdventureUnlockedByProgression,
    isRankedModeUnlockedForUser,
    isTowerUnlockedByProgression,
    PVP_LOBBIES_MIN_COMBINED_LEVEL,
    RANKED_MODE_FRIENDLY_UNLOCK_GAMES,
    TOWER_ENTRANCE_ADVENTURE_STAGE_ID,
} from '../../../shared/utils/contentProgressionGates.js';
import { ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS } from '../../../constants/adventureConstants.js';
import type { User } from '../../../shared/types/index.js';
import {
    ADVENTURE_CHAPTER_PRIOR_MIN_TIER_INDEX,
    isAdventureChapterUnlockedByStageIndex,
} from '../../../utils/adventureChapterUnlock.js';

const allOpen = {
    singleplayer: true,
    tower: true,
    strategicLobby: true,
    playfulLobby: true,
    pairLobby: true,
    championship: true,
    adventure: true,
    normalLobby: true,
    friendlyLobby: true,
};

const zeroStats = {
    [CoreStat.Concentration]: 0,
    [CoreStat.ThinkingSpeed]: 0,
    [CoreStat.Judgment]: 0,
    [CoreStat.Calculation]: 0,
    [CoreStat.CombatPower]: 0,
    [CoreStat.Stability]: 0,
};

function baseUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u1',
        userLevel: 1,
        clearedSinglePlayerStages: [],
        inventory: [],
        equippedPairPetTemplateId: null,
        equippedPairPetInventoryItemId: null,
        ...overrides,
    } as User;
}

describe('content progression gates', () => {
    it('allows level 1 users into PVP and AI arena lobbies', () => {
        const user = baseUser({ userLevel: 1 });
        const snap = getBadukAbilitySnapshotFromStats(user, zeroStats);
        const gated = applyUserProgressionArenaLocks(allOpen, snap);

        expect(PVP_LOBBIES_MIN_COMBINED_LEVEL).toBe(1);
        expect(gated.strategicLobby).toBe(true);
        expect(gated.playfulLobby).toBe(true);
    });

    it('locks adventure until intro-5 clear and equipped pet', () => {
        const noPet = getBadukAbilitySnapshotFromStats(
            baseUser({ clearedSinglePlayerStages: [ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID] }),
            zeroStats,
        );
        expect(isAdventureUnlockedByProgression(noPet)).toBe(false);
        expect(applyUserProgressionArenaLocks(allOpen, noPet).adventure).toBe(false);

        const withPet = getBadukAbilitySnapshotFromStats(
            baseUser({
                clearedSinglePlayerStages: [ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID],
                equippedPairPetTemplateId: 'pair-pet-1',
                equippedPairPetInventoryItemId: 'inv-1',
                inventory: [
                    {
                        id: 'inv-1',
                        name: 'pet',
                        description: '',
                        type: 'material',
                        slot: null,
                        level: 1,
                        stars: 0,
                        isEquipped: false,
                        createdAt: 0,
                        image: '/images/pets/pet1.webp',
                        grade: 'Normal' as any,
                        quantity: 1,
                        templateId: 'pair-pet-1',
                        pairPetMeta: {} as any,
                    },
                ],
            }),
            zeroStats,
        );
        expect(isAdventureUnlockedByProgression(withPet)).toBe(true);
        expect(applyUserProgressionArenaLocks(allOpen, withPet).adventure).toBe(true);
    });

    it('locks tower until neighborhood_hill understanding reaches Comfort', () => {
        const locked = getBadukAbilitySnapshotFromStats(baseUser(), zeroStats);
        expect(isTowerUnlockedByProgression(locked)).toBe(false);
        expect(applyUserProgressionArenaLocks(allOpen, locked).tower).toBe(false);

        const open = getBadukAbilitySnapshotFromStats(
            baseUser({
                adventureProfile: {
                    understandingXpByStage: {
                        [TOWER_ENTRANCE_ADVENTURE_STAGE_ID]: ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[1],
                    },
                },
            }),
            zeroStats,
        );
        expect(isTowerUnlockedByProgression(open)).toBe(true);
        expect(applyUserProgressionArenaLocks(allOpen, open).tower).toBe(true);
    });
});

describe('adventure chapter unlock', () => {
    it('opens chapter 1 at user level 1', () => {
        expect(
            isAdventureChapterUnlockedByStageIndex(1, {
                strategyLevel: 1,
                isAdmin: false,
                understandingXpByStage: {},
            }),
        ).toBe(true);
    });

    it('requires Familiar (tier 2) prior understanding for chapter 2', () => {
        expect(ADVENTURE_CHAPTER_PRIOR_MIN_TIER_INDEX).toBe(2);
        expect(
            isAdventureChapterUnlockedByStageIndex(2, {
                strategyLevel: 4,
                isAdmin: false,
                understandingXpByStage: {
                    neighborhood_hill: ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[1],
                },
            }),
        ).toBe(false);
        expect(
            isAdventureChapterUnlockedByStageIndex(2, {
                strategyLevel: 4,
                isAdmin: false,
                understandingXpByStage: {
                    neighborhood_hill: ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[2],
                },
            }),
        ).toBe(true);
    });

    it('unlocks Uniform/Castle/Chess in ranked after 5 friendly or training-machine completions', () => {
        expect(RANKED_MODE_FRIENDLY_UNLOCK_GAMES).toBe(5);
        const locked = baseUser({ stats: { [GameMode.Uniform]: { wins: 0, losses: 0, friendlyCompletions: 4 } } });
        expect(getFriendlyModeCompletions(locked, GameMode.Uniform)).toBe(4);
        expect(isRankedModeUnlockedForUser(locked, GameMode.Uniform)).toBe(false);
        expect(isRankedModeUnlockedForUser(locked, GameMode.Standard)).toBe(true);

        const unlocked = baseUser({ stats: { [GameMode.Castle]: { wins: 1, losses: 0, friendlyCompletions: 5 } } });
        expect(isRankedModeUnlockedForUser(unlocked, GameMode.Castle)).toBe(true);

        const admin = baseUser({ isAdmin: true, stats: {} });
        expect(isRankedModeUnlockedForUser(admin, GameMode.Chess)).toBe(true);
    });
});
