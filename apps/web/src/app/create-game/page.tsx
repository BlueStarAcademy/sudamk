/**
 * Create game page
 * 게임 생성 페이지
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '../../lib/trpc/utils';
import { AuthGuard } from '../../components/auth/auth-guard';

export default function CreateGamePage() {
  const router = useRouter();
  const [mode, setMode] = useState('standard');
  const [boardSize, setBoardSize] = useState(19);
  const [player2Id, setPlayer2Id] = useState('');

  const createGameMutation = trpc.game.create.useMutation({
    onSuccess: (data) => {
      router.push(`/game/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGameMutation.mutate({
      mode,
      boardSize,
      player2Id: player2Id || undefined,
    });
  };

  return (
    <AuthGuard>
      <div className="container mx-auto p-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">새 게임 만들기</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="mode" className="block text-sm font-medium mb-2">
              게임 모드
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="standard">클래식 바둑</option>
              <option value="capture">따내기 바둑</option>
              <option value="speed">스피드 바둑</option>
              {/* Add more modes as they are implemented */}
            </select>
          </div>

          <div>
            <label htmlFor="boardSize" className="block text-sm font-medium mb-2">
              바둑판 크기
            </label>
            <select
              id="boardSize"
              value={boardSize}
              onChange={(e) => setBoardSize(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="9">9x9</option>
              <option value="13">13x13</option>
              <option value="19">19x19</option>
            </select>
          </div>

          <div>
            <label htmlFor="player2Id" className="block text-sm font-medium mb-2">
              상대방 ID (선택사항, 비워두면 매칭 대기)
            </label>
            <input
              id="player2Id"
              type="text"
              value={player2Id}
              onChange={(e) => setPlayer2Id(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="상대방 사용자 ID"
            />
          </div>

          {createGameMutation.error && (
            <div className="text-red-600 text-sm">
              {createGameMutation.error.message}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={createGameMutation.isPending}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createGameMutation.isPending ? '생성 중...' : '게임 생성'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </AuthGuard>
  );
}

