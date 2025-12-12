/**
 * Lobby page
 */

'use client';

import Link from 'next/link';
import { trpc } from '../../lib/trpc/utils';
import { AuthGuard } from '../../components/auth/auth-guard';
import { GameList } from '../../components/game/game-list';
import { QuickMatch } from '../../components/game/quick-match';
import { LoadingSpinner } from '../../components/common/loading-spinner';
import { ErrorMessage } from '../../components/common/error-message';

export default function LobbyPage() {
  const { data: games, isLoading, error, refetch } = trpc.game.getActive.useQuery();

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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <QuickMatch />
          </div>
          <div className="lg:col-span-1">
            {/* Stats or other info can go here */}
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">진행 중인 게임</h2>
            <GameList filter="active" limit={10} />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">대기 중인 게임</h2>
            <GameList filter="pending" limit={10} />
          </div>
        </div>
        
        {games && games.length === 0 && (
          <p className="text-center text-gray-500 mt-8">활성 게임이 없습니다.</p>
        )}
      </div>
    </AuthGuard>
  );
}

