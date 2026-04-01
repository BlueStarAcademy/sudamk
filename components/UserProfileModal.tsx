import React, { useEffect, useMemo, useState } from 'react';
import { UserWithStatus, EquipmentSlot, InventoryItem, ItemGrade, GameMode, CoreStat } from '../types.js';
import Avatar from './Avatar.js';
import DraggableWindow from './DraggableWindow.js';
import { AVATAR_POOL, BORDER_POOL, emptySlotImages, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, RANKING_TIERS, CORE_STATS_DATA } from '../constants';
import { getMannerScore, getMannerRank, getMannerStyle } from '../services/manner.js';
import { calculateTotalStats } from '../services/statService.js';
import MbtiComparisonModal from './MbtiComparisonModal.js';
import { useAppContext } from '../hooks/useAppContext.js';
import type { ServerAction } from '../types.js';

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

const XpBar: React.FC<{ level: number, currentXp: number, label: string, colorClass: string }> = ({ level, currentXp, label, colorClass }) => {
    const maxXp = getXpRequirementForLevel(level);
    const percentage = Math.min((currentXp / maxXp) * 100, 100);
    return (
        <div>
            <div className="flex justify-between items-baseline mb-1 text-sm">
                <span className="font-semibold">{label} <span className="text-lg font-bold">Lv.{level}</span></span>
                <span className="text-xs font-mono text-gray-400">{currentXp} / {maxXp}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 border border-gray-900">
                <div className={`${colorClass} h-full rounded-full transition-width duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const CombinedLevelBadge: React.FC<{ level: number }> = ({ level }) => {
    return (
        <div className="flex-shrink-0 bg-gray-900/70 rounded-md border border-gray-700 flex items-center justify-center px-3 py-2">
            <span className="font-bold text-xl text-blue-300 whitespace-nowrap">Lv.{level}</span>
        </div>
    );
};

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
};

const getStarDisplay = (stars: number) => {
    let starImage = '';
    let numberColor = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = "prism-text-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.png';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.png';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.png';
        numberColor = "text-white";
    } else {
        return <img src="/images/equipments/Star1.png" alt="star" className="w-4 h-4 inline-block opacity-30" title="미강화" />;
    }

    // Add text shadow here for consistency across all usages
    return (
        <span className="flex items-center gap-0.5" style={{ textShadow: '1px 1px 2px black, 0 0 5px black' }}>
            <img src={starImage} alt="star" className="w-4 h-4" />
            <span className={`font-bold ${numberColor}`}>{stars}</span>
        </span>
    );
};

const EquipmentSlotDisplay: React.FC<{ slot: EquipmentSlot; item?: InventoryItem; onClick?: () => void; }> = ({ slot, item, onClick }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    
    if (item) {
        const isDivineMythic = item.isDivineMythic === true;
        return (
            <div
                className={`relative w-full aspect-square rounded-lg border-2 border-gray-700/50 bg-gray-900/50 ${clickableClass} ${isDivineMythic ? 'divine-mythic-border' : ''}`}
                title={item.name}
                onClick={onClick}
                style={{ border: isDivineMythic ? undefined : undefined }}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                <div className="absolute top-1 right-2.5 text-sm font-bold z-10">
                    {getStarDisplay(item.stars)}
                </div>
                {item.image && <img src={item.image} alt={item.name} className="absolute object-contain p-3" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />}
                {isDivineMythic && (
                    <div 
                        className="absolute bottom-0 left-0 flex items-center justify-center bg-black/60 rounded-tr-md z-10" 
                        style={{ 
                            textShadow: '1px 1px 2px black',
                            padding: '2px 4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: '#FFD700'
                        }}
                    >
                        D
                    </div>
                )}
            </div>
        );
    } else {
        return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-lg bg-gray-900/50 border-2 border-gray-700/50" />
        );
    }
};

interface UserProfileModalProps {
  user: UserWithStatus;
  onClose: () => void;
  onViewItem: (item: InventoryItem, isOwnedByCurrentUser: boolean) => void;
  isTopmost?: boolean;
}

const StatsTab: React.FC<{ user: UserWithStatus, type: 'strategic' | 'playful' }> = ({ user, type }) => {
    const modes = type === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const stats = user.stats || {};
    
    let totalWins = 0;
    let totalLosses = 0;

    const gameStats = modes.map(m => {
        const s = stats[m.mode];
        if (s) {
            totalWins += s.wins;
            totalLosses += s.losses;
            return { mode: m.mode, ...s };
        }
        return { mode: m.mode, wins: 0, losses: 0, rankingScore: 1200 };
    });
    
    const totalGames = totalWins + totalLosses;
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

    return (
        <div className="space-y-1 text-xs">
            <div className="bg-gray-700/50 px-1.5 py-1 rounded-md text-center">
                <span className="font-bold text-gray-100">총 전적: {totalWins}승 {totalLosses}패 ({winRate}%)</span>
            </div>
            <div className="space-y-1">
                {gameStats.map(stat => {
                    const gameTotal = stat.wins + stat.losses;
                    const gameWinRate = gameTotal > 0 ? Math.round((stat.wins / gameTotal) * 100) : 0;
                    return (
                        <div key={stat.mode} className="bg-gray-900/40 rounded px-1.5 py-0.5 flex items-center justify-between gap-1.5">
                            <span className="font-semibold text-gray-200 truncate">{stat.mode}</span>
                            <span className="text-right text-gray-300 whitespace-nowrap">{stat.wins}승 {stat.losses}패 ({gameWinRate}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

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
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    // 전략 바둑 / 놀이 바둑 티어+점수. 표시 점수 = 대기실과 동일한 현재 시즌점수(1200 + 차이)
    const strategicTierInfo = useMemo(() => {
        const dr = user.dailyRankings?.strategic;
        let seasonScore: number; // 1200 기준 현재 시즌 점수 (대기실 표시와 동일)
        let rank: number;
        let totalGames = 0;
        for (const m of SPECIAL_GAME_MODES) {
            const s = user.stats?.[m.mode];
            if (s) totalGames += (s.wins || 0) + (s.losses || 0);
        }
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

    const playfulTierInfo = useMemo(() => {
        const dr = user.dailyRankings?.playful;
        let seasonScore: number;
        let rank: number;
        let totalGames = 0;
        for (const m of PLAYFUL_GAME_MODES) {
            const s = user.stats?.[m.mode];
            if (s) totalGames += (s.wins || 0) + (s.losses || 0);
        }
        if (dr && typeof dr.rank === 'number') {
            const delta = typeof dr.score === 'number' ? dr.score : 0;
            seasonScore = SEASON_BASE_SCORE + delta;
            rank = dr.rank;
        } else {
            let sum = 0;
            let count = 0;
            for (const m of PLAYFUL_GAME_MODES) {
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
    }, [user.dailyRankings?.playful, user.stats]);

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

    const combinedLevel = (user as any).strategyLevel + (user as any).playfulLevel;

    const guildInfo = useMemo(() => {
        if (!user.guildId) return null;
        return guilds[user.guildId] || null;
    }, [user.guildId, guilds]);

    const DESKTOP_WIDTH = 900;
    const MOBILE_BREAKPOINT = 768;

    const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const containerWidth = DESKTOP_WIDTH;

    return (
        <DraggableWindow title={`${user.nickname}님의 프로필`} onClose={onClose} windowId={`view-user-${user.id}`} initialWidth={containerWidth} initialHeight={800} isTopmost={isTopmost}>
            {showMbtiComparison && <MbtiComparisonModal opponentUser={user} onClose={() => setShowMbtiComparison(false)} isTopmost={true} />}
            <div className="flex flex-col md:flex-row gap-3 h-full">
                    {/* Left Column */}
                    <div className="w-full md:w-1/3 flex-shrink-0 flex flex-col gap-3">
                        <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <Avatar userId={user.id} userName={nickname} size={60} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg font-bold truncate">{nickname}</h2>
                                    {user.guildId ? (
                                        <div className="flex items-center gap-1 text-xs text-gray-300 mt-0.5">
                                            <div className="w-5 h-5 rounded-md bg-gray-900/60 border border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                                                    <img src="/images/button/guild.png" alt="길드" className="w-4 h-4 object-contain" />
                                                )}
                                            </div>
                                            <span className="font-semibold truncate">
                                                {guildInfo?.name ?? (user as any).guildName ?? '길드 소속'}
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                Lv.{guildInfo ? (guildInfo.level || 1) : ((user as any).guildLevel ?? 1)}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            길드 없음
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                                        <span>MBTI:</span>
                                        {user.mbti ? (
                                            <>
                                                <span className="font-semibold text-gray-200">{user.mbti}</span>
                                                <button
                                                    onClick={() => setShowMbtiComparison(true)}
                                                    className="px-2 py-0.5 text-[11px] font-medium rounded bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
                                                >
                                                    분석하기
                                                </button>
                                            </>
                                        ) : (
                                            <span className="font-semibold text-gray-200 flex items-center gap-1">
                                                미설정
                                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="w-full bg-gray-900/70 rounded-md p-2 mt-1 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <CombinedLevelBadge level={combinedLevel} />
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <XpBar
                                            level={(user as any).strategyLevel}
                                            currentXp={(user as any).strategyXp}
                                            label="전략"
                                            colorClass="bg-gradient-to-r from-blue-500 to-cyan-400"
                                        />
                                        <XpBar
                                            level={(user as any).playfulLevel}
                                            currentXp={(user as any).playfulXp}
                                            label="놀이"
                                            colorClass="bg-gradient-to-r from-yellow-500 to-orange-400"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => {}}
                                    className="w-full text-left rounded-md"
                                    disabled
                                    style={{ display: 'none' }}
                                />
                                <div className="mt-0.5">
                                    <div className="flex items-center justify-between text-xs text-gray-300 mb-0.5">
                                        <span className="font-semibold">매너 등급</span>
                                        <span className={`font-semibold ${mannerRank.color}`}>{totalMannerScore}점 ({mannerRank.rank})</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2 border border-gray-900">
                                        <div className={`${mannerStyle.colorClass} h-full rounded-full`} style={{ width: `${mannerStyle.percentage}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-blue-900/30 border border-blue-700/50">
                                <img src={strategicTierInfo.tier.icon} alt={strategicTierInfo.tier.name} className="w-8 h-8 flex-shrink-0" />
                                <span className="text-xs text-blue-300 font-medium">전략 바둑</span>
                                <span className={`text-sm font-semibold ml-auto ${strategicTierInfo.tier.color}`}>{strategicTierInfo.tier.name} {strategicTierInfo.score}점</span>
                            </div>
                            <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-amber-900/30 border border-amber-700/50">
                                <img src={playfulTierInfo.tier.icon} alt={playfulTierInfo.tier.name} className="w-8 h-8 flex-shrink-0" />
                                <span className="text-xs text-amber-300 font-medium">놀이 바둑</span>
                                <span className={`text-sm font-semibold ml-auto ${playfulTierInfo.tier.color}`}>{playfulTierInfo.tier.name} {playfulTierInfo.score}점</span>
                            </div>
                        </div>

                        <div className="bg-gray-800/50 rounded-lg p-3">
                            <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto mb-3">
                                <EquipmentSlotDisplay slot="fan" item={getItemForSlot('fan')} onClick={() => getItemForSlot('fan') && onViewItem(getItemForSlot('fan')!, false)} />
                                <EquipmentSlotDisplay slot="board" item={getItemForSlot('board')} onClick={() => getItemForSlot('board') && onViewItem(getItemForSlot('board')!, false)} />
                                <EquipmentSlotDisplay slot="top" item={getItemForSlot('top')} onClick={() => getItemForSlot('top') && onViewItem(getItemForSlot('top')!, false)} />
                                <EquipmentSlotDisplay slot="bottom" item={getItemForSlot('bottom')} onClick={() => getItemForSlot('bottom') && onViewItem(getItemForSlot('bottom')!, false)} />
                                <EquipmentSlotDisplay slot="bowl" item={getItemForSlot('bowl')} onClick={() => getItemForSlot('bowl') && onViewItem(getItemForSlot('bowl')!, false)} />
                                <EquipmentSlotDisplay slot="stones" item={getItemForSlot('stones')} onClick={() => getItemForSlot('stones') && onViewItem(getItemForSlot('stones')!, false)} />
                            </div>
                            <div className="border-t border-gray-700 pt-3">
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs bg-gray-900/50 p-1.5 rounded-lg justify-between">
                                    {Object.entries(totalStats).map(([stat, value]) => (
                                        <div key={stat} className="flex items-center gap-1.5 min-w-[100px]">
                                            <span className="font-semibold text-gray-300">{CORE_STATS_DATA[stat as CoreStat]?.name || stat}:</span>
                                            <span className="font-mono text-right">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {isAdminViewingOtherUser && (
                            <div className="bg-red-950/35 border border-red-500/30 rounded-lg p-3 text-xs space-y-2">
                                <div className="font-bold text-red-300">관리자 기능</div>
                                <div className="text-gray-300">
                                    접속 상태: <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>{isConnected ? '접속중' : (onlineStatus || '오프라인')}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={forceLogout} className="px-2 py-1 rounded bg-red-700 hover:bg-red-600">로그아웃 처리</button>
                                    <button type="button" onClick={() => applySanction('connection', connectionDurationMinutes)} className="px-2 py-1 rounded bg-orange-700 hover:bg-orange-600">접속금지 적용</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => applySanction('chat', chatDurationMinutes)} className="px-2 py-1 rounded bg-yellow-700 hover:bg-yellow-600">채팅금지 적용</button>
                                    <button type="button" onClick={() => liftSanction('chat')} className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600">채팅금지 해제</button>
                                </div>
                                <div>
                                    <button type="button" onClick={() => liftSanction('connection')} className="w-full px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600">접속금지 해제</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="text-gray-400">채팅금지(분)
                                        <input type="number" min={1} className="mt-1 w-full bg-black/40 rounded px-2 py-1" value={chatDurationMinutes} onChange={(e) => setChatDurationMinutes(Math.max(1, Number(e.target.value) || 1))} />
                                    </label>
                                    <label className="text-gray-400">접속금지(분)
                                        <input type="number" min={1} className="mt-1 w-full bg-black/40 rounded px-2 py-1" value={connectionDurationMinutes} onChange={(e) => setConnectionDurationMinutes(Math.max(1, Number(e.target.value) || 1))} />
                                    </label>
                                </div>
                                <div>
                                    <label className="text-gray-400">제재 사유</label>
                                    <select value={sanctionReason} onChange={(e) => setSanctionReason(e.target.value)} className="mt-1 w-full bg-black/40 rounded px-2 py-1">
                                        <option>욕설/비방</option>
                                        <option>도배/스팸</option>
                                        <option>불법 프로그램 의심</option>
                                        <option>부적절한 닉네임/프로필</option>
                                        <option>기타</option>
                                    </select>
                                    {sanctionReason === '기타' && (
                                        <textarea
                                            className="mt-2 w-full bg-black/40 rounded px-2 py-1 min-h-[54px]"
                                            placeholder="사유를 직접 입력하세요"
                                            value={sanctionReasonEtc}
                                            onChange={(e) => setSanctionReasonEtc(e.target.value)}
                                        />
                                    )}
                                </div>
                                <div className="text-gray-300">
                                    제재내역:
                                    <div className="mt-1 max-h-24 overflow-y-auto space-y-1 pr-1">
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
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="w-full md:w-2/3 flex flex-col gap-3 min-h-0">
                        <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col flex-1 min-h-0">
                            <h4 className="font-semibold mb-2 text-blue-400 text-xs flex-shrink-0">전략 전적</h4>
                            <div className="flex-1 pr-2 min-h-0">
                                <StatsTab user={user} type="strategic" />
                            </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col flex-1 min-h-0">
                            <h4 className="font-semibold mb-2 text-yellow-400 text-xs flex-shrink-0">놀이 전적</h4>
                            <div className="flex-1 pr-2 min-h-0">
                                <StatsTab user={user} type="playful" />
                            </div>
                        </div>
                    </div>
                </div>
        </DraggableWindow>
    );
};

export default UserProfileModal;