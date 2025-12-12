/**
 * tRPC utilities
 */

import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import type { AppRouter } from '@sudam/api/src/trpc/router';
import superjson from 'superjson';

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }
  
  // SSR should use full URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Development SSR should use localhost
  return `http://localhost:${process.env.PORT ?? 4000}`;
}

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/trpc`,
          // Optional: Add headers for authentication
          headers() {
            const token = typeof window !== 'undefined' 
              ? localStorage.getItem('token') 
              : null;
            
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    };
  },
  ssr: false, // Disable SSR for now, can enable later
});

