import { describe, expect, it } from 'vitest';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { GameCategory, GameMode, Player } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';
import { aiUserId } from '../../aiPlayer.js';
import {
    applySpeedMoveClockEnd,
    applySpeedClocksAfterOptimisticClientMove,
    getSpeedLiveCaptureBonusDelta,
    mergeSpeedLiveClocksOnClient,
    syncSpeedTimePressureCaptures,
} from '../../../shared/utils/speedTimePressureSessionSync.js';

function makeSpeedPvpGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const p1 = createDefaultUser('p1-id', 'p1', 'P1');
    const p2 = createDefaultUser('p2-id', 'p2', 'P2');
    const now = Date.now();
    return {
        id: 'speed-pvp-score-1',
        mode: GameMode.Speed,
        settings: {
            boardSize: 9,
            komi: 6.5,
            timeLimit: 1,
            byoyomiCount: 0,
            byoyomiTime: 10,
            timeIncrement: 0,
        },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        boardState: Array(9)
            .fill(0)
            .map(() => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null,
        winReason: null,
        createdAt: now,
        lastMove: null,
        passCount: 0,
        round: 0,
        turnInRound: 0,
        koInfo: null,
        blackTimeLeft: 60,
        whiteTimeLeft: 60,
        turnStartTime: now,
        turnDeadline: now + 10_000,
        disconnectionCounts: {},
        currentActionButtons: {},
        scores: {},
        gameCategory: GameCategory.Normal,
        ...overrides,
    } as LiveGameSession;
}

describe('speed PVP time-pressure scoring', () => {
    it('awards opponent +1 (not +2) when a move is committed after one overtime period', () => {
        const now = 5_000_000;
        const game = makeSpeedPvpGame({
            turnStartTime: now - 11_000,
            turnDeadline: now - 1_000,
            currentPlayer: Player.Black,
        });

        applySpeedMoveClockEnd(game, Player.Black, now, aiUserId);

        expect(game.captures[Player.White]).toBe(1);
        expect(game.captures[Player.Black]).toBe(0);
        expect((game.settings as any).__speedTimePressureGranted.white).toBe(1);
        expect((game.settings as any).__speedTurnPenaltyCommitted.black).toBe(1);
    });

    it('does not add another point on commit if live sync already granted the overtime point', () => {
        const now = 6_000_000;
        const game = makeSpeedPvpGame({
            turnStartTime: now - 11_000,
            turnDeadline: now - 1_000,
            currentPlayer: Player.Black,
        });

        expect(syncSpeedTimePressureCaptures(game, now, aiUserId)).toBe(true);
        expect(game.captures[Player.White]).toBe(1);

        applySpeedMoveClockEnd(game, Player.Black, now, aiUserId);

        expect(game.captures[Player.White]).toBe(1);
        expect((game.settings as any).__speedTimePressureGranted.white).toBe(1);
    });

    it('exposes live PVP capture delta so UI can show +1 before the server tick', () => {
        const now = 7_000_000;
        const game = makeSpeedPvpGame({
            turnStartTime: now - 11_000,
            turnDeadline: now - 1_000,
            currentPlayer: Player.Black,
        });

        expect(getSpeedLiveCaptureBonusDelta(game, Player.White, now, aiUserId)).toBe(1);
        expect(getSpeedLiveCaptureBonusDelta(game, Player.Black, now, aiUserId)).toBe(0);

        syncSpeedTimePressureCaptures(game, now, aiUserId);
        expect(getSpeedLiveCaptureBonusDelta(game, Player.White, now, aiUserId)).toBe(0);
        expect(game.captures[Player.White]).toBe(1);
    });

    it('awards opponent +2 when the current move exceeds two 10-second periods', () => {
        const now = 8_000_000;
        const game = makeSpeedPvpGame({
            turnStartTime: now - 21_000,
            turnDeadline: now - 11_000,
            currentPlayer: Player.Black,
        });

        applySpeedMoveClockEnd(game, Player.Black, now, aiUserId);

        expect(game.captures[Player.White]).toBe(2);
        expect((game.settings as any).__speedTimePressureGranted.white).toBe(2);
        expect((game.settings as any).__speedTurnPenaltyCommitted.black).toBe(2);
    });

    it('does not rewind the live 10s clock when a later GAME_UPDATE arrives on the same turn', () => {
        const start = 9_000_000;
        const existing = makeSpeedPvpGame({
            turnStartTime: start,
            turnDeadline: start + 10_000,
            blackTimeLeft: 52,
            whiteTimeLeft: 60,
            currentPlayer: Player.White,
            moveHistory: [{ x: 3, y: 3, player: Player.Black }] as any,
        });
        const incoming = makeSpeedPvpGame({
            turnStartTime: start + 800,
            turnDeadline: start + 10_800,
            blackTimeLeft: 60,
            whiteTimeLeft: 60,
            currentPlayer: Player.White,
            moveHistory: [{ x: 3, y: 3, player: Player.Black }] as any,
        });

        const merged = mergeSpeedLiveClocksOnClient(incoming, existing);
        expect(merged.turnStartTime).toBe(start);
        expect(merged.turnDeadline).toBe(start + 10_000);
        expect(merged.blackTimeLeft).toBe(52);
        expect(merged.whiteTimeLeft).toBe(60);
    });

    it('optimistic client move snaps the next 10s clock to full immediately', () => {
        const now = 8_000_000;
        const game = makeSpeedPvpGame({
            turnStartTime: now - 7_000,
            turnDeadline: now + 3_000,
            currentPlayer: Player.White,
            blackTimeLeft: 60,
            whiteTimeLeft: 60,
        });

        applySpeedClocksAfterOptimisticClientMove(game, Player.Black, now, aiUserId);

        expect(game.turnStartTime).toBe(now);
        expect(game.turnDeadline).toBe(now + 10_000);
        expect(game.blackTimeLeft).toBe(53);
        expect(game.whiteTimeLeft).toBe(60);
    });
});
