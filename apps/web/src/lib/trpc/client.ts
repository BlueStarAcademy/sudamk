/**
 * tRPC client setup for Next.js
 */

import { createTRPCReact } from '@trpc/react-query';
// Type import fails during build, using any as workaround
// import type { AppRouter } from '@sudam/api/src/trpc/router';

export const trpc = createTRPCReact<any>();

