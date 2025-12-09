import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Guild as GuildType, UserWithStatus, GuildBossInfo, QuestReward, GuildMember, GuildMemberRole, CoreStat, GuildResearchId, GuildResearchCategory, ItemGrade, ServerAction, GuildBossSkill } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import GuildHomePanel, { GuildChat, GuildCheckInPanel, GuildAnnouncementPanel } from './GuildHomePanel.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, AVATAR_POOL, BORDER_POOL, emptySlotImages, slotNames, GUILD_BOSS_MAX_ATTEMPTS, GUILD_INITIAL_MEMBER_LIMIT, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_GOLD_COST, GUILD_DONATION_DIAMOND_COST, GUILD_CHECK_IN_MILESTONE_REWARDS, GUILD_DONATION_GOLD_REWARDS, GUILD_DONATION_DIAMOND_REWARDS } from '../../constants/index.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import NineSlicePanel from '../ui/NineSlicePanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import HelpModal from '../HelpModal.js';
import GuildWarRewardModal from './GuildWarRewardModal.js';
import GuildWarMatchingModal from './GuildWarMatchingModal.js';
import { getTimeUntilNextMondayKST, isSameDayKST, isDifferentWeekKST } from '../../utils/timeUtils.js';

// 길드 아이콘 경로 수정 함수
const getGuildIconPath = (icon: string | undefined): string => {
    if (!icon) return '/images/guild/profile/icon1.png';
    // 기존 경로가 /images/guild/icon으로 시작하면 /images/guild/profile/icon으로 변환
    if (icon.startsWith('/images/guild/icon')) {
        return icon.replace('/images/guild/icon', '/images/guild/profile/icon');
    }
    // 이미 올바른 경로이거나 다른 경로인 경우 그대로 반환
    return icon;
};

const GuildDonationPanel: React.FC<{ guildDonationAnimation: { coins: number; research: number; type: 'gold' | 'diamond' } | null; onDonationComplete?: (coins: number, research: number, type: 'gold' | 'diamond') => void; goldButtonRef: React.RefObject<HTMLDivElement>; diamondButtonRef: React.RefObject<HTMLDivElement> }> = ({ guildDonationAnimation, onDonationComplete, goldButtonRef, diamondButtonRef }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    const [isDonating, setIsDonating] = useState(false);
    const [donationType, setDonationType] = useState<'gold' | 'diamond' | null>(null);
    const donationInFlight = useRef(false);
    const now = Date.now();
    const dailyDonations = (currentUserWithStatus?.dailyDonations && isSameDayKST(currentUserWithStatus.dailyDonations.date, now))
        ? currentUserWithStatus.dailyDonations
        : { gold: 0, diamond: 0, date: now };

    const goldDonationsLeft = GUILD_DONATION_GOLD_LIMIT - dailyDonations.gold;
    const diamondDonationsLeft = GUILD_DONATION_DIAMOND_LIMIT - dailyDonations.diamond;

    const canDonateGold = goldDonationsLeft > 0 && (currentUserWithStatus?.gold ?? 0) >= GUILD_DONATION_GOLD_COST;
    const canDonateDiamond = diamondDonationsLeft > 0 && (currentUserWithStatus?.diamonds ?? 0) >= GUILD_DONATION_DIAMOND_COST;

    const handleDonate = async (type: 'GUILD_DONATE_GOLD' | 'GUILD_DONATE_DIAMOND') => {
        console.log('handleDonate called', type);
        if (donationInFlight.current) return;
        donationInFlight.current = true;
        setIsDonating(true);
        setDonationType(type === 'GUILD_DONATE_GOLD' ? 'gold' : 'diamond');
        try {
            const result = await handlers.handleAction({ type }) as any;
            console.log('[GuildDonationPanel] Donation result:', result);
            console.log('[GuildDonationPanel] result.clientResponse:', result?.clientResponse);
            console.log('[GuildDonationPanel] result.donationResult:', result?.donationResult);
            console.log('[GuildDonationPanel] result.clientResponse?.donationResult:', result?.clientResponse?.donationResult);
            
            if (result?.error) {
                console.error('[GuildDonationPanel] Donation failed:', result.error);
                alert(result.error);
                setDonationType(null);
            } else {
                // donationResult는 clientResponse 안에 있거나 직접 result에 있을 수 있음
                const donationResult = result?.clientResponse?.donationResult || result?.donationResult;
                if (donationResult) {
                    const { coins, research } = donationResult;
                    console.log('[GuildDonationPanel] Donation success:', { coins, research });
                    // 매번 애니메이션 발동
                    if (onDonationComplete) {
                        onDonationComplete(coins, research, type === 'GUILD_DONATE_GOLD' ? 'gold' : 'diamond');
                    }
                } else {
                    // donationResult가 없어도 기본값으로 애니메이션 발동 (서버에서 항상 반환해야 하지만 방어적 코드)
                    const defaultCoins = type === 'GUILD_DONATE_GOLD' 
                        ? GUILD_DONATION_GOLD_REWARDS.guildCoins[0] 
                        : GUILD_DONATION_DIAMOND_REWARDS.guildCoins[0];
                    const defaultResearch = type === 'GUILD_DONATE_GOLD'
                        ? GUILD_DONATION_GOLD_REWARDS.researchPoints[0]
                        : GUILD_DONATION_DIAMOND_REWARDS.researchPoints[0];
                    console.warn('[GuildDonationPanel] No donationResult in response, using defaults. Result:', result);
                    if (onDonationComplete) {
                        onDonationComplete(defaultCoins, defaultResearch, type === 'GUILD_DONATE_GOLD' ? 'gold' : 'diamond');
                    }
                }
                // 성공 시 길드 정보를 다시 가져옴
                await handlers.handleAction({ type: 'GET_GUILD_INFO' });
            }
        } catch(error) {
            console.error("Donation failed:", error);
            alert('기부 중 오류가 발생했습니다.');
            setDonationType(null);
        } finally {
            setIsDonating(false);
            donationInFlight.current = false;
        }
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    return (
        <div className="bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 p-3 rounded-xl flex flex-col relative overflow-hidden border-2 border-stone-600/60 shadow-2xl backdrop-blur-md flex-shrink-0" style={{ minHeight: '120px' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none rounded-xl"></div>
            <h3 className="font-bold text-base text-highlight mb-2 text-center relative z-10 flex items-center justify-center gap-2 drop-shadow-lg flex-shrink-0">
                <span className="text-lg">💎</span>
                <span>길드 기부</span>
            </h3>
            
            {/* 보상 정보 + 버튼 배치 - 한 줄로 */}
            <div className={`flex ${isMobile ? 'gap-1.5' : 'gap-3'} relative z-10 items-center min-w-0`}>
                {/* 골드 기부 */}
                <div className="flex-1 flex items-center min-w-0" style={{ gap: isMobile ? '0.25rem' : '0.5rem' }}>
                    <div className={`bg-gradient-to-br from-amber-900/40 to-amber-800/30 rounded-lg ${isMobile ? 'p-1' : 'p-2'} border border-amber-600/30 flex items-center gap-1 flex-shrink-0 overflow-hidden`} style={{ minHeight: '60px', height: '60px' }}>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-amber-200 font-semibold whitespace-nowrap`}>골드 기부</div>
                            <div className="flex items-center gap-1 min-w-0">
                                <img src="/images/guild/tokken.png" alt="길드코인" className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
                                <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-amber-100 font-bold truncate`}>{GUILD_DONATION_GOLD_REWARDS.guildCoins[0]}~{GUILD_DONATION_GOLD_REWARDS.guildCoins[1]}</span>
                            </div>
                            <div className="flex items-center gap-1 min-w-0">
                                <img src="/images/guild/button/guildlab.png" alt="연구포인트" className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
                                <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-amber-100 font-bold truncate`}>{GUILD_DONATION_GOLD_REWARDS.researchPoints[0]}~{GUILD_DONATION_GOLD_REWARDS.researchPoints[1]} RP</span>
                            </div>
                        </div>
                    </div>
                    <div ref={goldButtonRef} className="flex-1 relative overflow-hidden min-w-0">
                        <Button 
                            onClick={() => handleDonate('GUILD_DONATE_GOLD')}
                            disabled={!canDonateGold || isDonating}
                            colorScheme="none"
                            className={`w-full h-full justify-center rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 font-semibold tracking-wide shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500 ${!canDonateGold || isDonating ? 'opacity-50 cursor-not-allowed' : ''} ${isMobile ? '!text-xs' : ''}`}
                            style={{ minHeight: '60px', height: '60px' }}
                        >
                            <div className={`flex items-center justify-center ${isMobile ? 'gap-1' : 'gap-2'} min-w-0`}>
                                {isDonating ? (
                                    <>
                                        <span className={`${isMobile ? 'text-xs' : 'text-sm'} animate-spin`}>⏳</span>
                                        <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>기부 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <img src="/images/icon/Gold.png" alt="골드" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} drop-shadow-md flex-shrink-0`} />
                                        <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold truncate`}>{GUILD_DONATION_GOLD_COST.toLocaleString()}</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-slate-700/90 font-semibold whitespace-nowrap`}>
                                            ({goldDonationsLeft}/{GUILD_DONATION_GOLD_LIMIT})
                                        </span>
                                    </>
                                )}
                            </div>
                        </Button>
                    </div>
                </div>

                {/* 다이아 기부 */}
                <div className="flex-1 flex items-center min-w-0" style={{ gap: isMobile ? '0.25rem' : '0.5rem' }}>
                    <div className={`bg-gradient-to-br from-blue-900/40 to-indigo-800/30 rounded-lg ${isMobile ? 'p-1' : 'p-2'} border border-blue-600/30 flex items-center gap-1 flex-shrink-0 overflow-hidden`} style={{ minHeight: '60px', height: '60px' }}>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-blue-200 font-semibold whitespace-nowrap`}>다이아 기부</div>
                            <div className="flex items-center gap-1 min-w-0">
                                <img src="/images/guild/tokken.png" alt="길드코인" className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
                                <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-blue-100 font-bold truncate`}>{GUILD_DONATION_DIAMOND_REWARDS.guildCoins[0]}~{GUILD_DONATION_DIAMOND_REWARDS.guildCoins[1]}</span>
                            </div>
                            <div className="flex items-center gap-1 min-w-0">
                                <img src="/images/guild/button/guildlab.png" alt="연구포인트" className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
                                <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-blue-100 font-bold truncate`}>{GUILD_DONATION_DIAMOND_REWARDS.researchPoints[0]}~{GUILD_DONATION_DIAMOND_REWARDS.researchPoints[1]} RP</span>
                            </div>
                        </div>
                    </div>
                    <div ref={diamondButtonRef} className="flex-1 relative overflow-hidden min-w-0">
                        <Button
                            onClick={() => handleDonate('GUILD_DONATE_DIAMOND')}
                            disabled={!canDonateDiamond || isDonating}
                            colorScheme="none"
                            className={`w-full h-full justify-center rounded-xl border border-sky-400/50 bg-gradient-to-r from-sky-400/90 via-blue-500/90 to-indigo-500/90 text-white font-semibold tracking-wide shadow-[0_12px_32px_-18px_rgba(56,189,248,0.85)] hover:from-sky-300 hover:to-indigo-500 ${!canDonateDiamond || isDonating ? 'opacity-50 cursor-not-allowed' : ''} ${isMobile ? '!text-xs' : ''}`}
                            style={{ minHeight: '60px', height: '60px' }}
                        >
                            <div className={`flex items-center justify-center ${isMobile ? 'gap-1' : 'gap-2'} min-w-0`}>
                                {isDonating ? (
                                    <>
                                        <span className={`${isMobile ? 'text-xs' : 'text-sm'} animate-spin`}>⏳</span>
                                        <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>기부 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <img src="/images/icon/Zem.png" alt="다이아" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} drop-shadow-md flex-shrink-0`} />
                                        <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold truncate`}>{GUILD_DONATION_DIAMOND_COST.toLocaleString()}</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/90 font-semibold whitespace-nowrap`}>
                                            ({diamondDonationsLeft}/{GUILD_DONATION_DIAMOND_LIMIT})
                                        </span>
                                    </>
                                )}
                            </div>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ActivityPanel: React.FC<{ onOpenMissions: () => void; onOpenResearch: () => void; onOpenShop: () => void; missionNotification: boolean; onOpenBossGuide: () => void; }> = ({ onOpenMissions, onOpenResearch, onOpenShop, missionNotification, onOpenBossGuide }) => {
    const activities = [
        { name: '길드 미션', icon: '/images/guild/button/guildmission.png', action: onOpenMissions, notification: missionNotification },
        { name: '길드 연구소', icon: '/images/guild/button/guildlab.png', action: onOpenResearch },
        { name: '길드 상점', icon: '/images/guild/button/guildstore.png', action: onOpenShop },
        { name: '보스 도감', icon: '/images/guild/button/bossraid1.png', action: onOpenBossGuide },
    ];
    return (
        <div className="bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 p-2 sm:p-3 rounded-xl border-2 border-stone-600/60 shadow-2xl backdrop-blur-md flex-shrink-0">
            <h3 className="font-bold text-sm sm:text-base text-highlight mb-2 text-center flex items-center justify-center gap-1 sm:gap-2 flex-shrink-0">
                <span className="text-base sm:text-xl">⚡</span>
                <span>길드 활동</span>
            </h3>
            <div className="flex justify-around items-center gap-1 sm:gap-2">
                {activities.map(act => (
                    <button 
                        key={act.name} 
                        onClick={act.action}
                        className={`flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-3 rounded-xl bg-gradient-to-br from-stone-800/50 to-stone-700/30 border border-stone-600/40 transition-all hover:brightness-110 hover:shadow-lg relative group flex-1 min-w-0`}
                    >
                        <div className="w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-br from-stone-700/60 to-stone-800/50 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-xl transition-shadow border border-stone-600/40 flex-shrink-0">
                            <img src={act.icon} alt={act.name} className="w-8 h-8 sm:w-14 sm:h-14 drop-shadow-lg object-contain" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-highlight text-center leading-tight">{act.name}</span>
                        {act.notification && (
                            <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full animate-pulse border-2 border-secondary shadow-lg flex items-center justify-center">
                                <span className="text-[6px] sm:text-[8px] text-white font-bold">!</span>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

const BossPanel: React.FC<{ guild: GuildType, className?: string }> = ({ guild, className }) => {
    const { currentUserWithStatus } = useAppContext();
    const [hoveredSkill, setHoveredSkill] = useState<GuildBossSkill | null>(null);
    const [clickedSkill, setClickedSkill] = useState<GuildBossSkill | null>(null);
    const [skillTooltipPos, setSkillTooltipPos] = useState<{ top: number; left: number } | null>(null);
    const skillIconRefs = useRef<Record<string, HTMLDivElement | null>>({});
    
    // 나의 기록 계산
    const { myDamage, myRank } = useMemo(() => {
        if (!guild.guildBossState?.totalDamageLog || !currentUserWithStatus) {
            return { myDamage: 0, myRank: null };
        }
        
        const damageLog = guild.guildBossState.totalDamageLog || {} as Record<string, number>;
        const fullRanking = Object.entries(damageLog)
            .map(([userId, damage]: [string, any]) => {
                const member = guild.members?.find((m: GuildMember) => m.userId === userId);
                return { userId, nickname: member?.nickname || '알 수 없음', damage: typeof damage === 'number' ? damage : 0 };
            })
            .sort((a, b) => b.damage - a.damage);
        
        const myRankIndex = fullRanking.findIndex(r => r.userId === currentUserWithStatus.id);
        const myData = myRankIndex !== -1 ? { ...fullRanking[myRankIndex], rank: myRankIndex + 1 } : null;
        
        return {
            myDamage: myData?.damage || 0,
            myRank: myData?.rank || null
        };
    }, [guild.guildBossState?.totalDamageLog, guild.members, currentUserWithStatus]);
    const currentBoss = useMemo(() => {
        if (!guild.guildBossState) return GUILD_BOSSES[0];
        return GUILD_BOSSES.find(b => b.id === guild.guildBossState!.currentBossId) || GUILD_BOSSES[0];
    }, [guild.guildBossState]);
    
    const currentHp = guild.guildBossState?.currentBossHp ?? guild.guildBossState?.hp ?? currentBoss?.maxHp ?? 0;
    const hpPercent = (currentHp / currentBoss.maxHp) * 100;
    const [timeLeft, setTimeLeft] = useState('');
    
    // 보스전 티켓 계산
    const myBossTickets = currentUserWithStatus?.guildBossAttempts !== undefined 
        ? GUILD_BOSS_MAX_ATTEMPTS - currentUserWithStatus.guildBossAttempts 
        : GUILD_BOSS_MAX_ATTEMPTS;
    const canEnter = myBossTickets > 0;

    useEffect(() => {
        const calculateTimeLeft = () => {
            const msLeft = getTimeUntilNextMondayKST();
            const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
            setTimeLeft(`${days}일 ${String(hours).padStart(2, '0')}시간 ${String(minutes).padStart(2, '0')}분`);
        };
        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 60000);
        return () => clearInterval(interval);
    }, []);

    // 보스 속성에 따른 색상 테마
    const getBossTheme = (bossId: string) => {
        switch (bossId) {
            case 'boss_1': // 청해 (물)
                return {
                    bg: 'from-blue-900/95 via-cyan-800/90 to-blue-900/95',
                    border: 'border-blue-400/80',
                    shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
                    overlay: 'from-blue-500/20 via-cyan-400/10 to-blue-500/15',
                    iconBg: 'from-blue-600/40 to-cyan-800/30',
                    iconBorder: 'border-blue-500/40',
                    hpBar: 'from-blue-500 via-cyan-400 to-blue-500',
                    hpShadow: 'shadow-[0_0_8px_rgba(59,130,246,0.5)]',
                    text: 'text-blue-300',
                };
            case 'boss_2': // 홍염 (불)
                return {
                    bg: 'from-red-900/95 via-orange-800/90 to-red-900/95',
                    border: 'border-red-400/80',
                    shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',
                    overlay: 'from-red-500/20 via-orange-400/10 to-red-500/15',
                    iconBg: 'from-red-600/40 to-orange-800/30',
                    iconBorder: 'border-red-500/40',
                    hpBar: 'from-red-500 via-orange-600 to-red-700',
                    hpShadow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]',
                    text: 'text-red-300',
                };
            case 'boss_3': // 녹수 (풀)
                return {
                    bg: 'from-green-900/95 via-emerald-800/90 to-green-900/95',
                    border: 'border-green-400/80',
                    shadow: 'shadow-[0_0_20px_rgba(34,197,94,0.4)]',
                    overlay: 'from-green-500/20 via-emerald-400/10 to-green-500/15',
                    iconBg: 'from-green-600/40 to-emerald-800/30',
                    iconBorder: 'border-green-500/40',
                    hpBar: 'from-green-500 via-emerald-600 to-green-700',
                    hpShadow: 'shadow-[0_0_8px_rgba(34,197,94,0.5)]',
                    text: 'text-green-300',
                };
            case 'boss_4': // 현묘 (어둠)
                return {
                    bg: 'from-purple-900/95 via-indigo-800/90 to-purple-900/95',
                    border: 'border-purple-400/80',
                    shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
                    overlay: 'from-purple-500/20 via-indigo-400/10 to-purple-500/15',
                    iconBg: 'from-purple-600/40 to-indigo-800/30',
                    iconBorder: 'border-purple-500/40',
                    hpBar: 'from-purple-500 via-indigo-600 to-purple-700',
                    hpShadow: 'shadow-[0_0_8px_rgba(168,85,247,0.5)]',
                    text: 'text-purple-300',
                };
            case 'boss_5': // 백광 (빛)
                return {
                    bg: 'from-yellow-900/95 via-amber-800/90 to-yellow-900/95',
                    border: 'border-yellow-400/80',
                    shadow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]',
                    overlay: 'from-yellow-500/20 via-amber-400/10 to-yellow-500/15',
                    iconBg: 'from-yellow-600/40 to-amber-800/30',
                    iconBorder: 'border-yellow-500/40',
                    hpBar: 'from-yellow-500 via-amber-600 to-yellow-700',
                    hpShadow: 'shadow-[0_0_8px_rgba(234,179,8,0.5)]',
                    text: 'text-yellow-300',
                };
            default:
                return {
                    bg: 'from-gray-900/95 via-gray-800/90 to-gray-900/95',
                    border: 'border-gray-400/80',
                    shadow: 'shadow-[0_0_20px_rgba(156,163,175,0.4)]',
                    overlay: 'from-gray-500/20 via-gray-400/10 to-gray-500/15',
                    iconBg: 'from-gray-600/40 to-gray-800/30',
                    iconBorder: 'border-gray-500/40',
                    hpBar: 'from-gray-500 via-gray-600 to-gray-700',
                    hpShadow: 'shadow-[0_0_8px_rgba(156,163,175,0.5)]',
                    text: 'text-gray-300',
                };
        }
    };

    const theme = getBossTheme(currentBoss.id);

    const isMobile = window.innerWidth < 768;
    
    return (
        <div className={`bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 ${isMobile ? 'p-2' : 'p-3'} rounded-xl border-2 border-stone-600/60 shadow-lg flex flex-col items-center text-center w-full relative overflow-hidden h-full ${className || ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className="relative z-10 w-full flex flex-col h-full min-h-0">
                <h3 className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} text-highlight ${isMobile ? 'mb-1' : 'mb-2'} flex items-center justify-center gap-1 flex-shrink-0`}>
                    <span className={isMobile ? 'text-base' : 'text-xl'}>⚔️</span>
                    <span>길드 보스전</span>
                </h3>
                <div className={`flex flex-col ${isMobile ? 'mb-1' : 'mb-2'} flex-shrink-0`}>
                    {/* 보스 이름 */}
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-highlight ${isMobile ? 'mb-0.5' : 'mb-1'} text-center`}>{currentBoss.name}</p>
                    
                    {/* 보스 이미지와 스킬을 가로로 배치 */}
                    <div className="flex items-start gap-2 justify-center">
                        {/* 왼쪽: 보스 이미지와 체력 바 */}
                        <div className="flex flex-col items-center flex-shrink-0">
                            {/* 보스 이미지 - 크기 증가 */}
                            <div className="relative flex-shrink-0">
                                <div className={`${isMobile ? 'w-20 h-20' : 'w-32 h-32'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-xl flex items-center justify-center border border-stone-600/50 shadow-lg`}>
                                    <img src={currentBoss.image} alt={currentBoss.name} className={`${isMobile ? 'w-16 h-16' : 'w-28 h-28'} drop-shadow-lg object-contain`} />
                                </div>
                            </div>
                            
                            {/* 체력 바를 이미지 하단에 배치 */}
                            <div className={`${isMobile ? 'w-20' : 'w-32'} mt-1 relative`}>
                                <div className={`w-full bg-gray-700/50 rounded-full ${isMobile ? 'h-1.5' : 'h-2'} border border-gray-600/50 overflow-hidden shadow-inner relative`}>
                                    <div 
                                        className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(217,119,6,0.5)]"
                                        style={{ width: `${hpPercent}%` }}
                                    ></div>
                                    {/* 남은 체력을 그래프에 겹쳐서 표시 */}
                                    <span className={`absolute inset-0 flex items-center justify-center ${isMobile ? 'text-[9px]' : 'text-[10px]'} font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                                        {hpPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* 오른쪽: 보스 스킬 3개를 세로로 배치 */}
                        {currentBoss.skills && currentBoss.skills.length > 0 && (
                            <div className={`flex flex-col gap-1 relative ${isMobile ? 'mt-0' : 'mt-0'}`}>
                                {currentBoss.skills.slice(0, 3).map((skill, index) => (
                                    <div key={skill.id} className="relative">
                                        <div
                                            ref={(el) => { skillIconRefs.current[skill.id] = el; }}
                                            className={`${isMobile ? 'w-7 h-7' : 'w-10 h-10'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-lg flex items-center justify-center border border-stone-600/50 shadow-lg cursor-pointer hover:scale-110 transition-transform`}
                                            onMouseEnter={(e) => {
                                                setHoveredSkill(skill);
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setSkillTooltipPos({
                                                    top: rect.top + window.scrollY,
                                                    left: rect.left + rect.width / 2 + window.scrollX,
                                                });
                                            }}
                                            onMouseLeave={() => {
                                                setHoveredSkill(null);
                                                setSkillTooltipPos(null);
                                            }}
                                            onClick={() => setClickedSkill(clickedSkill?.id === skill.id ? null : skill)}
                                        >
                                            <img src={skill.image} alt={skill.name} className={`${isMobile ? 'w-5 h-5' : 'w-8 h-8'} object-contain drop-shadow-md`} />
                                            {skill.type === 'passive' && (
                                                <div className={`absolute -top-0.5 -right-0.5 ${isMobile ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5'} bg-purple-500 rounded-full flex items-center justify-center`}>
                                                    <span className={`${isMobile ? 'text-[4px]' : 'text-[6px]'} text-white font-bold`}>P</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* 호버 시 툴팁 */}
                                        {hoveredSkill?.id === skill.id && skillTooltipPos && (
                                            <div 
                                                className="fixed z-[9999] w-64 bg-gradient-to-br from-stone-900/98 via-neutral-800/95 to-stone-900/98 border-2 border-stone-600/60 rounded-xl shadow-2xl p-3 backdrop-blur-md"
                                                style={{
                                                    top: `${skillTooltipPos.top}px`,
                                                    left: `${skillTooltipPos.left}px`,
                                                    transform: 'translate(-50%, -100%)',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <img src={skill.image} alt={skill.name} className="w-8 h-8 object-contain" />
                                                    <div>
                                                        <h4 className="text-sm font-bold text-highlight">{skill.name}</h4>
                                                        <span className={`text-[10px] ${skill.type === 'active' ? 'text-blue-400' : 'text-purple-400'}`}>
                                                            {skill.type === 'active' ? '액티브' : '패시브'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-stone-300 leading-relaxed">{skill.description}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {/* 클릭 시 상세 정보 모달 */}
                                {clickedSkill && (
                                    <div 
                                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                                        onClick={() => setClickedSkill(null)}
                                    >
                                        <div 
                                            className="bg-gradient-to-br from-stone-900/98 via-neutral-800/95 to-stone-900/98 border-2 border-stone-600/60 rounded-xl shadow-2xl p-5 max-w-md w-full mx-4"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <img src={clickedSkill.image} alt={clickedSkill.name} className="w-12 h-12 object-contain" />
                                                <div>
                                                    <h3 className="text-lg font-bold text-highlight">{clickedSkill.name}</h3>
                                                    <span className={`text-xs ${clickedSkill.type === 'active' ? 'text-blue-400' : 'text-purple-400'}`}>
                                                        {clickedSkill.type === 'active' ? '액티브 스킬' : '패시브 스킬'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-stone-300 leading-relaxed mb-3">{clickedSkill.description}</p>
                                            <button
                                                onClick={() => setClickedSkill(null)}
                                                className="w-full py-2 px-4 bg-stone-700/50 hover:bg-stone-600/50 text-white rounded-lg transition-colors"
                                            >
                                                닫기
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* 남은 시간 */}
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-tertiary bg-gray-800/50 px-1 py-0.5 rounded-md ${isMobile ? 'mt-0.5 mb-0.5' : 'mt-1 mb-1'} text-center`}>{timeLeft}</p>
                </div>
                <div className="w-full flex-1 flex flex-col min-h-0">
                    {/* 중간 내용 영역 - flex-1로 공간 차지 */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {/* 나의 기록 - 항상 표시 */}
                        <div className={`flex-shrink-0 ${isMobile ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'} border-t border-stone-600/40`}>
                            <div className={`bg-stone-800/50 rounded-md ${isMobile ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}>
                                <div className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 ${isMobile ? 'mb-0.5' : 'mb-1'} font-semibold`}>나의 기록</div>
                                <div className={`flex flex-col ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-stone-300`}>랭킹</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold text-highlight`}>
                                            {myRank !== null ? `${myRank}위` : '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-stone-300`}>총 데미지</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold text-amber-300`}>{myDamage.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-stone-300`}>1회 최대</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold text-yellow-300`}>
                                            {(guild.guildBossState?.maxDamageLog?.[currentUserWithStatus?.id || ''] || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* 입장하기 버튼 - 하단 고정 */}
                    <div className={`flex-shrink-0 ${isMobile ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'} border-t border-stone-600/40`}>
                        <button
                            onClick={() => window.location.hash = '#/guildboss'}
                            disabled={!canEnter}
                            className={`w-full ${isMobile ? 'py-1 px-1.5' : 'py-1.5 px-2'} rounded-lg font-semibold ${isMobile ? 'text-[10px]' : 'text-xs'} transition-all flex items-center justify-center gap-1 ${
                                canEnter 
                                    ? `bg-gradient-to-r from-blue-600 to-blue-500 ${isMobile ? '' : 'hover:from-blue-500 hover:to-blue-400'} text-white shadow-lg ${isMobile ? '' : 'hover:shadow-xl hover:scale-105'}` 
                                    : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            <img src="/images/guild/ticket.png" alt="보스전 티켓" className={isMobile ? 'w-3 h-3' : 'w-4 h-4'} />
                            <span>{myBossTickets}/{GUILD_BOSS_MAX_ATTEMPTS}</span>
                            <span className="ml-0.5">입장</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WarPanel: React.FC<{ guild: GuildType, className?: string }> = ({ guild, className }) => {
    const { currentUserWithStatus, handlers, guilds } = useAppContext();
    const [showRewardModal, setShowRewardModal] = React.useState(false);
    const [activeWar, setActiveWar] = React.useState<any>(null);
    const [opponentGuild, setOpponentGuild] = React.useState<any>(null);
    const [canClaimReward, setCanClaimReward] = React.useState(false);
    const [isClaimed, setIsClaimed] = React.useState(false);
    const [myWarAttempts, setMyWarAttempts] = React.useState(0);
    const [isMatching, setIsMatching] = React.useState(false);
    const [isStarting, setIsStarting] = React.useState(false);
    const [isCanceling, setIsCanceling] = React.useState(false);
    const [nextMatchTime, setNextMatchTime] = React.useState<number | undefined>(undefined);
    const [timeRemaining, setTimeRemaining] = React.useState<string>('');
    const [showMatchingModal, setShowMatchingModal] = React.useState(false);
    const [matchingModalMessage, setMatchingModalMessage] = React.useState('');
    const [warActionCooldown, setWarActionCooldown] = React.useState<number | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = React.useState<string>('');
    const GUILD_WAR_MAX_ATTEMPTS = 3; // 하루 최대 공격권
    
    // 길드장/부길드장 권한 확인
    const myMemberInfo = React.useMemo(() => {
        if (!currentUserWithStatus?.id) return undefined;
        return guild.members?.find(m => m.userId === currentUserWithStatus.id);
    }, [guild.members, currentUserWithStatus?.id]);
    
    const canStartWar = myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';

    // handlers.handleAction을 ref로 저장하여 무한 루프 방지
    const handleActionRef = React.useRef(handlers.handleAction);
    React.useEffect(() => {
        handleActionRef.current = handlers.handleAction;
    }, [handlers.handleAction]);

    // 무한루프 방지를 위한 ref (컴포넌트 외부로 이동하여 공유)
    const isFetchingRef = React.useRef(false);
    const lastFetchTimeRef = React.useRef(0);
    const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const FETCH_COOLDOWN = 30000; // 30초 쿨다운 (interval과 동일하게)
    
    React.useEffect(() => {
        // 길드전 데이터 가져오기
        const fetchWarData = async () => {
            // 이미 fetch 중이거나 쿨다운 중이면 스킵
            const now = Date.now();
            if (isFetchingRef.current || (now - lastFetchTimeRef.current < FETCH_COOLDOWN)) {
                console.log('[WarPanel] Skipping fetch - cooldown active');
                return;
            }
            
            isFetchingRef.current = true;
            lastFetchTimeRef.current = now;
            
            try {
                const result = await handleActionRef.current({ type: 'GET_GUILD_WAR_DATA' }) as any;
                if (result?.error) {
                    console.error('[WarPanel] Failed to fetch war data:', result.error);
                    return;
                }
                
                const war = result?.clientResponse?.activeWar;
                // guilds를 의존성에서 제거하고 result에서 받은 데이터만 사용
                const allGuilds = result?.clientResponse?.guilds || {};
                const matching = result?.clientResponse?.isMatching || false;
                const nextMatch = result?.clientResponse?.nextMatchTime;
                
                setIsMatching(matching);
                setNextMatchTime(nextMatch);
                
                if (!war) {
                    // 활성 전쟁이 없음
                    setActiveWar(null);
                    setOpponentGuild(null);
                    return;
                }
                
                setActiveWar(war);
                
                // 상대 길드 정보
                const myGuildId = guild.id;
                const opponentGuildId = war.guild1Id === myGuildId ? war.guild2Id : war.guild1Id;
                const opponentGuildData = allGuilds[opponentGuildId];
                setOpponentGuild(opponentGuildData);
                
                // 하루 도전 횟수 계산
                const today = new Date().toISOString().split('T')[0];
                if (currentUserWithStatus) {
                    const attempts = war.dailyAttempts?.[currentUserWithStatus.id]?.[today] || 0;
                    setMyWarAttempts(attempts);
                } else {
                    setMyWarAttempts(0);
                }
                
                // 보상 수령 가능 여부 확인 (완료된 전쟁이면 모두 보상 수령 가능)
                if (war.status === 'completed') {
                    setCanClaimReward(true);
                } else {
                    setCanClaimReward(false);
                }
            } catch (error) {
                console.error('[WarPanel] Failed to fetch war data:', error);
            } finally {
                isFetchingRef.current = false;
            }
        };
        
        // 기존 interval 정리
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        
        // 초기 로드
        fetchWarData();
        
        // 30초마다 갱신
        intervalRef.current = setInterval(() => {
            fetchWarData();
        }, 30000);
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guild.id]); // guild.id만 의존성으로 유지 (길드가 바뀔 때만 재실행)
    
    // 남은 시간 계산
    React.useEffect(() => {
        if (!isMatching || !nextMatchTime) {
            setTimeRemaining('');
            return;
        }
        
        const updateTimeRemaining = () => {
            const now = Date.now();
            const remaining = nextMatchTime - now;
            
            if (remaining <= 0) {
                setTimeRemaining('매칭 중...');
                return;
            }
            
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            
            if (hours > 0) {
                setTimeRemaining(`${hours}시간 ${minutes}분 후 매칭`);
            } else if (minutes > 0) {
                setTimeRemaining(`${minutes}분 ${seconds}초 후 매칭`);
            } else {
                setTimeRemaining(`${seconds}초 후 매칭`);
            }
        };
        
        updateTimeRemaining();
        const interval = setInterval(updateTimeRemaining, 1000);
        return () => clearInterval(interval);
    }, [isMatching, nextMatchTime]);
    
    // 쿨타임 타이머 계산
    React.useEffect(() => {
        if (!warActionCooldown) {
            setCooldownRemaining('');
            return;
        }
        
        const updateCooldown = () => {
            const now = Date.now();
            const remaining = warActionCooldown - now;
            
            if (remaining <= 0) {
                setCooldownRemaining('');
                setWarActionCooldown(null);
                return;
            }
            
            const minutes = Math.floor(remaining / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            
            setCooldownRemaining(`${minutes}분 ${seconds}초`);
        };
        
        updateCooldown();
        const interval = setInterval(updateCooldown, 1000);
        return () => clearInterval(interval);
    }, [warActionCooldown]);
    
    const myWarTickets = GUILD_WAR_MAX_ATTEMPTS - myWarAttempts;
    const canEnterWar = myWarTickets > 0 && activeWar && !isMatching;

    const handleClaimReward = async () => {
        try {
            const result = await handlers.handleAction({ type: 'CLAIM_GUILD_WAR_REWARD' }) as any;
            if (result?.error) {
                alert(result.error);
                return undefined;
            } else {
                setIsClaimed(true);
                await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' });
                return {
                    warResult: result?.clientResponse?.warResult,
                    rewards: result?.clientResponse?.rewards,
                };
            }
        } catch (error) {
            console.error('[WarPanel] Claim reward failed:', error);
            alert('보상 수령에 실패했습니다.');
            return undefined;
        }
    };
    
    const handleStartWar = async () => {
        if (!canStartWar) return;
        if (warActionCooldown && Date.now() < warActionCooldown) {
            alert(`전쟁 취소 후 1시간이 지나야 신청할 수 있습니다. (남은 시간: ${cooldownRemaining})`);
            return;
        }
        setIsStarting(true);
        try {
            const result = await handlers.handleAction({ type: 'START_GUILD_WAR' }) as any;
            if (result?.error) {
                alert(result.error);
            } else {
                setMatchingModalMessage(result?.clientResponse?.message || '매칭 신청이 완료되었습니다. 다음날 0시에 매칭됩니다.');
                setShowMatchingModal(true);
                if (result?.clientResponse?.cooldownUntil) {
                    setWarActionCooldown(result.clientResponse.cooldownUntil);
                }
                await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' });
            }
        } catch (error) {
            console.error('[WarPanel] Start war failed:', error);
            alert('전쟁 시작에 실패했습니다.');
        } finally {
            setIsStarting(false);
        }
    };
    
    const handleCancelWar = async () => {
        if (!canStartWar) return;
        if (warActionCooldown && Date.now() < warActionCooldown) {
            alert(`전쟁 신청 후 1시간이 지나야 취소할 수 있습니다. (남은 시간: ${cooldownRemaining})`);
            return;
        }
        setIsCanceling(true);
        try {
            const result = await handlers.handleAction({ type: 'CANCEL_GUILD_WAR' }) as any;
            if (result?.error) {
                alert(result.error);
            } else {
                setMatchingModalMessage(result?.clientResponse?.message || '매칭이 취소되었습니다.');
                setShowMatchingModal(true);
                if (result?.clientResponse?.cooldownUntil) {
                    setWarActionCooldown(result.clientResponse.cooldownUntil);
                }
                await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' });
            }
        } catch (error) {
            console.error('[WarPanel] Cancel war failed:', error);
            alert('전쟁 취소에 실패했습니다.');
        } finally {
            setIsCanceling(false);
        }
    };

    // 점령률 계산
    const calculateOccupancy = () => {
        if (!activeWar || !activeWar.boards) {
            return { ourGuild: 0, enemyGuild: 0, ourStars: 0, enemyStars: 0, ourScore: 0, enemyScore: 0 };
        }
        
        const myGuildId = guild.id;
        const isGuild1 = activeWar.guild1Id === myGuildId;
        let ourStars = 0;
        let enemyStars = 0;
        let ourScore = 0;
        let enemyScore = 0;
        let totalBoards = 0;
        
        Object.values(activeWar.boards || {}).forEach((board: any) => {
            totalBoards++;
            const myBoardStars = isGuild1 ? (board.guild1Stars || 0) : (board.guild2Stars || 0);
            const enemyBoardStars = isGuild1 ? (board.guild2Stars || 0) : (board.guild1Stars || 0);
            ourStars += myBoardStars;
            enemyStars += enemyBoardStars;
            
            const myBestResult = isGuild1 ? board.guild1BestResult : board.guild2BestResult;
            const enemyBestResult = isGuild1 ? board.guild2BestResult : board.guild1BestResult;
            if (myBestResult) ourScore += myBestResult.captures || 0;
            if (enemyBestResult) enemyScore += enemyBestResult.captures || 0;
        });
        
        const totalStars = ourStars + enemyStars;
        const ourGuildOccupancy = totalStars > 0 ? (ourStars / totalStars) * 100 : 50;
        const enemyGuildOccupancy = totalStars > 0 ? (enemyStars / totalStars) * 100 : 50;
        
        return { 
            ourGuild: ourGuildOccupancy, 
            enemyGuild: enemyGuildOccupancy,
            ourStars,
            enemyStars,
            ourScore,
            enemyScore
        };
    };
    
    const { ourGuild: ourGuildOccupancy, enemyGuild: enemyGuildOccupancy, ourStars, enemyStars, ourScore, enemyScore } = calculateOccupancy();
    const enemyGuildName = opponentGuild?.name || "상대 길드";
    const isMobile = window.innerWidth < 768;
    
    return (
        <>
            <div className={`bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 ${isMobile ? 'p-2' : 'p-3'} rounded-xl border-2 border-stone-600/60 shadow-lg flex flex-col items-center text-center w-full relative overflow-hidden h-full ${className || ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
                <div className="relative z-10 w-full flex flex-col h-full min-h-0">
                    <h3 className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} text-highlight ${isMobile ? 'mb-1' : 'mb-2'} flex items-center justify-center gap-1 flex-shrink-0`}>
                        <span className={isMobile ? 'text-base' : 'text-xl'}>🛡️</span>
                        <span>길드 전쟁</span>
                    </h3>
                    {/* 전쟁 이미지 - 크기 축소 */}
                    <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-xl flex items-center justify-center ${isMobile ? 'my-1' : 'my-1.5'} mx-auto border border-stone-600/50 shadow-lg flex-shrink-0`}>
                        <img src="/images/guild/button/guildwar.png" alt="길드 전쟁" className={`${isMobile ? 'w-12 h-12' : 'w-20 h-20'} drop-shadow-lg object-contain`} />
                    </div>
                    
                    <div className="w-full flex-1 flex flex-col min-h-0">
                        {/* 중간 내용 영역 - flex-1로 공간 차지 */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {/* 매칭 중 표시 - 최우선 표시 */}
                            {isMatching && (
                                <div className={`flex-shrink-0 ${isMobile ? 'mb-1' : 'mb-1.5'} space-y-1.5`}>
                                    <div className={`bg-yellow-900/50 border-2 border-yellow-500/60 rounded-md ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
                                        <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-yellow-300 ${isMobile ? 'mb-1' : 'mb-1'} text-center`}>
                                            ⏳ 매칭 신청중
                                        </div>
                                        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-yellow-200 text-center`}>
                                            {timeRemaining || '다음날 0시에 매칭됩니다'}
                                        </div>
                                    </div>
                                    {/* 전쟁 참여 취소 버튼 - 길드장/부길드장만 표시 */}
                                    {canStartWar && (
                                        <button
                                            onClick={handleCancelWar}
                                            disabled={isCanceling || (warActionCooldown !== null && Date.now() < warActionCooldown)}
                                            className={`w-full ${isMobile ? 'py-1 px-1.5' : 'py-1.5 px-2'} rounded-lg font-semibold ${isMobile ? 'text-xs' : 'text-sm'} transition-all flex items-center justify-center gap-1 ${
                                                (isCanceling || (warActionCooldown !== null && Date.now() < warActionCooldown))
                                                    ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg hover:shadow-xl hover:scale-105'
                                            }`}
                                        >
                                            {isCanceling ? (
                                                <>
                                                    <span className="animate-spin text-xs">⏳</span>
                                                    <span>취소 중...</span>
                                                </>
                                            ) : (warActionCooldown !== null && Date.now() < warActionCooldown) ? (
                                                <>
                                                    <span className="text-xs">⏱️</span>
                                                    <span>쿨타임: {cooldownRemaining}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-xs">❌</span>
                                                    <span>전쟁 참여 취소</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                            
                            {/* 전쟁 진행 중 - 점령률 및 통계 */}
                            {activeWar && !isMatching && (
                                <div className={`flex-shrink-0 ${isMobile ? 'space-y-1' : 'space-y-1.5'}`}>
                                    {/* 점령률 막대그래프 (마주보는 형태) */}
                                    <div className={`bg-stone-800/50 rounded-md ${isMobile ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
                                        <div className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 ${isMobile ? 'mb-0.5' : 'mb-1'} text-center font-semibold`}>현재 점령률</div>
                                        <div className={`${isMobile ? 'space-y-0.5' : 'space-y-1'}`}>
                                            {/* 우리 길드 */}
                                            <div>
                                                <div className={`flex items-center justify-between ${isMobile ? 'mb-0.5' : 'mb-0.5'}`}>
                                                    <span className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} font-semibold text-blue-300 truncate`}>{(currentGuild || guild)?.name || '우리 길드'}</span>
                                                    <span className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} font-bold text-blue-300`}>{ourGuildOccupancy.toFixed(1)}%</span>
                                                </div>
                                                <div className={`w-full bg-gray-700/50 rounded-full ${isMobile ? 'h-1.5' : 'h-2'} border border-gray-600/50 overflow-hidden`}>
                                                    <div 
                                                        className="bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${ourGuildOccupancy}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            
                                            {/* 상대 길드 */}
                                            <div>
                                                <div className={`flex items-center justify-between ${isMobile ? 'mb-0.5' : 'mb-0.5'}`}>
                                                    <span className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} font-semibold text-red-300 truncate`}>{enemyGuildName}</span>
                                                    <span className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} font-bold text-red-300`}>{enemyGuildOccupancy.toFixed(1)}%</span>
                                                </div>
                                                <div className={`w-full bg-gray-700/50 rounded-full ${isMobile ? 'h-1.5' : 'h-2'} border border-gray-600/50 overflow-hidden`}>
                                                    <div 
                                                        className="bg-gradient-to-r from-red-500 via-orange-400 to-red-500 h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${enemyGuildOccupancy}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* 별 개수 및 점수 */}
                                    <div className={`bg-stone-800/50 rounded-md ${isMobile ? 'px-1.5 py-1' : 'px-2 py-1'}`}>
                                        <div className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 ${isMobile ? 'mb-0.5' : 'mb-1'} text-center font-semibold`}>전투 통계</div>
                                        <div className={`${isMobile ? 'space-y-0.5' : 'space-y-1'}`}>
                                            <div className={`flex items-center justify-between ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
                                                <span className="text-blue-300 font-medium">별 개수</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-300 font-bold">{ourStars}</span>
                                                    <span className="text-stone-500">vs</span>
                                                    <span className="text-red-300 font-bold">{enemyStars}</span>
                                                </div>
                                            </div>
                                            <div className={`flex items-center justify-between ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
                                                <span className="text-blue-300 font-medium">점수</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-300 font-bold">{ourScore.toLocaleString()}</span>
                                                    <span className="text-stone-500">vs</span>
                                                    <span className="text-red-300 font-bold">{enemyScore.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* 전쟁 없음 - 참여 버튼 (길드장/부길드장만) */}
                            {!activeWar && !isMatching && (
                                <div className={`flex-shrink-0 ${isMobile ? 'space-y-0.5' : 'space-y-1'}`}>
                                    <div className={`bg-stone-800/50 rounded-md ${isMobile ? 'px-1.5 py-1' : 'px-2 py-1'}`}>
                                        <div className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 text-center ${isMobile ? 'mb-0.5' : 'mb-1'}`}>진행 중인 전쟁 없음</div>
                                        {canStartWar && (
                                            <>
                                                {warActionCooldown !== null && Date.now() < warActionCooldown && (
                                                    <div className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-yellow-300 text-center ${isMobile ? 'mb-0.5' : 'mb-1'}`}>
                                                        쿨타임: {cooldownRemaining}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={handleStartWar}
                                                    disabled={isStarting || (warActionCooldown !== null && Date.now() < warActionCooldown)}
                                                    className={`w-full ${isMobile ? 'py-0.5 px-1.5' : 'py-1 px-2'} rounded-lg font-semibold ${isMobile ? 'text-xs' : 'text-sm'} transition-all flex items-center justify-center gap-1 ${
                                                        (isStarting || (warActionCooldown !== null && Date.now() < warActionCooldown))
                                                            ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                                                            : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg hover:shadow-xl hover:scale-105'
                                                    }`}
                                                >
                                                    {isStarting ? (
                                                        <>
                                                            <span className="animate-spin text-xs">⏳</span>
                                                            <span>매칭 중...</span>
                                                        </>
                                                    ) : (warActionCooldown !== null && Date.now() < warActionCooldown) ? (
                                                        <>
                                                            <span className="text-xs">⏱️</span>
                                                            <span>쿨타임: {cooldownRemaining}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-xs">⚔️</span>
                                                            <span>전쟁 참여</span>
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* 보상 받기 버튼 */}
                            {canClaimReward && !isClaimed && (
                                <div className={`flex-shrink-0 ${isMobile ? 'mt-1' : 'mt-1.5'}`}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRewardModal(true);
                                        }}
                                        className={`w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white ${isMobile ? 'text-xs' : 'text-sm'} font-semibold ${isMobile ? 'py-0.5 px-1.5' : 'py-1 px-2'} rounded-lg transition-all hover:scale-105`}
                                    >
                                        보상 받기
                                    </button>
                                </div>
                            )}
                            {isClaimed && (
                                <div className={`flex-shrink-0 ${isMobile ? 'mt-1' : 'mt-1.5'}`}>
                                    <div className={`w-full bg-green-600/50 text-green-300 ${isMobile ? 'text-xs' : 'text-sm'} font-semibold ${isMobile ? 'py-0.5 px-1.5' : 'py-1 px-2'} rounded-lg`}>
                                        보상 수령 완료
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* 입장하기 버튼 - 하단 고정 */}
                        <div className={`flex-shrink-0 ${isMobile ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'} border-t border-stone-600/40`}>
                            <button
                                onClick={() => window.location.hash = '#/guildwar'}
                                disabled={!canEnterWar}
                                className={`w-full ${isMobile ? 'py-1 px-1.5' : 'py-1.5 px-2'} rounded-lg font-semibold ${isMobile ? 'text-xs' : 'text-sm'} transition-all flex items-center justify-center gap-1 ${
                                    canEnterWar 
                                        ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg hover:shadow-xl hover:scale-105' 
                                        : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                <img src="/images/guild/warticket.png" alt="길드전 공격권" className={isMobile ? 'w-3 h-3' : 'w-4 h-4'} />
                                <span>{myWarTickets}/{GUILD_WAR_MAX_ATTEMPTS}</span>
                                <span className="ml-0.5">입장</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        {showRewardModal && (
            <GuildWarRewardModal
                onClose={() => setShowRewardModal(false)}
                onClaim={handleClaimReward}
                isClaimed={isClaimed}
                canClaim={canClaimReward && !isClaimed}
            />
        )}
        {showMatchingModal && (
            <GuildWarMatchingModal
                onClose={() => setShowMatchingModal(false)}
                message={matchingModalMessage}
            />
        )}
        </>
    );
};

const GuildBossGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [selectedBoss, setSelectedBoss] = useState<GuildBossInfo>(GUILD_BOSSES[0]);

    const getBossTheme = (bossId: string) => {
        switch (bossId) {
            case 'boss_1': return { color: 'from-blue-600 to-cyan-600', border: 'border-blue-400/60', text: 'text-blue-300' };
            case 'boss_2': return { color: 'from-red-600 to-orange-600', border: 'border-red-400/60', text: 'text-red-300' };
            case 'boss_3': return { color: 'from-green-600 to-emerald-600', border: 'border-green-400/60', text: 'text-green-300' };
            case 'boss_4': return { color: 'from-purple-600 to-indigo-600', border: 'border-purple-400/60', text: 'text-purple-300' };
            case 'boss_5': return { color: 'from-yellow-600 to-amber-600', border: 'border-yellow-400/60', text: 'text-yellow-300' };
            default: return { color: 'from-gray-600 to-slate-600', border: 'border-gray-400/60', text: 'text-gray-300' };
        }
    };

    const theme = getBossTheme(selectedBoss.id);

    return (
        <DraggableWindow title="길드 보스 도감" onClose={onClose} windowId="guild-boss-guide" initialWidth={1100} initialHeight={800} variant="store">
            <div className="flex gap-4 h-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-950/50 via-neutral-900/30 to-stone-950/50 pointer-events-none"></div>
                <div className="relative z-10 flex gap-4 w-full">
                <div className="w-1/3 flex flex-col gap-2 overflow-y-auto pr-2">
                    {GUILD_BOSSES.map(boss => {
                        const bossTheme = getBossTheme(boss.id);
                        const isSelected = selectedBoss.id === boss.id;
                        return (
                            <button
                                key={boss.id}
                                onClick={() => setSelectedBoss(boss)}
                                className={`flex items-center gap-2.5 p-3 rounded-xl transition-all w-full border-2 relative overflow-hidden ${
                                    isSelected 
                                        ? `bg-gradient-to-br ${bossTheme.color} ${bossTheme.border} shadow-xl` 
                                        : 'bg-gradient-to-br from-stone-900/90 to-stone-800/80 border-stone-600/60 hover:border-stone-500/80 hover:shadow-lg'
                                }`}
                            >
                                {isSelected && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none"></div>
                                )}
                                <div className={`w-12 h-12 bg-gradient-to-br ${isSelected ? 'from-white/20 to-white/10' : 'from-stone-800/80 to-stone-900/80'} rounded-lg flex items-center justify-center border-2 ${isSelected ? 'border-white/30' : 'border-stone-600/60'} shadow-lg flex-shrink-0 relative z-10`}>
                                    <img src={boss.image} alt={boss.name} className="w-10 h-10 object-contain drop-shadow-xl" />
                                </div>
                                <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-stone-300'} relative z-10 truncate`}>{boss.name}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="w-2/3 bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 p-4 rounded-xl overflow-y-auto border-2 border-stone-600/60 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
                    <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b-2 border-stone-700/60">
                        <div className={`w-24 h-24 bg-gradient-to-br ${theme.color} rounded-xl flex items-center justify-center border-2 ${theme.border} shadow-xl relative overflow-hidden flex-shrink-0`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none"></div>
                            <img src={selectedBoss.image} alt={selectedBoss.name} className="w-20 h-20 object-contain drop-shadow-xl relative z-10" />
                        </div>
                        <div className="flex-grow min-w-0">
                            <h3 className="text-xl font-bold text-white mb-1 drop-shadow-lg truncate">{selectedBoss.name}</h3>
                            <p className="text-sm text-stone-300 leading-relaxed line-clamp-2">{selectedBoss.description}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="bg-gradient-to-br from-amber-900/60 via-yellow-800/50 to-amber-900/60 p-3 rounded-xl border-2 border-amber-500/60 shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-yellow-400/5 to-amber-500/10 pointer-events-none"></div>
                            <div className="relative z-10">
                                <h4 className="font-bold text-sm text-amber-300 mb-2 flex items-center gap-1.5">
                                    <span className="text-base">📖</span>
                                    공략 가이드
                                </h4>
                                <p className="text-xs text-stone-200 leading-relaxed">{selectedBoss.strategyGuide}</p>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-stone-800/80 to-stone-900/80 p-3 rounded-xl border-2 border-stone-600/60 shadow-xl">
                            <h4 className="font-bold text-sm text-cyan-300 mb-3 flex items-center gap-1.5">
                                <span className="text-base">⚔️</span>
                                주요 스킬
                            </h4>
                            <ul className="space-y-2">
                                {selectedBoss.skills.map(skill => (
                                    <li key={skill.id} className="flex items-start gap-3 bg-gradient-to-br from-stone-900/80 to-stone-800/60 p-2.5 rounded-lg border border-stone-700/50 shadow-lg">
                                        <div className="w-12 h-12 bg-gradient-to-br from-stone-800/90 to-stone-900/90 rounded-lg flex items-center justify-center border-2 border-stone-600/60 shadow-lg flex-shrink-0">
                                            <img src={skill.image || ''} alt={skill.name} className="w-10 h-10 object-contain drop-shadow-lg" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm mb-0.5">{skill.name}</p>
                                            <p className="text-xs text-stone-300 leading-relaxed">{skill.description}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-blue-900/60 via-indigo-800/50 to-blue-900/60 p-3 rounded-xl border-2 border-blue-500/60 shadow-xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-400/5 to-blue-500/10 pointer-events-none"></div>
                                <div className="relative z-10">
                                    <h4 className="font-bold text-xs text-blue-300 mb-1.5 flex items-center gap-1.5">
                                        <span className="text-sm">💪</span>
                                        추천 능력치
                                    </h4>
                                    <p className="text-xs text-stone-200 leading-relaxed">{selectedBoss.recommendedStats.join(', ')}</p>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-900/60 via-violet-800/50 to-purple-900/60 p-3 rounded-xl border-2 border-purple-500/60 shadow-xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-violet-400/5 to-purple-500/10 pointer-events-none"></div>
                                <div className="relative z-10">
                                    <h4 className="font-bold text-xs text-purple-300 mb-1.5 flex items-center gap-1.5">
                                        <span className="text-sm">🔬</span>
                                        추천 연구
                                    </h4>
                                    <p className="text-xs text-stone-200 leading-relaxed">
                                        {selectedBoss.recommendedResearch.length > 0 
                                            ? selectedBoss.recommendedResearch.map(id => GUILD_RESEARCH_PROJECTS[id]?.name).join(', ')
                                            : '없음'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

const GuildIconSelectModal: React.FC<{ guild: GuildType; onClose: () => void; onSelect: (icon: string) => void }> = ({ guild, onClose, onSelect }) => {
    const guildIcons = Array.from({ length: 11 }, (_, i) => `/images/guild/profile/icon${i + 1}.png`);
    const [selectedIcon, setSelectedIcon] = useState<string>(getGuildIconPath(guild.icon));

    return (
        <DraggableWindow title="길드 마크 선택" onClose={onClose} windowId="guild-icon-select" initialWidth={600} variant="store">
            <div className="space-y-4">
                <div className="text-sm text-tertiary mb-4">
                    변경할 길드 마크를 선택하세요.
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {guildIcons.map((icon, index) => {
                        const isSelected = selectedIcon === icon;
                        return (
                            <button
                                key={icon}
                                onClick={() => setSelectedIcon(icon)}
                                className={`relative p-3 rounded-xl border-2 transition-all ${
                                    isSelected
                                        ? 'bg-accent/20 border-accent shadow-lg shadow-accent/30'
                                        : 'bg-stone-800/50 border-stone-600/50 hover:bg-stone-700/70 hover:border-stone-500/70'
                                }`}
                            >
                                <img src={icon} alt={`길드 마크 ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                                {isSelected && (
                                    <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                                        <span className="text-xs">✓</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-stone-600/50">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button onClick={() => onSelect(selectedIcon)} colorScheme="green">적용</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

interface GuildDashboardProps {
    guild: GuildType;
    guildDonationAnimation: { coins: number; research: number; type: 'gold' | 'diamond' } | null;
    onDonationComplete?: (coins: number, research: number, type: 'gold' | 'diamond') => void;
}

type GuildTab = 'home' | 'members' | 'management';

export const GuildDashboard: React.FC<GuildDashboardProps> = ({ guild, guildDonationAnimation, onDonationComplete }) => {
    const { currentUserWithStatus, handlers, guilds } = useAppContext();
    
    // guilds 상태에서 최신 길드 정보 가져오기 (guild prop보다 우선)
    const currentGuild = React.useMemo(() => {
        if (!guild?.id) return guild;
        
        // guilds 상태에 최신 정보가 있으면 사용 (name이 있는 경우 우선)
        const latestGuild = guilds[guild.id];
        
        // latestGuild에 name이 있으면 우선 사용, 없으면 guild prop 사용
        // 하지만 latestGuild가 있으면 최신 정보이므로 우선 사용
        const finalGuild = latestGuild || guild;
        
        // 디버깅: 길드명 확인 (개발 환경에서만)
        if (process.env.NODE_ENV === 'development' && !finalGuild?.name) {
            console.warn('[GuildDashboard] currentGuild has no name:', {
                guildId: guild.id,
                hasLatestGuild: !!latestGuild,
                latestGuildName: latestGuild?.name,
                guildPropName: guild?.name,
                finalGuildKeys: Object.keys(finalGuild || {}),
                guildsKeys: Object.keys(guilds),
                guildsHasGuild: !!guilds[guild.id],
                guildsGuildName: guilds[guild.id]?.name
            });
        }
        
        return finalGuild;
    }, [guild, guilds]);
    const [activeTab, setActiveTab] = useState<GuildTab>('home');
    const [isMissionsOpen, setIsMissionsOpen] = useState(false);
    const [isResearchOpen, setIsResearchOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isBossGuideOpen, setIsBossGuideOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [isIconSelectOpen, setIsIconSelectOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const goldButtonRef = useRef<HTMLDivElement>(null);
    const diamondButtonRef = useRef<HTMLDivElement>(null);
    const [goldButtonPos, setGoldButtonPos] = useState<{ top: number; left: number } | null>(null);
    const [diamondButtonPos, setDiamondButtonPos] = useState<{ top: number; left: number } | null>(null);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    // 모바일 감지 및 스케일 계산
    useEffect(() => {
        const handleResize = () => {
            const newIsMobile = window.innerWidth < 768;
            setIsMobile(newIsMobile);
            
            // 길드 홈 화면 스케일 계산 (데스크톱만)
            if (!newIsMobile && containerRef.current) {
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // 24인치 모니터 기준 (1920x1080)
                const baseWidth = 1920;
                const baseHeight = 1080;
                
                // 뷰포트에 맞는 스케일 계산 (패딩과 여백 고려)
                const padding = 20; // 양쪽 패딩 (10px * 2)
                const availableWidth = viewportWidth - padding;
                const availableHeight = viewportHeight - padding;
                
                const scaleX = availableWidth / baseWidth;
                const scaleY = availableHeight / baseHeight;
                // 최소 스케일을 0.8로 설정, 최대 스케일을 1.0으로 설정하여 스크롤 없이 표시
                const newScale = Math.max(0.8, Math.min(scaleX, scaleY, 1.0));
                
                setScale(newScale);
            } else {
                setScale(1);
            }
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const myMemberInfo = useMemo(() => {
        if (!currentUserWithStatus?.id) return undefined;
        let member = currentGuild.members?.find(m => m.userId === currentUserWithStatus.id);

        // Workaround for admin user ID mismatch
        if (!member && currentUserWithStatus.id === 'user-admin-static-id') {
            member = guild.members?.find(m => m.nickname === '관리자');
        }
        return member;
    }, [guild.members, currentUserWithStatus?.id, currentUserWithStatus?.nickname]);

    const canManage = myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';



    const xpForNextLevel = GUILD_XP_PER_LEVEL(currentGuild?.level || 1);
    const xpProgress = Math.min(((currentGuild?.xp ?? currentGuild?.experience ?? 0) / xpForNextLevel) * 100, 100);
    const myGuildCoins = currentUserWithStatus?.guildCoins ?? 0;
    const myBossTickets = currentUserWithStatus?.guildBossAttempts !== undefined ? GUILD_BOSS_MAX_ATTEMPTS - currentUserWithStatus.guildBossAttempts : GUILD_BOSS_MAX_ATTEMPTS;
    
    const missionTabNotification = useMemo(() => {
        if (!currentUserWithStatus || !myMemberInfo || !guild.weeklyMissions) return false;
        
        const now = Date.now();
        const isExpired = guild.lastMissionReset && isDifferentWeekKST(guild.lastMissionReset, now);
        if (isExpired) return false; // 초기화된 경우 보상 받을 수 없음
        
        // 초기화 전 보상 받을 내역이 있는지 확인
        return guild.weeklyMissions.some(m => {
            const isComplete = (m.progress ?? 0) >= (m.target ?? 0);
            const isClaimed = m.claimedBy?.includes(currentUserWithStatus.id) ?? false;
            return isComplete && !isClaimed;
        });
    }, [guild.weeklyMissions, guild.lastMissionReset, myMemberInfo, currentUserWithStatus]);

    // 버튼 위치 계산 (애니메이션용)
    useEffect(() => {
        if (!guildDonationAnimation) return;
        
        const updatePositions = () => {
            if (goldButtonRef.current) {
                const rect = goldButtonRef.current.getBoundingClientRect();
                setGoldButtonPos({ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 });
            }
            if (diamondButtonRef.current) {
                const rect = diamondButtonRef.current.getBoundingClientRect();
                setDiamondButtonPos({ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 });
            }
        };
        
        // 약간의 지연을 두고 위치 계산 (DOM이 업데이트된 후)
        const timeoutId = setTimeout(updatePositions, 100);
        window.addEventListener('resize', updatePositions);
        window.addEventListener('scroll', updatePositions);
        
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updatePositions);
            window.removeEventListener('scroll', updatePositions);
        };
    }, [guildDonationAnimation]);

    // 애니메이션 컴포넌트
    const goldAnimation = useMemo(() => {
        if (!guildDonationAnimation || guildDonationAnimation.type !== 'gold' || !goldButtonPos) return null;
        return (
            <div 
                className="fixed -translate-x-1/2 -translate-y-full animate-float-up-and-fade z-[100] pointer-events-none whitespace-nowrap" 
                style={{ 
                    animationDelay: '0ms',
                    top: `${goldButtonPos.top}px`,
                    left: `${goldButtonPos.left}px`
                }}
            >
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-900/95 via-yellow-900/95 to-amber-800/95 px-4 py-2 rounded-lg border-2 border-amber-400/60 shadow-[0_4px_12px_rgba(251,191,36,0.6)] backdrop-blur-sm">
                    <img src="/images/guild/tokken.png" alt="Coin" className="w-5 h-5 drop-shadow-md flex-shrink-0" />
                    <span className="text-sm font-bold text-yellow-300 drop-shadow-lg whitespace-nowrap">+{guildDonationAnimation.coins}</span>
                    <img src="/images/guild/button/guildlab.png" alt="Research" className="w-5 h-5 drop-shadow-md flex-shrink-0" />
                    <span className="text-sm font-bold text-blue-300 drop-shadow-lg whitespace-nowrap">+{guildDonationAnimation.research} RP</span>
                </div>
            </div>
        );
    }, [guildDonationAnimation, goldButtonPos]);

    const diamondAnimation = useMemo(() => {
        if (!guildDonationAnimation || guildDonationAnimation.type !== 'diamond' || !diamondButtonPos) return null;
        return (
            <div 
                className="fixed -translate-x-1/2 -translate-y-full animate-float-up-and-fade z-[100] pointer-events-none whitespace-nowrap" 
                style={{ 
                    animationDelay: '0ms',
                    top: `${diamondButtonPos.top}px`,
                    left: `${diamondButtonPos.left}px`
                }}
            >
                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-900/95 via-indigo-900/95 to-purple-900/95 px-4 py-2 rounded-lg border-2 border-blue-400/60 shadow-[0_4px_12px_rgba(59,130,246,0.6)] backdrop-blur-sm">
                    <img src="/images/guild/tokken.png" alt="Coin" className="w-5 h-5 drop-shadow-md flex-shrink-0" />
                    <span className="text-sm font-bold text-yellow-300 drop-shadow-lg whitespace-nowrap">+{guildDonationAnimation.coins}</span>
                    <img src="/images/guild/button/guildlab.png" alt="Research" className="w-5 h-5 drop-shadow-md flex-shrink-0" />
                    <span className="text-sm font-bold text-blue-300 drop-shadow-lg whitespace-nowrap">+{guildDonationAnimation.research} RP</span>
                </div>
            </div>
        );
    }, [guildDonationAnimation, diamondButtonPos]);

    const tabs = [
        { id: 'home' as GuildTab, label: '길드홈' },
        { id: 'members' as GuildTab, label: '길드원' },
    ];
    if (canManage) {
        tabs.push({ id: 'management' as GuildTab, label: '관리' });
    }
    
    const RightPanel: React.FC<{ guildDonationAnimation: { coins: number; research: number; type: 'gold' | 'diamond' } | null; onDonationComplete?: (coins: number, research: number, type: 'gold' | 'diamond') => void; goldButtonRef: React.RefObject<HTMLDivElement>; diamondButtonRef: React.RefObject<HTMLDivElement> }> = ({ guildDonationAnimation, onDonationComplete, goldButtonRef, diamondButtonRef }) => (
        <div className="lg:col-span-2 xl:col-span-2 flex flex-col gap-1.5 h-full min-h-0 overflow-hidden">
            {!isMobile && (
                <>
                    <GuildDonationPanel guildDonationAnimation={guildDonationAnimation} onDonationComplete={onDonationComplete} goldButtonRef={goldButtonRef} diamondButtonRef={diamondButtonRef} />
                    <ActivityPanel 
                        onOpenMissions={() => setIsMissionsOpen(true)} 
                        onOpenResearch={() => setIsResearchOpen(true)} 
                        onOpenShop={() => setIsShopOpen(true)} 
                        missionNotification={missionTabNotification} 
                        onOpenBossGuide={() => setIsBossGuideOpen(true)} 
                    />
                    <div className="flex gap-1.5 flex-1 min-h-0 overflow-hidden">
                        <BossPanel guild={currentGuild || guild} className="flex-1" />
                        <WarPanel guild={currentGuild || guild} className="flex-1" />
                    </div>
                </>
            )}
        </div>
    );    return (
        <div 
            ref={containerRef}
            className="w-full h-full flex items-center justify-center relative"
            style={{
                transform: !isMobile ? `scale(${scale})` : 'none',
                transformOrigin: 'center center',
                overflow: !isMobile ? 'visible' : 'auto',
            }}
        >
            <div 
                className={`${isMobile ? 'p-2' : 'p-1.5'} w-full mx-auto h-full flex flex-col relative`}
                style={{
                    width: !isMobile ? '100%' : '100%',
                    height: !isMobile ? '100%' : '100%',
                    maxWidth: !isMobile ? '100%' : '100%',
                    maxHeight: !isMobile ? '100%' : '100%',
                }}
            >
                <div className="relative z-10 h-full flex flex-col">
            {isMissionsOpen && <GuildMissionsPanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} onClose={() => setIsMissionsOpen(false)} />}
            {isResearchOpen && <GuildResearchPanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} onClose={() => setIsResearchOpen(false)} />}
            {isShopOpen && <GuildShopModal onClose={() => setIsShopOpen(false)} isTopmost={true} />}
            {isHelpOpen && <HelpModal mode="guild" onClose={() => setIsHelpOpen(false)} />}
            {isBossGuideOpen && <GuildBossGuideModal onClose={() => setIsBossGuideOpen(false)} />}
            {isIconSelectOpen && <GuildIconSelectModal guild={currentGuild || guild} onClose={() => setIsIconSelectOpen(false)} onSelect={(icon) => {
                handlers.handleAction({ type: 'GUILD_UPDATE_PROFILE', payload: { guildId: (currentGuild || guild).id, icon } });
                setIsIconSelectOpen(false);
            }} />}
            
            <header className="relative flex justify-center items-center mb-4 flex-shrink-0 py-3 md:py-4 bg-gradient-to-r from-secondary/80 via-secondary/60 to-secondary/80 rounded-xl border border-accent/20 shadow-lg">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <BackButton onClick={() => window.location.hash = '#/profile'} />
                </div>
                
                <div className="flex items-center gap-4 flex-1 justify-center px-16 md:px-20">
                    <div className="relative group flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-accent/10 rounded-xl blur-sm"></div>
                        <img src={getGuildIconPath(currentGuild?.icon || guild?.icon)} alt="Guild Icon" className="w-16 h-16 md:w-20 md:h-20 bg-tertiary rounded-xl border-2 border-accent/30 shadow-lg relative z-10" />
                        {canManage && (
                            <button
                                onClick={() => setIsIconSelectOpen(true)}
                                className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center shadow-lg hover:bg-accent/80 transition-all z-20 border-2 border-secondary"
                                title="길드 마크 변경"
                            >
                                <span className="text-xs">✏️</span>
                            </button>
                        )}
                    </div>
                    <div className="flex flex-col items-start flex-1 min-w-0 gap-1">
                        <div className="flex items-center gap-3 w-full">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-highlight to-accent bg-clip-text text-transparent drop-shadow-lg break-words">
                                {(() => {
                                    // currentGuild 객체가 없으면 로딩 중 표시
                                    if (!currentGuild) {
                                        return '로딩 중...';
                                    }
                                    
                                    // 길드명 우선순위: 
                                    // 1. guilds 상태의 최신 길드명 (guilds[guild.id]?.name)
                                    // 2. currentGuild.name
                                    // 3. guild prop의 name
                                    // 4. currentGuild.id (fallback)
                                    const guildsGuild = guilds[currentGuild.id || guild.id];
                                    const guildName = guildsGuild?.name || currentGuild?.name || guild?.name || currentGuild?.id || guild?.id || '길드명 없음';
                                    
                                    // 디버깅: 길드명이 없을 때 상세 로그
                                    if (!guildName || guildName === '길드명 없음' || guildName === currentGuild?.id || guildName === guild?.id) {
                                        console.warn('[GuildDashboard] Guild name is missing or invalid:', { 
                                            guildId: currentGuild?.id || guild?.id,
                                            guildName: guildName,
                                            guildsGuildName: guildsGuild?.name,
                                            currentGuildName: currentGuild?.name,
                                            guildPropName: guild?.name,
                                            currentGuild: currentGuild,
                                            originalGuild: guild,
                                            guildsGuild: guildsGuild,
                                            guildsState: Object.keys(guilds),
                                            guildsStateHasGuild: currentGuild?.id ? !!guilds[currentGuild.id] : false
                                        });
                                    }
                                    
                                    return guildName;
                                })()}
                            </h1>
                        </div>
                        <div className="flex items-center gap-3 w-full">
                            <div className="text-sm md:text-base lg:text-lg text-secondary font-semibold">레벨 {currentGuild?.level || 1}</div>
                            {!isMobile && (
                                <div className="flex-1 max-w-md">
                                    <div className="flex justify-between text-xs text-secondary mb-1">
                                        <span className="font-semibold">경험치</span>
                                        <span className="font-semibold">{(currentGuild?.xp ?? currentGuild?.experience ?? 0).toLocaleString()} / {xpForNextLevel.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-700/50 rounded-full h-2.5 border border-gray-600/50 overflow-hidden shadow-inner">
                                        <div 
                                            className="bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                                            style={{ width: `${xpProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!isMobile && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                        <button 
                            onClick={() => setIsHelpOpen(true)} 
                            className="p-2 rounded-xl bg-tertiary/50 hover:bg-tertiary/70 transition-all hover:scale-110 border border-accent/20 shadow-md" 
                            title="길드 도움말"
                        >
                            <img src="/images/button/help.png" alt="도움말" className="h-6 w-6" />
                        </button>
                    </div>
                )}

            </header>

            {/* 모바일 경험치 바 */}
            {isMobile && (
                <div className="w-full max-w-64 mx-auto mb-4">
                    <div className="flex justify-between text-xs text-secondary mb-1.5">
                        <span className="font-semibold">경험치</span>
                        <span className="font-semibold">{(guild.xp ?? 0).toLocaleString()} / {xpForNextLevel.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-3 border border-gray-600/50 overflow-hidden shadow-inner">
                        <div 
                            className="bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                            style={{ width: `${xpProgress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* 모바일 좌측 사이드바 (기부 + 채팅) */}
            {isMobile && (
                <>
                    <div className={`fixed top-0 left-0 h-full w-[320px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isLeftSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
                        <div className="flex items-center justify-between p-4 border-b border-color">
                            <h2 className="text-lg font-bold text-highlight">길드 기부 & 채팅</h2>
                            <button 
                                onClick={() => setIsLeftSidebarOpen(false)} 
                                className="text-2xl p-2 text-tertiary hover:text-primary"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
                            {/* 길드 기부 */}
                            <div className="flex-shrink-0">
                                <GuildDonationPanel 
                                    guildDonationAnimation={guildDonationAnimation} 
                                    onDonationComplete={onDonationComplete} 
                                    goldButtonRef={goldButtonRef} 
                                    diamondButtonRef={diamondButtonRef} 
                                />
                            </div>
                            {/* 채팅창 */}
                            <div className="flex-1 min-h-0" data-guild-chat>
                                <GuildChat guild={currentGuild || guild} myMemberInfo={myMemberInfo} />
                            </div>
                        </div>
                    </div>
                    {isLeftSidebarOpen && (
                        <div 
                            className="fixed inset-0 bg-black/50 z-40" 
                            onClick={() => setIsLeftSidebarOpen(false)}
                        ></div>
                    )}
                </>
            )}

            {/* 모바일 우측 사이드바 (활동, 보스전, 전쟁) */}
            {isMobile && (
                <>
                    <div className={`fixed top-0 right-0 h-full w-[320px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                        <div className="flex items-center justify-between p-4 border-b border-color">
                            <h2 className="text-lg font-bold text-highlight">길드 메뉴</h2>
                            <button 
                                onClick={() => setIsRightSidebarOpen(false)} 
                                className="text-2xl p-2 text-tertiary hover:text-primary"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
                            {/* 길드 활동 퀵메뉴 */}
                            <div className="flex-shrink-0">
                                <ActivityPanel 
                                    onOpenMissions={() => { setIsMissionsOpen(true); setIsRightSidebarOpen(false); }} 
                                    onOpenResearch={() => { setIsResearchOpen(true); setIsRightSidebarOpen(false); }} 
                                    onOpenShop={() => { setIsShopOpen(true); setIsRightSidebarOpen(false); }} 
                                    missionNotification={missionTabNotification}
                                    onOpenBossGuide={() => { setIsBossGuideOpen(true); setIsRightSidebarOpen(false); }}
                                />
                            </div>
                            
                            {/* 길드 보스전과 길드 전쟁을 위아래로 배치 */}
                            <div className="flex-1 flex flex-col gap-3 min-h-0">
                                <div className="flex-1 min-h-0">
                                    <BossPanel guild={currentGuild || guild} className="h-full" />
                                </div>
                                <div className="flex-1 min-h-0">
                                    <WarPanel guild={currentGuild || guild} className="h-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {isRightSidebarOpen && (
                        <div 
                            className="fixed inset-0 bg-black/50 z-40" 
                            onClick={() => setIsRightSidebarOpen(false)}
                        ></div>
                    )}
                </>
            )}

            <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-4 min-h-0">
                    {!isMobile && (
                        <div className="flex-shrink-0">
                            <div className="flex bg-gradient-to-r from-stone-800/80 to-stone-700/60 p-1 rounded-xl w-full max-w-md border border-stone-600/40 shadow-md">
                                {tabs.map(tab => {
                                    const tabColors = {
                                        home: { active: 'from-amber-600 to-amber-500', inactive: 'text-amber-300/70 hover:text-amber-300' },
                                        members: { active: 'from-blue-600 to-blue-500', inactive: 'text-blue-300/70 hover:text-blue-300' },
                                        management: { active: 'from-purple-600 to-purple-500', inactive: 'text-purple-300/70 hover:text-purple-300' },
                                    };
                                    const colors = tabColors[tab.id] || { active: 'from-accent to-accent/80', inactive: 'text-tertiary hover:text-highlight' };
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                                activeTab === tab.id 
                                                    ? `bg-gradient-to-r ${colors.active} text-white shadow-lg` 
                                                    : `${colors.inactive} hover:bg-stone-700/50`
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {activeTab === 'home' && (
                            <div className={`flex flex-col ${isMobile ? 'gap-4 h-full' : 'gap-4 h-full'}`}>
                                {isMobile ? (
                                    <>
                                        {/* 모바일: 출석부와 공지만 표시 */}
                                        <div className="flex-shrink-0">
                                            <GuildCheckInPanel guild={currentGuild || guild} />
                                        </div>
                                        {/* 사이드 버튼들 - 출석부와 공지 사이 */}
                                        <div className="flex items-center justify-between gap-2 py-2 flex-shrink-0">
                                            {/* 좌측 사이드 버튼 */}
                                            <button 
                                                onClick={() => setIsLeftSidebarOpen(true)} 
                                                className="flex-1 h-12 bg-secondary/80 backdrop-blur-sm rounded-lg flex items-center justify-center text-primary shadow-lg hover:bg-secondary transition-colors border border-accent/20"
                                                aria-label="왼쪽 사이드바 열기"
                                            >
                                                <span className="font-bold text-xl">{'<'}</span>
                                                <span className="ml-2 text-sm font-semibold">기부 & 채팅</span>
                                            </button>
                                            {/* 우측 사이드 버튼 */}
                                            <button 
                                                onClick={() => setIsRightSidebarOpen(true)} 
                                                className="flex-1 h-12 bg-secondary/80 backdrop-blur-sm rounded-lg flex items-center justify-center text-primary shadow-lg hover:bg-secondary transition-colors border border-accent/20"
                                                aria-label="오른쪽 사이드바 열기"
                                            >
                                                <span className="font-bold text-xl">{'>'}</span>
                                                <span className="mr-2 text-sm font-semibold">길드 메뉴</span>
                                            </button>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <GuildAnnouncementPanel guild={currentGuild || guild} />
                                        </div>
                                    </>
                                ) : (
                                    <GuildHomePanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} />
                                )}
                            </div>
                        )}
                        {activeTab === 'members' && (
                            <NineSlicePanel className="h-full">
                                <GuildMembersPanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} />
                            </NineSlicePanel>
                        )}
                        {activeTab === 'management' && canManage && (
                            <NineSlicePanel className="h-full">
                                <GuildManagementPanel guild={currentGuild || guild} />
                            </NineSlicePanel>
                        )}
                    </div>
                </div>

                <RightPanel guildDonationAnimation={guildDonationAnimation} onDonationComplete={onDonationComplete} goldButtonRef={goldButtonRef} diamondButtonRef={diamondButtonRef} />
                
            </main>
            {goldAnimation}
            {diamondAnimation}
            </div>
            </div>
        </div>
    );
};