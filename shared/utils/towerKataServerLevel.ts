/**
 * 도전의 탑 층별 KataServer `levelbot` 값 (`/move` 요청).
 * 운영 밸런스 표 — 층 번호는 1~100.
 * 1~20:-31, 21~35:-30, 36~50:-28, 51~80:-26, 81~90:-23, 91~99:-20, 100:-18
 */
export function getTowerKataServerLevelByFloor(floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f <= 20) return -31;
    if (f <= 35) return -30;
    if (f <= 50) return -28;
    if (f <= 80) return -26;
    if (f <= 90) return -23;
    if (f <= 99) return -20;
    return -18;
}
