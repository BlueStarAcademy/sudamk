import { SinglePlayerStageInfo, GameMode, Player, SinglePlayerLevel, SinglePlayerMissionInfo } from '../types/index.js';
import {
    buildMissionLevels,
    type FacilityTierParams,
} from '../utils/trainingQuestEconomy.js';

/** 반별 스테이지 클리어 수(10·20) 막대그래프에서 별도 수령하는 보상 */
export const SINGLE_PLAYER_CLASS_BAR_REWARDS: Record<
    SinglePlayerLevel,
    { milestone10: { itemId: string; quantity: number }; milestone20: { itemId: string; quantity: number } }
> = {
    [SinglePlayerLevel.입문]: {
        milestone10: { itemId: '장비 상자 II', quantity: 1 },
        milestone20: { itemId: '재료 상자 II', quantity: 1 },
    },
    [SinglePlayerLevel.초급]: {
        milestone10: { itemId: '행동력 회복제(+10)', quantity: 1 },
        milestone20: { itemId: '골드 꾸러미 I', quantity: 1 },
    },
    [SinglePlayerLevel.중급]: {
        milestone10: { itemId: '행동력 회복제(+20)', quantity: 1 },
        milestone20: { itemId: '다이아 꾸러미 II', quantity: 1 },
    },
    [SinglePlayerLevel.고급]: {
        milestone10: { itemId: '장비 상자 III', quantity: 1 },
        milestone20: { itemId: '재료 상자 III', quantity: 1 },
    },
    [SinglePlayerLevel.유단자]: {
        milestone10: { itemId: '행동력 회복제(+30)', quantity: 1 },
        milestone20: { itemId: '다이아 꾸러미 III', quantity: 1 },
    },
};

/** 생산소 카드 아트 — `public/images/factory/` */
const FACTORY_ART = {
    sprout: '/images/factory/factory-sprout.png',
    lifeTree: '/images/factory/factory-life-tree.png',
    runeCrucible: '/images/factory/factory-rune-crucible.png',
    relicVault: '/images/factory/factory-relic-vault.png',
    starSpring: '/images/factory/factory-star-spring.png',
    crystalGarden: '/images/factory/factory-crystal-garden.png',
    dragonAltar: '/images/factory/factory-dragon-altar.png',
    celestialSanctum: '/images/factory/factory-celestial-sanctum.png',
} as const;

/** 아이템/다이아 시설 보관 계단 (Lv1..10) */
const CYCLE_CAP_STONE = [1, 1, 1, 2, 2, 2, 2, 3, 3, 4] as const;
const CYCLE_CAP_BOX = [1, 1, 1, 2, 2, 2, 2, 3, 3, 4] as const;
const CYCLE_CAP_DRAGON = [2, 2, 2, 3, 3, 3, 3, 4, 4, 4] as const;
const CYCLE_CAP_CELESTIAL = [3, 3, 3, 4, 4, 4, 4, 5, 5, 5] as const;

/** 강화석 — Lv1 90분 → Lv10 약 52분 */
const STONE_INTERVALS = [90, 87, 84, 81, 78, 75, 70, 66, 61, 52] as const;
/** 장비 상자 — Lv1 135분 → Lv10 약 75분 */
const BOX_INTERVALS = [135, 129, 123, 117, 111, 105, 99, 93, 87, 75] as const;

export const FACILITY_TIER_PARAMS: FacilityTierParams[] = [
    {
        id: 'mission_attendance',
        name: '생명의 새싹',
        description: '이슬을 머금은 첫 새싹이 숨 쉬는 곳',
        unlockUserLevel: 2,
        rewardType: 'gold',
        image: FACTORY_ART.sprout,
        tier: 1,
        tierGoldBase: 8,
        baseIntervalMin: 15,
        baseAmount: 5,
        baseCap: 40,
    },
    {
        id: 'mission_complete_game',
        name: '생명의 나무',
        description: '세계를 떠받드는 고대의 거목',
        unlockUserLevel: 4,
        rewardType: 'gold',
        image: FACTORY_ART.lifeTree,
        tier: 2,
        tierGoldBase: 20,
        baseIntervalMin: 15,
        baseAmount: 12,
        baseCap: 120,
    },
    {
        id: 'mission_enhance_stone',
        name: '룬의 도가니',
        description: '마력이 끓는 제련 도가니에서 강화석이 응결된다',
        unlockUserLevel: 7,
        rewardType: 'enhance_stone',
        image: FACTORY_ART.runeCrucible,
        tier: 3,
        tierGoldBase: 35,
        baseIntervalMin: 90,
        baseAmount: 1,
        baseCap: 1,
        capByLevel: CYCLE_CAP_STONE,
        intervalByLevel: STONE_INTERVALS,
    },
    {
        id: 'mission_equipment_box',
        name: '유물의 궤실',
        description: '봉인된 고대 궤짝이 쌓인 비밀 창고',
        unlockUserLevel: 10,
        rewardType: 'equipment_box',
        image: FACTORY_ART.relicVault,
        tier: 4,
        tierGoldBase: 50,
        baseIntervalMin: 135,
        baseAmount: 1,
        baseCap: 1,
        capByLevel: CYCLE_CAP_BOX,
        intervalByLevel: BOX_INTERVALS,
    },
    {
        id: 'mission_rival_match',
        name: '별빛 샘',
        description: '별이 스며든 맑은 샘물이 고이는 곳',
        unlockUserLevel: 13,
        rewardType: 'gold',
        image: FACTORY_ART.starSpring,
        tier: 5,
        tierGoldBase: 70,
        baseIntervalMin: 15,
        baseAmount: 25,
        baseCap: 280,
    },
    {
        id: 'mission_study_joseki',
        name: '수정 정원',
        description: '영롱한 결정이 피어나는 비밀 정원',
        unlockUserLevel: 16,
        rewardType: 'gold',
        image: FACTORY_ART.crystalGarden,
        tier: 6,
        tierGoldBase: 100,
        baseIntervalMin: 15,
        baseAmount: 55,
        baseCap: 480,
    },
    {
        id: 'mission_league',
        name: '용의 제단',
        description: '고대 용이 잠든 불멸의 제단',
        unlockUserLevel: 20,
        rewardType: 'diamonds',
        image: FACTORY_ART.dragonAltar,
        tier: 7,
        tierGoldBase: 140,
        baseIntervalMin: 90,
        baseAmount: 1,
        baseCap: 2,
        capByLevel: CYCLE_CAP_DRAGON,
    },
    {
        id: 'mission_ai_match',
        name: '천상의 성역',
        description: '하늘과 맞닿은 신성한 성역',
        unlockUserLevel: 25,
        rewardType: 'diamonds',
        image: FACTORY_ART.celestialSanctum,
        tier: 8,
        tierGoldBase: 200,
        baseIntervalMin: 80,
        baseAmount: 1,
        baseCap: 3,
        capByLevel: CYCLE_CAP_CELESTIAL,
    },
];

function toMissionInfo(params: FacilityTierParams): SinglePlayerMissionInfo {
    return {
        id: params.id,
        name: params.name,
        description: params.description,
        unlockUserLevel: params.unlockUserLevel,
        rewardType: params.rewardType,
        image: params.image,
        levels: buildMissionLevels(params),
        baseCap: params.baseCap,
        tierGoldBase: params.tierGoldBase,
        tier: params.tier,
    };
}

export const SINGLE_PLAYER_MISSIONS: SinglePlayerMissionInfo[] = FACILITY_TIER_PARAMS.map(toMissionInfo);


export const SINGLE_PLAYER_STAGES_BASE: SinglePlayerStageInfo[] = [
    // Data from the spreadsheet image
    // 입문 1~10: 따내기 바둑 (흑에게 15턴 제한)
    {
        id: '입문-1',
        name: '관문 1',
        level: SinglePlayerLevel.입문,
        actionPointCost: 2,
        boardSize: 7,
        targetScore: { black: 1, white: 99 },
        fixedOpening: [
            { x: 3, y: 3, color: 'white' },
            { x: 2, y: 3, color: 'black' },
            { x: 3, y: 2, color: 'black' },
            { x: 3, y: 4, color: 'black' },
        ],
        placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 },
        timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 },
        blackTurnLimit: 15,
        rewards: {
            firstClear: { gold: 100, exp: 10 },
            repeatClear: { gold: 10, exp: 10 },
        },
    },
    { id: '입문-2', name: '관문 2', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 5, white: 5 }, placements: { black: 2, white: 2, blackPattern: 0, whitePattern: 1, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 100, exp: 11 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-3', name: '관문 3', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 5, white: 5 }, placements: { black: 2, white: 2, blackPattern: 1, whitePattern: 1, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 100, exp: 12 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-4', name: '관문 4', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 5, white: 5 }, placements: { black: 2, white: 2, blackPattern: 2, whitePattern: 1, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 100, exp: 13 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-5', name: '관문 5', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 6 }, placements: { black: 2, white: 3, blackPattern: 2, whitePattern: 1, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 100, exp: 14, items: [{ itemId: '푸른 바람 부채', quantity: 1 }] }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-6', name: '관문 6', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 6 }, placements: { black: 3, white: 5, blackPattern: 2, whitePattern: 0, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 100, exp: 15 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-7', name: '관문 7', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 6 }, placements: { black: 3, white: 4, blackPattern: 2, whitePattern: 2, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 100, exp: 16 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-8', name: '관문 8', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 6 }, placements: { black: 3, white: 5, blackPattern: 3, whitePattern: 2, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, blackTurnLimit: 15, forcedAiResponses: [{ whenOpponentStoneAt: { x: 5, y: 3 }, move: { x: 5, y: 2 } }, { move: { x: 5, y: 3 } }], strictForcedAiResponses: true, rewards: { firstClear: { gold: 100, exp: 17 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-9', name: '관문 9', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 6 }, placements: { black: 3, white: 4, blackPattern: 3, whitePattern: 3, centerBlackStoneChance: 90 }, timeControl: { type: 'byoyomi', mainTime: 3, byoyomiTime: 0, byoyomiCount: 3 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 100, exp: 18 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-10', name: '관문 10', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 7, targetScore: { black: 7, white: 5 }, placements: { black: 4, white: 7, blackPattern: 2, whitePattern: 3 }, timeControl: { type: 'fischer', mainTime: 5, increment: 10 }, blackTurnLimit: 15, rewards: { firstClear: { gold: 150, exp: 20, items: [{ itemId: '새싹 바둑판', quantity: 1 }] }, repeatClear: { gold: 10, exp: 15 } } },
    // 입문 11~20: 살리기 바둑 모드 (AI가 정해진 턴 동안 도망가며 살아남기)
    {
        id: '입문-11',
        name: '관문 11',
        level: SinglePlayerLevel.입문,
        actionPointCost: 2,
        boardSize: 9,
        // 살리기 바둑: 백(봇)이 1점을 만들지 못하면 승리
        targetScore: { black: 1, white: 0 },
        fixedOpening: [
            { x: 4, y: 4, color: 'black' },
            { x: 5, y: 4, color: 'white' },
        ],
        placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 },
        timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 },
        survivalTurns: 3,
        rewards: {
            firstClear: { gold: 150, exp: 20 },
            repeatClear: { gold: 10, exp: 10 },
        },
    },
    { id: '입문-12', name: '관문 12', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 4, white: 14, blackPattern: 1, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 15, rewards: { firstClear: { gold: 150, exp: 20 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-13', name: '관문 13', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 5, white: 15, blackPattern: 2, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 15, rewards: { firstClear: { gold: 150, exp: 20 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-14', name: '관문 14', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 4, white: 15, blackPattern: 2, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 15, rewards: { firstClear: { gold: 150, exp: 20 }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-15', name: '관문 15', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 3, white: 14, blackPattern: 2, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 15, rewards: { firstClear: { gold: 150, exp: 20, items: [{ itemId: '봄빛 도복 상의', quantity: 1 }] }, repeatClear: { gold: 10, exp: 10 } } },
    { id: '입문-16', name: '관문 16', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 2, white: 13, blackPattern: 2, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 16, rewards: { firstClear: { gold: 150, exp: 30 }, repeatClear: { gold: 10, exp: 15 } } },
    { id: '입문-17', name: '관문 17', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 3, white: 15, blackPattern: 3, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 17, rewards: { firstClear: { gold: 150, exp: 30 }, repeatClear: { gold: 10, exp: 15 } } },
    { id: '입문-18', name: '관문 18', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 4, white: 16, blackPattern: 4, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 18, rewards: { firstClear: { gold: 150, exp: 30 }, repeatClear: { gold: 10, exp: 15 } } },
    { id: '입문-19', name: '관문 19', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 5, white: 17, blackPattern: 5, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 19, rewards: { firstClear: { gold: 150, exp: 30 }, repeatClear: { gold: 10, exp: 15 } } },
    { id: '입문-20', name: '관문 20', level: SinglePlayerLevel.입문, actionPointCost: 2, boardSize: 9, targetScore: { black: 5, white: 0 }, placements: { black: 5, white: 18, blackPattern: 6, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 }, survivalTurns: 20, rewards: { firstClear: { gold: 200, exp: 30, items: [{ itemId: '봄빛 도복 하의', quantity: 1 }] }, repeatClear: { gold: 10, exp: 15 } } },
    // 초급
    { id: '초급-1', name: '관문 1', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 9, white: 8 }, placements: { black: 4, white: 6, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 30 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-2', name: '관문 2', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 9, white: 8 }, placements: { black: 5, white: 8, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 32 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-3', name: '관문 3', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 9, white: 8 }, placements: { black: 3, white: 7, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 34 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-4', name: '관문 4', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 9, white: 8 }, placements: { black: 6, white: 9, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 36 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-5', name: '관문 5', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 10, white: 9 }, placements: { black: 8, white: 13, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 38, items: [{ itemId: '가벼운 나무통', quantity: 1 }] }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-6', name: '관문 6', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 10, white: 9 }, placements: { black: 4, white: 9, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 40 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-7', name: '관문 7', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 10, white: 9 }, placements: { black: 7, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 42 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-8', name: '관문 8', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 10, white: 9 }, placements: { black: 5, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 44 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-9', name: '관문 9', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 10, white: 9 }, placements: { black: 6, white: 12, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 200, exp: 46 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-10', name: '관문 10', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 11, white: 9 }, placements: { black: 3, white: 8, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 50, items: [{ itemId: '흑백 새싹돌', quantity: 1 }] }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-11', name: '관문 11', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 11, white: 9 }, placements: { black: 4, white: 9, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 52 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-12', name: '관문 12', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 11, white: 9 }, placements: { black: 5, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 54 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-13', name: '관문 13', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 11, white: 9 }, placements: { black: 6, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 56 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-14', name: '관문 14', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 11, white: 9 }, placements: { black: 7, white: 12, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 58 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-15', name: '관문 15', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 12, white: 10 }, placements: { black: 5, white: 13, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 60, items: [{ itemId: '은결 바람 부채', quantity: 1 }] }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-16', name: '관문 16', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 12, white: 10 }, placements: { black: 6, white: 14, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 62 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-17', name: '관문 17', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 12, white: 10 }, placements: { black: 7, white: 15, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 64 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-18', name: '관문 18', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 12, white: 10 }, placements: { black: 8, white: 16, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 66 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-19', name: '관문 19', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 12, white: 10 }, placements: { black: 9, white: 17, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 250, exp: 100 }, repeatClear: { gold: 30, exp: 20 } }, autoScoringTurns: 40 },
    { id: '초급-20', name: '관문 20', level: SinglePlayerLevel.초급, actionPointCost: 3, boardSize: 9, targetScore: { black: 15, white: 12 }, placements: { black: 5, white: 20, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 300, exp: 120, items: [{ itemId: '단풍결 바둑판', quantity: 1 }] }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40 },
    // 중급
    { id: '중급-1', name: '관문 1', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 11, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 7, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 60, missileCount: 3 },
    { id: '중급-2', name: '관문 2', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 11, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 8, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 60, missileCount: 3 },
    { id: '중급-3', name: '관문 3', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 11, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 9, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 60, missileCount: 3 },
    { id: '중급-4', name: '관문 4', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 11, targetScore: { black: 0, white: 0 }, placements: { black: 6, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 60, missileCount: 3 },
    { id: '중급-5', name: '관문 5', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 11, targetScore: { black: 0, white: 0 }, placements: { black: 8, white: 13, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 400, exp: 150, items: [{ itemId: '여름빛 도복 상의', quantity: 1 }] }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 60, missileCount: 3 },
    { id: '중급-6', name: '관문 6', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 11, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 60, missileCount: 3 },
    {
        id: '중급-7',
        name: '관문 7',
        level: SinglePlayerLevel.중급,
        actionPointCost: 4,
        boardSize: 11,
        targetScore: { black: 0, white: 0 },
        placements: { black: 7, white: 12, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 },
        timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 },
        rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } },
        autoScoringTurns: 60,
        missileCount: 3,
        hiddenCount: 1,
        scanCount: 2,
        strategicRulePreset: 'mix',
        mixedStrategicModes: [GameMode.Missile, GameMode.Hidden],
        aiHiddenItemTurns: [1],
        aiHiddenItemPlacements: [{ x: 5, y: 5 }],
        kataServerLevel: -5,
    },
    { id: '중급-8', name: '관문 8', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 5, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, hiddenCount: 1, scanCount: 2, kataServerLevel: -5, strategicRulePreset: 'hidden' },
    { id: '중급-9', name: '관문 9', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 5, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, hiddenCount: 1, scanCount: 2, kataServerLevel: -5, strategicRulePreset: 'hidden' },
    { id: '중급-10', name: '관문 10', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 5, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 400, exp: 200, items: [{ itemId: '여름빛 도복 하의', quantity: 1 }] }, repeatClear: { gold: 50, exp: 50 } }, autoScoringTurns: 40, hiddenCount: 1, scanCount: 2, kataServerLevel: -5, strategicRulePreset: 'hidden' },
    { id: '중급-11', name: '관문 11', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 2 },
    { id: '중급-12', name: '관문 12', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 2 },
    { id: '중급-13', name: '관문 13', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 2 },
    { id: '중급-14', name: '관문 14', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 2 },
    { id: '중급-15', name: '관문 15', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 400, exp: 200, items: [{ itemId: '단단한 대나무통', quantity: 1 }] }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 2 },
    { id: '중급-16', name: '관문 16', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 3 },
    { id: '중급-17', name: '관문 17', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 3 },
    { id: '중급-18', name: '관문 18', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 3 },
    { id: '중급-19', name: '관문 19', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 300, exp: 100 }, repeatClear: { gold: 50, exp: 30 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 3 },
    { id: '중급-20', name: '관문 20', level: SinglePlayerLevel.중급, actionPointCost: 4, boardSize: 9, targetScore: { black: 0, white: 0 }, placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 400, exp: 250, items: [{ itemId: '은빛 결돌', quantity: 1 }] }, repeatClear: { gold: 50, exp: 50 } }, autoScoringTurns: 40, strategicRulePreset: 'base', baseStones: 4 },
    // 고급
    { id: '고급-1', name: '관문 1', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 8, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-2', name: '관문 2', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-3', name: '관문 3', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 6, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-4', name: '관문 4', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 7, white: 12, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-5', name: '관문 5', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 8, white: 14, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 250, items: [{ itemId: '화염 바람 부채', quantity: 1 }] }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-6', name: '관문 6', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 9, white: 14, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-7', name: '관문 7', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 8, white: 13, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-8', name: '관문 8', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 7, white: 12, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-9', name: '관문 9', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-10', name: '관문 10', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 9, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 500, exp: 300, items: [{ itemId: '산호결 바둑판', quantity: 1 }] }, repeatClear: { gold: 100, exp: 70 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-11', name: '관문 11', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-12', name: '관문 12', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-13', name: '관문 13', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-14', name: '관문 14', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 10, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-15', name: '관문 15', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 12, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 250, items: [{ itemId: '가을빛 도복 상의', quantity: 1 }] }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-16', name: '관문 16', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-17', name: '관문 17', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-18', name: '관문 18', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-19', name: '관문 19', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 12, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 200 }, repeatClear: { gold: 100, exp: 40 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    { id: '고급-20', name: '관문 20', level: SinglePlayerLevel.고급, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 5, white: 14, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 600, exp: 350, items: [{ itemId: '가을빛 도복 하의', quantity: 1 }] }, repeatClear: { gold: 100, exp: 80 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 3, kataServerLevel: -1 },
    // 유단자
    { id: '유단자-1', name: '관문 1', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 10 }, placements: { black: 4, white: 14, blackPattern: 5, whitePattern: 4, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 150, exp: 50 } }, blackTurnLimit: 35, kataServerLevel: 1 },
    { id: '유단자-2', name: '관문 2', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 9 }, placements: { black: 3, white: 14, blackPattern: 5, whitePattern: 3, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 150, exp: 50 } }, blackTurnLimit: 35, kataServerLevel: 1 },
    { id: '유단자-3', name: '관문 3', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 8 }, placements: { black: 4, white: 16, blackPattern: 7, whitePattern: 2, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 150, exp: 50 } }, blackTurnLimit: 35, kataServerLevel: 1 },
    { id: '유단자-4', name: '관문 4', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 7 }, placements: { black: 4, white: 17, blackPattern: 7, whitePattern: 2, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 150, exp: 50 } }, blackTurnLimit: 35, kataServerLevel: 1 },
    { id: '유단자-5', name: '관문 5', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 30, white: 6 }, placements: { black: 4, white: 18, blackPattern: 8, whitePattern: 2, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 700, exp: 400, items: [{ itemId: '홍목 바둑통', quantity: 1 }] }, repeatClear: { gold: 150, exp: 50 } }, blackTurnLimit: 35, kataServerLevel: 1 },
    { id: '유단자-6', name: '관문 6', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 15, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 200, exp: 50 } }, autoScoringTurns: 80, kataServerLevel: 1 },
    { id: '유단자-7', name: '관문 7', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 14, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 200, exp: 50 } }, autoScoringTurns: 80, kataServerLevel: 1 },
    { id: '유단자-8', name: '관문 8', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 15, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 200, exp: 50 } }, autoScoringTurns: 80, kataServerLevel: 1 },
    { id: '유단자-9', name: '관문 9', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 16, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 700, exp: 250 }, repeatClear: { gold: 200, exp: 50 } }, autoScoringTurns: 80, kataServerLevel: 1 },
    { id: '유단자-10', name: '관문 10', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 16, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'fischer', mainTime: 3, increment: 5 }, rewards: { firstClear: { gold: 700, exp: 500, items: [{ itemId: '홍옥 바둑돌', quantity: 1 }] }, repeatClear: { gold: 200, exp: 90 } }, autoScoringTurns: 80, kataServerLevel: 1 },
    { id: '유단자-11', name: '관문 11', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 16, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 300 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, missileCount: 3, kataServerLevel: 1 },
    { id: '유단자-12', name: '관문 12', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 15, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 300 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, missileCount: 3, kataServerLevel: 1 },
    { id: '유단자-13', name: '관문 13', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 16, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 300 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, missileCount: 3, kataServerLevel: 1 },
    { id: '유단자-14', name: '관문 14', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 17, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 300 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, missileCount: 3, kataServerLevel: 1 },
    { id: '유단자-15', name: '관문 15', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 17, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 400, items: [{ itemId: '서리 바람 부채', quantity: 1 }] }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, missileCount: 3, kataServerLevel: 1 },
    { id: '유단자-16', name: '관문 16', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 17, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 350 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 2, kataServerLevel: 1 },
    { id: '유단자-17', name: '관문 17', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 16, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 350 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 2, kataServerLevel: 1 },
    { id: '유단자-18', name: '관문 18', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 3, white: 17, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 350 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 2, kataServerLevel: 1 },
    { id: '유단자-19', name: '관문 19', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 18, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 350 }, repeatClear: { gold: 300, exp: 50 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 2, kataServerLevel: 1 },
    { id: '유단자-20', name: '관문 20', level: SinglePlayerLevel.유단자, actionPointCost: 5, boardSize: 13, targetScore: { black: 0, white: 0 }, placements: { black: 4, white: 25, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 }, timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 }, rewards: { firstClear: { gold: 800, exp: 1000, items: [{ itemId: '흑단 바둑판', quantity: 1 }] }, repeatClear: { gold: 300, exp: 100 } }, autoScoringTurns: 80, hiddenCount: 1, scanCount: 2, kataServerLevel: 1 },
];

export const DEFAULT_SINGLE_PLAYER_STAGES: SinglePlayerStageInfo[] = SINGLE_PLAYER_STAGES_BASE.map((stage) => ({
    ...stage,
    actionPointCost: stage.actionPointCost,
    rewards: {
        ...stage.rewards,
        repeatClear: {
            gold: 0,
            exp: 0,
        },
    },
}));

export let SINGLE_PLAYER_STAGES: SinglePlayerStageInfo[] = DEFAULT_SINGLE_PLAYER_STAGES;

const singlePlayerStagesListUpdateSubscribers = new Set<() => void>();

/** 관리자 KV 등으로 `SINGLE_PLAYER_STAGES`가 바뀐 뒤 React 트리를 갱신할 때 구독 */
export const subscribeSinglePlayerStagesListUpdate = (cb: () => void): (() => void) => {
    singlePlayerStagesListUpdateSubscribers.add(cb);
    return () => singlePlayerStagesListUpdateSubscribers.delete(cb);
};

export const getSinglePlayerStages = (): SinglePlayerStageInfo[] => SINGLE_PLAYER_STAGES;

export const setSinglePlayerStagesFromServer = (stages: SinglePlayerStageInfo[] | null | undefined): SinglePlayerStageInfo[] => {
    if (Array.isArray(stages) && stages.length > 0) {
        SINGLE_PLAYER_STAGES = stages.map((stage) => ({ ...stage }));
    } else {
        SINGLE_PLAYER_STAGES = DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => ({ ...stage }));
    }
    for (const cb of singlePlayerStagesListUpdateSubscribers) {
        try {
            cb();
        } catch {
            /* ignore subscriber errors */
        }
    }
    return SINGLE_PLAYER_STAGES;
};
