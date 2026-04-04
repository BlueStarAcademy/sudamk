
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
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

    /** 본문 영역 세로 스크롤 (모바일·스케일 캔버스 등에서 긴 모달 내용 잘림 방지) */
    bodyScrollable?: boolean;

    /**
     * mobileViewportFit일 때 기본은 본문 스크롤 허용.
     * true면 스크롤 없이 overflow-hidden (내용을 압축해 한 화면에 맞출 때)
     */
    bodyNoScroll?: boolean;

    /** 하단 "창 위치 기억하기" 영역 숨김 (한 화면에 맞출 때) */
    hideFooter?: boolean;

    /** 본문 패딩 클래스 (지정 시 store/default 패딩 대신 사용) */
    bodyPaddingClassName?: string;

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
    bodyScrollable = false,
    bodyNoScroll = false,
    hideFooter = false,
    bodyPaddingClassName,
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

    // App.tsx에서 1920x1080 캔버스를 scale로 맞추는 환경에서는,
    // DraggableWindow가 viewport(vh)/compact 기반으로 또 줄어들지 않게 막아야 합니다.
    const isInsideScaledCanvas =
        typeof document !== 'undefined' && !!document.getElementById('sudamr-modal-root');
    const effectiveIsCompactViewport = isInsideScaledCanvas ? false : isCompactViewport;

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
        if (isInsideScaledCanvas) return initialWidth;

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
    }, [initialWidth, windowWidth, effectiveIsCompactViewport, isInsideScaledCanvas]);

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
        if (isInsideScaledCanvas) return initialHeight;

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
    }, [initialHeight, windowHeight, effectiveIsCompactViewport, isInsideScaledCanvas]);

    const nativeCappedHeightPx = useMemo(() => {
        if (!isNativeMobile || nativeMaxHeightPx === undefined) return undefined;
        const raw = calculatedHeight ?? initialHeight;
        if (raw === undefined) return nativeMaxHeightPx;
        return Math.min(raw, nativeMaxHeightPx);
    }, [isNativeMobile, nativeMaxHeightPx, calculatedHeight, initialHeight]);

    // 모바일에서 PC 모달 구조를 그대로 사용하고 전체적으로 축소하는 스케일 팩터 계산
    const mobileScaleFactor = useMemo(() => {
        if (!effectiveIsCompactViewport) return 1.0;
        if (isInsideScaledCanvas) return 1.0;
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
    }, [effectiveIsCompactViewport, isInsideScaledCanvas, mobileViewportFit, isNativeMobile, windowWidth, windowHeight, initialWidth, initialHeight]);

    /** 모바일에서 축소 없이 뷰포트에 맞춘 프레임 (내부 가로/세로 스크롤) */
    const useMobileViewportFitLayout =
        mobileViewportFit && effectiveIsCompactViewport && !isInsideScaledCanvas;

    /** 네이티브 모바일: 가로·세로를 컨텐츠에 맞추고, 상한만 뷰포트로 제한 (하단 여백 최소화) */
    const useNativeMobileContentFit =
        isNativeMobile && !useMobileViewportFitLayout && !isInsideScaledCanvas;

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



            if (shouldRemember && !effectiveIsCompactViewport) {

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

    }, [windowId, effectiveIsCompactViewport, defaultPosition.x, defaultPosition.y]);





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

    const clampNativeMobileToVisualViewport = useCallback(() => {
        if (!isNativeMobile || typeof window === 'undefined' || !windowRef.current) return;
        const el = windowRef.current;
        const metrics = getScaledCanvasDragMetrics();
        const r = el.getBoundingClientRect();
        const vv = window.visualViewport;
        const offL = vv ? vv.offsetLeft : 0;
        const offT = vv ? vv.offsetTop : 0;
        const vw = vv ? vv.width : window.innerWidth;
        const vh = vv ? vv.height : window.innerHeight;
        const edge = 8;
        const headerH = 52;
        let dcx = 0;
        let dcy = 0;
        if (r.top < offT + edge) dcy += offT + edge - r.top;
        if (r.top + headerH > offT + vh - edge) dcy += offT + vh - edge - (r.top + headerH);
        if (r.left < offL + edge) dcx += offL + edge - r.left;
        if (r.right > offL + vw - edge) dcx += offL + vw - edge - r.right;
        if (dcx === 0 && dcy === 0) return;
        const rx = metrics ? metrics.ratioX : 1;
        const ry = metrics ? metrics.ratioY : 1;
        setPosition((p) => ({ x: p.x + dcx * rx, y: p.y + dcy * ry }));
    }, [isNativeMobile]);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {

        if (!isDragging || !windowRef.current) return;



        let dx = clientX - dragStartPos.current.x;

        let dy = clientY - dragStartPos.current.y;

        const metrics = getScaledCanvasDragMetrics();
        if (metrics) {
            dx *= metrics.ratioX;
            dy *= metrics.ratioY;
        }

        let newX = initialWindowPos.current.x + dx;

        let newY = initialWindowPos.current.y + dy;

        

        const { offsetWidth, offsetHeight } = windowRef.current;

        let innerWidth = window.innerWidth;

        let innerHeight = window.innerHeight;

        if (metrics) {
            innerWidth = metrics.boundsW;
            innerHeight = metrics.boundsH;
        }



        const halfW = offsetWidth / 2;

        const halfH = offsetHeight / 2;

        

        // Horizontal constraints (keep window fully inside)

        const minX = -(innerWidth / 2) + halfW;

        const maxX = (innerWidth / 2) - halfW;

        

        // Vertical constraints (keep header visible)

        const headerHeight = 50; // Approximate header height for safety margin

        let minY, maxY;



        if (offsetHeight <= innerHeight) {

            // Window is shorter than or same height as viewport

            // Keep it fully inside the viewport

            minY = -(innerHeight / 2) + halfH;

            maxY = (innerHeight / 2) - halfH;

        } else {

            // Window is taller than viewport

            // Allow vertical scrolling, but always keep the header visible

            minY = -(innerHeight / 2) - halfH + headerHeight; // Allow top to go off-screen, but keep header visible

            maxY = (innerHeight / 2) + halfH - headerHeight; // Allow bottom to go off-screen, but keep header visible

        }



        newX = Math.max(minX, Math.min(newX, maxX));

        newY = Math.max(minY, Math.min(newY, maxY));



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

            if (rememberPosition && !effectiveIsCompactViewport) {

                try {

                    const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                    savedPositions[windowId] = positionRef.current;

                    localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));

                } catch (e) {

                    console.error("Failed to save window position to localStorage", e);

                }

            }

        }

    }, [isDragging, windowId, rememberPosition, effectiveIsCompactViewport]);



    useEffect(() => {

        if (isDragging) {

            window.addEventListener('mousemove', handleMouseMove);

            window.addEventListener('mouseup', handleDragEnd);

            window.addEventListener('touchmove', handleTouchMove);

            window.addEventListener('touchend', handleDragEnd);

        }

        return () => {

            window.removeEventListener('mousemove', handleMouseMove);

            window.removeEventListener('mouseup', handleDragEnd);

            window.removeEventListener('touchmove', handleTouchMove);

            window.removeEventListener('touchend', handleDragEnd);

        };

    }, [isDragging, handleMouseMove, handleTouchMove, handleDragEnd]);

    useLayoutEffect(() => {
        if (!isNativeMobile || !isInitialized || !windowRef.current) return;
        clampNativeMobileToVisualViewport();
    }, [position.x, position.y, isNativeMobile, isInitialized, clampNativeMobileToVisualViewport]);

    useEffect(() => {
        if (!isNativeMobile || !isInitialized) return;
        const run = () => requestAnimationFrame(() => clampNativeMobileToVisualViewport());
        window.addEventListener('resize', run);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', run);
        vv?.addEventListener('scroll', run);
        return () => {
            window.removeEventListener('resize', run);
            vv?.removeEventListener('resize', run);
            vv?.removeEventListener('scroll', run);
        };
    }, [isNativeMobile, isInitialized, clampNativeMobileToVisualViewport]);

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





    const transformStyle = `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`;



    if (!isInitialized) return null;

    

    const headerCursor = isTopmost ? 'cursor-move' : '';
    const isStoreVariant = variant === 'store';
    const containerBaseClass = isInsideScaledCanvas
        ? 'absolute top-1/2 left-1/2 rounded-xl flex flex-col transition-shadow duration-200'
        : 'fixed top-1/2 left-1/2 rounded-xl flex flex-col transition-shadow duration-200';
    const containerVariantClass = isStoreVariant
        ? 'text-slate-100 bg-gradient-to-br from-[#1f2239] via-[#101a34] to-[#060b12] border border-cyan-300/40 shadow-[0_40px_100px_-45px_rgba(34,211,238,0.65)]'
        : 'text-on-panel bg-primary border border-color shadow-2xl';
    const headerVariantClass = isStoreVariant
        ? 'bg-gradient-to-r from-[#1b2645] via-[#15203b] to-[#1b2645] border-b border-cyan-300/30 text-cyan-100'
        : 'bg-secondary text-secondary';
    const footerVariantClass = isStoreVariant
        ? 'bg-[#111a32] border-t border-cyan-300/30 text-cyan-200'
        : 'bg-secondary border-color text-tertiary';
    const bodyPaddingClass = bodyPaddingClassName ?? (isStoreVariant ? 'p-5' : 'p-4');
    const bodyAllowsVerticalScroll =
        bodyScrollable ||
        (useMobileViewportFitLayout && !bodyNoScroll) ||
        useNativeMobileContentFit;
    const closeButtonClass = isStoreVariant
        ? 'w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-rose-500/85 via-rose-500/75 to-rose-600/85 hover:from-rose-400 hover:via-rose-500 hover:to-rose-600 transition-colors shadow-[0_18px_38px_-24px_rgba(244,63,94,0.75)]'
        : 'w-10 h-10 flex items-center justify-center rounded-full bg-tertiary hover:bg-danger transition-colors';

    const modalContent = (
        <>
            {modal && (
                <div
                    className={`${
                        isInsideScaledCanvas ? 'absolute' : 'fixed'
                    } inset-0 bg-black/50 ${!isTopmost ? 'backdrop-blur-sm' : ''}`}
                    style={{ zIndex: effectiveZIndex - 1, pointerEvents: 'auto' }}
                />
            )}
            <div
                ref={windowRef}
                data-draggable-window={windowId}
                className={`${containerBaseClass} ${containerVariantClass}${useNativeMobileContentFit ? ' min-h-0' : ''}`}
                style={{
                    width: useMobileViewportFitLayout
                        ? `${mobileViewportFitWidthPx}px`
                        : useNativeMobileContentFit
                          ? 'max-content'
                          : effectiveIsCompactViewport
                            ? (initialWidth ? `${initialWidth}px` : '800px')
                            : isNativeMobile && nativeClampedWidthPx !== undefined
                              ? `${nativeClampedWidthPx}px`
                              : (calculatedWidth ? `${calculatedWidth}px` : (initialWidth ? `${initialWidth}px` : undefined)),
                    minWidth: useMobileViewportFitLayout
                        ? `${mobileViewportFitWidthPx}px`
                        : useNativeMobileContentFit
                          ? 0
                          : effectiveIsCompactViewport
                            ? (initialWidth ? `${initialWidth}px` : '800px')
                            : isNativeMobile && nativeClampedWidthPx !== undefined
                              ? `${nativeClampedWidthPx}px`
                              : (calculatedWidth ? `${calculatedWidth}px` : (initialWidth ? `${Math.max(600, initialWidth)}px` : '600px')),
                    maxWidth: useMobileViewportFitLayout
                        ? isNativeMobile
                          ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 16px))`
                          : 'calc(100vw - 16px)'
                        : useNativeMobileContentFit
                          ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 24px), ${NATIVE_MOBILE_MODAL_MAX_WIDTH_PX}px)`
                          : isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, 100%)`
                            : isInsideScaledCanvas
                              ? undefined
                              : (effectiveIsCompactViewport ? undefined : 'calc(100vw - 40px)'),
                    height: useMobileViewportFitLayout
                        ? `${mobileViewportFitHeightPx}px`
                        : useNativeMobileContentFit
                          ? 'auto'
                          : effectiveIsCompactViewport
                            ? (initialHeight ? `${initialHeight}px` : '600px')
                            : isNativeMobile && nativeCappedHeightPx !== undefined
                              ? `${nativeCappedHeightPx}px`
                              : (calculatedHeight ? `${calculatedHeight}px` : (initialHeight ? `${initialHeight}px` : undefined)),
                    maxHeight: useMobileViewportFitLayout
                        ? isNativeMobile
                          ? `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 40px))`
                          : 'calc(100dvh - 40px)'
                        : useNativeMobileContentFit
                          ? `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px))`
                          : isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, 100%)`
                            : isInsideScaledCanvas
                              ? undefined
                              : (effectiveIsCompactViewport ? undefined : '90vh'),
                    transform: useMobileViewportFitLayout || useNativeMobileContentFit
                        ? 'translate(-50%, -50%)'
                        : effectiveIsCompactViewport
                          ? `translate(-50%, -50%) scale(${mobileScaleFactor})`
                          : transformStyle,
                    transformOrigin: 'center',
                    boxShadow: !isStoreVariant && isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : undefined,
                    zIndex: effectiveZIndex,
                    pointerEvents: 'auto',
                }}
            >
                {!isTopmost && (
                    <div className="absolute inset-0 bg-black/30 z-20 rounded-xl cursor-not-allowed" />
                )}
                <div
                    className={`${headerVariantClass} p-3 rounded-t-xl flex justify-between items-center ${headerCursor}`}
                    style={{ touchAction: 'none' }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    <h2 className="text-lg font-bold select-none">{title}</h2>
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
                                <span className="text-white font-bold text-lg">✕</span>
                            </button>
                        )}
                    </div>
                </div>
                <div
                    className={`flex min-h-0 flex-grow flex-col ${
                        bodyAllowsVerticalScroll
                            ? 'overflow-y-auto overflow-x-hidden overscroll-y-contain'
                            : 'overflow-hidden'
                    } ${bodyPaddingClass}`}
                >
                    {children}
                </div>
                {!hideFooter && (
                    <div className={`flex flex-shrink-0 items-center justify-end rounded-b-xl p-2 ${footerVariantClass}`}>
                        <label className="flex cursor-pointer select-none items-center gap-2 text-xs">
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
