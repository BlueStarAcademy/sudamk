/**
 * 도전의 탑 층별 KataServer `levelbot` 값 (`/move` 요청).
 * 운영 밸런스 표 — 층 번호는 1~100.
 */
export function getTowerKataServerLevelByFloor(floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f <= 50) return -31;
    if (f <= 80) return -30;
    if (f <= 90) return -28;
    if (f <= 99) return -27;
    return -25;
}
