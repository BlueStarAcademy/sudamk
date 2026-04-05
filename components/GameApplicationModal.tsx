import React, { useState, useMemo } from 'react';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';
import Button from './Button.js';
import { useAppContext } from '../hooks/useAppContext.js';
import DraggableWindow from './DraggableWindow.js';

interface GameApplicationModalProps {
  onClose: () => void;
}

const PANEL_W = 896;
const PANEL_H = 740;

const GameApplicationModal: React.FC<GameApplicationModalProps> = ({ onClose }) => {
  const { handlers } = useAppContext();

  const allGameModes = useMemo(() => {
    return [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES];
  }, []);

  const [selectedGameMode, setSelectedGameMode] = useState(allGameModes[0] || null);

  const handleApplyForGame = () => {
    if (selectedGameMode) {
      handlers.handleEnterWaitingRoom(selectedGameMode.mode);
      onClose();
    }
  };

  return (
    <DraggableWindow
      title="게임 신청"
      windowId="game-application"
      onClose={onClose}
      initialWidth={PANEL_W}
      initialHeight={PANEL_H}
      uniformPcScale
      bodyScrollable
      hideFooter
    >
      <div className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex min-h-0 flex-1 gap-6">
          <div className="w-1/3 min-w-0 flex flex-col rounded-lg bg-gray-800 p-4 shadow-inner">
            <h3 className="mb-4 border-b border-gray-600 pb-3 text-2xl font-semibold">게임 종류</h3>
            <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto">
              {allGameModes.map((game) => (
                <button
                  key={game.mode}
                  onClick={() => setSelectedGameMode(game)}
                  className={`rounded-md p-3.5 text-left text-base font-medium transition-colors duration-200
                              ${selectedGameMode?.mode === game.mode ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                >
                  {game.mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex w-2/3 min-w-0 flex-col justify-between rounded-lg bg-gray-800 p-6 shadow-inner">
            {selectedGameMode ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="mb-4 text-3xl font-bold text-primary">{selectedGameMode.mode} 신청</h3>
                <div className="mb-4 flex items-center">
                  <img src={selectedGameMode.image} alt={selectedGameMode.mode} className="mr-4 h-24 w-24 rounded-md object-cover" />
                  <p className="text-xl leading-snug text-gray-300">{selectedGameMode.description}</p>
                </div>
                <div className="mt-4 text-lg text-gray-400">
                  <p>여기에 {selectedGameMode.mode} 게임에 대한 추가 설정 옵션이 들어갑니다.</p>
                </div>
              </div>
            ) : (
              <p className="mt-20 text-center text-2xl text-gray-400">게임을 선택해주세요.</p>
            )}
            <div className="mt-6 flex-shrink-0">
              <Button onClick={handleApplyForGame} className="w-full py-3.5 text-xl font-semibold" disabled={!selectedGameMode}>
                게임 신청
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default GameApplicationModal;
