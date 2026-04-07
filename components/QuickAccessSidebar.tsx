import React, { useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
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
     * 네이티브 모바일: 앱 상단 헤더 바로 아래 전체 폭 가로 퀵 바 (게임플레이 5 + 유틸 6).
     */
    mobileHeaderStrip?: boolean;
}

/** 길드·대기실 등 좁은 우측 열 폭 (퀵 메뉴 제거 후에도 활동 레일 등에 사용) */
export const NATIVE_QUICK_RAIL_WIDTH_CLASS = 'w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem]';

/** PC·캔버스 등 세로 퀵 메뉴(QuickAccessSidebar) 외곽 열 폭 — 기존 6rem(w-24)보다 약간 넓게 */
export const PC_QUICK_RAIL_COLUMN_CLASS =
    'w-[7.5rem] min-w-[120px] max-w-[8.5rem] shrink-0';

type QuickBtn = {
    label: string;
    gameplay: boolean;
    iconUrl?: string;
    emoji?: string;
    handler: () => void;
    disabled?: boolean;
    notification?: boolean;
    count?: number;
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
    const { handlers, hasClaimableQuest, currentUserWithStatus } = useAppContext();

    if (showOnlyWhenQuestCompleted && !hasClaimableQuest) {
        return null;
    }

    const buttons: QuickBtn[] = useMemo(
        () => [
            {
                label: '퀘스트',
                gameplay: true,
                iconUrl: '/images/quickmenu/quest.png',
                handler: handlers.openQuests,
                disabled: false,
                notification: hasClaimableQuest,
            },
            {
                label: '기보',
                gameplay: true,
                iconUrl: '/images/quickmenu/gibo.png',
                handler: handlers.openGameRecordList,
                disabled: false,
                notification: false,
            },
            {
                label: '대장간',
                gameplay: true,
                iconUrl: '/images/quickmenu/enhance.png',
                handler: handlers.openBlacksmithModal,
                disabled: false,
                notification: false,
            },
            {
                label: '상점',
                gameplay: true,
                iconUrl: '/images/quickmenu/store.png',
                handler: () => handlers.openShop(),
                disabled: false,
                notification: false,
            },
            {
                label: '가방',
                gameplay: true,
                iconUrl: '/images/quickmenu/bag.png',
                handler: handlers.openInventory,
                disabled: false,
                notification: false,
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
                label: '채팅',
                gameplay: false,
                emoji: '💬',
                handler: handlers.openChatQuickModal,
                disabled: false,
                notification: false,
            },
            {
                label: '도감',
                gameplay: false,
                iconUrl: '/images/button/itembook.png',
                handler: handlers.openEncyclopedia,
                disabled: false,
                notification: false,
            },
            {
                label: '도움말',
                gameplay: false,
                iconUrl: '/images/button/help.webp',
                handler: handlers.openInfoModal,
                disabled: false,
                notification: false,
            },
            {
                label: '공지',
                gameplay: false,
                emoji: '📢',
                handler: handlers.openAnnouncementsModal,
                disabled: false,
                notification: false,
            },
            {
                label: '설정',
                gameplay: false,
                emoji: '⚙️',
                handler: handlers.openSettingsModal,
                disabled: false,
                notification: false,
            },
        ],
        [handlers, hasClaimableQuest],
    );

    const gameplayButtons = buttons.filter((b) => b.gameplay);
    const utilityButtons = buttons.filter((b) => !b.gameplay);

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

    const renderStripButton = (btn: QuickBtn) => {
        const g = btn.gameplay;
        const shell = g
            ? 'border-amber-500/45 bg-gradient-to-b from-amber-950/55 via-amber-900/25 to-slate-950/90 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)]'
            : 'border-violet-500/35 bg-gradient-to-b from-violet-950/40 via-slate-900/40 to-slate-950/90 shadow-[inset_0_1px_0_rgba(167,139,250,0.1)]';
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
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${shell}`}
            >
                <div className="flex h-[clamp(1rem,5vw,1.35rem)] w-[clamp(1rem,5vw,1.35rem)] shrink-0 items-center justify-center">
                    {renderIcon(
                        btn,
                        btn.iconUrl
                            ? 'h-full w-full object-contain drop-shadow-sm'
                            : 'text-[clamp(0.85rem,4.2vw,1.15rem)]',
                    )}
                </div>
                <span className="w-full truncate text-center text-[clamp(6px,2.5vw,9px)] font-semibold leading-none text-gray-100">
                    {btn.label}
                </span>
                {btn.notification &&
                    (btn.count && btn.count > 0 ? (
                        <span className={notificationCountClass}>{btn.count > 9 ? '9+' : btn.count}</span>
                    ) : (
                        <span className={notificationDotClass} />
                    ))}
            </button>
        );
    };

    if (mobileHeaderStrip) {
        if (!currentUserWithStatus) return null;
        return (
            <div
                className={[
                    'flex w-full min-w-0 items-stretch gap-0 border-b border-amber-900/25 bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950 px-0.5 py-1 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]',
                    className,
                ]
                    .filter(Boolean)
                    .join(' ')}
                data-quick-access-sidebar-root
            >
                <div className="flex min-w-0 w-full flex-nowrap items-stretch gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {gameplayButtons.map(renderStripButton)}
                    <div
                        className="mx-0.5 w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-amber-400/35 to-transparent"
                        aria-hidden
                    />
                    {utilityButtons.map(renderStripButton)}
                </div>
            </div>
        );
    }

    const verticalOuter = compact
        ? `rounded-xl border border-slate-600/40 bg-slate-950/50 p-1 flex flex-col gap-1.5 ${fillHeight ? 'h-full min-h-0' : ''}`
        : `rounded-xl border border-slate-600/40 bg-slate-950/50 p-1.5 flex flex-col gap-2 ${fillHeight ? 'h-full min-h-0' : ''}`;

    const gameplayPanel = compact
        ? 'flex flex-col gap-0.5 rounded-lg border border-amber-500/40 bg-gradient-to-b from-amber-950/50 to-slate-950/90 p-1 shadow-inner'
        : 'flex flex-col gap-1 rounded-lg border border-amber-500/45 bg-gradient-to-b from-amber-950/55 via-amber-900/20 to-slate-950/90 p-1.5 shadow-inner';

    const utilityPanel = compact
        ? 'flex flex-col gap-0.5 rounded-lg border border-violet-500/35 bg-gradient-to-b from-violet-950/35 to-slate-950/90 p-1 shadow-inner'
        : 'flex flex-col gap-1 rounded-lg border border-violet-500/40 bg-gradient-to-b from-violet-950/40 via-slate-900/30 to-slate-950/90 p-1.5 shadow-inner';

    const pcBtnGameplay = compact
        ? 'relative flex w-full flex-col items-center justify-center gap-0.5 rounded-md border border-amber-600/35 bg-gradient-to-br from-amber-900/50 to-slate-900/80 px-0.5 py-1 shadow-sm transition-transform hover:border-amber-400/50 active:scale-[0.98]'
        : 'relative flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-amber-500/50 bg-gradient-to-br from-amber-800/45 via-amber-900/35 to-slate-900/85 px-1 py-1.5 shadow-md transition-transform hover:border-amber-400/65 hover:shadow-lg active:scale-[0.98]';

    const pcBtnUtility = compact
        ? 'relative flex w-full flex-col items-center justify-center gap-0.5 rounded-md border border-violet-500/30 bg-gradient-to-br from-violet-950/45 to-slate-900/85 px-0.5 py-1 shadow-sm transition-transform hover:border-violet-400/45 active:scale-[0.98]'
        : 'relative flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-violet-500/40 bg-gradient-to-br from-violet-900/40 via-slate-900/40 to-slate-950/90 px-1 py-1.5 shadow-md transition-transform hover:border-violet-400/55 hover:shadow-lg active:scale-[0.98]';

    const iconPcGameplay = compact ? 'h-9 w-9 object-contain' : 'h-10 w-10 object-contain sm:h-11 sm:w-11';
    const iconPcUtility = compact ? 'h-9 w-9 object-contain' : 'h-10 w-10 object-contain sm:h-11 sm:w-11';
    const emojiPcGameplay = compact ? 'text-xl' : 'text-2xl sm:text-[1.65rem]';
    const emojiPcUtility = compact ? 'text-lg' : 'text-xl sm:text-2xl';

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
                className={`${base} disabled:cursor-not-allowed disabled:opacity-45`}
            >
                <div className="flex h-10 w-full items-center justify-center sm:h-11">
                    {btn.iconUrl ? (
                        <img src={btn.iconUrl} alt="" className={imgCls} />
                    ) : (
                        <span className={`flex items-center justify-center leading-none ${emoCls}`} aria-hidden>
                            {btn.emoji}
                        </span>
                    )}
                </div>
                <span className={`${labelPc} w-full truncate text-center leading-tight`}>{btn.label}</span>
                {btn.notification &&
                    (btn.count && btn.count > 0 ? (
                        <span className={notificationCountClass}>{btn.count > 9 ? '9+' : btn.count}</span>
                    ) : (
                        <span className={notificationDotClass} />
                    ))}
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
                <div className="flex w-full flex-wrap justify-center gap-1">{gameplayButtons.map(renderStripButton)}</div>
                {connector}
                <div className="flex w-full flex-wrap justify-center gap-1">{utilityButtons.map(renderStripButton)}</div>
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
