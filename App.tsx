import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Header from './components/Header.js';
import { AppProvider } from './contexts/AppContext.js';
import { useAppContext } from './hooks/useAppContext.js';
import Router from './components/Router.js';
import { preloadImages, ALL_IMAGE_URLS } from './services/assetService.js';
import { audioService } from './services/audioService.js';
import InstallPrompt from './components/InstallPrompt.js';
import AppModalLayer from './components/AppModalLayer.js';
import { useIsHandheldDevice, VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT } from './hooks/useIsMobileLayout.js';
import AdProvider from './components/ads/AdProvider.js';
import AdBanner from './components/ads/AdBanner.js';
import AdInterstitial from './components/ads/AdInterstitial.js';
import NativeMobileDock from './components/mobile/NativeMobileDock.js';
import { NATIVE_MOBILE_SHELL_MAX_WIDTH } from './constants/ads.js';

/**
 * 세로로 든 폰에서 전체 UI를 CSS로 90° 돌리면( index.css 의 sudamr-handheld-* )
 * 브라우저/OS는 여전히 세로 뷰포트로 키보드·포커스를 잡아 입력이 뒤집히거나 엇나갑니다.
 * 기본은 끔 — 실제 가로로 기기를 돌리거나 세로 레이아웃을 씁니다.
 * 예전 동작이 필요하면 빌드 시 VITE_HANDHELD_CSS_ROTATE=true 로 켤 수 있음.
 */
const USE_HANDHELD_CSS_ORIENTATION_WRAPPER =
    import.meta.env.VITE_HANDHELD_CSS_ROTATE === 'true';

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

    const isGameView = currentRoute.view === 'game';
    const backgroundClass = currentUser ? 'bg-primary' : 'bg-login-background';

    const isHandheld = useIsHandheldDevice(1025);
    const pcLikeMobileLayout = settings.graphics.pcLikeMobileLayout !== false;
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

    // 휴대기기: CSS 전체 회전과 같이 쓰면 키보드 방향이 꼬이므로, 래퍼 사용 시에만 시도
    useEffect(() => {
        if (!USE_HANDHELD_CSS_ORIENTATION_WRAPPER) return;
        if (typeof window === 'undefined' || !isHandheld) return;
        const orient = (window as any).screen?.orientation;
        if (!orient?.lock) return;

        let lastLockAttempt = 0;
        const tryLockLandscape = () => {
            const now = Date.now();
            if (now - lastLockAttempt < 400) return;
            lastLockAttempt = now;
            orient.lock('landscape').catch(() => {
                orient.lock('landscape-primary').catch(() => {});
            });
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') tryLockLandscape();
        };

        tryLockLandscape();
        window.addEventListener('orientationchange', tryLockLandscape);
        document.addEventListener('visibilitychange', onVisibilityChange);
        orient.addEventListener?.('change', tryLockLandscape);
        // 사용자 제스처 뒤에만 lock이 되는 브라우저 대비 — 짧게 스로틀하여 반복 시도
        const onGesture = () => tryLockLandscape();
        document.addEventListener('touchstart', onGesture, { passive: true, capture: true });
        document.addEventListener('click', onGesture, { capture: true });
        return () => {
            window.removeEventListener('orientationchange', tryLockLandscape);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            orient.removeEventListener?.('change', tryLockLandscape);
            document.removeEventListener('touchstart', onGesture, { capture: true } as AddEventListenerOptions);
            document.removeEventListener('click', onGesture, { capture: true } as AddEventListenerOptions);
        };
    }, [isHandheld]);

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
            
            {isNativeMobile ? (
                <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full overflow-hidden relative">
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
                                className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden w-full min-w-0"
                                style={{
                                    WebkitOverflowScrolling: 'touch',
                                }}
                            >
                                <Router />
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
                        <div className="relative flex flex-1 w-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto overflow-x-hidden bg-transparent px-3 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10 lg:py-12">
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
                            <main className="relative z-10 flex w-full min-w-0 max-w-[min(100%,480px)] flex-col items-center justify-center sm:max-w-[520px] lg:max-w-[560px]">
                                <Router />
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
                className={`flex min-h-0 w-full flex-1 flex-col ${pcLikeMobileLayout ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'}`}
            >
                <div
                    className="flex min-h-0 w-full flex-1 items-center justify-center"
                    style={pcLikeMobileLayout ? { minHeight: VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT } : undefined}
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
                                <main className="relative z-10 flex w-full min-w-0 max-w-[min(100%,480px)] flex-col items-center justify-center sm:max-w-[520px] lg:max-w-[560px]">
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

const HANDHELD_MAX_W = 1024;

function readScreenOrientation(): { type: string; angle: number | null } {
    const so = typeof screen !== 'undefined' ? (screen as Screen & { orientation?: { type?: string; angle?: number } }).orientation : undefined;
    const type = typeof so?.type === 'string' ? so.type : '';
    const angle = typeof so?.angle === 'number' ? so.angle : null;
    return { type, angle };
}

function isPortraitSecondaryLayout(w: number, h: number, type: string, angle: number | null): boolean {
    if (w > h) return false;
    if (type === 'portrait-secondary') return true;
    if (angle === 180 || angle === -180) return true;
    const wo = (window as Window & { orientation?: number }).orientation;
    if (typeof wo === 'number' && (wo === 180 || wo === -180)) return true;
    return false;
}

/**
 * 실제 가로(w>h)일 때 한쪽 방향(secondary)에서만 UI를 180° 돌려 주소창·기기 방향과 맞춤.
 * 브라우저마다 type/angle/window.orientation 조합이 달라 여러 경로를 본다.
 */
function computeHandheldLandscapeFlip180(w: number, h: number, type: string, angle: number | null): boolean {
    if (w <= h) return false;
    const t = (type || '').toLowerCase();

    const isApple =
        /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 1);

    if (t.includes('landscape') && t.includes('secondary')) return true;
    // iOS: primary면 보통 각도와 일치. Android Chrome은 type이 landscape-primary에 고정되는 기기가 있어
    // 여기서 false로 끝내면 한쪽 가로에서 angle/window.orientation을 영원히 안 본다 → 한쪽만 안 뒤집힘.
    if (isApple && (t === 'landscape-primary' || (t.includes('landscape') && t.includes('primary')))) return false;

    const normAngle = angle === null ? null : ((((angle % 360) + 360) % 360) as number);
    if (normAngle !== null) {
        if (isApple) {
            if (normAngle === 270) return true;
            if (normAngle === 90) return false;
            if (normAngle === 180) return true;
        } else {
            // Android: Chrome angle 해석을 window.orientation 과 맞춤(90↔270 기준 반전)
            if (normAngle === 90) return true;
            if (normAngle === 270) return false;
            if (normAngle === 180) return true;
        }
    }

    const wo = (window as Window & { orientation?: number }).orientation;
    if (typeof wo === 'number') {
        if (isApple) {
            // iOS: 가로 양방향이 90 / -90 — 한쪽이 주소창·노치와 맞지 않으면 아래 두 줄을 서로 바꿔 조정
            if (wo === 90) return true;
            if (wo === -90) return false;
        } else {
            // Android Chrome: 주소창 방향과 맞추기 위해 90일 때만 180° 보정
            if (wo === 90) return true;
            if (wo === -90 || wo === 270) return false;
        }
    }

    return false;
}

/** 좁은 화면 + 세로 뷰포트일 때 .app-container를 회전시켜 PC와 같은 가로 캔버스가 곧바로 보이게 함 */
const App: React.FC = () => {
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
            if (!USE_HANDHELD_CSS_ORIENTATION_WRAPPER) {
                clearClasses();
                return;
            }
            const w = window.innerWidth;
            const h = window.innerHeight;
            const handheld = w <= HANDHELD_MAX_W;
            const portrait = w <= h;
            const { type, angle } = readScreenOrientation();

            const portraitLock = handheld && portrait;
            const portraitSecondary = portraitLock && isPortraitSecondaryLayout(w, h, type, angle);
            const realLandscape = handheld && !portrait;

            const el = document.documentElement;
            el.classList.toggle('sudamr-handheld-portrait-lock', portraitLock);
            el.classList.toggle('sudamr-handheld-portrait-secondary', portraitSecondary);

            if (realLandscape && !portraitLock) {
                el.classList.add('sudamr-handheld-real-landscape');
                const flip = computeHandheldLandscapeFlip180(w, h, type, angle);
                el.style.setProperty('--sudamr-landscape-ui-rotate', flip ? '180deg' : '0deg');
            } else {
                el.classList.remove('sudamr-handheld-real-landscape');
                el.style.removeProperty('--sudamr-landscape-ui-rotate');
            }
        };

        const syncSoon = () => {
            sync();
            requestAnimationFrame(sync);
            [16, 50, 120, 280].forEach((ms) => window.setTimeout(sync, ms));
        };

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
            window.removeEventListener('resize', sync);
            window.removeEventListener('orientationchange', syncSoon);
            mq?.removeEventListener('change', syncSoon);
            so?.removeEventListener?.('change', syncSoon as EventListener);
            vv?.removeEventListener('resize', sync);
            clearClasses();
        };
    }, []);

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