import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Header from './components/Header.js';
import { AppProvider } from './contexts/AppContext.js';
import { useAppContext } from './hooks/useAppContext.js';
import Router from './components/Router.js';
import { preloadImages, ALL_IMAGE_URLS } from './services/assetService.js';
import { audioService } from './services/audioService.js';
import InstallPrompt from './components/InstallPrompt.js';
import AppModalLayer from './components/AppModalLayer.js';
import {
    useIsHandheldDevice,
    VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT,
    computeTouchLayoutProfile,
} from './hooks/useIsMobileLayout.js';
import AdProvider from './components/ads/AdProvider.js';
import AdBanner from './components/ads/AdBanner.js';
import AdInterstitial from './components/ads/AdInterstitial.js';
import NativeMobileDock from './components/mobile/NativeMobileDock.js';
import NativeMobileScaledContent from './components/mobile/NativeMobileScaledContent.js';
import { NATIVE_MOBILE_SHELL_MAX_WIDTH, NATIVE_MOBILE_MODAL_MAX_WIDTH_PX } from './constants/ads.js';

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
        currentRoute,
        showExitToast,
        hasClaimableQuest,
        settings,
        isNativeMobile,
        isLargeTouchTablet,
        isPhoneHandheldTouch,
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
        const initAudio = () => {
            audioService.initialize();
            // 모든 이벤트 리스너 제거
            document.removeEventListener('pointerdown', initAudio);
            document.removeEventListener('touchstart', initAudio);
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchend', initAudio);
        };
        
        // 모바일 환경을 위한 여러 이벤트 타입 지원
        document.addEventListener('pointerdown', initAudio);
        document.addEventListener('touchstart', initAudio);
        document.addEventListener('click', initAudio);
        document.addEventListener('touchend', initAudio);

        return () => {
            document.removeEventListener('pointerdown', initAudio);
            document.removeEventListener('touchstart', initAudio);
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchend', initAudio);
        };
    }, []);

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
     * 터치 폰: 예전엔 세로 보일 때 html에 portrait-lock(-90°)을 걸어 “가로폭 UI”를 긴 변에 맞췄음.
     * 네이티브 셸(홈·독)은 이미 세로 레이아웃이므로 로그인 후에도 쓰면 홈만 가로로 돌아간 것처럼 보임 → 폰+로그인에서는 전역 회전 비활성.
     */
    useEffect(() => {
        const clearClasses = () => {
            const el = document.documentElement;
            el.classList.remove(
                'sudamr-handheld-portrait-lock',
                'sudamr-handheld-portrait-secondary',
                'sudamr-handheld-real-landscape',
            );
            el.style.removeProperty('--sudamr-landscape-ui-rotate');
        };

        const sync = () => {
            const { isPhoneHandheldTouch } = computeTouchLayoutProfile();
            if (!isPhoneHandheldTouch) {
                clearClasses();
                return;
            }
            if (!currentUser) {
                clearClasses();
                return;
            }
            clearClasses();
        };

        const syncSoon = () => {
            sync();
            requestAnimationFrame(sync);
            [16, 50, 120, 280].forEach((ms) => window.setTimeout(sync, ms));
        };

        const mqCoarse = window.matchMedia?.('(pointer: coarse)');
        const mqHover = window.matchMedia?.('(hover: none)');
        mqCoarse?.addEventListener('change', syncSoon);
        mqHover?.addEventListener('change', syncSoon);

        sync();
        window.addEventListener('resize', sync);
        window.addEventListener('orientationchange', syncSoon);
        const mq = window.matchMedia?.('(orientation: portrait)');
        mq?.addEventListener('change', syncSoon);
        const so = typeof screen !== 'undefined' ? (screen as Screen & { orientation?: EventTarget }).orientation : undefined;
        so?.addEventListener?.('change', syncSoon as EventListener);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', sync);
        return () => {
            mqCoarse?.removeEventListener('change', syncSoon);
            mqHover?.removeEventListener('change', syncSoon);
            window.removeEventListener('resize', sync);
            window.removeEventListener('orientationchange', syncSoon);
            mq?.removeEventListener('change', syncSoon);
            so?.removeEventListener?.('change', syncSoon as EventListener);
            vv?.removeEventListener('resize', sync);
            clearClasses();
        };
    }, [currentUser]);

    const isGameView = currentRoute.view === 'game';
    const backgroundClass = currentUser ? 'bg-primary' : 'bg-login-background';

    const isHandheld = useIsHandheldDevice(1025);
    const pcLikeMobileLayout = settings.graphics.pcLikeMobileLayout === true;
    /** 8인치+ 태블릿(PC 셸)은 세로 스크롤 여유를 PC 화면 보기와 동일하게 둔다 */
    const pcShellUsesScrollLayout = pcLikeMobileLayout || isLargeTouchTablet;
    /**
     * 터치 폰: 항상 세로형 셸. 대형 태블릿은 PC 로그인 셸.
     */
    const usePortraitFirstShell =
        isNativeMobile || (!currentUser && isHandheld && !isLargeTouchTablet);
    /** 스케일 셸 전용: 네이티브 모드에서는 좌우 레일·하단 배너로 대체 */
    const showLobbySideAds = Boolean(currentUser && !isGameView && !isNativeMobile);

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
                                    paddingBottom: isHandheld ? 'env(safe-area-inset-bottom, 0px)' : '0px'
        }}>
            {isPreloading && (
                <div className="fixed bottom-4 right-4 z-[100] bg-panel border border-color text-on-panel rounded-lg shadow-xl px-3 py-2 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">에셋 로딩 중...</span>
                </div>
            )}
            {showExitToast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down-fast">
                    <div className="bg-primary border-2 border-color rounded-lg shadow-2xl p-3 text-primary font-semibold text-center">한번 더 뒤로가기를 하면 로그아웃 됩니다.</div>
                </div>
            )}
            
            {usePortraitFirstShell ? (
                <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full overflow-hidden relative">
                    <style>{`
                        #sudamr-modal-root [data-draggable-window] {
                            max-width: ${NATIVE_MOBILE_MODAL_MAX_WIDTH_PX}px !important;
                            box-sizing: border-box;
                        }
                    `}</style>
                    <div
                        id="sudamr-modal-root"
                        className="fixed inset-0 z-[180] pointer-events-none"
                        style={{ pointerEvents: 'none' }}
                    />
                    {currentUser ? (
                        <div
                            className="mx-auto flex min-h-0 w-full flex-1 flex-col"
                            style={{ maxWidth: NATIVE_MOBILE_SHELL_MAX_WIDTH }}
                        >
                            {!isGameView && <Header />}
                            <main
                                className={`flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden ${isGameView ? 'overflow-hidden' : 'overflow-y-auto overscroll-y-contain'}`}
                            >
                                {isPhoneHandheldTouch ? (
                                    <Router />
                                ) : (
                                    <NativeMobileScaledContent>
                                        <Router />
                                    </NativeMobileScaledContent>
                                )}
                            </main>
                            {!isGameView && (
                                <>
                                    <NativeMobileDock />
                                    <div className="w-full flex-shrink-0 border-t border-color/30 bg-primary/95">
                                        <AdBanner position="bottom" className="py-1" />
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="relative flex flex-1 w-full min-h-0 flex-col items-center justify-start gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-transparent px-3 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10 lg:py-12">
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/82 via-black/65 to-black/78" />
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_14%,rgba(180,140,80,0.14),transparent_48%)]" />
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_50%_at_50%_92%,rgba(30,58,95,0.18),transparent_52%)]" />
                            <header
                                className="relative z-10 flex w-full max-w-lg shrink-0 flex-col items-center gap-0.5 px-2 text-center sm:max-w-xl sm:gap-1 lg:max-w-3xl lg:gap-2"
                                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                            >
                                <p className="text-[8px] font-semibold uppercase tracking-[0.38em] text-amber-400/80 sm:text-[10px] sm:tracking-[0.42em] lg:text-xs lg:tracking-[0.48em]">
                                    Online Strategy
                                </p>
                                <h1 className="bg-gradient-to-br from-stone-50 via-amber-100 to-amber-800 bg-clip-text text-2xl font-black uppercase tracking-[0.16em] text-transparent drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] sm:text-4xl sm:tracking-[0.18em] lg:text-6xl lg:tracking-[0.14em] xl:text-7xl">
                                    SUDAM
                                </h1>
                                <p className="text-[9px] font-light tracking-[0.22em] text-stone-400 sm:text-xs sm:tracking-[0.26em] lg:text-base lg:tracking-[0.24em]">
                                    The Ascending Masters
                                </p>
                                <div
                                    className="mt-3 hidden h-px w-32 max-w-[80%] bg-gradient-to-r from-transparent via-amber-500/45 to-transparent sm:block lg:mt-5 lg:w-48"
                                    aria-hidden
                                />
                                <p className="mt-2 hidden max-w-xl px-2 text-center text-[11px] leading-relaxed text-stone-400 sm:mt-3 sm:block sm:text-xs lg:mt-4 lg:max-w-2xl lg:text-sm">
                                    Supreme Universe of Dueling Ascending Masters (S.U.D.A.M)
                                    <br />
                                    <span className="mt-1 inline-block text-[10px] text-stone-500 lg:text-xs">
                                        격돌하는 초인들이 승천하는 최고의 세계
                                    </span>
                                </p>
                            </header>
                            <main
                                className="relative z-10 flex w-full min-h-0 min-w-0 flex-1 flex-col items-stretch justify-start overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
                                style={{ maxWidth: `min(100%, ${NATIVE_MOBILE_SHELL_MAX_WIDTH}px)` }}
                            >
                                {isPhoneHandheldTouch ? (
                                    <Router />
                                ) : (
                                    <NativeMobileScaledContent>
                                        <Router />
                                    </NativeMobileScaledContent>
                                )}
                            </main>
                        </div>
                    )}
                    <AppModalLayer />
                    <AdInterstitial />
                    <InstallPrompt />
                </div>
            ) : (
            /* 전체 앱을 16:9 박스 안에 넣고, 내부는 고정 캔버스(1920x1080)를 scale로 맞춰 “한 장 그림”처럼 동일 비율로 확대/축소 */
            <div
                className={`flex min-h-0 w-full flex-1 flex-col ${pcShellUsesScrollLayout ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'}`}
            >
                <div
                    className="flex min-h-0 w-full flex-1 items-center justify-center"
                    style={pcShellUsesScrollLayout ? { minHeight: VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT } : undefined}
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
                        {currentUser && !isGameView && (
                            <>
                                <Header />
                            </>
                        )}
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
                                // 비어 있을 때도 전역을 덮어 main(길드전 등) 클릭을 삼키지 않도록. 포털 자식은 기본 pointer-events:auto로 정상 수신.
                                pointerEvents: 'none',
                            }}
                        />
                        
                        {currentUser ? (
                            <main
                                className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden"
                                style={{
                                    flex: '1 1 0',
                                    minHeight: 0,
                                    paddingBottom: isHandheld ? 'max(env(safe-area-inset-bottom, 0px), 20px)' : '0px',
                                    WebkitOverflowScrolling: 'touch',
                                    marginBottom: isHandheld ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                                }}
                            >
                                <Router />
                            </main>
                        ) : (
                            <div className="relative flex flex-1 w-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto overflow-x-hidden bg-transparent px-3 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10 lg:py-12">
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/82 via-black/65 to-black/78" />
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_14%,rgba(180,140,80,0.14),transparent_48%)]" />
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_50%_at_50%_92%,rgba(30,58,95,0.18),transparent_52%)]" />
                                {/* 상단 중앙 브랜드 — 모바일은 컴팩트, PC는 비율만 키움 */}
                                <header
                                    className="relative z-10 flex w-full max-w-lg shrink-0 flex-col items-center gap-0.5 px-2 text-center sm:max-w-xl sm:gap-1 lg:max-w-3xl lg:gap-2"
                                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                                >
                                    <p className="text-[8px] font-semibold uppercase tracking-[0.38em] text-amber-400/80 sm:text-[10px] sm:tracking-[0.42em] lg:text-xs lg:tracking-[0.48em]">
                                        Online Strategy
                                    </p>
                                    <h1 className="bg-gradient-to-br from-stone-50 via-amber-100 to-amber-800 bg-clip-text text-2xl font-black uppercase tracking-[0.16em] text-transparent drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] sm:text-4xl sm:tracking-[0.18em] lg:text-6xl lg:tracking-[0.14em] xl:text-7xl">
                                        SUDAM
                                    </h1>
                                    <p className="text-[9px] font-light tracking-[0.22em] text-stone-400 sm:text-xs sm:tracking-[0.26em] lg:text-base lg:tracking-[0.24em]">
                                        The Ascending Masters
                                    </p>
                                    <div
                                        className="mt-3 hidden h-px w-32 max-w-[80%] bg-gradient-to-r from-transparent via-amber-500/45 to-transparent sm:block lg:mt-5 lg:w-48"
                                        aria-hidden
                                    />
                                    <p className="mt-2 hidden max-w-xl px-2 text-center text-[11px] leading-relaxed text-stone-400 sm:mt-3 sm:block sm:text-xs lg:mt-4 lg:max-w-2xl lg:text-sm">
                                        Supreme Universe of Dueling Ascending Masters (S.U.D.A.M)
                                        <br />
                                        <span className="mt-1 inline-block text-[10px] text-stone-500 lg:text-xs">
                                            격돌하는 초인들이 승천하는 최고의 세계
                                        </span>
                                    </p>
                                </header>
                                <main
                                    className="relative z-10 flex w-full min-w-0 flex-col items-center justify-center"
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
            <AdProvider>
                <AppProvider>
                    <AppContent />
                </AppProvider>
            </AdProvider>
        </div>
    );
};

export default App;