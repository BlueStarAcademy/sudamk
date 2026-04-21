/**
 * 가장자리 근처에서 패닝 강도 u∈[0,1].
 * 지수를 1보다 작게 두어 끝에 닿았을 때 반응을 더 빠르게 키운다.
 */
function edgePanCurve(u: number): number {
    const clamped = Math.min(1, Math.max(0, u));
    return Math.pow(clamped, 0.92);
}

/**
 * 모바일에서 돌을 잡고 드래그할 때, 손가락이 화면 좌/우 맨 끝에 닿은 경우에만
 * 바둑판 래퍼에 적용할 수평 패닝(px).
 * @param maxPanPx — 호출 측에서 보통 «현재 바둑판 CSS 너비 × 0.22» 근처로 상한을 둠
 */
export function mobileBoardEdgePanX(clientX: number, innerWidth: number, maxPanPx: number): number {
    if (innerWidth <= 0 || maxPanPx <= 0) return 0;
    /** 화면 경계에서 이 픽셀 안으로 들어왔을 때 패닝 (기존보다 넓혀 체감 강화) */
    const edgePx = Math.min(56, Math.max(20, Math.round(innerWidth * 0.065)));
    let pan = 0;
    if (clientX < edgePx) {
        pan += maxPanPx * edgePanCurve(1 - clientX / edgePx);
    }
    const rightDist = innerWidth - clientX;
    if (rightDist < edgePx) {
        pan -= maxPanPx * edgePanCurve(1 - rightDist / edgePx);
    }
    return pan;
}
