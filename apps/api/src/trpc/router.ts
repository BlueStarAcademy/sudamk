/**
 * tRPC router setup
 */

import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './context.js';

// Initialize tRPC with context
const t = initTRPC.context<Context>().create();

// Base router and procedure
export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure (requires authentication)
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // TypeScript now knows user is defined
    },
  });
});

// Admin procedure (requires admin role)
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next({ ctx });
});

// Import routers
import { userRouter } from './routers/user.router.js';
import { gameRouter } from './routers/game.router.js';
import { inventoryRouter } from './routers/inventory.router.js';
import { guildRouter } from './routers/guild.router.js';
import { gameActionRouter } from './routers/game-action.router.js';
import { shopRouter } from './routers/shop.router.js';
import { questRouter } from './routers/quest.router.js';

// Main app router
export const appRouter = router({
  user: userRouter,
  game: gameRouter,
  gameAction: gameActionRouter,
  inventory: inventoryRouter,
  guild: guildRouter,
  shop: shopRouter,
  quest: questRouter,
  
  // Health check
  health: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }),
});

export type AppRouter = typeof appRouter;

