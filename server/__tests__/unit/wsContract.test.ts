import { describe, it, expect } from 'vitest';

describe('WebSocket event contract', () => {
    it('GAME_UPDATE payload has type and payload with game id key', () => {
        const msg = { type: 'GAME_UPDATE', payload: { 'game-1': { id: 'game-1', mode: '클래식 바둑', gameStatus: 'playing' } } };
        expect(msg.type).toBe('GAME_UPDATE');
        expect(msg.payload).toBeDefined();
        expect(typeof msg.payload).toBe('object');
        const gameId = Object.keys(msg.payload)[0];
        expect(gameId).toBe('game-1');
        expect((msg.payload as Record<string, unknown>)[gameId]).toHaveProperty('id', 'game-1');
        expect((msg.payload as Record<string, unknown>)[gameId]).toHaveProperty('gameStatus');
    });

    it('RANKED_MATCH_FOUND payload has gameId, player1, player2 with required fields', () => {
        const msg = {
            type: 'RANKED_MATCH_FOUND',
            payload: {
                gameId: 'game-ranked-1',
                player1: { id: 'p1', nickname: 'P1', rating: 1200, winChange: 20, lossChange: -20 },
                player2: { id: 'p2', nickname: 'P2', rating: 1180, winChange: 20, lossChange: -20 },
            },
        };
        expect(msg.type).toBe('RANKED_MATCH_FOUND');
        expect(msg.payload).toHaveProperty('gameId', 'game-ranked-1');
        expect(msg.payload.player1).toHaveProperty('id');
        expect(msg.payload.player1).toHaveProperty('nickname');
        expect(msg.payload.player1).toHaveProperty('rating');
        expect(msg.payload.player2).toHaveProperty('id');
        expect(msg.payload.player2).toHaveProperty('nickname');
        expect(msg.payload.player2).toHaveProperty('rating');
    });

    it('NEGOTIATION_UPDATE payload has negotiations and userStatuses', () => {
        const msg = {
            type: 'NEGOTIATION_UPDATE',
            payload: { negotiations: {}, userStatuses: {} },
        };
        expect(msg.type).toBe('NEGOTIATION_UPDATE');
        expect(msg.payload).toHaveProperty('negotiations');
        expect(msg.payload).toHaveProperty('userStatuses');
        expect(typeof msg.payload.negotiations).toBe('object');
        expect(typeof msg.payload.userStatuses).toBe('object');
    });

    it('GAME_UPDATE filtered for participant only includes own revealedHiddenMoves', () => {
        const gameId = 'g1';
        const fullPayload = {
            [gameId]: {
                id: gameId,
                revealedHiddenMoves: {
                    userA: [{ x: 1, y: 2 }],
                    userB: [{ x: 3, y: 4 }],
                },
                scannedAiInitialHiddenByUser: {
                    userA: true,
                    userB: false,
                },
            },
        };
        const uid = 'userA';
        const filtered: Record<string, unknown> = {};
        for (const [gid, g] of Object.entries(fullPayload)) {
            const gameObj = g as Record<string, unknown>;
            let gameCopy = { ...gameObj };
            if (gameCopy.revealedHiddenMoves && typeof gameCopy.revealedHiddenMoves === 'object') {
                const myRevealed = (gameCopy.revealedHiddenMoves as Record<string, unknown>)[uid];
                gameCopy = {
                    ...gameCopy,
                    revealedHiddenMoves: (myRevealed !== undefined && myRevealed !== null) ? { [uid]: myRevealed } : {},
                };
            }
            if (gameCopy.scannedAiInitialHiddenByUser && typeof gameCopy.scannedAiInitialHiddenByUser === 'object') {
                const myScanned = (gameCopy.scannedAiInitialHiddenByUser as Record<string, unknown>)[uid];
                gameCopy = {
                    ...gameCopy,
                    scannedAiInitialHiddenByUser: (myScanned !== undefined && myScanned !== null) ? { [uid]: myScanned } : {},
                };
            }
            filtered[gid] = gameCopy;
        }
        const gameForA = filtered[gameId] as Record<string, unknown>;
        expect(gameForA.revealedHiddenMoves).toEqual({ userA: [{ x: 1, y: 2 }] });
        expect(gameForA.scannedAiInitialHiddenByUser).toEqual({ userA: true });
    });
});
