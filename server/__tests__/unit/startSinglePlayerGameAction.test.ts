import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultUser } from '../../initialData.js';
import type { User, VolatileState } from '../../../types/index.js';

vi.mock('../../db.js', () => ({
    saveGame: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue(undefined),
    getKV: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../gameCache.js', () => ({
    updateGameCache: vi.fn(),
}));
vi.mock('../../socket.js', () => ({
    broadcast: vi.fn(),
    broadcastUserUpdate: vi.fn(),
    broadcastToGameParticipants: vi.fn(),
}));
vi.mock('../../arenaEntranceService.js', () => ({
    requireArenaEntranceOpen: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('../../effectService.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../effectService.js')>();
    return {
        ...actual,
        applyPassiveActionPointRegenToUser: vi.fn().mockResolvedValue(undefined),
    };
});

describe('START_SINGLE_PLAYER_GAME', () => {
    let volatileState: VolatileState;
    let user: User;

    beforeEach(() => {
        vi.clearAllMocks();
        user = createDefaultUser('user-tutorial-1', 'tutorial', '튜토리얼유저');
        user.equippedPairPetTemplateId = 'pet_slime';
        user.equippedPairPetInventoryItemId = user.inventory.find((it) => it.templateId === 'pet_slime')?.id ?? null;
        volatileState = {
            userConnections: {},
            userStatuses: {},
            negotiations: {},
            waitingRoomChats: { global: [], strategic: [], playful: [] },
            gameChats: {},
            userLastChatMessage: {},
            activeTournamentViewers: new Set<string>(),
        };
    });

    it('starts 입문-1 without throwing', async () => {
        const { handleSinglePlayerAction } = await import('../../actions/singlePlayerActions.js');
        const result = await handleSinglePlayerAction(
            volatileState,
            {
                type: 'START_SINGLE_PLAYER_GAME',
                payload: { stageId: '입문-1' },
                userId: user.id,
            } as any,
            user,
        );
        expect(result.error).toBeUndefined();
        expect(result.clientResponse?.gameId).toBeTruthy();
        expect(result.clientResponse?.game?.stageId).toBe('입문-1');
        expect(user.dismissedScreenGuides).toContain('first_run_walkthrough');
    });
});
