import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { UserWithStatus, TournamentState, TournamentType, User, LeagueTier, EquipmentSlot, InventoryItem, CoreStat } from '../types.js';
import { TOURNAMENT_DEFINITIONS, AVATAR_POOL, LEAGUE_DATA, BORDER_POOL, GRADE_LEVEL_REQUIREMENTS, emptySlotImages } from '../constants';
import Avatar from './Avatar.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsMobileLayout } from '../hooks/useIsMobileLayout.js';
import LeagueTierInfoModal from './LeagueTierInfoModal.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import PointsInfoPanel from './PointsInfoPanel.js';
import Button from './Button.js';
import { calculateUserEffects } from '../services/effectService.js';
import ChampionshipHelpModal from './ChampionshipHelpModal.js';
import ChampionshipRankingPanel from './ChampionshipRankingPanel.js';

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
/** stageResults 키가 JSON 직렬화로 문자열일 수 있으므로 숫자/문자 모두로 확인. currentStage >= stage면 해당 단계를 클리어한 것으로 간주(보정). maxUnlockedStage가 있으면 그 미만 단계는 모두 클리어로 간주(5단계 열림 → 1~4단계 클리어). */
function isStageCleared(
    stageResults: Record<number, { cleared?: boolean }> | undefined,
    stage: number,
    currentStage?: number,
    maxUnlockedStage?: number
): boolean {
    const cs = currentStage != null ? Number(currentStage) : undefined;
    if (cs != null && !Number.isNaN(cs) && cs >= stage) return true;
    if (maxUnlockedStage != null && stage < maxUnlockedStage) return true; // N단계가 열려 있으면 1~N-1은 클리어로 표시
    if (!stageResults) return false;
    const entry = stageResults[stage] ?? (stageResults as Record<string, { cleared?: boolean }>)[String(stage)];
    return !!entry?.cleared;
}

/** API/저장소에서 온 dungeonProgress 정규화: currentStage 숫자화, stageResults에서 역산, unlockedStages를 currentStage 기준으로 보정 */
function normalizeDungeonProgress(
    raw: { currentStage?: number; unlockedStages?: number[]; stageResults?: Record<number | string, { cleared?: boolean }>; dailyStageAttempts?: Record<number, number> } | null | undefined
): { currentStage: number; unlockedStages: number[]; stageResults: Record<number, { cleared?: boolean }>; dailyStageAttempts: Record<number, number> } {
    const empty = { currentStage: 0, unlockedStages: [1], stageResults: {} as Record<number, { cleared?: boolean }>, dailyStageAttempts: {} as Record<number, number> };
    if (!raw) return empty;
    const currentStageNum = Number(raw.currentStage);
    const fromNumber = !Number.isNaN(currentStageNum) && currentStageNum >= 0 ? currentStageNum : 0;
    let derivedCurrent = fromNumber;
    const sr = raw.stageResults;
    if (sr && typeof sr === 'object') {
        for (let s = 1; s <= 10; s++) {
            const entry = sr[s] ?? (sr as Record<string, { cleared?: boolean }>)[String(s)];
            if (entry?.cleared) derivedCurrent = Math.max(derivedCurrent, s);
        }
    }
    const currentStage = Math.min(10, Math.max(0, derivedCurrent));
    const list = Array.isArray(raw.unlockedStages) ? raw.unlockedStages.map(Number).filter(n => !Number.isNaN(n) && n >= 1 && n <= 10) : [1];
    const upToNext = Array.from({ length: Math.min(currentStage + 1, 10) }, (_, i) => i + 1);
    const unlockedStages = [...new Set([...list, ...upToNext])].sort((a, b) => a - b);
    return {
        currentStage,
        unlockedStages,
        stageResults: (raw.stageResults as Record<number, { cleared?: boolean }>) ?? {},
        dailyStageAttempts: (raw.dailyStageAttempts as Record<number, number>) ?? {},
    };
}

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
}> = ({ type, onClick, onContinue, inProgress, currentUser }) => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    const isSimulationInProgress = inProgress && inProgress.status === 'round_in_progress';
    const hasResultToView = inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated');
    // 경기가 완료된 경우에는 계속하기 버튼을 표시하지 않음
    const isReadyToContinue = inProgress && !hasResultToView && (inProgress.status === 'bracket_ready' || inProgress.status === 'round_complete');

    // 입장 가능 횟수 계산 (남은 횟수)
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
    const isCompletedToday = hasPlayedToday && hasResultToView;

    // 보상 미수령 여부 확인 (토너먼트가 완료되었지만 보상을 받지 않은 경우)
    const rewardClaimed = currentUser[rewardClaimedKey as keyof UserWithStatus] as boolean | undefined;
    const hasUnclaimedReward = hasResultToView && !rewardClaimed;

    // 던전 진행 상태 확인 (정규화: 이전에 깬 단계 클리어 표시, currentStage 기준 언락 보정)
    const dungeonProgress = normalizeDungeonProgress(currentUser?.dungeonProgress?.[type] || {
        currentStage: 0,
        unlockedStages: [1],
        stageResults: {},
        dailyStageAttempts: {},
    });
    
    // 도전 가능한 최고 단계 계산 (언락된 단계 중 가장 높은 단계)
    const maxUnlockedStage = useMemo(() => {
        return dungeonProgress.unlockedStages.length > 0 
            ? Math.max(...dungeonProgress.unlockedStages) 
            : 1;
    }, [dungeonProgress.unlockedStages]);
    
    const [selectedStage, setSelectedStage] = useState(maxUnlockedStage);
    
    // maxUnlockedStage가 변경되면 selectedStage도 업데이트
    useEffect(() => {
        setSelectedStage(maxUnlockedStage);
    }, [maxUnlockedStage]);
    
    // 던전 타입에 따른 입장 텍스트
    const getEntryText = () => {
        switch (type) {
            case 'neighborhood':
                return '리그 입장';
            case 'national':
                return '대회 입장';
            case 'world':
                return '대회 입장';
            default:
                return '입장';
        }
    };
    
    // 경기를 실제로 시작한 경우에만 이어보기/결과 보기 표시 (bracket_ready는 입장만 한 상태)
    const hasStartedMatch = inProgress && (inProgress.status === 'round_in_progress' || inProgress.status === 'complete' || inProgress.status === 'eliminated');
    const isDungeonMode = hasStartedMatch && inProgress.currentStageAttempt !== undefined && inProgress.currentStageAttempt !== null;
    
    // 버튼 문구: 오늘 이용 완료 시 "결과보기", 던전 진행 중이면 "이어서 보기", 그 외 "입장"
    let buttonText = getEntryText();
    if (isCompletedToday) {
        buttonText = '결과보기';
    } else if (isDungeonMode && inProgress) {
        if (inProgress.status === 'complete' || inProgress.status === 'eliminated') {
            buttonText = '결과보기';
        } else {
            buttonText = '이어서 보기';
        }
    }
    
    // 버튼 클릭 시: 오늘 완료 또는 던전 진행 중이면 onContinue(경기장 진입), 아니면 단계 선택 입장
    const handleMainButtonClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isCompletedToday || (isDungeonMode && inProgress)) {
            onContinue();
        } else {
            onClick(Number(selectedStage));
        }
    };
    
    // 경기 진행 중(일시정지 가능) 상태 표시용
    const isPausedInProgress = inProgress && inProgress.status === 'round_in_progress';
    
    return (
        <div 
            className="group bg-gray-800 rounded-lg p-2 sm:p-3 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/30 h-full relative"
        >
            {/* 보상 미수령 표시: 붉은 점 */}
            {hasUnclaimedReward && (
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full z-10 border-2 border-gray-800"></div>
            )}
            <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm lg:text-lg font-bold">
                        {definition.name}
                    </h2>
                    {isCompletedToday ? (
                        <span className="text-[10px] sm:text-xs text-green-400 font-semibold flex items-center gap-0.5">
                            <span>✓</span>
                            <span>완료</span>
                        </span>
                    ) : isPausedInProgress ? (
                        <span className="text-[10px] sm:text-xs text-amber-400 font-semibold">진행중..</span>
                    ) : (
                        <span className="text-[10px] sm:text-xs text-gray-300 font-semibold">({playedCountToday}/1)</span>
                    )}
                </div>
                {dungeonProgress.currentStage > 0 && (
                    <span className="text-[10px] sm:text-xs text-yellow-400">최고 {dungeonProgress.currentStage}단계</span>
                )}
            </div>
            <div className="w-full aspect-video bg-gray-700 rounded-md flex items-center justify-center text-gray-500 overflow-hidden relative flex-grow">
                <img src={definition.image} alt={definition.name} className="w-full h-full object-cover" />
            </div>
            
            {/* 단계 설정: 입장 카드에서 선택 가능 (1~3위 시 다음 단계 열림 안내는 도움말 참고) */}
            <div className="mt-1.5 sm:mt-2 relative">
                <div className="flex flex-row gap-1 items-center">
                    <select
                        value={selectedStage}
                        onChange={(e) => setSelectedStage(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-[10px] sm:text-xs bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-purple-500 min-w-0"
                        title="진행 가능 단계 선택"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stage => {
                            const isUnlocked = dungeonProgress.unlockedStages.includes(stage);
                            const maxUnlocked = dungeonProgress.unlockedStages.length > 0 ? Math.max(...dungeonProgress.unlockedStages) : 1;
                            const isCleared = isStageCleared(dungeonProgress.stageResults, stage, dungeonProgress.currentStage, maxUnlocked);
                            return (
                                <option
                                    key={stage}
                                    value={stage}
                                    disabled={!isUnlocked}
                                    className={!isUnlocked ? 'text-gray-500' : isCleared ? 'text-green-400' : ''}
                                >
                                    {stage}단계{isCleared ? ' ✓ 클리어' : ''}{!isUnlocked ? ' (잠김)' : ''}
                                </option>
                            );
                        })}
                    </select>
                    <button
                        onClick={handleMainButtonClick}
                        className="font-bold text-[10px] sm:text-xs lg:text-sm px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors whitespace-nowrap flex-shrink-0"
                    >
                        <span className="break-words">{buttonText}</span> <span>&rarr;</span>
                    </button>
                </div>
            </div>
        </div>
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

const StatsDisplayPanel: React.FC<{ currentUser: UserWithStatus; isMobile?: boolean }> = ({ currentUser, isMobile = false }) => {
    const { coreStatBonuses } = useMemo(() => calculateUserEffects(currentUser), [currentUser]);
    
    return (
        <div className="grid grid-cols-2 gap-1 sm:gap-1.5 lg:gap-2">
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
                    if (isMobile) {
                        return valueDigits >= 4 ? 'text-[7px]' : 'text-[8px]';
                    }
                    if (valueDigits >= 4) {
                        return 'text-[9px] sm:text-[10px]';
                    }
                    return 'text-[10px] sm:text-xs';
                };
                
                const getBonusTextSize = () => {
                    if (isMobile) {
                        return totalDigits >= 7 ? 'text-[6px]' : 'text-[7px]';
                    }
                    if (totalDigits >= 7) {
                        return 'text-[8px] sm:text-[9px]';
                    }
                    return 'text-[9px] sm:text-xs';
                };
                
                return (
                    <div key={stat} className={`bg-gray-700/50 ${isMobile ? 'p-1' : 'p-1.5 sm:p-2'} rounded-md flex items-center justify-between ${isMobile ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}>
                        <span className="font-semibold text-gray-300 whitespace-nowrap">{coreStatAbbreviations[stat]}</span>
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

const EquipmentSlotDisplay: React.FC<{ slot: EquipmentSlot; item?: InventoryItem; onClick?: () => void; compact?: boolean }> = ({ slot, item, onClick, compact = false }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    
    if (item) {
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
        const titleText = `${item.name} (착용 레벨 합: ${requiredLevel}) - 클릭하여 상세보기`;
        const starInfo = getStarDisplayInfo(item.stars);
        const isDivineMythic = (item as InventoryItem & { isDivineMythic?: boolean }).isDivineMythic === true;
        return (
            <div
                className={`relative w-full aspect-square rounded-lg border-2 border-color/50 bg-tertiary/50 ${clickableClass} ${isDivineMythic ? 'divine-mythic-border' : ''}`}
                title={titleText}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                {item.stars > 0 && (
                    <div className={`absolute top-1 right-2.5 text-sm font-bold z-10 ${starInfo.colorClass}`} style={{ textShadow: '1px 1px 2px black', fontSize: compact ? '10px' : '14px' }}>
                        ★{item.stars}
                    </div>
                )}
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="absolute object-contain p-1.5"
                        style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                    />
                )}
                {isDivineMythic && (
                    <div
                        className="absolute bottom-0 left-0 flex items-center justify-center bg-black/60 rounded-tr-md z-10"
                        style={{ textShadow: '1px 1px 2px black', padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', color: '#FFD700' }}
                    >
                        D
                    </div>
                )}
            </div>
        );
    } else {
         return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-lg bg-tertiary/50 border-2 border-color/50" />
        );
    }
};

const TournamentLobby: React.FC = () => {
    const { currentUserWithStatus, allUsers, handlers, waitingRoomChats, presets } = useAppContext();
    
    const [viewingTournament, setViewingTournament] = useState<TournamentState | null>(null);
    const isMobile = useIsMobileLayout(1024);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [hasRankChanged, setHasRankChanged] = useState(false);
    const [enrollingIn, setEnrollingIn] = useState<TournamentType | null>(null);
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [isChampionshipHelpOpen, setIsChampionshipHelpOpen] = useState(false);

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

    const containerClass = isMobile
        ? 'h-full overflow-y-auto'
        : 'h-full overflow-hidden min-h-0';

    return (
        <div className={`p-4 sm:p-6 lg:p-8 w-full flex flex-col relative ${containerClass}`}>
            <header className="flex justify-between items-center mb-4 sm:mb-6 flex-shrink-0">
                <button onClick={() => window.location.hash = '#/profile'} className="transition-transform active:scale-90 filter hover:drop-shadow-lg">
                    <img src="/images/button/back.png" alt="Back" className="w-10 h-10 sm:w-12 sm:h-12" />
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold">챔피언십</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsChampionshipHelpOpen(true)}
                        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center transition-transform hover:scale-110"
                        aria-label="도움말"
                        title="도움말"
                    >
                        <img src="/images/button/help.png" alt="도움말" className="w-full h-full" />
                    </button>
                    {isMobile && (
                        <button 
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="w-11 h-12 sm:w-12 sm:h-14 flex items-center justify-center bg-gradient-to-r from-accent/90 via-accent/95 to-accent/90 backdrop-blur-sm rounded-l-xl text-white shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-accent hover:via-accent hover:to-accent hover:shadow-[0_6px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-95 transition-all duration-200 border-2 border-white/30 hover:border-white/50"
                            aria-label="메뉴 열기"
                        >
                            <span className="text-2xl sm:text-3xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{'<'}</span>
                        </button>
                    )}
                </div>
            </header>
            
            <div className={`${isMobile ? '' : 'flex-1'} flex flex-col lg:flex-row gap-6 min-h-0 ${isMobile ? '' : 'overflow-hidden'}`}>
                <main className="flex-grow flex flex-col gap-6 min-h-0 overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 flex-shrink-0">
                        <TournamentCard type="neighborhood" onClick={(stage) => handleEnterArena('neighborhood', stage)} onContinue={() => handleContinueTournament('neighborhood')} inProgress={neighborhoodState || null} currentUser={currentUserWithStatus} />
                        <TournamentCard type="national" onClick={(stage) => handleEnterArena('national', stage)} onContinue={() => handleContinueTournament('national')} inProgress={nationalState || null} currentUser={currentUserWithStatus} />
                        <TournamentCard type="world" onClick={(stage) => handleEnterArena('world', stage)} onContinue={() => handleContinueTournament('world')} inProgress={worldState || null} currentUser={currentUserWithStatus} />
                    </div>
                    
                    {/* 모바일: 장착 장비 + 능력치 + 일일 획득 가능점수 패널 */}
                    <div className="lg:hidden grid grid-cols-2 gap-3 sm:gap-4 flex-shrink-0">
                        {/* 장착 장비 + 능력치 패널 (모바일) - 홈화면과 동일 레이아웃 */}
                        <div className="bg-panel border border-color rounded-lg p-2 sm:p-3 shadow-lg min-h-0 flex flex-col overflow-hidden text-on-panel">
                            <div className="flex flex-col gap-2 h-full min-h-0">
                                {/* 장착 장비 섹션 */}
                                <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    <h3 className="text-center font-semibold text-secondary text-xs flex-shrink-0">장착 장비</h3>
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
                                            className="bg-secondary border border-color text-[9px] sm:text-xs rounded-md p-0.5 focus:ring-accent focus:border-accent flex-1"
                                        >
                                            {presets && presets.map((preset, index) => (
                                                <option key={index} value={index}>{preset.name}</option>
                                            ))}
                                        </select>
                                        <Button
                                            onClick={handlers.openEquipmentEffectsModal}
                                            colorScheme="none"
                                            className="!text-[9px] sm:!text-[10px] !py-0.5 !px-2 flex-shrink-0 justify-center rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_8px_20px_-12px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400"
                                        >
                                            장비 효과
                                        </Button>
                                    </div>
                                </div>
                                {/* 능력치 섹션 - 그 아래에 표시 */}
                                <div className="flex flex-col gap-1 flex-1 min-h-0 border-t border-color pt-1.5 mt-0.5">
                                    <h3 className="text-[10px] sm:text-xs font-semibold text-secondary flex-shrink-0">능력치</h3>
                                    <div className="flex-1 min-h-0">
                                        <StatsDisplayPanel currentUser={currentUserWithStatus} isMobile={isMobile} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* 일일 획득 가능점수 패널 (모바일) */}
                        <div className="flex flex-col min-h-0 overflow-hidden">
                            <PointsInfoPanel />
                        </div>
                    </div>
                    
                    {/* 채팅창 - 모바일에서는 아래에 */}
                    <div className={`lg:hidden flex-1 bg-gray-800/50 rounded-lg shadow-lg min-h-0 flex flex-col overflow-hidden min-h-[300px]`}>
                        <ChatWindow
                            messages={waitingRoomChats.global || []}
                            mode="global"
                            onAction={handlers.handleAction}
                            onViewUser={handlers.openViewingUser}
                            locationPrefix="[챔피언십]"
                        />
                    </div>
                    
                    {/* 데스크톱: 일일 획득 가능점수 / 채팅창 가로 배치 */}
                    <div className="hidden lg:flex flex-1 flex-row gap-3 sm:gap-4 lg:gap-6 min-h-0 overflow-hidden">
                        {/* 일일 획득 가능점수 패널 (데스크톱) */}
                        <div className="w-80 flex-shrink-0 flex flex-col min-h-0 overflow-hidden">
                            <PointsInfoPanel />
                        </div>
                        
                        {/* 채팅창 (데스크톱) */}
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
                 <aside className="hidden lg:flex flex-col lg:w-[460px] flex-shrink-0 gap-3 min-h-0 overflow-hidden">
                    {/* 상단: 장비+능력치 패널(홈화면과 동일) + 퀵메뉴 */}
                    <div className="flex-shrink-0 flex flex-row gap-2 items-stretch">
                        {/* 장비 + 능력치 패널 - 홈화면과 동일한 내용 크기, 내부 패딩으로 중앙 배치 */}
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

            {/* Mobile Sidebar - 오른쪽에서 왼쪽으로 열림 */}
            {isMobile && (
                <>
                    <div className={`fixed top-0 right-0 h-full w-[320px] sm:w-[360px] bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                        <div className="flex justify-between items-center p-2 sm:p-3 border-b border-gray-600 flex-shrink-0">
                            <h3 className="text-base sm:text-lg font-bold">메뉴</h3>
                            <button onClick={() => setIsMobileSidebarOpen(false)} className="text-xl sm:text-2xl font-bold text-gray-300 hover:text-white">×</button>
                        </div>
                        <div className="flex flex-col gap-2 p-2 flex-grow min-h-0 overflow-y-auto">
                            {/* Quick Access Sidebar - Horizontal */}
                            <div className="flex-shrink-0 p-1.5 sm:p-2 bg-gray-900/50 rounded-lg border border-gray-700">
                                <QuickAccessSidebar mobile={true} />
                            </div>
                            {/* Championship Ranking Panel */}
                            <div className="flex-1 min-h-[250px] sm:min-h-[300px] bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                                <ChampionshipRankingPanel />
                            </div>
                        </div>
                    </div>
                    {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                </>
            )}
            {isChampionshipHelpOpen && <ChampionshipHelpModal onClose={() => setIsChampionshipHelpOpen(false)} />}
        </div>
    );
};

export default TournamentLobby;
