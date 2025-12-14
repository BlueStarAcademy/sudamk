/**
 * Admin panel page
 * 관리자 패널 페이지
 */

'use client';

import { trpc } from '../../lib/trpc/utils';
import { AuthGuard } from '../../components/auth/auth-guard';
import { LoadingSpinner } from '../../components/common/loading-spinner';
import { ErrorMessage } from '../../components/common/error-message';
import { useState } from 'react';

export default function AdminPage() {
  // @ts-ignore - Temporary fix for type inference issue
  const { data: user } = (trpc as any).user.me.useQuery();
  const [activeTab, setActiveTab] = useState<'users' | 'games' | 'system'>('users');

  // Check if user is admin
  if (!user?.isAdmin) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">접근 권한 없음</h1>
            <p className="text-gray-600">이 페이지는 관리자만 접근할 수 있습니다.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">관리자 패널</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'users'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            사용자 관리
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'games'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            게임 관리
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'system'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            시스템 정보
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'games' && <GamesTab />}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </AuthGuard>
  );
}

function UsersTab() {
  const [searchTerm, setSearchTerm] = useState('');
  // @ts-ignore - Temporary fix for type inference issue
  const { data: usersData, isLoading, error, refetch } = (trpc as any).admin.getUsers.useQuery({
    search: searchTerm || undefined,
    skip: 0,
    take: 50,
  });

  const users = usersData?.users || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="사용자 검색 (닉네임, 이메일)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2"
        />
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          검색
        </button>
      </div>

      {isLoading && <LoadingSpinner size="md" className="py-8" />}
      {error && <ErrorMessage error={error} onRetry={() => refetch()} />}

      {users && users.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  닉네임
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  레벨
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  골드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.nickname}
                    {user.isAdmin && (
                      <span className="ml-2 text-xs text-red-600">(관리자)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.strategyLevel}/{user.playfulLevel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.gold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isAdmin
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {user.isAdmin ? '관리자' : '일반'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-4">
                      수정
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          사용자를 찾을 수 없습니다.
        </div>
      )}
    </div>
  );
}

function GamesTab() {
  // @ts-ignore - Temporary fix for type inference issue
  const { data: games, isLoading, error } = (trpc as any).game.getActive.useQuery();

  return (
    <div className="space-y-4">
      {isLoading && <LoadingSpinner size="md" className="py-8" />}
      {error && <ErrorMessage error={error} />}

      {games && games.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  게임 ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  모드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {games.map((game) => (
                <tr key={game.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {game.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {game.category || 'Standard'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        game.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : game.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {game.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(game.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-4">
                      보기
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      종료
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          게임이 없습니다.
        </div>
      )}
    </div>
  );
}

function SystemTab() {
  // @ts-ignore - health endpoint exists but type inference fails
  const { data: health } = (trpc as any).health.useQuery();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">시스템 상태</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <p className="text-lg font-semibold text-green-600">
              {health?.status === 'ok' ? '정상' : '오류'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              업타임
            </label>
            <p className="text-lg">
              {health?.uptime ? `${Math.floor(health.uptime / 60)}분` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">데이터베이스</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">연결 상태</span>
            <span className="text-sm font-semibold text-green-600">연결됨</span>
          </div>
          {/* Add more DB stats here */}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">시스템 작업</h2>
        <div className="space-y-2">
          <button className="w-full text-left px-4 py-2 border border-gray-200 rounded hover:bg-gray-50">
            캐시 정리
          </button>
          <button className="w-full text-left px-4 py-2 border border-gray-200 rounded hover:bg-gray-50">
            데이터베이스 백업
          </button>
          <button className="w-full text-left px-4 py-2 border border-gray-200 rounded hover:bg-gray-50">
            로그 보기
          </button>
        </div>
      </div>
    </div>
  );
}

