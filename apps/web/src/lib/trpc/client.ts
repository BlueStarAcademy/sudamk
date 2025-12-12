/**
 * tRPC client setup for Next.js
 */

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@sudam/api/src/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

