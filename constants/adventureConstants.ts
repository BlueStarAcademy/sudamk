/** 모험 스테이지 입장 카드 (맵 webp — 로비·맵 화면·인게임 배경 공용) */
export const ADVENTURE_STAGES = [
    { id: 'neighborhood_hill', title: '동네뒷산', stageIndex: 1, mapWebp: '/images/forest.webp' },
    { id: 'lake_park', title: '호수공원', stageIndex: 2, mapWebp: '/images/lakesidepark.webp' },
    { id: 'aquarium', title: '아쿠아리움', stageIndex: 3, mapWebp: '/images/aquarium.webp' },
    { id: 'zoo', title: '동물원', stageIndex: 4, mapWebp: '/images/zoo.webp' },
    { id: 'amusement_park', title: '놀이동산', stageIndex: 5, mapWebp: '/images/amusementpark.webp' },
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

/** 몬스터 대전 규칙(표시명 — 실제 GameMode 연동은 추후) */
export type AdventureMonsterBattleMode = 'classic' | 'capture' | 'base' | 'hidden' | 'missile';

export const ADVENTURE_MONSTER_MODE_LABELS: Record<AdventureMonsterBattleMode, string> = {
    classic: '클래식',
    capture: '따내기',
    base: '베이스',
    hidden: '히든',
    missile: '미사일',
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

/** 맵 동시 존재 상한 */
export const ADVENTURE_MAP_MAX_MONSTERS = 8;

/** 자동 스폰 시도 간격(맵이 가득 차 있으면 스킵) */
export const ADVENTURE_MONSTER_SPAWN_INTERVAL_MS = 45_000;

/** 레벨 1 → 10분, 레벨 50 → 1시간 (선형) */
export const ADVENTURE_MONSTER_LIFETIME_MIN_MS = 10 * 60 * 1000;
export const ADVENTURE_MONSTER_LIFETIME_MAX_MS = 60 * 60 * 1000;

/** 공격 성공으로 제거된 슬롯 재등장 대기 */
export const ADVENTURE_MONSTER_RESPAWN_AFTER_DEFEAT_MS = 20 * 60 * 1000;

export function getAdventureMonsterLifetimeMs(level: number): number {
    const lv = Math.max(1, Math.min(50, Math.floor(level)));
    const t = (lv - 1) / 49;
    return Math.round(ADVENTURE_MONSTER_LIFETIME_MIN_MS + t * (ADVENTURE_MONSTER_LIFETIME_MAX_MS - ADVENTURE_MONSTER_LIFETIME_MIN_MS));
}

/**
 * 몬스터 일러스트 (추후 webp 등 배치).
 * 키가 없으면 맵에서 플레이스홀더 박스만 표시.
 * 예: `classic: '/images/adventure/monsters/classic.webp'`
 */
export const ADVENTURE_MONSTER_IMAGE_SRC: Partial<Record<AdventureMonsterBattleMode, string>> = {};

// --- 지역 이해도 (아이온2 종족 이해도처럼 지역(스테이지)별 누적 XP → 티어 → 패시브 보너스) ---

/** 누적 이해도 XP 하한(해당 값 이상이면 티어). 0=낯설음, 1=익숙함 … */
export const ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS = [0, 80, 240, 520, 1000] as const;

export const ADVENTURE_UNDERSTANDING_TIER_LABELS = ['낯설음', '익숙함', '친숙함', '정복자', '전설'] as const;

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

/** 스테이지별 이해도 티어가 주는 모험 골드 보너스(%) — 표시·향후 서버 정산에 동일 적용 권장 */
export const ADVENTURE_UNDERSTANDING_GOLD_BONUS_BY_TIER = [0, 1, 2, 3, 5] as const;

/** 이해도 2티어 이상인 지역 수에 비례해 표시하는 “코어 능력치 유효” 보너스 상한(%) */
export const ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP = 3;

/** 모든 스테이지 골드 보너스 합산 상한(%) */
export const ADVENTURE_UNDERSTANDING_GOLD_BONUS_CAP = 15;

/** 입장 카드 권장 가로세로 비 (와이드 배너) */
export const ADVENTURE_LOBBY_CARD_ASPECT = 'aspect-[16/7]';
