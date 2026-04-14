/**
 * 도전의 탑 스테이지 표시·실행 공통 규칙 (서버 `towerActions`와 동일).
 * 대기실 UI와 실제 게임 생성 시 수치가 어긋나지 않도록 여기서만 정의한다.
 */

/** 따내기 1~20층: 흑(유저) 목표. 6~10층=10, 11~20층=15 고정, 그 외는 스테이지 정의값. */
export function resolveTowerCaptureBlackTarget(floor: number, stageBlack: number | undefined): number {
    if (floor >= 6 && floor <= 10) return 10;
    if (floor >= 11 && floor <= 20) return 15;
    if (stageBlack != null && stageBlack > 0) return stageBlack;
    return 999;
}

/**
 * 미리 배치되는 일반 백돌 수(placements.white).
 * 11~20: 상수 대비 -5.
 * 21~35 / 36~50 / 51~100: (총 흑돌 수) + N = (총 백돌 수)가 되도록, 문양 백(whitePattern)을 제외한 일반 백 개수.
 */
export function resolveTowerPlainWhiteCount(
    floor: number,
    blackPlain: number,
    blackPattern: number,
    whitePattern: number,
    stageWhite: number
): number {
    const b = Math.max(0, blackPlain) + Math.max(0, blackPattern);
    const wp = Math.max(0, whitePattern);
    if (floor >= 11 && floor <= 20) {
        return Math.max(0, stageWhite - 5);
    }
    if (floor >= 21 && floor <= 35) {
        return Math.max(0, b + 3 - wp);
    }
    if (floor >= 36 && floor <= 50) {
        return Math.max(0, b + 4 - wp);
    }
    if (floor >= 51 && floor <= 100) {
        return Math.max(0, b + 5 - wp);
    }
    return Math.max(0, stageWhite);
}
