'use client';

import Link from 'next/link';
import { useAuthStore } from '../stores/auth-store';
import { trpc } from '../lib/trpc/utils';
import { NicknameSetupModal } from '../components/auth/nickname-setup-modal';

export default function Home() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { data: me } = trpc.user.me.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const needsNickname = isAuthenticated && !!me && !me.nickname;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <NicknameSetupModal open={needsNickname} />
      <h1 className="text-4xl font-bold">SUDAM v2</h1>
      <p className="mt-4 text-lg">바둑 게임 플랫폼 재작성 프로젝트</p>
      
      {isAuthenticated && me ? (
        <div className="mt-8 space-y-4">
          <p className="text-lg">
            {me.nickname ? `환영합니다, ${me.nickname}님!` : '닉네임 설정이 필요합니다.'}
          </p>
          <div className="space-x-4">
            <Link
              href="/lobby"
              aria-disabled={needsNickname}
              tabIndex={needsNickname ? -1 : 0}
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

