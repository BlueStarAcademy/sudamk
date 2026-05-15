import React, { useMemo, useState } from 'react';
import { UserWithStatus, EquipmentSlot, InventoryItem, ItemGrade, GameMode, CoreStat } from '../types.js';
import Avatar from './Avatar.js';
import DraggableWindow from './DraggableWindow.js';
import { AVATAR_POOL, BORDER_POOL, emptySlotImages, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, RANKING_TIERS, CORE_STATS_DATA } from '../constants';
import { getMannerScore, getMannerRank, getMannerStyle } from '../services/manner.js';
import { calculateTotalStats } from '../services/statService.js';
import MbtiComparisonModal from './MbtiComparisonModal.js';
import { useAppContext } from '../hooks/useAppContext.js';
import type { ServerAction } from '../types.js';
import type { ChampionshipVersusVenueKind } from '../types/entities.js';
import { MAX_GAME_INTEGER_INPUT } from '../shared/constants/numericLimits.js';
import { clampGameInt } from '../shared/utils/gameIntegerField.js';
import {
    readStrategicRankedBlock,
    readPairRankedBlock,
    readPairArenaAiMatchRecord,
} from '../shared/utils/unifiedRankedStatsMigration.js';
import PairPetProfilePanel from './pair/PairPetProfilePanel.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { getChampionshipVersusDisplayRating } from '../shared/utils/championshipVersusElo.js';
import { getSeasonalRankingTierName } from '../shared/constants/ranking.js';
import { resolvePublicUrl } from '../utils/publicAssetUrl.js';

// Re-using components from Profile.tsx for consistency.
const getXpRequirementForLevel = (level: number): number => {
    if (level < 1) return 0;
    if (level > 100) return Infinity; // Max level
    
    // 레벨 1~10: 200 + (레벨 x 100)
    if (level <= 10) {
        return 200 + (level * 100);
    }
    
    // 레벨 11~20: 300 + (레벨 x 150)
    if (level <= 20) {
        return 300 + (level * 150);
    }
    
    // 레벨 21~50: 이전 필요경험치 x 1.2
    // 레벨 51~100: 이전 필요경험치 x 1.3
    // 레벨 20의 필요 경험치를 먼저 계산
    let xp = 300 + (20 * 150); // 레벨 20의 필요 경험치
    
    // 레벨 21부터 현재 레벨까지 반복
    for (let l = 21; l <= level; l++) {
        if (l <= 50) {
            xp = Math.round(xp * 1.2);
        } else {
            xp = Math.round(xp * 1.3);
        }
    }
    
    return xp;
};

const XpBar: React.FC<{ level: number; currentXp: number; colorClass: string }> = ({ level, currentXp, colorClass }) => {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    const safeXp = Math.max(0, Math.floor(Number(currentXp) || 0));
    const maxXp = getXpRequirementForLevel(safeLevel);
    const percentage = maxXp > 0 ? Math.min((safeXp / maxXp) * 100, 100) : 0;
    return (
        <div className="min-w-0">
            <div className="mb-1 flex items-baseline justify-end gap-2 text-sm">
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400/95">
                    {safeXp} / {maxXp}
                </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full border border-black/55 bg-black/45 shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.05]">
                <div
                    className={`absolute inset-y-0 left-0 rounded-full ${colorClass} transition-[width] duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    aria-hidden
                />
            </div>
        </div>
    );
};

const CombinedLevelBadge: React.FC<{ level: number }> = ({ level }) => {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    return (
        <div className="flex shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-gradient-to-br from-slate-900/95 via-sky-950/35 to-slate-950/95 px-3 py-2 shadow-[0_10px_22px_-12px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.06]">
            <span className="whitespace-nowrap bg-gradient-to-b from-sky-100 to-cyan-300 bg-clip-text text-lg font-black tabular-nums text-transparent">
                Lv.{safeLevel}
            </span>
        </div>
    );
};

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.webp',
    uncommon: '/images/equipments/uncommonbgi.webp',
    rare: '/images/equipments/rarebgi.webp',
    epic: '/images/equipments/epicbgi.webp',
    legendary: '/images/equipments/legendarybgi.webp',
    mythic: '/images/equipments/mythicbgi.webp',
    transcendent: '/images/equipments/transcendentbgi.webp',
};

const getStarDisplay = (stars: number) => {
    let starImage = '';
    let numberColor = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.webp';
        numberColor = "prism-text-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.webp';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.webp';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.webp';
        numberColor = "text-white";
    } else {
        return <img src="/images/equipments/Star1.webp" alt="star" className="w-4 h-4 inline-block opacity-30" title="미강화" />;
    }

    // Add text shadow here for consistency across all usages
    return (
        <span className="flex items-center gap-0.5" style={{ textShadow: '1px 1px 2px black, 0 0 5px black' }}>
            <img src={starImage} alt="star" className="w-4 h-4" />
            <span className={`font-bold ${numberColor}`}>{stars}</span>
        </span>
    );
};

const EquipmentSlotDisplay: React.FC<{
    slot: EquipmentSlot;
    item?: InventoryItem;
    onClick?: () => void;
    /** 프로필 모달 등: 슬롯·아이콘을 줄여 상단 패널 높이 절약 */
    compact?: boolean;
    /** 타인 프로필: compact 슬롯 안에서 장비 아이콘만 살짝 확대 */
    largerCompactIcon?: boolean;
}> = ({ slot, item, onClick, compact, largerCompactIcon }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    const round = compact ? 'rounded-lg' : 'rounded-xl';

    if (item) {
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        const iconPct = compact ? (largerCompactIcon ? '76%' : '68%') : '80%';
        const iconPad = compact ? (largerCompactIcon ? 'p-1' : 'p-1.5') : 'p-3';
        return (
            <div
                className={`relative aspect-square w-full border border-white/[0.1] bg-gradient-to-br from-zinc-900/90 to-black/60 shadow-inner ring-1 ring-inset ring-white/[0.05] ${round} ${clickableClass} ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                title={item.name}
                onClick={onClick}
                style={{ border: isTranscendent ? undefined : undefined }}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 h-full w-full rounded-md object-cover" />
                <div
                    className={`absolute z-10 font-bold ${compact ? 'right-1 top-0.5 origin-top-right scale-[0.82]' : 'right-2.5 top-1 text-sm'}`}
                >
                    {getStarDisplay(item.stars)}
                </div>
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className={`absolute object-contain ${iconPad}`}
                        style={{ width: iconPct, height: iconPct, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                    />
                )}
            </div>
        );
    }
    return (
        <img
            src={emptySlotImages[slot]}
            alt={`${slot} empty slot`}
            className={`aspect-square w-full border border-white/[0.08] bg-black/45 opacity-90 ring-1 ring-inset ring-white/[0.04] ${round}`}
        />
    );
};

interface UserProfileModalProps {
  user: UserWithStatus;
  onClose: () => void;
  onViewItem: (item: InventoryItem, isOwnedByCurrentUser: boolean) => void;
  isTopmost?: boolean;
}

/** 페어: 랭킹전 전적(`pairRankedMatchRecord`) + 경기장 전략 모드별(`pairArenaStatsByMode`) */
const PairStatsTab: React.FC<{ user: UserWithStatus; dense?: boolean }> = ({ user, dense }) => {
    const pairRanked = readPairRankedBlock(user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
    const totalWins = pairRanked.wins;
    const totalLosses = pairRanked.losses;
    const totalGames = totalWins + totalLosses;
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const pairAi = readPairArenaAiMatchRecord(user.stats as Record<string, { wins?: number; losses?: number }>);
    const pairAiGames = pairAi.wins + pairAi.losses;
    const pairAiWinRate = pairAiGames > 0 ? Math.round((pairAi.wins / pairAiGames) * 100) : 0;
    const byMode = user.pairArenaStatsByMode;

    const wrap = dense ? 'space-y-1 text-[0.68rem]' : 'space-y-1.5 text-xs';
    const sumPad = dense ? 'px-1.5 py-1' : 'px-2 py-1.5';
    const rowPad = dense ? 'px-1.5 py-0.5' : 'px-2 py-1';
    const rowMono = dense ? 'text-[0.62rem]' : 'text-[0.7rem]';

    return (
        <div className={wrap}>
            <div
                className={`rounded-lg border border-violet-400/20 bg-gradient-to-r from-violet-950/50 via-black/35 to-fuchsia-950/35 text-center shadow-inner ring-1 ring-inset ring-white/[0.04] ${sumPad}`}
            >
                <span className="font-bold tracking-tight text-violet-100/95">
                    랭킹전 통합: {totalWins}승 {totalLosses}패 ({winRate}%)
                </span>
            </div>
            <div
                className={`rounded-lg border border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-950/40 via-black/35 to-violet-950/30 text-center shadow-inner ring-1 ring-inset ring-white/[0.04] ${sumPad}`}
            >
                <span className="font-bold tracking-tight text-fuchsia-100/95">
                    페어 AI 대전: {pairAi.wins}승 {pairAi.losses}패 ({pairAiWinRate}%)
                </span>
            </div>
            <div className={dense ? 'space-y-0.5' : 'space-y-1'}>
                {SPECIAL_GAME_MODES.map(({ mode, name }) => {
                    const row = byMode?.[String(mode)];
                    const wins = row?.wins ?? 0;
                    const losses = row?.losses ?? 0;
                    const g = wins + losses;
                    const wr = g > 0 ? Math.round((wins / g) * 100) : 0;
                    return (
                        <div
                            key={mode}
                            className={`flex items-center justify-between gap-1.5 rounded-md border border-white/[0.06] bg-black/35 shadow-sm ring-1 ring-inset ring-white/[0.03] ${rowPad}`}
                        >
                            <span className="truncate font-semibold text-slate-200/95">{name}</span>
                            <span className={`whitespace-nowrap text-right font-mono tabular-nums text-slate-300/90 ${rowMono}`}>
                                {wins}승 {losses}패 ({wr}%)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const StatsTab: React.FC<{ user: UserWithStatus; type: 'strategic' | 'playful'; dense?: boolean }> = ({ user, type, dense }) => {
    const modes = type === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const stats = user.stats || {};
    
    let totalWins = 0;
    let totalLosses = 0;
    let totalAiWins = 0;
    let totalAiLosses = 0;

    const gameStats = modes.map(m => {
        const s = stats[m.mode];
        if (s) {
            totalWins += s.wins ?? 0;
            totalLosses += s.losses ?? 0;
            totalAiWins += s.aiWins ?? 0;
            totalAiLosses += s.aiLosses ?? 0;
            return { mode: m.mode, ...s };
        }
        return { mode: m.mode, wins: 0, losses: 0, rankingScore: 1200 };
    });
    
    const totalGames = totalWins + totalLosses;
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const aiGames = totalAiWins + totalAiLosses;
    const aiWinRate = aiGames > 0 ? Math.round((totalAiWins / aiGames) * 100) : 0;

    const summaryTint =
        type === 'strategic'
            ? 'border-sky-400/25 from-sky-950/45 via-black/35 to-indigo-950/40 text-sky-100/95'
            : 'border-amber-400/22 from-amber-950/40 via-black/35 to-orange-950/35 text-amber-100/95';

    const wrap = dense ? 'space-y-1 text-[0.68rem]' : 'space-y-1.5 text-xs';
    const sumPad = dense ? 'px-1.5 py-1' : 'px-2 py-1.5';
    const rowPad = dense ? 'px-1.5 py-0.5' : 'px-2 py-1';
    const rowMono = dense ? 'text-[0.62rem]' : 'text-[0.7rem]';

    return (
        <div className={wrap}>
            <div
                className={`rounded-lg border bg-gradient-to-r text-center shadow-inner ring-1 ring-inset ring-white/[0.04] ${summaryTint} ${sumPad}`}
            >
                <span className="font-bold tracking-tight">
                    PVP 전적: {totalWins}승 {totalLosses}패 ({winRate}%)
                    {aiGames > 0 ? (
                        <span className="ml-2 font-semibold text-violet-200/90">
                            · AI {totalAiWins}승 {totalAiLosses}패 ({aiWinRate}%)
                        </span>
                    ) : null}
                </span>
            </div>
            <div className={dense ? 'space-y-0.5' : 'space-y-1'}>
                {gameStats.map((stat) => {
                    const gameTotal = (stat.wins ?? 0) + (stat.losses ?? 0);
                    const gameWinRate = gameTotal > 0 ? Math.round(((stat.wins ?? 0) / gameTotal) * 100) : 0;
                    const aw = stat.aiWins ?? 0;
                    const al = stat.aiLosses ?? 0;
                    const aiTot = aw + al;
                    const aiWr = aiTot > 0 ? Math.round((aw / aiTot) * 100) : 0;
                    return (
                        <div
                            key={stat.mode}
                            className={`flex items-center justify-between gap-1.5 rounded-md border border-white/[0.06] bg-black/35 shadow-sm ring-1 ring-inset ring-white/[0.03] ${rowPad}`}
                        >
                            <span className="truncate font-semibold text-slate-200/95">{stat.mode}</span>
                            <span className={`min-w-0 flex-1 text-right font-mono tabular-nums text-slate-300/90 ${rowMono}`}>
                                <span className="block">
                                    PVP {stat.wins ?? 0}승 {stat.losses ?? 0}패 ({gameWinRate}%)
                                </span>
                                {aiTot > 0 ? (
                                    <span className="mt-0.5 block text-violet-200/85">
                                        AI {aw}승 {al}패 ({aiWr}%)
                                    </span>
                                ) : null}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/** 대기실과 동일: 현재 시즌 점수 = 1200 + (저장된 차이값). dailyRankings에는 1200에서의 차이가 저장됨 */
const SEASON_BASE_SCORE = 1200;

/** 랭킹전 티어: 시즌 점수·순위·대국 수 기준 (RankedMatchPanel과 동일) */
const getTier = (score: number, rank: number, totalGames: number) => {
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) return tier;
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose, onViewItem, isTopmost }) => {
    const { inventory, stats, nickname, avatarId, borderId, equipment } = user;
    const [showMbtiComparison, setShowMbtiComparison] = useState(false);
    const [adminToolsOpen, setAdminToolsOpen] = useState(false);
    const { currentUserWithStatus, guilds, handlers } = useAppContext();
    const isAdminViewingOtherUser = !!currentUserWithStatus?.isAdmin && currentUserWithStatus.id !== user.id;
    const [chatDurationMinutes, setChatDurationMinutes] = useState(10);
    const [connectionDurationMinutes, setConnectionDurationMinutes] = useState(60);
    const [sanctionReason, setSanctionReason] = useState('욕설/비방');
    const [sanctionReasonEtc, setSanctionReasonEtc] = useState('');
    const effectiveReason = sanctionReason === '기타' ? sanctionReasonEtc.trim() : sanctionReason;
    const now = Date.now();
    const isChatBanned = !!user.chatBanUntil && user.chatBanUntil > now;
    const isConnectionBanned = !!user.connectionBanUntil && user.connectionBanUntil > now;
    const onlineStatus = (user as any).status as string | undefined;
    const isConnected = Boolean((user as any).isConnected);
    const myFriendIds = new Set(currentUserWithStatus?.friendIds || []);
    const isSelfProfile = currentUserWithStatus?.id === user.id;
    const isFriend = myFriendIds.has(user.id);

    const runAdminAction = async (action: ServerAction) => {
        try {
            await handlers.handleAction(action);
        } catch (err) {
            console.error('[UserProfileModal] admin action failed:', err);
        }
    };

    const applySanction = async (sanctionType: 'chat' | 'connection', durationMinutes: number) => {
        if (!effectiveReason) {
            alert('제재 사유를 입력해주세요.');
            return;
        }
        await runAdminAction({
            type: 'ADMIN_APPLY_SANCTION',
            payload: {
                targetUserId: user.id,
                sanctionType,
                durationMinutes,
                reason: effectiveReason,
                reasonDetail: sanctionReason === '기타' ? sanctionReasonEtc.trim() : undefined,
            },
        });
    };

    const liftSanction = async (sanctionType: 'chat' | 'connection') => {
        await runAdminAction({
            type: 'ADMIN_LIFT_SANCTION',
            payload: { targetUserId: user.id, sanctionType },
        });
    };

    const forceLogout = async () => {
        if (!window.confirm(`[${user.nickname}] 님을 즉시 로그아웃 처리할까요?`)) return;
        await runAdminAction({
            type: 'ADMIN_FORCE_LOGOUT',
            payload: { targetUserId: user.id },
        });
    };

    const addFriend = async () => {
        if (isSelfProfile) return;
        await handlers.handleAction({ type: 'FRIEND_SEND_REQUEST', payload: { targetUserId: user.id } } as any);
    };

    const removeFriend = async () => {
        if (isSelfProfile) return;
        await handlers.handleAction({ type: 'FRIEND_REMOVE', payload: { targetUserId: user.id } } as any);
    };
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    // 전략 바둑 / 놀이 바둑 티어+점수. 표시 점수 = 대기실과 동일한 현재 시즌점수(1200 + 차이)
    const strategicTierInfo = useMemo(() => {
        const dr = user.dailyRankings?.strategic;
        let seasonScore: number; // 1200 기준 현재 시즌 점수 (대기실 표시와 동일)
        let rank: number;
        const stratBlk = readStrategicRankedBlock(user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
        const totalGames = stratBlk.wins + stratBlk.losses;
        if (dr && typeof dr.rank === 'number') {
            // dailyRankings.score는 1200에서의 차이(델타)로 저장됨 → 시즌점수 = 1200 + delta
            const delta = typeof dr.score === 'number' ? dr.score : 0;
            seasonScore = SEASON_BASE_SCORE + delta;
            rank = dr.rank;
        } else {
            let sum = 0;
            let count = 0;
            for (const m of SPECIAL_GAME_MODES) {
                const s = user.stats?.[m.mode];
                if (s && typeof s.rankingScore === 'number') {
                    sum += s.rankingScore;
                    count++;
                }
            }
            seasonScore = count > 0 ? sum / count : SEASON_BASE_SCORE;
            rank = 9999;
        }
        const tier = getTier(seasonScore, rank, totalGames);
        return { tier, score: Math.round(seasonScore) };
    }, [user.dailyRankings?.strategic, user.stats]);

    const pairTierInfo = useMemo(() => {
        const dr = user.dailyRankings?.pair;
        let seasonScore: number;
        let rank: number;
        const pairBlk = readPairRankedBlock(user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
        const totalGames = pairBlk.wins + pairBlk.losses;
        if (dr && typeof dr.rank === 'number') {
            const delta = typeof dr.score === 'number' ? dr.score : 0;
            seasonScore = SEASON_BASE_SCORE + delta;
            rank = dr.rank;
        } else {
            seasonScore = pairBlk.rankingScore;
            rank = 9999;
        }
        const tier = getTier(seasonScore, rank, totalGames);
        return { tier, score: Math.round(seasonScore) };
    }, [user.dailyRankings?.pair, user.stats]);

    const championshipVenueStrip = useMemo(() => {
        const rating = getChampionshipVersusDisplayRating(user, 'pvp', Date.now());
        const wl = (k: ChampionshipVersusVenueKind) => {
            const e = user.championshipVersusVenueRatings?.[k];
            return {
                wins: Math.max(0, Math.floor(Number(e?.seasonWins) || 0)),
                losses: Math.max(0, Math.floor(Number(e?.seasonLosses) || 0)),
            };
        };
        const p = wl('pvp');
        const pet = wl('pet');
        const pr = wl('petpair');
        const games = Math.max(p.wins + p.losses, pet.wins + pet.losses, pr.wins + pr.losses);
        const tierName = getSeasonalRankingTierName(rating, 999_999, games);
        const tier = RANKING_TIERS.find((x) => x.name === tierName) ?? RANKING_TIERS[RANKING_TIERS.length - 1]!;
        return {
            rating: Math.round(rating),
            tierName,
            tierIcon: tier.icon,
            tierColor: tier.color,
            venueSeason: [
                { label: 'PVP', ...p },
                { label: '펫', ...pet },
                { label: '페어', ...pr },
            ],
        };
    }, [user]);
    const championshipVenueRecordOneLine = useMemo(
        () => championshipVenueStrip.venueSeason.map((row) => `${row.label} ${row.wins}승 ${row.losses}패`).join(' · '),
        [championshipVenueStrip],
    );

    // equipment 필드와 inventory를 매칭하여 장착된 아이템 찾기
    const equippedItems = useMemo(() => {
        const items: InventoryItem[] = [];
        const equipmentObj = equipment || {};
        const inventoryList = inventory || [];
        
        // equipment 필드의 각 슬롯에 대해 아이템 찾기
        for (const [slot, itemId] of Object.entries(equipmentObj)) {
            const item = inventoryList.find(i => i.id === itemId && i.slot === slot);
            if (item) {
                items.push(item);
            }
        }
        
        return items;
    }, [inventory, equipment]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        // equipment 필드에서 해당 슬롯의 아이템 ID 찾기
        const itemId = equipment?.[slot];
        if (!itemId) return undefined;
        
        // inventory에서 해당 아이템 찾기
        return (inventory || []).find(item => item.id === itemId && item.slot === slot);
    };

    const totalMannerScore = getMannerScore(user);
    const mannerRank = getMannerRank(totalMannerScore);
    const mannerStyle = getMannerStyle(totalMannerScore);
    const totalStats = calculateTotalStats(user);

    const combinedLevel = user.userLevel ?? 1;

    const guildInfo = useMemo(() => {
        if (!user.guildId) return null;
        return guilds[user.guildId] || null;
    }, [user.guildId, guilds]);

    const equippedPairPetRow = useMemo(() => getEquippedPairPetInventoryRow(user), [user]);

    const PROFILE_MODAL_WIDTH = 900;

    return (
        <>
        <DraggableWindow
            title={`${user.nickname}님의 프로필`}
            onClose={() => {
                setAdminToolsOpen(false);
                onClose();
            }}
            windowId={`view-user-${user.id}`}
            initialWidth={PROFILE_MODAL_WIDTH}
            initialHeight={700}
            isTopmost={isTopmost}
            mobileViewportFit
            headerContent={
                isAdminViewingOtherUser ? (
                    <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            setAdminToolsOpen(true);
                        }}
                        className="z-30 shrink-0 rounded-lg border border-rose-400/45 bg-gradient-to-br from-rose-950/90 to-red-950/80 px-2.5 py-1.5 text-xs font-bold text-rose-50 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.45)] ring-1 ring-inset ring-white/10 transition hover:border-rose-300/55 hover:from-rose-900/90 sm:px-3 sm:py-2 sm:text-sm"
                    >
                        관리자 기능
                    </button>
                ) : undefined
            }
        >
            {showMbtiComparison && <MbtiComparisonModal opponentUser={user} onClose={() => setShowMbtiComparison(false)} isTopmost={true} />}
            <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-950/40 via-transparent to-black/25 pr-0.5">
                <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                    {/* 좌상단: 프로필 */}
                    <div className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/95 via-slate-950/98 to-zinc-950 p-3 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-white/[0.05]">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" aria-hidden />
                        <div className="flex items-start gap-2.5">
                            <div className="relative shrink-0 rounded-xl p-0.5 shadow-lg shadow-black/50 ring-1 ring-cyan-400/20">
                                <Avatar userId={user.id} userName={nickname} size={52} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                            </div>
                            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate bg-gradient-to-r from-slate-50 via-sky-100 to-cyan-200 bg-clip-text text-lg font-extrabold tracking-tight text-transparent sm:text-xl">
                                        {nickname}
                                    </h2>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-400/95">
                                        <span className="font-semibold text-slate-300">MBTI</span>
                                        {user.mbti ? (
                                            <>
                                                <span className="font-bold text-base text-cyan-200">{user.mbti}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMbtiComparison(true)}
                                                    className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-md border border-cyan-300/55 bg-gradient-to-br from-cyan-500/80 via-sky-500/72 to-indigo-600/82 text-white shadow-[0_12px_22px_-14px_rgba(56,189,248,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200/80 hover:from-cyan-400/85 hover:via-sky-500/78 hover:to-indigo-500/85"
                                                >
                                                    분석하기
                                                </button>
                                            </>
                                        ) : (
                                            <span className="font-semibold text-base text-gray-200 inline-flex items-center gap-1">
                                                미설정
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {!isSelfProfile && (
                                    <div className="flex shrink-0 flex-col items-end gap-2 border-l border-white/[0.08] pl-3">
                                        {isFriend ? (
                                            <button
                                                type="button"
                                                onClick={removeFriend}
                                                className="min-w-[6.5rem] rounded-xl border border-rose-400/40 bg-gradient-to-br from-rose-950/80 to-zinc-950/90 px-4 py-2 text-sm font-bold text-rose-50 shadow-md shadow-black/40 ring-1 ring-inset ring-white/[0.06] transition hover:border-rose-300/50 hover:from-rose-900/85"
                                            >
                                                친구 삭제
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={addFriend}
                                                className="min-w-[6.5rem] rounded-xl border border-cyan-400/40 bg-gradient-to-br from-cyan-950/75 via-slate-950/90 to-indigo-950/80 px-4 py-2 text-sm font-bold text-cyan-50 shadow-md shadow-black/40 ring-1 ring-inset ring-white/[0.06] transition hover:border-cyan-300/55 hover:from-cyan-900/80"
                                            >
                                                친구 추가
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        {user.guildId ? (
                            <div className="mt-0.5 flex items-center gap-2 rounded-xl border border-indigo-400/25 bg-gradient-to-r from-indigo-950/55 via-slate-950/40 to-violet-950/45 px-2.5 py-1.5 shadow-inner ring-1 ring-inset ring-white/[0.04]">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                                    {(guildInfo?.icon ?? (user as any).guildIcon) ? (
                                        <img
                                            src={(() => {
                                                const icon = guildInfo?.icon ?? (user as any).guildIcon;
                                                return icon?.startsWith('/images/guild/icon') ? icon.replace('/images/guild/icon', '/images/guild/profile/icon') : icon;
                                            })()}
                                            alt={guildInfo?.name ?? (user as any).guildName ?? '길드'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <img src="/images/button/guild.webp" alt="길드" className="w-4 h-4 object-contain" />
                                    )}
                                </div>
                                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-indigo-300/80">길드</span>
                                <span className="truncate text-sm font-semibold text-slate-100">{guildInfo?.name ?? (user as any).guildName ?? '길드 소속'}</span>
                                <span className="ml-auto font-mono text-xs tabular-nums text-indigo-200/85">
                                    Lv.{guildInfo ? guildInfo.level || 1 : (user as any).guildLevel ?? 1}
                                </span>
                            </div>
                        ) : (
                            <div className="mt-0.5 rounded-xl border border-white/[0.07] bg-black/30 px-2.5 py-1.5 text-xs text-slate-500 ring-1 ring-inset ring-white/[0.03]">
                                길드 없음
                            </div>
                        )}
                        <div className="mt-0.5 flex w-full flex-col gap-2 rounded-xl border border-white/[0.08] bg-gradient-to-br from-black/55 via-slate-950/80 to-black/50 p-2.5 shadow-inner ring-1 ring-inset ring-white/[0.04]">
                            <div className="flex min-w-0 items-center gap-2">
                                <CombinedLevelBadge level={combinedLevel} />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <XpBar
                                        level={user.userLevel}
                                        currentXp={user.userXp}
                                        colorClass="bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-400 shadow-[0_0_14px_-2px_rgba(34,211,238,0.55)]"
                                    />
                                </div>
                            </div>
                            <div className="border-t border-white/[0.06] pt-2">
                                <PairPetProfilePanel
                                    currentUser={user}
                                    currentUserId={user.id}
                                    isBusy={false}
                                    compact
                                    readOnly={!isSelfProfile}
                                    showRepresentativeBadge={!!equippedPairPetRow}
                                    onOpenEquippedPetDetail={() => {
                                        if (equippedPairPetRow) handlers.openPairPetDetailModal(equippedPairPetRow, 'view');
                                    }}
                                />
                            </div>
                            <div className="border-t border-white/[0.06] pt-1.5">
                                <div className="mb-0.5 flex items-center justify-between text-[0.7rem] text-slate-400">
                                    <span className="font-semibold tracking-tight text-slate-300">매너 등급</span>
                                    <span className={`font-semibold tabular-nums ${mannerRank.color}`}>
                                        {totalMannerScore}점 ({mannerRank.rank})
                                    </span>
                                </div>
                                <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-black/50 bg-black/45 shadow-inner ring-1 ring-inset ring-white/[0.04]">
                                    <div
                                        className={`${mannerStyle.colorClass} h-full rounded-full transition-[width]`}
                                        style={{ width: `${mannerStyle.percentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 우상단: 장비 + 능력치 + 챔피언십 요약 */}
                    <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-slate-950 p-3 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-amber-500/[0.07]">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" aria-hidden />
                        <p className="mb-1.5 text-center text-[0.6rem] font-bold uppercase tracking-[0.18em] text-amber-200/70">장비</p>
                        <div className="flex shrink-0 gap-2 sm:gap-2.5">
                            <div
                                className={`mx-auto grid shrink-0 grid-cols-3 gap-1.5 ${isSelfProfile ? 'max-w-[11.5rem] sm:max-w-[12rem]' : 'max-w-[12.25rem] sm:max-w-[12.75rem]'}`}
                            >
                                <EquipmentSlotDisplay slot="fan" item={getItemForSlot('fan')} compact largerCompactIcon={!isSelfProfile} onClick={() => getItemForSlot('fan') && onViewItem(getItemForSlot('fan')!, false)} />
                                <EquipmentSlotDisplay slot="board" item={getItemForSlot('board')} compact largerCompactIcon={!isSelfProfile} onClick={() => getItemForSlot('board') && onViewItem(getItemForSlot('board')!, false)} />
                                <EquipmentSlotDisplay slot="top" item={getItemForSlot('top')} compact largerCompactIcon={!isSelfProfile} onClick={() => getItemForSlot('top') && onViewItem(getItemForSlot('top')!, false)} />
                                <EquipmentSlotDisplay slot="bottom" item={getItemForSlot('bottom')} compact largerCompactIcon={!isSelfProfile} onClick={() => getItemForSlot('bottom') && onViewItem(getItemForSlot('bottom')!, false)} />
                                <EquipmentSlotDisplay slot="bowl" item={getItemForSlot('bowl')} compact largerCompactIcon={!isSelfProfile} onClick={() => getItemForSlot('bowl') && onViewItem(getItemForSlot('bowl')!, false)} />
                                <EquipmentSlotDisplay slot="stones" item={getItemForSlot('stones')} compact largerCompactIcon={!isSelfProfile} onClick={() => getItemForSlot('stones') && onViewItem(getItemForSlot('stones')!, false)} />
                            </div>
                            <div className="min-h-0 min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-black/35 p-2 shadow-inner ring-1 ring-inset ring-white/[0.03]">
                                <p className="mb-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-slate-400/90">능력치</p>
                                <div className="flex flex-col gap-0.5">
                                    {Object.values(CoreStat).map((stat) => (
                                        <div key={stat} className="flex min-w-0 items-center gap-1 text-[0.65rem] leading-tight sm:text-[0.68rem]">
                                            <span className="truncate font-semibold text-slate-400">{CORE_STATS_DATA[stat]?.name || stat}</span>
                                            <span className="ml-auto shrink-0 font-mono tabular-nums text-slate-100">{totalStats[stat]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 border-t border-white/[0.07] pt-2">
                            <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-fuchsia-400/22 bg-gradient-to-b from-fuchsia-950/22 via-black/40 to-black/55 p-2.5 shadow-inner ring-1 ring-inset ring-white/[0.03]">
                                <p className="mb-2 text-center text-xs font-black uppercase tracking-wide text-fuchsia-200/90 sm:text-sm">
                                    챔피언십 경기장
                                </p>
                                <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/35 px-2 py-2 ring-1 ring-inset ring-white/[0.02] sm:gap-2.5 sm:px-2.5">
                                    <img
                                        src={resolvePublicUrl(championshipVenueStrip.tierIcon)}
                                        alt=""
                                        title={championshipVenueStrip.tierName}
                                        className="h-9 w-9 shrink-0 object-contain drop-shadow-sm sm:h-10 sm:w-10"
                                    />
                                    <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        <span className="block whitespace-nowrap text-[11px] font-semibold tracking-tight text-slate-100 sm:text-xs">
                                            <span className={`font-bold ${championshipVenueStrip.tierColor}`}>{championshipVenueStrip.tierName}</span>
                                            <span className="mx-1 text-slate-500">·</span>
                                            <span className="font-mono tabular-nums text-fuchsia-100">{championshipVenueStrip.rating}점</span>
                                            <span className="mx-1 text-slate-500">·</span>
                                            <span className="font-mono tabular-nums text-slate-200">{championshipVenueRecordOneLine}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 하단: 전략 → 페어 → 놀이 (한 줄, 모바일은 세로) */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:col-span-2">
                        <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-950/35 via-zinc-950/90 to-black/60 p-2.5 shadow-lg shadow-black/40 ring-1 ring-inset ring-white/[0.04]">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" aria-hidden />
                            <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-gradient-to-r from-sky-950/50 to-indigo-950/40 py-1.5 pl-1.5 pr-2 shadow-inner">
                                <img src={strategicTierInfo.tier.icon} alt={strategicTierInfo.tier.name} className="h-7 w-7 shrink-0 drop-shadow-md" />
                                <span className="text-[0.62rem] font-bold uppercase tracking-wide text-sky-200/90">전략</span>
                                <span className={`ml-auto text-right text-xs font-bold leading-tight ${strategicTierInfo.tier.color}`}>
                                    {strategicTierInfo.tier.name}
                                    <span className="mt-0.5 block font-mono text-[0.62rem] tabular-nums text-sky-100/80">{strategicTierInfo.score}점</span>
                                </span>
                            </div>
                            <div className="min-h-0 flex-1 overflow-visible pr-0.5">
                                <StatsTab user={user} type="strategic" dense />
                            </div>
                        </div>

                        <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-500/22 bg-gradient-to-b from-violet-950/35 via-zinc-950/90 to-black/60 p-2.5 shadow-lg shadow-black/40 ring-1 ring-inset ring-white/[0.04]">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/28 to-transparent" aria-hidden />
                            <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-violet-400/28 bg-gradient-to-r from-violet-950/55 to-fuchsia-950/35 py-1.5 pl-1.5 pr-2 shadow-inner">
                                <img src={pairTierInfo.tier.icon} alt={pairTierInfo.tier.name} className="h-7 w-7 shrink-0 drop-shadow-md" />
                                <span className="text-[0.62rem] font-bold uppercase tracking-wide text-violet-200/90">페어</span>
                                <span className={`ml-auto text-right text-xs font-bold leading-tight ${pairTierInfo.tier.color}`}>
                                    {pairTierInfo.tier.name}
                                    <span className="mt-0.5 block font-mono text-[0.62rem] tabular-nums text-violet-100/85">{pairTierInfo.score}점</span>
                                </span>
                            </div>
                            <div className="min-h-0 flex-1 overflow-visible pr-0.5">
                                <PairStatsTab user={user} dense />
                            </div>
                        </div>

                        <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-amber-500/22 bg-gradient-to-b from-amber-950/28 via-zinc-950/90 to-black/60 p-2.5 shadow-lg shadow-black/40 ring-1 ring-inset ring-white/[0.04]">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/28 to-transparent" aria-hidden />
                            <div className="mb-1.5 flex items-center rounded-lg border border-amber-400/28 bg-gradient-to-r from-amber-950/45 to-orange-950/35 py-1.5 px-2 shadow-inner">
                                <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-amber-200/95">놀이 바둑</span>
                            </div>
                            <div className="min-h-0 flex-1 overflow-visible pr-0.5">
                                <StatsTab user={user} type="playful" dense />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>

        {adminToolsOpen && isAdminViewingOtherUser && (
            <DraggableWindow
                title={`${user.nickname} — 관리자 기능`}
                onClose={() => setAdminToolsOpen(false)}
                windowId={`view-user-admin-${user.id}`}
                initialWidth={480}
                initialHeight={640}
                isTopmost
                mobileViewportFit
                hideFooter
            >
                <div className="space-y-2.5 rounded-xl border border-rose-500/35 bg-gradient-to-b from-rose-950/40 via-zinc-950/90 to-black/55 p-4 text-xs shadow-inner ring-1 ring-inset ring-white/[0.05]">
                    <div className="text-gray-300">
                        접속 상태:{' '}
                        <span className={isConnected ? 'font-semibold text-emerald-400' : 'text-gray-400'}>
                            {isConnected ? '접속중' : onlineStatus || '오프라인'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={forceLogout} className="rounded bg-red-700 px-2 py-1 hover:bg-red-600">
                            로그아웃 처리
                        </button>
                        <button
                            type="button"
                            onClick={() => applySanction('connection', connectionDurationMinutes)}
                            className="rounded bg-orange-700 px-2 py-1 hover:bg-orange-600"
                        >
                            접속금지 적용
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => applySanction('chat', chatDurationMinutes)} className="rounded bg-yellow-700 px-2 py-1 hover:bg-yellow-600">
                            채팅금지 적용
                        </button>
                        <button type="button" onClick={() => liftSanction('chat')} className="rounded bg-zinc-700 px-2 py-1 hover:bg-zinc-600">
                            채팅금지 해제
                        </button>
                    </div>
                    <div>
                        <button type="button" onClick={() => liftSanction('connection')} className="w-full rounded bg-zinc-700 px-2 py-1 hover:bg-zinc-600">
                            접속금지 해제
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-gray-400">
                            채팅금지(분)
                            <input
                                type="number"
                                min={1}
                                max={MAX_GAME_INTEGER_INPUT}
                                className="mt-1 w-full rounded bg-black/40 px-2 py-1"
                                value={chatDurationMinutes}
                                onChange={(e) => setChatDurationMinutes(clampGameInt(Number(e.target.value) || 1, { min: 1 }))}
                            />
                        </label>
                        <label className="text-gray-400">
                            접속금지(분)
                            <input
                                type="number"
                                min={1}
                                max={MAX_GAME_INTEGER_INPUT}
                                className="mt-1 w-full rounded bg-black/40 px-2 py-1"
                                value={connectionDurationMinutes}
                                onChange={(e) => setConnectionDurationMinutes(clampGameInt(Number(e.target.value) || 1, { min: 1 }))}
                            />
                        </label>
                    </div>
                    <div>
                        <label className="text-gray-400">제재 사유</label>
                        <select value={sanctionReason} onChange={(e) => setSanctionReason(e.target.value)} className="mt-1 w-full rounded bg-black/40 px-2 py-1">
                            <option>욕설/비방</option>
                            <option>도배/스팸</option>
                            <option>불법 프로그램 의심</option>
                            <option>부적절한 닉네임/프로필</option>
                            <option>기타</option>
                        </select>
                        {sanctionReason === '기타' && (
                            <textarea
                                className="mt-2 min-h-[54px] w-full rounded bg-black/40 px-2 py-1"
                                placeholder="사유를 직접 입력하세요"
                                value={sanctionReasonEtc}
                                onChange={(e) => setSanctionReasonEtc(e.target.value)}
                            />
                        )}
                    </div>
                    <div className="text-gray-300">
                        제재내역:
                        <div className="mt-1 max-h-24 space-y-1 overflow-y-auto pr-1">
                            {(user.sanctionHistory || []).slice(0, 8).map((h) => (
                                <div key={h.id} className="rounded bg-black/35 px-2 py-1">
                                    [{h.sanctionType === 'chat' ? '채팅금지' : '접속금지'}] {h.reason}
                                    {h.details ? ` (${h.details})` : ''} / {new Date(h.createdAt).toLocaleString()}
                                    {h.releasedAt ? ' / 해제됨' : ''}
                                </div>
                            ))}
                            {(user.sanctionHistory || []).length === 0 && <div className="text-gray-500">기록 없음</div>}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400">
                            현재: 채팅 {isChatBanned ? '금지중' : '정상'} / 접속 {isConnectionBanned ? '금지중' : '정상'}
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        )}
        </>
    );
};

export default UserProfileModal;