
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useId, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
    getLayoutViewportSize,
    isHandheldPortraitLockActive,
    useIsHandheldDevice,
} from '../hooks/useIsMobileLayout.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useViewportUniformScale } from '../hooks/useViewportUniformScale.js';
import {
    NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_VW,
    isInsideSudamrAdUi,
} from '../constants/ads.js';
import {
    INGAME_BOARD_FRAME_MAX_HEIGHT_PX,
    INGAME_BOARD_FRAME_MAX_WIDTH_PX,
} from '../constants/ingameModalFrame.js';
import { useInGameModalLayout } from '../contexts/InGameModalLayoutContext.js';
import { getModalScaleFitPaddingPx } from '../utils/modalViewportPadding.js';
import {
    bringModalStackEntryToFront,
    isModalStackEntryTop,
    registerModalStackEntry,
    subscribeModalStack,
    unregisterModalStackEntry,
} from '../utils/modalStack.js';

/** 공지 게시판 모달과 동일한 텍스트 「닫기」 버튼 스타일 (DraggableWindow·커스텀 모달 공통) */
export const SUDAMR_MODAL_CLOSE_BUTTON_CLASS =
    'rounded-lg border border-white/15 bg-black/35 px-3 py-1.5 text-sm font-semibold text-amber-50 shadow-sm hover:bg-black/50 sm:px-4 sm:py-2';

interface DraggableWindowProps {

    title: string;

    /** 헤더 제목을 문자열 대신 노드로 렌더(모바일 두 줄 등). 접근성·닫기 라벨은 `title` 문자열을 그대로 사용 */
    titleContent?: ReactNode;

    windowId: string;

    onClose?: () => void;

    children: ReactNode;

    initialWidth?: number;

    initialHeight?: number; // Added

    /**
     * true이고 `initialHeight`를 넘기지 않았을 때: 넓은 모달도 기본 설계 높이(너비 비례)를 쓰지 않고
     * 내용 높이에 맞춘다. `initialHeight`를 숫자로 주면 그 값은 그대로 사용된다.
     */
    shrinkHeightToContent?: boolean;

    modal?: boolean;

    /** false면 전체 화면 딤·블러 배경을 렌더하지 않음(인게임 결과 등에서 보드가 보이게) */
    modalBackdrop?: boolean;

    /**
     * true면 배경 딤·블러 없이 투명(클릭만 흡수). 인게임 경기 시작 확인 등에서 보드가 그대로 보이게 할 때 사용.
     */
    transparentModalBackdrop?: boolean;

    closeOnOutsideClick?: boolean;

    isTopmost?: boolean;

    headerContent?: ReactNode;

    zIndex?: number;

    /** 하위 호환용. 스타일은 default·store 동일(통합 크롬). */
    variant?: 'default' | 'store';

    /** 저장된 위치가 없을 때 사용 (스케일 캔버스에서 보드 옆에 두기 등) */
    defaultPosition?: { x: number; y: number };

    /**
     * 뷰포트 맞춤 레이아웃(너비 상한·본문 스크롤). true면 명시적으로 켭니다.
     * 생략 시에도 좁은 뷰포트·네이티브 앱(스케일 캔버스 밖)에서는 자동으로 동일 모드가 적용되어,
     * PC 설계 프레임을 통째로 축소(scale)해 넣는 방식은 쓰지 않습니다.
     */
    mobileViewportFit?: boolean;

    /** mobileViewportFit + 네이티브: 세로 상한 dvh(미지정 시 광고 상수). 결과 모달 등 한 화면 맞춤용 */
    mobileViewportMaxHeightVh?: number;

    /**
     * mobileViewportFit일 때 max-height의 첫 번째 인자(기본 80dvh).
     * 긴 본문·가로 스크롤 보상 등에서 세로 상한을 조금 올릴 때 사용.
     */
    mobileViewportMaxHeightCss?: string;

    /**
     * mobileViewportFit일 때 `min(..., calc(100dvh - Npx))`의 N(픽셀).
     * 미지정 시 네이티브 32, 그 외 28. 0에 가깝게 두면 모달 세로를 최대한 키울 수 있음.
     */
    mobileViewportDvhBottomGapPx?: number;

    /**
     * 모바일·좁은 뷰포트에서 기본은 콘텐츠 높이에 맞춤(auto)이나,
     * true면 initialHeight를 기준으로 한 고정 높이(뷰포트 상한까지)를 유지 — 채팅 등 본문이 flex로 꽉 차야 할 때.
     */
    mobileLockViewportHeight?: boolean;

    /**
     * 뷰포트 맞춤 셸에서 본문 래퍼의 flex-1 성장을 끄고, 창 높이를 자식 콘텐츠에 맞춤(짧은 확인·상세 팝업용).
     * `mobileLockViewportHeight`와 함께 쓰지 않는 것을 권장합니다.
     */
    bodyShrinkToContent?: boolean;

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

    /** 본문 스크롤 래퍼에 추가 (예: 얇은 스크롤바). `bodyScrollable`일 때 스크롤되는 본문 영역에만 합쳐짐 */
    bodyScrollClassName?: string;

    /**
     * PC 설계 크기(initialWidth/Height) 레이아웃을 유지한 채, 보이는 영역에 맞게 transform scale만 조정합니다.
     * (모바일·스케일 캔버스 안에서도 동일)
     */
    uniformPcScale?: boolean;

    /**
     * true이고 uniformPcScale 사용 시: 본문 래퍼를 flex-1로 늘리지 않아
     * 내용·하단 푸터(창 위치 기억하기) 사이에 빈 세로 공간이 생기지 않게 함.
     */
    bodyAvoidVerticalStretch?: boolean;

    /**
     * true: 헤더에 제목(h2) 표시. 기본 false(닫기·드래그만).
     * 접근성: 제목 숨김 시 `title`은 루트 aria-label·닫기 버튼 라벨에 사용됩니다.
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

    /**
     * PC(넓은 뷰포트, 네이티브·캔버스 특수 경로 제외)에서 프레임 max-width CSS.
     * 가방 등 넓은 모달이 기본 `95vw` 상한에 과도하게 줄지 않도록 할 때 사용.
     */
    pcViewportMaxWidthCss?: string;

    /** 온보딩 스포트라이트: 닫기 버튼에 `data-onboarding-target` 부여 */
    closeButtonDataOnboardingTarget?: string;

    /** true면 스케일 캔버스 안 modal-root 대신 실제 브라우저 뷰포트(document.body)에 렌더링 */
    viewportPortal?: boolean;

    /**
     * 작은 PC 뷰포트에서 자동으로 viewportPortal로 전환할지 여부.
     * 기본 false: 16:9 캔버스 비율을 유지한 채 모달이 함께 축소되도록 한다.
     */
    autoViewportPortalOnSmallDesktop?: boolean;

    /** true면 인게임 보드 프레임 기준 폭/높이 상한을 적용하지 않음 */
    skipIngameBoardFrameSizeCap?: boolean;

}



const SETTINGS_KEY = 'draggableWindowSettings';

/**
 * 모바일(좁은 뷰포트·네이티브)에서 DraggableWindow의 **직계 자식** 마지막 노드에 이 클래스를 붙이면,
 * 해당 노드는 본문 스크롤 밖에 두어 하단에 고정하고 위쪽만 스크롤됩니다. (PC는 기존처럼 한 덩어리로 렌더)
 */
export const SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS = 'sudamr-modal-mobile-sticky-footer';

/** 획득·보상 수령 모달: 확인 버튼을 가운데·적당 폭으로 */
export const ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS = `${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex justify-center px-2 pb-2.5 pt-2.5 sm:px-3 sm:pb-3 sm:pt-3`;

export const ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS =
    'inline-flex min-w-[6.5rem] shrink-0 items-center justify-center rounded-2xl border border-amber-400/45 bg-gradient-to-b from-emerald-500/98 via-emerald-600/96 to-emerald-950/92 px-8 py-2.5 text-[13px] font-semibold tracking-[0.05em] text-white shadow-[0_8px_26px_-14px_rgba(16,185,129,0.52),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.2)] ring-1 ring-white/10 transition-[transform,box-shadow,colors,border-color] hover:border-amber-300/55 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-900 hover:shadow-[0_12px_32px_-12px_rgba(16,185,129,0.42)] active:scale-[0.97] sm:min-w-[7.25rem] sm:px-10 sm:py-3 sm:text-sm';

/**
 * 아이템 획득·일괄 보상 `DraggableWindow`의 위치 저장 키.
 * 획득 종류(골드/다이아/장비/재료 등)마다 다른 `windowId`를 쓰면 내용이 바뀔 때마다 다른 창으로 인식되어 위치가 초기화된다.
 */
export const ITEM_OBTAINED_MODAL_WINDOW_ID = 'item-obtained-modal';

function childHasStickyFooterClassName(node: React.ReactNode): boolean {
    if (!React.isValidElement(node)) return false;
    const cn = (node.props as { className?: unknown }).className;
    return typeof cn === 'string' && cn.split(/\s+/).includes(SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS);
}

function partitionMobileStickyFooter(children: React.ReactNode): { main: React.ReactNode; footer: React.ReactNode | null } {
    const arr = React.Children.toArray(children);
    if (arr.length < 2) return { main: children, footer: null };

    // JSX 줄바꿈/공백이 문자열 노드로 끼어도 마지막 "요소"를 기준으로 스티키 푸터를 분리한다.
    let lastElementIndex = -1;
    for (let i = arr.length - 1; i >= 0; i--) {
        if (React.isValidElement(arr[i])) {
            lastElementIndex = i;
            break;
        }
    }
    if (lastElementIndex >= 0 && childHasStickyFooterClassName(arr[lastElementIndex])) {
        const footer = arr[lastElementIndex]!;
        const main = arr.filter((_, idx) => idx !== lastElementIndex);
        return { main: <>{main}</>, footer };
    }
    return { main: children, footer: null };
}

/** App.tsx 스케일 캔버스: 드래그는 client 픽셀, translate는 설계 픽셀이라 비율·경계를 맞춘다 */
function getScaledCanvasDragMetrics(): {
    boundsW: number;
    boundsH: number;
    ratioX: number;
    ratioY: number;
} | null {
    if (typeof document === 'undefined') return null;
    /** 회전 셸: rect는 뷰포트 축 AABB·offset은 로컬 박스라 비율이 비정상 → 클램프·드래그 보정이 폭주할 수 있음 */
    if (isHandheldPortraitLockActive()) return null;
    const root = document.getElementById('sudamr-modal-root');
    if (!root) return null;
    const r = root.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const ratioX = root.offsetWidth / r.width;
    const ratioY = root.offsetHeight / r.height;
    if (
        !Number.isFinite(ratioX) ||
        !Number.isFinite(ratioY) ||
        ratioX < 0.05 ||
        ratioX > 20 ||
        ratioY < 0.05 ||
        ratioY > 20
    ) {
        return null;
    }
    return {
        boundsW: root.offsetWidth,
        boundsH: root.offsetHeight,
        ratioX,
        ratioY,
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
    /** 닫기 행 실측에 맞춘 대략 높이(패딩 py-1.5 + text-sm 버튼) — 큰 모달 세로 보정용 */
    const headerH = 40;

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

/** 인게임 모달 기본 위치: 바둑판(.go-board-panel) 중심점으로 정렬 */
function getIngameBoardCenteredDefaultPosition(base: { x: number; y: number }): { x: number; y: number } {
    if (typeof document === 'undefined') return base;
    const modalRoot = document.getElementById('sudamr-modal-root');
    const boardEl = document.querySelector('.go-board-panel') as HTMLElement | null;
    if (!modalRoot || !boardEl) return base;

    const rootRect = modalRoot.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    if (rootRect.width <= 0 || rootRect.height <= 0 || boardRect.width <= 0 || boardRect.height <= 0) {
        return base;
    }

    const rootCx = rootRect.left + rootRect.width / 2;
    const rootCy = rootRect.top + rootRect.height / 2;
    const boardCx = boardRect.left + boardRect.width / 2;
    const boardCy = boardRect.top + boardRect.height / 2;
    const dScreenX = boardCx - rootCx;
    const dScreenY = boardCy - rootCy;
    const { dx, dy } = screenDeltaToPositionDelta(dScreenX, dScreenY);
    return { x: base.x + dx, y: base.y + dy };
}

/**
 * `fixed top-1/2 left-1/2` + translate(-50%,-50%) 기준점이 뷰포트(또는 visualViewport) 중앙일 때,
 * 모달 중심이 화면이 아니라 바둑판 패널 중심에 오도록 스크린 픽셀 오프셋을 더한다.
 */
function getIngameBoardCenteredDefaultPositionViewportFixed(base: { x: number; y: number }): { x: number; y: number } {
    if (typeof document === 'undefined' || typeof window === 'undefined') return base;
    const boardEl = document.querySelector('.go-board-panel') as HTMLElement | null;
    if (!boardEl) return base;

    const boardRect = boardEl.getBoundingClientRect();
    if (boardRect.width <= 0 || boardRect.height <= 0) return base;

    const vv = window.visualViewport;
    const refCx = vv ? vv.offsetLeft + vv.width / 2 : window.innerWidth / 2;
    const refCy = vv ? vv.offsetTop + vv.height / 2 : window.innerHeight / 2;

    const boardCx = boardRect.left + boardRect.width / 2;
    const boardCy = boardRect.top + boardRect.height / 2;

    return {
        x: base.x + (boardCx - refCx),
        y: base.y + (boardCy - refCy),
    };
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
    title,
    titleContent,
    windowId,
    onClose,
    children,
    initialWidth = 800,
    initialHeight,
    shrinkHeightToContent = false,
    modal = true,
    modalBackdrop = true,
    transparentModalBackdrop = false,
    closeOnOutsideClick = true,
    isTopmost = true,
    headerContent,
    zIndex,
    variant: _variant = 'default',
    defaultPosition = { x: 0, y: 0 },
    mobileViewportFit,
    mobileViewportMaxHeightVh,
    mobileViewportMaxHeightCss,
    mobileViewportDvhBottomGapPx,
    mobileLockViewportHeight = false,
    bodyShrinkToContent = false,
    bodyScrollable = true,
    bodyNoScroll = false,
    hideFooter = false,
    skipSavedPosition = false,
    bodyPaddingClassName,
    bodyScrollClassName,
    uniformPcScale = false,
    bodyAvoidVerticalStretch = false,
    headerShowTitle = false,
    containerExtraClassName,
    footerClassName,
    pcViewportMaxHeightCss,
    pcViewportMaxWidthCss,
    closeButtonDataOnboardingTarget,
    viewportPortal = false,
    autoViewportPortalOnSmallDesktop = false,
    skipIngameBoardFrameSizeCap = false,
}) => {
    const stackEntryId = useId();
    const [effectiveZIndex, setEffectiveZIndex] = useState(10_000);
    const [isStackTop, setIsStackTop] = useState(false);

    useLayoutEffect(() => {
        const syncTop = () => setIsStackTop(isModalStackEntryTop(stackEntryId));
        setEffectiveZIndex(registerModalStackEntry(stackEntryId, zIndex));
        syncTop();
        const unsub = subscribeModalStack(syncTop);
        return () => {
            unsub();
            unregisterModalStackEntry(stackEntryId);
        };
    }, [stackEntryId, zIndex]);

    /** AppModalLayer 등에서 최상위로 지정된 창을 스택 맨 위로 올림 */
    useLayoutEffect(() => {
        if (!isTopmost) return;
        setEffectiveZIndex(bringModalStackEntryToFront(stackEntryId, zIndex));
    }, [isTopmost, stackEntryId, zIndex]);

    /** 실제 클릭·드래그·딤 차단은 전역 스택 최상단만 */
    const effectiveIsTopmost = isStackTop;

    const [position, setPosition] = useState({ x: 0, y: 0 });

    const [isDragging, setIsDragging] = useState(false);

    const dragStartPos = useRef({ x: 0, y: 0 });

    const initialWindowPos = useRef({ x: 0, y: 0 });

    const [isInitialized, setIsInitialized] = useState(false);

    const positionRef = useRef(position);

    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const { modalLayerUsesDesignPixels: appModalLayerUsesDesignPixels } = useAppContext();

    /** 대국 화면(Game)에서만 true — 모달을 바둑판 패널 크기·위치에 맞춤 */
    const ingameBoardFrame = useInGameModalLayout();

    const [windowWidth, setWindowWidth] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth : 1920,
    );
    const [windowHeight, setWindowHeight] = useState(() =>
        typeof window !== 'undefined' ? window.innerHeight : 1080,
    );
    const useReadableSmallPcViewportPortal =
        !viewportPortal &&
        autoViewportPortalOnSmallDesktop &&
        appModalLayerUsesDesignPixels &&
        !isNativeMobile &&
        !isCompactViewport &&
        (windowWidth < 1440 || windowHeight < 820);
    // 로비: modal-root(z≈60)와 body 혼용 시 z-index가 깨지므로 대국 화면이 아니면 body 포털로 통일.
    // 대국 화면(ingameBoardFrame)은 설계 픽셀·보드 프레임 정렬을 위해 modal-root 유지.
    const effectiveViewportPortal =
        viewportPortal || useReadableSmallPcViewportPortal || !ingameBoardFrame;
    const modalLayerUsesDesignPixels = appModalLayerUsesDesignPixels && !effectiveViewportPortal;

    // PC 16:9 캔버스 안의 모달 루트(설계 픽셀)일 때만 true. 세로형 네이티브 셸에서는 false라 뷰포트·균일축소 분기가 동작함.
    const effectiveIsCompactViewport = modalLayerUsesDesignPixels ? false : isCompactViewport;

    const designInitialWidth = useMemo(() => {
        const w = initialWidth ?? 800;
        if (!skipIngameBoardFrameSizeCap && modalLayerUsesDesignPixels && ingameBoardFrame) {
            return Math.min(w, INGAME_BOARD_FRAME_MAX_WIDTH_PX);
        }
        return w;
    }, [initialWidth, modalLayerUsesDesignPixels, ingameBoardFrame, skipIngameBoardFrameSizeCap]);

    const effectiveDefaultPosition = useMemo(() => {
        const base = { x: defaultPosition?.x ?? 0, y: defaultPosition?.y ?? 0 };
        if (!ingameBoardFrame) return base;
        if (modalLayerUsesDesignPixels) {
            return getIngameBoardCenteredDefaultPosition(base);
        }
        return getIngameBoardCenteredDefaultPositionViewportFixed(base);
    }, [defaultPosition, modalLayerUsesDesignPixels, ingameBoardFrame, windowWidth, windowHeight]);

    const [rememberPosition, setRememberPosition] = useState(true);

    

    const windowRef = useRef<HTMLDivElement>(null);



    const handleClickOutside = useCallback((event: MouseEvent) => {

        if (
            onClose &&
            closeOnOutsideClick &&
            effectiveIsTopmost &&
            windowRef.current
        ) {
            /** 전면·배너 광고는 모달 밖에 있으나 클릭이 document까지 올라오므로 닫기에서 제외 */
            if (isInsideSudamrAdUi(event.target)) return;

            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const clickedInside = path.includes(windowRef.current) || windowRef.current.contains(event.target as Node);
            if (clickedInside) return;
            /** `createPortal(document.body)` 등 창 밖에 붙는 UI(도감 말풍선 등) — 같은 windowId면 바깥 클릭으로 닫지 않음 */
            const target = event.target as HTMLElement | null;
            if (target?.closest?.(`[data-draggable-satellite="${windowId}"]`)) {
                return;
            }
            /** 백드롭은 `windowRef`와 형제라 ancestor 탐색에 안 잡힘 — 다른 창의 딤 클릭 시 부모 모달이 닫히지 않게 함 */
            const foreignBackdrop = target?.closest?.('[data-draggable-window-backdrop]') as HTMLElement | null;
            const backdropOwnerId = foreignBackdrop?.getAttribute('data-draggable-window-backdrop');
            if (backdropOwnerId && backdropOwnerId !== windowId) {
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

    }, [onClose, closeOnOutsideClick, effectiveIsTopmost, windowId]);



    useEffect(() => {

        if (modal && onClose) {

            document.addEventListener('mousedown', handleClickOutside);

            return () => {

                document.removeEventListener('mousedown', handleClickOutside);

            };

        }

    }, [modal, onClose, handleClickOutside]);

    useEffect(() => {
        const handleResize = () => {
            const { width, height } = getLayoutViewportSize();
            setWindowWidth(width);
            setWindowHeight(height);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        window.addEventListener('sudamr-portrait-lock-change', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            window.removeEventListener('sudamr-portrait-lock-change', handleResize);
        };
    }, []);

    // 브라우저 크기에 따라 창 크기를 비례적으로 조정
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
            if (!skipIngameBoardFrameSizeCap && modalLayerUsesDesignPixels && ingameBoardFrame) {
                return Math.min(initialHeight, INGAME_BOARD_FRAME_MAX_HEIGHT_PX);
            }
            return initialHeight;
        }
        if (shrinkHeightToContent) {
            return undefined;
        }
        const baseWidth = designInitialWidth;
        if (baseWidth < 700) return undefined;
        const derived = Math.round(baseWidth * 0.72);
        let h = Math.max(520, Math.min(920, derived));
        if (!skipIngameBoardFrameSizeCap && modalLayerUsesDesignPixels && ingameBoardFrame) {
            h = Math.min(h, INGAME_BOARD_FRAME_MAX_HEIGHT_PX);
        }
        return h;
    }, [initialHeight, designInitialWidth, modalLayerUsesDesignPixels, ingameBoardFrame, shrinkHeightToContent, skipIngameBoardFrameSizeCap]);

    const nativeClampedWidthPx = useMemo(() => {
        if (!isNativeMobile) return undefined;
        const base = calculatedWidth ?? designInitialWidth;
        if (base === undefined) return undefined;
        const { width: layoutW } = getLayoutViewportSize();
        const vwCap = layoutW * (NATIVE_MOBILE_MODAL_MAX_WIDTH_VW / 100);
        return Math.min(base, vwCap);
    }, [isNativeMobile, calculatedWidth, designInitialWidth, windowWidth, windowHeight]);

    const nativeMaxHeightPx = useMemo(() => {
        if (!isNativeMobile) return undefined;
        const { height: layoutH } = getLayoutViewportSize();
        return layoutH * (NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH / 100);
    }, [isNativeMobile, windowWidth, windowHeight]);
    
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

    /**
     * 인게임 설계 픽셀 레이어에서도 작은 뷰포트에서는 모달 실치수를 강제로 캡한다.
     * (App scale만으로는 일부 케이스에서 모달이 오히려 커 보이거나 하단이 잘릴 수 있음)
     */
    const designPixelCompactWidthPx = useMemo(() => {
        if (!modalLayerUsesDesignPixels || !effectiveIsCompactViewport) return undefined;
        const { width: layoutW } = getLayoutViewportSize();
        return Math.max(260, Math.min(designInitialWidth, Math.floor(layoutW - 8)));
    }, [modalLayerUsesDesignPixels, effectiveIsCompactViewport, designInitialWidth, windowWidth, windowHeight]);

    const designPixelCompactHeightPx = useMemo(() => {
        if (!modalLayerUsesDesignPixels || !effectiveIsCompactViewport || !resolvedInitialHeight) return undefined;
        const { height: layoutH } = getLayoutViewportSize();
        return Math.max(240, Math.min(resolvedInitialHeight, Math.floor(layoutH - 12)));
    }, [modalLayerUsesDesignPixels, effectiveIsCompactViewport, resolvedInitialHeight, windowWidth, windowHeight]);

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

    /**
     * 스케일 캔버스 밖의 모바일·네이티브: PC 프레임 통째 축소(scale) 대신 뷰포트 맞춤(전용 셸) 기본.
     * 게임 내 설계 픽셀 레이어에서는 기존처럼 `mobileViewportFit === true`일 때만(중첩·특수 모달).
     */
    const wantsMobileViewportFitShell =
        mobileViewportFit === true ||
        useReadableSmallPcViewportPortal ||
        (!modalLayerUsesDesignPixels && (effectiveIsCompactViewport || isNativeMobile));

    const useMobileViewportFitLayout =
        wantsMobileViewportFitShell &&
        (effectiveIsCompactViewport ||
            modalLayerUsesDesignPixels ||
            isNativeMobile ||
            useReadableSmallPcViewportPortal ||
            /** `mobileViewportFit`만 켠 데스크톱(짧은 창 등): 예전엔 여기가 false여 셸·스티키 푸터가 비활성 → 일괄 사용 등 하단 버튼 잘림 */
            mobileViewportFit === true);

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
     * 스케일 캔버스 밖에서만, 뷰포트 맞춤·uniformPcScale이 아닐 때 실측 균일 scale.
     * 좁은 뷰포트·네이티브에서는 사용하지 않음(PC 축소형 모달 방지).
     */
    const useCompactScaleToFitLayout =
        !modalLayerUsesDesignPixels &&
        !useMobileViewportFitLayout &&
        !useUniformPcScaleLayout &&
        !effectiveIsCompactViewport &&
        !isNativeMobile;

    /** 실측 scale: 본문이 flex-1에 눌려 잘리지 않도록 자연 높이 (아래 containerBaseClass보다 먼저 선언) */
    const bodyScaleToFitNaturalLayout = useCompactScaleToFitLayout;

    /** `bodyShrinkToContent`+뷰포트 맞춤에서 flex-1을 끄면 본문이 콘텐츠 높이만큼만 커져 스크롤 박스가 생기지 않고 부모 overflow에 잘림(모바일 경기 결과 등) */
    const bodyInnerNoFlexGrow =
        bodyScaleToFitNaturalLayout ||
        useReadableSmallPcViewportPortal ||
        (bodyAvoidVerticalStretch && useUniformPcScaleLayout) ||
        (Boolean(bodyShrinkToContent) && useMobileViewportFitLayout && (!bodyScrollable || bodyNoScroll));

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
        const scale = Math.min(scaleX, scaleY);
        return Math.max(0.1, Math.min(0.98, scale));
    }, [useCompactScaleToFitLayout, designInitialWidth, resolvedInitialHeight, uniformDesignH, windowWidth, windowHeight]);

    const [measuredCompactFitScale, setMeasuredCompactFitScale] = useState<number | null>(null);
    const compactFitScale = measuredCompactFitScale ?? compactFitScaleEstimate;

    const uniformLayout = useUniformPcScaleLayout === true;

    const mobileViewportFitWidthPx = useMemo(() => {
        if (!useMobileViewportFitLayout) return undefined;
        const iw = designInitialWidth;
        const { width: layoutW } = getLayoutViewportSize();
        if (useReadableSmallPcViewportPortal) {
            const capW = Math.max(220, layoutW - 4);
            // 작은 PC 포털 분기에서도 설계 폭보다 커지지 않게 고정 (축소 시 역확대 방지)
            return Math.max(220, Math.min(iw, capW));
        }
        const capW = isNativeMobile ? layoutW * (NATIVE_MOBILE_MODAL_MAX_WIDTH_VW / 100) : layoutW - 8;
        return Math.max(300, Math.min(iw, capW));
    }, [useMobileViewportFitLayout, useReadableSmallPcViewportPortal, designInitialWidth, windowWidth, windowHeight, isNativeMobile]);

    /**
     * 뷰포트 맞춤(네이티브·좁은 화면): 고정 height를 주면 initialHeight(예: 600~780)만큼 항상 잡혀 짧은 모달도
     * 불필요하게 길어짐. 높이는 CSS 기본(auto)으로 두고 maxHeight·App.tsx 상한만으로 캡한다.
     * 설계 픽셀 캔버스(대국 중) 경로는 기존처럼 픽셀 높이를 유지한다.
     */
    const mobileViewportFitHeightPx = useMemo(() => {
        if (!useMobileViewportFitLayout) return undefined;
        if (useReadableSmallPcViewportPortal) {
            const designH = resolvedInitialHeight ?? 600;
            const capH = Math.max(220, getLayoutViewportSize().height - 16);
            // 작은 PC 포털 분기에서도 설계 높이보다 커지지 않게 고정 (축소 시 역확대 방지)
            return Math.max(220, Math.min(designH, capH));
        }
        const useContentDrivenHeight =
            !mobileLockViewportHeight &&
            !modalLayerUsesDesignPixels &&
            (isNativeMobile || effectiveIsCompactViewport);
        if (useContentDrivenHeight) {
            return undefined;
        }
        /** `mobileLockViewportHeight`로 셸 높이를 고정할 때는 shrink 전용 분기를 쓰지 않음(그대로 두면 flex 본문 높이 0) */
        if (shrinkHeightToContent && initialHeight === undefined && !mobileLockViewportHeight) {
            return undefined;
        }
        const ih = resolvedInitialHeight ?? 600;
        const layoutH = getLayoutViewportSize().height;
        const layoutHeightBottomGap =
            mobileViewportDvhBottomGapPx !== undefined ? mobileViewportDvhBottomGapPx : isNativeMobile ? 0 : 28;
        const capH = isNativeMobile
            ? layoutH * (effectiveMobileMaxHeightVh / 100)
            : Math.max(280, layoutH - layoutHeightBottomGap);
        return Math.max(240, Math.min(ih, capH));
    }, [
        useMobileViewportFitLayout,
        useReadableSmallPcViewportPortal,
        mobileLockViewportHeight,
        modalLayerUsesDesignPixels,
        isNativeMobile,
        effectiveIsCompactViewport,
        resolvedInitialHeight,
        windowWidth,
        windowHeight,
        effectiveMobileMaxHeightVh,
        mobileViewportDvhBottomGapPx,
        shrinkHeightToContent,
        initialHeight,
    ]);

    const smallPcContentDesignHeight = useMemo(() => {
        const shellH = resolvedInitialHeight ?? uniformDesignH;
        const chromeH = (headerShowTitle ? 54 : 42) + (hideFooter ? 0 : 54);
        return Math.max(240, shellH - chromeH);
    }, [resolvedInitialHeight, uniformDesignH, headerShowTitle, hideFooter]);

    const smallPcBodyContentScale = useMemo(() => {
        if (!useReadableSmallPcViewportPortal || !mobileViewportFitWidthPx) return 1;
        const horizontalPadding = 28;
        const verticalPadding = 24;
        const availableW = Math.max(240, getLayoutViewportSize().width - horizontalPadding);
        const availableH = mobileViewportFitHeightPx
            ? Math.max(220, mobileViewportFitHeightPx - (headerShowTitle ? 54 : 42) - (hideFooter ? 0 : 54) - verticalPadding)
            : Number.POSITIVE_INFINITY;
        const scaleW = availableW / Math.max(1, designInitialWidth);
        const scaleH = availableH / Math.max(1, smallPcContentDesignHeight);
        return Math.max(0.42, Math.min(1, scaleW, scaleH));
    }, [
        useReadableSmallPcViewportPortal,
        mobileViewportFitWidthPx,
        mobileViewportFitHeightPx,
        headerShowTitle,
        hideFooter,
        designInitialWidth,
        smallPcContentDesignHeight,
    ]);

    const smallPcShellWidthPx = useMemo(() => {
        if (!useReadableSmallPcViewportPortal) return undefined;
        const layoutW = getLayoutViewportSize().width;
        const chromePadding = 16;
        const contentW = Math.ceil(designInitialWidth * smallPcBodyContentScale);
        return Math.max(320, Math.min(layoutW - 4, contentW + chromePadding));
    }, [useReadableSmallPcViewportPortal, designInitialWidth, smallPcBodyContentScale, windowWidth, windowHeight]);

    const smallPcScaledContentRef = useRef<HTMLDivElement | null>(null);
    const [smallPcObservedContentHeightPx, setSmallPcObservedContentHeightPx] = useState(0);

    useLayoutEffect(() => {
        if (!useReadableSmallPcViewportPortal) {
            setSmallPcObservedContentHeightPx(0);
            return;
        }
        setSmallPcObservedContentHeightPx(0);
    }, [useReadableSmallPcViewportPortal, windowId, windowWidth, windowHeight]);

    useLayoutEffect(() => {
        if (!useReadableSmallPcViewportPortal) return;
        const el = smallPcScaledContentRef.current;
        if (!el) return;

        const sync = () => {
            const unscaledH = Math.max(el.scrollHeight, el.offsetHeight);
            if (!Number.isFinite(unscaledH) || unscaledH <= 0) return;
            const scaledH = Math.ceil(unscaledH * smallPcBodyContentScale);
            setSmallPcObservedContentHeightPx((prev) => Math.max(prev, scaledH));
        };

        sync();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => requestAnimationFrame(sync)) : null;
        ro?.observe(el);
        const raf = requestAnimationFrame(sync);
        return () => {
            cancelAnimationFrame(raf);
            ro?.disconnect();
        };
    }, [useReadableSmallPcViewportPortal, smallPcBodyContentScale, children, windowId]);

    const smallPcShellHeightPx = useMemo(() => {
        if (!useReadableSmallPcViewportPortal || !mobileViewportFitHeightPx) return undefined;
        const chromeH = Math.max(30, 42 * smallPcBodyContentScale) + (hideFooter ? 0 : Math.max(30, 46 * smallPcBodyContentScale));
        const bodyPaddingH = 16;
        const fallbackBodyH = Math.ceil(smallPcContentDesignHeight * smallPcBodyContentScale);
        const bodyH = smallPcObservedContentHeightPx > 0 ? smallPcObservedContentHeightPx : fallbackBodyH;
        return Math.max(320, Math.min(mobileViewportFitHeightPx, Math.ceil(chromeH + bodyPaddingH + bodyH)));
    }, [
        useReadableSmallPcViewportPortal,
        mobileViewportFitHeightPx,
        smallPcBodyContentScale,
        hideFooter,
        smallPcContentDesignHeight,
        smallPcObservedContentHeightPx,
    ]);

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
            const s = Math.min(1, availW / w, availH / h);
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

            const shouldRemember = settings.rememberPosition ?? false;

            setRememberPosition(shouldRemember);

            /** 인게임에서도 `창 위치 기억하기`가 켜져 있으면 저장 좌표를 쓰고, 끄면 바둑판 중앙 고정(기존 동작) */
            const shouldForceDefaultCenter =
                skipSavedPosition || (Boolean(ingameBoardFrame) && !shouldRemember);
            if (shouldForceDefaultCenter) {
                setPosition({ ...effectiveDefaultPosition });
                try {
                    const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');
                    delete savedPositions[windowId];
                    localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));
                } catch (clearErr) {
                    console.error('Failed to clear saved position for window', windowId, clearErr);
                }
            } else if (shouldRemember) {

                const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                if (savedPositions[windowId]) {

                    setPosition(savedPositions[windowId]);

                } else {

                    setPosition({ ...effectiveDefaultPosition });

                }

            } else {
                // 기본값은 항상 중앙(인게임은 바둑판 중앙)
                setPosition({ ...effectiveDefaultPosition });

            }

        } catch (e) {

            console.error("Failed to load window settings from localStorage", e);

            setPosition({ ...effectiveDefaultPosition });

        }

        setIsInitialized(true);

    }, [windowId, effectiveDefaultPosition.x, effectiveDefaultPosition.y, skipSavedPosition, ingameBoardFrame]);





    const handleDragStart = useCallback((clientX: number, clientY: number) => {

        setIsDragging(true);

        dragStartPos.current = { x: clientX, y: clientY };

        initialWindowPos.current = positionRef.current;

    }, []);



    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

        if (e.button !== 0) return;
        if (effectiveIsTopmost) {
            setEffectiveZIndex(bringModalStackEntryToFront(stackEntryId, zIndex));
        }
        if (!effectiveIsTopmost) return;

        handleDragStart(e.clientX, e.clientY);

    }, [effectiveIsTopmost, handleDragStart, stackEntryId, zIndex]);



    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {

        if (!effectiveIsTopmost) return;

        const touch = e.touches[0];

        handleDragStart(touch.clientX, touch.clientY);

    }, [effectiveIsTopmost, handleDragStart]);

    const applyBoundsClamp = useCallback(() => {
        /** 회전 셸: visualViewport ∩ getBoundingClientRect 클램프가 매 프레임 미세히 달라져 setPosition → effect 무한 루프가 난다 */
        if (isHandheldPortraitLockActive()) return;
        setPosition((prev) => {
            const el = windowRef.current;
            if (!el) return prev;
            const er = el.getBoundingClientRect();
            if (er.width < 2 && er.height < 2) return prev;
            const modalRoot = effectiveViewportPortal ? null : document.getElementById('sudamr-modal-root');
            const clamp = getModalClampScreenRect(modalRoot);
            if (!clamp || clamp.width < 4 || clamp.height < 4) return prev;
            const { dcx, dcy } = computeModalScreenCorrection(er, clamp);
            if (Math.abs(dcx) < 0.25 && Math.abs(dcy) < 0.25) return prev;
            const { dx, dy } = effectiveViewportPortal ? { dx: dcx, dy: dcy } : screenDeltaToPositionDelta(dcx, dcy);
            const nx = prev.x + dx;
            const ny = prev.y + dy;
            if (Math.abs(nx - prev.x) < 0.5 && Math.abs(ny - prev.y) < 0.5) return prev;
            return { x: nx, y: ny };
        });
    }, [effectiveViewportPortal]);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {

        if (!isDragging || !windowRef.current) return;



        let dx = clientX - dragStartPos.current.x;

        let dy = clientY - dragStartPos.current.y;

        const metrics = effectiveViewportPortal ? null : getScaledCanvasDragMetrics();
        if (metrics) {
            dx *= metrics.ratioX;
            dy *= metrics.ratioY;
        }

        const newX = initialWindowPos.current.x + dx;

        const newY = initialWindowPos.current.y + dy;

        setPosition({ x: newX, y: newY });

    }, [effectiveViewportPortal, isDragging]);



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

            if (rememberPosition && !skipSavedPosition) {
                try {
                    const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                    savedPositions[windowId] = positionRef.current;

                    localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));
                } catch (e) {
                    console.error("Failed to save window position to localStorage", e);
                }
            }

            queueMicrotask(() => applyBoundsClamp());
        }
    }, [isDragging, windowId, rememberPosition, skipSavedPosition, applyBoundsClamp]);



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

    /**
     * 뷰포트·스케일 변화 시에만 클램프. position을 deps에 넣으면 applyBoundsClamp → setPosition → 무한 루프가 된다.
     * 드래그 종료 시 보정은 handleDragEnd에서 queueMicrotask로 호출한다.
     */
    useLayoutEffect(() => {
        if (!isInitialized) return;
        applyBoundsClamp();
    }, [
        isInitialized,
        windowWidth,
        windowHeight,
        effectiveDefaultPosition.x,
        effectiveDefaultPosition.y,
        ingameBoardFrame,
        applyBoundsClamp,
        compactFitScale,
        pcUniformScale,
        useUniformPcScaleLayout,
    ]);

    useLayoutEffect(() => {
        if (!isInitialized || typeof ResizeObserver === 'undefined') return;
        const el = windowRef.current;
        if (!el) return;
        let roRaf = 0;
        const ro = new ResizeObserver(() => {
            if (roRaf) cancelAnimationFrame(roRaf);
            roRaf = requestAnimationFrame(() => {
                roRaf = 0;
                applyBoundsClamp();
            });
        });
        ro.observe(el);
        return () => {
            if (roRaf) cancelAnimationFrame(roRaf);
            ro.disconnect();
        };
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

                setPosition({ ...effectiveDefaultPosition });

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

    

    const headerCursor = effectiveIsTopmost ? 'cursor-move' : '';
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
    /** store/default 통일: 글로벌 sudamr-floating-modal-surface + 앰버 톤 헤더·푸터 */
    const containerVariantClass = 'sudamr-floating-modal-surface text-on-panel ring-1 ring-inset ring-amber-400/15';
    const headerVariantClass =
        'relative z-[11] border-b border-amber-400/28 bg-gradient-to-b from-zinc-800/98 via-zinc-950 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]';
    const footerVariantClass =
        'relative z-[11] border-t border-amber-400/25 bg-gradient-to-t from-zinc-950 via-zinc-900/96 to-zinc-900/92 text-amber-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
    /** 좁은 뷰포트·네이티브: 본문 글자·여백을 키워 가독성 확보 */
    const isMobileModalShell = effectiveIsCompactViewport || isNativeMobile || useReadableSmallPcViewportPortal;
    const bodyPaddingClass =
        bodyPaddingClassName ??
        (uniformLayout
            ? 'p-5'
            : useReadableSmallPcViewportPortal
              ? 'p-2'
            : isMobileModalShell
              ? 'p-4 min-[390px]:p-5 max-[360px]:p-3'
              : 'p-4');
    const viewportMaxWidthCss = '95vw';
    const viewportMaxHeightCss = '80dvh';
    const mobileViewportFitMaxHeightCss = mobileViewportMaxHeightCss ?? (isNativeMobile ? viewportMaxHeightCss : 'calc(100dvh - 8px)');
    const mobileViewportFitDvhBottomGapPx =
        mobileViewportDvhBottomGapPx !== undefined ? mobileViewportDvhBottomGapPx : isNativeMobile ? 32 : 28;
    const mobileViewportFitFrameMaxHeightCss = isNativeMobile
        ? `min(${mobileViewportFitMaxHeightCss}, min(${effectiveMobileMaxHeightVh}dvh, calc(100dvh - ${mobileViewportFitDvhBottomGapPx}px)))`
        : `min(${mobileViewportFitMaxHeightCss}, calc(100dvh - ${mobileViewportFitDvhBottomGapPx}px))`;
    /** 균일 scale(모든 화면)·실측 scale: max-height로 레이아웃이 먼저 잘리면 스크롤·하단 버튼 잘림 유발 */
    const relaxOuterMaxHeight = useCompactScaleToFitLayout || uniformLayout;
    /** 실측·uniform 균일 scale 시 본문 스크롤 없음(줄바꿈·비율은 transform으로 유지). 뷰포트 맞춤만 스크롤 허용 */
    const forceBodyScrollForViewportClamp =
        !bodyNoScroll && !uniformLayout && !useCompactScaleToFitLayout && !modalLayerUsesDesignPixels;
    const bodyAllowsVerticalScroll =
        !bodyNoScroll &&
        ((useReadableSmallPcViewportPortal ? bodyScrollable : useMobileViewportFitLayout) ||
            (bodyScrollable && !uniformLayout && !useCompactScaleToFitLayout) ||
            forceBodyScrollForViewportClamp);

    const { main: stickyMain, footer: stickyFooter } = partitionMobileStickyFooter(children);
    const useStickyMobileFooter =
        stickyFooter !== null &&
        !useReadableSmallPcViewportPortal &&
        (isMobileModalShell || useMobileViewportFitLayout);
    /** `bodyNoScroll`이면 본문 스크롤을 끄는데, sticky 푸터 경로만 예외로 켜져 있으면 빈 스크롤 트랙이 생길 수 있음 → 함께 끔(내부에서 스크롤 처리) */
    const scrollRegionAllowsVerticalScroll = (useStickyMobileFooter && !bodyNoScroll) || bodyAllowsVerticalScroll;
    const useSmallPcScaledBodyContent = useReadableSmallPcViewportPortal;
    const smallPcChromeScale = useReadableSmallPcViewportPortal ? smallPcBodyContentScale : 1;
    /** 모바일 셸: 예전 기본(`sudamr-mobile-modal-body`만)은 text-sm 등을 키워 한 화면에 넘치기 쉬움 → dense-copy를 함께 둔다 */
    const mobileBodyClass =
        isMobileModalShell && !useReadableSmallPcViewportPortal
            ? ' sudamr-mobile-modal-body sudamr-mobile-modal-body--dense-copy'
            : '';
    const renderSmallPcScaledBodyContent = (node: React.ReactNode) => {
        if (!useSmallPcScaledBodyContent) return node;
        const measuredH = smallPcObservedContentHeightPx > 0 ? smallPcObservedContentHeightPx : smallPcContentDesignHeight * smallPcBodyContentScale;
        const keepDesignFrameHeight = !useReadableSmallPcViewportPortal && (!bodyScrollable || bodyNoScroll);
        return (
            <div
                className="relative max-w-full overflow-visible"
                style={{
                    width: `${designInitialWidth * smallPcBodyContentScale}px`,
                    height: `${measuredH}px`,
                }}
            >
                <div
                    ref={smallPcScaledContentRef}
                    style={{
                        width: `${designInitialWidth}px`,
                        minHeight: keepDesignFrameHeight ? `${smallPcContentDesignHeight}px` : undefined,
                        transform: `scale(${smallPcBodyContentScale})`,
                        transformOrigin: 'top left',
                    }}
                >
                    {node}
                </div>
            </div>
        );
    };

    /** iOS·WebKit: 중첩 스크롤보다 단일 본문 스크롤이 안정적 — 모멘텀·세로 팬 명시 */
    const bodyScrollTouchClass = 'touch-pan-y [-webkit-overflow-scrolling:touch]';
    /** mobileViewportFit: 스크롤은 유지하되 트랙을 숨김(좁은 브라우저·스케일 캔버스에서도 동일) */
    const bodyScrollOverflowClass =
        useReadableSmallPcViewportPortal && !scrollRegionAllowsVerticalScroll
            ? 'overflow-hidden'
            : scrollRegionAllowsVerticalScroll && useMobileViewportFitLayout
            ? `overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:auto] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 ${bodyScrollTouchClass}`
            : scrollRegionAllowsVerticalScroll
              ? `overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:auto] ${bodyScrollTouchClass}`
              : 'overflow-hidden';

    const modalContent = (
        <>
            {modal && modalBackdrop && (
                <div
                    data-draggable-window-backdrop={windowId}
                    className={`sudamr-draggable-modal-backdrop${transparentModalBackdrop ? ' sudamr-draggable-modal-backdrop--transparent' : ''} ${
                        modalLayerUsesDesignPixels ? 'absolute' : 'fixed'
                    } inset-0`}
                    style={{ zIndex: effectiveZIndex - 1, pointerEvents: 'auto' }}
                    aria-hidden
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
                          ? `${smallPcShellWidthPx ?? mobileViewportFitWidthPx}px`
                          : useCompactScaleToFitLayout
                            ? `${designInitialWidth}px`
                            : effectiveIsCompactViewport
                              ? `${designPixelCompactWidthPx ?? designInitialWidth}px`
                              : isNativeMobile && nativeClampedWidthPx !== undefined
                                ? `${nativeClampedWidthPx}px`
                                : (calculatedWidth ? `${calculatedWidth}px` : `${designInitialWidth}px`),
                    minWidth: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? `${smallPcShellWidthPx ?? mobileViewportFitWidthPx}px`
                          : useCompactScaleToFitLayout
                            ? `${designInitialWidth}px`
                            : effectiveIsCompactViewport
                              ? `${designPixelCompactWidthPx ?? designInitialWidth}px`
                              : isNativeMobile && nativeClampedWidthPx !== undefined
                                ? `${nativeClampedWidthPx}px`
                                : (calculatedWidth ? `${calculatedWidth}px` : `${Math.max(600, designInitialWidth)}px`),
                    maxWidth: uniformLayout
                        ? `${uniformDesignW}px`
                        : useMobileViewportFitLayout
                          ? useReadableSmallPcViewportPortal
                            ? `${smallPcShellWidthPx ?? mobileViewportFitWidthPx}px`
                            : isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px)))`
                            : `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 8px))`
                          : isNativeMobile
                            ? `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px)))`
                            : modalLayerUsesDesignPixels
                              ? effectiveIsCompactViewport
                                ? 'calc(100vw - 8px)'
                                : undefined
                              : (effectiveIsCompactViewport
                                    ? viewportMaxWidthCss
                                    : (pcViewportMaxWidthCss ?? `min(${viewportMaxWidthCss}, calc(100vw - 40px))`)),
                    height: uniformLayout
                        ? `${uniformDesignH}px`
                        : useMobileViewportFitLayout
                          ? (smallPcShellHeightPx ?? mobileViewportFitHeightPx) != null
                              ? `${smallPcShellHeightPx ?? mobileViewportFitHeightPx}px`
                              : undefined
                          : useCompactScaleToFitLayout
                            ? undefined
                            : effectiveIsCompactViewport
                              ? (resolvedInitialHeight ? `${designPixelCompactHeightPx ?? resolvedInitialHeight}px` : undefined)
                              : isNativeMobile && nativeCappedHeightPx !== undefined
                                ? `${nativeCappedHeightPx}px`
                                : (calculatedHeight ? `${calculatedHeight}px` : (resolvedInitialHeight ? `${resolvedInitialHeight}px` : undefined)),
                    maxHeight: useCompactScaleToFitLayout
                        ? undefined
                        : uniformLayout
                          ? `${uniformDesignH}px`
                          : useMobileViewportFitLayout
                            ? useReadableSmallPcViewportPortal
                              ? 'calc(100dvh - 16px)'
                              : mobileViewportFitFrameMaxHeightCss
                            : isNativeMobile
                              ? `min(${viewportMaxHeightCss}, min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, 100%))`
                              : modalLayerUsesDesignPixels
                                ? effectiveIsCompactViewport
                                  ? 'calc(100dvh - 12px)'
                                  : undefined
                                : effectiveIsCompactViewport
                                  ? `min(${viewportMaxHeightCss}, min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 24px)))`
                                  : (pcViewportMaxHeightCss ?? `min(${viewportMaxHeightCss}, calc(100dvh - 12px))`),
                    transform: uniformLayout
                        ? `${positionTranslate} scale(${pcUniformScale})`
                        : useMobileViewportFitLayout
                          ? positionTranslate
                          : useCompactScaleToFitLayout
                            ? `${positionTranslate} scale(${compactFitScale})`
                            : transformStyle,
                    transformOrigin: 'center',
                    boxShadow: isDragging
                        ? '0 32px 64px -24px rgba(0,0,0,0.58), 0 0 72px -32px rgba(251,191,36,0.14)'
                        : undefined,
                    zIndex: effectiveZIndex,
                    pointerEvents: 'auto',
                }}
            >
                {!effectiveIsTopmost && (
                    <div className={`absolute inset-0 z-20 cursor-not-allowed bg-black/30 ${overlayCornerRounded}`} />
                )}
                <div
                    className={`${headerVariantClass} ${headerTopRounded} flex shrink-0 items-center justify-between px-3 py-1.5 sm:py-2 ${headerCursor}`}
                    style={{
                        touchAction: 'none',
                        ...(useReadableSmallPcViewportPortal
                            ? {
                                  minHeight: `${Math.max(30, 42 * smallPcChromeScale)}px`,
                                  paddingTop: `${Math.max(3, 6 * smallPcChromeScale)}px`,
                                  paddingBottom: `${Math.max(3, 6 * smallPcChromeScale)}px`,
                              }
                            : {}),
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    {headerShowTitle ? (
                        <h2
                            className={`min-w-0 flex-1 pr-2 select-none font-bold leading-tight tracking-tight text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${
                                uniformLayout ? 'text-xl' : isMobileModalShell ? 'text-base sm:text-xl' : 'text-lg'
                            }`}
                        >
                            {titleContent ?? title}
                        </h2>
                    ) : (
                        <div className="min-h-0 min-w-0 flex-1" aria-hidden />
                    )}
                    <div className="flex items-center gap-2">
                        {headerContent}
                        {onClose && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                className={`z-30 shrink-0 ${SUDAMR_MODAL_CLOSE_BUTTON_CLASS}`}
                                style={{
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                    ...(useReadableSmallPcViewportPortal
                                        ? {
                                              fontSize: `${Math.max(10, 14 * smallPcChromeScale)}px`,
                                              lineHeight: 1.2,
                                              padding: `${Math.max(4, 6 * smallPcChromeScale)}px ${Math.max(8, 14 * smallPcChromeScale)}px`,
                                          }
                                        : {}),
                                }}
                                aria-label={`${title} 닫기`}
                                {...(closeButtonDataOnboardingTarget
                                    ? { 'data-onboarding-target': closeButtonDataOnboardingTarget }
                                    : {})}
                            >
                                닫기
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {useStickyMobileFooter ? (
                        <>
                            <div
                                className={`flex min-h-0 flex-1 flex-col ${bodyScrollOverflowClass} ${bodyPaddingClass} ${bodyScrollClassName ?? ''} ${
                                    uniformLayout ? 'antialiased' : ''
                                }${mobileBodyClass}`}
                            >
                                {renderSmallPcScaledBodyContent(stickyMain)}
                            </div>
                            <div className="min-w-0 shrink-0">{stickyFooter}</div>
                        </>
                    ) : (
                        <div
                            className={`${
                                bodyInnerNoFlexGrow
                                    ? 'flex w-full min-h-0 flex-shrink-0 flex-col'
                                    : 'flex min-h-0 flex-1 flex-col'
                            } ${bodyScrollOverflowClass} ${bodyPaddingClass} ${bodyScrollClassName ?? ''} ${uniformLayout ? 'antialiased' : ''}${
                                mobileBodyClass
                            }`}
                        >
                            {renderSmallPcScaledBodyContent(children)}
                        </div>
                    )}
                    {!hideFooter && (
                        <div
                            className={
                                footerClassName
                                    ? `relative flex min-h-[46px] shrink-0 flex-wrap items-center justify-end gap-2 ${footerBottomRounded} ${footerClassName}`
                                    : `relative flex min-h-[46px] shrink-0 items-center justify-end p-2 ${footerBottomRounded} ${footerVariantClass}`
                            }
                            style={
                                useReadableSmallPcViewportPortal
                                    ? {
                                          minHeight: `${Math.max(30, 46 * smallPcChromeScale)}px`,
                                          padding: `${Math.max(4, 8 * smallPcChromeScale)}px`,
                                      }
                                    : undefined
                            }
                        >
                            <label
                                className={`flex cursor-pointer select-none items-center gap-2 rounded-lg border border-amber-300/20 bg-black/25 px-2.5 py-1.5 text-amber-50/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-amber-300/35 hover:bg-black/35 ${
                                    uniformLayout ? 'text-sm' : isMobileModalShell ? 'text-sm' : 'text-xs'
                                }`}
                                style={
                                    useReadableSmallPcViewportPortal
                                        ? {
                                              gap: `${Math.max(4, 8 * smallPcChromeScale)}px`,
                                              fontSize: `${Math.max(10, 14 * smallPcChromeScale)}px`,
                                              lineHeight: 1.2,
                                              padding: `${Math.max(4, 6 * smallPcChromeScale)}px ${Math.max(8, 10 * smallPcChromeScale)}px`,
                                          }
                                        : undefined
                                }
                            >
                                <input
                                    type="checkbox"
                                    checked={rememberPosition}
                                    onChange={handleRememberChange}
                                    className="h-4 w-4 cursor-pointer rounded border border-amber-300/45 bg-zinc-900/90 text-amber-400 focus:ring-1 focus:ring-amber-300/50"
                                    style={
                                        useReadableSmallPcViewportPortal
                                            ? {
                                                  width: `${Math.max(12, 16 * smallPcChromeScale)}px`,
                                                  height: `${Math.max(12, 16 * smallPcChromeScale)}px`,
                                              }
                                            : undefined
                                    }
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
    const portalTarget = effectiveViewportPortal ? document.body : document.getElementById('sudamr-modal-root') ?? document.body;
    return createPortal(modalContent, portalTarget);

};



export default DraggableWindow;
