/**
 * Alkkagi game mode handler
 * 알까기 모드 - 알까기 게임 (바둑알을 튕겨서 상대 돌을 밖으로 내보내는 게임)
 */

import type { LiveGame } from '@sudam/database';
import { gameStateManager } from '../game-state-manager.js';

export type AlkkagiPlayer = 0 | 1 | 2; // None, Player1, Player2
export type AlkkagiBoardState = AlkkagiPlayer[][];

export interface AlkkagiGameData {
  boardState: AlkkagiBoardState;
  currentPlayer: 1 | 2;
  captures: { [key: number]: number };
  moveHistory: Array<{
    x: number;
    y: number;
    player: 1 | 2;
    direction?: { x: number; y: number }; // 튕기는 방향
  }>;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    targetCaptures: number; // 목표 따낸 돌 개수 (기본 10개)
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class AlkkagiGameMode {
  /**
   * Initialize a new alkkagi game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    targetCaptures = 10
  ): AlkkagiGameData {
    const boardState: AlkkagiBoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    // Place initial stones in center area
    const center = Math.floor(boardSize / 2);
    const stonesPerPlayer = 5;

    // Player 1 stones (top area)
    for (let i = 0; i < stonesPerPlayer; i++) {
      const x = center - 2 + (i % 3);
      const y = center - 2 + Math.floor(i / 3);
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        boardState[y][x] = 1;
      }
    }

    // Player 2 stones (bottom area)
    for (let i = 0; i < stonesPerPlayer; i++) {
      const x = center - 2 + (i % 3);
      const y = center + 2 - Math.floor(i / 3);
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        boardState[y][x] = 2;
      }
    }

    return {
      boardState,
      currentPlayer: 1,
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
   * Simulate stone flicking and check captures
   */
  private static simulateFlick(
    boardState: AlkkagiBoardState,
    from: { x: number; y: number },
    direction: { x: number; y: number },
    player: 1 | 2
  ): { newBoardState: AlkkagiBoardState; captured: number } {
    const boardSize = boardState.length;
    const newBoardState = boardState.map((row) => row.map((cell) => cell));
    const opponent = player === 1 ? 2 : 1;

    // Normalize direction
    const dx = direction.x > 0 ? 1 : direction.x < 0 ? -1 : 0;
    const dy = direction.y > 0 ? 1 : direction.y < 0 ? -1 : 0;

    if (dx === 0 && dy === 0) {
      return { newBoardState, captured: 0 };
    }

    // Move stone along direction until it hits something or goes out of bounds
    let currentX = from.x;
    let currentY = from.y;
    let captured = 0;

    // Remove stone from starting position
    if (newBoardState[currentY][currentX] === player) {
      newBoardState[currentY][currentX] = 0;
    }

    // Move along direction
    while (true) {
      const nextX = currentX + dx;
      const nextY = currentY + dy;

      // Check bounds
      if (nextX < 0 || nextX >= boardSize || nextY < 0 || nextY >= boardSize) {
        // Stone goes out of bounds - captured
        captured++;
        break;
      }

      // Check if hits opponent stone
      if (newBoardState[nextY][nextX] === opponent) {
        // Push opponent stone
        const pushX = nextX + dx;
        const pushY = nextY + dy;

        // If pushed out of bounds, capture it
        if (pushX < 0 || pushX >= boardSize || pushY < 0 || pushY >= boardSize) {
          newBoardState[nextY][nextX] = 0;
          captured++;
          break;
        }

        // Move opponent stone
        newBoardState[pushY][pushX] = opponent;
        newBoardState[nextY][nextX] = player; // Place player stone
        break;
      }

      // Check if hits own stone or empty
      if (newBoardState[nextY][nextX] === 0) {
        newBoardState[nextY][nextX] = player;
        currentX = nextX;
        currentY = nextY;
      } else {
        // Hits own stone, stop
        break;
      }
    }

    return { newBoardState, captured };
  }

  /**
   * Process a move in alkkagi game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number; direction?: { x: number; y: number } }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as AlkkagiGameData;
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

    // Check if position has player's stone
    if (gameData.boardState[move.y][move.x] !== playerNumber) {
      return { success: false, error: 'No stone at position' };
    }

    // Default direction if not provided (towards center)
    const direction = move.direction || { x: 0, y: 0 };
    if (direction.x === 0 && direction.y === 0) {
      return { success: false, error: 'Direction required' };
    }

    // Simulate flick
    const { newBoardState, captured } = this.simulateFlick(
      gameData.boardState,
      { x: move.x, y: move.y },
      direction,
      playerNumber
    );

    // Update captures
    const newCaptures = {
      ...gameData.captures,
      [playerNumber]: gameData.captures[playerNumber] + captured,
    };

    // Check win condition
    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;
    let gameStatus: 'active' | 'ended' = 'active';

    if (newCaptures[playerNumber] >= gameData.settings.targetCaptures) {
      winner = playerNumber;
      winReason = `captured_${gameData.settings.targetCaptures}_stones`;
      gameStatus = 'ended';
    }

    // Update game state
    const updatedData: AlkkagiGameData = {
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
          direction,
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
        winReason || 'alkkagi_win'
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
    const gameData = game.data as AlkkagiGameData;

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

    // Switch player
    const updatedData: AlkkagiGameData = {
      ...gameData,
      currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      lastMoveTime: Date.now(),
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
    const gameData = game.data as AlkkagiGameData;

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

