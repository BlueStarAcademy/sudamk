/**
 * Profile page
 * 프로필 페이지 (닉네임 변경 불가)
 */

'use client';

import { trpc } from '../../lib/trpc/utils';
import { AuthGuard } from '../../components/auth/auth-guard';

export default function ProfilePage() {
  const { data: user, refetch } = trpc.user.me.useQuery();
  void refetch; // keep existing behavior (query caches), refetch may be used later

  if (!user) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-8">
          <p>로딩 중...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto p-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">프로필</h1>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              닉네임
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg">{user.nickname}</span>
              <span className="text-xs rounded bg-gray-100 px-2 py-1 text-gray-600">
                변경 불가
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              닉네임은 최초 1회 설정되며 이후 변경할 수 없습니다.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사용자명
            </label>
            <p className="text-lg text-gray-600">{user.username || 'N/A'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <p className="text-lg text-gray-600">{user.email || 'N/A'}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전략 레벨
              </label>
              <p className="text-2xl font-bold">{user.strategyLevel}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                재미 레벨
              </label>
              <p className="text-2xl font-bold">{user.playfulLevel}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                골드
              </label>
              <p className="text-lg font-semibold">{user.gold}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                다이아
              </label>
              <p className="text-lg font-semibold">{user.diamonds}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                리그
              </label>
              <p className="text-lg">{user.league || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                토너먼트 점수
              </label>
              <p className="text-lg">{user.tournamentScore}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                도전의 탑 층수
              </label>
              <p className="text-lg">{user.towerFloor}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                액션 포인트
              </label>
              <p className="text-lg">
                {user.actionPointCurr} / {user.actionPointMax}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

