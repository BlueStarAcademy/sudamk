import {
    ADVENTURE_MONSTERS_AQUARIUM,
    ADVENTURE_MONSTERS_AMUSEMENT_PARK,
    ADVENTURE_MONSTERS_LAKE_PARK,
    ADVENTURE_MONSTERS_NEIGHBORHOOD_HILL,
    ADVENTURE_MONSTERS_ZOO,
} from './adventureMonstersCodex.js';
import { GameMode } from '../types/index.js';

export type AdventureMonsterBattleMode = 'classic' | 'capture' | 'base' | 'hidden' | 'missile';

/** 맵 몬스터 룰 → 전략바둑 `GameMode` */
export function adventureBattleModeToGameMode(mode: AdventureMonsterBattleMode): GameMode {
    switch (mode) {
        case 'classic':
            return GameMode.Standard;
        case 'capture':
            return GameMode.Capture;
        case 'base':
            return GameMode.Base;
        case 'hidden':
            return GameMode.Hidden;
        case 'missile':
            return GameMode.Missile;
        default:
            return GameMode.Standard;
    }
}

/** 몬스터 레벨에 따른 장비 상자 최고 등급(로마 숫자 상한) — 재료 상한과 별도 곡선 */
export function adventureMaxEquipmentBoxTier(level: number): 1 | 2 | 3 | 4 {
    const lv = Math.max(1, Math.min(50, Math.floor(level)));
    if (lv <= 8) return 1;
    if (lv <= 20) return 2;
    if (lv <= 35) return 3;
    return 4;
}

/** 몬스터 레벨에 따른 재료 상자 최고 등급(로마 숫자 상한) */
export function adventureMaxMaterialBoxTier(level: number): 1 | 2 | 3 | 4 {
    const lv = Math.max(1, Math.min(50, Math.floor(level)));
    if (lv <= 6) return 1;
    if (lv <= 15) return 2;
    if (lv <= 28) return 3;
    return 4;
}

/** 승리 골드에 곱하는 레벨 계수(대략 0.4~1.15) */
export function adventureMonsterGoldLevelMultiplier(level: number): number {
    const lv = Math.max(1, Math.min(50, Math.floor(level)));
    return 0.4 + (lv / 50) * 0.75;
}

/** 모험 스테이지 입장 카드 (맵 webp — 로비·맵 화면·인게임 배경 공용) */
export const ADVENTURE_STAGES = [
    {
        id: 'neighborhood_hill',
        title: '동네뒷산',
        stageIndex: 1,
        mapWebp: '/images/forest.webp',
        monsters: ADVENTURE_MONSTERS_NEIGHBORHOOD_HILL,
        /** 로비 카드 짧은 한 줄 스토리 */
        lobbyStoryLine: '숲이 속삭여요—반짝 바둑돌 길, 끝이 궁금해요!',
    },
    {
        id: 'lake_park',
        title: '호수공원',
        stageIndex: 2,
        mapWebp: '/images/lakesidepark.webp',
        monsters: ADVENTURE_MONSTERS_LAKE_PARK,
        lobbyStoryLine: '호수 별빛이 수수께끼를 속삭여요.',
    },
    {
        id: 'aquarium',
        title: '아쿠아리움',
        stageIndex: 3,
        mapWebp: '/images/aquarium.webp',
        monsters: ADVENTURE_MONSTERS_AQUARIUM,
        lobbyStoryLine: '인어의 한마디—「보물은 반짝 돌이 아니란다.」',
    },
    {
        id: 'zoo',
        title: '동물원',
        stageIndex: 4,
        mapWebp: '/images/zoo.webp',
        monsters: ADVENTURE_MONSTERS_ZOO,
        lobbyStoryLine: '밤엔 동물 친구도 바둑! 누가 먼저 둘까?',
    },
    {
        id: 'amusement_park',
        title: '놀이동산',
        stageIndex: 5,
        mapWebp: '/images/amusementpark.webp',
        monsters: ADVENTURE_MONSTERS_AMUSEMENT_PARK,
        lobbyStoryLine: '멜로디 끝—하늘이 바둑판을 내려줘요!',
    },
] as const;

export type AdventureStageId = (typeof ADVENTURE_STAGES)[number]['id'];

export function getAdventureStageById(id: string | null | undefined) {
    if (!id) return undefined;
    return ADVENTURE_STAGES.find((s) => s.id === id);
}

/** 인게임 `gameCategory === 'adventure'` + `adventureStageId` 배경용 */
export function getAdventureMapWebpPath(stageId: string | null | undefined): string | null {
    const s = getAdventureStageById(stageId ?? undefined);
    return s?.mapWebp ?? null;
}

/** 스테이지 맵 오버레이(격자·비네트) — 16:9 맵 캔버스 */
export const ADVENTURE_MAP_THEMES: Record<AdventureStageId, { gridColor: string; fog: string }> = {
    neighborhood_hill: {
        gridColor: 'rgba(255,255,255,0.06)',
        fog: 'rgba(15, 36, 25, 0.25)',
    },
    lake_park: {
        gridColor: 'rgba(186, 230, 253, 0.07)',
        fog: 'rgba(12, 33, 55, 0.3)',
    },
    aquarium: {
        gridColor: 'rgba(147, 197, 253, 0.06)',
        fog: 'rgba(15, 23, 42, 0.35)',
    },
    zoo: {
        gridColor: 'rgba(254, 243, 199, 0.06)',
        fog: 'rgba(28, 20, 8, 0.28)',
    },
    amusement_park: {
        gridColor: 'rgba(232, 121, 249, 0.07)',
        fog: 'rgba(30, 16, 51, 0.32)',
    },
};

/** 몬스터 도감 모달 — 챕터 분위기에 맞는 배경·카드 톤 (Tailwind 클래스 전체 문자열) */
export const ADVENTURE_CODEX_CHAPTER_UI: Record<
    AdventureStageId,
    {
        /** 탭 패널·본문 큰 배경 */
        panelClass: string;
        /** 개별 몬스터 카드 표면 */
        cardClass: string;
        /** 이미지 박스 상단 이름 바 */
        nameBarClass: string;
        /** 선택된 챕터 탭 */
        tabSelectedClass: string;
        /** 비선택 탭 hover 시 챕터 힌트 */
        tabIdleHoverClass: string;
        /** 도감 문장 앞 동그라미 */
        bulletClass: string;
    }
> = {
    neighborhood_hill: {
        panelClass:
            'border-emerald-500/20 bg-gradient-to-br from-emerald-950/88 via-green-950/82 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        cardClass: 'border-emerald-500/20 bg-emerald-950/20',
        nameBarClass: 'from-emerald-800/95 to-emerald-950/98 border-b border-emerald-950/40',
        tabSelectedClass:
            'border-emerald-400/55 bg-emerald-500/20 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        tabIdleHoverClass: 'hover:border-emerald-500/35 hover:text-emerald-100/90',
        bulletClass: 'bg-emerald-400/80',
    },
    lake_park: {
        panelClass:
            'border-sky-500/20 bg-gradient-to-br from-sky-950/88 via-blue-950/85 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        cardClass: 'border-sky-500/20 bg-sky-950/22',
        nameBarClass: 'from-sky-800/95 to-sky-950/98 border-b border-sky-950/45',
        tabSelectedClass:
            'border-sky-400/55 bg-sky-500/20 text-sky-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        tabIdleHoverClass: 'hover:border-sky-500/35 hover:text-sky-100/90',
        bulletClass: 'bg-sky-400/80',
    },
    aquarium: {
        panelClass:
            'border-cyan-500/20 bg-gradient-to-br from-slate-950/92 via-blue-950/88 to-cyan-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        cardClass: 'border-cyan-500/20 bg-cyan-950/18',
        nameBarClass: 'from-cyan-900/95 to-slate-950/98 border-b border-cyan-950/40',
        tabSelectedClass:
            'border-cyan-400/55 bg-cyan-500/18 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        tabIdleHoverClass: 'hover:border-cyan-500/35 hover:text-cyan-100/90',
        bulletClass: 'bg-cyan-400/80',
    },
    zoo: {
        panelClass:
            'border-amber-500/25 bg-gradient-to-br from-amber-950/88 via-yellow-950/75 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        cardClass: 'border-amber-500/20 bg-amber-950/18',
        nameBarClass: 'from-amber-800/95 to-amber-950/98 border-b border-amber-950/45',
        tabSelectedClass:
            'border-amber-400/55 bg-amber-500/22 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        tabIdleHoverClass: 'hover:border-amber-500/35 hover:text-amber-100/90',
        bulletClass: 'bg-amber-400/80',
    },
    amusement_park: {
        panelClass:
            'border-fuchsia-500/22 bg-gradient-to-br from-purple-950/90 via-fuchsia-950/85 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        cardClass: 'border-fuchsia-500/20 bg-fuchsia-950/16',
        nameBarClass: 'from-fuchsia-800/95 to-purple-950/98 border-b border-purple-950/45',
        tabSelectedClass:
            'border-fuchsia-400/55 bg-fuchsia-500/18 text-fuchsia-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        tabIdleHoverClass: 'hover:border-fuchsia-500/35 hover:text-fuchsia-100/90',
        bulletClass: 'bg-fuchsia-400/80',
    },
};

export const ADVENTURE_MONSTER_MODE_LABELS: Record<AdventureMonsterBattleMode, string> = {
    classic: '클래식',
    capture: '따내기',
    base: '베이스',
    hidden: '히든',
    missile: '미사일',
};

/** 맵·챕터 목록 등에서 몬스터 이름 옆 한 글자 룰 표기 */
export const ADVENTURE_MONSTER_MODE_BADGE_SHORT: Record<AdventureMonsterBattleMode, string> = {
    classic: '클',
    capture: '따',
    base: '베',
    hidden: '히',
    missile: '미',
};

export const ADVENTURE_MONSTER_MODES: readonly AdventureMonsterBattleMode[] = [
    'classic',
    'capture',
    'base',
    'hidden',
    'missile',
];

/** 스테이지 N → 몬스터 레벨 (N*10-9)~(N*10) */
export function getAdventureStageLevelRange(stageIndex: number): { min: number; max: number } {
    const s = Math.max(1, Math.min(5, Math.floor(stageIndex)));
    const min = (s - 1) * 10 + 1;
    return { min, max: min + 9 };
}

/** 맵 위 몬스터 앵커 간 최소 거리(% 좌표, 유클리드) — 서로 겹치지 않게 */
export const ADVENTURE_MAP_MONSTER_MIN_DISTANCE_PCT = 12;

/** 몬스터 스폰 X 구간(맵 가로 %) */
export const ADVENTURE_MAP_MONSTER_SPAWN_X_PCT = { min: 14, max: 86 } as const;

/** 좌측 맵 오버레이 패널과 겹치지 않도록 스폰 X%(왼쪽) 하한 — `ADVENTURE_MAP_MONSTER_SPAWN_X_PCT.min`과 비교해 큰 값 사용 */
export const ADVENTURE_MAP_MONSTER_SPAWN_X_MIN_EXCLUDING_LEFT_PANEL = 30;

/** 몬스터 스폰 Y 구간(맵 세로 % — 하단 길·지면 쪽에 최대한 몰아서 배치) */
export const ADVENTURE_MAP_MONSTER_SPAWN_Y_PCT = { min: 66, max: 93 } as const;

/** 겹침 회피 시 랜덤 위치 시도 횟수 */
export const ADVENTURE_MAP_MONSTER_SPAWN_MAX_TRIES = 72;

/** 맵에 머무는 시간(만료까지) — 모든 몬스터 동일 — `shared/utils/adventureMapSchedule` 절대 스케줄과 동기 */
export const ADVENTURE_MONSTER_MAP_STAY_MS = 20 * 60 * 1000;

/** 일반 몬스터: 스케줄상 비출현(재출현 간격) 구간 길이 10~15분 — 종·스테이지별 해시로 고정 */
export const ADVENTURE_MONSTER_RESPAWN_NORMAL_MIN_MS = 10 * 60 * 1000;
export const ADVENTURE_MONSTER_RESPAWN_NORMAL_MAX_MS = 15 * 60 * 1000;

/** 챕터 보스: 비출현 구간 30분 고정 */
export const ADVENTURE_MONSTER_RESPAWN_BOSS_MS = 30 * 60 * 1000;

// --- 지역 이해도 (아이온2 종족 이해도처럼 지역(스테이지)별 누적 XP → 티어 → 패시브 보너스) ---

/**
 * 단계별 필요 이해도 XP(증분).
 * 예) [80, 160, 280, 480]이면:
 * 0→1은 80, 1→2는 160, 2→3은 280, 3→4는 480 필요.
 */
export const ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP = [80, 160, 280, 480] as const;

/** 누적 이해도 XP 하한(해당 값 이상이면 티어). 0=낯섬, 1=편함 … */
export const ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS = [
    0,
    ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[0],
    ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[0] + ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[1],
    ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[0] + ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[1] + ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[2],
    ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[0] +
        ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[1] +
        ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[2] +
        ADVENTURE_UNDERSTANDING_TIER_REQUIRED_XP[3],
] as const;

export const ADVENTURE_UNDERSTANDING_TIER_LABELS = ['낯섬', '편함', '익숙함', '친숙함', '정복'] as const;

export type AdventureUnderstandingTierIndex = 0 | 1 | 2 | 3 | 4;

export function getAdventureUnderstandingTierFromXp(xp: number): AdventureUnderstandingTierIndex {
    const x = Math.max(0, Math.floor(xp));
    let tier: AdventureUnderstandingTierIndex = 0;
    for (let i = ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
        if (x >= ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[i]) {
            tier = i as AdventureUnderstandingTierIndex;
            break;
        }
    }
    return tier;
}

export function getAdventureUnderstandingTierProgress(xp: number): {
    tier: AdventureUnderstandingTierIndex;
    currentInTier: number;
    neededInTier: number;
} {
    const x = Math.max(0, Math.floor(xp));
    const tier = getAdventureUnderstandingTierFromXp(x);
    const curThreshold = ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier];
    const nextThreshold =
        tier < ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS.length - 1
            ? ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier + 1]
            : null;
    if (nextThreshold == null || nextThreshold <= curThreshold) {
        return { tier, currentInTier: 0, neededInTier: 0 };
    }
    return {
        tier,
        currentInTier: Math.max(0, x - curThreshold),
        neededInTier: Math.max(1, nextThreshold - curThreshold),
    };
}

/** 이해도 2티어 이상인 지역 수에 비례해 표시하는 “코어 능력치 유효” 보너스 상한(%) */
export const ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP = 3;

/**
 * 지역 이해도 XP 구간 끝점(티어 경계와 동일). 구간 안에서는 아래 `SHARED_BONUS_PERCENT_KNOTS`로 선형 보간되어
 * 챕터 1만 플레이해도 골드·장비·고급장비·재료·고급재료가 함께 서서히 오릅니다.
 */
export const ADVENTURE_UNDERSTANDING_SHARED_BONUS_XP_KNOTS = [0, 80, 240, 520, 1000] as const;

/**
 * `SHARED_BONUS_XP_KNOTS`와 같은 길이: 해당 XP에 도달한 지역 1곳이 합산 풀에 더하는 공통 %(지역당).
 * 실제 적용은 `getAdventureUnderstandingSharedBonusPercentForStageXp`로 보간.
 * 합산된 공통 값을 골드·장비·고급장비·재료·고급재료에 동일하게 더하되 항목별 상한만 별도.
 */
export const ADVENTURE_UNDERSTANDING_SHARED_BONUS_PERCENT_KNOTS = [0, 0.15, 0.45, 0.95, 3] as const;

/** 모든 스테이지에서 합산한 공통 보너스에 대한 모험 골드 +% 상한 */
export const ADVENTURE_UNDERSTANDING_GOLD_BONUS_CAP = 15;

/** 공통 합산에 대한 장비 상자 드롭 +% 상한 */
export const ADVENTURE_UNDERSTANDING_EQUIPMENT_DROP_BONUS_CAP = 8;

/** 공통 합산에 대한 II·III·IV급 장비 상자 가중 +% 상한 */
export const ADVENTURE_UNDERSTANDING_HIGH_GRADE_EQUIP_CAP = 4;

/** 공통 합산에 대한 재료 상자 드롭 +% 상한 */
export const ADVENTURE_UNDERSTANDING_MATERIAL_DROP_BONUS_CAP = 8;

/** 공통 합산에 대한 II·III·IV급 재료 상자 가중 +% 상한 */
export const ADVENTURE_UNDERSTANDING_HIGH_GRADE_MATERIAL_CAP = 4;

/** 스테이지 한 곳의 이해도 XP → 공통 모험 보상 보너스 %(보간). 5지역×전설 구간 ≈ 골드 상한 15%에 맞춤 */
export function getAdventureUnderstandingSharedBonusPercentForStageXp(xp: number): number {
    const x = Math.max(0, Math.floor(xp));
    const xKnots = ADVENTURE_UNDERSTANDING_SHARED_BONUS_XP_KNOTS;
    const yKnots = ADVENTURE_UNDERSTANDING_SHARED_BONUS_PERCENT_KNOTS;
    const last = xKnots.length - 1;
    if (last < 0) return 0;
    if (x >= xKnots[last]) {
        return yKnots[last] ?? 0;
    }
    for (let i = 0; i < last; i++) {
        const x0 = xKnots[i]!;
        const x1 = xKnots[i + 1]!;
        if (x >= x0 && x < x1) {
            const y0 = yKnots[i]!;
            const y1 = yKnots[i + 1]!;
            return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
    }
    return 0;
}

/** 입장 카드 권장 가로세로 비 (와이드 배너) */
export const ADVENTURE_LOBBY_CARD_ASPECT = 'aspect-[16/7]';
