/**
 * Lobby page
 */

'use client';

import Link from 'next/link';
import { trpc } from '../../lib/trpc/utils';
import { AuthGuard } from '../../components/auth/auth-guard';

export default function LobbyPage() {
  const { data: games } = trpc.game.getActive.useQuery();

  return (
    <AuthGuard>
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">로비</h1>
          <Link
            href="/create-game"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            새 게임 만들기
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games?.map((game) => (
            <Link
              key={game.id}
              href={`/game/${game.id}`}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow block"
            >
              <h2 className="text-xl font-semibold mb-2">게임 #{game.id.slice(0, 8)}</h2>
              <p className="text-sm text-gray-600">모드: {game.category || 'Standard'}</p>
              <p className="text-sm text-gray-600">상태: {game.status}</p>
            </Link>
          ))}
        </div>
        
        {games && games.length === 0 && (
          <p className="text-center text-gray-500 mt-8">활성 게임이 없습니다.</p>
        )}
      </div>
    </AuthGuard>
  );
}

