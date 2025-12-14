/**
 * Hidden Go game mode handler
 * 히든 바둑 모드 - 상대에게 보이지 않는 히든돌을 놓아 허를 찌르는 심리전 바둑
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';

export interface HiddenGameData {
  boardState: BoardState;
  visibleBoardState: BoardState; // 상대에게 보이는 보드 상태 (히든 돌 제외)
  currentPlayer: 1 | 2; // Black = 1, White = 2
  captures: { [key: number]: number };
  moveHistory: Move[];
  koInfo: { point: { x: number; y: number }; turn: number } | null;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    komi: number;
    maxHiddenStones: number; // 최대 히든 돌 개수
    revealOnCapture: boolean; // 따낼 때 히든 돌이 드러나는지 여부
  };
  hiddenStones: {
    1: Array<{ x: number; y: number; turn: number }>; // Player 1의 히든 돌
    2: Array<{ x: number; y: number; turn: number }>; // Player 2의 히든 돌
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class HiddenGameMode {
  /**
   * Initialize a new hidden game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    maxHiddenStones = 5,
    revealOnCapture = true
  ): HiddenGameData {
    const boardState: BoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    const visibleBoardState: BoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    return {
      boardState,
      visibleBoardState,
      currentPlayer: 1, // Black starts
      captures: { 1: 0, 2: 0 },
      moveHistory: [],
      koInfo: null,
      player1Id,
      player2Id,
      settings: {
        boardSize,
        komi: 6.5,
        maxHiddenStones,
        revealOnCapture,
      },
      hiddenStones: {
        1: [],
        2: [],
      },
      gameStatus: 'pending',
    };
  }

  /**
   * Update visible board state (hide opponent's hidden stones)
   */
  private static updateVisibleBoard(gameData: HiddenGameData): BoardState {
    const visibleBoard: BoardState = gameData.boardState.map((row) => [...row]);
    const currentPlayer = gameData.currentPlayer;
    const opponent = currentPlayer === 1 ? 2 : 1;

    // Hide opponent's hidden stones
    gameData.hiddenStones[opponent].forEach((hidden) => {
      visibleBoard[hidden.y][hidden.x] = 0; // Make it appear empty
    });

    return visibleBoard;
  }

  /**
   * Reveal hidden stones when captured
   */
  private static revealCapturedHiddenStones(
    gameData: HiddenGameData,
    capturedPositions: Array<{ x: number; y: number }>
  ): HiddenGameData {
    const updatedHiddenStones = { ...gameData.hiddenStones };
    const currentPlayer = gameData.currentPlayer;
    const opponent = currentPlayer === 1 ? 2 : 1;

    // Remove hidden stones that were captured
    updatedHiddenStones[opponent] = updatedHiddenStones[opponent].filter(
      (hidden) =>
        !capturedPositions.some((pos) => pos.x === hidden.x && pos.y === hidden.y)
    );

    return {
      ...gameData,
      hiddenStones: updatedHiddenStones,
    };
  }

  /**
   * Process a move in hidden game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number },
    isHidden = false // 히든 돌로 놓을지 여부
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as HiddenGameData;

    // Verify it's the player's turn
    const expectedPlayer = gameData.currentPlayer;
    const isPlayer1 = userId === gameData.player1Id;
    const isPlayer2 = userId === gameData.player2Id;

    if (!isPlayer1 && !isPlayer2) {
      return { success: false, error: 'Not a player in this game' };
    }

    const playerNumber = isPlayer1 ? 1 : 2;
    if (playerNumber !== expectedPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    // Check if game is already ended
    if (gameData.gameStatus === 'ended' || gameData.gameStatus === 'no_contest') {
      return { success: false, error: 'Game has already ended' };
    }

    // Check hidden stone limit
    if (isHidden && gameData.hiddenStones[playerNumber].length >= gameData.settings.maxHiddenStones) {
      return { success: false, error: 'Maximum hidden stones limit reached' };
    }

    // Check if position is occupied (in actual board state)
    if (gameData.boardState[move.y][move.x] !== 0) {
      return { success: false, error: 'Position already occupied' };
    }

    // Process the move on actual board
    const result = processMove(
      gameData.boardState,
      {
        x: move.x,
        y: move.y,
        player: playerNumber as 1 | 2,
      },
      gameData.koInfo,
      gameData.moveHistory.length
    );

    if (!result.success || !result.newBoardState) {
      return { success: false, error: result.error || 'Invalid move' };
    }

    // Track captured positions for hidden stone revelation
    const capturedPositions: Array<{ x: number; y: number }> = [];
    if (result.captures && result.captures > 0) {
      // Find captured positions (simplified - in production, track actual positions)
      // This would need to be enhanced to track exact captured positions
    }

    // Update hidden stones if this is a hidden move
    let updatedHiddenStones = { ...gameData.hiddenStones };
    if (isHidden) {
      updatedHiddenStones[playerNumber] = [
        ...updatedHiddenStones[playerNumber],
        { x: move.x, y: move.y, turn: gameData.moveHistory.length + 1 },
      ];
    }

    // Reveal hidden stones if captured and revealOnCapture is true
    let updatedGameData = {
      ...gameData,
      boardState: result.newBoardState!,
      hiddenStones: updatedHiddenStones,
    };

    if (gameData.settings.revealOnCapture && result.captures && result.captures > 0) {
      updatedGameData = this.revealCapturedHiddenStones(updatedGameData, capturedPositions);
    }

    // Update visible board (hide opponent's hidden stones)
    const visibleBoardState = this.updateVisibleBoard(updatedGameData);

    // Update game state
    const updatedData: HiddenGameData = {
      ...updatedGameData,
      visibleBoardState,
      currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      captures: {
        ...gameData.captures,
        [playerNumber]: gameData.captures[playerNumber] + (result.captures || 0),
      },
      moveHistory: [
        ...gameData.moveHistory,
        {
          x: move.x,
          y: move.y,
          player: playerNumber as 1 | 2,
        },
      ],
      koInfo: result.koPoint
        ? {
            point: result.koPoint,
            turn: gameData.moveHistory.length + 1,
          }
        : null,
      lastMoveTime: Date.now(),
      gameStatus: 'active',
    };

    await gameStateManager.updateGameState(game.id, updatedData);

    return { success: true };
  }

  /**
   * Handle pass
   */
  static async handlePass(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as HiddenGameData;

    // Verify player
    const isPlayer1 = userId === gameData.player1Id;
    const isPlayer2 = userId === gameData.player2Id;
    if (!isPlayer1 && !isPlayer2) {
      return { success: false, error: 'Not a player in this game' };
    }

    // Verify it's the player's turn
    const expectedPlayer = gameData.currentPlayer;
    const playerNumber = isPlayer1 ? 1 : 2;
    if (playerNumber !== expectedPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    // Check if game is already ended
    if (gameData.gameStatus === 'ended' || gameData.gameStatus === 'no_contest') {
      return { success: false, error: 'Game has already ended' };
    }

    // Record pass in move history
    const passMove: Move = {
      x: -1,
      y: -1,
      player: playerNumber as 1 | 2,
    };

    const updatedMoveHistory = [...gameData.moveHistory, passMove];

    // Check if both players passed consecutively
    const consecutivePasses =
      updatedMoveHistory.length >= 2 &&
      updatedMoveHistory[updatedMoveHistory.length - 1].x === -1 &&
      updatedMoveHistory[updatedMoveHistory.length - 1].y === -1 &&
      updatedMoveHistory[updatedMoveHistory.length - 2].x === -1 &&
      updatedMoveHistory[updatedMoveHistory.length - 2].y === -1;

    // Update visible board
    const visibleBoardState = this.updateVisibleBoard(gameData);

    // Update game state
    const updatedData: HiddenGameData = {
      ...gameData,
      visibleBoardState,
      currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      moveHistory: updatedMoveHistory,
      lastMoveTime: Date.now(),
      gameStatus: consecutivePasses ? 'ended' : 'active',
    };

    // If both players passed, end the game
    if (consecutivePasses) {
      await gameStateManager.endGame(
        game.id,
        undefined, // Winner will be determined later through scoring
        'both_players_passed'
      );
    } else {
      await gameStateManager.updateGameState(game.id, updatedData);
    }

    return { success: true };
  }

  /**
   * Handle resign
   */
  static async handleResign(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean }> {
    const gameData = game.data as HiddenGameData;

    const isPlayer1 = userId === gameData.player1Id;
    const winner = isPlayer1 ? 2 : 1;

    await gameStateManager.endGame(
      game.id,
      gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
      'resignation'
    );

    return { success: true };
  }
}

