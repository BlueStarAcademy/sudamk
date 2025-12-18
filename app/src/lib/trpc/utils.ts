/**
 * tRPC utilities for Next.js 14 App Router
 */

import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/trpc/router';
import superjson from 'superjson';

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Helper function to get base URL
export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }
  
  // SSR should use full URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Development SSR should use localhost
  return process.env.NEXT_PUBLIC_API_URL || `http://localhost:3000`;
}

// Create tRPC client configuration
export function getTRPCClientConfig() {
  return {
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        // Optional: Add headers for authentication
        headers() {
          if (typeof window === 'undefined') return {};
          const token = localStorage.getItem('sudam_token');
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  };
}

