/**
 * 도전의 탑 층별 KataServer `levelbot` 값 (`/move` 요청).
 * 운영 밸런스 표 — 층 번호는 1~100.
 *
 * 1~10:-30, 11~19:-28, 20:-25, 21~35:-22, 36~50:-19, 51~65:-18,
 * 66~80:-15, 81~90:-12, 91~100:-10
 */
export function getTowerKataServerLevelByFloor(floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f >= 91) return -10;
    if (f >= 81) return -12;
    if (f >= 66) return -15;
    if (f >= 51) return -18;
    if (f >= 36) return -19;
    if (f >= 21) return -22;
    if (f === 20) return -25;
    if (f >= 11) return -28;
    return -30;
}
