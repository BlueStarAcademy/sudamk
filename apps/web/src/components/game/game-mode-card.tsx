/**
 * Game mode card component
 * 게임 모드 카드 컴포넌트
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '../../lib/trpc/utils';
import { GameMode, type GameModeConfig } from '@sudam/game-logic';

interface GameModeCardProps {
  config: GameModeConfig;
  onSelect?: (mode: string) => void;
}

export function GameModeCard({ config, onSelect }: GameModeCardProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  
  const createGameMutation = trpc.game.create.useMutation({
    onSuccess: (data: { id: string; status: string; mode: string }) => {
      router.push(`/game/${data.id}`);
    },
    onError: () => {
      setIsCreating(false);
    },
  });

  // Convert GameMode enum to API-compatible string
  const getModeValue = (modeEnum: GameMode): string => {
    const modeMap: Record<GameMode, string> = {
      [GameMode.Standard]: 'standard',
      [GameMode.Capture]: 'capture',
      [GameMode.Speed]: 'speed',
      [GameMode.Base]: 'base',
      [GameMode.Hidden]: 'hidden',
      [GameMode.Missile]: 'missile',
      [GameMode.Mix]: 'mix',
      [GameMode.Dice]: 'dice',
      [GameMode.Omok]: 'omok',
      [GameMode.Ttamok]: 'ttamok',
      [GameMode.Thief]: 'thief',
      [GameMode.Alkkagi]: 'alkkagi',
      [GameMode.Curling]: 'curling',
    };
    return modeMap[modeEnum] || 'standard';
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(getModeValue(config.mode));
      return;
    }

    setIsCreating(true);
    const modeValue = getModeValue(config.mode);
    const boardSize = config.mode === GameMode.Omok || config.mode === GameMode.Ttamok ? 15 : 19;
    
    createGameMutation.mutate({
      mode: modeValue,
      boardSize,
    });
  };

  const getCategoryColor = () => {
    switch (config.category) {
      case 'strategic':
        return 'border-blue-500 bg-blue-50 hover:bg-blue-100';
      case 'playful':
        return 'border-purple-500 bg-purple-50 hover:bg-purple-100';
      case 'special':
        return 'border-orange-500 bg-orange-50 hover:bg-orange-100';
      default:
        return 'border-gray-500 bg-gray-50 hover:bg-gray-100';
    }
  };

  const getCategoryBadge = () => {
    switch (config.category) {
      case 'strategic':
        return { text: '전략', color: 'bg-blue-600 text-white' };
      case 'playful':
        return { text: '재미', color: 'bg-purple-600 text-white' };
      case 'special':
        return { text: '특수', color: 'bg-orange-600 text-white' };
      default:
        return { text: '기타', color: 'bg-gray-600 text-white' };
    }
  };

  const badge = getCategoryBadge();

  return (
    <div
      onClick={handleClick}
      className={`
        relative border-2 rounded-lg p-6 cursor-pointer transition-all
        transform hover:scale-105 hover:shadow-lg
        ${getCategoryColor()}
        ${isCreating || createGameMutation.isPending ? 'opacity-50 cursor-wait' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-bold text-gray-900">{config.name}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
          {badge.text}
        </span>
      </div>
      
      <p className="text-sm text-gray-700 mb-4 line-clamp-2">
        {config.description}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {isCreating || createGameMutation.isPending ? '게임 생성 중...' : '클릭하여 시작'}
        </span>
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>

      {createGameMutation.error && (
        <div className="mt-2 text-xs text-red-600">
          {createGameMutation.error.message}
        </div>
      )}
    </div>
  );
}

