import { describe, expect, it } from 'vitest';
import {
    isEligibleForPveAiTurnStuckRecovery,
    isManuallyPausedAiGame,
    shouldDeferStuckRecoveryDuringHiddenReveal,
    shouldUseServerAiKickForStuckRecovery,
} from '../../../utils/pveAiTurnRecoveryPolicy.js';

describe('pveAiTurnRecoveryPolicy', () => {
    it('enables stuck recovery for PVE strategic AI but not PVP', () => {
        expect(
            isEligibleForPveAiTurnStuckRecovery({
                isAiGame: true,
                gameCategory: 'singleplayer',
            } as any),
        ).toBe(true);
        expect(
            isEligibleForPveAiTurnStuckRecovery({
                isAiGame: true,
                gameCategory: 'adventure',
            } as any),
        ).toBe(true);
        expect(
            isEligibleForPveAiTurnStuckRecovery({
                isAiGame: false,
                gameCategory: 'normal',
            } as any),
        ).toBe(false);
        expect(
            isEligibleForPveAiTurnStuckRecovery({
                isAiGame: true,
                gameCategory: 'normal',
                settings: { pairGame: { pairMode: 'pvp' } },
            } as any),
        ).toBe(false);
    });

    it('uses REQUEST_SERVER_AI_MOVE kick for kata PVE arenas and pair AI', () => {
        expect(
            shouldUseServerAiKickForStuckRecovery(
                { gameCategory: 'adventure', isAiGame: true } as any,
                { isPairAiTurn: false },
            ),
        ).toBe(true);
        expect(
            shouldUseServerAiKickForStuckRecovery(
                { gameCategory: 'normal', isAiGame: true } as any,
                { isPairAiTurn: false },
            ),
        ).toBe(false);
        expect(
            shouldUseServerAiKickForStuckRecovery(
                {
                    gameCategory: 'normal',
                    isAiGame: true,
                    settings: { pairGame: { pairMode: 'ai', teamB: { members: [{ id: 'pair-opponent-ai' }] } } },
                } as any,
                { isPairAiTurn: false },
            ),
        ).toBe(true);
        expect(
            shouldUseServerAiKickForStuckRecovery(
                { gameCategory: 'normal', isAiGame: true } as any,
                { isPairAiTurn: true },
            ),
        ).toBe(true);
    });

    it('defers hidden reveal recovery for kata-server PVE arenas only', () => {
        expect(
            shouldDeferStuckRecoveryDuringHiddenReveal({ gameCategory: 'adventure' } as any),
        ).toBe(true);
        expect(
            shouldDeferStuckRecoveryDuringHiddenReveal({ gameCategory: 'normal', isAiGame: true } as any),
        ).toBe(false);
    });

    it('detects manually paused strategic AI lobby games', () => {
        expect(
            isManuallyPausedAiGame({
                isAiGame: true,
                gameCategory: 'normal',
                pausedTurnTimeLeft: 30,
                turnDeadline: undefined,
                itemUseDeadline: undefined,
            } as any),
        ).toBe(true);
        expect(
            isManuallyPausedAiGame({
                isAiGame: true,
                gameCategory: 'singleplayer',
                pausedTurnTimeLeft: 30,
            } as any),
        ).toBe(false);
    });
});
