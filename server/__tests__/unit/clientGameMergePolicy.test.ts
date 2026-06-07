import { describe, expect, it } from 'vitest';
import {
    mergeGameUpdateByArena,
    mergeLiveRejoinResponseWithExistingBoard,
    preserveTerminalAnalysisResultOnMerge,
    shouldClearMissileFlightAnimationOnPlayingMerge,
    shouldIgnoreStaleLiveTerminalGameUpdate,
} from '../../../utils/clientGameMergePolicy.js';
import { resolveArenaSessionPolicy } from '../../../shared/utils/liveSessionArenaKind.js';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';

const minimalSession = (overrides: Partial<LiveGameSession>): LiveGameSession =>
    ({
        id: 'g1',
        mode: GameMode.Missile,
        isSinglePlayer: false,
        isAiGame: true,
        gameCategory: 'normal',
        player1: { id: 'p1', username: 'p1', nickname: 'p1' } as any,
        player2: { id: 'p2', username: 'p2', nickname: 'p2' } as any,
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        currentPlayer: Player.Black,
        settings: { boardSize: 9, komi: 0.5 },
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        ...overrides,
    }) as LiveGameSession;

describe('mergeGameUpdateByArena', () => {
    it('policy flag is set for missile mode sessions', () => {
        const session = minimalSession({ mode: GameMode.Missile });
        expect(resolveArenaSessionPolicy(session).clearsItemPhaseAnimationOnPlaying).toBe(true);
    });

    it('policy flag is set for hidden mode sessions', () => {
        const session = minimalSession({ mode: GameMode.Hidden });
        expect(resolveArenaSessionPolicy(session).clearsItemPhaseAnimationOnPlaying).toBe(true);
    });

    it('shouldClearMissileFlightAnimationOnPlayingMerge is false when previous state was not missile flight', () => {
        const existing = minimalSession({ gameStatus: 'playing', animation: null });
        const incoming = minimalSession({ gameStatus: 'playing' });
        delete (incoming as any).animation;
        expect(shouldClearMissileFlightAnimationOnPlayingMerge(existing, incoming)).toBe(false);
    });

    it('clears stale missile flight animation when server sends playing without animation field', () => {
        const existing = minimalSession({
            gameStatus: 'missile_animating',
            animation: {
                type: 'missile',
                from: { x: 1, y: 1 },
                to: { x: 1, y: 3 },
                player: Player.Black,
                startTime: Date.now(),
                duration: 400,
            } as any,
        });
        const incoming = minimalSession({
            gameStatus: 'playing',
            currentPlayer: Player.Black,
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('playing');
        expect(merged.animation).toBeNull();
    });

    it('clears stale missile flight animation when server sends playing with animation null', () => {
        const existing = minimalSession({
            gameStatus: 'missile_animating',
            animation: {
                type: 'missile',
                from: { x: 1, y: 1 },
                to: { x: 1, y: 3 },
                player: Player.Black,
                startTime: Date.now(),
                duration: 400,
            } as any,
        });
        const incoming = minimalSession({
            gameStatus: 'playing',
            animation: null,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.animation).toBeNull();
    });

    it('clears stale scan animation when server sends playing without animation field', () => {
        const existing = minimalSession({
            mode: GameMode.Hidden,
            gameStatus: 'scanning_animating',
            animation: {
                type: 'scan',
                playerId: 'p1',
                startTime: Date.now(),
                duration: 500,
            } as any,
        });
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            gameStatus: 'playing',
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.animation).toBeNull();
    });

    it('keeps lower strategic item inventory counts when stale GAME_UPDATE has full settings', () => {
        const existing = minimalSession({
            mode: GameMode.Hidden,
            hidden_stones_p2: 1,
        } as Partial<LiveGameSession>);
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            hidden_stones_p2: 2,
        } as Partial<LiveGameSession>);
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect((merged as { hidden_stones_p2?: number }).hidden_stones_p2).toBe(1);
    });

    it('does not clear missile animation when incoming explicitly includes it', () => {
        const anim = {
            type: 'missile',
            from: { x: 2, y: 2 },
            to: { x: 2, y: 4 },
            player: Player.White,
            startTime: 1,
            duration: 400,
        };
        const existing = minimalSession({
            gameStatus: 'missile_animating',
            animation: anim as any,
        });
        const incoming = minimalSession({
            gameStatus: 'playing',
            animation: anim as any,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.animation).toEqual(anim);
    });
});

describe('shouldIgnoreStaleLiveTerminalGameUpdate', () => {
    it('ignores playing regression while local is scoring', () => {
        const existing = minimalSession({
            isAiGame: false,
            gameStatus: 'scoring',
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
        });
        const incoming = minimalSession({
            isAiGame: false,
            gameStatus: 'playing',
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
        });
        expect(shouldIgnoreStaleLiveTerminalGameUpdate(incoming, existing)).toBe(true);
    });

    it('accepts ended transition from local scoring', () => {
        const existing = minimalSession({
            isAiGame: false,
            gameStatus: 'scoring',
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
        });
        const incoming = minimalSession({
            isAiGame: false,
            gameStatus: 'ended',
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
        });
        expect(shouldIgnoreStaleLiveTerminalGameUpdate(incoming, existing)).toBe(false);
    });

    it('ignores non-terminal updates after local ended', () => {
        const existing = minimalSession({ isAiGame: false, gameStatus: 'ended' });
        const incoming = minimalSession({ isAiGame: false, gameStatus: 'playing' });
        expect(shouldIgnoreStaleLiveTerminalGameUpdate(incoming, existing)).toBe(true);
    });
});

describe('mergeLiveRejoinResponseWithExistingBoard', () => {
    it('keeps substantive client board when rejoin payload is an empty grid', () => {
        const board = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        board[3][3] = Player.Black;
        const existing = minimalSession({
            isAiGame: false,
            boardState: board,
            moveHistory: [{ x: 3, y: 3, player: Player.Black }],
        });
        const emptyGrid = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        const incoming = minimalSession({
            isAiGame: false,
            gameStatus: 'scoring',
            boardState: emptyGrid,
            moveHistory: [],
        });
        const merged = mergeLiveRejoinResponseWithExistingBoard(existing, incoming);
        expect(merged.boardState?.[3]?.[3]).toBe(Player.Black);
        expect(merged.moveHistory?.length).toBe(1);
    });
});

describe('preserveTerminalAnalysisResultOnMerge', () => {
    it('keeps system analysis when ended packet omits it', () => {
        const analysis = { scoreDetails: { black: { total: 10 }, white: { total: 8 } } };
        const existing = minimalSession({
            isAiGame: false,
            gameStatus: 'scoring',
            analysisResult: { system: analysis } as any,
        });
        const incoming = minimalSession({
            isAiGame: false,
            gameStatus: 'ended',
            summary: { p1: { gold: 100 } } as any,
        });
        const merged = preserveTerminalAnalysisResultOnMerge(incoming, existing);
        expect((merged.analysisResult as any)?.system).toEqual(analysis);
    });
});
