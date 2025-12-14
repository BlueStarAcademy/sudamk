/**
 * Game Modes Integration Tests
 * 게임 모드별 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient } from '@sudam/database';
import { gameRepository } from '../../repositories/index.js';
import {
  CaptureGameMode,
  SpeedGameMode,
  BaseGameMode,
  HiddenGameMode,
  MissileGameMode,
  MixGameMode,
  DiceGameMode,
  OmokGameMode,
  TtamokGameMode,
  ThiefGameMode,
  AlkkagiGameMode,
  CurlingGameMode,
} from '../../game/modes/index.js';

const prisma = getPrismaClient();

describe('Game Modes Integration Tests', () => {
  let testUserId1: string;
  let testUserId2: string;

  beforeAll(async () => {
    testUserId1 = 'test-modes-user-1-' + Date.now();
    testUserId2 = 'test-modes-user-2-' + Date.now();

    await prisma.user.createMany({
      data: [
        {
          id: testUserId1,
          nickname: 'testplayer1' + Date.now(),
        },
        {
          id: testUserId2,
          nickname: 'testplayer2' + Date.now(),
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.liveGame.deleteMany({
        where: {
          id: { startsWith: 'test-mode-' },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [testUserId1, testUserId2] },
        },
      });
    } catch (error) {
      // Ignore errors
    }
    await prisma.$disconnect();
  });

  describe('Capture Mode', () => {
    it('should initialize capture game', () => {
      const gameData = CaptureGameMode.initializeGame(testUserId1, testUserId2, 19, 5);
      expect(gameData.settings.targetCaptures).toBe(5);
      expect(gameData.captures).toEqual({ 1: 0, 2: 0 });
    });

    it('should win when reaching target captures', async () => {
      const gameId = 'test-mode-capture-' + Date.now();
      const gameData = CaptureGameMode.initializeGame(testUserId1, testUserId2, 19, 2);
      
      const game = await gameRepository.create({
        id: gameId,
        status: 'active',
        category: 'capture',
        data: gameData,
      });

      // Simulate captures
      const updatedData = {
        ...gameData,
        captures: { 1: 2, 2: 0 },
      };
      await gameRepository.update(gameId, { data: updatedData });

      // Check win condition
      const updatedGame = await gameRepository.findById(gameId);
      const data = updatedGame?.data as any;
      expect(data.captures[1]).toBeGreaterThanOrEqual(data.settings.targetCaptures);
    });
  });

  describe('Speed Mode', () => {
    it('should initialize speed game with time', () => {
      const gameData = SpeedGameMode.initializeGame(testUserId1, testUserId2, 19, 60000, 5000);
      expect(gameData.settings.initialTime).toBe(60000);
      expect(gameData.settings.timeIncrement).toBe(5000);
      expect(gameData.timeRemaining).toBeDefined();
      expect(gameData.timeRemaining[1]).toBe(60000);
    });

    it('should have turn start time', () => {
      const gameData = SpeedGameMode.initializeGame(testUserId1, testUserId2);
      expect(gameData.turnStartTime).toBeDefined();
    });
  });

  describe('Base Mode', () => {
    it('should initialize base game with placement phase', () => {
      const gameData = BaseGameMode.initializeGame(testUserId1, testUserId2, 19, 3);
      expect(gameData.basePhase).toBe('placing');
      expect(gameData.basePlacementTurn).toBe(1);
      expect(gameData.baseStones[1]).toEqual([]);
      expect(gameData.baseStones[2]).toEqual([]);
    });

    it('should place base stones', async () => {
      const gameId = 'test-mode-base-' + Date.now();
      const gameData = BaseGameMode.initializeGame(testUserId1, testUserId2, 19, 2);
      
      const game = await gameRepository.create({
        id: gameId,
        status: 'pending',
        category: 'base',
        data: gameData,
      });

      const result = await BaseGameMode.placeBaseStone(game, testUserId1, { x: 3, y: 3 });
      expect(result.success).toBe(true);

      const updatedGame = await gameRepository.findById(gameId);
      const data = updatedGame?.data as any;
      expect(data.baseStones[1]).toHaveLength(1);
      expect(data.baseStones[1][0]).toEqual({ x: 3, y: 3 });
    });
  });

  describe('Hidden Mode', () => {
    it('should initialize hidden game with visible board', () => {
      const gameData = HiddenGameMode.initializeGame(testUserId1, testUserId2, 19, 5, true);
      expect(gameData.visibleBoardState).toBeDefined();
      expect(gameData.settings.maxHiddenStones).toBe(5);
      expect(gameData.settings.revealOnCapture).toBe(true);
      expect(gameData.hiddenStones[1]).toEqual([]);
    });
  });

  describe('Missile Mode', () => {
    it('should initialize missile game with inventory', () => {
      const gameData = MissileGameMode.initializeGame(testUserId1, testUserId2, 19, 5, 3);
      expect(gameData.missileInventory[1]).toBe(5);
      expect(gameData.missileInventory[2]).toBe(5);
      expect(gameData.settings.missileCooldown).toBe(3);
    });
  });

  describe('Mix Mode', () => {
    it('should initialize mix game with multiple modes enabled', () => {
      const gameData = MixGameMode.initializeGame(testUserId1, testUserId2, 19, {
        enableCapture: true,
        enableSpeed: true,
        enableBase: true,
        targetCaptures: 10,
        initialTime: 300000,
        timeIncrement: 5000,
        baseStonesPerPlayer: 3,
      });

      expect(gameData.settings.enableCapture).toBe(true);
      expect(gameData.settings.enableSpeed).toBe(true);
      expect(gameData.settings.enableBase).toBe(true);
      expect(gameData.timeRemaining).toBeDefined();
      expect(gameData.baseStones).toBeDefined();
    });
  });

  describe('Dice Mode', () => {
    it('should initialize dice game', () => {
      const gameData = DiceGameMode.initializeGame(testUserId1, testUserId2, 19, 6);
      expect(gameData.settings.maxDiceValue).toBe(6);
      expect(gameData.diceRoll).toBeNull();
      expect(gameData.movesRemaining).toBe(0);
    });

    it('should roll dice for turn', async () => {
      const gameId = 'test-mode-dice-' + Date.now();
      const gameData = DiceGameMode.initializeGame(testUserId1, testUserId2, 19);
      
      const game = await gameRepository.create({
        id: gameId,
        status: 'pending',
        category: 'dice',
        data: gameData,
      });

      const result = await DiceGameMode.rollDiceForTurn(game, testUserId1);
      expect(result.success).toBe(true);
      expect(result.diceValue).toBeGreaterThanOrEqual(1);
      expect(result.diceValue).toBeLessThanOrEqual(6);
    });
  });

  describe('Omok Mode', () => {
    it('should initialize omok game with 15x15 board', () => {
      const gameData = OmokGameMode.initializeGame(testUserId1, testUserId2, 15);
      expect(gameData.settings.boardSize).toBe(15);
      expect(gameData.boardState).toHaveLength(15);
      expect(gameData.boardState[0]).toHaveLength(15);
    });

    it('should detect 5 in a row win', async () => {
      const gameId = 'test-mode-omok-' + Date.now();
      const gameData = OmokGameMode.initializeGame(testUserId1, testUserId2, 15);
      
      // Create a board with 5 in a row
      const boardState = gameData.boardState.map((row) => [...row]);
      for (let i = 0; i < 5; i++) {
        boardState[0][i] = 1;
      }
      boardState[0][4] = 1; // Last stone

      const updatedData = {
        ...gameData,
        boardState,
        moveHistory: [
          { x: 0, y: 0, player: 1 },
          { x: 1, y: 0, player: 1 },
          { x: 2, y: 0, player: 1 },
          { x: 3, y: 0, player: 1 },
        ],
      };

      const game = await gameRepository.create({
        id: gameId,
        status: 'active',
        category: 'omok',
        data: updatedData,
      });

      const result = await OmokGameMode.processMove(game, testUserId1, { x: 4, y: 0 });
      expect(result.success).toBe(true);

      const finalGame = await gameRepository.findById(gameId);
      const finalData = finalGame?.data as any;
      expect(finalData.gameStatus).toBe('ended');
      expect(finalData.winner).toBe(1);
    });
  });

  describe('Ttamok Mode', () => {
    it('should initialize ttamok game', () => {
      const gameData = TtamokGameMode.initializeGame(testUserId1, testUserId2, 15, 5);
      expect(gameData.settings.targetCaptures).toBe(5);
      expect(gameData.captures).toEqual({ 1: 0, 2: 0 });
    });
  });

  describe('Thief Mode', () => {
    it('should initialize thief game with positions', () => {
      const gameData = ThiefGameMode.initializeGame(testUserId1, testUserId2, 19, 2, 1, 1);
      expect(gameData.thiefPosition).toBeDefined();
      expect(gameData.policePosition).toBeDefined();
      expect(gameData.settings.thiefMovesPerTurn).toBe(2);
      expect(gameData.settings.policeMovesPerTurn).toBe(1);
      expect(gameData.movesRemaining).toBe(2); // Thief starts
    });

    it('should have thief and police at opposite corners', () => {
      const gameData = ThiefGameMode.initializeGame(testUserId1, testUserId2, 19);
      expect(gameData.thiefPosition).toEqual({ x: 0, y: 0 });
      expect(gameData.policePosition).toEqual({ x: 18, y: 18 });
    });
  });

  describe('Alkkagi Mode', () => {
    it('should initialize alkkagi game with initial stones', () => {
      const gameData = AlkkagiGameMode.initializeGame(testUserId1, testUserId2, 19, 10);
      expect(gameData.settings.targetCaptures).toBe(10);
      
      // Check initial stones are placed
      let player1Stones = 0;
      let player2Stones = 0;
      gameData.boardState.forEach((row) => {
        row.forEach((cell) => {
          if (cell === 1) player1Stones++;
          if (cell === 2) player2Stones++;
        });
      });
      expect(player1Stones).toBeGreaterThan(0);
      expect(player2Stones).toBeGreaterThan(0);
    });
  });

  describe('Curling Mode', () => {
    it('should initialize curling game with target position', () => {
      const gameData = CurlingGameMode.initializeGame(testUserId1, testUserId2, 19, 10, 5);
      expect(gameData.targetPosition).toBeDefined();
      expect(gameData.settings.targetScore).toBe(10);
      expect(gameData.settings.rounds).toBe(5);
      expect(gameData.currentRound).toBe(1);
      expect(gameData.scores).toEqual({ 1: 0, 2: 0 });
    });

    it('should have target at center', () => {
      const gameData = CurlingGameMode.initializeGame(testUserId1, testUserId2, 19);
      const center = Math.floor(19 / 2);
      expect(gameData.targetPosition).toEqual({ x: center, y: center });
    });
  });
});

