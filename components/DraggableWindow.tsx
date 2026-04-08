
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useViewportUniformScale } from '../hooks/useViewportUniformScale.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH, NATIVE_MOBILE_MODAL_MAX_WIDTH_VW } from '../constants/ads.js';
import {
    INGAME_BOARD_FRAME_MAX_HEIGHT_PX,
    INGAME_BOARD_FRAME_MAX_WIDTH_PX,
    INGAME_MODAL_DEFAULT_OFFSET_X,
    INGAME_MODAL_DEFAULT_OFFSET_Y,
} from '../constants/ingameModalFrame.js';
import { useInGameModalLayout } from '../contexts/InGameModalLayoutContext.js';
import { getModalScaleFitPaddingPx } from '../utils/modalViewportPadding.js';

interface DraggableWindowProps {

    title: string;

    windowId: string;

    onClose?: () => void;

    children: ReactNode;

    initialWidth?: number;

    initialHeight?: number; // Added

    modal?: boolean;

    closeOnOutsideClick?: boolean;

    isTopmost?: boolean;

    headerContent?: ReactNode;

    zIndex?: number;

    variant?: 'default' | 'store';

    /** 저장된 위치가 없을 때 사용 (스케일 캔버스에서 보드 옆에 두기 등) */
    defaultPosition?: { x: number; y: number };

    /**
     * true: 프레임을 뷰로 맞추고 본문 스크롤(스크롤·줄바꿈으로 빈 공간 활용).
     * 미지정/false: 기본은 스크롤 없이 PC 레이아웃을 유지한 채 전체를 균일 scale로 한 화면에 맞춤.
     */
    mobileViewportFit?: boolean;

    /** mobileViewportFit + 네이티브: 세로 상한 dvh(미지정 시 광고 상수). 결과 모달 등 한 화면 맞춤용 */
    mobileViewportMaxHeightVh?: number;

    /**
     * mobileViewportFit일 때 max-height의 첫 번째 인자(기본 80dvh).
     * 긴 본문·가로 스크롤 보상 등에서 세로 상한을 조금 올릴 때 사용.
     */
    mobileViewportMaxHeightCss?: string;

    /** 본문 영역 세로 스크롤(기본 true). 가방·상점 등 내부에 전용 스크롤이 있으면 false */
    bodyScrollable?: boolean;

    /** true면 DraggableWindow 본문 스크롤을 끔(내부에서 직접 스크롤할 때) */
    bodyNoScroll?: boolean;

    /** 하단 "창 위치 기억하기" 영역 숨김 (한 화면에 맞출 때) */
    hideFooter?: boolean;

    /**
     * localStorage에 창 위치를 읽지/쓰지 않고 항상 defaultPosition(기본 0,0)으로 연다.
     * 보상·획득 모달 등 짧은 오버레이가 스케일 캔버스 밖으로 밀려 잘리는 것을 방지한다.
     */
    skipSavedPosition?: boolean;

    /** 본문 패딩 클래스 (지정 시 store/default 패딩 대신 사용) */
    bodyPaddingClassName?: string;

    /**
     * PC 설계 크기(initialWidth/Height) 레이아웃을 유지한 채, 보이는 영역에 맞게 transform scale만 조정합니다.
     * (모바일·스케일 캔버스 안에서도 동일)
     */
    uniformPcScale?: boolean;

    /**
     * false: 헤더에 제목(h2)을 렌더하지 않음(닫기·드래그 영역만 유지). 본문 상단 박스가 제목 역할을 할 때 사용.
     * 접근성: 이 경우 `title` 문자열이 루트에 aria-label로 전달됩니다.
     */
    headerShowTitle?: boolean;

    /** 창 루트 div에 추가 클래스 (게임 설명 등 전용 크롬) */
    containerExtraClassName?: string;

    /** 하단 푸터(창 위치 기억하기) 영역 클래스 — 지정 시 배경·테두리 등을 덮어씁니다 */
    footerClassName?: string;

    /**
     * PC(넓은 뷰포트, 네이티브·캔버스 특수 경로 제외)에서 프레임 max-height CSS.
     * 가방 등 큰 그리드 모달에서만 지정; 미지정 시 90vh.
     */
    pcViewportMaxHeightCss?: string;

}



const SETTINGS_KEY = 'draggableWindowSettings';

/** App.tsx 스케일 캔버스: 드래그는 client 픽셀, translate는 설계 픽셀이라 비율·경계를 맞춘다 */
function getScaledCanvasDragMetrics(): {
    boundsW: number;
    boundsH: number;
    ratioX: number;
    ratioY: number;
} | null {
    if (typeof document === 'undefined') return null;
    const root = document.getElementById('sudamr-modal-root');
    if (!root) return null;
    const r = root.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
        boundsW: root.offsetWidth,
        boundsH: root.offsetHeight,
        ratioX: root.offsetWidth / r.width,
        ratioY: root.offsetHeight / r.height,
    };
}

/** 스크린 픽셀 기준으로 모달이 들어가야 할 영역 (#sudamr-modal-root ∩ visualViewport) */
function getModalClampScreenRect(modalRoot: HTMLElement | null): DOMRect | null {
    if (typeof window === 'undefined') return null;
    const margin = 12;
    const vv = window.visualViewport;

    if (modalRoot) {
        const rr = modalRoot.getBoundingClientRect();
        if (rr.width <= 0 || rr.height <= 0) return null;
        if (vv) {
            const left = Math.max(rr.left, vv.offsetLeft) + margin;
            const top = Math.max(rr.top, vv.offsetTop) + margin;
            const right = Math.min(rr.right, vv.offsetLeft + vv.width) - margin;
            const bottom = Math.min(rr.bottom, vv.offsetTop + vv.height) - margin;
            const w = right - left;
            const h = bottom - top;
            if (w <= 4 || h <= 4) return null;
            return new DOMRect(left, top, w, h);
        }
        return new DOMRect(rr.left + margin, rr.top + margin, rr.width - 2 * margin, rr.height - 2 * margin);
    }

    if (vv) {
        return new DOMRect(
            vv.offsetLeft + margin,
            vv.offsetTop + margin,
            Math.max(0, vv.width - 2 * margin),
            Math.max(0, vv.height - 2 * margin),
        );
    }
    return new DOMRect(
        margin,
        margin,
        Math.max(0, window.innerWidth - 2 * margin),
        Math.max(0, window.innerHeight - 2 * margin),
    );
}

/** 실제 렌더링 박스(er)가 clamp 안으로 들어오도록 필요한 화면 좌표 이동량 */
function computeModalScreenCorrection(er: DOMRectReadOnly, clamp: DOMRectReadOnly): { dcx: number; dcy: number } {
    let dcx = 0;
    let dcy = 0;
    const headerH = 52;

    if (er.width <= clamp.width) {
        if (er.left < clamp.left) dcx = clamp.left - er.left;
        else if (er.right > clamp.right) dcx = clamp.right - er.right;
    } else {
        dcx = clamp.left - er.left;
    }

    if (er.height <= clamp.height) {
        if (er.top < clamp.top) dcy = clamp.top - er.top;
        else if (er.bottom > clamp.bottom) dcy = clamp.bottom - er.bottom;
    } else {
        if (er.top < clamp.top) dcy = clamp.top - er.top;
        if (er.top + headerH > clamp.bottom) dcy += clamp.bottom - (er.top + headerH);
    }

    return { dcx, dcy };
}

function screenDeltaToPositionDelta(dScreenX: number, dScreenY: number): { dx: number; dy: number } {
    const metrics = getScaledCanvasDragMetrics();
    const rx = metrics?.ratioX ?? 1;
    const ry = metrics?.ratioY ?? 1;
    return { dx: dScreenX * rx, dy: dScreenY * ry };
}

// 전역 z-index 카운터: 최상위 모달이 항상 가장 높은 z-index를 가지도록 함
let globalZIndexCounter = 10000;

const DraggableWindow: React.FC<DraggableWindowProps> = ({
    title,
    windowId,
    onClose,
    children,
    initialWidth = 800,
    initialHeight,
    modal = true,
    closeOnOutsideClick = true,
    isTopmost = true,
    headerContent,
    zIndex,
    variant = 'default',
    defaultPosition = { x: 0, y: 0 },
    mobileViewportFit,
    mobileViewportMaxHeightVh,
    mobileViewportMaxHeightCss,
    bodyScrollable = true,
    bodyNoScroll = false,
    hideFooter = false,
    skipSavedPosition = false,
    bodyPaddingClassName,
    uniformPcScale = false,
    headerShowTitle = true,
    containerExtraClassName,
    footerClassName,
    pcViewportMaxHeightCss,
}) => {
    // isTopmost가 true일 때는 전역 카운터를 사용하여 항상 최상위에 표시
    const [effectiveZIndex, setEffectiveZIndex] = useState(() => {
        if (isTopmost) {
            // 최상위 모달은 전역 카운터를 증가시켜 항상 최상위에 표시
            globalZIndexCounter += 1;
            return globalZIndexCounter;
        }
        // isTopmost가 false일 때만 전달된 zIndex 사용 (기본값 50)
        return zIndex ?? 50;
    });

    // isTopmost나 zIndex가 변경될 때 z-index 업데이트
    useEffect(() => {
        if (isTopmost) {
            globalZIndexCounter += 1;
            setEffectiveZIndex(globalZIndexCounter);
        } else {
            setEffectiveZIndex(zIndex ?? 50);
        }
    }, [isTopmost, zIndex]);

    const [position, setPosition] = useState({ x: 0, y: 0 });

    const [isDragging, setIsDragging] = useState(false);

    const dragStartPos = useRef({ x: 0, y: 0 });

    const initialWindowPos = useRef({ x: 0, y: 0 });

    const [isInitialized, setIsInitialized] = useState(false);

    const positionRef = useRef(position);

    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const { modalLayerUsesDesignPixels } = useAppContext();

    // PC 16:9 캔버스 안의 모달 루트(설계 픽셀)일 때만 true. 세로형 네이티브 셸에서는 false라 뷰포트·균일축소 분기가 동작함.
    const effectiveIsCompactViewport = modalLayerUsesDesignPixels ? false : isCompactViewport;

    /** 대국 화면(Game)에서만 true — 모달을 바둑판 패널 크기·위치에 맞춤 */
    const ingameBoardFrame = useInGameModalLayout();

    const designInitialWidth = useMemo(() => {
        const w = initialWidth ?? 800;
        if (modalLayerUsesDesignPixels && ingameBoardFrame) {
            return Math.min(w, INGAME_BOARD_FRAME_MAX_WIDTH_PX);
        }
        return w;
    }, [initialWidth, modalLayerUsesDesignPixels, ingameBoardFrame]);

    const effectiveDefaultPosition = useMemo(() => {
        if (!modalLayerUsesDesignPixels || !ingameBoardFrame) return defaultPosition;
        return {
            x: (defaultPosition?.x ?? 0) + INGAME_MODAL_DEFAULT_OFFSET_X,
            y: (defaultPosition?.y ?? 0) + INGAME_MODAL_DEFAULT_OFFSET_Y,
        };
    }, [defaultPosition, modalLayerUsesDesignPixels, ingameBoardFrame]);

    const [rememberPosition, setRememberPosition] = useState(true);

    

    const windowRef = useRef<HTMLDivElement>(null);



    const handleClickOutside = useCallback((event: MouseEvent) => {

        if (
            onClose &&
            closeOnOutsideClick &&
            isTopmost &&
            windowRef.current
        ) {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const clickedInside = path.includes(windowRef.current) || windowRef.current.contains(event.target as Node);
            if (clickedInside) return;
            /** `createPortal(document.body)` 등 창 밖에 붙는 UI(도감 말풍선 등) — 같은 windowId면 바깥 클릭으로 닫지 않음 */
            const target = event.target as HTMLElement | null;
            if (target?.closest?.(`[data-draggable-satellite="${windowId}"]`)) {
                return;
            }
            // 클릭된 요소가 다른 DraggableWindow 내부에 있는지 확인
            if (target) {
                // 클릭된 요소의 부모 중에 다른 DraggableWindow가 있는지 확인
                let parent = target.parentElement;
                while (parent) {
                    // 다른 DraggableWindow의 루트 요소를 찾음 (data-draggable-window 속성 확인)
                    if (parent.getAttribute && parent.getAttribute('data-draggable-window')) {
                        // 다른 창 내부를 클릭한 것이므로 이 창을 닫지 않음
                        return;
                    }
                    parent = parent.parentElement;
                }
            }
            onClose();

        }

    }, [onClose, closeOnOutsideClick, isTopmost, windowId]);



    useEffect(() => {

        if (modal && onClose) {

            document.addEventListener('mousedown', handleClickOutside);

            return () => {

                document.removeEventListener('mousedown', handleClickOutside);

            };

        }

    }, [modal, onClose, handleClickOutside]);



    useEffect(() => {
        if (effectiveIsCompactViewport) {
            setPosition({ x: 0, y: 0 });
            try {
                const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');
                delete savedPositions[windowId];
                localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));
            } catch (e) {
                console.error("Failed to clear mobile position", e);
            }
        }
    }, [effectiveIsCompactViewport, windowId]);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            setWindowHeight(window.innerHeight);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);



    // 브라우저 크기에 따라 창 크기를 비례적으로 조정
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);
    
    const calculatedWidth = useMemo(() => {
        if (!initialWidth) return undefined;
        
        // 스케일 캔버스 내부에서는 App.tsx의 scale로만 줄이기 위해 viewport 기반 보정 로직을 끕니다.
        if (modalLayerUsesDesignPixels) return designInitialWidth;

        // 모바일이 아닐 때는 initialWidth를 최소값으로 보장 (데스크톱에서는 고정 크기 사용)
        if (!effectiveIsCompactViewport) {
            // 데스크톱: initialWidth를 최대한 보장하되, 화면이 너무 작으면 화면 크기에 맞춤
            const minWidth = Math.min(designInitialWidth, windowWidth - 40); // 화면에서 40px 여유 공간
            // initialWidth를 최소한 95% 이상 보장 (90%에서 95%로 증가)
            return Math.max(designInitialWidth * 0.95, minWidth);
        }
        
        // 모바일: 화면 크기에 맞춤
        const baseWidth = designInitialWidth;
        const viewportRatio = windowWidth / 1920; // 기준 해상도 1920px
        const adjustedWidth = Math.max(400, Math.min(baseWidth, baseWidth * viewportRatio));
        return adjustedWidth;
    }, [initialWidth, designInitialWidth, windowWidth, effectiveIsCompactViewport, modalLayerUsesDesignPixels]);

    /**
     * 전체 모달 공통: 내용량에 따라 세로 길이가 과도하게 변하지 않도록
     * 큰 모달(initialWidth가 충분히 큰 경우)에는 기본 설계 높이를 자동 부여한다.
     * 작은 확인/알림 모달은 기존 동작(콘텐츠 기반) 유지.
     */
    const resolvedInitialHeight = useMemo(() => {
        if (typeof initialHeight === 'number') {
            if (modalLayerUsesDesignPixels && ingameBoardFrame) {
                return Math.min(initialHeight, INGAME_BOARD_FRAME_MAX_HEIGHT_PX);
            }
            return initialHeight;
        }
        const baseWidth = designInitialWidth;
        if (baseWidth < 700) return undefined;
        const derived = Math.round(baseWidth * 0.72);
        let h = Math.max(520, Math.min(920, derived));
        if (modalLayerUsesDesignPixels && ingameBoardFrame) {
            h = Math.min(h, INGAME_BOARD_FRAME_MAX_HEIGHT_PX);
        }
        return h;
    }, [initialHeight, designInitialWidth, modalLayerUsesDesignPixels, ingameBoardFrame]);

    const nativeClampedWidthPx = useMemo(() => {
        if (!isNativeMobile) return undefined;
        const base = calculatedWidth ?? designInitialWidth;
        if (base === undefined) return undefined;
        const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
        const vwCap = (vv?.width ?? windowWidth) * (NATIVE_MOBILE_MODAL_MAX_WIDTH_VW / 100);
        return Math.min(base, vwCap);
    }, [isNativeMobile, calculatedWidth, designInitialWidth, windowWidth]);

    const nativeMaxHeightPx = useMemo(() => {
        if (!isNativeMobile) return undefined;
        return windowHeight * (NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH / 100);
    }, [isNativeMobile, windowHeight]);
    
    const calculatedHeight = useMemo(() => {
        if (!resolvedInitialHeight) return undefined;
        
        // 스케일 캔버스 내부에서는 App.tsx의 scale로만 줄이기 위해 viewport 기반 보정 로직을 끕니다.
        if (modalLayerUsesDesignPixels) return resolvedInitialHeight;

        // 모바일이 아닐 때는 initialHeight를 최소값으로 보장 (데스크톱에서는 고정 크기 사용)
        if (!effectiveIsCompactViewport) {
            // 데스크톱: initialHeight를 최소값으로 보장하되, 화면이 너무 작으면 화면 크기에 맞춤
            const minHeight = Math.min(resolvedInitialHeight, windowHeight - 40); // 화면에서 40px 여유 공간
            return Math.max(resolvedInitialHeight * 0.9, minHeight); // initialHeight의 90% 이상 보장
        }
        
        // 모바일: 화면 크기에 맞춤
        const baseHeight = resolvedInitialHeight;
        const viewportRatio = windowHeight / 1080; // 기준 해상도 1080px
        const adjustedHeight = Math.max(300, Math.min(baseHeight, baseHeight * viewportRatio));
        return adjustedHeight;
    }, [resolvedInitialHeight, windowHeight, effectiveIsCompactViewport, modalLayerUsesDesignPixels]);

    const nativeCappedHeightPx = useMemo(() => {
        if (!isNativeMobile || nativeMaxHeightPx === undefined) return undefined;
        const raw = calculatedHeight ?? resolvedInitialHeight;
        /** 설계 높이가 없으면 콘텐츠 높이에 맞추고, maxHeight만으로 상한을 둡니다 */
        if (raw === undefined) return undefined;
        return Math.min(raw, nativeMaxHeightPx);
    }, [isNativeMobile, nativeMaxHeightPx, calculatedHeight, resolvedInitialHeight]);

    const uniformDesignW = designInitialWidth;
    const uniformDesignH = resolvedInitialHeight ?? 720;
    const effectiveMobileMaxHeightVh = mobileViewportMaxHeightVh ?? NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH;

    /** 스크롤형 뷰포트 맞춤은 명시적 true일 때만(프로필·강화 결과·캔버스 안 중첩 등). */
    const useMobileViewportFitLayout =
        mobileViewportFit === true &&
        (effectiveIsCompactViewport || modalLayerUsesDesignPixels);

    const useUniformPcScaleLayout = uniformPcScale && !useMobileViewportFitLayout;

    /** uniform scale: initialHeight가 푸터 미포함일 때 실측 셸 높이를 넣어 하단이 잘리지 않게 함 */
    const [uniformShellMeasuredH, setUniformShellMeasuredH] = useState(0);
    useLayoutEffect(() => {
        if (!isInitialized || !useUniformPcScaleLayout || hideFooter) {
            setUniformShellMeasuredH(0);
            return;
        }
        const el = windowRef.current;
        if (!el) return;
        const sync = () => {
            const h = el.offsetHeight;
            if (h > 0) setUniformShellMeasuredH(h);
        };
        sync();
        const ro = new ResizeObserver(() => requestAnimationFrame(sync));
        ro.observe(el);
        return () => ro.disconnect();
    }, [isInitialized, useUniformPcScaleLayout, hideFooter, windowId, resolvedInitialHeight, designInitialWidth]);

    const uniformHeightForViewportScale = useMemo(() => {
        if (!useUniformPcScaleLayout) return uniformDesignH;
        if (hideFooter) return uniformDesignH;
        return Math.max(uniformDesignH, uniformShellMeasuredH || uniformDesignH);
    }, [useUniformPcScaleLayout, hideFooter, uniformDesignH, uniformShellMeasuredH]);

    const pcUniformScale = useViewportUniformScale(uniformDesignW, uniformHeightForViewportScale, useUniformPcScaleLayout);

    /**
     * 스케일 캔버스 밖에서, 뷰포트 맞춤·uniformPcScale이 아닐 때 실측 균일 scale.
     * PC·모바일 공통: 스크롤 없이 전체가 보이도록 하며 하단 버튼까지 맞춤.
     */
    const useCompactScaleToFitLayout =
        !modalLayerUsesDesignPixels && !useMobileViewportFitLayout && !useUniformPcScaleLayout;

    /** 실측 scale: 본문이 flex-1에 눌려 잘리지 않도록 자연 높이 (아래 containerBaseClass보다 먼저 선언) */
    const bodyScaleToFitNaturalLayout = useCompactScaleToFitLayout;

    const compactFitScaleEstimate = useMemo(() => {
        if (!useCompactScaleToFitLayout) return 1;
        const baseWidth = designInitialWidth || 800;
        const baseHeight = resolvedInitialHeight || uniformDesignH;
        const { horizontal, top, bottom } = getModalScaleFitPaddingPx();
        const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
        const availableWidth = Math.max(40, (vv?.width ?? windowWidth) - horizontal);
        const availableHeight = Math.max(40, (vv?.height ?? windowHeight) - top - bottom);
        const scaleX = availableWidth / baseWidth;
        const scaleY = availableHeight / baseHeight;
        const scale = Math.min(scaleX, scaleY) * 0.99;
        return Math.max(0.1, Math.min(0.98, scale));
    }, [useCompactScaleToFitLayout, designInitialWidth, resolvedInitialHeight, uniformDesignH, windowWidth, windowHeight]);

    const [measuredCompactFitScale, setMeasuredCompactFitScale] = useState<number | null>(null);
    const compactFitScale = measuredCompactFitScale ?? compactFitScaleEstimate;

    const uniformLayout = useUniformPcScaleLayout === true;

    const mobileViewportFitWidthPx = useMemo(() => {
        if (!useMobileViewportFitLayout) return undefined;
        const iw = designInitialWidth;
        const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
        const vw = vv?.width ?? windowWidth;
        const capW = isNativeMobile ? vw * (NATIVE_MOBILE_MODAL_MAX_WIDTH_VW / 100) : vw - 8;
        return Math.max(300, Math.min(iw, capW));
    }, [useMobileViewportFitLayout, designInitialWidth, windowWidth, isNativeMobile]);

    const mobileViewportFitHeightPx = useMemo(() => {
        if (!useMobileViewportFitLayout) return undefined;
        const ih = resolvedInitialHeight ?? 600;
        const capH = isNativeMobile
            ? windowHeight * (effectiveMobileMaxHeightVh / 100)
            : Math.max(280, windowHeight - 28);
        return Math.max(240, Math.min(ih, capH));
    }, [useMobileViewportFitLayout, resolvedInitialHeight, windowHeight, isNativeMobile, effectiveMobileMaxHeightVh]);

    useLayoutEffect(() => {
        if (!useCompactScaleToFitLayout || !isInitialized) {
            setMeasuredCompactFitScale(null);
            return;
        }
        const el = windowRef.current;
        if (!el) return;

        const compute = () => {
            const vv = window.visualViewport;
            const { horizontal, top, bottom } = getModalScaleFitPaddingPx();
            const availW = Math.max(48, (vv?.width ?? window.innerWidth) - horizontal);
            const availH = Math.max(48, (vv?.height ?? window.innerHeight) - top - bottom);
            const w = Math.max(1, el.offsetWidth);
            const h = Math.max(1, el.offsetHeight);
            const s = Math.min(1, availW / w, availH / h) * 0.99;
            setMeasuredCompactFitScale(Math.max(0.08, Math.min(1, Number.isFinite(s) ? s : 1)));
        };

        const ro = new ResizeObserver(() => {
            requestAnimationFrame(compute);
        });
        ro.observe(el);
        let raf = requestAnimationFrame(compute);
        window.addEventListener('resize', compute);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', compute);
        vv?.addEventListener('scroll', compute);
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('resize', compute);
            vv?.removeEventListener('resize', compute);
            vv?.removeEventListener('scroll', compute);
            setMeasuredCompactFitScale(null);
        };
    }, [useCompactScaleToFitLayout, isInitialized, windowWidth, windowHeight, windowId]);

    useEffect(() => {

        positionRef.current = position;

    }, [position]);



     useEffect(() => {

        try {

            const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

            const shouldRemember = settings.rememberPosition ?? true;

            setRememberPosition(shouldRemember);

            if (skipSavedPosition) {
                setPosition({ ...effectiveDefaultPosition });
                try {
                    const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');
                    delete savedPositions[windowId];
                    localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));
                } catch (clearErr) {
                    console.error('Failed to clear saved position for window', windowId, clearErr);
                }
            } else if (shouldRemember && !effectiveIsCompactViewport) {

                const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                if (savedPositions[windowId]) {

                    setPosition(savedPositions[windowId]);

                } else {

                    setPosition({ ...effectiveDefaultPosition });

                }

            } else {

                setPosition({ x: 0, y: 0 });

            }

        } catch (e) {

            console.error("Failed to load window settings from localStorage", e);

            setPosition({ ...effectiveDefaultPosition });

        }

        setIsInitialized(true);

    }, [windowId, effectiveIsCompactViewport, effectiveDefaultPosition.x, effectiveDefaultPosition.y, skipSavedPosition]);





    const handleDragStart = useCallback((clientX: number, clientY: number) => {

        setIsDragging(true);

        dragStartPos.current = { x: clientX, y: clientY };

        initialWindowPos.current = positionRef.current;

    }, []);



    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

        if (!isTopmost || e.button !== 0) return;

        handleDragStart(e.clientX, e.clientY);

    }, [handleDragStart, isTopmost]);



    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {

        if (!isTopmost) return;

        const touch = e.touches[0];

        handleDragStart(touch.clientX, touch.clientY);

    }, [handleDragStart, isTopmost]);

    const applyBoundsClamp = useCallback(() => {
        setPosition((prev) => {
            const el = windowRef.current;
            if (!el) return prev;
            const er = el.getBoundingClientRect();
            if (er.width < 2 && er.height < 2) return prev;
            const modalRoot = document.getElementById('sudamr-modal-root');
            const clamp = getModalClampScreenRect(modalRoot);
            if (!clamp || clamp.width < 4 || clamp.height < 4) return prev;
            const { dcx, dcy } = computeModalScreenCorrection(er, clamp);
            if (Math.abs(dcx) < 0.25 && Math.abs(dcy) < 0.25) return prev;
            const { dx, dy } = screenDeltaToPositionDelta(dcx, dcy);
            return { x: prev.x + dx, y: prev.y + dy };
        });
    }, []);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {

        if (!isDragging || !windowRef.current) return;



        let dx = clientX - dragStartPos.current.x;

        let dy = clientY - dragStartPos.current.y;

        const metrics = getScaledCanvasDragMetrics();
        if (metrics) {
            dx *= metrics.ratioX;
            dy *= metrics.ratioY;
        }

        const newX = initialWindowPos.current.x + dx;

        const newY = initialWindowPos.current.y + dy;

        setPosition({ x: newX, y: newY });

    }, [isDragging]);



    const handleMouseMove = useCallback((e: MouseEvent) => {

        handleDragMove(e.clientX, e.clientY);

    }, [handleDragMove]);



    const handleTouchMove = useCallback((e: TouchEvent) => {

        if (isDragging) {

             const touch = e.touches[0];

             handleDragMove(touch.clientX, touch.clientY);

        }

    }, [isDragging, handleDragMove]);





    const handleDragEnd = useCallback(() => {

        if (isDragging) {

            setIsDragging(false);

            if (rememberPosition && !effectiveIsCompactViewport && !skipSavedPosition) {

                try {

                    const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                    savedPositions[windowId] = positionRef.current;

                    localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));

                } catch (e) {

                    console.error("Failed to save window position to localStorage", e);

                }

            }

        }

    }, [isDragging, windowId, rememberPosition, effectiveIsCompactViewport, skipSavedPosition]);



    useEffect(() => {
        if (!isDragging) return;

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleDragEnd);
        const touchMoveNonPassive = (e: TouchEvent) => {
            e.preventDefault();
            handleTouchMove(e);
        };
        const touchMoveOpts: AddEventListenerOptions = { passive: false };
        window.addEventListener('touchmove', touchMoveNonPassive, touchMoveOpts);
        window.addEventListener('touchend', handleDragEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', touchMoveNonPassive, touchMoveOpts);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, handleMouseMove, handleTouchMove, handleDragEnd]);

    /** 실제 화면 박스 기준으로 영역 밖이면 보정 (transform scale·max-width·스케일 캔버스 모두 반영) */
    useLayoutEffect(() => {
        if (!isInitialized) return;
        applyBoundsClamp();
    }, [
        isInitialized,
        position.x,
        position.y,
        windowWidth,
        windowHeight,
        applyBoundsClamp,
        compactFitScale,
        pcUniformScale,
        useUniformPcScaleLayout,
    ]);

    useLayoutEffect(() => {
        if (!isInitialized || typeof ResizeObserver === 'undefined') return;
        const el = windowRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => applyBoundsClamp());
        ro.observe(el);
        return () => ro.disconnect();
    }, [isInitialized, applyBoundsClamp]);

    useEffect(() => {
        if (!isInitialized) return;
        const run = () => requestAnimationFrame(() => applyBoundsClamp());
        window.addEventListener('resize', run);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', run);
        vv?.addEventListener('scroll', run);
        return () => {
            window.removeEventListener('resize', run);
            vv?.removeEventListener('resize', run);
            vv?.removeEventListener('scroll', run);
        };
    }, [isInitialized, applyBoundsClamp]);

    const handleRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {

        const isChecked = e.target.checked;

        setRememberPosition(isChecked);

        try {

            const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

            settings.rememberPosition = isChecked;

            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

            if (!isChecked) {

                // If unchecked, reset position immediately and clear saved data

                setPosition({ x: 0, y: 0 });

                const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                delete savedPositions[windowId];

                localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));

            }

        } catch (error) {

            console.error("Failed to save remember position setting", error);

        }

    };





    /** 항상 center 기준 + 드래그 오프셋 (모바일 네이티브·viewportFit에서도 동일하게 적용) */
    const positionTranslate = `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`;
    const transformStyle = positionTranslate;



    if (!isInitialized) return null;

    

    const headerCursor = isTopmost ? 'cursor-move' : '';
    const isStoreVariant = variant === 'store';
    const useLargeCorners = Boolean(containerExtraClassName?.includes('rounded-2xl'));
    const headerTopRounded = useLargeCorners ? 'rounded-t-2xl' : 'rounded-t-xl';
    const footerBottomRounded = useLargeCorners ? 'rounded-b-2xl' : 'rounded-b-xl';
    const overlayCornerRounded = useLargeCorners ? 'rounded-2xl' : 'rounded-xl';
    // `relative`를 두면 Tailwind에서 `absolute`/`fixed`보다 우선해 포털 형제 모달이 세로로 쌓이고,
    // 위치 기억 해제 시 (0,0)만으로는 하단으로 밀려 보일 수 있음. 내부 오버레이는 absolute 부모(이 루트)에 붙는다.
    const outerOverflowClass = bodyScaleToFitNaturalLayout ? 'overflow-visible' : 'overflow-hidden';
    const containerBaseClass = modalLayerUsesDesignPixels
        ? `absolute top-1/2 left-1/2 flex flex-col ${outerOverflowClass} rounded-xl transition-shadow duration-200`
        : `fixed top-1/2 left-1/2 flex flex-col ${outerOverflowClass} rounded-xl transition-shadow duration-200`;
    const containerVariantClass = isStoreVariant
        ? 'text-slate-100 bg-gradient-to-br from-[#1f2239] via-[#101a34] to-[#060b12] border border-cyan-300/40 shadow-[0_40px_100px_-45px_rgba(34,211,238,0.65)]'
        : 'sudamr-floating-modal-surface ring-1 ring-inset ring-white/[0.07]';
    const headerVariantClass = isStoreVariant
        ? 'bg-gradient-to-r from-[#1b2645] via-[#15203b] to-[#1b2645] border-b border-cyan-300/30 text-cyan-100'
        : 'border-b border-white/[0.09] bg-gradient-to-r from-secondary/95 via-secondary/75 to-tertiary/55 text-primary shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]';
    const footerVariantClass = isStoreVariant
        ? 'bg-[#111a32] border-t border-cyan-300/30 text-cyan-200'
        : 'border-t border-white/[0.09] bg-gradient-to-t from-tertiary/40 via-secondary/35 to-secondary/45 text-tertiary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
    /** 좁은 뷰포트·네이티브: 본문 글자·여백을 키워 가독성 확보 */
    const isMobileModalShell = effectiveIsCompactViewport || isNativeMobile;
    const bodyPaddingClass =
        bodyPaddingClassName ??
        (isStoreVariant ? 'p-5' : uniformLayout ? 'p-5' : isMobileModalShell ? 'p-5' : 'p-4');
    const viewportMaxWidthCss = '95vw';
    const viewportMaxHeightCss = '80dvh';
    const mobileViewportFitMaxHeightCss = mobileViewportMaxHeightCss ?? viewportMaxHeightCss;
    /** 균일 scale(모든 화면)·실측 scale: max-height로 레이아웃이 먼저 잘리면 스크롤·하단 버튼 잘림 유발 */
    const relaxOuterMaxHeight = useCompactScaleToFitLayout || uniformLayout;
    /** 실측·uniform 균일 scale 시 본문 스크롤 없음(줄바꿈·비율은 transform으로 유지). 뷰포트 맞춤만 스크롤 허용 */
    const forceBodyScrollForViewportClamp =
        !bodyNoScroll && !uniformLayout && !useCompactScaleToFitLayout && !modalLayerUsesDesignPixels;
    const bodyAllowsVerticalScroll =
        !bodyNoScroll &&
        (useMobileViewportFitLayout ||
            (bodyScrollable && !uniformLayout && !useCompactScaleToFitLayout) ||
            forceBodyScrollForViewportClamp);
    const closeButtonClass = isStoreVariant
        ? 'w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-rose-500/85 via-rose-500/75 to-rose-600/85 hover:from-rose-400 hover:via-rose-500 hover:to-rose-600 transition-colors shadow-[0_18px_38px_-24px_rgba(244,63,94,0.75)]'
        : 'w-10 h-10 flex items-center justify-center rounded-full border border-white/14 bg-gradient-to-b from-white/[0.08] to-transparent bg-tertiary/90 text-on-panel shadow-[0_12px_32px_-14px_rgba(0,0,0,0.6)] transition-all duration-200 hover:border-danger/45 hover:bg-danger/90 hover:text-white';

    /** mobileViewportFit: 스크롤은 유지하되 트랙을 숨김(좁은 브라우저·스케일 캔버스에서도 동일) */
    const bodyScrollOverflowClass =
        bodyAllowsVerticalScroll && useMobileViewportFitLayout
            ? 'overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0'
            : bodyAllowsVerticalScroll
              ? 'overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:auto]'
              : 'overflow-hidden';

    const modalContent = (
        <>
            {modal && (
                <div
                    className={`${modalLayerUsesDesignPixels ? 'absolute' : 'fixed'} inset-0 bg-transparent`}
                    style={{ zIndex: effectiveZIndex - 1, pointerEvents: 'auto' }}
                />
            )}
            <div
                ref={windowRef}
                data-draggable-window={windowId}
                data-uniform-pc-scale={useUniformPcScaleLayout ? '1' : undefined}
                aria-label={!headerShowTitle ? title : undefined}
                className={`${containerBaseClass} ${containerVariantClass} min-h-0 ${
                    relaxOuterMaxHeight ? 'max-h-none' : 'max-h-[min(100dvh,100vh)]'
                }${containerExtraClassName ? ` ${containerExtraClassName}` : ''}`}
                style={{
                    width: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? `${mobileViewportFitWidthPx}px`
                          : useCompactScaleToFitLayout
                            ? `${designInitialWidth}px`
                            : effectiveIsCompactViewport
                              ? `${designInitialWidth}px`
                              : isNativeMobile && nativeClampedWidthPx !== undefined
                                ? `${nativeClampedWidthPx}px`
                                : (calculatedWidth ? `${calculatedWidth}px` : `${designInitialWidth}px`),
                    minWidth: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? `${mobileViewportFitWidthPx}px`
                          : useCompactScaleToFitLayout
                            ? `${designInitialWidth}px`
                            : effectiveIsCompactViewport
                              ? `${designInitialWidth}px`
                              : isNativeMobile && nativeClampedWidthPx !== undefined
                                ? `${nativeClampedWidthPx}px`
                                : (calculatedWidth ? `${calculatedWidth}px` : `${Math.max(600, designInitialWidth)}px`),
                    maxWidth: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px)))`
                            : `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 8px))`
                          : isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px)))`
                            : modalLayerUsesDesignPixels
                              ? undefined
                              : (effectiveIsCompactViewport ? viewportMaxWidthCss : `min(${viewportMaxWidthCss}, calc(100vw - 40px))`),
                    height: uniformLayout
                        ? `${uniformDesignH}px`
                        : useMobileViewportFitLayout
                          ? `${mobileViewportFitHeightPx}px`
                          : useCompactScaleToFitLayout
                            ? undefined
                            : effectiveIsCompactViewport
                              ? (resolvedInitialHeight ? `${resolvedInitialHeight}px` : undefined)
                              : isNativeMobile && nativeCappedHeightPx !== undefined
                                ? `${nativeCappedHeightPx}px`
                                : (calculatedHeight ? `${calculatedHeight}px` : (resolvedInitialHeight ? `${resolvedInitialHeight}px` : undefined)),
                    maxHeight: useCompactScaleToFitLayout
                        ? undefined
                        : uniformLayout
                          ? `${uniformDesignH}px`
                          : useMobileViewportFitLayout
                            ? isNativeMobile
                              ? `min(${mobileViewportFitMaxHeightCss}, min(${effectiveMobileMaxHeightVh}dvh, calc(100dvh - 32px)))`
                              : `min(${mobileViewportFitMaxHeightCss}, min(${effectiveMobileMaxHeightVh}dvh, calc(100dvh - 28px)))`
                            : isNativeMobile
                              ? `min(${viewportMaxHeightCss}, min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, 100%))`
                              : modalLayerUsesDesignPixels
                                ? undefined
                                : effectiveIsCompactViewport
                                  ? `min(${viewportMaxHeightCss}, min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 24px)))`
                                  : `min(${viewportMaxHeightCss}, ${pcViewportMaxHeightCss ?? 'calc(100dvh - 12px)'})`,
                    transform: uniformLayout
                        ? `${positionTranslate} scale(${pcUniformScale})`
                        : useMobileViewportFitLayout
                          ? positionTranslate
                          : useCompactScaleToFitLayout
                            ? `${positionTranslate} scale(${compactFitScale})`
                            : transformStyle,
                    transformOrigin: 'center',
                    boxShadow: !isStoreVariant && isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : undefined,
                    zIndex: effectiveZIndex,
                    pointerEvents: 'auto',
                }}
            >
                {!isTopmost && (
                    <div className={`absolute inset-0 z-20 cursor-not-allowed bg-black/30 ${overlayCornerRounded}`} />
                )}
                <div
                    className={`${headerVariantClass} ${headerTopRounded} flex shrink-0 items-center justify-between p-3 ${headerCursor}`}
                    style={{ touchAction: 'none' }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    {headerShowTitle ? (
                        <h2
                            className={`select-none font-bold tracking-tight text-primary ${
                                uniformLayout ? 'text-xl' : isMobileModalShell ? 'text-xl' : 'text-lg'
                            }`}
                        >
                            {title}
                        </h2>
                    ) : (
                        <div className="min-h-[2.5rem] min-w-0 flex-1 self-stretch" aria-hidden />
                    )}
                    <div className="flex items-center gap-2">
                        {headerContent}
                        {onClose && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }} 
                                className={`${closeButtonClass} z-30`}
                                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                            >
                                <span
                                    className={`font-bold text-white ${uniformLayout ? 'text-xl' : 'text-lg'}`}
                                >
                                    ✕
                                </span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div
                        className={`${
                            bodyScaleToFitNaturalLayout
                                ? 'flex w-full min-h-0 flex-shrink-0 flex-col'
                                : 'flex min-h-0 flex-1 flex-col'
                        } ${bodyScrollOverflowClass} ${bodyPaddingClass} ${uniformLayout ? 'antialiased' : ''}${
                            isMobileModalShell ? ' sudamr-mobile-modal-body' : ''
                        }`}
                    >
                        {children}
                    </div>
                    {!hideFooter && (
                        <div
                            className={
                                footerClassName
                                    ? `relative flex min-h-[44px] shrink-0 flex-wrap items-center justify-end gap-2 ${footerBottomRounded} ${footerClassName}`
                                    : `relative flex min-h-[44px] shrink-0 items-center justify-end p-2 ${footerBottomRounded} ${footerVariantClass}`
                            }
                        >
                            <label
                                className={`flex cursor-pointer select-none items-center gap-2 ${
                                    uniformLayout ? 'text-sm' : isMobileModalShell ? 'text-sm' : 'text-xs'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={rememberPosition}
                                    onChange={handleRememberChange}
                                    className="h-4 w-4 rounded border-color bg-tertiary focus:ring-accent"
                                />
                                창 위치 기억하기
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    // Portal target:
    // - App.tsx 스케일 캔버스 내부에 `sudamr-modal-root`가 있으면 그쪽으로 렌더링
    // - 없으면 기존처럼 document.body로 폴백
    const portalTarget = document.getElementById('sudamr-modal-root') ?? document.body;
    return createPortal(modalContent, portalTarget);

};



export default DraggableWindow;
