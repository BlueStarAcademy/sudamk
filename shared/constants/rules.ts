import { ActionButton, GameMode } from '../types/index.js';
import { ItemGrade } from '../types/enums.js';

type CombinationGreatSuccessRates = {
    'normal'?: number;
    'uncommon'?: number;
    'rare'?: number;
    'epic'?: number;
    'legendary'?: number;
    'mythic'?: number;
    'transcendent'?: number;
};

// --- User Profile Rules ---
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 6;

// --- Action Point Costs ---
export const STRATEGIC_ACTION_POINT_COST = 5;
export const PLAYFUL_ACTION_POINT_COST = 3;
export const ACTION_POINT_REGEN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// --- Action Point Purchase Costs ---
export const ACTION_POINT_PURCHASE_COSTS_DIAMONDS = [10, 20, 30, 50, 80, 120, 180, 250, 350, 500];
export const MAX_ACTION_POINT_PURCHASES_PER_DAY = 10;
export const ACTION_POINT_PURCHASE_REFILL_AMOUNT = 30;

/** PVP 매너 액션 한 사이클에 동시에 제시되는 선택지 개수 */
export const MANNER_ACTION_BUTTON_CHOICE_COUNT = 5;

// --- Action Buttons by Game Phase ---

// STRATEGIC GAMES
export const STRATEGIC_ACTION_BUTTONS_EARLY: ActionButton[] = [
    { name: '안녕하세요', message: '정중하게 인사를 건넵니다.', type: 'manner' },
    { name: '잘 부탁드립니다', message: '좋은 대국을 기대하며 정중히 부탁합니다.', type: 'manner' },
    { name: '자세 바로잡기', message: '자세를 바로잡고 대국에 집중합니다.', type: 'manner' },
    { name: '물 한 모금', message: '목을 가다듬으며 물을 한 모금 마십니다.', type: 'manner' },
    { name: '집중 다짐', message: '가볍게 주먹을 쥐고 오늘 판에 집중하겠다고 다짐합니다.', type: 'manner' },
    { name: '좋은 승부', message: '서로 존중하는 좋은 승부가 되길 바랍니다.', type: 'manner' },
    { name: '돌 가볍게 두기', message: '바둑돌을 조용히, 가볍게 바둑판에 놓습니다.', type: 'manner' },
    { name: '헛기침하기', message: '헛기침을 하며 목을 가다듬습니다.', type: 'unmannerly' },
    { name: '다리 꼬기', message: '거만하게 다리를 꼬고 상대를 봅니다.', type: 'unmannerly' },
    { name: '탁탁 소리', message: '돌을 탁탁 두드려 주변을 신경 쓰이게 합니다.', type: 'unmannerly' },
    { name: '시계만 보기', message: '상대 말 없이 시계만 힐끗거립니다.', type: 'unmannerly' },
    { name: '자리 흔들기', message: '의자를 흔들어 삐걱거리는 소리를 냅니다.', type: 'unmannerly' },
    { name: '한숨+눈치', message: '한숨과 함께 짜증 난 눈치를 보냅니다.', type: 'unmannerly' },
];

export const STRATEGIC_ACTION_BUTTONS_MID: ActionButton[] = [
    { name: '상대의 묘수 인정', message: '상대의 좋은 수를 인정합니다.', type: 'manner' },
    { name: '차분히 생각', message: '차분하게 다음 수를 생각합니다.', type: 'manner' },
    { name: '판세 인정', message: '불리해도 침착하게 국면을 받아들입니다.', type: 'manner' },
    { name: '경청하기', message: '상대의 의견이 있으면 끝까지 들어줍니다.', type: 'manner' },
    { name: '미소 짓기', message: '긴장을 풀며 가볍게 미소를 짓습니다.', type: 'manner' },
    { name: '다리 떨기', message: '다리를 떨기 시작합니다.', type: 'unmannerly' },
    { name: '바둑돌 만지작', message: '바둑돌을 잘그락거리며 소음을 냅니다.', type: 'unmannerly' },
    { name: '흥얼거리기', message: '콧노래를 부르며 흥얼거립니다.', type: 'unmannerly' },
    { name: '문자하기', message: '휴대폰을 꺼내 문자를 보냅니다.', type: 'unmannerly' },
    { name: '코 훌쩍', message: '크게 코를 훌쩍이며 집중을 깨뜨립니다.', type: 'unmannerly' },
    { name: '중얼거리기', message: '혼잣말로 상대 수를 비꼽습니다.', type: 'unmannerly' },
    { name: '수 비웃기', message: '상대 착수를 보고 코웃음을 칩니다.', type: 'unmannerly' },
];

export const STRATEGIC_ACTION_BUTTONS_LATE: ActionButton[] = [
    { name: '끝까지 집중', message: '끝까지 최선을 다해 집중합니다.', type: 'manner' },
    { name: '계가 신청?', message: '슬슬 끝내자는 눈치를 줍니다.', type: 'manner' },
    { name: '상대 칭찬', message: '상대의 집중력과 실력을 인정합니다.', type: 'manner' },
    { name: 'GG 인사', message: '곧 끝날 판을 앞두고 예의 있게 인사합니다.', type: 'manner' },
    { name: '한숨 쉬기', message: '깊은 한숨을 내쉬며 불만을 표합니다.', type: 'unmannerly' },
    { name: '하품하기', message: '대국이 지겹다는 듯이 하품을 합니다.', type: 'unmannerly' },
    { name: '통화하기', message: '전화를 받으며 대국에 집중하지 않습니다.', type: 'unmannerly' },
    { name: '채팅 비꼬기', message: '채팅으로 상대를 비꼬며 분위기를 망칩니다.', type: 'unmannerly' },
    { name: '무시하기', message: '인사에도 무응답으로 예의를 저버립니다.', type: 'unmannerly' },
    { name: '자리 박차기', message: '거칠게 자리에서 일어나 소음을 냅니다.', type: 'unmannerly' },
];


// PLAYFUL GAMES
export const PLAYFUL_ACTION_BUTTONS_EARLY: ActionButton[] = [
    { name: '손가락 풀기', message: '결전의 시간을 위해 손가락을 풉니다.', type: 'manner' },
    { name: '기원하기', message: '좋은 결과가 있기를 기원합니다.', type: 'manner' },
    { name: '심호흡', message: '크게 심호흡하며 집중력을 높입니다.', type: 'manner' },
    { name: '스트레칭', message: '어깨와 손목을 가볍게 풀어 준비합니다.', type: 'manner' },
    { name: '리스펙트', message: '상대에게 가볍게 고개를 끄덕여 존중을 표합니다.', type: 'manner' },
    { name: '약올리기', message: '상대를 약올리는 표정을 짓습니다.', type: 'unmannerly' },
    { name: '윙크 도발', message: '장난스럽게 윙크하며 도발합니다.', type: 'unmannerly' },
    { name: '혀 차기', message: '혀를 차며 상대를 깎아내립니다.', type: 'unmannerly' },
    { name: '주사위 독차지', message: '상대 차례인데도 주사위를 혼자 굴리려 합니다.', type: 'unmannerly' },
    { name: '자리 흔들기', message: '책상을 흔들어 말이 흔들리게 합니다.', type: 'unmannerly' },
];

export const PLAYFUL_ACTION_BUTTONS_MID: ActionButton[] = [
    { name: '응원하기', message: '좋은 승부를 기대하며 응원합니다.', type: 'manner' },
    { name: '페어파이브', message: '가볍게 손바닥을 마주쳐 호의를 표합니다.', type: 'manner' },
    { name: '실수 인정', message: '내 실수를 솔직하게 인정합니다.', type: 'manner' },
    { name: '책상 쿵!', message: '책상을 쿵! 치며 상대를 놀라게 합니다.', type: 'unmannerly' },
    { name: '입김 불기', message: '주사위/돌에 입김을 불어넣습니다.', type: 'unmannerly' },
    { name: '안타까워하기', message: '자신의 실수를 안타까워합니다.', type: 'unmannerly' },
    { name: '소리 지르기', message: '갑자기 크게 외쳐 분위기를 깨뜨립니다.', type: 'unmannerly' },
    { name: '조롱 세레머니', message: '과장된 세레머니로 상대를 조롱합니다.', type: 'unmannerly' },
    { name: '룰 잡음', message: '사소한 규칙으로 상대를 잡으려 듭니다.', type: 'unmannerly' },
];

export const PLAYFUL_ACTION_BUTTONS_LATE: ActionButton[] = [
    { name: '거의 다왔다!', message: '승리가 눈 앞에 있다는 듯 미소짓습니다.', type: 'manner' },
    { name: '멋진 한 판', message: '승패를 떠나 재미있는 한 판이었다고 말합니다.', type: 'manner' },
    { name: '재경기?', message: '다음 판을 정중히 제안합니다.', type: 'manner' },
    { name: 'GG', message: '예의 있게 GG를 건넵니다.', type: 'manner' },
    { name: '초조해하기', message: '초조한 듯 손톱을 물어뜯습니다.', type: 'unmannerly' },
    { name: '상대 실수 기원', message: '상대방이 실수하기를 간절히 기도합니다.', type: 'unmannerly' },
    { name: '결과 불복', message: '운 탓, 룰 탓으로 결과를 부정합니다.', type: 'unmannerly' },
    { name: '최후의 도발', message: '끝나가는 순간까지 상대를 자극합니다.', type: 'unmannerly' },
    { name: '탈주 눈치', message: '패배가 보이자 연결만 보며 자리를 피하려 합니다.', type: 'unmannerly' },
];

// --- No Contest Rules ---
/** 전략 PVP: 유효 착수(패 제외)가 이 값 미만일 때 기권·계가 요청 시 무효 대국 (UI「10수 미만」과 동일) */
export const NO_CONTEST_MOVE_THRESHOLD = 10;
export const NO_CONTEST_TIME_THRESHOLD_SECONDS = 180;
export const NO_CONTEST_MANNER_PENALTY = 20;
export const NO_CONTEST_RANKING_PENALTY = 50;

// --- Ranked Matchmaking / ELO Rules ---
export const RANKED_ELO_BASE_SCORE = 1200;
export const RANKED_ELO_K_FACTOR = 32;
export const RANKED_ELO_MIN_CHANGE = 6;
export const RANKED_ELO_MAX_CHANGE = 32;
export const RANKED_MATCH_MAX_RATING_DIFF = 400;

// --- Blacksmith XP Gain ---
// XP = ACTION_BASE × GRADE_MULT × STAR_FACTOR × Uniform(1−V, 1+V); VIP ×1.5 is applied by callers.
export const BLACKSMITH_MAX_LEVEL = 20;

export type BlacksmithXpAction = 'enhance' | 'disassemble' | 'combine';

/** Grade scale for XP; high tiers grow slower than a pure exponential so late gear does not flood XP. */
export const BLACKSMITH_XP_GRADE_MULT: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 1,
    [ItemGrade.Uncommon]: 2,
    [ItemGrade.Rare]: 3,
    [ItemGrade.Epic]: 5,
    [ItemGrade.Legendary]: 8,
    [ItemGrade.Mythic]: 12,
    [ItemGrade.Transcendent]: 16,
};

export const BLACKSMITH_XP_ACTION_BASE: Record<BlacksmithXpAction, number> = {
    enhance: 2,
    disassemble: 1,
    combine: 8, // Normal combine expected ≤10 (±15% variance)
};

/** Enhance only: STAR_FACTOR = 1 + bonus × stars (attempt-time stars). */
export const BLACKSMITH_XP_STAR_BONUS_PER_LEVEL = 0.08;

/** Half-width of uniform variance around baseXp (±15%). */
export const BLACKSMITH_XP_VARIANCE = 0.15;

/**
 * Rolls blacksmith XP for one action (before Function VIP).
 * For enhance, pass attempt-time `stars` (before success mutation).
 */
export function computeBlacksmithXpGain(params: {
    action: BlacksmithXpAction;
    grade: ItemGrade;
    stars?: number;
    random?: () => number;
}): number {
    const { action, grade, stars = 0, random = Math.random } = params;
    const gradeMult = BLACKSMITH_XP_GRADE_MULT[grade];
    const actionBase = BLACKSMITH_XP_ACTION_BASE[action];
    if (!Number.isFinite(gradeMult) || !Number.isFinite(actionBase) || gradeMult <= 0 || actionBase <= 0) {
        return 1;
    }
    const starFactor =
        action === 'enhance'
            ? 1 + BLACKSMITH_XP_STAR_BONUS_PER_LEVEL * Math.max(0, Math.floor(Number(stars) || 0))
            : 1;
    const baseXp = actionBase * gradeMult * starFactor;
    const v = BLACKSMITH_XP_VARIANCE;
    const roll = 1 - v + random() * (2 * v);
    return Math.max(1, Math.round(baseXp * roll));
}

export const BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL: ItemGrade[] = [
    ItemGrade.Uncommon, // Level 1: 고급 이하 (Uncommon or lower)
    ItemGrade.Rare,     // Level 2: 희귀 이하 (Rare or lower)
    ItemGrade.Epic,     // Level 3: 에픽 이하 (Epic or lower)
    ItemGrade.Legendary,// Level 4: 전설 이하 (Legendary or lower)
    ItemGrade.Mythic,   // Level 5: 모든 장비 (All equipment)
    ItemGrade.Mythic,   // Level 6
    ItemGrade.Mythic,   // Level 7
    ItemGrade.Mythic,   // Level 8
    ItemGrade.Mythic,   // Level 9
    ItemGrade.Mythic,   // Level 10
    ItemGrade.Mythic,   // Level 11
    ItemGrade.Mythic,   // Level 12
    ItemGrade.Mythic,   // Level 13
    ItemGrade.Mythic,   // Level 14
    ItemGrade.Mythic,   // Level 15
    ItemGrade.Mythic,   // Level 16
    ItemGrade.Mythic,   // Level 17
    ItemGrade.Mythic,   // Level 18
    ItemGrade.Mythic,   // Level 19
    ItemGrade.Mythic,   // Level 20
];

/**
 * 장비 합성 대성공률(%) — 대장간 레벨 L(1~20) 기준.
 * - 일반: L1에 50%, 레벨당 +10%(100% 캡)
 * - 고급: L1에 30%, 레벨당 +10%(100% 캡)
 * - 희귀: L2에 30%, 레벨당 +10%(100% 캡)
 * - 에픽: L3에 30%, 레벨당 +5%(100% 캡)
 * - 전설: L4에 10%, L20에 45% — +2%×16=42%와 불일치하므로 L4~20 구간을 선형(레벨당 +35/16%p)으로 맞춤
 * - 신화: L5에 10%, L20에 35% — +1.5%×15=32.5%와 불일치하므로 L5~20 구간을 선형(레벨당 +25/15%p ≈1.67%p)으로 맞춤
 */
function buildBlacksmithCombinationGreatSuccessRates(): CombinationGreatSuccessRates[] {
    const out: CombinationGreatSuccessRates[] = [];
    for (let L = 1; L <= 20; L++) {
        const row: CombinationGreatSuccessRates = {
            normal: Math.min(100, 50 + (L - 1) * 10),
            uncommon: Math.min(100, 30 + (L - 1) * 10),
        };
        if (L >= 2) row.rare = Math.min(100, 30 + (L - 2) * 10);
        if (L >= 3) row.epic = Math.min(100, 30 + (L - 3) * 5);
        if (L >= 4) row.legendary = Math.min(100, Math.round(10 + (L - 4) * (35 / 16)));
        if (L >= 5) row.mythic = Math.min(100, Math.round(10 + (L - 5) * (25 / 15)));
        out.push(row);
    }
    return out;
}

export const BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES: CombinationGreatSuccessRates[] =
    buildBlacksmithCombinationGreatSuccessRates();

export const BLACKSMITH_DISASSEMBLY_JACKPOT_RATES: number[] = [
    2, 4, 6, 8, 10, 12, 14, 16, 18, 20,
    22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
];

/** XP to advance from `level` → level+1. Quadratic curve; slightly heavier late game than the old piecewise table. */
export const BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP = (level: number): number => {
    if (level < 1) return 0;
    if (level >= BLACKSMITH_MAX_LEVEL) return Infinity;
    return Math.round(900 + 280 * level + 12 * level * level);
};

// --- Equipment Refinement Costs ---
// 골드 비용: 옵션 1개당 비용
export const REFINEMENT_GOLD_COSTS: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 0,        // 일반: 제련 불가
    [ItemGrade.Uncommon]: 100,    // 고급: 100골드
    [ItemGrade.Rare]: 200,         // 희귀: 200골드
    [ItemGrade.Epic]: 350,         // 에픽: 350골드
    [ItemGrade.Legendary]: 500,    // 전설: 500골드
    [ItemGrade.Mythic]: 1000,      // 신화: 1000골드
    [ItemGrade.Transcendent]: 1200,
};

export const calculateRefinementGoldCost = (grade: ItemGrade): number => {
    return REFINEMENT_GOLD_COSTS[grade] || 0;
};