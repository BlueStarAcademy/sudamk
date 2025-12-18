/**
 * Game state manager
 * Manages game state updates and synchronization
 * 각 게임은 독립적인 세션으로 관리됨 (gameId로 격리)
 */

import { gameRepository } from '../repositories/index.js';
// WebSocket은 나중에 구현
// import { broadcastToGame } from '../websocket/server.js';

export class GameStateManager {
  /**
   * Update game state
   * 게임 상태 업데이트 - 각 게임은 독립적으로 관리됨
   */
  async updateGameState(gameId: string, updates: any) {
    const game = await gameRepository.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const updatedData = {
      ...(game.data as any),
      ...updates,
    };

    const updatedGame = await gameRepository.update(gameId, {
      data: updatedData,
    });

    // TODO: Broadcast update to game participants via WebSocket
    // broadcastToGame(gameId, {
    //   type: 'GAME_UPDATE',
    //   payload: {
    //     [gameId]: {
    //       id: gameId,
    //       status: updatedGame.status,
    //       data: updatedData,
    //     },
    //   },
    // });

    return updatedGame;
  }

  /**
   * Mark game as ended
   */
  async endGame(gameId: string, winnerId?: string, reason?: string) {
    const game = await gameRepository.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const updatedData = {
      ...(game.data as any),
      gameStatus: 'ended',
      winner: winnerId,
      winReason: reason,
    };

    const updatedGame = await gameRepository.update(gameId, {
      status: 'ended',
      isEnded: true,
      data: updatedData,
    });

    // TODO: Broadcast game end via WebSocket
    // broadcastToGame(gameId, {
    //   type: 'GAME_END',
    //   payload: {
    //     gameId,
    //     winner: winnerId,
    //     reason,
    //   },
    // });

    return updatedGame;
  }
}

export const gameStateManager = new GameStateManager();

