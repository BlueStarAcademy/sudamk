/**
 * Game page
 * 게임 플레이 페이지
 */

'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { trpc } from '../../../lib/trpc/utils';
import { GoBoard } from '../../../components/game/go-board';
import { AuthGuard } from '../../../components/auth/auth-guard';
import type { BoardState } from '@sudam/game-logic';

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  
  const { data: game, refetch } = trpc.game.getById.useQuery(
    { gameId },
    {
      refetchInterval: 2000, // Poll every 2 seconds
    }
  );
  
  const makeMoveMutation = trpc.gameAction.makeMove.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);

  useEffect(() => {
    if (game?.data) {
      const gameData = game.data as any;
      if (gameData.boardState) {
        setBoardState(gameData.boardState);
      }
      if (gameData.currentPlayer) {
        setCurrentPlayer(gameData.currentPlayer);
      }
    }
  }, [game]);

  const handleMove = (x: number, y: number) => {
    if (!game) return;
    makeMoveMutation.mutate({ gameId: game.id, x, y });
  };

  if (!game || !boardState) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-8">
          <p>게임을 불러오는 중...</p>
        </div>
      </AuthGuard>
    );
  }

  const gameData = game.data as any;
  const boardSize = gameData.settings?.boardSize || 19;

  return (
    <AuthGuard>
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">게임 #{game.id.slice(0, 8)}</h1>
            <p className="text-gray-600">
              현재 차례: {currentPlayer === 1 ? '흑' : '백'}
            </p>
            <p className="text-sm text-gray-500">
              상태: {game.status} | 모드: {game.category || 'Standard'}
            </p>
          </div>

          <GoBoard
            boardSize={boardSize}
            boardState={boardState}
            currentPlayer={currentPlayer}
            onMove={handleMove}
            disabled={makeMoveMutation.isPending || game.isEnded}
            lastMove={
              gameData.moveHistory && gameData.moveHistory.length > 0
                ? gameData.moveHistory[gameData.moveHistory.length - 1]
                : null
            }
          />

          <div className="flex gap-4">
            <button
              onClick={() => {
                // TODO: Implement pass
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              disabled={makeMoveMutation.isPending || game.isEnded}
            >
              패스
            </button>
            <button
              onClick={() => {
                // TODO: Implement resign
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              disabled={makeMoveMutation.isPending || game.isEnded}
            >
              기권
            </button>
          </div>

          {game.isEnded && (
            <div className="text-center">
              <p className="text-lg font-semibold">게임 종료</p>
              {gameData.winner && (
                <p>승자: {gameData.winner === 1 ? '흑' : '백'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

