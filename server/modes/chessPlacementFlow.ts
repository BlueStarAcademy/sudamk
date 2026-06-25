import * as types from '../../types/index.js';
import { Player } from '../../types/enums.js';
import {
    draftToChessPieceStates,
    finalizeChessPiecesFromDrafts,
    generateRandomChessSetupDraftForRemainingBudget,
    getChessSetupBudgetFromSettings,
    validateChessPlacementDraft,
} from '../../shared/utils/chessGoPlacement.js';
import { createEmptyChessCaptureScore, normalizeChessGoSession, sessionUsesChessGo } from '../../shared/utils/chessGoRules.js';
import { CHESS_PIECE_PLACEMENT_TIME_LIMIT_SEC } from '../../shared/constants/gameSettings.js';
import { transitionToPlayingOrUniformRoulette } from './shared.js';
import { aiUserId } from '../aiPlayer.js';
import {
    isPairClassicGame,
    isPairAiSeat,
    resolvePairUserPlayerEnum,
} from '../../shared/utils/pairGameTurn.js';
import {
    resolvePairChessSetupDraftKey,
    resolvePairChessSetupPlayerColor,
    resolvePairChessSideDraftKeys,
} from '../../shared/utils/pairChessSetup.js';
import { getEffectivePairLobbyOwnerId } from '../../shared/utils/effectivePairLobbyOwnerId.js';

const CHESS_PLACEMENT_MS = CHESS_PIECE_PLACEMENT_TIME_LIMIT_SEC * 1000;

function isPairCooperativeAiChessPlacement(game: types.LiveGameSession): boolean {
    if (!game.isAiGame || !isPairClassicGame(game.settings, game.mode)) return false;
    const pairMode = game.settings?.pairGame?.pairMode;
    const hasOpponentAiSeat = game.settings?.pairGame?.teamB?.members?.some(
        (m) => m.id === 'pair-opponent-ai',
    );
    return pairMode === 'ai' || Boolean(hasOpponentAiSeat);
}

function resolvePairCoopHumanTeamDraftKey(game: types.LiveGameSession): string | null {
    const ownerId = getEffectivePairLobbyOwnerId(game);
    if (!ownerId) return null;
    return resolvePairChessSetupDraftKey(game, ownerId);
}

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
    if (isPairClassicGame(game.settings, game.mode)) {
        if (game.gameStatus === 'chess_piece_placement') {
            return resolvePairChessSetupPlayerColor(game, userId);
        }
        const seatColor = resolvePairUserPlayerEnum(game.settings, userId);
        if (seatColor === Player.Black || seatColor === Player.White) return seatColor;
        return null;
    }
    if (userId === game.blackPlayerId) return Player.Black;
    if (userId === game.whitePlayerId) return Player.White;
    return null;
}

/** 팀/색별 draft·ready 맵 키 (페어: black1/white1 좌석 id, 1v1: 흑/백 유저 id) */
function getChessDraftKey(game: types.LiveGameSession, userId: string): string | null {
    if (isPairClassicGame(game.settings, game.mode)) {
        return resolvePairChessSetupDraftKey(game, userId);
    }
    const color = getPlayerColor(game, userId);
    if (color === Player.Black) return game.blackPlayerId ?? null;
    if (color === Player.White) return game.whitePlayerId ?? null;
    return null;
}

function getChessSideDraftKeys(game: types.LiveGameSession): { blackKey: string; whiteKey: string } | null {
    const pairKeys = resolvePairChessSideDraftKeys(game);
    if (pairKeys) return pairKeys;
    if (!game.blackPlayerId || !game.whitePlayerId) return null;
    return { blackKey: game.blackPlayerId, whiteKey: game.whitePlayerId };
}

function isPairDraftHolderAiOrPet(game: types.LiveGameSession, draftKey: string): boolean {
    const seat = game.settings?.pairGame?.turnOrder?.find((s) => s.participantId === draftKey);
    return Boolean(seat && isPairAiSeat(seat));
}

function ensurePairAiPetChessPlacementReady(game: types.LiveGameSession): void {
    if (!isPairClassicGame(game.settings, game.mode)) return;
    ensureChessPlacementState(game);
    const sideKeys = getChessSideDraftKeys(game);
    if (!sideKeys) return;
    const boardSize = game.settings.boardSize ?? 13;
    const budget = getChessBudget(game);
    for (const [draftKey, color] of [
        [sideKeys.blackKey, Player.Black],
        [sideKeys.whiteKey, Player.White],
    ] as const) {
        if (!isPairDraftHolderAiOrPet(game, draftKey)) continue;
        let draft = game.chessPiecePlacementDraft?.[draftKey] ?? [];
        if (!validateChessPlacementDraft(draft, color, boardSize, budget).ok) {
            draft = [];
        }
        game.chessPiecePlacementDraft![draftKey] = generateRandomChessSetupDraftForRemainingBudget(
            draft,
            budget,
            boardSize,
            color,
        );
        game.chessPiecePlacementReady![draftKey] = true;
    }
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
    const sideKeys = getChessSideDraftKeys(game);
    if (!sideKeys) return;

    for (const [participantId, color] of [
        [sideKeys.blackKey, Player.Black],
        [sideKeys.whiteKey, Player.White],
    ] as const) {
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

    if (!isPairCooperativeAiChessPlacement(game)) {
        ensureAiChessPlacementReady(game);
    }
    ensurePairAiPetChessPlacementReady(game);
}

function placementPiecesForRender(game: types.LiveGameSession): types.ChessPieceState[] {
    const boardSize = game.settings.boardSize ?? 13;
    const pieces: types.ChessPieceState[] = [];
    const sideKeys = getChessSideDraftKeys(game);
    if (!sideKeys) return pieces;
    const blackDraft = game.chessPiecePlacementDraft?.[sideKeys.blackKey] ?? [];
    const whiteDraft = game.chessPiecePlacementDraft?.[sideKeys.whiteKey] ?? [];
    pieces.push(...draftToChessPieceStates(blackDraft, Player.Black, boardSize));
    pieces.push(...draftToChessPieceStates(whiteDraft, Player.White, boardSize));
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

    const sideKeys = getChessSideDraftKeys(game);
    if (!sideKeys) return;

    game.chessPiecePlacementReady = {
        [sideKeys.blackKey]: false,
        [sideKeys.whiteKey]: false,
    };
    game.chessPiecePlacementDraft = {
        [sideKeys.blackKey]: [],
        [sideKeys.whiteKey]: [],
    };

    if (game.isAiGame) {
        game.chessPiecePlacementDeadline = undefined;
        if (!isPairCooperativeAiChessPlacement(game)) {
            ensureAiChessPlacementReady(game);
        }
    } else {
        game.chessPiecePlacementDeadline = now + CHESS_PLACEMENT_MS;
    }
    ensurePairAiPetChessPlacementReady(game);

    syncChessPlacementBoard(game);
}

export function resolveChessPlacementAndTransition(game: types.LiveGameSession, now: number): boolean {
    if (game.gameStatus !== 'chess_piece_placement') return false;
    const sideKeys = getChessSideDraftKeys(game);
    if (!sideKeys) return false;
    const blackId = sideKeys.blackKey;
    const whiteId = sideKeys.whiteKey;

    const humanId = resolveHumanParticipantId(game);
    const deadlinePassed =
        !game.isAiGame &&
        !!game.chessPiecePlacementDeadline &&
        now > game.chessPiecePlacementDeadline;

    const pvpBothReady =
        (game.chessPiecePlacementReady?.[blackId] ?? false) &&
        (game.chessPiecePlacementReady?.[whiteId] ?? false);
    const humanReady = humanId ? (game.chessPiecePlacementReady?.[humanId] ?? false) : false;
    const pairCoopHumanDraftKey = isPairCooperativeAiChessPlacement(game)
        ? resolvePairCoopHumanTeamDraftKey(game)
        : null;
    const pairCoopHumanReady = pairCoopHumanDraftKey
        ? (game.chessPiecePlacementReady?.[pairCoopHumanDraftKey] ?? false)
        : false;
    const pairHumanPlacerReady =
        isPairClassicGame(game.settings, game.mode) && !isPairCooperativeAiChessPlacement(game)
            ? pvpBothReady
            : false;
    const canTransition = pairCoopHumanDraftKey
        ? pairCoopHumanReady
        : pairHumanPlacerReady
          ? true
          : game.isAiGame
            ? humanReady
            : deadlinePassed || pvpBothReady;
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

export { getChessBudget, getPlayerColor, getChessDraftKey, ensureChessPlacementState };
