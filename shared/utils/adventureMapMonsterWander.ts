import type { CSSProperties } from 'react';
import { fnv1a32 } from './adventureMapSchedule.js';

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

type WanderPoint = { x: number; y: number };

function faceFromDelta(dx: number): 1 | -1 {
    if (dx < -0.5) return -1;
    if (dx > 0.5) return 1;
    return 1;
}

/** 맵 몬스터 마커 배회용 CSS 변수·타이밍 (시드 고정 → 동일 창마다 같은 경로) */
export function buildAdventureMapMonsterWanderStyle(
    monsterId: string,
    mapW: number,
    mapH: number,
): { wanderStyle: CSSProperties; faceStyle: CSSProperties } {
    const seed = fnv1a32(`advWander|${monsterId}`);
    const rng = mulberry32(seed);
    const maxX = mapW > 0 ? mapW * 0.018 : 28;
    const maxY = mapH > 0 ? mapH * 0.012 : 18;

    const points: WanderPoint[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < 3; i++) {
        points.push({
            x: (rng() * 2 - 1) * maxX,
            y: (rng() * 2 - 1) * maxY - rng() * 4,
        });
    }
    points.push({ x: 0, y: 0 });

    const px = (n: number) => `${n.toFixed(2)}px`;
    const wanderStyle: CSSProperties = {
        animationDuration: `${8 + (seed % 6000) / 1000}s`,
        animationDelay: `${-((seed >>> 10) % 8000) / 1000}s`,
        ['--w0x' as string]: px(points[0]!.x),
        ['--w0y' as string]: px(points[0]!.y),
        ['--w1x' as string]: px(points[1]!.x),
        ['--w1y' as string]: px(points[1]!.y),
        ['--w2x' as string]: px(points[2]!.x),
        ['--w2y' as string]: px(points[2]!.y),
        ['--w3x' as string]: px(points[3]!.x),
        ['--w3y' as string]: px(points[3]!.y),
    };

    const faceStyle: CSSProperties = {
        animationDuration: wanderStyle.animationDuration,
        animationDelay: wanderStyle.animationDelay,
        ['--face0' as string]: String(faceFromDelta(points[1]!.x - points[0]!.x)),
        ['--face1' as string]: String(faceFromDelta(points[2]!.x - points[1]!.x)),
        ['--face2' as string]: String(faceFromDelta(points[3]!.x - points[2]!.x)),
        ['--face3' as string]: String(faceFromDelta(points[0]!.x - points[3]!.x)),
    };

    return { wanderStyle, faceStyle };
}
