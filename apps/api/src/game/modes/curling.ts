/**
 * Curling game mode handler
 * 바둑 컬링 모드 - 바둑판에서 컬링을 하는 게임
 */

import type { LiveGame } from '@sudam/database';
import { gameStateManager } from '../game-state-manager.js';

export type CurlingPlayer = 0 | 1 | 2; // None, Player1, Player2
export type CurlingBoardState = CurlingPlayer[][];

export interface CurlingGameData {
  boardState: CurlingBoardState;
  currentPlayer: 1 | 2;
  scores: {
    1: number; // Player 1 점수
    2: number; // Player 2 점수
  };
  moveHistory: Array<{
    x: number;
    y: number;
    player: 1 | 2;
    power?: number; // 던지는 힘
    direction?: { x: number; y: number }; // 방향
  }>;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    targetScore: number; // 목표 점수 (기본 10점)
    rounds: number; // 라운드 수
  };
  currentRound: number;
  stonesThrown: { [key: number]: number }; // 각 플레이어가 던진 돌 개수
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
  targetPosition?: { x: number; y: number }; // 목표 위치 (중앙)
}

export class CurlingGameMode {
  /**
   * Calculate distance from target
   */
  private static distanceToTarget(
    pos: { x: number; y: number },
    target: { x: number; y: number }
  ): number {
    const dx = pos.x - target.x;
    const dy = pos.y - target.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate score based on distance from target
   */
  private static calculateScore(
    positions: Array<{ x: number; y: number; player: 1 | 2 }>,
    target: { x: number; y: number },
    currentPlayer: 1 | 2
  ): number {
    // Sort by distance to target
    const sorted = positions
      .map((pos) => ({
        ...pos,
        distance: this.distanceToTarget(pos, target),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Score points for stones closest to target
    let score = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].player === currentPlayer) {
        // Check if this is the closest stone
        if (i === 0) {
          score += 3; // Closest stone gets 3 points
        } else if (i === 1) {
          score += 2; // Second closest gets 2 points
        } else {
          score += 1; // Others get 1 point
        }
      } else {
        // Opponent's stone is closer, stop scoring
        break;
      }
    }

    return score;
  }

  /**
   * Initialize a new curling game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    targetScore = 10,
    rounds = 5
  ): CurlingGameData {
    const boardState: CurlingBoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    const center = Math.floor(boardSize / 2);
    const targetPosition = { x: center, y: center };

    return {
      boardState,
      currentPlayer: 1,
      scores: { 1: 0, 2: 0 },
      moveHistory: [],
      player1Id,
      player2Id,
      settings: {
        boardSize,
        targetScore,
        rounds,
      },
      currentRound: 1,
      stonesThrown: { 1: 0, 2: 0 },
      gameStatus: 'pending',
      targetPosition,
    };
  }

  /**
   * Process a move in curling game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: {
      x: number;
      y: number;
      power?: number;
      direction?: { x: number; y: number };
    }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as CurlingGameData;
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

    // Check if position is empty
    if (gameData.boardState[move.y][move.x] !== 0) {
      return { success: false, error: 'Position already occupied' };
    }

    // Place stone
    const newBoardState = gameData.boardState.map((row) => row.map((cell) => cell));
    newBoardState[move.y][move.x] = playerNumber;

    // Update stones thrown
    const newStonesThrown = {
      ...gameData.stonesThrown,
      [playerNumber]: gameData.stonesThrown[playerNumber] + 1,
    };

    // Check if round is complete (both players have thrown their stones)
    const stonesPerRound = 3; // Each player throws 3 stones per round
    const roundComplete =
      newStonesThrown[1] >= stonesPerRound && newStonesThrown[2] >= stonesPerRound;

    // Calculate score if round is complete
    let newScores = { ...gameData.scores };
    let nextRound = gameData.currentRound;
    let nextStonesThrown = newStonesThrown;

    if (roundComplete && gameData.targetPosition) {
      // Get all stone positions
      const stonePositions: Array<{ x: number; y: number; player: 1 | 2 }> = [];
      newBoardState.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell !== 0) {
            stonePositions.push({ x, y, player: cell as 1 | 2 });
          }
        });
      });

      // Calculate scores
      const player1Score = this.calculateScore(
        stonePositions,
        gameData.targetPosition,
        1
      );
      const player2Score = this.calculateScore(
        stonePositions,
        gameData.targetPosition,
        2
      );

      newScores = {
        1: gameData.scores[1] + player1Score,
        2: gameData.scores[2] + player2Score,
      };

      // Reset for next round
      nextRound = gameData.currentRound + 1;
      nextStonesThrown = { 1: 0, 2: 0 };

      // Clear board for next round
      newBoardState.forEach((row) => {
        row.fill(0);
      });
    }

    // Check win conditions
    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;
    let gameStatus: 'active' | 'ended' = 'active';

    if (
      newScores[1] >= gameData.settings.targetScore ||
      newScores[2] >= gameData.settings.targetScore
    ) {
      winner = newScores[1] >= gameData.settings.targetScore ? 1 : 2;
      winReason = 'reached_target_score';
      gameStatus = 'ended';
    } else if (nextRound > gameData.settings.rounds) {
      // Game ends after all rounds, winner is player with higher score
      winner = newScores[1] > newScores[2] ? 1 : newScores[2] > newScores[1] ? 2 : undefined;
      winReason = winner ? 'higher_score' : 'tie';
      gameStatus = 'ended';
    }

    // Switch player if round not complete
    let nextPlayer = gameData.currentPlayer;
    if (!roundComplete) {
      nextPlayer = expectedPlayer === 1 ? 2 : 1;
    }

    // Update game state
    const updatedData: CurlingGameData = {
      ...gameData,
      boardState: newBoardState,
      currentPlayer: gameStatus === 'ended' ? gameData.currentPlayer : nextPlayer,
      scores: newScores,
      currentRound: nextRound,
      stonesThrown: nextStonesThrown,
      moveHistory: [
        ...gameData.moveHistory,
        {
          x: move.x,
          y: move.y,
          player: playerNumber,
          power: move.power,
          direction: move.direction,
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
        winReason || 'curling_win'
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
    const gameData = game.data as CurlingGameData;

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
    const updatedData: CurlingGameData = {
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
    const gameData = game.data as CurlingGameData;

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

