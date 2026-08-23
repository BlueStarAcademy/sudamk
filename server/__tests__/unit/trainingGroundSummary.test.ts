import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameMode, Player, ItemGrade } from '../../../shared/types/enums.js';
import type { LiveGameSession, User } from '../../../shared/types/index.js';
import { aiUserId } from '../../../shared/constants/auth.js';
import { createDefaultUser } from '../../initialData.js';
import { rewardForKataLevel } from '../../../shared/constants/trainingGround.js';

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
    updateGuildMissionProgress: vi.fn().mockResolvedValue(undefined),
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

const human = createDefaultUser('human-tg', 'human1', 'Human');
human.userXp = 120;
human.userLevel = 5;

const petItemId = 'pet-inv-1';
const humanWithPet: User = {
    ...human,
    id: 'human-pet-tg',
    equippedPairPetTemplateId: 'pair-pet-1',
    equippedPairPetInventoryItemId: petItemId,
    inventory: [
        {
            id: petItemId,
            name: 'Test Pet',
            description: '',
            type: 'material',
            slot: null,
            level: 1,
            stars: 0,
            isEquipped: false,
            createdAt: 0,
            image: '/images/pets/pet1.webp',
            grade: ItemGrade.Normal,
            quantity: 1,
            templateId: 'pair-pet-1',
            pairPetMeta: {
                level: 3,
                xp: 10,
                disposition: { kind: 'all', pct: 5 },
                specialization: { kind: 'trainingXp', pct: 0 },
                levelUpCoreBonuses: {},
                rpsAttribute: 1,
            },
        },
    ],
};

function buildTrainingGroundGame(
    user: User,
    track: 'kata' | 'pet',
    patch: Partial<LiveGameSession> = {},
): LiveGameSession {
    const humanWinsBlack = user.id === human.id;
    return {
        id: `tg-${track}-summary`,
        mode: GameMode.Standard,
        gameStatus: 'ended',
        winner: Player.Black,
        winReason: 'score',
        blackPlayerId: user.id,
        whitePlayerId: aiUserId,
        player1: { id: user.id, nickname: user.nickname },
        player2: { id: aiUserId, nickname: 'AI' },
        settings: {
            boardSize: 19,
            trainingGround: { track, kataLevel: -30, boardSize: 19 },
        },
        moveHistory: Array(20).fill({ x: 3, y: 3, player: Player.Black }),
        gameStartTime: Date.now() - 120_000,
        statsUpdated: false,
        isAiGame: true,
        isRankedGame: false,
        ...patch,
        ...(humanWinsBlack
            ? {}
            : {
                  winner: Player.White,
                  blackPlayerId: aiUserId,
                  whitePlayerId: user.id,
              }),
    } as LiveGameSession;
}

describe('trainingGround summary rewards', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const db = await import('../../db.js');
        vi.mocked(db.getUser).mockImplementation((id: string) => {
            if (id === human.id) return Promise.resolve(JSON.parse(JSON.stringify(human)) as User);
            if (id === humanWithPet.id) return Promise.resolve(JSON.parse(JSON.stringify(humanWithPet)) as User);
            return Promise.resolve(null);
        });
    });

    it('grants kata user xp on kata track win', async () => {
        const game = buildTrainingGroundGame(human, 'kata');
        const expectedXp = rewardForKataLevel(-30, 19).kataUserXp;
        const { processGameSummary } = await import('../../summaryService.js');
        await processGameSummary(game);

        const summary = game.summary?.[human.id];
        expect(summary?.gold).toBe(rewardForKataLevel(-30, 19).gold);
        expect(summary?.diamonds).toBe(rewardForKataLevel(-30, 19).diamonds);
        expect(summary?.xp?.change).toBe(expectedXp);
        expect(summary?.xp?.final).toBe(human.userXp + expectedXp);
        expect(summary?.level?.final).toBeGreaterThanOrEqual(human.userLevel);
    });

    it('grants pet xp on pet track win', async () => {
        const game = buildTrainingGroundGame(humanWithPet, 'pet');
        const expectedPetXp = rewardForKataLevel(-30, 19).petXp;
        const { processGameSummary } = await import('../../summaryService.js');
        await processGameSummary(game);

        const summary = game.summary?.[humanWithPet.id];
        expect(summary?.gold).toBe(rewardForKataLevel(-30, 19).gold);
        expect(summary?.pairPetXp?.change).toBe(expectedPetXp);
        expect(summary?.pairPetLevel).toBeDefined();
        expect(summary?.xp?.change).toBe(0);
    });
});
