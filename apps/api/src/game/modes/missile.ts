/**
 * Missile Go game mode handler
 * 미사일 바둑 모드 - 미사일 아이템으로 내 돌을 움직여 전략적인 행마를 구사하는 바둑
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';

export interface MissileGameData {
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
    missileCooldown: number; // 미사일 사용 쿨다운 (턴 수)
  };
  missileInventory: {
    1: number; // Player 1의 미사일 개수
    2: number; // Player 2의 미사일 개수
  };
  lastMissileUse: {
    1?: number; // Player 1이 마지막으로 미사일을 사용한 턴
    2?: number; // Player 2가 마지막으로 미사일을 사용한 턴
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class MissileGameMode {
  /**
   * Initialize a new missile game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    initialMissiles = 3, // 초기 미사일 개수
    missileCooldown = 5 // 미사일 사용 쿨다운 (턴 수)
  ): MissileGameData {
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
        komi: 6.5,
        missileCooldown,
      },
      missileInventory: {
        1: initialMissiles,
        2: initialMissiles,
      },
      lastMissileUse: {},
      gameStatus: 'pending',
    };
  }

  /**
   * Check if player can use missile
   */
  private static canUseMissile(
    gameData: MissileGameData,
    playerNumber: 1 | 2
  ): boolean {
    // Check if player has missiles
    if (gameData.missileInventory[playerNumber] <= 0) {
      return false;
    }

    // Check cooldown
    const lastUse = gameData.lastMissileUse[playerNumber];
    if (lastUse !== undefined) {
      const turnsSinceLastUse = gameData.moveHistory.length - lastUse;
      if (turnsSinceLastUse < gameData.settings.missileCooldown) {
        return false;
      }
    }

    return true;
  }

  /**
   * Move a stone using missile
   */
  static moveStoneWithMissile(
    boardState: BoardState,
    from: { x: number; y: number },
    to: { x: number; y: number },
    player: 1 | 2
  ): { success: boolean; newBoardState?: BoardState; error?: string } {
    const boardSize = boardState.length;

    // Check bounds
    if (
      from.x < 0 ||
      from.x >= boardSize ||
      from.y < 0 ||
      from.y >= boardSize ||
      to.x < 0 ||
      to.x >= boardSize ||
      to.y < 0 ||
      to.y >= boardSize
    ) {
      return { success: false, error: 'Position out of bounds' };
    }

    // Check if from position has player's stone
    if (boardState[from.y][from.x] !== player) {
      return { success: false, error: 'No stone at source position' };
    }

    // Check if to position is empty
    if (boardState[to.y][to.x] !== 0) {
      return { success: false, error: 'Target position is not empty' };
    }

    // Move the stone
    const newBoardState = boardState.map((row, y) =>
      row.map((cell, x) => {
        if (x === from.x && y === from.y) {
          return 0; // Remove from source
        }
        if (x === to.x && y === to.y) {
          return player; // Place at target
        }
        return cell;
      })
    );

    return { success: true, newBoardState };
  }

  /**
   * Process a move in missile game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number },
    useMissile?: { from: { x: number; y: number } } // 미사일 사용 시 원래 위치
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as MissileGameData;

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

    // If using missile
    if (useMissile) {
      // Check if can use missile
      if (!this.canUseMissile(gameData, playerNumber)) {
        return { success: false, error: 'Cannot use missile (no missiles or cooldown)' };
      }

      // Move stone with missile
      const missileResult = this.moveStoneWithMissile(
        gameData.boardState,
        useMissile.from,
        move,
        playerNumber
      );

      if (!missileResult.success || !missileResult.newBoardState) {
        return { success: false, error: missileResult.error || 'Invalid missile move' };
      }

      // Update game state
      const updatedData: MissileGameData = {
        ...gameData,
        boardState: missileResult.newBoardState,
        currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
        missileInventory: {
          ...gameData.missileInventory,
          [playerNumber]: gameData.missileInventory[playerNumber] - 1,
        },
        lastMissileUse: {
          ...gameData.lastMissileUse,
          [playerNumber]: gameData.moveHistory.length + 1,
        },
        moveHistory: [
          ...gameData.moveHistory,
          {
            x: move.x,
            y: move.y,
            player: playerNumber as 1 | 2,
          },
        ],
        lastMoveTime: Date.now(),
        gameStatus: 'active',
      };

      await gameStateManager.updateGameState(game.id, updatedData);

      return { success: true };
    }

    // Regular move
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
    const updatedData: MissileGameData = {
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
    const gameData = game.data as MissileGameData;

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

    // Update game state
    const updatedData: MissileGameData = {
      ...gameData,
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
    const gameData = game.data as MissileGameData;

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

