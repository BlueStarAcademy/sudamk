/**
 * Capture Go game mode handler
 * 따내기 바둑 모드 - 정해진 개수의 돌을 먼저 따내는 사람이 승리
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';

export interface CaptureGameData {
  boardState: BoardState;
  currentPlayer: 1 | 2; // Black = 1, White = 2
  captures: { [key: number]: number };
  moveHistory: Move[];
  koInfo: { point: { x: number; y: number }; turn: number } | null;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    targetCaptures: number; // 목표 따낸 돌 개수
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number; // Timestamp of last move
}

export class CaptureGameMode {
  /**
   * Initialize a new capture game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    targetCaptures = 10
  ): CaptureGameData {
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
        targetCaptures, // 기본값 10개, 설정 가능
      },
      gameStatus: 'pending',
    };
  }

  /**
   * Process a move in capture game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as CaptureGameData;

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

    // Update captures
    const newCaptures = {
      ...gameData.captures,
      [playerNumber]: gameData.captures[playerNumber] + (result.captures || 0),
    };

    // Check win condition: first player to reach target captures wins
    const targetCaptures = gameData.settings.targetCaptures || 10;
    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;
    let gameStatus: 'active' | 'ended' = 'active';

    if (newCaptures[playerNumber] >= targetCaptures) {
      winner = playerNumber;
      winReason = `captured_${targetCaptures}_stones`;
      gameStatus = 'ended';
    }

    // Update game state
    const updatedData: CaptureGameData = {
      ...gameData,
      boardState: result.newBoardState!,
      currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      captures: newCaptures,
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
      gameStatus: gameStatus === 'ended' ? 'ended' : 'active',
      winner,
      winReason,
    };

    // Update game in database
    if (gameStatus === 'ended' && winner) {
      await gameStateManager.endGame(
        game.id,
        gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
        winReason || 'capture_win'
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
    const gameData = game.data as CaptureGameData;

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

    // In capture mode, if both players pass, winner is determined by captures
    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;

    if (consecutivePasses) {
      // Player with more captures wins
      if (gameData.captures[1] > gameData.captures[2]) {
        winner = 1;
        winReason = 'more_captures';
      } else if (gameData.captures[2] > gameData.captures[1]) {
        winner = 2;
        winReason = 'more_captures';
      } else {
        // Tie - could be handled differently, for now we'll end without winner
        winReason = 'tie';
      }
    }

    // Update game state
    const updatedData: CaptureGameData = {
      ...gameData,
      currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      moveHistory: updatedMoveHistory,
      lastMoveTime: Date.now(),
      gameStatus: consecutivePasses ? 'ended' : 'active',
      winner,
      winReason,
    };

    // If both players passed, end the game
    if (consecutivePasses) {
      if (winner) {
        await gameStateManager.endGame(
          game.id,
          gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
          winReason || 'both_players_passed'
        );
      } else {
        await gameStateManager.endGame(game.id, undefined, 'tie');
      }
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
    const gameData = game.data as CaptureGameData;

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

