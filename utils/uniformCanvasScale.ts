import {
    PC_DESIGN_CANVAS_HEIGHT,
    PC_DESIGN_CANVAS_WIDTH,
} from '../shared/constants/viewportDesign.js';

/**
 * PC 셸의 transform: scale()이 소수 배율이면 글리프가 뭉개져 보이기 쉬움.
 * 1) 스케일 후 논리 크기가 정수 CSS 픽셀에 가깝게
 * 2) devicePixelRatio 그리드에 맞춰(125%/150% 윈도 배율 등) 래스터 정렬
 */
export function snapUniformCanvasScale(
    fitW: number,
    fitH: number,
    designW: number = PC_DESIGN_CANVAS_WIDTH,
    designH: number = PC_DESIGN_CANVAS_HEIGHT,
): number {
    const raw = Math.min(fitW / designW, fitH / designH, 1);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    const wPx = Math.max(1, Math.floor(designW * raw));
    const hPx = Math.max(1, Math.floor(designH * raw));
    let scale = Math.min(wPx / designW, hPx / designH);

    if (typeof window !== 'undefined' && window.devicePixelRatio) {
        const dpr = window.devicePixelRatio;
        const alignToDevicePx = (s: number) => {
            const dev = designW * s * dpr;
            const r = Math.max(1, Math.round(dev));
            return r / (designW * dpr);
        };
        scale = alignToDevicePx(scale);
        if (designW * scale > fitW + 1e-4) scale = fitW / designW;
        if (designH * scale > fitH + 1e-4) scale = Math.min(scale, fitH / designH);
    }

    return scale;
}

/** 설계 프레임이 가용 영역에 들어가도록 균일 배율(최대 1) */
export function computeUniformFitScale(
    availW: number,
    availH: number,
    designW: number,
    designH: number,
    options?: { snap?: boolean; minScale?: number },
): number {
    if (designW <= 0 || designH <= 0) return 1;
    const sx = availW / designW;
    const sy = availH / designH;
    let s = Math.min(1, sx, sy);
    if (!Number.isFinite(s) || s <= 0) s = 1;
    if (options?.snap) {
        s = snapUniformCanvasScale(availW, availH, designW, designH);
    }
    const min = options?.minScale ?? 0.08;
    return Math.max(min, s);
}
