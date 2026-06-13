import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, User } from '../../../shared/types/index.js';
import { aiUserId } from '../../../shared/constants/auth.js';
import { createDefaultUser } from '../../initialData.js';
import { STRATEGIC_RANKED_STAT_KEY } from '../../../shared/constants/userRankedStats.js';

vi.mock('../../db.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../db.js')>();
    return {
        ...actual,
        getUser: vi.fn(),
        updateUser: vi.fn().mockResolvedValue(undefined),
        saveGame: vi.fn().mockResolvedValue(undefined),
        invalidateUserCache: vi.fn(),
        getLiveGame: vi.fn(),
        getKV: vi.fn().mockResolvedValue(null),
    };
});

vi.mock('../../socket.js', () => ({
    broadcast: vi.fn(),
    broadcastUserUpdate: vi.fn(),
}));

vi.mock('../../guildService.js', () => ({
    recordGuildEpicPlusEquipmentAcquisition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../mannerService.js', () => ({
    applyMannerRankChange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../gameCache.js', () => ({
    updateGameCache: vi.fn(),
}));

vi.mock('../../state.js', () => ({
    volatileState: { endedPvpGameRecordSnapshots: [] },
}));

vi.mock('../../gameRecordSnapshot.js', () => ({
    stashEndedPvpGameRecordSnapshot: vi.fn(),
}));

vi.mock('../../guildWarBoardResult.js', () => ({
    applyGuildWarBoardAfterGame: vi.fn().mockResolvedValue(undefined),
}));

const human = createDefaultUser('human-1', 'human1', 'Human');
human.mannerScore = 200;
const opponent = createDefaultUser('human-2', 'human2', 'Opponent');
opponent.mannerScore = 200;
opponent.stats = {
    ...opponent.stats,
    [GameMode.Standard]: { wins: 0, losses: 0, rankingScore: 1200 },
    [STRATEGIC_RANKED_STAT_KEY]: { rankingScore: 1200 },
};

function buildGame(patch: Partial<LiveGameSession> = {}): LiveGameSession {
    return {
        id: 'manner-penalty-test',
        mode: GameMode.Standard,
        gameStatus: 'ended',
        winner: Player.White,
        winReason: 'disconnect',
        blackPlayerId: human.id,
        whitePlayerId: aiUserId,
        player1: { id: human.id, nickname: human.nickname },
        player2: { id: aiUserId, nickname: 'AI' },
        settings: { boardSize: 19 },
        moveHistory: Array(20).fill({ x: 3, y: 3, player: Player.Black }),
        gameStartTime: Date.now() - 120_000,
        statsUpdated: false,
        isAiGame: true,
        isRankedGame: false,
        ...patch,
    } as LiveGameSession;
}

describe('manner disconnect penalty', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        human.mannerScore = 200;
        opponent.mannerScore = 200;
        const db = await import('../../db.js');
        vi.mocked(db.getUser).mockImplementation((id: string) => {
            if (id === human.id) return Promise.resolve(JSON.parse(JSON.stringify(human)) as User);
            if (id === opponent.id) return Promise.resolve(JSON.parse(JSON.stringify(opponent)) as User);
            return Promise.resolve(null);
        });
    });

    it('does not reduce manner score when a PVE (lobby AI) game ends by disconnect', async () => {
        const game = buildGame();
        const { processGameSummary } = await import('../../summaryService.js');
        await processGameSummary(game);

        const summary = game.summary?.[human.id];
        expect(summary?.manner?.change).toBe(0);
        expect(summary?.manner?.final).toBe(200);
    });

    it('reduces manner score by 50 when a ranked PVP game ends by disconnect loss', async () => {
        const game = buildGame({
            isAiGame: false,
            isRankedGame: true,
            winner: Player.White,
            winReason: 'disconnect',
            blackPlayerId: human.id,
            whitePlayerId: opponent.id,
            player1: { id: human.id, nickname: human.nickname },
            player2: { id: opponent.id, nickname: opponent.nickname },
        });
        human.stats = {
            ...human.stats,
            [GameMode.Standard]: { wins: 0, losses: 0, rankingScore: 1200 },
            [STRATEGIC_RANKED_STAT_KEY]: { rankingScore: 1200 },
        };

        const { processGameSummary } = await import('../../summaryService.js');
        await processGameSummary(game);

        const summary = game.summary?.[human.id];
        expect(summary?.manner?.change).toBe(-50);
        expect(summary?.manner?.final).toBe(150);
    });

    it('does not reduce manner score on friendly PVP disconnect', async () => {
        const game = buildGame({
            isAiGame: false,
            isRankedGame: false,
            winner: Player.White,
            winReason: 'disconnect',
            blackPlayerId: human.id,
            whitePlayerId: opponent.id,
            player1: { id: human.id, nickname: human.nickname },
            player2: { id: opponent.id, nickname: opponent.nickname },
        });

        const { processGameSummary } = await import('../../summaryService.js');
        await processGameSummary(game);

        const summary = game.summary?.[human.id];
        expect(summary?.manner?.change).toBe(0);
        expect(summary?.manner?.final).toBe(200);
    });
});
