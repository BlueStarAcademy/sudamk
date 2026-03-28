import type { LiveGameSession } from '../shared/types/index.js';
import { Player } from '../shared/types/enums.js';
import * as db from './db.js';
import { isGuildWarLiveSession } from '../shared/constants/guildConstants.js';
import { computeGuildWarAttemptMetrics } from '../shared/utils/guildWarAttemptMetrics.js';
import { isGuildWarAttemptStrictlyBetter } from '../shared/utils/guildWarBoardOwner.js';

/** {@link ./aiPlayer.js} `aiUserId` 와 동일 — aiPlayer 모듈을 끌어오면 summaryService 순환 로딩 위험이 있음 */
const AI_USER_ID = 'ai-player-01';

type GuildWarAttemptRecord = {
    userId: string;
    stars: number;
    captures: number;
    score?: number;
    scoreDiff?: number;
    maxSingleCapture?: number;
    completedAt: number;
}

export { computeGuildWarAttemptMetrics } from '../shared/utils/guildWarAttemptMetrics.js';

/** 길드전 한 판 종료 시 activeGuildWars 보드 기록·별 갱신 */
export async function applyGuildWarBoardAfterGame(game: LiveGameSession): Promise<void> {
    const warId = (game as any).guildWarId as string | undefined;
    const boardId = (game as any).guildWarBoardId as string | undefined;
    if (!warId || !boardId || (game as any).isDemo) return;
    // processGameSummary는 guildWarId/보드Id만으로도 길드전으로 처리함 — 여기서 gameCategory만 보면
    // DB 메타/복원 과정에서 category가 빠진 판은 보드·브로드캐스트가 영구히 스킵되는 버그가 난다.
    if (!isGuildWarLiveSession(game as any)) return;

    const blackId = game.blackPlayerId;
    const whiteId = game.whitePlayerId;
    const humanId =
        blackId && blackId !== AI_USER_ID
            ? blackId
            : whiteId && whiteId !== AI_USER_ID
              ? whiteId
              : game.player1?.id;
    if (!humanId) return;

    let humanEnum: Player;
    if (blackId === humanId) humanEnum = Player.Black;
    else if (whiteId === humanId) humanEnum = Player.White;
    else return;
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

    if (stars > 0) {
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
        if (!prev || isGuildWarAttemptStrictlyBetter(prev, candidate)) {
            board[keyBest] = candidate;
            board[keyStars] = stars;
        }
    }

    activeWars[warIndex] = war;
    await db.setKV('activeGuildWars', activeWars);

    const { broadcast } = await import('./socket.js');
    await broadcast({ type: 'GUILD_WAR_UPDATE', payload: { activeWars } });
}
