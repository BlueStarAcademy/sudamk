import type { Player } from '../types/index.js';

/**
 * 길드전 따내기: 한 수에서 얻은 **포획 점수 합**(문양·배치돌 가중)의 최대값을 세션에 누적한다.
 * 별(★2/★3) 판정과 인게임 사이드바 표시에 사용.
 */
export function bumpGuildWarMaxSingleCapturePointsForPlayer(
    game: { gameCategory?: string | null; maxSingleCapturePointsByPlayer?: Partial<Record<Player, number>> },
    moverEnum: Player,
    pointsThisMove: number
): void {
    if ((game as { gameCategory?: string | null }).gameCategory !== 'guildwar') return;
    if (!Number.isFinite(pointsThisMove) || pointsThisMove <= 0) return;
    const o = ((game as any).maxSingleCapturePointsByPlayer ??= {}) as Partial<Record<Player, number>>;
    const prev = Number(o[moverEnum] ?? 0) || 0;
    if (pointsThisMove > prev) {
        o[moverEnum] = pointsThisMove;
    }
}
