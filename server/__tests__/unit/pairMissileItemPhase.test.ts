import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { resolveArenaSessionPolicy } from '../../../shared/utils/liveSessionArenaKind.js';
import { finalizeItemPhase } from '../../modes/finalizeItemPhase.js';
import { buildItemPhaseGameUpdatePayload } from '../../utils/broadcastItemPhaseSnapshot.js';
import {
    mergeGameUpdateByArena,
    shouldClearMissileFlightAnimationOnPlayingMerge,
} from '../../../utils/clientGameMergePolicy.js';

const pairAiMissileSession = (): LiveGameSession => {
    const startTime = 3000;
    return {
        id: 'pair-ai-missile',
        mode: GameMode.Missile,
        gameCategory: 'normal',
        isSinglePlayer: false,
        isAiGame: true,
        gameStatus: 'missile_animating',
        currentPlayer: Player.White,
        player1: { id: 'human', username: 'human', nickname: 'human' } as any,
        player2: { id: 'ai-op', username: 'ai', nickname: 'ai' } as any,
        blackPlayerId: 'human',
        whitePlayerId: 'ai-op',
        settings: {
            boardSize: 9,
            komi: 0.5,
            missileCount: 3,
            timeLimit: 0,
            pairGame: {
                roomId: 'pair-room',
                pairMode: 'ai',
                teamA: { name: 'A', members: [{ id: 'human', kind: 'user', name: 'human', slot: 'a0' }] },
                teamB: {
                    name: 'B',
                    members: [
                        { id: 'ai-op', kind: 'ai', name: 'ai', slot: 'b0' },
                        { id: 'pet1', kind: 'pet', name: 'pet', slot: 'b1' },
                    ],
                },
                turnOrder: [
                    { seatId: 'a0', participantId: 'human', player: Player.Black, kind: 'user', name: 'human' },
                    { seatId: 'b0', participantId: 'ai-op', player: Player.White, kind: 'ai', name: 'ai' },
                ],
            },
        } as any,
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        animation: {
            type: 'missile',
            from: { x: 2, y: 2 },
            to: { x: 2, y: 4 },
            player: Player.White,
            startTime,
            duration: 400,
        } as any,
    } as unknown as LiveGameSession;
};

describe('pair AI missile item phase', () => {
    it('policy enables missile flight animation clear on playing merge', () => {
        const session = pairAiMissileSession();
        const policy = resolveArenaSessionPolicy(session);
        expect(policy.isPairGame).toBe(true);
        expect(policy.clearsMissileFlightAnimationOnPlaying).toBe(true);
    });

    it('finalizeItemPhase leaves playing + null animation for pair AI session', () => {
        const game = pairAiMissileSession();
        finalizeItemPhase(game, 'missile', 3500, {
            animationStartTime: 3000,
            skipBoardRelocation: true,
        });
        expect(game.gameStatus).toBe('playing');
        expect(game.animation).toBeNull();
    });

    it('broadcast payload explicitly includes animation null', () => {
        const game = pairAiMissileSession();
        finalizeItemPhase(game, 'missile', 3500, {
            animationStartTime: 3000,
            skipBoardRelocation: true,
        });
        const payload = buildItemPhaseGameUpdatePayload(game)[game.id]!;
        expect(payload.animation).toBeNull();
    });

    it('mergeGameUpdateByArena clears stale missile animation for pair playing packet', () => {
        const existing = pairAiMissileSession();
        const incoming = {
            ...existing,
            gameStatus: 'playing' as const,
        };
        delete (incoming as { animation?: unknown }).animation;
        expect(shouldClearMissileFlightAnimationOnPlayingMerge(existing, incoming)).toBe(true);
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('playing');
        expect(merged.animation).toBeNull();
    });
});
