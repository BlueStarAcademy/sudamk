/**
 * Game state manager
 * Manages game state updates and synchronization
 */

import { gameRepository } from '../repositories/index.js';
import { broadcastToGame } from '../websocket/server.js';

export class GameStateManager {
  /**
   * Update game state
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

    // Broadcast update to game participants
    broadcastToGame(gameId, {
      type: 'GAME_UPDATE',
      payload: {
        [gameId]: {
          id: gameId,
          status: updatedGame.status,
          data: updatedData,
        },
      },
    });

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

    // Broadcast game end
    broadcastToGame(gameId, {
      type: 'GAME_END',
      payload: {
        gameId,
        winner: winnerId,
        reason,
      },
    });

    return updatedGame;
  }
}

export const gameStateManager = new GameStateManager();

