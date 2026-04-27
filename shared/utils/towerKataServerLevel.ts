/**
 * 도전의 탑 층별 KataServer `levelbot` 값 (`/move` 요청).
 * 운영 밸런스 표 — 층 번호는 1~100.
 *
 * 1~10:-30, 11~20:-28, 21~34:-26, 35:-25, 36~49:-22, 50:-20, 51~64:-19, 65:-18,
 * 66~79:-15, 80:-12, 81~89:-10, 90:-7, 91~99:-5, 100:-3
 */
export function getTowerKataServerLevelByFloor(floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f === 100) return -3;
    if (f >= 91) return -5;
    if (f === 90) return -7;
    if (f >= 81) return -10;
    if (f === 80) return -12;
    if (f >= 66) return -15;
    if (f === 65) return -18;
    if (f >= 51) return -19;
    if (f === 50) return -20;
    if (f >= 36) return -22;
    if (f === 35) return -25;
    if (f >= 21) return -26;
    if (f >= 11) return -28;
    return -30;
}
