/**
 * Thief game mode handler
 * 도둑과 경찰 모드 - 도둑과 경찰 역할을 나눠 플레이하는 게임
 */

import type { LiveGame } from '@sudam/database';
import { gameStateManager } from '../game-state-manager.js';

export type ThiefPlayer = 0 | 1 | 2; // None, Thief, Police
export type ThiefBoardState = ThiefPlayer[][];

export interface ThiefGameData {
  boardState: ThiefBoardState;
  currentPlayer: 1 | 2; // Thief = 1, Police = 2
  moveHistory: Array<{ x: number; y: number; player: 1 | 2 }>;
  player1Id: string; // Thief
  player2Id?: string; // Police
  settings: {
    boardSize: number;
    thiefMovesPerTurn: number; // 도둑의 턴당 이동 횟수 (기본 2)
    policeMovesPerTurn: number; // 경찰의 턴당 이동 횟수 (기본 1)
    captureDistance: number; // 경찰이 도둑을 잡을 수 있는 거리 (기본 1)
  };
  movesRemaining: number; // 현재 턴에 남은 이동 횟수
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
  thiefPosition?: { x: number; y: number };
  policePosition?: { x: number; y: number };
}

export class ThiefGameMode {
  /**
   * Initialize a new thief game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    thiefMovesPerTurn = 2,
    policeMovesPerTurn = 1,
    captureDistance = 1
  ): ThiefGameData {
    const boardState: ThiefBoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    // Place thief and police at opposite corners
    const thiefPosition = { x: 0, y: 0 };
    const policePosition = { x: boardSize - 1, y: boardSize - 1 };

    boardState[thiefPosition.y][thiefPosition.x] = 1; // Thief
    boardState[policePosition.y][policePosition.x] = 2; // Police

    return {
      boardState,
      currentPlayer: 1, // Thief starts
      moveHistory: [],
      player1Id, // Thief
      player2Id, // Police
      settings: {
        boardSize,
        thiefMovesPerTurn,
        policeMovesPerTurn,
        captureDistance,
      },
      movesRemaining: thiefMovesPerTurn,
      gameStatus: 'pending',
      thiefPosition,
      policePosition,
    };
  }

  /**
   * Calculate distance between two positions
   */
  private static distance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Check if police can capture thief
   */
  private static checkCapture(
    gameData: ThiefGameData
  ): boolean {
    if (!gameData.thiefPosition || !gameData.policePosition) {
      return false;
    }

    const dist = this.distance(gameData.thiefPosition, gameData.policePosition);
    return dist <= gameData.settings.captureDistance;
  }

  /**
   * Process a move in thief game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as ThiefGameData;
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

    // Check if moves remaining
    if (gameData.movesRemaining <= 0) {
      return { success: false, error: 'No moves remaining for this turn' };
    }

    // Check bounds
    if (move.x < 0 || move.x >= boardSize || move.y < 0 || move.y >= boardSize) {
      return { success: false, error: 'Position out of bounds' };
    }

    // Get current position
    const currentPosition =
      playerNumber === 1 ? gameData.thiefPosition : gameData.policePosition;

    if (!currentPosition) {
      return { success: false, error: 'Player position not found' };
    }

    // Check if move is adjacent (only move to adjacent cells)
    const dist = this.distance(currentPosition, move);
    if (dist !== 1) {
      return { success: false, error: 'Can only move to adjacent cells' };
    }

    // Check if target position is empty
    if (gameData.boardState[move.y][move.x] !== 0) {
      return { success: false, error: 'Position already occupied' };
    }

    // Move player
    const newBoardState = gameData.boardState.map((row) => row.map((cell) => cell));
    newBoardState[currentPosition.y][currentPosition.x] = 0; // Remove from old position
    newBoardState[move.y][move.x] = playerNumber; // Place at new position

    // Update positions
    const newThiefPosition = playerNumber === 1 ? move : gameData.thiefPosition;
    const newPolicePosition = playerNumber === 2 ? move : gameData.policePosition;

    // Update moves remaining
    const newMovesRemaining = gameData.movesRemaining - 1;

    // Check win conditions
    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;
    let gameStatus: 'active' | 'ended' = 'active';

    // Police wins if captures thief
    if (playerNumber === 2 && newThiefPosition && newPolicePosition) {
      const dist = this.distance(newThiefPosition, newPolicePosition);
      if (dist <= gameData.settings.captureDistance) {
        winner = 2; // Police wins
        winReason = 'thief_captured';
        gameStatus = 'ended';
      }
    }

    // Thief wins if reaches opposite corner (or survives long enough)
    // For now, thief wins by reaching police's starting position
    if (
      playerNumber === 1 &&
      newThiefPosition &&
      newThiefPosition.x === boardSize - 1 &&
      newThiefPosition.y === boardSize - 1
    ) {
      winner = 1; // Thief wins
      winReason = 'thief_escaped';
      gameStatus = 'ended';
    }

    // Switch player if no moves remaining
    let nextPlayer = gameData.currentPlayer;
    let nextMovesRemaining = newMovesRemaining;

    if (newMovesRemaining === 0 && gameStatus === 'active') {
      nextPlayer = expectedPlayer === 1 ? 2 : 1;
      nextMovesRemaining =
        nextPlayer === 1
          ? gameData.settings.thiefMovesPerTurn
          : gameData.settings.policeMovesPerTurn;
    }

    // Update game state
    const updatedData: ThiefGameData = {
      ...gameData,
      boardState: newBoardState,
      currentPlayer: gameStatus === 'ended' ? gameData.currentPlayer : nextPlayer,
      movesRemaining: gameStatus === 'ended' ? newMovesRemaining : nextMovesRemaining,
      thiefPosition: newThiefPosition,
      policePosition: newPolicePosition,
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
        winReason || 'thief_game_win'
      );
    } else {
      await gameStateManager.updateGameState(game.id, updatedData);
    }

    return { success: true };
  }

  /**
   * Handle pass (skip remaining moves)
   */
  static async handlePass(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as ThiefGameData;

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

    // Skip remaining moves and switch player
    const nextPlayer = expectedPlayer === 1 ? 2 : 1;
    const nextMovesRemaining =
      nextPlayer === 1
        ? gameData.settings.thiefMovesPerTurn
        : gameData.settings.policeMovesPerTurn;

    const updatedData: ThiefGameData = {
      ...gameData,
      currentPlayer: nextPlayer,
      movesRemaining: nextMovesRemaining,
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
    const gameData = game.data as ThiefGameData;

    const isPlayer1 = userId === gameData.player1Id;
    const winner = isPlayer1 ? 2 : 1; // Opponent wins

    await gameStateManager.endGame(
      game.id,
      gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
      'resignation'
    );

    return { success: true };
  }
}

