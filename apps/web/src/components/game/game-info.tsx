/**
 * Game info component
 * 게임 정보 표시 컴포넌트
 */

'use client';

interface GameInfoProps {
  currentPlayer: 1 | 2;
  captures: { [key: number]: number };
  moveCount: number;
  gameStatus: string;
}

export function GameInfo({
  currentPlayer,
  captures,
  moveCount,
  gameStatus,
}: GameInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-600">현재 차례</span>
        <span className={`text-lg font-bold ${currentPlayer === 1 ? 'text-black' : 'text-gray-600'}`}>
          {currentPlayer === 1 ? '흑' : '백'}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-600">흑 포착</span>
        <span className="text-lg font-semibold">{captures[1] || 0}</span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-600">백 포착</span>
        <span className="text-lg font-semibold">{captures[2] || 0}</span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-600">총 수</span>
        <span className="text-lg font-semibold">{moveCount}</span>
      </div>
      
      <div className="flex justify-between items-center pt-2 border-t">
        <span className="text-sm font-medium text-gray-600">상태</span>
        <span className={`text-sm font-semibold ${
          gameStatus === 'ended' ? 'text-red-600' :
          gameStatus === 'active' ? 'text-green-600' :
          'text-gray-600'
        }`}>
          {gameStatus === 'ended' ? '종료' :
           gameStatus === 'active' ? '진행 중' :
           gameStatus === 'pending' ? '대기 중' :
           gameStatus}
        </span>
      </div>
    </div>
  );
}

