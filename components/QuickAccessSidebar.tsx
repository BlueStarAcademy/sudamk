import React, { useMemo, useState } from 'react';
import { useAppUserSlice, useAppUiSlice, useAppRealtimeSlice } from '../hooks/useAppSlices.js';
import { calculateTotalStats } from '../services/statService.js';
import {
    getBadukAbilitySnapshotFromStats,
    isBlacksmithQuickUnlocked,
    isQuestQuickUnlocked,
} from '../shared/utils/contentProgressionGates.js';
import { NEW_FEATURE_BADGE_CLASS } from '../utils/newFeatureBadges.js';
interface QuickAccessSidebarProps {
    mobile?: boolean;
    compact?: boolean;
    /** 레거시: 더 이상 세로 퀵 레일에 사용하지 않음 (호환용 무시) */
    dense?: boolean;
    /** @deprecated App 헤더 아래 가로 스트립으로 대체 */
    nativeHomeColumn?: boolean;
    showOnlyWhenQuestCompleted?: boolean;
    fillHeight?: boolean;
    className?: string;
    /**
     * 네이티브 모바일: 앱 상단 헤더 바로 아래 전체 폭 가로 퀵 바 (게임플레이 6 + 유틸 5).
     */
    mobileHeaderStrip?: boolean;
}

/** 길드·대기실 등 좁은 우측 열 폭 (퀵 메뉴 제거 후에도 활동 레일 등에 사용) */
export const NATIVE_QUICK_RAIL_WIDTH_CLASS = 'w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem]';

/** @deprecated import from shared/constants/pcShellLayout — re-export for 기존 import 호환 */
export { PC_QUICK_RAIL_COLUMN_CLASS } from '../shared/constants/pcShellLayout.js';

type QuickBtn = {
    label: string;
    gameplay: boolean;
    iconUrl?: string;
    emoji?: string;
    handler: () => void;
    disabled?: boolean;
    notification?: boolean;
    newBadge?: boolean;
    count?: number;
    /** 온보딩 안내용 점멸 */
    pulse?: boolean;
};

const QuickAccessSidebar: React.FC<QuickAccessSidebarProps> = ({
    mobile = false,
    compact = false,
    dense: _dense = false,
    nativeHomeColumn: _nativeHomeColumn = false,
    showOnlyWhenQuestCompleted = false,
    fillHeight = true,
    className = '',
    mobileHeaderStrip = false,
}) => {
    const {
        handlers,
    } = useAppUiSlice();
    const {
        hasClaimableQuest,
        hasClaimableExchangeSettlement,
        hasClaimablePairPetTrainingOrHatchery,
        currentUserWithStatus,
    } = useAppUserSlice();
    const { hasUnreadHomeBoardPosts } = useAppRealtimeSlice();

    const badukSnap = useMemo(() => {
        if (!currentUserWithStatus) return null;
        return getBadukAbilitySnapshotFromStats(currentUserWithStatus, calculateTotalStats(currentUserWithStatus));
    }, [currentUserWithStatus]);
    const progressionQuickDisabled = (label: string) => {
        if (!currentUserWithStatus || currentUserWithStatus.isAdmin) return false;
        if (!badukSnap) return false;
        if (label === '퀘스트') return !isQuestQuickUnlocked(badukSnap);
        if (label === '대장간') return !isBlacksmithQuickUnlocked(badukSnap);
        return false;
    };

    if (showOnlyWhenQuestCompleted && !hasClaimableQuest) {
        return null;
    }

    const buttons: QuickBtn[] = useMemo(
        () => [
            {
                label: '퀘스트',
                gameplay: true,
                iconUrl: '/images/quickmenu/quest.webp',
                handler: handlers.openQuests,
                disabled: progressionQuickDisabled('퀘스트'),
                notification: hasClaimableQuest,
            },
            {
                label: '거래소',
                gameplay: true,
                iconUrl: '/images/quickmenu/trade.webp',
                handler: handlers.openExchange,
                disabled: progressionQuickDisabled('거래소'),
                notification: hasClaimableExchangeSettlement,
            },
            {
                label: '대장간',
                gameplay: true,
                iconUrl: '/images/quickmenu/enhance.webp',
                handler: handlers.openBlacksmithModal,
                disabled: progressionQuickDisabled('대장간'),
                notification: false,
            },
            {
                label: '상점',
                gameplay: true,
                iconUrl: '/images/quickmenu/store.webp',
                handler: () => handlers.openShop(),
                disabled: progressionQuickDisabled('상점'),
                notification: false,
            },
            {
                label: '가방',
                gameplay: true,
                iconUrl: '/images/quickmenu/bag.webp',
                handler: handlers.openInventory,
                disabled: progressionQuickDisabled('가방'),
                notification: false,
            },
            {
                label: '펫',
                gameplay: true,
                emoji: '🐾',
                handler: handlers.openPetManagementModal,
                disabled: false,
                notification: hasClaimablePairPetTrainingOrHatchery,
            },
            {
                label: '랭킹',
                gameplay: false,
                emoji: '🏆',
                handler: handlers.openRankingQuickModal,
                disabled: false,
                notification: false,
            },
            {
                label: '기보',
                gameplay: false,
                iconUrl: '/images/quickmenu/gibo.webp',
                handler: handlers.openGameRecordList,
                disabled: false,
                notification: false,
            },
            {
                label: '도감',
                gameplay: false,
                iconUrl: '/images/button/itembook.webp',
                handler: handlers.openEncyclopedia,
                disabled: false,
                notification: false,
            },
            {
                label: '공지',
                gameplay: false,
                emoji: '📢',
                handler: handlers.openAnnouncementsModal,
                disabled: false,
                notification: hasUnreadHomeBoardPosts,
            },
            {
                label: '도움말',
                gameplay: false,
                iconUrl: '/images/button/help.webp',
                handler: handlers.openInfoModal,
                disabled: false,
                notification: false,
            },
        ],
        [
            handlers,
            hasClaimableQuest,
            hasClaimableExchangeSettlement,
            hasUnreadHomeBoardPosts,
            hasClaimablePairPetTrainingOrHatchery,
            badukSnap,
            currentUserWithStatus?.isAdmin,
        ],
    );

    const gameplayButtons = buttons.filter((b) => b.gameplay);
    const utilityButtons = buttons.filter((b) => !b.gameplay);
    const [mobileHeaderDrawer, setMobileHeaderDrawer] = useState<'menu1' | 'menu2' | 'collapsed'>('menu1');

    const notificationDotClass =
        'absolute right-0.5 top-0.5 h-2 w-2 rounded-full border-2 border-slate-900 bg-red-500 sm:right-1 sm:top-1 sm:h-2.5 sm:w-2.5';
    const notificationCountClass =
        'absolute right-0 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full border-2 border-slate-900 bg-red-500 px-0.5 text-[9px] font-bold text-white sm:h-5 sm:text-[10px]';

    const renderIcon = (btn: QuickBtn, iconClass: string) => {
        if (btn.iconUrl) {
            return <img src={btn.iconUrl} alt="" className={iconClass} />;
        }
        if (btn.emoji) {
            return (
                <span className={`flex items-center justify-center leading-none ${iconClass}`} aria-hidden>
                    {btn.emoji}
                </span>
            );
        }
        return null;
    };

    const renderMobileMenuToggleButton = ({
        label,
        tone,
        active,
        compact,
        expanded,
        onClick,
    }: {
        label: '메뉴1' | '메뉴2';
        tone: 'amber' | 'cyan';
        active: boolean;
        compact: boolean;
        expanded: boolean;
        onClick: () => void;
    }) => {
        const isAmber = tone === 'amber';
        return (
            <button
                type="button"
                onClick={onClick}
                aria-pressed={active}
                aria-expanded={expanded}
                className={`group z-10 inline-flex shrink-0 items-center justify-center rounded-md border px-0.5 backdrop-blur-md shadow-[0_6px_18px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.2)] transition-all duration-300 ease-out active:scale-[0.97] ${
                    compact ? 'h-10 min-h-10 w-7' : 'h-14 min-h-14 w-8'
                } ${
                    isAmber
                        ? 'border-amber-300/35 bg-gradient-to-br from-amber-400/20 via-stone-900/75 to-stone-950 text-amber-100'
                        : 'border-cyan-300/35 bg-gradient-to-br from-cyan-400/18 via-slate-900/80 to-slate-950 text-cyan-100'
                } ${active ? 'ring-2 ring-white/25' : 'opacity-90'}`}
            >
                <div
                    className={`flex flex-col rounded-sm bg-black/45 ring-1 ring-inset ${
                        compact ? 'gap-0.5 px-0.5 py-1' : 'gap-[3px] px-[3px] py-1.5'
                    } ${isAmber ? 'ring-amber-300/30' : 'ring-cyan-300/25'}`}
                    aria-hidden
                >
                    <span className={`rounded-full bg-white/90 ${compact ? 'h-px w-2.5' : 'h-[1.5px] w-3'}`} />
                    <span className={`rounded-full bg-white/90 ${compact ? 'h-px w-2.5' : 'h-[1.5px] w-3'}`} />
                    <span className={`rounded-full bg-white/90 ${compact ? 'h-px w-2.5' : 'h-[1.5px] w-3'}`} />
                </div>
                <span className="sr-only">{label}</span>
            </button>
        );
    };

    const renderStripButton = (btn: QuickBtn, variant: 'wrap' | 'topBar' = 'wrap') => {
        const g = btn.gameplay;
        const shell = g
            ? 'border-amber-500/45 bg-gradient-to-b from-amber-950/55 via-amber-900/25 to-slate-950/90 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)]'
            : 'border-violet-500/35 bg-gradient-to-b from-violet-950/40 via-slate-900/40 to-slate-950/90 shadow-[inset_0_1px_0_rgba(167,139,250,0.1)]';
        const topBar = variant === 'topBar';
        const iconShell = topBar
            ? 'flex h-9 w-9 shrink-0 items-center justify-center'
            : 'flex h-[clamp(1.55rem,6.5vw,2.05rem)] w-[clamp(1.55rem,6.5vw,2.05rem)] shrink-0 items-center justify-center';
        const iconInner = btn.iconUrl
            ? topBar
                ? 'h-full w-full object-contain drop-shadow-sm [image-rendering:-webkit-optimize-contrast]'
                : 'h-full w-full object-contain drop-shadow-sm'
            : topBar
              ? 'text-[1.2rem] leading-none'
              : 'text-[clamp(1.15rem,5.5vw,1.5rem)] leading-none';
        const labelClass = topBar
            ? 'w-full truncate text-center text-[10px] font-semibold leading-none text-gray-100'
            : 'w-full truncate text-center text-[clamp(6px,2.5vw,9px)] font-semibold leading-none text-gray-100';
        return (
            <button
                key={btn.label}
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    btn.handler();
                }}
                disabled={btn.disabled}
                title={btn.label}
                className={`relative flex min-h-0 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${btn.pulse ? 'animate-pulse ring-2 ring-amber-300/60' : ''} ${topBar ? 'h-full min-h-0 py-1' : 'py-1'} ${shell}`}
            >
                <div className={iconShell}>
                    {renderIcon(btn, iconInner)}
                </div>
                <span className={labelClass}>{btn.label}</span>
                {btn.notification &&
                    (btn.count && btn.count > 0 ? (
                        <span className={notificationCountClass}>{btn.count > 9 ? '9+' : btn.count}</span>
                    ) : (
                        <span className={notificationDotClass} />
                    ))}
                {btn.newBadge && <span className={`${NEW_FEATURE_BADGE_CLASS} left-0.5 top-0.5 scale-90`}>NEW</span>}
            </button>
        );
    };

    if (mobileHeaderStrip) {
        if (!currentUserWithStatus) return null;
        const stripCollapsed = mobileHeaderDrawer === 'collapsed';
        return (
            <div
                className={[
                    'relative flex w-full min-w-0 items-stretch overflow-hidden border-b border-amber-900/25 bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950 px-0.5 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)] transition-[padding] duration-300 ease-out',
                    stripCollapsed ? 'py-1' : 'py-1.5',
                    className,
                ]
                    .filter(Boolean)
                    .join(' ')}
                data-quick-access-sidebar-root
            >
                <div className="relative flex min-h-14 w-full items-center justify-between">
                    {renderMobileMenuToggleButton({
                        label: '메뉴1',
                        tone: 'amber',
                        active: mobileHeaderDrawer === 'menu1',
                        compact: false,
                        expanded: !stripCollapsed && mobileHeaderDrawer === 'menu1',
                        onClick: () =>
                            setMobileHeaderDrawer((d) => {
                                if (d === 'menu1') return 'collapsed';
                                return 'menu1';
                            }),
                    })}
                    {renderMobileMenuToggleButton({
                        label: '메뉴2',
                        tone: 'cyan',
                        active: mobileHeaderDrawer === 'menu2',
                        compact: false,
                        expanded: !stripCollapsed && mobileHeaderDrawer === 'menu2',
                        onClick: () =>
                            setMobileHeaderDrawer((d) => {
                                if (d === 'menu2') return 'collapsed';
                                return 'menu2';
                            }),
                    })}

                    <div
                        className={`pointer-events-none absolute inset-x-[2.75rem] top-0 overflow-hidden transition-all duration-300 ease-out ${
                            stripCollapsed
                                ? 'max-h-0 opacity-0 -translate-y-2'
                                : 'max-h-14 min-h-14 translate-y-0 opacity-100'
                        }`}
                    >
                        <div className="relative h-14 min-h-14 w-full">
                            <div
                                className={`absolute inset-0 transition-all duration-300 ease-out ${
                                    !stripCollapsed && mobileHeaderDrawer === 'menu1'
                                        ? 'pointer-events-auto translate-x-0 opacity-100'
                                        : 'pointer-events-none -translate-x-8 opacity-0'
                                }`}
                            >
                                <div className="flex h-full w-full items-stretch gap-1 pr-1">
                                    {gameplayButtons.map((btn) => renderStripButton(btn, 'topBar'))}
                                </div>
                            </div>

                            <div
                                className={`absolute inset-0 transition-all duration-300 ease-out ${
                                    !stripCollapsed && mobileHeaderDrawer === 'menu2'
                                        ? 'pointer-events-auto translate-x-0 opacity-100'
                                        : 'pointer-events-none translate-x-8 opacity-0'
                                }`}
                            >
                                <div className="flex h-full w-full items-stretch justify-start gap-1 pl-1 pr-1">
                                    {utilityButtons.map((btn) => renderStripButton(btn, 'topBar'))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const verticalOuter = compact
        ? `rounded-xl border border-slate-600/40 bg-slate-950/50 p-1 flex flex-col gap-1.5 overflow-hidden ${fillHeight ? 'h-full min-h-0' : ''}`
        : `rounded-xl border border-slate-600/40 bg-slate-950/50 p-1.5 flex flex-col gap-2 overflow-hidden ${fillHeight ? 'h-full min-h-0' : ''}`;

    const gameplayPanel = compact
        ? 'flex min-h-0 flex-[6_1_0] flex-col gap-0.5 overflow-hidden rounded-lg border border-amber-500/40 bg-gradient-to-b from-amber-950/50 to-slate-950/90 p-1 shadow-inner'
        : 'flex min-h-0 flex-[6_1_0] flex-col gap-1 overflow-hidden rounded-lg border border-amber-500/45 bg-gradient-to-b from-amber-950/55 via-amber-900/20 to-slate-950/90 p-1.5 shadow-inner';

    const utilityPanel = compact
        ? 'flex min-h-0 flex-[5_1_0] flex-col gap-0.5 overflow-hidden rounded-lg border border-violet-500/35 bg-gradient-to-b from-violet-950/35 to-slate-950/90 p-1 shadow-inner'
        : 'flex min-h-0 flex-[5_1_0] flex-col gap-1 overflow-hidden rounded-lg border border-violet-500/40 bg-gradient-to-b from-violet-950/40 via-slate-900/30 to-slate-950/90 p-1.5 shadow-inner';

    const pcBtnGameplay = compact
        ? 'relative flex min-h-0 flex-1 w-full flex-col items-center justify-center gap-0.5 rounded-md border border-amber-600/35 bg-gradient-to-br from-amber-900/50 to-slate-900/80 px-0.5 py-0.5 shadow-sm transition-transform hover:border-amber-400/50 active:scale-[0.98]'
        : 'relative flex min-h-0 flex-1 w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-amber-500/50 bg-gradient-to-br from-amber-800/45 via-amber-900/35 to-slate-900/85 px-1 py-1 shadow-md transition-transform hover:border-amber-400/65 hover:shadow-lg active:scale-[0.98]';

    const pcBtnUtility = compact
        ? 'relative flex min-h-0 flex-1 w-full flex-col items-center justify-center gap-0.5 rounded-md border border-violet-500/30 bg-gradient-to-br from-violet-950/45 to-slate-900/85 px-0.5 py-0.5 shadow-sm transition-transform hover:border-violet-400/45 active:scale-[0.98]'
        : 'relative flex min-h-0 flex-1 w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-violet-500/40 bg-gradient-to-br from-violet-900/40 via-slate-900/40 to-slate-950/90 px-1 py-1 shadow-md transition-transform hover:border-violet-400/55 hover:shadow-lg active:scale-[0.98]';

    const iconPcGameplay = compact ? 'max-h-full max-w-full object-contain' : 'max-h-full max-w-full object-contain';
    const iconPcUtility = compact ? 'max-h-full max-w-full object-contain' : 'max-h-full max-w-full object-contain';
    /** 이모지 버튼: 부모 % 기반 금지(좁은 열에서 과도 축소). 도감·도움말 PNG와 비슷한 시각 무게 */
    const emojiPcGameplay = compact ? 'text-2xl leading-none' : 'text-3xl leading-none';
    const emojiPcUtility = compact ? 'text-2xl leading-none' : 'text-3xl leading-none';

    const labelPc = compact ? 'text-[9px] font-semibold text-gray-100' : 'text-[10px] font-semibold text-gray-100 sm:text-[11px]';

    const renderVerticalButton = (btn: QuickBtn) => {
        const base = btn.gameplay ? pcBtnGameplay : pcBtnUtility;
        const imgCls = btn.gameplay ? iconPcGameplay : iconPcUtility;
        const emoCls = btn.gameplay ? emojiPcGameplay : emojiPcUtility;
        return (
            <button
                key={btn.label}
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    btn.handler();
                }}
                disabled={btn.disabled}
                title={btn.label}
                className={`${base} disabled:cursor-not-allowed disabled:opacity-45 ${btn.pulse ? 'animate-pulse ring-2 ring-amber-300/60' : ''}`}
            >
                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <div className="flex aspect-square h-full max-h-14 min-h-[2.35rem] min-w-0 max-w-full items-center justify-center">
                    {btn.iconUrl ? (
                        <img src={btn.iconUrl} alt="" className={imgCls} />
                    ) : (
                        <span className={`flex items-center justify-center leading-none ${emoCls}`} aria-hidden>
                            {btn.emoji}
                        </span>
                    )}
                    </div>
                </div>
                <span className={`${labelPc} w-full truncate text-center leading-tight`}>{btn.label}</span>
                {btn.notification &&
                    (btn.count && btn.count > 0 ? (
                        <span className={notificationCountClass}>{btn.count > 9 ? '9+' : btn.count}</span>
                    ) : (
                        <span className={notificationDotClass} />
                    ))}
                {btn.newBadge && <span className={`${NEW_FEATURE_BADGE_CLASS} left-1 top-1`}>NEW</span>}
            </button>
        );
    };

    const connector = (
        <div
            className="relative mx-auto h-2 w-[85%] shrink-0 rounded-full bg-gradient-to-r from-transparent via-amber-400/25 to-transparent"
            aria-hidden
        />
    );

    if (mobile && !mobileHeaderStrip) {
        const wrap =
            'flex flex-wrap justify-center gap-1.5 rounded-xl border border-slate-600/35 bg-slate-950/60 p-1.5';
        return (
            <div className={[wrap, className].filter(Boolean).join(' ')} data-quick-access-sidebar-root>
                <div className="flex w-full flex-wrap justify-center gap-1">
                    {gameplayButtons.map((btn) => renderStripButton(btn))}
                </div>
                {connector}
                <div className="flex w-full flex-wrap justify-center gap-1">
                    {utilityButtons.map((btn) => renderStripButton(btn))}
                </div>
            </div>
        );
    }

    return (
        <div className={[verticalOuter, className].filter(Boolean).join(' ')} data-quick-access-sidebar-root>
            <div className={gameplayPanel}>{gameplayButtons.map(renderVerticalButton)}</div>
            {connector}
            <div className={utilityPanel}>{utilityButtons.map(renderVerticalButton)}</div>
        </div>
    );
};

export default QuickAccessSidebar;
