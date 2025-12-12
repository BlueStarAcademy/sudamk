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

// Example router (will be replaced with actual routers)
export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name ?? 'World'}!`,
      };
    }),
  
  // Protected example
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      userId: ctx.user.id,
      username: ctx.user.username,
      isAdmin: ctx.user.isAdmin,
    };
  }),
});

export type AppRouter = typeof appRouter;

