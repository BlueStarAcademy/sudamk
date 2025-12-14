/**
 * Dice Go game mode handler
 * 주사위 바둑 모드 - 주사위를 굴려 나온 수만큼 돌을 놓는 재미있는 바둑
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';

export interface DiceGameData {
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
    maxDiceValue: number; // 주사위 최대값 (기본 6)
  };
  diceRoll: number | null; // 현재 턴의 주사위 결과
  movesRemaining: number; // 현재 턴에 남은 이동 횟수
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class DiceGameMode {
  /**
   * Roll dice (1 to maxDiceValue)
   */
  private static rollDice(maxValue: number): number {
    return Math.floor(Math.random() * maxValue) + 1;
  }

  /**
   * Initialize a new dice game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    maxDiceValue = 6
  ): DiceGameData {
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
        maxDiceValue,
      },
      diceRoll: null,
      movesRemaining: 0,
      gameStatus: 'pending',
    };
  }

  /**
   * Roll dice for current player's turn
   */
  static async rollDiceForTurn(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean; diceValue?: number; error?: string }> {
    const gameData = game.data as DiceGameData;

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

    // Check if already rolled dice for this turn
    if (gameData.movesRemaining > 0) {
      return { success: false, error: 'Dice already rolled for this turn' };
    }

    // Roll dice
    const diceValue = this.rollDice(gameData.settings.maxDiceValue);

    // Update game state
    const updatedData: DiceGameData = {
      ...gameData,
      diceRoll: diceValue,
      movesRemaining: diceValue,
      lastMoveTime: Date.now(),
      gameStatus: 'active',
    };

    await gameStateManager.updateGameState(game.id, updatedData);

    return { success: true, diceValue };
  }

  /**
   * Process a move in dice game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as DiceGameData;

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

    // Check if dice has been rolled and moves remaining
    if (gameData.movesRemaining <= 0) {
      return { success: false, error: 'Must roll dice first or no moves remaining' };
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

    // Update moves remaining
    const newMovesRemaining = gameData.movesRemaining - 1;

    // Update game state
    const updatedData: DiceGameData = {
      ...gameData,
      boardState: result.newBoardState!,
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
      movesRemaining: newMovesRemaining,
      // Switch player if no moves remaining
      currentPlayer: newMovesRemaining === 0 ? (expectedPlayer === 1 ? 2 : 1) : expectedPlayer,
      diceRoll: newMovesRemaining === 0 ? null : gameData.diceRoll,
      lastMoveTime: Date.now(),
      gameStatus: 'active',
    };

    await gameStateManager.updateGameState(game.id, updatedData);

    return { success: true };
  }

  /**
   * Handle pass (skip remaining moves)
   */
  static async handlePass(
    game: LiveGame,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as DiceGameData;

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
    const updatedData: DiceGameData = {
      ...gameData,
      currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      diceRoll: null,
      movesRemaining: 0,
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
    const gameData = game.data as DiceGameData;

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

