import * as types from '../../types/index.js';
import { Player } from '../../types/enums.js';
import {
    draftToChessPieceStates,
    finalizeChessPiecesFromDrafts,
    generateRandomChessSetupDraftForRemainingBudget,
    getChessSetupBudgetFromSettings,
    validateChessPlacementDraft,
} from '../../shared/utils/chessGoPlacement.js';
import { createEmptyChessCaptureScore, normalizeChessGoSession } from '../../shared/utils/chessGoRules.js';
import { CHESS_PIECE_PLACEMENT_TIME_LIMIT_SEC } from '../../shared/constants/gameSettings.js';
import { transitionToPlayingOrUniformRoulette } from './shared.js';
import { aiUserId } from '../aiPlayer.js';

const CHESS_PLACEMENT_MS = CHESS_PIECE_PLACEMENT_TIME_LIMIT_SEC * 1000;

function resolveAiParticipantId(game: types.LiveGameSession): string | null {
    if (!game.isAiGame) return null;
    for (const id of [game.player1.id, game.player2.id]) {
        if (id === aiUserId || id.startsWith('dungeon-bot-')) return id;
    }
    return game.player2.id;
}

function resolveHumanParticipantId(game: types.LiveGameSession): string | null {
    const aiId = resolveAiParticipantId(game);
    if (!aiId) return null;
    return aiId === game.player1.id ? game.player2.id : game.player1.id;
}

function getChessBudget(game: types.LiveGameSession): number {
    return getChessSetupBudgetFromSettings(
        game.settings.boardSize ?? 13,
        game.settings.chessPieceTotalScore,
        Boolean((game as { isRanked?: boolean }).isRanked),
    );
}

function getPlayerColor(game: types.LiveGameSession, userId: string): Player.Black | Player.White | null {
    if (userId === game.blackPlayerId) return Player.Black;
    if (userId === game.whitePlayerId) return Player.White;
    return null;
}

function ensureChessPlacementState(game: types.LiveGameSession): void {
    game.chessPiecePlacementDraft ??= {};
    game.chessPiecePlacementReady ??= {};
}

function ensureAiChessPlacementReady(game: types.LiveGameSession): void {
    if (!game.isAiGame) return;
    ensureChessPlacementState(game);
    const aiId = resolveAiParticipantId(game);
    if (!aiId) return;
    const boardSize = game.settings.boardSize ?? 13;
    const budget = getChessBudget(game);
    const aiColor = getPlayerColor(game, aiId);
    if (aiColor == null) return;

    let aiDraft = game.chessPiecePlacementDraft?.[aiId] ?? [];
    const validation = validateChessPlacementDraft(aiDraft, aiColor, boardSize, budget);
    if (!validation.ok) {
        aiDraft = [];
    }
    game.chessPiecePlacementDraft![aiId] = generateRandomChessSetupDraftForRemainingBudget(
        aiDraft,
        budget,
        boardSize,
        aiColor,
    );
    game.chessPiecePlacementReady![aiId] = true;
}

function prepareChessPlacementDrafts(game: types.LiveGameSession, deadlinePassed: boolean): void {
    ensureChessPlacementState(game);
    const boardSize = game.settings.boardSize ?? 13;
    const budget = getChessBudget(game);
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;

    for (const participantId of [p1Id, p2Id]) {
        const color = getPlayerColor(game, participantId);
        if (color == null) continue;
        const isReady = game.chessPiecePlacementReady?.[participantId] ?? false;
        if (deadlinePassed && !isReady) {
            const existing = game.chessPiecePlacementDraft?.[participantId] ?? [];
            game.chessPiecePlacementDraft![participantId] = generateRandomChessSetupDraftForRemainingBudget(
                existing,
                budget,
                boardSize,
                color,
            );
            game.chessPiecePlacementReady![participantId] = true;
        }
    }

    ensureAiChessPlacementReady(game);
}

function placementPiecesForRender(game: types.LiveGameSession): types.ChessPieceState[] {
    const boardSize = game.settings.boardSize ?? 13;
    const pieces: types.ChessPieceState[] = [];
    if (game.blackPlayerId) {
        const blackDraft = game.chessPiecePlacementDraft?.[game.blackPlayerId] ?? [];
        pieces.push(...draftToChessPieceStates(blackDraft, Player.Black, boardSize));
    }
    if (game.whitePlayerId) {
        const whiteDraft = game.chessPiecePlacementDraft?.[game.whitePlayerId] ?? [];
        pieces.push(...draftToChessPieceStates(whiteDraft, Player.White, boardSize));
    }
    return pieces;
}

export function syncChessPlacementBoard(game: types.LiveGameSession): void {
    const boardSize = game.settings.boardSize ?? 13;
    const board = Array.from({ length: boardSize }, () =>
        Array(boardSize).fill(Player.None),
    ) as types.LiveGameSession['boardState'];
    for (const piece of placementPiecesForRender(game)) {
        board[piece.y]![piece.x] = piece.owner;
    }
    game.chessPieces = placementPiecesForRender(game);
    game.boardState = board;
}

export function enterChessPiecePlacement(game: types.LiveGameSession, now: number): void {
    const boardSize = game.settings.boardSize ?? 13;
    ensureChessPlacementState(game);
    game.gameStatus = 'chess_piece_placement';
    game.chessPieces = [];
    game.chessCaptureScore = createEmptyChessCaptureScore();
    game.chessPieceMovedThisTurn = false;
    game.boardState = Array.from({ length: boardSize }, () =>
        Array(boardSize).fill(Player.None),
    ) as types.LiveGameSession['boardState'];
    game.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    game.koInfo = null;
    game.moveHistory = [];
    game.passCount = 0;

    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    game.chessPiecePlacementReady = { [p1Id]: false, [p2Id]: false };
    game.chessPiecePlacementDraft = { [p1Id]: [], [p2Id]: [] };

    if (game.isAiGame) {
        game.chessPiecePlacementDeadline = undefined;
        ensureAiChessPlacementReady(game);
    } else {
        game.chessPiecePlacementDeadline = now + CHESS_PLACEMENT_MS;
    }

    syncChessPlacementBoard(game);
}

export function resolveChessPlacementAndTransition(game: types.LiveGameSession, now: number): boolean {
    if (game.gameStatus !== 'chess_piece_placement') return false;
    const blackId = game.blackPlayerId;
    const whiteId = game.whitePlayerId;
    if (!blackId || !whiteId) return false;

    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    const humanId = resolveHumanParticipantId(game);
    const deadlinePassed =
        !game.isAiGame &&
        !!game.chessPiecePlacementDeadline &&
        now > game.chessPiecePlacementDeadline;

    const pvpBothReady =
        (game.chessPiecePlacementReady?.[p1Id] ?? false) &&
        (game.chessPiecePlacementReady?.[p2Id] ?? false);
    const humanReady = humanId ? (game.chessPiecePlacementReady?.[humanId] ?? false) : false;
    const canTransition = game.isAiGame ? humanReady : deadlinePassed || pvpBothReady;
    if (!canTransition) return false;

    prepareChessPlacementDrafts(game, deadlinePassed);

    const boardSize = game.settings.boardSize ?? 13;
    const budget = getChessBudget(game);
    let blackDraft = game.chessPiecePlacementDraft?.[blackId] ?? [];
    let whiteDraft = game.chessPiecePlacementDraft?.[whiteId] ?? [];
    let blackVal = validateChessPlacementDraft(blackDraft, Player.Black, boardSize, budget);
    let whiteVal = validateChessPlacementDraft(whiteDraft, Player.White, boardSize, budget);

    const aiParticipantId = resolveAiParticipantId(game);
    if (!blackVal.ok) {
        blackDraft = generateRandomChessSetupDraftForRemainingBudget([], budget, boardSize, Player.Black);
        game.chessPiecePlacementDraft![blackId] = blackDraft;
        blackVal = validateChessPlacementDraft(blackDraft, Player.Black, boardSize, budget);
    } else if (game.isAiGame && aiParticipantId === blackId) {
        blackDraft = generateRandomChessSetupDraftForRemainingBudget(blackDraft, budget, boardSize, Player.Black);
        game.chessPiecePlacementDraft![blackId] = blackDraft;
        blackVal = validateChessPlacementDraft(blackDraft, Player.Black, boardSize, budget);
    }
    if (!whiteVal.ok) {
        whiteDraft = generateRandomChessSetupDraftForRemainingBudget([], budget, boardSize, Player.White);
        game.chessPiecePlacementDraft![whiteId] = whiteDraft;
        whiteVal = validateChessPlacementDraft(whiteDraft, Player.White, boardSize, budget);
    } else if (game.isAiGame && aiParticipantId === whiteId) {
        whiteDraft = generateRandomChessSetupDraftForRemainingBudget(whiteDraft, budget, boardSize, Player.White);
        game.chessPiecePlacementDraft![whiteId] = whiteDraft;
        whiteVal = validateChessPlacementDraft(whiteDraft, Player.White, boardSize, budget);
    }
    if (!blackVal.ok || !whiteVal.ok) return false;

    game.chessPieces = finalizeChessPiecesFromDrafts(blackDraft, whiteDraft, boardSize);
    game.chessPiecePlacementDraft = undefined;
    game.chessPiecePlacementReady = undefined;
    game.chessPiecePlacementDeadline = undefined;
    const normalized = normalizeChessGoSession(game);
    game.chessPieces = normalized.chessPieces;
    game.boardState = normalized.boardState;
    game.settings = normalized.settings;
    game.chessCaptureScore = normalized.chessCaptureScore;
    game.chessPieceMovedThisTurn = normalized.chessPieceMovedThisTurn;
    transitionToPlayingOrUniformRoulette(game, now);
    return true;
}

export function updateChessPlacementState(game: types.LiveGameSession, now: number): void {
    if (game.gameStatus !== 'chess_piece_placement') return;
    resolveChessPlacementAndTransition(game, now);
}

export function startChessPlacementAfterNigiri(game: types.LiveGameSession, now: number): void {
    enterChessPiecePlacement(game, now);
}

export { getChessBudget, getPlayerColor, ensureChessPlacementState };
