/**
 * Go board component
 * 바둑판 컴포넌트
 */

'use client';

import { useState, useCallback } from 'react';
import type { BoardState, Point } from '@sudam/game-logic';

interface GoBoardProps {
  boardSize: number;
  boardState: BoardState;
  currentPlayer: 1 | 2;
  onMove: (x: number, y: number) => void;
  disabled?: boolean;
  lastMove?: Point | null;
}

export function GoBoard({
  boardSize,
  boardState,
  currentPlayer,
  onMove,
  disabled = false,
  lastMove,
}: GoBoardProps) {
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (disabled) return;
      if (boardState[y][x] !== 0) return; // Already occupied
      onMove(x, y);
    },
    [disabled, boardState, onMove]
  );

  const getStoneColor = (player: number): string => {
    if (player === 1) return 'bg-black';
    if (player === 2) return 'bg-white';
    return '';
  };

  const isLastMove = (x: number, y: number): boolean => {
    return lastMove?.x === x && lastMove?.y === y;
  };

  const isHovered = (x: number, y: number): boolean => {
    return hoveredPoint?.x === x && hoveredPoint?.y === y;
  };

  return (
    <div className="inline-block p-4 bg-amber-50 rounded-lg">
      <div
        className="grid gap-0 border-2 border-gray-800"
        style={{
          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
          width: `${boardSize * 40}px`,
          height: `${boardSize * 40}px`,
        }}
      >
        {Array.from({ length: boardSize * boardSize }, (_, i) => {
          const y = Math.floor(i / boardSize);
          const x = i % boardSize;
          const stone = boardState[y][x];
          const hasStone = stone !== 0;

          return (
            <div
              key={`${x}-${y}`}
              className={`
                relative border border-gray-600 bg-amber-100
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-amber-200'}
                ${isLastMove(x, y) ? 'ring-2 ring-blue-500' : ''}
                ${isHovered(x, y) && !hasStone ? 'bg-amber-300' : ''}
              `}
              style={{ width: '40px', height: '40px' }}
              onClick={() => handleCellClick(x, y)}
              onMouseEnter={() => !disabled && !hasStone && setHoveredPoint({ x, y })}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {hasStone && (
                <div
                  className={`
                    absolute inset-0 rounded-full
                    ${getStoneColor(stone)}
                    ${stone === 1 ? 'shadow-lg' : 'shadow-md border border-gray-400'}
                  `}
                  style={{
                    width: '32px',
                    height: '32px',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
              {!hasStone && isHovered(x, y) && (
                <div
                  className={`
                    absolute inset-0 rounded-full opacity-50
                    ${currentPlayer === 1 ? 'bg-black' : 'bg-white border border-gray-400'}
                  `}
                  style={{
                    width: '32px',
                    height: '32px',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

