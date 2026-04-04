import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Guild as GuildType, ChatMessage, GuildMemberRole, GuildMember } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import { GUILD_CHECK_IN_MILESTONE_REWARDS } from '../../constants/index.js';
import { isSameDayKST, formatDateTimeKST, getTodayKSTDateString } from '../../utils/timeUtils.js';
import Avatar from '../Avatar.js';

const ensureTimestamp = (v: number | string | undefined): number =>
    typeof v === 'number' ? v : new Date((v as string) || 0).getTime();
import { AVATAR_POOL, BORDER_POOL } from '../../constants/index.js';
import { GAME_CHAT_MESSAGES, GAME_CHAT_EMOJIS, ADMIN_USER_ID, ADMIN_NICKNAME } from '../../constants/index.js';
import { containsProfanity } from '../../profanity.js';

// 고급 버튼 스타일 함수
const luxuryButtonBase = "relative overflow-hidden whitespace-normal break-keep text-sm px-4 py-2 rounded-xl backdrop-blur-sm font-semibold tracking-wide transition-all duration-200 flex items-center justify-center gap-1";

const getLuxuryButtonClasses = (variant: 'primary' | 'danger' | 'neutral' | 'accent' | 'success' | 'green' | 'gray' = 'primary') => {
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

export const GuildCheckInPanel: React.FC<{ guild: GuildType }> = ({ guild }) => {
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
        <div className="bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 p-2 sm:p-4 rounded-xl flex flex-col h-full border-2 border-stone-600/60 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col h-full min-h-0">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h3 className="font-bold text-sm sm:text-lg text-highlight drop-shadow-lg flex items-center gap-1 sm:gap-2">
                        <span className="text-base sm:text-xl">📅</span>
                        <span className="whitespace-nowrap">길드 출석부</span>
                    </h3>
                    <Button 
                        onClick={handleCheckIn} 
                        disabled={hasCheckedInToday} 
                        colorScheme="none"
                        className={`${hasCheckedInToday ? getLuxuryButtonClasses('gray') : getLuxuryButtonClasses('green')} !text-xs sm:!text-sm !py-1 sm:!py-2 !px-2 sm:!px-4`}
                    >
                        {hasCheckedInToday ? '출석 완료' : '출석하기'}
                    </Button>
                </div>
                <p className="text-xs sm:text-sm text-tertiary mb-2 flex-shrink-0">
                    오늘 출석: <span className="font-bold text-primary text-sm sm:text-base">{todaysCheckIns} / {totalMembers}</span>명
                </p>
                <div className="my-2 relative z-10 flex-shrink-0">
                    <div className="w-full bg-tertiary/60 rounded-full h-2 sm:h-3 relative border-2 border-black/30 shadow-inner backdrop-blur-sm">
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
                                    title={`${milestone.count}명 보상`}
                                >
                                    <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] text-yellow-300 font-bold whitespace-nowrap drop-shadow-lg bg-black/40 px-1 rounded">
                                        {milestone.count}명
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
                            <div key={index} className={`bg-gradient-to-br ${isAchieved ? 'from-yellow-900/40 via-amber-900/30 to-yellow-800/40' : 'from-tertiary/60 via-tertiary/50 to-tertiary/40'} p-1.5 sm:p-3 rounded-xl text-center flex flex-col items-center justify-between border-2 ${isAchieved ? 'border-yellow-500/60 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'border-transparent'} min-w-0 aspect-square backdrop-blur-sm transition-all hover:scale-105`}>
                                <div className="flex flex-col items-center">
                                    <img src="/images/guild/tokken.png" alt="길드 코인" className="w-4 h-4 sm:w-8 sm:h-8 drop-shadow-lg mb-0.5 sm:mb-1"/>
                                    <span className="text-[10px] sm:text-base font-bold text-primary drop-shadow">+{milestone.reward.guildCoins}</span>
                                    <p className="text-[8px] sm:text-xs text-tertiary mt-0.5">{milestone.count}명</p>
                                </div>
                                <Button 
                                    onClick={() => { if (canClaim) handleClaimMilestone(index); }} 
                                    disabled={!canClaim} 
                                    colorScheme="none"
                                    className={canClaim ? `${getLuxuryButtonClasses('success')} !text-[8px] sm:!text-xs !py-0.5 sm:!py-1.5 !px-1 sm:!px-2 mt-1 sm:mt-2 w-full` : `${getLuxuryButtonClasses('gray')} !text-[8px] sm:!text-xs !py-0.5 sm:!py-1.5 !px-1 sm:!px-2 mt-1 sm:mt-2 w-full`}
                                >
                                    {isClaimed ? '완료' : (isClaiming ? '처리중' : (isAchieved ? '받기' : '미달성'))}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        {guildCoinRewardModal && (
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                onClick={() => setGuildCoinRewardModal(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="guild-checkin-coin-title"
            >
                <div
                    className="bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 rounded-xl border-2 border-amber-500/55 shadow-2xl max-w-sm w-full p-5 sm:p-6 relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => setGuildCoinRewardModal(null)}
                        className="absolute top-3 right-3 text-tertiary hover:text-primary transition-colors text-2xl font-bold leading-none"
                        aria-label="닫기"
                    >
                        ×
                    </button>
                    <h2 id="guild-checkin-coin-title" className="text-lg sm:text-xl font-bold text-highlight text-center mb-3 pr-6">
                        길드 코인 획득
                    </h2>
                    <p className="text-sm text-primary text-center leading-relaxed mb-4">
                        오늘 출석 인원 <span className="font-bold text-amber-300">{guildCoinRewardModal.attendeeCount}명</span> 달성 보상으로 길드 코인{' '}
                        <span className="font-bold text-yellow-300">{guildCoinRewardModal.amount.toLocaleString()}개</span>를 받았습니다.
                    </p>
                    <div className="flex items-center justify-center gap-2 py-3 mb-4 rounded-lg bg-amber-950/40 border border-amber-600/30">
                        <img src="/images/guild/tokken.png" alt="" className="w-10 h-10 drop-shadow-md" />
                        <span className="text-2xl font-bold text-yellow-300">+{guildCoinRewardModal.amount.toLocaleString()}</span>
                    </div>
                    <Button
                        onClick={() => setGuildCoinRewardModal(null)}
                        colorScheme="none"
                        className={`${getLuxuryButtonClasses('success')} w-full !py-2 !text-sm`}
                    >
                        확인
                    </Button>
                </div>
            </div>
        )}
        </>
    );
};

export const GuildAnnouncementPanel: React.FC<{ guild: GuildType; compact?: boolean }> = ({ guild, compact = false }) => (
    <div
        className={`relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 shadow-2xl backdrop-blur-md ${
            compact ? 'p-2' : 'p-4'
        }`}
    >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10"></div>
        <h3
            className={`relative z-10 flex flex-shrink-0 items-center font-bold text-highlight drop-shadow-lg ${
                compact ? 'mb-1.5 gap-1 text-sm' : 'mb-3 gap-2 text-lg'
            }`}
        >
            <span className={compact ? 'text-base' : 'text-xl'}>📢</span>
            <span>길드 공지</span>
        </h3>
        <div
            className={`relative z-10 min-h-0 flex-grow overflow-y-auto rounded-lg border-2 border-black/20 bg-tertiary/50 shadow-inner backdrop-blur-sm ${
                compact ? 'p-2 pr-1.5' : 'p-4 pr-2'
            }`}
        >
            <p className={`whitespace-pre-wrap text-primary leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                {guild.announcement || <span className="text-tertiary italic">등록된 공지사항이 없습니다.</span>}
            </p>
        </div>
    </div>
);

export const GuildChat: React.FC<{ guild: GuildType, myMemberInfo: GuildMember | undefined }> = ({ guild, myMemberInfo }) => {
    const { handlers, allUsers, currentUserWithStatus, waitingRoomChats, isNativeMobile } = useAppContext();
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'guild' | 'global'>('global');
    const [showQuickChat, setShowQuickChat] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const quickChatRef = useRef<HTMLDivElement>(null);
    const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);
    
    // 전체 채팅 메시지 가져오기
    const globalChatMessages = waitingRoomChats['global'] || [];

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
        ? `채팅 금지 중 (${banTimeLeft}분 남음)`
        : isInputDisabled
          ? `(${cooldown}초)`
          : isNativeMobile
            ? '[메시지 입력]'
            : '메시지를 입력하세요...';

    const handleSend = (payload: { text?: string; emoji?: string }) => {
        if (cooldown > 0) return;
        if (activeTab === 'guild') {
            if (payload.text) {
                handlers.handleAction({ type: 'SEND_GUILD_CHAT_MESSAGE', payload: { content: payload.text } });
            }
        } else {
            if (payload.text) {
                handlers.handleAction({ type: 'SEND_CHAT_MESSAGE', payload: { channel: 'global', text: payload.text, location: '[홈]' } });
            } else if (payload.emoji) {
                handlers.handleAction({ type: 'SEND_CHAT_MESSAGE', payload: { channel: 'global', emoji: payload.emoji, location: '[홈]' } });
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
            alert('부적절한 단어가 포함되어 있어 메시지를 전송할 수 없습니다.');
            setMessage('');
            return;
        }
        handleSend({ text: message });
    };

    const handleDelete = (msg: ChatMessage) => {
        if (window.confirm('메시지를 삭제하시겠습니까?')) {
            handlers.handleAction({ 
                type: 'GUILD_DELETE_CHAT_MESSAGE', 
                payload: { 
                    messageId: msg.id, 
                    timestamp: msg.timestamp 
                } 
            });
        }
    };

    return (
        <div
            className={`bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 rounded-xl h-full flex flex-col border-2 border-stone-600/60 shadow-2xl backdrop-blur-md relative overflow-hidden ${
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
                    전체채팅
                </button>
                <button
                    onClick={() => setActiveTab('guild')}
                    className={`flex-1 rounded-md font-semibold ${isNativeMobile ? 'py-1 text-[12px]' : 'py-1.5 text-sm'} ${activeTab === 'guild' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                    길드채팅
                </button>
            </div>
            {isNativeMobile && activeTab === 'global' && (
                <p className="relative z-10 mb-0.5 rounded-sm bg-tertiary/50 p-0.5 text-center text-[10px] leading-tight text-yellow-400">
                    AI 보안관봇이 부적절한 언어 사용을 감지하고 있습니다. 🚓
                </p>
            )}
            <div
                ref={chatBodyRef}
                className={`relative z-10 min-h-0 flex-grow overflow-y-auto rounded-lg bg-tertiary/50 ${isNativeMobile ? 'mb-1 space-y-0.5 p-1 pr-1' : 'mb-3 space-y-3 p-4 pr-2'} border-2 border-black/20 shadow-inner backdrop-blur-sm`}
            >
                {activeTab === 'global' ? (
                    // 전체 채팅 메시지 표시 (길드채팅과 동일한 형태)
                    globalChatMessages.length > 0 ? (
                        globalChatMessages.map((msg: any) => {
                            const senderId = msg.user?.id;
                            const sender = senderId ? userMap.get(senderId) : undefined;
                            const isSystem = msg.system || senderId === 'system';
                            const isBotMessage = isSystem && msg.user?.nickname === 'AI 보안관봇';
                            const displayName = isSystem ? (isBotMessage ? 'AI 보안관봇' : '시스템') : (msg.user?.nickname || (senderId === ADMIN_USER_ID || sender?.isAdmin ? ADMIN_NICKNAME : sender?.nickname) || 'Unknown');
                            const avatarUrl = sender ? AVATAR_POOL.find(a => a.id === sender.avatarId)?.url : undefined;
                            const borderUrl = sender ? BORDER_POOL.find(b => b.id === sender.borderId)?.url : undefined;
                            return (
                                <div key={msg.id} className="flex items-start gap-3 group p-2 rounded-lg hover:bg-black/10 transition-colors">
                                    <div className="flex-shrink-0 mt-1">
                                        <Avatar userId={senderId ?? ''} userName={displayName} avatarUrl={avatarUrl} borderUrl={borderUrl} size={36} />
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-baseline gap-2">
                                                <span className={`font-semibold text-sm ${
                                                    isSystem ? 'text-blue-400' : 'text-blue-300'
                                                }`}>
                                                    {displayName}
                                                </span>
                                                <span className="text-xs text-tertiary">{formatDateTimeKST(ensureTimestamp(msg.timestamp ?? msg.createdAt))}</span>
                                            </div>
                                        </div>
                                        <p className={`text-sm break-words whitespace-pre-wrap leading-relaxed ${
                                            isSystem ? 'text-blue-300' : 'text-blue-300'
                                        }`}>{msg.text || msg.content || ''}</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-full flex items-center justify-center text-tertiary"><p className="italic">전체 채팅 메시지가 없습니다.</p></div>
                    )
                ) : activeTab === 'guild' ? (
                    // 길드 채팅 메시지 표시 (파란색)
                    guild.chatHistory && guild.chatHistory.length > 0 ? (
                    guild.chatHistory.map(msg => {
                        const senderId = msg.user?.id || msg.authorId;
                        const sender = senderId ? userMap.get(senderId) : undefined;
                        const guildMemberSender = senderId ? guild.members?.find(m => m.userId === senderId) : undefined;
                        const displayName = senderId === 'system' ? '시스템' : (msg.user?.nickname || sender?.nickname || guildMemberSender?.nickname || (senderId === ADMIN_USER_ID ? ADMIN_NICKNAME : 'Unknown'));
                        const avatarUrl = sender ? AVATAR_POOL.find(a => a.id === sender.avatarId)?.url : undefined;
                        const borderUrl = sender ? BORDER_POOL.find(b => b.id === sender.borderId)?.url : undefined;
                        const isMyMessage = senderId === currentUserWithStatus?.id;
                        const canManage = myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';

                        return (
                            <div key={msg.id || msg.timestamp || msg.createdAt} className="flex items-start gap-3 group p-2 rounded-lg hover:bg-black/10 transition-colors">
                                <div className="flex-shrink-0 mt-1">
                                    {(sender || displayName !== 'Unknown') && <Avatar userId={sender?.id ?? senderId ?? ''} userName={displayName} avatarUrl={avatarUrl} borderUrl={borderUrl} size={36} />}
                                </div>
                                <div className="flex-grow">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className={`font-semibold text-sm ${
                                                senderId === 'system' 
                                                    ? 'text-blue-400' 
                                                    : 'text-blue-300'
                                            }`}>
                                                {displayName}
                                            </span>
                                            <span className="text-xs text-tertiary">{formatDateTimeKST(ensureTimestamp(msg.timestamp ?? msg.createdAt))}</span>
                                        </div>
                                        {(isMyMessage || canManage) && !msg.system && msg.id && (
                                            <button onClick={() => handleDelete(msg as ChatMessage)} className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-semibold px-2 py-1 rounded hover:bg-red-500/20" aria-label="Delete message" title="메시지 삭제">삭제</button>
                                        )}
                                    </div>
                                    <p className={`text-sm break-words whitespace-pre-wrap leading-relaxed ${
                                        msg.authorId === 'system' || senderId === 'system' 
                                            ? 'text-blue-300' 
                                            : 'text-blue-300'
                                    }`}>{msg.text || msg.content || ''}</p>
                                </div>
                            </div>
                        );
                    })
                    ) : (
                        <div className="h-full flex items-center justify-center text-tertiary"><p className="italic">길드 채팅 메시지가 없습니다.</p></div>
                    )
                ) : null}
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
                                                alert('부적절한 단어가 포함되어 있어 메시지를 전송할 수 없습니다.');
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
                            title="빠른 채팅"
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
                        <Button type="submit" disabled={!message.trim() || isInputDisabled} className="!px-2 !py-1" title="보내기">
                            💬
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="relative z-10 flex flex-shrink-0 gap-3">
                        <button
                            type="button"
                            onClick={() => setShowQuickChat(!showQuickChat)}
                            className="flex items-center justify-center rounded-lg border-2 border-black/30 bg-tertiary/80 px-3 py-2 transition-colors hover:bg-tertiary"
                            title="빠른 채팅"
                            disabled={isInputDisabled}
                        >
                            <span className="text-xl">😊</span>
                        </button>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={placeholderText}
                            className="min-w-0 flex-grow resize-none rounded-lg border-2 border-black/30 bg-tertiary/80 p-3 text-sm shadow-inner backdrop-blur-sm transition-all focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:bg-secondary disabled:text-tertiary"
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
                            전송
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
