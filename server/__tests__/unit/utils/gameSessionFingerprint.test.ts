import { describe, expect, it } from 'vitest';
import { Player } from '../../../../types.js';
import type { LiveGameSession } from '../../../../types.js';
import { computeBoardQuickHash, computeGameSessionFingerprint } from '../../../../utils/gameSessionFingerprint.js';

describe('gameSessionFingerprint', () => {
    it('returns stable hash for identical board', () => {
        const board = [
            [Player.None, Player.Black],
            [Player.White, Player.None],
        ];
        expect(computeBoardQuickHash(board)).toBe(computeBoardQuickHash(board));
    });

    it('changes fingerprint when move count changes', () => {
        const base = {
            id: 'g1',
            serverRevision: 1,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            moveHistory: [],
            boardState: [[Player.None]],
        } as unknown as LiveGameSession;

        const withMove = {
            ...base,
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
        } as unknown as LiveGameSession;

        expect(computeGameSessionFingerprint(base)).not.toBe(
            computeGameSessionFingerprint(withMove),
        );
    });
});
