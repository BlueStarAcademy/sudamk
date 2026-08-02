import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import { useAppContext } from '../../hooks/useAppContext.js';

/** 전략·놀이·페어 경기장 대기실: 패널 뒤 경기장 배경 블러(프로스트 글래스) */
export const WAITING_LOBBY_PANEL_GLASS =
    'backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter] [transform:translateZ(0)]';

const ROW_HEIGHT_REM = 2.5;
/** 홈·뷰어 공간 상단 전광판 — 대기실보다 얇게 */
const HOME_ROW_HEIGHT_REM = 1.85;
const ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_SEC = 90;

export type WaitingLobbyAnnouncementBoardMode = GameMode | 'strategic' | 'playful' | 'pair' | 'home';

const WaitingLobbyAnnouncementBoardInner: React.FC<{ mode: WaitingLobbyAnnouncementBoardMode }> = ({ mode }) => {
    const { t } = useTranslation('lobby');
    const { announcements, globalOverrideAnnouncement, announcementInterval } = useAppContext();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMarqueeRunning, setIsMarqueeRunning] = useState(true);
    const [travelDurationSec, setTravelDurationSec] = useState(12);
    const [travelDistancePx, setTravelDistancePx] = useState(1000);
    const waitTimerRef = useRef<number | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const announcementsRef = useRef(announcements);
    const measureRafRef = useRef<number | null>(null);
    const announcementIds = useMemo(() => announcements.map((a) => a.id).join(','), [announcements]);
    const strategicModes = useMemo(() => SPECIAL_GAME_MODES.map((m) => m.mode), []);
    const playfulModes = useMemo(() => PLAYFUL_GAME_MODES.map((m) => m.mode), []);

    useEffect(() => {
        announcementsRef.current = announcements;
    }, [announcements]);

    useEffect(() => {
        if (!announcements || announcements.length <= 0) {
            setCurrentIndex(0);
            setIsMarqueeRunning(true);
            return;
        }
        setCurrentIndex((prev) => (prev >= announcements.length ? 0 : prev));
    }, [announcementIds, announcements.length]);

    useEffect(() => {
        if (!announcements || announcements.length === 0 || !isMarqueeRunning) return;

        const measure = () => {
            const viewportWidth = viewportRef.current?.clientWidth ?? 0;
            const textWidth = textRef.current?.scrollWidth ?? 0;
            if (viewportWidth <= 0 || textWidth <= 0) return;

            const distancePx = viewportWidth + textWidth;
            const duration = Math.max(6, distancePx / ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_SEC);
            setTravelDistancePx((prev) => (Math.abs(prev - distancePx) < 1 ? prev : distancePx));
            setTravelDurationSec((prev) => (Math.abs(prev - duration) < 0.05 ? prev : duration));
        };

        if (measureRafRef.current != null) {
            window.cancelAnimationFrame(measureRafRef.current);
        }
        measureRafRef.current = window.requestAnimationFrame(() => {
            measureRafRef.current = null;
            measure();
        });

        return () => {
            if (measureRafRef.current != null) {
                window.cancelAnimationFrame(measureRafRef.current);
                measureRafRef.current = null;
            }
        };
    }, [currentIndex, announcementIds, isMarqueeRunning, announcements.length]);

    useEffect(() => {
        return () => {
            if (waitTimerRef.current != null) {
                window.clearTimeout(waitTimerRef.current);
            }
            if (measureRafRef.current != null) {
                window.cancelAnimationFrame(measureRafRef.current);
            }
        };
    }, []);

    const handleMarqueeEnd = useCallback(() => {
        const list = announcementsRef.current;
        if (!list || list.length <= 1) {
            setIsMarqueeRunning(true);
            return;
        }
        if (waitTimerRef.current != null) {
            window.clearTimeout(waitTimerRef.current);
        }
        setIsMarqueeRunning(false);
        const waitMs = Math.max(1000, (announcementInterval ?? 3) * 1000);
        waitTimerRef.current = window.setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % list.length);
            setIsMarqueeRunning(true);
        }, waitMs);
    }, [announcementInterval]);

    const isHomeViewer = mode === 'home';
    const isLobbyGlass = mode === 'strategic' || mode === 'playful' || mode === 'pair' || isHomeViewer;
    const glassCls = isLobbyGlass ? WAITING_LOBBY_PANEL_GLASS : '';
    const rowHeightRem = isHomeViewer ? HOME_ROW_HEIGHT_REM : ROW_HEIGHT_REM;
    const shellHeightClass = isHomeViewer ? 'h-7' : 'h-10';
    const textSizeClass = isHomeViewer
        ? 'text-[0.6rem] sm:text-[0.7rem]'
        : 'text-[0.65rem] sm:text-sm';
    const roundedClass = isHomeViewer ? 'rounded-xl' : 'rounded-2xl';
    const padXClass = isHomeViewer ? 'px-3' : 'px-4';

    const relevantOverride =
        globalOverrideAnnouncement &&
        (isHomeViewer ||
            globalOverrideAnnouncement.modes === 'all' ||
            (Array.isArray(globalOverrideAnnouncement.modes) &&
                globalOverrideAnnouncement.modes.some((m) => {
                    if (mode === 'strategic') return strategicModes.includes(m);
                    if (mode === 'playful') return playfulModes.includes(m);
                    if (mode === 'pair') return strategicModes.includes(m) || playfulModes.includes(m);
                    return m === mode;
                })));

    if (relevantOverride) {
        return (
            <div
                className={`relative flex ${shellHeightClass} flex-shrink-0 items-center justify-center ${roundedClass} ${
                    isHomeViewer ? 'px-2' : 'p-2'
                } ${
                    isLobbyGlass
                        ? 'bg-gradient-to-r from-yellow-900/70 via-amber-800/65 to-yellow-900/70 backdrop-blur-xl backdrop-saturate-150'
                        : 'bg-yellow-800/50'
                }`}
                style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.14)' }}
            >
                <span className={`text-center font-bold text-yellow-300 animate-pulse ${textSizeClass}`}>
                    {globalOverrideAnnouncement.message}
                </span>
            </div>
        );
    }

    if (!announcements || announcements.length === 0) {
        return (
            <div
                className={`flex ${shellHeightClass} flex-shrink-0 items-center justify-center ${roundedClass} ${
                    isHomeViewer ? 'px-2' : 'p-2'
                } text-on-panel ${glassCls}`}
                style={{
                    background: 'linear-gradient(110deg, rgba(24,24,27,0.9), rgba(63,63,70,0.75), rgba(24,24,27,0.9))',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.09)',
                }}
            >
                <span className={`text-center font-bold text-tertiary ${textSizeClass}`}>{t('announcement.noneRegistered')}</span>
            </div>
        );
    }

    const currentAnnouncement = announcements[currentIndex];
    const shouldAnimate = isMarqueeRunning && !!currentAnnouncement;

    return (
        <div
            ref={viewportRef}
            className={`relative flex-shrink-0 overflow-hidden ${roundedClass} ${padXClass} text-on-panel ${glassCls}`}
            style={{ height: `${rowHeightRem}rem` }}
        >
            <div
                className={`pointer-events-none absolute inset-[1px] ${roundedClass}`}
                style={{ background: 'linear-gradient(100deg, rgba(8,14,24,0.9), rgba(26,34,49,0.78), rgba(13,18,30,0.88))' }}
            />
            <div className={`pointer-events-none absolute inset-0 ${roundedClass} bg-[radial-gradient(circle_at_18%_50%,rgba(56,189,248,0.16),transparent_45%),radial-gradient(circle_at_82%_50%,rgba(245,158,11,0.14),transparent_45%)]`} />
            <div className="relative h-full w-full overflow-hidden" style={{ boxShadow: '0 14px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)' }}>
                {currentAnnouncement && shouldAnimate && (
                    <div className="absolute inset-y-0 flex items-center" style={{ left: shouldAnimate ? '100%' : '0%' }}>
                        <span
                            ref={textRef}
                            key={`${currentAnnouncement.id}-${currentIndex}`}
                            onAnimationEnd={handleMarqueeEnd}
                            className={`inline-flex items-center whitespace-nowrap px-2 font-bold will-change-transform ${textSizeClass}`}
                            style={
                                {
                                    animation: `waitingLobbyAnnouncementMarquee ${travelDurationSec}s linear 1 forwards`,
                                    ['--announcement-travel-distance' as string]: `${travelDistancePx}px`,
                                } as React.CSSProperties
                            }
                        >
                            <span className="mr-2 text-red-400">{t('announcement.badge')}</span>
                            <span className="bg-gradient-to-r from-cyan-100 via-amber-100 to-cyan-100 bg-clip-text text-transparent">
                                {currentAnnouncement.message}
                            </span>
                        </span>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes waitingLobbyAnnouncementMarquee {
                    from { transform: translateX(0); }
                    to { transform: translateX(calc(-1 * var(--announcement-travel-distance, 1000px))); }
                }
            `}</style>
        </div>
    );
};

export const WaitingLobbyAnnouncementBoard = React.memo(WaitingLobbyAnnouncementBoardInner);
