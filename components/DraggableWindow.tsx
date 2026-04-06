
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useViewportUniformScale } from '../hooks/useViewportUniformScale.js';
import {
    NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_PX,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_VW,
} from '../constants/ads.js';

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
     * 좁은 뷰포트에서 scale 축소 대신 실제 크기로 맞추고 본문만 스크롤.
     * (다른 유저 프로필 등 PC와 동일한 레이아웃·가독성 유지용)
     */
    mobileViewportFit?: boolean;

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

    /** 창 루트 div에 추가 클래스 (게임 설명 등 전용 크롬) */
    containerExtraClassName?: string;

    /** 하단 푸터(창 위치 기억하기) 영역 클래스 — 지정 시 배경·테두리 등을 덮어씁니다 */
    footerClassName?: string;

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
    const margin = 8;
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
    mobileViewportFit = false,
    bodyScrollable = true,
    bodyNoScroll = false,
    hideFooter = false,
    skipSavedPosition = false,
    bodyPaddingClassName,
    uniformPcScale = false,
    containerExtraClassName,
    footerClassName,
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
            // 클릭된 요소가 다른 DraggableWindow 내부에 있는지 확인
            const target = event.target as HTMLElement;
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

    }, [onClose, closeOnOutsideClick, isTopmost]);



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
        if (modalLayerUsesDesignPixels) return initialWidth;

        // 모바일이 아닐 때는 initialWidth를 최소값으로 보장 (데스크톱에서는 고정 크기 사용)
        if (!effectiveIsCompactViewport) {
            // 데스크톱: initialWidth를 최대한 보장하되, 화면이 너무 작으면 화면 크기에 맞춤
            const minWidth = Math.min(initialWidth, windowWidth - 40); // 화면에서 40px 여유 공간
            // initialWidth를 최소한 95% 이상 보장 (90%에서 95%로 증가)
            return Math.max(initialWidth * 0.95, minWidth);
        }
        
        // 모바일: 화면 크기에 맞춤
        const baseWidth = initialWidth;
        const viewportRatio = windowWidth / 1920; // 기준 해상도 1920px
        const adjustedWidth = Math.max(400, Math.min(baseWidth, baseWidth * viewportRatio));
        return adjustedWidth;
    }, [initialWidth, windowWidth, effectiveIsCompactViewport, modalLayerUsesDesignPixels]);

    const nativeClampedWidthPx = useMemo(() => {
        if (!isNativeMobile) return undefined;
        const base = calculatedWidth ?? initialWidth;
        if (base === undefined) return undefined;
        const vwCap = windowWidth * (NATIVE_MOBILE_MODAL_MAX_WIDTH_VW / 100);
        return Math.min(base, vwCap, NATIVE_MOBILE_MODAL_MAX_WIDTH_PX);
    }, [isNativeMobile, calculatedWidth, initialWidth, windowWidth]);

    const nativeMaxHeightPx = useMemo(() => {
        if (!isNativeMobile) return undefined;
        return windowHeight * (NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH / 100);
    }, [isNativeMobile, windowHeight]);
    
    const calculatedHeight = useMemo(() => {
        if (!initialHeight) return undefined;
        
        // 스케일 캔버스 내부에서는 App.tsx의 scale로만 줄이기 위해 viewport 기반 보정 로직을 끕니다.
        if (modalLayerUsesDesignPixels) return initialHeight;

        // 모바일이 아닐 때는 initialHeight를 최소값으로 보장 (데스크톱에서는 고정 크기 사용)
        if (!effectiveIsCompactViewport) {
            // 데스크톱: initialHeight를 최소값으로 보장하되, 화면이 너무 작으면 화면 크기에 맞춤
            const minHeight = Math.min(initialHeight, windowHeight - 40); // 화면에서 40px 여유 공간
            return Math.max(initialHeight * 0.9, minHeight); // initialHeight의 90% 이상 보장
        }
        
        // 모바일: 화면 크기에 맞춤
        const baseHeight = initialHeight;
        const viewportRatio = windowHeight / 1080; // 기준 해상도 1080px
        const adjustedHeight = Math.max(300, Math.min(baseHeight, baseHeight * viewportRatio));
        return adjustedHeight;
    }, [initialHeight, windowHeight, effectiveIsCompactViewport, modalLayerUsesDesignPixels]);

    const nativeCappedHeightPx = useMemo(() => {
        if (!isNativeMobile || nativeMaxHeightPx === undefined) return undefined;
        const raw = calculatedHeight ?? initialHeight;
        /** 설계 높이가 없으면 콘텐츠 높이에 맞추고, maxHeight만으로 상한을 둡니다 */
        if (raw === undefined) return undefined;
        return Math.min(raw, nativeMaxHeightPx);
    }, [isNativeMobile, nativeMaxHeightPx, calculatedHeight, initialHeight]);

    const uniformDesignW = initialWidth ?? 800;
    const uniformDesignH = initialHeight ?? 720;
    /**
     * PC/16:9 설계 캔버스에서만 균일 축소. 네이티브 세로 셸에서는 텍스트·이미지가 과도하게 작아지므로
     * uniformPcScale prop이 있어도 뷰포트 맞춤·스크롤 반응형 경로를 씁니다.
     */
    const useUniformPcScaleLayout =
        uniformPcScale && !(isNativeMobile && !modalLayerUsesDesignPixels);
    const pcUniformScale = useViewportUniformScale(uniformDesignW, uniformDesignH, useUniformPcScaleLayout);

    // 모바일에서 PC 모달 구조를 그대로 사용하고 전체적으로 축소하는 스케일 팩터 계산
    const mobileScaleFactor = useMemo(() => {
        if (useUniformPcScaleLayout) return 1.0;
        if (!effectiveIsCompactViewport) return 1.0;
        if (modalLayerUsesDesignPixels) return 1.0;
        if (mobileViewportFit) return 1.0;

        // 네이티브 모바일: 컨텐츠 맞춤 레이아웃에서 전체 scale 축소 사용 안 함
        if (isNativeMobile) return 1.0;

        // PC 모달 크기를 그대로 사용
        const baseWidth = initialWidth || 800;
        const baseHeight = initialHeight || 600;

        // 화면 크기에서 여유 공간 제외 (좌우 10px씩, 상하 20px씩)
        const availableWidth = windowWidth - 20;
        const availableHeight = windowHeight - 40;

        // 가로/세로 비율에 맞춰서 스케일 계산
        const scaleX = availableWidth / baseWidth;
        const scaleY = availableHeight / baseHeight;

        // 더 작은 스케일을 사용하여 화면 안에 완전히 들어오도록 보장
        const scale = Math.min(scaleX, scaleY);

        // 최소/최대 스케일 제한 (너무 작거나 크지 않도록)
        return Math.max(0.25, Math.min(0.95, scale));
    }, [useUniformPcScaleLayout, effectiveIsCompactViewport, modalLayerUsesDesignPixels, mobileViewportFit, isNativeMobile, windowWidth, windowHeight, initialWidth, initialHeight]);

    /** 모바일에서 축소 없이 뷰포트에 맞춘 프레임 (내부 가로/세로 스크롤) */
    const useMobileViewportFitLayout =
        mobileViewportFit && effectiveIsCompactViewport && !modalLayerUsesDesignPixels;

    /** 네이티브 모바일: 가로·세로를 컨텐츠에 맞추고, 상한만 뷰포트로 제한 (하단 여백 최소화) */
    const useNativeMobileContentFit =
        isNativeMobile && !useMobileViewportFitLayout && !modalLayerUsesDesignPixels && !useUniformPcScaleLayout;

    /** 탭 전환 등으로 본문 길이가 바뀌어도 프레임 크기는 initial*·뷰포트 상한 기준으로 고정 */
    const stableNativeModalWidthPx = useMemo(() => {
        if (!useNativeMobileContentFit) return undefined;
        if (nativeClampedWidthPx !== undefined) return nativeClampedWidthPx;
        const vwCap = windowWidth * (NATIVE_MOBILE_MODAL_MAX_WIDTH_VW / 100);
        return Math.min(vwCap, NATIVE_MOBILE_MODAL_MAX_WIDTH_PX, Math.max(280, windowWidth - 24));
    }, [useNativeMobileContentFit, nativeClampedWidthPx, windowWidth]);

    const stableNativeModalHeightPx = useMemo(() => {
        if (!useNativeMobileContentFit) return undefined;
        if (nativeCappedHeightPx !== undefined) return nativeCappedHeightPx;
        if (nativeMaxHeightPx !== undefined) return nativeMaxHeightPx;
        return Math.min(
            windowHeight * (NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH / 100),
            Math.max(0, windowHeight - 32),
        );
    }, [useNativeMobileContentFit, nativeCappedHeightPx, nativeMaxHeightPx, windowHeight]);

    const uniformLayout = useUniformPcScaleLayout === true;

    const mobileViewportFitWidthPx = useMemo(() => {
        if (!useMobileViewportFitLayout) return undefined;
        const iw = initialWidth ?? 800;
        const capW = isNativeMobile ? windowWidth * (NATIVE_MOBILE_MODAL_MAX_WIDTH_VW / 100) : windowWidth - 16;
        return Math.max(280, Math.min(iw, capW));
    }, [useMobileViewportFitLayout, initialWidth, windowWidth, isNativeMobile]);

    const mobileViewportFitHeightPx = useMemo(() => {
        if (!useMobileViewportFitLayout) return undefined;
        const ih = initialHeight ?? 600;
        const capH = isNativeMobile ? windowHeight * (NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH / 100) : windowHeight - 40;
        return Math.max(240, Math.min(ih, capH));
    }, [useMobileViewportFitLayout, initialHeight, windowHeight, isNativeMobile]);

    useEffect(() => {

        positionRef.current = position;

    }, [position]);



     useEffect(() => {

        try {

            const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

            const shouldRemember = settings.rememberPosition ?? true;

            setRememberPosition(shouldRemember);

            if (skipSavedPosition) {
                setPosition({ ...defaultPosition });
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

                    setPosition({ ...defaultPosition });

                }

            } else {

                setPosition({ x: 0, y: 0 });

            }

        } catch (e) {

            console.error("Failed to load window settings from localStorage", e);

            setPosition({ ...defaultPosition });

        }

        setIsInitialized(true);

    }, [windowId, effectiveIsCompactViewport, defaultPosition.x, defaultPosition.y, skipSavedPosition]);





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
    }, [isInitialized, position.x, position.y, windowWidth, windowHeight, applyBoundsClamp]);

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
    const containerBaseClass = modalLayerUsesDesignPixels
        ? 'absolute top-1/2 left-1/2 flex flex-col overflow-hidden rounded-xl transition-shadow duration-200'
        : 'fixed top-1/2 left-1/2 flex flex-col overflow-hidden rounded-xl transition-shadow duration-200';
    const containerVariantClass = isStoreVariant
        ? 'text-slate-100 bg-gradient-to-br from-[#1f2239] via-[#101a34] to-[#060b12] border border-cyan-300/40 shadow-[0_40px_100px_-45px_rgba(34,211,238,0.65)]'
        : 'sudamr-floating-modal-surface ring-1 ring-inset ring-white/[0.07]';
    const headerVariantClass = isStoreVariant
        ? 'bg-gradient-to-r from-[#1b2645] via-[#15203b] to-[#1b2645] border-b border-cyan-300/30 text-cyan-100'
        : 'border-b border-white/[0.09] bg-gradient-to-r from-secondary/95 via-secondary/75 to-tertiary/55 text-primary shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]';
    const footerVariantClass = isStoreVariant
        ? 'bg-[#111a32] border-t border-cyan-300/30 text-cyan-200'
        : 'border-t border-white/[0.09] bg-gradient-to-t from-tertiary/40 via-secondary/35 to-secondary/45 text-tertiary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
    const bodyPaddingClass =
        bodyPaddingClassName ?? (isStoreVariant ? 'p-5' : uniformLayout ? 'p-5' : 'p-4');
    /** 헤더·푸터는 고정, 본문만 스크롤. bodyNoScroll이면 전부 끔(내부 전용 스크롤 UI용) */
    const bodyAllowsVerticalScroll =
        !bodyNoScroll &&
        (bodyScrollable || useMobileViewportFitLayout || useNativeMobileContentFit);
    const closeButtonClass = isStoreVariant
        ? 'w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-rose-500/85 via-rose-500/75 to-rose-600/85 hover:from-rose-400 hover:via-rose-500 hover:to-rose-600 transition-colors shadow-[0_18px_38px_-24px_rgba(244,63,94,0.75)]'
        : 'w-10 h-10 flex items-center justify-center rounded-full border border-white/14 bg-gradient-to-b from-white/[0.08] to-transparent bg-tertiary/90 text-on-panel shadow-[0_12px_32px_-14px_rgba(0,0,0,0.6)] transition-all duration-200 hover:border-danger/45 hover:bg-danger/90 hover:text-white';

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
                className={`${containerBaseClass} ${containerVariantClass} min-h-0 max-h-[min(100dvh,100vh)]${
                    containerExtraClassName ? ` ${containerExtraClassName}` : ''
                }`}
                style={{
                    width: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? `${mobileViewportFitWidthPx}px`
                          : useNativeMobileContentFit
                            ? `${stableNativeModalWidthPx ?? 320}px`
                            : effectiveIsCompactViewport
                              ? (initialWidth ? `${initialWidth}px` : '800px')
                              : isNativeMobile && nativeClampedWidthPx !== undefined
                                ? `${nativeClampedWidthPx}px`
                                : (calculatedWidth ? `${calculatedWidth}px` : (initialWidth ? `${initialWidth}px` : undefined)),
                    minWidth: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? `${mobileViewportFitWidthPx}px`
                          : useNativeMobileContentFit
                            ? `${stableNativeModalWidthPx ?? 320}px`
                            : effectiveIsCompactViewport
                              ? (initialWidth ? `${initialWidth}px` : '800px')
                              : isNativeMobile && nativeClampedWidthPx !== undefined
                                ? `${nativeClampedWidthPx}px`
                                : (calculatedWidth ? `${calculatedWidth}px` : (initialWidth ? `${Math.max(600, initialWidth)}px` : '600px')),
                    maxWidth: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 16px))`
                            : 'calc(100vw - 16px)'
                          : useNativeMobileContentFit
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 24px), ${NATIVE_MOBILE_MODAL_MAX_WIDTH_PX}px)`
                            : isNativeMobile
                              ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, 100%)`
                              : modalLayerUsesDesignPixels
                                ? undefined
                                : (effectiveIsCompactViewport ? undefined : 'calc(100vw - 40px)'),
                    height: uniformLayout
                        ? `${uniformDesignH}px`
                        : useMobileViewportFitLayout
                          ? `${mobileViewportFitHeightPx}px`
                          : useNativeMobileContentFit
                            ? `${stableNativeModalHeightPx ?? Math.min(windowHeight * (NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH / 100), Math.max(0, windowHeight - 32))}px`
                            : effectiveIsCompactViewport
                              ? (initialHeight ? `${initialHeight}px` : undefined)
                              : isNativeMobile && nativeCappedHeightPx !== undefined
                                ? `${nativeCappedHeightPx}px`
                                : (calculatedHeight ? `${calculatedHeight}px` : (initialHeight ? `${initialHeight}px` : undefined)),
                    maxHeight: uniformLayout
                        ? `${uniformDesignH}px`
                        : useMobileViewportFitLayout
                          ? isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 40px))`
                            : 'calc(100dvh - 40px)'
                          : useNativeMobileContentFit
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px))`
                            : isNativeMobile
                              ? `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, 100%)`
                              : modalLayerUsesDesignPixels
                                ? undefined
                                : effectiveIsCompactViewport
                                  ? `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 24px))`
                                  : '90vh',
                    transform: uniformLayout
                        ? `${positionTranslate} scale(${pcUniformScale})`
                        : useMobileViewportFitLayout || useNativeMobileContentFit
                          ? positionTranslate
                          : effectiveIsCompactViewport
                            ? `${positionTranslate} scale(${mobileScaleFactor})`
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
                    <h2
                        className={`select-none font-bold tracking-tight text-primary ${
                            uniformLayout ? 'text-xl' : 'text-lg'
                        }`}
                    >
                        {title}
                    </h2>
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
                <div
                    className={`flex min-h-0 flex-1 flex-col ${
                        bodyAllowsVerticalScroll
                            ? 'overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]'
                            : 'overflow-hidden'
                    } ${bodyPaddingClass} ${uniformLayout ? 'antialiased' : ''}`}
                >
                    {children}
                </div>
                {!hideFooter && (
                    <div
                        className={
                            footerClassName
                                ? `relative z-[1] flex min-h-[44px] shrink-0 flex-wrap items-center justify-end gap-2 ${footerBottomRounded} ${footerClassName}`
                                : `relative z-[1] flex min-h-[44px] shrink-0 items-center justify-end p-2 ${footerBottomRounded} ${footerVariantClass}`
                        }
                    >
                        <label
                            className={`flex cursor-pointer select-none items-center gap-2 ${
                                uniformLayout ? 'text-sm' : 'text-xs'
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
        </>
    );

    // Portal target:
    // - App.tsx 스케일 캔버스 내부에 `sudamr-modal-root`가 있으면 그쪽으로 렌더링
    // - 없으면 기존처럼 document.body로 폴백
    const portalTarget = document.getElementById('sudamr-modal-root') ?? document.body;
    return createPortal(modalContent, portalTarget);

};



export default DraggableWindow;
