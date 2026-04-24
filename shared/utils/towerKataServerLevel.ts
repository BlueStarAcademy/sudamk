/**
 * 도전의 탑 층별 KataServer `levelbot` 값 (`/move` 요청).
 * 운영 밸런스 표 — 층 번호는 1~100.
 *
 * 1~10:-31, 11~20:-30, 21~34:-28, 35:-27, 36~49:-26, 50:-25, 51~64:-23, 65:-21,
 * 66~79:-19, 80:-18, 81~89:-16, 90:-15, 91~99:-12, 100:-10
 */
export function getTowerKataServerLevelByFloor(floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f === 100) return -10;
    if (f >= 91) return -12;
    if (f === 90) return -15;
    if (f >= 81) return -16;
    if (f === 80) return -18;
    if (f >= 66) return -19;
    if (f === 65) return -21;
    if (f >= 51) return -23;
    if (f === 50) return -25;
    if (f >= 36) return -26;
    if (f === 35) return -27;
    if (f >= 21) return -28;
    if (f >= 11) return -30;
    return -31;
}
