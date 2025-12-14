/**
 * Speed Go game mode handler
 * 스피드 바둑 모드 - 피셔 방식 시간 제한 (한 수를 둘 때마다 시간 추가)
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';

export interface SpeedGameData {
  boardState: BoardState;
  currentPlayer: 1 | 2; // Black = 1, White = 2
  captures: { [key: number]: number };
  moveHistory: Move[];
  koInfo: { point: { x: number; y: number }; turn: number } | null;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    initialTime: number; // 초기 시간 (밀리초)
    timeIncrement: number; // 한 수마다 추가되는 시간 (밀리초)
  };
  timeRemaining: {
    1: number; // Player 1 남은 시간
    2: number; // Player 2 남은 시간
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number; // Timestamp of last move
  turnStartTime?: number; // 현재 턴 시작 시간
}

export class SpeedGameMode {
  /**
   * Initialize a new speed game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    initialTime = 300000, // 5분 기본값 (밀리초)
    timeIncrement = 5000 // 5초 추가 기본값 (밀리초)
  ): SpeedGameData {
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
        initialTime,
        timeIncrement,
      },
      timeRemaining: {
        1: initialTime,
        2: initialTime,
      },
      gameStatus: 'pending',
      turnStartTime: Date.now(),
    };
  }

  /**
   * Process a move in speed game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as SpeedGameData;
    const now = Date.now();

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

    // Calculate time used for this turn
    let timeRemaining = { ...gameData.timeRemaining };
    if (gameData.turnStartTime) {
      const timeUsed = now - gameData.turnStartTime;
      const remaining = timeRemaining[playerNumber] - timeUsed;

      // Check if time ran out
      if (remaining <= 0) {
        // Time out - opponent wins
        const winner = (playerNumber === 1 ? 2 : 1) as 1 | 2;
        await gameStateManager.endGame(
          game.id,
          gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
          'timeout'
        );
        return { success: false, error: 'Time ran out' };
      }

      // Update remaining time and add increment
      timeRemaining[playerNumber] = remaining + gameData.settings.timeIncrement;
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

    if (!result.success || !result.newBoardState) {
      return { success: false, error: result.error || 'Invalid move' };
    }

    // Update game state
    const nextPlayer = (expectedPlayer === 1 ? 2 : 1) as 1 | 2;
    const updatedData: SpeedGameData = {
      ...gameData,
      boardState: result.newBoardState!,
      currentPlayer: nextPlayer,
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
      lastMoveTime: now,
      timeRemaining,
      turnStartTime: now, // Start timer for next player
      gameStatus: 'active',
    };

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
    const gameData = game.data as SpeedGameData;
    const now = Date.now();

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

    // Calculate time used for this turn
    let timeRemaining = { ...gameData.timeRemaining };
    if (gameData.turnStartTime) {
      const timeUsed = now - gameData.turnStartTime;
      const remaining = timeRemaining[playerNumber] - timeUsed;

      // Check if time ran out
      if (remaining <= 0) {
        // Time out - opponent wins
        const winner = (playerNumber === 1 ? 2 : 1) as 1 | 2;
        await gameStateManager.endGame(
          game.id,
          gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
          'timeout'
        );
        return { success: false, error: 'Time ran out' };
      }

      // Update remaining time and add increment
      timeRemaining[playerNumber] = remaining + gameData.settings.timeIncrement;
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

    // Update game state
    const nextPlayer = (expectedPlayer === 1 ? 2 : 1) as 1 | 2;
    const updatedData: SpeedGameData = {
      ...gameData,
      currentPlayer: nextPlayer,
      moveHistory: updatedMoveHistory,
      lastMoveTime: now,
      timeRemaining,
      turnStartTime: now,
      gameStatus: consecutivePasses ? 'ended' : 'active',
    };

    // If both players passed, end the game
    if (consecutivePasses) {
      // TODO: Calculate winner based on territory and komi
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
    const gameData = game.data as SpeedGameData;

    const isPlayer1 = userId === gameData.player1Id;
    const winner = isPlayer1 ? 2 : 1;

    await gameStateManager.endGame(
      game.id,
      gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
      'resignation'
    );

    return { success: true };
  }

  /**
   * Check for timeout (should be called periodically)
   */
  static async checkTimeout(game: LiveGame): Promise<boolean> {
    const gameData = game.data as SpeedGameData;

    if (gameData.gameStatus !== 'active' || !gameData.turnStartTime) {
      return false;
    }

    const now = Date.now();
    const currentPlayer = gameData.currentPlayer;
    const timeElapsed = now - gameData.turnStartTime;
    const timeRemaining = gameData.timeRemaining[currentPlayer] - timeElapsed;

    if (timeRemaining <= 0) {
      // Time out - opponent wins
      const winner = (currentPlayer === 1 ? 2 : 1) as 1 | 2;
      await gameStateManager.endGame(
        game.id,
        gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
        'timeout'
      );
      return true;
    }

    return false;
  }
}

