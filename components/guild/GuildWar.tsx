import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
    getGuildWarBoardOwnerGuildId,
    getGuildWarBoardOwnerGuildIdWithBotAttemptsFallback,
    getGuildWarBotBoardDisplayTally,
} from '../../shared/utils/guildWarBoardOwner.js';
import { GUILD_WAR_BOT_GUILD_ID } from '../../shared/constants/auth.js';
import { GuildWarUnifiedScoreboard } from './GuildWarUnifiedScoreboard.js';

const GUILD_WAR_PERSONAL_DAILY_LIMIT = GUILD_WAR_PERSONAL_DAILY_ATTEMPTS;

const GUILD_WAR_TICKET_IMG = '/images/guild/warticket.png';
const GUILD_WAR_BOARD_IMG = '/images/guild/guildwar/board.png';
const GUILD_WAR_BLUE_FLAG = '/images/guild/guildwar/blueflag.png';
const GUILD_WAR_RED_FLAG = '/images/guild/guildwar/redflag.png';
const GUILD_WAR_STAR_IMG = '/images/guild/guildwar/clearstar.png';
const GUILD_WAR_EMPTY_STAR_IMG = '/images/guild/guildwar/emptystar.png';
const GUILD_WAR_BLUE_TEAM_BANNER = '/images/guild/guildwar/blueteam.png';
const GUILD_WAR_RED_TEAM_BANNER = '/images/guild/guildwar/redteam.png';
const GUILD_WAR_MISSILE_ICON = '/images/button/missile.png';
const GUILD_WAR_HIDDEN_ICON = '/images/button/hidden.png';
const GUILD_WAR_SCAN_ICON = '/images/button/scan.png';

/** 서버 `GUILD_WAR_UPDATE` 브로드캐스트 → 대기실 즉시 GET_GUILD_WAR_DATA (hooks/useApp.ts에서 dispatch) */
const GUILD_WAR_LOBBY_REFRESH_EVENT = 'sudamr:guild-war-update';

/**
 * 서버 `guild1`/`guild2`는 데이터 슬롯일 뿐이고, UI 청팀/홍팀은 전쟁마다 의사난수로 정해 모든 클라이언트가 동일하게 본다.
 * `true` → guild1이 청(좌)·guild2가 홍(우) UI에 대응.
 */
function guild1IsVisualBlueSide(war: { id?: string; guild1Id: string; guild2Id: string }): boolean {
    const [a, b] =
        war.guild1Id < war.guild2Id ? [war.guild1Id, war.guild2Id] : [war.guild2Id, war.guild1Id];
    const warId = war.id ?? `${war.guild1Id}-${war.guild2Id}`;
    const str = `${warId}|${a}|${b}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return (h & 1) === 0;
}

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
    /** 청팀(guild1) / 홍팀(guild2) 별 — 선택 칸 좌우 표시용 */
    guild1Stars: number;
    guild2Stars: number;
}

type MyGuildWarAttemptLogRow = {
    gameId: string;
    boardId: string;
    boardName: string;
    modeLabel: string;
    outcome: 'win' | 'lose' | 'draw';
    stars: number;
    captures: number;
    scoreDiff?: number;
    houseScore?: number;
    endedAtMs: number;
    detailSummary?: string;
};

const GuildWar = () => {
    const { currentUserWithStatus, currentUser, guilds, handlers, allUsers } = useAppContext();
    /** 세션/WS 타이밍으로 WithStatus에만 늦게 붙는 경우 대비 */
    const effectiveGuildId = currentUserWithStatus?.guildId ?? currentUser?.guildId ?? '';
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
    const [myAttemptLogOpen, setMyAttemptLogOpen] = useState(false);
    const [myAttemptLogLoading, setMyAttemptLogLoading] = useState(false);
    const [myAttemptLogRows, setMyAttemptLogRows] = useState<MyGuildWarAttemptLogRow[]>([]);
    const [myAttemptLogUsed, setMyAttemptLogUsed] = useState(0);
    const [myAttemptLogMax, setMyAttemptLogMax] = useState(GUILD_WAR_PERSONAL_DAILY_LIMIT);
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
    const pendingForceRef = useRef(false);
    const fetchWarDataRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
    const FETCH_COOLDOWN = 10000; // 10초 쿨다운
    const [warListLoading, setWarListLoading] = useState(!!effectiveGuildId);

    // 길드전 데이터 가져오기
    useEffect(() => {
        const gid = effectiveGuildId;
        if (!gid) {
            setWarListLoading(false);
            return;
        }

        let cancelled = false;
        lastFetchTimeRef.current = 0;
        let remainingTimeInterval: ReturnType<typeof setInterval> | null = null;
        setWarListLoading(true);

        const fetchWarData = async (force = false) => {
            if (!gid || cancelled) return;

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
                if (cancelled) return;
                if (result?.error) {
                    console.error('[GuildWar] Failed to fetch war data:', result.error);
                    replaceAppHash('#/guild');
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
                    replaceAppHash('#/guild');
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
                const myGuildId = gid;
                const opponentGuildId = war.guild1Id === myGuildId ? war.guild2Id : war.guild1Id;
                const isBotWar = !!(war as any).isBotGuild || opponentGuildId === GUILD_WAR_BOT_GUILD_ID;
                let myGuildData = guildsData[myGuildId] as any;
                let opponentGuildData = guildsData[opponentGuildId] as any;
                if (!myGuildData) {
                    myGuildData = { id: myGuildId, name: '길드', level: 1, members: [], leaderId: myGuildId };
                }
                if (!opponentGuildData) {
                    opponentGuildData =
                        isBotWar || opponentGuildId === GUILD_WAR_BOT_GUILD_ID
                            ? {
                                  id: opponentGuildId,
                                  name: '[시스템] 길드전 AI',
                                  level: 1,
                                  members: [],
                                  leaderId: opponentGuildId,
                              }
                            : {
                                  id: opponentGuildId,
                                  name: '상대 길드',
                                  level: 1,
                                  members: [],
                                  leaderId: opponentGuildId,
                              };
                }

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
                    const myBestResult = isGuild1 ? board.guild1BestResult : board.guild2BestResult;
                    const opponentBestResult = isGuild1 ? board.guild2BestResult : board.guild1BestResult;

                    // 점령자: 기록 기준 → 봇전이면 칸별 도전권 소모(guild1/2Attempts)로 표시 (봇 스크립트와 동일)
                    const ownerGuildId = isBotWar
                        ? getGuildWarBoardOwnerGuildIdWithBotAttemptsFallback(
                              board,
                              war.guild1Id,
                              war.guild2Id,
                              GUILD_WAR_BOT_GUILD_ID,
                          )
                        : getGuildWarBoardOwnerGuildId(board, war.guild1Id, war.guild2Id);

                    const displayTally = getGuildWarBotBoardDisplayTally(board, {
                        warId: String(war.id),
                        boardId,
                        guild1Id: war.guild1Id,
                        guild2Id: war.guild2Id,
                        botGuildId: GUILD_WAR_BOT_GUILD_ID,
                        isBotWar,
                    });
                    const myStars = isGuild1 ? displayTally.guild1Stars : displayTally.guild2Stars;
                    const opponentStars = isGuild1 ? displayTally.guild2Stars : displayTally.guild1Stars;
                    
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
                        } else if (ownerGuildId === GUILD_WAR_BOT_GUILD_ID) {
                            const seeded = guildWarBotSeededDisplay(String(war.id), boardId, String(aiUserId));
                            occupierNickname = getGuildWarAiBotDisplayName(boardId);
                            (board as any).occupierAvatarUrl = seeded.avatarUrl;
                            (board as any).occupierBorderId = 'default';
                            (board as any).occupierLevel = seeded.level;
                            (board as any).occupierIsAiBot = true;
                            if (displayTally.occupierCapturesDisplay != null) {
                                (board as any).occupierCaptures = displayTally.occupierCapturesDisplay;
                            }
                            if (displayTally.occupierScoreDiffDisplay != null) {
                                (board as any).occupierScoreDiff = displayTally.occupierScoreDiffDisplay;
                            }
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
                        guild1Stars: displayTally.guild1Stars,
                        guild2Stars: displayTally.guild2Stars,
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
                
                const uid =
                    currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : (currentUserWithStatus?.id ?? currentUser?.id ?? '');
                const myAttempts = currentUserWithStatus?.isAdmin
                    ? 0
                    : (Number((war as any).userAttempts?.[uid] ?? 0) || 0);
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
                replaceAppHash('#/guild');
            } finally {
                isFetchingRef.current = false;
                if (pendingForceRef.current) {
                    pendingForceRef.current = false;
                    void fetchWarData(true);
                }
                if (!cancelled) setWarListLoading(false);
            }
        };

        fetchWarDataRef.current = fetchWarData;

        // guildId가 생기거나 길드가 바뀔 때마다 즉시 강제 로드 (이전 hasInitializedRef는 지연 guildId에서 영구 스킵 유발)
        void fetchWarData(true);

        const interval = setInterval(() => {
            void fetchWarData();
        }, 30000);
        
        return () => {
            cancelled = true;
            clearInterval(interval);
            if (remainingTimeInterval) {
                clearInterval(remainingTimeInterval);
                remainingTimeInterval = null;
            }
            isFetchingRef.current = false;
            pendingForceRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveGuildId]); // guilds·allUsers는 의존성에서 제외 (무한 루프 방지)

    useEffect(() => {
        const onWarUpdate = () => {
            void fetchWarDataRef.current?.(false);
        };
        window.addEventListener(GUILD_WAR_LOBBY_REFRESH_EVENT, onWarUpdate);
        return () => window.removeEventListener(GUILD_WAR_LOBBY_REFRESH_EVENT, onWarUpdate);
    }, []);

    /** 길드 미가입 시 길드전 URL로 들어온 경우 */
    useEffect(() => {
        const uid = currentUserWithStatus?.id ?? currentUser?.id;
        if (!uid) return;
        if (!effectiveGuildId) {
            replaceAppHash('#/guild');
        }
    }, [currentUserWithStatus?.id, currentUser?.id, effectiveGuildId]);

    // 바둑판 클릭 시 도전
    const handleBoardClick = async (board: Board) => {
        if (!activeWar || !effectiveGuildId) return;
        if ((activeWar as any).status !== 'active') {
            alert('종료된 길드 전쟁에서는 도전할 수 없습니다.');
            return;
        }
        
        // 데모 모드에서는 도전 횟수 제한 없음
        if (!isDemoMode && !currentUserWithStatus?.isAdmin) {
            // 하루 도전 횟수 확인 (관리자는 테스트용 무제한)
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

    const openMyAttemptLogModal = useCallback(async () => {
        if (isDemoMode) return;
        setMyAttemptLogOpen(true);
        setMyAttemptLogLoading(true);
        try {
            const result = (await handlers.handleAction({ type: 'GET_MY_GUILD_WAR_ATTEMPT_LOG' })) as any;
            if (result?.error) {
                setMyAttemptLogRows([]);
                alert(String(result.error));
                return;
            }
            const cr = result?.clientResponse ?? result;
            setMyAttemptLogRows(Array.isArray(cr?.myGuildWarAttemptLog) ? cr.myGuildWarAttemptLog : []);
            setMyAttemptLogUsed(Number(cr?.attemptsUsedInWar ?? 0) || 0);
            setMyAttemptLogMax(Number(cr?.attemptsMax ?? GUILD_WAR_PERSONAL_DAILY_LIMIT) || GUILD_WAR_PERSONAL_DAILY_LIMIT);
        } catch (e) {
            console.error('[GuildWar] GET_MY_GUILD_WAR_ATTEMPT_LOG', e);
            setMyAttemptLogRows([]);
            alert('기록을 불러오지 못했습니다.');
        } finally {
            setMyAttemptLogLoading(false);
        }
    }, [handlers, isDemoMode]);
    
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
    
    const warMapBgClass = `flex min-h-full w-full flex-col bg-tertiary bg-cover bg-center text-primary ${isNativeMobile ? 'p-2' : 'p-4'}`;
    const warMapBgStyle = { backgroundImage: "url('/images/guild/guildwar/warmap.png')" } as const;

    if (!activeWar || !myGuild || !opponentGuild) {
        if (effectiveGuildId && warListLoading) {
            return (
                <div className={`${warMapBgClass} items-center justify-center gap-3 text-primary`} style={warMapBgStyle}>
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400/70 border-t-transparent" aria-hidden />
                    <p className="text-sm font-semibold text-amber-100/90">길드전 정보를 불러오는 중…</p>
                </div>
            );
        }
        return null;
    }

    const personalTicketTotal = GUILD_WAR_PERSONAL_DAILY_LIMIT;
    const personalTicketsRemaining =
        isDemoMode || currentUserWithStatus?.isAdmin
            ? personalTicketTotal
            : Math.max(0, personalTicketTotal - myDailyAttempts);

    /** 서버 데이터 슬롯: guild1 / guild2 (별·집점수 필드와 동일) */
    const weAreGuild1 = activeWar.guild1Id === myGuild.id;
    const guild1IsBlueVisual = guild1IsVisualBlueSide(activeWar);
    /** UI 청(좌)·홍(우) — 우리가 홍이면 기존과 반대로 깃발·별·집점수 열이 맞춰진다. */
    const weAreVisualBlue = guild1IsBlueVisual ? weAreGuild1 : !weAreGuild1;
    const visualBlueTeamStars = boards.reduce(
        (sum, b) => sum + (guild1IsBlueVisual ? (b.guild1Stars ?? 0) : (b.guild2Stars ?? 0)),
        0,
    );
    const visualRedTeamStars = boards.reduce(
        (sum, b) => sum + (guild1IsBlueVisual ? (b.guild2Stars ?? 0) : (b.guild1Stars ?? 0)),
        0,
    );
    const isBotWarView =
        !!(activeWar as any).isBotGuild ||
        opponentGuild.id === GUILD_WAR_BOT_GUILD_ID ||
        myGuild.id === GUILD_WAR_BOT_GUILD_ID;
    let blueTotalHouseScore = 0;
    let redTotalHouseScore = 0;
    Object.entries(activeWar.boards || {}).forEach(([boardId, board]: [string, any]) => {
        const tally = getGuildWarBotBoardDisplayTally(board, {
            warId: String(activeWar.id),
            boardId,
            guild1Id: activeWar.guild1Id,
            guild2Id: activeWar.guild2Id,
            botGuildId: GUILD_WAR_BOT_GUILD_ID,
            isBotWar: isBotWarView,
        });
        const g1House = tally.guild1HouseTally;
        const g2House = tally.guild2HouseTally;
        blueTotalHouseScore += guild1IsBlueVisual ? g1House : g2House;
        redTotalHouseScore += guild1IsBlueVisual ? g2House : g1House;
    });

    const visualBlueGuild = weAreVisualBlue ? myGuild : opponentGuild;
    const visualRedGuild = weAreVisualBlue ? opponentGuild : myGuild;

    /** 상황판 선택 맵: 우리 길드 vs 상대 집점(보드별) */
    const houseForSituationBoard = ((): { ours: number; theirs: number } => {
        if (!selectedBoard?.id || !activeWar?.boards) return { ours: 0, theirs: 0 };
        const raw = (activeWar.boards as Record<string, unknown>)[selectedBoard.id];
        if (raw == null) return { ours: 0, theirs: 0 };
        const tally = getGuildWarBotBoardDisplayTally(raw as any, {
            warId: String(activeWar.id),
            boardId: selectedBoard.id,
            guild1Id: activeWar.guild1Id,
            guild2Id: activeWar.guild2Id,
            botGuildId: GUILD_WAR_BOT_GUILD_ID,
            isBotWar: isBotWarView,
        });
        const g1 = tally.guild1HouseTally;
        const g2 = tally.guild2HouseTally;
        return { ours: weAreGuild1 ? g1 : g2, theirs: weAreGuild1 ? g2 : g1 };
    })();

    /** 바둑판 칸: 선택 여부와 관계없이 청/홍 날개 + 중앙 보드 레이아웃 유지 (선택 시 링·강조만 추가) */
    const renderGuildWarBoardCell = (board: Board, compact: boolean, onAfterSelectBoard?: () => void) => {
        let ownerGuildId: string | undefined = board.ownerGuildId;
        if (!ownerGuildId) {
            if (board.myStars > board.opponentStars) {
                ownerGuildId = myGuild.id;
            } else if (board.opponentStars > board.myStars) {
                ownerGuildId = opponentGuild.id;
            }
        }

        const isSelected = selectedBoard?.id === board.id;
        const g1Stars = board.guild1Stars ?? 0;
        const g2Stars = board.guild2Stars ?? 0;
        const visualBlueStars = guild1IsBlueVisual ? g1Stars : g2Stars;
        const visualRedStars = guild1IsBlueVisual ? g2Stars : g1Stars;
        const myOccupationFlagSrc = weAreVisualBlue ? GUILD_WAR_BLUE_FLAG : GUILD_WAR_RED_FLAG;
        const oppOccupationFlagSrc = weAreVisualBlue ? GUILD_WAR_RED_FLAG : GUILD_WAR_BLUE_FLAG;
        const occupierFlagSrc =
            ownerGuildId === myGuild.id
                ? myOccupationFlagSrc
                : ownerGuildId === opponentGuild.id
                  ? oppOccupationFlagSrc
                  : null;
        const occupierFlagAlt =
            ownerGuildId === myGuild.id ? '우리 길드 점령' : ownerGuildId === opponentGuild.id ? '상대 길드 점령' : '';

        const boardImg = compact ? 'h-[min(29vw,6rem)] w-[min(29vw,6rem)]' : 'h-28 w-28 sm:h-[7.25rem] sm:w-[7.25rem]';
        const occupierFlagClass = compact
            ? 'pointer-events-none absolute left-1/2 top-[29%] z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]'
            : 'pointer-events-none absolute left-1/2 top-[29%] z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_3px_12px_rgba(0,0,0,0.6)] sm:h-12 sm:w-12';
        const starSzWing = compact ? 'h-3.5 w-3.5' : 'h-4 w-4 sm:h-6 sm:w-6';
        const scaleHover = compact ? 'hover:scale-[1.02]' : 'hover:scale-[1.02] hover:shadow-[0_14px_40px_rgba(0,0,0,0.35)]';
        const scaleSel = compact ? 'scale-[1.02]' : 'scale-[1.03]';

        /** 선택 시 바둑판 이미지가 아니라 칸 전체(날개·요약 포함)가 한 덩어로 선택된 느낌 */
        const cellShell = compact
            ? `rounded-xl border bg-gradient-to-b from-black/55 to-stone-900/85 p-1.5 shadow-md ring-1 ring-black/50 ${
                  isSelected
                      ? 'border-amber-200/90 ring-[3px] ring-amber-100/55 shadow-[0_0_28px_rgba(251,191,36,0.45),inset_0_0_0_1px_rgba(253,230,138,0.25)] bg-gradient-to-b from-amber-950/40 via-black/50 to-stone-900/90'
                      : 'border-amber-500/25 hover:border-amber-400/40'
              }`
            : `rounded-2xl border-2 bg-gradient-to-br from-black/70 via-stone-950/85 to-amber-950/30 p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-[2px] ${
                  isSelected
                      ? 'border-amber-200/85 ring-[3px] ring-amber-100/50 shadow-[0_0_48px_rgba(251,191,36,0.38),inset_0_0_0_1px_rgba(253,230,138,0.2)] bg-gradient-to-br from-amber-950/45 via-stone-950/90 to-amber-900/40'
                      : 'border-amber-500/30 hover:border-amber-400/45'
              }`;

        const boardCenter = (
            <div className="relative flex min-w-0 flex-col items-center justify-center gap-0.5">
                <div className="relative flex items-center justify-center">
                    <img src={GUILD_WAR_BOARD_IMG} alt="바둑판" className={`${boardImg} rounded-md shadow-lg`} />
                    {occupierFlagSrc ? (
                        <img src={occupierFlagSrc} alt={occupierFlagAlt} className={occupierFlagClass} />
                    ) : null}
                </div>
                <span
                    className={`max-w-full truncate rounded-md bg-black/65 px-1.5 font-semibold text-amber-50 ring-1 ring-amber-500/20 ${
                        compact ? 'py-0 text-[11px]' : '-mt-1 px-2 py-0.5 text-base shadow-md'
                    }`}
                >
                    {board.name}
                </span>
            </div>
        );

        const wingSelected = !compact && isSelected ? 'shadow-[inset_0_0_24px_rgba(251,191,36,0.14)] ring-1 ring-amber-200/40' : '';

        const wingBlue = (
            <div
                className={`flex w-12 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-sky-500/35 bg-gradient-to-b from-blue-950/65 to-slate-950/90 py-2 shadow-inner sm:w-[4.75rem] sm:py-2.5 ${wingSelected}`}
            >
                <img
                    src={GUILD_WAR_BLUE_TEAM_BANNER}
                    alt=""
                    className="h-9 w-7 object-contain object-top drop-shadow-md sm:h-11 sm:w-9"
                />
                <StarDisplay count={visualBlueStars} size={starSzWing} />
            </div>
        );
        const wingRed = (
            <div
                className={`flex w-12 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-gradient-to-b from-red-950/65 to-slate-950/90 py-2 shadow-inner sm:w-[4.75rem] sm:py-2.5 ${wingSelected}`}
            >
                <img
                    src={GUILD_WAR_RED_TEAM_BANNER}
                    alt=""
                    className="h-9 w-7 object-contain object-top drop-shadow-md sm:h-11 sm:w-9"
                />
                <StarDisplay count={visualRedStars} size={starSzWing} />
            </div>
        );

        const compactWingSummary = (
            <div
                className={`mb-0.5 flex w-full items-center justify-center gap-1 border-b pb-0.5 ${
                    isSelected ? 'border-amber-200/35' : 'border-white/10'
                }`}
            >
                <img src={GUILD_WAR_BLUE_TEAM_BANNER} alt="" className="h-4 w-3.5 object-contain opacity-95" />
                <StarDisplay count={visualBlueStars} size="h-3 w-3" />
                <span className="px-0.5 text-[9px] font-black text-amber-200/90">·</span>
                <StarDisplay count={visualRedStars} size="h-3 w-3" />
                <img src={GUILD_WAR_RED_TEAM_BANNER} alt="" className="h-4 w-3.5 object-contain opacity-95" />
            </div>
        );

        return (
            <div
                key={board.id}
                className={`flex cursor-pointer flex-col transition-all ${cellShell} ${isSelected ? scaleSel : scaleHover}`}
                onClick={() => {
                    setSelectedBoard(board);
                    onAfterSelectBoard?.();
                }}
            >
                {compact ? (
                    <>
                        {compactWingSummary}
                        {boardCenter}
                    </>
                ) : (
                    <div className="flex w-full flex-1 items-center justify-center gap-2.5 sm:gap-5">
                        {wingBlue}
                        {boardCenter}
                        {wingRed}
                    </div>
                )}
            </div>
        );
    };

    const StatusAndViewerPanel: React.FC<{
        /** 청팀/홍팀 UI 색 (우리가 어느 쪽이든 «우리 길드» 수치만 표시) */
        colorSide: 'blue' | 'red';
        challengingMembers: { name: string, board: string, level: number, avatarUrl: string }[];
        /** 출전 명단 기준 길드원 총 도전권 (당일 사용/총량) */
        teamUsedTickets: number;
        teamTotalTickets: number;
        teamTicketsUnknown?: boolean;
        board: Board | null;
        /** 선택 맵 기준 우리·상대 집점(상단 통합 바용) */
        boardHousePair: { ours: number; theirs: number };
        /** 남은 개인 도전권 N/최대 */
        personalTicketsRemaining?: number;
        personalTicketsTotal?: number;
        onOpenMyAttemptLog?: () => void;
        myAttemptLogBusy?: boolean;
        myAttemptLogDisabled?: boolean;
    }> = ({
        colorSide,
        challengingMembers,
        teamUsedTickets,
        teamTotalTickets,
        teamTicketsUnknown,
        board,
        boardHousePair,
        personalTicketsRemaining: myTicketsLeft,
        personalTicketsTotal: myTicketsMax,
        onOpenMyAttemptLog,
        myAttemptLogBusy,
        myAttemptLogDisabled,
    }) => {
        const isBlue = colorSide === 'blue';
        const panelClasses = isBlue ? 'bg-blue-900/50 border-blue-700' : 'bg-red-900/55 border-red-600 ring-1 ring-red-500/30';
        const textClasses = isBlue ? 'text-blue-300' : 'text-red-300';
        const secondaryTextClasses = isBlue ? 'text-blue-200' : 'text-red-200';
        const occupierPanelClasses = isBlue
            ? 'bg-blue-950/30 border-blue-800/60'
            : 'bg-red-950/65 border-red-500/75 ring-1 ring-red-400/25 shadow-inner shadow-red-950/50';
        const detailShellClass = isBlue
            ? 'border-white/10 bg-gradient-to-b from-black/45 via-black/35 to-black/50'
            : 'border-red-900/40 bg-gradient-to-b from-red-950/35 via-black/40 to-black/50';
        const detailAccentText = isBlue ? 'text-sky-100' : 'text-rose-100';
        const perspectiveAttempts = board ? (board.myGuildBoardAttempts ?? 0) : 0;

        return (
            <div className={`flex h-full min-h-0 w-full flex-col gap-2 ${panelClasses} rounded-lg border-2 p-2 sm:p-2.5`}>
                <div className="shrink-0">
                    <h2 className={`mb-1.5 text-center text-lg font-bold sm:text-xl ${textClasses}`}>상황판</h2>
                    <div className="space-y-1.5">
                        <div
                            className={`flex flex-col gap-2 rounded-lg border px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between ${isBlue ? 'border-blue-800/70 bg-blue-950/45' : 'border-red-700/80 bg-red-950/50'}`}
                        >
                            <span className={`min-w-0 shrink text-left text-xs font-semibold leading-snug sm:text-sm ${secondaryTextClasses}`}>
                                길드원 총 도전권
                            </span>
                            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:max-w-[65%]">
                                <div className="flex shrink-0 items-center justify-center gap-2">
                                    <img src={GUILD_WAR_TICKET_IMG} alt="" className="h-7 w-7 shrink-0 object-contain opacity-95 sm:h-8 sm:w-8" />
                                    <span className="text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">
                                        {teamTicketsUnknown ? '—' : `${teamUsedTickets}/${teamTotalTickets}`}
                                    </span>
                                </div>
                                {onOpenMyAttemptLog ? (
                                    <button
                                        type="button"
                                        title={myAttemptLogDisabled ? '데모 모드에서는 이용할 수 없습니다.' : '내가 사용한 도전권 기록'}
                                        disabled={!!myAttemptLogDisabled || !!myAttemptLogBusy}
                                        onClick={() => onOpenMyAttemptLog()}
                                        className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-bold transition sm:text-sm ${
                                            myAttemptLogDisabled || myAttemptLogBusy
                                                ? 'cursor-not-allowed border-white/10 bg-black/20 text-slate-500'
                                                : isBlue
                                                  ? 'border-sky-400/40 bg-sky-600/35 text-sky-50 hover:bg-sky-500/40'
                                                  : 'border-amber-200/35 bg-red-700/40 text-amber-50 hover:bg-red-600/45'
                                        }`}
                                    >
                                        {myAttemptLogBusy ? '불러오는 중…' : '내 도전'}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <div className={`rounded-lg border px-2 py-1.5 sm:px-2.5 sm:py-2 ${occupierPanelClasses}`}>
                            <p className={`mb-1 text-center text-xs font-semibold leading-none sm:text-sm ${secondaryTextClasses}`}>현재 점령자</p>
                            <div className="flex min-h-11 w-full items-center justify-center sm:min-h-12">
                                {!board ? (
                                    <div className="min-h-11 w-full rounded-md border border-dashed border-white/10 bg-black/20 sm:min-h-12" aria-hidden />
                                ) : board.ownerGuildId && board.occupierNickname ? (
                                    <div className="flex min-h-11 w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden sm:min-h-12 sm:gap-2">
                                        <Avatar
                                            userId={board.occupierNickname}
                                            userName={board.occupierNickname}
                                            avatarUrl={board.occupierAvatarUrl || '/images/profiles/profile1.png'}
                                            borderUrl={
                                                BORDER_POOL.find((b) => b.id === (board.occupierBorderId || 'default'))?.url ?? '#FFFFFF'
                                            }
                                            size={40}
                                            className="shrink-0"
                                        />
                                        <span className="shrink-0 whitespace-nowrap text-xs font-black tabular-nums leading-none text-white sm:text-sm">
                                            {board.occupierIsAiBot
                                                ? `AI Lv.${Number(board.occupierLevel ?? 0) || 0}`
                                                : `Lv.${Number(board.occupierLevel ?? 0) || 0}`}
                                        </span>
                                        <span
                                            className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight text-slate-200 sm:text-sm"
                                            title={board.occupierNickname}
                                        >
                                            {board.occupierNickname}
                                        </span>
                                        {board.gameMode === 'capture' || board.gameMode === 'hidden' || board.gameMode === 'missile' ? (
                                            <span
                                                className="max-w-[38%] shrink-0 truncate text-right text-[10px] font-bold leading-tight text-amber-200/95 sm:max-w-[42%] sm:text-xs"
                                                title={
                                                    board.gameMode === 'capture'
                                                        ? `따낸돌 ${board.occupierCaptures ?? 0}개`
                                                        : `집 차이 ${board.occupierScoreDiff ?? 0}집`
                                                }
                                            >
                                                {board.gameMode === 'capture'
                                                    ? `따낸돌 ${board.occupierCaptures ?? 0}개`
                                                    : `차이 ${board.occupierScoreDiff ?? 0}집`}
                                            </span>
                                        ) : (
                                            <span className="shrink-0 text-[10px] font-semibold text-slate-500 sm:text-xs">—</span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="block w-full text-center text-xs text-slate-500 sm:text-sm">없음</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-0.5 flex min-h-0 flex-1 flex-col border-t border-gray-500/40 pt-1">
                    <div
                        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border p-2 text-sm shadow-inner backdrop-blur-sm sm:p-2.5 ${detailShellClass}`}
                    >
                        {board ? (
                            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto text-left">
                                <div className="shrink-0 space-y-1.5 text-center">
                                    <div className="inline-flex max-w-full items-center justify-center rounded-full border border-amber-300/45 bg-gradient-to-r from-amber-600/90 via-amber-500/85 to-yellow-600/90 px-3 py-1 shadow-md">
                                        <span className="truncate text-sm font-black tracking-wide text-stone-900 drop-shadow-sm sm:text-base">
                                            {board.name}
                                        </span>
                                    </div>
                                    <GuildWarUnifiedScoreboard
                                        compact
                                        hideHouseWhenZero
                                        blueStars={board.myStars}
                                        redStars={board.opponentStars}
                                        blueHouse={boardHousePair.ours}
                                        redHouse={boardHousePair.theirs}
                                    />
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
                                        <div className="grid shrink-0 grid-cols-2 gap-1.5">
                                            {board.gameMode === 'capture' && (
                                                <div className="col-span-2 rounded-lg border border-amber-500/25 bg-slate-900/50 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                    <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-200/90 sm:text-xs">
                                                        따내기 목표
                                                    </p>
                                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                                        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                                                            <PlainBlackStoneIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                                                            <span className="text-base font-black tabular-nums text-amber-50 sm:text-lg">
                                                                {getGuildWarCaptureBlackTargetByBoardId(board.id)}점
                                                            </span>
                                                        </div>
                                                        <span className="px-0.5 text-xs font-bold text-slate-500">vs</span>
                                                        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                                                            <PlainWhiteStoneIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                                                            <span className="text-base font-black tabular-nums text-amber-50 sm:text-lg">
                                                                {GUILD_WAR_CAPTURE_AI_TARGET}점
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 rounded-lg border border-slate-600/40 bg-slate-900/55 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                <img src={modeIcon} alt="" className="h-8 w-8 shrink-0 rounded-md bg-black/20 object-contain p-0.5 sm:h-9 sm:w-9" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">모드</p>
                                                    <p className={`text-sm font-bold sm:text-base ${detailAccentText}`}>{modeLabel}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg border border-slate-600/40 bg-slate-900/55 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                <img src={GUILD_WAR_BOARD_IMG} alt="" className="h-8 w-8 shrink-0 rounded-md bg-black/20 object-contain p-0.5 sm:h-9 sm:w-9" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">바둑판</p>
                                                    <p className={`text-sm font-bold sm:text-base ${detailAccentText}`}>{board.boardSize}줄</p>
                                                </div>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2.5 rounded-lg border border-slate-600/40 bg-slate-900/55 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                <img src="/images/icon/timer.png" alt="" className="h-7 w-7 shrink-0 rounded-md bg-black/20 object-contain p-0.5 sm:h-8 sm:w-8" />
                                                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">턴 제한</p>
                                                        <p className={`text-sm font-bold whitespace-nowrap sm:text-base ${detailAccentText}`}>
                                                            {board.gameMode === 'capture'
                                                                ? `${getGuildWarCaptureTurnLimitByBoardId(board.id)}턴`
                                                                : `계가까지 ${getGuildWarAutoScoringTurnsByBoardId(board.id)}턴`}
                                                        </p>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">대국 시계</p>
                                                        <p className={`text-sm font-bold whitespace-nowrap sm:text-base ${detailAccentText}`}>
                                                            {GUILD_WAR_MAIN_TIME_MINUTES}분(피셔 {GUILD_WAR_FISCHER_INCREMENT_SECONDS}초)
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="shrink-0 rounded-lg border border-amber-600/30 bg-amber-950/35 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                    <p className="mb-1 flex shrink-0 items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-200/95 sm:text-sm">
                                        <img src={GUILD_WAR_STAR_IMG} alt="" className="h-4 w-4 shrink-0 opacity-95 sm:h-4 sm:w-4" />
                                        별 획득 조건
                                    </p>
                                    <ul className="space-y-1 text-xs leading-snug text-amber-50/95 sm:text-sm sm:leading-relaxed">
                                        {getGuildWarStarConditionLines(board.gameMode, board.id).map((line, i) => (
                                            <li key={i} className="break-words">
                                                {line}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="shrink-0 rounded-lg border border-slate-600/35 bg-slate-900/45 px-1.5 py-1 sm:px-2 sm:py-1.5">
                                    <div
                                        className="flex flex-nowrap items-center justify-between gap-1 overflow-x-auto"
                                        role="group"
                                        aria-label={`초기 배치: 흑 ${board.initialStoneCounts.blackPlain}, 백 ${board.initialStoneCounts.whitePlain}, 문양 흑 ${board.initialStoneCounts.blackMarked}, 문양 백 ${board.initialStoneCounts.whiteMarked}`}
                                    >
                                        {[
                                            {
                                                key: 'bp',
                                                icon: <PlainBlackStoneIcon className="h-6 w-6 sm:h-7 sm:w-7" />,
                                                n: board.initialStoneCounts.blackPlain,
                                            },
                                            {
                                                key: 'wp',
                                                icon: <PlainWhiteStoneIcon className="h-6 w-6 sm:h-7 sm:w-7" />,
                                                n: board.initialStoneCounts.whitePlain,
                                            },
                                            {
                                                key: 'bm',
                                                icon: (
                                                    <img
                                                        src={BLACK_BASE_STONE_IMG}
                                                        alt=""
                                                        className="h-6 w-6 shrink-0 rounded-full object-cover shadow-md ring-2 ring-amber-500/45 sm:h-7 sm:w-7"
                                                    />
                                                ),
                                                n: board.initialStoneCounts.blackMarked,
                                            },
                                            {
                                                key: 'wm',
                                                icon: (
                                                    <img
                                                        src={WHITE_BASE_STONE_IMG}
                                                        alt=""
                                                        className="h-6 w-6 shrink-0 rounded-full object-cover shadow-md ring-2 ring-sky-200/50 sm:h-7 sm:w-7"
                                                    />
                                                ),
                                                n: board.initialStoneCounts.whiteMarked,
                                            },
                                        ].map((row) => (
                                            <div
                                                key={row.key}
                                                className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-black/40 px-1 py-0.5 sm:gap-1 sm:px-1.5 sm:py-1"
                                            >
                                                {row.icon}
                                                <span className="min-w-[1rem] text-center text-xs font-black tabular-nums text-amber-100 sm:text-sm">{row.n}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {board.gameMode !== 'capture' && (
                                <div className="shrink-0 rounded-lg border border-slate-600/35 bg-slate-900/45 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                    <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">아이템</p>
                                    {board.gameMode === 'hidden' ? (
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1 sm:py-1.5">
                                                <img src={GUILD_WAR_HIDDEN_ICON} alt="" className="h-7 w-7 shrink-0 object-contain" />
                                                <div>
                                                    <p className="text-[10px] text-slate-400 sm:text-xs">히든</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100 sm:text-base">{getGuildWarHiddenStoneCountByBoardId(board.id)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1 sm:py-1.5">
                                                <img src={GUILD_WAR_SCAN_ICON} alt="" className="h-7 w-7 shrink-0 object-contain" />
                                                <div>
                                                    <p className="text-[10px] text-slate-400 sm:text-xs">스캔</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100 sm:text-base">{getGuildWarScanCountByBoardId(board.id)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-1.5">
                                            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1 sm:py-1.5">
                                                <img src={GUILD_WAR_MISSILE_ICON} alt="" className="h-7 w-7 shrink-0 object-contain" />
                                                <div>
                                                    <p className="text-[10px] text-slate-400 sm:text-xs">미사일</p>
                                                    <p className="text-sm font-bold tabular-nums text-amber-100 sm:text-base">{getGuildWarMissileCountByBoardId(board.id)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                )}

                                <div className="flex shrink-0 items-center gap-2 rounded-lg border border-indigo-500/25 bg-indigo-950/40 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                    <img src={GUILD_WAR_TICKET_IMG} alt="" className="h-7 w-7 shrink-0 object-contain drop-shadow sm:h-8 sm:w-8" />
                                    <div className="min-w-0 flex-1 text-right">
                                        <p className="text-xs font-semibold text-indigo-200/80 sm:text-sm">맵 도전 횟수</p>
                                        <p className="text-lg font-black tabular-nums text-indigo-100 sm:text-xl">
                                            {perspectiveAttempts.toLocaleString()}회
                                        </p>
                                    </div>
                                </div>

                                {myTicketsMax != null && myTicketsLeft != null && (
                                    <button
                                        type="button"
                                        onClick={() => handleBoardClick(board)}
                                        disabled={!isDemoMode && myDailyAttempts >= GUILD_WAR_PERSONAL_DAILY_LIMIT}
                                        className={`mt-0.5 w-full shrink-0 rounded-lg px-2 py-2 text-sm font-semibold transition-all sm:py-2.5 sm:text-base flex items-center justify-center gap-2 flex-wrap ${
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
                        ) : null}
                    </div>
                </div>
            </div>
        );
    };

    /** 상대 길드 측: 총 도전권 사용/전체만 — 깃발 열과 맞춘 높이 */
    const OpponentGuildTicketsOnly: React.FC<{
        colorSide: 'blue' | 'red';
        used: number;
        total: number;
        unknown: boolean;
        className?: string;
    }> = ({ colorSide, used, total, unknown, className }) => {
        const isBlue = colorSide === 'blue';
        const panelClasses = isBlue ? 'bg-blue-900/45 border-blue-700' : 'bg-red-900/45 border-red-700';
        const secondaryTextClasses = isBlue ? 'text-blue-200' : 'text-red-200';
        const innerBox = isBlue ? 'bg-blue-950/50 border-blue-800/70' : 'bg-red-950/50 border-red-800/70';
        return (
            <div
                className={`flex h-40 w-full shrink-0 flex-col justify-center gap-1 rounded-lg border-2 px-2.5 py-2 ${panelClasses} shadow-md ${className ?? ''}`}
            >
                <div className={`flex min-h-0 flex-1 flex-col justify-center rounded-md border px-2 py-1.5 ${innerBox}`}>
                    <p className={`text-center text-[10px] font-semibold leading-none ${secondaryTextClasses}`}>총 도전권 (사용/전체)</p>
                    <div className="mt-1 flex items-center justify-center gap-2">
                        <img src={GUILD_WAR_TICKET_IMG} alt="" className="h-6 w-6 shrink-0 object-contain opacity-95" />
                        <span className="tabular-nums text-xl font-black leading-none text-white sm:text-2xl">
                            {unknown ? '—' : `${used}/${total}`}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={warMapBgClass} style={warMapBgStyle}>
            <header className={`flex flex-shrink-0 items-center justify-between gap-2 sm:gap-4 ${isNativeMobile ? 'mb-1' : 'mb-4'}`}>
                <div className="inline-flex min-w-0 max-w-[min(100%,28rem)] flex-1 items-center gap-2 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-black/75 via-stone-900/90 to-black/75 px-2 py-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-md sm:gap-3 sm:px-3 sm:py-2">
                    <BackButton
                        onClick={() => {
                            if (isDemoMode) {
                                setIsDemoMode(false);
                                setActiveWar(null);
                                setMyGuild(null);
                                setOpponentGuild(null);
                                setBoards([]);
                            } else {
                                replaceAppHash('#/guild');
                            }
                        }}
                    />
                    <div className="hidden h-9 w-px shrink-0 bg-gradient-to-b from-transparent via-amber-400/45 to-transparent sm:block" aria-hidden />
                    <div className="min-w-0 flex-1 pr-0.5 sm:pr-1">
                        <h1
                            className={`truncate bg-gradient-to-r from-amber-100 via-white to-amber-100 bg-clip-text font-black tracking-tight text-transparent ${isNativeMobile ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
                        >
                            길드 전쟁
                        </h1>
                    </div>
                </div>
                <div
                    className={`shrink-0 rounded-xl border border-amber-400/30 bg-black/55 px-2.5 py-1.5 text-right shadow-inner ring-1 ring-white/5 backdrop-blur-sm sm:px-3 sm:py-2 ${isNativeMobile ? 'max-w-[40%]' : 'min-w-[9rem]'}`}
                >
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/75">남은 기간</p>
                    <p className={`font-bold tabular-nums text-amber-50 ${isNativeMobile ? 'text-[11px] leading-tight' : 'text-sm'}`}>
                        {isDemoMode ? '데모 모드' : remainingTime || '계산 중...'}
                    </p>
                </div>
            </header>
            {isNativeMobile ? (
                <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
                    <div className="shrink-0 space-y-2">
                        <div className="flex items-end gap-1.5 text-white sm:gap-2" style={{ textShadow: '1px 1px 3px black' }}>
                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                {!weAreVisualBlue ? (
                                    <div className="mb-1 flex w-full max-w-[7.25rem] flex-col items-center gap-0.5 rounded-md border border-blue-800/55 bg-blue-950/45 px-1 py-1">
                                        <span className="text-[9px] font-semibold text-blue-200/90">총 도전권</span>
                                        <div className="flex items-center gap-1">
                                            <img src={GUILD_WAR_TICKET_IMG} alt="" className="h-4 w-4 shrink-0 object-contain opacity-95" />
                                            <span className="text-[11px] font-black tabular-nums text-white">
                                                {opponentTeamTickets.unknown ? '—' : `${opponentTeamTickets.used}/${opponentTeamTickets.total}`}
                                            </span>
                                        </div>
                                    </div>
                                ) : null}
                                <img
                                    src={visualBlueGuild.icon || visualBlueGuild.emblem || '/images/guild/profile/icon1.png'}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-md object-contain ring-1 ring-blue-400/40"
                                />
                                <span className="mt-0.5 max-w-full truncate text-center text-[11px] font-bold">{visualBlueGuild.name}</span>
                            </div>
                            <div className="min-w-0 flex-[1.35] pb-0.5">
                                <GuildWarUnifiedScoreboard
                                    compact
                                    blueStars={visualBlueTeamStars}
                                    redStars={visualRedTeamStars}
                                    blueHouse={blueTotalHouseScore}
                                    redHouse={redTotalHouseScore}
                                />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                <img
                                    src={visualRedGuild.icon || visualRedGuild.emblem || '/images/guild/profile/icon1.png'}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-md object-contain ring-1 ring-red-400/40"
                                />
                                <span className="mt-0.5 max-w-full truncate text-center text-[11px] font-bold">{visualRedGuild.name}</span>
                                {weAreVisualBlue ? (
                                    <div className="mt-1 flex w-full max-w-[7.25rem] flex-col items-center gap-0.5 rounded-md border border-red-800/55 bg-red-950/45 px-1 py-1">
                                        <span className="text-[9px] font-semibold text-red-200/90">총 도전권</span>
                                        <div className="flex items-center gap-1">
                                            <img src={GUILD_WAR_TICKET_IMG} alt="" className="h-4 w-4 shrink-0 object-contain opacity-95" />
                                            <span className="text-[11px] font-black tabular-nums text-white">
                                                {opponentTeamTickets.unknown ? '—' : `${opponentTeamTickets.used}/${opponentTeamTickets.total}`}
                                            </span>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-x-0.5 gap-y-0.5 px-0.5">
                        {boards.map((board) => renderGuildWarBoardCell(board, true, () => setMySituationDrawerOpen(true)))}
                    </div>
                </main>
            ) : (
                <main className="flex min-h-0 min-w-0 flex-1 gap-4">
                    <div className="flex h-full min-h-0 w-[min(30rem,24vw)] min-w-[21rem] max-w-[32rem] shrink-0 flex-col">
                        <StatusAndViewerPanel
                            colorSide={weAreVisualBlue ? 'blue' : 'red'}
                            challengingMembers={myMembersChallenging}
                            teamUsedTickets={myTeamTickets.used}
                            teamTotalTickets={myTeamTickets.total}
                            board={selectedBoard}
                            boardHousePair={houseForSituationBoard}
                            personalTicketsRemaining={personalTicketsRemaining}
                            personalTicketsTotal={personalTicketTotal}
                            onOpenMyAttemptLog={openMyAttemptLogModal}
                            myAttemptLogBusy={myAttemptLogLoading}
                            myAttemptLogDisabled={isDemoMode}
                        />
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                        <div className="flex w-full shrink-0 flex-wrap items-start justify-center gap-x-3 gap-y-3">
                            <div className="flex shrink-0 items-start gap-2.5">
                                {!weAreVisualBlue ? (
                                    <OpponentGuildTicketsOnly
                                        colorSide="blue"
                                        used={opponentTeamTickets.used}
                                        total={opponentTeamTickets.total}
                                        unknown={opponentTeamTickets.unknown}
                                        className="!w-[min(12rem,100%)]"
                                    />
                                ) : null}
                                <div className="flex w-[9.25rem] shrink-0 flex-col items-center">
                                    <div className="relative h-40 w-[9.25rem]">
                                        <img
                                            src="/images/guild/guildwar/blueteam.png"
                                            alt="Blue Team Flag"
                                            className="h-full w-full object-contain object-bottom"
                                        />
                                        <img
                                            src={visualBlueGuild.icon || visualBlueGuild.emblem || '/images/guild/profile/icon1.png'}
                                            alt="청팀 길드"
                                            className="absolute left-1/2 top-[42px] h-12 w-12 max-w-[44%] -translate-x-1/2 object-contain drop-shadow-md"
                                        />
                                    </div>
                                    <div className="z-10 -mt-5 rounded-md bg-black/60 px-3 py-1.5 shadow-lg">
                                        <span className="block max-w-[10rem] truncate text-center text-base font-bold text-white">{visualBlueGuild.name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex min-w-[13rem] max-w-[640px] flex-1 flex-col items-stretch self-center pt-1">
                                <GuildWarUnifiedScoreboard
                                    blueStars={visualBlueTeamStars}
                                    redStars={visualRedTeamStars}
                                    blueHouse={blueTotalHouseScore}
                                    redHouse={redTotalHouseScore}
                                />
                            </div>

                            <div className="flex shrink-0 items-start gap-2.5">
                                <div className="flex w-[9.25rem] shrink-0 flex-col items-center">
                                    <div className="relative h-40 w-[9.25rem]">
                                        <img
                                            src="/images/guild/guildwar/redteam.png"
                                            alt="Red Team Flag"
                                            className="h-full w-full object-contain object-bottom"
                                        />
                                        <img
                                            src={visualRedGuild.icon || visualRedGuild.emblem || '/images/guild/profile/icon1.png'}
                                            alt="홍팀 길드"
                                            className="absolute left-1/2 top-[42px] h-12 w-12 max-w-[44%] -translate-x-1/2 object-contain drop-shadow-md"
                                        />
                                    </div>
                                    <div className="z-10 -mt-5 rounded-md bg-black/60 px-3 py-1.5 shadow-lg">
                                        <span className="block max-w-[10rem] truncate text-center text-base font-bold text-white">{visualRedGuild.name}</span>
                                    </div>
                                </div>
                                {weAreVisualBlue ? (
                                    <OpponentGuildTicketsOnly
                                        colorSide="red"
                                        used={opponentTeamTickets.used}
                                        total={opponentTeamTickets.total}
                                        unknown={opponentTeamTickets.unknown}
                                        className="!w-[min(12rem,100%)]"
                                    />
                                ) : null}
                            </div>
                        </div>

                        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-x-10 gap-y-5">
                            {boards.map((board) => renderGuildWarBoardCell(board, false))}
                        </div>
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
                        className={`fixed top-0 right-0 z-[10051] flex h-[100dvh] max-h-[100dvh] w-[min(94vw,28rem)] flex-col border-l border-white/20 bg-gray-950/98 shadow-[-12px_0_32px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
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
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2">
                            <StatusAndViewerPanel
                                colorSide={weAreVisualBlue ? 'blue' : 'red'}
                                challengingMembers={myMembersChallenging}
                                teamUsedTickets={myTeamTickets.used}
                                teamTotalTickets={myTeamTickets.total}
                                board={selectedBoard}
                                boardHousePair={houseForSituationBoard}
                                personalTicketsRemaining={personalTicketsRemaining}
                                personalTicketsTotal={personalTicketTotal}
                                onOpenMyAttemptLog={openMyAttemptLogModal}
                                myAttemptLogBusy={myAttemptLogLoading}
                                myAttemptLogDisabled={isDemoMode}
                            />
                        </div>
                    </aside>
                </>
            )}

            {myAttemptLogOpen ? (
                <>
                    <div
                        className="fixed inset-0 z-[10060] bg-black/60 backdrop-blur-[2px]"
                        aria-hidden
                        onClick={() => {
                            if (!myAttemptLogLoading) setMyAttemptLogOpen(false);
                        }}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="guild-war-my-attempt-log-title"
                        className="fixed left-1/2 top-1/2 z-[10061] flex max-h-[min(85dvh,32rem)] w-[min(96vw,26rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-b from-stone-950 via-stone-900 to-black shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
                    >
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                            <h2 id="guild-war-my-attempt-log-title" className="sr-only">
                                길드전 종료 대국 기록
                            </h2>
                            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-amber-500/25 bg-black/40 px-2.5 py-1.5">
                                <img src={GUILD_WAR_TICKET_IMG} alt="" className="h-5 w-5 shrink-0 object-contain opacity-95" />
                                <span className="text-xs font-semibold text-slate-400">도전권</span>
                                <span className="font-black tabular-nums text-amber-100 sm:text-base">
                                    {myAttemptLogUsed}/{myAttemptLogMax}
                                </span>
                            </div>
                            <button
                                type="button"
                                disabled={myAttemptLogLoading}
                                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => setMyAttemptLogOpen(false)}
                            >
                                닫기
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
                            {myAttemptLogLoading && myAttemptLogRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
                                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400/60 border-t-transparent" aria-hidden />
                                    <p className="text-sm font-medium">불러오는 중…</p>
                                </div>
                            ) : myAttemptLogRows.length === 0 ? (
                                <p className="py-8 text-center text-sm text-slate-400">
                                    아직 종료된 길드전 대국 기록이 없습니다.
                                    <br />
                                    <span className="text-xs text-slate-500">진행 중인 판은 끝난 뒤 여기에 반영됩니다.</span>
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {myAttemptLogRows.map((row) => {
                                        const when = new Intl.DateTimeFormat('ko-KR', {
                                            dateStyle: 'short',
                                            timeStyle: 'short',
                                        }).format(new Date(row.endedAtMs));
                                        const oc =
                                            row.outcome === 'win'
                                                ? { t: '승리', c: 'text-emerald-300' }
                                                : row.outcome === 'lose'
                                                  ? { t: '패배', c: 'text-rose-300' }
                                                  : { t: '무승부', c: 'text-slate-300' };
                                        return (
                                            <li
                                                key={row.gameId}
                                                className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-left shadow-inner"
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-white">
                                                            {row.boardName}{' '}
                                                            <span className="font-semibold text-sky-200/90">· {row.modeLabel}</span>
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-400">{when}</p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-xs font-black ${oc.c}`}>
                                                        {oc.t}
                                                    </span>
                                                </div>
                                                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2">
                                                    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">기여도</p>
                                                        <div className="mt-0.5 flex items-center gap-1">
                                                            <div className="flex items-center gap-0.5">
                                                                {[0, 1, 2].map((i) => (
                                                                    <img
                                                                        key={i}
                                                                        src={i < Math.min(3, Math.max(0, row.stars)) ? GUILD_WAR_STAR_IMG : GUILD_WAR_EMPTY_STAR_IMG}
                                                                        alt=""
                                                                        className="h-3.5 w-3.5"
                                                                    />
                                                                ))}
                                                            </div>
                                                            <span className="font-black tabular-nums text-amber-200">{row.stars}</span>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">집점수</p>
                                                        <p className="mt-0.5 text-lg font-black tabular-nums leading-none text-cyan-200/95">
                                                            {typeof row.houseScore === 'number' && Number.isFinite(row.houseScore)
                                                                ? Number.isInteger(row.houseScore)
                                                                    ? row.houseScore
                                                                    : row.houseScore.toFixed(1)
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default GuildWar;
