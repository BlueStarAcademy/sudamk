/**
 * tRPC router setup
 */

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

// Initialize tRPC with context
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

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

// Admin procedure (requires admin role) - 절대적인 관리자 권한
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

