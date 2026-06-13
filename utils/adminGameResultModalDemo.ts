import { AVATAR_POOL, BORDER_POOL } from '../constants/index.js';
import { GameCategory, GameMode, Player } from '../shared/types/enums.js';
import type { AnalysisResult, GameSummary, LiveGameSession, User, UserWithStatus } from '../shared/types/index.js';
import { readStrategicRankedBlock } from '../shared/utils/unifiedRankedStatsMigration.js';
import { getXpRequiredForCurrentLevel } from './playerLevelXp.js';

export const ADMIN_GAME_RESULT_DEMO_SESSION_ID = 'admin-game-result-demo';

const DEMO_OPPONENT_ID = 'admin-game-result-demo-opponent';

function buildDemoOpponent(): User {
    const avatarId = AVATAR_POOL.find((a) => a.id === 'profile_2')?.id ?? AVATAR_POOL[1]?.id ?? AVATAR_POOL[0]!.id;
    const borderId = BORDER_POOL[0]?.id ?? 'border_1';
    return {
        id: DEMO_OPPONENT_ID,
        username: 'demo_opponent',
        nickname: '데모 상대',
        isAdmin: false,
        userLevel: 38,
        userXp: 42000,
        avatarId,
        borderId,
    } as User;
}

function buildDemoAnalysisResult(): AnalysisResult {
    return {
        winRateBlack: 62,
        blackConfirmed: [],
        whiteConfirmed: [],
        blackRight: [],
        whiteRight: [],
        blackLikely: [],
        whiteLikely: [],
        deadStones: [],
        ownershipMap: null,
        recommendedMoves: [],
        areaScore: { black: 86, white: 79 },
        scoreDetails: {
            black: {
                territory: 52,
                captures: 3,
                liveCaptures: 3,
                deadStones: 1,
                baseStoneBonus: 0,
                hiddenStoneBonus: 0,
                timeBonus: 0,
                itemBonus: 0,
                total: 86.5,
            },
            white: {
                territory: 48,
                captures: 2,
                liveCaptures: 2,
                deadStones: 2,
                komi: 6.5,
                baseStoneBonus: 0,
                hiddenStoneBonus: 0,
                timeBonus: 0,
                itemBonus: 0,
                total: 79.5,
            },
        },
    };
}

function buildDemoSummary(user: UserWithStatus): GameSummary {
    const level = Math.max(1, user.userLevel ?? 1);
    const xpReq = getXpRequiredForCurrentLevel(level);
    const xpGain = 120;
    const xpInitial = Math.max(0, user.userXp ?? 0);
    const xpFinal = xpInitial + xpGain;
    const xpProgressInitial = xpReq > 0 ? Math.min(100, (xpInitial / xpReq) * 100) : 0;
    const xpProgressFinal = xpReq > 0 ? Math.min(100, (xpFinal / xpReq) * 100) : 0;

    const rankedBlk = readStrategicRankedBlock(
        user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>,
    );
    const ratingInitial = rankedBlk.rankingScore ?? 1500;
    const ratingChange = 15;
    const mannerInitial = user.mannerScore ?? 200;
    const mannerChange = 2;
    const wins = rankedBlk.wins ?? 12;
    const losses = rankedBlk.losses ?? 8;

    const petLevel = 5;
    const petXpGain = 80;
    const petXpMax = 1000;
    const petXpInitial = 420;
    const petXpFinal = petXpInitial + petXpGain;

    return {
        xp: { initial: xpInitial, change: xpGain, final: xpFinal },
        rating: { initial: ratingInitial, change: ratingChange, final: ratingInitial + ratingChange },
        manner: { initial: mannerInitial, change: mannerChange, final: mannerInitial + mannerChange },
        level: {
            initial: level,
            final: level,
            progress: { initial: xpProgressInitial, final: xpProgressFinal, max: xpReq },
        },
        overallRecord: { wins, losses },
        gold: 500,
        matchGold: 500,
        pairPetXp: { initial: petXpInitial, change: petXpGain, final: petXpFinal },
        pairPetLevel: {
            initial: petLevel,
            final: petLevel,
            progress: {
                initial: (petXpInitial / petXpMax) * 100,
                final: (petXpFinal / petXpMax) * 100,
                max: petXpMax,
            },
        },
        items: [
            {
                id: 'admin-demo-reward-item',
                name: '강화석',
                type: 'material',
                quantity: 2,
                image: '/images/icon/item.webp',
            } as GameSummary['items'] extends (infer T)[] | undefined ? T : never,
        ],
        vipPlayRewardSlot: {
            locked: false,
            grantedItem: {
                name: 'VIP 슬롯 보상',
                quantity: 1,
                image: '/images/icon/item.webp',
            },
        },
    };
}

/** 관리자 홈 모달 미리보기용 PVP 경기 결과 데모 세션 */
export function buildAdminGameResultModalDemoSession(user: UserWithStatus): LiveGameSession {
    const now = Date.now();
    const gameDurationMs = 18 * 60 * 1000;
    const opponent = buildDemoOpponent();
    const adminAsPlayer = {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        isAdmin: user.isAdmin,
        userLevel: user.userLevel,
        userXp: user.userXp,
        avatarId: user.avatarId,
        borderId: user.borderId,
    } as User;

    const boardSize = 19;
    const boardState = Array.from({ length: boardSize }, () => Array(boardSize).fill(Player.None));

    return {
        id: ADMIN_GAME_RESULT_DEMO_SESSION_ID,
        mode: GameMode.Standard,
        gameCategory: GameCategory.Normal,
        settings: {
            boardSize,
            komi: 6.5,
            timeLimit: 10,
            byoyomiTime: 30,
            byoyomiCount: 3,
        } as LiveGameSession['settings'],
        player1: adminAsPlayer,
        player2: opponent,
        blackPlayerId: user.id,
        whitePlayerId: DEMO_OPPONENT_ID,
        gameStatus: 'ended',
        currentPlayer: Player.Black,
        boardState,
        moveHistory: Array.from({ length: 186 }, (_, i) => ({
            x: (i * 3) % boardSize,
            y: Math.floor((i * 3) / boardSize) % boardSize,
            player: i % 2 === 0 ? Player.Black : Player.White,
        })),
        captures: { [Player.Black]: 3, [Player.White]: 2, [Player.None]: 0 },
        baseStoneCaptures: { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 },
        hiddenStoneCaptures: { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 },
        winner: Player.Black,
        winReason: 'score',
        createdAt: now - gameDurationMs,
        gameStartTime: now - gameDurationMs,
        endTime: now,
        lastMove: { x: 10, y: 10 },
        passCount: 0,
        koInfo: null,
        blackTimeLeft: 420,
        whiteTimeLeft: 180,
        blackByoyomiPeriodsLeft: 2,
        whiteByoyomiPeriodsLeft: 1,
        isRankedGame: true,
        isAiGame: false,
        isSinglePlayer: false,
        analysisResult: { system: buildDemoAnalysisResult() },
        summary: { [user.id]: buildDemoSummary(user) },
        currentActionButtons: {},
        disconnectionCounts: {},
    } as unknown as LiveGameSession;
}
