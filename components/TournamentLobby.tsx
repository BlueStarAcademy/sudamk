import React, { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { UserWithStatus, TournamentState, TournamentType, User, LeagueTier, EquipmentSlot, InventoryItem, CoreStat, ItemGrade } from '../types.js';
import { TOURNAMENT_DEFINITIONS, AVATAR_POOL, LEAGUE_DATA, BORDER_POOL, GRADE_LEVEL_REQUIREMENTS, emptySlotImages } from '../constants';
import Avatar from './Avatar.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import { useAppContext } from '../hooks/useAppContext.js';
import LeagueTierInfoModal from './LeagueTierInfoModal.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import PointsInfoPanel from './PointsInfoPanel.js';
import Button from './Button.js';
import { calculateUserEffects } from '../services/effectService.js';
import ChampionshipHelpModal from './ChampionshipHelpModal.js';
import ChampionshipPointsModal from './ChampionshipPointsModal.js';
import ChampionshipRankingPanel from './ChampionshipRankingPanel.js';
import ChampionshipVenueEntryModal from './ChampionshipVenueEntryModal.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { normalizeDungeonProgress, isStageCleared } from '../utils/championshipDungeonProgress.js';

const stringToSeed = (str: string): number => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

const seededRandom = (seed: number): number => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// WeeklyCompetitorsPanel 제거됨 - 던전 시스템으로 변경
const DungeonStageSelector: React.FC<{ dungeonType: TournamentType; currentUser: UserWithStatus; onSelectStage: (stage: number) => void }> = ({ dungeonType, currentUser, onSelectStage }) => {
    const raw = currentUser?.dungeonProgress?.[dungeonType];
    const dungeonProgress = normalizeDungeonProgress(raw || { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} });
    
    return (
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0">
            <h2 className="text-xl font-bold mb-3 border-b border-gray-700 pb-2 flex-shrink-0">
                {TOURNAMENT_DEFINITIONS[dungeonType].name} 단계 선택
            </h2>
            <div className="grid grid-cols-5 gap-2 overflow-y-auto flex-grow min-h-0">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stage => {
                    const isUnlocked = dungeonProgress.unlockedStages.includes(stage);
                    const maxUnlocked = dungeonProgress.unlockedStages.length > 0 ? Math.max(...dungeonProgress.unlockedStages) : 1;
                    const isCleared = isStageCleared(dungeonProgress.stageResults, stage, dungeonProgress.currentStage, maxUnlocked);
                    const isCurrentMax = stage === dungeonProgress.currentStage + 1;
                    
                    return (
                        <button
                            key={stage}
                            onClick={() => isUnlocked && onSelectStage(stage)}
                            disabled={!isUnlocked}
                            className={`p-3 rounded-lg text-center transition-all ${
                                isUnlocked
                                    ? isCurrentMax
                                        ? 'bg-purple-600 hover:bg-purple-700 cursor-pointer'
                                        : isCleared
                                        ? 'bg-green-800/50 hover:bg-green-700/50 cursor-pointer'
                                        : 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                                    : 'bg-gray-900/50 cursor-not-allowed opacity-50'
                            }`}
                        >
                            <div className="font-bold text-lg">{stage}단계</div>
                            {isCleared && <div className="text-xs text-green-400">✓ 클리어</div>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const WeeklyCompetitorsPanel_DEPRECATED: React.FC<{ setHasRankChanged: (changed: boolean) => void }> = ({ setHasRankChanged }) => {
    const { currentUserWithStatus, allUsers, handlers } = useAppContext();
    const prevRankRef = useRef<number | null>(null);
    const [timeLeft, setTimeLeft] = useState('');

    const [currentKstDayStart, setCurrentKstDayStart] = useState(() => {
        const KST_OFFSET = 9 * 60 * 60 * 1000;
        const now = Date.now();
        const kstNow = new Date(now + KST_OFFSET);
        return new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate()).getTime();
    });

    useEffect(() => {
        const KST_OFFSET = 9 * 60 * 60 * 1000;
        const timer = setInterval(() => {
            const now = Date.now();
            const kstNow = new Date(now + KST_OFFSET);
            const newKstDayStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate()).getTime();
            if (newKstDayStart !== currentKstDayStart) {
                setCurrentKstDayStart(newKstDayStart);
            }
        }, 1000 * 60); // Check every minute
        return () => clearInterval(timer);
    }, [currentKstDayStart]);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const daysUntilMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
            const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
            nextMonday.setHours(0, 0, 0, 0);

            const diff = nextMonday.getTime() - now.getTime();
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${d}D ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, []);

    const liveCompetitors = useMemo(() => {
        if (!currentUserWithStatus?.weeklyCompetitors) {
            return [];
        }
    
        const KST_OFFSET = 9 * 60 * 60 * 1000;
    
        const lastUpdateTs = currentUserWithStatus.lastWeeklyCompetitorsUpdate || currentKstDayStart; // Use currentKstDayStart as fallback
        
        const startOfWeek = new Date(lastUpdateTs + KST_OFFSET);
        startOfWeek.setHours(0, 0, 0, 0);

        const diffTime = Math.max(0, currentKstDayStart - startOfWeek.getTime()); // Use currentKstDayStart here
        const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
        let competitors = (currentUserWithStatus.weeklyCompetitors).map(competitor => {
            if (competitor.id.startsWith('bot-')) {
                // 서버에 저장된 봇 점수 사용
                const botScoreData = currentUserWithStatus.weeklyCompetitorsBotScores?.[competitor.id];
                const liveScore = botScoreData?.score || 0;
                // 어제 점수를 기준으로 변화량 계산 (yesterdayScore가 없으면 0으로 간주)
                const yesterdayScore = botScoreData?.yesterdayScore ?? 0;
                const scoreChange = liveScore - yesterdayScore;
                return { ...competitor, liveScore, scoreChange };
            } else {
                const liveData = allUsers.find(u => u.id === competitor.id);
                // cumulativeTournamentScore를 사용하여 일주일 동안의 모든 경기장 점수 합계 표시
                const liveScore = liveData ? (liveData.cumulativeTournamentScore || 0) : competitor.initialScore;
                // 어제 점수를 기준으로 변화량 계산
                // yesterdayTournamentScore가 있으면 그것을 사용, 없으면 dailyRankings.championship.score를 사용
                // 둘 다 없으면 현재 점수를 어제 점수로 간주 (변화 없음)
                let yesterdayScore: number;
                if (liveData?.yesterdayTournamentScore !== undefined && liveData.yesterdayTournamentScore !== null) {
                    yesterdayScore = liveData.yesterdayTournamentScore;
                } else if (liveData?.dailyRankings?.championship?.score !== undefined) {
                    yesterdayScore = liveData.dailyRankings.championship.score;
                } else {
                    // 어제 점수가 없으면 현재 점수를 어제 점수로 간주 (변화 없음)
                    yesterdayScore = liveScore;
                }
                const scoreChange = liveScore - yesterdayScore;
                return { ...competitor, liveScore, scoreChange };
            }
        });

        // Add bots if less than 16 competitors
        const NUM_COMPETITORS = 16;
        if (competitors.length < NUM_COMPETITORS) {
            const botsToAdd = NUM_COMPETITORS - competitors.length;
            for (let i = 0; i < botsToAdd; i++) {
                const botId = `bot-${currentKstDayStart}-${i}`; // Use currentKstDayStart for bot ID to make it stable for the day
                const botSeed = stringToSeed(botId);
                // 봇들은 월요일 0시에 점수가 0으로 초기화되므로 initialScore를 0으로 설정
                const botInitialScore = 0;
                const randomAvatar = AVATAR_POOL[Math.floor(seededRandom(botSeed + 1) * AVATAR_POOL.length)];
                const randomBorder = BORDER_POOL[Math.floor(seededRandom(botSeed + 2) * BORDER_POOL.length)];

                // 서버에 저장된 봇 점수 사용 (없으면 0)
                const botScoreData = currentUserWithStatus.weeklyCompetitorsBotScores?.[botId];
                const liveScore = botScoreData?.score || 0;
                // 어제 점수를 기준으로 변화량 계산 (yesterdayScore가 없으면 0으로 간주)
                const yesterdayScore = botScoreData?.yesterdayScore ?? 0;
                const scoreChange = liveScore - yesterdayScore;

                // Static list of possible bot nicknames
                const botNicknames = [
                    "바둑사랑꾼", "묘수장인", "신의한수", "돌가루", "흑백의춤",
                    "고수킬러", "초읽기", "천재기사", "바둑왕", "행마의달인",
                    "돌의속삭임", "궁극의수", "침착맨", "승률100%", "패왕", "기성", "조훈현", "이창호", "알파고"
                ];

                let assignedNickname = `Bot ${i + 1}`;
                // Assign a nickname that hasn't been taken by other bots generated in this session
                const usedBotNicknames = competitors.filter(c => c.id.startsWith('bot-')).map(c => c.nickname);
                const availableNicknames = botNicknames.filter(name => !usedBotNicknames.includes(name));
                
                if (availableNicknames.length > 0) {
                    // Use a seeded random to pick a nickname from the available ones
                    const nicknameSeed = stringToSeed(botId + 'nickname');
                    assignedNickname = availableNicknames[Math.floor(seededRandom(nicknameSeed) * availableNicknames.length)];
                } else if (botNicknames.length > 0) {
                    // If all static nicknames are used, cycle through them or append a number
                    assignedNickname = `${botNicknames[i % botNicknames.length]} ${Math.floor(Math.random() * 100)}`;
                }

                competitors.push({
                    id: botId,
                    nickname: assignedNickname,
                    avatarId: randomAvatar.id,
                    borderId: randomBorder.id,
                    initialScore: botInitialScore,
                    liveScore: liveScore,
                    scoreChange: scoreChange,
                    league: currentUserWithStatus.league, // Bots should be in the current user's league
                });
            }
        }

        return competitors.sort((a, b) => b.liveScore - a.liveScore);
    }, [currentUserWithStatus?.weeklyCompetitors, currentUserWithStatus?.lastWeeklyCompetitorsUpdate, allUsers, currentKstDayStart]);


    useEffect(() => {
        if (!currentUserWithStatus) return;
        const myRank = liveCompetitors.findIndex(c => c.id === currentUserWithStatus.id) + 1;
        if (myRank > 0) {
            if (prevRankRef.current !== null && prevRankRef.current !== myRank) {
                setHasRankChanged(true);
            }
            prevRankRef.current = myRank;
        }
    }, [liveCompetitors, currentUserWithStatus, setHasRankChanged]);

    if (!currentUserWithStatus || !currentUserWithStatus.weeklyCompetitors || currentUserWithStatus.weeklyCompetitors.length === 0) {
        return (
             <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0 items-center justify-center text-gray-500">
                주간 경쟁 상대 정보를 불러오는 중...
            </div>
        );
    }

    return (
         <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0">
            <div className="flex-shrink-0 text-center mb-3 border-b border-gray-700 pb-2">
                <h2 className="text-xl font-bold">이번주 경쟁 상대</h2>
                <p className="text-sm text-yellow-300 font-mono">{timeLeft}</p>
            </div>
            <ul className="space-y-1.5 overflow-y-auto pr-2 flex-grow min-h-0">
                {liveCompetitors.map((competitor, index) => {
                    const rank = index + 1;
                    const isCurrentUser = competitor.id === currentUserWithStatus.id;
                    const scoreChangeColor = competitor.scoreChange > 0 ? 'text-green-400' : competitor.scoreChange < 0 ? 'text-red-400' : 'text-gray-400';
                    const scoreChangeSign = competitor.scoreChange > 0 ? '▲' : competitor.scoreChange < 0 ? '▼' : '변화없음';
                    
                    const avatarUrl = AVATAR_POOL.find(a => a.id === competitor.avatarId)?.url;
                    const borderUrl = BORDER_POOL.find(b => b.id === competitor.borderId)?.url;
                    const isClickable = !isCurrentUser && !competitor.id.startsWith('bot-');

                    return (
                        <li 
                            key={competitor.id} 
                            className={`flex items-center gap-3 p-1.5 rounded-md ${isCurrentUser ? 'bg-blue-900/50' : 'bg-gray-900/50'} ${isClickable ? 'transition-colors cursor-pointer hover:bg-gray-700/50' : ''}`}
                            onClick={isClickable ? () => handlers.openViewingUser(competitor.id) : undefined}
                            title={isClickable ? `${competitor.nickname} 프로필 보기` : ''}
                        >
                            <span className="font-bold text-lg w-6 text-center flex-shrink-0">{rank}</span>
                             <Avatar userId={competitor.id} userName={competitor.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={28} />
                            <span className="flex-grow font-semibold text-sm truncate">{competitor.nickname}</span>
                            <div className="flex items-baseline gap-1 text-xs">
                                <span className="font-mono text-yellow-300">{competitor.liveScore.toLocaleString()}</span>
                                <span className={scoreChangeColor}>
                                    {competitor.scoreChange === 0 ? `(${scoreChangeSign})` : `(${scoreChangeSign}${Math.abs(competitor.scoreChange)})`}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

interface RankItemProps {
    user: User;
    rank: number;
    isMyRankDisplay: boolean;
}

const RankItem: React.FC<RankItemProps> = ({ user, rank, isMyRankDisplay }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    if (!currentUserWithStatus) return null;

    const score = user.cumulativeTournamentScore || 0;

    const rankDisplay = useMemo(() => {
        if (rank === 1) return <span className="text-3xl" role="img" aria-label="Gold Trophy">🥇</span>;
        if (rank === 2) return <span className="text-3xl" role="img" aria-label="Silver Trophy">🥈</span>;
        if (rank === 3) return <span className="text-3xl" role="img" aria-label="Bronze Trophy">🥉</span>;
        return <span className="text-2xl font-bold text-gray-300">{rank}</span>;
    }, [rank]);

    const isCurrentUserInList = !isMyRankDisplay && user.id === currentUserWithStatus.id;
    const baseClass = 'flex items-center rounded-lg';
    const myRankClass = 'bg-yellow-900/40 border border-yellow-700';
    const highlightClass = 'bg-blue-900/60 border border-blue-600';
    const defaultClass = 'bg-gray-900/50';
    
    const isClickable = !isMyRankDisplay && user.id !== currentUserWithStatus.id;
    const finalClass = `${baseClass} ${isMyRankDisplay ? myRankClass : (isCurrentUserInList ? highlightClass : defaultClass)} p-1.5 lg:p-2 ${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''}`;
    const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;

    return (
        <li
            className={finalClass}
            onClick={isClickable ? () => handlers.openViewingUser(user.id) : undefined}
            title={isClickable ? `${user.nickname} 프로필 보기` : ''}
        >
            <div className="w-12 text-center flex-shrink-0 flex flex-col items-center justify-center">
                {rankDisplay}
            </div>
            <Avatar userId={user.id} userName={user.nickname} size={32} avatarUrl={avatarUrl} borderUrl={borderUrl} />
            <div className="ml-2 lg:ml-3 flex-grow overflow-hidden">
                <p className="font-semibold text-sm truncate">{user.nickname}</p>
                <p className="text-xs text-yellow-400 font-mono">{score.toLocaleString()}점</p>
            </div>
        </li>
    );
};

// ChampionshipRankingPanel은 별도 파일에서 import

const TournamentCard: React.FC<{
    type: TournamentType;
    onClick: (stage?: number) => void;
    onContinue: () => void;
    inProgress: TournamentState | null;
    currentUser: UserWithStatus;
    compact?: boolean;
}> = ({ type, onClick, onContinue, inProgress, currentUser, compact }) => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    const hasResultToView = inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated');

    const now = Date.now();
    let playedDateKey: keyof UserWithStatus;
    let rewardClaimedKey: keyof UserWithStatus;
    switch (type) {
        case 'neighborhood':
            playedDateKey = 'lastNeighborhoodPlayedDate';
            rewardClaimedKey = 'neighborhoodRewardClaimed';
            break;
        case 'national':
            playedDateKey = 'lastNationalPlayedDate';
            rewardClaimedKey = 'nationalRewardClaimed';
            break;
        case 'world':
            playedDateKey = 'lastWorldPlayedDate';
            rewardClaimedKey = 'worldRewardClaimed';
            break;
    }
    const lastPlayedDate = currentUser[playedDateKey as keyof UserWithStatus] as number | null | undefined;
    const hasPlayedToday = lastPlayedDate && isSameDayKST(lastPlayedDate, now);
    // 하루 1회 참여: 표시용 (N/1) = 오늘 참여 횟수/1
    const playedCountToday = hasPlayedToday ? 1 : 0;
    // 오늘 경기 완료 여부 (경기를 시작했고 완료/탈락 상태인 경우)
    const isCompletedToday = Boolean(hasPlayedToday && hasResultToView);

    const rewardClaimed = currentUser[rewardClaimedKey as keyof UserWithStatus] as boolean | undefined;
    const hasUnclaimedReward = Boolean(hasResultToView && !rewardClaimed);

    const dungeonProgress = normalizeDungeonProgress(currentUser?.dungeonProgress?.[type] || {
        currentStage: 0,
        unlockedStages: [1],
        stageResults: {},
        dailyStageAttempts: {},
    });

    const isPausedInProgress = inProgress && inProgress.status === 'round_in_progress';

    const [entryModalOpen, setEntryModalOpen] = useState(false);

    const imageButtonClass = compact
        ? 'relative flex min-h-0 w-full flex-1 overflow-hidden rounded-lg bg-gray-700 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.98]'
        : 'relative flex aspect-video w-full flex-grow overflow-hidden rounded-lg bg-gray-700 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.99] group-hover:brightness-105';

    return (
        <>
            <div
                className={`group relative flex flex-col rounded-lg bg-gray-800 text-center shadow-lg transition-all hover:shadow-purple-500/30 ${compact ? 'flex h-full min-h-0 flex-col p-1' : 'h-full transform p-2 hover:-translate-y-1 sm:p-3'}`}
            >
                {hasUnclaimedReward && (
                    <div
                        className="pointer-events-none absolute right-1 top-1 z-20 h-2.5 w-2.5 rounded-full border-2 border-gray-800 bg-red-500 sm:right-1.5 sm:top-1.5 sm:h-3 sm:w-3"
                        aria-hidden
                    />
                )}
                <button
                    type="button"
                    onClick={() => setEntryModalOpen(true)}
                    className={imageButtonClass}
                    aria-label={`${definition.name} 입장 및 보상 안내`}
                >
                    <img src={definition.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/75" aria-hidden />
                    <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent px-1.5 pb-3 pt-1 sm:px-2 sm:pt-1.5">
                        <div className="flex items-start justify-between gap-1">
                            <span
                                className={`min-w-0 truncate text-left font-bold leading-tight text-white drop-shadow-md ${compact ? 'text-[10px] sm:text-[11px]' : 'text-xs sm:text-sm lg:text-base'}`}
                            >
                                {definition.name}
                            </span>
                            <div
                                className={`flex flex-shrink-0 flex-col items-end font-semibold leading-tight ${compact ? 'text-[8px] sm:text-[9px]' : 'text-[9px] sm:text-[10px]'}`}
                            >
                                {isCompletedToday ? (
                                    <span className="text-green-300">{compact ? '✓' : '✓ 완료'}</span>
                                ) : isPausedInProgress ? (
                                    <span className="text-amber-300">{compact ? '..' : '진행중'}</span>
                                ) : (
                                    <span className="text-white/95">({playedCountToday}/1)</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {dungeonProgress.currentStage > 0 && (
                        <div
                            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-3 font-semibold text-yellow-200 drop-shadow ${compact ? 'text-[8px] sm:text-[9px]' : 'text-[9px] sm:text-[10px]'}`}
                        >
                            최고 {dungeonProgress.currentStage}단계
                        </div>
                    )}
                </button>
            </div>
            <ChampionshipVenueEntryModal
                isOpen={entryModalOpen}
                onClose={() => setEntryModalOpen(false)}
                type={type}
                currentUser={currentUser}
                inProgress={inProgress}
                onEnter={stage => onClick(stage)}
                onContinue={onContinue}
            />
        </>
    );
};


const PlaceholderCard: React.FC<{ title: string; description: string; imageUrl: string; }> = ({ title, description, imageUrl }) => {
    return (
        <div className="bg-gray-800 rounded-lg p-3 flex flex-col text-center shadow-lg opacity-60 cursor-not-allowed h-full">
            <div className="w-full aspect-video bg-gray-700 rounded-md flex items-center justify-center text-gray-500 overflow-hidden">
                <img src={imageUrl} alt={title} className="w-full h-full object-cover grayscale" />
            </div>
        </div>
    );
};

const filterInProgress = (state: TournamentState | null | undefined): TournamentState | null => {
    if (!state) return null;
    // Keep completed/eliminated states to show "Result" button
    return state;
};

const gradeBackgrounds: Record<string, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
    transcendent: '/images/equipments/mythicbgi.png',
};

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-purple-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const coreStatAbbreviations: Record<CoreStat, string> = {
    [CoreStat.Concentration]: '집중',
    [CoreStat.ThinkingSpeed]: '사고',
    [CoreStat.Judgment]: '판단',
    [CoreStat.Calculation]: '계산',
    [CoreStat.CombatPower]: '전투',
    [CoreStat.Stability]: '안정',
};

const StatsDisplayPanel: React.FC<{ currentUser: UserWithStatus; isMobile?: boolean; tight?: boolean }> = ({ currentUser, isMobile = false, tight = false }) => {
    const { coreStatBonuses } = useMemo(() => calculateUserEffects(currentUser), [currentUser]);
    const gapClass = tight && isMobile ? 'gap-1' : 'gap-1 sm:gap-1.5 lg:gap-2';
    const mobileChampTight = isMobile && tight;

    return (
        <div className={`grid grid-cols-2 ${gapClass}`}>
            {Object.values(CoreStat).map(stat => {
                const baseValue = (currentUser.baseStats[stat] || 0) + (currentUser.spentStatPoints?.[stat] || 0);
                // Align with calculateTotalStats: final = floor((base + flat) * (1 + percent/100))
                const finalValue = Math.floor((baseValue + coreStatBonuses[stat].flat) * (1 + coreStatBonuses[stat].percent / 100));
                const bonus = finalValue - baseValue;
                // 숫자 자릿수에 따라 텍스트 크기 조정 (4자리 이상이면 작게)
                const valueDigits = finalValue.toString().length;
                const bonusDigits = bonus > 0 ? bonus.toString().length : 0;
                const totalDigits = valueDigits + (bonus > 0 ? bonusDigits + 4 : 0); // (+N) 포함
                
                // 4자리 이상이면 텍스트 크기를 줄임
                const getValueTextSize = () => {
                    if (mobileChampTight) {
                        return valueDigits >= 4 ? 'text-xs' : 'text-sm';
                    }
                    if (isMobile) {
                        return valueDigits >= 4 ? 'text-[10px]' : 'text-xs';
                    }
                    if (valueDigits >= 4) {
                        return 'text-[9px] sm:text-[10px]';
                    }
                    return 'text-[10px] sm:text-xs';
                };
                
                const getBonusTextSize = () => {
                    if (mobileChampTight) {
                        return totalDigits >= 8 ? 'text-[10px]' : 'text-xs';
                    }
                    if (isMobile) {
                        return totalDigits >= 7 ? 'text-[9px]' : 'text-[10px]';
                    }
                    if (totalDigits >= 7) {
                        return 'text-[8px] sm:text-[9px]';
                    }
                    return 'text-[9px] sm:text-xs';
                };
                
                const padClass = mobileChampTight ? 'px-1.5 py-1' : isMobile ? 'p-1.5' : 'p-1.5 sm:p-2';
                const rowTextClass = mobileChampTight ? 'text-sm' : isMobile ? 'text-xs' : 'text-[10px] sm:text-xs';
                const abbrevClass = mobileChampTight ? 'text-xs' : isMobile ? 'text-xs' : '';
                return (
                    <div key={stat} className={`bg-gray-700/50 ${padClass} rounded-md flex items-center justify-between ${rowTextClass}`}>
                        <span className={`font-semibold text-gray-300 whitespace-nowrap ${abbrevClass}`}>{coreStatAbbreviations[stat]}</span>
                        <span className={`font-mono font-bold whitespace-nowrap ${getValueTextSize()}`} title={`기본: ${baseValue}, 장비: ${bonus}`}>
                            {finalValue}
                            {bonus > 0 && <span className={`text-green-400 ${getBonusTextSize()} ml-0.5`}>(+{bonus})</span>}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const EquipmentSlotDisplay: React.FC<{
    slot: EquipmentSlot;
    item?: InventoryItem;
    onClick?: () => void;
    /** 작은 슬롯(별 10px) */
    compact?: boolean;
    /** compact와 일반 사이: 별 12px, 장비 아이콘 패딩 약간 축소 */
    medium?: boolean;
    className?: string;
}> = ({ slot, item, onClick, compact = false, medium = false, className = '' }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    const starFontPx = compact ? 10 : medium ? 12 : 14;
    const itemPadClass = medium ? 'p-1' : 'p-1.5';

    if (item) {
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
        const titleText = `${item.name} (착용 레벨 합: ${requiredLevel}) - 클릭하여 상세보기`;
        const starInfo = getStarDisplayInfo(item.stars);
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        return (
            <div
                className={`relative w-full aspect-square rounded-lg border-2 border-color/50 bg-tertiary/50 ${clickableClass} ${isTranscendent ? 'transcendent-grade-slot' : ''} ${className}`}
                title={titleText}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                {item.stars > 0 && (
                    <div className={`absolute top-1 right-2.5 font-bold z-10 ${starInfo.colorClass}`} style={{ textShadow: '1px 1px 2px black', fontSize: `${starFontPx}px` }}>
                        ★{item.stars}
                    </div>
                )}
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className={`absolute object-contain ${itemPadClass}`}
                        style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                    />
                )}
            </div>
        );
    } else {
         return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className={`w-full aspect-square rounded-lg bg-tertiary/50 border-2 border-color/50 ${className}`} />
        );
    }
};

const TournamentLobby: React.FC = () => {
    const { currentUserWithStatus, allUsers, handlers, waitingRoomChats, presets } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();

    /** 네이티브 상단 행(입장카드·장비·퀵메뉴) 높이: 퀵메뉴 고유 높이에 맞춤 — 퀵메뉴 버튼이 세로로 늘어나지 않도록 */
    const nativeQuickMenuMeasureRef = useRef<HTMLDivElement>(null);
    const [nativeTopRowHeightPx, setNativeTopRowHeightPx] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (!isNativeMobile || !currentUserWithStatus) return;
        const outer = nativeQuickMenuMeasureRef.current;
        if (!outer) return;
        const update = () => {
            const inner = outer.querySelector<HTMLElement>('[data-quick-access-sidebar-root]');
            if (!inner) return;
            const boxH = Math.ceil(
                Math.max(outer.getBoundingClientRect().height, outer.scrollHeight, outer.offsetHeight)
            );
            if (boxH > 0) setNativeTopRowHeightPx(boxH);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(outer);
        const innerRoot = outer.querySelector('[data-quick-access-sidebar-root]');
        if (innerRoot) ro.observe(innerRoot);
        return () => ro.disconnect();
    }, [isNativeMobile, currentUserWithStatus]);
    
    const [viewingTournament, setViewingTournament] = useState<TournamentState | null>(null);
    const [hasRankChanged, setHasRankChanged] = useState(false);
    const [enrollingIn, setEnrollingIn] = useState<TournamentType | null>(null);
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [isChampionshipHelpOpen, setIsChampionshipHelpOpen] = useState(false);
    const [isPointsInfoOpen, setIsPointsInfoOpen] = useState(false);

    if (!currentUserWithStatus) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto flex flex-col h-full relative text-gray-500 items-center justify-center min-h-0">
                로비 정보를 불러오는 중...
            </div>
        );
    }

    const neighborhoodState = filterInProgress(currentUserWithStatus.lastNeighborhoodTournament);
    const nationalState = filterInProgress(currentUserWithStatus.lastNationalTournament);
    const worldState = filterInProgress(currentUserWithStatus.lastWorldTournament);

    const handleEnterArena = useCallback(async (type: TournamentType, stage?: number | string) => {
        // select value 등에서 문자열("1")로 올 수 있으므로 숫자로 통일
        const stageNum = stage !== undefined && stage !== null
            ? (typeof stage === 'number' && !isNaN(stage) ? stage : Number(stage))
            : undefined;
        console.log('[TournamentLobby] handleEnterArena called:', { type, stage, stageNum, stageType: typeof stage });
        
        if (stageNum !== undefined && !isNaN(stageNum) && stageNum >= 1 && stageNum <= 10) {
            // 던전 단계 시작 (서버에 항상 숫자로 전달)
            const actionPayload = { dungeonType: type, stage: stageNum };
            console.log('[TournamentLobby] Starting dungeon stage with payload:', actionPayload);
            try {
                const result = await handlers.handleAction({ type: 'START_DUNGEON_STAGE', payload: actionPayload });
                console.log('[TournamentLobby] START_DUNGEON_STAGE result:', result);
                if (result && 'error' in result) {
                    console.error('[TournamentLobby] START_DUNGEON_STAGE returned error:', result.error);
                    return;
                }
                // 상태(updatedUser)가 컨텍스트에 반영된 뒤 이동 (즉시 이동 시 경기장에서 상태를 못 읽어 "단계 선택 후 입장" 안내가 나오는 현상 방지)
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        window.location.hash = `#/tournament/${type}`;
                    });
                });
            } catch (error) {
                console.error('[TournamentLobby] Failed to start dungeon stage:', error);
                throw error;
            }
        } else {
            console.log('[TournamentLobby] Starting regular tournament session (no stage provided)');
            // 기존 토너먼트 세션 시작 (호환성 유지)
            await handlers.handleAction({ type: 'START_TOURNAMENT_SESSION', payload: { type: type } });
            window.location.hash = `#/tournament/${type}`;
        }
    }, [handlers]);

    const handleContinueTournament = useCallback(async (type: TournamentType) => {
        await handlers.handleAction({ type: 'START_TOURNAMENT_ROUND', payload: { type: type } });
        window.location.hash = `#/tournament/${type}`;
    }, [handlers]);

    const equippedItems = useMemo(() => {
        if (!currentUserWithStatus?.inventory) return [];
        return currentUserWithStatus.inventory.filter(item => item.isEquipped);
    }, [currentUserWithStatus?.inventory]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        return equippedItems.find(item => item.slot === slot);
    };

    const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const presetIndex = Number(event.target.value);
        setSelectedPreset(presetIndex);
        const selectedPresetData = presets?.[presetIndex];
        // 프리셋이 있으면 적용하고, 없으면(빈 프리셋) 빈 장비 세트를 적용
        if (selectedPresetData) {
            handlers.applyPreset(selectedPresetData);
        } else if (presets) {
            handlers.applyPreset({ name: `프리셋 ${presetIndex + 1}`, equipment: {} });
        }
    };

    return (
        <div
            className={`relative flex w-full flex-col ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-0.5 pb-0.5' : 'h-full min-h-0 overflow-hidden p-4 sm:p-6 lg:p-8'}`}
        >
            {isNativeMobile ? (
                <header className="relative mb-0.5 flex min-h-9 shrink-0 items-center justify-center px-1">
                    <h1 className="pointer-events-none select-none px-14 text-center text-sm font-bold">챔피언십</h1>
                    <div className="absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => setIsPointsInfoOpen(true)}
                            className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-semibold text-slate-100 shadow-sm backdrop-blur-sm transition-transform active:scale-95 sm:text-[11px]"
                            aria-label="일일 획득 가능 점수"
                        >
                            획득 점수
                        </button>
                        <button
                            onClick={() => setIsChampionshipHelpOpen(true)}
                            className="flex h-7 w-7 items-center justify-center transition-transform hover:scale-110"
                            aria-label="도움말"
                            title="도움말"
                        >
                            <img src="/images/button/help.webp" alt="도움말" className="h-full w-full" />
                        </button>
                    </div>
                </header>
            ) : (
                <header className="mb-4 flex flex-shrink-0 items-center justify-between sm:mb-6">
                    <button
                        onClick={() => window.location.hash = '#/profile'}
                        className="transition-transform active:scale-90 filter hover:drop-shadow-lg"
                    >
                        <img src="/images/button/back.png" alt="Back" className="h-10 w-10 sm:h-12 sm:w-12" />
                    </button>
                    <div className="min-w-0 flex-1 text-center">
                        <h1 className="text-xl font-bold sm:text-2xl lg:text-4xl">챔피언십</h1>
                    </div>
                    <div className="flex shrink-0 items-center justify-center">
                        <button
                            onClick={() => setIsChampionshipHelpOpen(true)}
                            className="flex h-8 w-8 items-center justify-center transition-transform hover:scale-110 sm:h-10 sm:w-10"
                            aria-label="도움말"
                            title="도움말"
                        >
                            <img src="/images/button/help.webp" alt="도움말" className="h-full w-full" />
                        </button>
                    </div>
                </header>
            )}

            {isNativeMobile ? (
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                    {/* 상단: 경기장 입장(세로) · 장착 장비 · 퀵메뉴 — 일일 점수는 헤더「획득 점수」모달 */}
                    <div
                        className="grid min-h-0 shrink-0 grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)_5.5rem] items-stretch gap-0.5 overflow-hidden"
                        style={
                            nativeTopRowHeightPx != null
                                ? { height: `${nativeTopRowHeightPx}px`, minHeight: 0 }
                                : { minHeight: 0, maxHeight: 'min(44dvh, 90vh)' }
                        }
                    >
                        <div className="flex h-full min-h-0 min-w-0 flex-col gap-1 overflow-hidden rounded-md border border-color/40 bg-gray-800/40 p-0.5">
                            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
                                <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
                                    <TournamentCard
                                        compact
                                        type="neighborhood"
                                        onClick={(stage) => handleEnterArena('neighborhood', stage)}
                                        onContinue={() => handleContinueTournament('neighborhood')}
                                        inProgress={neighborhoodState || null}
                                        currentUser={currentUserWithStatus}
                                    />
                                </div>
                                <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
                                    <TournamentCard
                                        compact
                                        type="national"
                                        onClick={(stage) => handleEnterArena('national', stage)}
                                        onContinue={() => handleContinueTournament('national')}
                                        inProgress={nationalState || null}
                                        currentUser={currentUserWithStatus}
                                    />
                                </div>
                                <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
                                    <TournamentCard
                                        compact
                                        type="world"
                                        onClick={(stage) => handleEnterArena('world', stage)}
                                        onContinue={() => handleContinueTournament('world')}
                                        inProgress={worldState || null}
                                        currentUser={currentUserWithStatus}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-color bg-panel text-on-panel">
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1 py-1">
                                <h3 className="flex-shrink-0 text-center text-sm font-semibold leading-tight text-secondary">장착 장비</h3>
                                <div className="grid shrink-0 grid-cols-3 grid-rows-2 gap-x-0.5 gap-y-px px-0.5">
                                    {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                                        const item = getItemForSlot(slot);
                                        return (
                                            <div key={slot} className="aspect-square min-h-0 w-full min-w-0">
                                                <EquipmentSlotDisplay
                                                    slot={slot}
                                                    item={item}
                                                    medium
                                                    onClick={() => item && handlers.openViewingItem(item, true)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex shrink-0 items-center justify-center gap-1 pt-0.5">
                                    <select
                                        value={selectedPreset}
                                        onChange={handlePresetChange}
                                        className="min-w-0 flex-1 rounded border border-color bg-secondary px-1.5 py-0.5 text-sm font-semibold leading-tight"
                                    >
                                        {presets && presets.map((preset, index) => (
                                            <option key={index} value={index}>{preset.name}</option>
                                        ))}
                                    </select>
                                    <Button
                                        onClick={handlers.openEquipmentEffectsModal}
                                        colorScheme="none"
                                        className="!px-2 !py-0.5 !text-xs flex-shrink-0 justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white"
                                    >
                                        효과
                                    </Button>
                                </div>
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-color pt-0.5">
                                    <StatsDisplayPanel currentUser={currentUserWithStatus} isMobile tight />
                                </div>
                            </div>
                        </div>
                        <div
                            ref={nativeQuickMenuMeasureRef}
                            className="box-border flex h-fit min-h-0 min-w-0 flex-col self-start overflow-hidden rounded-md border border-color/50 bg-panel/95 p-0.5"
                        >
                            <QuickAccessSidebar nativeHomeColumn />
                        </div>
                    </div>

                    {/* 채팅 · 챔피언십 랭킹 */}
                    <div className="grid min-h-0 flex-1 grid-cols-2 gap-0.5 overflow-hidden">
                        <div className="min-h-0 overflow-hidden rounded-md bg-gray-800/50">
                            <ChatWindow
                                messages={waitingRoomChats.global || []}
                                mode="global"
                                onAction={handlers.handleAction}
                                onViewUser={handlers.openViewingUser}
                                locationPrefix="[챔피언십]"
                            />
                        </div>
                        <div className="min-h-0 overflow-hidden rounded-md border border-color/40 bg-panel/90 p-0.5">
                            <ChampionshipRankingPanel compact />
                        </div>
                    </div>
                </div>
            ) : (
            <div className="flex-1 flex flex-row gap-6 min-h-0 overflow-hidden">
                <main className="flex-grow flex flex-col gap-6 min-h-0 overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 flex-shrink-0">
                        <TournamentCard type="neighborhood" onClick={(stage) => handleEnterArena('neighborhood', stage)} onContinue={() => handleContinueTournament('neighborhood')} inProgress={neighborhoodState || null} currentUser={currentUserWithStatus} />
                        <TournamentCard type="national" onClick={(stage) => handleEnterArena('national', stage)} onContinue={() => handleContinueTournament('national')} inProgress={nationalState || null} currentUser={currentUserWithStatus} />
                        <TournamentCard type="world" onClick={(stage) => handleEnterArena('world', stage)} onContinue={() => handleContinueTournament('world')} inProgress={worldState || null} currentUser={currentUserWithStatus} />
                    </div>
                    
                    <div className="flex-1 flex flex-row gap-3 sm:gap-4 lg:gap-6 min-h-0 overflow-hidden">
                        <div className="w-80 flex-shrink-0 flex flex-col min-h-0 overflow-hidden">
                            <PointsInfoPanel />
                        </div>
                        <div className="flex-1 bg-gray-800/50 rounded-lg shadow-lg min-h-0 flex flex-col overflow-hidden">
                            <ChatWindow
                                messages={waitingRoomChats.global || []}
                                mode="global"
                                onAction={handlers.handleAction}
                                onViewUser={handlers.openViewingUser}
                                locationPrefix="[챔피언십]"
                            />
                        </div>
                    </div>
                </main>
                 <aside className="flex flex-col w-[380px] xl:w-[460px] flex-shrink-0 gap-3 min-h-0 overflow-hidden">
                    <div className="flex-shrink-0 flex flex-row gap-2 items-stretch">
                        <div className="flex-1 bg-panel border border-color text-on-panel rounded-lg flex flex-col overflow-hidden min-w-0">
                            <div className="w-[280px] max-w-full mx-auto flex flex-col flex-1 p-1.5">
                                <h3 className="text-center font-semibold text-secondary text-xs flex-shrink-0 mb-1">장착 장비</h3>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                                        const item = getItemForSlot(slot);
                                        return (
                                            <div key={slot} className="w-full aspect-square">
                                                <EquipmentSlotDisplay
                                                    slot={slot}
                                                    item={item}
                                                    onClick={() => item && handlers.openViewingItem(item, true)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-1 flex gap-1.5 items-center">
                                    <select
                                        value={selectedPreset}
                                        onChange={handlePresetChange}
                                        className="bg-secondary border border-color text-xs rounded-md p-0.5 focus:ring-accent focus:border-accent flex-1"
                                    >
                                        {presets && presets.map((preset, index) => (
                                            <option key={index} value={index}>{preset.name}</option>
                                        ))}
                                    </select>
                                    <Button
                                        onClick={handlers.openEquipmentEffectsModal}
                                        colorScheme="none"
                                        className="!text-[9px] !py-0.5 !px-2 flex-shrink-0 justify-center rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_8px_20px_-12px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400"
                                    >
                                        장비 효과
                                    </Button>
                                </div>
                                <div className="border-t border-color mt-1.5 pt-1.5 flex flex-col gap-1 flex-shrink-0">
                                    <h3 className="text-xs font-semibold text-secondary">능력치</h3>
                                    <StatsDisplayPanel currentUser={currentUserWithStatus} />
                                </div>
                            </div>
                        </div>
                        <div className="w-24 min-w-[96px] flex-shrink-0 ml-auto overflow-hidden">
                            <QuickAccessSidebar fillHeight={true} compact={true} />
                        </div>
                    </div>
                    
                    {/* 챔피언십 랭킹 - 더 위로 끌어올려져 세로 공간 확보 */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <ChampionshipRankingPanel />
                    </div>
                </aside>
            </div>
            )}
            {isChampionshipHelpOpen && <ChampionshipHelpModal onClose={() => setIsChampionshipHelpOpen(false)} />}
            {isPointsInfoOpen && <ChampionshipPointsModal onClose={() => setIsPointsInfoOpen(false)} isTopmost />}
        </div>
    );
};

export default TournamentLobby;
