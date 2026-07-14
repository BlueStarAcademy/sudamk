import type { CSSProperties } from 'react';
import type { AdventureStageId } from '../../constants/adventureConstants.js';
import { fnv1a32 } from './adventureMapSchedule.js';
import {
    ADVENTURE_MAP_PATHS,
    adventureMapPathNearestT,
    pointOnAdventureMapPath,
    type AdventureMapPathPoint,
} from './adventureMapPaths.js';

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

function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}

function faceFromDelta(dx: number, fallback: 1 | -1 = 1): 1 | -1 {
    if (dx < -1.2) return -1;
    if (dx > 1.2) return 1;
    return fallback;
}

export type AdventureMapWanderPoint = { x: number; y: number };

/** CSS `--w0`…`--w5` 키프레임 개수 */
export const ADVENTURE_MAP_WANDER_POINT_COUNT = 6;

function pathPointWithLateral(
    stageId: AdventureStageId,
    t: number,
    lateralPct: number,
): AdventureMapPathPoint {
    const path = ADVENTURE_MAP_PATHS[stageId];
    const base = pointOnAdventureMapPath(path.waypoints, clamp01(t));
    const tA = Math.max(0, t - 0.03);
    const tB = Math.min(1, t + 0.03);
    const a = pointOnAdventureMapPath(path.waypoints, tA);
    const b = pointOnAdventureMapPath(path.waypoints, tB);
    const dx = b.xPct - a.xPct;
    const dy = b.yPct - a.yPct;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return {
        xPct: base.xPct + nx * lateralPct,
        yPct: base.yPct + ny * lateralPct,
    };
}

function toSpawnOffsetPx(
    pct: AdventureMapPathPoint,
    spawnPct: AdventureMapPathPoint,
    mapW: number,
    mapH: number,
): AdventureMapWanderPoint {
    return {
        x: ((pct.xPct - spawnPct.xPct) / 100) * mapW,
        y: ((pct.yPct - spawnPct.yPct) / 100) * mapH,
    };
}

/**
 * 스폰 근처 통행로를 따라 왕복·루프·사행하는 배회 경로 (px 오프셋, 스폰 기준).
 * pattern: 0=왕복 순찰, 1=타원 루프, 2=사행 후 복귀
 */
export function buildAdventureMapMonsterWanderPoints(
    monsterId: string,
    mapW: number,
    mapH: number,
    stageId?: AdventureStageId,
    spawnPct?: AdventureMapPathPoint,
): AdventureMapWanderPoint[] {
    const seed = fnv1a32(`advWander|${monsterId}`);
    const rng = mulberry32(seed);
    const n = ADVENTURE_MAP_WANDER_POINT_COUNT;

    if (!(stageId && spawnPct && mapW > 0 && mapH > 0)) {
        const maxX = mapW > 0 ? mapW * (0.045 + rng() * 0.035) : 48;
        const maxY = mapH > 0 ? mapH * (0.028 + rng() * 0.02) : 28;
        const pattern = seed % 3;
        if (pattern === 0) {
            return [
                { x: 0, y: 0 },
                { x: maxX * 0.45, y: -maxY * 0.25 },
                { x: maxX, y: -maxY * 0.1 },
                { x: maxX * 0.55, y: maxY * 0.35 },
                { x: -maxX * 0.35, y: maxY * 0.2 },
                { x: -maxX * 0.15, y: -maxY * 0.15 },
            ];
        }
        if (pattern === 1) {
            return [
                { x: 0, y: 0 },
                { x: maxX * 0.7, y: -maxY * 0.55 },
                { x: maxX * 0.15, y: -maxY },
                { x: -maxX * 0.75, y: -maxY * 0.35 },
                { x: -maxX * 0.55, y: maxY * 0.45 },
                { x: maxX * 0.25, y: maxY * 0.55 },
            ];
        }
        return [
            { x: 0, y: 0 },
            { x: maxX * 0.55, y: maxY * 0.15 },
            { x: maxX * 0.9, y: -maxY * 0.4 },
            { x: 0, y: -maxY * 0.75 },
            { x: -maxX * 0.85, y: -maxY * 0.2 },
            { x: -maxX * 0.4, y: maxY * 0.5 },
        ];
    }

    const path = ADVENTURE_MAP_PATHS[stageId];
    const t0 = adventureMapPathNearestT(stageId, spawnPct);
    const half = path.corridorHalfWidthPct;
    /** 경로 파라미터 왕복 폭 — 예전 0.04~0.09 → 실제 활보 가능한 구간 */
    const span = 0.11 + rng() * 0.17;
    const tLo = clamp01(t0 - span * (0.35 + rng() * 0.35));
    const tHi = clamp01(t0 + span * (0.45 + rng() * 0.4));
    const tMid = (tLo + tHi) / 2;
    const pattern = seed % 3;
    const sideA = (rng() * 2 - 1) * half * (0.55 + rng() * 0.4);
    const sideB = -sideA * (0.55 + rng() * 0.35);

    let ts: number[];
    let laterals: number[];

    if (pattern === 0) {
        // 왕복 순찰: 한쪽 끝 → 반대쪽 → 복귀
        ts = [tLo, tLo + (tMid - tLo) * 0.55, tMid, tHi, tMid + (tHi - tMid) * 0.45, tLo + (tMid - tLo) * 0.25];
        laterals = [sideA * 0.35, sideA * 0.55, sideA * 0.25, sideB * 0.4, sideB * 0.55, sideA * 0.2];
    } else if (pattern === 1) {
        // 타원 루프: 경로를 따라 가며 좌·우 복도를 번갈아 밟음
        ts = [tLo, tMid, tHi, tHi, tMid, tLo];
        laterals = [sideA * 0.7, sideA, sideA * 0.55, sideB * 0.7, sideB, sideB * 0.4];
    } else {
        // 사행: 지그재그로 전진했다가 짧게 돌아와 루프
        const t1 = tLo + (tHi - tLo) * 0.22;
        const t2 = tLo + (tHi - tLo) * 0.48;
        const t3 = tLo + (tHi - tLo) * 0.78;
        ts = [tLo, t1, t2, t3, t2, t1];
        laterals = [sideA * 0.3, sideB * 0.85, sideA * 0.9, sideB * 0.55, sideA * 0.65, sideB * 0.35];
    }

    const points: AdventureMapWanderPoint[] = [];
    for (let i = 0; i < n; i++) {
        const pct = pathPointWithLateral(stageId, ts[i]!, laterals[i]!);
        points.push(toSpawnOffsetPx(pct, spawnPct, mapW, mapH));
    }
    return points;
}

function facesAlongPoints(points: AdventureMapWanderPoint[]): Array<1 | -1> {
    const faces: Array<1 | -1> = [];
    let face: 1 | -1 = 1;
    for (let i = 0; i < points.length; i++) {
        const next = points[(i + 1) % points.length]!;
        const cur = points[i]!;
        face = faceFromDelta(next.x - cur.x, face);
        faces.push(face);
    }
    return faces;
}

/**
 * 맵 몬스터 배회 — 스폰 지점 근처 통행로를 따라 pct→px 오프셋.
 * (부모가 left/top% 에 고정되고, 이 transform 이 길을 따라 이동)
 */
export function buildAdventureMapMonsterWanderStyle(
    monsterId: string,
    mapW: number,
    mapH: number,
    stageId?: AdventureStageId,
    spawnPct?: AdventureMapPathPoint,
): { wanderStyle: CSSProperties; faceStyle: CSSProperties; bobStyle: CSSProperties; walking: boolean } {
    const seed = fnv1a32(`advWander|${monsterId}`);
    const points = buildAdventureMapMonsterWanderPoints(monsterId, mapW, mapH, stageId, spawnPct);
    const faces = facesAlongPoints(points);

    let travel = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        travel += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const walking = travel > 10;

    /** 이동 거리가 클수록 조금 더 길게 — 일정한 보속으로 보이게 */
    const durationSec = Math.max(12, Math.min(26, 11 + travel / 18 + (seed % 5000) / 1000));
    const delaySec = -((seed >>> 10) % 11000) / 1000;
    const bobMs = 320 + (seed % 120);

    const px = (n: number) => `${n.toFixed(2)}px`;
    const wanderStyle: CSSProperties = {
        animationDuration: `${durationSec.toFixed(2)}s`,
        animationDelay: `${delaySec.toFixed(2)}s`,
        ['--w0x' as string]: px(points[0]!.x),
        ['--w0y' as string]: px(points[0]!.y),
        ['--w1x' as string]: px(points[1]!.x),
        ['--w1y' as string]: px(points[1]!.y),
        ['--w2x' as string]: px(points[2]!.x),
        ['--w2y' as string]: px(points[2]!.y),
        ['--w3x' as string]: px(points[3]!.x),
        ['--w3y' as string]: px(points[3]!.y),
        ['--w4x' as string]: px(points[4]!.x),
        ['--w4y' as string]: px(points[4]!.y),
        ['--w5x' as string]: px(points[5]!.x),
        ['--w5y' as string]: px(points[5]!.y),
    };

    const faceStyle: CSSProperties = {
        animationDuration: wanderStyle.animationDuration,
        animationDelay: wanderStyle.animationDelay,
        ['--face0' as string]: String(faces[0]),
        ['--face1' as string]: String(faces[1]),
        ['--face2' as string]: String(faces[2]),
        ['--face3' as string]: String(faces[3]),
        ['--face4' as string]: String(faces[4]),
        ['--face5' as string]: String(faces[5]),
    };

    const bobStyle: CSSProperties = walking
        ? {
              animationDuration: `${bobMs}ms`,
              animationDelay: `${(seed % 200) / 1000}s`,
          }
        : {};

    return { wanderStyle, faceStyle, bobStyle, walking };
}
