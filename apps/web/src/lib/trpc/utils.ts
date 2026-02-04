/**
 * tRPC utilities
 */

import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
// Type import fails during build, using any as workaround
// import type { AppRouter } from '@sudam/api/src/trpc/router';
import superjson from 'superjson';

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser must call the API service directly when web/api are deployed separately.
    // Fallback to relative path only when NEXT_PUBLIC_API_URL is not set (e.g. local dev).
    return process.env.NEXT_PUBLIC_API_URL || '';
  }
  
  // SSR should use full URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Development SSR should use localhost
  return process.env.NEXT_PUBLIC_API_URL || `http://localhost:4000`;
}

const _trpc = createTRPCNext<any>({
  config() {
    return {
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/trpc`,
          // Optional: Add headers for authentication
          headers() {
            if (typeof window === 'undefined') return {};
            const token = localStorage.getItem('sudam_token');
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    };
  },
  ssr: false, // Disable SSR for now, can enable later
});

// Type assertion to bypass type checking issues during build
// This is a temporary workaround until the backend types are properly resolved
export const trpc = _trpc as any;

