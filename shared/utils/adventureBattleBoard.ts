import { GameMode } from '../types/enums.js';
import type { GameSettings } from '../types/entities.js';

/** `adventureMonstersCodex`의 `isAdventureBoss`와 동기화 — 놀이동산 19줄·고보상 전용 */
export const ADVENTURE_BOSS_CODEX_IDS = new Set<string>(['amuse_09']);

export type AdventureMonsterBattleModeKey = 'classic' | 'capture' | 'base' | 'hidden' | 'missile';

export function isAdventureBossCodexId(codexId: string): boolean {
    return ADVENTURE_BOSS_CODEX_IDS.has(codexId);
}

/** 챕터 내 레벨 구간 — 큰 판 확률이 레벨에 따라 달라짐(클라·서버 동일 입력 필요) */
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
 * 스테이지·도감·맵 몬스터 인스턴스 id로 판 크기 결정.
 * - 놀이동산 비보스: 항상 13줄
 * - 놀이동산 보스: 13 또는 19줄
 * - 아쿠아리움·동물원·보스 13/19: `levelCtx`가 있으면 낮은 레벨일수록 작은 판, 높을수록 큰 판에 가깝게 편향
 */
export function resolveAdventureBoardSize(
    stageId: string,
    codexId: string,
    mapMonsterInstanceId: string,
    levelCtx?: AdventureBoardSizeLevelContext | null,
): number {
    const key = `${stageId}|${codexId}|${mapMonsterInstanceId}`;
    const u = adventureBoardSizeHashUnit(key);
    const boss = isAdventureBossCodexId(codexId);
    const t = levelCtx
        ? adventureLevelNormInChapter(levelCtx.monsterLevel, levelCtx.chapterLevelMin, levelCtx.chapterLevelMax)
        : null;
    /** u가 이 값 미만이면 “큰 쪽” 판(챕터 최소 레벨 ~12%, 최대 레벨 ~100%) */
    const pPreferLarger =
        t == null ? 0.5 : Math.min(1, Math.max(0, 0.12 + 0.88 * t));

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
