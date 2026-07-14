import type { AdventureStageId } from '../../constants/adventureConstants.js';

export type AdventureMapPathPoint = { xPct: number; yPct: number };

/** 스테이지 맵 아트에 맞춘 통행로 polyline (%). 몬스터 스폰·배회는 이 복도 안. */
export const ADVENTURE_MAP_PATHS: Record<
    AdventureStageId,
    { waypoints: readonly AdventureMapPathPoint[]; corridorHalfWidthPct: number }
> = {
    neighborhood_hill: {
        // 전경 오솔길 → 중경 (실사+판타지 숲 맵 v3)
        waypoints: [
            { xPct: 50, yPct: 92 },
            { xPct: 48, yPct: 86 },
            { xPct: 46, yPct: 80 },
            { xPct: 48, yPct: 74 },
            { xPct: 52, yPct: 68 },
            { xPct: 56, yPct: 64 },
        ],
        corridorHalfWidthPct: 3.4,
    },
    lake_park: {
        // 전경 보드워크 → 호숫가 (실사+판타지 호수 맵 v3)
        waypoints: [
            { xPct: 28, yPct: 92 },
            { xPct: 38, yPct: 88 },
            { xPct: 48, yPct: 84 },
            { xPct: 56, yPct: 82 },
            { xPct: 64, yPct: 82 },
            { xPct: 72, yPct: 84 },
        ],
        corridorHalfWidthPct: 3.2,
    },
    aquarium: {
        // 관람 통로(하단 바닥)
        waypoints: [
            { xPct: 22, yPct: 92 },
            { xPct: 36, yPct: 90 },
            { xPct: 50, yPct: 89 },
            { xPct: 64, yPct: 90 },
            { xPct: 78, yPct: 92 },
        ],
        corridorHalfWidthPct: 2.8,
    },
    zoo: {
        // 전경 벽돌 산책로 → 중경 관람로 (동물원 맵 v4)
        waypoints: [
            { xPct: 48, yPct: 94 },
            { xPct: 50, yPct: 88 },
            { xPct: 52, yPct: 82 },
            { xPct: 56, yPct: 78 },
            { xPct: 62, yPct: 74 },
        ],
        corridorHalfWidthPct: 3.6,
    },
    amusement_park: {
        // 전경 보도
        waypoints: [
            { xPct: 26, yPct: 92 },
            { xPct: 40, yPct: 88 },
            { xPct: 52, yPct: 86 },
            { xPct: 64, yPct: 88 },
            { xPct: 78, yPct: 92 },
        ],
        corridorHalfWidthPct: 3.6,
    },
};

function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}

function dist2(a: AdventureMapPathPoint, b: AdventureMapPathPoint): number {
    const dx = a.xPct - b.xPct;
    const dy = a.yPct - b.yPct;
    return dx * dx + dy * dy;
}

/** polyline 누적 길이 (pct 공간, x/y 동일 가중) */
export function adventureMapPathLength(waypoints: readonly AdventureMapPathPoint[]): number {
    let len = 0;
    for (let i = 1; i < waypoints.length; i++) {
        const a = waypoints[i - 1]!;
        const b = waypoints[i]!;
        len += Math.hypot(b.xPct - a.xPct, b.yPct - a.yPct);
    }
    return len;
}

/** t∈[0,1] 을 경로 위 점으로 */
export function pointOnAdventureMapPath(
    waypoints: readonly AdventureMapPathPoint[],
    t: number,
): AdventureMapPathPoint {
    if (waypoints.length === 0) return { xPct: 50, yPct: 80 };
    if (waypoints.length === 1) return { ...waypoints[0]! };
    const tt = clamp01(t);
    const total = adventureMapPathLength(waypoints);
    if (total <= 1e-6) return { ...waypoints[0]! };
    let remain = tt * total;
    for (let i = 1; i < waypoints.length; i++) {
        const a = waypoints[i - 1]!;
        const b = waypoints[i]!;
        const seg = Math.hypot(b.xPct - a.xPct, b.yPct - a.yPct);
        if (remain <= seg || i === waypoints.length - 1) {
            const u = seg <= 1e-6 ? 0 : remain / seg;
            return {
                xPct: a.xPct + (b.xPct - a.xPct) * u,
                yPct: a.yPct + (b.yPct - a.yPct) * u,
            };
        }
        remain -= seg;
    }
    return { ...waypoints[waypoints.length - 1]! };
}

/** 경로 + 수직 오프셋(복도 반폭 내) */
export function sampleAdventureMapPathPosition(
    stageId: AdventureStageId,
    rng: () => number,
    opts?: { preferLowerHalf?: boolean },
): AdventureMapPathPoint {
    const path = ADVENTURE_MAP_PATHS[stageId];
    let t = rng();
    if (opts?.preferLowerHalf) {
        // 경로의 앞쪽(대개 전경) 쪽을 선호
        t = 0.55 + rng() * 0.45;
    }
    const base = pointOnAdventureMapPath(path.waypoints, t);
    const half = path.corridorHalfWidthPct;
    // 대략 접선 수직 방향: 인접 세그먼트에서 추정
    const tA = Math.max(0, t - 0.02);
    const tB = Math.min(1, t + 0.02);
    const a = pointOnAdventureMapPath(path.waypoints, tA);
    const b = pointOnAdventureMapPath(path.waypoints, tB);
    const dx = b.xPct - a.xPct;
    const dy = b.yPct - a.yPct;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = (rng() * 2 - 1) * half;
    return {
        xPct: base.xPct + nx * off,
        yPct: base.yPct + ny * off,
    };
}

export function adventureMapPathNearestT(
    stageId: AdventureStageId,
    pos: AdventureMapPathPoint,
): number {
    const { waypoints } = ADVENTURE_MAP_PATHS[stageId];
    let bestT = 0;
    let bestD = Infinity;
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = pointOnAdventureMapPath(waypoints, t);
        const d = dist2(p, pos);
        if (d < bestD) {
            bestD = d;
            bestT = t;
        }
    }
    return bestT;
}
