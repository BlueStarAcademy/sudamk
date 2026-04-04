import React, { useEffect, useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { TournamentType, UserWithStatus, TournamentState, QuestReward } from '../types.js';
import { CoreStat, ItemGrade } from '../types/enums.js';
import {
    TOURNAMENT_DEFINITIONS,
    DUNGEON_RANK_REWARDS,
    DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT,
    DUNGEON_STAGE_BASE_REWARDS_GOLD,
    DUNGEON_STAGE_BASE_REWARDS_MATERIAL,
    DUNGEON_STAGE_BOT_STATS,
    gradeBackgrounds,
} from '../constants';
import { normalizeDungeonProgress, isStageCleared } from '../utils/championshipDungeonProgress.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import {
    getChampionshipRewardItemGrade,
    getChampionshipRewardItemImageUrl,
} from '../utils/championshipRewardDisplay.js';

type RewardPiece = {
    key: string;
    label: string;
    quantity: string;
    imageUrl: string;
    grade?: ItemGrade;
    frame?: 'gold' | 'diamond';
};

const CORE_STAT_SHORT: Record<CoreStat, string> = {
    [CoreStat.Concentration]: '집중',
    [CoreStat.ThinkingSpeed]: '사고',
    [CoreStat.Judgment]: '판단',
    [CoreStat.Calculation]: '계산',
    [CoreStat.CombatPower]: '전투',
    [CoreStat.Stability]: '안정',
};

const CORE_STAT_ROW: CoreStat[] = [
    CoreStat.Concentration,
    CoreStat.ThinkingSpeed,
    CoreStat.Judgment,
    CoreStat.Calculation,
    CoreStat.CombatPower,
    CoreStat.Stability,
];

function getDungeonBotStatRangeForStage(stage: number): { minStat: number; maxStat: number } {
    const clamped = Math.min(10, Math.max(1, Number.isFinite(stage) ? Math.floor(stage) : 1));
    return DUNGEON_STAGE_BOT_STATS[clamped] ?? DUNGEON_STAGE_BOT_STATS[1] ?? { minStat: 100, maxStat: 120 };
}

function fallbackIconByName(name: string): string {
    if (name.includes('골드')) return '/images/icon/Gold.png';
    if (name.includes('다이아')) return '/images/icon/Zem.png';
    return '';
}

/** 동일 보상 판별용 (순위 묶음) */
function questRewardSignature(reward: QuestReward | undefined): string {
    if (!reward) return '∅';
    const gold = reward.gold ?? 0;
    const diamonds = reward.diamonds ?? 0;
    const actionPoints = reward.actionPoints ?? 0;
    const xp = reward.xp
        ? { t: reward.xp.type, a: reward.xp.amount }
        : null;
    const rawItems = reward.items ?? [];
    const items = rawItems.map(it => {
        if (it && typeof it === 'object' && 'itemId' in it && (it as { itemId: string }).itemId) {
            const row = it as { itemId: string; quantity?: number };
            return { k: 'id' as const, id: row.itemId, q: row.quantity ?? 1 };
        }
        if (it && typeof it === 'object' && 'name' in it) {
            const row = it as { name: string; quantity?: number };
            return { k: 'nm' as const, id: row.name, q: row.quantity ?? 1 };
        }
        return { k: '?' as const, id: '', q: 0 };
    });
    items.sort((a, b) => `${a.k}:${a.id}:${a.q}`.localeCompare(`${b.k}:${b.id}:${b.q}`));
    return JSON.stringify({ gold, diamonds, actionPoints, xp, items });
}

/** 연속된 순위 중 보상이 같은 구간을 한 덩어리로 묶음 */
function groupConsecutiveRanksWithSameReward(map: Record<number, QuestReward>): { ranks: number[]; pieces: RewardPiece[] }[] {
    const ranks = Object.keys(map)
        .map(Number)
        .filter(n => !Number.isNaN(n))
        .sort((a, b) => a - b);
    const groups: { ranks: number[]; pieces: RewardPiece[] }[] = [];
    let cur: { ranks: number[]; sig: string; pieces: RewardPiece[] } | null = null;
    for (const rank of ranks) {
        const reward = map[rank];
        const sig = questRewardSignature(reward);
        const pieces = parseQuestRewardToPieces(reward);
        if (cur && cur.sig === sig && rank === cur.ranks[cur.ranks.length - 1] + 1) {
            cur.ranks.push(rank);
        } else {
            if (cur) {
                groups.push({ ranks: cur.ranks, pieces: cur.pieces });
            }
            cur = { ranks: [rank], sig, pieces };
        }
    }
    if (cur) {
        groups.push({ ranks: cur.ranks, pieces: cur.pieces });
    }
    return groups;
}

function formatRankGroupLabel(ranks: number[]): string {
    if (ranks.length === 0) return '';
    const lo = ranks[0];
    const hi = ranks[ranks.length - 1];
    if (lo === hi) return `${lo}위`;
    return `${lo}~${hi}위`;
}

function parseQuestRewardToPieces(reward: QuestReward | undefined): RewardPiece[] {
    if (!reward) return [];
    const out: RewardPiece[] = [];
    let idx = 0;
    if (reward.gold != null && reward.gold > 0) {
        out.push({
            key: `g-${idx++}`,
            label: '골드',
            quantity: reward.gold.toLocaleString(),
            imageUrl: '/images/icon/Gold.png',
            frame: 'gold',
        });
    }
    if (reward.diamonds != null && reward.diamonds > 0) {
        out.push({
            key: `d-${idx++}`,
            label: '다이아',
            quantity: reward.diamonds.toLocaleString(),
            imageUrl: '/images/icon/Zem.png',
            frame: 'diamond',
        });
    }
    if (reward.items?.length) {
        for (const it of reward.items) {
            if (it && typeof it === 'object' && 'itemId' in it && (it as { itemId: string }).itemId) {
                const row = it as { itemId: string; quantity?: number };
                const name = row.itemId;
                const qty = row.quantity ?? 1;
                const imageUrl = getChampionshipRewardItemImageUrl(name) || fallbackIconByName(name);
                out.push({
                    key: `i-${idx++}-${name}`,
                    label: name,
                    quantity: `×${qty}`,
                    imageUrl,
                    grade: getChampionshipRewardItemGrade(name),
                });
            } else if (it && typeof it === 'object' && 'name' in it) {
                const row = it as { name: string; quantity?: number };
                const name = row.name;
                const qty = row.quantity ?? 1;
                out.push({
                    key: `i-${idx++}-${name}`,
                    label: name,
                    quantity: `×${qty}`,
                    imageUrl: getChampionshipRewardItemImageUrl(name) || fallbackIconByName(name),
                    grade: getChampionshipRewardItemGrade(name),
                });
            }
        }
    }
    return out;
}

function getBaseRewardPieces(type: TournamentType, stage: number): RewardPiece[] {
    if (type === 'neighborhood') {
        const g = DUNGEON_STAGE_BASE_REWARDS_GOLD[stage];
        if (g == null) return [];
        return [
            {
                key: 'base-gold',
                label: '클리어 골드',
                quantity: g.toLocaleString(),
                imageUrl: '/images/icon/Gold.png',
                frame: 'gold',
            },
        ];
    }
    if (type === 'national') {
        const m = DUNGEON_STAGE_BASE_REWARDS_MATERIAL[stage];
        if (!m) return [];
        return [
            {
                key: 'base-mat',
                label: m.materialName,
                quantity: `×${m.quantity}`,
                imageUrl: getChampionshipRewardItemImageUrl(m.materialName) || '/images/materials/materials1.png',
                grade: getChampionshipRewardItemGrade(m.materialName),
            },
        ];
    }
    if (type === 'world') {
        const e = DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT[stage];
        if (!e) return [];
        const list: RewardPiece[] = [];
        e.boxes.forEach((b, bi) => {
            list.push({
                key: `box-${bi}`,
                label: b.boxName,
                quantity: `×${b.quantity}`,
                imageUrl: getChampionshipRewardItemImageUrl(b.boxName) || '/images/Box/EquipmentBox1.png',
                grade: getChampionshipRewardItemGrade(b.boxName),
            });
        });
        if (e.changeTickets > 0) {
            list.push({
                key: 'tickets',
                label: '장비 변경권',
                quantity: `×${e.changeTickets}`,
                imageUrl: '/images/use/change1.png',
            });
        }
        return list;
    }
    return [];
}

const rewardThumbRing = (piece: RewardPiece) => {
    if (piece.frame === 'gold') {
        return 'ring-amber-400/45 shadow-[0_0_14px_-4px_rgba(251,191,36,0.45)]';
    }
    if (piece.frame === 'diamond') {
        return 'ring-sky-400/40 shadow-[0_0_14px_-4px_rgba(56,189,248,0.35)]';
    }
    return 'ring-white/[0.12]';
};

const RewardThumb: React.FC<{ piece: RewardPiece }> = ({ piece }) => {
    const box = 'h-10 w-10 min-h-[2.5rem] min-w-[2.5rem] sm:h-11 sm:w-11 sm:min-h-[2.75rem] sm:min-w-[2.75rem]';
    const qtyClass = 'px-0.5 py-px text-[8px] sm:text-[9px]';
    const padImg = 'p-0.5 sm:p-1';
    const tierBg = piece.grade !== undefined ? gradeBackgrounds[piece.grade] : undefined;
    const ring = rewardThumbRing(piece);
    return (
        <div
            className={`group/thumb relative shrink-0 overflow-hidden rounded-lg ${box} bg-gradient-to-b from-zinc-800/90 to-black/80 ring-1 ${ring}`}
            title={`${piece.label} ${piece.quantity}`}
        >
            {tierBg ? (
                <>
                    <img src={tierBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.88]" aria-hidden />
                    {piece.imageUrl ? (
                        <img
                            src={piece.imageUrl}
                            alt=""
                            className={`relative z-[1] h-full w-full object-contain ${padImg}`}
                            loading="lazy"
                            decoding="async"
                        />
                    ) : null}
                </>
            ) : (
                piece.imageUrl && (
                    <img
                        src={piece.imageUrl}
                        alt=""
                        className={`relative z-[1] h-full w-full object-contain ${padImg}`}
                        loading="lazy"
                        decoding="async"
                    />
                )
            )}
            <span
                className={`absolute bottom-0 right-0 z-[2] max-w-[100%] truncate rounded-tl bg-black/90 font-bold leading-tight text-amber-100/95 tabular-nums ${qtyClass}`}
            >
                {piece.quantity}
            </span>
        </div>
    );
};

const RewardStripRow: React.FC<{ piece: RewardPiece }> = ({ piece }) => (
    <div className="flex min-w-0 max-w-[13.5rem] shrink-0 items-center gap-2 sm:max-w-[15rem]">
        <RewardThumb piece={piece} />
        <span className="min-w-0 truncate whitespace-nowrap text-xs font-medium text-zinc-200 sm:text-sm" title={`${piece.label} ${piece.quantity}`}>
            {piece.label}
            <span className="ml-1 tabular-nums font-semibold text-amber-200/90">{piece.quantity}</span>
        </span>
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode; accent: 'cyan' | 'amber' }> = ({ children, accent }) => {
    const line =
        accent === 'cyan'
            ? 'from-cyan-400/50 via-cyan-300/20 to-transparent'
            : 'from-amber-400/50 via-amber-300/15 to-transparent';
    const text = accent === 'cyan' ? 'text-cyan-100/95' : 'text-amber-100/95';
    return (
        <div className="mb-2 flex items-center gap-2">
            <span className={`whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] sm:text-sm ${text}`}>{children}</span>
            <span className={`h-px min-w-0 flex-1 bg-gradient-to-r ${line}`} aria-hidden />
        </div>
    );
};

export interface ChampionshipVenueEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: TournamentType;
    currentUser: UserWithStatus;
    inProgress: TournamentState | null;
    onEnter: (stage: number) => void;
    onContinue: () => void;
    isTopmost?: boolean;
}

const ChampionshipVenueEntryModal: React.FC<ChampionshipVenueEntryModalProps> = ({
    isOpen,
    onClose,
    type,
    currentUser,
    inProgress,
    onEnter,
    onContinue,
    isTopmost,
}) => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    const dungeonProgress = useMemo(
        () =>
            normalizeDungeonProgress(
                currentUser?.dungeonProgress?.[type] || {
                    currentStage: 0,
                    unlockedStages: [1],
                    stageResults: {},
                    dailyStageAttempts: {},
                }
            ),
        [currentUser?.dungeonProgress, type]
    );

    const maxUnlockedStage = useMemo(
        () => (dungeonProgress.unlockedStages.length > 0 ? Math.max(...dungeonProgress.unlockedStages) : 1),
        [dungeonProgress.unlockedStages]
    );

    const [selectedStage, setSelectedStage] = useState(maxUnlockedStage);
    useEffect(() => {
        if (isOpen) setSelectedStage(maxUnlockedStage);
    }, [isOpen, maxUnlockedStage]);

    const now = Date.now();
    let playedDateKey: keyof UserWithStatus;
    switch (type) {
        case 'neighborhood':
            playedDateKey = 'lastNeighborhoodPlayedDate';
            break;
        case 'national':
            playedDateKey = 'lastNationalPlayedDate';
            break;
        case 'world':
            playedDateKey = 'lastWorldPlayedDate';
            break;
    }
    const lastPlayedDate = currentUser[playedDateKey as keyof UserWithStatus] as number | null | undefined;
    const hasPlayedToday = lastPlayedDate && isSameDayKST(lastPlayedDate, now);

    const hasResultToView = inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated');
    const isCompletedToday = !!(hasPlayedToday && hasResultToView);
    const hasStartedMatch =
        inProgress &&
        (inProgress.status === 'round_in_progress' || inProgress.status === 'complete' || inProgress.status === 'eliminated');
    const isDungeonMode = !!(
        hasStartedMatch &&
        inProgress &&
        inProgress.currentStageAttempt !== undefined &&
        inProgress.currentStageAttempt !== null
    );
    const showContinueFlow = isCompletedToday || !!(isDungeonMode && inProgress);

    let continueLabel = '이어서 보기';
    if (isCompletedToday) {
        continueLabel = '결과보기';
    } else if (isDungeonMode && inProgress) {
        if (inProgress.status === 'complete' || inProgress.status === 'eliminated') {
            continueLabel = '결과보기';
        } else {
            continueLabel = '이어서 보기';
        }
    }

    const basePieces = useMemo(() => getBaseRewardPieces(type, selectedStage), [type, selectedStage]);

    const rankRewardGroups = useMemo(() => {
        const map = DUNGEON_RANK_REWARDS[type]?.[selectedStage] as Record<number, QuestReward> | undefined;
        if (!map) return [];
        return groupConsecutiveRanksWithSameReward(map);
    }, [type, selectedStage]);

    const botStatRange = useMemo(() => getDungeonBotStatRangeForStage(selectedStage), [selectedStage]);
    const botAvgStat = useMemo(
        () => Math.round((botStatRange.minStat + botStatRange.maxStat) / 2),
        [botStatRange]
    );

    const isUnlocked = dungeonProgress.unlockedStages.includes(selectedStage);
    const canEnterFresh = !showContinueFlow && isUnlocked;

    if (!isOpen) return null;

    return (
        <DraggableWindow
            title={definition.name}
            windowId={`championship-venue-entry-${type}`}
            onClose={onClose}
            initialWidth={760}
            modal
            isTopmost={isTopmost}
            mobileViewportFit
            bodyScrollable
            hideFooter
            bodyPaddingClassName="!p-0"
        >
            <div className="relative flex max-h-[min(80dvh,680px)] flex-col overflow-hidden bg-[#07080c] text-zinc-100 sm:max-h-[min(85vh,700px)]">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    }}
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-900/25 via-violet-900/10 to-transparent" aria-hidden />
                <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-purple-600/15 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-amber-600/10 blur-3xl" aria-hidden />

                <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-3.5">
                    <div className="relative flex h-[5rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-amber-500/25 sm:h-[5.5rem]">
                        <img src={definition.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/55 to-black/25" />
                        <div className="relative z-[1] flex flex-1 flex-col justify-center px-3.5 py-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80 sm:text-xs">Championship</span>
                            <span className="line-clamp-1 text-lg font-bold leading-tight text-white drop-shadow-md sm:text-xl">
                                {definition.name}
                            </span>
                        </div>
                        <div className="relative z-[1] flex items-center pr-3 sm:pr-4">
                            <div className="rounded-lg bg-black/55 px-3 py-1.5 ring-1 ring-amber-400/30 backdrop-blur-sm">
                                <span className="block text-center text-[10px] font-semibold uppercase tracking-wider text-amber-200/85 sm:text-xs">단계</span>
                                <span className="block text-center text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">{selectedStage}</span>
                            </div>
                        </div>
                    </div>

                    {showContinueFlow && (
                        <div className="shrink-0 rounded-xl border border-amber-400/35 bg-gradient-to-r from-amber-950/50 via-yellow-950/25 to-amber-950/40 p-2.5 ring-1 ring-inset ring-amber-500/15 sm:p-3">
                            <p className="mb-2 text-center text-sm leading-snug text-amber-50/90 sm:text-base">
                                {isCompletedToday ||
                                (isDungeonMode && inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated'))
                                    ? '오늘 진행한 경기가 있습니다. 결과를 확인하세요.'
                                    : '진행 중인 경기가 있습니다.'}
                            </p>
                            <Button
                                onClick={() => {
                                    onContinue();
                                    onClose();
                                }}
                                colorScheme="none"
                                className="w-full border border-amber-400/40 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 py-2.5 text-base font-bold text-amber-950 shadow-lg shadow-amber-900/30 hover:from-amber-500 hover:to-yellow-500 sm:py-3 sm:text-lg"
                            >
                                {continueLabel}
                            </Button>
                        </div>
                    )}

                    <div className="shrink-0">
                        <SectionTitle accent="cyan">단계 선택</SectionTitle>
                        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stage => {
                                const unlocked = dungeonProgress.unlockedStages.includes(stage);
                                const maxUnlocked = dungeonProgress.unlockedStages.length > 0 ? Math.max(...dungeonProgress.unlockedStages) : 1;
                                const cleared = isStageCleared(dungeonProgress.stageResults, stage, dungeonProgress.currentStage, maxUnlocked);
                                const isNext = stage === dungeonProgress.currentStage + 1;
                                const active = selectedStage === stage;
                                return (
                                    <button
                                        key={stage}
                                        type="button"
                                        disabled={!unlocked}
                                        onClick={() => unlocked && setSelectedStage(stage)}
                                        className={`relative rounded-lg py-2 text-center text-sm font-bold tabular-nums transition-all sm:py-2.5 sm:text-base ${
                                            !unlocked
                                                ? 'cursor-not-allowed bg-zinc-950/80 text-zinc-600 ring-1 ring-zinc-800'
                                                : active
                                                  ? 'bg-gradient-to-b from-violet-600 to-indigo-800 text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.55)] ring-2 ring-amber-300/70 ring-offset-1 ring-offset-[#07080c]'
                                                  : isNext
                                                    ? 'bg-gradient-to-b from-violet-800/90 to-zinc-900 text-violet-100 ring-1 ring-violet-400/35 hover:from-violet-700'
                                                    : cleared
                                                      ? 'bg-gradient-to-b from-emerald-950/80 to-zinc-900 text-emerald-200/90 ring-1 ring-emerald-500/25 hover:from-emerald-900/70'
                                                      : 'bg-gradient-to-b from-zinc-800 to-zinc-950 text-zinc-200 ring-1 ring-white/10 hover:from-zinc-700'
                                        }`}
                                    >
                                        {stage}
                                        {cleared && (
                                            <span className="absolute right-1 top-1 text-[10px] leading-none text-emerald-300 sm:text-xs" aria-hidden>
                                                ✓
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="shrink-0 rounded-xl border border-violet-500/25 bg-black/35 p-2.5 ring-1 ring-inset ring-violet-500/10 sm:p-3">
                        <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                            <span className="text-sm font-bold text-violet-200 sm:text-base">상대 선수 평균 능력치 (참고)</span>
                            <span className="whitespace-nowrap text-[11px] text-zinc-500 sm:text-xs">
                                능력치별 {botStatRange.minStat}~{botStatRange.maxStat} 랜덤 · 표시 ≈ 평균 {botAvgStat}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {CORE_STAT_ROW.map(stat => (
                                <div
                                    key={stat}
                                    className="flex items-center justify-between gap-1 rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/[0.06] sm:flex-col sm:items-stretch sm:px-2 sm:py-2"
                                >
                                    <span className="shrink-0 text-xs font-semibold text-zinc-400">{CORE_STAT_SHORT[stat]}</span>
                                    <span className="text-right font-mono text-base font-bold tabular-nums text-zinc-50 sm:text-center sm:text-lg">
                                        {botAvgStat}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex min-h-[10rem] max-h-[min(44vh,400px)] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-600/35 bg-zinc-950/55 ring-1 ring-inset ring-white/[0.06] sm:min-h-[11rem] sm:max-h-[min(46vh,420px)]">
                        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-3 [scrollbar-width:thin] [scrollbar-color:rgba(52,211,153,0.35)_transparent] sm:p-3.5">
                            <div className="flex min-w-max items-stretch gap-0">
                                <div className="flex shrink-0 flex-col gap-2.5 pr-4">
                                    <span className="whitespace-nowrap text-sm font-bold text-emerald-400 sm:text-base">기본 보상 (경기 보상)</span>
                                    <div className="flex flex-col gap-2">
                                        {basePieces.length === 0 ? (
                                            <span className="text-base text-zinc-500">—</span>
                                        ) : (
                                            basePieces.map(p => <RewardStripRow key={p.key} piece={p} />)
                                        )}
                                    </div>
                                </div>
                                {rankRewardGroups.length === 0 ? (
                                    <div className="flex shrink-0 items-center border-l border-white/15 pl-4 text-base text-zinc-500">
                                        순위 보상 없음
                                    </div>
                                ) : (
                                    rankRewardGroups.map(({ ranks, pieces }) => {
                                        const headRank = ranks[0];
                                        const label = formatRankGroupLabel(ranks);
                                        return (
                                            <div
                                                key={ranks.join('-')}
                                                className="flex shrink-0 flex-col gap-2.5 border-l border-white/15 pl-4"
                                            >
                                                <span
                                                    className={`whitespace-nowrap text-sm font-bold sm:text-base ${
                                                        headRank === 1
                                                            ? 'text-amber-300'
                                                            : headRank === 2
                                                              ? 'text-slate-200'
                                                              : headRank === 3
                                                                ? 'text-orange-300/95'
                                                                : 'text-zinc-300'
                                                    }`}
                                                >
                                                    {label}
                                                </span>
                                                <div className="flex flex-col gap-2">
                                                    {pieces.length === 0 ? (
                                                        <span className="text-base text-zinc-500">—</span>
                                                    ) : (
                                                        pieces.map(p => <RewardStripRow key={p.key} piece={p} />)
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {!showContinueFlow && (
                        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-white/10 pt-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (canEnterFresh) {
                                        onEnter(selectedStage);
                                        onClose();
                                    }
                                }}
                                disabled={!canEnterFresh}
                                className="group relative mx-auto w-auto min-w-[13rem] max-w-[min(17rem,90vw)] overflow-hidden rounded-full border border-violet-300/45 bg-gradient-to-b from-violet-500 via-indigo-600 to-violet-950 px-9 py-3 text-base font-bold text-white shadow-[0_10px_36px_-10px_rgba(109,40,217,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:border-violet-200/50 hover:shadow-[0_14px_40px_-8px_rgba(139,92,246,0.55)] disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none sm:min-w-[14.5rem] sm:px-11 sm:py-3.5 sm:text-lg"
                            >
                                <span
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                                    aria-hidden
                                />
                                <span className="relative flex items-center justify-center gap-2">
                                    <span className="tracking-wide">입장하기</span>
                                    <span className="rounded-full bg-black/25 px-2 py-0.5 text-sm font-extrabold tabular-nums text-violet-100 ring-1 ring-white/15 sm:text-base">
                                        {selectedStage}단계
                                    </span>
                                </span>
                            </button>
                            {!isUnlocked && (
                                <p className="text-center text-sm text-red-300/90 sm:text-base">선택한 단계는 아직 잠겨 있습니다.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChampionshipVenueEntryModal;
