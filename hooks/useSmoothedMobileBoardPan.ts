import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { mobileBoardEdgePanX } from '../utils/mobileBoardEdgePan.js';

/** AlkkagiBoardHandle / CurlingBoardHandle */
type BoardHandleWithSvg = { getSvg: () => SVGSVGElement | null };

/**
 * 알까기·컬링 모바일: 화면 가장자리 드래그 시 판 translateX.
 * - 목표 패닝은 rAF에서 지수 보간해 터치마다 setState 폭주·끊김을 줄임.
 */
export function useSmoothedMobileBoardPan(args: {
    boardRef: RefObject<BoardHandleWithSvg | null>;
    enabled: boolean;
}): {
    panX: number;
    onDragMoveClientX: (clientX: number, innerWidth: number) => void;
    resetPan: () => void;
} {
    const { boardRef, enabled } = args;
    const [panX, setPanX] = useState(0);
    const targetRef = useRef(0);
    const displayRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    const cancelRaf = useCallback(() => {
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const runStep = useCallback(() => {
        rafRef.current = null;
        if (!enabledRef.current) return;
        const t = targetRef.current;
        const prev = displayRef.current;
        /** 낮을수록 가장자리 패닝이 천천히 따라옴 (너무 크면 판이 빨리 쏠림) */
        const alpha = 0.055;
        let next = prev + (t - prev) * alpha;
        if (Math.abs(t - next) < 0.1) next = t;
        displayRef.current = next;
        setPanX(next);
        if (Math.abs(t - next) > 0.1 && enabledRef.current) {
            rafRef.current = requestAnimationFrame(runStep);
        }
    }, []);

    const scheduleStep = useCallback(() => {
        if (rafRef.current != null || !enabledRef.current) return;
        rafRef.current = requestAnimationFrame(runStep);
    }, [runStep]);

    const getBoardWidthPx = useCallback(() => {
        const svg = boardRef.current?.getSvg() ?? null;
        const w = svg?.getBoundingClientRect().width ?? 0;
        if (w > 12) return w;
        return typeof window !== 'undefined' ? window.innerWidth * 0.82 : 0;
    }, [boardRef]);

    const onDragMoveClientX = useCallback(
        (clientX: number, innerWidth: number) => {
            if (!enabledRef.current) return;
            const bw = getBoardWidthPx();
            const maxPan = Math.max(12, bw * 0.14);
            targetRef.current = mobileBoardEdgePanX(clientX, innerWidth, maxPan);
            scheduleStep();
        },
        [getBoardWidthPx, scheduleStep]
    );

    const resetPan = useCallback(() => {
        cancelRaf();
        targetRef.current = 0;
        displayRef.current = 0;
        setPanX(0);
    }, [cancelRaf]);

    useEffect(() => {
        if (!enabled) {
            resetPan();
        }
    }, [enabled, resetPan]);

    return { panX, onDragMoveClientX, resetPan };
}
