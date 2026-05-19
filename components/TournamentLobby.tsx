import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { UserWithStatus, TournamentState, TournamentType, User, LeagueTier, InventoryItem, CoreStat, SpecialStat } from '../types.js';
import {
    TOURNAMENT_DEFINITIONS,
    CHAMPIONSHIP_VENUE_LOBBY_BG_IMAGE,
    CHAMPIONSHIP_PVP_VENUE_BG_WEBP,
    CHAMPIONSHIP_PET_VENUE_BG_WEBP,
    CHAMPIONSHIP_PET_PAIR_VENUE_BG_WEBP,
    AVATAR_POOL,
    LEAGUE_DATA,
    BORDER_POOL,
    getHighestDungeonStageWhereUserAvgExceedsBot,
} from '../constants';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE,
} from '../shared/constants/championshipVersusVenue.js';
import {
    computeChampionshipVersusDuelTicketStateForVenue,
    hasPersistedVersusDuelTicketsByVenue,
} from '../shared/utils/championshipVersusDuelTickets.js';
import { championshipVersusDuelVenueModeLabelKo } from '../shared/utils/championshipVersusDuelWeekLog.js';
import ChampionshipVersusDuelTicketCountdown from './ChampionshipVersusDuelTicketCountdown.js';
import Avatar from './Avatar.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import { useAppContext } from '../hooks/useAppContext.js';
import LeagueTierInfoModal from './LeagueTierInfoModal.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from './QuickAccessSidebar.js';
import { calculateUserEffects } from '../services/effectService.js';
import { computeCoreStatFinalFromBonuses } from '../shared/utils/coreStatComposition.js';
import ChampionshipVenueEntryModal from './ChampionshipVenueEntryModal.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { normalizeDungeonProgress, isStageCleared } from '../utils/championshipDungeonProgress.js';
import HomeNativeMergedEquipmentAbilityPanel from './HomeNativeMergedEquipmentAbilityPanel.js';
import { championshipKataAbilityScore } from '../shared/constants/championshipRealMatch.js';
import { specialResourceIcons } from './resourceIcons.js';
import ChampionshipShopPanel from './championship/ChampionshipShopPanel.js';
import PairPetDetailEmbedPanel from './pair/PairPetDetailEmbedPanel.js';
import PairPetHomeEmptyDetailFrame from './pair/PairPetHomeEmptyDetailFrame.js';
import { PairPetDetailFitScale } from './pair/PairPetDetailCardBody.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { getChampionshipVersusDisplayRating } from '../shared/utils/championshipVersusElo.js';
import { getSeasonalRankingTierName, RANKING_TIERS } from '../shared/constants/ranking.js';
import { RANKED_ELO_BASE_SCORE } from '../shared/constants/rules.js';
import { resolvePublicUrl } from '../utils/publicAssetUrl.js';
import ChampionshipVersusDuelHistoryModal from './ChampionshipVersusDuelHistoryModal.js';

/** 챔피언십 로비 패널: 경기장 배경 블러(전략/놀이 대기실과 동일 계열) */
const CHAMPIONSHIP_PANEL_GLASS =
    'backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter] [transform:translateZ(0)]';

/** 프로필 홈 경기장 그리드(`Profile.tsx` lobbyGridShell)와 동일 — 2열 동일 폭·3행 동일 높이 */
const CHAMPIONSHIP_ENTRY_GRID_DESKTOP_HOME_MATCH =
    'grid h-full min-h-0 w-full content-center grid-cols-2 grid-rows-[repeat(3,minmax(0,15rem))] gap-2.5 overflow-hidden lg:grid-rows-[repeat(3,minmax(0,17.5rem))] lg:gap-3 [&>*]:min-h-0 [&>*]:min-w-0';

/** 네이티브 모바일 챔피언십: 입장 카드 16:9 유지, 영역 안에서 세로 스크롤 */
const CHAMPIONSHIP_ENTRY_STACK_NATIVE_SCROLL =
    'flex w-full min-w-0 flex-col gap-[clamp(0.35rem,1.4dvh,0.65rem)] pb-1';
const CORE_STAT_CAP = 1500;

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
                const liveScore = liveData ? liveData.tournamentScore || 0 : competitor.initialScore;
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

    const score = user.tournamentScore || 0;

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

type ChampionshipVersusLobbyKind = 'pvp' | 'pet' | 'petpair';

const CHAMPIONSHIP_VERSUS_LOBBY_META: Record<
    ChampionshipVersusLobbyKind,
    {
        title: string;
        image: string;
        ticketImage: string;
        ring: string;
        border: string;
        panelFrom: string;
        chip: string;
        chipText: string;
    }
> = {
    pvp: {
        title: championshipVersusDuelVenueModeLabelKo('pvp'),
        image: CHAMPIONSHIP_PVP_VENUE_BG_WEBP,
        ticketImage: CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE.pvp,
        ring: 'ring-white/10',
        border: 'border-slate-500/45',
        panelFrom: 'from-zinc-900/90',
        chip: 'border-slate-400/35 bg-gradient-to-r from-slate-900/70 via-zinc-900/65 to-slate-900/70',
        chipText: 'text-slate-100',
    },
    pet: {
        title: championshipVersusDuelVenueModeLabelKo('pet'),
        image: CHAMPIONSHIP_PET_VENUE_BG_WEBP,
        ticketImage: CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE.pet,
        ring: 'ring-fuchsia-200/10',
        border: 'border-fuchsia-500/45',
        panelFrom: 'from-violet-950/90',
        chip: 'border-fuchsia-400/40 bg-gradient-to-r from-violet-900/75 via-purple-900/70 to-violet-900/75',
        chipText: 'text-fuchsia-50',
    },
    petpair: {
        title: championshipVersusDuelVenueModeLabelKo('petpair'),
        image: CHAMPIONSHIP_PET_PAIR_VENUE_BG_WEBP,
        ticketImage: CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE.petpair,
        ring: 'ring-sky-200/10',
        border: 'border-sky-500/45',
        panelFrom: 'from-cyan-950/90',
        chip: 'border-sky-400/40 bg-gradient-to-r from-cyan-900/75 via-sky-900/70 to-cyan-900/75',
        chipText: 'text-sky-50',
    },
};

type VersusLobbyMeta = (typeof CHAMPIONSHIP_VERSUS_LOBBY_META)['pvp'];

/** 챔피언십 대전장 입장 카드 우측: 티어·ELO·전적(승률)·입장권 — 유저/펫/페어 공통 */
function ChampionshipVersusLobbyCardRightStats(props: {
    compact: boolean;
    meta: VersusLobbyMeta;
    versusRating: number;
    tierName: string;
    tierIconUrl: string;
    wins: number;
    losses: number;
    duelTickets: number;
    duelTicketNextAt?: number;
}) {
    const { compact, meta, versusRating, tierName, tierIconUrl, wins, losses, duelTickets, duelTicketNextAt } = props;
    const seasonGames = wins + losses;
    const winPct = seasonGames > 0 ? Math.round((100 * wins) / seasonGames) : 0;

    if (compact) {
        return (
            <>
                <div className="mt-1.5 flex w-full flex-col items-center rounded-lg border border-white/[0.09] bg-gradient-to-br from-white/[0.06] via-black/35 to-black/55 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-white/[0.05]">
                    <div className="flex flex-col items-center">
                        <img
                            src={resolvePublicUrl(tierIconUrl)}
                            alt=""
                            className="h-8 w-8 object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:h-9 sm:w-9"
                        />
                        <p className="mt-1 max-w-full truncate text-center text-[8px] font-semibold leading-tight tracking-wide text-slate-400/95 sm:text-[9px]">
                            {tierName}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-center text-base font-black tabular-nums leading-none text-white drop-shadow-sm sm:text-lg">
                            {versusRating}
                        </p>
                    </div>
                </div>
                <p className="mt-1.5 text-center text-[10px] font-bold leading-snug text-slate-200/95 sm:text-[11px]">
                    시즌 전적{' '}
                    <span className="font-black tabular-nums text-white">
                        {wins}승 {losses}패
                    </span>
                    <span className="font-black tabular-nums text-amber-200/90"> ({winPct}%)</span>
                </p>
                <div className="mt-1.5 flex w-full min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-0 rounded-full border border-amber-400/25 bg-gradient-to-r from-amber-500/14 via-amber-950/25 to-black/40 px-2 py-1 shadow-inner ring-1 ring-inset ring-amber-300/10">
                    <img
                        src={meta.ticketImage}
                        alt=""
                        className="h-3.5 w-auto max-w-[1.35rem] shrink-0 object-contain opacity-95 sm:h-4"
                        loading="lazy"
                        decoding="async"
                    />
                    <span className="shrink-0 text-[10px] font-black tabular-nums tracking-wide text-amber-50 sm:text-[11px]">
                        {duelTickets}/{CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                    </span>
                    <ChampionshipVersusDuelTicketCountdown
                        current={duelTickets}
                        max={CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                        nextAt={duelTicketNextAt}
                        className="shrink-0 text-[9px] font-mono font-bold tabular-nums text-amber-200/90 sm:text-[10px]"
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <div className="mb-2 flex w-full max-w-[16rem] flex-col items-center rounded-xl border border-white/[0.1] bg-gradient-to-br from-white/[0.07] via-slate-950/55 to-black/60 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_-18px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-amber-400/12">
                <div className="flex flex-col items-center">
                    <img
                        src={resolvePublicUrl(tierIconUrl)}
                        alt=""
                        className="h-12 w-12 object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)] sm:h-[3.25rem] sm:w-[3.25rem]"
                    />
                    <p className="mt-1.5 max-w-full truncate px-1 text-center text-[10px] font-semibold leading-tight tracking-wide text-slate-400 sm:text-[11px]">
                        {tierName}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-center text-2xl font-black tabular-nums leading-none text-white drop-shadow-sm sm:text-3xl">
                        {versusRating}
                    </p>
                </div>
            </div>
            <p className="text-center text-sm font-bold leading-snug text-slate-200">
                시즌 전적{' '}
                <span className="font-black tabular-nums text-white">
                    {wins}승 {losses}패
                </span>
                <span className="font-black tabular-nums text-amber-200/95"> ({winPct}%)</span>
            </p>
            <div className="mt-2 flex w-full max-w-[16rem] min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/18 via-amber-950/35 to-black/45 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-300/12">
                <img
                    src={meta.ticketImage}
                    alt=""
                    className="h-4 w-auto max-w-[1.5rem] shrink-0 object-contain opacity-95 sm:h-[1.125rem]"
                    loading="lazy"
                    decoding="async"
                />
                <span className="shrink-0 text-sm font-black tabular-nums tracking-wide text-amber-50">
                    {duelTickets}/{CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                </span>
                <ChampionshipVersusDuelTicketCountdown
                    current={duelTickets}
                    max={CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                    nextAt={duelTicketNextAt}
                    className="shrink-0 text-[11px] font-mono font-bold tabular-nums text-amber-200/90 sm:text-xs"
                />
            </div>
        </>
    );
}

const ChampionshipVersusLobbyCard: React.FC<{
    kind: ChampionshipVersusLobbyKind;
    compactMerged: boolean;
    mergedInfoPanelStretch?: boolean;
    fillLobbyGridCell?: boolean;
}> = ({ kind, compactMerged, mergedInfoPanelStretch = false, fillLobbyGridCell = false }) => {
    const { currentUserWithStatus } = useAppContext();
    const meta = CHAMPIONSHIP_VERSUS_LOBBY_META[kind];
    const ratingEntry = currentUserWithStatus?.championshipVersusVenueRatings?.[kind];
    const wins = Math.max(0, Math.floor(Number(ratingEntry?.seasonWins) || 0));
    const losses = Math.max(0, Math.floor(Number(ratingEntry?.seasonLosses) || 0));
    const seasonGames = wins + losses;
    const versusRating = useMemo(() => {
        if (!currentUserWithStatus) return RANKED_ELO_BASE_SCORE;
        return getChampionshipVersusDisplayRating(currentUserWithStatus, kind, Date.now());
    }, [currentUserWithStatus, kind, ratingEntry?.rating, ratingEntry?.seasonWins, ratingEntry?.seasonLosses]);
    const tierName = useMemo(
        () => getSeasonalRankingTierName(versusRating, 999_999, seasonGames),
        [versusRating, seasonGames],
    );
    const tierIconUrl = useMemo(() => {
        const t = RANKING_TIERS.find((x) => x.name === tierName) ?? RANKING_TIERS[RANKING_TIERS.length - 1]!;
        return t.icon;
    }, [tierName]);
    const [duelTicketUiTick, setDuelTicketUiTick] = useState(0);
    const duelTicketState = useMemo(() => {
        if (!currentUserWithStatus) {
            return { tickets: CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX, nextAt: undefined as number | undefined };
        }
        return computeChampionshipVersusDuelTicketStateForVenue(currentUserWithStatus, kind, Date.now());
    }, [
        currentUserWithStatus,
        kind,
        currentUserWithStatus?.championshipVersusDuelTicketsByVenue,
        currentUserWithStatus?.championshipVersusDuelTickets,
        currentUserWithStatus?.championshipVersusDuelTicketNextAtByVenue,
        currentUserWithStatus?.championshipVersusDuelTicketNextAt,
        duelTicketUiTick,
    ]);
    const duelTickets = duelTicketState.tickets;
    const duelTicketNextAt = duelTicketState.nextAt;
    useEffect(() => {
        if (!currentUserWithStatus || duelTickets >= CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX) return;
        const id = window.setInterval(() => setDuelTicketUiTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, [currentUserWithStatus, duelTickets, duelTicketNextAt, kind]);
    const go = () => {
        window.location.hash = `#/tournament/${kind}`;
    };
    const shell = `flex w-full cursor-pointer overflow-hidden rounded-2xl border ${meta.border} bg-gradient-to-br from-slate-950 via-slate-950 to-black shadow-[0_22px_48px_-20px_rgba(0,0,0,0.92),0_0_0_1px_rgba(255,255,255,0.04)] ring-1 ${meta.ring} transition-[transform,box-shadow] duration-200 hover:shadow-[0_26px_56px_-18px_rgba(0,0,0,0.88)] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60`;

    if (compactMerged) {
        return (
            <button
                type="button"
                onClick={go}
                className={`${shell} ${
                    mergedInfoPanelStretch
                        ? fillLobbyGridCell
                            ? 'h-full min-h-0 w-full min-w-0 shrink-0 text-left'
                            : 'aspect-video max-h-full min-h-0 w-full shrink-0 text-left'
                        : 'h-full min-h-[5rem] max-h-[7.85rem] text-left'
                }`}
            >
                <div className="relative min-h-0 min-w-0 flex-[1.58] overflow-hidden rounded-l-2xl bg-slate-950/90">
                    <img src={meta.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-88" />
                    <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-gradient-to-b from-black/55 via-black/20 to-black/78" />
                </div>
                <div
                    className={`relative flex min-h-0 min-w-0 max-w-[42%] flex-1 flex-col items-stretch justify-center overflow-hidden border-l border-white/10 ${meta.panelFrom} to-black/88 p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent sm:p-2.5`}
                >
                    <div
                        className={`relative inline-flex w-full shrink-0 items-center justify-center rounded-lg border px-1.5 py-1 text-[12px] font-black leading-tight tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-10px_rgba(0,0,0,0.65)] sm:text-[13px] ${meta.chip} ${meta.chipText}`}
                    >
                        {meta.title}
                    </div>
                    <ChampionshipVersusLobbyCardRightStats
                        compact
                        meta={meta}
                        versusRating={versusRating}
                        tierName={tierName}
                        tierIconUrl={tierIconUrl}
                        wins={wins}
                        losses={losses}
                        duelTickets={duelTickets}
                        duelTicketNextAt={duelTicketNextAt}
                    />
                </div>
            </button>
        );
    }
    return (
        <button type="button" onClick={go} className={`${shell} ${fillLobbyGridCell ? 'h-full min-h-0 text-left' : 'aspect-[2.08/1] max-h-full min-h-0 text-left'}`}>
            <div className="relative min-h-0 min-w-0 flex-[1.52] overflow-hidden rounded-l-2xl bg-slate-950/90">
                <img src={meta.image} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-90" />
                <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-gradient-to-b from-black/50 via-black/15 to-black/72" />
            </div>
            <div
                className={`relative flex min-h-0 min-w-[200px] flex-[1.08] flex-col items-center justify-center overflow-hidden border-l border-white/10 ${meta.panelFrom} to-black/88 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent`}
            >
                <div
                    className={`relative mb-2 inline-flex w-full max-w-[16rem] items-center justify-center rounded-xl border px-3 py-2 text-[17px] font-black tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_28px_-14px_rgba(0,0,0,0.7)] ${meta.chip} ${meta.chipText}`}
                >
                    {meta.title}
                </div>
                <ChampionshipVersusLobbyCardRightStats
                    compact={false}
                    meta={meta}
                    versusRating={versusRating}
                    tierName={tierName}
                    tierIconUrl={tierIconUrl}
                    wins={wins}
                    losses={losses}
                    duelTickets={duelTickets}
                    duelTicketNextAt={duelTicketNextAt}
                />
            </div>
        </button>
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
    /** 2×3 데스크톱·탭·네이티브 균등 행: 카드가 aspect 대신 셀 높이를 채움 */
    fillLobbyGridCell?: boolean;
    /** 6코어 최종 능력치 산술평균(장비 반영). 모바일 입장카드 추천 단계 표시용 */
    userDungeonCoreStatAverage?: number;
}> = ({
    type,
    onClick,
    onContinue,
    inProgress,
    currentUser,
    compact,
    compactInline,
    mergedInfoPanel = false,
    mergedInfoPanelCompact = false,
    mergedInfoPanelStretch = false,
    fillLobbyGridCell = false,
    userDungeonCoreStatAverage,
}) => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    const lobbyVenueBg = CHAMPIONSHIP_VENUE_LOBBY_BG_IMAGE[type];
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

    const recommendedDungeonStage = useMemo(() => {
        if (userDungeonCoreStatAverage == null || !Number.isFinite(userDungeonCoreStatAverage)) return null;
        return getHighestDungeonStageWhereUserAvgExceedsBot(userDungeonCoreStatAverage);
    }, [userDungeonCoreStatAverage]);

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

    const compactInlineAccent =
        type === 'neighborhood'
            ? 'border-emerald-500/50 ring-1 ring-emerald-400/35 shadow-[0_2px_14px_rgba(16,185,129,0.18)]'
            : type === 'national'
              ? 'border-sky-500/50 ring-1 ring-sky-400/35 shadow-[0_2px_14px_rgba(56,189,248,0.18)]'
              : 'border-violet-500/50 ring-1 ring-violet-400/35 shadow-[0_2px_14px_rgba(167,139,250,0.2)]';

    const imageButtonClass = compactInline
        ? 'relative flex aspect-[2.65/1] w-full shrink-0 overflow-hidden rounded-md bg-gray-800 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 active:scale-[0.98]'
        : compact
          ? 'relative flex min-h-0 w-full flex-1 overflow-hidden rounded-lg bg-gray-700 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.98]'
          : 'relative flex aspect-[2.12/1] w-full flex-grow overflow-hidden rounded-lg bg-gray-700 ring-0 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.99] group-hover:brightness-105';

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
                                    ? fillLobbyGridCell
                                        ? 'h-full min-h-0 w-full min-w-0 shrink-0'
                                        : 'aspect-video max-h-full min-h-0 w-full shrink-0'
                                    : 'h-full min-h-[5rem] max-h-[7.85rem]'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => setEntryModalOpen(true)}
                                className="group relative min-h-0 min-w-0 flex-[1.58] overflow-hidden rounded-l-2xl text-left focus:outline-none"
                                aria-label={`${definition.name} 입장 및 보상 안내`}
                            >
                                <img src={lobbyVenueBg} alt="" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                                <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                                <div
                                    className={`pointer-events-none absolute right-1.5 top-1.5 z-20 max-w-[calc(100%-0.5rem)] rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold leading-tight tracking-tight shadow-[0_4px_14px_rgba(0,0,0,0.35)] sm:right-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[11px] ${participationBadgeTone}`}
                                    aria-label={`참가 상태: ${participationBadge}`}
                                >
                                    {participationBadge}
                                </div>
                            </button>
                            <div className="flex min-h-0 min-w-0 max-w-[42%] flex-1 flex-col items-stretch border-l border-amber-200/15 bg-gradient-to-b from-zinc-900/90 to-black/84 p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-2.5">
                                <div className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-amber-300/35 bg-gradient-to-r from-amber-950/55 via-zinc-900/65 to-amber-950/55 px-1.5 py-1 text-[12px] font-black leading-tight tracking-tight text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-8px_rgba(251,191,36,0.4)] sm:text-[13px]">
                                    {definition.name}
                                </div>
                                <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 py-0.5">
                                    <div className="grid w-full min-w-0 grid-cols-[minmax(3.25rem,auto)_minmax(0,1fr)] items-center gap-x-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-1 text-[11px] leading-snug sm:gap-x-2 sm:px-2 sm:py-1.5 sm:text-xs">
                                        <span className="min-w-0 text-center font-semibold text-slate-300/95">최고 단계</span>
                                        <span className="min-w-0 w-full text-center font-semibold text-slate-100/95 whitespace-normal break-keep">
                                            {dungeonProgress.currentStage > 0 ? `${dungeonProgress.currentStage}단계` : '-'}
                                        </span>
                                    </div>
                                    <div className="grid w-full min-w-0 grid-cols-[minmax(3.25rem,auto)_minmax(0,1fr)] items-center gap-x-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-1 text-[11px] leading-snug sm:gap-x-2 sm:px-2 sm:py-1.5 sm:text-xs">
                                        <span className="min-w-0 text-center font-semibold text-slate-300/95">추천 단계</span>
                                        <span className="min-w-0 w-full text-center font-semibold text-emerald-200/95 whitespace-normal break-keep">
                                            {recommendedDungeonStage != null ? `${recommendedDungeonStage}단계` : '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                <div
                    className={`flex w-full overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${
                        fillLobbyGridCell ? 'h-full min-h-0' : 'aspect-[2.08/1] max-h-full min-h-0'
                    }`}
                >
                    <button
                        type="button"
                        onClick={() => setEntryModalOpen(true)}
                        className="group relative min-h-0 min-w-0 flex-[1.52] overflow-hidden rounded-l-2xl text-left focus:outline-none"
                        aria-label={`${definition.name} 입장 및 보상 안내`}
                    >
                        <img src={lobbyVenueBg} alt="" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
                        <div
                            className={`pointer-events-none absolute right-2 top-2 z-20 rounded-md border px-2 py-1 text-[11px] font-extrabold tracking-tight shadow-[0_4px_14px_rgba(0,0,0,0.35)] ${participationBadgeTone}`}
                            aria-label={`참가 상태: ${participationBadge}`}
                        >
                            {participationBadge}
                        </div>
                    </button>
                    <div className="flex min-h-0 min-w-[248px] flex-[1.08] flex-col items-stretch border-l border-amber-200/15 bg-gradient-to-b from-zinc-900/90 to-black/84 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <div className="mb-1 inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-amber-300/35 bg-gradient-to-r from-amber-950/55 via-zinc-900/65 to-amber-950/55 px-2.5 py-1.5 text-[17px] font-black tracking-tight text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-8px_rgba(251,191,36,0.4)]">
                            {definition.name}
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 py-1">
                            <div className="grid w-full min-w-0 grid-cols-[minmax(5.2rem,auto)_minmax(0,1fr)] items-center gap-x-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2 text-[14px] leading-snug">
                                <span className="min-w-0 text-center font-semibold text-slate-300/95">최고 단계</span>
                                <span className="min-w-0 w-full text-center font-semibold text-slate-100/95 whitespace-normal break-keep">
                                    {dungeonProgress.currentStage > 0 ? `${dungeonProgress.currentStage}단계` : '-'}
                                </span>
                            </div>
                            <div className="grid w-full min-w-0 grid-cols-[minmax(5.2rem,auto)_minmax(0,1fr)] items-center gap-x-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2 text-[14px] leading-snug">
                                <span className="min-w-0 text-center font-semibold text-slate-300/95">추천 단계</span>
                                <span className="min-w-0 w-full text-center font-semibold text-emerald-200/95 whitespace-normal break-keep">
                                    {recommendedDungeonStage != null ? `${recommendedDungeonStage}단계` : '-'}
                                </span>
                            </div>
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
                            <img src={lobbyVenueBg} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
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
                    <img src={lobbyVenueBg} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
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

const TournamentLobby: React.FC = () => {
    const { currentUserWithStatus, handlers, presets } = useAppContext();
    const { isNativeMobile, isNarrowViewport, pcLikeMobileLayout } = useNativeMobileShell();
    /** 네이티브 앱이 아니어도 좁은 화면(모바일 브라우저 등)에서는 단일 열 탭 로비 */
    const useCompactMergedChampionshipCards = isNarrowViewport && !pcLikeMobileLayout;
    const isHandheldChampionshipLobby = isNativeMobile || useCompactMergedChampionshipCards;

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
    /** 네이티브·좁은 뷰포트 챔피언십 로비: 능력치 / 경기장 / 상점 */
    const [nativeChampionshipTab, setNativeChampionshipTab] = useState<'stats' | 'arena' | 'shop'>('arena');
    /** PC 챔피언십 로비 좌측: 유저 장비·능력치 / 대표 펫 능력치 */
    const [pcChampionshipLeftAbilityTab, setPcChampionshipLeftAbilityTab] = useState<'user' | 'pet'>('user');
    const [championshipDuelHistoryOpen, setChampionshipDuelHistoryOpen] = useState(false);

    /** 경기장별 결투권이 DB에 없으면 서버와 동일 규칙으로 한 번 동기화(대기실 5/5 오표시 방지) */
    useEffect(() => {
        const u = currentUserWithStatus;
        if (!u || hasPersistedVersusDuelTicketsByVenue(u)) return;
        void handlers.handleAction({
            type: 'GET_CHAMPIONSHIP_VERSUS_VENUE_STATE',
            payload: { venue: 'pvp', economyOnly: true },
        });
    }, [currentUserWithStatus?.id, handlers]);

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

    const openPairLobbyForRepresentativePet = useCallback(() => {
        try {
            sessionStorage.setItem('sudamr_pair_lobby_open_pet_tab', '1');
        } catch {
            // ignore
        }
        window.location.hash = '#/pair';
    }, []);

    const equippedItems = useMemo(() => {
        if (!currentUserWithStatus?.inventory) return [];
        return currentUserWithStatus.inventory.filter(item => item.isEquipped);
    }, [currentUserWithStatus?.inventory]);

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

    const equipmentEffects = useMemo(() => calculateUserEffects(currentUserWithStatus), [currentUserWithStatus]);
    const { coreStatBonuses } = equipmentEffects;
    const championshipVenueAllCorePct =
        equipmentEffects.specialStatBonuses[SpecialStat.ChampionshipVenueAllStats]?.percent ?? 0;
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
            const flatBonus = Number(coreStatBonuses[stat].flat) || 0;
            const percentBonus = (Number(coreStatBonuses[stat].percent) || 0) + championshipVenueAllCorePct;
            out[stat] = computeCoreStatFinalFromBonuses(baseValue, flatBonus, percentBonus);
        }
        return out;
    }, [baseByStat, coreStatBonuses, championshipVenueAllCorePct]);
    const badukAbilityTotal = useMemo(
        () =>
            Object.values(finalByStat).reduce((sum, v) => {
                const safe = Number.isFinite(v) ? Math.max(0, v) : 0;
                return sum + Math.min(CORE_STAT_CAP, safe);
            }, 0),
        [finalByStat],
    );
    const championshipPhaseAbilityScores = useMemo(
        () => ({
            opening: championshipKataAbilityScore('opening', finalByStat),
            midgame: championshipKataAbilityScore('midgame', finalByStat),
            endgame: championshipKataAbilityScore('endgame', finalByStat),
        }),
        [finalByStat],
    );
    const userDungeonCoreStatAverage = useMemo(() => badukAbilityTotal / 6, [badukAbilityTotal]);
    const totalPoints = (Math.max(0, currentUserWithStatus.userLevel - 1) * 2) + (currentUserWithStatus.bonusStatPoints || 0);
    const spentPoints = Object.values(currentUserWithStatus.spentStatPoints || {}).reduce((sum, points) => sum + points, 0);
    const availablePoints = totalPoints - spentPoints;
    const equippedPairPetRowNative = useMemo(
        () => getEquippedPairPetInventoryRow(currentUserWithStatus),
        [currentUserWithStatus],
    );
    return (
        <div
            className={`relative flex w-full flex-col bg-lobby-shell-championship text-primary ${
                isHandheldChampionshipLobby
                    ? isNativeMobile
                        ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden overscroll-y-contain px-0.5 pb-0.5'
                        : 'h-full min-h-0 flex-1 overflow-hidden px-1 py-0.5 sm:px-1.5 sm:py-1'
                    : 'h-full p-2 sm:p-4 lg:p-2'
            }`}
            style={venueLobbyPanelStyle}
        >
            {isHandheldChampionshipLobby ? (
                <>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[clamp(0.25rem,1.2dvh,0.5rem)] overflow-hidden pb-[clamp(0.125rem,0.6dvh,0.25rem)]">
                    {/* 상단: 뒤로가기 + 타이틀 */}
                    <div className="relative w-full shrink-0 overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15">
                        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                        <div className="relative flex items-center gap-2 p-2 text-on-panel">
                            <button
                                type="button"
                                onClick={() => { window.location.hash = '#/profile'; }}
                                className="relative z-[1] shrink-0 transition-transform active:scale-90 filter hover:drop-shadow-lg"
                                aria-label="프로필로 돌아가기"
                            >
                                <img src="/images/button/back.webp" alt="" className="h-9 w-9" />
                            </button>
                            <h1 className="relative z-[1] min-w-0 flex-1 truncate text-left text-lg font-bold text-amber-50">챔피언십</h1>
                            <button
                                type="button"
                                onClick={() => setChampionshipDuelHistoryOpen(true)}
                                className="relative z-[1] shrink-0 rounded-lg border border-amber-400/45 bg-black/35 px-2 py-1 text-[10px] font-black tracking-wide text-amber-100 shadow-inner ring-1 ring-inset ring-amber-300/15 transition hover:border-amber-300/70 hover:bg-amber-950/40 active:scale-[0.98]"
                            >
                                대전정보
                            </button>
                        </div>
                    </div>

                    <div
                        role="tablist"
                        aria-label="챔피언십 구역"
                        className="flex w-full shrink-0 gap-0.5 rounded-lg border border-amber-500/40 bg-black/45 p-0.5 shadow-inner"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={nativeChampionshipTab === 'stats'}
                            onClick={() => setNativeChampionshipTab('stats')}
                            className={`min-h-[2.125rem] min-w-0 flex-1 rounded-md px-0.5 py-1 text-[10px] font-black leading-tight transition-colors sm:min-h-[2.35rem] sm:px-1.5 sm:text-xs ${
                                nativeChampionshipTab === 'stats'
                                    ? 'bg-amber-500/90 text-slate-950 shadow'
                                    : 'text-amber-100/80 hover:bg-white/10'
                            }`}
                        >
                            능력치
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={nativeChampionshipTab === 'arena'}
                            onClick={() => setNativeChampionshipTab('arena')}
                            className={`min-h-[2.125rem] min-w-0 flex-1 rounded-md px-0.5 py-1 text-[10px] font-black leading-tight transition-colors sm:min-h-[2.35rem] sm:px-1.5 sm:text-xs ${
                                nativeChampionshipTab === 'arena'
                                    ? 'bg-amber-500/90 text-slate-950 shadow'
                                    : 'text-amber-100/80 hover:bg-white/10'
                            }`}
                        >
                            경기장
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={nativeChampionshipTab === 'shop'}
                            onClick={() => setNativeChampionshipTab('shop')}
                            className={`min-h-[2.125rem] min-w-0 flex-1 rounded-md px-0.5 py-1 text-[9px] font-black leading-tight transition-colors sm:min-h-[2.35rem] sm:px-1.5 sm:text-xs ${
                                nativeChampionshipTab === 'shop'
                                    ? 'bg-amber-500/90 text-slate-950 shadow'
                                    : 'text-amber-100/80 hover:bg-white/10'
                            }`}
                            title="챔피언십 상점"
                        >
                            챔피언십 상점
                        </button>
                    </div>

                    <div
                        className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-stone-600/40 shadow-inner [-webkit-overflow-scrolling:touch] ${CHAMPIONSHIP_PANEL_GLASS} bg-stone-950/45`}
                        role="tabpanel"
                        aria-label={
                            nativeChampionshipTab === 'stats'
                                ? '능력치'
                                : nativeChampionshipTab === 'arena'
                                  ? '경기장'
                                  : '챔피언십 상점'
                        }
                    >
                        {nativeChampionshipTab === 'stats' ? (
                            <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.25rem,1dvh,0.45rem)] overflow-y-auto overflow-x-hidden overscroll-y-contain p-[clamp(0.2rem,0.85dvh,0.45rem)]">
                                <HomeNativeMergedEquipmentAbilityPanel
                                    equippedItems={equippedItems}
                                    presets={presets}
                                    selectedPreset={selectedPreset}
                                    onPresetChange={handlePresetChange}
                                    onOpenEquipmentEffects={handlers.openEquipmentEffectsModal}
                                    onOpenStatAllocation={handlers.openStatAllocationModal}
                                    onViewEquippedItem={(item) => handlers.openViewingItem(item, true)}
                                    finalByStat={finalByStat}
                                    baseByStat={baseByStat}
                                    badukAbilityTotal={badukAbilityTotal}
                                    availablePoints={availablePoints}
                                    framed
                                    compactLayout
                                    championshipPhaseAbilityScores={championshipPhaseAbilityScores}
                                />
                                <div className="relative shrink-0 overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-amber-100/12">
                                    <div
                                        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                                        aria-hidden
                                    />
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                                    <div className="relative z-[1] flex min-h-0 max-h-[min(48dvh,22rem)] flex-col overflow-hidden p-1.5 sm:max-h-[min(50dvh,24rem)]">
                                        {equippedPairPetRowNative ? (
                                            <PairPetDetailEmbedPanel
                                                currentUser={currentUserWithStatus}
                                                item={equippedPairPetRowNative}
                                                detailVariant="modal"
                                                contentHeight="hug"
                                                showRepresentativeBadge
                                            />
                                        ) : (
                                            <PairPetHomeEmptyDetailFrame
                                                variant="modal"
                                                onRequestEquip={openPairLobbyForRepresentativePet}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : nativeChampionshipTab === 'arena' ? (
                            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain p-[clamp(0.2rem,0.85dvh,0.45rem)]">
                                <div className={CHAMPIONSHIP_ENTRY_STACK_NATIVE_SCROLL}>
                                    <div className="flex w-full min-w-0 shrink-0 flex-col">
                                        <TournamentCard
                                            type="neighborhood"
                                            onClick={(stage) => handleEnterArena('neighborhood', stage)}
                                            onContinue={() => handleContinueTournament('neighborhood')}
                                            inProgress={neighborhoodState || null}
                                            currentUser={currentUserWithStatus}
                                            mergedInfoPanel
                                            mergedInfoPanelCompact
                                            mergedInfoPanelStretch
                                            userDungeonCoreStatAverage={userDungeonCoreStatAverage}
                                        />
                                    </div>
                                    <div className="flex w-full min-w-0 shrink-0 flex-col">
                                        <TournamentCard
                                            type="national"
                                            onClick={(stage) => handleEnterArena('national', stage)}
                                            onContinue={() => handleContinueTournament('national')}
                                            inProgress={nationalState || null}
                                            currentUser={currentUserWithStatus}
                                            mergedInfoPanel
                                            mergedInfoPanelCompact
                                            mergedInfoPanelStretch
                                            userDungeonCoreStatAverage={userDungeonCoreStatAverage}
                                        />
                                    </div>
                                    <div className="flex w-full min-w-0 shrink-0 flex-col">
                                        <TournamentCard
                                            type="world"
                                            onClick={(stage) => handleEnterArena('world', stage)}
                                            onContinue={() => handleContinueTournament('world')}
                                            inProgress={worldState || null}
                                            currentUser={currentUserWithStatus}
                                            mergedInfoPanel
                                            mergedInfoPanelCompact
                                            mergedInfoPanelStretch
                                            userDungeonCoreStatAverage={userDungeonCoreStatAverage}
                                        />
                                    </div>
                                    <div className="flex w-full min-w-0 shrink-0 flex-col">
                                        <ChampionshipVersusLobbyCard kind="pvp" compactMerged mergedInfoPanelStretch />
                                    </div>
                                    <div className="flex w-full min-w-0 shrink-0 flex-col">
                                        <ChampionshipVersusLobbyCard kind="pet" compactMerged mergedInfoPanelStretch />
                                    </div>
                                    <div className="flex w-full min-w-0 shrink-0 flex-col">
                                        <ChampionshipVersusLobbyCard kind="petpair" compactMerged mergedInfoPanelStretch />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <section
                                className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                                aria-label="챔피언십 상점"
                            >
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                                <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-white/8" aria-hidden />
                                <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/25 px-2 py-1.5">
                                    <h2 className="min-w-0 flex-1 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text text-sm font-bold tracking-tight text-transparent">
                                        챔피언십 상점
                                    </h2>
                                    <div
                                        className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/35 bg-black/35 py-0.5 pl-1 pr-1.5 shadow-inner"
                                        title="챔프 코인"
                                    >
                                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/90">
                                            <img
                                                src={specialResourceIcons.champCoins}
                                                alt="챔프 코인"
                                                className="h-4 w-4 object-contain"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        </div>
                                        <span className="text-xs font-bold tabular-nums text-amber-100">
                                            {(currentUserWithStatus.champCoins ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 pb-1.5 pt-1">
                                    <ChampionshipShopPanel currentUser={currentUserWithStatus} onAction={handlers.handleAction} />
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </>
            ) : (
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row gap-1.5 overflow-hidden">
                <div className="min-h-0 flex-1 flex flex-col gap-1.5 overflow-hidden">
                    <div className="flex min-h-0 flex-1 flex-row gap-1.5 overflow-hidden">
                    <aside className="flex h-full min-h-0 w-[min(42%,480px)] min-w-[288px] max-w-[480px] shrink-0 flex-col gap-1 overflow-hidden">
                        <div className="relative shrink-0 overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_-22px_rgba(0,0,0,0.78)] ring-1 ring-amber-100/15">
                            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
                            <div className="relative flex items-center gap-2 p-2 text-on-panel">
                                <button
                                    type="button"
                                    onClick={() => window.location.hash = '#/profile'}
                                    className="relative z-[1] shrink-0 transition-transform active:scale-90 filter hover:drop-shadow-lg"
                                    aria-label="프로필로 돌아가기"
                                >
                                    <img src="/images/button/back.webp" alt="" className="h-10 w-10 sm:h-11 sm:w-11" />
                                </button>
                                <h1 className="relative z-[1] min-w-0 flex-1 truncate text-left text-xl font-bold sm:text-2xl lg:text-3xl">챔피언십</h1>
                                <button
                                    type="button"
                                    onClick={() => setChampionshipDuelHistoryOpen(true)}
                                    className="relative z-[1] shrink-0 rounded-lg border border-amber-400/45 bg-black/35 px-2.5 py-1.5 text-[11px] font-black tracking-wide text-amber-100 shadow-inner ring-1 ring-inset ring-amber-300/15 transition hover:border-amber-300/70 hover:bg-amber-950/40 active:scale-[0.98] sm:text-xs"
                                >
                                    대전정보
                                </button>
                            </div>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden overscroll-y-contain">
                            {/* 유저·펫: 남는 높이 전부 사용. 상점은 본문 높이만(shrink-0) — 장비 6칸 스크롤 없이 맞춤 */}
                            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                                <div
                                    role="tablist"
                                    aria-label="능력치 패널"
                                    className="flex w-full shrink-0 gap-1 rounded-lg border border-amber-500/40 bg-black/40 p-0.5 shadow-inner"
                                >
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={pcChampionshipLeftAbilityTab === 'user'}
                                        onClick={() => setPcChampionshipLeftAbilityTab('user')}
                                        className={`min-h-[2.25rem] flex-1 rounded-md px-2 text-xs font-black transition-colors sm:text-sm ${
                                            pcChampionshipLeftAbilityTab === 'user'
                                                ? 'bg-amber-500/90 text-slate-950 shadow'
                                                : 'text-amber-100/85 hover:bg-white/10'
                                        }`}
                                    >
                                        유저
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={pcChampionshipLeftAbilityTab === 'pet'}
                                        onClick={() => setPcChampionshipLeftAbilityTab('pet')}
                                        className={`min-h-[2.25rem] flex-1 rounded-md px-2 text-xs font-black transition-colors sm:text-sm ${
                                            pcChampionshipLeftAbilityTab === 'pet'
                                                ? 'bg-amber-500/90 text-slate-950 shadow'
                                                : 'text-amber-100/85 hover:bg-white/10'
                                        }`}
                                    >
                                        펫
                                    </button>
                                </div>
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-b-none bg-black/20 ring-1 ring-inset ring-white/5">
                                    <PairPetDetailFitScale
                                        itemId={
                                            pcChampionshipLeftAbilityTab === 'user'
                                                ? `champ-lobby-left-user-${currentUserWithStatus.id}`
                                                : equippedPairPetRowNative
                                                  ? `champ-lobby-left-pet-${equippedPairPetRowNative.id}`
                                                  : 'champ-lobby-left-pet-empty'
                                        }
                                        outerClassName="px-0.5 py-0.5 sm:px-1 sm:py-1"
                                        innerClassName={
                                            pcChampionshipLeftAbilityTab === 'user'
                                                ? 'flex h-full min-h-0 w-full flex-col'
                                                : 'flex w-full min-w-0 min-h-0 shrink-0 flex-col'
                                        }
                                        stretchInnerHeightWhenUnscaled
                                    >
                                        {pcChampionshipLeftAbilityTab === 'user' ? (
                                            <HomeNativeMergedEquipmentAbilityPanel
                                                equippedItems={equippedItems}
                                                presets={presets}
                                                selectedPreset={selectedPreset}
                                                onPresetChange={handlePresetChange}
                                                onOpenEquipmentEffects={handlers.openEquipmentEffectsModal}
                                                onOpenStatAllocation={handlers.openStatAllocationModal}
                                                onViewEquippedItem={(item) => handlers.openViewingItem(item, true)}
                                                finalByStat={finalByStat}
                                                baseByStat={baseByStat}
                                                badukAbilityTotal={badukAbilityTotal}
                                                availablePoints={availablePoints}
                                                framed
                                                joinShopBelow
                                                compactLayout
                                                championshipPhaseAbilityScores={championshipPhaseAbilityScores}
                                            />
                                        ) : equippedPairPetRowNative ? (
                                            <div className="flex w-full shrink-0 flex-col rounded-t-xl rounded-b-none border border-fuchsia-500/40 border-b-0 bg-gradient-to-b from-zinc-900/92 to-zinc-950 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-fuchsia-500/18 sm:p-2">
                                                <PairPetDetailEmbedPanel
                                                    currentUser={currentUserWithStatus}
                                                    item={equippedPairPetRowNative}
                                                    detailVariant="modal"
                                                    contentHeight="fill"
                                                    showRepresentativeBadge
                                                    suppressDetailFitScale
                                                    parentOuterFitScale
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex w-full shrink-0 flex-col rounded-t-xl rounded-b-none border border-fuchsia-500/40 border-b-0 bg-gradient-to-b from-zinc-900/92 to-zinc-950 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-fuchsia-500/18 sm:p-2">
                                                <PairPetHomeEmptyDetailFrame
                                                    variant="modal"
                                                    onRequestEquip={openPairLobbyForRepresentativePet}
                                                />
                                            </div>
                                        )}
                                    </PairPetDetailFitScale>
                                </div>
                            </div>
                            <section
                                className="relative flex w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-b-xl rounded-t-none border-2 border-amber-500/40 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_40px_-20px_rgba(0,0,0,0.7)] ring-1 ring-amber-100/10"
                                aria-label="챔피언십 상점"
                            >
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
                                <div className="pointer-events-none absolute inset-0 rounded-b-xl rounded-t-none ring-1 ring-inset ring-white/8" aria-hidden />
                                <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/25 px-2 py-1.5">
                                    <h2 className="min-w-0 flex-1 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-lg">
                                        챔피언십 상점
                                    </h2>
                                    <div
                                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/35 bg-black/35 py-1 pl-1.5 pr-2 shadow-inner"
                                        title="챔프 코인"
                                    >
                                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/90">
                                            <img
                                                src={specialResourceIcons.champCoins}
                                                alt="챔프 코인"
                                                className="h-5 w-5 object-contain"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        </div>
                                        <span className="font-bold tabular-nums text-amber-100">
                                            {(currentUserWithStatus.champCoins ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col overflow-hidden px-2 pb-1.5 pt-0">
                                    <ChampionshipShopPanel
                                        currentUser={currentUserWithStatus}
                                        onAction={handlers.handleAction}
                                        layoutVariant="asideIntrinsic"
                                    />
                                </div>
                            </section>
                        </div>
                    </aside>
                    <main className="min-h-0 flex-1 flex flex-col items-center overflow-hidden rounded-lg border border-zinc-600/80 bg-panel p-1 shadow-inner">
                        <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(100%,1280px)] flex-col justify-center px-0.5">
                            <div className={CHAMPIONSHIP_ENTRY_GRID_DESKTOP_HOME_MATCH}>
                                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                                        <TournamentCard
                                            type="neighborhood"
                                            onClick={(stage) => handleEnterArena('neighborhood', stage)}
                                            onContinue={() => handleContinueTournament('neighborhood')}
                                            inProgress={neighborhoodState || null}
                                            currentUser={currentUserWithStatus}
                                            mergedInfoPanel
                                            mergedInfoPanelCompact={false}
                                            mergedInfoPanelStretch={false}
                                            fillLobbyGridCell
                                            userDungeonCoreStatAverage={userDungeonCoreStatAverage}
                                        />
                                    </div>
                                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                                        <ChampionshipVersusLobbyCard kind="pvp" compactMerged={false} fillLobbyGridCell />
                                    </div>
                                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                                        <TournamentCard
                                            type="national"
                                            onClick={(stage) => handleEnterArena('national', stage)}
                                            onContinue={() => handleContinueTournament('national')}
                                            inProgress={nationalState || null}
                                            currentUser={currentUserWithStatus}
                                            mergedInfoPanel
                                            mergedInfoPanelCompact={false}
                                            mergedInfoPanelStretch={false}
                                            fillLobbyGridCell
                                            userDungeonCoreStatAverage={userDungeonCoreStatAverage}
                                        />
                                    </div>
                                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                                        <ChampionshipVersusLobbyCard kind="pet" compactMerged={false} fillLobbyGridCell />
                                    </div>
                                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                                        <TournamentCard
                                            type="world"
                                            onClick={(stage) => handleEnterArena('world', stage)}
                                            onContinue={() => handleContinueTournament('world')}
                                            inProgress={worldState || null}
                                            currentUser={currentUserWithStatus}
                                            mergedInfoPanel
                                            mergedInfoPanelCompact={false}
                                            mergedInfoPanelStretch={false}
                                            fillLobbyGridCell
                                            userDungeonCoreStatAverage={userDungeonCoreStatAverage}
                                        />
                                    </div>
                                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                                        <ChampionshipVersusLobbyCard kind="petpair" compactMerged={false} fillLobbyGridCell />
                                    </div>
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
            <ChampionshipVersusDuelHistoryModal
                open={championshipDuelHistoryOpen}
                onClose={() => setChampionshipDuelHistoryOpen(false)}
                entries={currentUserWithStatus.championshipVersusDuelWeekLog}
            />
        </div>
    );
};

export default TournamentLobby;
