/**
 * Game page
 * 게임 플레이 페이지
 */

'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { trpc } from '../../../lib/trpc/utils';
import { GoBoard } from '../../../components/game/go-board';
import { GameInfo } from '../../../components/game/game-info';
import { AuthGuard } from '../../../components/auth/auth-guard';
import { useWebSocket } from '../../../hooks/use-websocket';
import { useGameStore } from '../../../stores/game-store';

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  
  // Game store
  const {
    currentGame,
    boardState,
    currentPlayer,
    captures,
    moveHistory,
    isWebSocketConnected,
    setCurrentGame,
    setCurrentGameId,
    setWebSocketConnected,
    updateGame,
  } = useGameStore();
  
  const { data: game, refetch } = trpc.game.getById.useQuery(
    { gameId },
    {
      refetchInterval: 5000, // Fallback polling every 5 seconds
      enabled: !!gameId,
    }
  );

  // Update store when game data changes
  useEffect(() => {
    if (game) {
      setCurrentGame(game);
      setCurrentGameId(gameId);
    }
  }, [game, gameId, setCurrentGame, setCurrentGameId]);

  // WebSocket for real-time updates
  const { send } = useWebSocket({
    url: `/ws`,
    enabled: !!gameId,
    onMessage: (data) => {
      if (data.type === 'GAME_UPDATE' && data.payload && data.payload[gameId]) {
        const updatedGame = data.payload[gameId];
        updateGame(gameId, updatedGame);
        refetch();
      }
    },
    onOpen: () => {
      setWebSocketConnected(true);
      // Subscribe to game updates
      if (gameId) {
        send({ type: 'subscribe_game', gameId });
      }
    },
    onClose: () => {
      setWebSocketConnected(false);
      // Unsubscribe from game updates
      if (gameId) {
        send({ type: 'unsubscribe_game', gameId });
      }
    },
  });
  
  const makeMoveMutation = trpc.gameAction.makeMove.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const passMutation = trpc.gameAction.pass.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const resignMutation = trpc.gameAction.resign.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleMove = (x: number, y: number) => {
    if (!currentGame) return;
    makeMoveMutation.mutate({ gameId: currentGame.id, x, y });
  };

  if (!currentGame || !boardState) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-8">
          <p>게임을 불러오는 중...</p>
        </div>
      </AuthGuard>
    );
  }

  const gameData = currentGame.data as any;
  const boardSize = gameData.settings?.boardSize || 19;
  const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;

  return (
    <AuthGuard>
      <div className="container mx-auto p-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">게임 #{currentGame.id.slice(0, 8)}</h1>
              <p className="text-sm text-gray-500">
                모드: {currentGame.category || 'Standard'}
              </p>
              <p className={`text-xs mt-1 ${isWebSocketConnected ? 'text-green-600' : 'text-gray-400'}`}>
                {isWebSocketConnected ? '● 실시간 연결됨' : '○ 폴링 모드'}
              </p>
            </div>

            <GoBoard
              boardSize={boardSize}
              boardState={boardState}
              currentPlayer={currentPlayer}
              onMove={handleMove}
              disabled={makeMoveMutation.isPending || currentGame.isEnded}
              lastMove={lastMove}
            />

            <div className="flex gap-4">
              <button
                onClick={() => {
                  passMutation.mutate({ gameId: currentGame.id });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                disabled={makeMoveMutation.isPending || passMutation.isPending || currentGame.isEnded}
              >
                패스
              </button>
              <button
                onClick={() => {
                  resignMutation.mutate({ gameId: currentGame.id });
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                disabled={makeMoveMutation.isPending || resignMutation.isPending || currentGame.isEnded}
              >
                기권
              </button>
            </div>
          </div>

          <div className="w-full lg:w-64">
            <GameInfo
              currentPlayer={currentPlayer}
              captures={captures}
              moveCount={moveHistory.length}
              gameStatus={currentGame.status}
            />
          </div>
        </div>

        {currentGame.isEnded && (
          <div className="mt-8 text-center">
            <p className="text-lg font-semibold">게임 종료</p>
            {gameData.winner && (
              <p>승자: {gameData.winner === 1 ? '흑' : '백'}</p>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

