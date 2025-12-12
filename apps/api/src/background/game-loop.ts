/**
 * Game loop for background processing
 * Optimized version of the original main loop
 */

import { gameRepository } from '../repositories/index.js';
import { gameStateManager } from '../game/game-state-manager.js';

let isRunning = false;
let loopInterval: NodeJS.Timeout | null = null;

const GAME_LOOP_INTERVAL = 10000; // 10 seconds (optimized from 1 second)

export function startGameLoop() {
  if (isRunning) {
    console.warn('[GameLoop] Game loop is already running');
    return;
  }

  isRunning = true;
  console.log('[GameLoop] Starting game loop...');

  const processGames = async () => {
    try {
      const now = Date.now();
      
      // Get active games (with timeout protection)
      const activeGames = await Promise.race([
        gameRepository.findActive(),
        new Promise<any[]>((resolve) => {
          setTimeout(() => {
            console.warn('[GameLoop] Game fetch timeout, skipping this cycle');
            resolve([]);
          }, 5000);
        }),
      ]);

      if (activeGames.length === 0) {
        return;
      }

      // Process games in batches (3 at a time)
      const BATCH_SIZE = 3;
      for (let i = 0; i < activeGames.length; i += BATCH_SIZE) {
        const batch = activeGames.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (game) => {
            try {
              // Process game state updates
              // TODO: Implement game mode-specific updates
              const gameData = game.data as any;
              
              // Skip ended games
              if (gameData.gameStatus === 'ended' || gameData.gameStatus === 'no_contest') {
                return;
              }

              // Process timeout checks, action buttons, etc.
              // This will be implemented per game mode
              
            } catch (error: any) {
              console.error(`[GameLoop] Error processing game ${game.id}:`, error?.message);
            }
          })
        );
      }
    } catch (error: any) {
      console.error('[GameLoop] Error in game loop:', error?.message);
    }
  };

  // Run immediately, then on interval
  processGames();
  loopInterval = setInterval(processGames, GAME_LOOP_INTERVAL);
}

export function stopGameLoop() {
  if (!isRunning) {
    return;
  }

  isRunning = false;
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }
  
  console.log('[GameLoop] Game loop stopped');
}

