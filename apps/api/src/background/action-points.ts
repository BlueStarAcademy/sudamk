/**
 * Action points regeneration system
 * 액션 포인트 재생성 시스템
 */

import { userRepository } from '../repositories/index.js';

const ACTION_POINT_REGEN_INTERVAL = 5 * 60 * 1000; // 5 minutes
const ACTION_POINT_REGEN_AMOUNT = 1;
const MAX_ACTION_POINTS = 100;

export async function regenerateActionPoints() {
  try {
    // Get all users
    const users = await userRepository.list({
      take: 1000, // Process in batches
    });

    const now = Date.now();
    let updatedCount = 0;

    for (const user of users) {
      // Check if user needs action point regeneration
      if (user.actionPointCurr >= user.actionPointMax) {
        continue; // Already at max
      }

      // Calculate how many action points to regenerate
      // This is simplified - in production, track last regeneration time
      const pointsToAdd = Math.min(
        ACTION_POINT_REGEN_AMOUNT,
        user.actionPointMax - user.actionPointCurr
      );

      if (pointsToAdd > 0) {
        await userRepository.update(user.id, {
          actionPointCurr: user.actionPointCurr + pointsToAdd,
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`[ActionPoints] Regenerated action points for ${updatedCount} users`);
    }
  } catch (error: any) {
    console.error('[ActionPoints] Error regenerating action points:', error?.message);
  }
}

let actionPointInterval: NodeJS.Timeout | null = null;

export function startActionPointRegeneration() {
  if (actionPointInterval) {
    console.warn('[ActionPoints] Action point regeneration already running');
    return;
  }

  console.log('[ActionPoints] Starting action point regeneration...');
  
  // Run immediately, then on interval
  regenerateActionPoints();
  actionPointInterval = setInterval(regenerateActionPoints, ACTION_POINT_REGEN_INTERVAL);
}

export function stopActionPointRegeneration() {
  if (actionPointInterval) {
    clearInterval(actionPointInterval);
    actionPointInterval = null;
    console.log('[ActionPoints] Action point regeneration stopped');
  }
}

