import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { SinglePlayerMissionInfo } from '../../types.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

const ENHANCE_GAUGE_DURATION = 3000; // 3초
/** DraggableWindow 상단(닫기) 헤더 실측에 가깝게 — 모바일 콘텐츠 높이 + 이 값 = initialHeight */
const COMPACT_LEVELUP_CHROME_HEADER_PX = 40;

interface TrainingQuestLevelUpModalProps {
    mission: SinglePlayerMissionInfo;
    currentLevel: number;
    upgradeCost: number;
    canLevelUp: boolean;
    nextLevelUnlockStage?: string;
    currentUserGold: number;
    accumulatedCollection: number;
    requiredCollection: number;
    progressPercent: number;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}

const TrainingQuestLevelUpModal: React.FC<TrainingQuestLevelUpModalProps> = ({
    mission,
    currentLevel,
    upgradeCost,
    canLevelUp,
    nextLevelUnlockStage,
    currentUserGold,
    accumulatedCollection,
    requiredCollection,
    progressPercent,
    onConfirm,
    onClose,
}) => {
    const [isLevelingUp, setIsLevelingUp] = useState(false);
    const [displayLevel, setDisplayLevel] = useState(currentLevel);
    const [showLevelUpEffect, setShowLevelUpEffect] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancementProgress, setEnhancementProgress] = useState(0);
    const enhanceIntervalRef = useRef<number | null>(null);
    const enhanceTimeoutRef = useRef<number | null>(null);

    const isHandheld = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isCompactUi = isHandheld || isNativeMobile;

    const compactPanelRef = useRef<HTMLDivElement | null>(null);
    const [compactMeasuredTotalHeight, setCompactMeasuredTotalHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (!isCompactUi) {
            setCompactMeasuredTotalHeight(null);
            return;
        }
        const el = compactPanelRef.current;
        if (!el) return;

        const sync = () => {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
            const cap = Math.floor(vh * 0.94);
            const minTotal = 260;
            const contentH = el.offsetHeight;
            const total = Math.round(contentH + COMPACT_LEVELUP_CHROME_HEADER_PX);
            setCompactMeasuredTotalHeight(Math.min(cap, Math.max(minTotal, total)));
        };

        sync();
        const ro = new ResizeObserver(() => requestAnimationFrame(sync));
        ro.observe(el);
        window.addEventListener('resize', sync);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', sync);
        };
    }, [
        isCompactUi,
        mission.id,
        currentLevel,
        displayLevel,
        nextLevelUnlockStage,
        canLevelUp,
        isEnhancing,
        upgradeCost,
        currentUserGold,
        accumulatedCollection,
        requiredCollection,
        progressPercent,
    ]);

    const clearEnhanceTimers = useCallback(() => {
        if (enhanceIntervalRef.current !== null) {
            window.clearInterval(enhanceIntervalRef.current);
            enhanceIntervalRef.current = null;
        }
        if (enhanceTimeoutRef.current !== null) {
            window.clearTimeout(enhanceTimeoutRef.current);
            enhanceTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => clearEnhanceTimers();
    }, [clearEnhanceTimers]);

    const currentLevelInfo = currentLevel > 0 ? mission.levels[currentLevel - 1] : null;
    const nextLevelInfo = mission.levels && mission.levels[currentLevel];

    // currentLevel이 변경되면 애니메이션 트리거
    useEffect(() => {
        if (currentLevel > displayLevel) {
            setIsLevelingUp(true);
            setShowLevelUpEffect(true);
            
            // 레벨 카운트업 애니메이션
            const startLevel = displayLevel;
            const endLevel = currentLevel;
            const duration = 800; // 0.8초
            const steps = 20;
            const stepDuration = duration / steps;
            let step = 0;

            const interval = setInterval(() => {
                step++;
                const progress = step / steps;
                const easeOutCubic = 1 - Math.pow(1 - progress, 3);
                const current = Math.floor(startLevel + (endLevel - startLevel) * easeOutCubic);
                setDisplayLevel(current);

                if (step >= steps) {
                    clearInterval(interval);
                    setDisplayLevel(endLevel);
                    setTimeout(() => {
                        setIsLevelingUp(false);
                        setTimeout(() => setShowLevelUpEffect(false), 500);
                    }, 200);
                }
            }, stepDuration);

            return () => clearInterval(interval);
        } else if (currentLevel < displayLevel) {
            // 레벨이 내려간 경우 (리셋 등) 즉시 동기화
            setDisplayLevel(currentLevel);
        }
    }, [currentLevel, displayLevel]);

    if (!nextLevelInfo) {
        return null;
    }

    const hasEnoughGold = currentUserGold >= upgradeCost;
    const productionRateChange = currentLevelInfo ? (currentLevelInfo.productionRateMinutes - nextLevelInfo.productionRateMinutes) : 0;
    const rewardAmountChange = currentLevelInfo ? (nextLevelInfo.rewardAmount - currentLevelInfo.rewardAmount) : nextLevelInfo.rewardAmount;
    const maxCapacityChange = currentLevelInfo ? (nextLevelInfo.maxCapacity - currentLevelInfo.maxCapacity) : nextLevelInfo.maxCapacity;

    const normalizedRequired = Math.max(0, requiredCollection);
    const normalizedAccumulated = Math.max(0, accumulatedCollection);
    const xpPercent = normalizedRequired > 0
        ? Math.min(100, Math.round((normalizedAccumulated / normalizedRequired) * 100))
        : (canLevelUp ? 100 : Math.max(0, Math.round(progressPercent)));

    const handleEnhance = async () => {
        if (!canLevelUp || !hasEnoughGold || isEnhancing) return;

        setIsEnhancing(true);
        setEnhancementProgress(0);
        clearEnhanceTimers();

        const startTime = Date.now();
        enhanceIntervalRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const percent = Math.min(100, Math.round((elapsed / ENHANCE_GAUGE_DURATION) * 100));
            setEnhancementProgress(percent);
            if (elapsed >= ENHANCE_GAUGE_DURATION && enhanceIntervalRef.current !== null) {
                window.clearInterval(enhanceIntervalRef.current);
                enhanceIntervalRef.current = null;
            }
        }, 50);

        enhanceTimeoutRef.current = window.setTimeout(() => {
            enhanceTimeoutRef.current = null;
            (async () => {
                try {
                    setEnhancementProgress(100);
                    await onConfirm();
                } finally {
                    clearEnhanceTimers();
                    setIsEnhancing(false);
                    setEnhancementProgress(0);
                }
            })();
        }, ENHANCE_GAUGE_DURATION);
    };

    /** 모바일: 경험치는 막대 하나 + 막대 안(중앙) N/N (N%)만 */
    const compactXpBarLabel =
        normalizedRequired > 0
            ? `${Math.min(normalizedAccumulated, normalizedRequired).toLocaleString()} / ${normalizedRequired.toLocaleString()} (${xpPercent}%)`
            : `— / — (${xpPercent}%)`;

    const headerXpCompact = (
        <div className="mt-[clamp(0.25rem,1.2vw,0.375rem)] border-t border-white/[0.06] pt-[clamp(0.25rem,1.2vw,0.375rem)]">
            <div
                className="relative w-full overflow-hidden rounded-full bg-emerald-950/70 ring-1 ring-inset ring-white/[0.06] h-[clamp(0.875rem,2.6vw,1.125rem)]"
            >
                <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-lime-400 to-yellow-300 transition-all duration-300"
                    style={{ width: `${Math.min(100, xpPercent)}%` }}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[clamp(0.125rem,1vw,0.375rem)]">
                    <span className="max-w-full truncate font-bold tabular-nums leading-none text-white [text-shadow:0_0_3px_rgba(0,0,0,0.85),0_1px_2px_rgba(0,0,0,0.9)] text-[clamp(0.5625rem,2.35vw,0.6875rem)]">
                        {compactXpBarLabel}
                    </span>
                </div>
            </div>
        </div>
    );

    /** PC: 모바일과 동일 N/N (N%) 단일 막대, 글자·막대만 크게 */
    const headerXpPc = (
        <div className="mt-2 border-t border-white/[0.08] pt-2">
            <div className="relative h-5 w-full overflow-hidden rounded-full bg-emerald-950/70 ring-1 ring-inset ring-white/[0.08]">
                <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-lime-400 to-yellow-300 transition-all duration-300"
                    style={{ width: `${Math.min(100, xpPercent)}%` }}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
                    <span className="max-w-full truncate text-sm font-bold tabular-nums leading-none text-white [text-shadow:0_0_4px_rgba(0,0,0,0.9),0_1px_2px_rgba(0,0,0,0.95)]">
                        {compactXpBarLabel}
                    </span>
                </div>
            </div>
        </div>
    );

    const footerActions = (
        <>
            <div className="flex w-full justify-center">
                <Button
                    onClick={handleEnhance}
                    colorScheme="none"
                    className={`${PREMIUM_QUEST_BTN.upgrade} ${(!canLevelUp || !hasEnoughGold || isEnhancing) ? 'cursor-not-allowed opacity-50' : ''} !mx-auto !w-auto !max-w-[min(9.5rem,88vw)] !min-w-0 !shrink-0 !whitespace-normal !px-[clamp(0.5rem,3vw,0.75rem)] !py-[clamp(0.375rem,2vw,0.5rem)] !text-center !leading-tight ${
                        isCompactUi
                            ? '!text-[clamp(0.8125rem,3.5vw,0.9375rem)]'
                            : '!text-base'
                    }`}
                    disabled={!canLevelUp || !hasEnoughGold || isEnhancing}
                >
                    {isEnhancing ? (
                        '강화 중...'
                    ) : !canLevelUp ? (
                        '조건 미충족'
                    ) : !hasEnoughGold ? (
                        '골드 부족'
                    ) : (
                        <span className="flex items-center justify-center gap-[clamp(0.25rem,1.5vw,0.5rem)] font-semibold tracking-wide">
                            <img
                                src="/images/icon/Gold.png"
                                alt="골드"
                                className={`flex-shrink-0 drop-shadow ${isCompactUi ? 'h-[clamp(1rem,4.2vw,1.25rem)] w-[clamp(1rem,4.2vw,1.25rem)]' : 'h-6 w-6'}`}
                            />
                            <span>{upgradeCost.toLocaleString()}</span>
                            <span>강화</span>
                        </span>
                    )}
                </Button>
            </div>
            <div className="flex w-full items-center gap-[clamp(0.25rem,1.5vw,0.5rem)]">
                <span
                    className={`flex-shrink-0 font-semibold tabular-nums text-slate-300 ${isCompactUi ? 'text-[clamp(0.75rem,3.2vw,0.875rem)]' : 'text-base'}`}
                >
                    Lv.{currentLevel}
                </span>
                <div
                    className={`flex-1 overflow-hidden rounded-full border border-slate-700/60 bg-slate-800/80 ${isCompactUi ? 'h-[clamp(0.375rem,1.4vw,0.5rem)]' : 'h-3'}`}
                >
                    <div
                        className={`h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 transition-[width] duration-100 ease-linear ${isEnhancing ? '' : 'opacity-0'}`}
                        style={{ width: `${isEnhancing ? enhancementProgress : 0}%` }}
                    />
                </div>
                <span
                    className={`flex-shrink-0 font-semibold tabular-nums text-slate-300 ${isCompactUi ? 'text-[clamp(0.75rem,3.2vw,0.875rem)]' : 'text-base'}`}
                >
                    Lv.{currentLevel + 1}
                </span>
            </div>
        </>
    );

    return (
        <DraggableWindow
            title={isCompactUi ? `${mission.name} · 강화` : `${mission.name} 강화`}
            onClose={onClose}
            windowId={`training-quest-levelup-${mission.id}`}
            initialWidth={isCompactUi ? 340 : 540}
            initialHeight={isCompactUi ? (compactMeasuredTotalHeight ?? 380) : undefined}
            shrinkHeightToContent
            isTopmost
            modal
            closeOnOutsideClick
            mobileViewportFit={isCompactUi}
            mobileViewportMaxHeightVh={94}
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px))))"
            pcViewportMaxHeightCss="min(92dvh, calc(100dvh - 1.5rem))"
            bodyNoScroll={isCompactUi}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0'
                    : undefined
            }
        >
            {isCompactUi ? (
                <div
                    ref={compactPanelRef}
                    className="relative flex w-full flex-col overflow-hidden rounded-2xl bg-[#0a0e14] text-slate-200 ring-1 ring-inset ring-white/[0.06]"
                >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(52,211,153,0.08),transparent)]" aria-hidden />
                    <div className="relative shrink-0 border-b border-white/[0.06] px-[clamp(0.625rem,3.5vw,0.875rem)] pb-[clamp(0.375rem,2vw,0.5rem)] pt-[clamp(0.375rem,2vw,0.5rem)]">
                        <div className="flex items-center gap-[clamp(0.5rem,2.5vw,0.75rem)]">
                            <div className="flex size-[clamp(3.125rem,16vw,3.875rem)] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900/80 ring-1 ring-white/10">
                                {mission.image ? (
                                    <img
                                        src={mission.image}
                                        alt=""
                                        className="h-full w-full object-contain p-[clamp(0.3125rem,1.4vw,0.4375rem)]"
                                    />
                                ) : (
                                    <span className="leading-none text-[clamp(1.375rem,6vw,1.625rem)]" aria-hidden>
                                        📜
                                    </span>
                                )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-[clamp(0.25rem,1.2vw,0.375rem)]">
                                <div className="flex min-w-0 items-center gap-x-[clamp(0.375rem,2vw,0.5rem)]">
                                    <p className="min-w-0 flex-1 truncate font-semibold leading-tight text-slate-100 text-[clamp(0.8125rem,3.4vw,0.9375rem)]">
                                        {mission.name}
                                    </p>
                                    <span
                                        className={`shrink-0 font-bold tabular-nums transition-all duration-300 text-[clamp(0.9375rem,4.2vw,1.0625rem)] ${
                                            isLevelingUp
                                                ? 'text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.5)]'
                                                : showLevelUpEffect
                                                  ? 'text-emerald-300'
                                                  : 'text-emerald-200/90'
                                        }`}
                                    >
                                        Lv.{displayLevel}
                                    </span>
                                    {showLevelUpEffect && (
                                        <span className="shrink-0 animate-bounce text-[clamp(0.6875rem,3.2vw,0.8125rem)]" aria-hidden>
                                            ✨
                                        </span>
                                    )}
                                </div>
                                {headerXpCompact}
                            </div>
                        </div>
                    </div>

                    <div className="relative max-h-[min(58dvh,calc(100dvh-9.5rem))] shrink-0 overflow-y-auto overscroll-contain px-2 py-1">
                        <div className="mx-auto flex w-full max-w-sm flex-col gap-1 pb-0.5">
                            <div className="flex min-h-[2rem] items-center gap-1 rounded-lg border border-white/[0.06] bg-slate-900/40 px-2 py-1">
                                <img
                                    src="/images/icon/timer.png"
                                    alt=""
                                    className="size-[clamp(1.125rem,4.8vw,1.5rem)] shrink-0 opacity-90"
                                />
                                <span className="w-10 shrink-0 font-medium text-slate-500 text-[clamp(0.6875rem,3.1vw,0.8125rem)]">
                                    생산
                                </span>
                                <div className="min-w-0 flex-1 text-right tabular-nums leading-tight text-[clamp(0.8125rem,3.6vw,0.9375rem)]">
                                    <span className="text-slate-300">{currentLevelInfo ? `${currentLevelInfo.productionRateMinutes}분` : '—'}</span>
                                    <span className="mx-0.5 text-slate-600">→</span>
                                    <span className="font-semibold text-emerald-200/95">{nextLevelInfo.productionRateMinutes}분</span>
                                    {productionRateChange !== 0 && (
                                        <span className="ml-0.5 font-semibold text-lime-400 text-[clamp(0.6875rem,3.2vw,0.8125rem)]">
                                            {productionRateChange > 0
                                                ? `(-${productionRateChange.toFixed(1)})`
                                                : `(+${Math.abs(productionRateChange).toFixed(1)})`}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex min-h-[2rem] items-center gap-1 rounded-lg border border-white/[0.06] bg-slate-900/40 px-2 py-1">
                                <img
                                    src={mission.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                    alt=""
                                    className="size-[clamp(1.125rem,4.8vw,1.5rem)] shrink-0 opacity-95"
                                />
                                <span className="w-10 shrink-0 font-medium text-slate-500 text-[clamp(0.6875rem,3.1vw,0.8125rem)]">
                                    생산량
                                </span>
                                <div className="min-w-0 flex-1 text-right tabular-nums leading-tight text-[clamp(0.8125rem,3.6vw,0.9375rem)]">
                                    <span className="text-slate-300">
                                        {currentLevelInfo ? currentLevelInfo.rewardAmount.toLocaleString() : '—'}
                                    </span>
                                    <span className="mx-0.5 text-slate-600">→</span>
                                    <span className="font-semibold text-emerald-200/95">{nextLevelInfo.rewardAmount.toLocaleString()}</span>
                                    {rewardAmountChange !== 0 && (
                                        <span className="ml-0.5 font-semibold text-lime-400 text-[clamp(0.6875rem,3.2vw,0.8125rem)]">
                                            ({rewardAmountChange > 0 ? `+${rewardAmountChange}` : String(rewardAmountChange)})
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex min-h-[2rem] items-center gap-1 rounded-lg border border-white/[0.06] bg-slate-900/40 px-2 py-1">
                                <span className="flex size-[clamp(1.125rem,4.8vw,1.5rem)] shrink-0 items-center justify-center rounded bg-violet-500/35 text-[clamp(0.5625rem,2.6vw,0.6875rem)] font-bold text-violet-100">
                                    M
                                </span>
                                <span className="w-10 shrink-0 font-medium text-slate-500 text-[clamp(0.6875rem,3.1vw,0.8125rem)]">
                                    저장
                                </span>
                                <div className="min-w-0 flex-1 text-right tabular-nums leading-tight text-[clamp(0.8125rem,3.6vw,0.9375rem)]">
                                    <span className="text-slate-300">
                                        {currentLevelInfo ? currentLevelInfo.maxCapacity.toLocaleString() : '—'}
                                    </span>
                                    <span className="mx-0.5 text-slate-600">→</span>
                                    <span className="font-semibold text-emerald-200/95">{nextLevelInfo.maxCapacity.toLocaleString()}</span>
                                    {maxCapacityChange !== 0 && (
                                        <span className="ml-0.5 font-semibold text-lime-400 text-[clamp(0.6875rem,3.2vw,0.8125rem)]">
                                            ({maxCapacityChange > 0 ? `+${maxCapacityChange}` : String(maxCapacityChange)})
                                        </span>
                                    )}
                                </div>
                            </div>

                            {nextLevelUnlockStage && (
                                <div className="flex min-h-[2rem] items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-950/25 px-2 py-1 leading-tight text-amber-100/95 text-[clamp(0.625rem,2.9vw,0.75rem)]">
                                    <span className="shrink-0 text-[clamp(0.8125rem,3.4vw,0.9375rem)]" aria-hidden>
                                        ⚠️
                                    </span>
                                    <p className="min-w-0 truncate">
                                        <span className="font-semibold text-amber-200">{nextLevelUnlockStage}</span>
                                        <span className="text-amber-100/75"> 클리어 후 강화</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative shrink-0 space-y-[clamp(0.375rem,2vw,0.5rem)] border-t border-white/[0.06] bg-[#080b10]/95 px-[clamp(0.625rem,3.5vw,0.875rem)] py-[clamp(0.5rem,2.5vw,0.75rem)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md">
                        {footerActions}
                    </div>
                </div>
            ) : (
                <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#0a0e14] text-slate-100 antialiased [-webkit-font-smoothing:antialiased] ring-1 ring-inset ring-white/[0.07]">
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-2xl bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(52,211,153,0.1),transparent)]"
                        aria-hidden
                    />
                    <div className="relative shrink-0 border-b border-white/[0.08] px-4 pb-3 pt-3">
                        <div className="flex items-center gap-4">
                            <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900/85 ring-1 ring-white/10">
                                {mission.image ? (
                                    <img
                                        src={mission.image}
                                        alt={mission.name}
                                        className="h-full w-full object-contain p-2"
                                    />
                                ) : (
                                    <span className="text-4xl" aria-hidden>
                                        📜
                                    </span>
                                )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                                <div className="flex min-w-0 items-center gap-3">
                                    <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-slate-50">{mission.name}</h2>
                                    <span
                                        className={`shrink-0 text-2xl font-bold tabular-nums transition-all duration-300 ${
                                            isLevelingUp
                                                ? 'text-green-400 drop-shadow-[0_0_16px_rgba(34,197,94,0.65)]'
                                                : showLevelUpEffect
                                                  ? 'text-emerald-300'
                                                  : 'text-emerald-200/95'
                                        }`}
                                    >
                                        Lv.{displayLevel}
                                    </span>
                                    {showLevelUpEffect && (
                                        <span className="shrink-0 text-xl animate-bounce" aria-hidden>
                                            ✨
                                        </span>
                                    )}
                                </div>
                                {headerXpPc}
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 overflow-visible px-4 py-2">
                        <div className="mx-auto flex w-full max-w-md flex-col gap-1.5">
                            <div className="flex min-h-[2.35rem] items-center gap-2 rounded-lg border border-white/[0.08] bg-slate-900/50 px-3 py-1.5">
                                <img src="/images/icon/timer.png" alt="" className="h-7 w-7 shrink-0 opacity-95" />
                                <span className="w-12 shrink-0 text-sm font-medium text-slate-400">생산</span>
                                <div className="min-w-0 flex-1 text-right text-lg tabular-nums leading-snug">
                                    <span className="text-slate-200">{currentLevelInfo ? `${currentLevelInfo.productionRateMinutes}분` : '—'}</span>
                                    <span className="mx-1 text-slate-500">→</span>
                                    <span className="font-semibold text-emerald-200">{nextLevelInfo.productionRateMinutes}분</span>
                                    {productionRateChange !== 0 && (
                                        <span className="ml-1 text-sm font-semibold text-lime-400">
                                            {productionRateChange > 0
                                                ? `(-${productionRateChange.toFixed(1)})`
                                                : `(+${Math.abs(productionRateChange).toFixed(1)})`}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex min-h-[2.35rem] items-center gap-2 rounded-lg border border-white/[0.08] bg-slate-900/50 px-3 py-1.5">
                                <img
                                    src={mission.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                    alt=""
                                    className="h-7 w-7 shrink-0 opacity-95"
                                />
                                <span className="w-12 shrink-0 text-sm font-medium text-slate-400">생산량</span>
                                <div className="min-w-0 flex-1 text-right text-lg tabular-nums leading-snug">
                                    <span className="text-slate-200">
                                        {currentLevelInfo ? currentLevelInfo.rewardAmount.toLocaleString() : '—'}
                                    </span>
                                    <span className="mx-1 text-slate-500">→</span>
                                    <span className="font-semibold text-emerald-200">{nextLevelInfo.rewardAmount.toLocaleString()}</span>
                                    {rewardAmountChange !== 0 && (
                                        <span className="ml-1 text-sm font-semibold text-lime-400">
                                            ({rewardAmountChange > 0 ? `+${rewardAmountChange}` : String(rewardAmountChange)})
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex min-h-[2.35rem] items-center gap-2 rounded-lg border border-white/[0.08] bg-slate-900/50 px-3 py-1.5">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/40 text-xs font-bold text-violet-50 ring-1 ring-violet-400/30">
                                    M
                                </span>
                                <span className="w-12 shrink-0 text-sm font-medium text-slate-400">저장</span>
                                <div className="min-w-0 flex-1 text-right text-lg tabular-nums leading-snug">
                                    <span className="text-slate-200">
                                        {currentLevelInfo ? currentLevelInfo.maxCapacity.toLocaleString() : '—'}
                                    </span>
                                    <span className="mx-1 text-slate-500">→</span>
                                    <span className="font-semibold text-emerald-200">{nextLevelInfo.maxCapacity.toLocaleString()}</span>
                                    {maxCapacityChange !== 0 && (
                                        <span className="ml-1 text-sm font-semibold text-lime-400">
                                            ({maxCapacityChange > 0 ? `+${maxCapacityChange}` : String(maxCapacityChange)})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {nextLevelUnlockStage && (
                            <div className="mx-auto mt-2 flex w-full max-w-md items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/35 px-3 py-2 text-[15px] leading-snug text-amber-50">
                                <span className="shrink-0 text-xl" aria-hidden>
                                    ⚠️
                                </span>
                                <p className="min-w-0">
                                    <span className="font-semibold text-amber-200">{nextLevelUnlockStage}</span>
                                    <span className="text-amber-100/85"> 스테이지를 클리어해야 합니다.</span>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="relative flex shrink-0 flex-col gap-2 rounded-b-2xl border-t border-white/[0.08] bg-[#080b10]/95 px-4 py-2.5 backdrop-blur-sm">
                        <div className="flex gap-3">
                            <Button
                                onClick={onClose}
                                colorScheme="none"
                                className={`flex-1 rounded-lg border border-slate-500/50 bg-slate-800/80 py-2.5 text-base font-semibold text-slate-100 shadow-sm hover:bg-slate-700/80 ${isEnhancing ? 'cursor-not-allowed opacity-50' : ''}`}
                                disabled={isEnhancing}
                            >
                                취소
                            </Button>
                            <Button
                                onClick={handleEnhance}
                                colorScheme="none"
                                className={`${PREMIUM_QUEST_BTN.upgrade} !text-base !py-2.5 ${(!canLevelUp || !hasEnoughGold || isEnhancing) ? 'cursor-not-allowed opacity-50' : ''}`}
                                disabled={!canLevelUp || !hasEnoughGold || isEnhancing}
                            >
                                {isEnhancing ? (
                                    '강화 중...'
                                ) : !canLevelUp ? (
                                    '조건 미충족'
                                ) : !hasEnoughGold ? (
                                    '골드 부족'
                                ) : (
                                    <span className="flex items-center justify-center gap-2 font-semibold tracking-wide">
                                        <img src="/images/icon/Gold.png" alt="골드" className="h-6 w-6 flex-shrink-0 drop-shadow" />
                                        <span>{upgradeCost.toLocaleString()}</span>
                                        <span>강화</span>
                                    </span>
                                )}
                            </Button>
                        </div>
                        <div className="flex w-full items-center gap-2">
                            <span className="flex-shrink-0 text-base font-semibold tabular-nums text-slate-300">Lv.{currentLevel}</span>
                            <div className="h-3 flex-1 overflow-hidden rounded-full border border-slate-600/70 bg-slate-800/90">
                                <div
                                    className={`h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 transition-[width] duration-100 ease-linear ${isEnhancing ? '' : 'opacity-0'}`}
                                    style={{ width: `${isEnhancing ? enhancementProgress : 0}%` }}
                                />
                            </div>
                            <span className="flex-shrink-0 text-base font-semibold tabular-nums text-slate-300">Lv.{currentLevel + 1}</span>
                        </div>
                    </div>
                </div>
            )}
        </DraggableWindow>
    );
};

export default TrainingQuestLevelUpModal;
