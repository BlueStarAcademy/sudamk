/**
 * tRPC router setup
 */

import { router, publicProcedure } from './core';

// Import routers
import { userRouter } from './routers/user.router';
import { gameRouter } from './routers/game.router';
import { inventoryRouter } from './routers/inventory.router';
import { guildRouter } from './routers/guild.router';
import { gameActionRouter } from './routers/game-action.router';
import { shopRouter } from './routers/shop.router';
import { questRouter } from './routers/quest.router';
import { adminRouter } from './routers/admin.router';

// Main app router
export const appRouter = router({
  user: userRouter,
  game: gameRouter,
  gameAction: gameActionRouter,
  inventory: inventoryRouter,
  guild: guildRouter,
  shop: shopRouter,
  quest: questRouter,
  admin: adminRouter,
  
  // Health check
  health: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }),
});

export type AppRouter = typeof appRouter;

