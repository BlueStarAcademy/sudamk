import React, { useState, useMemo, useCallback, useRef, useEffect, useId } from 'react';
import { UserWithStatus, Quest, ServerAction, QuestLog, QuestReward } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { DAILY_MILESTONE_THRESHOLDS, WEEKLY_MILESTONE_THRESHOLDS, MONTHLY_MILESTONE_THRESHOLDS, DAILY_MILESTONE_REWARDS, WEEKLY_MILESTONE_REWARDS, MONTHLY_MILESTONE_REWARDS, CONSUMABLE_ITEMS, ACHIEVEMENT_TRACKS } from '../constants';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH, isInsideSudamrAdUi } from '../constants/ads.js';
import { clampQuestProgressToTarget } from '../utils/questProgressCap.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import { formatGoldAmountKoG } from '../shared/utils/walletAmountDisplay.js';
import type { User } from '../types.js';
import { getAchievementProgressDisplay, isAchievementRequirementMet } from '../shared/utils/achievementProgress.js';
import { useKeyedAsyncAction } from '../hooks/useAsyncAction.js';

interface QuestsModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
    /** PC 로비 중앙 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
}

type QuestTab = 'daily' | 'weekly' | 'monthly' | 'achievements';
type QuestData = NonNullable<QuestLog['daily' | 'weekly' | 'monthly']>;

/** 퀘스트 진행 막대: 모바일에서만 상한 */
const QUEST_ITEM_BAR_MAX_CLASS = 'max-w-[14rem]';

/** 활약도 보상 아이콘만 구분선 대비 살짝 왼쪽 — 구분선 좌표는 변경하지 않음 */
const ACTIVITY_REWARD_ICON_LEFT_NUDGE_PX = 4;

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

/** 상점 소모품 탭과 동일: 행동력 회복제 카드는 ⚡ 배지 + 수치(아이템 이미지는 lightning.png, applus는 헤더 충전 버튼 전용) */
const getShopActionPointBadgeFromReward = (reward: QuestReward): string | null => {
    if (!reward.items?.length) return null;
    const ref = reward.items[0];
    const raw = 'itemId' in ref ? ref.itemId : (ref as { name?: string }).name;
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id) return null;
    if (id === 'action_point_10' || id === '행동력 회복제(+10)') return '+10';
    if (id === 'action_point_20' || id === '행동력 회복제(+20)') return '+20';
    if (id === 'action_point_30' || id === '행동력 회복제(+30)') return '+30';
    const ko = id.match(/행동력\s*회복제\s*\(\+(\d+)\)/);
    if (ko) return `+${ko[1]}`;
    const apId = id.match(/^action_point_(\d+)$/i);
    if (apId) return `+${apId[1]}`;
    return null;
};

const resolveConsumableDisplayName = (ref: NonNullable<QuestReward['items']>[0]): string => {
    const raw = 'itemId' in ref ? ref.itemId : (ref as { name?: string }).name;
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id) return '';
    if (id === 'action_point_10') return '행동력 회복제(+10)';
    if (id === 'action_point_20') return '행동력 회복제(+20)';
    if (id === 'action_point_30') return '행동력 회복제(+30)';
    const apId = id.match(/^action_point_(\d+)$/i);
    if (apId) return `행동력 회복제(+${apId[1]})`;
    return id;
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
    /** PC 2:1 분할 우측 사이드바 — 컴팩트 카드·인라인 상세 */
    compact?: boolean;
    claimPendingKey?: string | null;
    onClaimAchievement: (trackId: string, stageIndex: number) => void;
}> = ({ currentUser, onAction, isMobile, compact = false, claimPendingKey = null, onClaimAchievement }) => {
    const [viewIndices, setViewIndices] = useState<Record<string, number>>({});

    const isRequirementMet = (stage: (typeof ACHIEVEMENT_TRACKS)[number]['stages'][number]) =>
        isAchievementRequirementMet(stage, currentUser as User);

    const totalStages = ACHIEVEMENT_TRACKS.reduce((sum, track) => sum + track.stages.length, 0);
    const totalClaimed = ACHIEVEMENT_TRACKS.reduce((sum, track) => {
        const trackState = currentUser.quests?.achievements?.tracks?.[track.id] ?? { currentIndex: 0, claimedIndices: [] };
        const claimedIndices = Array.isArray(trackState.claimedIndices) ? trackState.claimedIndices : [];
        return sum + claimedIndices.length;
    }, 0);

    const shellClass = compact
        ? 'flex h-full min-h-0 flex-col'
        : `rounded-2xl border border-slate-400/15 bg-slate-950/75 shadow-[0_20px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07] ${isMobile ? 'p-3' : 'p-4'}`;

    return (
        <div className={shellClass}>
            <div className={`flex shrink-0 items-center justify-between gap-2 ${compact ? 'mb-2.5 px-0.5' : 'mb-4 gap-3'}`}>
                <h3
                    className={`font-bold tracking-tight text-white ${compact ? 'text-base' : isMobile ? 'text-base' : 'text-lg'}`}
                >
                    {compact ? '업적' : '전체 업적'}
                </h3>
                <span
                    className={`rounded-full border border-amber-400/30 bg-gradient-to-b from-amber-950/90 via-slate-950/95 to-slate-950 font-bold tabular-nums text-amber-50 ${
                        compact ? 'px-2.5 py-1 text-xs' : `px-3 py-1 ${isMobile ? 'text-sm' : 'text-sm'}`
                    }`}
                >
                    {totalClaimed}/{totalStages}
                </span>
            </div>
            <ul
                className={`min-h-0 ${compact ? 'flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.4)_transparent]' : isMobile ? 'space-y-2' : 'space-y-3'}`}
            >
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
                    const achProgress = getAchievementProgressDisplay(stage, currentUser as User);

                    const navBtnClass = `flex shrink-0 flex-col items-center justify-center rounded-lg border border-slate-600/40 bg-slate-800/60 font-semibold text-slate-200 transition-colors hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-35 ${
                        compact ? 'min-w-[2.75rem] px-1.5 py-2' : 'min-w-[3.25rem] px-2 py-2.5'
                    }`;
                    const navArrowClass = compact ? 'text-xl leading-none' : 'text-2xl leading-none';
                    const navLabelClass = compact ? 'text-[11px] leading-tight' : 'text-xs leading-tight';
                    const claimLabel = isClaimed ? '완료' : canClaim ? '받기' : isCurrentStage ? '진행' : '기록';

                    return (
                        <li
                            key={track.id}
                            className={`rounded-xl border border-slate-500/25 bg-gradient-to-br from-slate-900/95 via-[#0f1118]/98 to-[#080a0f] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-500/[0.07] ${
                                compact ? 'p-2.5' : 'rounded-2xl p-2.5 sm:p-3'
                            }`}
                        >
                            <div className={`flex items-stretch gap-1 ${compact ? 'mb-2' : 'mb-2.5 gap-1.5'}`}>
                                <button
                                    type="button"
                                    onClick={() => setViewIndices((prev) => ({ ...prev, [track.id]: Math.max(0, viewIndex - 1) }))}
                                    disabled={viewIndex <= 0}
                                    className={navBtnClass}
                                    aria-label="이전 단계"
                                >
                                    <span className={navArrowClass} aria-hidden>
                                        ‹
                                    </span>
                                    <span className={navLabelClass}>이전</span>
                                </button>
                                <div
                                    className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/35 bg-gradient-to-b from-slate-900/92 to-black/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/10 ${
                                        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
                                    }`}
                                >
                                    <span
                                        className={`min-w-0 truncate font-semibold tracking-tight text-slate-100 ${
                                            compact ? 'text-sm' : isMobile ? 'text-sm' : 'text-base'
                                        }`}
                                    >
                                        {track.title}
                                    </span>
                                    <span
                                        className={`shrink-0 rounded-full border border-amber-500/35 bg-black/45 font-bold tabular-nums text-amber-100 ${
                                            compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
                                        }`}
                                    >
                                        {viewIndex + 1}/{track.stages.length}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setViewIndices((prev) => ({
                                            ...prev,
                                            [track.id]: Math.min(track.stages.length - 1, viewIndex + 1),
                                        }))
                                    }
                                    disabled={viewIndex >= track.stages.length - 1}
                                    className={navBtnClass}
                                    aria-label="다음 단계"
                                >
                                    <span className={navArrowClass} aria-hidden>
                                        ›
                                    </span>
                                    <span className={navLabelClass}>다음</span>
                                </button>
                            </div>

                            <div className="flex min-w-0 items-center gap-2">
                                <div className="flex min-w-0 flex-1 flex-col gap-1 text-center">
                                    <span
                                        className={`line-clamp-2 font-bold leading-snug tracking-tight text-slate-100 ${
                                            compact ? 'text-sm' : isMobile ? 'text-base' : 'text-lg'
                                        }`}
                                    >
                                        {stage.title}
                                    </span>
                                    {achProgress ? (
                                        <span
                                            className={`text-center font-semibold tabular-nums ${
                                                isCleared ? 'text-emerald-300' : 'text-slate-400'
                                            } ${compact ? 'text-xs' : 'text-sm'}`}
                                        >
                                            달성 {achProgress.current}/{achProgress.target}
                                        </span>
                                    ) : (
                                        <span
                                            className={`text-center font-semibold ${
                                                isCleared ? 'text-emerald-300' : 'text-slate-400'
                                            } ${compact ? 'text-xs' : 'text-sm'}`}
                                        >
                                            {isCleared ? '달성' : '미달성'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5 self-center">
                                    <div
                                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/35 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                                            compact ? 'px-2 py-1.5' : 'px-2.5 py-2'
                                        }`}
                                    >
                                        <img
                                            src="/images/icon/Zem.webp"
                                            alt=""
                                            className={`object-contain ${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
                                        />
                                        <span
                                            className={`font-bold tabular-nums text-amber-100 ${compact ? 'text-sm' : 'text-base'}`}
                                        >
                                            {stage.rewardDiamonds}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onClaimAchievement(track.id, viewIndex)}
                                        disabled={!canClaim || claimPendingKey === `achievement-${track.id}-${viewIndex}`}
                                        className={`shrink-0 rounded-lg border font-semibold ${
                                            compact ? 'w-[3.25rem] px-1 py-2 text-xs' : 'w-[3.75rem] px-1.5 py-2.5 text-sm'
                                        } ${
                                            canClaim
                                                ? 'border-amber-400/30 bg-gradient-to-b from-amber-500/25 via-amber-900/40 to-amber-950/85 text-amber-50'
                                                : 'border-slate-600/40 bg-slate-800/60 text-slate-300'
                                        }`}
                                    >
                                        {claimPendingKey === `achievement-${track.id}-${viewIndex}` ? '수령 중...' : claimLabel}
                                    </button>
                                </div>
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
    isPending?: boolean;
}> = ({ isClaimed, isComplete, onClaim, isMobile, isPending = false }) => {
    const size = isMobile ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm';
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
            disabled={isPending}
            className={`${base} border-amber-400/30 bg-gradient-to-b from-amber-500/25 via-amber-900/40 to-amber-950/85 text-amber-50 hover:border-amber-300/45 hover:from-amber-400/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
        >
            {isPending ? '수령 중...' : '보상 받기'}
        </button>
    );
};

const QuestRewardPill: React.FC<{ quest: Quest; isMobile: boolean; inline?: boolean }> = ({
    quest,
    isMobile,
    inline = false,
}) => {
    const hasGold = Boolean(quest.reward?.gold && quest.reward.gold > 0);
    const firstItem = quest.reward?.items?.[0];
    const resolvedItemName = firstItem ? resolveConsumableDisplayName(firstItem) : '';
    const itemQty = firstItem?.quantity ?? 0;
    const actionPointBadge = quest.reward ? getShopActionPointBadgeFromReward(quest.reward) : null;
    const itemImage =
        resolvedItemName && !actionPointBadge
            ? (CONSUMABLE_ITEMS.find((item) => item.name === resolvedItemName)?.image ?? null)
            : null;
    const ap = quest.activityPoints ?? 0;
    const hasActivity = ap > 0;

    if (!hasGold && !firstItem && !hasActivity) return null;

    return (
        <div
            className={`flex min-w-0 items-center gap-x-2 gap-y-0.5 rounded-md border border-amber-500/20 bg-black/30 px-2 py-1.5 ${
                inline ? 'shrink-0 flex-nowrap whitespace-nowrap' : 'w-full flex-wrap justify-center text-center'
            } ${isMobile ? 'text-[11px]' : 'text-xs'}`}
            title="퀘스트 보상"
        >
            {hasGold || hasActivity ? (
                <span className="inline-flex min-w-0 flex-nowrap items-center justify-center gap-x-2 font-semibold">
                    {hasGold ? (
                        <span className="inline-flex min-w-0 items-center gap-0.5 text-amber-100">
                            <img src="/images/icon/Gold.webp" alt="" className="h-3.5 w-3.5 shrink-0 opacity-95 sm:h-4 sm:w-4" />
                            <span className="truncate tabular-nums">{formatGoldAmountKoG(quest.reward.gold!)}</span>
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
                actionPointBadge ? (
                    <span className="inline-flex min-w-0 items-center gap-1 font-semibold text-slate-100">
                        <span className="shrink-0 text-base leading-none sm:text-lg" aria-hidden>
                            ⚡
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-cyan-300">{actionPointBadge}</span>
                        <span className="tabular-nums text-amber-200">×{itemQty}</span>
                    </span>
                ) : (
                    <span className="inline-flex min-w-0 items-center gap-0.5 font-semibold text-slate-100">
                        {itemImage ? <img src={itemImage} alt="" className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4" /> : null}
                        <span className="truncate">{resolvedItemName}</span>
                        <span className="tabular-nums text-amber-200">x{itemQty}</span>
                    </span>
                )
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
                        <img src="/images/icon/Gold.webp" alt="" className="mb-px mr-0.5 inline h-3 w-3 align-middle opacity-95" />
                        골드 +{formatGoldAmountKoG(gold)}
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

const QuestItem: React.FC<{ quest: Quest; onClaim: (id: string) => void; isMobile: boolean; isClaimPending?: boolean }> = ({ quest, onClaim, isMobile, isClaimPending = false }) => {
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

    const questIcon = (
        <div
            className={`flex shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/10 ${
                isMobile ? 'h-9 w-9' : 'h-11 w-11'
            }`}
            aria-hidden
        >
            <img
                src="/images/quest.webp"
                alt=""
                className={`object-contain opacity-95 ${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`}
            />
        </div>
    );

    const titleButton = (
        <button
            type="button"
            className="group flex min-w-0 items-center rounded-lg py-0.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-amber-400/35"
            onClick={() => setBubbleOpen((o) => !o)}
            aria-expanded={bubbleOpen}
            aria-haspopup="dialog"
        >
            <span
                className={`min-w-0 font-semibold leading-snug tracking-tight text-slate-100 ${isMobile ? 'text-sm' : 'text-base'}`}
            >
                <span className={bubbleOpen ? '' : 'line-clamp-2'}>{displayTitle}</span>
            </span>
        </button>
    );

    const progressBar = (
        <div className={`flex min-w-0 items-center gap-2 ${isMobile ? 'flex-1' : 'flex-1'}`}>
            <div
                className={`relative min-w-0 flex-1 overflow-hidden rounded-full border border-slate-600/40 bg-slate-950/85 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] ${isMobile ? `h-2.5 ${QUEST_ITEM_BAR_MAX_CLASS}` : 'h-3'}`}
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
                className={`shrink-0 tabular-nums font-medium text-amber-200/85 ${isMobile ? 'text-[11px]' : 'text-sm'}`}
            >
                {displayProgress}/{quest.target}
            </span>
        </div>
    );

    const claimButton = (
        <div data-quest-claim onClick={(e) => e.stopPropagation()}>
            <QuestClaimStripButton
                isClaimed={quest.isClaimed}
                isComplete={isComplete}
                onClaim={handleClaimClick}
                isMobile={isMobile}
                isPending={isClaimPending}
            />
        </div>
    );

    const cardShell =
        'rounded-2xl border border-slate-500/25 bg-gradient-to-br from-slate-900/95 via-[#0f1118]/98 to-[#080a0f] p-3 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-500/[0.07] sm:p-3.5';

    if (isMobile) {
        return (
            <div className={cardShell}>
                <div className="flex min-w-0 gap-2.5">
                    {questIcon}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div ref={titleWrapRef} className="relative min-w-0">
                            {titleButton}
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
                        <div className="flex min-w-0 items-stretch gap-2.5">
                            {progressBar}
                            <div className="flex w-[6.25rem] shrink-0 flex-col justify-center gap-1.5">
                                <QuestRewardPill quest={quest} isMobile={isMobile} />
                                {claimButton}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 ${cardShell}`}>
            {questIcon}
            <div ref={titleWrapRef} className="relative w-[min(30%,9.5rem)] shrink-0">
                {titleButton}
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
            {progressBar}
            <QuestRewardPill quest={quest} isMobile={isMobile} inline />
            <div className="w-[6.75rem] shrink-0">{claimButton}</div>
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
    claimPendingKey?: string | null;
}> = ({ title, questData, thresholds, rewards, questType, onClaim, isMobile, claimPendingKey = null }) => {
    if (!questData) return null;

    const { activityProgress, claimedMilestones } = questData;
    const maxProgress = thresholds[thresholds.length - 1];
    const displayActivity = clampQuestProgressToTarget(activityProgress, maxProgress);

    /** 구분선·진행 막대 — 20/40/60/80/100% 정확히 5등분 */
    const milestoneMarkerPct = (milestone: number): number =>
        maxProgress > 0 ? (milestone / maxProgress) * 100 : 0;

    const getItemImage = (reward: QuestReward): string => {
        if (!reward.items || reward.items.length === 0) return '/images/Box/box.webp';
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
        return itemTemplate?.image ?? '/images/Box/box.webp';
    };

    const trackWrap = 'mb-2 w-full';
    const barHeight = 'h-3';
    const milestoneIcon = isMobile ? 'h-7 w-7' : 'h-8 w-8';
    const rewardRowMinH = isMobile ? '2.35rem' : '2.5rem';
    const fillPct = maxProgress > 0 ? (displayActivity / maxProgress) * 100 : 0;

    return (
        <div
            className={`relative mb-3 flex-shrink-0 overflow-visible rounded-2xl border border-slate-400/15 bg-slate-950/75 p-2.5 shadow-[0_20px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.07] backdrop-blur-md sm:mb-4 sm:p-3`}
        >
            <div className="pointer-events-none absolute -right-6 -top-16 h-36 w-36 rounded-full bg-emerald-400/[0.09] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-amber-400/[0.08] blur-3xl" />
            <div className={`relative mb-2 flex min-w-0 items-center gap-2 ${questTextScrollRowClass}`}>
                <h3 className={`shrink-0 font-bold tracking-tight text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                    {title}
                </h3>
                <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-gradient-to-b from-amber-950/90 via-slate-950/95 to-slate-950 px-2 py-0.5 font-bold tabular-nums text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-2.5 sm:py-1 ${isMobile ? 'text-xs' : 'text-sm'}`}
                >
                    <span className={`leading-none text-amber-300 ${isMobile ? 'text-sm' : 'text-base'}`} aria-hidden>
                        ⭐
                    </span>
                    {displayActivity}
                    <span className="mx-0.5 font-normal text-amber-200/45">/</span>
                    {maxProgress}
                </span>
            </div>
            <div className={`${trackWrap} overflow-visible`}>
                <div className="relative w-full overflow-visible" style={{ minHeight: rewardRowMinH }}>
                    {thresholds.map((milestone, index) => {
                        if (!rewards[index]) return null;
                        const progressMet = activityProgress >= milestone;
                        const isClaimed = claimedMilestones[index];
                        const canClaim = progressMet && !isClaimed;
                        const reward = rewards[index];
                        const apBadge = getShopActionPointBadgeFromReward(reward);
                        const itemImage = apBadge ? null : getItemImage(reward);
                        const markerPct = milestoneMarkerPct(milestone);
                        const isLastMilestone = milestone >= maxProgress;

                        return (
                            <div
                                key={milestone}
                                className="absolute top-0 flex flex-col items-center"
                                style={
                                    isLastMilestone
                                        ? { right: 0, transform: 'none' }
                                        : {
                                              left: `${markerPct}%`,
                                              transform: `translateX(calc(-50% - ${ACTIVITY_REWARD_ICON_LEFT_NUDGE_PX}px))`,
                                          }
                                }
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (canClaim) {
                                            onClaim(index, questType);
                                        }
                                    }}
                                    disabled={!canClaim || claimPendingKey === `milestone-${questType}-${index}`}
                                    className={`relative ${milestoneIcon} rounded-lg border border-slate-500/35 bg-gradient-to-b from-slate-800/90 to-slate-950/90 p-0.5 shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed ${canClaim ? 'ring-1 ring-amber-400/40 shadow-[0_0_16px_-6px_rgba(251,191,36,0.55)]' : ''}`}
                                    title={isClaimed ? '수령 완료' : progressMet ? '보상 수령' : `${milestone} 활약도 필요`}
                                >
                                    <div
                                        className={`relative h-full w-full rounded-md ${!progressMet && !isClaimed ? 'opacity-45 grayscale' : ''}`}
                                        aria-label={
                                            apBadge ? `${milestone} 활약도 보상 행동력 회복제` : `${milestone} 활약도 보상`
                                        }
                                    >
                                        {apBadge ? (
                                            <span
                                                className="flex h-full w-full items-center justify-center text-[1.35rem] leading-none drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)] sm:text-[1.5rem]"
                                                aria-hidden
                                            >
                                                ⚡
                                            </span>
                                        ) : (
                                            <img
                                                src={itemImage ?? '/images/Box/box.webp'}
                                                alt=""
                                                className="h-full w-full object-contain p-0.5"
                                            />
                                        )}
                                        {apBadge ? (
                                            <span className="absolute right-0 top-0 rounded-bl bg-gray-900/90 px-0.5 text-[9px] font-bold leading-tight text-cyan-300 shadow-md sm:px-1 sm:text-[10px]">
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
                            </div>
                        );
                    })}
                </div>
                <div
                    className="relative w-full rounded-full bg-gradient-to-r from-emerald-500/25 via-amber-500/20 to-teal-500/25 p-[2px] shadow-[0_0_20px_-8px_rgba(52,211,153,0.35)] sm:p-[2.5px]"
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
                            const milestonePosition = milestoneMarkerPct(milestone);
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
            </div>
        </div>
    );
};


const QuestsModal: React.FC<QuestsModalProps> = ({
    currentUser: propCurrentUser,
    onClose,
    onAction,
    isTopmost,
    embedded = false,
}) => {
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;

    const currentUser = propCurrentUser;

    const [activeTab, setActiveTab] = useState<QuestTab>('daily');
    const { quests } = currentUser;
    const claimAction = useKeyedAsyncAction();

    const handleClaim = (questId: string) => {
        void claimAction.run(`quest-${questId}`, async () => {
            await onAction({ type: 'CLAIM_QUEST_REWARD', payload: { questId } });
        });
    };

    const handleClaimAchievement = (trackId: string, stageIndex: number) => {
        void claimAction.run(`achievement-${trackId}-${stageIndex}`, async () => {
            await onAction({
                type: 'CLAIM_ACHIEVEMENT_REWARD',
                payload: { trackId, stageIndex },
            });
        });
    };

    const handleClaimMilestone = (index: number, questType: 'daily' | 'weekly' | 'monthly') => {
        void claimAction.run(`milestone-${questType}-${index}`, async () => {
            await onAction({ type: 'CLAIM_ACTIVITY_MILESTONE', payload: { milestoneIndex: index, questType } });
        });
    };

    useEffect(() => {
        if (!isMobile && activeTab === 'achievements') {
            setActiveTab('daily');
        }
    }, [isMobile, activeTab]);

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
            if (isAchievementRequirementMet(stage, currentUser as User)) return true;
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
                    onClaim={handleClaimMilestone}
                    claimPendingKey={claimAction.pendingKey}
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
                    onClaim={handleClaimMilestone}
                    claimPendingKey={claimAction.pendingKey}
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
                    onClaim={handleClaimMilestone}
                    claimPendingKey={claimAction.pendingKey}
                />
            );
        }
        return null;
    };

    const questListScrollClass =
        'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.4)_transparent]';

    const questTabs = (
        <div
            className={`mb-3 grid shrink-0 gap-0.5 rounded-xl border border-slate-600/35 bg-slate-950/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-amber-500/[0.08] sm:gap-1 ${
                isMobile ? 'sticky top-0 z-20 mb-2 grid-cols-4 backdrop-blur-sm' : 'mb-3 grid-cols-3'
            }`}
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
                {hasClaimableWeekly && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1.5 sm:top-1.5 sm:h-2 sm:w-2" aria-hidden />
                )}
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
                {hasClaimableMonthly && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1.5 sm:top-1.5 sm:h-2 sm:w-2" aria-hidden />
                )}
            </button>
            {isMobile ? (
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
                    {hasClaimableAchievements && (
                        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1.5 sm:top-1.5 sm:h-2 sm:w-2" aria-hidden />
                    )}
                </button>
            ) : null}
        </div>
    );

    const questMainContent = (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0">{renderActivityPanel()}</div>
            <div className={`${questListScrollClass} ${isMobile ? 'w-full min-w-0 pb-1 pr-1' : 'pr-1'}`}>
                {questList.length > 0 ? (
                    <ul className={`${isMobile ? 'space-y-2' : 'space-y-2.5'}`}>
                        {questList.map((quest) => (
                            <li key={quest.id}>
                                <QuestItem quest={quest} onClaim={handleClaim} isMobile={isMobile} isClaimPending={claimAction.isPending(`quest-${quest.id}`)} />
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
    );

    const questBody = (
        <div className={`flex min-h-0 ${embedded || !isMobile ? 'h-full' : 'w-full'} ${isMobile ? 'flex-col' : 'flex-row gap-3'}`}>
            {isMobile && activeTab === 'achievements' ? (
                <>
                    {questTabs}
                    <div className="w-full min-w-0 overflow-x-hidden pb-1 pr-1">
                        <AchievementTrackPanel currentUser={currentUser} onAction={onAction} isMobile={isMobile} claimPendingKey={claimAction.pendingKey} onClaimAchievement={handleClaimAchievement} />
                    </div>
                </>
            ) : (
                <>
                    <div className={`flex min-h-0 min-w-0 flex-col ${isMobile ? 'flex-1' : 'flex-[2]'}`}>
                        {questTabs}
                        {questMainContent}
                    </div>
                    {!isMobile ? (
                        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col border-l border-slate-600/35 pl-3">
                            {hasClaimableAchievements ? (
                                <span
                                    className="absolute right-0 top-0 z-[1] h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-500/30"
                                    aria-label="수령 가능한 업적 있음"
                                />
                            ) : null}
                            <AchievementTrackPanel
                                compact
                                currentUser={currentUser}
                                onAction={onAction}
                                isMobile={false}
                                claimPendingKey={claimAction.pendingKey}
                                onClaimAchievement={handleClaimAchievement}
                            />
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );

    if (embedded) {
        return <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{questBody}</div>;
    }

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
            {questBody}
        </DraggableWindow>
    );
};

export default QuestsModal;