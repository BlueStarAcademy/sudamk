import { GameMode } from '../types/enums.js';
import type { GameSettings } from '../types/entities.js';

/** `adventureMonstersCodex`의 `isAdventureBoss`와 동기화 — 놀이동산 19줄·고보상 전용 */
export const ADVENTURE_BOSS_CODEX_IDS = new Set<string>(['amuse_09']);

export type AdventureMonsterBattleModeKey = 'classic' | 'capture' | 'base' | 'hidden' | 'missile';

export function isAdventureBossCodexId(codexId: string): boolean {
    return ADVENTURE_BOSS_CODEX_IDS.has(codexId);
}

/** 몬스터 레벨·챕터 레벨 범위(검증/향후 확장용). 판 크기는 `monsterLevel` 기준 */
export type AdventureBoardSizeLevelContext = {
    monsterLevel: number;
    chapterLevelMin: number;
    chapterLevelMax: number;
};

function adventureLevelNormInChapter(level: number, min: number, max: number): number {
    if (!Number.isFinite(level)) return 0.5;
    if (max <= min) return 0.5;
    return Math.max(0, Math.min(1, (level - min) / (max - min)));
}

/** 동일 인스턴스는 항상 같은 판 크기(스폰~대국 일치) */
export function adventureBoardSizeHashUnit(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 2 ** 32;
}

/**
 * 몬스터 레벨(1~50) + 결정론 난수 u∈[0,1) → 판 줄 수.
 * 분기 구간은 `mapMonsterInstanceId` 해시로 동일 인스턴스마다 고정.
 */
export function adventureBoardSizeFromMonsterLevel(monsterLevel: number, u: number): 7 | 9 | 11 | 13 | 19 {
    const lv = Math.max(1, Math.min(50, Math.floor(monsterLevel)));
    const r = Number.isFinite(u) ? Math.max(0, Math.min(0.999999999, u)) : 0;
    if (lv <= 2) return 7;
    if (lv <= 4) return 11;
    if (lv <= 9) return 9;
    if (lv === 10) return 13;
    if (lv <= 15) return r < 0.5 ? 9 : 13;
    if (lv <= 19) return r < 0.2 ? 9 : 13;
    if (lv <= 45) return 13;
    if (lv <= 49) return r < 0.5 ? 13 : 19;
    return 19;
}

/** 챕터 레벨 구간 안에서 나올 수 있는 판 크기 최소·최대(보상 미리보기 등) */
export function getAdventureBoardSizeExtentForMonsterLevels(lvMin: number, lvMax: number): { min: number; max: number } {
    const lo = Math.max(1, Math.min(50, Math.floor(lvMin)));
    const hi = Math.max(1, Math.min(50, Math.floor(lvMax)));
    if (hi < lo) return { min: 9, max: 9 };
    const samples = [0, 0.1, 0.19, 0.2, 0.25, 0.4, 0.49, 0.5, 0.51, 0.65, 0.8, 0.99];
    let minB = 19;
    let maxB = 7;
    for (let lv = lo; lv <= hi; lv++) {
        for (const s of samples) {
            const b = adventureBoardSizeFromMonsterLevel(lv, s);
            minB = Math.min(minB, b);
            maxB = Math.max(maxB, b);
        }
    }
    return { min: minB, max: maxB };
}

/**
 * 스테이지·도감·맵 몬스터 인스턴스 id로 판 크기 결정.
 * `levelCtx`가 있으면 몬스터 레벨 표만 사용(스테이지 무관). 없으면 구형 스테이지 기반 폴백.
 */
export function resolveAdventureBoardSize(
    stageId: string,
    codexId: string,
    mapMonsterInstanceId: string,
    levelCtx?: AdventureBoardSizeLevelContext | null,
): number {
    const key = `${stageId}|${codexId}|${mapMonsterInstanceId}`;
    const u = adventureBoardSizeHashUnit(key);

    if (levelCtx != null && Number.isFinite(levelCtx.monsterLevel)) {
        return adventureBoardSizeFromMonsterLevel(levelCtx.monsterLevel, u);
    }

    const boss = isAdventureBossCodexId(codexId);
    const t = levelCtx
        ? adventureLevelNormInChapter(levelCtx.monsterLevel, levelCtx.chapterLevelMin, levelCtx.chapterLevelMax)
        : null;
    const pPreferLarger = t == null ? 0.5 : Math.min(1, Math.max(0, 0.12 + 0.88 * t));

    switch (stageId) {
        case 'neighborhood_hill':
            return 7;
        case 'lake_park':
            return 9;
        case 'aquarium':
            return u < pPreferLarger ? 11 : 9;
        case 'zoo':
            return u < pPreferLarger ? 13 : 11;
        case 'amusement_park':
            if (boss) {
                return u < pPreferLarger ? 19 : 13;
            }
            return 13;
        default:
            return 9;
    }
}

/** 19줄: 따내기·베이스·히든 불가 */
export function getAdventureAllowedBattleModes(boardSize: number): AdventureMonsterBattleModeKey[] {
    if (boardSize === 19) {
        return ['classic', 'missile'];
    }
    return ['classic', 'capture', 'base', 'hidden', 'missile'];
}

type BoardRuleRow = {
    scoringTurnLimit: number;
    captureTarget?: number;
    baseStones?: number;
    hiddenStoneCount?: number;
    scanCount?: number;
    missileCount?: number;
};

/** 모험 몬스터 대국: 경기 전체 카운트다운(분). 경기 시작(CONFIRM) 시점부터 적용 */
const ADVENTURE_ENCOUNTER_COUNTDOWN_MINUTES: Record<number, number> = {
    7: 5,
    9: 10,
    11: 12,
    13: 13,
    19: 30,
};

export function getAdventureEncounterCountdownMinutes(boardSize: number): number {
    return ADVENTURE_ENCOUNTER_COUNTDOWN_MINUTES[boardSize] ?? 10;
}

const ADVENTURE_BOARD_RULES: Record<7 | 9 | 11 | 13 | 19, BoardRuleRow> = {
    7: {
        scoringTurnLimit: 30,
        captureTarget: 5,
        baseStones: 2,
        hiddenStoneCount: 1,
        scanCount: 1,
        missileCount: 1,
    },
    9: {
        scoringTurnLimit: 40,
        captureTarget: 6,
        baseStones: 3,
        hiddenStoneCount: 1,
        scanCount: 1,
        missileCount: 1,
    },
    11: {
        scoringTurnLimit: 60,
        captureTarget: 8,
        baseStones: 3,
        hiddenStoneCount: 1,
        scanCount: 2,
        missileCount: 2,
    },
    13: {
        scoringTurnLimit: 80,
        captureTarget: 10,
        baseStones: 4,
        hiddenStoneCount: 1,
        scanCount: 3,
        missileCount: 3,
    },
    19: {
        scoringTurnLimit: 200,
        missileCount: 3,
    },
};

/** 맵·도감 풍선용 — 판 줄·계가·룰별 수치 한 줄씩 */
export function formatAdventureBattleQuickLines(boardSize: number, mode: GameMode): string[] {
    const bs = boardSize as 7 | 9 | 11 | 13 | 19;
    const r = ADVENTURE_BOARD_RULES[bs];
    if (!r) return [`${boardSize}줄`];
    const lines: string[] = [`${boardSize}줄 판`, `계가 ${r.scoringTurnLimit}수`];
    switch (mode) {
        case GameMode.Capture:
            if (typeof r.captureTarget === 'number') lines.push(`따내기 ${r.captureTarget}돌`);
            break;
        case GameMode.Base:
            if (typeof r.baseStones === 'number') lines.push(`베이스 돌 ${r.baseStones}개`);
            break;
        case GameMode.Hidden:
            if (typeof r.hiddenStoneCount === 'number') lines.push(`히든${r.hiddenStoneCount}개`);
            if (typeof r.scanCount === 'number') lines.push(`스캔 ${r.scanCount}회`);
            break;
        case GameMode.Missile:
            if (typeof r.missileCount === 'number') lines.push(`미사일${r.missileCount}개`);
            break;
        case GameMode.Standard:
        case GameMode.Speed:
        default:
            break;
    }
    return lines;
}

export function applyAdventureStrategicGameSettings(settings: GameSettings, boardSize: number, mode: GameMode): void {
    const bs = boardSize as 7 | 9 | 11 | 13 | 19;
    const r = ADVENTURE_BOARD_RULES[bs];
    if (!r) {
        return;
    }
    settings.boardSize = bs;
    settings.timeLimit = getAdventureEncounterCountdownMinutes(boardSize);
    settings.byoyomiCount = 0;
    settings.byoyomiTime = 0;

    switch (mode) {
        case GameMode.Capture:
            if (typeof r.captureTarget === 'number') {
                settings.captureTarget = r.captureTarget;
            }
            break;
        case GameMode.Base:
            if (typeof r.baseStones === 'number') {
                settings.baseStones = r.baseStones;
            }
            settings.scoringTurnLimit = r.scoringTurnLimit;
            break;
        case GameMode.Hidden:
            if (typeof r.hiddenStoneCount === 'number') {
                settings.hiddenStoneCount = r.hiddenStoneCount;
            }
            if (typeof r.scanCount === 'number') {
                settings.scanCount = r.scanCount;
            }
            settings.scoringTurnLimit = r.scoringTurnLimit;
            break;
        case GameMode.Missile:
            if (typeof r.missileCount === 'number') {
                settings.missileCount = r.missileCount;
            }
            settings.scoringTurnLimit = r.scoringTurnLimit;
            break;
        case GameMode.Standard:
        case GameMode.Speed:
        default:
            settings.scoringTurnLimit = r.scoringTurnLimit;
            break;
    }
}
