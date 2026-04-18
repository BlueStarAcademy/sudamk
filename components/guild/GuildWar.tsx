import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import Avatar from '../Avatar.js';
import { GuildWar as GuildWarType } from '../../types/index.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import {
    BLACK_BASE_STONE_IMG,
    WHITE_BASE_STONE_IMG,
    BLACK_HIDDEN_STONE_IMG,
} from '../../assets.js';
import {
    getGuildWarStarConditionLines,
    GUILD_WAR_PERSONAL_DAILY_ATTEMPTS,
    getGuildWarMissileCountByBoardId,
    getGuildWarHiddenStoneCountByBoardId,
    getGuildWarScanCountByBoardId,
    getGuildWarAutoScoringTurnsByBoardId,
    AVATAR_POOL,
    BORDER_POOL,
    ADMIN_USER_ID,
    GUILD_WAR_BOARD_ORDER,
    getGuildWarBoardMode,
    GUILD_WAR_MAIN_TIME_MINUTES,
    GUILD_WAR_FISCHER_INCREMENT_SECONDS,
    getGuildWarAiBotDisplayName,
    aiUserId,
    getGuildWarCaptureInitialStones,
    getGuildWarBoardLineSize,
    getGuildWarCaptureTurnLimitByBoardId,
    getGuildWarCaptureBlackTargetByBoardId,
    GUILD_WAR_CAPTURE_AI_TARGET,
} from '../../constants/index.js';
import { getTodayKSTDateString } from '../../utils/timeUtils.js';
import { getGuildWarBoardOwnerGuildId } from '../../shared/utils/guildWarBoardOwner.js';

const GUILD_WAR_PERSONAL_DAILY_LIMIT = GUILD_WAR_PERSONAL_DAILY_ATTEMPTS;

const GUILD_WAR_TICKET_IMG = '/images/guild/warticket.png';
const GUILD_WAR_BOARD_IMG = '/images/guild/guildwar/board.png';
const GUILD_WAR_BLUE_FLAG = '/images/guild/guildwar/blueflag.png';
const GUILD_WAR_RED_FLAG = '/images/guild/guildwar/redflag.png';
const GUILD_WAR_STAR_IMG = '/images/guild/guildwar/clearstar.png';
const GUILD_WAR_EMPTY_STAR_IMG = '/images/guild/guildwar/emptystar.png';
const GUILD_WAR_MISSILE_ICON = '/images/button/missile.png';
const GUILD_WAR_HIDDEN_ICON = '/images/button/hidden.png';
const GUILD_WAR_SCAN_ICON = '/images/button/scan.png';

/** 서버 `GUILD_WAR_UPDATE` 브로드캐스트 → 대기실 즉시 GET_GUILD_WAR_DATA (hooks/useApp.ts에서 dispatch) */
const GUILD_WAR_LOBBY_REFRESH_EVENT = 'sudamr:guild-war-update';

type InitialStoneCounts = {
    blackPlain: number;
    whitePlain: number;
    blackMarked: number;
    whiteMarked: number;
};

const getGuildWarCaptureInitialStoneCountsByBoardId = (boardId: string): InitialStoneCounts =>
    getGuildWarCaptureInitialStones(boardId);

const PlainBlackStoneIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
    <svg className={`${className} shrink-0 drop-shadow-md`} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="13" fill="#0f172a" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
    </svg>
);

const PlainWhiteStoneIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
    <svg className={`${className} shrink-0 drop-shadow-md`} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="13" fill="#f8f6f0" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
    </svg>
);

/** /api/action 응답은 { success, ...clientResponse }로 평탄화되어 최상위에 필드가 올 수 있음 */
function readGuildWarApiResult(result: any) {
    const war = result?.activeWar ?? result?.clientResponse?.activeWar;
    const guildsData = result?.guilds ?? result?.clientResponse?.guilds ?? {};
    const guildWarTicketSummary =
        result?.guildWarTicketSummary ?? result?.clientResponse?.guildWarTicketSummary ?? null;
    const occupierProfileByUserId =
        result?.occupierProfileByUserId ?? result?.clientResponse?.occupierProfileByUserId;
    return { war, guildsData, guildWarTicketSummary, occupierProfileByUserId };
}

type GuildWarOccupierServerProfile = {
    nickname: string;
    avatarId?: string | null;
    borderId?: string | null;
    strategyLevel: number;
    playfulLevel: number;
};

function guildWarOccupierHash(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
}

/** 전쟁·칸·봇 ID 기준 고정: 레벨 1~20, 프로필 이미지 */
function guildWarBotSeededDisplay(warId: string, boardId: string, botUserId: string) {
    const h = guildWarOccupierHash(`${warId}|${boardId}|${botUserId}`);
    const level = (h % 20) + 1;
    const pool = AVATAR_POOL.filter((a) => a.type === 'any');
    const pick = pool.length ? pool[(h >>> 8) % pool.length] : AVATAR_POOL[0];
    return { level, avatarUrl: pick.url };
}

function resolveHomeStyleAvatarUrl(avatarId: string | null | undefined): string {
    if (avatarId == null || avatarId === '' || avatarId === 'default') {
        return '/images/profiles/profile1.png';
    }
    return AVATAR_POOL.find((a) => a.id === avatarId)?.url || '/images/profiles/profile1.png';
}

function isGuildWarBotOccupierUserId(uid: string): boolean {
    if (uid === aiUserId) return true;
    if (uid === 'demo-bot') return true;
    return uid.includes('demo-bot');
}

interface Board {
    id: string;
    name: string;
    myStars: number;
    opponentStars: number;
    boardSize: number;
    highestScorer?: string;
    scoreDiff?: number;
    initialStones?: { black: number; white: number };
    initialStoneCounts: InitialStoneCounts;
    ownerGuildId?: string;
    gameMode?: 'capture' | 'hidden' | 'missile';
    /** 점령 길드 소속 기록 보유자 닉네임 */
    occupierNickname?: string;
    occupierAvatarUrl?: string;
    /** 프로필(홈) 테두리 — BORDER_POOL id */
    occupierBorderId?: string | null;
    occupierLevel?: number;
    /** 봇 점령 시 occupierLevel은 AI 난이도(1~20), 유저는 전략+놀이 통합 */
    occupierIsAiBot?: boolean;
    occupierCaptures?: number;
    occupierScoreDiff?: number;
    occupierIsMyGuild?: boolean;
    /** 이 바둑판에서 우리 길드가 도전한 총 횟수 */
    myGuildBoardAttempts?: number;
    /** 이 바둑판에서 상대 길드가 도전한 총 횟수 */
    opponentGuildBoardAttempts?: number;
}

const GuildWar = () => {
    const { currentUserWithStatus, guilds, handlers, allUsers } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
    const [activeWar, setActiveWar] = useState<GuildWarType | null>(null);
    const [myGuild, setMyGuild] = useState<any>(null);
    const [opponentGuild, setOpponentGuild] = useState<any>(null);
    const [boards, setBoards] = useState<Board[]>([]);
    const [myMembersChallenging, setMyMembersChallenging] = useState<{ name: string, board: string, level: number, avatarUrl: string }[]>([]);
    const [opponentMembersChallenging, setOpponentMembersChallenging] = useState<{ name: string, board: string, level: number, avatarUrl: string }[]>([]);
    const [myDailyAttempts, setMyDailyAttempts] = useState(0);
    /** 출전 명단 기준 당일 사용/총 도전권 (상황판) */
    const [myTeamTickets, setMyTeamTickets] = useState({ used: 0, total: 0 });
    const [opponentTeamTickets, setOpponentTeamTickets] = useState({ used: 0, total: 0, unknown: false });
    const [remainingTime, setRemainingTime] = useState<string>('');
    /** 네이티브 모바일: 바둑판 탭 시 우측 상황판 드로어 */
    const [mySituationDrawerOpen, setMySituationDrawerOpen] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const isDemoModeRef = useRef(false);
    useEffect(() => {
        isDemoModeRef.current = isDemoMode;
    }, [isDemoMode]);

    // handlers.handleAction을 ref로 저장하여 무한 루프 방지
    const handleActionRef = useRef(handlers.handleAction);
    useEffect(() => {
        handleActionRef.current = handlers.handleAction;
    }, [handlers.handleAction]);

    // 무한루프 방지를 위한 ref
    const isFetchingRef = useRef(false);
    const lastFetchTimeRef = useRef(0);
    const hasInitializedRef = useRef(false);
    const pendingForceRef = useRef(false);
    const fetchWarDataRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
    const FETCH_COOLDOWN = 10000; // 10초 쿨다운
    
    // 길드전 데이터 가져오기
    useEffect(() => {
        lastFetchTimeRef.current = 0;
        let remainingTimeInterval: ReturnType<typeof setInterval> | null = null;

        const fetchWarData = async (force = false) => {
            if (!currentUserWithStatus?.guildId) return;

            const now = Date.now();
            if (isFetchingRef.current) {
                if (force) pendingForceRef.current = true;
                return;
            }
            if (!force && now - lastFetchTimeRef.current < FETCH_COOLDOWN) {
                return;
            }
            
            isFetchingRef.current = true;
            lastFetchTimeRef.current = now;
            
            try {
                const result = await handleActionRef.current({ type: 'GET_GUILD_WAR_DATA' }) as any;
                if (result?.error) {
                    console.error('[GuildWar] Failed to fetch war data:', result.error);
                    return;
                }

                const { war, guildsData, guildWarTicketSummary, occupierProfileByUserId } =
                    readGuildWarApiResult(result);
                const occupierProfiles: Record<string, GuildWarOccupierServerProfile> =
                    occupierProfileByUserId && typeof occupierProfileByUserId === 'object'
                        ? occupierProfileByUserId
                        : {};

                if (!war) {
                    if (isDemoModeRef.current) {
                        return;
                    }
                    // 활성 길드전이 없음
                    setActiveWar(null);
                    setMyGuild(null);
                    setOpponentGuild(null);
                    setBoards([]);
                    setIsDemoMode(false);
                    return;
                }

                setIsDemoMode(false);
                setActiveWar(war);
                
                // 내 길드와 상대 길드 정보
                const myGuildId = currentUserWithStatus.guildId;
                const myGuildData = guildsData[myGuildId];
                const opponentGuildId = war.guild1Id === myGuildId ? war.guild2Id : war.guild1Id;
                const opponentGuildData = guildsData[opponentGuildId];
                
                setMyGuild(myGuildData);
                setOpponentGuild(opponentGuildData);
                
                // 바둑판 데이터 변환
                const boardNames: Record<string, string> = {
                    'top-left': '좌상귀',
                    'top-mid': '상변',
                    'top-right': '우상귀',
                    'mid-left': '좌변',
                    'center': '중앙',
                    'mid-right': '우변',
                    'bottom-left': '좌하귀',
                    'bottom-mid': '하변',
                    'bottom-right': '우하귀',
                };
                
                const convertedBoards: Board[] = GUILD_WAR_BOARD_ORDER
                    .filter((boardId) => !!(war.boards || {})[boardId])
                    .map((boardId) => {
                    const board = (war.boards || {})[boardId] as any;
                    const isGuild1 = war.guild1Id === myGuildId;
                    const myStars = isGuild1 ? (board.guild1Stars || 0) : (board.guild2Stars || 0);
                    const opponentStars = isGuild1 ? (board.guild2Stars || 0) : (board.guild1Stars || 0);
                    const myBestResult = isGuild1 ? board.guild1BestResult : board.guild2BestResult;
                    const opponentBestResult = isGuild1 ? board.guild2BestResult : board.guild1BestResult;
                    
                    // 점령자: 별 → 집점수(score) → 먼저 기록(completedAt) — shared/utils/guildWarBoardOwner 와 서버 동일
                    const ownerGuildId = getGuildWarBoardOwnerGuildId(board, war.guild1Id, war.guild2Id);
                    
                    const bestResult = myBestResult || opponentBestResult;
                    const userMap = new Map(allUsers.map(u => [u.id, u]));
                    const bestUser = bestResult ? userMap.get(bestResult.userId) : null;
                    // 9칸 모두 열(좌/중/우) 기준 동일 규칙 — KV 미기록·구데이터와 무관하게 대기실 표시를 현재 규칙과 맞춤
                    const rulesStones = getGuildWarCaptureInitialStoneCountsByBoardId(boardId);
                    const initialStoneCounts: InitialStoneCounts = {
                        blackPlain: rulesStones.blackPlain,
                        whitePlain: rulesStones.whitePlain,
                        blackMarked: rulesStones.blackMarked,
                        whiteMarked: rulesStones.whiteMarked,
                    };

                    let occupierNickname: string | undefined;
                    let occupierIsMyGuild = false;
                    if (ownerGuildId) {
                        occupierIsMyGuild = ownerGuildId === myGuildId;
                        const holderResult =
                            ownerGuildId === war.guild1Id ? board.guild1BestResult : board.guild2BestResult;
                        if (holderResult) {
                            const uid = String(holderResult.userId ?? '');
                            const serv = occupierProfiles[uid];
                            const occUser = userMap.get(holderResult.userId);
                            if (isGuildWarBotOccupierUserId(uid)) {
                                const seeded = guildWarBotSeededDisplay(String(war.id), boardId, uid);
                                occupierNickname = getGuildWarAiBotDisplayName(boardId);
                                (board as any).occupierAvatarUrl = seeded.avatarUrl;
                                (board as any).occupierBorderId = 'default';
                                (board as any).occupierLevel = seeded.level;
                                (board as any).occupierIsAiBot = true;
                            } else {
                                occupierNickname = serv?.nickname ?? occUser?.nickname ?? '알 수 없음';
                                const avatarId = serv?.avatarId ?? (occUser as any)?.avatarId;
                                (board as any).occupierAvatarUrl = resolveHomeStyleAvatarUrl(avatarId);
                                const bId = serv?.borderId ?? (occUser as any)?.borderId ?? 'default';
                                (board as any).occupierBorderId = bId || 'default';
                                const st =
                                    Number(serv?.strategyLevel ?? (occUser as any)?.strategyLevel ?? 0) || 0;
                                const pl =
                                    Number(serv?.playfulLevel ?? (occUser as any)?.playfulLevel ?? 0) || 0;
                                (board as any).occupierLevel = st + pl;
                                (board as any).occupierIsAiBot = false;
                            }
                            (board as any).occupierCaptures = Number(holderResult.captures ?? 0) || 0;
                            (board as any).occupierScoreDiff = typeof holderResult.scoreDiff === 'number'
                                ? holderResult.scoreDiff
                                : undefined;
                        }
                    }

                    const myGuildBoardAttempts = isGuild1
                        ? (board.guild1Attempts ?? 0)
                        : (board.guild2Attempts ?? 0);
                    const opponentGuildBoardAttempts = isGuild1
                        ? (board.guild2Attempts ?? 0)
                        : (board.guild1Attempts ?? 0);

                    return {
                        id: boardId,
                        name: boardNames[boardId] || boardId,
                        myStars,
                        opponentStars,
                        boardSize: getGuildWarBoardLineSize(boardId),
                        highestScorer: bestUser?.nickname,
                        scoreDiff: bestResult?.scoreDiff,
                        initialStones: board.initialStones?.[0] || {
                            black: initialStoneCounts.blackPlain,
                            white: initialStoneCounts.whitePlain,
                        },
                        initialStoneCounts,
                        ownerGuildId,
                        gameMode: getGuildWarBoardMode(boardId),
                        occupierNickname,
                        occupierAvatarUrl: (board as any).occupierAvatarUrl,
                        occupierBorderId: (board as any).occupierBorderId,
                        occupierLevel: (board as any).occupierLevel,
                        occupierIsAiBot: (board as any).occupierIsAiBot,
                        occupierCaptures: (board as any).occupierCaptures,
                        occupierScoreDiff: (board as any).occupierScoreDiff,
                        occupierIsMyGuild,
                        myGuildBoardAttempts,
                        opponentGuildBoardAttempts,
                    };
                });
                
                setBoards(convertedBoards);
                
                // 도전 중인 멤버 정보
                const userMap = new Map(allUsers.map(u => [u.id, u]));
                const myChallengers: { name: string, board: string, level: number, avatarUrl: string }[] = [];
                const opponentChallengers: { name: string, board: string, level: number, avatarUrl: string }[] = [];
                
                Object.entries(war.boards || {}).forEach(([boardId, board]: [string, any]) => {
                    const boardName = boardNames[boardId] || boardId;
                    const isGuild1 = war.guild1Id === myGuildId;
                    const myChallengerIds = isGuild1 ? board.guild1Challengers : board.guild2Challengers;
                    const opponentChallengerIds = isGuild1 ? board.guild2Challengers : board.guild1Challengers;
                    
                    myChallengerIds?.forEach((userId: string) => {
                        const user = userMap.get(userId) as any;
                        if (user) {
                            const level = (Number(user.strategyLevel ?? 0) || 0) + (Number(user.playfulLevel ?? 0) || 0);
                            const avatarUrl = AVATAR_POOL.find((a: any) => a.id === user.avatarId)?.url || '/images/guild/profile/icon1.png';
                            myChallengers.push({ name: user.nickname, board: boardName, level, avatarUrl });
                        }
                    });
                    
                    opponentChallengerIds?.forEach((userId: string) => {
                        const user = userMap.get(userId) as any;
                        if (user) {
                            const level = (Number(user.strategyLevel ?? 0) || 0) + (Number(user.playfulLevel ?? 0) || 0);
                            const avatarUrl = AVATAR_POOL.find((a: any) => a.id === user.avatarId)?.url || '/images/guild/profile/icon1.png';
                            opponentChallengers.push({ name: user.nickname, board: boardName, level, avatarUrl });
                        }
                    });
                });
                
                setMyMembersChallenging(myChallengers);
                setOpponentMembersChallenging(opponentChallengers);
                
                const uid = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
                const myAttempts = Number((war as any).userAttempts?.[uid] ?? 0) || 0;
                setMyDailyAttempts(myAttempts);

                if (guildWarTicketSummary) {
                    setMyTeamTickets({
                        used: guildWarTicketSummary.myRoster.used,
                        total: guildWarTicketSummary.myRoster.total,
                    });
                    setOpponentTeamTickets({
                        used: guildWarTicketSummary.opponentRoster.used,
                        total: guildWarTicketSummary.opponentRoster.total,
                        unknown: !!guildWarTicketSummary.opponentRoster.unknown,
                    });
                } else {
                    setMyTeamTickets({ used: 0, total: 0 });
                    setOpponentTeamTickets({ used: 0, total: 0, unknown: false });
                }
                
                // 남은 시간 계산
                if (war.endTime) {
                    if (remainingTimeInterval) {
                        clearInterval(remainingTimeInterval);
                        remainingTimeInterval = null;
                    }
                    const updateRemainingTime = () => {
                        const now = Date.now();
                        const remaining = war.endTime! - now;
                        if (remaining <= 0) {
                            setRemainingTime('종료됨');
                            return;
                        }
                        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
                        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                        setRemainingTime(`${days}일 ${hours}시간`);
                    };
                    updateRemainingTime();
                    remainingTimeInterval = setInterval(updateRemainingTime, 60000); // 1분마다 업데이트
                } else if (remainingTimeInterval) {
                    clearInterval(remainingTimeInterval);
                    remainingTimeInterval = null;
                }
            } catch (error) {
                console.error('[GuildWar] Error fetching war data:', error);
            } finally {
                isFetchingRef.current = false;
                if (pendingForceRef.current) {
                    pendingForceRef.current = false;
                    void fetchWarData(true);
                }
            }
        };

        fetchWarDataRef.current = fetchWarData;
        
        // 초기 로드 시에만 실행하고, 이후에는 interval만 사용
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            void fetchWarData();
        }
        
        // 30초마다 갱신 (초기 로드 후)
        const interval = setInterval(() => {
            void fetchWarData();
        }, 30000);
        
        return () => {
            clearInterval(interval);
            if (remainingTimeInterval) {
                clearInterval(remainingTimeInterval);
                remainingTimeInterval = null;
            }
            hasInitializedRef.current = false;
            isFetchingRef.current = false;
            pendingForceRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserWithStatus?.guildId]); // guilds와 allUsers를 의존성에서 제거하여 무한 루프 방지

    useEffect(() => {
        const onWarUpdate = () => {
            void fetchWarDataRef.current?.(true);
        };
        window.addEventListener(GUILD_WAR_LOBBY_REFRESH_EVENT, onWarUpdate);
        return () => window.removeEventListener(GUILD_WAR_LOBBY_REFRESH_EVENT, onWarUpdate);
    }, []);
    
    // 바둑판 클릭 시 도전
    const handleBoardClick = async (board: Board) => {
        if (!activeWar || !currentUserWithStatus?.guildId) return;
        if ((activeWar as any).status !== 'active') {
            alert('종료된 길드 전쟁에서는 도전할 수 없습니다.');
            return;
        }
        
        // 데모 모드에서는 도전 횟수 제한 없음
        if (!isDemoMode) {
            // 하루 도전 횟수 확인
            if (myDailyAttempts >= GUILD_WAR_PERSONAL_DAILY_LIMIT) {
                alert(`이번 길드전 도전 횟수를 모두 사용했습니다. (총 ${GUILD_WAR_PERSONAL_DAILY_LIMIT}회)`);
                return;
            }
        }
        
        try {
            const result = await handlers.handleAction({ 
                type: 'START_GUILD_WAR_GAME', 
                payload: { 
                    boardId: board.id, 
                    isDemo: isDemoMode,
                    gameMode: board.gameMode, // 데모 모드에서 게임 모드 전달
                } 
            }) as any;
            
            if (result?.error) {
                alert(result.error);
            } else {
                const gameId = result?.gameId ?? result?.clientResponse?.gameId;
                if (gameId) {
                    window.location.hash = `#/game/${gameId}`;
                }
            }
        } catch (error) {
            console.error('[GuildWar] Failed to start game:', error);
            alert('게임 시작에 실패했습니다.');
        }
    };
    
    const StarDisplay = ({ count, total = 3, size = 'w-6 h-6' }: { count: number, total?: number, size?: string }) => {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push(<img key={`filled-${i}`} src="/images/guild/guildwar/clearstar.png" alt="filled star" className={size} />);
        }
        for (let i = count; i < total; i++) {
            stars.push(<img key={`empty-${i}`} src="/images/guild/guildwar/emptystar.png" alt="empty star" className={size} />);
        }
        return <div className="flex justify-center">{stars}</div>;
    };
    
    // 총 별 개수 계산
    const totalMyStars = boards.reduce((sum, b) => sum + b.myStars, 0);
    const totalOpponentStars = boards.reduce((sum, b) => sum + b.opponentStars, 0);
    // 동률(별 합계) 시 비교용 집점수 합계
    const isGuild1ForHouseScore = !!activeWar && !!myGuild && activeWar.guild1Id === myGuild.id;
    let myTotalHouseScore = 0;
    let opponentTotalHouseScore = 0;
    if (activeWar && myGuild) {
        Object.values(activeWar.boards || {}).forEach((board: any) => {
            const myBest = isGuild1ForHouseScore ? board.guild1BestResult : board.guild2BestResult;
            const oppBest = isGuild1ForHouseScore ? board.guild2BestResult : board.guild1BestResult;
            myTotalHouseScore += Number(myBest?.score ?? 0) || 0;
            opponentTotalHouseScore += Number(oppBest?.score ?? 0) || 0;
        });
    }

    // 활성 길드전이 없을 때
    if (!activeWar || !myGuild || !opponentGuild) {
        return (
            <div className="h-full w-full flex flex-col bg-tertiary text-primary p-4 bg-cover bg-center" style={{ backgroundImage: "url('/images/guild/guildwar/warmap.png')" }}>
                <header className="flex justify-between items-center mb-4 flex-shrink-0">
                    <BackButton onClick={() => replaceAppHash('#/guild')} />
                    <h1 className="text-3xl font-bold text-white" style={{textShadow: '2px 2px 5px black'}}>길드 전쟁</h1>
                </header>
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center text-white" style={{textShadow: '2px 2px 4px black'}}>
                        <p className="text-2xl font-bold mb-4">진행 중인 길드전이 없습니다.</p>
                        <p className="text-lg mb-6">다음 매칭을 기다려주세요.</p>
                        <p className="text-sm text-gray-300 mt-4">길드전은 자동 매칭으로 진행됩니다.</p>
                    </div>
                </main>
            </div>
        );
    }

    const personalTicketTotal = GUILD_WAR_PERSONAL_DAILY_LIMIT;
    const personalTicketsRemaining = isDemoMode
        ? personalTicketTotal
        : Math.max(0, personalTicketTotal - myDailyAttempts);

    const renderGuildWarBoardGrid = (compact: boolean, onAfterSelectBoard?: () => void) => (
        <div
            className={
                compact
                    ? 'grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-x-0.5 gap-y-0.5 px-0.5'
                    : 'grid flex-1 grid-cols-3 grid-rows-3 gap-x-8 gap-y-4'
            }
        >
            {boards.map((board) => {
                let ownerGuildId: string | undefined = board.ownerGuildId;
                if (!ownerGuildId) {
                    if (board.myStars > board.opponentStars) {
                        ownerGuildId = myGuild.id;
                    } else if (board.opponentStars > board.myStars) {
                        ownerGuildId = opponentGuild.id;
                    }
                }

                const isMyGuildOccupied = ownerGuildId === myGuild.id;
                const isOpponentOccupied = ownerGuildId === opponentGuild.id;
                const isSelected = selectedBoard?.id === board.id;

                const boardImg = compact ? 'h-[min(26vw,5.25rem)] w-[min(26vw,5.25rem)]' : 'h-24 w-24';
                const flagClass = compact
                    ? 'absolute left-0 top-1/2 z-10 h-5 w-5 -translate-x-full -translate-y-1/2'
                    : 'absolute left-0 top-1/2 z-10 h-8 w-8 -translate-x-full -translate-y-1/2';
                const flagClassR = compact
                    ? 'absolute right-0 top-1/2 z-10 h-5 w-5 translate-x-full -translate-y-1/2'
                    : 'absolute right-0 top-1/2 z-10 h-8 w-8 translate-x-full -translate-y-1/2';
                const starSz = compact ? 'h-3.5 w-3.5' : 'w-5 h-5';
                const ring = compact ? 'ring-2 ring-yellow-400' : 'ring-4 ring-yellow-400';
                const scaleHover = compact ? 'hover:scale-[1.03]' : 'hover:scale-105';
                const scaleSel = compact ? 'scale-105' : 'scale-110';

                return (
                    <div
                        key={board.id}
                        className={`relative flex cursor-pointer flex-col items-center justify-center gap-0.5 transition-all ${isSelected ? scaleSel : scaleHover}`}
                        onClick={() => {
                            setSelectedBoard(board);
                            onAfterSelectBoard?.();
                        }}
                    >
                        <StarDisplay count={board.myStars} size={starSz} />
                        <div className="relative flex items-center justify-center">
                            {isMyGuildOccupied && (
                                <img src={GUILD_WAR_BLUE_FLAG} alt="우리 길드 점령" className={flagClass} />
                            )}
                            <img
                                src={GUILD_WAR_BOARD_IMG}
                                alt="바둑판"
                                className={`${boardImg} ${isSelected ? ring : ''}`}
                            />
                            {isOpponentOccupied && (
                                <img src={GUILD_WAR_RED_FLAG} alt="상대 길드 점령" className={flagClassR} />
                            )}
                        </div>
                        <span
                            className={`max-w-full -mt-1 truncate rounded-md bg-black/60 font-semibold text-white ${
                                compact ? 'px-1 py-0 text-[10px]' : '-mt-2 px-2 py-0.5 text-sm'
                            }`}
                        >
                            {board.name}
                        </span>
                        <StarDisplay count={board.opponentStars} size={starSz} />
                    </div>
                );
            })}
        </div>
    );

    const StatusAndViewerPanel: React.FC<{
        team: 'blue' | 'red';
        challengingMembers: { name: string, board: string, level: number, avatarUrl: string }[];
        /** 출전 명단 기준 길드원 총 도전권 (당일 사용/총량) */
        teamUsedTickets: number;
        teamTotalTickets: number;
        teamTicketsUnknown?: boolean;
        board: Board | null;
        /** 우리편(블루) 상세: 남은 개인 도전권 N/최대 */
        personalTicketsRemaining?: number;
        personalTicketsTotal?: number;
    }> = ({
        team,
        challengingMembers,
        teamUsedTickets,
        teamTotalTickets,
        teamTicketsUnknown,
        board,
        personalTicketsRemaining: myTicketsLeft,
        personalTicketsTotal: myTicketsMax,
    }) => {
        const isBlue = team === 'blue';
        const panelClasses = isBlue ? 'bg-blue-900/50 border-blue-700' : 'bg-red-900/50 border-red-700';
        const textClasses = isBlue ? 'text-blue-300' : 'text-red-300';
        const secondaryTextClasses = isBlue ? 'text-blue-200' : 'text-red-200';
        const perspectiveStars = board ? (isBlue ? board.myStars : board.opponentStars) : 0;
        const perspectiveAttempts = board
            ? (isBlue ? (board.myGuildBoardAttempts ?? 0) : (board.opponentGuildBoardAttempts ?? 0))
            : 0;

        return (
            <div className={`flex-1 min-h-0 w-full flex flex-col gap-2 ${panelClasses} border-2 rounded-lg p-2 sm:p-2.5`}>
                <div className="shrink-0">
                    <h2 className={`text-sm font-bold text-center ${textClasses} mb-1`}>상황판</h2>
                    <div className="space-y-1.5">
                        <div className={`rounded-lg border px-2 py-1.5 ${isBlue ? 'bg-blue-950/45 border-blue-800/70' : 'bg-red-950/45 border-red-800/70'}`}>
                            <p className={`text-[10px] sm:text-[11px] font-semibold ${secondaryTextClasses}`}>
                                {isBlue ? '길드원 총 도전권' : '상대 총 도전권'}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                                <img src={GUILD_WAR_TICKET_IMG} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-95 shrink-0" />
                                <span className="tabular-nums font-black text-white text-lg sm:text-xl leading-none">
                                    {teamTicketsUnknown ? '—' : `${teamUsedTickets}/${teamTotalTickets}`}
                                </span>
                            </div>
                        </div>
                        <div className={`rounded-lg border px-2 py-1.5 ${isBlue ? 'bg-blue-950/30 border-blue-800/60' : 'bg-red-950/30 border-red-800/60'}`}>
                            <p className={`text-[10px] sm:text-[11px] font-semibold ${secondaryTextClasses}`}>현재 점령자</p>
                            {board?.ownerGuildId && board.occupierNickname ? (
                                isNativeMobile ? (
                                    <div className="mt-1.5 flex min-w-0 gap-2.5">
                                        <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1">
                                            <Avatar
                                                userId={board.occupierNickname}
                                                userName={board.occupierNickname}
                                                avatarUrl={board.occupierAvatarUrl || '/images/profiles/profile1.png'}
                                                borderUrl={
                                                    BORDER_POOL.find((b) => b.id === (board.occupierBorderId || 'default'))
                                                        ?.url ?? '#FFFFFF'
                                                }
                                                size={48}
                                                className="shrink-0"
                                            />
                                            <span
                                                className="w-full truncate text-center text-xs font-bold leading-tight text-slate-100"
                                                title={board.occupierNickname}
                                            >
                                                {board.occupierNickname}
                                            </span>
                                            <span className="text-center text-[10px] font-semibold leading-none text-slate-200/90">
                                                {board.occupierIsAiBot
                                                    ? `AI Lv.${Number(board.occupierLevel ?? 0) || 0}`
                                                    : `통합 Lv.${Number(board.occupierLevel ?? 0) || 0}`}
                                            </span>
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col justify-center border-l border-white/15 pl-2.5">
                                            <span className="text-[10px] font-bold text-amber-200/90">점령 기록</span>
                                            {board.gameMode === 'capture' ||
                                            board.gameMode === 'hidden' ||
                                            board.gameMode === 'missile' ? (
                                                <p className="mt-1 text-sm font-bold leading-snug text-amber-50">
                                                    {board.gameMode === 'capture'
                                                        ? `따낸 돌 ${board.occupierCaptures ?? 0}개`
                                                        : `집 차이 ${board.occupierScoreDiff ?? 0}집`}
                                                </p>
                                            ) : (
                                                <p className="mt-1 text-xs text-slate-400">—</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                                        <Avatar
                                            userId={board.occupierNickname}
                                            userName={board.occupierNickname}
                                            avatarUrl={board.occupierAvatarUrl || '/images/profiles/profile1.png'}
                                            borderUrl={
                                                BORDER_POOL.find((b) => b.id === (board.occupierBorderId || 'default'))
                                                    ?.url ?? '#FFFFFF'
                                            }
                                            size={40}
                                            className="shrink-0"
                                        />
                                        <div className="min-w-0 flex-1 text-right">
                                            <span
                                                className="block truncate text-sm font-bold text-slate-100 sm:text-base"
                                                title={board.occupierNickname}
                                            >
                                                {board.occupierNickname}
                                            </span>
                                            <span className="text-[10px] text-slate-200/85 sm:text-[11px]">
                                                {board.occupierIsAiBot
                                                    ? `AI Lv.${Number(board.occupierLevel ?? 0) || 0}`
                                                    : `통합 Lv.${Number(board.occupierLevel ?? 0) || 0}`}
                                            </span>
                                            {(board.gameMode === 'capture' ||
                                                board.gameMode === 'hidden' ||
                                                board.gameMode === 'missile') && (
                                                <span className="text-[10px] text-amber-200/90 sm:text-[11px]">
                                                    {board.gameMode === 'capture'
                                                        ? `점령 기록: 따낸 돌 ${board.occupierCaptures ?? 0}개`
                                                        : `점령 기록: 집 차이 ${board.occupierScoreDiff ?? 0}집`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            ) : (
                                <span className="text-xs text-slate-500">없음</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col pt-1 border-t border-gray-500/40">
                    <div className="flex-1 min-h-0 bg-gradient-to-b from-black/45 via-black/35 to-black/50 rounded-xl p-2.5 sm:p-3 text-xs flex flex-col items-stretch overflow-y-auto border border-white/10 shadow-inner backdrop-blur-sm">
                        {board ? (
                            <div className="w-full space-y-3 text-left">
                                <div className="text-center">
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-600/90 via-amber-500/85 to-yellow-600/90 border border-amber-300/50 shadow-[0_0_20px_rgba(251,191,36,0.25)]">
                                            <span className="text-sm sm:text-base font-black tracking-wide text-stone-900 drop-shadow-sm">
                                                {board.name}
                                            </span>
                                        </div>
                                        <div
                                            className="inline-flex items-center gap-0.5"
                                            title={`${isBlue ? '우리' : '상대'} 길드 별 ${Math.min(3, perspectiveStars)}/3`}
                                            aria-label={`${isBlue ? '우리' : '상대'} 길드 별 ${Math.min(3, perspectiveStars)}개`}
                                        >
                                            {[0, 1, 2].map((i) => (
                                                <img
                                                    key={i}
                                                    src={i < Math.min(3, Math.max(0, perspectiveStars)) ? GUILD_WAR_STAR_IMG : GUILD_WAR_EMPTY_STAR_IMG}
                                                    alt=""
                                                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const modeIcon =
                                        board.gameMode === 'hidden'
                                            ? BLACK_HIDDEN_STONE_IMG
                                            : board.gameMode === 'missile'
                                              ? GUILD_WAR_MISSILE_ICON
                                              : GUILD_WAR_BOARD_IMG;
                                    const modeLabel =
                                        board.gameMode === 'capture'
                                            ? '따내기 바둑'
                                            : board.gameMode === 'hidden'
                                              ? '히든 바둑'
                                              : board.gameMode === 'missile'
                                                ? '미사일 바둑'
                                                : '바둑';
                                    return (
                                        <div className="grid grid-cols-2 gap-2">
                                            {board.gameMode === 'capture' && (
                                                <div className="col-span-2 rounded-lg bg-slate-900/50 border border-amber-500/25 px-2.5 py-2.5">
                                                    <p className="text-[10px] uppercase tracking-wider text-amber-200/90 font-semibold mb-2 text-center">
                                                        따내기 목표
                                                    </p>
                                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                                        <div className="flex items-center gap-2 rounded-lg bg-black/35 border border-white/10 px-3 py-2">
                                                            <PlainBlackStoneIcon className="w-8 h-8 sm:w-9 sm:h-9" />
                                                            <span className="text-sm sm:text-base font-black tabular-nums text-amber-50">
                                                                {getGuildWarCaptureBlackTargetByBoardId(board.id)}점
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-0.5">
                                                            vs
                                                        </span>
                                                        <div className="flex items-center gap-2 rounded-lg bg-black/35 border border-white/10 px-3 py-2">
                                                            <PlainWhiteStoneIcon className="w-8 h-8 sm:w-9 sm:h-9" />
                                                            <span className="text-sm sm:text-base font-black tabular-nums text-amber-50">
                                                                {GUILD_WAR_CAPTURE_AI_TARGET}점
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 rounded-lg bg-slate-900/55 border border-slate-600/40 px-2.5 py-2">
                                                <img src={modeIcon} alt="" className="w-8 h-8 object-contain shrink-0 rounded-md bg-black/20 p-0.5" />
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">모드</p>
                                                    <p className="text-sm font-bold text-sky-100">{modeLabel}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg bg-slate-900/55 border border-slate-600/40 px-2.5 py-2">
                                                <img src={GUILD_WAR_BOARD_IMG} alt="" className="w-8 h-8 object-contain shrink-0 rounded-md bg-black/20 p-1" />
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">바둑판</p>
                                                    <p className="text-sm font-bold text-sky-100">{board.boardSize}줄</p>
                                                </div>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-3 rounded-lg bg-slate-900/55 border border-slate-600/40 px-2.5 py-2">
                                                <img src="/images/icon/timer.png" alt="" className="w-7 h-7 object-contain shrink-0 rounded-md bg-black/20 p-1" />
                                                <div className="flex-1 grid grid-cols-2 gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">턴 제한</p>
                                                        <p className="text-sm font-bold text-sky-100 whitespace-nowrap">
                                                            {board.gameMode === 'capture'
                                                                ? `${getGuildWarCaptureTurnLimitByBoardId(board.id)}턴`
                                                                : `계가까지 ${getGuildWarAutoScoringTurnsByBoardId(board.id)}턴`}
                                                        </p>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">대국 시계</p>
                                                        <p className="text-sm font-bold text-sky-100 whitespace-nowrap">
                                                            {GUILD_WAR_MAIN_TIME_MINUTES}분(피셔 {GUILD_WAR_FISCHER_INCREMENT_SECONDS}초)
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="rounded-lg bg-amber-950/35 border border-amber-600/30 px-2.5 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-amber-200/90 font-semibold mb-1.5 flex items-center gap-1">
                                        <img src={GUILD_WAR_STAR_IMG} alt="" className="w-3.5 h-3.5 opacity-95" />
                                        별 획득 조건
                                    </p>
                                    <ul className="space-y-1.5 text-[10px] sm:text-[11px] text-amber-50/95 leading-snug">
                                        {getGuildWarStarConditionLines(board.gameMode, board.id).map((line, i) => (
                                            <li key={i}>{line}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="rounded-lg bg-slate-900/45 border border-slate-600/35 px-2.5 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 text-center">초기 배치</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'bp', label: '흑돌', icon: <PlainBlackStoneIcon />, n: board.initialStoneCounts.blackPlain },
                                            { key: 'wp', label: '백돌', icon: <PlainWhiteStoneIcon />, n: board.initialStoneCounts.whitePlain },
                                            {
                                                key: 'bm',
                                                label: '문양 흑',
                                                icon: (
                                                    <img
                                                        src={BLACK_BASE_STONE_IMG}
                                                        alt=""
                                                        className="w-7 h-7 rounded-full object-cover ring-2 ring-amber-500/45 shadow-md shrink-0"
                                                    />
                                                ),
                                                n: board.initialStoneCounts.blackMarked,
                                            },
                                            {
                                                key: 'wm',
                                                label: '문양 백',
                                                icon: (
                                                    <img
                                                        src={WHITE_BASE_STONE_IMG}
                                                        alt=""
                                                        className="w-7 h-7 rounded-full object-cover ring-2 ring-sky-200/50 shadow-md shrink-0"
                                                    />
                                                ),
                                                n: board.initialStoneCounts.whiteMarked,
                                            },
                                        ].map((row) => (
                                            <div
                                                key={row.key}
                                                className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5"
                                            >
                                                {row.icon}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] text-slate-400 leading-tight">{row.label}</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100">{row.n}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {board.gameMode !== 'capture' && (
                                <div className="rounded-lg bg-slate-900/45 border border-slate-600/35 px-2.5 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 text-center">아이템</p>
                                    {board.gameMode === 'hidden' ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5">
                                                <img src={GUILD_WAR_HIDDEN_ICON} alt="" className="w-6 h-6 object-contain shrink-0" />
                                                <div>
                                                    <p className="text-[9px] text-slate-400">히든</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100">{getGuildWarHiddenStoneCountByBoardId(board.id)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5">
                                                <img src={GUILD_WAR_SCAN_ICON} alt="" className="w-6 h-6 object-contain shrink-0" />
                                                <div>
                                                    <p className="text-[9px] text-slate-400">스캔</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100">{getGuildWarScanCountByBoardId(board.id)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5">
                                                <img src={GUILD_WAR_MISSILE_ICON} alt="" className="w-6 h-6 object-contain shrink-0" />
                                                <div>
                                                    <p className="text-[9px] text-slate-400">미사일</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100">{getGuildWarMissileCountByBoardId(board.id)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                )}

                                <div className="flex items-center gap-2 rounded-lg bg-indigo-950/40 border border-indigo-500/25 px-2.5 py-2">
                                    <img src={GUILD_WAR_TICKET_IMG} alt="" className="w-7 h-7 object-contain shrink-0 drop-shadow" />
                                    <div className="flex-1 text-right">
                                        <p className="text-[10px] text-indigo-200/80 font-semibold">
                                            맵 도전 횟수
                                        </p>
                                        <p className="text-base font-black tabular-nums text-indigo-100">
                                            {perspectiveAttempts.toLocaleString()}회
                                        </p>
                                    </div>
                                </div>

                                {team === 'blue' && myTicketsMax != null && myTicketsLeft != null && (
                                    <button
                                        type="button"
                                        onClick={() => handleBoardClick(board)}
                                        disabled={!isDemoMode && myDailyAttempts >= GUILD_WAR_PERSONAL_DAILY_LIMIT}
                                        className={`mt-2 w-full py-2 px-2 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 flex-wrap ${
                                            (!isDemoMode && myDailyAttempts >= GUILD_WAR_PERSONAL_DAILY_LIMIT)
                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]'
                                        }`}
                                    >
                                        <span className="flex items-center gap-1 shrink-0">
                                            <img src={GUILD_WAR_TICKET_IMG} alt="" className="w-6 h-6 object-contain drop-shadow" />
                                            <span className={`tabular-nums font-bold ${(!isDemoMode && myDailyAttempts >= GUILD_WAR_PERSONAL_DAILY_LIMIT) ? 'text-gray-300' : 'text-amber-100'}`}>
                                                {myTicketsLeft}/{myTicketsMax}
                                            </span>
                                        </span>
                                        <span className="opacity-80 hidden min-[380px]:inline" aria-hidden>·</span>
                                        <span className="leading-tight text-center">
                                            {(!isDemoMode && myDailyAttempts >= GUILD_WAR_PERSONAL_DAILY_LIMIT) ? '도전 횟수 소진' : '도전하기'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-tertiary">바둑판을 선택하여<br/>정보를 확인하세요.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className={`flex h-full w-full flex-col bg-tertiary bg-cover bg-center text-primary ${isNativeMobile ? 'p-2' : 'p-4'}`}
            style={{ backgroundImage: "url('/images/guild/guildwar/warmap.png')" }}
        >
            <header className={`flex flex-shrink-0 items-center justify-between ${isNativeMobile ? 'mb-1' : 'mb-4'}`}>
                 <BackButton onClick={() => {
                     if (isDemoMode) {
                         setIsDemoMode(false);
                         setActiveWar(null);
                         setMyGuild(null);
                         setOpponentGuild(null);
                         setBoards([]);
                     } else {
                         replaceAppHash('#/guild');
                     }
                 }} />
                <h1 className={`font-bold text-white ${isNativeMobile ? 'text-xl' : 'text-3xl'}`} style={{textShadow: '2px 2px 5px black'}}>
                    길드 전쟁
                </h1>
                 <div className={isNativeMobile ? 'max-w-[38%] text-right' : 'w-40 text-right'}>
                    <p className={`font-semibold text-white ${isNativeMobile ? 'text-xs leading-tight' : 'text-sm'}`} style={{textShadow: '1px 1px 3px black'}}>
                        {isDemoMode ? '데모 모드' : (remainingTime || '계산 중...')}
                    </p>
                </div>
            </header>
            {isNativeMobile ? (
                <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
                    <div className="shrink-0 rounded-xl border border-amber-300/35 bg-gradient-to-b from-black/55 via-black/45 to-black/55 px-2 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.4)]">
                        <div className="flex items-center gap-2 text-white" style={{ textShadow: '1px 1px 3px black' }}>
                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                <img
                                    src={myGuild.icon || myGuild.emblem || '/images/guild/profile/icon1.png'}
                                    alt=""
                                    className="h-8 w-8 shrink-0 rounded-md object-contain ring-1 ring-blue-400/40"
                                />
                                <span className="mt-0.5 max-w-full truncate text-center text-[10px] font-bold">{myGuild.name}</span>
                            </div>
                            <div className="min-w-0 flex-[1.4] text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                    <img src={GUILD_WAR_STAR_IMG} alt="" className="h-5 w-5 shrink-0" />
                                    <span className="text-2xl font-black tabular-nums">{totalMyStars}</span>
                                    <span className="text-xs font-extrabold text-amber-200/90">VS</span>
                                    <span className="text-2xl font-black tabular-nums">{totalOpponentStars}</span>
                                    <img src={GUILD_WAR_STAR_IMG} alt="" className="h-5 w-5 shrink-0" />
                                </div>
                                <p className="mt-0.5 text-[9px] font-semibold text-amber-200/90">동점 시 집점수 비교</p>
                                <div className="mt-0.5 flex justify-between gap-1 text-[10px] font-bold tabular-nums text-cyan-100">
                                    <span className="min-w-0 truncate">집 {myTotalHouseScore}</span>
                                    <span className="min-w-0 truncate">집 {opponentTotalHouseScore}</span>
                                </div>
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                <img
                                    src={opponentGuild.icon || opponentGuild.emblem || '/images/guild/profile/icon1.png'}
                                    alt=""
                                    className="h-8 w-8 shrink-0 rounded-md object-contain ring-1 ring-red-400/40"
                                />
                                <span className="mt-0.5 max-w-full truncate text-center text-[10px] font-bold">{opponentGuild.name}</span>
                            </div>
                        </div>
                    </div>

                    {renderGuildWarBoardGrid(true, () => setMySituationDrawerOpen(true))}
                </main>
            ) : (
                <main className="flex-1 grid grid-cols-5 gap-4 min-h-0">
                {/* Left Panel */}
                <div className="col-span-1 min-h-0 flex flex-col">
                    <StatusAndViewerPanel
                        team="blue"
                        challengingMembers={myMembersChallenging}
                        teamUsedTickets={myTeamTickets.used}
                        teamTotalTickets={myTeamTickets.total}
                        board={selectedBoard}
                        personalTicketsRemaining={personalTicketsRemaining}
                        personalTicketsTotal={personalTicketTotal}
                    />
                </div>

                {/* Center Panel */}
                <div className="col-span-3 flex flex-col">
                    <div className="grid grid-cols-[176px_minmax(0,1fr)_176px] items-start gap-4 mb-4">
                        <div className="w-44 justify-self-start flex flex-col items-center">
                            <div className="relative w-24 h-32">
                                <img src="/images/guild/guildwar/blueteam.png" alt="Blue Team Flag" className="w-full h-full" />
                                <img src={myGuild.icon || myGuild.emblem || '/images/guild/profile/icon1.png'} alt="My Guild Emblem" className="absolute top-[30px] left-1/2 -translate-x-1/2 w-14 h-14 object-contain" />
                            </div>
                            <div className="bg-black/60 px-3 py-1 rounded-md -mt-5 z-10 shadow-lg">
                                <span className="font-bold text-white block max-w-[150px] truncate text-center">{myGuild.name}</span>
                            </div>
                        </div>
                        
                        <div className="w-full flex flex-col items-center gap-2 pt-1">
                            <div className="w-full max-w-[560px] rounded-2xl border border-amber-300/35 bg-gradient-to-b from-black/55 via-black/45 to-black/55 shadow-[0_10px_30px_rgba(0,0,0,0.45)] px-5 py-3">
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center text-white" style={{ textShadow: '2px 2px 4px black' }}>
                                    <div className="justify-self-center inline-flex items-center justify-end gap-2 min-w-[120px]">
                                        <img src={GUILD_WAR_STAR_IMG} alt="star" className="w-8 h-8" />
                                        <span className="text-4xl font-black tabular-nums">{totalMyStars}</span>
                                    </div>
                                    <span className="mx-4 text-xl font-extrabold text-amber-200/90">VS</span>
                                    <div className="justify-self-center inline-flex items-center justify-start gap-2 min-w-[120px]">
                                        <span className="text-4xl font-black tabular-nums">{totalOpponentStars}</span>
                                        <img src={GUILD_WAR_STAR_IMG} alt="star" className="w-8 h-8" />
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center justify-end text-[12px] font-semibold text-slate-100/95">
                                    <span className="text-amber-200/95">동점 시 집점수 비교</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-sm font-bold text-cyan-100 tabular-nums">
                                    <span>집점수 {myTotalHouseScore}</span>
                                    <span>집점수 {opponentTotalHouseScore}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-44 justify-self-end flex flex-col items-center">
                            <div className="relative w-24 h-32">
                                <img src="/images/guild/guildwar/redteam.png" alt="Red Team Flag" className="w-full h-full" />
                                <img src={opponentGuild.icon || opponentGuild.emblem || '/images/guild/profile/icon1.png'} alt="Opponent Guild Emblem" className="absolute top-[30px] left-1/2 -translate-x-1/2 w-14 h-14 object-contain" />
                            </div>
                             <div className="bg-black/60 px-3 py-1 rounded-md -mt-5 z-10 shadow-lg">
                                <span className="font-bold text-white block max-w-[150px] truncate text-center">{opponentGuild.name}</span>
                            </div>
                        </div>
                    </div>
                    
                    {renderGuildWarBoardGrid(false)}
                </div>

                {/* Right Panel */}
                <div className="col-span-1 min-h-0 flex flex-col">
                     <StatusAndViewerPanel
                        team="red"
                        challengingMembers={opponentMembersChallenging}
                        teamUsedTickets={opponentTeamTickets.used}
                        teamTotalTickets={opponentTeamTickets.total}
                        teamTicketsUnknown={opponentTeamTickets.unknown}
                        board={selectedBoard}
                    />
                </div>
                </main>
            )}

            {isNativeMobile && (
                <>
                    <div
                        aria-hidden={!mySituationDrawerOpen}
                        className={`fixed inset-0 z-[10050] bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ${
                            mySituationDrawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                        }`}
                        onClick={() => setMySituationDrawerOpen(false)}
                    />
                    <aside
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="guild-war-my-situation-title"
                        aria-hidden={!mySituationDrawerOpen}
                        className={`fixed top-0 right-0 z-[10051] flex h-[100dvh] max-h-[100dvh] w-[min(92vw,22rem)] flex-col border-l border-white/20 bg-gray-950/98 shadow-[-12px_0_32px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
                            mySituationDrawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
                        }`}
                        style={{
                            paddingTop: 'env(safe-area-inset-top, 0px)',
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                        }}
                    >
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
                            <h2 id="guild-war-my-situation-title" className="text-base font-bold text-white" style={{ textShadow: '1px 1px 3px black' }}>
                                우리 길드 상황판
                            </h2>
                            <button
                                type="button"
                                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
                                onClick={() => setMySituationDrawerOpen(false)}
                            >
                                닫기
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
                            <StatusAndViewerPanel
                                team="blue"
                                challengingMembers={myMembersChallenging}
                                teamUsedTickets={myTeamTickets.used}
                                teamTotalTickets={myTeamTickets.total}
                                board={selectedBoard}
                                personalTicketsRemaining={personalTicketsRemaining}
                                personalTicketsTotal={personalTicketTotal}
                            />
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
};

export default GuildWar;
