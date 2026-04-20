import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { Guild as GuildType, UserWithStatus, GuildBossInfo, QuestReward, GuildMember, GuildMemberRole, CoreStat, GuildResearchId, GuildResearchCategory, ItemGrade, ServerAction, GuildBossSkill } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import GuildHomePanel, { GuildCheckInPanel, GuildAnnouncementPanel, getLuxuryButtonClasses } from './GuildHomePanel.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, AVATAR_POOL, BORDER_POOL, emptySlotImages, slotNames, GUILD_BOSS_MAX_ATTEMPTS, GUILD_INITIAL_MEMBER_LIMIT, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_GOLD_COST, GUILD_DONATION_DIAMOND_COST, GUILD_CHECK_IN_MILESTONE_REWARDS, GUILD_DONATION_GOLD_REWARDS, GUILD_DONATION_DIAMOND_REWARDS, ADMIN_USER_ID, ADMIN_NICKNAME, GUILD_WAR_BOT_GUILD_ID, GUILD_WAR_PERSONAL_DAILY_ATTEMPTS } from '../../constants/index.js';
import DraggableWindow, { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import NineSlicePanel from '../ui/NineSlicePanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import HelpModal from '../HelpModal.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from '../QuickAccessSidebar.js';
import GuildWarRewardModal from './GuildWarRewardModal.js';
import GuildWarMatchingModal, { type GuildWarMatchPresentationClient } from './GuildWarMatchingModal.js';
import { GuildWarUnifiedScoreboard } from './GuildWarUnifiedScoreboard.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { getTimeUntilNextMondayKST, isSameDayKST, isDifferentWeekKST, formatDateTimeKST, getStartOfDayKST, getTodayKSTDateString } from '../../utils/timeUtils.js';
import { getCurrentGuildBossStage, getScaledGuildBossMaxHp } from '../../utils/guildBossStageUtils.js';
import { getGuildWarBotBoardDisplayTally } from '../../shared/utils/guildWarBoardOwner.js';
// 고급 버튼 스타일 (길드 패널용)
const guildPanelBtnBase =
    'inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold tracking-wide transition-all duration-200';
const guildPanelBtn = {
    boss: `${guildPanelBtnBase} border-cyan-400/40 bg-gradient-to-br from-blue-600/90 via-cyan-500/85 to-blue-600/90 text-white shadow-[0_4px_14px_-2px_rgba(34,211,238,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(34,211,238,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    war: `${guildPanelBtnBase} border-red-400/40 bg-gradient-to-br from-red-600/90 via-rose-500/85 to-red-600/90 text-white shadow-[0_4px_14px_-2px_rgba(244,63,94,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(244,63,94,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    participate: `${guildPanelBtnBase} border-purple-400/40 bg-gradient-to-br from-purple-600/90 via-violet-500/85 to-purple-600/90 text-white shadow-[0_4px_14px_-2px_rgba(168,85,247,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(168,85,247,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    cancel: `${guildPanelBtnBase} border-rose-400/40 bg-gradient-to-br from-rose-700/90 via-red-600/85 to-rose-700/90 text-white shadow-[0_4px_14px_-2px_rgba(244,63,94,0.35)] hover:shadow-[0_6px_20px_-2px_rgba(244,63,94,0.45)] hover:-translate-y-0.5 active:translate-y-0`,
    reward: `${guildPanelBtnBase} border-emerald-400/40 bg-gradient-to-br from-emerald-600/90 via-teal-500/85 to-emerald-600/90 text-white shadow-[0_4px_14px_-2px_rgba(20,184,166,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(20,184,166,0.5)] hover:-translate-y-0.5 active:translate-y-0`,
    disabled: `${guildPanelBtnBase} border-stone-500/30 bg-stone-800/60 text-stone-400 cursor-not-allowed opacity-70`,
};

/** 모바일 길드 기부 DraggableWindow와 동일 — 포털 기부 횟수 모달이 바깥 클릭으로 창이 닫히지 않도록 DraggableWindow가 인식 */
const GUILD_HOME_MOBILE_DONATION_WINDOW_ID = 'guild-home-mobile-donation';

/** `public/images/guild/guildbg.webp` — 길드 홈 전체 배경 */
const GUILD_HOME_BACKGROUND_IMAGE = '/images/guild/guildbg.webp';

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

    // 닉네임(유저)별 누적: 골드/다이아 기부 횟수 분리, 획득 길드코인·연구포인트 합계 (데이터 양 제한)
    const donationByUser = React.useMemo(() => {
        const log = guild?.donationLog || [];
        const map = new Map<string, { nickname: string; goldCount: number; diamondCount: number; totalCoins: number; totalResearch: number }>();
        for (const entry of log) {
            const cur = map.get(entry.userId);
            const nickname = entry.nickname || entry.userId;
            if (!cur) {
                map.set(entry.userId, {
                    nickname,
                    goldCount: entry.type === 'gold' ? entry.count : 0,
                    diamondCount: entry.type === 'diamond' ? entry.count : 0,
                    totalCoins: entry.coins,
                    totalResearch: entry.research,
                });
            } else {
                cur.nickname = nickname;
                if (entry.type === 'gold') cur.goldCount += entry.count;
                else cur.diamondCount += entry.count;
                cur.totalCoins += entry.coins;
                cur.totalResearch += entry.research;
            }
        }
        return [...map.entries()]
            .map(([userId, agg]) => ({ userId, ...agg }))
            .sort((a, b) => b.totalCoins - a.totalCoins);
    }, [guild?.donationLog]);
    const isMobile = false;

    return (
        <div className="flex min-h-[200px] max-h-[320px] flex-1 flex-col gap-3 overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 p-3 shadow-lg relative" style={{ minHeight: '200px' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none rounded-xl" />
            <h3 className="font-bold text-base text-highlight text-center relative z-10 flex items-center justify-center gap-2 drop-shadow-lg flex-shrink-0">
                <span className="text-lg">💎</span>
                <span>길드 기부</span>
            </h3>

            <div className="flex min-h-0 flex-1 flex-row gap-3 relative z-10 min-w-0 items-stretch">
            {/* 좌측: 골드·다이아 기부 버튼 세로 배치 (PC) */}
            <div className="flex w-[9.75rem] shrink-0 flex-col justify-center gap-3">
                {/* 골드 기부 */}
                <div className="flex w-full flex-col gap-1.5 items-center">
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
                <div className="flex w-full flex-col gap-1.5 items-center">
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

            {/* 우측: 기부 기록 — 가로폭 우선 */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-stone-600/50 pl-3 pt-0 relative z-10">
                <div className="mb-1 flex-shrink-0 text-sm font-semibold text-highlight">기부 기록</div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border-2 border-black/20 bg-tertiary/40 pr-1 shadow-inner">
                    <div className="min-h-full space-y-0.5 p-2.5 text-sm leading-snug text-secondary sm:p-3">
                            {donationByUser.length === 0 ? (
                                <div className="text-stone-500 py-1">기록 없음</div>
                            ) : (
                                donationByUser.map((agg) => (
                                    <div key={agg.userId} className="leading-tight truncate" title={`${agg.nickname} · 골드 ${agg.goldCount}회 · 다이아 ${agg.diamondCount}회 · 길드코인 ${agg.totalCoins.toLocaleString()} · RP ${agg.totalResearch.toLocaleString()}`}>
                                        <span className="text-amber-200/90">[{agg.nickname}]</span>
                                        {' '}
                                        <span className="text-amber-200/95">골드 <span className="font-semibold text-white">{agg.goldCount}</span>회</span>
                                        {' · '}
                                        <span className="text-blue-200/95">다이아 <span className="font-semibold text-white">{agg.diamondCount}</span>회</span>
                                        {' · '}
                                        <img src="/images/guild/tokken.png" alt="코인" className="inline h-3 w-3 align-middle" />
                                        <span className="font-semibold text-amber-200">{agg.totalCoins.toLocaleString()}</span>
                                        {' · '}
                                        <img src="/images/guild/button/guildlab.png" alt="RP" className="inline h-3 w-3 align-middle" />
                                        <span className="font-semibold text-blue-200">{agg.totalResearch.toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 기부 횟수 선택 모달 - createPortal로 document.body에 렌더링 */}
            {donationModal && createPortal(
                <div className="sudamr-modal-overlay z-[99999] pointer-events-auto" style={{ isolation: 'isolate' }} onClick={() => setDonationModal(null)}>
                    <div 
                        className={`sudamr-panel-edge-host relative z-10 mx-4 max-w-sm w-full overflow-hidden rounded-2xl border-2 shadow-2xl pointer-events-auto ${donationModal.type === 'gold' ? 'border-amber-400/50 shadow-amber-500/20' : 'border-sky-400/50 shadow-sky-500/20'}`}
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
                document.getElementById('sudamr-modal-root') ?? document.body
            )}
        </div>
    );
};

const GuildDonationPanelPhone: React.FC<{ guild?: GuildType | null; guildDonationAnimation: { coins: number; research: number; type: 'gold' | 'diamond' } | null; onDonationComplete?: (coins: number, research: number, type: 'gold' | 'diamond') => void; goldButtonRef: React.RefObject<HTMLDivElement>; diamondButtonRef: React.RefObject<HTMLDivElement> }> = ({ guild, guildDonationAnimation, onDonationComplete, goldButtonRef, diamondButtonRef }) => {
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

    // 닉네임(유저)별 누적: 골드/다이아 기부 횟수 분리, 획득 길드코인·연구포인트 합계 (데이터 양 제한)
    const donationByUser = React.useMemo(() => {
        const log = guild?.donationLog || [];
        const map = new Map<string, { nickname: string; goldCount: number; diamondCount: number; totalCoins: number; totalResearch: number }>();
        for (const entry of log) {
            const cur = map.get(entry.userId);
            const nickname = entry.nickname || entry.userId;
            if (!cur) {
                map.set(entry.userId, {
                    nickname,
                    goldCount: entry.type === 'gold' ? entry.count : 0,
                    diamondCount: entry.type === 'diamond' ? entry.count : 0,
                    totalCoins: entry.coins,
                    totalResearch: entry.research,
                });
            } else {
                cur.nickname = nickname;
                if (entry.type === 'gold') cur.goldCount += entry.count;
                else cur.diamondCount += entry.count;
                cur.totalCoins += entry.coins;
                cur.totalResearch += entry.research;
            }
        }
        return [...map.entries()]
            .map(([userId, agg]) => ({ userId, ...agg }))
            .sort((a, b) => b.totalCoins - a.totalCoins);
    }, [guild?.donationLog]);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 p-2 shadow-lg sm:gap-3 sm:p-3">
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10" />

            <div className="relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2">
                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-stone-600/45 bg-tertiary/45 p-2 shadow-inner">
                    <div className="mb-1 text-[11px] font-semibold text-highlight">기부 기록</div>
                    <div className="space-y-1 text-sm leading-tight text-secondary">
                        {donationByUser.length === 0 ? (
                            <div className="py-3 text-center text-stone-500">기록 없음</div>
                        ) : (
                            donationByUser.map((agg) => (
                                <div
                                    key={agg.userId}
                                    className="flex w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap text-center"
                                    title={`${agg.nickname} · 골드 ${agg.goldCount}회 · 다이아 ${agg.diamondCount}회 · 길드코인 ${agg.totalCoins.toLocaleString()} · RP ${agg.totalResearch.toLocaleString()}`}
                                >
                                    <span className="min-w-0 max-w-[8.5rem] truncate text-amber-200/90">[{agg.nickname}]</span>
                                    <span className="inline-flex items-center gap-1 text-amber-200/95">
                                        <img src="/images/icon/Gold.png" alt="골드" className="h-3 w-3 shrink-0" />
                                        <span className="font-semibold text-white">{agg.goldCount}회</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-blue-200/95">
                                        <img src="/images/icon/Zem.png" alt="다이아" className="h-3 w-3 shrink-0" />
                                        <span className="font-semibold text-white">{agg.diamondCount}회</span>
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="grid w-full grid-cols-2 gap-2">
                    <div ref={goldButtonRef} className="min-w-0">
                        <div className="mb-1 text-center text-[10px] font-semibold text-amber-200">골드 기부</div>
                        <Button
                            onClick={() => openDonationModal('gold')}
                            disabled={!canDonateGold || isDonating}
                            colorScheme="none"
                            className={`flex w-full items-center justify-center rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 py-1 text-[12px] font-bold text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.3)] [text-shadow:0_1px_0_rgba(255,255,255,0.3)] leading-tight ${!canDonateGold || isDonating ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            {isDonating && donationType === 'gold' ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                    <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 shrink-0" />
                                    <span>{GUILD_DONATION_GOLD_COST.toLocaleString()}</span>
                                    <span className="ml-1 text-[10px] opacity-90">
                                        {goldDonationsLeft}/{GUILD_DONATION_GOLD_LIMIT}
                                    </span>
                                </span>
                            )}
                        </Button>
                    </div>
                    <div ref={diamondButtonRef} className="min-w-0">
                        <div className="mb-1 text-center text-[10px] font-semibold text-blue-200">다이아 기부</div>
                        <Button
                            onClick={() => openDonationModal('diamond')}
                            disabled={!canDonateDiamond || isDonating}
                            colorScheme="none"
                            className={`flex w-full items-center justify-center rounded-xl border border-sky-400/50 bg-gradient-to-r from-sky-400/90 via-blue-500/90 to-indigo-500/90 py-1 text-[12px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] drop-shadow-[0_0_1px_rgba(0,0,0,0.8)] leading-tight ${!canDonateDiamond || isDonating ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            {isDonating && donationType === 'diamond' ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                    <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 shrink-0" />
                                    <span>{GUILD_DONATION_DIAMOND_COST.toLocaleString()}</span>
                                    <span className="ml-1 text-[10px] opacity-90">
                                        {diamondDonationsLeft}/{GUILD_DONATION_DIAMOND_LIMIT}
                                    </span>
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* 기부 횟수 선택 모달 */}
            {donationModal && createPortal(
                <div
                    className="sudamr-modal-overlay z-[99999] pointer-events-auto"
                    style={{ isolation: 'isolate' }}
                    data-draggable-satellite={GUILD_HOME_MOBILE_DONATION_WINDOW_ID}
                    onClick={() => setDonationModal(null)}
                >
                    <div 
                        className={`sudamr-panel-edge-host relative z-10 mx-4 max-w-sm w-full overflow-hidden rounded-2xl border-2 shadow-2xl pointer-events-auto ${donationModal.type === 'gold' ? 'border-amber-400/50 shadow-amber-500/20' : 'border-sky-400/50 shadow-sky-500/20'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 헤더 - 그라데이션 */}
                        <div className={`px-5 py-3 ${donationModal.type === 'gold' ? 'bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-yellow-500/90' : 'bg-gradient-to-r from-sky-600/90 via-blue-500/90 to-indigo-500/90'}`}>
                            <div className="flex items-center gap-2">
                                <img src={donationModal.type === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt="" className="w-7 h-7 drop-shadow-lg" />
                                <h3 className="font-bold text-base text-white drop-shadow-md">
                                    {donationModal.type === 'gold' ? '골드' : '다이아'} 기부
                                </h3>
                            </div>
                        </div>
                        {/* 본문 */}
                        <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-4">
                            {/* 보상 미리보기 카드 */}
                            <div className="mb-4 rounded-xl border border-stone-600/50 bg-stone-800/80 p-3">
                                <div className="mb-1.5 text-[11px] font-semibold text-stone-400">1회당 보상</div>
                                <div className="flex items-center justify-center gap-4 text-sm">
                                    <span className="flex items-center gap-1.5 font-bold text-amber-300">
                                        <img src="/images/guild/tokken.png" alt="" className="h-4 w-4" />
                                        {donationModal.type === 'gold' ? `${GUILD_DONATION_GOLD_REWARDS.guildCoins[0]}~${GUILD_DONATION_GOLD_REWARDS.guildCoins[1]}` : `${GUILD_DONATION_DIAMOND_REWARDS.guildCoins[0]}~${GUILD_DONATION_DIAMOND_REWARDS.guildCoins[1]}`}
                                    </span>
                                    <span className="flex items-center gap-1.5 font-bold text-blue-300">
                                        <img src="/images/guild/button/guildlab.png" alt="" className="h-4 w-4" />
                                        {donationModal.type === 'gold' ? `${GUILD_DONATION_GOLD_REWARDS.researchPoints[0]}~${GUILD_DONATION_GOLD_REWARDS.researchPoints[1]} RP` : `${GUILD_DONATION_DIAMOND_REWARDS.researchPoints[0]}~${GUILD_DONATION_DIAMOND_REWARDS.researchPoints[1]} RP`}
                                    </span>
                                </div>
                            </div>
                            {/* 횟수 선택: +, -, Max로 조절 */}
                            <div className="mb-4">
                                <div className="mb-2 text-xs font-semibold text-stone-400">기부 횟수 (최대 {donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount}회)</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="h-11 w-11 shrink-0 rounded-xl border border-stone-500/50 bg-stone-700/80 text-xl font-bold text-white transition-all hover:scale-105 hover:bg-stone-600 active:scale-95"
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
                                        className={`flex-1 rounded-xl border border-stone-600/50 bg-stone-800/80 px-3 py-2.5 text-center text-base font-bold text-white focus:outline-none focus:ring-2 ${donationModal.type === 'gold' ? 'focus:ring-amber-400/50' : 'focus:ring-sky-400/50'}`}
                                    />
                                    <button
                                        className="h-11 w-11 shrink-0 rounded-xl border border-stone-500/50 bg-stone-700/80 text-xl font-bold text-white transition-all hover:scale-105 hover:bg-stone-600 active:scale-95"
                                        onClick={() => setDonationModal(m => m ? { ...m, count: Math.min(donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount, m.count + 1) } : null)}
                                    >+</button>
                                </div>
                                <button
                                    className={`mt-2 w-full rounded-xl border py-2 text-sm font-bold text-white transition-all hover:brightness-110 ${donationModal.type === 'gold' ? 'border-amber-500/50 bg-amber-600/80 hover:bg-amber-500/90' : 'border-sky-500/50 bg-sky-600/80 hover:bg-sky-500/90'}`}
                                    onClick={() => {
                                        const max = donationModal.type === 'gold' ? goldMaxCount : diamondMaxCount;
                                        setDonationModal(m => m ? { ...m, count: max } : null);
                                    }}
                                >
                                    최대치 입력 (Max)
                                </button>
                            </div>
                            {/* 취소 / 기부하기 */}
                            <div className="flex gap-2.5">
                                <button
                                    className="flex-1 rounded-xl border border-stone-500/50 bg-stone-700/80 py-2.5 font-semibold text-stone-200 transition-all hover:bg-stone-600"
                                    onClick={() => setDonationModal(null)}
                                >
                                    취소
                                </button>
                                <button
                                    className={`flex-[2] rounded-xl py-2.5 font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${donationModal.type === 'gold' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-yellow-400' : 'bg-gradient-to-r from-sky-500 to-blue-500 shadow-lg shadow-sky-500/30 hover:from-sky-400 hover:to-blue-400'}`}
                                    onClick={() => handleDonate(donationModal.type === 'gold' ? 'GUILD_DONATE_GOLD' : 'GUILD_DONATE_DIAMOND', donationModal.count)}
                                >
                                    기부하기 ({donationModal.count}회)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.getElementById('sudamr-modal-root') ?? document.body
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
        <div className="flex-shrink-0 rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 p-3 shadow-lg">
            <h3 className="font-bold text-base text-highlight mb-2 text-center flex items-center justify-center gap-2 flex-shrink-0">
                <span className="text-xl">⚡</span>
                <span>길드 활동</span>
            </h3>
            <div className="flex justify-around items-center gap-2">
                {activities.map(act => (
                    <button 
                        key={act.name} 
                        onClick={act.action}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-stone-800/50 to-stone-700/30 border border-stone-600/40 transition-all hover:brightness-110 hover:shadow-lg relative group flex-1 min-w-0`}
                    >
                        <div className="h-16 w-16 bg-gradient-to-br from-stone-700/60 to-stone-800/50 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-xl transition-shadow border border-stone-600/40 flex-shrink-0">
                            <img src={act.icon} alt={act.name} className="h-14 w-14 drop-shadow-lg object-contain" />
                        </div>
                        <span className="text-sm font-semibold text-highlight text-center leading-tight">{act.name}</span>
                        {act.notification && (
                            <div className="absolute right-1 top-1 h-4 w-4 bg-red-500 rounded-full animate-pulse border-2 border-secondary shadow-lg flex items-center justify-center">
                                <span className="text-[8px] text-white font-bold">!</span>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

/** 우측 6rem 열: 길드 컨텐츠 버튼 아래 세로 배치 */
const GuildActivityRailStrip: React.FC<{
    onOpenMissions: () => void;
    onOpenResearch: () => void;
    onOpenShop: () => void;
    onOpenBossGuide: () => void;
    missionNotification: boolean;
}> = ({ onOpenMissions, onOpenResearch, onOpenShop, onOpenBossGuide, missionNotification }) => {
    const activities = [
        { name: '길드 미션', icon: '/images/guild/button/guildmission.png', action: onOpenMissions, notification: missionNotification },
        { name: '길드 연구소', icon: '/images/guild/button/guildlab.png', action: onOpenResearch, notification: false },
        { name: '길드 상점', icon: '/images/guild/button/guildstore.png', action: onOpenShop, notification: false },
        { name: '보스 도감', icon: '/images/guild/button/bossraid1.png', action: onOpenBossGuide, notification: false },
    ];
    return (
        <div className="flex w-full shrink-0 flex-col gap-1.5">
            {activities.map((act) => (
                <button
                    key={act.name}
                    type="button"
                    onClick={act.action}
                    title={act.name}
                    className="relative flex w-full flex-col items-center gap-1 rounded-lg border border-stone-600/50 bg-gradient-to-br from-stone-800/85 to-stone-900/80 py-2 px-0.5 transition-all hover:brightness-110 active:scale-[0.98]"
                >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-stone-600/40 bg-stone-700/50">
                        <img src={act.icon} alt="" className="h-9 w-9 object-contain drop-shadow-md" />
                    </div>
                    <span className="max-w-full break-keep px-0.5 text-center text-[8px] font-semibold leading-tight text-highlight">
                        {act.name}
                    </span>
                    {act.notification && (
                        <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-stone-800 bg-red-500 shadow-sm" aria-hidden />
                    )}
                </button>
            ))}
        </div>
    );
};

const BOSS_SKILL_TOOLTIP_HIDE_DELAY_MS = 200;

const BossPanel: React.FC<{ guild: GuildType; className?: string; forceDesktopPanelLayout?: boolean }> = ({
    guild,
    className,
    forceDesktopPanelLayout,
}) => {
    const { currentUserWithStatus, isNativeMobile } = useAppContext();
    const [hoveredSkill, setHoveredSkill] = useState<GuildBossSkill | null>(null);
    const [clickedSkill, setClickedSkill] = useState<GuildBossSkill | null>(null);
    const [skillTooltipPos, setSkillTooltipPos] = useState<{ top: number; left: number } | null>(null);
    const skillIconRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const tooltipHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showBossParticipantsModal, setShowBossParticipantsModal] = useState(false);

    useEffect(() => () => {
        if (tooltipHideTimeoutRef.current) clearTimeout(tooltipHideTimeoutRef.current);
    }, []);

    // 서버와 동일한 키 사용(관리자는 ADMIN_USER_ID로 저장됨) — 나의 기록 갱신 정확도
    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;

    const bossParticipantRanking = useMemo(() => {
        if (!guild.guildBossState?.totalDamageLog) return [];
        const damageLog = guild.guildBossState.totalDamageLog || {} as Record<string, number>;
        return Object.entries(damageLog)
            .map(([userId, damage]: [string, any]) => {
                let member = guild.members?.find((m: GuildMember) => m.userId === userId);
                if (!member && userId === ADMIN_USER_ID) {
                    member = guild.members?.find((m: GuildMember) => m.nickname === ADMIN_NICKNAME);
                }
                const nickname = member?.nickname || (userId === ADMIN_USER_ID ? ADMIN_NICKNAME : '알 수 없음');
                return { userId, nickname, damage: typeof damage === 'number' ? damage : 0 };
            })
            .sort((a, b) => b.damage - a.damage);
    }, [guild.guildBossState?.totalDamageLog, guild.members]);

    // 나의 기록 계산
    const { myDamage, myRank, totalParticipants } = useMemo(() => {
        if (!guild.guildBossState?.totalDamageLog || !currentUserWithStatus) {
            return { myDamage: 0, myRank: null, totalParticipants: 0 };
        }
        const myRankIndex = bossParticipantRanking.findIndex(r => r.userId === effectiveUserId);
        const myData = myRankIndex !== -1 ? { ...bossParticipantRanking[myRankIndex], rank: myRankIndex + 1 } : null;
        
        return {
            myDamage: myData?.damage || 0,
            myRank: myData?.rank || null,
            totalParticipants: bossParticipantRanking.length,
        };
    }, [guild.guildBossState?.totalDamageLog, currentUserWithStatus, effectiveUserId, bossParticipantRanking]);
    const currentBoss = useMemo(() => {
        if (!guild.guildBossState) return GUILD_BOSSES[0];
        return GUILD_BOSSES.find(b => b.id === guild.guildBossState!.currentBossId) || GUILD_BOSSES[0];
    }, [guild.guildBossState]);

    const bossDifficultyStage = useMemo(
        () => getCurrentGuildBossStage(guild.guildBossState, currentBoss.id),
        [guild.guildBossState, currentBoss.id]
    );

    const { currentHp, maxHp } = useMemo(() => {
        const scaledMax =
            guild.guildBossState?.maxHp ?? getScaledGuildBossMaxHp(currentBoss.maxHp, bossDifficultyStage);
        const ch =
            guild.guildBossState?.currentBossHp ?? guild.guildBossState?.hp ?? scaledMax;
        return { currentHp: ch, maxHp: scaledMax };
    }, [guild.guildBossState, currentBoss.id, currentBoss.maxHp, bossDifficultyStage]);
    const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
    const clampedHpPercent = Math.max(0, Math.min(100, hpPercent));
    const remainingHp = Math.max(0, Math.ceil(currentHp));
    const formatHpWithK = (value: number) => {
        const kValue = value / 1000;
        if (Number.isInteger(kValue)) return `${kValue.toLocaleString()}k`;
        return `${kValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
    };
    const [timeLeft, setTimeLeft] = useState('');
    
    // 보스전 티켓 계산 (일일 2회, KST 기준 날짜 변경 시 2/2 회복)
    const bossTodayKST = getTodayKSTDateString();
    const bossUsedToday = currentUserWithStatus?.guildBossLastAttemptDayKST === bossTodayKST ? (currentUserWithStatus?.guildBossAttemptsUsedToday ?? 0) : 0;
    const myBossTickets = GUILD_BOSS_MAX_ATTEMPTS - bossUsedToday;
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

    const isMobile = forceDesktopPanelLayout ? false : isNativeMobile;

    return (
        <div className={`bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 ${isMobile ? 'p-2' : 'p-4'} rounded-xl border-2 border-stone-600/60 shadow-lg flex flex-col items-center text-center w-full relative overflow-hidden h-full ${className || ''}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className="relative z-10 w-full flex flex-col h-full min-h-0">
                <h3 className={`font-bold ${isMobile ? 'text-sm' : 'text-lg'} text-highlight ${isMobile ? 'mb-1' : 'mb-3'} flex items-center justify-center gap-2 flex-shrink-0`}>
                    <span className={isMobile ? 'text-base' : 'text-2xl'}>⚔️</span>
                    <span>길드 보스전</span>
                </h3>
                <div className={`flex flex-col ${isMobile ? 'mb-1' : 'mb-3'} flex-shrink-0`}>
                    {/* 보스 이름 · 난이도 단계 */}
                    <p className={`${isMobile ? 'text-xs' : 'text-base'} font-bold text-highlight ${isMobile ? 'mb-0.5' : 'mb-2'} text-center`}>
                        {currentBoss.name}
                        <span className={`tabular-nums text-amber-200/95 ${isMobile ? 'text-[11px] ml-1' : 'text-sm ml-1.5'}`}>· {bossDifficultyStage}단계</span>
                    </p>
                    
                    {/* 가로로 둘로 나눔: 왼쪽(보스+스킬) | 오른쪽(내 기록) */}
                    <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-2 w-full`}>
                        {/* 왼쪽: 보스 이미지 + 스킬(아래 가로 배치) — 데스크톱에서 열 비중을 조금 더 주어 보스 이미지 확대 */}
                        <div className={`flex flex-col ${isMobile ? 'items-center' : 'min-w-0 flex-[1.35]'} gap-2`}>
                                    <div className="flex flex-col items-center w-full">
                                        {/* 보스 이미지 (확대) */}
                                        <div className="flex flex-col items-center flex-shrink-0 w-full max-w-[min(100%,18rem)]">
                                            <div className={`relative ${isMobile ? 'w-32 h-32' : 'w-full aspect-square max-h-[min(18rem,calc(50vh-8rem))]'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-xl flex items-center justify-center border border-stone-600/50 shadow-lg overflow-hidden`}>
                                                <img src={currentBoss.image} alt={currentBoss.name} className={`${isMobile ? 'w-28 h-28' : 'h-[92%] w-[92%] max-h-[min(16.5rem,calc(50vh-9rem))]'} drop-shadow-lg object-contain`} />
                                                {/* 체력: 수치는 게이지 바로 위, 게이지는 이미지 하단 오버레이 */}
                                                <div className={`absolute inset-x-0 bottom-0 flex flex-col items-stretch ${isMobile ? 'gap-0.5 px-1.5 pb-1.5 pt-6' : 'gap-1 px-2 pb-2 pt-8'} bg-gradient-to-t from-black/75 via-black/45 to-transparent`}>
                                                    <div className={`text-center font-bold tabular-nums text-white ${isMobile ? 'text-[10px]' : 'text-[12px]'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                                                        {formatHpWithK(remainingHp)} / {formatHpWithK(maxHp)} ({clampedHpPercent.toFixed(1)}%)
                                                    </div>
                                                    <div className={`w-full bg-gray-800/85 rounded-full ${isMobile ? 'h-2' : 'h-3'} border border-gray-600/60 overflow-hidden shadow-inner`}>
                                                        <div
                                                            className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(217,119,6,0.5)]"
                                                            style={{ width: `${clampedHpPercent}%` }}
                                                        />
                                                    </div>
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
                                                        className={`${isMobile ? 'w-9 h-9' : 'w-12 h-12'} bg-gradient-to-br from-stone-700/50 to-stone-800/40 rounded-lg flex items-center justify-center border border-stone-600/50 shadow-lg cursor-pointer hover:scale-110 transition-transform`}
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
                                                        <img src={skill.image} alt={skill.name} className={`${isMobile ? 'w-7 h-7' : 'w-10 h-10'} object-contain drop-shadow-md`} />
                                                {skill.type === 'passive' && (
                                                            <div className={`absolute -top-0.5 -right-0.5 ${isMobile ? 'w-2 h-2' : 'w-2.5 h-2.5'} bg-purple-500 rounded-full flex items-center justify-center`}>
                                                                <span className={`${isMobile ? 'text-[5px]' : 'text-[6px]'} text-white font-bold`}>P</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* 호버 시 툴팁 */}
                                            {hoveredSkill?.id === skill.id && skillTooltipPos && (
                                            <div 
                                                className="fixed z-[9999] w-64 rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/98 via-neutral-800/95 to-stone-900/98 p-3 shadow-2xl"
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
                                                    <img src={skill.image} alt={skill.name} className="w-10 h-10 object-contain" />
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
                                {/* 남은 시간: 보스 이미지 패널 너비만큼만 사용 (모바일 6rem / 데스크 9rem) */}
                                <div className={`${isMobile ? 'mt-1 w-full max-w-[8rem]' : 'mt-2 w-full'} flex shrink-0 justify-center`}>
                                    <p className={`w-full ${isMobile ? 'text-[10px]' : 'text-sm'} text-tertiary bg-gray-800/50 px-2 py-1 rounded-md text-center truncate`} title={timeLeft}>{timeLeft}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* 오른쪽: 내 기록 + 입장 버튼(하단 중앙) */}
                        <div className={`flex flex-col ${isMobile ? 'w-full' : 'min-w-0 flex-[0.95]'} justify-center gap-2`}>
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
                                            {(guild.guildBossState?.maxDamageLog?.[effectiveUserId || ''] || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* 입장 버튼: 나의 기록 하단 중앙배열 */}
                            <div className={`flex justify-center ${isMobile ? 'mt-0.5' : 'mt-1'}`}>
                                <button
                                    onClick={() => window.location.hash = '#/guildboss'}
                                    disabled={!canEnter}
                                    className={`${canEnter ? guildPanelBtn.boss : guildPanelBtn.disabled}`}
                                >
                                    <img src="/images/guild/ticket.png" alt="보스전 티켓" className="w-4 h-4" />
                                    <span>{myBossTickets}/{GUILD_BOSS_MAX_ATTEMPTS}</span>
                                    <span>입장</span>
                                </button>
                            </div>
                            <div className={`flex justify-center ${isMobile ? 'mt-0.5' : 'mt-1'}`}>
                                <button
                                    onClick={() => setShowBossParticipantsModal(true)}
                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border border-cyan-500/40 bg-cyan-900/20 hover:bg-cyan-800/30 text-cyan-200 text-xs font-semibold transition-colors"
                                >
                                    참여길드원
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* 클릭 시 상세 정보 모달 (스킬용) */}
                    {clickedSkill && (
                        <div 
                            className="sudamr-modal-overlay z-[100]"
                            onClick={() => setClickedSkill(null)}
                        >
                            <div 
                                className="sudamr-modal-panel mx-4 max-w-md border-stone-600/50 p-5 ring-1 ring-white/[0.05]"
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
                    {showBossParticipantsModal && (
                        <div
                            className="sudamr-modal-overlay z-[110]"
                            onClick={() => setShowBossParticipantsModal(false)}
                        >
                            <div
                                className="sudamr-modal-panel flex w-[min(92vw,28rem)] max-h-[70vh] flex-col border-stone-600/50 p-4 ring-1 ring-white/[0.05]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-bold text-highlight">참여 길드원 기록</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowBossParticipantsModal(false)}
                                        className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS}
                                        aria-label="닫기"
                                    >
                                        닫기
                                    </button>
                                </div>
                                {bossParticipantRanking.length > 0 ? (
                                    <div className="overflow-y-auto pr-1 space-y-1">
                                        {bossParticipantRanking.map((row, index) => (
                                            <div key={row.userId} className="flex items-center justify-between rounded-md bg-stone-800/50 px-2 py-1.5 text-sm">
                                                <span className="text-stone-200">{index + 1}위 · {row.nickname}</span>
                                                <span className="font-bold text-amber-300 tabular-nums">{row.damage.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-sm text-stone-400 py-8">아직 참여 기록이 없습니다.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

type GuildWarDashboardWarStats = {
    totalWins: number;
    totalLosses: number;
    winRate: number;
    lastOpponent: {
        name: string;
        isWin: boolean;
        ourStars: number;
        enemyStars: number;
        ourScore: number;
        enemyScore: number;
        guildXp?: number;
        researchPoints?: number;
    } | null;
    myRecordInLastWar?: { contributedStars: number } | null;
};

type GuildWarDashboardMyRecord = { attempts: number; maxAttempts?: number; contributedStars: number };

/**
 * `/api/action` 성공 시 `respondAction(200, { success: true, ...clientResponse })` 로 평탄화되어
 * `activeWar` 등이 최상위에만 올 수 있음 — `GuildWar.tsx` 의 readGuildWarApiResult 와 동일하게 처리.
 */
function readGuildWarActionPayload(result: any) {
    if (!result || typeof result !== 'object') return {};
    const cr = result.clientResponse;
    const pick = <T,>(key: string, fallback?: T): T | undefined => {
        if (Object.prototype.hasOwnProperty.call(result, key)) return result[key] as T;
        if (cr && Object.prototype.hasOwnProperty.call(cr, key)) return cr[key] as T;
        return fallback;
    };
    return {
        activeWar: pick<any>('activeWar'),
        guilds: (pick<Record<string, unknown>>('guilds') as Record<string, unknown> | undefined) ?? {},
        isMatching: pick<boolean>('isMatching') ?? false,
        nextMatchTime: pick<number>('nextMatchTime'),
        applicationDeadline: pick<number | null>('applicationDeadline') ?? null,
        cancelDeadline: pick<number | null>('cancelDeadline') ?? null,
        warStats: pick<GuildWarDashboardWarStats>('warStats'),
        myRecordInCurrentWar: pick<GuildWarDashboardMyRecord>('myRecordInCurrentWar'),
        guildWarRewardClaimable: pick<boolean>('guildWarRewardClaimable'),
        guildWarLatestCompletedRewardClaimed: pick<boolean>('guildWarLatestCompletedRewardClaimed'),
        warActionCooldown: pick<number>('warActionCooldown'),
        message: pick<string>('message'),
        cooldownUntil: pick<number>('cooldownUntil'),
        matched: pick<boolean>('matched'),
        matchPresentation: pick('matchPresentation'),
    };
}

const WarPanel: React.FC<{ guild: GuildType; className?: string; forceDesktopPanelLayout?: boolean }> = ({
    guild,
    className,
    forceDesktopPanelLayout,
}) => {
    const { currentUserWithStatus, handlers, guilds, isNativeMobile } = useAppContext();
    const [showRewardModal, setShowRewardModal] = React.useState(false);
    const [activeWar, setActiveWar] = React.useState<any>(null);
    const [opponentGuild, setOpponentGuild] = React.useState<any>(null);
    const [canClaimReward, setCanClaimReward] = React.useState(false);
    const [isClaimed, setIsClaimed] = React.useState(false);
    const [myWarAttempts, setMyWarAttempts] = React.useState(0);
    const [isMatching, setIsMatching] = React.useState(() => !!(guild as any).guildWarMatching);
    const [nextMatchTime, setNextMatchTime] = React.useState<number | undefined>(undefined);
    const [timeRemaining, setTimeRemaining] = React.useState<string>('');
    const [showMatchingModal, setShowMatchingModal] = React.useState(false);
    const [matchingModalMessage, setMatchingModalMessage] = React.useState('');
    const [matchingModalPresentation, setMatchingModalPresentation] = React.useState<GuildWarMatchPresentationClient | null>(null);
    /** 매칭 완료/대기 시 모달에 표시할 이번 길드전 시작 시각 (화/금 0시) */
    const [matchingModalWarStartTime, setMatchingModalWarStartTime] = React.useState<number | undefined>(undefined);
    const [warActionCooldown, setWarActionCooldown] = React.useState<number | null>(null);
    const [cancelDeadline, setCancelDeadline] = React.useState<number | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = React.useState<string>('');
    const [warStats, setWarStats] = React.useState<GuildWarDashboardWarStats | null>(null);
    const [myRecordInCurrentWar, setMyRecordInCurrentWar] = React.useState<GuildWarDashboardMyRecord | null>(null);
    const [isGuildRoute, setIsGuildRoute] = React.useState(() => window.location.hash === '#/guild');
    const [isUpdatingWarParticipation, setIsUpdatingWarParticipation] = React.useState(false);

    React.useEffect(() => {
        const onHashChange = () => {
            const onGuild = window.location.hash === '#/guild';
            setIsGuildRoute(onGuild);
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);
    
    // 길드장/부길드장 권한 확인 (관리자는 effectiveUserId로 비교 - 서버와 동일)
    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;
    const myMemberInfo = React.useMemo(() => {
        if (!effectiveUserId) return undefined;
        return guild.members?.find(m => m.userId === effectiveUserId);
    }, [guild.members, effectiveUserId]);
    
    const myWarParticipationEnabled = (currentUserWithStatus as any)?.guildWarParticipationEnabled !== false;

    // guild.guildWarMatching 변경 시 동기화 (broadcast, GET_GUILD_WAR_DATA 등으로 길드가 갱신된 경우)
    React.useEffect(() => {
        const gw = (guild as any).guildWarMatching;
        if (typeof gw !== 'boolean') return;
        // 진행 중 전쟁이 있으면 길드 객체의 매칭 플래그가 잠시 true로 남아도 '매칭 대기'로 덮어쓰지 않음
        if (activeWar && (activeWar as any).status === 'active') {
            setIsMatching(false);
            lastAppliedAtRef.current = 0;
            return;
        }
        setIsMatching(gw);
        if (gw) {
            lastAppliedAtRef.current = Date.now();
        } else {
            lastAppliedAtRef.current = 0;
            setNextMatchTime(undefined);
            setCancelDeadline(null);
        }
    }, [(guild as any).guildWarMatching, activeWar]);

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

                const p = readGuildWarActionPayload(result);
                const war = p.activeWar;
                const warIsLive =
                    !!war && String((war as { status?: unknown }).status ?? '').toLowerCase() === 'active';
                // guilds를 의존성에서 제거하고 result에서 받은 데이터만 사용
                const allGuilds = (p.guilds as Record<string, unknown>) || {};
                const matching = p.isMatching || false;
                const nextMatch = p.nextMatchTime;
                const appDeadline = p.applicationDeadline ?? null;
                const ts = matchingJustStartedAtRef.current;
                const justStarted = ts > 0 && (Date.now() - ts) < 60000;
                const myGuildFromResponse = allGuilds[guild.id];
                const gwFromGuild = (myGuildFromResponse as any)?.guildWarMatching;
                const serverSaysMatching = matching || gwFromGuild === true;
                const stillBeforeDeadline =
                    lastAppliedAtRef.current > 0 && appDeadline != null && Date.now() < appDeadline;
                // 진행 중 전쟁이 있으면 KV의 guildWarMatching 지연과 무관하게 매칭 대기 UI 끄기 + 입장 가능
                if (warIsLive) {
                    setIsMatching(false);
                    matchingJustStartedAtRef.current = 0;
                    lastAppliedAtRef.current = 0;
                } else if (war && !serverSaysMatching) {
                    setIsMatching(false);
                    matchingJustStartedAtRef.current = 0;
                    lastAppliedAtRef.current = 0;
                } else if (justStarted || (stillBeforeDeadline && !serverSaysMatching)) {
                    setIsMatching(true);
                } else {
                    setIsMatching(serverSaysMatching);
                    if (!serverSaysMatching) lastAppliedAtRef.current = 0;
                }
                setNextMatchTime(nextMatch);
                setCancelDeadline(matching ? (p.cancelDeadline ?? null) : null);
                const wr = p.warStats ?? null;
                setWarStats(wr);
                setMyRecordInCurrentWar(p.myRecordInCurrentWar ?? null);
                
                if (!war) {
                    setActiveWar(null);
                    setOpponentGuild(null);
                    setCanClaimReward(false);
                    setIsClaimed(false);
                    return;
                }

                if (String((war as { status?: unknown }).status ?? '').toLowerCase() === 'active') {
                    setActiveWar(war);
                    const myGuildId = guild.id;
                    const opponentGuildId = war.guild1Id === myGuildId ? war.guild2Id : war.guild1Id;
                    const opponentGuildData =
                        allGuilds[opponentGuildId] ??
                        ((war as any).isBotGuild || opponentGuildId === GUILD_WAR_BOT_GUILD_ID
                            ? {
                                  id: opponentGuildId,
                                  name: '[시스템] 길드전 AI',
                                  level: 1,
                                  members: [],
                                  leaderId: opponentGuildId,
                              }
                            : undefined);
                    setOpponentGuild(opponentGuildData ?? null);
                    if (effectiveUserId) {
                        const attempts = currentUserWithStatus?.isAdmin
                            ? 0
                            : (Number((war as any).userAttempts?.[effectiveUserId] ?? 0) || 0);
                        setMyWarAttempts(attempts);
                    } else {
                        setMyWarAttempts(0);
                    }
                } else {
                    setActiveWar(null);
                    setOpponentGuild(null);
                    setMyWarAttempts(0);
                }

                setCanClaimReward(!!p.guildWarRewardClaimable);
                setIsClaimed(!!p.guildWarLatestCompletedRewardClaimed);
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

        /** 서버 `GUILD_WAR_UPDATE` → `sudamr:guild-war-update` (useApp). 대시보드도 길드전 화면처럼 즉시 GET_GUILD_WAR_DATA */
        const onGuildWarSocketRefresh = () => {
            lastFetchTimeRef.current = 0;
            void fetchWarData();
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('sudamr:guild-war-update', onGuildWarSocketRefresh);
        }
        
        // 30초마다 갱신
        intervalRef.current = setInterval(() => {
            fetchWarData();
        }, 30000);
        
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (typeof window !== 'undefined') {
                window.removeEventListener('sudamr:guild-war-update', onGuildWarSocketRefresh);
            }
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
    
    const myWarTickets = GUILD_WAR_PERSONAL_DAILY_ATTEMPTS - myWarAttempts;

    const handleClaimReward = async () => {
        try {
            const result = await handlers.handleAction({ type: 'CLAIM_GUILD_WAR_REWARD' }) as any;
            if (result?.error) {
                alert(result.error);
                return undefined;
            } else {
                setIsClaimed(true);
                await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' });
                const warResult = (result as any)?.warResult ?? result?.clientResponse?.warResult;
                const rewards = (result as any)?.rewards ?? result?.clientResponse?.rewards;
                return { warResult, rewards };
            }
        } catch (error) {
            console.error('[WarPanel] Claim reward failed:', error);
            alert('보상 수령에 실패했습니다.');
            return undefined;
        }
    };
    
    const handleToggleMyWarParticipation = async () => {
        if (!guild?.id || isUpdatingWarParticipation) return;
        setIsUpdatingWarParticipation(true);
        try {
            const result = await handlers.handleAction({
                type: 'SET_GUILD_WAR_PARTICIPATION',
                payload: { enabled: !myWarParticipationEnabled },
            } as const) as any;
            if (result?.error) {
                alert(result.error);
            } else {
                await handlers.handleAction({ type: 'GET_GUILD_WAR_DATA' } as const);
            }
        } catch (error) {
            console.error('[WarPanel] Toggle participation failed:', error);
            alert('전쟁 참여 설정 변경에 실패했습니다.');
        } finally {
            setIsUpdatingWarParticipation(false);
        }
    };

    const botOpponentFallback = (oppId: string, war?: { isBotGuild?: boolean } | null) =>
        (war as any)?.isBotGuild || oppId === GUILD_WAR_BOT_GUILD_ID
            ? { id: oppId, name: '[시스템] 길드전 AI', level: 1, members: [], leaderId: oppId }
            : null;

    // 점령률 계산
    const calculateOccupancy = () => {
        if (!activeWar || !activeWar.boards) {
            return { ourStars: 0, enemyStars: 0, ourScore: 0, enemyScore: 0 };
        }
        
        const myGuildId = guild.id;
        const isGuild1 = activeWar.guild1Id === myGuildId;
        const isBotWar =
            !!(activeWar as any).isBotGuild ||
            activeWar.guild1Id === GUILD_WAR_BOT_GUILD_ID ||
            activeWar.guild2Id === GUILD_WAR_BOT_GUILD_ID;
        let ourStars = 0;
        let enemyStars = 0;
        let ourScore = 0;
        let enemyScore = 0;
        let totalBoards = 0;

        Object.entries(activeWar.boards || {}).forEach(([boardId, board]: [string, any]) => {
            totalBoards++;
            if (isBotWar) {
                const tally = getGuildWarBotBoardDisplayTally(board, {
                    warId: String((activeWar as any).id ?? ''),
                    boardId,
                    guild1Id: activeWar.guild1Id,
                    guild2Id: activeWar.guild2Id,
                    botGuildId: GUILD_WAR_BOT_GUILD_ID,
                    isBotWar: true,
                });
                ourStars += isGuild1 ? tally.guild1Stars : tally.guild2Stars;
                enemyStars += isGuild1 ? tally.guild2Stars : tally.guild1Stars;
                ourScore += isGuild1 ? tally.guild1HouseTally : tally.guild2HouseTally;
                enemyScore += isGuild1 ? tally.guild2HouseTally : tally.guild1HouseTally;
                return;
            }

            const myBoardStars = isGuild1 ? (board.guild1Stars || 0) : (board.guild2Stars || 0);
            const enemyBoardStars = isGuild1 ? (board.guild2Stars || 0) : (board.guild1Stars || 0);
            ourStars += myBoardStars;
            enemyStars += enemyBoardStars;

            const myBestResult = isGuild1 ? board.guild1BestResult : board.guild2BestResult;
            const enemyBestResult = isGuild1 ? board.guild2BestResult : board.guild1BestResult;
            const boardMode = board.gameMode as string | undefined;
            const addHouse = (best: any) => {
                if (!best) return 0;
                if (typeof best.score === 'number' && !Number.isNaN(best.score)) return best.score;
                if (boardMode === 'capture') return (best.captures || 0) * 2;
                return best.captures || 0;
            };
            if (myBestResult) ourScore += addHouse(myBestResult);
            if (enemyBestResult) enemyScore += addHouse(enemyBestResult);
        });
        
        return {
            ourStars,
            enemyStars,
            ourScore,
            enemyScore,
        };
    };

    const { ourStars, enemyStars, ourScore, enemyScore } = calculateOccupancy();
    const opponentGuildIdForDisplay = activeWar ? (activeWar.guild1Id === guild.id ? activeWar.guild2Id : activeWar.guild1Id) : null;
    const displayOpponent =
        opponentGuild ??
        (activeWar &&
        opponentGuildIdForDisplay &&
        ((activeWar as any).isBotGuild || opponentGuildIdForDisplay === GUILD_WAR_BOT_GUILD_ID)
            ? {
                  id: opponentGuildIdForDisplay,
                  name: '[시스템] 길드전 AI',
                  level: 1,
                  members: [],
                  leaderId: opponentGuildIdForDisplay,
              }
            : null);
    const isMobile = forceDesktopPanelLayout ? false : isNativeMobile;
    const showOpponentWarPanel = !!(activeWar && !isMatching && displayOpponent);

    const warStatPill = (label: string, value: string | number, tone: 'emerald' | 'rose' | 'amber') => {
        const ring =
            tone === 'emerald'
                ? 'border-emerald-500/35 bg-emerald-950/40 text-emerald-200'
                : tone === 'rose'
                  ? 'border-rose-500/35 bg-rose-950/40 text-rose-200'
                  : 'border-amber-500/35 bg-amber-950/45 text-amber-200';
        return (
            <div className={`flex min-w-0 flex-1 flex-col rounded-lg border px-2 py-1.5 text-center shadow-inner ${ring}`}>
                <span className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} font-semibold uppercase tracking-wider opacity-80`}>{label}</span>
                <span className={`${isMobile ? 'text-sm' : 'text-base'} font-black tabular-nums leading-tight`}>{value}</span>
            </div>
        );
    };

    return (
        <>
            <div
                className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border-2 border-stone-600/60 bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 shadow-lg ${isMobile ? 'p-2.5' : 'p-3'} ${className || ''}`}
            >
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10" aria-hidden />
                <div className="relative z-10 flex h-full min-h-0 w-full flex-col">
                    {/* 헤더: 타이틀 + 누적 전적 칩 */}
                    <div className={`mb-2 flex w-full flex-shrink-0 flex-col gap-2.5 sm:mb-3 sm:flex-row sm:items-center sm:justify-between`}>
                        <div className="flex min-w-0 items-center gap-3 text-left">
                            <div
                                className={`relative flex shrink-0 items-center justify-center rounded-xl border border-stone-600/50 bg-gradient-to-br from-stone-800/60 to-stone-900/70 shadow-inner ${isMobile ? 'h-12 w-12' : 'h-14 w-14'}`}
                            >
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/25 to-transparent" aria-hidden />
                                <img
                                    src="/images/guild/button/guildwar.png"
                                    alt=""
                                    className={`relative z-[1] object-contain drop-shadow-lg ${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}
                                />
                            </div>
                            <div className="min-w-0">
                                <h3 className={`font-black tracking-tight text-highlight ${isMobile ? 'text-sm' : 'text-base'}`}>길드 전쟁</h3>
                            </div>
                        </div>
                        <div className={`flex w-full min-w-0 gap-1.5 sm:max-w-[14rem] sm:flex-shrink-0 ${isMobile ? '' : 'sm:justify-end'}`}>
                            {warStatPill('승', warStats?.totalWins ?? 0, 'emerald')}
                            {warStatPill('패', warStats?.totalLosses ?? 0, 'rose')}
                            {warStatPill(
                                '승률',
                                warStats && warStats.totalWins + warStats.totalLosses > 0 ? `${warStats.winRate}%` : '0%',
                                'amber'
                            )}
                        </div>
                    </div>

                    <div className={`${isMobile ? 'mb-1.5 flex w-full flex-shrink-0 flex-col gap-1.5' : 'mb-2 flex min-h-0 w-full flex-1 flex-col gap-2 sm:flex-row'}`}>
                        {showOpponentWarPanel && (
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-600/50 bg-gradient-to-b from-stone-900/75 to-black/50 shadow-inner">
                                <div
                                    className={`border-b border-stone-600/40 bg-gradient-to-r from-orange-950/55 via-stone-950/60 to-stone-950/55 px-2 py-1.5 text-center font-bold tracking-wide text-orange-100/95 ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                >
                                    이번 상대
                                </div>
                                <div className={`flex min-h-0 flex-1 flex-col gap-2 ${isMobile ? 'p-2' : 'p-2.5'} overflow-y-auto`}>
                                    <p
                                        className={`truncate text-center font-bold text-stone-100 ${isMobile ? 'text-xs' : 'text-sm'}`}
                                        title={displayOpponent!.name}
                                    >
                                        {displayOpponent!.name || '상대 길드'}
                                    </p>
                                    <GuildWarUnifiedScoreboard
                                        variant="embedded"
                                        compact
                                        blueStars={ourStars}
                                        redStars={enemyStars}
                                        blueHouse={ourScore}
                                        redHouse={enemyScore}
                                        hideHouseWhenZero
                                    />
                                    {(myRecordInCurrentWar || myWarAttempts > 0) && (
                                        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-2">
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-black/40 px-2 py-1 font-semibold tabular-nums text-amber-100/95 ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                            >
                                                <img src="/images/guild/warticket.png" alt="" className="h-3.5 w-3.5 opacity-90" />
                                                {(myRecordInCurrentWar?.attempts ?? myWarAttempts)}/
                                                {(myRecordInCurrentWar?.maxAttempts ?? GUILD_WAR_PERSONAL_DAILY_ATTEMPTS)}
                                            </span>
                                            {myRecordInCurrentWar?.contributedStars != null && myRecordInCurrentWar.contributedStars > 0 ? (
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-950/35 px-2 py-1 font-bold text-amber-200 ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                                >
                                                    <img src="/images/guild/guildwar/clearstar.png" alt="" className="h-3.5 w-3.5" />
                                                    기여 {myRecordInCurrentWar.contributedStars}
                                                </span>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div
                            className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-stone-600/50 bg-gradient-to-b from-stone-900/75 to-black/50 shadow-inner ${showOpponentWarPanel ? 'flex-1' : 'w-full flex-1'}`}
                        >
                            <div
                                className={`border-b border-stone-600/40 bg-gradient-to-r from-amber-950/45 via-stone-950/55 to-stone-950/55 px-2 py-1.5 text-center font-bold tracking-wide text-amber-100/95 ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                            >
                                직전 길드전
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                                <div className={`min-h-0 flex-1 overflow-y-auto ${isMobile ? 'p-2' : 'p-2.5'}`}>
                                    {warStats?.lastOpponent ? (
                                        <div className="flex flex-col gap-2">
                                            <p
                                                className={`truncate text-center font-semibold text-stone-100 ${isMobile ? 'text-xs' : 'text-sm'}`}
                                                title={warStats.lastOpponent.name}
                                            >
                                                {warStats.lastOpponent.name}
                                            </p>
                                            <GuildWarUnifiedScoreboard
                                                variant="embedded"
                                                compact
                                                blueStars={warStats.lastOpponent.ourStars}
                                                redStars={warStats.lastOpponent.enemyStars}
                                                blueHouse={warStats.lastOpponent.ourScore}
                                                redHouse={warStats.lastOpponent.enemyScore}
                                                hideHouseWhenZero
                                            />
                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                <span
                                                    className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${
                                                        warStats.lastOpponent.isWin
                                                            ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                                                            : 'border-rose-500/40 bg-rose-950/50 text-rose-300'
                                                    }`}
                                                >
                                                    {warStats.lastOpponent.isWin ? '승리' : '패배'}
                                                </span>
                                                {warStats.lastOpponent.guildXp != null && warStats.lastOpponent.researchPoints != null ? (
                                                    <span className="flex flex-wrap items-center justify-center gap-x-2 text-[10px] font-medium text-stone-400 sm:text-xs">
                                                        <span className="inline-flex items-center gap-0.5">
                                                            <img src="/images/guild/tokken.png" alt="" className="h-3.5 w-3.5" />
                                                            {warStats.lastOpponent.guildXp}
                                                        </span>
                                                        <span className="inline-flex items-center gap-0.5">
                                                            <img src="/images/guild/button/guildlab.png" alt="" className="h-3.5 w-3.5" />
                                                            {warStats.lastOpponent.researchPoints} RP
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-stone-500">보상 미수령</span>
                                                )}
                                            </div>
                                            {(warStats as any).myRecordInLastWar != null ? (
                                                <div className="flex justify-center border-t border-white/10 pt-2">
                                                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-black/35 px-2 py-1 text-[10px] font-bold text-amber-200 sm:text-xs">
                                                        <img src="/images/guild/guildwar/clearstar.png" alt="" className="h-3.5 w-3.5" />
                                                        기여 {((warStats as any).myRecordInLastWar as { contributedStars: number }).contributedStars}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <p className={`py-6 text-center text-stone-500 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>기록 없음</p>
                                    )}
                                </div>
                                <div className="flex shrink-0 justify-center border-t border-stone-600/40 px-2 py-2">
                                    <button
                                        type="button"
                                        disabled={isClaimed || !canClaimReward}
                                        title={
                                            isClaimed
                                                ? '이미 직전 길드전 보상을 수령했습니다.'
                                                : canClaimReward
                                                  ? '직전 길드전 보상을 받습니다.'
                                                  : '받을 보상이 없거나, 수령 가능 시각 전입니다. (전쟁 종료 1시간 후부터)'
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canClaimReward && !isClaimed) setShowRewardModal(true);
                                        }}
                                        className={canClaimReward && !isClaimed ? guildPanelBtn.reward : guildPanelBtn.disabled}
                                    >
                                        {isClaimed ? '보상 수령 완료' : '보상 수령'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="w-full flex-1 flex flex-col min-h-0">
                        {/* 중간 내용 영역 - flex-1로 공간 차지 */}
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {/* 매칭 중 / 전쟁 진행 중 상세는 상단 '이번 상대' 패널에 표시됨 */}
                        </div>
                        
                        {/* 입장 버튼 - 하단 고정 */}
                        <div className={`flex-shrink-0 ${isMobile ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'} border-t border-stone-600/40 flex flex-wrap justify-center gap-2`}>
                            <button
                                type="button"
                                onClick={() => replaceAppHash('#/guildwar')}
                                title="길드전 화면으로 이동합니다"
                                className={guildPanelBtn.war}
                            >
                                <img src="/images/guild/warticket.png" alt="길드전 공격권" className="w-4 h-4" />
                                <span>{myWarTickets}/{GUILD_WAR_PERSONAL_DAILY_ATTEMPTS}</span>
                                <span>입장</span>
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
                onClose={() => {
                    setShowMatchingModal(false);
                    setMatchingModalPresentation(null);
                }}
                message={matchingModalMessage}
                warStartTime={matchingModalWarStartTime}
                matchPresentation={matchingModalPresentation}
            />
        )}
        </>
    );
};

const GuildBossGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { isNativeMobile } = useNativeMobileShell();
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

    const bossList = GUILD_BOSSES.map(boss => {
        const bossTheme = getBossTheme(boss.id);
        const isSelected = selectedBoss.id === boss.id;
        return (
            <button
                key={boss.id}
                onClick={() => setSelectedBoss(boss)}
                className={`flex items-center rounded-xl transition-all border-2 relative overflow-hidden flex-shrink-0 ${
                    isNativeMobile ? 'flex-col gap-1 px-2 py-2 min-w-[4.25rem]' : 'gap-2.5 p-3 w-full'
                } ${
                    isSelected
                        ? `bg-gradient-to-br ${bossTheme.color} ${bossTheme.border} shadow-xl`
                        : 'bg-gradient-to-br from-stone-900/90 to-stone-800/80 border-stone-600/60 hover:border-stone-500/80 hover:shadow-lg'
                }`}
            >
                {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none"></div>
                )}
                <div className={`bg-gradient-to-br ${isSelected ? 'from-white/20 to-white/10' : 'from-stone-800/80 to-stone-900/80'} rounded-lg flex items-center justify-center border-2 ${isSelected ? 'border-white/30' : 'border-stone-600/60'} shadow-lg flex-shrink-0 relative z-10 ${isNativeMobile ? 'w-11 h-11' : 'w-12 h-12'}`}>
                    <img src={boss.image} alt={boss.name} className={`object-contain drop-shadow-xl ${isNativeMobile ? 'w-9 h-9' : 'w-10 h-10'}`} />
                </div>
                <span className={`font-bold relative z-10 ${isSelected ? 'text-white' : 'text-stone-300'} ${isNativeMobile ? 'text-center text-[10px] max-w-[4.5rem] line-clamp-2 leading-tight' : 'text-sm truncate'}`}>{boss.name}</span>
            </button>
        );
    });

    const detailPanel = (
        <div className={`bg-gradient-to-br from-stone-900/85 via-neutral-800/80 to-stone-900/85 rounded-xl overflow-y-auto border-2 border-stone-600/60 shadow-2xl relative overflow-hidden ${isNativeMobile ? 'flex-1 min-h-0 p-2.5' : 'w-2/3 p-4'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className="relative z-10">
                <div className={`flex border-b-2 border-stone-700/60 ${isNativeMobile ? 'flex-col items-center text-center gap-2 mb-3 pb-3' : 'items-center gap-4 mb-4 pb-4'}`}>
                    <div className={`bg-gradient-to-br ${theme.color} rounded-xl flex items-center justify-center border-2 ${theme.border} shadow-xl relative overflow-hidden flex-shrink-0 ${isNativeMobile ? 'w-[4.5rem] h-[4.5rem]' : 'w-24 h-24'}`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none"></div>
                        <img src={selectedBoss.image} alt={selectedBoss.name} className={`object-contain drop-shadow-xl relative z-10 ${isNativeMobile ? 'w-[3.75rem] h-[3.75rem]' : 'w-20 h-20'}`} />
                    </div>
                    <div className="flex-grow min-w-0">
                        <h3 className={`font-bold text-white drop-shadow-lg ${isNativeMobile ? 'text-lg mb-1' : 'text-xl mb-1 truncate'}`}>{selectedBoss.name}</h3>
                        <p className={`text-stone-300 leading-relaxed ${isNativeMobile ? 'text-xs line-clamp-3' : 'text-sm line-clamp-2'}`}>{selectedBoss.description}</p>
                    </div>
                </div>
                <div className={isNativeMobile ? 'space-y-2.5' : 'space-y-3'}>
                    <div className={`bg-gradient-to-br from-amber-900/60 via-yellow-800/50 to-amber-900/60 rounded-xl border-2 border-amber-500/60 shadow-xl relative overflow-hidden ${isNativeMobile ? 'p-2.5' : 'p-3'}`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-yellow-400/5 to-amber-500/10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h4 className={`font-bold text-amber-300 flex items-center gap-1.5 ${isNativeMobile ? 'text-xs mb-1.5' : 'text-sm mb-2'}`}>
                                <span className={isNativeMobile ? 'text-sm' : 'text-base'}>📖</span>
                                공략 가이드
                            </h4>
                            <p className={`text-stone-200 leading-relaxed ${isNativeMobile ? 'text-xs' : 'text-xs'}`}>{selectedBoss.strategyGuide}</p>
                        </div>
                    </div>
                    <div className={`bg-gradient-to-br from-stone-800/80 to-stone-900/80 rounded-xl border-2 border-stone-600/60 shadow-xl ${isNativeMobile ? 'p-2.5' : 'p-3'}`}>
                        <h4 className={`font-bold text-cyan-300 flex items-center gap-1.5 ${isNativeMobile ? 'text-xs mb-2' : 'text-sm mb-3'}`}>
                            <span className={isNativeMobile ? 'text-sm' : 'text-base'}>⚔️</span>
                            주요 스킬
                        </h4>
                        <ul className={isNativeMobile ? 'space-y-1.5' : 'space-y-2'}>
                            {selectedBoss.skills.map(skill => (
                                <li key={skill.id} className={`flex bg-gradient-to-br from-stone-900/80 to-stone-800/60 rounded-lg border border-stone-700/50 shadow-lg ${isNativeMobile ? 'items-center gap-2 p-2' : 'items-start gap-3 p-2.5'}`}>
                                    <div className={`bg-gradient-to-br from-stone-800/90 to-stone-900/90 rounded-lg flex items-center justify-center border-2 border-stone-600/60 shadow-lg flex-shrink-0 ${isNativeMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                                        <img src={skill.image || ''} alt={skill.name} className={`object-contain drop-shadow-lg ${isNativeMobile ? 'w-8 h-8' : 'w-10 h-10'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-bold text-white mb-0.5 ${isNativeMobile ? 'text-xs' : 'text-sm'}`}>{skill.name}</p>
                                        <p className={`text-stone-300 leading-relaxed ${isNativeMobile ? 'text-[11px]' : 'text-xs'}`}>{skill.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={`grid gap-2 ${isNativeMobile ? 'grid-cols-1' : 'grid-cols-2 gap-3'}`}>
                        <div className={`bg-gradient-to-br from-blue-900/60 via-indigo-800/50 to-blue-900/60 rounded-xl border-2 border-blue-500/60 shadow-xl relative overflow-hidden ${isNativeMobile ? 'p-2.5' : 'p-3'}`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-400/5 to-blue-500/10 pointer-events-none"></div>
                            <div className="relative z-10">
                                <h4 className={`font-bold text-blue-300 flex items-center gap-1.5 ${isNativeMobile ? 'text-[11px] mb-1' : 'text-xs mb-1.5'}`}>
                                    <span className="text-sm">💪</span>
                                    추천 능력치
                                </h4>
                                <p className={`text-stone-200 leading-relaxed ${isNativeMobile ? 'text-[11px]' : 'text-xs'}`}>{selectedBoss.recommendedStats.join(', ')}</p>
                            </div>
                        </div>
                        <div className={`bg-gradient-to-br from-purple-900/60 via-violet-800/50 to-purple-900/60 rounded-xl border-2 border-purple-500/60 shadow-xl relative overflow-hidden ${isNativeMobile ? 'p-2.5' : 'p-3'}`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-violet-400/5 to-purple-500/10 pointer-events-none"></div>
                            <div className="relative z-10">
                                <h4 className={`font-bold text-purple-300 flex items-center gap-1.5 ${isNativeMobile ? 'text-[11px] mb-1' : 'text-xs mb-1.5'}`}>
                                    <span className="text-sm">🔬</span>
                                    추천 연구
                                </h4>
                                <p className={`text-stone-200 leading-relaxed ${isNativeMobile ? 'text-[11px]' : 'text-xs'}`}>
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
    );

    return (
        <DraggableWindow
            title="길드 보스 도감"
            onClose={onClose}
            windowId="guild-boss-guide"
            initialWidth={1100}
            initialHeight={800}
            variant="store"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            bodyPaddingClassName={isNativeMobile ? 'p-2' : undefined}
        >
            <div className={`flex relative overflow-hidden ${isNativeMobile ? 'flex-col gap-2 h-full min-h-0' : 'h-full gap-4'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-stone-950/50 via-neutral-900/30 to-stone-950/50 pointer-events-none"></div>
                <div className={`relative z-10 flex w-full min-h-0 ${isNativeMobile ? 'flex-col flex-1 gap-2' : 'gap-4 h-full'}`}>
                    {isNativeMobile ? (
                        <>
                            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0 -mx-0.5 px-0.5 [scrollbar-width:thin]">
                                {bossList}
                            </div>
                            {detailPanel}
                        </>
                    ) : (
                        <>
                            <div className="w-1/3 pr-2 flex flex-col gap-2 overflow-y-auto">{bossList}</div>
                            {detailPanel}
                        </>
                    )}
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

type GuildTab = 'home' | 'members' | 'management' | 'boss' | 'war';

export const GuildDashboard: React.FC<GuildDashboardProps> = ({ guild, guildDonationAnimation, onDonationComplete }) => {
    const { currentUserWithStatus, handlers, guilds, isNativeMobile: isGuildPhone } = useAppContext();
    
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
    const [isMobileDonationOpen, setIsMobileDonationOpen] = useState(false);
    const [isIconSelectOpen, setIsIconSelectOpen] = useState(false);
    const goldButtonRef = useRef<HTMLDivElement>(null);
    const diamondButtonRef = useRef<HTMLDivElement>(null);
    const [goldButtonPos, setGoldButtonPos] = useState<{ top: number; left: number } | null>(null);
    const [diamondButtonPos, setDiamondButtonPos] = useState<{ top: number; left: number } | null>(null);
    const myMemberInfo = useMemo(() => {
        if (!currentUserWithStatus?.id) return undefined;
        const effectiveUserId = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
        const member = currentGuild?.members?.find(m => m.userId === effectiveUserId);
        return member ?? undefined;
    }, [currentGuild?.members, currentUserWithStatus?.id, currentUserWithStatus?.isAdmin]);

    const effectiveUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : currentUserWithStatus?.id;
    const canManage = guild.leaderId === effectiveUserId || myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';



    const guildLevel = currentGuild?.level || 1;
    const guildXp = currentGuild?.xp ?? currentGuild?.experience ?? 0;
    const xpForNextLevel = GUILD_XP_PER_LEVEL(guildLevel);
    const xpProgress = Math.min((guildXp / xpForNextLevel) * 100, 100);
    const guildDisplayName = React.useMemo(() => {
        if (!currentGuild) return '';
        const g = guilds[currentGuild.id || guild.id];
        return g?.name || currentGuild?.name || guild?.name || '길드';
    }, [currentGuild, guild.id, guild?.name, guilds]);
    const myGuildCoins = currentUserWithStatus?.guildCoins ?? 0;
    const dashboardBossTodayKST = getTodayKSTDateString();
    const dashboardBossUsedToday = currentUserWithStatus?.guildBossLastAttemptDayKST === dashboardBossTodayKST ? (currentUserWithStatus?.guildBossAttemptsUsedToday ?? 0) : 0;
    const myBossTickets = GUILD_BOSS_MAX_ATTEMPTS - dashboardBossUsedToday;
    
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
                className="pointer-events-none fixed -translate-x-1/2 -translate-y-full animate-float-up-and-fade whitespace-nowrap" 
                style={{ 
                    animationDelay: '0ms',
                    top: `${goldButtonPos.top}px`,
                    left: `${goldButtonPos.left}px`
                }}
            >
                <div className="flex items-center gap-2 rounded-lg border-2 border-amber-400/60 bg-gradient-to-r from-amber-900/95 via-yellow-900/95 to-amber-800/95 px-4 py-2 shadow-[0_4px_12px_rgba(251,191,36,0.6)]">
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
                className="pointer-events-none fixed -translate-x-1/2 -translate-y-full animate-float-up-and-fade whitespace-nowrap" 
                style={{ 
                    animationDelay: '0ms',
                    top: `${diamondButtonPos.top}px`,
                    left: `${diamondButtonPos.left}px`
                }}
            >
                <div className="flex items-center gap-2 rounded-lg border-2 border-blue-400/60 bg-gradient-to-r from-blue-900/95 via-indigo-900/95 to-purple-900/95 px-4 py-2 shadow-[0_4px_12px_rgba(59,130,246,0.6)]">
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
    if (isGuildPhone) {
        tabs.push({ id: 'boss' as GuildTab, label: '길드보스전' });
        tabs.push({ id: 'war' as GuildTab, label: '길드전쟁' });
    }

    const activityRailProps = {
        onOpenMissions: () => setIsMissionsOpen(true),
        onOpenResearch: () => setIsResearchOpen(true),
        onOpenShop: () => setIsShopOpen(true),
        onOpenBossGuide: () => setIsBossGuideOpen(true),
        missionNotification: missionTabNotification,
    };

    const guildHomeActions = [
        { key: 'mission', name: '길드 미션', icon: '/images/guild/button/guildmission.png', action: activityRailProps.onOpenMissions, notification: activityRailProps.missionNotification },
        { key: 'research', name: '길드 연구소', icon: '/images/guild/button/guildlab.png', action: activityRailProps.onOpenResearch, notification: false },
        { key: 'shop', name: '길드 상점', icon: '/images/guild/button/guildstore.png', action: activityRailProps.onOpenShop, notification: false },
        { key: 'bossGuide', name: '보스 도감', icon: '/images/guild/button/bossraid1.png', action: activityRailProps.onOpenBossGuide, notification: false },
    ] as const;

    return (
        <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
            <div
                className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('${GUILD_HOME_BACKGROUND_IMAGE}')` }}
                aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-stone-950/50 via-stone-950/35 to-stone-950/55" aria-hidden />
            <div className="relative z-10 flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
            {isMissionsOpen && <GuildMissionsPanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} onClose={() => setIsMissionsOpen(false)} />}
            {isResearchOpen && <GuildResearchPanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} onClose={() => setIsResearchOpen(false)} />}
            {isShopOpen && <GuildShopModal onClose={() => setIsShopOpen(false)} isTopmost={true} />}
            {isMobileDonationOpen && isGuildPhone && (
                <DraggableWindow
                    title="길드 기부"
                    onClose={() => setIsMobileDonationOpen(false)}
                    windowId={GUILD_HOME_MOBILE_DONATION_WINDOW_ID}
                    initialWidth={400}
                    initialHeight={600}
                    isTopmost
                >
                    <GuildDonationPanelPhone
                        guild={currentGuild || guild}
                        guildDonationAnimation={guildDonationAnimation}
                        onDonationComplete={onDonationComplete}
                        goldButtonRef={goldButtonRef}
                        diamondButtonRef={diamondButtonRef}
                    />
                </DraggableWindow>
            )}
            {isHelpOpen && <HelpModal mode="guild" onClose={() => setIsHelpOpen(false)} />}
            {isBossGuideOpen && <GuildBossGuideModal onClose={() => setIsBossGuideOpen(false)} />}
            {isIconSelectOpen && <GuildIconSelectModal guild={currentGuild || guild} onClose={() => setIsIconSelectOpen(false)} onSelect={(icon) => {
                handlers.handleAction({ type: 'GUILD_UPDATE_PROFILE', payload: { guildId: (currentGuild || guild).id, icon } });
                setIsIconSelectOpen(false);
            }} />}

            {!isGuildPhone && (
            <>
            <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto] gap-2">
                <div className="flex min-h-0 flex-col gap-2">
                    <header className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-accent/20 bg-gradient-to-r from-secondary/80 via-secondary/60 to-secondary/80 px-4 py-2 shadow-lg">
                        <BackButton onClick={() => window.location.hash = '#/profile'} />
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="relative group flex-shrink-0 overflow-visible">
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 blur-sm"></div>
                                <img src={getGuildIconPath(currentGuild?.icon || guild?.icon)} alt="Guild Icon" className="relative z-10 h-16 w-16 rounded-xl border-2 border-accent/30 bg-tertiary shadow-lg" />
                                {canManage && (
                                    <button
                                        onClick={() => setIsIconSelectOpen(true)}
                                        className="absolute -bottom-1 -right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 border-secondary bg-accent shadow-lg transition-all hover:bg-accent/80"
                                        title="길드 마크 변경"
                                        type="button"
                                    >
                                        <span className="text-[10px]">✏️</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <h1 className="w-full truncate break-words text-left text-3xl font-bold text-highlight drop-shadow-md" title={(() => {
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
                                <div className="flex w-full flex-wrap items-center gap-3">
                                    <div className="text-lg font-semibold text-secondary">레벨 {currentGuild?.level || 1}</div>
                                    <div className="max-w-md min-w-[180px] flex-1">
                                        <div className="mb-1 flex justify-between text-xs text-secondary">
                                            <span className="font-semibold">경험치</span>
                                            <span className="font-semibold">{(currentGuild?.xp ?? currentGuild?.experience ?? 0).toLocaleString()} / {xpForNextLevel.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2.5 w-full overflow-hidden rounded-full border border-gray-600/50 bg-gray-700/50 shadow-inner">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-500"
                                                style={{ width: `${xpProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>
                        <div className="flex-shrink-0">
                            <div className="flex bg-gradient-to-r from-stone-800/80 to-stone-700/60 p-1 rounded-xl w-full max-w-md border border-stone-600/40 shadow-md">
                                {tabs.map(tab => {
                                    const tabColors: Record<GuildTab, { active: string; inactive: string }> = {
                                        home: { active: 'from-amber-600 to-amber-500', inactive: 'text-amber-300/70 hover:text-amber-300' },
                                        members: { active: 'from-blue-600 to-blue-500', inactive: 'text-blue-300/70 hover:text-blue-300' },
                                        management: { active: 'from-purple-600 to-purple-500', inactive: 'text-purple-300/70 hover:text-purple-300' },
                                        boss: { active: 'from-red-600 to-red-500', inactive: 'text-red-300/70 hover:text-red-300' },
                                        war: { active: 'from-orange-600 to-orange-500', inactive: 'text-orange-300/70 hover:text-orange-300' },
                                    };
                                    const colors = tabColors[tab.id];
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
                    
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {activeTab === 'home' && (
                            <div className="flex h-full flex-col gap-2">
                                    <GuildHomePanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} rightOfChat={<BossPanel guild={currentGuild || guild} className="h-full" />} />
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

                <div className="flex h-full min-h-0 gap-1 overflow-hidden">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <ActivityPanel
                                onOpenMissions={() => setIsMissionsOpen(true)}
                                onOpenResearch={() => setIsResearchOpen(true)}
                                onOpenShop={() => setIsShopOpen(true)}
                                missionNotification={missionTabNotification}
                                onOpenBossGuide={() => setIsBossGuideOpen(true)}
                            />
                            <GuildDonationPanel guild={currentGuild || guild} guildDonationAnimation={guildDonationAnimation} onDonationComplete={onDonationComplete} goldButtonRef={goldButtonRef} diamondButtonRef={diamondButtonRef} />
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <WarPanel guild={currentGuild || guild} className="h-full w-full" />
                            </div>
                        </div>
                </div>
                <div
                    className={`flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}
                    aria-label="퀵 메뉴"
                >
                    <div className="flex h-full min-h-0 flex-col rounded-xl border-2 border-amber-600/55 bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-950 p-1 shadow-xl shadow-black/40">
                        <QuickAccessSidebar fillHeight={true} />
                    </div>
                </div>
                
            </main>
            </>
            )}

            {isGuildPhone && (
            <>
            <header className="relative flex flex-shrink-0 rounded-xl border border-accent/20 bg-gradient-to-r from-secondary/80 via-secondary/60 to-secondary/80 px-2 py-2 shadow-lg mb-2">
                <div className="flex w-full items-stretch gap-2">
                    <BackButton onClick={() => window.location.hash = '#/profile'} />
                    <div className="relative group flex-shrink-0 overflow-visible self-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-accent/10 rounded-xl blur-sm"></div>
                        <img src={getGuildIconPath(currentGuild?.icon || guild?.icon)} alt="Guild Icon" className="relative z-10 h-10 w-10 bg-tertiary rounded-xl border-2 border-accent/30 shadow-lg" />
                        {canManage && (
                            <button
                                onClick={() => setIsIconSelectOpen(true)}
                                className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center shadow-lg hover:bg-accent/80 transition-all z-20 border border-secondary"
                                title="길드 마크 변경"
                                type="button"
                            >
                                <span className="text-[9px]">✏️</span>
                            </button>
                        )}
                    </div>
                    <div className="flex min-w-0 flex-1 items-stretch gap-2">
                        <div className="flex min-w-0 flex-[1.35] flex-col justify-center gap-1">
                            <h1
                                className="w-full min-w-0 font-bold text-highlight drop-shadow-md flex flex-wrap items-center justify-center text-center gap-x-1.5 gap-y-0.5"
                                title={guildDisplayName ? `Lv.${guildLevel} ${guildDisplayName}` : ''}
                            >
                                <span className="shrink-0 text-sm font-semibold text-secondary tabular-nums">Lv.{guildLevel}</span>
                                <span className="min-w-0 max-w-full truncate text-base">
                                    {currentGuild ? guildDisplayName : '로딩 중...'}
                                </span>
                            </h1>
                            <div className="w-full min-w-0 px-0">
                                <div className="w-full bg-gray-700/50 rounded-full h-2 sm:h-2.5 border border-gray-600/50 overflow-hidden shadow-inner">
                                    <div
                                        className="relative bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                        style={{ width: `${xpProgress}%` }}
                                    >
                                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] tabular-nums sm:text-[9px]">
                                            {guildXp.toLocaleString()} / {xpForNextLevel.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex min-w-0 flex-1 items-stretch">
                            <Button
                                type="button"
                                onClick={() => setIsMobileDonationOpen(true)}
                                colorScheme="none"
                                title="길드 기부"
                                className={`${getLuxuryButtonClasses('accent')} !text-[11px] sm:!text-xs !py-0.5 sm:!py-1 !px-2 sm:!px-3 w-full h-full min-h-[2.1rem] sm:min-h-[2.35rem]`}
                            >
                                길드 기부
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="w-full max-w-full flex-shrink-0">
                    <div className="flex w-full rounded-xl border border-stone-600/40 bg-gradient-to-r from-stone-800/80 to-stone-700/60 p-1 shadow-md">
                        {tabs.map(tab => {
                            const tabColors: Record<GuildTab, { active: string; inactive: string }> = {
                                home: { active: 'from-amber-600 to-amber-500', inactive: 'text-amber-300/70 hover:text-amber-300' },
                                members: { active: 'from-blue-600 to-blue-500', inactive: 'text-blue-300/70 hover:text-blue-300' },
                                management: { active: 'from-purple-600 to-purple-500', inactive: 'text-purple-300/70 hover:text-purple-300' },
                                boss: { active: 'from-red-600 to-red-500', inactive: 'text-red-300/70 hover:text-red-300' },
                                war: { active: 'from-orange-600 to-orange-500', inactive: 'text-orange-300/70 hover:text-orange-300' },
                            };
                            const colors = tabColors[tab.id];
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 font-bold rounded-lg transition-all py-2 text-xs ${
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

                {activeTab === 'home' && (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                        <div className="w-full flex-shrink-0">
                            <GuildCheckInPanel guild={currentGuild || guild} />
                        </div>
                        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
                            <div className="min-h-0 overflow-y-auto">
                                <GuildAnnouncementPanel guild={currentGuild || guild} compact />
                            </div>
                            <div className="min-h-0">
                                <div className="grid h-full grid-cols-2 gap-1.5">
                                    {guildHomeActions.map((act) => (
                                        <button
                                            key={act.key}
                                            type="button"
                                            onClick={act.action}
                                            title={act.name}
                                            className="relative flex min-h-0 flex-col items-center justify-center gap-1 rounded-lg border border-stone-600/50 bg-gradient-to-br from-stone-800/85 to-stone-900/80 px-1 py-1.5 transition-all hover:brightness-110 active:scale-[0.98]"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-600/40 bg-stone-700/50">
                                                <img src={act.icon} alt="" className="h-8 w-8 object-contain drop-shadow-md" />
                                            </div>
                                            <span className="max-w-full break-keep px-0.5 text-center text-[10px] font-semibold leading-tight text-highlight">
                                                {act.name}
                                            </span>
                                            {act.notification && (
                                                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-stone-800 bg-red-500 shadow-sm" aria-hidden />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <NineSlicePanel className="h-full min-h-0">
                                <GuildMembersPanel guild={currentGuild || guild} myMemberInfo={myMemberInfo} compact />
                            </NineSlicePanel>
                        </div>
                    </div>
                )}

                {activeTab === 'management' && canManage && (
                    <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <NineSlicePanel className="h-full min-h-0">
                                <GuildManagementPanel guild={currentGuild || guild} compact />
                            </NineSlicePanel>
                        </div>
                    </div>
                )}

                {activeTab === 'boss' && (
                    <div className="min-h-0 flex-1">
                        <BossPanel guild={currentGuild || guild} className="h-full" forceDesktopPanelLayout />
                    </div>
                )}

                {activeTab === 'war' && (
                    <div className="min-h-0 flex-1">
                        <WarPanel guild={currentGuild || guild} className="h-full" forceDesktopPanelLayout />
                    </div>
                )}
            </main>
            </>
            )}
            {typeof document !== 'undefined' &&
                (goldAnimation || diamondAnimation) &&
                createPortal(
                    <div
                        className="pointer-events-none fixed inset-0 z-[200000]"
                        style={{ isolation: 'isolate' }}
                        aria-hidden
                    >
                        {goldAnimation}
                        {diamondAnimation}
                    </div>,
                    document.getElementById('sudamr-modal-root') ?? document.body
                )}
            </div>
        </div>
    );
};