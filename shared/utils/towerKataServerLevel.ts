/**
 * 도전의 탑 층별 KataServer `levelbot` 값 (`/move` 요청).
 * 운영 밸런스 표 — 층 번호는 1~100.
 *
 * 1~10:-30, 11~19:-28, 20:-25,
 * 21~34:-20, 35:-19, 36~50:-18, 51~64:-15, 65:-13, 66~79:-10, 80:-8,
 * 81~89:-6, 90:-5, 91~99:-3, 100:-1
 */
export function getTowerKataServerLevelByFloor(floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f === 100) return -1;
    if (f >= 91) return -3;
    if (f === 90) return -5;
    if (f >= 81) return -6;
    if (f === 80) return -8;
    if (f >= 66) return -10;
    if (f === 65) return -13;
    if (f >= 51) return -15;
    if (f >= 36) return -18;
    if (f === 35) return -19;
    if (f >= 21) return -20;
    if (f === 20) return -25;
    if (f >= 11) return -28;
    return -30;
}
