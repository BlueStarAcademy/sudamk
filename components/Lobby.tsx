
import React, { useState } from 'react';
import { GameMode } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';
import Button from './Button.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface LobbyProps {
  lobbyType: 'strategic' | 'playful';
}

const GameCard: React.FC<{ mode: GameMode, description: string, image: string, available: boolean, onSelect: () => void, hoverColorClass: string }> = ({ mode, description, image, available, onSelect, hoverColorClass }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div
            className={`bg-panel text-on-panel rounded-lg p-5 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${hoverColorClass} ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={available ? onSelect : undefined}
        >
            <div className="w-[200px] h-[150px] mx-auto bg-tertiary rounded-md mb-4 flex items-center justify-center text-tertiary overflow-hidden shadow-inner">
                {!imgError ? (
                    <img 
                        src={image} 
                        alt={mode} 
                        className="w-full h-full object-cover" 
                        onError={() => setImgError(true)} 
                    />
                ) : (
                    <span className="text-xs">{mode}</span>
                )}
            </div>
            <div className="flex-grow flex flex-col">
                <h3 className="text-xl font-bold text-primary mb-2">{mode}</h3>
                <p className="text-tertiary text-sm flex-grow">{description}</p>
            </div>
        </div>
    );
};

const Lobby: React.FC<LobbyProps> = ({ lobbyType }) => {
  const { gameModeAvailability, handlers } = useAppContext();
  const { isNativeMobile } = useNativeMobileShell();

  const isStrategic = lobbyType === 'strategic';
  const title = isStrategic ? '전략 게임' : '놀이 게임';
  const modes = isStrategic ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
  const sectionTitle = isStrategic ? '전략 게임' : '놀이 게임';
  const sectionBorderColor = isStrategic ? 'border-blue-400' : 'border-yellow-400';
  const hoverColorClass = isStrategic ? 'hover:shadow-blue-500/20' : 'hover:shadow-yellow-500/20';

  const onBackToProfile = () => window.location.hash = '#/profile';

  const lobbyHeader = (
    <header
      className={`relative flex shrink-0 flex-wrap items-center justify-between gap-4 ${isNativeMobile ? 'mb-1 gap-2' : 'mb-6 gap-4'}`}
    >
      <button
        onClick={onBackToProfile}
        className={`relative z-20 flex items-center justify-center rounded-full p-0 transition-all duration-100 active:scale-95 active:shadow-inner active:translate-y-0.5 pointer-events-auto ${isNativeMobile ? 'h-8 w-8' : 'h-10 w-10'}`}
      >
        <img src="/images/button/back.png" alt="Back" className={isNativeMobile ? 'h-8 w-8' : 'h-10 w-10 sm:h-12 sm:w-12'} />
      </button>
      <div className="min-w-0 flex-grow text-center">
        <h1 className={`font-bold ${isNativeMobile ? 'text-sm' : 'text-2xl sm:text-4xl'}`}>{title} 로비</h1>
        <p className={`text-secondary ${isNativeMobile ? 'mt-0.5 text-[10px]' : 'mt-2 text-sm sm:text-base'}`}>플레이할 게임을 선택하세요.</p>
      </div>
      <div className={isNativeMobile ? 'w-8 shrink-0' : 'w-10 shrink-0 sm:w-24'} />
    </header>
  );

  const modeGrid = (
    <section className="min-h-0">
      <h2
        className={`font-semibold border-l-4 ${sectionBorderColor} ${isNativeMobile ? 'mb-1 border-l-2 pl-2 text-xs' : 'mb-4 pl-4 text-xl sm:text-2xl'}`}
      >
        {sectionTitle}
      </h2>
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${isNativeMobile ? 'gap-2' : 'gap-4 sm:gap-6'}`}
      >
        {modes.map(game => (
          <GameCard key={game.mode} {...game} available={gameModeAvailability[game.mode] ?? game.available} onSelect={() => handlers.handleEnterWaitingRoom(game.mode)} hoverColorClass={hoverColorClass} />
        ))}
      </div>
    </section>
  );

  if (isNativeMobile) {
    return (
      <div className="sudamr-native-route-root flex w-full flex-col bg-primary p-1 text-primary">
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
          <div className="shrink-0 px-0.5">{lobbyHeader}</div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0.5 pb-1 [&_.grid]:grid-cols-1 [&_h2]:!text-sm [&_h3]:!text-xs [&_p]:!text-[11px]">
            {modeGrid}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary text-primary p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {lobbyHeader}
      <main>{modeGrid}</main>
    </div>
  );
};

export default Lobby;
