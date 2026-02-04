/**
 * Auth guard component
 * Protects routes that require authentication
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../../stores/auth-store';
import { trpc } from '../../lib/trpc/utils';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialize, setUser, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const { data: me } = trpc.user.me.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (me) {
      setUser({
        id: me.id,
        nickname: me.nickname,
        username: me.username ?? undefined,
        email: me.email ?? undefined,
        isAdmin: me.isAdmin,
      });
    }
  }, [me, setUser]);

  useEffect(() => {
    // Force nickname setup before using other authenticated pages.
    const needsNickname = isAuthenticated && (me?.nickname === null || user?.nickname === null);
    if (needsNickname && pathname !== '/') {
      router.push('/');
    }
  }, [isAuthenticated, me?.nickname, pathname, router, user?.nickname]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

