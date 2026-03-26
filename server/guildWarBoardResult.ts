import type { LiveGameSession } from '../shared/types/index.js';
import { Player } from '../shared/types/enums.js';
import * as db from './db.js';
import { computeGuildWarAttemptMetrics } from '../shared/utils/guildWarAttemptMetrics.js';

type GuildWarAttemptRecord = {
    userId: string;
    stars: number;
    captures: number;
    score?: number;
    scoreDiff?: number;
    maxSingleCapture?: number;
    completedAt: number;
};

function isNewAttemptBetter(prev: GuildWarAttemptRecord, cand: GuildWarAttemptRecord): boolean {
    if (cand.stars !== prev.stars) return cand.stars > prev.stars;
    const cs = cand.score ?? -1e15;
    const ps = prev.score ?? -1e15;
    if (cs !== ps) return cs > ps;
    if (cand.captures !== prev.captures) return cand.captures > prev.captures;
    const cd = cand.scoreDiff ?? -1e15;
    const pd = prev.scoreDiff ?? -1e15;
    if (cd !== pd) return cd > pd;
    return cand.completedAt < prev.completedAt;
}

export { computeGuildWarAttemptMetrics } from '../shared/utils/guildWarAttemptMetrics.js';

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

    const { stars, captures, score, scoreDiff, maxSingleCapture } = computeGuildWarAttemptMetrics(game, humanEnum, humanWon);

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
            score,
            scoreDiff,
            maxSingleCapture,
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
