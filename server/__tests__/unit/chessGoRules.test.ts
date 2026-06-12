import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, ChessPieceType } from '../../../shared/types/entities.js';
import {
    applyChessMoveToSession,
    applyChessPiecesToBoard,
    boardMatchesChessPieces,
    buildChessGoOpeningBoardState,
    createEmptyBoardState,
    enumerateLegalChessGoStonePlacements,
    enumerateLegalChessMoves,
    ensureChessGoOpeningLayout,
    generateChessGoInitialPieces,
    getChessPieceCaptureValue,
    getInitialRemainingMoves,
    hasChessPiecesMovedFromStart,
    hasLegacyChessFlankPawnLayout,
    isPlayableChessGoIntersection,
    isStandardChessGoOpeningBoard,
    isStandardChessGoOpeningLayout,
    migrateUnmovedLegacyFlankPawns,
    patchChessStonesOnBoard,
    needsChessGoLayoutRepair,
    hasLegacyChessEdgeMajorLayout,
    isLegacyChessGoLayout,
    normalizeChessGoSession,
    processChessGoMove,
    reconcileChessGoClientSession,
    shouldPreserveChessGoMidgameState,
    repairChessOpeningWhilePreservingGoStones,
    syncChessGoBoardFromPiecesAndMoves,
    stripLegacyChessFlankBoardStones,
    resolveChessCapturesByLiberty,
    commitChessGoPlacementCaptures,
    validateChessMove,
} from '../../../shared/utils/chessGoRules.js';
import { pickAiChessMoveIfAny, shouldAttemptChessMoveThisTurn } from '../../../shared/utils/chessGoAiHeuristic.js';

function createChessSession(): LiveGameSession {
    const pieces = generateChessGoInitialPieces(13);
    const boardState = Array.from({ length: 13 }, () => Array(13).fill(Player.None)) as LiveGameSession['boardState'];
    return {
        id: 'test-chess',
        mode: GameMode.Chess,
        settings: { boardSize: 13, komi: 6.5, scoringTurnLimit: 100 },
        player1: { id: 'p1' } as LiveGameSession['player1'],
        player2: { id: 'p2' } as LiveGameSession['player2'],
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        boardState: applyChessPiecesToBoard(boardState, pieces),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        chessPieces: pieces,
        chessCaptureScore: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        chessPieceMovedThisTurn: false,
        winner: null,
        winReason: null,
        createdAt: Date.now(),
        passCount: 0,
        koInfo: null,
        blackTimeLeft: 300,
        whiteTimeLeft: 300,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
    } as LiveGameSession;
}

describe('chessGoRules', () => {
    it('places 28 pieces on 13x13 with correct remaining moves', () => {
        const pieces = generateChessGoInitialPieces(13);
        expect(pieces).toHaveLength(28);
        expect(pieces.filter((p) => p.type === 'pawn')).toHaveLength(14);
        expect(pieces.filter((p) => p.type === 'queen')).toHaveLength(2);
        for (const p of pieces) {
            expect(p.remainingMoves).toBe(getInitialRemainingMoves(p.type));
        }
    });

    it('places pawns on row directly in front of major pieces', () => {
        const pieces = generateChessGoInitialPieces(13);
        const blackPawns = pieces.filter((p) => p.owner === Player.Black && p.type === 'pawn');
        expect(blackPawns).toHaveLength(7);
        for (const pawn of blackPawns) {
            expect(pawn.y).toBe(10);
            expect(pawn.x).toBeGreaterThanOrEqual(3);
            expect(pawn.x).toBeLessThanOrEqual(9);
        }
        const whitePawns = pieces.filter((p) => p.owner === Player.White && p.type === 'pawn');
        for (const pawn of whitePawns) {
            expect(pawn.y).toBe(2);
        }
    });

    it('allows pawn double step from starting square only', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        expect(validateChessMove(session, pawn.id, 5, 8, Player.Black).ok).toBe(true);
        applyChessMoveToSession(session, pawn.id, 5, 9);
        expect(validateChessMove(session, pawn.id, 5, 7, Player.Black).ok).toBe(false);
    });

    it('blocks pawn double step when intermediate square is occupied', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        session.boardState[9][5] = Player.White;
        expect(validateChessMove(session, pawn.id, 5, 8, Player.Black).ok).toBe(false);
    });

    it('detects legacy flank pawn layout', () => {
        const pieces = generateChessGoInitialPieces(13);
        expect(hasLegacyChessFlankPawnLayout(pieces)).toBe(false);
        const legacy = pieces.map((p) =>
            p.type === 'pawn' && p.owner === Player.Black && p.x === 3
                ? { ...p, x: 0, y: 9, startX: 0, startY: 9 }
                : p,
        );
        expect(hasLegacyChessFlankPawnLayout(legacy)).toBe(true);
    });

    it('rejects legacy flank stones on opening board', () => {
        const pieces = generateChessGoInitialPieces(13);
        const board = buildChessGoOpeningBoardState(pieces, 13);
        expect(isStandardChessGoOpeningBoard(board)).toBe(true);
        board[4]![0] = Player.White;
        board[8]![12] = Player.Black;
        expect(isStandardChessGoOpeningBoard(board)).toBe(false);
    });

    it('ensureChessGoOpeningLayout fixes board with flank stones but standard chessPieces', () => {
        const pieces = generateChessGoInitialPieces(13);
        const session = createChessSession();
        session.chessPieces = pieces;
        session.boardState = buildChessGoOpeningBoardState(pieces, 13);
        session.boardState[4]![0] = Player.White;
        session.boardState[8]![12] = Player.Black;
        expect(ensureChessGoOpeningLayout(session)).toBe(true);
        expect(isStandardChessGoOpeningBoard(session.boardState)).toBe(true);
        expect(session.chessPieces!.filter((p) => p.type === 'pawn' && p.owner === Player.White).every((p) => p.y === 2)).toBe(true);
    });

    it('ensureChessGoOpeningLayout fixes stale board with standard pieces', () => {
        const pieces = generateChessGoInitialPieces(13);
        const session = createChessSession();
        session.chessPieces = pieces;
        session.boardState = createEmptyBoardState(13);
        session.boardState[9][0] = Player.Black;
        expect(boardMatchesChessPieces(session.boardState, pieces)).toBe(false);
        expect(ensureChessGoOpeningLayout(session)).toBe(true);
        expect(boardMatchesChessPieces(session.boardState, pieces)).toBe(true);
    });

    it('ensureChessGoOpeningLayout no longer reorders custom legacy major pieces', () => {
        const pieces = generateChessGoInitialPieces(13);
        const wrongOrder = pieces.map((p) => {
            if (p.owner === Player.Black && p.x === 9 && p.y === 11 && p.type === 'rook') {
                return { ...p, type: 'bishop' as const };
            }
            if (p.owner === Player.Black && p.x === 8 && p.y === 11 && p.type === 'bishop') {
                return { ...p, type: 'rook' as const };
            }
            return p;
        });
        const session = createChessSession();
        session.chessPieces = wrongOrder;
        session.boardState = buildChessGoOpeningBoardState(wrongOrder, 13);
        expect(ensureChessGoOpeningLayout(session)).toBe(false);
        expect(session.chessPieces).toHaveLength(28);
    });

    it('detects legacy edge major layout (y=0/12)', () => {
        const legacy = generateChessGoInitialPieces(13).map((p) => {
            if (p.owner === Player.White && p.type !== 'pawn') {
                return { ...p, y: 0, startY: 0 };
            }
            if (p.owner === Player.Black && p.type !== 'pawn') {
                return { ...p, y: 12, startY: 12 };
            }
            return p;
        });
        expect(hasLegacyChessEdgeMajorLayout(legacy)).toBe(true);
        expect(isLegacyChessGoLayout(legacy)).toBe(true);
        const session = createChessSession();
        session.chessPieces = legacy;
        session.boardState = buildChessGoOpeningBoardState(legacy, 13);
        const normalized = normalizeChessGoSession(session);
        expect(isLegacyChessGoLayout(normalized.chessPieces)).toBe(true);
        expect(normalized.boardState![0]![5]).toBe(Player.White);
        expect(normalized.boardState![12]![5]).toBe(Player.Black);
    });

    it('normalizeChessGoSession preserves legacy flank pawn layout (no auto migration)', () => {
        const legacy = generateChessGoInitialPieces(13).map((p) => {
            if (p.type === 'pawn' && p.owner === Player.White && p.x === 3) {
                return { ...p, x: 0, y: 4, startX: 0, startY: 4 };
            }
            if (p.type === 'pawn' && p.owner === Player.Black && p.x === 9) {
                return { ...p, x: 12, y: 9, startX: 12, startY: 9 };
            }
            return p;
        });
        const session = createChessSession();
        session.chessPieces = legacy;
        session.boardState = buildChessGoOpeningBoardState(legacy, 13);
        const reconciled = reconcileChessGoClientSession(session);
        expect(hasLegacyChessFlankPawnLayout(reconciled.chessPieces)).toBe(true);
    });

    it('ensureChessGoOpeningLayout clamps invalid board size without auto-generating pieces', () => {
        const session = createChessSession();
        session.settings = { ...session.settings, boardSize: 15 };
        session.boardState = createEmptyBoardState(15);
        session.chessPieces = [];
        expect(ensureChessGoOpeningLayout(session)).toBe(true);
        expect(session.settings.boardSize).toBe(13);
        expect(session.boardState).toHaveLength(13);
        expect(session.chessPieces).toHaveLength(0);
    });

    it('reconcileChessGoClientSession aligns opening board to chessPieces', () => {
        const pieces = generateChessGoInitialPieces(13);
        const session = createChessSession();
        session.chessPieces = pieces;
        session.boardState = buildChessGoOpeningBoardState(pieces, 13);
        session.boardState[9][0] = Player.Black;
        const reconciled = reconcileChessGoClientSession(session);
        expect(boardMatchesChessPieces(reconciled.boardState, pieces)).toBe(true);
        expect(reconciled.boardState![9][0]).toBe(Player.None);
    });

    it('places major pieces in standard chess order RNBQBNR', () => {
        const pieces = generateChessGoInitialPieces(13);
        const order: ChessPieceType[] = ['rook', 'knight', 'bishop', 'queen', 'bishop', 'knight', 'rook'];
        for (let i = 0; i < order.length; i++) {
            const x = 3 + i;
            const black = pieces.find((p) => p.owner === Player.Black && p.x === x && p.y === 11)!;
            const white = pieces.find((p) => p.owner === Player.White && p.x === x && p.y === 1)!;
            expect(black.type).toBe(order[i]);
            expect(white.type).toBe(order[i]);
        }
    });

    it('blocks rook when path is occupied', () => {
        const session = createChessSession();
        const blackRook = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'rook' && p.x === 3)!;
        session.boardState[blackRook.y][blackRook.x + 1] = Player.Black;
        const moves = enumerateLegalChessMoves(session, Player.Black);
        expect(moves.some((m) => m.pieceId === blackRook.id && m.to.x === blackRook.x + 2)).toBe(false);
    });

    it('allows knight to jump over stones', () => {
        const session = createChessSession();
        const knight = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'knight' && p.x === 4)!;
        session.boardState[knight.y][knight.x + 1] = Player.White;
        const v = validateChessMove(session, knight.id, knight.x + 1, knight.y - 2, Player.Black);
        expect(v.ok).toBe(true);
    });

    it('captures surrounded chess piece and awards queen score', () => {
        const session = createChessSession();
        const queen = session.chessPieces!.find((p) => p.owner === Player.White && p.type === 'queen')!;
        session.boardState = Array.from({ length: 13 }, () => Array(13).fill(Player.None)) as LiveGameSession['boardState'];
        session.boardState[queen.y][queen.x] = Player.White;
        session.boardState[queen.y + 1][queen.x] = Player.Black;
        session.boardState[queen.y - 1][queen.x] = Player.Black;
        session.boardState[queen.y][queen.x + 1] = Player.Black;
        session.boardState[queen.y][queen.x - 1] = Player.Black;
        session.chessPieces = [queen];

        const result = resolveChessCapturesByLiberty(session, Player.Black);
        expect(result.capturedChessPieces).toHaveLength(1);
        expect(session.chessCaptureScore![Player.Black]).toBe(getChessPieceCaptureValue('queen'));
        expect(session.boardState[queen.y][queen.x]).toBe(Player.None);
    });

    it('normalizeChessGoSession keeps captured go stones removed after chess liberty capture', () => {
        const session = createChessSession();
        session.moveHistory = [
            { x: 6, y: 6, player: Player.White },
            { x: 6, y: 5, player: Player.Black },
            { x: 5, y: 6, player: Player.Black },
            { x: 7, y: 6, player: Player.Black },
            { x: 6, y: 7, player: Player.Black },
        ];
        session.boardState = normalizeChessGoSession(session).boardState;
        expect(session.boardState[6]![6]).toBe(Player.White);

        resolveChessCapturesByLiberty(session, Player.Black);
        expect(session.boardState[6]![6]).toBe(Player.None);
        expect(session.chessGoRemovedPoints?.some((p) => p.x === 6 && p.y === 6)).toBe(true);

        const normalized = normalizeChessGoSession(session);
        expect(normalized.boardState[6]![6]).toBe(Player.None);
    });

    it('commitChessGoPlacementCaptures allows re-placing on a previously captured intersection', () => {
        const session = createChessSession();
        session.chessGoRemovedPoints = [{ x: 6, y: 6 }];
        session.moveHistory = [{ x: 6, y: 6, player: Player.White }];
        commitChessGoPlacementCaptures(session, 6, 6, []);
        session.moveHistory.push({ x: 6, y: 6, player: Player.Black });
        const board = normalizeChessGoSession(session).boardState;
        expect(board[6]![6]).toBe(Player.Black);
    });

    it('rejects move when remainingMoves is 0', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn')!;
        pawn.remainingMoves = 0;
        const v = validateChessMove(session, pawn.id, pawn.x, pawn.y - 1, Player.Black);
        expect(v.ok).toBe(false);
    });

    it('strips legacy flank board stones while keeping standard chessPieces at move 0', () => {
        const pieces = generateChessGoInitialPieces(13);
        const session = createChessSession();
        session.chessPieces = pieces;
        session.boardState = buildChessGoOpeningBoardState(pieces, 13);
        session.boardState[4]![0] = Player.White;
        session.boardState[8]![12] = Player.Black;
        stripLegacyChessFlankBoardStones(session);
        expect(session.boardState[4]![0]).toBe(Player.None);
        expect(session.boardState[8]![12]).toBe(Player.None);
        expect(session.boardState[2]![5]).toBe(Player.White);
    });

    it('migrateUnmovedLegacyFlankPawns moves side pawns in front of majors', () => {
        const legacy = generateChessGoInitialPieces(13).map((p) => {
            if (p.type === 'pawn' && p.owner === Player.White && p.x === 3) {
                return { ...p, x: 0, y: 4, startX: 0, startY: 4 };
            }
            if (p.type === 'pawn' && p.owner === Player.Black && p.x === 9) {
                return { ...p, x: 12, y: 9, startX: 12, startY: 9 };
            }
            return p;
        });
        expect(migrateUnmovedLegacyFlankPawns(legacy)).toBe(true);
        expect(legacy.find((p) => p.owner === Player.White && p.type === 'pawn' && p.x === 0)).toBeUndefined();
        expect(legacy.filter((p) => p.owner === Player.White && p.type === 'pawn').every((p) => p.y === 2)).toBe(true);
    });

    it('repairChessOpeningWhilePreservingGoStones restores full layout after go stone on legacy session', () => {
        const legacy = generateChessGoInitialPieces(13).map((p) => {
            if (p.type === 'pawn' && p.owner === Player.White) {
                return { ...p, x: 0, y: 2 + p.x - 3, startX: 0, startY: 2 + p.x - 3 };
            }
            if (p.type === 'pawn' && p.owner === Player.Black) {
                return { ...p, x: 12, y: 8 + p.x - 3, startX: 12, startY: 8 + p.x - 3 };
            }
            if (p.owner === Player.White && p.type !== 'pawn') {
                return { ...p, y: 0, startY: 0 };
            }
            if (p.owner === Player.Black && p.type !== 'pawn') {
                return { ...p, y: 12, startY: 12 };
            }
            return p;
        });
        const session = createChessSession();
        session.settings = { ...session.settings, boardSize: 15 };
        session.chessPieces = legacy;
        session.boardState = createEmptyBoardState(15);
        for (const p of legacy) {
            session.boardState[p.y]![p.x] = p.owner;
        }
        session.moveHistory = [{ player: Player.Black, x: 6, y: 6 }];
        session.boardState[6]![6] = Player.Black;

        expect(repairChessOpeningWhilePreservingGoStones(session)).toBe(false);
        expect(session.settings.boardSize).toBe(13);
        expect(isLegacyChessGoLayout(session.chessPieces)).toBe(true);
        expect(session.boardState).toHaveLength(13);
        expect(session.boardState[6]![6]).toBe(Player.Black);
    });

    it('reconcile preserves legacy flank pawns after go stone placed', () => {
        const legacy = generateChessGoInitialPieces(13).map((p) =>
            p.type === 'pawn' && p.owner === Player.White && p.x === 3
                ? { ...p, x: 0, y: 4, startX: 0, startY: 4 }
                : p,
        );
        const session = createChessSession();
        session.chessPieces = legacy;
        session.boardState = buildChessGoOpeningBoardState(legacy, 13);
        session.moveHistory = [{ player: Player.Black, x: 6, y: 6 }];
        session.boardState[6]![6] = Player.Black;
        const reconciled = reconcileChessGoClientSession(session);
        expect(hasLegacyChessFlankPawnLayout(reconciled.chessPieces)).toBe(true);
        expect(reconciled.boardState![6]![6]).toBe(Player.Black);
    });

    it('reconcile patches board from chessPieces after go stone placed', () => {
        const pieces = generateChessGoInitialPieces(13);
        const session = createChessSession();
        session.chessPieces = pieces;
        session.boardState = buildChessGoOpeningBoardState(pieces, 13);
        session.boardState[4]![0] = Player.White;
        session.moveHistory = [{ player: Player.Black, x: 6, y: 6 }];
        session.boardState[6]![6] = Player.Black;
        const reconciled = reconcileChessGoClientSession(session);
        expect(reconciled.boardState![4]![0]).toBe(Player.None);
        expect(reconciled.boardState![2]![5]).toBe(Player.White);
        expect(reconciled.boardState![6]![6]).toBe(Player.Black);
    });

    it('patchChessStonesOnBoard clears stale stone at old square after piece moved', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        applyChessMoveToSession(session, pawn.id, 5, 9, Player.Black);
        expect(session.lastChessMove).toEqual({
            from: { x: pawn.startX, y: pawn.startY },
            to: { x: 5, y: 9 },
            player: Player.Black,
        });
        session.boardState[pawn.startY]![pawn.startX] = Player.Black;
        patchChessStonesOnBoard(session);
        expect(session.boardState[pawn.startY]![pawn.startX]).toBe(Player.None);
        expect(session.boardState[9]![5]).toBe(Player.Black);
    });

    it('syncChessGoBoardFromPiecesAndMoves keeps moved piece after go stone', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        applyChessMoveToSession(session, pawn.id, 5, 9);
        session.moveHistory = [{ player: Player.Black, x: 6, y: 6 }];
        session.boardState[6]![6] = Player.Black;
        syncChessGoBoardFromPiecesAndMoves(session);
        expect(session.chessPieces!.find((p) => p.id === pawn.id)!.y).toBe(9);
        expect(session.chessPieces!.find((p) => p.id === pawn.id)!.remainingMoves).toBe(9);
        expect(session.boardState[9]![5]).toBe(Player.Black);
        expect(session.boardState[10]![5]).toBe(Player.None);
        expect(session.boardState[6]![6]).toBe(Player.Black);
    });

    it('normalizeChessGoSession keeps moved piece after go stone when chessPieceMovedThisTurn resets', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        applyChessMoveToSession(session, pawn.id, 5, 9);
        session.chessPieceMovedThisTurn = true;
        session.moveHistory = [{ player: Player.Black, x: 6, y: 6 }];
        session.chessPieceMovedThisTurn = false;
        const normalized = normalizeChessGoSession(session);
        expect(normalized.chessPieces!.find((p) => p.id === pawn.id)!.y).toBe(9);
        expect(normalized.boardState![9]![5]).toBe(Player.Black);
        expect(normalized.boardState![10]![5]).toBe(Player.None);
        expect(normalized.boardState![6]![6]).toBe(Player.Black);
    });

    it('needsChessGoLayoutRepair detects legacy flank board with standard pieces', () => {
        const pieces = generateChessGoInitialPieces(13);
        const session = createChessSession();
        session.chessPieces = pieces;
        session.boardState = buildChessGoOpeningBoardState(pieces, 13);
        session.boardState[4]![0] = Player.White;
        expect(needsChessGoLayoutRepair(session)).toBe(true);
        const reconciled = reconcileChessGoClientSession(session);
        expect(reconciled.boardState![4]![0]).toBe(Player.None);
    });

    it('reconcile preserves chess piece move when legacy flank pawns remain in chessPieces', () => {
        const legacy = generateChessGoInitialPieces(13).map((p) => {
            if (p.type === 'pawn' && p.owner === Player.White && p.x === 3) {
                return { ...p, x: 0, y: 4, startX: 0, startY: 4 };
            }
            return p;
        });
        const session = createChessSession();
        session.chessPieces = legacy;
        session.boardState = buildChessGoOpeningBoardState(legacy, 13);
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        applyChessMoveToSession(session, pawn.id, 5, 9);
        session.chessPieceMovedThisTurn = true;
        const reconciled = reconcileChessGoClientSession(session);
        expect(reconciled.chessPieces!.find((p) => p.id === pawn.id)!.y).toBe(9);
        expect(reconciled.chessPieceMovedThisTurn).toBe(true);
    });

    it('uses stable piece ids across regenerate', () => {
        const a = generateChessGoInitialPieces(13);
        const b = generateChessGoInitialPieces(13);
        expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
        expect(a.find((p) => p.owner === Player.Black && p.type === 'rook' && p.x === 3)?.id).toBe('b-rook-3-11');
    });

    it('does not reset layout after chess piece move at move 0', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        applyChessMoveToSession(session, pawn.id, 5, 9);
        session.chessPieceMovedThisTurn = true;
        expect(hasChessPiecesMovedFromStart(session.chessPieces)).toBe(true);
        expect(shouldPreserveChessGoMidgameState(session)).toBe(true);
        expect(ensureChessGoOpeningLayout(session)).toBe(false);
        expect(pawn.y).toBe(9);
        const reconciled = reconcileChessGoClientSession(session);
        expect(reconciled.chessPieces!.find((p) => p.id === pawn.id)!.y).toBe(9);
        expect(reconciled.chessPieceMovedThisTurn).toBe(true);
    });

    it('preserves midgame when chessPieceMovedThisTurn is set even if coords look like opening', () => {
        const session = createChessSession();
        session.moveHistory = [{ player: Player.Black, x: 6, y: 6 }];
        session.chessPieceMovedThisTurn = true;
        expect(shouldPreserveChessGoMidgameState(session)).toBe(true);
        expect(repairChessOpeningWhilePreservingGoStones(session)).toBe(false);
        const reconciled = reconcileChessGoClientSession(session);
        expect(reconciled.chessPieces).toHaveLength(28);
        expect(reconciled.boardState[6]![6]).toBe(Player.Black);
    });

    it('applyChessMove decrements remainingMoves without ending turn flag alone', () => {
        const session = createChessSession();
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        const before = pawn.remainingMoves;
        applyChessMoveToSession(session, pawn.id, pawn.x, pawn.y - 1);
        expect(pawn.remainingMoves).toBe(before - 1);
        expect(session.boardState[pawn.y][pawn.x]).toBe(Player.Black);
    });
});

describe('chessGoAiHeuristic', () => {
    it('skips move attempt when random is above threshold', () => {
        expect(shouldAttemptChessMoveThisTurn(1, 0.99)).toBe(false);
    });

    it('returns null when no legal moves', () => {
        const session = createChessSession();
        for (const p of session.chessPieces ?? []) {
            if (p.owner === Player.Black) p.remainingMoves = 0;
        }
        expect(pickAiChessMoveIfAny(session, Player.Black, 5, 0)).toBeNull();
    });

    it('returns null on random skip even with legal moves', () => {
        const session = createChessSession();
        expect(pickAiChessMoveIfAny(session, Player.Black, 5, 0.99)).toBeNull();
    });
});

describe('processChessGoMove', () => {
    it('rejects placement on chess piece intersections', () => {
        const session = createChessSession();
        expect(isPlayableChessGoIntersection(session, 5, 10)).toBe(false);
        const result = processChessGoMove(session, { x: 5, y: 10, player: Player.Black }, null, 0);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('occupied');
    });

    it('rejects suicide when surrounded by opponent stones', () => {
        const session = createChessSession();
        session.moveHistory = [
            { x: 5, y: 6, player: Player.White },
            { x: 4, y: 5, player: Player.White },
            { x: 6, y: 5, player: Player.White },
            { x: 5, y: 4, player: Player.White },
        ];
        session.boardState = normalizeChessGoSession(session).boardState;
        const result = processChessGoMove(session, { x: 5, y: 5, player: Player.Black }, null, 4);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('suicide');
    });

    it('allows legal placement on empty intersection away from pieces', () => {
        const session = createChessSession();
        const result = processChessGoMove(session, { x: 0, y: 0, player: Player.Black }, null, 0);
        expect(result.isValid).toBe(true);
        expect(result.newBoardState[0]![0]).toBe(Player.Black);
    });

    it('enumerateLegalChessGoStonePlacements skips occupied and suicide points', () => {
        const session = createChessSession();
        const legal = enumerateLegalChessGoStonePlacements(session, Player.Black);
        expect(legal.some((p) => p.x === 5 && p.y === 10)).toBe(false);
        expect(legal.length).toBeGreaterThan(0);
    });
});
