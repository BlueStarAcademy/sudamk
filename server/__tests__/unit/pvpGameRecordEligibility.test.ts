import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    canSaveStrategicPvpGameRecord,
    isPvpHumanGameRecordEligible,
    resolveClientRecordSessionSnapshot,
} from '../../../utils/strategicPvpGameRecord.js';

describe('pvp game record eligibility', () => {
    it('allows playful PVP modes', () => {
        expect(
            isPvpHumanGameRecordEligible({
                mode: GameMode.Omok,
                isSinglePlayer: false,
                isAiGame: false,
                gameCategory: GameCategory.Normal,
            }),
        ).toBe(true);
    });

    it('rejects AI lobby games', () => {
        expect(
            isPvpHumanGameRecordEligible({
                mode: GameMode.Standard,
                isAiGame: true,
                gameCategory: GameCategory.Normal,
            }),
        ).toBe(false);
    });

    it('canSaveStrategicPvpGameRecord for ended omok PVP', () => {
        expect(
            canSaveStrategicPvpGameRecord({
                mode: GameMode.Omok,
                gameStatus: 'ended',
                isAiGame: false,
                gameCategory: GameCategory.Normal,
            }),
        ).toBe(true);
    });

    it('resolveClientRecordSessionSnapshot accepts valid client session', () => {
        const snapshot = {
            id: 'pvp-client-1',
            mode: GameMode.Standard,
            gameStatus: 'ended',
            isSinglePlayer: false,
            isAiGame: false,
            player1: { id: 'u1', nickname: 'A' },
            player2: { id: 'u2', nickname: 'B' },
            moveHistory: [{ player: Player.Black, x: 3, y: 3 }],
        } as LiveGameSession;
        expect(resolveClientRecordSessionSnapshot('pvp-client-1', 'u1', snapshot)?.id).toBe('pvp-client-1');
    });
});
