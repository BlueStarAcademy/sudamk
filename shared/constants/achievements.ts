export type AchievementStageDefinition = {
    id: string;
    title: string;
    description: string;
    requirement:
        | { type: 'singleplayer_stage_clear'; stageId: string }
        | { type: 'strategy_level'; level: number }
        | { type: 'playful_level'; level: number }
        | { type: 'championship_cumulative_score'; score: number }
        | { type: 'all_equipment_min_grade'; grade: 'normal' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'transcendent' }
        | { type: 'strategy_tier'; tier: '루키' | '브론즈' | '실버' | '골드' | '플래티넘' | '다이아' | '마스터' | '챌린저' }
        | { type: 'playful_tier'; tier: '루키' | '브론즈' | '실버' | '골드' | '플래티넘' | '다이아' | '마스터' | '챌린저' }
        | { type: 'adventure_understanding_tier'; stageId: 'neighborhood_hill' | 'lake_park' | 'aquarium' | 'zoo' | 'amusement_park'; tier: '편함' | '익숙함' | '친숙함' | '정복' }
        | { type: 'adventure_codex_score'; score: number }
        | { type: 'blacksmith_level'; level: number };
    rewardDiamonds: number;
};

export type AchievementTrackDefinition = {
    id: string;
    title: string;
    stages: AchievementStageDefinition[];
};

export const BADUK_ACADEMY_TRACK_ID = 'baduk_academy_20_clear';
export const STRATEGY_LEVEL_TRACK_ID = 'strategy_level_milestones';
export const PLAYFUL_LEVEL_TRACK_ID = 'playful_level_milestones';
export const CHAMPIONSHIP_SCORE_TRACK_ID = 'championship_score_milestones';
export const ALL_EQUIPMENT_GRADE_TRACK_ID = 'all_equipment_grade_milestones';
export const STRATEGY_TIER_TRACK_ID = 'strategy_tier_milestones';
export const PLAYFUL_TIER_TRACK_ID = 'playful_tier_milestones';
export const NEIGHBORHOOD_HILL_EXPLORATION_TRACK_ID = 'adventure_neighborhood_hill_conquest';
export const LAKE_PARK_EXPLORATION_TRACK_ID = 'adventure_lake_park_conquest';
export const AQUARIUM_EXPLORATION_TRACK_ID = 'adventure_aquarium_conquest';
export const ZOO_EXPLORATION_TRACK_ID = 'adventure_zoo_conquest';
export const AMUSEMENT_PARK_EXPLORATION_TRACK_ID = 'adventure_amusement_park_conquest';
export const MONSTER_CODEX_HUNTER_TRACK_ID = 'adventure_monster_codex_hunter';
export const BLACKSMITH_LEVEL_TRACK_ID = 'blacksmith_level_milestones';

export const ACHIEVEMENT_TRACKS: AchievementTrackDefinition[] = [
    {
        id: BADUK_ACADEMY_TRACK_ID,
        title: '바둑학원 돌파 업적',
        stages: [
            {
                id: 'academy-beginner-20',
                title: '바둑학원 입문반-20 돌파',
                description: '바둑학원 입문반 20스테이지를 클리어하세요.',
                requirement: { type: 'singleplayer_stage_clear', stageId: '입문-20' },
                rewardDiamonds: 5,
            },
            {
                id: 'academy-elementary-20',
                title: '바둑학원 초급반-20 돌파',
                description: '바둑학원 초급반 20스테이지를 클리어하세요.',
                requirement: { type: 'singleplayer_stage_clear', stageId: '초급-20' },
                rewardDiamonds: 10,
            },
            {
                id: 'academy-intermediate-20',
                title: '바둑학원 중급반-20 돌파',
                description: '바둑학원 중급반 20스테이지를 클리어하세요.',
                requirement: { type: 'singleplayer_stage_clear', stageId: '중급-20' },
                rewardDiamonds: 20,
            },
            {
                id: 'academy-advanced-20',
                title: '바둑학원 고급반-20 돌파',
                description: '바둑학원 고급반 20스테이지를 클리어하세요.',
                requirement: { type: 'singleplayer_stage_clear', stageId: '고급-20' },
                rewardDiamonds: 30,
            },
            {
                id: 'academy-master-20',
                title: '바둑학원 유단자-20 돌파',
                description: '바둑학원 유단자 20스테이지를 클리어하세요.',
                requirement: { type: 'singleplayer_stage_clear', stageId: '유단자-20' },
                rewardDiamonds: 50,
            },
        ],
    },
    {
        id: STRATEGY_LEVEL_TRACK_ID,
        title: '전략바둑 레벨 업적',
        stages: [
            { id: 'strategy-level-5', title: '전략바둑 5레벨 달성', description: '전략바둑 레벨 5를 달성하세요.', requirement: { type: 'strategy_level', level: 5 }, rewardDiamonds: 50 },
            { id: 'strategy-level-10', title: '전략바둑 10레벨 달성', description: '전략바둑 레벨 10을 달성하세요.', requirement: { type: 'strategy_level', level: 10 }, rewardDiamonds: 100 },
            { id: 'strategy-level-15', title: '전략바둑 15레벨 달성', description: '전략바둑 레벨 15를 달성하세요.', requirement: { type: 'strategy_level', level: 15 }, rewardDiamonds: 100 },
            { id: 'strategy-level-20', title: '전략바둑 20레벨 달성', description: '전략바둑 레벨 20을 달성하세요.', requirement: { type: 'strategy_level', level: 20 }, rewardDiamonds: 100 },
            { id: 'strategy-level-25', title: '전략바둑 25레벨 달성', description: '전략바둑 레벨 25를 달성하세요.', requirement: { type: 'strategy_level', level: 25 }, rewardDiamonds: 100 },
            { id: 'strategy-level-30', title: '전략바둑 30레벨 달성', description: '전략바둑 레벨 30을 달성하세요.', requirement: { type: 'strategy_level', level: 30 }, rewardDiamonds: 100 },
            { id: 'strategy-level-35', title: '전략바둑 35레벨 달성', description: '전략바둑 레벨 35를 달성하세요.', requirement: { type: 'strategy_level', level: 35 }, rewardDiamonds: 100 },
            { id: 'strategy-level-40', title: '전략바둑 40레벨 달성', description: '전략바둑 레벨 40을 달성하세요.', requirement: { type: 'strategy_level', level: 40 }, rewardDiamonds: 100 },
            { id: 'strategy-level-45', title: '전략바둑 45레벨 달성', description: '전략바둑 레벨 45를 달성하세요.', requirement: { type: 'strategy_level', level: 45 }, rewardDiamonds: 100 },
            { id: 'strategy-level-50', title: '전략바둑 50레벨 달성', description: '전략바둑 레벨 50을 달성하세요.', requirement: { type: 'strategy_level', level: 50 }, rewardDiamonds: 100 },
        ],
    },
    {
        id: PLAYFUL_LEVEL_TRACK_ID,
        title: '놀이바둑 레벨 업적',
        stages: [
            { id: 'playful-level-5', title: '놀이바둑 5레벨 달성', description: '놀이바둑 레벨 5를 달성하세요.', requirement: { type: 'playful_level', level: 5 }, rewardDiamonds: 50 },
            { id: 'playful-level-10', title: '놀이바둑 10레벨 달성', description: '놀이바둑 레벨 10을 달성하세요.', requirement: { type: 'playful_level', level: 10 }, rewardDiamonds: 100 },
            { id: 'playful-level-15', title: '놀이바둑 15레벨 달성', description: '놀이바둑 레벨 15를 달성하세요.', requirement: { type: 'playful_level', level: 15 }, rewardDiamonds: 100 },
            { id: 'playful-level-20', title: '놀이바둑 20레벨 달성', description: '놀이바둑 레벨 20을 달성하세요.', requirement: { type: 'playful_level', level: 20 }, rewardDiamonds: 100 },
            { id: 'playful-level-25', title: '놀이바둑 25레벨 달성', description: '놀이바둑 레벨 25를 달성하세요.', requirement: { type: 'playful_level', level: 25 }, rewardDiamonds: 100 },
            { id: 'playful-level-30', title: '놀이바둑 30레벨 달성', description: '놀이바둑 레벨 30을 달성하세요.', requirement: { type: 'playful_level', level: 30 }, rewardDiamonds: 100 },
            { id: 'playful-level-35', title: '놀이바둑 35레벨 달성', description: '놀이바둑 레벨 35를 달성하세요.', requirement: { type: 'playful_level', level: 35 }, rewardDiamonds: 100 },
            { id: 'playful-level-40', title: '놀이바둑 40레벨 달성', description: '놀이바둑 레벨 40을 달성하세요.', requirement: { type: 'playful_level', level: 40 }, rewardDiamonds: 100 },
            { id: 'playful-level-45', title: '놀이바둑 45레벨 달성', description: '놀이바둑 레벨 45를 달성하세요.', requirement: { type: 'playful_level', level: 45 }, rewardDiamonds: 100 },
            { id: 'playful-level-50', title: '놀이바둑 50레벨 달성', description: '놀이바둑 레벨 50을 달성하세요.', requirement: { type: 'playful_level', level: 50 }, rewardDiamonds: 100 },
        ],
    },
    {
        id: CHAMPIONSHIP_SCORE_TRACK_ID,
        title: '챔피언십 점령 업적',
        stages: [
            { id: 'champ-score-200', title: '챔피언십 점수 누적 200점', description: '챔피언십 누적 점수 200점을 달성하세요.', requirement: { type: 'championship_cumulative_score', score: 200 }, rewardDiamonds: 10 },
            { id: 'champ-score-500', title: '챔피언십 점수 누적 500점', description: '챔피언십 누적 점수 500점을 달성하세요.', requirement: { type: 'championship_cumulative_score', score: 500 }, rewardDiamonds: 20 },
            { id: 'champ-score-1000', title: '챔피언십 점수 누적 1000점', description: '챔피언십 누적 점수 1000점을 달성하세요.', requirement: { type: 'championship_cumulative_score', score: 1000 }, rewardDiamonds: 50 },
            { id: 'champ-score-2000', title: '챔피언십 점수 누적 2000점', description: '챔피언십 누적 점수 2000점을 달성하세요.', requirement: { type: 'championship_cumulative_score', score: 2000 }, rewardDiamonds: 100 },
            { id: 'champ-score-3000', title: '챔피언십 점수 누적 3000점', description: '챔피언십 누적 점수 3000점을 달성하세요.', requirement: { type: 'championship_cumulative_score', score: 3000 }, rewardDiamonds: 150 },
        ],
    },
    {
        id: ALL_EQUIPMENT_GRADE_TRACK_ID,
        title: '장비장착 업적',
        stages: [
            { id: 'equip-grade-normal', title: '모든 장비 일반등급 이상 장착', description: '모든 장비 슬롯에 일반등급 이상을 장착하세요.', requirement: { type: 'all_equipment_min_grade', grade: 'normal' }, rewardDiamonds: 10 },
            { id: 'equip-grade-uncommon', title: '모든 장비 고급등급 이상 장착', description: '모든 장비 슬롯에 고급등급 이상을 장착하세요.', requirement: { type: 'all_equipment_min_grade', grade: 'uncommon' }, rewardDiamonds: 30 },
            { id: 'equip-grade-rare', title: '모든 장비 희귀등급 이상 장착', description: '모든 장비 슬롯에 희귀등급 이상을 장착하세요.', requirement: { type: 'all_equipment_min_grade', grade: 'rare' }, rewardDiamonds: 50 },
            { id: 'equip-grade-epic', title: '모든 장비 에픽등급 이상 장착', description: '모든 장비 슬롯에 에픽등급 이상을 장착하세요.', requirement: { type: 'all_equipment_min_grade', grade: 'epic' }, rewardDiamonds: 100 },
            { id: 'equip-grade-legendary', title: '모든 장비 전설등급 이상 장착', description: '모든 장비 슬롯에 전설등급 이상을 장착하세요.', requirement: { type: 'all_equipment_min_grade', grade: 'legendary' }, rewardDiamonds: 100 },
            { id: 'equip-grade-mythic', title: '모든 장비 신화등급 이상 장착', description: '모든 장비 슬롯에 신화등급 이상을 장착하세요.', requirement: { type: 'all_equipment_min_grade', grade: 'mythic' }, rewardDiamonds: 100 },
            { id: 'equip-grade-transcendent', title: '모든 장비 초월등급 이상 장착', description: '모든 장비 슬롯에 초월등급 이상을 장착하세요.', requirement: { type: 'all_equipment_min_grade', grade: 'transcendent' }, rewardDiamonds: 150 },
        ],
    },
    {
        id: STRATEGY_TIER_TRACK_ID,
        title: '전략바둑 랭커 업적',
        stages: [
            { id: 'strategy-tier-rookie', title: '시즌 최고 티어 [루키]', description: '전략바둑 시즌 티어 루키를 달성하세요.', requirement: { type: 'strategy_tier', tier: '루키' }, rewardDiamonds: 25 },
            { id: 'strategy-tier-bronze', title: '시즌 최고 티어 [브론즈]', description: '전략바둑 시즌 티어 브론즈를 달성하세요.', requirement: { type: 'strategy_tier', tier: '브론즈' }, rewardDiamonds: 50 },
            { id: 'strategy-tier-silver', title: '시즌 최고 티어 [실버]', description: '전략바둑 시즌 티어 실버를 달성하세요.', requirement: { type: 'strategy_tier', tier: '실버' }, rewardDiamonds: 100 },
            { id: 'strategy-tier-gold', title: '시즌 최고 티어 [골드]', description: '전략바둑 시즌 티어 골드를 달성하세요.', requirement: { type: 'strategy_tier', tier: '골드' }, rewardDiamonds: 150 },
            { id: 'strategy-tier-platinum', title: '시즌 최고 티어 [플래티넘]', description: '전략바둑 시즌 티어 플래티넘을 달성하세요.', requirement: { type: 'strategy_tier', tier: '플래티넘' }, rewardDiamonds: 200 },
            { id: 'strategy-tier-diamond', title: '시즌 최고 티어 [다이아]', description: '전략바둑 시즌 티어 다이아를 달성하세요.', requirement: { type: 'strategy_tier', tier: '다이아' }, rewardDiamonds: 250 },
            { id: 'strategy-tier-master', title: '시즌 최고 티어 [마스터]', description: '전략바둑 시즌 티어 마스터를 달성하세요.', requirement: { type: 'strategy_tier', tier: '마스터' }, rewardDiamonds: 300 },
            { id: 'strategy-tier-challenger', title: '시즌 최고 티어 [챌린저]', description: '전략바둑 시즌 티어 챌린저를 달성하세요.', requirement: { type: 'strategy_tier', tier: '챌린저' }, rewardDiamonds: 500 },
        ],
    },
    {
        id: PLAYFUL_TIER_TRACK_ID,
        title: '놀이바둑 랭커 업적',
        stages: [
            { id: 'playful-tier-rookie', title: '시즌 최고 티어 [루키]', description: '놀이바둑 시즌 티어 루키를 달성하세요.', requirement: { type: 'playful_tier', tier: '루키' }, rewardDiamonds: 25 },
            { id: 'playful-tier-bronze', title: '시즌 최고 티어 [브론즈]', description: '놀이바둑 시즌 티어 브론즈를 달성하세요.', requirement: { type: 'playful_tier', tier: '브론즈' }, rewardDiamonds: 50 },
            { id: 'playful-tier-silver', title: '시즌 최고 티어 [실버]', description: '놀이바둑 시즌 티어 실버를 달성하세요.', requirement: { type: 'playful_tier', tier: '실버' }, rewardDiamonds: 100 },
            { id: 'playful-tier-gold', title: '시즌 최고 티어 [골드]', description: '놀이바둑 시즌 티어 골드를 달성하세요.', requirement: { type: 'playful_tier', tier: '골드' }, rewardDiamonds: 150 },
            { id: 'playful-tier-platinum', title: '시즌 최고 티어 [플래티넘]', description: '놀이바둑 시즌 티어 플래티넘을 달성하세요.', requirement: { type: 'playful_tier', tier: '플래티넘' }, rewardDiamonds: 200 },
            { id: 'playful-tier-diamond', title: '시즌 최고 티어 [다이아]', description: '놀이바둑 시즌 티어 다이아를 달성하세요.', requirement: { type: 'playful_tier', tier: '다이아' }, rewardDiamonds: 250 },
            { id: 'playful-tier-master', title: '시즌 최고 티어 [마스터]', description: '놀이바둑 시즌 티어 마스터를 달성하세요.', requirement: { type: 'playful_tier', tier: '마스터' }, rewardDiamonds: 300 },
            { id: 'playful-tier-challenger', title: '시즌 최고 티어 [챌린저]', description: '놀이바둑 시즌 티어 챌린저를 달성하세요.', requirement: { type: 'playful_tier', tier: '챌린저' }, rewardDiamonds: 500 },
        ],
    },
    {
        id: NEIGHBORHOOD_HILL_EXPLORATION_TRACK_ID,
        title: '동네뒷산 모험의 정복 업적',
        stages: [
            { id: 'neighborhood-hill-exploration-comfort', title: '동네뒷산 지역 탐험도 [편함] 달성', description: '동네뒷산 지역 탐험도를 [편함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'neighborhood_hill', tier: '편함' }, rewardDiamonds: 10 },
            { id: 'neighborhood-hill-exploration-familiar', title: '동네뒷산 지역 탐험도 [익숙함] 달성', description: '동네뒷산 지역 탐험도를 [익숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'neighborhood_hill', tier: '익숙함' }, rewardDiamonds: 20 },
            { id: 'neighborhood-hill-exploration-close', title: '동네뒷산 지역 탐험도 [친숙함] 달성', description: '동네뒷산 지역 탐험도를 [친숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'neighborhood_hill', tier: '친숙함' }, rewardDiamonds: 30 },
            { id: 'neighborhood-hill-exploration-conquer', title: '동네뒷산 지역 탐험도 [정복] 달성', description: '동네뒷산 지역 탐험도를 [정복]으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'neighborhood_hill', tier: '정복' }, rewardDiamonds: 50 },
        ],
    },
    {
        id: LAKE_PARK_EXPLORATION_TRACK_ID,
        title: '호수공원 모험의 정복 업적',
        stages: [
            { id: 'lake-park-exploration-comfort', title: '호수공원 지역 탐험도 [편함] 달성', description: '호수공원 지역 탐험도를 [편함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'lake_park', tier: '편함' }, rewardDiamonds: 10 },
            { id: 'lake-park-exploration-familiar', title: '호수공원 지역 탐험도 [익숙함] 달성', description: '호수공원 지역 탐험도를 [익숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'lake_park', tier: '익숙함' }, rewardDiamonds: 20 },
            { id: 'lake-park-exploration-close', title: '호수공원 지역 탐험도 [친숙함] 달성', description: '호수공원 지역 탐험도를 [친숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'lake_park', tier: '친숙함' }, rewardDiamonds: 30 },
            { id: 'lake-park-exploration-conquer', title: '호수공원 지역 탐험도 [정복] 달성', description: '호수공원 지역 탐험도를 [정복]으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'lake_park', tier: '정복' }, rewardDiamonds: 50 },
        ],
    },
    {
        id: AQUARIUM_EXPLORATION_TRACK_ID,
        title: '아쿠아리움 모험의 정복 업적',
        stages: [
            { id: 'aquarium-exploration-comfort', title: '아쿠아리움 지역 탐험도 [편함] 달성', description: '아쿠아리움 지역 탐험도를 [편함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'aquarium', tier: '편함' }, rewardDiamonds: 10 },
            { id: 'aquarium-exploration-familiar', title: '아쿠아리움 지역 탐험도 [익숙함] 달성', description: '아쿠아리움 지역 탐험도를 [익숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'aquarium', tier: '익숙함' }, rewardDiamonds: 20 },
            { id: 'aquarium-exploration-close', title: '아쿠아리움 지역 탐험도 [친숙함] 달성', description: '아쿠아리움 지역 탐험도를 [친숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'aquarium', tier: '친숙함' }, rewardDiamonds: 30 },
            { id: 'aquarium-exploration-conquer', title: '아쿠아리움 지역 탐험도 [정복] 달성', description: '아쿠아리움 지역 탐험도를 [정복]으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'aquarium', tier: '정복' }, rewardDiamonds: 50 },
        ],
    },
    {
        id: ZOO_EXPLORATION_TRACK_ID,
        title: '동물원 모험의 정복 업적',
        stages: [
            { id: 'zoo-exploration-comfort', title: '동물원 지역 탐험도 [편함] 달성', description: '동물원 지역 탐험도를 [편함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'zoo', tier: '편함' }, rewardDiamonds: 10 },
            { id: 'zoo-exploration-familiar', title: '동물원 지역 탐험도 [익숙함] 달성', description: '동물원 지역 탐험도를 [익숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'zoo', tier: '익숙함' }, rewardDiamonds: 20 },
            { id: 'zoo-exploration-close', title: '동물원 지역 탐험도 [친숙함] 달성', description: '동물원 지역 탐험도를 [친숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'zoo', tier: '친숙함' }, rewardDiamonds: 30 },
            { id: 'zoo-exploration-conquer', title: '동물원 지역 탐험도 [정복] 달성', description: '동물원 지역 탐험도를 [정복]으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'zoo', tier: '정복' }, rewardDiamonds: 50 },
        ],
    },
    {
        id: AMUSEMENT_PARK_EXPLORATION_TRACK_ID,
        title: '놀이동산 모험의 정복 업적',
        stages: [
            { id: 'amusement-park-exploration-comfort', title: '놀이동산 지역 탐험도 [편함] 달성', description: '놀이동산 지역 탐험도를 [편함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'amusement_park', tier: '편함' }, rewardDiamonds: 10 },
            { id: 'amusement-park-exploration-familiar', title: '놀이동산 지역 탐험도 [익숙함] 달성', description: '놀이동산 지역 탐험도를 [익숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'amusement_park', tier: '익숙함' }, rewardDiamonds: 20 },
            { id: 'amusement-park-exploration-close', title: '놀이동산 지역 탐험도 [친숙함] 달성', description: '놀이동산 지역 탐험도를 [친숙함] 이상으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'amusement_park', tier: '친숙함' }, rewardDiamonds: 30 },
            { id: 'amusement-park-exploration-conquer', title: '놀이동산 지역 탐험도 [정복] 달성', description: '놀이동산 지역 탐험도를 [정복]으로 달성하세요.', requirement: { type: 'adventure_understanding_tier', stageId: 'amusement_park', tier: '정복' }, rewardDiamonds: 50 },
        ],
    },
    {
        id: MONSTER_CODEX_HUNTER_TRACK_ID,
        title: '몬스터 사냥꾼 업적',
        stages: [
            { id: 'monster-codex-score-50', title: '몬스터 도감 50점', description: '몬스터 도감 점수 50점을 달성하세요.', requirement: { type: 'adventure_codex_score', score: 50 }, rewardDiamonds: 10 },
            { id: 'monster-codex-score-100', title: '몬스터 도감 100점', description: '몬스터 도감 점수 100점을 달성하세요.', requirement: { type: 'adventure_codex_score', score: 100 }, rewardDiamonds: 20 },
            { id: 'monster-codex-score-200', title: '몬스터 도감 200점', description: '몬스터 도감 점수 200점을 달성하세요.', requirement: { type: 'adventure_codex_score', score: 200 }, rewardDiamonds: 50 },
            { id: 'monster-codex-score-350', title: '몬스터 도감 350점', description: '몬스터 도감 점수 350점을 달성하세요.', requirement: { type: 'adventure_codex_score', score: 350 }, rewardDiamonds: 100 },
            { id: 'monster-codex-score-540', title: '몬스터 도감 540점', description: '몬스터 도감 점수 540점을 달성하세요.', requirement: { type: 'adventure_codex_score', score: 540 }, rewardDiamonds: 200 },
        ],
    },
    {
        id: BLACKSMITH_LEVEL_TRACK_ID,
        title: '대장장이 업적',
        stages: [
            { id: 'blacksmith-level-2', title: '대장간 레벨 2 달성', description: '대장간 레벨 2에 도달하세요.', requirement: { type: 'blacksmith_level', level: 2 }, rewardDiamonds: 10 },
            { id: 'blacksmith-level-5', title: '대장간 레벨 5 달성', description: '대장간 레벨 5에 도달하세요.', requirement: { type: 'blacksmith_level', level: 5 }, rewardDiamonds: 50 },
            { id: 'blacksmith-level-10', title: '대장간 레벨 10 달성', description: '대장간 레벨 10에 도달하세요.', requirement: { type: 'blacksmith_level', level: 10 }, rewardDiamonds: 100 },
            { id: 'blacksmith-level-15', title: '대장간 레벨 15 달성', description: '대장간 레벨 15에 도달하세요.', requirement: { type: 'blacksmith_level', level: 15 }, rewardDiamonds: 100 },
            { id: 'blacksmith-level-20', title: '대장간 레벨 20 달성', description: '대장간 레벨 20에 도달하세요.', requirement: { type: 'blacksmith_level', level: 20 }, rewardDiamonds: 100 },
        ],
    },
];

export const ACHIEVEMENT_TRACK_MAP: Record<string, AchievementTrackDefinition> = ACHIEVEMENT_TRACKS.reduce((acc, track) => {
    acc[track.id] = track;
    return acc;
}, {} as Record<string, AchievementTrackDefinition>);
