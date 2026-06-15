import * as types from '../../types/index.js';
import type { LiveGameSession } from '../../types/index.js';
import { GameMode, Player } from '../../types/enums.js';
import {
    applyChessMoveToSession,
    createEmptyChessCaptureScore,
    enumerateLegalChessMoves,
    normalizeChessGoSession,
    resolveChessCapturesByLiberty,
    sessionUsesChessGo,
    validateChessMove,
} from '../../shared/utils/chessGoRules.js';
import {
    computeChessSetupDraftScore,
    generateRandomChessSetupDraft,
    generateRandomChessSetupDraftForRemainingBudget,
    validateChessPlacementDraft,
} from '../../shared/utils/chessGoPlacement.js';
import { initializeNigiri } from './nigiri.js';
import {
    enterChessPiecePlacement,
    ensureChessPlacementState,
    getChessBudget,
    getChessDraftKey,
    getPlayerColor,
    resolveChessPlacementAndTransition,
    syncChessPlacementBoard,
    updateChessPlacementState,
} from './chessPlacementFlow.js';
import { isPairClassicGame } from '../../shared/utils/pairGameTurn.js';
import * as summaryService from '../summaryService.js';

export { enterChessPiecePlacement, updateChessPlacementState, startChessPlacementAfterNigiri } from './chessPlacementFlow.js';

function resolveStrategicAiHumanColor(game: types.LiveGameSession, neg: types.Negotiation): types.Player {
    const preferred = neg.challenger?.id === game.player1.id
        ? game.settings.player1Color
        : game.settings.player1Color === types.Player.White
          ? types.Player.White
          : types.Player.Black;
    return preferred === types.Player.White ? types.Player.White : types.Player.Black;
}

/** 서버 저장·캐시·로드 직전: chessPieces 기준으로 boardState를 맞춘다 */
export function repairChessGoSessionState(game: types.LiveGameSession): void {
    if (!sessionUsesChessGo(game)) return;
    if (game.gameStatus === 'chess_piece_placement') {
        syncChessPlacementBoard(game);
        return;
    }
    const normalized = normalizeChessGoSession(game);
    game.chessPieces = normalized.chessPieces;
    game.boardState = normalized.boardState;
    game.settings = normalized.settings;
    game.chessCaptureScore = normalized.chessCaptureScore;
    game.chessPieceMovedThisTurn = normalized.chessPieceMovedThisTurn;
}

export function initializeChessGame(game: types.LiveGameSession, neg: types.Negotiation, now: number): void {
    const boardSize = game.settings.boardSize ?? 13;
    if (boardSize !== 9 && boardSize !== 13) {
        game.settings = { ...game.settings, boardSize: 13 };
    }
    game.chessCaptureScore = createEmptyChessCaptureScore();
    game.chessPieceMovedThisTurn = false;
    game.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    game.koInfo = null;
    game.moveHistory = [];
    game.passCount = 0;

    const p1 = game.player1;
    const p2 = game.player2;

    if (game.isAiGame) {
        const humanPlayerColor = resolveStrategicAiHumanColor(game, neg);
        if (humanPlayerColor === types.Player.Black) {
            game.blackPlayerId = p1.id;
            game.whitePlayerId = p2.id;
        } else {
            game.whitePlayerId = p1.id;
            game.blackPlayerId = p2.id;
        }
        enterChessPiecePlacement(game, now);
    } else if (isPairClassicGame(game.settings, game.mode)) {
        // configurePairClassicGameStart → pair_order_reveal → chess_piece_placement
    } else {
        initializeNigiri(game, now);
    }
}

export type ChessMovePayload = {
    pieceId: string;
    toX: number;
    toY: number;
};

export async function tryEndChessOnKingCapture(
    game: types.LiveGameSession,
    capturer: types.Player.Black | types.Player.White,
): Promise<boolean> {
    if (!sessionUsesChessGo(game)) return false;
    if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') return false;
    const opponent = capturer === Player.Black ? Player.White : Player.Black;
    const opponentStillHasKing = game.chessPieces?.some(
        (p) => p.type === 'king' && p.owner === opponent,
    );
    if (opponentStillHasKing) return false;
    await summaryService.endGame(game, capturer, 'chess_checkmate');
    return true;
}

export function applyChessMoveInternal(
    game: types.LiveGameSession,
    actingPlayer: types.Player.Black | types.Player.White,
    payload: ChessMovePayload,
): { error?: string; kingCaptured?: boolean } {
    if (!sessionUsesChessGo(game)) return { error: 'Not a chess go game.' };
    if (game.gameStatus !== 'playing') return { error: 'Game is not in playing state.' };

    const validation = validateChessMove(game, payload.pieceId, payload.toX, payload.toY, actingPlayer);
    if (!validation.ok) {
        return { error: 'Invalid chess move.' };
    }

    applyChessMoveToSession(game, payload.pieceId, payload.toX, payload.toY, actingPlayer);
    game.chessPieceMovedThisTurn = true;
    const captureResult = resolveChessCapturesByLiberty(game, actingPlayer);
    repairChessGoSessionState(game);
    return { kingCaptured: captureResult.kingCaptured };
}

export async function handleChessMoveAction(
    game: types.LiveGameSession,
    user: types.User,
    payload: ChessMovePayload,
): Promise<{ error?: string }> {
    if (!sessionUsesChessGo(game)) return { error: 'Not a chess go game.' };
    if (game.gameStatus !== 'playing') return { error: 'Game is not in playing state.' };
    repairChessGoSessionState(game);

    const myPlayerEnum = getPlayerColor(game, user.id);
    if (myPlayerEnum == null) return { error: 'Not your game.' };
    if (game.currentPlayer !== myPlayerEnum) return { error: 'Not your turn.' };

    const result = applyChessMoveInternal(game, myPlayerEnum, payload);
    if (result.error) return { error: result.error };
    if (result.kingCaptured) {
        await tryEndChessOnKingCapture(game, myPlayerEnum);
    }
    return {};
}

export async function handleChessPlacementAction(
    game: types.LiveGameSession,
    user: types.User,
    action: types.ServerAction,
    now: number,
): Promise<{ error?: string }> {
    if (!sessionUsesChessGo(game) || game.gameStatus !== 'chess_piece_placement') {
        return { error: 'Not in chess piece placement phase.' };
    }
    ensureChessPlacementState(game);
    const draftKey = getChessDraftKey(game, user.id);
    if (!draftKey) return { error: 'Not your game.' };
    const boardSize = game.settings.boardSize ?? 13;
    const budget = getChessBudget(game);
    const playerColor = getPlayerColor(game, user.id);
    if (playerColor == null) return { error: 'Not your game.' };

    const { type } = action as { type: string; payload?: Record<string, unknown> };
    const payload = (action as { payload?: Record<string, unknown> }).payload ?? {};

    switch (type) {
        case 'PLACE_CHESS_SETUP_PIECE': {
            if (game.chessPiecePlacementReady?.[draftKey]) {
                return { error: 'Already confirmed placement.' };
            }
            const pieceType = String(payload.pieceType ?? '') as types.ChessPieceType;
            const x = Number(payload.x);
            const y = Number(payload.y);
            if (!pieceType || pieceType === 'king' || !Number.isFinite(x) || !Number.isFinite(y)) {
                return { error: 'Invalid placement.' };
            }
            const draft = [...(game.chessPiecePlacementDraft![draftKey] ?? [])];
            draft.push({ type: pieceType, x, y });
            const validation = validateChessPlacementDraft(draft, playerColor, boardSize, budget);
            if (!validation.ok) {
                return { error: 'Invalid placement.' };
            }
            game.chessPiecePlacementDraft![draftKey] = draft;
            syncChessPlacementBoard(game);
            return {};
        }
        case 'REMOVE_CHESS_SETUP_PIECE': {
            if (game.chessPiecePlacementReady?.[draftKey]) {
                return { error: 'Already confirmed placement.' };
            }
            const x = Number(payload.x);
            const y = Number(payload.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return { error: 'Invalid placement.' };
            }
            game.chessPiecePlacementDraft![draftKey] = (game.chessPiecePlacementDraft![draftKey] ?? []).filter(
                (p) => !(p.x === x && p.y === y),
            );
            syncChessPlacementBoard(game);
            return {};
        }
        case 'RESET_CHESS_SETUP_PLACEMENT': {
            if (game.chessPiecePlacementReady?.[draftKey]) {
                return { error: 'Already confirmed placement.' };
            }
            game.chessPiecePlacementDraft![draftKey] = [];
            game.chessPiecePlacementReady![draftKey] = false;
            syncChessPlacementBoard(game);
            return {};
        }
        case 'FILL_CHESS_SETUP_RANDOMLY': {
            if (game.chessPiecePlacementReady?.[draftKey]) {
                return { error: 'Already confirmed placement.' };
            }
            const existing = game.chessPiecePlacementDraft?.[draftKey] ?? [];
            game.chessPiecePlacementDraft![draftKey] = generateRandomChessSetupDraftForRemainingBudget(
                existing,
                budget,
                boardSize,
                playerColor,
            );
            syncChessPlacementBoard(game);
            return {};
        }
        case 'CONFIRM_CHESS_SETUP_PLACEMENT': {
            const draft = game.chessPiecePlacementDraft?.[draftKey] ?? [];
            const validation = validateChessPlacementDraft(draft, playerColor, boardSize, budget);
            if (!validation.ok) {
                return { error: 'Invalid placement.' };
            }
            game.chessPiecePlacementReady![draftKey] = true;
            const started = resolveChessPlacementAndTransition(game, now);
            if (game.isAiGame && !started) {
                return { error: 'Could not start game.' };
            }
            return {};
        }
        default:
            return { error: 'Unknown chess placement action.' };
    }
}

export { enumerateLegalChessMoves, computeChessSetupDraftScore };

export async function tryAiChessPieceMove(
    game: types.LiveGameSession,
    aiPlayer: types.Player.Black | types.Player.White,
    profileLevel: number,
): Promise<boolean> {
    if (!sessionUsesChessGo(game) || game.chessPieceMovedThisTurn) return false;
    repairChessGoSessionState(game);
    const { pickAiChessMoveIfAny } = await import('../../shared/utils/chessGoAiHeuristic.js');
    const move = pickAiChessMoveIfAny(game, aiPlayer, profileLevel);
    if (!move) return false;
    const result = applyChessMoveInternal(game, aiPlayer, {
        pieceId: move.pieceId,
        toX: move.to.x,
        toY: move.to.y,
    });
    if (result.kingCaptured) {
        await tryEndChessOnKingCapture(game, aiPlayer);
    }
    return !result.error;
}
