import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Header from './components/Header.js';
import { AppProvider } from './contexts/AppContext.js';
import { useAppContext } from './hooks/useAppContext.js';
import Router from './components/Router.js';
import { preloadImages, ALL_IMAGE_URLS } from './services/assetService.js';
import { audioService } from './services/audioService.js';
import InstallPrompt from './components/InstallPrompt.js';
import AppModalLayer from './components/AppModalLayer.js';
import { VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT } from './hooks/useIsMobileLayout.js';
import AdProvider from './components/ads/AdProvider.js';
import AdBanner from './components/ads/AdBanner.js';
import AdInterstitial from './components/ads/AdInterstitial.js';
import NativeMobileDock from './components/mobile/NativeMobileDock.js';
import NativeMobileScaledContent from './components/mobile/NativeMobileScaledContent.js';
import QuickAccessSidebar from './components/QuickAccessSidebar.js';
import OnboardingTutorialOverlay from './components/onboarding/OnboardingTutorialOverlay.js';
import MainBackgroundLayer from './components/MainBackgroundLayer.js';
import {
    NATIVE_MOBILE_SHELL_MAX_WIDTH,
    NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH,
    NATIVE_MOBILE_CHAT_MODAL_MAX_HEIGHT_VH,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_VW,
} from './constants/ads.js';
import { syncDocumentViewportHeightVar } from './utils/layoutViewportCss.js';

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

/**
 * PC 셸의 transform: scale()이 소수 배율이면 글리프가 뭉개져 보이기 쉬움.
 * 1) 스케일 후 논리 크기가 정수 CSS 픽셀에 가깝게
 * 2) devicePixelRatio 그리드에 맞춰(125%/150% 윈도 배율 등) 래스터 정렬
 */
function snapUniformCanvasScale(fitW: number, fitH: number, designW: number, designH: number): number {
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

// AppContent is the part of the app that can access the context
const AppContent: React.FC = () => {
    const {
        currentUser,
        currentUserWithStatus,
        currentRoute,
        showExitToast,
        serverReconnectNotice,
        hasClaimableQuest,
        settings,
        isNativeMobile,
        isLargeTouchTablet,
        isPhoneHandheldTouch,
        usePortraitFirstShell,
        isNarrowViewport,
    } = useAppContext();
    
    // 에셋 프리로딩은 UX를 위해 백그라운드로 돌리고, 화면을 막지 않도록 함
    const [isPreloading, setIsPreloading] = useState(false);
    const [showQuestToast, setShowQuestToast] = useState(false);
    
    const prevHasClaimableQuest = usePrevious(hasClaimableQuest);

    useEffect(() => {
        if (settings.features.questNotifications && hasClaimableQuest && !prevHasClaimableQuest) {
            setShowQuestToast(true);
            const timer = setTimeout(() => setShowQuestToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [hasClaimableQuest, prevHasClaimableQuest, settings.features.questNotifications]);

    useEffect(() => {
        if (showQuestToast) {
            const timer = setTimeout(() => setShowQuestToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showQuestToast]);


    useEffect(() => {
        const unlockAudio = () => {
            audioService.unlockFromUserGesture();
            void audioService.initialize();
        };
        /** iOS/WebView: passive 터치만으로는 활성화가 안 되는 경우가 있어 capture + non-passive */
        const capNonPassive = { capture: true, passive: false } as const;
        const capPassive = { capture: true, passive: true } as const;
        window.addEventListener('pointerdown', unlockAudio, capNonPassive);
        window.addEventListener('touchstart', unlockAudio, capNonPassive);
        document.addEventListener('touchend', unlockAudio, capNonPassive);
        document.addEventListener('click', unlockAudio, capPassive);
        /** 앱플레이어·에뮬레이터는 마우스 다운만 오는 경우가 있음 */
        document.addEventListener('mousedown', unlockAudio, capPassive);
        /** 블루투스 키보드·접근성 입력으로만 조작하는 모바일 */
        window.addEventListener('keydown', unlockAudio, capPassive);
        const onPageShow = () => {
            audioService.unlockFromUserGesture({ warmHtml5Pool: false });
            void audioService.initialize();
        };
        window.addEventListener('pageshow', onPageShow);

        return () => {
            window.removeEventListener('pointerdown', unlockAudio, capNonPassive);
            window.removeEventListener('touchstart', unlockAudio, capNonPassive);
            document.removeEventListener('touchend', unlockAudio, capNonPassive);
            document.removeEventListener('click', unlockAudio, capPassive);
            document.removeEventListener('mousedown', unlockAudio, capPassive);
            window.removeEventListener('keydown', unlockAudio, capPassive);
            window.removeEventListener('pageshow', onPageShow);
        };
    }, []);

    /** 모바일·좁은 뷰포트: 얇은 스크롤바 전역 적용(index.css) */
    useEffect(() => {
        const el = document.documentElement;
        const cls = 'sudamr-mobile-thin-scroll';
        const on = isNativeMobile || isNarrowViewport;
        if (on) el.classList.add(cls);
        else el.classList.remove(cls);
        return () => el.classList.remove(cls);
    }, [isNativeMobile, isNarrowViewport]);

    useEffect(() => {
        if (currentUser) {
            // 우선순위가 높은 이미지들만 먼저 로드 (UI에 즉시 필요한 것들)
            // 나머지는 백그라운드에서 점진적으로 로드
            let cancelled = false;

            // 프리로딩이 오래 걸릴 때만 표시 (짧은 로드는 표시하지 않음)
            const showTimer = setTimeout(() => {
                if (!cancelled) setIsPreloading(true);
            }, 500);

            preloadImages(ALL_IMAGE_URLS, { priority: 'low', batchSize: 15 })
                .catch(() => {
                    // 프리로딩 실패는 치명적이지 않음 (이미지는 필요 시 로드됨)
                })
                .finally(() => {
                    if (cancelled) return;
                    clearTimeout(showTimer);
                    setIsPreloading(false);
                });

            return () => {
                cancelled = true;
                clearTimeout(showTimer);
            };
        } else {
            setIsPreloading(false);
        }
    }, [currentUser]);

    /**
     * 터치 폰만: 물리 가로일 때 OS가 뷰포트를 돌리면 모바일 셸이 풀리고 PC 레이아웃으로 바뀌는 문제가 있다.
     * `screen.orientation.lock` 은 브라우저·전체화면 조건으로 자주 실패하므로, 폰일 때만 index.css 의
     * `sudamr-handheld-portrait-lock` 으로 세로 UI를 유지한다. 8인치+ 태블릿(`isLargeTouchTablet`)은 제외.
     * 잠금은 `innerWidth > innerHeight` 일 때만 걸어 세로에서는 클래스를 두지 않는다(과거 깜빡임 완화).
     */
    useEffect(() => {
        const el = document.documentElement;

        const syncPhonePortraitLock = () => {
            const physicalLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
            const shouldLock = isPhoneHandheldTouch && physicalLandscape;
            const hadLock = el.classList.contains('sudamr-handheld-portrait-lock');

            if (shouldLock) {
                if (!hadLock) {
                    el.classList.add('sudamr-handheld-portrait-lock');
                    el.classList.remove('sudamr-handheld-portrait-secondary', 'sudamr-handheld-real-landscape');
                    el.style.removeProperty('--sudamr-landscape-ui-rotate');
                    syncDocumentViewportHeightVar();
                    window.dispatchEvent(new Event('sudamr-portrait-lock-change'));
                }
            } else if (hadLock) {
                el.classList.remove(
                    'sudamr-handheld-portrait-lock',
                    'sudamr-handheld-portrait-secondary',
                    'sudamr-handheld-real-landscape',
                );
                el.style.removeProperty('--sudamr-landscape-ui-rotate');
                syncDocumentViewportHeightVar();
                window.dispatchEvent(new Event('sudamr-portrait-lock-change'));
            }
        };

        const onGeometryChange = () => {
            requestAnimationFrame(() => syncPhonePortraitLock());
        };

        syncPhonePortraitLock();
        window.addEventListener('resize', onGeometryChange);
        window.addEventListener('orientationchange', onGeometryChange);
        window.addEventListener('sudamr-portrait-lock-change', onGeometryChange);
        const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
        vv?.addEventListener('resize', onGeometryChange);
        const mq = typeof window !== 'undefined' ? window.matchMedia?.('(orientation: landscape)') : undefined;
        mq?.addEventListener('change', onGeometryChange);

        return () => {
            window.removeEventListener('resize', onGeometryChange);
            window.removeEventListener('orientationchange', onGeometryChange);
            window.removeEventListener('sudamr-portrait-lock-change', onGeometryChange);
            vv?.removeEventListener('resize', onGeometryChange);
            mq?.removeEventListener('change', onGeometryChange);
        };
    }, [isPhoneHandheldTouch]);

    /**
     * 터치 폰만: portrait-primary 잠금을 반복 시도해 상하 반전 시에도 UI가 별도 반응하지 않게 유지한다.
     * 8인치+ 태블릿은 이 훅이 돌지 않음(`isPhoneHandheldTouch` false).
     */
    useEffect(() => {
        if (!isPhoneHandheldTouch) {
            return undefined;
        }

        const so = typeof screen !== 'undefined' ? screen.orientation : undefined;

        const tryPortraitPrimaryLock = () => {
            try {
                if (!so?.lock) return;
                void so.lock('portrait-primary').catch(() => {});
            } catch {
                /* lock 은 전체화면·정책 등으로 자주 거절됨 */
            }
        };

        const syncUpsideDownAndLock = () => {
            requestAnimationFrame(() => {
                tryPortraitPrimaryLock();
            });
        };

        syncUpsideDownAndLock();
        so?.addEventListener('change', syncUpsideDownAndLock);
        window.addEventListener('orientationchange', syncUpsideDownAndLock);
        window.addEventListener('resize', syncUpsideDownAndLock);

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                syncUpsideDownAndLock();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            so?.removeEventListener('change', syncUpsideDownAndLock);
            window.removeEventListener('orientationchange', syncUpsideDownAndLock);
            window.removeEventListener('resize', syncUpsideDownAndLock);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [isPhoneHandheldTouch]);

    const isGameView = currentRoute.view === 'game';
    const hideAppHeader = Boolean(currentUser && currentRoute.view === 'set-nickname');
    const showMainBg =
        !currentUser ||
        currentRoute.view === 'profile' ||
        currentRoute.view === 'set-nickname' ||
        currentRoute.view === 'register' ||
        currentRoute.view === 'kakao-callback';
    const backgroundClass = !currentUser ? 'bg-login-background' : showMainBg ? 'bg-zinc-950' : 'bg-primary';

    const pcLikeMobileLayout = settings.graphics.pcLikeMobileLayout === true;
    /** 8인치+ 태블릿(PC 셸)은 세로 스크롤 여유를 PC 화면 보기와 동일하게 둔다 */
    const pcShellUsesScrollLayout = pcLikeMobileLayout || isLargeTouchTablet;
    /** 스케일 셸 전용: 네이티브 모드에서는 좌우 레일·하단 배너로 대체 */
    const showLobbySideAds = Boolean(currentUser && !isGameView && !isNativeMobile);
    /** 닉네임 설정: PC main 세로 스크롤로 빈 영역·이중 스크롤 방지 */
    const lockPcMainScroll = currentUser && currentRoute.view === 'set-nickname';
    /** 챔피언십 인게임 경기장: 퀵스트립 없이 본문만 풀 높이 (로비 #/tournament 는 유지) */
    const championshipVenueType =
        currentRoute.view === 'tournament' && currentRoute.params?.type
            ? String(currentRoute.params.type)
            : null;
    const isChampionshipDungeonVenueType =
        championshipVenueType === 'neighborhood' ||
        championshipVenueType === 'national' ||
        championshipVenueType === 'world';
    const hasChampionshipVenueSession = Boolean(
        currentUserWithStatus &&
            isChampionshipDungeonVenueType &&
            ((championshipVenueType === 'neighborhood' && currentUserWithStatus.lastNeighborhoodTournament) ||
                (championshipVenueType === 'national' && currentUserWithStatus.lastNationalTournament) ||
                (championshipVenueType === 'world' && currentUserWithStatus.lastWorldTournament)),
    );
    let hasPendingChampionshipDungeon = false;
    if (typeof window !== 'undefined' && championshipVenueType && isChampionshipDungeonVenueType) {
        try {
            hasPendingChampionshipDungeon = Boolean(
                window.sessionStorage.getItem(`pendingDungeon_${championshipVenueType}`),
            );
        } catch {
            hasPendingChampionshipDungeon = false;
        }
    }
    const hideNativeTopQuickStripForChampionshipArena =
        currentRoute.view === 'tournament' &&
        Boolean(championshipVenueType) &&
        (hasChampionshipVenueSession || hasPendingChampionshipDungeon);

    /** 네이티브 셸 상단 퀵스트립은 프로필 홈/경기장, 전략/놀이 대기실, 길드, 챔피언십 로비, 모험에서 노출 (인게임 경기장 제외) */
    const showNativeTopQuickStrip =
        Boolean(currentUser) &&
        isNativeMobile &&
        !isGameView &&
        !hideAppHeader &&
        ((currentRoute.view === 'profile' &&
            ['home', 'arena'].includes(((currentRoute.params?.tab as string | undefined) ?? 'home')) ) ||
            currentRoute.view === 'waiting' ||
            currentRoute.view === 'guild' ||
            currentRoute.view === 'adventure' ||
            (currentRoute.view === 'tournament' && !hideNativeTopQuickStripForChampionshipArena));

    // 전체 화면을 하나의 그림처럼 동일 비율로 스케일 (고정 캔버스 1920x1080 → 컨테이너에 맞춤)
    const DESIGN_W = 1920;
    const DESIGN_H = 1080;
    const getInitialScale = () => {
        if (typeof window === 'undefined') return 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w <= 0 || h <= 0) return 1;
        return snapUniformCanvasScale(w, h, DESIGN_W, DESIGN_H);
    };
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(getInitialScale);
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const updateScale = () => {
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (w > 0 && h > 0) setScale(snapUniformCanvasScale(w, h, DESIGN_W, DESIGN_H));
        };
        updateScale();
        const ro = new ResizeObserver(updateScale);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isNativeMobile]);

    return (
        <div className={`font-sans ${backgroundClass} text-primary flex flex-col`} style={{ 
            minHeight: '100%',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
                                    paddingBottom: isNarrowViewport ? 'env(safe-area-inset-bottom, 0px)' : '0px'
        }}>
            {isPreloading && (
                <div className="fixed bottom-4 right-4 z-[100] bg-panel border border-color text-on-panel rounded-lg shadow-xl px-3 py-2 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">에셋 로딩 중...</span>
                </div>
            )}
            {showExitToast && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6 pointer-events-none"
                    style={{
                        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
                        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
                        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
                    }}
                    role="status"
                    aria-live="polite"
                >
                    <div className="pointer-events-auto w-full max-w-md animate-fade-in">
                        <div className="rounded-xl border-2 border-color bg-primary p-4 text-center text-base font-semibold leading-snug text-primary shadow-2xl">
                            한번 더 뒤로가기를 하면 로그아웃 됩니다.
                        </div>
                    </div>
                </div>
            )}
            {serverReconnectNotice && (
                <div
                    className="fixed inset-0 z-[199] flex items-start justify-center px-4 py-6 pointer-events-none"
                    style={{
                        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
                    }}
                    role="status"
                    aria-live="polite"
                >
                    <div className="pointer-events-auto mt-2 w-full max-w-md animate-fade-in">
                        <div className="rounded-xl border border-amber-500/40 bg-zinc-900/95 p-3 text-center text-sm font-medium leading-snug text-amber-100 shadow-2xl backdrop-blur-sm">
                            {serverReconnectNotice}
                        </div>
                    </div>
                </div>
            )}
            {currentUser ? <OnboardingTutorialOverlay /> : null}

            {usePortraitFirstShell ? (
                <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full overflow-hidden relative">
                    <style>{`
                        /* PC 설계 크기 + transform scale( uniformPcScale ) 창은 상한을 쓰면 본문이 잘리고 버튼이 사라짐 → 제외 */
                        #sudamr-modal-root [data-draggable-window]:not([data-uniform-pc-scale="1"]) {
                            max-width: min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px))) !important;
                            max-height: min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px)) !important;
                            box-sizing: border-box;
                        }
                        #sudamr-modal-root [data-draggable-window="chat-quick-modal"]:not([data-uniform-pc-scale="1"]) {
                            max-height: min(${NATIVE_MOBILE_CHAT_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px)) !important;
                        }
                    `}</style>
                    {/* 착수 확정 등 인게임 크롬: 모달(z-60)보다 아래 — 헤더(z-50)보다 위에 모달이 오도록 루트를 더 높임 */}
                    <div
                        id="sudamr-game-chrome-root"
                        className="pointer-events-none fixed inset-0 z-[25]"
                        style={{ pointerEvents: 'none' }}
                    />
                    {/* aria-hidden 금지: 싱글/튜토리얼 등이 이 루트로 포털할 때 포커스 가능 버튼이 조상에 숨겨지면 브라우저가 경고하고 a11y가 깨짐 */}
                    <div id="sudamr-onboarding-root" className="pointer-events-none fixed inset-0 z-[70]" />
                    <div
                        id="sudamr-modal-root"
                        className="pointer-events-none fixed inset-0 z-[60]"
                        style={{ pointerEvents: 'none' }}
                    />
                    {currentUser ? (
                        <>
                            <div
                                className="mx-auto flex h-full min-h-0 w-full max-h-full min-w-0 flex-1 flex-col overflow-hidden"
                                style={{
                                    maxWidth: NATIVE_MOBILE_SHELL_MAX_WIDTH,
                                    /* 부모 높이 한도: 가로+portrait-lock 시 var(--vh) 미갱신·1vh 폴백이 짧은 변(375)로 셸을 잘랐음 */
                                    maxHeight: '100%',
                                }}
                            >
                            <main
                                className={`relative z-0 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overscroll-y-none ${lockPcMainScroll ? 'overflow-y-hidden' : 'overflow-hidden'} ${showMainBg ? 'bg-transparent' : ''}`}
                            >
                                {showMainBg && <MainBackgroundLayer variant="app" />}
                                <NativeMobileScaledContent className="relative z-[1] min-h-0 w-full flex-1">
                                    {!isGameView && !hideAppHeader && (
                                        <>
                                            <div className="w-full min-w-0 shrink-0">
                                                <Header />
                                            </div>
                                            {showNativeTopQuickStrip && (
                                                <div className="relative z-[45] w-full min-w-0 shrink-0">
                                                    <QuickAccessSidebar mobileHeaderStrip />
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                        <Router />
                                    </div>
                                    {!isGameView && !hideAppHeader && (
                                        <>
                                            <NativeMobileDock />
                                            <div className="w-full flex-shrink-0 border-t border-color/30 bg-primary/95">
                                                <AdBanner position="bottom" className="py-1" />
                                            </div>
                                        </>
                                    )}
                                </NativeMobileScaledContent>
                            </main>
                            </div>
                        </>
                    ) : (
                        <div className="relative flex flex-1 w-full min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-transparent">
                            <MainBackgroundLayer variant="auth" />
                            <div
                                className={`relative z-10 flex min-h-full w-full flex-1 flex-col items-center justify-center px-3 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:gap-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10 lg:py-12 ${
                                    isNativeMobile ? 'gap-3 py-4' : 'gap-5 py-6'
                                }`}
                            >
                                <header
                                    className={`flex w-full shrink-0 flex-col items-center px-2 text-center subpixel-antialiased [text-rendering:optimizeLegibility] sm:max-w-xl sm:gap-1 lg:max-w-3xl lg:gap-2 ${
                                        isNativeMobile ? 'max-w-sm gap-1' : 'max-w-lg gap-1.5'
                                    }`}
                                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                                >
                                    <h1
                                        className={`bg-gradient-to-br from-white via-amber-50 to-amber-600 bg-clip-text font-black uppercase leading-[0.92] text-transparent drop-shadow-[0_4px_28px_rgba(251,191,36,0.35)] sm:text-7xl sm:tracking-[0.14em] sm:drop-shadow-[0_6px_36px_rgba(251,191,36,0.28)] lg:text-8xl lg:tracking-[0.12em] xl:text-8xl ${
                                            isNativeMobile
                                                ? 'text-5xl tracking-[0.11em]'
                                                : 'text-6xl tracking-[0.12em]'
                                        }`}
                                    >
                                        SUDAM
                                    </h1>
                                    <p
                                        className={`font-semibold tracking-[0.2em] text-stone-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:text-base sm:tracking-[0.24em] lg:text-lg lg:tracking-[0.26em] ${
                                            isNativeMobile ? 'text-xs tracking-[0.18em]' : 'text-sm'
                                        }`}
                                    >
                                        The Ascending Masters
                                    </p>
                                    <div
                                        className="mt-2 block h-px w-28 max-w-[85%] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent sm:mt-3 sm:w-36 lg:mt-4 lg:w-48"
                                        aria-hidden
                                    />
                                    <p className="mt-2 max-w-xl px-1 text-center text-[10px] leading-relaxed text-stone-300/95 sm:mt-3 sm:px-2 sm:text-xs lg:mt-4 lg:max-w-2xl lg:text-sm">
                                        Supreme Universe of Dueling Ascending Masters (S.U.D.A.M)
                                        <br />
                                        <span className="mt-1 inline-block text-[9px] text-amber-200/85 sm:text-[10px] lg:text-xs">
                                            격돌하는 초인들이 승천하는 최고의 세계
                                        </span>
                                    </p>
                                </header>
                                <main
                                    className="flex w-full min-w-0 shrink-0 flex-col items-center justify-center overflow-x-hidden"
                                    style={{ maxWidth: `min(100%, ${NATIVE_MOBILE_SHELL_MAX_WIDTH}px)` }}
                                >
                                    <Router />
                                </main>
                            </div>
                        </div>
                    )}
                    <AppModalLayer />
                    <AdInterstitial />
                    <InstallPrompt />
                </div>
            ) : (
            /* 전체 앱을 16:9 박스 안에 넣고, 내부는 고정 캔버스(1920x1080)를 scale로 맞춰 “한 장 그림”처럼 동일 비율로 확대/축소 */
            <div
                className={`flex min-h-0 w-full flex-1 flex-col ${
                    lockPcMainScroll ? 'overflow-hidden' : pcShellUsesScrollLayout ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'
                }`}
            >
                <div
                    className="flex min-h-0 w-full flex-1 items-center justify-center"
                    style={
                        lockPcMainScroll
                            ? undefined
                            : pcShellUsesScrollLayout
                              ? { minHeight: VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT }
                              : undefined
                    }
                >
                {showLobbySideAds && (
                    <div className="flex flex-shrink-0 items-center justify-center px-0.5 sm:px-1 self-stretch w-40 max-w-[28vw]">
                        <AdBanner position="left" />
                    </div>
                )}
                <div
                    ref={containerRef}
                    className={`h-full max-h-full aspect-[16/9] overflow-hidden relative flex items-center justify-center min-h-0 min-w-0 max-w-full ${showLobbySideAds ? 'flex-1 w-auto' : 'w-full'}`}
                >
                    {/* 스케일된 실제 픽셀 크기로 클립하면 transform과 부모 높이의 소수점 차이로 생기는 하단 틈/배경 끊김을 막는다 */}
                    <div
                        className="relative shrink-0 overflow-hidden"
                        style={{
                            width: Math.round(DESIGN_W * scale),
                            height: Math.round(DESIGN_H * scale),
                        }}
                    >
                    <div
                        className="sudamr-pc-scaled-canvas-root absolute left-0 top-0 flex flex-col"
                        style={{
                            width: DESIGN_W,
                            height: DESIGN_H,
                            transform: `scale(${scale})`,
                            transformOrigin: '0 0',
                        }}
                    >
                        {currentUser && !isGameView && !hideAppHeader && (
                            <>
                                <Header />
                            </>
                        )}
                        {/* 인게임 크롬(착수 확정 패널 등): 모달보다 아래 레이어 */}
                        <div
                            id="sudamr-game-chrome-root"
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: DESIGN_W,
                                height: DESIGN_H,
                                zIndex: 25,
                                pointerEvents: 'none',
                            }}
                        />
                        <div
                            id="sudamr-onboarding-root"
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: DESIGN_W,
                                height: DESIGN_H,
                                zIndex: 70,
                                pointerEvents: 'none',
                            }}
                        />
                        {/* 
                           Modals/portals that render into document.body will not be scaled.
                           We provide a dedicated portal target inside the scaled canvas.
                        */}
                        <div
                            id="sudamr-modal-root"
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: DESIGN_W,
                                height: DESIGN_H,
                                zIndex: 60,
                                // 비어 있을 때도 전역을 덮어 main(길드전 등) 클릭을 삼키지 않도록. 포털 자식은 기본 pointer-events:auto로 정상 수신.
                                pointerEvents: 'none',
                            }}
                        />
                        
                        {currentUser ? (
                            <main
                                className={`relative flex-1 flex flex-col min-h-0 overflow-x-hidden ${lockPcMainScroll ? 'overflow-y-hidden' : 'overflow-y-auto'} ${showMainBg ? 'bg-transparent' : ''}`}
                                style={{
                                    flex: '1 1 0',
                                    minHeight: 0,
                                    paddingBottom: isNarrowViewport ? 'max(env(safe-area-inset-bottom, 0px), 20px)' : '0px',
                                    WebkitOverflowScrolling: 'touch',
                                    marginBottom: isNarrowViewport ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                                }}
                            >
                                {showMainBg && <MainBackgroundLayer variant="app" />}
                                <div className="relative z-[1] min-h-0 flex-1 flex flex-col">
                                    <Router />
                                </div>
                            </main>
                        ) : (
                            <div className="relative flex flex-1 w-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto overflow-x-hidden bg-transparent px-3 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10 lg:py-12">
                                <MainBackgroundLayer variant="auth" />
                                {/* 상단 중앙 브랜드 — 모바일은 컴팩트, PC는 비율만 키움 */}
                                <header
                                    className="relative z-[2] flex w-full max-w-lg shrink-0 flex-col items-center gap-1 px-2 text-center sm:max-w-xl sm:gap-1.5 lg:max-w-3xl lg:gap-2"
                                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                                >
                                    <h1 className="bg-gradient-to-br from-white via-amber-50 to-amber-600 bg-clip-text text-3xl font-black uppercase tracking-[0.14em] text-transparent drop-shadow-[0_4px_28px_rgba(251,191,36,0.32)] sm:text-4xl sm:tracking-[0.16em] lg:text-6xl lg:tracking-[0.14em] xl:text-7xl">
                                        SUDAM
                                    </h1>
                                    <p className="text-[10px] font-semibold tracking-[0.2em] text-stone-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-xs sm:tracking-[0.24em] lg:text-base lg:tracking-[0.24em]">
                                        The Ascending Masters
                                    </p>
                                    <div
                                        className="mt-2 block h-px w-28 max-w-[80%] bg-gradient-to-r from-transparent via-amber-400/55 to-transparent sm:mt-3 sm:w-32 lg:mt-4 lg:w-48"
                                        aria-hidden
                                    />
                                    <p className="mt-2 max-w-xl px-1 text-center text-[9px] leading-relaxed text-stone-300/95 sm:mt-2.5 sm:px-2 sm:text-[11px] lg:mt-3 lg:max-w-2xl lg:text-sm">
                                        Supreme Universe of Dueling Ascending Masters (S.U.D.A.M)
                                        <br />
                                        <span className="mt-0.5 inline-block text-[8px] text-amber-200/85 sm:text-[10px] lg:text-xs">
                                            격돌하는 초인들이 승천하는 최고의 세계
                                        </span>
                                    </p>
                                </header>
                                <main
                                    className="relative z-[2] flex w-full min-w-0 flex-col items-center justify-center"
                                    style={{ maxWidth: `min(100%, ${NATIVE_MOBILE_SHELL_MAX_WIDTH}px)` }}
                                >
                                    <Router />
                                </main>
                            </div>
                        )}

                        <AppModalLayer />
                        {/* 전면 광고 모달 */}
                        <AdInterstitial />
                        <InstallPrompt />
                    </div>
                    </div>
                </div>
                {showLobbySideAds && (
                    <div className="flex flex-shrink-0 items-center justify-center px-0.5 sm:px-1 self-stretch w-40 max-w-[28vw]">
                        <AdBanner position="right" />
                    </div>
                )}
                </div>
            </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
    return (
        <div className="app-container">
            <AppProvider>
                <AdProvider>
                    <AppContent />
                </AdProvider>
            </AppProvider>
        </div>
    );
};

export default App;