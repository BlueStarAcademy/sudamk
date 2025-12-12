'use client';

import Link from 'next/link';
import { useAuthStore } from '../stores/auth-store';
import { trpc } from '../lib/trpc/utils';

export default function Home() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { data: me } = trpc.user.me.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">SUDAM v2</h1>
      <p className="mt-4 text-lg">바둑 게임 플랫폼 재작성 프로젝트</p>
      
      {isAuthenticated && me ? (
        <div className="mt-8 space-y-4">
          <p className="text-lg">환영합니다, {me.nickname}님!</p>
          <div className="space-x-4">
            <Link
              href="/lobby"
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              로비로 가기
            </Link>
            <button
              onClick={logout}
              className="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-x-4">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            회원가입
          </Link>
        </div>
      )}
    </main>
  );
}

