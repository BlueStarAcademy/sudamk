import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SINGLE_PLAYER_STAGES } from '../../../shared/constants/singlePlayerConstants.js';
import type { LiveGameSession } from '../../../shared/types/index.js';

vi.mock('../../db.js', () => ({
    getKV: vi.fn(),
    setKV: vi.fn(),
}));

import * as db from '../../db.js';
import {
    ensureSinglePlayerKataServerLevelOnGame,
    resolveSinglePlayerKataServerLevelForGame,
} from '../../singlePlayerStageConfigService.js';

describe('single-player KataServer level resolve', () => {
    beforeEach(() => {
        vi.mocked(db.getKV).mockReset();
        vi.mocked(db.getKV).mockResolvedValue(null);
    });

    it('prefers live admin stage table over stale game.settings.kataServerLevel', async () => {
        const stage = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.id === '고급-1') ?? DEFAULT_SINGLE_PLAYER_STAGES[0]!;
        vi.mocked(db.getKV).mockResolvedValue([
            {
                ...stage,
                kataServerLevel: 5,
            },
        ]);

        const level = await resolveSinglePlayerKataServerLevelForGame({
            stageId: stage.id,
            settings: { kataServerLevel: -31 } as LiveGameSession['settings'],
            singlePlayerStageDisplay: { ...stage, kataServerLevel: -31 },
        });

        expect(level).toBe(5);
    });

    it('writes authoritative stage level onto settings for singleplayer sessions', async () => {
        const stage = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.id === '고급-1') ?? DEFAULT_SINGLE_PLAYER_STAGES[0]!;
        vi.mocked(db.getKV).mockResolvedValue([
            {
                ...stage,
                kataServerLevel: 3,
            },
        ]);

        const game = {
            id: 'sp-game-test',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            stageId: stage.id,
            settings: { kataServerLevel: -31 },
            singlePlayerStageDisplay: { ...stage, kataServerLevel: -31 },
        } as unknown as LiveGameSession;

        const level = await ensureSinglePlayerKataServerLevelOnGame(game);
        expect(level).toBe(3);
        expect((game.settings as { kataServerLevel?: number }).kataServerLevel).toBe(3);
        expect(game.singlePlayerStageDisplay?.kataServerLevel).toBe(3);
    });

    it('does not mutate non-singleplayer sessions', async () => {
        const game = {
            id: 'live-1',
            isSinglePlayer: false,
            gameCategory: 'normal',
            settings: { kataServerLevel: -12 },
        } as unknown as LiveGameSession;

        const level = await ensureSinglePlayerKataServerLevelOnGame(game);
        expect(level).toBeUndefined();
        expect((game.settings as { kataServerLevel?: number }).kataServerLevel).toBe(-12);
    });
});
