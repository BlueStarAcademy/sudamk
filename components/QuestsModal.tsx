import React, { useState, useMemo, useCallback, useRef, useEffect, useId } from 'react';
import { UserWithStatus, Quest, ServerAction, QuestLog, QuestReward } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { DAILY_MILESTONE_THRESHOLDS, WEEKLY_MILESTONE_THRESHOLDS, MONTHLY_MILESTONE_THRESHOLDS, DAILY_MILESTONE_REWARDS, WEEKLY_MILESTONE_REWARDS, MONTHLY_MILESTONE_REWARDS, CONSUMABLE_ITEMS, ACHIEVEMENT_TRACKS } from '../constants';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH, isInsideSudamrAdUi } from '../constants/ads.js';
import { clampQuestProgressToTarget } from '../utils/questProgressCap.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { getAdventureUnderstandingTierFromXp } from '../constants/adventureConstants.js';
import { getAdventureCodexCompletionBreakdown } from '../utils/adventureCodexCompletion.js';

interface QuestsModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

type QuestTab = 'daily' | 'weekly' | 'monthly' | 'achievements';
type QuestData = NonNullable<QuestLog['daily' | 'weekly' | 'monthly']>;

/** 퀘스트 진행 막대: 카드 내에서 늘어나되 상한만 둠 */
const QUEST_ITEM_BAR_MAX_CLASS = 'max-w-[14rem]';

const questTextScrollRowClass =
    'max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent]';

/** 퀘스트 활약도 전용 심볼 — 보상 줄·상세·오늘의 활약도 등 동일 마크 */
const ActivityVitalityIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 14 }) => {
    const gradId = `q-av-${useId().replace(/:/g, '')}`;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            className={`shrink-0 ${className}`}
            aria-hidden
            focusable="false"
        >
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="55%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
            </defs>
            <path
                fill={`url(#${gradId})`}
                d="M8 1.2 9.62 5.86 14.6 6.38 10.9 9.58 12.1 14.48 8 11.7 3.9 14.48 5.1 9.58 1.4 6.38 6.38 5.86z"
            />
        </svg>
    );
};

/** 퀘스트 목록 제목 옆 아이콘 (퀵메뉴·에셋과 동일 계열) */
const QUEST_LIST_ICON_SRC = '/images/quest.png';

/** 상점 소모품 탭과 동일: 행동력 회복제 카드는 ⚡ + 수치 배지 */
const getShopActionPointBadgeFromReward = (reward: QuestReward): string | null => {
    if (!reward.items?.length) return null;
    const ref = reward.items[0];
    const id = 'itemId' in ref ? ref.itemId : (ref as { name?: string }).name;
    if (!id || typeof id !== 'string') return null;
    if (id === 'action_point_10' || id === '행동력 회복제(+10)') return '+10';
    if (id === 'action_point_20' || id === '행동력 회복제(+20)') return '+20';
    if (id === 'action_point_30' || id === '행동력 회복제(+30)') return '+30';
    return null;
};

const getQuestDisplayTitle = (title: string): string => {
    if (title === '자동대국 토너먼트 참여하기' || title === '챔피언십 경기 진행하기' || title === '챔피언십 경기 완료하기') {
        return '챔피언십 경기 완료';
    }
    if (title === '일일퀘스트 활약도100보상 받기(3/3)' || title === '일일퀘스트 활약도100보상 받기 3회') {
        return '일일 퀘스트 활약도 100보상 받기 (3회)';
    }
    if (title === '주간퀘스트 활약도100보상 받기(2/2)') {
        return '주간 퀘스트 활약도 100보상 받기 (2회)';
    }
    return title;
};

const AchievementTrackPanel: React.FC<{
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    isMobile: boolean;
}> = ({ currentUser, onAction, isMobile }) => {
    const [viewIndices, setViewIndices] = useState<Record<string, number>>({});
    const [detailOpenMap, setDetailOpenMap] = useState<Record<string, boolean>>({});
    const adventureTierIndexByLabel: Record<string, number> = { 편함: 1, 익숙함: 2, 친숙함: 3, 정복: 4 };

    const isRequirementMet = (stage: (typeof ACHIEVEMENT_TRACKS)[number]['stages'][number]) => {
        if (stage.requirement.type === 'singleplayer_stage_clear') {
            return (currentUser.clearedSinglePlayerStages ?? []).includes(stage.requirement.stageId);
        }
        if (stage.requirement.type === 'strategy_level') {
            return (currentUser.strategyLevel ?? 0) >= stage.requirement.level;
        }
        if (stage.requirement.type === 'playful_level') {
            return (currentUser.playfulLevel ?? 0) >= stage.requirement.level;
        }
        if (stage.requirement.type === 'championship_cumulative_score') {
            return (currentUser.cumulativeTournamentScore ?? 0) >= stage.requirement.score;
        }
        if (stage.requirement.type === 'all_equipment_min_grade') {
            const gradeOrder = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'transcendent'];
            const requiredIndex = gradeOrder.indexOf(stage.requirement.grade);
            const slots: Array<'fan' | 'board' | 'top' | 'bottom' | 'bowl' | 'stones'> = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
            return slots.every((slot) => {
                const equippedId = currentUser.equipment?.[slot];
                if (!equippedId) return false;
                const item = currentUser.inventory.find((it) => it.id === equippedId);
                if (!item) return false;
                const normalizedGrade = String(item.grade).toLowerCase();
                const idx = gradeOrder.indexOf(normalizedGrade);
                return idx >= requiredIndex;
            });
        }
        if (stage.requirement.type === 'strategy_tier' || stage.requirement.type === 'playful_tier') {
            const tierScoreMap: Record<string, number> = {
                루키: 1300,
                브론즈: 1400,
                실버: 1500,
                골드: 1700,
                플래티넘: 2000,
                다이아: 2400,
                마스터: 3000,
                챌린저: 3500,
            };
            const scoreDiff = stage.requirement.type === 'strategy_tier'
                ? (currentUser.cumulativeRankingScore?.standard ?? 0)
                : (currentUser.cumulativeRankingScore?.playful ?? 0);
            const seasonScore = 1200 + scoreDiff;
            return seasonScore >= (tierScoreMap[stage.requirement.tier] ?? Number.MAX_SAFE_INTEGER);
        }
        if (stage.requirement.type === 'adventure_understanding_tier') {
            const xp = Math.max(0, Math.floor(currentUser.adventureProfile?.understandingXpByStage?.[stage.requirement.stageId] ?? 0));
            const currentTier = getAdventureUnderstandingTierFromXp(xp);
            const requiredTier = adventureTierIndexByLabel[stage.requirement.tier] ?? Number.MAX_SAFE_INTEGER;
            return currentTier >= requiredTier;
        }
        if (stage.requirement.type === 'adventure_codex_score') {
            const { totalSum } = getAdventureCodexCompletionBreakdown(currentUser.adventureProfile);
            return totalSum >= stage.requirement.score;
        }
        if (stage.requirement.type === 'blacksmith_level') {
            return (currentUser.blacksmithLevel ?? 1) >= stage.requirement.level;
        }
        return false;
    };

    const totalStages = ACHIEVEMENT_TRACKS.reduce((sum, track) => sum + track.stages.length, 0);
    const totalClaimed = ACHIEVEMENT_TRACKS.reduce((sum, track) => {
        const trackState = currentUser.quests?.achievements?.tracks?.[track.id] ?? { currentIndex: 0, claimedIndices: [] };
        const claimedIndices = Array.isArray(trackState.claimedIndices) ? trackState.claimedIndices : [];
        return sum + claimedIndices.length;
    }, 0);

    return (
        <div className={`rounded-2xl border border-slate-400/15 bg-slate-950/75 shadow-[0_20px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07] ${isMobile ? 'p-3' : 'p-4'}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h3 className={`font-bold tracking-tight text-white ${isMobile ? 'text-sm' : 'text-lg'}`}>전체 업적</h3>
                </div>
                <span className={`rounded-full border border-amber-400/30 bg-gradient-to-b from-amber-950/90 via-slate-950/95 to-slate-950 px-3 py-1 font-bold tabular-nums text-amber-50 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {totalClaimed}/{totalStages}
                </span>
            </div>
            <ul className={`${isMobile ? 'space-y-2' : 'space-y-3'}`}>
                {ACHIEVEMENT_TRACKS.map((track) => {
                    const trackState = currentUser.quests?.achievements?.tracks?.[track.id] ?? { currentIndex: 0, claimedIndices: [] };
                    const claimedIndices = Array.isArray(trackState.claimedIndices) ? trackState.claimedIndices : [];
                    const currentIndex = Math.max(0, Math.min(track.stages.length - 1, trackState.currentIndex ?? 0));
                    const viewIndex = Math.max(0, Math.min(track.stages.length - 1, viewIndices[track.id] ?? currentIndex));
                    const stage = track.stages[viewIndex];
                    const isCleared = isRequirementMet(stage);
                    const isClaimed = claimedIndices.includes(viewIndex);
                    const isCurrentStage = viewIndex === currentIndex;
                    const canClaim = isCurrentStage && isCleared && !isClaimed;
                    const isDetailOpen = !!detailOpenMap[track.id];

                    return (
                        <li key={track.id} className="rounded-2xl border border-slate-500/25 bg-gradient-to-br from-slate-900/95 via-[#0f1118]/98 to-[#080a0f] p-2.5 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-500/[0.07] sm:p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h4 className={`min-w-0 truncate font-semibold tracking-tight text-slate-100 ${isMobile ? 'text-[13px]' : 'text-[15px]'}`}>{track.title}</h4>
                                <span className="shrink-0 rounded-full border border-amber-500/30 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                                    {viewIndex + 1}/{track.stages.length}
                                </span>
                            </div>
                            <div className="flex items-start justify-between gap-2.5">
                                <div className="relative min-w-0 flex-1">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDetailOpenMap((prev) => ({ ...prev, [track.id]: !prev[track.id] }))}
                                            className={`text-left font-bold tracking-tight text-slate-100 hover:text-amber-200 ${isMobile ? 'text-[15px]' : 'text-lg'}`}
                                            title="클릭하여 상세 설명 보기"
                                        >
                                            {stage.title}
                                        </button>
                                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${isCleared ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-300'}`}>
                                            {isCleared ? '조건 달성' : '미달성'}
                                        </span>
                                    </div>
                                    {isDetailOpen ? (
                                        <div
                                            role="dialog"
                                            aria-label="업적 상세"
                                            className={`absolute left-0 z-20 mt-2 w-full rounded-xl border border-amber-500/25 bg-gradient-to-b from-[#1a1d28]/98 via-[#12151c]/98 to-[#0a0c10]/98 px-3 py-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/10 backdrop-blur-md ${isMobile ? 'max-w-[20rem]' : 'max-w-[24rem]'}`}
                                        >
                                            <p className={`text-slate-200 ${isMobile ? 'text-[11px] leading-relaxed' : 'text-xs leading-relaxed'}`}>
                                                {stage.description}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-black/30 px-2 py-1">
                                    <img src="/images/icon/Zem.png" alt="" className="h-4 w-4 object-contain" />
                                    <span className="text-xs font-semibold text-amber-100 tabular-nums">{stage.rewardDiamonds}</span>
                                </div>
                            </div>
                            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setViewIndices((prev) => ({ ...prev, [track.id]: Math.max(0, viewIndex - 1) }))}
                                    disabled={viewIndex <= 0}
                                    className="rounded-lg border border-slate-600/40 bg-slate-800/60 px-2 py-1.5 text-[11px] text-slate-200 disabled:opacity-40"
                                >
                                    이전
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAction({ type: 'CLAIM_ACHIEVEMENT_REWARD', payload: { trackId: track.id, stageIndex: viewIndex } })}
                                    disabled={!canClaim}
                                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                                        canClaim
                                            ? 'border-amber-400/30 bg-gradient-to-b from-amber-500/25 via-amber-900/40 to-amber-950/85 text-amber-50'
                                            : 'border-slate-600/40 bg-slate-800/60 text-slate-300'
                                    }`}
                                >
                                    {isClaimed ? '완료' : canClaim ? '보상 받기' : isCurrentStage ? '진행 중' : '기록 보기'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewIndices((prev) => ({ ...prev, [track.id]: Math.min(track.stages.length - 1, viewIndex + 1) }))}
                                    disabled={viewIndex >= track.stages.length - 1}
                                    className="rounded-lg border border-slate-600/40 bg-slate-800/60 px-2 py-1.5 text-[11px] text-slate-200 disabled:opacity-40"
                                >
                                    다음
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

/** 퀘스트 수령 — 작은 프레임, 징크/에메랄드 톤 (리소스 버튼보다 컴팩트) */
const QuestClaimStripButton: React.FC<{
    isClaimed: boolean;
    isComplete: boolean;
    onClaim: () => void;
    isMobile: boolean;
}> = ({ isClaimed, isComplete, onClaim, isMobile }) => {
    const size = isMobile ? 'px-2 py-1.5 text-[11px]' : 'px-2.5 py-2 text-xs';
    const base =
        `w-full rounded-lg border text-center font-semibold leading-tight transition-[transform,box-shadow,border-color,background-color] duration-200 ` +
        `shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-white/[0.06] ${size}`;
    if (isClaimed) {
        return (
            <button type="button" disabled className={`${base} cursor-default border-slate-500/35 bg-slate-800/90 text-slate-500`}>
                완료
            </button>
        );
    }
    if (!isComplete) {
        return (
            <button type="button" disabled className={`${base} cursor-default border-slate-600/30 bg-slate-900/85 text-slate-500`}>
                진행 중
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onClaim}
            className={`${base} border-amber-400/30 bg-gradient-to-b from-amber-500/25 via-amber-900/40 to-amber-950/85 text-amber-50 hover:border-amber-300/45 hover:from-amber-400/30 active:scale-[0.99]`}
        >
            보상 받기
        </button>
    );
};

const QuestRewardPill: React.FC<{ quest: Quest; isMobile: boolean }> = ({ quest, isMobile }) => {
    const hasGold = Boolean(quest.reward?.gold && quest.reward.gold > 0);
    const firstItem = quest.reward?.items?.[0];
    const itemName = firstItem ? ('itemId' in firstItem ? firstItem.itemId : firstItem.name) : null;
    const itemQty = firstItem?.quantity ?? 0;
    const itemImage = itemName ? (CONSUMABLE_ITEMS.find((item) => item.name === itemName)?.image ?? null) : null;
    const ap = quest.activityPoints ?? 0;
    const hasActivity = ap > 0;

    if (!hasGold && !firstItem && !hasActivity) return null;

    return (
        <div
            className={`flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-md border border-amber-500/20 bg-black/30 px-1.5 py-1 text-center ${
                isMobile ? 'text-[10px]' : 'text-[11px]'
            }`}
            title="퀘스트 보상"
        >
            {hasGold || hasActivity ? (
                <span className="inline-flex min-w-0 flex-nowrap items-center justify-center gap-x-2 font-semibold">
                    {hasGold ? (
                        <span className="inline-flex min-w-0 items-center gap-0.5 text-amber-100">
                            <img src="/images/icon/Gold.png" alt="" className="h-3 w-3 shrink-0 opacity-95" />
                            <span className="truncate tabular-nums">{quest.reward.gold!.toLocaleString()}</span>
                        </span>
                    ) : null}
                    {hasActivity ? (
                        <span className="shrink-0 tabular-nums text-amber-200">
                            ⭐+{ap}
                        </span>
                    ) : null}
                </span>
            ) : null}
            {firstItem ? (
                <span className="inline-flex min-w-0 items-center gap-0.5 font-semibold text-slate-100">
                    {itemImage ? <img src={itemImage} alt="" className="h-3 w-3 object-contain" /> : null}
                    <span className="truncate">{itemName}</span>
                    <span className="tabular-nums text-amber-200">x{itemQty}</span>
                </span>
            ) : null}
        </div>
    );
};

const QuestDetailBubble: React.FC<{
    description: string;
    activityPoints: number;
    gold?: number;
    isMobile: boolean;
    onClose: () => void;
}> = ({ description, activityPoints, gold, isMobile, onClose }) => (
    <div
        className={`pointer-events-auto absolute z-50 mt-2 animate-fade-in ${
            isMobile ? 'left-0 right-0 mx-auto w-[min(100%,20rem)]' : 'left-0 w-[min(100%,19rem)]'
        }`}
        role="dialog"
        aria-label="퀘스트 상세"
    >
        <div className="relative rounded-xl border border-amber-500/25 bg-gradient-to-b from-[#1a1d28]/98 via-[#12151c]/98 to-[#0a0c10]/98 p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/10 backdrop-blur-md">
            <div
                className="absolute -top-1.5 left-5 h-2.5 w-2.5 rotate-45 border-l border-t border-amber-500/30 bg-[#1a1d28]"
                aria-hidden
            />
            <p className={`text-slate-200/95 ${isMobile ? 'text-[11px] leading-relaxed' : 'text-xs leading-relaxed'}`}>{description}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-amber-500/15 pt-2 text-[11px] text-amber-100/90 sm:text-xs">
                <span className="inline-flex items-center gap-1 font-medium tracking-tight">
                    <ActivityVitalityIcon size={isMobile ? 12 : 13} />
                    활약도 +{activityPoints}
                </span>
                {gold != null && gold > 0 ? (
                    <span className="font-medium tracking-tight">
                        <img src="/images/icon/Gold.png" alt="" className="mb-px mr-0.5 inline h-3 w-3 align-middle opacity-95" />
                        골드 +{gold.toLocaleString()}
                    </span>
                ) : null}
            </div>
            <button
                type="button"
                onClick={onClose}
                className="mt-2 w-full rounded-md border border-slate-600/40 bg-slate-800/60 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-slate-500/50 hover:bg-slate-700/50 hover:text-slate-300 sm:text-xs"
            >
                닫기
            </button>
        </div>
    </div>
);

const QuestItem: React.FC<{ quest: Quest; onClaim: (id: string) => void; isMobile: boolean }> = ({ quest, onClaim, isMobile }) => {
    const [bubbleOpen, setBubbleOpen] = useState(false);
    const titleWrapRef = useRef<HTMLDivElement>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);
    const displayProgress = clampQuestProgressToTarget(quest.progress, quest.target);
    const isComplete = quest.progress >= quest.target;
    const percentage = quest.target > 0 ? (displayProgress / quest.target) * 100 : 0;
    const displayTitle = getQuestDisplayTitle(quest.title);

    const handleClaimClick = useCallback(() => {
        if (isComplete && !quest.isClaimed) {
            onClaim(quest.id);
        }
    }, [isComplete, quest.isClaimed, quest.id, onClaim]);

    useEffect(() => {
        if (!bubbleOpen) return;
        const onDocDown = (e: MouseEvent) => {
            if (isInsideSudamrAdUi(e.target)) return;
            const t = e.target as Node;
            if (titleWrapRef.current?.contains(t)) return;
            if (bubbleRef.current?.contains(t)) return;
            setBubbleOpen(false);
        };
        document.addEventListener('mousedown', onDocDown);
        return () => document.removeEventListener('mousedown', onDocDown);
    }, [bubbleOpen]);

    const claimBlock = (
        <div className="flex w-full min-w-0 flex-col items-stretch gap-1" data-quest-claim onClick={(e) => e.stopPropagation()}>
            <QuestRewardPill quest={quest} isMobile={isMobile} />
            <QuestClaimStripButton
                isClaimed={quest.isClaimed}
                isComplete={isComplete}
                onClaim={handleClaimClick}
                isMobile={isMobile}
            />
        </div>
    );

    const iconBox = (
        <div
            className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-xl border border-amber-900/35 bg-gradient-to-b from-slate-800/80 to-slate-950/90 text-2xl text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10"
            aria-hidden
        >
            📜
        </div>
    );

    const mainColumn = (
        <div className="min-w-0 flex-1">
            <div ref={titleWrapRef} className="relative">
                <button
                    type="button"
                    className="group flex w-full min-w-0 items-center gap-1.5 rounded-lg py-0.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-amber-400/35"
                    onClick={() => setBubbleOpen((o) => !o)}
                    aria-expanded={bubbleOpen}
                    aria-haspopup="dialog"
                >
                    <span
                        className={`flex shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/10 ${
                            isMobile ? 'h-7 w-7' : 'h-9 w-9'
                        }`}
                        aria-hidden
                    >
                        <img
                            src={QUEST_LIST_ICON_SRC}
                            alt=""
                            className={`object-contain opacity-95 transition-opacity group-hover:opacity-100 ${isMobile ? 'h-4 w-4' : 'h-[1.35rem] w-[1.35rem]'}`}
                        />
                    </span>
                    <span
                        className={`min-w-0 flex-1 font-semibold leading-snug tracking-tight text-slate-100 ${isMobile ? 'text-[13px]' : 'text-[15px]'} ${bubbleOpen ? '' : 'truncate'}`}
                    >
                        {displayTitle}
                    </span>
                </button>
                {bubbleOpen ? (
                    <div ref={bubbleRef}>
                        <QuestDetailBubble
                            description={quest.description}
                            activityPoints={quest.activityPoints}
                            gold={quest.reward.gold}
                            isMobile={isMobile}
                            onClose={() => setBubbleOpen(false)}
                        />
                    </div>
                ) : null}
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2.5">
                <div
                    className={`relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border border-slate-600/40 bg-slate-950/85 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] ${QUEST_ITEM_BAR_MAX_CLASS}`}
                >
                    <div
                        className="absolute inset-y-0 left-0 overflow-hidden rounded-full shadow-[0_0_10px_rgba(251,191,36,0.28)]"
                        style={{ width: `${percentage}%` }}
                    >
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300" />
                        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.22] to-transparent" />
                    </div>
                </div>
                <span
                    className={`shrink-0 tabular-nums font-medium text-amber-200/85 ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                >
                    {displayProgress}/{quest.target}
                </span>
            </div>
        </div>
    );

    const cardShell = 'rounded-2xl border border-slate-500/25 bg-gradient-to-br from-slate-900/95 via-[#0f1118]/98 to-[#080a0f] p-2.5 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-500/[0.07] sm:p-3';

    if (isMobile) {
        return (
            <div className={cardShell}>
                <div className="flex min-w-0 items-stretch gap-2.5">
                    {mainColumn}
                    <div className="flex w-[5.75rem] shrink-0 flex-col justify-center">{claimBlock}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-stretch gap-3 ${cardShell}`}>
            {iconBox}
            {mainColumn}
            <div className="flex w-[6.5rem] shrink-0 flex-col justify-center">{claimBlock}</div>
        </div>
    );
};

const ActivityPanel: React.FC<{
    title: string;
    questData: QuestData | undefined;
    thresholds: number[];
    rewards: QuestReward[];
    questType: 'daily' | 'weekly' | 'monthly';
    onClaim: (index: number, type: 'daily' | 'weekly' | 'monthly') => void;
    isMobile: boolean;
}> = ({ title, questData, thresholds, rewards, questType, onClaim, isMobile }) => {
    if (!questData) return null;

    const { activityProgress, claimedMilestones } = questData;
    const maxProgress = thresholds[thresholds.length - 1];
    const displayActivity = clampQuestProgressToTarget(activityProgress, maxProgress);

    /** 마일스톤 N 보상은 구간 (이전~N]의 중앙에 둠 — 예: 20보상 → 0~20의 중앙(10/최대) */
    const rewardCenterLeftPct = (index: number, milestone: number): number => {
        if (maxProgress <= 0) return 0;
        const prev = index === 0 ? 0 : thresholds[index - 1]!;
        const segmentMid = (prev + milestone) / 2;
        return (segmentMid / maxProgress) * 100;
    };

    const getItemImage = (reward: QuestReward): string => {
        if (!reward.items || reward.items.length === 0) return '/images/Box/box.png';
        const firstItem = reward.items[0];
        const raw = 'itemId' in firstItem ? firstItem.itemId : firstItem.name;
        const fromShopId =
            raw === 'action_point_10'
                ? '행동력 회복제(+10)'
                : raw === 'action_point_20'
                  ? '행동력 회복제(+20)'
                  : raw === 'action_point_30'
                    ? '행동력 회복제(+30)'
                    : raw;
        const itemTemplate = CONSUMABLE_ITEMS.find((item) => item.name === fromShopId);
        return itemTemplate?.image ?? '/images/Box/box.png';
    };

    const trackWrap = 'mb-2 w-full';
    const barHeight = 'h-3.5';
    const milestoneIcon = 'h-8 w-8';
    const milestoneMinH = isMobile ? '4rem' : '4.25rem';
    const fillPct = maxProgress > 0 ? (displayActivity / maxProgress) * 100 : 0;

    return (
        <div
            className={`relative mb-4 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-400/15 bg-slate-950/75 p-3 shadow-[0_20px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07] backdrop-blur-md sm:p-4`}
        >
            <div className="pointer-events-none absolute -right-6 -top-16 h-36 w-36 rounded-full bg-emerald-400/[0.09] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-amber-400/[0.08] blur-3xl" />
            <div className="relative mb-3 flex min-w-0 items-end justify-between gap-3">
                <div className="min-w-0">
                    <p
                        className={`mb-0.5 flex items-center gap-1 font-semibold uppercase tracking-[0.18em] text-amber-200/40 ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}
                    >
                        <span className="text-sm leading-none text-amber-300 sm:text-base" aria-hidden>
                            ⭐
                        </span>
                        활약도
                    </p>
                    <div className={questTextScrollRowClass}>
                        <h3 className={`shrink-0 font-bold tracking-tight text-white ${isMobile ? 'text-sm' : 'text-lg'}`}>{title}</h3>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <span
                        className={`inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-gradient-to-b from-amber-950/90 via-slate-950/95 to-slate-950 px-2.5 py-1 font-bold tabular-nums text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-3 sm:py-1.5 ${isMobile ? 'text-xs' : 'text-sm'}`}
                    >
                        <span className={`leading-none text-amber-300 ${isMobile ? 'text-sm' : 'text-base'}`} aria-hidden>
                            ⭐
                        </span>
                        {displayActivity}
                        <span className="mx-0.5 font-normal text-amber-200/45">/</span>
                        {maxProgress}
                    </span>
                    <span className={`font-medium tabular-nums text-slate-500 ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
                        {Math.min(100, fillPct).toFixed(0)}% 달성
                    </span>
                </div>
            </div>
            <div className={trackWrap}>
                <div
                    className="relative w-full rounded-full bg-gradient-to-r from-emerald-500/25 via-amber-500/20 to-teal-500/25 p-[2.5px] shadow-[0_0_20px_-8px_rgba(52,211,153,0.35)] sm:p-[3px]"
                >
                    <div
                        className={`relative w-full overflow-hidden rounded-full border border-slate-700/50 bg-slate-950/95 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)] ${barHeight}`}
                    >
                    <div
                        className="relative h-full overflow-hidden rounded-full shadow-[0_0_14px_rgba(52,211,153,0.22)]"
                        style={{ width: `${Math.min(100, fillPct)}%` }}
                    >
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-lime-400" />
                        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.18] to-transparent" />
                    </div>
                    {thresholds.map((milestone, index) => {
                        if (!rewards[index]) return null;
                        if (milestone === maxProgress) return null;
                        const milestonePosition = (milestone / maxProgress) * 100;
                        const progressMet = activityProgress >= milestone;
                        const isClaimed = claimedMilestones[index];

                        return (
                            <div
                                key={`marker-${milestone}`}
                                className="absolute bottom-0 top-0 -translate-x-1/2"
                                style={{ left: `${milestonePosition}%` }}
                            >
                                <div
                                    className={`h-full w-px ${
                                        isClaimed ? 'bg-emerald-300/90' : progressMet ? 'bg-amber-300/85' : 'bg-slate-500/70'
                                    }`}
                                />
                            </div>
                        );
                    })}
                    </div>
                </div>
                <div className="relative w-full pb-0.5" style={{ minHeight: milestoneMinH }}>
                {thresholds.map((milestone, index) => {
                    if (!rewards[index]) return null;
                    const progressMet = activityProgress >= milestone;
                    const isClaimed = claimedMilestones[index];
                    const canClaim = progressMet && !isClaimed;
                    const reward = rewards[index];
                    const itemImage = getItemImage(reward);
                    const apBadge = getShopActionPointBadgeFromReward(reward);
                    const leftPct = rewardCenterLeftPct(index, milestone);
                    const iconClass = milestoneIcon;

                    return (
                        <div
                            key={milestone}
                            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                            style={{ left: `${leftPct}%` }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    if (canClaim) {
                                        onClaim(index, questType);
                                    }
                                }}
                                disabled={!canClaim}
                                className={`relative ${iconClass} rounded-lg border border-slate-500/35 bg-gradient-to-b from-slate-800/90 to-slate-950/90 p-0.5 shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed ${canClaim ? 'ring-1 ring-amber-400/40 shadow-[0_0_16px_-6px_rgba(251,191,36,0.55)]' : ''}`}
                                title={isClaimed ? '수령 완료' : progressMet ? '보상 수령' : `${milestone} 활약도 필요`}
                            >
                                <div
                                    className={`relative h-full w-full rounded-md ${!progressMet && !isClaimed ? 'opacity-45 grayscale' : ''}`}
                                    aria-label={
                                        apBadge ? `${milestone} 활약도 보상 행동력 회복제` : `${milestone} 활약도 보상`
                                    }
                                >
                                    <img
                                        src={itemImage}
                                        alt=""
                                        className="h-full w-full object-contain p-0.5"
                                    />
                                    {apBadge ? (
                                        <span className="absolute right-0 top-0 rounded-bl bg-gray-900/90 px-1 text-[10px] font-bold leading-tight text-cyan-300 shadow-md">
                                            {apBadge}
                                        </span>
                                    ) : null}
                                </div>
                                {isClaimed && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/65 text-sm text-emerald-400">
                                        ✓
                                    </div>
                                )}
                            </button>
                            <span
                                className={`mt-0.5 font-bold tabular-nums leading-none ${progressMet ? 'text-amber-200' : 'text-slate-500'} ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                            >
                                {milestone}
                            </span>
                        </div>
                    );
                })}
                </div>
            </div>
        </div>
    );
};


const QuestsModal: React.FC<QuestsModalProps> = ({ currentUser: propCurrentUser, onClose, onAction, isTopmost }) => {
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;

    const currentUser = propCurrentUser;

    const [activeTab, setActiveTab] = useState<QuestTab>('daily');
    const { quests } = currentUser;

    const modalInitialWidth = useMemo(() => {
        if (typeof window === 'undefined') return 800;
        if (!isMobile) return 800;
        return Math.min(720, Math.max(280, Math.round(window.innerWidth - 16)));
    }, [isMobile]);

    const modalInitialHeight = useMemo(() => {
        if (typeof window === 'undefined') return 900;
        if (!isMobile) return 900;
        return Math.min(920, Math.max(420, Math.round(window.innerHeight * 0.88)));
    }, [isMobile]);

    const handleClaim = (questId: string) => {
        onAction({ type: 'CLAIM_QUEST_REWARD', payload: { questId } });
    };

    const questList =
        activeTab === 'daily'
            ? quests.daily?.quests || []
            : activeTab === 'weekly'
              ? quests.weekly?.quests || []
              : activeTab === 'monthly'
                ? quests.monthly?.quests || []
                : [];

    // 주간 탭: 수령 가능한 퀘스트 보상 또는 활약도 마일스톤이 있으면 true
    const hasClaimableWeekly = useMemo(() => {
        const weekly = quests.weekly;
        if (!weekly) return false;
        const questClaimable = (weekly.quests || []).some((q: Quest) => q.progress >= q.target && !q.isClaimed);
        const milestoneClaimable = WEEKLY_MILESTONE_THRESHOLDS.some((th, i) => 
            (weekly.claimedMilestones?.[i] === false) && (weekly.activityProgress ?? 0) >= th
        );
        return questClaimable || milestoneClaimable;
    }, [quests.weekly]);

    // 월간 탭: 수령 가능한 퀘스트 보상 또는 활약도 마일스톤이 있으면 true
    const hasClaimableMonthly = useMemo(() => {
        const monthly = quests.monthly;
        if (!monthly) return false;
        const questClaimable = (monthly.quests || []).some((q: Quest) => q.progress >= q.target && !q.isClaimed);
        const milestoneClaimable = MONTHLY_MILESTONE_THRESHOLDS.some((th, i) => 
            (monthly.claimedMilestones?.[i] === false) && (monthly.activityProgress ?? 0) >= th
        );
        return questClaimable || milestoneClaimable;
    }, [quests.monthly]);

    const hasClaimableAchievements = useMemo(() => {
        for (const track of ACHIEVEMENT_TRACKS) {
            const trackState = quests.achievements?.tracks?.[track.id] ?? { currentIndex: 0, claimedIndices: [] };
            const claimedIndices = Array.isArray(trackState.claimedIndices) ? trackState.claimedIndices : [];
            const currentIndex = Math.max(0, Math.min(track.stages.length - 1, trackState.currentIndex ?? 0));
            const stage = track.stages[currentIndex];
            if (!stage || claimedIndices.includes(currentIndex)) continue;

            const requirement = stage.requirement;
            let met = false;
            if (requirement.type === 'singleplayer_stage_clear') {
                met = (currentUser.clearedSinglePlayerStages ?? []).includes(requirement.stageId);
            } else if (requirement.type === 'strategy_level') {
                met = (currentUser.strategyLevel ?? 0) >= requirement.level;
            } else if (requirement.type === 'playful_level') {
                met = (currentUser.playfulLevel ?? 0) >= requirement.level;
            } else if (requirement.type === 'championship_cumulative_score') {
                met = (currentUser.cumulativeTournamentScore ?? 0) >= requirement.score;
            } else if (requirement.type === 'all_equipment_min_grade') {
                const gradeOrder = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'transcendent'];
                const requiredIdx = gradeOrder.indexOf(requirement.grade);
                const slots: Array<'fan' | 'board' | 'top' | 'bottom' | 'bowl' | 'stones'> = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
                met = slots.every((slot) => {
                    const equippedId = currentUser.equipment?.[slot];
                    if (!equippedId) return false;
                    const item = currentUser.inventory.find((it) => it.id === equippedId);
                    if (!item) return false;
                    const idx = gradeOrder.indexOf(String(item.grade).toLowerCase());
                    return idx >= requiredIdx;
                });
            } else if (requirement.type === 'strategy_tier' || requirement.type === 'playful_tier') {
                const tierScoreMap: Record<string, number> = { 루키: 1300, 브론즈: 1400, 실버: 1500, 골드: 1700, 플래티넘: 2000, 다이아: 2400, 마스터: 3000, 챌린저: 3500 };
                const scoreDiff = requirement.type === 'strategy_tier'
                    ? (currentUser.cumulativeRankingScore?.standard ?? 0)
                    : (currentUser.cumulativeRankingScore?.playful ?? 0);
                met = 1200 + scoreDiff >= (tierScoreMap[requirement.tier] ?? Number.MAX_SAFE_INTEGER);
            } else if (requirement.type === 'adventure_understanding_tier') {
                const tierMap: Record<string, number> = { 편함: 1, 익숙함: 2, 친숙함: 3, 정복: 4 };
                const xp = Math.max(0, Math.floor(currentUser.adventureProfile?.understandingXpByStage?.[requirement.stageId] ?? 0));
                met = getAdventureUnderstandingTierFromXp(xp) >= (tierMap[requirement.tier] ?? Number.MAX_SAFE_INTEGER);
            } else if (requirement.type === 'adventure_codex_score') {
                met = getAdventureCodexCompletionBreakdown(currentUser.adventureProfile).totalSum >= requirement.score;
            } else if (requirement.type === 'blacksmith_level') {
                met = (currentUser.blacksmithLevel ?? 1) >= requirement.level;
            }

            if (met) return true;
        }
        return false;
    }, [quests.achievements, currentUser]);

    const renderActivityPanel = () => {
        if (activeTab === 'daily') {
            return (
                <ActivityPanel
                    title="오늘의 활약도"
                    questData={quests.daily}
                    thresholds={DAILY_MILESTONE_THRESHOLDS}
                    rewards={DAILY_MILESTONE_REWARDS}
                    questType="daily"
                    isMobile={isMobile}
                    onClaim={(index, type) => onAction({ type: 'CLAIM_ACTIVITY_MILESTONE', payload: { milestoneIndex: index, questType: type } })}
                />
            );
        }
        if (activeTab === 'weekly') {
            return (
                <ActivityPanel
                    title="주간 활약도"
                    questData={quests.weekly}
                    thresholds={WEEKLY_MILESTONE_THRESHOLDS}
                    rewards={WEEKLY_MILESTONE_REWARDS}
                    questType="weekly"
                    isMobile={isMobile}
                    onClaim={(index, type) => onAction({ type: 'CLAIM_ACTIVITY_MILESTONE', payload: { milestoneIndex: index, questType: type } })}
                />
            );
        }
        if (activeTab === 'monthly') {
            return (
                <ActivityPanel
                    title="월간 활약도"
                    questData={quests.monthly}
                    thresholds={MONTHLY_MILESTONE_THRESHOLDS}
                    rewards={MONTHLY_MILESTONE_REWARDS}
                    questType="monthly"
                    isMobile={isMobile}
                    onClaim={(index, type) => onAction({ type: 'CLAIM_ACTIVITY_MILESTONE', payload: { milestoneIndex: index, questType: type } })}
                />
            );
        }
        return null;
    };

    return (
        <DraggableWindow
            title="퀘스트"
            onClose={onClose}
            windowId="quests"
            initialWidth={modalInitialWidth}
            initialHeight={modalInitialHeight}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}
            bodyPaddingClassName={
                isMobile ? '!p-2 !pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]' : undefined
            }
            bodyNoScroll={false}
            bodyScrollable
        >
            <div className={`flex min-h-0 flex-col ${isMobile ? 'w-full' : 'h-full'}`}>
                <div
                    className={`mb-3 grid shrink-0 grid-cols-4 gap-0.5 rounded-xl border border-slate-600/35 bg-slate-950/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-amber-500/[0.08] sm:gap-1 ${isMobile ? 'sticky top-0 z-20 mb-2 backdrop-blur-sm' : 'mb-4'}`}
                >
                    <button
                        type="button"
                        onClick={() => setActiveTab('daily')}
                        className={`relative rounded-lg py-1.5 text-[11px] font-semibold transition-all sm:py-2 sm:text-sm ${
                            activeTab === 'daily'
                                ? 'bg-gradient-to-b from-amber-500/90 to-amber-700/95 text-amber-950 shadow-md ring-1 ring-amber-300/40'
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        }`}
                    >
                        일일
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('weekly')}
                        className={`relative rounded-lg py-1.5 text-[11px] font-semibold transition-all sm:py-2 sm:text-sm ${
                            activeTab === 'weekly'
                                ? 'bg-gradient-to-b from-amber-500/90 to-amber-700/95 text-amber-950 shadow-md ring-1 ring-amber-300/40'
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        }`}
                    >
                        주간
                        {hasClaimableWeekly && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1.5 sm:top-1.5 sm:h-2 sm:w-2" aria-hidden />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('monthly')}
                        className={`relative rounded-lg py-1.5 text-[11px] font-semibold transition-all sm:py-2 sm:text-sm ${
                            activeTab === 'monthly'
                                ? 'bg-gradient-to-b from-amber-500/90 to-amber-700/95 text-amber-950 shadow-md ring-1 ring-amber-300/40'
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        }`}
                    >
                        월간
                        {hasClaimableMonthly && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1.5 sm:top-1.5 sm:h-2 sm:w-2" aria-hidden />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('achievements')}
                        className={`relative rounded-lg py-1.5 text-[11px] font-semibold transition-all sm:py-2 sm:text-sm ${
                            activeTab === 'achievements'
                                ? 'bg-gradient-to-b from-violet-500/90 to-indigo-800/95 text-violet-50 shadow-md ring-1 ring-violet-300/35'
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        }`}
                    >
                        업적
                        {hasClaimableAchievements && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1.5 sm:top-1.5 sm:h-2 sm:w-2" aria-hidden />}
                    </button>
                </div>

                <div
                    className={
                        isMobile
                            ? 'w-full min-w-0 overflow-x-hidden pb-1 pr-1'
                            : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.4)_transparent]'
                    }
                >
                    {activeTab !== 'achievements' ? renderActivityPanel() : null}
                    {activeTab === 'achievements' ? (
                        <AchievementTrackPanel currentUser={currentUser} onAction={onAction} isMobile={isMobile} />
                    ) : questList.length > 0 ? (
                        <ul className={`${isMobile ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}`}>
                            {questList.map((quest) => (
                                <li key={quest.id}>
                                    <QuestItem quest={quest} onClaim={handleClaim} isMobile={isMobile} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex h-full min-h-[8rem] items-center justify-center text-slate-500">
                            <p className="text-sm">진행 가능한 퀘스트가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default QuestsModal;