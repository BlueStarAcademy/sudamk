import * as types from '../../types/index.js';
import type { LiveGameSession, User } from '../../types/index.js';
import { GameMode } from '../../types/enums.js';
import {
    detectAndConfirmTerritories,
    generateCastleStonePoints,
    hasAnyLegalCastleMove,
    isCastleMode,
    scoreCastleGame,
} from '../../shared/utils/castleGoRules.js';
import { clampCastleCount, getDefaultCastleCountByBoardSize } from '../../shared/constants/gameSettings.js';
import { isPairClassicGame } from '../../shared/utils/pairGameTurn.js';
import { initializeNigiri } from './nigiri.js';
import { transitionToPlayingOrUniformRoulette } from './shared.js';
import * as summaryService from '../summaryService.js';

export { isCastleMode };

/** 페어·AI 등 `initializeCastleGame`을 거치지 않은 세션에서도 캐슬 돌 좌표를 보장한다. */
export function ensureCastleStonePointsForSession(game: types.LiveGameSession): void {
    if (game.mode !== GameMode.Castle) return;
    if (game.castleStonePoints && game.castleStonePoints.length > 0) return;

    const boardSize = game.settings.boardSize ?? 13;
    const castleCount = clampCastleCount(
        game.settings.castleCount ?? getDefaultCastleCountByBoardSize(boardSize),
        boardSize,
    );
    game.castleStonePoints = generateCastleStonePoints(boardSize, castleCount, game.id);
    if (!game.confirmedTerritoryOwnerByPoint) {
        game.confirmedTerritoryOwnerByPoint = {};
    }
}

function resolveStrategicAiHumanColor(game: types.LiveGameSession, neg: types.Negotiation): types.Player {
    const preferred = neg.challenger?.id === game.player1.id
        ? game.settings.player1Color
        : game.settings.player1Color === types.Player.White
          ? types.Player.Black
          : types.Player.White;
    return preferred === types.Player.White ? types.Player.White : types.Player.Black;
}

export function initializeCastleGame(game: types.LiveGameSession, neg: types.Negotiation, now: number): void {
    const boardSize = game.settings.boardSize ?? 13;

    game.boardState = Array.from({ length: boardSize }, () =>
        Array(boardSize).fill(types.Player.None),
    ) as types.LiveGameSession['boardState'];
    game.captures = { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 };
    game.confirmedTerritoryOwnerByPoint = {};
    ensureCastleStonePointsForSession(game);

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
    } else if (isPairClassicGame(game.settings, game.mode)) {
        // configurePairClassicGameStart → pair_order_reveal → playing
    } else {
        initializeNigiri(game, now);
    }
}

export async function tryEndCastleOnCapture(
    game: types.LiveGameSession,
    capturer: types.Player,
    capturedCount: number,
): Promise<boolean> {
    if (game.mode !== GameMode.Castle) return false;
    if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') return false;
    if (capturedCount < 1) return false;
    await summaryService.endGame(game, capturer, 'castle_capture');
    return true;
}

export async function tryAutoScoreCastleIfNoMoves(game: types.LiveGameSession): Promise<boolean> {
    if (game.mode !== GameMode.Castle) return false;
    if (game.gameStatus !== 'playing') return false;
    if (hasAnyLegalCastleMove(game)) return false;

    const { getGameResult } = await import('../gameModes.js');
    await getGameResult(game);
    return true;
}

export function applyCastleTerritoryAfterMove(game: types.LiveGameSession): void {
    if (game.mode !== GameMode.Castle) return;
    game.confirmedTerritoryOwnerByPoint = detectAndConfirmTerritories(game, game.boardState);
}

export async function finalizeCastleScoring(game: types.LiveGameSession): Promise<types.LiveGameSession> {
    const score = scoreCastleGame(game);
    const komi = game.settings.komi ?? 6.5;
    const blackStones = game.boardState.flat().filter((c) => c === types.Player.Black).length;
    const whiteStones = game.boardState.flat().filter((c) => c === types.Player.White).length;
    const blackTerritory = score.black - blackStones;
    const whiteTerritory = score.white - whiteStones - komi;

    const analysis: types.AnalysisResult = {
        winRateBlack: score.black > score.white ? 100 : 0,
        deadStones: [],
        ownershipMap: game.boardState.map((row) => row.map(() => 0)),
        recommendedMoves: [],
        areaScore: { black: score.black, white: score.white },
        scoreDetails: {
            black: {
                territory: Math.max(0, blackTerritory),
                captures: 0,
                liveCaptures: 0,
                deadStones: 0,
                baseStoneBonus: 0,
                hiddenStoneBonus: 0,
                timeBonus: 0,
                itemBonus: 0,
                total: score.black,
            },
            white: {
                territory: Math.max(0, whiteTerritory),
                captures: 0,
                liveCaptures: 0,
                deadStones: 0,
                komi,
                baseStoneBonus: 0,
                hiddenStoneBonus: 0,
                timeBonus: 0,
                itemBonus: 0,
                total: score.white,
            },
        },
        blackConfirmed: [],
        whiteConfirmed: [],
        blackRight: [],
        whiteRight: [],
        blackLikely: [],
        whiteLikely: [],
        source: 'manual',
        isProvisional: false,
    };

    game.finalScores = { black: score.black, white: score.white };
    game.analysisResult = { system: analysis };
    game.isAnalyzing = false;
    game.winReason = 'score';

    const winner = score.winner ?? types.Player.White;
    await summaryService.endGame(game, winner, 'score');
    return game;
}

export function handleCastleAction(
    _game: types.LiveGameSession,
    _action: types.ServerAction,
    _user: User,
): types.HandleActionResult | null {
    return null;
}
