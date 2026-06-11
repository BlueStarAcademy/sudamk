import * as types from '../../types/index.js';
import type { LiveGameSession } from '../../types/index.js';
import { GameMode } from '../../types/enums.js';
import {
    applyChessMoveToSession,
    createEmptyChessCaptureScore,
    enumerateLegalChessMoves,
    generateChessGoInitialPieces,
    isChessMode,
    normalizeChessGoSession,
    resolveChessCapturesByLiberty,
    validateChessMove,
} from '../../shared/utils/chessGoRules.js';
import { initializeNigiri } from './nigiri.js';
import { transitionToPlayingOrUniformRoulette } from './shared.js';

export { isChessMode };

/** 서버 저장·캐시·로드 직전: chessPieces 기준으로 boardState를 맞춘다 */
export function repairChessGoSessionState(game: types.LiveGameSession): void {
    if (game.mode !== GameMode.Chess) return;
    const normalized = normalizeChessGoSession(game);
    game.chessPieces = normalized.chessPieces;
    game.boardState = normalized.boardState;
    game.settings = normalized.settings;
    game.chessCaptureScore = normalized.chessCaptureScore;
    game.chessPieceMovedThisTurn = normalized.chessPieceMovedThisTurn;
}

function resolveStrategicAiHumanColor(game: types.LiveGameSession, neg: types.Negotiation): types.Player {
    const preferred = neg.challenger?.id === game.player1.id
        ? game.settings.player1Color
        : game.settings.player1Color === types.Player.White
          ? types.Player.White
          : types.Player.Black;
    return preferred === types.Player.White ? types.Player.White : types.Player.Black;
}

export function initializeChessGame(game: types.LiveGameSession, neg: types.Negotiation, now: number): void {
    game.settings = { ...game.settings, boardSize: 13 as LiveGameSession['settings']['boardSize'] };
    game.chessPieces = generateChessGoInitialPieces(13);
    game.chessCaptureScore = createEmptyChessCaptureScore();
    game.chessPieceMovedThisTurn = false;
    game.captures = { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 };
    game.koInfo = null;
    game.moveHistory = [];
    game.passCount = 0;
    repairChessGoSessionState(game);

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
        transitionToPlayingOrUniformRoulette(game, now);
    } else {
        initializeNigiri(game, now);
    }
}

export type ChessMovePayload = {
    pieceId: string;
    toX: number;
    toY: number;
};

export function applyChessMoveInternal(
    game: types.LiveGameSession,
    actingPlayer: types.Player.Black | types.Player.White,
    payload: ChessMovePayload,
): { error?: string } {
    if (game.mode !== GameMode.Chess) return { error: 'Not a chess go game.' };
    if (game.gameStatus !== 'playing') return { error: 'Game is not in playing state.' };

    const validation = validateChessMove(game, payload.pieceId, payload.toX, payload.toY, actingPlayer);
    if (!validation.ok) {
        return { error: 'Invalid chess move.' };
    }

    applyChessMoveToSession(game, payload.pieceId, payload.toX, payload.toY);
    game.chessPieceMovedThisTurn = true;
    resolveChessCapturesByLiberty(game, actingPlayer);
    repairChessGoSessionState(game);
    return {};
}

export async function handleChessMoveAction(
    game: types.LiveGameSession,
    user: types.User,
    payload: ChessMovePayload,
): Promise<{ error?: string }> {
    if (game.mode !== GameMode.Chess) return { error: 'Not a chess go game.' };
    if (game.gameStatus !== 'playing') return { error: 'Game is not in playing state.' };
    repairChessGoSessionState(game);

    const myPlayerEnum =
        user.id === game.blackPlayerId
            ? types.Player.Black
            : user.id === game.whitePlayerId
              ? types.Player.White
              : null;
    if (myPlayerEnum == null) return { error: 'Not your game.' };
    if (game.currentPlayer !== myPlayerEnum) return { error: 'Not your turn.' };

    return applyChessMoveInternal(game, myPlayerEnum, payload);
}

export { enumerateLegalChessMoves };

export async function tryAiChessPieceMove(
    game: types.LiveGameSession,
    aiPlayer: types.Player.Black | types.Player.White,
    profileLevel: number,
): Promise<boolean> {
    if (game.mode !== GameMode.Chess || game.chessPieceMovedThisTurn) return false;
    repairChessGoSessionState(game);
    const { pickAiChessMoveIfAny } = await import('../../shared/utils/chessGoAiHeuristic.js');
    const move = pickAiChessMoveIfAny(game, aiPlayer, profileLevel);
    if (!move) return false;
    const result = applyChessMoveInternal(game, aiPlayer, {
        pieceId: move.pieceId,
        toX: move.to.x,
        toY: move.to.y,
    });
    return !result.error;
}
