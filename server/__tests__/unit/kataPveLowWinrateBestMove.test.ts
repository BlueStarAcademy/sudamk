import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    normalizeKataWinrateToFraction,
    PVE_KATA_PREFER_BEST_MOVE_WINRATE_THRESHOLD,
    shouldPreferKataBestMoveOverReported,
} from '../../kataServerService.js';

describe('kata PVE low winrate bestMove preference', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv('KATA_SERVER_URL', 'http://kata.example');
        vi.stubEnv('KATA_APPLY_MOVE_DELAY_MS', '0');
        vi.stubEnv('KATA_SERVER_TIMEOUT_MS', '5000');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('normalizes percent-scale winrate to fraction', () => {
        expect(normalizeKataWinrateToFraction(4)).toBe(0.04);
        expect(normalizeKataWinrateToFraction(0.04)).toBe(0.04);
    });

    it('prefers bestMove when winrate is below 5%', () => {
        expect(
            shouldPreferKataBestMoveOverReported(0.03, PVE_KATA_PREFER_BEST_MOVE_WINRATE_THRESHOLD, 'E4', 'C5'),
        ).toBe(true);
        expect(
            shouldPreferKataBestMoveOverReported(4, PVE_KATA_PREFER_BEST_MOVE_WINRATE_THRESHOLD, 'E4', 'C5'),
        ).toBe(true);
    });

    it('keeps level move when winrate is at or above 5%', () => {
        expect(
            shouldPreferKataBestMoveOverReported(0.05, PVE_KATA_PREFER_BEST_MOVE_WINRATE_THRESHOLD, 'E4', 'C5'),
        ).toBe(false);
        expect(
            shouldPreferKataBestMoveOverReported(0.52, PVE_KATA_PREFER_BEST_MOVE_WINRATE_THRESHOLD, 'E4', 'C5'),
        ).toBe(false);
    });

    it('orders bestMove before move in candidates when PVE threshold is set', async () => {
        const fetchMock = vi.fn(async () =>
            new Response(
                JSON.stringify({
                    move: 'C5',
                    bestMove: 'E4',
                    strategy: 'weakbot',
                    winrate: 0.02,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
        );
        vi.stubGlobal('fetch', fetchMock);

        const { generateKataServerMoveCandidateDetails } = await import('../../kataServerService.js');
        const result = await generateKataServerMoveCandidateDetails({
            boardSize: 9,
            player: 'white',
            moveHistory: [{ x: 0, y: 0, player: 1 }],
            level: -31,
            gameId: 'sp-game-low-wr',
            allowPass: false,
            preferBestMoveWhenWinrateBelow: PVE_KATA_PREFER_BEST_MOVE_WINRATE_THRESHOLD,
        });

        expect(result.candidates[0]).toEqual({ x: 4, y: 5 });
        expect(result.candidates[1]).toEqual({ x: 2, y: 4 });
    });

    it('keeps move before bestMove when threshold is not set (PVP)', async () => {
        const fetchMock = vi.fn(async () =>
            new Response(
                JSON.stringify({
                    move: 'C5',
                    bestMove: 'E4',
                    strategy: 'weakbot',
                    winrate: 0.02,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
        );
        vi.stubGlobal('fetch', fetchMock);

        const { generateKataServerMoveCandidateDetails } = await import('../../kataServerService.js');
        const result = await generateKataServerMoveCandidateDetails({
            boardSize: 9,
            player: 'white',
            moveHistory: [{ x: 0, y: 0, player: 1 }],
            level: -12,
            gameId: 'pvp-game-low-wr',
            allowPass: false,
        });

        expect(result.candidates[0]).toEqual({ x: 2, y: 4 });
        expect(result.candidates[1]).toEqual({ x: 4, y: 5 });
    });
});
