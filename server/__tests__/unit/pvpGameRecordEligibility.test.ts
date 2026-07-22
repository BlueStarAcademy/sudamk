import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    canSaveStrategicPvpGameRecord,
    isPvpHumanGameRecordEligible,
    resolveClientRecordSessionSnapshot,
} from '../../../utils/strategicPvpGameRecord.js';

describe('pvp game record eligibility', () => {
    it('rejects playful PVP modes (no save/manage)', () => {
        expect(
            isPvpHumanGameRecordEligible({
                mode: GameMode.Omok,
                isSinglePlayer: false,
                isAiGame: false,
                gameCategory: GameCategory.Normal,
            }),
        ).toBe(false);
        expect(
            isPvpHumanGameRecordEligible({
                mode: GameMode.Dice,
                isAiGame: false,
                gameCategory: GameCategory.Normal,
            }),
        ).toBe(false);
        expect(
            canSaveStrategicPvpGameRecord({
                mode: GameMode.Alkkagi,
                gameStatus: 'ended',
                isAiGame: false,
                gameCategory: GameCategory.Normal,
            }),
        ).toBe(false);
    });

    it('allows strategic PVP modes', () => {
        expect(
            isPvpHumanGameRecordEligible({
                mode: GameMode.Standard,
                isSinglePlayer: false,
                isAiGame: false,
                gameCategory: GameCategory.Normal,
            }),
        ).toBe(true);
        expect(
            isPvpHumanGameRecordEligible({
                mode: GameMode.Hidden,
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

    it('canSaveStrategicPvpGameRecord for ended strategic PVP', () => {
        expect(
            canSaveStrategicPvpGameRecord({
                mode: GameMode.Standard,
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

    it('resolveClientRecordSessionSnapshot rejects playful PVP session', () => {
        const snapshot = {
            id: 'playful-pvp-1',
            mode: GameMode.Omok,
            gameStatus: 'ended',
            isSinglePlayer: false,
            isAiGame: false,
            player1: { id: 'u1', nickname: 'A' },
            player2: { id: 'u2', nickname: 'B' },
            moveHistory: [{ player: Player.Black, x: 3, y: 3 }],
        } as LiveGameSession;
        expect(resolveClientRecordSessionSnapshot('playful-pvp-1', 'u1', snapshot)).toBeNull();
    });
});
