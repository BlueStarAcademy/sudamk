import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isKataServerFirstMoveFlag } from '../../kataServerService.js';

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

    it('isKataServerFirstMoveFlag is true only when there are no real stones', () => {
        expect(isKataServerFirstMoveFlag([])).toBe(true);
        expect(isKataServerFirstMoveFlag([['B', 'pass']])).toBe(true);
        expect(isKataServerFirstMoveFlag([['B', 'D4']])).toBe(false);
        expect(isKataServerFirstMoveFlag([['B', 'D4'], ['W', 'pass']])).toBe(false);
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

    it('keeps Kata moveInfos as extra candidates even when /move is a board coordinate', async () => {
        const fetchMock = vi.fn(async () => new Response(
            JSON.stringify({
                move: 'C5',
                bestMove: 'C5',
                strategy: 'levelbot',
                winrate: 0.5,
                moveInfos: [
                    { move: 'C5', winrate: 0.5 },
                    { move: 'E4', winrate: 0.48 },
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
            level: 1,
            gameId: 'sp-yudanja-5-moveinfos',
            allowPass: false,
        });

        expect(result.candidates[0]).toEqual({ x: 2, y: 4 });
        expect(result.candidates).toContainEqual({ x: 4, y: 5 });
    });

    it('does not send firstMove when the request already has a real stone', async () => {
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body ?? '{}')) as { firstMove?: boolean; moves?: unknown[] };
            expect(body.firstMove).toBe(false);
            expect((body.moves?.length ?? 0) > 0).toBe(true);
            return new Response(
                JSON.stringify({ move: 'C5', bestMove: 'C5' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        });
        vi.stubGlobal('fetch', fetchMock);

        const { generateKataServerMoveCandidateDetails } = await import('../../kataServerService.js');
        await generateKataServerMoveCandidateDetails({
            boardSize: 13,
            player: 'white',
            moveHistory: [{ x: 3, y: 3, player: 1 }],
            level: 1,
            gameId: 'sp-yudanja-5-firstmove',
            allowPass: false,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
