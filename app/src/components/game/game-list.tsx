/**
 * Game list component
 * 게임 목록 컴포넌트
 */

'use client';

import Link from 'next/link';
import { trpc } from '../../lib/trpc/utils';
import { LoadingSpinner } from '../common/loading-spinner';
import { EmptyState } from '../common/empty-state';

interface GameListProps {
  filter?: 'active' | 'pending' | 'ended';
  limit?: number;
}

export function GameList({ filter, limit = 20 }: GameListProps) {
  const { data: games, isLoading } = trpc.game.getActive.useQuery();

  if (isLoading) {
    return <LoadingSpinner size="md" className="py-8" />;
  }

  if (!games || games.length === 0) {
    return (
      <EmptyState
        title="게임이 없습니다"
        description="새 게임을 만들어보세요!"
      />
    );
  }

  const filteredGames = games.filter((game) => {
    if (!filter) return true;
    return game.status === filter;
  }).slice(0, limit);

  return (
    <div className="space-y-2">
      {filteredGames.map((game) => (
        <Link
          key={game.id}
          href={`/game/${game.id}`}
          className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">게임 #{game.id.slice(0, 8)}</h3>
              <p className="text-sm text-gray-600">
                모드: {game.category || 'Standard'} | 상태: {game.status}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  game.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : game.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {game.status === 'active'
                  ? '진행 중'
                  : game.status === 'pending'
                  ? '대기 중'
                  : '종료'}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

