import { useCallback, useEffect, useRef, useState } from 'react';

export type MapViewportTransform = {
    scale: number;
    tx: number;
    ty: number;
};

export type UseMapViewportOptions = {
    worldWidth: number;
    worldHeight: number;
    /**
     * cover: 패널을 항상 채움(최소 줌에서도 빈 공간 없음, 가장자리 일부는 잘릴 수 있음)
     * contain: 맵 전체가 보임(여백 가능)
     */
    fitMode?: 'cover' | 'contain';
    /** cover/contain 기준 배율에 곱해 최대 줌을 정함 (기본 3.2) */
    maxZoomMultiplier?: number;
    /** 고정 최소 줌(선택). 미지정 시 뷰포트 기준 동적 계산 */
    minScale?: number;
    /** 고정 최대 줌(선택). 미지정 시 min × maxZoomMultiplier */
    maxScale?: number;
};

const DEFAULT_MAX_ZOOM_MULTIPLIER = 3.2;
const DRAG_CLICK_THRESHOLD_PX = 6;

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function clampTranslate(
    scale: number,
    tx: number,
    ty: number,
    worldWidth: number,
    worldHeight: number,
    viewW: number,
    viewH: number,
): { tx: number; ty: number } {
    const scaledW = worldWidth * scale;
    const scaledH = worldHeight * scale;
    let nextTx = tx;
    let nextTy = ty;

    if (scaledW <= viewW) {
        nextTx = (viewW - scaledW) / 2;
    } else {
        nextTx = clamp(tx, viewW - scaledW, 0);
    }
    if (scaledH <= viewH) {
        nextTy = (viewH - scaledH) / 2;
    } else {
        nextTy = clamp(ty, viewH - scaledH, 0);
    }
    return { tx: nextTx, ty: nextTy };
}

export function useMapViewport({
    worldWidth,
    worldHeight,
    fitMode = 'cover',
    maxZoomMultiplier = DEFAULT_MAX_ZOOM_MULTIPLIER,
    minScale: minScaleOverride,
    maxScale: maxScaleOverride,
}: UseMapViewportOptions) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [transform, setTransform] = useState<MapViewportTransform>({
        scale: 1,
        tx: 0,
        ty: 0,
    });
    const transformRef = useRef(transform);
    transformRef.current = transform;

    const animFrameRef = useRef<number | null>(null);
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originTx: number;
        originTy: number;
        moved: boolean;
    } | null>(null);
    const pinchRef = useRef<{
        dist0: number;
        scale0: number;
        midX: number;
        midY: number;
    } | null>(null);
    const suppressClickRef = useRef(false);
    const didInitialFitRef = useRef(false);
    const scaleBoundsRef = useRef({ min: 0.2, max: 2.4 });

    const measure = useCallback(() => {
        const el = viewportRef.current;
        if (!el) return { w: 0, h: 0 };
        return { w: el.clientWidth, h: el.clientHeight };
    }, []);

    const computeScaleBounds = useCallback(
        (viewW: number, viewH: number) => {
            if (viewW <= 0 || viewH <= 0 || worldWidth <= 0 || worldHeight <= 0) {
                return scaleBoundsRef.current;
            }
            const cover = Math.max(viewW / worldWidth, viewH / worldHeight);
            const contain = Math.min(viewW / worldWidth, viewH / worldHeight);
            const fitBase = fitMode === 'cover' ? cover : contain;
            const min = minScaleOverride ?? fitBase;
            const max = Math.max(
                min + 0.001,
                maxScaleOverride ?? min * maxZoomMultiplier,
            );
            const bounds = { min, max };
            scaleBoundsRef.current = bounds;
            return bounds;
        },
        [fitMode, maxZoomMultiplier, minScaleOverride, maxScaleOverride, worldWidth, worldHeight],
    );

    const applyClamped = useCallback(
        (next: MapViewportTransform) => {
            const { w, h } = measure();
            if (w <= 0 || h <= 0) {
                setTransform(next);
                return next;
            }
            const { min, max } = computeScaleBounds(w, h);
            const scale = clamp(next.scale, min, max);
            const clamped = clampTranslate(scale, next.tx, next.ty, worldWidth, worldHeight, w, h);
            const result = { scale, ...clamped };
            setTransform(result);
            transformRef.current = result;
            return result;
        },
        [measure, computeScaleBounds, worldWidth, worldHeight],
    );

    const zoomAt = useCallback(
        (clientX: number, clientY: number, nextScaleRaw: number) => {
            const el = viewportRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const { scale, tx, ty } = transformRef.current;
            const { min, max } = computeScaleBounds(rect.width, rect.height);
            const nextScale = clamp(nextScaleRaw, min, max);
            if (nextScale === scale) return;
            const vx = clientX - rect.left;
            const vy = clientY - rect.top;
            const worldX = (vx - tx) / scale;
            const worldY = (vy - ty) / scale;
            applyClamped({
                scale: nextScale,
                tx: vx - worldX * nextScale,
                ty: vy - worldY * nextScale,
            });
        },
        [applyClamped, computeScaleBounds],
    );

    const focusWorldPoint = useCallback(
        (worldX: number, worldY: number, opts?: { animate?: boolean; scale?: number }) => {
            const { w, h } = measure();
            if (w <= 0 || h <= 0) return;
            const { min, max } = computeScaleBounds(w, h);
            const targetScale = clamp(opts?.scale ?? transformRef.current.scale, min, max);
            const targetTx = w / 2 - worldX * targetScale;
            const targetTy = h / 2 - worldY * targetScale;
            const target = clampTranslate(
                targetScale,
                targetTx,
                targetTy,
                worldWidth,
                worldHeight,
                w,
                h,
            );
            const end = { scale: targetScale, ...target };

            if (animFrameRef.current != null) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }

            if (!opts?.animate) {
                setTransform(end);
                transformRef.current = end;
                return;
            }

            const start = { ...transformRef.current };
            const t0 = performance.now();
            const duration = 380;
            const tick = (now: number) => {
                const u = Math.min(1, (now - t0) / duration);
                const e = 1 - Math.pow(1 - u, 3);
                const mid = {
                    scale: start.scale + (end.scale - start.scale) * e,
                    tx: start.tx + (end.tx - start.tx) * e,
                    ty: start.ty + (end.ty - start.ty) * e,
                };
                setTransform(mid);
                transformRef.current = mid;
                if (u < 1) {
                    animFrameRef.current = requestAnimationFrame(tick);
                } else {
                    animFrameRef.current = null;
                    applyClamped(end);
                }
            };
            animFrameRef.current = requestAnimationFrame(tick);
        },
        [applyClamped, measure, computeScaleBounds, worldWidth, worldHeight],
    );

    const bumpZoom = useCallback(
        (factor: number) => {
            const el = viewportRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, transformRef.current.scale * factor);
        },
        [zoomAt],
    );

    const fitToWorld = useCallback(
        (opts?: { overscan?: number }) => {
            const { w, h } = measure();
            if (w <= 0 || h <= 0) return 1;
            const { min, max } = computeScaleBounds(w, h);
            const overscan = opts?.overscan ?? 1;
            const cover = Math.max(w / worldWidth, h / worldHeight);
            const contain = Math.min(w / worldWidth, h / worldHeight);
            const base = fitMode === 'cover' ? cover : contain;
            const scale = clamp(base * overscan, min, max);
            applyClamped({
                scale,
                tx: (w - worldWidth * scale) / 2,
                ty: (h - worldHeight * scale) / 2,
            });
            return scale;
        },
        [applyClamped, measure, computeScaleBounds, fitMode, worldWidth, worldHeight],
    );

    const applyClampedRef = useRef(applyClamped);
    applyClampedRef.current = applyClamped;
    const zoomAtRef = useRef(zoomAt);
    zoomAtRef.current = zoomAt;
    const measureRef = useRef(measure);
    measureRef.current = measure;
    const fitToWorldRef = useRef(fitToWorld);
    fitToWorldRef.current = fitToWorld;
    const computeScaleBoundsRef = useRef(computeScaleBounds);
    computeScaleBoundsRef.current = computeScaleBounds;

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.11;
            zoomAtRef.current(e.clientX, e.clientY, transformRef.current.scale * factor);
        };

        const onPointerDown = (e: PointerEvent) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (pinchRef.current) return;
            const target = e.target as HTMLElement | null;
            if (target?.closest('button, a, input, textarea, [data-map-no-pan]')) return;
            dragRef.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                originTx: transformRef.current.tx,
                originTy: transformRef.current.ty,
                moved: false,
            };
            suppressClickRef.current = false;
            try {
                el.setPointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== e.pointerId || pinchRef.current) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            if (!drag.moved && dx * dx + dy * dy > DRAG_CLICK_THRESHOLD_PX * DRAG_CLICK_THRESHOLD_PX) {
                drag.moved = true;
                suppressClickRef.current = true;
            }
            applyClampedRef.current({
                scale: transformRef.current.scale,
                tx: drag.originTx + dx,
                ty: drag.originTy + dy,
            });
        };

        const onPointerUp = (e: PointerEvent) => {
            if (dragRef.current?.pointerId === e.pointerId) {
                dragRef.current = null;
            }
            try {
                el.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
        };

        const touchDist = (a: Touch, b: Touch) => {
            const dx = a.clientX - b.clientX;
            const dy = a.clientY - b.clientY;
            return Math.hypot(dx, dy);
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                dragRef.current = null;
                const a = e.touches[0];
                const b = e.touches[1];
                pinchRef.current = {
                    dist0: touchDist(a, b),
                    scale0: transformRef.current.scale,
                    midX: (a.clientX + b.clientX) / 2,
                    midY: (a.clientY + b.clientY) / 2,
                };
                suppressClickRef.current = true;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && pinchRef.current) {
                e.preventDefault();
                const a = e.touches[0];
                const b = e.touches[1];
                const dist = touchDist(a, b);
                const ratio = dist / Math.max(1, pinchRef.current.dist0);
                zoomAtRef.current(
                    pinchRef.current.midX,
                    pinchRef.current.midY,
                    pinchRef.current.scale0 * ratio,
                );
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                pinchRef.current = null;
            }
        };

        const onDblClick = (e: MouseEvent) => {
            zoomAtRef.current(e.clientX, e.clientY, transformRef.current.scale * 1.35);
        };

        const syncToViewport = (forceFit: boolean) => {
            const { w, h } = measureRef.current();
            if (w <= 0 || h <= 0) return;
            const { min, max } = computeScaleBoundsRef.current(w, h);
            if (forceFit || !didInitialFitRef.current) {
                fitToWorldRef.current({ overscan: 1 });
                didInitialFitRef.current = true;
                return;
            }
            const cur = transformRef.current;
            // 리사이즈 후에도 cover 최소줌 미만으로 내려가지 않게 — 빈 공간 방지
            const nextScale = clamp(cur.scale, min, max);
            applyClampedRef.current({
                scale: nextScale,
                tx: cur.tx,
                ty: cur.ty,
            });
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('dblclick', onDblClick);

        syncToViewport(true);

        const ro =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(() => {
                      syncToViewport(false);
                  })
                : null;
        ro?.observe(el);

        return () => {
            ro?.disconnect();
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', onPointerUp);
            el.removeEventListener('pointercancel', onPointerUp);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('dblclick', onDblClick);
            if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
        };
    }, [worldWidth, worldHeight, fitMode, maxZoomMultiplier, minScaleOverride, maxScaleOverride]);

    const consumeClickSuppression = useCallback(() => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return true;
        }
        return false;
    }, []);

    return {
        viewportRef,
        transform,
        focusWorldPoint,
        fitToWorld,
        bumpZoom,
        consumeClickSuppression,
        minScale: scaleBoundsRef.current.min,
        maxScale: scaleBoundsRef.current.max,
    };
}
