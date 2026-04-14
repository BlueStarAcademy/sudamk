import type { AdventureMonsterBattleMode } from '../../constants/adventureConstants.js';
import {
    ADVENTURE_MAP_MONSTER_MIN_DISTANCE_PCT,
    ADVENTURE_MAP_MONSTER_SPAWN_MAX_TRIES,
    ADVENTURE_MAP_MONSTER_SPAWN_X_MIN_EXCLUDING_LEFT_PANEL,
    ADVENTURE_MAP_MONSTER_SPAWN_X_PCT,
    ADVENTURE_MAP_MONSTER_SPAWN_Y_PCT,
    ADVENTURE_MONSTER_MAP_STAY_MS,
    ADVENTURE_MONSTER_RESPAWN_BOSS_MS,
    ADVENTURE_MONSTER_RESPAWN_NORMAL_MAX_MS,
    ADVENTURE_MONSTER_RESPAWN_NORMAL_MIN_MS,
    getAdventureStageLevelRange,
} from '../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import { getAdventureAllowedBattleModes, resolveAdventureBoardSize } from './adventureBattleBoard.js';

/** `adventureProfile.adventureMapSuppressUntilByKey` 키 — stageId·codexId에 `::` 미포함 가정 */
export const ADVENTURE_MAP_SUPPRESS_KEY_SEP = '::' as const;

export function adventureMapSuppressKey(stageId: string, codexId: string): string {
    return `${stageId}${ADVENTURE_MAP_SUPPRESS_KEY_SEP}${codexId}`;
}

export type AdventureMapMonsterInstance = {
    id: string;
    codexId: string;
    level: number;
    mode: AdventureMonsterBattleMode;
    xPct: number;
    yPct: number;
    expiresAt: number;
    spriteSheetWebp: string;
    speciesName: string;
    spriteCols: number;
    spriteRows: number;
    spriteFrameIndex: number;
};

export type AdventureMapStageForSchedule = {
    id: string;
    stageIndex: number;
    monsters: readonly { codexId: string; imageWebp: string; name: string }[];
};

function fnv1a32(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function posInCycle(nowMs: number, phaseMs: number, cycleMs: number): number {
    const c = cycleMs;
    return (((nowMs + phaseMs) % c) + c) % c;
}

export function getAdventureMapCycleParams(
    stageId: string,
    codexId: string,
    isBoss: boolean,
    dwellMultiplier = 1,
    /** 출현 대기 구간(off) 길이 배율 — 0.5~1 권장 */
    offMsMultiplier = 1,
) {
    const mult = Math.max(1, dwellMultiplier);
    const dwell = Math.round(ADVENTURE_MONSTER_MAP_STAY_MS * mult);
    const offBase = isBoss
        ? ADVENTURE_MONSTER_RESPAWN_BOSS_MS
        : ADVENTURE_MONSTER_RESPAWN_NORMAL_MIN_MS +
          (fnv1a32(`${stageId}|${codexId}`) %
              (ADVENTURE_MONSTER_RESPAWN_NORMAL_MAX_MS - ADVENTURE_MONSTER_RESPAWN_NORMAL_MIN_MS + 1));
    const offMs = Math.max(60_000, Math.round(offBase * Math.max(0.25, Math.min(1, offMsMultiplier))));
    const cycle = dwell + offMs;
    const phase = fnv1a32(`advMapPhase|${stageId}|${codexId}`) % cycle;
    return { dwell, offMs, cycle, phase };
}

/** 절대 시각 기준: 스케줄상 맵 체류 구간 안인지(억제 전) */
export function adventureMapIsOnScheduleDwell(
    nowMs: number,
    stageId: string,
    codexId: string,
    isBoss: boolean,
    dwellMultiplier = 1,
    offMsMultiplier = 1,
): boolean {
    const { dwell, cycle, phase } = getAdventureMapCycleParams(stageId, codexId, isBoss, dwellMultiplier, offMsMultiplier);
    return posInCycle(nowMs, phase, cycle) < dwell;
}

/** 처치 직후: 다음 절대 출현 시각(다음 체류 구간 시작) */
export function getAdventureMapSuppressUntilAfterDefeat(
    defeatAtMs: number,
    stageId: string,
    codexId: string,
    isBoss: boolean,
    dwellMultiplier = 1,
    offMsMultiplier = 1,
): number {
    const { dwell, cycle, phase } = getAdventureMapCycleParams(stageId, codexId, isBoss, dwellMultiplier, offMsMultiplier);
    const local = posInCycle(defeatAtMs, phase, cycle);
    if (local < dwell) {
        return defeatAtMs - local + dwell + (cycle - dwell);
    }
    return defeatAtMs + (cycle - local);
}

/** 프로필 억제 + 스케줄 반영 후 실제로 맵에 보이는지 */
export function adventureMapIsEffectivelyVisible(
    nowMs: number,
    stageId: string,
    codexId: string,
    isBoss: boolean,
    suppressUntilMs: number | undefined,
    dwellMultiplier = 1,
    offMsMultiplier = 1,
): boolean {
    if (!adventureMapIsOnScheduleDwell(nowMs, stageId, codexId, isBoss, dwellMultiplier, offMsMultiplier))
        return false;
    if (suppressUntilMs != null && nowMs < suppressUntilMs) return false;
    return true;
}

/**
 * 다음으로 맵에 나타나기까지 남은 ms (0이면 이미 출현 중).
 * 스케줄 + `suppressUntil`(처치 등) 중 더 늦은 시점까지 기다립니다.
 */
export function adventureMapMsUntilNextAppearance(
    nowMs: number,
    stageId: string,
    codexId: string,
    isBoss: boolean,
    suppressUntilMs: number | undefined,
    dwellMultiplier = 1,
    offMsMultiplier = 1,
): number {
    const { dwell, cycle, phase } = getAdventureMapCycleParams(stageId, codexId, isBoss, dwellMultiplier, offMsMultiplier);
    const suppress = suppressUntilMs != null && suppressUntilMs > nowMs ? suppressUntilMs : nowMs;

    let t = suppress;
    for (let i = 0; i < 96; i++) {
        const local = posInCycle(t, phase, cycle);
        if (local < dwell) {
            const visibleAt = t;
            if (visibleAt <= nowMs && (suppressUntilMs == null || nowMs >= suppressUntilMs)) {
                return 0;
            }
            return Math.max(0, visibleAt - nowMs);
        }
        t += cycle - local;
    }
    return Math.max(0, t - nowMs);
}

function distanceSquaredPct(a: { xPct: number; yPct: number }, b: { xPct: number; yPct: number }): number {
    const dx = a.xPct - b.xPct;
    const dy = a.yPct - b.yPct;
    return dx * dx + dy * dy;
}

function groundPositionFromRng(rng: () => number, yLowerHalf: boolean): { xPct: number; yPct: number } {
    const xmin = Math.max(ADVENTURE_MAP_MONSTER_SPAWN_X_PCT.min, ADVENTURE_MAP_MONSTER_SPAWN_X_MIN_EXCLUDING_LEFT_PANEL);
    const xmax = ADVENTURE_MAP_MONSTER_SPAWN_X_PCT.max;
    const { min: ymin, max: ymax } = ADVENTURE_MAP_MONSTER_SPAWN_Y_PCT;
    const ySpan = ymax - ymin;
    const yPct = yLowerHalf ? ymin + ySpan * (0.5 + rng() * 0.5) : ymin + rng() * ySpan;
    return {
        xPct: xmin + rng() * (xmax - xmin),
        yPct,
    };
}

function pickNonOverlappingPositionSeeded(
    existing: readonly { xPct: number; yPct: number }[],
    rng: () => number,
    yLowerHalf: boolean,
): { xPct: number; yPct: number } | null {
    const minD2 = ADVENTURE_MAP_MONSTER_MIN_DISTANCE_PCT * ADVENTURE_MAP_MONSTER_MIN_DISTANCE_PCT;
    for (let t = 0; t < ADVENTURE_MAP_MONSTER_SPAWN_MAX_TRIES; t++) {
        const pos = groundPositionFromRng(rng, yLowerHalf);
        const clash = existing.some((e) => distanceSquaredPct(e, pos) < minD2);
        if (!clash) return pos;
    }
    return null;
}

/**
 * UTC 절대 시각 기준 스케줄로 맵에 올라갈 몬스터 목록(서버 부하 없음 — 순수 계산).
 * 동일 `(stageId, codexId, windowStart)`이면 항상 같은 위치·레벨·룰.
 */
export function buildAdventureMapMonstersFromSchedule(
    stage: AdventureMapStageForSchedule,
    nowMs: number,
    suppressUntilByKey: Readonly<Record<string, number>> | null | undefined,
    mapDwellMultiplierForStage = 1,
    mapRespawnOffMultiplierForStage = 1,
): AdventureMapMonsterInstance[] {
    const { min: lvMin, max: lvMax } = getAdventureStageLevelRange(stage.stageIndex);
    const sorted = [...stage.monsters].sort((a, b) => {
        const ab = isAdventureChapterBossCodexId(a.codexId) ? 1 : 0;
        const bb = isAdventureChapterBossCodexId(b.codexId) ? 1 : 0;
        if (ab !== bb) return ab - bb;
        return a.codexId.localeCompare(b.codexId);
    });
    const placed: { xPct: number; yPct: number }[] = [];
    const out: AdventureMapMonsterInstance[] = [];

    for (const row of sorted) {
        const isBoss = isAdventureChapterBossCodexId(row.codexId);
        const key = adventureMapSuppressKey(stage.id, row.codexId);
        const suppressUntil = suppressUntilByKey?.[key];
        if (
            !adventureMapIsEffectivelyVisible(
                nowMs,
                stage.id,
                row.codexId,
                isBoss,
                suppressUntil,
                mapDwellMultiplierForStage,
                mapRespawnOffMultiplierForStage,
            )
        )
            continue;

        const { dwell, cycle, phase } = getAdventureMapCycleParams(
            stage.id,
            row.codexId,
            isBoss,
            mapDwellMultiplierForStage,
            mapRespawnOffMultiplierForStage,
        );
        const local = posInCycle(nowMs, phase, cycle);
        const windowStart = nowMs - local;
        const windowEnd = windowStart + dwell;

        const seed = fnv1a32(`${stage.id}|${row.codexId}|${windowStart}`);
        const rng = mulberry32(seed);
        const pos = pickNonOverlappingPositionSeeded(placed, rng, isBoss);
        if (!pos) continue;
        placed.push(pos);

        const level = lvMin + Math.floor(rng() * (lvMax - lvMin + 1));
        const id = `adv-abs-${stage.id}-${row.codexId}-${windowStart}`;
        const boardSize = resolveAdventureBoardSize(stage.id, row.codexId, id, {
            monsterLevel: level,
            chapterLevelMin: lvMin,
            chapterLevelMax: lvMax,
        });
        const allowedModes = getAdventureAllowedBattleModes(boardSize);
        if (allowedModes.length === 0) continue;
        const mode = allowedModes[Math.floor(rng() * allowedModes.length)]! as AdventureMonsterBattleMode;

        out.push({
            id,
            codexId: row.codexId,
            level,
            mode,
            xPct: pos.xPct,
            yPct: pos.yPct,
            expiresAt: windowEnd,
            spriteSheetWebp: row.imageWebp,
            speciesName: row.name,
            spriteCols: 1,
            spriteRows: 1,
            spriteFrameIndex: 0,
        });
    }

    return out;
}
