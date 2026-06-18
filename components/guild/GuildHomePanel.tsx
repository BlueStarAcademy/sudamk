import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Guild as GuildType, ChatMessage, GuildMember } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import { GUILD_CHECK_IN_MILESTONE_REWARDS } from '../../constants/index.js';
import { isSameDayKST, getTodayKSTDateString } from '../../utils/timeUtils.js';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';
import MobileModalTitleBar from '../mobile/MobileModalTitleBar.js';
import { useMobileModalChrome } from '../../hooks/useMobileModalChrome.js';
import { GAME_CHAT_MESSAGES, GAME_CHAT_EMOJIS, ADMIN_USER_ID } from '../../constants/index.js';
import { containsProfanity } from '../../profanity.js';
import { mergeWaitingRoomPublicChatMessages } from '../../shared/utils/waitingRoomGlobalChatMerge.js';
import ChatInlineMessageRow from '../waiting-room/ChatInlineMessageRow.js';
import { guildChatHistoryEntryToChatMessage } from '../../shared/utils/guildChatMessageAdapter.js';
import { useTranslation } from 'react-i18next';

// 고급 버튼 스타일 함수
const luxuryButtonBase =
    'relative flex items-center justify-center gap-1 overflow-hidden whitespace-normal break-keep rounded-xl px-4 py-2 text-sm font-semibold tracking-wide transition-all duration-200';

export const getLuxuryButtonClasses = (variant: 'primary' | 'danger' | 'neutral' | 'accent' | 'success' | 'green' | 'gray' = 'primary') => {
    const variants: Record<string, string> = {
        primary: `${luxuryButtonBase} border border-cyan-200/40 bg-gradient-to-br from-cyan-500/85 via-sky-500/80 to-indigo-500/80 text-white shadow-[0_18px_34px_-18px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-18px_rgba(96,165,250,0.6)]`,
        danger: `${luxuryButtonBase} border border-rose-300/45 bg-gradient-to-br from-rose-600/90 via-red-500/85 to-amber-400/80 text-white shadow-[0_18px_36px_-16px_rgba(248,113,113,0.55)] hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-18px_rgba(248,113,113,0.65)]`,
        neutral: `${luxuryButtonBase} border border-slate-400/35 bg-gradient-to-br from-slate-800/85 via-slate-900/80 to-black/70 text-slate-100 shadow-[0_16px_32px_-20px_rgba(148,163,184,0.5)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-18px_rgba(203,213,225,0.55)]`,
        accent: `${luxuryButtonBase} border border-amber-300/55 bg-gradient-to-br from-amber-400/85 via-yellow-400/75 to-orange-400/80 text-slate-900 shadow-[0_18px_36px_-18px_rgba(251,191,36,0.5)] hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-18px_rgba(251,191,36,0.6)]`,
        success: `${luxuryButtonBase} border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-slate-900 shadow-[0_18px_34px_-18px_rgba(74,222,128,0.45)] hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-18px_rgba(74,222,128,0.6)]`,
        green: `${luxuryButtonBase} border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-white shadow-[0_18px_34px_-18px_rgba(74,222,128,0.45)] hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-18px_rgba(74,222,128,0.6)]`,
        gray: `${luxuryButtonBase} border border-slate-400/35 bg-gradient-to-br from-slate-700/85 via-slate-800/80 to-slate-900/70 text-slate-300 shadow-[0_16px_32px_-20px_rgba(148,163,184,0.4)] opacity-60 cursor-not-allowed`,
    };
    return variants[variant] || variants.primary;
};

export const GuildCheckInPanel: React.FC<{ guild: GuildType; leftAction?: React.ReactNode }> = ({ guild, leftAction }) => {
    const { t } = useTranslation(['guild', 'common']);
    const useMobileChrome = useMobileModalChrome();
    const { handlers, currentUserWithStatus } = useAppContext();
    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;

    const [guildCoinRewardModal, setGuildCoinRewardModal] = useState<{
        amount: number;
        attendeeCount: number;
    } | null>(null);

    const now = Date.now();
    const todayKstStr = getTodayKSTDateString(now);
    const myCheckInTimestamp = guild.checkIns?.[effectiveUserId ?? currentUserWithStatus!.id];
    const hasCheckedInToday = myCheckInTimestamp ? isSameDayKST(myCheckInTimestamp, now) : false;

    const todaysCheckIns = Object.values(guild.checkIns || {}).filter(ts => isSameDayKST(ts, now)).length;
    const totalMembers = guild.memberLimit || (guild.members?.length || 0);
    
    const maxProgress = GUILD_CHECK_IN_MILESTONE_REWARDS[GUILD_CHECK_IN_MILESTONE_REWARDS.length - 1].count;
    // 막대그래프는 출석 인원수 기준으로 채워지되, 최대 maxProgress까지만 표시
    const progressPercent = totalMembers > 0 ? Math.min((todaysCheckIns / totalMembers) * 100, 100) : 0;

    const handleCheckIn = async () => {
        const result = await handlers.handleAction({ type: 'GUILD_CHECK_IN' }) as any;
        if (result?.error) {
            console.error('[GuildCheckInPanel] Check-in failed:', result.error);
            alert(result.error);
        } else {
            // 성공 시 길드 정보를 다시 가져옴
            await handlers.handleAction({ type: 'GET_GUILD_INFO' });
        }
    };
    
    const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
    const handleClaimMilestone = async (index: number) => {
        if (claimingIndex !== null) return;
        setClaimingIndex(index);
        try {
            const result = await handlers.handleAction({
                type: 'GUILD_CLAIM_CHECK_IN_REWARD',
                payload: { milestoneIndex: index },
            }) as any;
            if (result?.error) {
                alert(result.error);
                return;
            }
            const coins =
                typeof (result as any)?.clientResponse?.gainedGuildCoins === 'number'
                    ? (result as any).clientResponse.gainedGuildCoins
                    : typeof (result as any)?.gainedGuildCoins === 'number'
                      ? (result as any).gainedGuildCoins
                      : 0;
            if (coins > 0) {
                const milestone = GUILD_CHECK_IN_MILESTONE_REWARDS[index];
                if (milestone) {
                    setGuildCoinRewardModal({ amount: coins, attendeeCount: milestone.count });
                }
            }
        } finally {
            setClaimingIndex(null);
        }
    };

    return (
        <>
        <div className="relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 p-2 shadow-lg sm:p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col h-full min-h-0">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h3 className="font-bold text-sm sm:text-lg text-highlight drop-shadow-lg flex items-center gap-1 sm:gap-2">
                        <span className="text-base sm:text-xl">📅</span>
                        <span className="whitespace-nowrap">{t('checkIn.title')}</span>
                    </h3>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {leftAction}
                        <Button 
                            onClick={handleCheckIn} 
                            disabled={hasCheckedInToday} 
                            colorScheme="none"
                            className={`${hasCheckedInToday ? getLuxuryButtonClasses('gray') : getLuxuryButtonClasses('green')} !text-xs sm:!text-sm !py-1 sm:!py-2 !px-2 sm:!px-4`}
                        >
                            {hasCheckedInToday ? t('checkIn.checkedIn') : t('checkIn.checkIn')}
                        </Button>
                    </div>
                </div>
                <p className="text-xs sm:text-sm text-tertiary mb-2 flex-shrink-0">
                    {t('checkIn.todayCount', { current: todaysCheckIns, total: totalMembers })}
                </p>
                <div className="my-2 relative z-10 flex-shrink-0">
                    <div className="relative h-2 w-full rounded-full border-2 border-black/30 bg-tertiary/60 shadow-inner sm:h-3">
                        <div className="bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(74,222,128,0.6)]" style={{ width: `${progressPercent}%` }}></div>
                        {GUILD_CHECK_IN_MILESTONE_REWARDS.map((milestone, index) => {
                            // 마일스톤 구분선: totalMembers 기준으로 위치 계산
                            const milestonePercent = totalMembers > 0 
                                ? Math.min((milestone.count / totalMembers) * 100, 100) 
                                : 0;
                            // 마일스톤이 totalMembers보다 크면 표시하지 않음
                            if (milestone.count > totalMembers) return null;
                            return (
                                <div 
                                    key={`milestone-line-${index}`} 
                                    className="absolute top-0 h-full w-0.5 bg-yellow-400/80 z-10 border-l border-yellow-300 shadow-[0_0_4px_rgba(251,191,36,0.8)]" 
                                    style={{ left: `${milestonePercent}%` }} 
                                    title={t('checkIn.milestoneReward', { count: milestone.count })}
                                >
                                    <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] text-yellow-300 font-bold whitespace-nowrap drop-shadow-lg bg-black/40 px-1 rounded">
                                        {t('checkIn.milestoneCount', { count: milestone.count })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 sm:gap-3 flex-grow relative z-10 min-h-0 min-w-0">
                    {GUILD_CHECK_IN_MILESTONE_REWARDS.map((milestone, index) => {
                        const isAchieved = todaysCheckIns >= milestone.count;
                        const isClaimed = guild.dailyCheckInRewardsClaimed?.some(c => {
                            if (c.userId !== effectiveUserId || c.milestoneIndex !== index) return false;
                            const d = (c as { claimedKstDay?: string }).claimedKstDay;
                            if (d === todayKstStr) return true;
                            if (d == null) return true;
                            return false;
                        });
                        const isClaiming = claimingIndex === index;
                        const canClaim = isAchieved && !isClaimed && hasCheckedInToday && !isClaiming;
                        
                        return (
                            <div key={index} className={`flex aspect-square min-w-0 flex-col items-center justify-between rounded-xl border-2 bg-gradient-to-br p-1.5 text-center transition-all hover:scale-105 sm:p-3 ${isAchieved ? 'from-yellow-900/40 via-amber-900/30 to-yellow-800/40 border-yellow-500/60 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'from-tertiary/60 via-tertiary/50 to-tertiary/40 border-transparent'}`}>
                                <div className="flex flex-col items-center">
                                    <img src="/images/guild/tokken.webp" alt={t('rewards.guildCoins')} className="w-4 h-4 sm:w-8 sm:h-8 drop-shadow-lg mb-0.5 sm:mb-1"/>
                                    <span className="text-[10px] sm:text-base font-bold text-primary drop-shadow">+{milestone.reward.guildCoins}</span>
                                    <p className="text-[8px] sm:text-xs text-tertiary mt-0.5">{t('checkIn.milestoneCount', { count: milestone.count })}</p>
                                </div>
                                <Button 
                                    onClick={() => { if (canClaim) handleClaimMilestone(index); }} 
                                    disabled={!canClaim} 
                                    colorScheme="none"
                                    className={canClaim ? `${getLuxuryButtonClasses('success')} !text-[8px] sm:!text-xs !py-0.5 sm:!py-1.5 !px-1 sm:!px-2 mt-1 sm:mt-2 w-full` : `${getLuxuryButtonClasses('gray')} !text-[8px] sm:!text-xs !py-0.5 sm:!py-1.5 !px-1 sm:!px-2 mt-1 sm:mt-2 w-full`}
                                >
                                    {isClaimed ? t('checkIn.done') : (isClaiming ? t('checkIn.claiming') : (isAchieved ? t('checkIn.claim') : t('checkIn.notReached')))}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        {guildCoinRewardModal && (
            <div
                className="sudamr-modal-overlay z-[100]"
                onClick={() => setGuildCoinRewardModal(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="guild-checkin-coin-title"
            >
                <div
                    className={`sudamr-modal-panel relative max-w-sm border border-amber-400/35 shadow-[0_0_48px_-16px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/20 ${useMobileChrome ? 'flex flex-col overflow-hidden p-0' : 'p-5 sm:p-6'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {useMobileChrome ? (
                        <MobileModalTitleBar
                            title={t('checkIn.coinEarnedTitle')}
                            titleId="guild-checkin-coin-title"
                            onClose={() => setGuildCoinRewardModal(null)}
                        />
                    ) : (
                    <button
                        type="button"
                        onClick={() => setGuildCoinRewardModal(null)}
                        className={`absolute right-3 top-3 ${SUDAMR_MODAL_CLOSE_BUTTON_CLASS}`}
                        aria-label={t('common:actions.close')}
                    >
                        {t('common:actions.close')}
                    </button>
                    )}
                    <div className={useMobileChrome ? 'p-4 sm:p-6' : undefined}>
                    {!useMobileChrome && (
                    <h2 id="guild-checkin-coin-title" className="text-lg sm:text-xl font-bold text-highlight text-center mb-3 pr-6">
                        {t('checkIn.coinEarnedTitle')}
                    </h2>
                    )}
                    <p className="text-sm text-primary text-center leading-relaxed mb-4">
                        {t('checkIn.coinEarnedBody', {
                            attendeeCount: guildCoinRewardModal.attendeeCount,
                            amount: guildCoinRewardModal.amount.toLocaleString(),
                        })}
                    </p>
                    <div className="flex items-center justify-center gap-2 py-3 mb-4 rounded-lg bg-amber-950/40 border border-amber-600/30">
                        <img src="/images/guild/tokken.webp" alt="" className="w-10 h-10 drop-shadow-md" />
                        <span className="text-2xl font-bold text-yellow-300">+{guildCoinRewardModal.amount.toLocaleString()}</span>
                    </div>
                    <Button
                        onClick={() => setGuildCoinRewardModal(null)}
                        colorScheme="none"
                        className={`${getLuxuryButtonClasses('success')} w-full !py-2 !text-sm`}
                    >
                        {t('common:actions.confirm')}
                    </Button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export const GuildAnnouncementPanel: React.FC<{
    guild: GuildType;
    compact?: boolean;
    stretch?: boolean;
    /** 부길드장 이상: 홈 화면에서 공지 직접 편집 */
    canEdit?: boolean;
}> = ({ guild, compact = false, stretch = false, canEdit = false }) => {
    const { t } = useTranslation(['guild', 'common']);
    const { handlers } = useAppContext();
    const [announcement, setAnnouncement] = useState(guild.announcement || '');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setAnnouncement(guild.announcement || '');
        }
    }, [guild.announcement, isEditing]);

    const handleSave = () => {
        handlers.handleAction({ type: 'GUILD_UPDATE_ANNOUNCEMENT', payload: { guildId: guild.id, announcement } });
        setIsEditing(false);
    };

    return (
        <div
            className={`relative flex flex-col overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 shadow-lg ${
                stretch ? 'h-full min-h-0' : 'h-full'
            } ${compact ? 'p-2' : 'p-4'}`}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10"></div>
            <div
                className={`relative z-10 flex flex-shrink-0 items-center justify-between gap-2 ${
                    compact ? 'mb-1.5' : 'mb-3'
                }`}
            >
                <h3
                    className={`flex items-center font-bold text-highlight drop-shadow-lg ${
                        compact ? 'gap-1 text-sm' : 'gap-2 text-lg'
                    }`}
                >
                    <span className={compact ? 'text-base' : 'text-xl'}>📢</span>
                    <span>{t('management.announcement')}</span>
                </h3>
                {canEdit && (
                    <Button
                        type="button"
                        onClick={() => setIsEditing((prev) => !prev)}
                        colorScheme="none"
                        className={`${getLuxuryButtonClasses('primary')} ${compact ? '!px-2 !py-1 !text-[10px]' : '!px-3 !py-1.5 !text-xs'}`}
                    >
                        {isEditing ? t('common:actions.cancel') : t('management.edit')}
                    </Button>
                )}
            </div>
            <div
                className={`relative z-10 min-h-0 flex-grow overflow-y-auto rounded-lg border-2 border-black/20 bg-tertiary/50 shadow-inner ${
                    compact ? 'p-2 pr-1.5' : 'p-4 pr-2'
                }`}
            >
                {isEditing ? (
                    <div className="flex h-full min-h-0 flex-col gap-2">
                        <textarea
                            value={announcement}
                            onChange={(e) => setAnnouncement(e.target.value)}
                            maxLength={150}
                            className={`min-h-0 w-full flex-1 resize-none rounded-lg border border-stone-600/50 bg-stone-900/80 p-2 text-primary focus:border-accent/50 focus:outline-none ${
                                compact ? 'text-xs leading-snug' : 'text-sm leading-relaxed'
                            }`}
                        />
                        <Button
                            type="button"
                            onClick={handleSave}
                            colorScheme="none"
                            className={`${getLuxuryButtonClasses('green')} w-full ${compact ? '!py-1.5 !text-xs' : '!py-2 !text-sm'}`}
                        >
                            {t('common:actions.save')}
                        </Button>
                    </div>
                ) : (
                    <p className={`whitespace-pre-wrap text-primary leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                        {guild.announcement || <span className="text-tertiary italic">{t('management.noAnnouncement')}</span>}
                    </p>
                )}
            </div>
        </div>
    );
};

export const GuildChat: React.FC<{ guild: GuildType, myMemberInfo: GuildMember | undefined }> = ({ guild, myMemberInfo }) => {
    const { t } = useTranslation(['guild', 'common']);
    const { handlers, allUsers, currentUserWithStatus, waitingRoomChats, isNativeMobile } = useAppContext();
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'guild' | 'global'>('global');
    const [showQuickChat, setShowQuickChat] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const quickChatRef = useRef<HTMLDivElement>(null);
    
    // 전체 채팅 메시지 가져오기
    const globalChatMessages = useMemo(
        () => mergeWaitingRoomPublicChatMessages(waitingRoomChats),
        [waitingRoomChats],
    );

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [guild.chatHistory, globalChatMessages, activeTab]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickChatRef.current && !quickChatRef.current.contains(event.target as Node)) {
                setShowQuickChat(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const isBanned = (currentUserWithStatus?.chatBanUntil ?? 0) > Date.now();
    const banTimeLeft =
        isBanned && currentUserWithStatus?.chatBanUntil
            ? Math.ceil((currentUserWithStatus.chatBanUntil - Date.now()) / 1000 / 60)
            : 0;
    const isInputDisabled = isBanned || cooldown > 0;
    const placeholderText = isBanned
        ? t('homeChat.banPlaceholder', { minutes: banTimeLeft })
        : isInputDisabled
          ? t('homeChat.cooldownPlaceholder', { seconds: cooldown })
          : isNativeMobile
            ? t('homeChat.inputPlaceholder')
            : t('homeChat.messagePlaceholder');

    const handleSend = (payload: { text?: string; emoji?: string }) => {
        if (cooldown > 0) return;
        if (activeTab === 'guild') {
            if (payload.text) {
                handlers.handleAction({ type: 'SEND_GUILD_CHAT_MESSAGE', payload: { content: payload.text } });
            }
        } else {
            if (payload.text) {
                handlers.handleAction({ type: 'SEND_CHAT_MESSAGE', payload: { channel: 'global', text: payload.text, location: t('homeChat.locationHome') } });
            } else if (payload.emoji) {
                handlers.handleAction({ type: 'SEND_CHAT_MESSAGE', payload: { channel: 'global', emoji: payload.emoji, location: t('homeChat.locationHome') } });
            }
        }
        setShowQuickChat(false);
        setMessage('');
        setCooldown(5);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || isInputDisabled) return;
        if (containsProfanity(message)) {
            alert(t('homeChat.inappropriateWord'));
            setMessage('');
            return;
        }
        handleSend({ text: message });
    };

    const handleDelete = (msg: ChatMessage) => {
        if (window.confirm(t('homeChat.deleteConfirm'))) {
            handlers.handleAction({ 
                type: 'GUILD_DELETE_CHAT_MESSAGE', 
                payload: { 
                    messageId: msg.id, 
                    timestamp: msg.timestamp 
                } 
            });
        }
    };

    const msgClass = isNativeMobile ? 'text-sm leading-snug' : 'text-base leading-snug';
    const emptyClass = isNativeMobile ? 'text-sm leading-snug' : 'text-base';

    const handleChatUserClick = (userId: string) => {
        if (userId !== currentUserWithStatus?.id) {
            handlers.openViewingUser(userId);
        }
    };

    const activeMessages = activeTab === 'global'
        ? globalChatMessages
        : (guild.chatHistory ?? []).map((msg) => guildChatHistoryEntryToChatMessage(msg, allUsers));

    return (
        <div
            className={`relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 shadow-lg ${
                isNativeMobile ? 'px-2 py-2 sm:p-4' : 'p-4'
            }`}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div
                className={`flex flex-shrink-0 rounded-lg bg-gray-900/70 relative z-10 ${isNativeMobile ? 'mb-1 p-0.5' : 'mb-3 p-1'}`}
            >
                <button
                    onClick={() => setActiveTab('global')}
                    className={`flex-1 rounded-md font-semibold ${isNativeMobile ? 'py-1 text-[12px]' : 'py-1.5 text-sm'} ${activeTab === 'global' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                    {t('homeChat.globalTab')}
                </button>
                <button
                    onClick={() => setActiveTab('guild')}
                    className={`flex-1 rounded-md font-semibold ${isNativeMobile ? 'py-1 text-[12px]' : 'py-1.5 text-sm'} ${activeTab === 'guild' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                    {t('homeChat.guildTab')}
                </button>
            </div>
            {isNativeMobile && activeTab === 'global' && (
                <p className="relative z-10 mb-0.5 rounded-sm bg-tertiary/50 p-0.5 text-center text-[10px] leading-tight text-yellow-400">
                    {t('homeChat.securityBanner')}
                </p>
            )}
            <div
                ref={chatBodyRef}
                className={`relative z-10 min-h-0 flex-grow overflow-y-auto rounded-lg border-2 border-black/20 bg-tertiary/50 shadow-inner ${isNativeMobile ? 'mb-1 space-y-0.5 p-1 pr-1' : 'mb-3 space-y-0.5 p-2 pr-2'}`}
            >
                {activeMessages.length > 0 ? (
                    activeMessages.map((msg) => {
                        const senderId = msg.user.id;
                        const isMyMessage = senderId === currentUserWithStatus?.id;
                        const canManage = myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';
                        const canDelete = activeTab === 'guild' && (isMyMessage || canManage) && !msg.system && msg.id;

                        return (
                            <ChatInlineMessageRow
                                key={msg.id}
                                message={msg}
                                rowClassName={msgClass}
                                onUserClick={handleChatUserClick}
                                onViewUser={handlers.openViewingUser}
                                allUsers={allUsers}
                                currentUserId={currentUserWithStatus?.id}
                                onOpenViewingItem={(item, isOwn) => handlers.openViewingItem(item, isOwn)}
                                suffix={
                                    canDelete ? (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(msg)}
                                            className="ml-2 align-middle text-xs font-semibold text-red-400 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                                            aria-label={t('homeChat.deleteMessage')}
                                            title={t('homeChat.deleteMessage')}
                                        >
                                            {t('common:actions.delete')}
                                        </button>
                                    ) : undefined
                                }
                            />
                        );
                    })
                ) : (
                    <div className={`flex h-full items-center justify-center text-tertiary ${emptyClass}`}>
                        <p className="italic">
                            {activeTab === 'guild' ? t('homeChat.noGuildMessages') : t('homeChat.noGlobalMessages')}
                        </p>
                    </div>
                )}
            </div>
            <div className="relative flex-shrink-0">
                {showQuickChat && (
                    <div ref={quickChatRef} className="absolute bottom-full z-10 mb-2 max-h-64 w-full overflow-y-auto rounded-lg bg-secondary p-1 shadow-xl">
                        <div className="mb-1 grid grid-cols-5 gap-1 border-b border-color pb-1 text-xl">
                            {GAME_CHAT_EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                        if (isInputDisabled) return;
                                        if (activeTab === 'guild') return;
                                        handleSend({ emoji });
                                    }}
                                    disabled={isInputDisabled || activeTab === 'guild'}
                                    className="w-full rounded-md p-1 text-center transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <ul className="space-y-0.5">
                            {GAME_CHAT_MESSAGES.map((msg) => (
                                <li key={msg}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isInputDisabled) return;
                                            if (containsProfanity(msg)) {
                                                alert(t('homeChat.inappropriateWord'));
                                                return;
                                            }
                                            handleSend({ text: msg });
                                        }}
                                        disabled={isInputDisabled}
                                        className="w-full rounded-md p-1 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {msg}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {isNativeMobile ? (
                    <form onSubmit={handleSubmit} className="relative z-10 flex flex-shrink-0 gap-1">
                        <button
                            type="button"
                            onClick={() => setShowQuickChat((s) => !s)}
                            className="flex items-center justify-center rounded-md bg-secondary px-2.5 text-lg font-bold text-primary transition-colors hover:bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
                            title={t('homeChat.quickChat')}
                            disabled={isInputDisabled}
                        >
                            <span>🙂</span>
                        </button>
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={placeholderText}
                            className="min-w-0 flex-grow rounded-md border border-color bg-tertiary p-1 text-[11px] focus:border-accent focus:ring-accent disabled:bg-secondary disabled:text-tertiary"
                            maxLength={30}
                            disabled={isInputDisabled}
                        />
                        <Button type="submit" disabled={!message.trim() || isInputDisabled} className="!px-2 !py-1" title={t('homeChat.sendTitle')}>
                            💬
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="relative z-10 flex flex-shrink-0 gap-3">
                        <button
                            type="button"
                            onClick={() => setShowQuickChat(!showQuickChat)}
                            className="flex items-center justify-center rounded-lg border-2 border-black/30 bg-tertiary/80 px-3 py-2 transition-colors hover:bg-tertiary"
                            title={t('homeChat.quickChat')}
                            disabled={isInputDisabled}
                        >
                            <span className="text-xl">😊</span>
                        </button>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={placeholderText}
                            className="min-w-0 flex-grow resize-none rounded-lg border-2 border-black/30 bg-tertiary/80 p-3 text-sm shadow-inner transition-all focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:bg-secondary disabled:text-tertiary"
                            rows={1}
                            maxLength={200}
                            disabled={isInputDisabled}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <Button type="submit" colorScheme="none" disabled={!message.trim() || isInputDisabled} className={getLuxuryButtonClasses('primary')}>
                            {t('chat.send')}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};

interface GuildHomePanelProps {
    guild: GuildType;
    myMemberInfo: GuildMember | undefined;
    /** 데스크톱에서 채팅 우측에 배치할 패널 (채팅 50% + 이 패널 50%) */
    rightOfChat?: React.ReactNode;
}

const GuildHomePanel: React.FC<GuildHomePanelProps> = ({ guild, myMemberInfo, rightOfChat }) => {
    const isMobile = false;

    return (
        <div className="flex h-full flex-col gap-2">
            {isMobile ? (
                <>
                    {/* 모바일: 출석부와 공지를 가로로 압축 배치 (PC 버전 압축) */}
                    <div className="flex gap-4 flex-1 min-h-0">
                        <div className="flex-1 min-h-0">
                            <GuildCheckInPanel guild={guild} />
                        </div>
                        <div className="flex-1 min-h-0">
                            <GuildAnnouncementPanel guild={guild} />
                        </div>
                    </div>
                    {/* 모바일: 채팅창 */}
                    <div className="flex-1 min-h-0" data-guild-chat>
                        <GuildChat guild={guild} myMemberInfo={myMemberInfo} />
                    </div>
                </>
            ) : (
                <>
                    <div className="grid flex-shrink-0 grid-cols-2 gap-2">
                        <GuildCheckInPanel guild={guild} />
                        <GuildAnnouncementPanel guild={guild} />
                    </div>
                    <div className="flex min-h-0 flex-grow gap-2" data-guild-chat>
                        <div className={rightOfChat ? 'flex-1 min-w-0' : 'w-full'}>
                            <GuildChat guild={guild} myMemberInfo={myMemberInfo} />
                        </div>
                        {rightOfChat && <div className="flex-1 min-w-0 flex flex-col">{rightOfChat}</div>}
                    </div>
                </>
            )}
        </div>
    );
};

export default GuildHomePanel;
