import { SinglePlayerLevel } from '../types/index.js';

/** 모험 스테이지 맵 논리 월드 크기 — 확장 캠페인 맵(3600×1600)에 맞춤 */
export const SINGLE_PLAYER_MAP_WORLD = {
    width: 3600,
    height: 1600,
} as const;

export type SinglePlayerStageMapPoint = { xPct: number; yPct: number };

const STAGE_SLOT_COUNT = 20;

function clampPct(n: number): number {
    return Math.max(4, Math.min(96, n));
}

function clampPoint(p: SinglePlayerStageMapPoint): SinglePlayerStageMapPoint {
    return { xPct: clampPct(p.xPct), yPct: clampPct(p.yPct) };
}

function lerpPoint(
    a: SinglePlayerStageMapPoint,
    b: SinglePlayerStageMapPoint,
    t: number,
): SinglePlayerStageMapPoint {
    return {
        xPct: a.xPct + (b.xPct - a.xPct) * t,
        yPct: a.yPct + (b.yPct - a.yPct) * t,
    };
}

/** Catmull-Rom 스플라인 한 점 (균일 파라미터) */
function catmullRomPoint(
    p0: SinglePlayerStageMapPoint,
    p1: SinglePlayerStageMapPoint,
    p2: SinglePlayerStageMapPoint,
    p3: SinglePlayerStageMapPoint,
    t: number,
): SinglePlayerStageMapPoint {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
        xPct:
            0.5 *
            (2 * p1.xPct +
                (-p0.xPct + p2.xPct) * t +
                (2 * p0.xPct - 5 * p1.xPct + 4 * p2.xPct - p3.xPct) * t2 +
                (-p0.xPct + 3 * p1.xPct - 3 * p2.xPct + p3.xPct) * t3),
        yPct:
            0.5 *
            (2 * p1.yPct +
                (-p0.yPct + p2.yPct) * t +
                (2 * p0.yPct - 5 * p1.yPct + 4 * p2.yPct - p3.yPct) * t2 +
                (-p0.yPct + 3 * p1.yPct - 3 * p2.yPct + p3.yPct) * t3),
    };
}

function segmentLength(a: SinglePlayerStageMapPoint, b: SinglePlayerStageMapPoint): number {
    const dx = b.xPct - a.xPct;
    const dy = b.yPct - a.yPct;
    // 세로 진행을 조금 더 가중해 원근감 있는 길에 맞춤
    return Math.hypot(dx, dy * 1.35);
}

/**
 * 손맵핑된 도로 키포인트를 Catmull-Rom으로 이어 총 길이 기준으로 균등 샘플.
 */
export function sampleAlongRoad(
    road: readonly SinglePlayerStageMapPoint[],
    count: number,
): SinglePlayerStageMapPoint[] {
    if (count <= 0) return [];
    if (road.length === 0) return [];
    if (road.length === 1 || count === 1) return [clampPoint(road[0]!)];

    const pts = road.map(clampPoint);
    const densifyPerSeg = 24;
    const dense: SinglePlayerStageMapPoint[] = [];

    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)]!;
        const p1 = pts[i]!;
        const p2 = pts[i + 1]!;
        const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
        for (let s = 0; s < densifyPerSeg; s++) {
            const t = s / densifyPerSeg;
            dense.push(clampPoint(catmullRomPoint(p0, p1, p2, p3, t)));
        }
    }
    dense.push(pts[pts.length - 1]!);

    const segLens: number[] = [];
    let total = 0;
    for (let i = 0; i < dense.length - 1; i++) {
        const len = segmentLength(dense[i]!, dense[i + 1]!);
        segLens.push(len);
        total += len;
    }
    if (total <= 0) return pts.slice(0, count);

    const out: SinglePlayerStageMapPoint[] = [];
    for (let i = 0; i < count; i++) {
        const target = (i / (count - 1)) * total;
        let acc = 0;
        let placed = false;
        for (let s = 0; s < segLens.length; s++) {
            const next = acc + segLens[s]!;
            if (target <= next || s === segLens.length - 1) {
                const u = segLens[s]! > 0 ? (target - acc) / segLens[s]! : 0;
                out.push(clampPoint(lerpPoint(dense[s]!, dense[s + 1]!, Math.min(1, Math.max(0, u)))));
                placed = true;
                break;
            }
            acc = next;
        }
        if (!placed) out.push(pts[pts.length - 1]!);
    }
    return out;
}

/**
 * 반(단계)별 도로 키포인트 (%).
 * adventure-map 아트의 실제 길 위에 오버레이 프리뷰로 보정한 값.
 * (관리자 맵 보정 모드로 재찍기 가능)
 */
export const SINGLE_PLAYER_ROAD_KEYPOINTS: Record<
    SinglePlayerLevel,
    readonly SinglePlayerStageMapPoint[]
> = {
    // 새싹의 숲 — 길 보정 모드로 찍은 키포인트
    [SinglePlayerLevel.입문]: [
        { xPct: 48.3, yPct: 91.7 },
        { xPct: 44.5, yPct: 75.4 },
        { xPct: 57.0, yPct: 50.3 },
        { xPct: 54.1, yPct: 44.0 },
        { xPct: 72.3, yPct: 24.9 },
        { xPct: 70.5, yPct: 20.6 },
        { xPct: 73.5, yPct: 17.7 },
    ],
    // 바람의 언덕 — 길 보정 모드로 찍은 키포인트
    [SinglePlayerLevel.초급]: [
        { xPct: 43.6, yPct: 96.0 },
        { xPct: 51.4, yPct: 92.6 },
        { xPct: 47.3, yPct: 84.8 },
        { xPct: 48.1, yPct: 78.2 },
        { xPct: 54.4, yPct: 73.6 },
        { xPct: 53.1, yPct: 69.5 },
        { xPct: 53.6, yPct: 65.2 },
        { xPct: 48.8, yPct: 59.1 },
        { xPct: 52.0, yPct: 53.4 },
        { xPct: 43.4, yPct: 44.7 },
        { xPct: 51.5, yPct: 36.3 },
        { xPct: 49.2, yPct: 32.8 },
        { xPct: 51.2, yPct: 29.3 },
        { xPct: 46.8, yPct: 25.9 },
        { xPct: 48.3, yPct: 20.8 },
        { xPct: 44.1, yPct: 15.0 },
    ],
    // 별빛계곡 — 길 보정 모드로 찍은 키포인트
    [SinglePlayerLevel.중급]: [
        { xPct: 46.7, yPct: 95.3 },
        { xPct: 51.3, yPct: 88.6 },
        { xPct: 46.6, yPct: 77.9 },
        { xPct: 51.0, yPct: 69.8 },
        { xPct: 54.6, yPct: 66.0 },
        { xPct: 53.7, yPct: 62.7 },
        { xPct: 55.6, yPct: 59.8 },
        { xPct: 53.2, yPct: 56.2 },
        { xPct: 57.6, yPct: 50.1 },
        { xPct: 56.9, yPct: 46.8 },
        { xPct: 61.7, yPct: 44.0 },
        { xPct: 59.2, yPct: 40.6 },
        { xPct: 62.7, yPct: 39.1 },
        { xPct: 55.8, yPct: 32.9 },
        { xPct: 60.0, yPct: 27.8 },
        { xPct: 64.4, yPct: 23.4 },
    ],
    // 화산 능선 — 길 보정 모드로 찍은 키포인트
    [SinglePlayerLevel.고급]: [
        { xPct: 48.7, yPct: 93.7 },
        { xPct: 40.2, yPct: 86.8 },
        { xPct: 55.9, yPct: 79.4 },
        { xPct: 56.9, yPct: 72.8 },
        { xPct: 45.0, yPct: 56.2 },
        { xPct: 48.5, yPct: 51.6 },
        { xPct: 51.2, yPct: 43.5 },
        { xPct: 44.5, yPct: 41.0 },
        { xPct: 39.7, yPct: 35.4 },
        { xPct: 45.8, yPct: 28.3 },
        { xPct: 51.9, yPct: 26.8 },
        { xPct: 49.0, yPct: 19.1 },
        { xPct: 61.2, yPct: 21.5 },
        { xPct: 66.4, yPct: 14.0 },
        { xPct: 72.6, yPct: 14.6 },
    ],
    // 천상의 탑 — 길 보정 모드로 찍은 키포인트
    [SinglePlayerLevel.유단자]: [
        { xPct: 42.4, yPct: 92.0 },
        { xPct: 51.8, yPct: 83.2 },
        { xPct: 45.2, yPct: 77.1 },
        { xPct: 49.4, yPct: 74.2 },
        { xPct: 42.3, yPct: 69.9 },
        { xPct: 52.7, yPct: 64.5 },
        { xPct: 59.4, yPct: 57.8 },
        { xPct: 53.3, yPct: 53.0 },
        { xPct: 46.8, yPct: 50.4 },
        { xPct: 54.1, yPct: 47.1 },
        { xPct: 56.7, yPct: 44.4 },
        { xPct: 47.4, yPct: 39.6 },
        { xPct: 53.8, yPct: 36.2 },
        { xPct: 63.3, yPct: 32.7 },
        { xPct: 64.1, yPct: 28.9 },
        { xPct: 57.3, yPct: 24.9 },
        { xPct: 60.4, yPct: 20.6 },
        { xPct: 61.8, yPct: 13.2 },
    ],
};

export const SINGLE_PLAYER_STAGE_MAP_PATHS: Record<
    SinglePlayerLevel,
    { waypoints: readonly SinglePlayerStageMapPoint[] }
> = {
    [SinglePlayerLevel.입문]: {
        waypoints: sampleAlongRoad(SINGLE_PLAYER_ROAD_KEYPOINTS[SinglePlayerLevel.입문], STAGE_SLOT_COUNT),
    },
    [SinglePlayerLevel.초급]: {
        waypoints: sampleAlongRoad(SINGLE_PLAYER_ROAD_KEYPOINTS[SinglePlayerLevel.초급], STAGE_SLOT_COUNT),
    },
    [SinglePlayerLevel.중급]: {
        waypoints: sampleAlongRoad(SINGLE_PLAYER_ROAD_KEYPOINTS[SinglePlayerLevel.중급], STAGE_SLOT_COUNT),
    },
    [SinglePlayerLevel.고급]: {
        waypoints: sampleAlongRoad(SINGLE_PLAYER_ROAD_KEYPOINTS[SinglePlayerLevel.고급], STAGE_SLOT_COUNT),
    },
    [SinglePlayerLevel.유단자]: {
        waypoints: sampleAlongRoad(SINGLE_PLAYER_ROAD_KEYPOINTS[SinglePlayerLevel.유단자], STAGE_SLOT_COUNT),
    },
};

export function getSinglePlayerRoadKeypoints(
    level: SinglePlayerLevel,
): readonly SinglePlayerStageMapPoint[] {
    return SINGLE_PLAYER_ROAD_KEYPOINTS[level] ?? SINGLE_PLAYER_ROAD_KEYPOINTS[SinglePlayerLevel.입문];
}

export function getSinglePlayerStageMapWaypoints(
    level: SinglePlayerLevel,
    stageCount: number,
    roadOverride?: readonly SinglePlayerStageMapPoint[] | null,
): SinglePlayerStageMapPoint[] {
    if (roadOverride != null) {
        return sampleAlongRoad(roadOverride, stageCount);
    }
    return sampleAlongRoad(getSinglePlayerRoadKeypoints(level), stageCount);
}

export function stageMapPointToWorld(
    point: SinglePlayerStageMapPoint,
    world = SINGLE_PLAYER_MAP_WORLD,
): { x: number; y: number } {
    return {
        x: (point.xPct / 100) * world.width,
        y: (point.yPct / 100) * world.height,
    };
}

export function worldToStageMapPoint(
    x: number,
    y: number,
    world = SINGLE_PLAYER_MAP_WORLD,
): SinglePlayerStageMapPoint {
    return clampPoint({
        xPct: (x / world.width) * 100,
        yPct: (y / world.height) * 100,
    });
}

/** 월드 좌표를 Catmull-Rom → cubic Bézier SVG path로 변환 */
export function buildSmoothStagePathD(
    worldPoints: ReadonlyArray<{ x: number; y: number }>,
): string {
    if (worldPoints.length === 0) return '';
    if (worldPoints.length === 1) {
        const p = worldPoints[0]!;
        return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    if (worldPoints.length === 2) {
        const a = worldPoints[0]!;
        const b = worldPoints[1]!;
        return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }

    let d = `M ${worldPoints[0]!.x.toFixed(1)} ${worldPoints[0]!.y.toFixed(1)}`;
    for (let i = 0; i < worldPoints.length - 1; i++) {
        const p0 = worldPoints[Math.max(0, i - 1)]!;
        const p1 = worldPoints[i]!;
        const p2 = worldPoints[i + 1]!;
        const p3 = worldPoints[Math.min(worldPoints.length - 1, i + 2)]!;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
}
