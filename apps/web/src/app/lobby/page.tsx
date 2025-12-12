/**
 * Lobby page
 */

'use client';

import { useAuthStore } from '../../stores/auth-store';
import { trpc } from '../../lib/trpc/utils';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LobbyPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const { data: games } = trpc.game.getActive.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">로비</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games?.map((game) => (
          <div
            key={game.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">게임 #{game.id.slice(0, 8)}</h2>
            <p className="text-sm text-gray-600">모드: {game.category || 'Standard'}</p>
            <p className="text-sm text-gray-600">상태: {game.status}</p>
          </div>
        ))}
      </div>
      
      {games && games.length === 0 && (
        <p className="text-center text-gray-500 mt-8">활성 게임이 없습니다.</p>
      )}
    </div>
  );
}

