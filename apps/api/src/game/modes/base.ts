/**
 * Base Go game mode handler
 * 베이스 바둑 모드 - 각자 비밀리에 베이스돌을 놓아 독특한 시작 판을 만듭니다
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';

export interface BaseGameData {
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
    baseStonesPerPlayer: number; // 각 플레이어가 놓을 베이스 돌 개수
  };
  baseStones: {
    1: Array<{ x: number; y: number }>; // Player 1의 베이스 돌 위치
    2: Array<{ x: number; y: number }>; // Player 2의 베이스 돌 위치
  };
  basePhase: 'placing' | 'playing'; // 베이스 돌 배치 단계 또는 게임 진행 단계
  basePlacementTurn: 1 | 2; // 베이스 돌 배치 중인 플레이어
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class BaseGameMode {
  /**
   * Initialize a new base game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    baseStonesPerPlayer = 3
  ): BaseGameData {
    const boardState: BoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    return {
      boardState,
      currentPlayer: 1, // Black starts placing base stones
      captures: { 1: 0, 2: 0 },
      moveHistory: [],
      koInfo: null,
      player1Id,
      player2Id,
      settings: {
        boardSize,
        komi: 6.5,
        baseStonesPerPlayer,
      },
      baseStones: {
        1: [],
        2: [],
      },
      basePhase: 'placing', // Start with base stone placement phase
      basePlacementTurn: 1,
      gameStatus: 'pending',
    };
  }

  /**
   * Place a base stone (during placement phase)
   */
  static async placeBaseStone(
    game: LiveGame,
    userId: string,
    position: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as BaseGameData;

    // Verify player
    const isPlayer1 = userId === gameData.player1Id;
    const isPlayer2 = userId === gameData.player2Id;
    if (!isPlayer1 && !isPlayer2) {
      return { success: false, error: 'Not a player in this game' };
    }

    const playerNumber = isPlayer1 ? 1 : 2;

    // Check if still in placement phase
    if (gameData.basePhase !== 'placing') {
      return { success: false, error: 'Base stone placement phase is over' };
    }

    // Check if it's this player's turn to place base stones
    if (gameData.basePlacementTurn !== playerNumber) {
      return { success: false, error: 'Not your turn to place base stones' };
    }

    // Check bounds
    const boardSize = gameData.settings.boardSize;
    if (
      position.x < 0 ||
      position.x >= boardSize ||
      position.y < 0 ||
      position.y >= boardSize
    ) {
      return { success: false, error: 'Position out of bounds' };
    }

    // Check if position is already occupied (by base stone or regular stone)
    if (gameData.boardState[position.y][position.x] !== 0) {
      return { success: false, error: 'Position already occupied' };
    }

    // Check if player already placed all base stones
    const currentBaseStones = gameData.baseStones[playerNumber];
    if (currentBaseStones.length >= gameData.settings.baseStonesPerPlayer) {
      return { success: false, error: 'All base stones already placed' };
    }

    // Place base stone (on board but marked separately)
    const updatedBaseStones = {
      ...gameData.baseStones,
      [playerNumber]: [...currentBaseStones, { x: position.x, y: position.y }],
    };

    // Place stone on board (but it's a base stone, not a regular move)
    const updatedBoardState = gameData.boardState.map((row, y) =>
      row.map((cell, x) => {
        if (x === position.x && y === position.y) {
          return playerNumber;
        }
        return cell;
      })
    );

    // Check if both players have placed all base stones
    const allBaseStonesPlaced =
      updatedBaseStones[1].length >= gameData.settings.baseStonesPerPlayer &&
      updatedBaseStones[2].length >= gameData.settings.baseStonesPerPlayer;

    // Update game state
    const updatedData: BaseGameData = {
      ...gameData,
      boardState: updatedBoardState,
      baseStones: updatedBaseStones,
      basePhase: allBaseStonesPlaced ? 'playing' : 'placing',
      basePlacementTurn: allBaseStonesPlaced
        ? 1 // Start regular game with player 1
        : (gameData.basePlacementTurn === 1 ? 2 : 1),
      currentPlayer: allBaseStonesPlaced ? 1 : gameData.currentPlayer,
      gameStatus: allBaseStonesPlaced ? 'active' : 'pending',
      lastMoveTime: Date.now(),
    };

    await gameStateManager.updateGameState(game.id, updatedData);

    return { success: true };
  }

  /**
   * Process a move in base game (after base stone placement)
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as BaseGameData;

    // If still in placement phase, use placeBaseStone instead
    if (gameData.basePhase === 'placing') {
      return this.placeBaseStone(game, userId, move);
    }

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

    // Check if trying to place on a base stone position
    const isBaseStonePosition = [
      ...gameData.baseStones[1],
      ...gameData.baseStones[2],
    ].some((base) => base.x === move.x && base.y === move.y);

    if (isBaseStonePosition) {
      return { success: false, error: 'Cannot place on base stone position' };
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
    const updatedData: BaseGameData = {
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
    const gameData = game.data as BaseGameData;

    // If still in placement phase, cannot pass
    if (gameData.basePhase === 'placing') {
      return { success: false, error: 'Must place all base stones before passing' };
    }

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
    const updatedData: BaseGameData = {
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
    const gameData = game.data as BaseGameData;

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

