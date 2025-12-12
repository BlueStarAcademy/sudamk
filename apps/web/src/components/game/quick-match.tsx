/**
 * Quick match component
 * 빠른 매칭 컴포넌트
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '../../lib/trpc/utils';

export function QuickMatch() {
  const router = useRouter();
  const [mode, setMode] = useState('standard');
  const [boardSize, setBoardSize] = useState(19);

  const createGameMutation = trpc.game.create.useMutation({
    onSuccess: (data) => {
      router.push(`/game/${data.id}`);
    },
  });

  const handleQuickMatch = () => {
    createGameMutation.mutate({
      mode,
      boardSize,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">빠른 매칭</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">게임 모드</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="standard">클래식 바둑</option>
            <option value="capture">따내기 바둑</option>
            <option value="speed">스피드 바둑</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">바둑판 크기</label>
          <select
            value={boardSize}
            onChange={(e) => setBoardSize(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="9">9x9</option>
            <option value="13">13x13</option>
            <option value="19">19x19</option>
          </select>
        </div>

        <button
          onClick={handleQuickMatch}
          disabled={createGameMutation.isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createGameMutation.isPending ? '매칭 중...' : '빠른 매칭 시작'}
        </button>

        {createGameMutation.error && (
          <div className="text-red-600 text-sm">
            {createGameMutation.error.message}
          </div>
        )}
      </div>
    </div>
  );
}

