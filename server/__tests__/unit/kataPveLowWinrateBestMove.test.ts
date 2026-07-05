import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('kata move candidate ordering', () => {
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

    it('keeps KataServer move before bestMove regardless of low winrate', async () => {
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
        });

        expect(result.candidates[0]).toEqual({ x: 2, y: 4 });
        expect(result.candidates[1]).toEqual({ x: 4, y: 5 });
    });

    it('keeps KataServer move before bestMove in PVP too', async () => {
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
