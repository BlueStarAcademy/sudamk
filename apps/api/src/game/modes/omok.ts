/**
 * Omok game mode handler
 * 오목 모드 - 5개를 연속으로 놓으면 승리하는 게임
 */

import type { LiveGame } from '@sudam/database';
import { gameStateManager } from '../game-state-manager.js';

export type OmokPlayer = 0 | 1 | 2; // None, Black, White
export type OmokBoardState = OmokPlayer[][];

export interface OmokGameData {
  boardState: OmokBoardState;
  currentPlayer: 1 | 2; // Black = 1, White = 2
  moveHistory: Array<{ x: number; y: number; player: 1 | 2 }>;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class OmokGameMode {
  /**
   * Initialize a new omok game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 15 // 오목은 보통 15x15 보드 사용
  ): OmokGameData {
    const boardState: OmokBoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    return {
      boardState,
      currentPlayer: 1, // Black starts
      moveHistory: [],
      player1Id,
      player2Id,
      settings: {
        boardSize,
      },
      gameStatus: 'pending',
    };
  }

  /**
   * Check if a position has 5 in a row
   */
  private static checkWin(
    boardState: OmokBoardState,
    x: number,
    y: number,
    player: 1 | 2
  ): boolean {
    const boardSize = boardState.length;
    const directions = [
      [1, 0], // Horizontal
      [0, 1], // Vertical
      [1, 1], // Diagonal \
      [1, -1], // Diagonal /
    ];

    for (const [dx, dy] of directions) {
      let count = 1; // Count the current stone

      // Check positive direction
      for (let i = 1; i < 5; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (
          nx >= 0 &&
          nx < boardSize &&
          ny >= 0 &&
          ny < boardSize &&
          boardState[ny][nx] === player
        ) {
          count++;
        } else {
          break;
        }
      }

      // Check negative direction
      for (let i = 1; i < 5; i++) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        if (
          nx >= 0 &&
          nx < boardSize &&
          ny >= 0 &&
          ny < boardSize &&
          boardState[ny][nx] === player
        ) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process a move in omok game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as OmokGameData;
    const boardSize = gameData.settings.boardSize;

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

    // Check bounds
    if (move.x < 0 || move.x >= boardSize || move.y < 0 || move.y >= boardSize) {
      return { success: false, error: 'Position out of bounds' };
    }

    // Check if position is occupied
    if (gameData.boardState[move.y][move.x] !== 0) {
      return { success: false, error: 'Position already occupied' };
    }

    // Place stone
    const newBoardState = gameData.boardState.map((row, y) =>
      row.map((cell, x) => {
        if (x === move.x && y === move.y) {
          return playerNumber;
        }
        return cell;
      })
    );

    // Check for win
    const hasWon = this.checkWin(newBoardState, move.x, move.y, playerNumber);

    // Update game state
    const updatedData: OmokGameData = {
      ...gameData,
      boardState: newBoardState,
      currentPlayer: hasWon ? gameData.currentPlayer : (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      moveHistory: [
        ...gameData.moveHistory,
        {
          x: move.x,
          y: move.y,
          player: playerNumber,
        },
      ],
      lastMoveTime: Date.now(),
      gameStatus: hasWon ? 'ended' : 'active',
      winner: hasWon ? playerNumber : undefined,
      winReason: hasWon ? 'five_in_a_row' : undefined,
    };

    // End game if won
    if (hasWon) {
      await gameStateManager.endGame(
        game.id,
        gameData[`player${playerNumber}Id` as 'player1Id' | 'player2Id'],
        'five_in_a_row'
      );
    } else {
      // Check for draw (board full)
      const isBoardFull = newBoardState.every((row) => row.every((cell) => cell !== 0));
      if (isBoardFull) {
        updatedData.gameStatus = 'ended';
        updatedData.winReason = 'draw';
        await gameStateManager.endGame(game.id, undefined, 'draw');
      } else {
        await gameStateManager.updateGameState(game.id, updatedData);
      }
    }

    return { success: true };
  }

  /**
   * Handle pass (not typically used in Omok, but included for consistency)
   */
  static async handlePass(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as OmokGameData;

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

    // In Omok, passing means forfeiting
    const winner = (playerNumber === 1 ? 2 : 1) as 1 | 2;
    await gameStateManager.endGame(
      game.id,
      gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
      'pass_forfeit'
    );

    return { success: true };
  }

  /**
   * Handle resign
   */
  static async handleResign(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean }> {
    const gameData = game.data as OmokGameData;

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

