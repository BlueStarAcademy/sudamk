/**
 * 가장자리 근처에서 패닝 강도 u∈[0,1] — 지수로 두면 끝에 가까울수록 천천히 증가(조절하기 쉬움)
 */
function edgePanCurve(u: number): number {
    const clamped = Math.min(1, Math.max(0, u));
    return Math.pow(clamped, 1.55);
}

/**
 * 모바일에서 돌을 잡고 드래그할 때, 손가락이 화면 좌/우 맨 끝에 닿은 경우에만
 * 바둑판 래퍼에 적용할 수평 패닝(px).
 * @param maxPanPx — 호출 측에서 보통 «현재 바둑판 CSS 너비 × 0.14» 근처로 상한을 둠
 */
export function mobileBoardEdgePanX(clientX: number, innerWidth: number, maxPanPx: number): number {
    if (innerWidth <= 0 || maxPanPx <= 0) return 0;
    /** 화면 경계에서 이 픽셀 안으로 들어왔을 때만 패닝 (실제 기기에서 더 잘 걸리도록 넓힘) */
    const edgePx = Math.min(28, Math.max(12, Math.round(innerWidth * 0.028)));
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
