import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import BlacksmithLevelEffectsSummary from './BlacksmithLevelEffectsSummary.js';
import { User } from '../../types.js';
import { isFunctionVipActive } from '../../shared/utils/rewardVip.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../../shared/constants/pcShellLayout.js';
import { BLACKSMITH_MAX_LEVEL } from '../../constants/rules.js';
import {
    getBlacksmithVisualImageSrc,
    getBlacksmithVisualNameKey,
} from '../../shared/utils/blacksmithVisualTier.js';

interface BlacksmithEffectsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    blacksmithLevel: number;
    currentUser: User;
    embedded?: boolean;
}

const BlacksmithEffectsModal: React.FC<BlacksmithEffectsModalProps> = ({
    onClose,
    isTopmost,
    blacksmithLevel,
    currentUser,
    embedded = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const { isNativeMobile } = useNativeMobileShell();
    const ownedLevel = Math.max(1, Math.min(BLACKSMITH_MAX_LEVEL, Math.floor(Number(blacksmithLevel) || 1)));
    const [viewLevel, setViewLevel] = useState(ownedLevel);
    const [viewportCompact, setViewportCompact] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 1025
    );

    useEffect(() => {
        setViewLevel(ownedLevel);
    }, [ownedLevel]);

    useEffect(() => {
        const onResize = () => setViewportCompact(window.innerWidth < 1025);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    /** BlacksmithModal 스택 레이아웃과 동일 기준: 모바일·좁은 가로에서 타이포 통일 */
    const compactLayout = viewportCompact || isNativeMobile;

    const vipBonus = isFunctionVipActive(currentUser) ? 10 : 0;
    const disassemblyJackpotBonusPercent = vipBonus;
    const combinationGreatSuccessBonusPercent = vipBonus;
    const canPrev = viewLevel > 1;
    const canNext = viewLevel < BLACKSMITH_MAX_LEVEL;
    const viewName = t(getBlacksmithVisualNameKey(viewLevel));
    const viewImageSrc = getBlacksmithVisualImageSrc(viewLevel);
    const isOwnedView = viewLevel === ownedLevel;

    const navButtonClass =
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200/45 bg-black/55 text-xl font-black leading-none text-amber-50 shadow-[inset_0_1px_0_rgba(255,251,235,0.18)] backdrop-blur-sm transition enabled:hover:border-amber-100/70 enabled:hover:bg-black/70 enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70';

    const effectsBody = (
        <div className="relative flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-b from-[#2a1d0f]/95 via-[#141018]/98 to-[#0a0c12] p-2.5 shadow-[inset_0_1px_0_rgba(253,230,138,0.14),0_24px_48px_-28px_rgba(0,0,0,0.85)] sm:gap-3 sm:p-3">
            <div
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/55 to-transparent"
                aria-hidden
            />

            <div className="relative shrink-0 overflow-hidden rounded-xl border border-amber-300/35 shadow-[0_18px_36px_-22px_rgba(251,191,36,0.55)]">
                <div className="relative aspect-[16/10] w-full">
                    <img
                        key={viewImageSrc}
                        src={viewImageSrc}
                        alt={viewName}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                        decoding="async"
                    />
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
                        aria-hidden
                    />
                    <div className="absolute inset-x-0 top-0 z-[1] flex items-center gap-2 px-2 py-2 sm:px-2.5 sm:py-2.5">
                        <button
                            type="button"
                            className={navButtonClass}
                            disabled={!canPrev}
                            onClick={() => setViewLevel((lv) => Math.max(1, lv - 1))}
                            aria-label={t('levelEffects.prevLevel')}
                            title={t('levelEffects.prevLevel')}
                        >
                            ‹
                        </button>
                        <div className="min-w-0 flex-1 text-center">
                            <p className="truncate text-sm font-black tracking-tight text-amber-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-base">
                                {viewName}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold tabular-nums tracking-wide text-amber-100/85 sm:text-xs">
                                <span>{t('levelEffects.viewLevel', { level: viewLevel })}</span>
                                {isOwnedView && (
                                    <span className="rounded-md border border-emerald-300/40 bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100 sm:text-[11px]">
                                        {t('levelEffects.current')}
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            className={navButtonClass}
                            disabled={!canNext}
                            onClick={() => setViewLevel((lv) => Math.min(BLACKSMITH_MAX_LEVEL, lv + 1))}
                            aria-label={t('levelEffects.nextLevel')}
                            title={t('levelEffects.nextLevel')}
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

            <div
                className={
                    compactLayout
                        ? 'relative shrink-0 rounded-xl border border-white/10 bg-black/35 p-2 shadow-inner'
                        : 'relative shrink-0 rounded-xl border border-white/10 bg-black/35 p-2.5 shadow-inner'
                }
            >
                <BlacksmithLevelEffectsSummary
                    blacksmithLevel={viewLevel}
                    disassemblyJackpotBonusPercent={disassemblyJackpotBonusPercent}
                    combinationGreatSuccessBonusPercent={combinationGreatSuccessBonusPercent}
                    compact={compactLayout}
                />
            </div>
        </div>
    );

    if (embedded) {
        return <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{effectsBody}</div>;
    }

    return (
        <DraggableWindow
            title={t('effectsTitle')}
            onClose={onClose}
            windowId="blacksmith-effects"
            initialWidth={compactLayout ? 400 : 460}
            initialHeight={compactLayout ? 860 : 840}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={compactLayout}
            mobileViewportMaxHeightVh={compactLayout ? 94 : undefined}
            mobileViewportMaxHeightCss={compactLayout ? 'min(96dvh, calc(100dvh - 8px))' : undefined}
            bodyPaddingClassName={
                compactLayout
                    ? '!px-2 !pt-2 !pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
                    : '!px-3 !pt-3 !pb-3'
            }
        >
            {effectsBody}
        </DraggableWindow>
    );
};

export default BlacksmithEffectsModal;
