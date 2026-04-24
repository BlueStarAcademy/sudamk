/**
 * 도전의 탑 스테이지 표시·실행 공통 규칙 (서버 `towerActions`와 동일).
 * 대기실 UI와 실제 게임 생성 시 수치가 어긋나지 않도록 여기서만 정의한다.
 */

/** 따내기 1~20층: 흑(유저) 목표. 1~10=5, 11~19=6, 20=7. 21층+는 스테이지 정의값. */
export function resolveTowerCaptureBlackTarget(floor: number, stageBlack: number | undefined): number {
    if (floor >= 1 && floor <= 10) return 5;
    if (floor >= 11 && floor <= 19) return 6;
    if (floor === 20) return 7;
    if (stageBlack != null && stageBlack > 0) return stageBlack;
    return 999;
}

/**
 * 초기 무작위 배치용 일반 흑돌 수 (`TOWER_STAGES`의 `placements.black` 기준).
 * 60~90층: 정의값 −1, 91~100층: 정의값 −2. 그 외 층은 정의값 그대로.
 */
export function resolveTowerPlainBlackCount(floor: number, stageBlack: number): number {
    const base = Math.max(0, Math.floor(Number(stageBlack) || 0));
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    if (f >= 91) return Math.max(0, base - 2);
    if (f >= 60) return Math.max(0, base - 1);
    return base;
}

/**
 * 미리 배치되는 일반 백돌 수(placements.white).
 * 도전의 탑 1~100층: `TOWER_STAGES`에 적힌 `white`를 그대로 쓴다.
 * (예전 21~100층에서는 JSON의 `white`와 달리 (흑일반+흑무)+구간상수−백무 로만 계산했기 때문에,
 *  백 개수를 늘릴 때는 그 「실효」를 기준으로 잡는 것이 맞다.)
 */
export function resolveTowerPlainWhiteCount(
    floor: number,
    blackPlain: number,
    blackPattern: number,
    whitePattern: number,
    stageWhite: number
): number {
    void floor;
    void blackPlain;
    void blackPattern;
    void whitePattern;
    return Math.max(0, stageWhite);
}
