/**
 * Header component
 */

'use client';

import Link from 'next/link';
import { useAuthStore } from '../../stores/auth-store';

export function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          SUDAM
        </Link>
        
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-gray-600">
                {user?.nickname}
              </span>
              <Link
                href="/lobby"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                로비
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="text-sm text-green-600 hover:text-green-700"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

