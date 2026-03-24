import type { LiveGameSession } from '../shared/types/index.js';
import { Player, GameMode } from '../shared/types/enums.js';
import * as db from './db.js';
import {
    GUILD_WAR_STAR_CAPTURE_TIER2_MIN,
    GUILD_WAR_STAR_CAPTURE_TIER3_MIN,
    GUILD_WAR_STAR_SCORE_TIER2_MIN_DIFF,
    GUILD_WAR_STAR_SCORE_TIER3_MIN_DIFF,
} from '../shared/constants/index.js';

type GuildWarAttemptRecord = {
    userId: string;
    stars: number;
    captures: number;
    score?: number;
    scoreDiff?: number;
    completedAt: number;
};

function scoreModeStarsFromDiff(diff: number): number {
    if (diff >= GUILD_WAR_STAR_SCORE_TIER3_MIN_DIFF) return 3;
    if (diff >= GUILD_WAR_STAR_SCORE_TIER2_MIN_DIFF) return 2;
    return 1;
}

export function computeGuildWarAttemptMetrics(
    game: LiveGameSession,
    humanEnum: Player,
    humanWon: boolean
): { stars: number; captures: number; scoreDiff?: number } {
    const aiEnum = humanEnum === Player.Black ? Player.White : Player.Black;
    const captures = game.captures?.[humanEnum] ?? 0;

    if (!humanWon) {
        return { stars: 0, captures };
    }

    if (game.mode === GameMode.Capture) {
        const opCap = game.captures?.[aiEnum] ?? 0;
        const margin = captures - opCap;
        const stars =
            captures >= GUILD_WAR_STAR_CAPTURE_TIER3_MIN
                ? 3
                : captures >= GUILD_WAR_STAR_CAPTURE_TIER2_MIN
                  ? 2
                  : 1;
        return { stars, captures, scoreDiff: margin };
    }

    const fs = game.finalScores;
    if (fs && typeof fs.black === 'number' && typeof fs.white === 'number') {
        const myTotal = humanEnum === Player.Black ? fs.black : fs.white;
        const opTotal = humanEnum === Player.Black ? fs.white : fs.black;
        const diff = myTotal - opTotal;
        const stars = scoreModeStarsFromDiff(diff);
        return { stars, captures, scoreDiff: Math.round(diff * 10) / 10 };
    }

    return { stars: 1, captures };
}

function isNewAttemptBetter(prev: GuildWarAttemptRecord, cand: GuildWarAttemptRecord): boolean {
    if (cand.stars !== prev.stars) return cand.stars > prev.stars;
    if (cand.captures !== prev.captures) return cand.captures > prev.captures;
    const cd = cand.scoreDiff ?? -1e15;
    const pd = prev.scoreDiff ?? -1e15;
    if (cd !== pd) return cd > pd;
    return cand.completedAt < prev.completedAt;
}

/** 길드전 한 판 종료 시 activeGuildWars 보드 기록·별 갱신 */
export async function applyGuildWarBoardAfterGame(game: LiveGameSession): Promise<void> {
    const warId = (game as any).guildWarId as string | undefined;
    const boardId = (game as any).guildWarBoardId as string | undefined;
    if (!warId || !boardId || (game as any).isDemo) return;
    if ((game as any).gameCategory !== 'guildwar') return;

    const humanId = game.player1?.id;
    if (!humanId) return;

    const humanEnum = game.blackPlayerId === humanId ? Player.Black : Player.White;
    const isDraw = game.winner === Player.None;
    const humanWon = !isDraw && game.winner === humanEnum;

    const { stars, captures, scoreDiff } = computeGuildWarAttemptMetrics(game, humanEnum, humanWon);

    const user = await db.getUser(humanId);
    const userGuildId = user?.guildId;
    if (!userGuildId) return;

    const activeWars = (await db.getKV<any[]>('activeGuildWars')) || [];
    const warIndex = activeWars.findIndex((w: any) => w.id === warId);
    if (warIndex < 0) return;

    const war = activeWars[warIndex];
    if (war.status !== 'active') return;

    const board = war.boards?.[boardId];
    if (!board) return;

    const isGuild1 = war.guild1Id === userGuildId;
    const keyBest: 'guild1BestResult' | 'guild2BestResult' = isGuild1 ? 'guild1BestResult' : 'guild2BestResult';
    const keyStars: 'guild1Stars' | 'guild2Stars' = isGuild1 ? 'guild1Stars' : 'guild2Stars';
    const keyAttempts: 'guild1Attempts' | 'guild2Attempts' = isGuild1 ? 'guild1Attempts' : 'guild2Attempts';

    board[keyAttempts] = (board[keyAttempts] || 0) + 1;

    if (board.challenging && typeof board.challenging === 'object' && board.challenging[humanId]) {
        delete board.challenging[humanId];
    }

    if (humanWon && stars > 0) {
        const completedAt = Date.now();
        const candidate: GuildWarAttemptRecord = {
            userId: humanId,
            stars,
            captures,
            scoreDiff,
            completedAt,
        };
        const prev = board[keyBest] as GuildWarAttemptRecord | null | undefined;
        if (!prev || isNewAttemptBetter(prev, candidate)) {
            board[keyBest] = candidate;
            board[keyStars] = stars;
        }
    }

    activeWars[warIndex] = war;
    await db.setKV('activeGuildWars', activeWars);

    const { broadcast } = await import('./socket.js');
    await broadcast({ type: 'GUILD_WAR_UPDATE', payload: { activeWars } });
}
