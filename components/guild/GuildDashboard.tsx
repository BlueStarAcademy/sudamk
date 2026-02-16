import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Guild as GuildType, UserWithStatus, GuildBossInfo, QuestReward, GuildMember, GuildMemberRole, CoreStat, GuildResearchId, GuildResearchCategory, ItemGrade, ServerAction, GuildBossSkill } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import GuildHomePanel, { GuildChat, GuildCheckInPanel, GuildAnnouncementPanel } from './GuildHomePanel.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, AVATAR_POOL, BORDER_POOL, emptySlotImages, slotNames, GUILD_BOSS_MAX_ATTEMPTS, GUILD_INITIAL_MEMBER_LIMIT, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_GOLD_COST, GUILD_DONATION_DIAMOND_COST, GUILD_CHECK_IN_MILESTONE_REWARDS, GUILD_DONATION_GOLD_REWARDS, GUILD_DONATION_DIAMOND_REWARDS, ADMIN_USER_ID, ADMIN_NICKNAME } from '../../constants/index.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import NineSlicePanel from '../ui/NineSlicePanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import HelpModal from '../HelpModal.js';
import QuickAccessSidebar from '../QuickAccessSidebar.js';
import GuildWarRewardModal from './GuildWarRewardModal.js';
import GuildWarMatchingModal from './GuildWarMatchingModal.js';
import GuildWarCancelConfirmModal from './GuildWarCancelConfirmModal.js';
import GuildWarApplicationDayOnlyModal from './GuildWarApplicationDayOnlyModal.js';
import { getTimeUntilNextMondayKST, isSameDayKST, isDifferentWeekKST, formatDateTimeKST, getStartOfDayKST, getKSTDay } from '../../utils/timeUtils.js';

// 고급 버튼 스타일 (길드 패널용)
const guildPanelBtnBase = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold tracking-wide transition-all duration-200 px-4 py-2 text-sm border backdrop-blur-sm';
const guildPanelBtn = {
    boss: `${guildPanelBtnBase} border-cyan-400/40 bg-gradient-to-br from-blue-600/90 via-cyan-500/85 to-blue-600/90 text-white shadow-[0_4px_14px_-2px_rgba(34,211,238,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(34,211,238,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    war: `${guildPanelBtnBase} border-red-400/40 bg-gradient-to-br from-red-600/90 via-rose-500/85 to-red-600/90 text-white shadow-[0_4px_14px_-2px_rgba(244,63,94,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(244,63,94,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    participate: `${guildPanelBtnBase} border-purple-400/40 bg-gradient-to-br from-purple-600/90 via-violet-500/85 to-purple-600/90 text-white shadow-[0_4px_14px_-2px_rgba(168,85,247,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(168,85,247,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    cancel: `${guildPanelBtnBase} border-rose-400/40 bg-gradient-to-br from-rose-700/90 via-red-600/85 to-rose-700/90 text-white shadow-[0_4px_14px_-2px_rgba(244,63,94,0.35)] hover:shadow-[0_6px_20px_-2px_rgba(244,63,94,0.45)] hover:-translate-y-0.5 active:translate-y-0`,
    reward: `${guildPanelBtnBase} border-emerald-400/40 bg-gradient-to-br from-emerald-600/90 via-teal-500/85 to-emerald-600/90 text-white shadow-[0_4px_14px_-2px_rgba(20,184,166,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(20,184,166,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    disabled: `${guildPanelBtnBase} border-stone-500/30 bg-stone-800/60 text-stone-400 cursor-not-allowed opacity-70`,
};

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

const GuildDonationPanel: React.FC<{ guild?: GuildType | null; guildDonationAnimation: { coins: number; research: number; type: 'gold' | 'diamond' } | null; onDonationComplete?: (coins: number, research: number, type: 'gold' | 'diamond') => void; goldButtonRef: React.RefObject<HTMLDivElement>; diamondButtonRef: React.RefObject<HTMLDivElement> }> = ({ guild, guildDonationAnimation, onDonationComplete, goldButtonRef, diamondButtonRef }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    const [isDonating, setIsDonating] = useState(false);
    const [donationType, setDonationType] = useState<'gold' | 'diamond' | null>(null);
    const [donationModal, setDonationModal] = useState<{ type: 'gold' | 'diamond'; count: number } | null>(null);
    const donationInFlight = useRef(false);
    const now = Date.now();
    const dailyDonations = (currentUserWithStatus?.dailyDonations && isSameDayKST(currentUserWithStatus.dailyDonations.date, now))
        ? currentUserWithStatus.dailyDonations
        : { gold: 0, diamond: 0, date: now };

    const goldDonationsLeft = GUILD_DONATION_GOLD_LIMIT - dailyDonations.gold;
    const diamondDonationsLeft = GUILD_DONATION_DIAMOND_LIMIT - dailyDonations.diamond;
    const goldMaxCount = Math.min(goldDonationsLeft, Math.floor((currentUserWithStatus?.gold ?? 0) / GUILD_DONATION_GOLD_COST));
    const diamondMaxCount = Math.min(diamondDonationsLeft, Math.floor((currentUserWithStatus?.diamonds ?? 0) / GUILD_DONATION_DIAMOND_COST));

    const canDonateGold = goldMaxCount > 0;
    const canDonateDiamond = diamondMaxCount > 0;

    const handleDonate = async (type: 'GUILD_DONATE_GOLD' | 'GUILD_DONATE_DIAMOND', count: number) => {
        if (donationInFlight.current || count < 1) return;
        donationInFlight.current = true;
        setIsDonating(true);
        setDonationType(type === 'GUILD_DONATE_GOLD' ? 'gold' : 'diamond');
        setDonationModal(null);
        try {
            const result = await handlers.handleAction({ type, payload: { count } }) as any;
            if (result?.error) {
                alert(result.error);
                setDonationType(null);
            } else {
                const donationResult = result?.clientResponse?.donationResult || result?.donationResult;
                if (donationResult && onDonationComplete) {
                    onDonationComplete(donationResult.coins, donationResult.research, type === 'GUILD_DONATE_GOLD' ? 'gold' : 'diamond');
                }
                await handlers.handleAction({ type: 'GET_GUILD_INFO' });
            }
        } catch (error) {
            alert('기부 중 오류가 발생했습니다.');
            setDonationType(null);
        } finally {
            setIsDonating(false);
            donationInFlight.current = false;
        }
    };

    const openDonationModal = (type: 'gold' | 'diamond') => {
        const max = type === 'gold' ? goldMaxCount : diamondMaxCount;
        setDonationModal({ type, count: Math.min(1, max) });
    };

    const donationRecords = [...(guild?.donationLog || [])].reverse();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    return (
        <div className="bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 p-3 rounded-xl flex flex-col gap-3 relative overflow-hidden border-2 border-stone-600/60 shadow-2xl backdrop-blur-md flex-1 min-h-[200px]" style={{ minHeight: '200px' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none rounded-xl" />
            <h3 className="font-bold text-base text-highlight text-center relative z-10 flex items-center justify-center gap-2 drop-shadow-lg flex-shrink-0">
                <span className="text-lg">💎</span>
                <span>길드 기부</span>
            </h3>

            <div className="flex flex-col md:flex-row gap-3 relative z-10 min-w-0 flex-1 items-stretch">
            {/* 좌측: 기부 버튼 - 가운데 정렬, 기부 기록과 균형 맞춤 */}
            <div className="flex-[1] flex flex-col md:flex-row gap-2 md:gap-4 min-w-0 shrink-0 justify-center items-center md:items-stretch">
                {/* 골드 기부 */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-[100px] max-w-[140px] shrink-0 items-center justify-center">
                    <div className="text-xs text-amber-200 font-semibold whitespace-nowrap text-center w-full">골드 기부</div>
                    <div ref={goldButtonRef} className="w-full min-w-0">
                        <Button
                            onClick={() => openDonationModal('gold')}
                            disabled={!canDonateGold || isDonating}
                            colorScheme="none"
                            className={`w-full justify-center rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 font-bold text-sm py-2.5 px-2 shadow-[0_1px_2px_rgba(0,0,0,0.3)] [text-shadow:0_1px_0_rgba(255,255,255,0.3)] flex flex-col items-center gap-0.5 leading-tight ${!canDonateGold || isDonating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isDonating && donationType === 'gold' ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <>
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                        <img src="/images/icon/Gold.png" alt="골드" className="w-4 h-4 flex-shrink-0" />
                                        <span>{GUILD_DONATION_GOLD_COST.toLocaleString()}</span>
                                    </span>
                                    <span className="text-[10px] opacity-90">{goldDonationsLeft}/{GUILD_DONATION_GOLD_LIMIT}</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* 다이아 기부 */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-[100px] max-w-[140px] shrink-0 items-center justify-center">
                    <div className="text-xs text-blue-200 font-semibold whitespace-nowrap text-center w-full">다이아 기부</div>
                    <div ref={diamondButtonRef} className="w-full min-w-0">
                        <Button
                            onClick={() => openDonationModal('diamond')}
                            disabled={!canDonateDiamond || isDonating}
                            colorScheme="none"
                            className={`w-full justify-center rounded-xl border border-sky-400/50 bg-gradient-to-r from-sky-400/90 via-blue-500/90 to-indigo-500/90 text-white font-bold text-sm py-2.5 px-2 shadow-[0_1px_2px_rgba(0,0,0,0.3)] drop-shadow-[0_0_1px_rgba(0,0,0,0.8)] flex flex-col items-center gap-0.5 leading-tight ${!canDonateDiamond || isDonating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isDonating && donationType === 'diamond' ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <>
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                        <img src="/images/icon/Zem.png" alt="다이아" className="w-4 h-4 flex-shrink-0" />
                                        <span>{GUILD_DONATION_DIAMOND_COST.toLocaleString()}</span>
                                    </span>
                                    <span className="text-[10px] opacity-90">{diamondDonationsLeft}/{GUILD_DONATION_DIAMOND_LIMIT}</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* 우측: 기부 기록 - 길드 공지 스타일 내부 박스 */}
            <div className="flex-[1.5] min-w-0 flex flex-col relative z-10 border-t md:border-t-0 md:border-l border-stone-600/50 pt-2 md:pt-0 md:pl-3">
                <div className="text-xs font-semibold text-highlight mb-1">기부 기록</div>
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                    <div className="bg-tertiary/50 rounded-lg p-3 min-h-[80px] border-2 border-black/20 shadow-inner backdrop-blur-sm h-full">
                        <div className="space-y-0.5 text-[10px] md:text-xs text-secondary h-full overflow-y-auto">
                            {donationRecords.length === 0 ? (
                                <div className="text-stone-500 py-1">기록 없음</div>
                            ) : (
                                donationRecords.map((log, idx) => (
                                    <div key={idx} className="leading-tight truncate" title={`${log.nickname} ${log.type === 'gold' ? '골드' : '다이아'}${log.count}회 : 길드코인 ${log.coins} + RP ${log.research}`}>
                                        <span className="text-amber-200/90">[{log.nickname}]</span>
                                        {log.type === 'gold' ? '골드' : '다이아'}{log.count}회기부 :{' '}
                                        <img src="/images/guild/tokken.png" alt="코인" className="w-2.5 h-2.5 inline align-middle" />
                                        <span className="font-semibold text-amber-200">{log.coins}</span>
                                        {' + '}
                                        <img src="/images/guild/button/guildlab.png" alt="RP" className="w-2.5 h-2.5 inline align-middle" />
                                        <span className="font-semibold text-blue-200">{log.research}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            </div>

            {/* 기부 횟수 선택 모달 - createPortal로 document.body에 렌더링 */}
            {donationModal && createPortal(
                <div className="fixed inset-0 flex items-center justify-center z-[99999]" style={{ isolation: 'isolate' }}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDonationModal(null)} />
                    <div 
                        className={`relative rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden border-2 ${donationModal.type === 'gold' ? 'border-amber-400/50 shadow-amber-500/20' : 'border-sky-400/50 shadow-sky-500/20'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 헤더 - 그라데이션 */}
                        <div className={`px-6 py-4 ${donationModal.type === 'gold' ? 'bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-yellow-500/90' : 'bg-gradient-to-r from-sky-600/90 via-blue-500/90 to-indigo-500/90'}`}>
                            <div className="flex items-center gap-2">
                                <img src={donationModal.type === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt="" className="w-8 h-8 drop-shadow-lg" />
                                <h3 className="font-bold text-lg text-white drop-shadow-md">
                                    {donationModal.type === 'gold' ? '골드' : '다이아'} 기부
                                </h3>
                            </div>
                        </div>
                        {/* 본문 */}
                        <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-6">
                            {/* 보상 미리보기 카드 */}
                            <div className="rounded-xl bg-stone-800/80 border border-stone-600/50 p-4 mb-5">
                                <div className="text-xs text-stone-400 font-semibold mb-2">1회당 보상</div>
                                <div className="flex items-center justify-center gap-6">
                                    <span className="flex items-center gap-2 text-amber-300 font-bold">
                                        <img src="/images/guild/tokken.png" alt="" className="w-5 h-5" />
                                        {donationModal.type === 'gold' ? `${GUILD_DONATION_GOLD_REWARDS.guildCoins[0]}~${GUILD_DONATION_GOLD_REWARDS.guildCoins[1]}` : `${GUILD_DONATION_DIAMOND_REWARDS.guildCoins[0]}~${GUILD_DONATION_DIAMOND_REWARDS.guildCoins[1]}`}
                                    </span>
                                    <span className="flex items-center gap-2 text-blue-300 font-bold">
                                        <img src="/images/guild/button/guildlab.png" alt="" className="w-5 h-5" />
                                        {donationModal.type === 'gold' ? `${GUILD_DONATION_GOLD_REWARDS.researchPoints[0]}~${GUILD_DONATION_GOLD_REWARDS.researchPoints[1]} RP` : `${GUILD_DONATION_DIAMOND_REWARDS.researchPoints[0]}~${GUILD_DONATION_DIAMOND_REWARDS.researchPoints[1]} RP`}
                                    </span>
                                </div>
                            </div>
                            {/* 횟수 선택: +, -, Max로 조절 */}
                            <div className="mb-5">
                                <div className="text-xs text-stone-400 font-semibold mb-2">기부 횟수 (최대 {donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount}회)</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="w-12 h-12 rounded-xl bg-stone-700/80 hover:bg-stone-600 border border-stone-500/50 text-white font-bold text-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                                        onClick={() => setDonationModal(m => m ? { ...m, count: Math.max(1, m.count - 1) } : null)}
                                    >−</button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount}
                                        value={donationModal.count}
                                        onChange={e => {
                                            const v = parseInt(e.target.value, 10);
                                            const max = donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount;
                                            if (!isNaN(v)) setDonationModal(m => m ? { ...m, count: Math.min(max, Math.max(1, v)) } : null);
                                        }}
                                        className={`flex-1 bg-stone-800/80 rounded-xl px-4 py-3 text-center text-white font-bold text-lg border border-stone-600/50 focus:outline-none focus:ring-2 ${donationModal.type === 'gold' ? 'focus:ring-amber-400/50' : 'focus:ring-sky-400/50'}`}
                                    />
                                    <button
                                        className="w-12 h-12 rounded-xl bg-stone-700/80 hover:bg-stone-600 border border-stone-500/50 text-white font-bold text-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                                        onClick={() => setDonationModal(m => m ? { ...m, count: Math.min(donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount, m.count + 1) } : null)}
                                    >+</button>
                                    <button
                                        className={`px-3 py-2 rounded-xl font-bold text-white text-sm transition-all hover:scale-105 active:scale-95 flex-shrink-0 ${donationModal.type === 'gold' ? 'bg-amber-600/80 hover:bg-amber-500/90 border border-amber-500/50' : 'bg-sky-600/80 hover:bg-sky-500/90 border border-sky-500/50'}`}
                                        onClick={() => {
                                            const max = donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount;
                                            setDonationModal(m => m ? { ...m, count: max } : null);
                                        }}
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>
                            {/* 취소 / 기부하기 */}
                            <div className="flex gap-3">
                                <button
                                    className="flex-1 py-3 rounded-xl bg-stone-700/80 hover:bg-stone-600 border border-stone-500/50 text-stone-200 font-semibold transition-all"
                                    onClick={() => setDonationModal(null)}
                                >취소</button>
                                <button
                                    className={`flex-[2] py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${donationModal.type === 'gold' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-500/30' : 'bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 shadow-lg shadow-sky-500/30'}`}
                                    onClick={() => handleDonate(donationModal.type === 'gold' ? 'GUILD_DONATE_GOLD' : 'GUILD_DONATE_DIAMOND', donationModal.count)}
                                >
                                    기부하기 ({donationModal.count}회)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
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

const BOSS_SKILL_TOOLTIP_HIDE_DELAY_MS = 200;

const BossPanel: React.FC<{ guild: GuildType, className?: string }> = ({ guild, className }) => {
    const { currentUserWithStatus } = useAppContext();
    const [hoveredSkill, setHoveredSkill] = useState<GuildBossSkill | null>(null);
    const [clickedSkill, setClickedSkill] = useState<GuildBossSkill | null>(null);
    const [skillTooltipPos, setSkillTooltipPos] = useState<{ top: number; left: number } | null>(null);
    const skillIconRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const tooltipHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (tooltipHideTimeoutRef.current) clearTimeout(tooltipHideTimeoutRef.current);
    }, []);

    // 나의 기록 계산
    const { myDamage, myRank, totalParticipants } = useMemo(() => {
        if (!guild.guildBossState?.totalDamageLog || !currentUserWithStatus) {
            return { myDamage: 0, myRank: null, totalParticipants: 0 };
        }
        
        const damageLog = guild.guildBossState.totalDamageLog || {} as Record<string, number>;
        const fullRanking = Object.entries(damageLog)
            .map(([userId, damage]: [string, any]) => {
                let member = guild.members?.find((m: GuildMember) => m.userId === userId);
                if (!member && userId === ADMIN_USER_ID) {
                    member = guild.members?.find((m: GuildMember) => m.nickname === ADMIN_NICKNAME);
                }
                const nickname = member?.nickname || (userId === ADMIN_USER_ID ? ADMIN_NICKNAME : '알 수 없음');
                return { userId, nickname, damage: typeof damage === 'number' ? damage : 0 };
            })
            .sort((a, b) => b.damage - a.damage);
        
        const myRankIndex = fullRanking.findIndex(r => r.userId === currentUserWithStatus.id);
        const myData = myRankIndex !== -1 ? { ...fullRanking[myRankIndex], rank: myRankIndex + 1 } : null;
        
        return {
            myDamage: myData?.damage || 0,
            myRank: myData?.rank || null,
            totalParticipants: fullRanking.length,
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
        <div className={`bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 ${isMobile ? 'p-2' : 'p-4'} rounded-xl border-2 border-stone-600/60 shadow-lg flex flex-col items-center text-center w-full relative overflow-hidden h-full ${className || ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className="relative z-10 w-full flex flex-col h-full min-h-0">
                <h3 className={`font-bold ${isMobile ? 'text-sm' : 'text-lg'} text-highlight ${isMobile ? 'mb-1' : 'mb-3'} flex items-center justify-center gap-2 flex-shrink-0`}>
                    <span className={isMobile ? 'text-base' : 'text-2xl'}>⚔️</span>
                    <span>길드 보스전</span>
                </h3>
                <div className={`flex flex-col ${isMobile ? 'mb-1' : 'mb-3'} flex-shrink-0`}>
                    {/* 보스 이름 */}
                    <p className={`${isMobile ? 'text-xs' : 'text-base'} font-bold text-highlight ${isMobile ? 'mb-0.5' : 'mb-2'} text-center`}>{currentBoss.name}</p>
                    
                    {/* 가로로 둘로 나눔: 왼쪽(보스+스킬) | 오른쪽(내 기록) */}
                    <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-2 w-full`}>
                        {/* 왼쪽: 보스 이미지 + 스킬(아래 가로 배치) */}
                        <div className={`flex flex-col ${isMobile ? 'items-center' : 'flex-1 min-w-0'} gap-2`}>
                            <div className="flex flex-col items-center">
                                {/* 보스 이미지 (확대) */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                    <div className={`${isMobile ? 'w-24 h-24' : 'w-36 h-36'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-xl flex items-center justify-center border border-stone-600/50 shadow-lg`}>
                                        <img src={currentBoss.image} alt={currentBoss.name} className={`${isMobile ? 'w-20 h-20' : 'w-32 h-32'} drop-shadow-lg object-contain`} />
                                    </div>
                                    {/* 체력 바 */}
                                    <div className={`${isMobile ? 'w-24' : 'w-36'} ${isMobile ? 'mt-1' : 'mt-1.5'} relative`}>
                                        <div className={`w-full bg-gray-700/50 rounded-full ${isMobile ? 'h-1.5' : 'h-2'} border border-gray-600/50 overflow-hidden shadow-inner relative`}>
                                            <div 
                                                className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(217,119,6,0.5)]"
                                                style={{ width: `${hpPercent}%` }}
                                            ></div>
                                            <span className={`absolute inset-0 flex items-center justify-center ${isMobile ? 'text-[9px]' : 'text-[10px]'} font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                                                {hpPercent.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* 스킬들 - 이미지 아래 가로 배치 */}
                                {currentBoss.skills && currentBoss.skills.length > 0 && (
                                    <div className={`flex relative ${isMobile ? 'flex-row gap-1 mt-1' : 'flex-row gap-2 mt-2'} items-center justify-center`}>
                                    {currentBoss.skills.slice(0, 3).map((skill) => (
                                        <div key={skill.id} className="relative">
                                            <div
                                                ref={(el) => { skillIconRefs.current[skill.id] = el; }}
                                                className={`${isMobile ? 'w-7 h-7' : 'w-10 h-10'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-lg flex items-center justify-center border border-stone-600/50 shadow-lg cursor-pointer hover:scale-110 transition-transform`}
                                            onMouseEnter={(e) => {
                                                if (tooltipHideTimeoutRef.current) {
                                                    clearTimeout(tooltipHideTimeoutRef.current);
                                                    tooltipHideTimeoutRef.current = null;
                                                }
                                                setHoveredSkill(skill);
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setSkillTooltipPos({
                                                    top: rect.top,
                                                    left: rect.left + rect.width / 2,
                                                });
                                            }}
                                            onMouseLeave={() => {
                                                tooltipHideTimeoutRef.current = setTimeout(() => {
                                                    setHoveredSkill(null);
                                                    setSkillTooltipPos(null);
                                                    tooltipHideTimeoutRef.current = null;
                                                }, BOSS_SKILL_TOOLTIP_HIDE_DELAY_MS);
                                            }}
                                            onClick={() => setClickedSkill(clickedSkill?.id === skill.id ? null : skill)}
                                        >
                                                <img src={skill.image} alt={skill.name} className={`${isMobile ? 'w-5 h-5' : 'w-8 h-8'} object-contain drop-shadow-md`} />
                                                {skill.type === 'passive' && (
                                                    <div className={`absolute -top-0.5 -right-0.5 ${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-purple-500 rounded-full flex items-center justify-center`}>
                                                        <span className={`${isMobile ? 'text-[4px]' : 'text-[5px]'} text-white font-bold`}>P</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* 호버 시 툴팁 */}
                                            {hoveredSkill?.id === skill.id && skillTooltipPos && (
                                            <div 
                                                className="fixed z-[9999] w-64 bg-gradient-to-br from-stone-900/98 via-neutral-800/95 to-stone-900/98 border-2 border-stone-600/60 rounded-xl shadow-2xl p-3 backdrop-blur-md"
                                                style={{
                                                    bottom: `calc(100vh - ${skillTooltipPos.top}px + 8px)`,
                                                    left: `${skillTooltipPos.left}px`,
                                                    transform: 'translateX(-50%)',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.stopPropagation();
                                                    if (tooltipHideTimeoutRef.current) {
                                                        clearTimeout(tooltipHideTimeoutRef.current);
                                                        tooltipHideTimeoutRef.current = null;
                                                    }
                                                    setHoveredSkill(skill);
                                                }}
                                                onMouseLeave={() => {
                                                    setHoveredSkill(null);
                                                    setSkillTooltipPos(null);
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
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* 오른쪽: 내 기록 */}
                        <div className={`flex flex-col ${isMobile ? 'w-full' : 'flex-1 min-w-0'} justify-center`}>
                            <div className={`bg-stone-800/50 rounded-lg ${isMobile ? 'px-1.5 py-0.5' : 'px-3 py-2'}`}>
                                <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-stone-400 ${isMobile ? 'mb-0.5' : 'mb-2'} font-semibold`}>나의 기록</div>
                                <div className={`flex flex-col ${isMobile ? 'gap-0.5' : 'gap-1.5'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-stone-300`}>랭킹</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-bold text-highlight`}>
                                            {myRank !== null ? `${myRank}위` : '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-stone-300`}>총 데미지</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-bold text-amber-300`}>{myDamage.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-stone-300`}>현재순위</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-bold text-cyan-300`}>
                                            {totalParticipants > 0 && myRank !== null ? `${totalParticipants}명 중 ${myRank}위` : '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-stone-300`}>역대 최고 기록</span>
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-bold text-yellow-300`}>
                                            {(guild.guildBossState?.maxDamageLog?.[currentUserWithStatus?.id || ''] || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* 클릭 시 상세 정보 모달 (스킬용) */}
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
                    
                    {/* 남은 시간 */}
                    <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-tertiary bg-gray-800/50 px-2 py-1 rounded-md ${isMobile ? 'mt-0.5 mb-0.5' : 'mt-2 mb-2'} text-center`}>{timeLeft}</p>
                </div>
                <div className="w-full flex-1 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0" />
                    {/* 입장하기 버튼 - 하단 고정 */}
                    <div className={`flex-shrink-0 ${isMobile ? 'mt-1 pt-1' : 'mt-2 pt-2'} border-t border-stone-600/40 flex justify-center`}>
                        <button
                            onClick={() => window.location.hash = '#/guildboss'}
                            disabled={!canEnter}
                            className={canEnter ? guildPanelBtn.boss : guildPanelBtn.disabled}
                        >
                            <img src="/images/guild/ticket.png" alt="보스전 티켓" className="w-4 h-4" />
                            <span>{myBossTickets}/{GUILD_BOSS_MAX_ATTEMPTS}</span>
                            <span>입장</span>
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
    const [isMatching, setIsMatching] = React.useState(() => !!(guild as any).guildWarMatching);
    const [isStarting, setIsStarting] = React.useState(false);
    const [isCanceling, setIsCanceling] = React.useState(false);
    const [nextMatchTime, setNextMatchTime] = React.useState<number | undefined>(undefined);
    const [timeRemaining, setTimeRemaining] = React.useState<string>('');
    const [showMatchingModal, setShowMatchingModal] = React.useState(false);
    const [matchingModalMessage, setMatchingModalMessage] = React.useState('');
    /** 매칭 완료/대기 시 모달에 표시할 이번 길드전 시작 시각 (화/금 0시) */
    const [matchingModalWarStartTime, setMatchingModalWarStartTime] = React.useState<number | undefined>(undefined);
    const [warActionCooldown, setWarActionCooldown] = React.useState<number | null>(null);
    const [cancelDeadline, setCancelDeadline] = React.useState<number | null>(null);
    const [applicationDeadline, setApplicationDeadline] = React.useState<number | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = React.useState<string>('');
    const [warStats, setWarStats] = React.useState<{ totalWins: number; totalLosses: number; winRate: number; lastOpponent: { name: string; isWin: boolean; ourStars: number; enemyStars: number; ourScore: number; enemyScore: number; guildXp?: number; researchPoints?: number } | null; myRecordInLastWar?: { contributedStars: number } | null } | null>(null);
    const [myRecordInCurrentWar, setMyRecordInCurrentWar] = React.useState<{ attempts: number; maxAttempts?: number; contributedStars: number } | null>(null);
    const [showCancelConfirmModal, setShowCancelConfirmModal] = React.useState(false);
    const [showApplicationDayOnlyModal, setShowApplicationDayOnlyModal] = React.useState(false);
    const [nextApplicationDayLabel, setNextApplicationDayLabel] = React.useState('');
    const GUILD_WAR_MAX_ATTEMPTS = 3; // 기본 표시용 (실제는 전쟁별 2/3)
    
    // 길드장/부길드장 권한 확인 (관리자는 effectiveUserId로 비교 - 서버와 동일)
    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;
    const myMemberInfo = React.useMemo(() => {
        if (!effectiveUserId) return undefined;
        return guild.members?.find(m => m.userId === effectiveUserId);
    }, [guild.members, effectiveUserId]);
    
    const canStartWar = guild.leaderId === effectiveUserId || myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';

    // guild.guildWarMatching 변경 시 동기화 (broadcast, GET_GUILD_WAR_DATA 등으로 길드가 갱신된 경우)
    React.useEffect(() => {
        const gw = (guild as any).guildWarMatching;
        if (typeof gw === 'boolean') {
            setIsMatching(gw);
            if (gw) {
                lastAppliedAtRef.current = Date.now();
                const now = Date.now();
                const todayStart = getStartOfDayKST(now);
                setNextMatchTime(prev => prev ?? todayStart + 24 * 60 * 60 * 1000);
                setCancelDeadline(prev => prev ?? todayStart + 24 * 60 * 60 * 1000 - 60 * 60 * 1000);
            } else {
                lastAppliedAtRef.current = 0;
                setNextMatchTime(undefined);
                setCancelDeadline(null);
            }
        }
    }, [(guild as any).guildWarMatching]);

    // handlers.handleAction을 ref로 저장하여 무한 루프 방지
    const handleActionRef = React.useRef(handlers.handleAction);
    React.useEffect(() => {
        handleActionRef.current = handlers.handleAction;
    }, [handlers.handleAction]);

    // 무한루프 방지를 위한 ref
    const isFetchingRef = React.useRef(false);
    const lastFetchTimeRef = React.useRef(0);
    const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const matchingJustStartedAtRef = React.useRef<number>(0); // 전쟁 참여 직후 isMatching 덮어쓰기 방지
    const lastAppliedAtRef = React.useRef<number>(0); // 참여 신청한 시각 - 신청 마감 전까지 isMatching 유지
    const FETCH_COOLDOWN = 30000; // 30초 쿨다운 (interval과 동일하게)
    
    React.useEffect(() => {
        // 길드전 데이터 가져오기
        const fetchWarData = async () => {
            // 이미 fetch 중이거나 쿨다운 중이면 스킵
            const now = Date.now();
            if (isFetchingRef.current || (now - lastFetchTimeRef.current < FETCH_COOLDOWN)) {
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
                const appDeadline = result?.clientResponse?.applicationDeadline ?? null;
                const ts = matchingJustStartedAtRef.current;
                const justStarted = ts > 0 && (Date.now() - ts) < 60000;
                const myGuildFromResponse = allGuilds[guild.id];
                const gwFromGuild = (myGuildFromResponse as any)?.guildWarMatching;
                const serverSaysMatching = matching || gwFromGuild === true;
                const stillBeforeDeadline = lastAppliedAtRef.current > 0 && (appDeadline == null || Date.now() < appDeadline);
                if (justStarted || (stillBeforeDeadline && !serverSaysMatching)) {
                    setIsMatching(true);
                } else {
                    setIsMatching(serverSaysMatching);
                    if (!serverSaysMatching) lastAppliedAtRef.current = 0;
                }
                setNextMatchTime(nextMatch);
                setCancelDeadline(matching ? (result?.clientResponse?.cancelDeadline ?? null) : null);
                setApplicationDeadline(result?.clientResponse?.applicationDeadline ?? null);
                const wr = result?.clientResponse?.warStats ?? null;
                setWarStats(wr);
                setMyRecordInCurrentWar(result?.clientResponse?.myRecordInCurrentWar ?? null);
                
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
                if (effectiveUserId) {
                    const attempts = war.dailyAttempts?.[effectiveUserId]?.[today] || 0;
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
        
        // 초기 로드 (쿨다운 무시하여 즉시 fetch)
        lastFetchTimeRef.current = 0;
        fetchWarData();
        
        // 탭 포커스 시 refetch (매칭 상태 등 최신화)
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                lastFetchTimeRef.current = 0;
                fetchWarData();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        
        // 30초마다 갱신
        intervalRef.current = setInterval(() => {
            fetchWarData();
        }, 30000);
        
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
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
        const kstDay = getKSTDay(Date.now());
        const isApplicationDay = kstDay === 1 || kstDay === 4;
        if (!isApplicationDay) {
            const dayBeforeMatch = nextMatchTime != null ? nextMatchTime - 24 * 60 * 60 * 1000 : null;
            const dayBeforeKst = dayBeforeMatch != null ? getKSTDay(dayBeforeMatch) : null;
            const label = dayBeforeKst === 1 ? '월요일 0:00 ~ 23:00' : dayBeforeKst === 4 ? '목요일 0:00 ~ 23:00' : '월요일 또는 목요일 0:00 ~ 23:00';
            setNextApplicationDayLabel(label);
            setShowApplicationDayOnlyModal(true);
            return;
        }
        if (isMatching) {
            setMatchingModalMessage('이미 참가 신청중입니다.');
            setShowMatchingModal(true);
            return;
        }
        if (warActionCooldown && Date.now() < warActionCooldown) {
            alert(`전쟁 취소 후 1시간이 지나야 신청할 수 있습니다. (남은 시간: ${cooldownRemaining})`);
            return;
        }
        setIsStarting(true);
        matchingJustStartedAtRef.current = 0;
        try {
            const result = await handlers.handleAction({ type: 'START_GUILD_WAR' }) as any;
            if (result?.error) {
                const isAlreadyMatching = result.error.includes('이미 매칭') || result.error.includes('이미 참가');
                if (isAlreadyMatching) {
                    lastAppliedAtRef.current = Date.now();
                    setIsMatching(true);
                    setMatchingModalMessage('이미 참가 신청중입니다.');
                    setMatchingModalWarStartTime(undefined);
                    setShowMatchingModal(true);
                    const fetchResult = await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' }) as any;
                    if (fetchResult?.clientResponse) {
                        const fr = fetchResult.clientResponse;
                        setNextMatchTime(fr.nextMatchTime ?? undefined);
                        setCancelDeadline(fr.cancelDeadline ?? null);
                        setApplicationDeadline(fr.applicationDeadline ?? null);
                        if (fr.nextMatchTime != null) setMatchingModalWarStartTime(fr.nextMatchTime);
                    }
                } else {
                    alert(result.error);
                }
            } else {
                matchingJustStartedAtRef.current = Date.now();
                lastAppliedAtRef.current = Date.now();
                const cr = result?.clientResponse;
                // 응답에서 즉시 isMatching, nextMatchTime, cancelDeadline 반영 (API 응답 우선)
                setIsMatching(cr?.isMatching ?? true);
                setNextMatchTime(cr?.nextMatchTime ?? undefined);
                setCancelDeadline(cr?.cancelDeadline ?? null);
                setMatchingModalMessage(cr?.message || '매칭 신청이 완료되었습니다. 화요일·금요일 0시에 매칭됩니다.');
                setMatchingModalWarStartTime(cr?.nextMatchTime ?? undefined);
                setShowMatchingModal(true);
                // guilds 병합을 위해 GET_GUILD_WAR_DATA 호출 (guildWarMatching 동기화)
                const fetchResult = await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' }) as any;
                if (fetchResult?.clientResponse) {
                    const fr = fetchResult.clientResponse;
                    // 방금 시작했으므로 isMatching이 true이면 유지 (fetch가 false로 덮어쓰지 않도록)
                    if (fr.isMatching === true || (matchingJustStartedAtRef.current > 0 && Date.now() - matchingJustStartedAtRef.current < 60000)) {
                        setIsMatching(true);
                    }
                    setNextMatchTime(fr.nextMatchTime ?? cr?.nextMatchTime);
                    setCancelDeadline(fr.cancelDeadline ?? cr?.cancelDeadline ?? null);
                    if (fr.warActionCooldown != null) setWarActionCooldown(fr.warActionCooldown);
                    if (fr.activeWar) {
                        setActiveWar(fr.activeWar);
                        const allGuilds = fr.guilds || {};
                        const oppId = fr.activeWar.guild1Id === guild.id ? fr.activeWar.guild2Id : fr.activeWar.guild1Id;
                        setOpponentGuild(allGuilds[oppId] ?? null);
                    }
                }
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
        if (cancelDeadline != null && Date.now() >= cancelDeadline) {
            alert('매칭 1시간 전부터는 취소할 수 없습니다.');
            return;
        }
        setIsCanceling(true);
        lastAppliedAtRef.current = 0;
        try {
            const result = await handlers.handleAction({ type: 'CANCEL_GUILD_WAR' }) as any;
            if (result?.error) {
                alert(result.error);
            } else {
                setIsMatching(false);
                setNextMatchTime(undefined);
                setCancelDeadline(null);
                setMatchingModalMessage(result?.clientResponse?.message || '매칭이 취소되었습니다.');
                setMatchingModalWarStartTime(undefined);
                setShowMatchingModal(true);
                if (result?.clientResponse?.cooldownUntil) {
                    setWarActionCooldown(result.clientResponse.cooldownUntil);
                }
                const fetchResult = await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' }) as any;
                if (fetchResult?.clientResponse) {
                    setIsMatching(fetchResult.clientResponse.isMatching ?? false);
                    setNextMatchTime(fetchResult.clientResponse.nextMatchTime);
                    const war = fetchResult.clientResponse.activeWar ?? null;
                    setActiveWar(war);
                    if (!war) setOpponentGuild(null);
                    if (fetchResult.clientResponse.warActionCooldown != null) {
                        setWarActionCooldown(fetchResult.clientResponse.warActionCooldown);
                    }
                }
            }
        } catch (error) {
            console.error('[WarPanel] Cancel war failed:', error);
            alert('전쟁 취소에 실패했습니다.');
        } finally {
            setIsCanceling(false);
        }
    };

    const handleCancelWarClick = () => {
        setShowCancelConfirmModal(true);
    };

    const handleConfirmCancelWar = () => {
        setShowCancelConfirmModal(false);
        handleCancelWar();
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
    const isPastApplicationDeadline = applicationDeadline != null && Date.now() >= applicationDeadline;
    
    return (
        <>
            <div className={`bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 ${isMobile ? 'p-2' : 'p-3'} rounded-xl border-2 border-stone-600/60 shadow-lg flex flex-col items-center text-center w-full relative overflow-hidden h-full ${className || ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
                <div className="relative z-10 w-full flex flex-col h-full min-h-0">
                    {/* 상단: 길드 전쟁 마크 패널 중앙, 누적 전적 우측·높이 맞춤 */}
                    <div className={`w-full flex-shrink-0 flex flex-row items-center justify-center gap-2 ${isMobile ? 'mb-2' : 'mb-2'}`}>
                        <div className="flex-1 min-w-0" />
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-xl flex items-center justify-center border border-stone-600/50 shadow-lg`}>
                                <img src="/images/guild/button/guildwar.png" alt="길드 전쟁" className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} drop-shadow-lg object-contain`} />
                            </div>
                            <span className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} text-highlight`}>길드 전쟁</span>
                        </div>
                        <div className="flex-1 flex justify-end items-center min-w-0">
                            {/* 누적 전적 - 마크와 같은 줄·높이 맞춤, 자리수 늘어나도 여유 있게 */}
                            <div className={`bg-stone-800/50 rounded-lg border border-stone-600/50 overflow-hidden flex-shrink-0 ${isMobile ? 'min-h-[58px]' : 'min-h-[72px]'}`}>
                                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-stone-400 font-semibold px-3 py-1 bg-stone-700/50 text-center border-b border-stone-600/40`}>누적 전적</div>
                                <table className="border-collapse min-w-[110px] w-full">
                                    <thead>
                                        <tr className="bg-stone-700/50">
                                            <th className={`${isMobile ? 'text-xs' : 'text-sm'} text-stone-400 font-semibold px-3 py-1 border-b border-r border-stone-600/40 w-1/3 whitespace-nowrap`}>승</th>
                                            <th className={`${isMobile ? 'text-xs' : 'text-sm'} text-stone-400 font-semibold px-3 py-1 border-b border-r border-stone-600/40 w-1/3 whitespace-nowrap`}>패</th>
                                            <th className={`${isMobile ? 'text-xs' : 'text-sm'} text-stone-400 font-semibold px-3 py-1 border-b border-stone-600/40 w-1/3 whitespace-nowrap`}>승률</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-emerald-400 px-3 py-1 text-center whitespace-nowrap`}>{warStats?.totalWins ?? 0}</td>
                                            <td className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-red-400 px-3 py-1 text-center whitespace-nowrap`}>{warStats?.totalLosses ?? 0}</td>
                                            <td className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-amber-300 px-3 py-1 text-center whitespace-nowrap`}>{warStats && (warStats.totalWins + warStats.totalLosses) > 0 ? `${warStats.winRate}%` : '0%'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    {/* 하단: 왼쪽 이번 상대 정보 / 오른쪽 마지막 상대 기록 */}
                    <div className="w-full flex-shrink-0 mb-1.5 flex gap-1.5">
                        {/* 왼쪽: 이번 상대와의 정보 */}
                        <div className="flex-1 min-w-0 bg-stone-800/50 rounded-lg border border-stone-600/50 overflow-hidden">
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-stone-400 font-semibold px-2 py-1 bg-stone-700/50 text-center border-b border-stone-600/40`}>이번 상대</div>
                            <div className="p-2 min-h-[60px]">
                                {isMatching && (
                                    <div className="space-y-0.5 text-xs">
                                        <div className="font-bold text-yellow-300 text-center">매칭 대기 중</div>
                                        <div className="text-stone-400 text-center text-[10px]">
                                            {nextMatchTime != null
                                                ? (getKSTDay(nextMatchTime) === 2 ? '화요일 0시에 매칭 상대 표시됩니다' : '금요일 0시에 매칭 상대 표시됩니다')
                                                : '화/금 0시에 매칭·상대 표시'}
                                        </div>
                                        {nextMatchTime != null && <div className="text-yellow-200 text-center text-[10px]">{timeRemaining || '0시에 상대 표시'}</div>}
                                    </div>
                                )}
                                {activeWar && !isMatching && opponentGuild && (
                                    <div className="space-y-1 text-xs">
                                        <div className="font-bold text-red-300 truncate text-center" title={opponentGuild.name}>{opponentGuild.name || '상대 길드'}</div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-blue-300">{ourStars} vs {enemyStars} (별)</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-blue-300">{ourScore.toLocaleString()} vs {enemyScore.toLocaleString()}</span>
                                        </div>
                                        {(myRecordInCurrentWar || myWarAttempts > 0) && (
                                            <div className="text-[10px] text-amber-300/90 border-t border-stone-600/40 pt-0.5 mt-0.5">
                                                내 기록: {(myRecordInCurrentWar?.attempts ?? myWarAttempts)}/{(myRecordInCurrentWar?.maxAttempts ?? GUILD_WAR_MAX_ATTEMPTS)} 공격권{myRecordInCurrentWar?.contributedStars != null && myRecordInCurrentWar.contributedStars > 0 ? ` · ${myRecordInCurrentWar.contributedStars}별 기여` : ''}
                                            </div>
                                        )}
                                        <div className="flex gap-1 mt-0.5">
                                            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ourGuildOccupancy}%` }}></div>
                                            </div>
                                            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${enemyGuildOccupancy}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!activeWar && !isMatching && (
                                    <div className="text-center text-xs py-1">
                                        <div className="text-stone-500">진행 중인 전쟁 없음</div>
                                        {canStartWar && isPastApplicationDeadline && (
                                            <div className="text-amber-300/90 mt-1">23시~0시 참여 불가<br />0시에 매칭 결과 확인</div>
                                        )}
                                        {canStartWar && !isPastApplicationDeadline && warActionCooldown !== null && Date.now() < warActionCooldown && (
                                            <div className="text-yellow-300 mt-1">쿨타임: {cooldownRemaining}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* 오른쪽: 마지막 상대와의 기록 */}
                        <div className="flex-1 min-w-0 bg-stone-800/50 rounded-lg border border-stone-600/50 overflow-hidden">
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-stone-400 font-semibold px-2 py-1 bg-stone-700/50 text-center border-b border-stone-600/40`}>마지막 상대 기록</div>
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    {warStats?.lastOpponent ? (
                                        <>
                                            <tr>
                                                <td className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 px-2 py-0.5 border-b border-r border-stone-600/40 w-14`}>상대</td>
                                                <td className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium px-2 py-0.5 border-b border-stone-600/40 truncate`} title={warStats.lastOpponent.name}>{warStats.lastOpponent.name}</td>
                                            </tr>
                                            <tr>
                                                <td className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 px-2 py-0.5 border-b border-r border-stone-600/40`}>스코어</td>
                                                <td className={`${isMobile ? 'text-[10px]' : 'text-xs'} px-2 py-0.5 border-b border-stone-600/40`}>{warStats.lastOpponent.ourScore.toLocaleString()} vs {warStats.lastOpponent.enemyScore.toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <td className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 px-2 py-0.5 border-b border-r border-stone-600/40`}>별/승패</td>
                                                <td className={`${isMobile ? 'text-[10px]' : 'text-xs'} px-2 py-0.5 border-b border-stone-600/40`}>
                                                    {warStats.lastOpponent.ourStars} vs {warStats.lastOpponent.enemyStars} · <span className={warStats.lastOpponent.isWin ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{warStats.lastOpponent.isWin ? '승' : '패'}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 px-2 py-0.5 border-r border-stone-600/40`}>보상</td>
                                                <td className={`${isMobile ? 'text-[10px]' : 'text-xs'} px-2 py-0.5 border-b border-stone-600/40`}>
                                                    {warStats.lastOpponent.guildXp != null && warStats.lastOpponent.researchPoints != null ? (
                                                        <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                                                            <span><img src="/images/guild/tokken.png" alt="" className="w-3 h-3 inline align-middle" />{warStats.lastOpponent.guildXp}</span>
                                                            <span><img src="/images/guild/button/guildlab.png" alt="" className="w-3 h-3 inline align-middle" />{warStats.lastOpponent.researchPoints}RP</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-stone-500">미수령</span>
                                                    )}
                                                </td>
                                            </tr>
                                            {(warStats as any).myRecordInLastWar != null && (
                                                <tr>
                                                    <td className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-stone-400 px-2 py-0.5 border-r border-stone-600/40`}>내 기록</td>
                                                    <td className={`${isMobile ? 'text-[10px]' : 'text-xs'} px-2 py-0.5 text-amber-300/90`}>
                                                        {((warStats as any).myRecordInLastWar as { contributedStars: number }).contributedStars}별 기여
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-stone-500 text-center py-2`}>기록 없음</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="w-full flex-1 flex flex-col min-h-0">
                        {/* 중간 내용 영역 - flex-1로 공간 차지 */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {/* 매칭 중 / 전쟁 진행 중 상세는 상단 '이번 상대' 패널에 표시됨 */}
                            
                            {/* 이번 상대/마지막 상대 정보는 상단 좌우 패널에 표시됨 */}
                            
                            {/* 보상 받기 버튼 */}
                            {canClaimReward && !isClaimed && (
                                <div className={`flex-shrink-0 ${isMobile ? 'mt-1' : 'mt-1.5'} flex justify-center`}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRewardModal(true);
                                        }}
                                        className={guildPanelBtn.reward}
                                    >
                                        보상 받기
                                    </button>
                                </div>
                            )}
                            {isClaimed && (
                                <div className={`flex-shrink-0 ${isMobile ? 'mt-1' : 'mt-1.5'} flex justify-center`}>
                                    <div className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-900/50 text-emerald-300 text-sm font-semibold border border-emerald-500/30">
                                        보상 수령 완료
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* 입장 + 전쟁 참여 + 전쟁 취소 버튼 - 하단 고정 */}
                        <div className={`flex-shrink-0 ${isMobile ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'} border-t border-stone-600/40 flex flex-wrap justify-center gap-2`}>
                            <button
                                onClick={() => window.location.hash = '#/guildwar'}
                                disabled={!canEnterWar}
                                className={canEnterWar ? guildPanelBtn.war : guildPanelBtn.disabled}
                            >
                                <img src="/images/guild/warticket.png" alt="길드전 공격권" className="w-4 h-4" />
                                <span>{myWarTickets}/{GUILD_WAR_MAX_ATTEMPTS}</span>
                                <span>입장</span>
                            </button>
                            {canStartWar && !activeWar && !isMatching && !isPastApplicationDeadline && (
                                <button
                                    onClick={handleStartWar}
                                    disabled={isStarting || (warActionCooldown !== null && Date.now() < warActionCooldown)}
                                    className={(isStarting || (warActionCooldown !== null && Date.now() < warActionCooldown)) ? guildPanelBtn.disabled : guildPanelBtn.participate}
                                >
                                    {isStarting ? (
                                        <>
                                            <span className="animate-spin text-xs">⏳</span>
                                            <span>매칭 중...</span>
                                        </>
                                    ) : (warActionCooldown !== null && Date.now() < warActionCooldown) ? (
                                        <>
                                            <span className="text-xs">⏱️</span>
                                            <span>쿨타임</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs">⚔️</span>
                                            <span>전쟁 참여</span>
                                        </>
                                    )}
                                </button>
                            )}
                            {canStartWar && !activeWar && !isMatching && isPastApplicationDeadline && (
                                <button disabled className={guildPanelBtn.disabled} title="매칭 1시간 전(23시)부터 참여 불가">
                                    <span className="text-xs">🔒</span>
                                    <span>참여 마감</span>
                                </button>
                            )}
                            {canStartWar && isMatching && (
                                <button
                                    onClick={handleCancelWarClick}
                                    disabled={isCanceling || (cancelDeadline != null && Date.now() >= cancelDeadline)}
                                    className={(isCanceling || (cancelDeadline != null && Date.now() >= cancelDeadline)) ? guildPanelBtn.disabled : guildPanelBtn.cancel}
                                >
                                    {isCanceling ? (
                                        <>
                                            <span className="animate-spin text-xs">⏳</span>
                                            <span>취소 중...</span>
                                        </>
                                    ) : (cancelDeadline != null && Date.now() >= cancelDeadline) ? (
                                        <>
                                            <span className="text-xs">🔒</span>
                                            <span>취소 마감</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs">❌</span>
                                            <span>전쟁 취소</span>
                                        </>
                                    )}
                                </button>
                            )}
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
                warStartTime={matchingModalWarStartTime}
            />
        )}
        {showCancelConfirmModal && (
            <GuildWarCancelConfirmModal
                onClose={() => setShowCancelConfirmModal(false)}
                onConfirmCancel={handleConfirmCancelWar}
                isCanceling={isCanceling}
            />
        )}
        {showApplicationDayOnlyModal && (
            <GuildWarApplicationDayOnlyModal
                onClose={() => setShowApplicationDayOnlyModal(false)}
                nextApplicationDayLabel={nextApplicationDayLabel || '월요일 또는 목요일 0:00 ~ 23:00'}
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
        const effectiveUserId = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
        const member = currentGuild?.members?.find(m => m.userId === effectiveUserId);
        return member ?? undefined;
    }, [currentGuild?.members, currentUserWithStatus?.id, currentUserWithStatus?.isAdmin]);

    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;
    const canManage = guild.leaderId === effectiveUserId || myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';



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
        const effectiveId = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
        return guild.weeklyMissions.some(m => {
            const isComplete = (m.progress ?? 0) >= (m.target ?? 0);
            const isClaimed = m.claimedBy?.includes(effectiveId) ?? false;
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
    
    return (
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
                    <div className="relative group flex-shrink-0 overflow-visible">
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-accent/10 rounded-xl blur-sm"></div>
                        <img src={getGuildIconPath(currentGuild?.icon || guild?.icon)} alt="Guild Icon" className="w-16 h-16 md:w-20 md:h-20 bg-tertiary rounded-xl border-2 border-accent/30 shadow-lg relative z-10" />
                        {canManage && (
                            <button
                                onClick={() => setIsIconSelectOpen(true)}
                                className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center shadow-lg hover:bg-accent/80 transition-all z-20 border-2 border-secondary"
                                title="길드 마크 변경"
                                type="button"
                            >
                                <span className="text-xs">✏️</span>
                            </button>
                        )}
                    </div>
                    <div className="flex flex-col items-center gap-1 min-w-0 flex-1 max-w-md">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-highlight drop-shadow-md break-words truncate w-full text-center" title={(() => {
                            if (!currentGuild) return '';
                            const guildsGuild = guilds[currentGuild.id || guild.id];
                            return guildsGuild?.name || currentGuild?.name || guild?.name || '';
                        })()}>
                            {(() => {
                                if (!currentGuild) return '로딩 중...';
                                const guildsGuild = guilds[currentGuild.id || guild.id];
                                return guildsGuild?.name || currentGuild?.name || guild?.name || '길드';
                            })()}
                        </h1>
                        <div className="flex items-center gap-3 w-full flex-wrap justify-center">
                            <div className="text-sm md:text-base lg:text-lg text-secondary font-semibold">레벨 {currentGuild?.level || 1}</div>
                            {!isMobile && (
                                <div className="flex-1 min-w-[180px] max-w-md">
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
                            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-tertiary/50 hover:bg-tertiary/70 transition-all hover:scale-110 border border-accent/20 shadow-md" 
                            title="길드 도움말"
                        >
                            <img src="/images/button/help.png" alt="도움말" className="w-full h-full" />
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
                                    guild={currentGuild || guild}
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
                                    <GuildHomePanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} rightOfChat={<BossPanel guild={currentGuild || guild} className="h-full" />} />
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

                <div className="lg:col-span-2 xl:col-span-2 flex flex-col gap-1 h-full min-h-0 overflow-hidden">
                    {!isMobile && (
                        <>
                            <div className="flex gap-1 flex-shrink-0">
                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <GuildDonationPanel guild={currentGuild || guild} guildDonationAnimation={guildDonationAnimation} onDonationComplete={onDonationComplete} goldButtonRef={goldButtonRef} diamondButtonRef={diamondButtonRef} />
                                    <ActivityPanel 
                                        onOpenMissions={() => setIsMissionsOpen(true)} 
                                        onOpenResearch={() => setIsResearchOpen(true)} 
                                        onOpenShop={() => setIsShopOpen(true)} 
                                        missionNotification={missionTabNotification} 
                                        onOpenBossGuide={() => setIsBossGuideOpen(true)} 
                                    />
                                </div>
                                <div className="w-24 min-w-[96px] flex-shrink-0 flex flex-col">
                                    <QuickAccessSidebar compact={true} fillHeight={true} />
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <WarPanel guild={currentGuild || guild} className="h-full w-full" />
                            </div>
                        </>
                    )}
                </div>
                
            </main>
            {goldAnimation}
            {diamondAnimation}
            </div>
            </div>
        </div>
    );
};