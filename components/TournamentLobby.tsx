import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { UserWithStatus, TournamentState, TournamentType, User, LeagueTier, EquipmentSlot, InventoryItem, CoreStat, ItemGrade } from '../types.js';
import { TOURNAMENT_DEFINITIONS, AVATAR_POOL, LEAGUE_DATA, BORDER_POOL, GRADE_LEVEL_REQUIREMENTS, emptySlotImages, getDungeonStageScore } from '../constants';
import Avatar from './Avatar.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import { useAppContext } from '../hooks/useAppContext.js';
import LeagueTierInfoModal from './LeagueTierInfoModal.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from './QuickAccessSidebar.js';
import PointsInfoPanel from './PointsInfoPanel.js';
import Button from './Button.js';
import { calculateUserEffects } from '../services/effectService.js';
import ChampionshipVenueEntryModal from './ChampionshipVenueEntryModal.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { normalizeDungeonProgress, isStageCleared } from '../utils/championshipDungeonProgress.js';
import CoreStatsHexagonChart from './CoreStatsHexagonChart.js';
import DraggableWindow from './DraggableWindow.js';

/** 챔피언십 로비 패널: 경기장 배경 블러(전략/놀이 대기실과 동일 계열) */
const CHAMPIONSHIP_PANEL_GLASS =
    'backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter] [transform:translateZ(0)]';

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

/** 던전별 챔피언십 랭킹점수표(단계 선택 + 순위별 점수) — 입장 카드 우측 패널·모달 공통 */
const DungeonChampionshipRankingPointsPanel: React.FC<{
    type: TournamentType;
    currentUser: UserWithStatus;
    /** 모바일 모달 등에서 패딩·글자 크기 축소 */
    compact?: boolean;
}> = ({ type, currentUser, compact = false }) => {
    const dungeonProgress = normalizeDungeonProgress(currentUser?.dungeonProgress?.[type] || {
        currentStage: 0,
        unlockedStages: [1],
        stageResults: {},
        dailyStageAttempts: {},
    });
    const currentPointsStage = Math.min(10, Math.max(1, dungeonProgress.currentStage || 1));
    const [pointsStage, setPointsStage] = useState<number>(currentPointsStage);
    useEffect(() => {
        setPointsStage(currentPointsStage);
    }, [currentPointsStage]);

    const buildRows = () => {
        if (type === 'neighborhood') {
            return Array.from({ length: 6 }, (_, i) => ({ label: `${i + 1}위`, rank: i + 1 }));
        }
        if (type === 'national') {
            return [
                ...Array.from({ length: 4 }, (_, i) => ({ label: `${i + 1}위`, rank: i + 1 })),
                { label: '8강', rank: 8 },
            ];
        }
        return [
            ...Array.from({ length: 4 }, (_, i) => ({ label: `${i + 1}위`, rank: i + 1 })),
            { label: '8강', rank: 8 },
            { label: '16강', rank: 16 },
        ];
    };
    const rows = buildRows();
    const selClass = compact
        ? 'min-w-[4.25rem] rounded border border-amber-400/35 bg-zinc-900/85 px-1 py-0.5 text-[11px] font-semibold text-amber-100 focus:border-amber-300/70 focus:outline-none'
        : 'min-w-[5rem] rounded border border-amber-400/35 bg-zinc-900/85 px-1.5 py-0.5 text-[12px] font-semibold text-amber-100 focus:border-amber-300/70 focus:outline-none';
    const gridClass = compact ? 'grid grid-cols-3 gap-0.5' : 'grid grid-cols-3 gap-1';
    const headClass = compact
        ? 'border-b border-white/10 px-0.5 py-0.5 text-center text-[11px] font-bold'
        : 'border-b border-white/10 px-1 py-0.5 text-center text-[13px] font-bold';
    const cellClass = compact
        ? 'px-0.5 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums text-slate-100'
        : 'px-1 py-0.5 text-center font-mono text-[13px] font-semibold tabular-nums text-slate-100';

    return (
        <div className="w-full min-w-0">
            <div className={`mb-1 flex items-center justify-between gap-2 ${compact ? '' : ''}`}>
                <div className={`text-center font-semibold text-slate-200/95 ${compact ? 'text-xs' : 'text-[14px]'}`}>챔피언십 랭킹점수</div>
                <select
                    value={pointsStage}
                    onChange={(e) => setPointsStage(Number(e.target.value))}
                    className={selClass}
                    aria-label="점수 확인 단계 선택"
                >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((stage) => (
                        <option key={stage} value={stage}>
                            {stage}단계{stage === currentPointsStage ? ' (현재단계)' : ''}
                        </option>
                    ))}
                </select>
            </div>
            <div className={gridClass}>
                {rows.map(({ label, rank }) => {
                    const score = getDungeonStageScore(type, pointsStage, rank);
                    const rankTone =
                        rank === 1
                            ? 'text-yellow-300'
                            : rank === 2
                              ? 'text-slate-200'
                              : rank === 3
                                ? 'text-amber-300'
                                : 'text-slate-300';
                    return (
                        <div key={`${label}-${rank}`} className="overflow-hidden rounded-md border border-white/12 bg-black/25">
                            <div className={`${headClass} ${rankTone}`}>
                                {label}{rank <= 3 ? ' (단계상승)' : ''}
                            </div>
                            <div className={cellClass}>{score}점</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TournamentCard: React.FC<{
    type: TournamentType;
    onClick: (stage?: number) => void;
    onContinue: () => void;
    inProgress: TournamentState | null;
    currentUser: UserWithStatus;
    compact?: boolean;
    /** 채팅·랭킹 사이 가로 3열: 좁은 폭, 하단 독 이상 글자 크기 */
    compactInline?: boolean;
    /** 홈 입장버튼처럼 우측 정보 패널 결합형 */
    mergedInfoPanel?: boolean;
    /** 모바일: 우측 패널을 낮게 두고 랭킹점수표는 모달로 분리 */
    mergedInfoPanelCompact?: boolean;
    /** 모바일 로비: 입장 카드가 남는 세로 공간을 균등 분배할 때 고정 max-height 제거 */
    mergedInfoPanelStretch?: boolean;
}> = ({ type, onClick, onContinue, inProgress, currentUser, compact, compactInline, mergedInfoPanel = false, mergedInfoPanelCompact = false, mergedInfoPanelStretch = false }) => {
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

    /** 모바일 입장 카드: 오늘 아직 참여 전이면 (0/1) — 남은 일일 입장이 있을 때 */
    const hasRemainingDailyEntry =
        !isCompletedToday && !isPausedInProgress && playedCountToday === 0;
    const participationBadge = hasResultToView ? '결과 보기' : hasUnclaimedReward ? '보상 완료' : '참가 가능';
    const participationBadgeTone = hasResultToView
        ? 'border-amber-300/60 bg-amber-500/90 text-amber-950'
        : hasUnclaimedReward
          ? 'border-emerald-300/60 bg-emerald-500/90 text-emerald-950'
          : 'border-cyan-300/60 bg-cyan-500/90 text-cyan-950';

    const [entryModalOpen, setEntryModalOpen] = useState(false);
    const [rankingPointsModalOpen, setRankingPointsModalOpen] = useState(false);

    const compactInlineAccent =
        type === 'neighborhood'
            ? 'border-emerald-500/50 ring-1 ring-emerald-400/35 shadow-[0_2px_14px_rgba(16,185,129,0.18)]'
            : type === 'national'
              ? 'border-sky-500/50 ring-1 ring-sky-400/35 shadow-[0_2px_14px_rgba(56,189,248,0.18)]'
              : 'border-violet-500/50 ring-1 ring-violet-400/35 shadow-[0_2px_14px_rgba(167,139,250,0.2)]';

    const imageButtonClass = compactInline
        ? 'relative flex aspect-[2.2/1] w-full shrink-0 overflow-hidden rounded-md bg-gray-800 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 active:scale-[0.98]'
        : compact
          ? 'relative flex min-h-0 w-full flex-1 overflow-hidden rounded-lg bg-gray-700 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.98]'
          : 'relative flex aspect-video w-full flex-grow overflow-hidden rounded-lg bg-gray-700 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.99] group-hover:brightness-105';

    const titleText = compactInline
        ? 'min-w-0 truncate text-left font-bold leading-tight text-white drop-shadow-md text-[11px] sm:text-[12px]'
        : compact
          ? 'min-w-0 truncate text-left font-bold leading-tight text-white drop-shadow-md text-[10px] sm:text-[11px]'
          : 'min-w-0 truncate text-left font-bold leading-tight text-white drop-shadow-md text-xs sm:text-sm lg:text-base';

    const statusText = compactInline
        ? 'flex flex-shrink-0 flex-col items-end font-semibold leading-tight text-[11px] sm:text-[12px]'
        : compact
          ? 'flex flex-shrink-0 flex-col items-end font-semibold leading-tight text-[8px] sm:text-[9px]'
          : 'flex flex-shrink-0 flex-col items-end font-semibold leading-tight text-[9px] sm:text-[10px]';

    const stageFooter = compactInline
        ? 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/92 to-transparent px-1 pb-0.5 pt-1.5 font-semibold text-yellow-200 drop-shadow text-[10px] leading-tight sm:text-[11px]'
        : compact
          ? 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-3 font-semibold text-yellow-200 drop-shadow text-[8px] sm:text-[9px]'
          : 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-3 font-semibold text-yellow-200 drop-shadow text-[9px] sm:text-[10px]';

    const cardShellClass = `group relative flex flex-col text-center transition-all ${
        compactInline
            ? `h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit] bg-gray-900/90 p-1 ${compactInlineAccent} hover:brightness-[1.03]`
            : compact
              ? 'flex h-full min-h-0 flex-col rounded-lg bg-gray-800 p-1 shadow-lg hover:shadow-purple-500/30'
              : 'h-full transform rounded-lg bg-gray-800 p-2 shadow-lg hover:-translate-y-1 hover:shadow-purple-500/30 sm:p-3'
    }`;

    return (
        <>
            {mergedInfoPanel ? (
                mergedInfoPanelCompact ? (
                    <>
                        <div
                            className={`flex w-full overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${
                                mergedInfoPanelStretch
                                    ? 'h-full min-h-0 flex-1'
                                    : 'h-full min-h-[6.75rem] max-h-[11rem]'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => setEntryModalOpen(true)}
                                className="group relative min-h-0 min-w-0 flex-[1.45] overflow-hidden rounded-l-2xl text-left focus:outline-none"
                                aria-label={`${definition.name} 입장 및 보상 안내`}
                            >
                                <img src={definition.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                                <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                                <div
                                    className={`pointer-events-none absolute right-1.5 top-1.5 z-20 max-w-[calc(100%-0.5rem)] rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold leading-tight tracking-tight shadow-[0_4px_14px_rgba(0,0,0,0.35)] sm:right-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[11px] ${participationBadgeTone}`}
                                    aria-label={`참가 상태: ${participationBadge}`}
                                >
                                    {participationBadge}
                                </div>
                            </button>
                            <div className="flex min-h-0 min-w-0 max-w-[44%] flex-1 flex-col items-stretch justify-between border-l border-amber-200/15 bg-gradient-to-b from-zinc-900/90 to-black/84 p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-2.5">
                                <div className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-amber-300/35 bg-gradient-to-r from-amber-950/55 via-zinc-900/65 to-amber-950/55 px-1.5 py-1 text-[12px] font-black leading-tight tracking-tight text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-8px_rgba(251,191,36,0.4)] sm:text-[13px]">
                                    {definition.name}
                                </div>
                                <div className="grid w-full min-w-0 grid-cols-[minmax(3.25rem,auto)_minmax(0,1fr)] items-center gap-x-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-1 text-[11px] leading-snug sm:gap-x-2 sm:px-2 sm:py-1.5 sm:text-xs">
                                    <span className="min-w-0 text-center font-semibold text-slate-300/95">최고 단계</span>
                                    <span className="min-w-0 w-full text-center font-semibold text-slate-100/95 whitespace-normal break-keep">
                                        {dungeonProgress.currentStage > 0 ? `${dungeonProgress.currentStage}단계` : '-'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRankingPointsModalOpen(true)}
                                    className="mt-1 w-full shrink-0 rounded-lg border border-amber-400/45 bg-gradient-to-r from-amber-950/55 to-zinc-900/80 py-2 text-[11px] font-semibold text-amber-50 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-colors active:scale-[0.99] sm:py-2.5 sm:text-xs"
                                >
                                    챔피언십 랭킹점수
                                </button>
                            </div>
                        </div>
                        {rankingPointsModalOpen && (
                            <DraggableWindow
                                title={`${definition.name} — 랭킹점수`}
                                onClose={() => setRankingPointsModalOpen(false)}
                                windowId={`venue-ranking-${type}-mobile`}
                                isTopmost={true}
                                initialWidth={420}
                                initialHeight={520}
                                variant="store"
                                mobileViewportFit
                                mobileViewportMaxHeightVh={88}
                                hideFooter
                                bodyPaddingClassName="p-2"
                            >
                                <DungeonChampionshipRankingPointsPanel type={type} currentUser={currentUser} compact />
                            </DraggableWindow>
                        )}
                    </>
                ) : (
                <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                    <button
                        type="button"
                        onClick={() => setEntryModalOpen(true)}
                        className="group relative min-h-0 min-w-0 flex-[1.35] overflow-hidden rounded-l-2xl text-left focus:outline-none"
                        aria-label={`${definition.name} 입장 및 보상 안내`}
                    >
                        <img src={definition.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                        <div
                            className={`pointer-events-none absolute right-2 top-2 z-20 rounded-md border px-2 py-1 text-[11px] font-extrabold tracking-tight shadow-[0_4px_14px_rgba(0,0,0,0.35)] ${participationBadgeTone}`}
                            aria-label={`참가 상태: ${participationBadge}`}
                        >
                            {participationBadge}
                        </div>
                    </button>
                    <div className="flex min-h-0 min-w-[248px] flex-[1.08] flex-col items-stretch border-l border-amber-200/15 bg-gradient-to-b from-zinc-900/90 to-black/84 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] space-y-2.5">
                        <div className="mb-1 inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-amber-300/35 bg-gradient-to-r from-amber-950/55 via-zinc-900/65 to-amber-950/55 px-2.5 py-1.5 text-[17px] font-black tracking-tight text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-8px_rgba(251,191,36,0.4)]">
                            {definition.name}
                        </div>
                        <div className="grid w-full min-w-0 grid-cols-[minmax(5.2rem,auto)_minmax(0,1fr)] items-center gap-x-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2 text-[14px] leading-snug">
                            <span className="min-w-0 text-center font-semibold text-slate-300/95">최고 단계</span>
                            <span className="min-w-0 w-full text-center font-semibold text-slate-100/95 whitespace-normal break-keep">
                                {dungeonProgress.currentStage > 0 ? `${dungeonProgress.currentStage}단계` : '-'}
                            </span>
                        </div>
                        <div className="w-full min-w-0 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2">
                            <DungeonChampionshipRankingPointsPanel type={type} currentUser={currentUser} />
                        </div>
                    </div>
                </div>
                )
            ) : compactInline && hasRemainingDailyEntry ? (
                <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg p-[2px] shadow-[0_0_20px_-4px_rgba(251,191,36,0.35)]">
                    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]" aria-hidden>
                        <div
                            className="absolute left-1/2 top-1/2 h-[220%] min-h-[120px] w-[220%] min-w-[120px] -translate-x-1/2 -translate-y-1/2 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,rgba(251,191,36,0.2)_0deg,rgba(251,191,36,0.98)_52deg,rgba(167,139,250,0.98)_118deg,rgba(56,189,248,0.85)_188deg,rgba(251,191,36,0.2)_360deg)] [will-change:transform]"
                        />
                    </div>
                    <div className={`relative z-[1] h-full min-h-0 ${cardShellClass}`}>
                        <div
                            className={`pointer-events-none absolute right-2 top-2 z-20 rounded-md border px-2 py-1 text-[11px] font-extrabold tracking-tight shadow-[0_4px_14px_rgba(0,0,0,0.35)] ${participationBadgeTone}`}
                            aria-label={`참가 상태: ${participationBadge}`}
                        >
                            {participationBadge}
                        </div>
                        <button
                            type="button"
                            onClick={() => setEntryModalOpen(true)}
                            className={imageButtonClass}
                            aria-label={`${definition.name} 입장 및 보상 안내`}
                        >
                            <img src={definition.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/75" aria-hidden />
                            <div className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent ${compactInline ? 'px-1 pb-1.5 pt-0.5' : 'px-1.5 pb-3 pt-1 sm:px-2 sm:pt-1.5'}`}>
                                <div className="flex items-start justify-between gap-0.5">
                                    <span className={titleText}>{definition.name}</span>
                                    <div className={statusText}>
                                        {isCompletedToday ? (
                                            <span className="text-green-300">{compact || compactInline ? '✓' : '✓ 완료'}</span>
                                        ) : isPausedInProgress ? (
                                            <span className="text-amber-300">{compact || compactInline ? '..' : '진행중'}</span>
                                        ) : (
                                            <span className="text-white/95">({playedCountToday}/1)</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {dungeonProgress.currentStage > 0 && (
                                <div className={stageFooter}>최고 {dungeonProgress.currentStage}단계</div>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
            <div className={cardShellClass}>
                <div
                    className={`pointer-events-none absolute right-2 top-2 z-20 rounded-md border px-2 py-1 text-[11px] font-extrabold tracking-tight shadow-[0_4px_14px_rgba(0,0,0,0.35)] ${participationBadgeTone}`}
                    aria-label={`참가 상태: ${participationBadge}`}
                >
                    {participationBadge}
                </div>
                <button
                    type="button"
                    onClick={() => setEntryModalOpen(true)}
                    className={imageButtonClass}
                    aria-label={`${definition.name} 입장 및 보상 안내`}
                >
                    <img src={definition.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/75" aria-hidden />
                    <div className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent ${compactInline ? 'px-1 pb-1.5 pt-0.5' : 'px-1.5 pb-3 pt-1 sm:px-2 sm:pt-1.5'}`}>
                        <div className="flex items-start justify-between gap-0.5">
                            <span className={titleText}>
                                {definition.name}
                            </span>
                            <div className={statusText}>
                                {isCompletedToday ? (
                                    <span className="text-green-300">{compact || compactInline ? '✓' : '✓ 완료'}</span>
                                ) : isPausedInProgress ? (
                                    <span className="text-amber-300">{compact || compactInline ? '..' : '진행중'}</span>
                                ) : (
                                    <span className="text-white/95">({playedCountToday}/1)</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {dungeonProgress.currentStage > 0 && (
                        <div className={stageFooter}>
                            최고 {dungeonProgress.currentStage}단계
                        </div>
                    )}
                </button>
            </div>
            )}
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
    const starFontPx = compact ? 11 : medium ? 13 : 15;
    const itemPadClass = medium ? 'p-0.5' : 'p-1';

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
                        style={{ width: '86%', height: '86%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
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
    const { currentUserWithStatus, allUsers, handlers, presets } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();

    const venueLobbyPanelStyle = useMemo(
        () =>
            ({
                ['--custom-panel-bg' as string]: 'rgb(var(--bg-secondary) / 0.82)',
            }) as React.CSSProperties,
        []
    );
    const [viewingTournament, setViewingTournament] = useState<TournamentState | null>(null);
    const [hasRankChanged, setHasRankChanged] = useState(false);
    const [enrollingIn, setEnrollingIn] = useState<TournamentType | null>(null);
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [isChampionshipPresetModalOpen, setIsChampionshipPresetModalOpen] = useState(false);
    const [isAcquiredScoreModalOpen, setIsAcquiredScoreModalOpen] = useState(false);

    if (!currentUserWithStatus) {
        return (
            <div
                className="bg-lobby-shell-championship text-primary relative mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col items-center justify-center p-4 sm:p-6 lg:p-8"
                style={venueLobbyPanelStyle}
            >
                <span className="text-secondary">로비 정보를 불러오는 중...</span>
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

    const { coreStatBonuses } = useMemo(() => calculateUserEffects(currentUserWithStatus), [currentUserWithStatus]);
    const baseByStat = useMemo(() => {
        const out = {} as Record<CoreStat, number>;
        for (const stat of Object.values(CoreStat)) {
            out[stat] = (currentUserWithStatus.baseStats?.[stat] || 0) + (currentUserWithStatus.spentStatPoints?.[stat] || 0);
        }
        return out;
    }, [currentUserWithStatus]);
    const finalByStat = useMemo(() => {
        const out = {} as Record<CoreStat, number>;
        for (const stat of Object.values(CoreStat)) {
            const baseValue = baseByStat[stat] || 0;
            out[stat] = Math.floor((baseValue + coreStatBonuses[stat].flat) * (1 + coreStatBonuses[stat].percent / 100));
        }
        return out;
    }, [baseByStat, coreStatBonuses]);
    const badukAbilityTotal = useMemo(
        () => Object.values(finalByStat).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0),
        [finalByStat],
    );
    const totalPoints =
        (Math.max(0, currentUserWithStatus.strategyLevel - 1) * 2) +
        (Math.max(0, currentUserWithStatus.playfulLevel - 1) * 2) +
        (currentUserWithStatus.bonusStatPoints || 0);
    const spentPoints = Object.values(currentUserWithStatus.spentStatPoints || {}).reduce((sum, points) => sum + points, 0);
    const availablePoints = totalPoints - spentPoints;
    const combinedLevel = (currentUserWithStatus.strategyLevel || 0) + (currentUserWithStatus.playfulLevel || 0);
    const myAvatarUrl = AVATAR_POOL.find(a => a.id === currentUserWithStatus.avatarId)?.url;
    const myBorderUrl = BORDER_POOL.find(b => b.id === currentUserWithStatus.borderId)?.url;
    const championshipScore = currentUserWithStatus.cumulativeTournamentScore || currentUserWithStatus.tournamentScore || 0;
    const championshipRank = useMemo(() => {
        if (championshipScore <= 0) return null;
        const rankedByServer = currentUserWithStatus.dailyRankings?.championship?.rank;
        if (typeof rankedByServer === 'number' && rankedByServer > 0) return rankedByServer;

        const participantsMap = new Map<string, UserWithStatus>();
        for (const user of allUsers || []) {
            participantsMap.set(user.id, user);
        }
        participantsMap.set(currentUserWithStatus.id, currentUserWithStatus);

        const participants = Array.from(participantsMap.values()).filter(
            (u) => (u.cumulativeTournamentScore || u.tournamentScore || 0) > 0
        );
        if (participants.length === 0) return null;

        participants.sort((a, b) => {
            const aScore = a.cumulativeTournamentScore || a.tournamentScore || 0;
            const bScore = b.cumulativeTournamentScore || b.tournamentScore || 0;
            if (bScore !== aScore) return bScore - aScore;
            return (a.nickname || '').localeCompare(b.nickname || '', 'ko');
        });

        const idx = participants.findIndex(u => u.id === currentUserWithStatus.id);
        return idx >= 0 ? idx + 1 : null;
    }, [allUsers, currentUserWithStatus, championshipScore]);

    return (
        <div
            className={`relative flex w-full flex-col bg-lobby-shell-championship text-primary ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-0.5 pb-0.5' : 'h-full p-2 sm:p-4 lg:p-2'}`}
            style={venueLobbyPanelStyle}
        >
            {isNativeMobile ? (
                <>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[clamp(0.25rem,1.2dvh,0.5rem)] pb-[clamp(0.125rem,0.6dvh,0.25rem)]">
                    {/* 좌: 뒤로가기+타이틀 + (프로필·점수·순위 한 패널) / 우: 프리셋·획득 점수 패널 */}
                    <div className="flex min-h-0 w-full shrink-0 flex-row items-stretch gap-2">
                        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15">
                            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                            <div className="relative flex min-h-0 flex-col overflow-hidden p-2 text-on-panel">
                                <div className="relative mb-2 flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/35 bg-black/20 p-1.5">
                                    <button
                                        type="button"
                                        onClick={() => { window.location.hash = '#/profile'; }}
                                        className="relative z-[1] shrink-0 transition-transform active:scale-90 filter hover:drop-shadow-lg"
                                        aria-label="프로필로 돌아가기"
                                    >
                                        <img src="/images/button/back.png" alt="" className="h-9 w-9" />
                                    </button>
                                    <h1 className="relative z-[1] min-w-0 truncate text-left text-lg font-bold text-amber-50">챔피언십</h1>
                                </div>
                                <div className="min-h-0 overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-br from-black/35 via-zinc-950/50 to-amber-950/20 p-1.5 sm:p-2">
                                    <div className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-amber-400/25 bg-black/30 px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-2">
                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                                        {/* 프로필 · 챔피언십 점수 · 순위 — 한 줄 */}
                                        <div className="flex min-h-0 min-w-0 flex-row items-stretch gap-1.5 sm:gap-2">
                                            <div className="flex min-w-0 max-w-[min(42%,11rem)] shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-1.5 py-1 sm:gap-2 sm:px-2 sm:py-1.5">
                                                <Avatar
                                                    userId={currentUserWithStatus.id}
                                                    userName={currentUserWithStatus.nickname}
                                                    avatarUrl={myAvatarUrl}
                                                    borderUrl={myBorderUrl}
                                                    size={36}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[11px] font-extrabold tracking-tight text-amber-50 sm:text-xs">{currentUserWithStatus.nickname}</p>
                                                    <p className="mt-0.5 text-[10px] font-semibold text-amber-200/90 sm:text-[11px]">Lv.{combinedLevel}</p>
                                                </div>
                                            </div>
                                            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-lg border border-violet-300/45 bg-gradient-to-br from-violet-900/55 via-zinc-900/75 to-indigo-950/65 px-1 py-1 shadow-[0_6px_16px_-10px_rgba(99,102,241,0.45)] sm:px-1.5 sm:py-1.5">
                                                <div className="text-center text-[9px] font-black leading-none tracking-wide text-violet-100/95 sm:text-[10px]">
                                                    챔피언십
                                                </div>
                                                <div className="mt-0.5 flex min-h-[1.35rem] items-center justify-center sm:min-h-[1.5rem]">
                                                    <span className="font-mono text-sm font-black leading-none tabular-nums text-violet-50 drop-shadow-[0_0_12px_rgba(167,139,250,0.4)] sm:text-base">
                                                        {championshipScore.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-lg border border-amber-300/45 bg-gradient-to-br from-amber-900/55 via-zinc-900/75 to-orange-950/65 px-1 py-1 shadow-[0_6px_16px_-10px_rgba(245,158,11,0.45)] sm:px-1.5 sm:py-1.5">
                                                <div className="text-center text-[9px] font-black leading-none tracking-wide text-amber-50/95 sm:text-[10px]">
                                                    순위
                                                </div>
                                                <div className="mt-0.5 flex min-h-[1.35rem] items-center justify-center sm:min-h-[1.5rem]">
                                                    <span className="text-sm font-black leading-none tabular-nums text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)] sm:text-base">
                                                        {championshipRank != null ? `${championshipRank}위` : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex w-[min(7.5rem,34vw)] min-w-[6.75rem] shrink-0 flex-col">
                            <div className="relative flex h-full min-h-0 flex-1 flex-col justify-center gap-2 rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15 sm:p-3">
                                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                                <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                                <button
                                    type="button"
                                    onClick={() => setIsChampionshipPresetModalOpen(true)}
                                    className="w-full shrink-0 rounded-lg border border-indigo-400/55 bg-gradient-to-b from-indigo-900/85 to-indigo-950/90 px-2 py-2.5 text-center text-[11px] font-bold leading-snug text-indigo-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors active:scale-[0.99] sm:text-xs"
                                >
                                    프리셋 변경
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAcquiredScoreModalOpen(true)}
                                    className="w-full shrink-0 rounded-lg border border-violet-400/50 bg-gradient-to-b from-violet-900/80 to-zinc-950/90 px-2 py-2.5 text-center text-[11px] font-bold leading-snug text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors active:scale-[0.99] sm:text-xs"
                                >
                                    획득 점수
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 입장 카드 3개 — 남는 높이를 균등 분배 */}
                    <div
                        className={`flex min-h-0 w-full min-w-0 flex-1 flex-col gap-[clamp(0.375rem,1.5dvh,0.75rem)] overflow-hidden overscroll-y-contain rounded-lg border border-stone-600/40 p-[clamp(0.25rem,1dvh,0.5rem)] shadow-inner ${CHAMPIONSHIP_PANEL_GLASS} bg-stone-950/45`}
                    >
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col basis-0">
                            <TournamentCard
                                type="neighborhood"
                                onClick={(stage) => handleEnterArena('neighborhood', stage)}
                                onContinue={() => handleContinueTournament('neighborhood')}
                                inProgress={neighborhoodState || null}
                                currentUser={currentUserWithStatus}
                                mergedInfoPanel
                                mergedInfoPanelCompact
                                mergedInfoPanelStretch
                            />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col basis-0">
                            <TournamentCard
                                type="national"
                                onClick={(stage) => handleEnterArena('national', stage)}
                                onContinue={() => handleContinueTournament('national')}
                                inProgress={nationalState || null}
                                currentUser={currentUserWithStatus}
                                mergedInfoPanel
                                mergedInfoPanelCompact
                                mergedInfoPanelStretch
                            />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col basis-0">
                            <TournamentCard
                                type="world"
                                onClick={(stage) => handleEnterArena('world', stage)}
                                onContinue={() => handleContinueTournament('world')}
                                inProgress={worldState || null}
                                currentUser={currentUserWithStatus}
                                mergedInfoPanel
                                mergedInfoPanelCompact
                                mergedInfoPanelStretch
                            />
                        </div>
                    </div>
                </div>
                {isChampionshipPresetModalOpen && (
                    <DraggableWindow
                        title="프리셋 / 바둑능력"
                        onClose={() => setIsChampionshipPresetModalOpen(false)}
                        windowId="championship-preset-tournament-mobile"
                        isTopmost={true}
                        initialWidth={760}
                        initialHeight={680}
                        variant="store"
                        mobileViewportFit
                        mobileViewportMaxHeightVh={96}
                        hideFooter
                        bodyNoScroll
                        bodyPaddingClassName="p-1.5 min-h-0"
                    >
                        <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden">
                            <div className="flex min-h-0 min-w-0 flex-[1.15] flex-col overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-zinc-800 to-zinc-950 p-1.5">
                                <div className="mb-0.5 shrink-0 text-center text-[10px] font-bold tracking-wide text-amber-200">바둑능력</div>
                                <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_50px_-22px_rgba(0,0,0,0.72)] ring-1 ring-amber-100/10">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                                    <div className="relative mb-1 flex min-w-0 shrink-0 flex-col overflow-hidden rounded-lg border border-amber-600/45 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-1.5 py-1 shadow-[0_10px_32px_-14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)]">
                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" aria-hidden />
                                        <div className="relative flex min-w-0 flex-col gap-1">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                                                    <span className="bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text text-xs font-bold tracking-tight text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.25)]">
                                                        바둑능력
                                                    </span>
                                                    <span
                                                        className="bg-gradient-to-br from-yellow-50 via-amber-200 to-amber-700 bg-clip-text font-mono text-lg font-black tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
                                                        title="6개 핵심 능력치 합계"
                                                    >
                                                        {badukAbilityTotal}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center justify-between gap-1 border-t border-zinc-700/90 pt-1">
                                                <span className="min-w-0 truncate text-[10px] font-medium text-amber-100/85" title={`보너스: ${availablePoints}P`}>
                                                    보너스 <span className="font-bold tabular-nums text-emerald-300">{availablePoints}</span>
                                                    <span className="text-amber-100/55">P</span>
                                                </span>
                                                <Button
                                                    onClick={handlers.openStatAllocationModal}
                                                    colorScheme="none"
                                                    className="!shrink-0 !whitespace-nowrap !rounded-md !border !border-indigo-400/45 !bg-gradient-to-r !from-indigo-500/90 !via-violet-500/85 !to-fuchsia-500/80 !px-1.5 !py-0.5 !text-[9px] !font-semibold !text-white !shadow-[0_6px_20px_-8px_rgba(99,102,241,0.55)] hover:!brightness-110"
                                                >
                                                    분배
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                                        <CoreStatsHexagonChart
                                            values={finalByStat}
                                            baseByStat={baseByStat}
                                            className="h-full min-h-0"
                                            desktopLike
                                            mobileReadable
                                            compactModal
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-zinc-800 to-zinc-950 p-1.5">
                                <div className="mb-0.5 shrink-0 text-center text-[10px] font-bold tracking-wide text-amber-200">장착 장비 / 프리셋</div>
                                <div className="relative flex flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_40px_-20px_rgba(0,0,0,0.7)] ring-1 ring-amber-100/10">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                                    <div className="mx-auto flex w-full min-w-0 max-w-[min(220px,88vw)] flex-col">
                                        <div className="grid w-full min-w-0 grid-cols-3 grid-rows-2 gap-0.5 [&>*]:min-w-0">
                                            {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                                                const item = getItemForSlot(slot);
                                                return (
                                                    <div key={slot} className="aspect-square w-full min-w-0">
                                                        <EquipmentSlotDisplay
                                                            slot={slot}
                                                            item={item}
                                                            onClick={() => item && handlers.openViewingItem(item, true)}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-1 flex w-full min-w-0 shrink-0 items-stretch gap-1 border-t border-color/40 pt-1">
                                            <select
                                                value={selectedPreset}
                                                onChange={handlePresetChange}
                                                className="min-h-[24px] min-w-0 flex-1 rounded border border-color bg-secondary px-1 py-0.5 text-[11px] focus:border-accent focus:ring-accent"
                                            >
                                                {presets && presets.map((preset, index) => (
                                                    <option key={index} value={index}>{preset.name}</option>
                                                ))}
                                            </select>
                                            <Button
                                                onClick={handlers.openEquipmentEffectsModal}
                                                colorScheme="none"
                                                className="!shrink-0 !whitespace-nowrap !px-1.5 !py-0.5 !text-[9px] justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white"
                                            >
                                                효과
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                )}
                {isAcquiredScoreModalOpen && (
                    <DraggableWindow
                        title="일일 획득 가능 점수"
                        onClose={() => setIsAcquiredScoreModalOpen(false)}
                        windowId="championship-daily-points-mobile"
                        isTopmost={true}
                        initialWidth={420}
                        initialHeight={620}
                        variant="store"
                        mobileViewportFit
                        mobileViewportMaxHeightVh={96}
                        hideFooter
                        bodyNoScroll
                        bodyPaddingClassName="p-1.5 min-h-0"
                    >
                        <div className="flex h-full max-h-[min(88dvh,620px)] min-h-0 flex-col overflow-hidden">
                            <PointsInfoPanel variant="nativeEmbedded" lobbyGlass hideHeading arenaTabs />
                        </div>
                    </DraggableWindow>
                )}
            </>
            ) : (
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row gap-1.5 overflow-hidden">
                <div className="min-h-0 flex-1 flex flex-col gap-1.5 overflow-hidden">
                    <div className="flex min-h-0 flex-1 flex-row gap-1.5 overflow-hidden">
                    <aside className="flex h-full min-h-0 w-[min(42%,480px)] min-w-[288px] max-w-[480px] shrink-0 flex-col gap-1.5 overflow-hidden">
                        <div className="relative flex min-h-0 flex-[0.9] flex-col overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15">
                            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2.5 text-on-panel">
                                <div className="mb-2 relative flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/35 bg-black/20 p-1.5">
                                    <button
                                        onClick={() => window.location.hash = '#/profile'}
                                        className="relative z-[1] transition-transform active:scale-90 filter hover:drop-shadow-lg"
                                    >
                                        <img src="/images/button/back.png" alt="Back" className="h-10 w-10 sm:h-11 sm:w-11" />
                                    </button>
                                    <h1 className="relative z-[1] text-left text-xl font-bold sm:text-2xl lg:text-3xl">챔피언십</h1>
                                </div>
                                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-br from-black/35 via-zinc-950/50 to-amber-950/20 p-2">
                                    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-amber-400/25 bg-black/30 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                                        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                                            <Avatar
                                                userId={currentUserWithStatus.id}
                                                userName={currentUserWithStatus.nickname}
                                                avatarUrl={myAvatarUrl}
                                                borderUrl={myBorderUrl}
                                                size={54}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-base font-extrabold tracking-tight text-amber-50">{currentUserWithStatus.nickname}</p>
                                                <p className="mt-0.5 text-sm font-semibold text-amber-200/90">Lv.{combinedLevel}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2">
                                            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-violet-300/45 bg-gradient-to-br from-violet-900/55 via-zinc-900/75 to-indigo-950/65 shadow-[0_10px_24px_-12px_rgba(99,102,241,0.55)]">
                                                <div className="border-b border-violet-200/20 bg-gradient-to-r from-violet-400/35 to-indigo-500/35 px-2.5 py-1.5 text-center text-[13px] font-black tracking-wide text-violet-50">
                                                    챔피언십 점수
                                                </div>
                                                <div className="flex min-h-0 flex-1 items-center justify-center px-2.5 py-2">
                                                <span className="font-mono text-[1.9rem] font-black leading-none text-violet-100 tabular-nums drop-shadow-[0_0_20px_rgba(167,139,250,0.45)]">
                                                    {championshipScore.toLocaleString()}
                                                </span>
                                                </div>
                                            </div>
                                            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-amber-300/45 bg-gradient-to-br from-amber-900/55 via-zinc-900/75 to-orange-950/65 shadow-[0_10px_24px_-12px_rgba(245,158,11,0.55)]">
                                                <div className="border-b border-amber-200/20 bg-gradient-to-r from-amber-400/35 to-orange-500/35 px-2.5 py-1.5 text-center text-[13px] font-black tracking-wide text-amber-50">
                                                    현재 순위
                                                </div>
                                                <div className="flex min-h-0 flex-1 items-center justify-center px-2.5 py-2">
                                                <span className="text-[1.9rem] font-black leading-none text-amber-100 tabular-nums drop-shadow-[0_0_20px_rgba(251,191,36,0.45)]">
                                                    {championshipRank != null ? `${championshipRank}위` : '-'}
                                                </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={`relative flex min-h-0 flex-[0.58] flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_40px_-20px_rgba(0,0,0,0.7)] ring-1 ring-amber-100/10`}>
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                            <div className="mx-auto flex w-full min-w-0 max-w-[275px] flex-1 flex-col">
                                <div className="grid w-full min-w-0 grid-cols-3 grid-rows-2 gap-1 [&>*]:min-w-0">
                                    {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                                        const item = getItemForSlot(slot);
                                        return (
                                            <div key={slot} className="aspect-square w-full min-w-0">
                                                <EquipmentSlotDisplay
                                                    slot={slot}
                                                    item={item}
                                                    onClick={() => item && handlers.openViewingItem(item, true)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-1.5 flex w-full min-w-0 shrink-0 items-stretch gap-1 border-t border-color/40 pt-1.5">
                                    <select
                                        value={selectedPreset}
                                        onChange={handlePresetChange}
                                        className="min-h-[24px] min-w-0 flex-1 rounded border border-color bg-secondary px-1 py-0.5 text-[10px] focus:border-accent focus:ring-accent sm:text-xs"
                                    >
                                        {presets && presets.map((preset, index) => (
                                            <option key={index} value={index}>{preset.name}</option>
                                        ))}
                                    </select>
                                    <Button
                                        onClick={handlers.openEquipmentEffectsModal}
                                        colorScheme="none"
                                        className="!shrink-0 !whitespace-nowrap !px-2 !py-0.5 !text-[9px] justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white"
                                    >
                                        효과
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className={`relative flex min-h-0 flex-[0.76] flex-col overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_50px_-22px_rgba(0,0,0,0.72)] ring-1 ring-amber-100/10`}>
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/8" aria-hidden />
                            <div className="relative mb-2 flex min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-amber-600/45 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-2.5 py-2 shadow-[0_10px_32px_-14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)] sm:px-3 sm:py-2.5">
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" aria-hidden />
                                <div className="relative flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                                            <span className="bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text text-base font-bold tracking-tight text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.25)] sm:text-lg">
                                                바둑능력
                                            </span>
                                            <span
                                                className="bg-gradient-to-br from-yellow-50 via-amber-200 to-amber-700 bg-clip-text font-mono text-[1.35rem] font-black tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] sm:text-2xl"
                                                title="6개 핵심 능력치 합계"
                                            >
                                                {badukAbilityTotal}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-zinc-700/90 pt-2 sm:border-t-0 sm:pt-0">
                                        <span className="min-w-0 truncate text-xs font-medium text-amber-100/85 sm:text-sm" title={`보너스: ${availablePoints}P`}>
                                            보너스 <span className="font-bold tabular-nums text-emerald-300">{availablePoints}</span>
                                            <span className="text-amber-100/55">P</span>
                                        </span>
                                        <Button
                                            onClick={handlers.openStatAllocationModal}
                                            colorScheme="none"
                                            className="!shrink-0 !whitespace-nowrap !rounded-lg !border !border-indigo-400/45 !bg-gradient-to-r !from-indigo-500/90 !via-violet-500/85 !to-fuchsia-500/80 !px-2.5 !py-1 !text-[10px] !font-semibold !text-white !shadow-[0_6px_20px_-8px_rgba(99,102,241,0.55)] hover:!brightness-110 sm:!text-[11px]"
                                        >
                                            분배
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <CoreStatsHexagonChart
                                values={finalByStat}
                                baseByStat={baseByStat}
                                className="min-h-0 flex-1"
                            />
                        </div>
                    </aside>
                    <main className="min-h-0 flex-1 flex flex-col items-center overflow-hidden rounded-lg border border-zinc-600/80 bg-panel p-1 shadow-inner">
                        <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(100%,1120px)] flex-col justify-center">
                            <div className="grid h-full min-h-0 grid-cols-1 grid-rows-3 content-center gap-3 sm:gap-4 lg:gap-5">
                                <TournamentCard type="neighborhood" onClick={(stage) => handleEnterArena('neighborhood', stage)} onContinue={() => handleContinueTournament('neighborhood')} inProgress={neighborhoodState || null} currentUser={currentUserWithStatus} mergedInfoPanel />
                                <TournamentCard type="national" onClick={(stage) => handleEnterArena('national', stage)} onContinue={() => handleContinueTournament('national')} inProgress={nationalState || null} currentUser={currentUserWithStatus} mergedInfoPanel />
                                <TournamentCard type="world" onClick={(stage) => handleEnterArena('world', stage)} onContinue={() => handleContinueTournament('world')} inProgress={worldState || null} currentUser={currentUserWithStatus} mergedInfoPanel />
                            </div>
                        </div>
                    </main>
                    </div>
                </div>
                    <aside className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden self-stretch">
                    <div className="flex h-full min-h-0 flex-shrink-0 flex-row gap-2 items-stretch">
                        <div className={`${PC_QUICK_RAIL_COLUMN_CLASS} ml-auto overflow-hidden`}>
                            <QuickAccessSidebar fillHeight={true} compact={false} className={CHAMPIONSHIP_PANEL_GLASS} />
                        </div>
                    </div>
                </aside>
            </div>
            )}
        </div>
    );
};

export default TournamentLobby;
