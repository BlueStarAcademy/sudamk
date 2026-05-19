import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('kataServerService PASS fallback', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv('KATA_SERVER_URL', 'http://kata.example');
        vi.stubEnv('KATA_APPLY_MOVE_DELAY_MS', '2000');
        vi.stubEnv('KATA_SERVER_TIMEOUT_MS', '5000');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('does not wait for apply delay when Kata returns PASS-only candidates', async () => {
        const fetchMock = vi.fn(async () => new Response(
            JSON.stringify({
                move: 'PASS',
                strategy: 'pass',
                winrate: 0,
                bestMove: '',
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        ));
        vi.stubGlobal('fetch', fetchMock);

        const { generateKataServerMoveCandidateDetails } = await import('../../kataServerService.js');

        const startedAt = performance.now();
        const result = await generateKataServerMoveCandidateDetails({
            boardSize: 9,
            player: 'white',
            moveHistory: [{ x: 0, y: 0, player: 1 }],
            level: -5,
            gameId: 'sp-game-pass',
            allowPass: false,
        });

        expect(result.candidates).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(performance.now() - startedAt).toBeLessThan(500);
    });

    it('uses Kata moveInfos non-pass candidate when /move reports PASS', async () => {
        const fetchMock = vi.fn(async () => new Response(
            JSON.stringify({
                move: 'PASS',
                strategy: 'pass',
                winrate: 0.8,
                bestMove: 'PASS',
                moveInfos: [
                    { move: 'PASS', winrate: 0.8 },
                    { move: 'G8', winrate: 0.76 },
                ],
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        ));
        vi.stubGlobal('fetch', fetchMock);

        const { generateKataServerMoveCandidateDetails } = await import('../../kataServerService.js');

        const result = await generateKataServerMoveCandidateDetails({
            boardSize: 9,
            player: 'white',
            moveHistory: [{ x: 0, y: 0, player: 1 }],
            level: -5,
            gameId: 'sp-game-pass-with-candidates',
            allowPass: false,
        });

        expect(result.candidates).toEqual([{ x: 6, y: 1 }]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
