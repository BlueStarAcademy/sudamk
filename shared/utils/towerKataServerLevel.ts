/**
 * 도전의 탑 층별 KataServer `levelbot` 값 (`/move` 요청).
 * 운영 밸런스 표 — 층 번호는 1~100.
 */
export function getTowerKataServerLevelByFloor(floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f <= 5) return -28;
    if (f <= 10) return -27;
    if (f <= 15) return -26;
    if (f <= 20) return -25;
    if (f <= 30) return -22;
    if (f <= 35) return -20;
    if (f <= 40) return -18;
    if (f <= 45) return -16;
    if (f <= 50) return -15;
    if (f <= 55) return -14;
    if (f <= 60) return -13;
    if (f <= 65) return -12;
    if (f <= 70) return -11;
    if (f <= 75) return -10;
    if (f <= 80) return -9;
    if (f <= 85) return -8;
    if (f <= 90) return -7;
    if (f <= 95) return -6;
    if (f <= 99) return -5;
    return -3;
}
