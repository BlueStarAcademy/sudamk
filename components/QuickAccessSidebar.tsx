import React, { useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';

interface QuickAccessSidebarProps {
    mobile?: boolean;
    compact?: boolean;
    /** 네이티브 모바일 한 화면용: 버튼·글자 축소 */
    dense?: boolean;
    /** 네이티브 홈 우측: PC 기본 퀵메뉴(폭 6rem)와 동일한 버튼·아이콘 비율 */
    nativeHomeColumn?: boolean;
    showOnlyWhenQuestCompleted?: boolean;
    fillHeight?: boolean;
}

const QuickAccessSidebar: React.FC<QuickAccessSidebarProps> = ({
    mobile = false,
    compact = false,
    dense = false,
    nativeHomeColumn = false,
    showOnlyWhenQuestCompleted = false,
    fillHeight = true,
}) => {
    const { handlers, unreadMailCount, hasClaimableQuest, currentUserWithStatus } = useAppContext();
    
    if (showOnlyWhenQuestCompleted && !hasClaimableQuest) {
        return null;
    }

    const hasUnreadMail = unreadMailCount > 0;

    const allButtons = [
        { label: '퀘스트', iconUrl: '/images/quickmenu/quest.png', handler: handlers.openQuests, disabled: false, notification: hasClaimableQuest },
        { label: '기보', iconUrl: '/images/quickmenu/gibo.png', handler: handlers.openGameRecordList, disabled: false, notification: false },
        { label: '대장간', iconUrl: '/images/quickmenu/enhance.png', handler: handlers.openBlacksmithModal, disabled: false, notification: false },
        { label: '상점', iconUrl: '/images/quickmenu/store.png', handler: handlers.openShop, disabled: false, notification: false },
        { label: '가방', iconUrl: '/images/quickmenu/bag.png', handler: handlers.openInventory, disabled: false, notification: false },
    ];
    
    const containerClass = nativeHomeColumn
        ? `bg-panel rounded-lg p-1 flex w-full min-h-0 flex-col overflow-hidden ${
              fillHeight ? 'h-full justify-around gap-0.5' : 'shrink-0 justify-start gap-1'
          }`
        : mobile && dense
        ? "flex flex-wrap justify-center items-center gap-1"
        : mobile
        ? "flex justify-around items-center gap-2"
        : compact
        ? `bg-panel rounded-lg p-1 flex flex-col justify-around gap-0.5 ${fillHeight ? 'h-full' : ''}`
        : `bg-panel rounded-lg p-1 flex flex-col justify-around gap-0.5 ${fillHeight ? 'h-full' : ''}`;

    const buttonClass = nativeHomeColumn
        ? 'flex flex-col items-center justify-center p-1 rounded-lg w-full bg-gradient-to-br from-gray-700/90 via-gray-600/80 to-gray-700/90 hover:from-gray-600/95 hover:via-gray-500/85 hover:to-gray-600/95 border-2 border-gray-500/60 hover:border-gray-400/80 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95'
        : mobile && dense
        ? "flex flex-col items-center justify-center p-0.5 rounded-lg w-[2.35rem] h-[2.35rem] sm:w-11 sm:h-11 bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-700/80 border border-gray-500/50 shadow-md transition-transform active:scale-95"
        : mobile
        ? "flex flex-col items-center justify-center p-2 rounded-lg w-16 h-16 bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-700/80 hover:from-gray-600/90 hover:via-gray-500/80 hover:to-gray-600/90 border-2 border-gray-500/50 hover:border-gray-400/70 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
        : compact
        ? `flex flex-col items-center justify-center p-1 rounded-lg w-full bg-gradient-to-br from-gray-700/80 via-gray-600/70 to-gray-700/80 hover:from-gray-600/90 hover:via-gray-500/80 hover:to-gray-600/90 border-2 border-gray-500/50 hover:border-gray-400/70 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95`
        : `flex flex-col items-center justify-center p-1 rounded-lg w-full bg-gradient-to-br from-gray-700/90 via-gray-600/80 to-gray-700/90 hover:from-gray-600/95 hover:via-gray-500/85 hover:to-gray-600/95 border-2 border-gray-500/60 hover:border-gray-400/80 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95`;

    const iconSize = nativeHomeColumn
        ? 'w-10 h-10 object-contain drop-shadow-md'
        : mobile && dense
          ? "w-4 h-4 object-contain drop-shadow-sm"
          : mobile
            ? "w-7 h-7 object-contain drop-shadow-md"
            : compact
              ? "w-12 h-12 object-contain drop-shadow-md"
              : "w-10 h-10 object-contain drop-shadow-md";
    const labelSize = nativeHomeColumn
        ? 'text-[10px] mt-0.5 font-semibold text-gray-200'
        : mobile && dense
          ? "text-[7px] mt-0.5 font-semibold text-gray-200 leading-none"
          : mobile
            ? "text-[11px] mt-1.5 font-semibold text-gray-200"
            : compact
              ? "text-[10px] mt-0.5 font-semibold text-gray-200"
              : "text-[10px] mt-0.5 font-semibold text-gray-200";
    
    const notificationDotClass = nativeHomeColumn
        ? 'absolute top-1 right-1 bg-red-500 rounded-full w-2.5 h-2.5 border-2 border-gray-800/50'
        : mobile
          ? "absolute top-1 right-1 bg-red-500 rounded-full w-2.5 h-2.5 border-2 border-gray-800"
          : `absolute top-1 right-1 bg-red-500 rounded-full w-2.5 h-2.5 border-2 ${compact ? 'border-gray-800' : 'border-gray-800/50'}`;
    
    const notificationCountClass = nativeHomeColumn
        ? 'absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-gray-800/50'
        : mobile
          ? "absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-gray-800"
          : `absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full ${compact ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center border-2 ${compact ? 'border-gray-800' : 'border-gray-800/50'}`;


    const renderButton = (btn: typeof allButtons[0]) => (
        <button
            key={btn.label}
            onClick={(e) => { e.preventDefault(); btn.handler(); }}
            disabled={btn.disabled}
            className={`relative ${
                nativeHomeColumn
                    ? fillHeight
                        ? 'min-h-0 flex-1'
                        : 'shrink-0 flex-none'
                    : mobile && dense
                      ? 'flex-none'
                      : 'flex-1'
            } ${buttonClass} disabled:cursor-not-allowed disabled:opacity-50 transition-colors`}
            title={btn.label}
        >
            <img src={btn.iconUrl} alt={btn.label} className={iconSize} />
            <span className={labelSize}>{btn.label}</span>
            {btn.notification && (
                (btn as any).count && (btn as any).count > 0 ? (
                    <span className={notificationCountClass}>
                        {(btn as any).count > 9 ? '9+' : (btn as any).count}
                    </span>
                ) : (
                    <span className={notificationDotClass}></span>
                )
            )}
        </button>
    );

    return (
        <div className={containerClass} data-quick-access-sidebar-root>
            {allButtons.map(renderButton)}
        </div>
    );
};

export default QuickAccessSidebar;