import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import { GuildWar as GuildWarType } from '../../types/index.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import {
    BLACK_BASE_STONE_IMG,
    WHITE_BASE_STONE_IMG,
    BLACK_HIDDEN_STONE_IMG,
} from '../../assets.js';
import {
    getGuildWarStarConditionLines,
    GUILD_WAR_PERSONAL_DAILY_ATTEMPTS,
    GUILD_WAR_HIDDEN_STONE_COUNT,
    GUILD_WAR_SCAN_COUNT,
    GUILD_WAR_MISSILE_COUNT,
    AVATAR_POOL,
    ADMIN_USER_ID,
} from '../../constants/index.js';
import { getTodayKSTDateString } from '../../utils/timeUtils.js';

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
const GUILD_WAR_CAPTURE_TURN_LIMIT = 15;
const GUILD_WAR_AUTO_SCORING_TURN_LIMIT = 60;
const GUILD_WAR_BOARD_ORDER = ['top-left', 'top-mid', 'top-right', 'mid-left', 'center', 'mid-right', 'bottom-left', 'bottom-mid', 'bottom-right'] as const;
const getGuildWarBoardMode = (boardId: string): 'capture' | 'hidden' | 'missile' => {
    if (boardId === 'top-left' || boardId === 'top-mid' || boardId === 'top-right') return 'capture';
    if (boardId === 'mid-left' || boardId === 'center' || boardId === 'mid-right') return 'missile';
    return 'hidden';
};

type InitialStoneCounts = {
    blackPlain: number;
    whitePlain: number;
    blackMarked: number;
    whiteMarked: number;
};

function parseInitialStoneCounts(board: any): InitialStoneCounts {
    const raw = board?.initialStones?.[0] ?? board?.initialStones;
    if (!raw || typeof raw !== 'object') {
        return { blackPlain: 0, whitePlain: 0, blackMarked: 0, whiteMarked: 0 };
    }
    const hasSplit =
        'blackPlain' in raw ||
        'blackMarked' in raw ||
        'whitePlain' in raw ||
        'whiteMarked' in raw;
    if (hasSplit) {
        return {
            blackPlain: Number(raw.blackPlain ?? 0) || 0,
            whitePlain: Number(raw.whitePlain ?? 0) || 0,
            blackMarked: Number(raw.blackMarked ?? 0) || 0,
            whiteMarked: Number(raw.whiteMarked ?? 0) || 0,
        };
    }
    return {
        blackPlain: Number(raw.black ?? 0) || 0,
        whitePlain: Number(raw.white ?? 0) || 0,
        blackMarked: 0,
        whiteMarked: 0,
    };
}

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
    return { war, guildsData, guildWarTicketSummary };
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
    occupierLevel?: number;
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
    const FETCH_COOLDOWN = 10000; // 10초 쿨다운
    
    // 길드전 데이터 가져오기
    useEffect(() => {
        const fetchWarData = async () => {
            if (!currentUserWithStatus?.guildId) return;
            
            // 이미 fetch 중이거나 쿨다운 중이면 스킵
            const now = Date.now();
            if (isFetchingRef.current || (now - lastFetchTimeRef.current < FETCH_COOLDOWN)) {
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

                const { war, guildsData, guildWarTicketSummary } = readGuildWarApiResult(result);

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
                    
                    // 점령자 결정
                    let ownerGuildId: string | undefined = undefined;
                    if (board.guild1BestResult && board.guild2BestResult) {
                        // 별 개수 비교
                        if (board.guild1BestResult.stars > board.guild2BestResult.stars) {
                            ownerGuildId = war.guild1Id;
                        } else if (board.guild2BestResult.stars > board.guild1BestResult.stars) {
                            ownerGuildId = war.guild2Id;
                        } else {
                            // 따낸 돌 비교
                            if (board.guild1BestResult.captures > board.guild2BestResult.captures) {
                                ownerGuildId = war.guild1Id;
                            } else if (board.guild2BestResult.captures > board.guild1BestResult.captures) {
                                ownerGuildId = war.guild2Id;
                            } else {
                                // 집 차이 비교
                                if (board.guild1BestResult.scoreDiff !== undefined && board.guild2BestResult.scoreDiff !== undefined) {
                                    if (board.guild1BestResult.scoreDiff > board.guild2BestResult.scoreDiff) {
                                        ownerGuildId = war.guild1Id;
                                    } else if (board.guild2BestResult.scoreDiff > board.guild1BestResult.scoreDiff) {
                                        ownerGuildId = war.guild2Id;
                                    }
                                }
                                // 먼저 도전 성공한 사람
                                if (!ownerGuildId) {
                                    ownerGuildId = board.guild1BestResult.completedAt < board.guild2BestResult.completedAt 
                                        ? war.guild1Id : war.guild2Id;
                                }
                            }
                        }
                    } else if (board.guild1BestResult) {
                        ownerGuildId = war.guild1Id;
                    } else if (board.guild2BestResult) {
                        ownerGuildId = war.guild2Id;
                    }
                    
                    const bestResult = myBestResult || opponentBestResult;
                    const userMap = new Map(allUsers.map(u => [u.id, u]));
                    const bestUser = bestResult ? userMap.get(bestResult.userId) : null;
                    const initialStoneCounts = parseInitialStoneCounts(board);

                    let occupierNickname: string | undefined;
                    let occupierIsMyGuild = false;
                    if (ownerGuildId) {
                        occupierIsMyGuild = ownerGuildId === myGuildId;
                        const holderResult =
                            ownerGuildId === war.guild1Id ? board.guild1BestResult : board.guild2BestResult;
                        if (holderResult) {
                            const occUser = userMap.get(holderResult.userId);
                            const uid = String(holderResult.userId ?? '');
                            occupierNickname =
                                occUser?.nickname ??
                                (uid.includes('bot') || uid === 'demo-bot' ? 'AI 선수' : '알 수 없음');
                            const avatarId = (occUser as any)?.avatarId;
                            const avatarUrl = AVATAR_POOL.find((a: any) => a.id === avatarId)?.url;
                            (board as any).occupierAvatarUrl = avatarUrl || '/images/guild/profile/icon1.png';
                            (board as any).occupierLevel = (Number((occUser as any)?.strategyLevel ?? 0) || 0) + (Number((occUser as any)?.playfulLevel ?? 0) || 0);
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
                        boardSize: board.boardSize || 13,
                        highestScorer: bestUser?.nickname,
                        scoreDiff: bestResult?.scoreDiff,
                        initialStones: board.initialStones?.[0] || {
                            black: initialStoneCounts.blackPlain,
                            white: initialStoneCounts.whitePlain,
                        },
                        initialStoneCounts,
                        ownerGuildId,
                        gameMode: board.gameMode,
                        occupierNickname,
                        occupierAvatarUrl: (board as any).occupierAvatarUrl,
                        occupierLevel: (board as any).occupierLevel,
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
                
                const todayKST = getTodayKSTDateString();
                const uid = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
                const myAttempts = war.dailyAttempts?.[uid]?.[todayKST] || 0;
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
                    const interval = setInterval(updateRemainingTime, 60000); // 1분마다 업데이트
                    return () => clearInterval(interval);
                }
            } catch (error) {
                console.error('[GuildWar] Error fetching war data:', error);
            } finally {
                isFetchingRef.current = false;
            }
        };
        
        // 초기 로드 시에만 실행하고, 이후에는 interval만 사용
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            fetchWarData();
        }
        
        // 30초마다 갱신 (초기 로드 후)
        const interval = setInterval(() => {
            fetchWarData();
        }, 30000);
        
        return () => {
            clearInterval(interval);
            // 컴포넌트 언마운트 시에만 초기화 플래그 리셋
            hasInitializedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserWithStatus?.guildId]); // guilds와 allUsers를 의존성에서 제거하여 무한 루프 방지
    
    // 바둑판 클릭 시 도전
    const handleBoardClick = async (board: Board) => {
        if (!activeWar || !currentUserWithStatus?.guildId) return;
        
        // 데모 모드에서는 도전 횟수 제한 없음
        if (!isDemoMode) {
            // 하루 도전 횟수 확인
            if (myDailyAttempts >= GUILD_WAR_PERSONAL_DAILY_LIMIT) {
                alert(`오늘 도전 횟수를 모두 사용했습니다. (하루 ${GUILD_WAR_PERSONAL_DAILY_LIMIT}회)`);
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
    
    // 데모 모드 시작
    const startDemoMode = () => {
        if (!currentUserWithStatus?.guildId) {
            alert('길드에 가입되어 있지 않습니다.');
            return;
        }
        
        const myGuildId = currentUserWithStatus.guildId;
        const myGuildData = guilds[myGuildId] ?? {
            id: myGuildId,
            name: '내 길드',
            icon: '/images/guild/profile/icon1.png',
            members: [],
        };
        
        // 데모용 가짜 전쟁 데이터 생성
        const demoWar: any = {
            id: 'demo-war',
            guild1Id: myGuildId,
            guild2Id: 'demo-opponent-guild',
            status: 'active',
            startTime: Date.now(),
            endTime: Date.now() + (48 * 60 * 60 * 1000),
            boards: {},
        };
        
        // 9개 바둑판 초기화
        const boardIds = [...GUILD_WAR_BOARD_ORDER];
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
        
        boardIds.forEach(boardId => {
            const gameMode = getGuildWarBoardMode(boardId);
            demoWar.boards[boardId] = {
                boardSize: 13,
                gameMode: gameMode,
                guild1Stars: 0,
                guild2Stars: Math.floor(Math.random() * 2) + 2, // 봇이 2-3개 별 획득
                guild1BestResult: null,
                guild2BestResult: {
                    userId: 'demo-bot',
                    stars: Math.floor(Math.random() * 2) + 2,
                    captures: Math.floor(Math.random() * 10) + 5,
                    score: 100 + Math.floor(Math.random() * 50),
                    scoreDiff: Math.floor(Math.random() * 11) + 5, // 5-15집 차이
                },
                guild1Attempts: 0,
                guild2Attempts: 3, // 봇은 이미 3번 공격 완료
                initialStones: [
                    {
                        blackPlain: 2,
                        whitePlain: 2,
                        blackMarked: 1,
                        whiteMarked: 1,
                    },
                ],
            };
        });
        
        // 데모용 상대 길드 생성
        const demoOpponentGuild = {
            id: 'demo-opponent-guild',
            name: '데모 상대 길드',
            icon: '/images/guild/profile/icon1.png',
        };
        
        // 바둑판 데이터 변환
        const convertedBoards: Board[] = boardIds.map(boardId => {
            const board = demoWar.boards[boardId];
            const initialStoneCounts = parseInitialStoneCounts(board);
            const ownerG = board.guild2BestResult ? demoOpponentGuild.id : undefined;
            return {
                id: boardId,
                name: boardNames[boardId],
                myStars: board.guild1Stars || 0,
                opponentStars: board.guild2Stars || 0,
                boardSize: board.boardSize || 13,
                ownerGuildId: ownerG,
                gameMode: board.gameMode,
                initialStoneCounts,
                initialStones: board.initialStones?.[0],
                occupierNickname: board.guild2BestResult ? '데모 봇' : undefined,
                occupierAvatarUrl: board.guild2BestResult ? '/images/guild/profile/icon1.png' : undefined,
                occupierLevel: 0,
                occupierCaptures: board.guild2BestResult?.captures,
                occupierScoreDiff: board.guild2BestResult?.scoreDiff,
                occupierIsMyGuild: false,
                myGuildBoardAttempts: board.guild1Attempts ?? 0,
                opponentGuildBoardAttempts: board.guild2Attempts ?? 0,
                scoreDiff: board.guild2BestResult?.scoreDiff,
            };
        });
        
        setActiveWar(demoWar);
        setMyGuild(myGuildData);
        setOpponentGuild(demoOpponentGuild);
        setBoards(convertedBoards);
        setIsDemoMode(true);
        setMyDailyAttempts(0);
        const demoRosterN = Math.min(10, myGuildData.members?.length || 1);
        setMyTeamTickets({ used: 0, total: demoRosterN * GUILD_WAR_PERSONAL_DAILY_LIMIT });
        setOpponentTeamTickets({ used: 0, total: 0, unknown: true });
        setRemainingTime('데모 모드');
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
                        <Button
                            onClick={startDemoMode}
                            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg hover:shadow-xl px-6 py-3 text-lg font-semibold"
                        >
                            🎮 데모 버전 입장
                        </Button>
                        <p className="text-sm text-gray-300 mt-4">데모 버전에서는 테스트용 전쟁을 체험할 수 있습니다.</p>
                    </div>
                </main>
            </div>
        );
    }

    const personalTicketTotal = GUILD_WAR_PERSONAL_DAILY_LIMIT;
    const personalTicketsRemaining = isDemoMode
        ? personalTicketTotal
        : Math.max(0, personalTicketTotal - myDailyAttempts);

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
                                <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                                    <img
                                        src={board.occupierAvatarUrl || '/images/guild/profile/icon1.png'}
                                        alt=""
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-white/30 shadow shrink-0"
                                    />
                                    <div className="min-w-0 flex-1 text-right">
                                        <span className="text-sm sm:text-base font-bold text-slate-100 truncate block" title={board.occupierNickname}>
                                            {board.occupierNickname}
                                        </span>
                                        <span className="text-[10px] sm:text-[11px] text-slate-200/85">
                                            Lv.{Math.max(0, Number(board.occupierLevel ?? 0) || 0)}
                                        </span>
                                        {(board.gameMode === 'capture' || board.gameMode === 'hidden' || board.gameMode === 'missile') && (
                                            <span className="text-[10px] sm:text-[11px] text-amber-200/90">
                                                {board.gameMode === 'capture'
                                                    ? `점령 기록: 따낸 돌 ${board.occupierCaptures ?? 0}개`
                                                    : `점령 기록: 집 차이 ${board.occupierScoreDiff ?? 0}집`}
                                            </span>
                                        )}
                                    </div>
                                </div>
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
                                            <div className="col-span-2 flex items-center gap-2 rounded-lg bg-slate-900/55 border border-slate-600/40 px-2.5 py-2">
                                                <img src="/images/icon/timer.png" alt="" className="w-7 h-7 object-contain shrink-0 rounded-md bg-black/20 p-1" />
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">턴 제한</p>
                                                    <p className="text-sm font-bold text-sky-100">
                                                        {board.gameMode === 'capture'
                                                            ? `${GUILD_WAR_CAPTURE_TURN_LIMIT}턴`
                                                            : `계가까지 ${GUILD_WAR_AUTO_SCORING_TURN_LIMIT}턴`}
                                                    </p>
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
                                        {getGuildWarStarConditionLines(board.gameMode).map((line, i) => (
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

                                <div className="rounded-lg bg-slate-900/45 border border-slate-600/35 px-2.5 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 text-center">아이템</p>
                                    {board.gameMode === 'capture' ? (
                                        <p className="text-center text-xs text-slate-400">아이템 없음</p>
                                    ) : board.gameMode === 'hidden' ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5">
                                                <img src={GUILD_WAR_HIDDEN_ICON} alt="" className="w-6 h-6 object-contain shrink-0" />
                                                <div>
                                                    <p className="text-[9px] text-slate-400">히든</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100">{GUILD_WAR_HIDDEN_STONE_COUNT}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5">
                                                <img src={GUILD_WAR_SCAN_ICON} alt="" className="w-6 h-6 object-contain shrink-0" />
                                                <div>
                                                    <p className="text-[9px] text-slate-400">스캔</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100">{GUILD_WAR_SCAN_COUNT}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5">
                                                <img src={GUILD_WAR_MISSILE_ICON} alt="" className="w-6 h-6 object-contain shrink-0" />
                                                <div>
                                                    <p className="text-[9px] text-slate-400">미사일</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100">{GUILD_WAR_MISSILE_COUNT}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

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
        <div className="h-full w-full flex flex-col bg-tertiary text-primary p-4 bg-cover bg-center" style={{ backgroundImage: "url('/images/guild/guildwar/warmap.png')" }}>
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
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
                <h1 className="text-3xl font-bold text-white" style={{textShadow: '2px 2px 5px black'}}>
                    길드 전쟁 {isDemoMode && <span className="text-lg text-yellow-400">(데모)</span>}
                </h1>
                 <div className="w-40 text-right">
                    <p className="text-sm text-white font-semibold" style={{textShadow: '1px 1px 3px black'}}>
                        {isDemoMode ? '데모 모드' : (remainingTime || '계산 중...')}
                    </p>
                </div>
            </header>
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
                    
                    <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-x-8 gap-y-4">
                        {boards.map(board => {
                            // 점령 상태 결정: ownerGuildId가 있으면 사용, 없으면 별 개수 비교
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
                            
                            return (
                                <div key={board.id} className={`relative flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${isSelected ? 'scale-110' : 'hover:scale-105'}`} 
                                    onClick={() => setSelectedBoard(board)}>
                                    <StarDisplay count={board.myStars} size="w-5 h-5"/>
                                    <div className="relative flex items-center justify-center">
                                        {/* 좌측 파란 깃발 */}
                                        {isMyGuildOccupied && (
                                            <img 
                                                src="/images/guild/guildwar/blueflag.png" 
                                                alt="Blue Flag" 
                                                className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-8 h-8 z-10" 
                                            />
                                        )}
                                        <img 
                                            src="/images/guild/guildwar/board.png" 
                                            alt="Go Board" 
                                            className={`w-24 h-24 ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}
                                        />
                                        {/* 우측 빨간 깃발 */}
                                        {isOpponentOccupied && (
                                            <img 
                                                src="/images/guild/guildwar/redflag.png" 
                                                alt="Red Flag" 
                                                className="absolute right-0 top-1/2 translate-x-full -translate-y-1/2 w-8 h-8 z-10" 
                                            />
                                        )}
                                    </div>
                                    <span className="bg-black/60 px-2 py-0.5 rounded-md text-sm font-semibold -mt-2">{board.name}</span>
                                    <StarDisplay count={board.opponentStars} size="w-5 h-5"/>
                                </div>
                            );
                        })}
                    </div>
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
        </div>
    );
};

export default GuildWar;
