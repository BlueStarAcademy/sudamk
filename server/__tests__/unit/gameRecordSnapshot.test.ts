import { describe, expect, it } from 'vitest';
import type { VolatileState } from '../../../types/index.js';
import type { LiveGameSession } from '../../../types/index.js';
import { GameMode, Player } from '../../../types/enums.js';
import {
    resolveGameSessionForRecordSave,
    stashEndedPvpGameRecordSnapshot,
} from '../../gameRecordSnapshot.js';

function makeEndedPvpGame(id: string): LiveGameSession {
    return {
        id,
        mode: GameMode.Standard,
        gameStatus: 'ended',
        isSinglePlayer: false,
        isAiGame: false,
        player1: { id: 'u1', nickname: 'A' },
        player2: { id: 'u2', nickname: 'B' },
        blackPlayerId: 'u1',
        whitePlayerId: 'u2',
        winner: Player.Black,
        settings: { boardSize: 19, komi: 0.5 },
        moveHistory: [{ player: Player.Black, x: 3, y: 3 }],
        createdAt: Date.now(),
    } as LiveGameSession;
}

describe('gameRecordSnapshot', () => {
    it('resolveGameSessionForRecordSave returns stashed session after DB miss', async () => {
        const volatileState = { endedPvpGameRecordSnapshots: new Map() } as VolatileState;
        const game = makeEndedPvpGame('pvp-test-1');
        stashEndedPvpGameRecordSnapshot(volatileState, game);

        const resolved = await resolveGameSessionForRecordSave(volatileState, 'pvp-test-1');
        expect(resolved?.id).toBe('pvp-test-1');
        expect(resolved?.moveHistory?.length).toBe(1);
    });
});
