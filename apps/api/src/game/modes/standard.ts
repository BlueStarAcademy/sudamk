/**
 * Standard Go game mode handler
 * 클래식 바둑 모드
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';

export interface StandardGameData {
  boardState: BoardState;
  currentPlayer: 1 | 2; // Black = 1, White = 2
  captures: { [key: number]: number };
  moveHistory: Move[];
  koInfo: { point: { x: number; y: number }; turn: number } | null;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    komi: number;
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
}

export class StandardGameMode {
  /**
   * Initialize a new standard game
   */
  static initializeGame(player1Id: string, player2Id?: string, boardSize = 19): StandardGameData {
    const boardState: BoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    return {
      boardState,
      currentPlayer: 1, // Black starts
      captures: { 1: 0, 2: 0 },
      moveHistory: [],
      koInfo: null,
      player1Id,
      player2Id,
      settings: {
        boardSize,
        komi: 6.5, // Standard komi
      },
      gameStatus: 'pending',
    };
  }

  /**
   * Process a move in standard game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as StandardGameData;

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

    // Process the move
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

    if (!result.success) {
      return { success: false, error: result.error || 'Invalid move' };
    }

    // Update game state
    const updatedData: StandardGameData = {
      ...gameData,
      boardState: result.newBoardState!,
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
    };

    // Check for game end conditions (simplified - in production, check for pass/pass)
    // For now, we'll let the game continue until explicit end

    // Update game in database
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
    const gameData = game.data as StandardGameData;

    // Verify player
    const isPlayer1 = userId === gameData.player1Id;
    const isPlayer2 = userId === gameData.player2Id;
    if (!isPlayer1 && !isPlayer2) {
      return { success: false, error: 'Not a player in this game' };
    }

    // TODO: Implement pass logic
    // For now, just switch turns
    const updatedData: StandardGameData = {
      ...gameData,
      currentPlayer: (gameData.currentPlayer === 1 ? 2 : 1) as 1 | 2,
    };

    await gameStateManager.updateGameState(game.id, updatedData);

    return { success: true };
  }

  /**
   * Handle resign
   */
  static async handleResign(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean }> {
    const gameData = game.data as StandardGameData;

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

