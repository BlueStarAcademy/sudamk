import { describe, expect, it } from 'vitest';
import {
    isPveAwaitingStartConfirmModal,
    isPvePostStartConfirmPrePlayPhase,
    mergeGameUpdateByArena,
    mergeLiveRejoinResponseWithExistingBoard,
    preserveTerminalAnalysisResultOnMerge,
    preserveTerminalGameSessionOnMerge,
    shouldClearMissileFlightAnimationOnPlayingMerge,
    shouldIgnoreStaleLiveTerminalGameUpdate,
    shouldIgnoreStalePendingPveStartRegression,
    buildOptimisticAiLobbyStartSession,
    buildOptimisticPveStartConfirmSession,
    resolveAiLobbyHumanPlayerColor,
    shouldIgnoreStalePendingAiLobbyStartRegression,
    shouldIgnoreStalePvpChessPrePlayRegression,
} from '../../../utils/clientGameMergePolicy.js';
import { resolveArenaSessionPolicy } from '../../../shared/utils/liveSessionArenaKind.js';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    applyChessMoveToSession,
    generateChessGoInitialPieces,
    CHESS_GO_BOARD_SIZE,
} from '../../../shared/utils/chessGoRules.js';

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

    it('keeps active ai_thinking presentation when slim playing packet omits animation', () => {
        const endTime = Date.now() + 5000;
        const existing = minimalSession({
            mode: GameMode.Hidden,
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'playing',
            animation: {
                type: 'ai_thinking',
                startTime: Date.now(),
                duration: 5000,
                playerId: 'ai-user',
            } as any,
            aiHiddenItemAnimationEndTime: endTime,
        } as Partial<LiveGameSession>);
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'playing',
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.animation).toEqual(existing.animation);
        expect((merged as { aiHiddenItemAnimationEndTime?: number }).aiHiddenItemAnimationEndTime).toBe(endTime);
    });

    it('keeps active hidden_reveal presentation when slim playing packet omits animation', () => {
        const endTime = Date.now() + 3000;
        const existing = minimalSession({
            mode: GameMode.Hidden,
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'hidden_reveal_animating',
            revealAnimationEndTime: endTime,
            serverRevision: 10,
            animation: {
                type: 'hidden_reveal',
                stones: [{ point: { x: 1, y: 1 }, player: Player.Black }],
                startTime: Date.now(),
                duration: 3000,
            } as any,
        });
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'playing',
            serverRevision: 10,
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('hidden_reveal_animating');
        expect(merged.animation).toEqual(existing.animation);
        expect(merged.revealAnimationEndTime).toBe(endTime);
    });

    it('accepts server playing when incoming serverRevision is ahead of local hidden_reveal', () => {
        const endTime = Date.now() + 3000;
        const existing = minimalSession({
            mode: GameMode.Hidden,
            isAiGame: false,
            gameCategory: 'normal',
            gameStatus: 'hidden_reveal_animating',
            revealAnimationEndTime: endTime,
            serverRevision: 10,
            animation: {
                type: 'hidden_reveal',
                stones: [{ point: { x: 1, y: 1 }, player: Player.Black }],
                startTime: Date.now(),
                duration: 3000,
            } as any,
        });
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            isAiGame: false,
            gameCategory: 'normal',
            gameStatus: 'playing',
            serverRevision: 12,
            currentPlayer: Player.White,
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('playing');
        expect(merged.currentPlayer).toBe(Player.White);
    });

    it('adventure accepts newer capture hidden_reveal while local is still playing', () => {
        const existing = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'playing',
            serverRevision: 5,
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            permanentlyRevealedStones: [],
            pendingCapture: null,
        });
        const endTime = Date.now() + 2000;
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'hidden_reveal_animating',
            serverRevision: 6,
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.Black },
            ],
            revealAnimationEndTime: endTime,
            pendingCapture: {
                stones: [{ x: 2, y: 2 }],
                move: { x: 1, y: 1, player: Player.Black },
                hiddenContributors: [{ x: 0, y: 0 }],
            },
            animation: {
                type: 'hidden_reveal',
                stones: [
                    { point: { x: 0, y: 0 }, player: Player.Black },
                    { point: { x: 1, y: 1 }, player: Player.Black },
                ],
                startTime: Date.now(),
                duration: 2000,
            } as any,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('hidden_reveal_animating');
        expect(merged.animation?.type).toBe('hidden_reveal');
        expect((merged.animation as any).stones).toHaveLength(2);
        expect(merged.pendingCapture).toBeTruthy();
    });

    it('adventure accepts overdue AI user-hidden full reveal and refreshes endTime', () => {
        const existing = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'playing',
            serverRevision: 6,
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            permanentlyRevealedStones: [],
            pendingCapture: null,
        });
        const pastEnd = Date.now() - 500;
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'hidden_reveal_animating',
            serverRevision: 6,
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            permanentlyRevealedStones: [{ x: 0, y: 0 }],
            revealAnimationEndTime: pastEnd,
            pendingCapture: null,
            animation: {
                type: 'hidden_reveal',
                stones: [{ point: { x: 0, y: 0 }, player: Player.Black }],
                startTime: pastEnd - 1500,
                duration: 1500,
            } as any,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('hidden_reveal_animating');
        expect(merged.animation?.type).toBe('hidden_reveal');
        expect(Number(merged.revealAnimationEndTime)).toBeGreaterThan(Date.now());
    });

    it('adventure ignores stale equal-revision hidden_reveal replay after local finalize', () => {
        const endTime = Date.now() - 1000;
        const existing = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'playing',
            serverRevision: 6,
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.Black },
            ],
            permanentlyRevealedStones: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ],
            pendingCapture: null,
        });
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'hidden_reveal_animating',
            serverRevision: 6,
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.Black },
            ],
            revealAnimationEndTime: endTime,
            animation: {
                type: 'hidden_reveal',
                stones: [
                    { point: { x: 0, y: 0 }, player: Player.Black },
                    { point: { x: 1, y: 1 }, player: Player.Black },
                ],
                startTime: endTime - 2000,
                duration: 2000,
            } as any,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('playing');
        expect(merged.animation).toBeNull();
        expect(merged.pendingCapture).toBeNull();
    });

    it('keeps active hidden_reveal presentation when slim playing packet omits animation (tower)', () => {
        const endTime = Date.now() + 3000;
        const existing = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'tower',
            isAiGame: true,
            gameStatus: 'hidden_reveal_animating',
            revealAnimationEndTime: endTime,
            animation: {
                type: 'hidden_reveal',
                stones: [{ point: { x: 1, y: 1 }, player: Player.Black }],
                startTime: Date.now(),
                duration: 3000,
            } as any,
        });
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'tower',
            isAiGame: true,
            gameStatus: 'playing',
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('hidden_reveal_animating');
        expect(merged.animation).toEqual(existing.animation);
        expect(merged.revealAnimationEndTime).toBe(endTime);
    });

    it('keeps active hidden_reveal presentation when slim playing packet omits animation (adventure)', () => {
        const endTime = Date.now() + 3000;
        const existing = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'hidden_reveal_animating',
            revealAnimationEndTime: endTime,
            animation: {
                type: 'hidden_reveal',
                stones: [{ point: { x: 1, y: 1 }, player: Player.Black }],
                startTime: Date.now(),
                duration: 3000,
            } as any,
        });
        const incoming = minimalSession({
            mode: GameMode.Hidden,
            gameCategory: 'adventure',
            isAiGame: true,
            gameStatus: 'playing',
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('hidden_reveal_animating');
        expect(merged.animation).toEqual(existing.animation);
        expect(merged.revealAnimationEndTime).toBe(endTime);
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

    it('preserves moved chess pieces when incoming snapshot still has opening layout', () => {
        const pieces = generateChessGoInitialPieces(13);
        const existing = minimalSession({
            mode: GameMode.Chess,
            isAiGame: true,
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces: pieces,
            chessPieceMovedThisTurn: true,
            boardState: Array.from({ length: 13 }, () => Array(13).fill(Player.None)),
        }) as LiveGameSession;
        const pawn = existing.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        applyChessMoveToSession(existing, pawn.id, 5, 9);
        existing.chessPieceMovedThisTurn = true;
        existing.moveHistory = [{ player: Player.Black, x: 6, y: 6 }];

        const incoming = minimalSession({
            mode: GameMode.Chess,
            isAiGame: true,
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces: pieces,
            chessPieceMovedThisTurn: false,
            moveHistory: [{ player: Player.Black, x: 6, y: 6 }],
            currentPlayer: Player.White,
        }) as LiveGameSession;

        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.chessPieces!.find((p) => p.id === pawn.id)!.y).toBe(9);
        expect(merged.boardState![9]![5]).toBe(Player.Black);
        expect(merged.boardState![10]![5]).toBe(Player.None);
    });

    it('preserves client moveHistory when stale incoming has shorter chess go history', () => {
        const pieces = generateChessGoInitialPieces(13);
        const existing = minimalSession({
            mode: GameMode.Chess,
            isAiGame: true,
            gameStatus: 'playing',
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces: pieces,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 7, y: 7, player: Player.White },
                { x: 5, y: 5, player: Player.Black },
            ],
            currentPlayer: Player.White,
        }) as LiveGameSession;
        existing.boardState = Array.from({ length: 13 }, () => Array(13).fill(Player.None));
        existing.boardState![6]![6] = Player.Black;
        existing.boardState![7]![7] = Player.White;
        existing.boardState![5]![5] = Player.Black;

        const incoming = minimalSession({
            mode: GameMode.Chess,
            isAiGame: true,
            gameStatus: 'playing',
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces: pieces,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 7, y: 7, player: Player.White },
            ],
            currentPlayer: Player.Black,
        }) as LiveGameSession;

        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.moveHistory).toHaveLength(3);
        expect(merged.boardState![5]![5]).toBe(Player.Black);
        expect(merged.boardState![7]![7]).toBe(Player.White);
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

    it('strips stale justCaptured when moveHistory advances without capture score change', () => {
        const staleCapture = [{ point: { x: 1, y: 1 }, player: Player.White, wasHidden: false }];
        const existing = minimalSession({
            isAiGame: false,
            gameStatus: 'playing',
            moveHistory: [{ x: 2, y: 2, player: Player.Black }],
            captures: { [Player.None]: 0, [Player.Black]: 3, [Player.White]: 0 },
            justCaptured: staleCapture as any,
        });
        const incoming = minimalSession({
            isAiGame: false,
            gameStatus: 'playing',
            moveHistory: [
                { x: 2, y: 2, player: Player.Black },
                { x: 3, y: 3, player: Player.White },
            ],
            captures: { [Player.None]: 0, [Player.Black]: 3, [Player.White]: 0 },
            justCaptured: staleCapture as any,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.justCaptured).toEqual([]);
    });
});

describe('shouldIgnoreStalePendingPveStartRegression', () => {
    it('ignores pending WS while local is playing with zero moves after confirm', () => {
        const existing = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'playing',
            moveHistory: [],
            startTime: Date.now(),
        } as Partial<LiveGameSession>);
        const incoming = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'pending',
        } as Partial<LiveGameSession>);
        expect(shouldIgnoreStalePendingPveStartRegression(incoming, existing)).toBe(true);
    });

    it('ignores pending WS while local is in base placement after confirm', () => {
        const existing = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'base_placement',
            mode: GameMode.Base,
        } as Partial<LiveGameSession>);
        const incoming = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'pending',
            mode: GameMode.Base,
        } as Partial<LiveGameSession>);
        expect(shouldIgnoreStalePendingPveStartRegression(incoming, existing)).toBe(true);
    });

    it('accepts pending when local is also pending', () => {
        const existing = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'pending',
        } as Partial<LiveGameSession>);
        const incoming = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'pending',
        } as Partial<LiveGameSession>);
        expect(shouldIgnoreStalePendingPveStartRegression(incoming, existing)).toBe(false);
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

    it('accepts PVE pending → playing forward progress (next-stage start confirm)', () => {
        const existing = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'pending',
        });
        const incoming = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'playing',
        });
        expect(shouldIgnoreStaleLiveTerminalGameUpdate(incoming, existing)).toBe(false);
    });
});

describe('preserveTerminalGameSessionOnMerge', () => {
    it('keeps local ended when HTTP merge would regress to playing', () => {
        const existing = minimalSession({
            isAiGame: true,
            gameStatus: 'ended',
            winner: Player.Black,
            winReason: 'chess_checkmate',
        });
        const incoming = minimalSession({
            isAiGame: true,
            gameStatus: 'playing',
            currentPlayer: Player.White,
        });
        const merged = preserveTerminalGameSessionOnMerge(incoming, existing);
        expect(merged.gameStatus).toBe('ended');
        expect(merged.winner).toBe(Player.Black);
        expect(merged.winReason).toBe('chess_checkmate');
    });

    it('accepts ended packet with new summary over local ended without summary', () => {
        const existing = minimalSession({
            isAiGame: false,
            gameStatus: 'ended',
            winner: Player.Black,
            winReason: 'castle_capture',
        });
        const incoming = minimalSession({
            isAiGame: false,
            gameStatus: 'ended',
            winner: Player.Black,
            winReason: 'castle_capture',
            summary: { u1: { gold: 100 } } as any,
        });
        const merged = preserveTerminalGameSessionOnMerge(incoming, existing);
        expect(merged.summary).toEqual({ u1: { gold: 100 } });
    });

    it('accepts ended packet when ad gold double flags advance with same summary key count', () => {
        const existing = minimalSession({
            isAiGame: true,
            gameStatus: 'ended',
            winner: Player.Black,
            winReason: 'resign',
            summary: {
                p1: { gold: 100, matchGold: 100, adGoldDoubled: false, adGoldBonus: 0 },
            } as any,
        });
        const incoming = minimalSession({
            isAiGame: true,
            gameStatus: 'ended',
            winner: Player.Black,
            winReason: 'resign',
            summary: {
                p1: { gold: 200, matchGold: 200, adGoldDoubled: true, adGoldBonus: 100 },
            } as any,
        });
        const merged = preserveTerminalGameSessionOnMerge(incoming, existing);
        expect(merged.summary?.p1?.adGoldDoubled).toBe(true);
        expect(merged.summary?.p1?.adGoldBonus).toBe(100);
        expect(merged.summary?.p1?.gold).toBe(200);
    });
});

describe('isPveAwaitingStartConfirmModal / isPvePostStartConfirmPrePlayPhase', () => {
    it('awaiting modal only for pending 0-move PVE without start time', () => {
        const pending = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'pending',
        });
        expect(isPveAwaitingStartConfirmModal(pending)).toBe(true);
        expect(isPvePostStartConfirmPrePlayPhase(pending)).toBe(false);
    });

    it('post-confirm pre-play is playing with 0 moves', () => {
        const playing = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'playing',
        });
        expect(isPveAwaitingStartConfirmModal(playing)).toBe(false);
        expect(isPvePostStartConfirmPrePlayPhase(playing)).toBe(true);
    });
});

describe('mergeGameUpdateByArena PVE start confirm', () => {
    it('does not preserve terminal ended when CONFIRM advances to playing', () => {
        const existing = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'ended',
            winner: Player.Black,
        });
        const incoming = minimalSession({
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            gameStatus: 'playing',
            winner: null,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, {
            source: 'http_action',
            actionType: 'CONFIRM_SINGLE_PLAYER_GAME_START',
        });
        expect(merged.gameStatus).toBe('playing');
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

    it('chess-go playing: prefers server chessPieces and rebuilds board from pieces + moves', () => {
        const pieces = generateChessGoInitialPieces(CHESS_GO_BOARD_SIZE);
        const movedPiece = pieces.find((p) => p.owner === Player.Black && p.type !== 'pawn');
        expect(movedPiece).toBeTruthy();
        movedPiece!.x = 4;
        movedPiece!.y = 4;

        const staleBoard = Array.from({ length: CHESS_GO_BOARD_SIZE }, () =>
            Array(CHESS_GO_BOARD_SIZE).fill(Player.None),
        );
        for (const p of pieces) {
            if (p.x !== movedPiece!.x || p.y !== movedPiece!.y) {
                staleBoard[p.y]![p.x] = p.owner;
            }
        }
        staleBoard[3]![3] = Player.Black;

        const existing = minimalSession({
            mode: GameMode.Chess,
            isAiGame: true,
            gameStatus: 'playing',
            chessPieces: pieces.map((p) => ({ ...p })),
            moveHistory: [{ x: 3, y: 3, player: Player.Black }],
            boardState: staleBoard,
        });

        const serverPieces = pieces.map((p) => ({ ...p }));
        const incoming = minimalSession({
            mode: GameMode.Chess,
            isAiGame: true,
            gameStatus: 'playing',
            chessPieces: serverPieces,
            moveHistory: [{ x: 3, y: 3, player: Player.Black }],
            boardState: staleBoard,
        });

        const merged = mergeLiveRejoinResponseWithExistingBoard(existing, incoming);
        expect(merged.chessPieces?.find((p) => p.id === movedPiece!.id)?.x).toBe(4);
        expect(merged.boardState?.[4]?.[4]).toBe(Player.Black);
        expect(merged.boardState?.[3]?.[3]).toBe(Player.Black);
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

describe('buildOptimisticAiLobbyStartSession', () => {
    it('transitions standard AI lobby pending to playing with configured human color', () => {
        const pending = minimalSession({
            isAiGame: true,
            gameCategory: 'normal',
            gameStatus: 'pending',
            mode: GameMode.Standard,
            player1: { id: 'human-1', username: 'h', nickname: 'h' } as any,
            player2: { id: 'ai-player-01', username: 'ai', nickname: 'ai' } as any,
            blackPlayerId: null as any,
            whitePlayerId: null as any,
            settings: { boardSize: 19, komi: 6.5, player1Color: Player.White },
        });
        expect(resolveAiLobbyHumanPlayerColor(pending)).toBe(Player.White);
        const optimistic = buildOptimisticAiLobbyStartSession(pending, 1_000);
        expect(optimistic?.gameStatus).toBe('playing');
        expect(optimistic?.blackPlayerId).toBe('ai-player-01');
        expect(optimistic?.whitePlayerId).toBe('human-1');
        expect(optimistic?.gameStartTime).toBe(1_000);
    });

    it('uses base_placement for base AI lobby', () => {
        const pending = minimalSession({
            isAiGame: true,
            gameCategory: 'normal',
            gameStatus: 'pending',
            mode: GameMode.Base,
            player1: { id: 'human-1', username: 'h', nickname: 'h' } as any,
            player2: { id: 'ai-player-01', username: 'ai', nickname: 'ai' } as any,
            blackPlayerId: null as any,
            whitePlayerId: null as any,
        });
        const optimistic = buildOptimisticAiLobbyStartSession(pending);
        expect(optimistic?.gameStatus).toBe('base_placement');
    });

    it('uses chess_piece_placement for chess AI lobby', () => {
        const pending = minimalSession({
            isAiGame: true,
            gameCategory: 'normal',
            gameStatus: 'pending',
            mode: GameMode.Chess,
            player1: { id: 'human-1', username: 'h', nickname: 'h' } as any,
            player2: { id: 'ai-player-01', username: 'ai', nickname: 'ai' } as any,
            blackPlayerId: null as any,
            whitePlayerId: null as any,
            settings: { boardSize: 13, player1Color: Player.Black },
        });
        const optimistic = buildOptimisticAiLobbyStartSession(pending);
        expect(optimistic?.gameStatus).toBe('chess_piece_placement');
        expect(optimistic?.boardState?.length).toBe(13);
    });
});

describe('buildOptimisticPveStartConfirmSession', () => {
    it('transitions tower pending to playing for standard start confirm', () => {
        const pending = minimalSession({
            gameCategory: 'tower',
            gameStatus: 'pending',
            mode: GameMode.Speed,
            player1: { id: 'human-1', username: 'h', nickname: 'h' } as any,
            player2: { id: 'ai-player-01', username: 'ai', nickname: 'ai' } as any,
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
        });
        const optimistic = buildOptimisticPveStartConfirmSession(pending, 2_000);
        expect(optimistic?.gameStatus).toBe('playing');
        expect(optimistic?.currentPlayer).toBe(Player.Black);
        expect(optimistic?.startTime).toBe(2_000);
        expect(optimistic?.gameStartTime).toBe(2_000);
    });

    it('uses base_placement for tower base stages', () => {
        const pending = minimalSession({
            gameCategory: 'tower',
            gameStatus: 'pending',
            mode: GameMode.Base,
            player1: { id: 'human-1', username: 'h', nickname: 'h' } as any,
            player2: { id: 'ai-player-01', username: 'ai', nickname: 'ai' } as any,
        });
        const optimistic = buildOptimisticPveStartConfirmSession(pending);
        expect(optimistic?.gameStatus).toBe('base_placement');
        expect(optimistic?.startTime).toBeDefined();
    });
});

describe('shouldIgnoreStalePvpChessPrePlayRegression', () => {
    it('ignores playing without chessPieces during chess_piece_placement', () => {
        const existing = minimalSession({
            mode: GameMode.Chess,
            isAiGame: false,
            gameStatus: 'chess_piece_placement',
            chessPiecePlacementDraft: { p1: [{ type: 'pawn', x: 3, y: 2 }] },
            chessPiecePlacementDeadline: Date.now() + 60_000,
            serverRevision: 2,
        });
        const incoming = minimalSession({
            mode: GameMode.Chess,
            isAiGame: false,
            gameStatus: 'playing',
            chessPieces: [],
            serverRevision: 1,
        });
        expect(shouldIgnoreStalePvpChessPrePlayRegression(incoming, existing)).toBe(true);
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('chess_piece_placement');
        expect(merged.chessPiecePlacementDraft?.p1).toEqual([{ type: 'pawn', x: 3, y: 2 }]);
    });

    it('allows playing when chessPieces are present after placement', () => {
        const pieces = generateChessGoInitialPieces(CHESS_GO_BOARD_SIZE);
        const existing = minimalSession({
            mode: GameMode.Chess,
            isAiGame: false,
            gameStatus: 'chess_piece_placement',
            chessPiecePlacementDraft: { p1: [] },
            serverRevision: 2,
        });
        const incoming = minimalSession({
            mode: GameMode.Chess,
            isAiGame: false,
            gameStatus: 'playing',
            chessPieces: pieces,
            currentPlayer: Player.Black,
            serverRevision: 3,
            settings: { boardSize: 13, komi: 6.5 },
            boardState: Array.from({ length: 13 }, () => Array(13).fill(Player.None)),
        });
        expect(shouldIgnoreStalePvpChessPrePlayRegression(incoming, existing)).toBe(false);
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('playing');
        expect(merged.chessPieces?.length).toBeGreaterThan(0);
        expect(merged.chessPiecePlacementDraft).toBeUndefined();
    });

    it('protects Mix+Chess nigiri_reveal from empty playing', () => {
        const existing = minimalSession({
            mode: GameMode.Mix,
            isAiGame: false,
            gameStatus: 'nigiri_reveal',
            settings: { boardSize: 13, mixedModes: [GameMode.Chess, GameMode.Hidden] },
        });
        const incoming = minimalSession({
            mode: GameMode.Mix,
            isAiGame: false,
            gameStatus: 'playing',
            chessPieces: [],
            settings: { boardSize: 13, mixedModes: [GameMode.Chess, GameMode.Hidden] },
        });
        expect(shouldIgnoreStalePvpChessPrePlayRegression(incoming, existing)).toBe(true);
    });
});

describe('shouldIgnoreStalePendingAiLobbyStartRegression', () => {
    it('ignores stale pending while local already started', () => {
        const existing = minimalSession({
            isAiGame: true,
            gameCategory: 'normal',
            gameStatus: 'playing',
            gameStartTime: 100,
        });
        const incoming = minimalSession({
            isAiGame: true,
            gameCategory: 'normal',
            gameStatus: 'pending',
        });
        expect(shouldIgnoreStalePendingAiLobbyStartRegression(incoming, existing)).toBe(true);
    });
});
