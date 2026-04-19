import {
    ADVENTURE_MAP_MONSTER_MIN_DISTANCE_PCT,
    ADVENTURE_MAP_MONSTER_SPAWN_MAX_TRIES,
    ADVENTURE_MAP_MONSTER_SPAWN_X_MIN_EXCLUDING_LEFT_PANEL,
    ADVENTURE_MAP_MONSTER_SPAWN_X_PCT,
    ADVENTURE_MAP_MONSTER_SPAWN_Y_PCT,
} from '../../constants/adventureConstants.js';
import { getKSTDate } from './timeUtils.js';
import type { AdventureMapMonsterInstance } from './adventureMapSchedule.js';
import { fnv1a32 } from './adventureMapSchedule.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 보물상자 맵 체류(출현) 시간 — 매 정시(KST) 구간 내 랜덤 시작 후 10분 */
export const ADVENTURE_MAP_TREASURE_DWELL_MS = 10 * 60 * 1000;

/** 몬스터 목록·도감 상황 탭에서 보물상자 행 선택 시 사용하는 가짜 id */
export const ADVENTURE_MAP_TREASURE_UI_ROW_ID = '__adventure_treasure__';

/** 한 KST 시각 구간(1시간) 안에서 시작할 수 있는 최대 오프셋(초) — 10분 체류가 같은 시간 안에 들어가도록 */
const MAX_OFFSET_SEC_IN_HOUR = 3600 - ADVENTURE_MAP_TREASURE_DWELL_MS / 1000;

export type AdventureMapTreasureChestInstance = {
    id: string;
    /** 동일 창 식별(서버 중복 수령 방지) */
    windowStartMs: number;
    windowEndMs: number;
    xPct: number;
    yPct: number;
    /** 챕터별 베이스 장비상자 이미지(로마 숫자 II~VI) — UI에서 ? 오버레이 */
    equipmentBoxImage: string;
};

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

/** 현재 시각이 속한 KST 정시(해당 KST 시각의 :00:00.000)의 UTC epoch ms */
export function getKstHourStartEpochMs(nowMs: number): number {
    const k = getKSTDate(nowMs);
    return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), k.getUTCHours(), 0, 0, 0) - KST_OFFSET_MS;
}

/** 챕터 인덱스(1~5) → 장비상자 II~VI 베이스 PNG */
export function adventureTreasureChestEquipmentImageForStageIndex(stageIndex: number): string {
    const s = Math.max(1, Math.min(5, Math.floor(stageIndex)));
    const boxNum = s + 1;
    return `/images/Box/EquipmentBox${boxNum}.png`;
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

export type AdventureTreasureWindowMeta = {
    hourStartMs: number;
    windowStartMs: number;
    windowEndMs: number;
    offsetSecInHour: number;
};

/** 현재 KST 정시 구간의 보물상자 절대 출현 창(없으면 null — 계산만, 맵 표시는 `buildAdventureMapTreasureChest` 참고) */
/** 이번 출현 창에서 보물을 건너뛰어(수령 취소) 맵·목록에서 숨김 처리된 상태인지 */
export function adventureTreasureChestDismissedForCurrentWindow(
    stageId: string,
    nowMs: number,
    dismissedByStageId: Partial<Record<string, number>> | null | undefined,
): boolean {
    const meta = getAdventureTreasureChestWindowMeta(stageId, nowMs);
    if (!meta) return false;
    const d = dismissedByStageId?.[stageId];
    return d === meta.windowStartMs;
}

/** 수령 완료·건너뛰기 등으로 이번 출현 창에서 맵·목록에 더 이상 표시하지 않을 때 */
export function adventureTreasureChestHandledForCurrentWindow(
    stageId: string,
    nowMs: number,
    dismissedByStageId: Partial<Record<string, number>> | null | undefined,
    claimedByStageId: Partial<Record<string, number>> | null | undefined,
): boolean {
    const meta = getAdventureTreasureChestWindowMeta(stageId, nowMs);
    if (!meta) return false;
    const ws = meta.windowStartMs;
    return dismissedByStageId?.[stageId] === ws || claimedByStageId?.[stageId] === ws;
}

export function getAdventureTreasureChestWindowMeta(stageId: string, nowMs: number): AdventureTreasureWindowMeta | null {
    const hourStartMs = getKstHourStartEpochMs(nowMs);
    const seed = fnv1a32(`advTreasureHour|${stageId}|${hourStartMs}`);
    const rng = mulberry32(seed);
    const offsetSecInHour = Math.floor(rng() * (MAX_OFFSET_SEC_IN_HOUR + 1));
    const windowStartMs = hourStartMs + offsetSecInHour * 1000;
    const windowEndMs = windowStartMs + ADVENTURE_MAP_TREASURE_DWELL_MS;
    if (nowMs < windowStartMs || nowMs >= windowEndMs) return null;
    return { hourStartMs, windowStartMs, windowEndMs, offsetSecInHour };
}

/**
 * 맵에 표시할 보물상자(몬스터와 동일 좌표 규칙·겹침 회피).
 * `nowMs`가 출현 창 안일 때만 인스턴스를 반환합니다.
 * `mapPositionUserId`가 있으면 좌표 시드에 포함해 유저·출현 창마다 다른 위치가 되도록 합니다.
 */
export function buildAdventureMapTreasureChest(
    stageId: string,
    stageIndex: number,
    nowMs: number,
    mapMonsters: readonly AdventureMapMonsterInstance[],
    opts?: { mapPositionUserId?: string | null },
): AdventureMapTreasureChestInstance | null {
    const meta = getAdventureTreasureChestWindowMeta(stageId, nowMs);
    if (!meta) return null;

    const uid = opts?.mapPositionUserId?.trim() ? opts.mapPositionUserId.trim() : '';
    const seed = fnv1a32(`advTreasurePos|${stageId}|${meta.windowStartMs}|${uid}`);
    const rng = mulberry32(seed);
    const placed = mapMonsters.map((m) => ({ xPct: m.xPct, yPct: m.yPct }));
    const pos = pickNonOverlappingPositionSeeded(placed, rng, false);
    if (!pos) return null;

    return {
        id: `adv-treasure-${stageId}-${meta.windowStartMs}`,
        windowStartMs: meta.windowStartMs,
        windowEndMs: meta.windowEndMs,
        xPct: pos.xPct,
        yPct: pos.yPct,
        equipmentBoxImage: adventureTreasureChestEquipmentImageForStageIndex(stageIndex),
    };
}
