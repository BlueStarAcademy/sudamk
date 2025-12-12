/**
 * tRPC router setup
 */

import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// Initialize tRPC
const t = initTRPC.context().create();

// Base router and procedure
export const router = t.router;
export const publicProcedure = t.procedure;

// Example router (will be replaced with actual routers)
export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name ?? 'World'}!`,
      };
    }),
});

export type AppRouter = typeof appRouter;

