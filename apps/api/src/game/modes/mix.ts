/**
 * Mix Go game mode handler
 * 믹스룰 바둑 모드 - 여러 규칙을 섞어서 대결하는 모드
 */

import type { LiveGame } from '@sudam/database';
import { processMove, type Move, type BoardState } from '@sudam/game-logic';
import { gameStateManager } from '../game-state-manager.js';
import { CaptureGameMode } from './capture.js';
import { SpeedGameMode } from './speed.js';
import { BaseGameMode } from './base.js';
import { HiddenGameMode } from './hidden.js';
import { MissileGameMode } from './missile.js';

export interface MixGameData {
  boardState: BoardState;
  visibleBoardState?: BoardState; // Hidden 모드가 활성화된 경우
  currentPlayer: 1 | 2;
  captures: { [key: number]: number };
  moveHistory: Move[];
  koInfo: { point: { x: number; y: number }; turn: number } | null;
  player1Id: string;
  player2Id?: string;
  settings: {
    boardSize: number;
    komi: number;
    // 활성화된 모드들
    enableCapture: boolean;
    enableSpeed: boolean;
    enableBase: boolean;
    enableHidden: boolean;
    enableMissile: boolean;
    // 각 모드의 설정
    targetCaptures?: number;
    initialTime?: number;
    timeIncrement?: number;
    baseStonesPerPlayer?: number;
    maxHiddenStones?: number;
    revealOnCapture?: boolean;
    initialMissiles?: number;
    missileCooldown?: number;
  };
  // Base 모드 관련
  baseStones?: {
    1: Array<{ x: number; y: number }>;
    2: Array<{ x: number; y: number }>;
  };
  basePhase?: 'placing' | 'playing';
  basePlacementTurn?: 1 | 2;
  // Hidden 모드 관련
  hiddenStones?: {
    1: Array<{ x: number; y: number; turn: number }>;
    2: Array<{ x: number; y: number; turn: number }>;
  };
  // Speed 모드 관련
  timeRemaining?: {
    1: number;
    2: number;
  };
  turnStartTime?: number;
  // Missile 모드 관련
  missileInventory?: {
    1: number;
    2: number;
  };
  lastMissileUse?: {
    1?: number;
    2?: number;
  };
  gameStatus: 'pending' | 'active' | 'ended' | 'no_contest';
  winner?: 1 | 2;
  winReason?: string;
  lastMoveTime?: number;
}

export class MixGameMode {
  /**
   * Initialize a new mix game
   */
  static initializeGame(
    player1Id: string,
    player2Id?: string,
    boardSize = 19,
    settings: Partial<MixGameData['settings']> = {}
  ): MixGameData {
    const boardState: BoardState = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(0));

    const defaultSettings: MixGameData['settings'] = {
      boardSize,
      komi: 6.5,
      enableCapture: false,
      enableSpeed: false,
      enableBase: false,
      enableHidden: false,
      enableMissile: false,
      ...settings,
    };

    const gameData: MixGameData = {
      boardState,
      currentPlayer: 1,
      captures: { 1: 0, 2: 0 },
      moveHistory: [],
      koInfo: null,
      player1Id,
      player2Id,
      settings: defaultSettings,
      gameStatus: 'pending',
    };

    // Initialize Base mode if enabled
    if (defaultSettings.enableBase) {
      gameData.baseStones = { 1: [], 2: [] };
      gameData.basePhase = 'placing';
      gameData.basePlacementTurn = 1;
    }

    // Initialize Hidden mode if enabled
    if (defaultSettings.enableHidden) {
      gameData.visibleBoardState = Array(boardSize)
        .fill(null)
        .map(() => Array(boardSize).fill(0));
      gameData.hiddenStones = { 1: [], 2: [] };
    }

    // Initialize Speed mode if enabled
    if (defaultSettings.enableSpeed) {
      const initialTime = defaultSettings.initialTime || 300000;
      gameData.timeRemaining = {
        1: initialTime,
        2: initialTime,
      };
      gameData.turnStartTime = Date.now();
    }

    // Initialize Missile mode if enabled
    if (defaultSettings.enableMissile) {
      const initialMissiles = defaultSettings.initialMissiles || 3;
      gameData.missileInventory = {
        1: initialMissiles,
        2: initialMissiles,
      };
      gameData.lastMissileUse = {};
    }

    return gameData;
  }

  /**
   * Process a move in mix game
   */
  static async processMove(
    game: LiveGame,
    userId: string,
    move: { x: number; y: number },
    options?: {
      isHidden?: boolean;
      useMissile?: { from: { x: number; y: number } };
    }
  ): Promise<{ success: boolean; error?: string }> {
    const gameData = game.data as MixGameData;

    // Handle Base mode placement phase
    if (gameData.settings.enableBase && gameData.basePhase === 'placing') {
      return BaseGameMode.placeBaseStone(game, userId, move);
    }

    // Check Speed mode timeout
    if (gameData.settings.enableSpeed && gameData.timeRemaining && gameData.turnStartTime) {
      const now = Date.now();
      const currentPlayer = gameData.currentPlayer;
      const timeElapsed = now - gameData.turnStartTime;
      const timeRemaining = gameData.timeRemaining[currentPlayer] - timeElapsed;

      if (timeRemaining <= 0) {
        const winner = (currentPlayer === 1 ? 2 : 1) as 1 | 2;
        await gameStateManager.endGame(
          game.id,
          gameData[`player${winner}Id` as 'player1Id' | 'player2Id'],
          'timeout'
        );
        return { success: false, error: 'Time ran out' };
      }
    }

    // Handle Missile move
    if (options?.useMissile && gameData.settings.enableMissile) {
      const missileResult = MissileGameMode.moveStoneWithMissile(
        gameData.boardState,
        options.useMissile.from,
        move,
        gameData.currentPlayer
      );

      if (!missileResult.success || !missileResult.newBoardState) {
        return { success: false, error: missileResult.error || 'Invalid missile move' };
      }

      // Check if can use missile
      if (
        !gameData.missileInventory ||
        gameData.missileInventory[gameData.currentPlayer] <= 0
      ) {
        return { success: false, error: 'No missiles available' };
      }

      // Update game state
      const updatedData: MixGameData = {
        ...gameData,
        boardState: missileResult.newBoardState,
        currentPlayer: (gameData.currentPlayer === 1 ? 2 : 1) as 1 | 2,
        missileInventory: {
          ...gameData.missileInventory,
          [gameData.currentPlayer]: gameData.missileInventory[gameData.currentPlayer] - 1,
        },
        lastMissileUse: {
          ...gameData.lastMissileUse,
          [gameData.currentPlayer]: gameData.moveHistory.length + 1,
        },
        moveHistory: [
          ...gameData.moveHistory,
          {
            x: move.x,
            y: move.y,
            player: gameData.currentPlayer,
          },
        ],
        lastMoveTime: Date.now(),
        turnStartTime: gameData.settings.enableSpeed ? Date.now() : gameData.turnStartTime,
        gameStatus: 'active',
      };

      // Update Speed mode time
      if (gameData.settings.enableSpeed && gameData.timeRemaining && gameData.turnStartTime) {
        const now = Date.now();
        const timeUsed = now - gameData.turnStartTime;
        const remaining = gameData.timeRemaining[gameData.currentPlayer] - timeUsed;
        updatedData.timeRemaining = {
          ...gameData.timeRemaining,
          [gameData.currentPlayer]: remaining + (gameData.settings.timeIncrement || 0),
        };
      }

      await gameStateManager.updateGameState(game.id, updatedData);
      return { success: true };
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

    // Check Base mode restrictions
    if (gameData.settings.enableBase && gameData.baseStones) {
      const isBaseStonePosition = [
        ...gameData.baseStones[1],
        ...gameData.baseStones[2],
      ].some((base) => base.x === move.x && base.y === move.y);

      if (isBaseStonePosition) {
        return { success: false, error: 'Cannot place on base stone position' };
      }
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

    // Check Capture mode win condition
    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;
    let gameStatus: 'active' | 'ended' = 'active';

    if (
      gameData.settings.enableCapture &&
      gameData.settings.targetCaptures &&
      newCaptures[playerNumber] >= gameData.settings.targetCaptures
    ) {
      winner = playerNumber;
      winReason = `captured_${gameData.settings.targetCaptures}_stones`;
      gameStatus = 'ended';
    }

    // Update Hidden mode
    let updatedHiddenStones = gameData.hiddenStones;
    if (options?.isHidden && gameData.settings.enableHidden && updatedHiddenStones) {
      if (
        updatedHiddenStones[playerNumber].length <
        (gameData.settings.maxHiddenStones || 5)
      ) {
        updatedHiddenStones = {
          ...updatedHiddenStones,
          [playerNumber]: [
            ...updatedHiddenStones[playerNumber],
            { x: move.x, y: move.y, turn: gameData.moveHistory.length + 1 },
          ],
        };
      }
    }

    // Update visible board for Hidden mode
    let visibleBoardState = gameData.visibleBoardState;
    if (gameData.settings.enableHidden && updatedHiddenStones) {
      visibleBoardState = result.newBoardState.map((row) => [...row]);
      const opponent = playerNumber === 1 ? 2 : 1;
      updatedHiddenStones[opponent].forEach((hidden) => {
        if (visibleBoardState) {
          visibleBoardState[hidden.y][hidden.x] = 0;
        }
      });
    }

    // Update Speed mode time
    let timeRemaining = gameData.timeRemaining;
    let turnStartTime = gameData.turnStartTime;
    if (gameData.settings.enableSpeed && timeRemaining && gameData.turnStartTime) {
      const now = Date.now();
      const timeUsed = now - gameData.turnStartTime;
      const remaining = timeRemaining[playerNumber] - timeUsed;
      timeRemaining = {
        ...timeRemaining,
        [playerNumber]: remaining + (gameData.settings.timeIncrement || 0),
      };
      turnStartTime = now;
    }

    // Update game state
    const updatedData: MixGameData = {
      ...gameData,
      boardState: result.newBoardState!,
      visibleBoardState,
      currentPlayer: (expectedPlayer === 1 ? 2 : 1) as 1 | 2,
      captures: newCaptures,
      hiddenStones: updatedHiddenStones,
      timeRemaining,
      turnStartTime,
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

    // End game if Capture mode win condition met
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
    const gameData = game.data as MixGameData;

    // If Base mode is enabled and still in placement phase
    if (gameData.settings.enableBase && gameData.basePhase === 'placing') {
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

    // In Capture mode, determine winner by captures
    let winner: 1 | 2 | undefined;
    let winReason: string | undefined;

    if (consecutivePasses && gameData.settings.enableCapture) {
      if (gameData.captures[1] > gameData.captures[2]) {
        winner = 1;
        winReason = 'more_captures';
      } else if (gameData.captures[2] > gameData.captures[1]) {
        winner = 2;
        winReason = 'more_captures';
      } else {
        winReason = 'tie';
      }
    }

    // Update game state
    const updatedData: MixGameData = {
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
    const gameData = game.data as MixGameData;

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

