import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { computeLiveGameBroadcastSignature } from '../../utils/liveGameBroadcastSignature.js';

function baseGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    return {
        id: 'sig-game-1',
        mode: GameMode.Standard,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        serverRevision: 1,
        moveHistory: [],
        ...overrides,
    } as LiveGameSession;
}

describe('computeLiveGameBroadcastSignature', () => {
    it('changes when only currentPlayer flips', () => {
        const a = computeLiveGameBroadcastSignature(baseGame({ currentPlayer: Player.Black }));
        const b = computeLiveGameBroadcastSignature(baseGame({ currentPlayer: Player.White }));
        expect(a).not.toBe(b);
    });

    it('changes when only stonesToPlace changes', () => {
        const a = computeLiveGameBroadcastSignature(baseGame({ mode: GameMode.Dice, stonesToPlace: 3 }));
        const b = computeLiveGameBroadcastSignature(baseGame({ mode: GameMode.Dice, stonesToPlace: 2 }));
        expect(a).not.toBe(b);
    });

    it('changes when only pair currentTurnIndex changes', () => {
        const pairSettings = (idx: number) =>
            ({
                boardSize: 9,
                pairGame: {
                    pairMode: 'pvp',
                    currentTurnIndex: idx,
                    turnOrder: [
                        { seatId: 'b1', participantId: 'u1', kind: 'user', player: Player.Black, teamId: 'a' },
                        { seatId: 'w1', participantId: 'u2', kind: 'user', player: Player.White, teamId: 'b' },
                    ],
                },
            }) as LiveGameSession['settings'];
        const a = computeLiveGameBroadcastSignature(baseGame({ settings: pairSettings(0) }));
        const b = computeLiveGameBroadcastSignature(baseGame({ settings: pairSettings(1) }));
        expect(a).not.toBe(b);
    });

    it('changes when only animation type/startTime changes', () => {
        const a = computeLiveGameBroadcastSignature(
            baseGame({
                gameStatus: 'scanning_animating',
                animation: { type: 'scan', playerId: 'u1', startTime: 1000, duration: 1500 } as any,
            }),
        );
        const b = computeLiveGameBroadcastSignature(
            baseGame({
                gameStatus: 'scanning_animating',
                animation: { type: 'scan', playerId: 'u1', startTime: 2000, duration: 1500 } as any,
            }),
        );
        expect(a).not.toBe(b);
    });

    it('changes when only itemUseDeadline changes', () => {
        const a = computeLiveGameBroadcastSignature(baseGame({ itemUseDeadline: 100 }));
        const b = computeLiveGameBroadcastSignature(baseGame({ itemUseDeadline: 200 }));
        expect(a).not.toBe(b);
    });

    it('changes when only round advances', () => {
        const a = computeLiveGameBroadcastSignature(baseGame({ mode: GameMode.Dice, round: 1 }));
        const b = computeLiveGameBroadcastSignature(baseGame({ mode: GameMode.Dice, round: 2 }));
        expect(a).not.toBe(b);
    });
});
