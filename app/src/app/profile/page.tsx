/**
 * Profile page
 * 프로필 페이지
 */

'use client';

import { trpc } from '../../lib/trpc/utils';
import { AuthGuard } from '../../components/auth/auth-guard';
import { useState } from 'react';

export default function ProfilePage() {
  const { data: user, refetch } = trpc.user.me.useQuery();
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState('');

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditing(false);
    },
  });

  if (!user) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-8">
          <p>로딩 중...</p>
        </div>
      </AuthGuard>
    );
  }

  const handleSave = () => {
    updateProfileMutation.mutate({
      nickname: nickname || undefined,
    });
  };

  return (
    <AuthGuard>
      <div className="container mx-auto p-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">프로필</h1>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              닉네임
            </label>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nickname || user.nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2"
                />
                <button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setNickname('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg">{user.nickname}</span>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setNickname(user.nickname);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  수정
                </button>
              </div>
            )}
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

