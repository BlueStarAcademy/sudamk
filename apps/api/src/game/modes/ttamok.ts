/**
 * Ttamok game mode handler
 * 따목 모드 - 오목의 변형 게임 (상대 돌을 따내는 오목)
 */

import type { LiveGame } from '@sudam/database';
import { gameStateManager } from '../game-state-manager.js';

export type TtamokPlayer = 0 | 1 | 2; // None, Black, White
export type TtamokBoardState = TtamokPlayer[][];

export interface TtamokGameData {
  boardState: TtamokBoardState;
  currentPlayer: 1 | 2; // Black = 1, White = 2
  captures: { [key: number]: number };
  moveHistory: Array<{ x: number; y: number; player: 1 | 2 }>;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    targetCaptures: number; // 목표 따낸 돌 개수 (기본 5개)
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class TtamokGameMode {
  /**
   * Initialize a new ttamok game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 15, // 오목과 동일하게 15x15 보드 사용
    targetCaptures = 5 // 기본 목표: 5개 따내기
  ): TtamokGameData {
    const boardState: TtamokBoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    return {
      boardState,
      currentPlayer: 1, // Black starts
      captures: { 1: 0, 2: 0 },
      moveHistory: [],
      player1Id,
      player2Id,
      settings: {
        boardSize,
        targetCaptures,
      },
      gameStatus: 'pending',
    };
  }

  /**
   * Check if a position has 3 in a row (capture condition)
   */
  private static checkCapture(
    boardState: TtamokBoardState,
    x: number,
    y: number,
    player: 1 | 2
  ): number {
    const boardSize = boardState.length;
    const opponent = player === 1 ? 2 : 1;
    let capturedCount = 0;

    const directions = [
      [1, 0], // Horizontal
      [0, 1], // Vertical
      [1, 1], // Diagonal \
      [1, -1], // Diagonal /
    ];

    for (const [dx, dy] of directions) {
      // Check for pattern: opponent-opponent-player (capture 2 stones)
      // Pattern 1: -X-X-O (player placed at end)
      let pattern1 = true;
      if (
        x - 2 * dx >= 0 &&
        x - 2 * dx < boardSize &&
        y - 2 * dy >= 0 &&
        y - 2 * dy < boardSize &&
        boardState[y - dy][x - dx] === opponent &&
        boardState[y - 2 * dy][x - 2 * dx] === opponent &&
        boardState[y - dy][x - dx] !== 0
      ) {
        // Check if positions are valid
        if (
          boardState[y - dy][x - dx] === opponent &&
          boardState[y - 2 * dy][x - 2 * dx] === opponent
        ) {
          capturedCount += 2;
          // Remove captured stones
          boardState[y - dy][x - dx] = 0;
          boardState[y - 2 * dy][x - 2 * dx] = 0;
        }
      }

      // Pattern 2: O-X-X- (player placed at start)
      if (
        x + 2 * dx >= 0 &&
        x + 2 * dx < boardSize &&
        y + 2 * dy >= 0 &&
        y + 2 * dy < boardSize &&
        boardState[y + dy][x + dx] === opponent &&
        boardState[y + 2 * dy][x + 2 * dx] === opponent
      ) {
        capturedCount += 2;
        // Remove captured stones
        boardState[y + dy][x + dx] = 0;
        boardState[y + 2 * dy][x + 2 * dx] = 0;
      }
    }

    return capturedCount;
  }

  /**
   * Check if a position has 5 in a row (win condition)
   */
  private static checkWin(
    boardState: TtamokBoardState,
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
   * Process a move in ttamok game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as TtamokGameData;
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
    const newBoardState = gameData.boardState.map((row) => row.map((cell) => cell));
    newBoardState[move.y][move.x] = playerNumber;

    // Check for captures (3 in a row captures 2 opponent stones)
    const capturedCount = this.checkCapture(newBoardState, move.x, move.y, playerNumber);

    // Update captures
    const newCaptures = {
      ...gameData.captures,
      [playerNumber]: gameData.captures[playerNumber] + capturedCount,
    };

    // Check win conditions: 5 in a row OR reach target captures
    const hasWonFiveInRow = this.checkWin(newBoardState, move.x, move.y, playerNumber);
    const hasWonByCaptures =
      newCaptures[playerNumber] >= gameData.settings.targetCaptures;

    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;
    let gameStatus: 'active' | 'ended' = 'active';

    if (hasWonFiveInRow) {
      winner = playerNumber;
      winReason = 'five_in_a_row';
      gameStatus = 'ended';
    } else if (hasWonByCaptures) {
      winner = playerNumber;
      winReason = `captured_${gameData.settings.targetCaptures}_stones`;
      gameStatus = 'ended';
    }

    // Update game state
    const updatedData: TtamokGameData = {
      ...gameData,
      boardState: newBoardState,
      currentPlayer: gameStatus === 'ended' ? gameData.currentPlayer : (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      captures: newCaptures,
      moveHistory: [
        ...gameData.moveHistory,
        {
          x: move.x,
          y: move.y,
          player: playerNumber,
        },
      ],
      lastMoveTime: Date.now(),
      gameStatus: gameStatus === 'ended' ? 'ended' : 'active',
      winner,
      winReason,
    };

    // End game if won
    if (gameStatus === 'ended' && winner) {
      await gameStateManager.endGame(
        game.id,
        gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
        winReason || 'ttamok_win'
      );
    } else {
      await gameStateManager.updateGameState(game.id, updatedData);
    }

    return { success: true };
  }

  /**
   * Handle pass
   */
  static async handlePass(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as TtamokGameData;

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

    // In Ttamok, passing means forfeiting
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
    const gameData = game.data as TtamokGameData;

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

