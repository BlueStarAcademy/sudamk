import React from 'react';
import { LiveGameSession, GameProps } from '../../types.js';
import { GameInfoPanel, ChatPanel } from './Sidebar.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';

interface TowerSidebarProps {
    session: LiveGameSession;
    gameChat?: GameProps['gameChat'];
    onAction?: GameProps['onAction'];
    currentUser?: GameProps['currentUser'];
    onClose?: () => void;
    onTogglePause?: () => void;
    isPaused?: boolean;
    resumeCountdown?: number;
    pauseButtonCooldown?: number;
}

const TowerSidebar: React.FC<TowerSidebarProps> = ({
    session,
    gameChat = [],
    onAction,
    currentUser,
    onClose,
    onTogglePause,
    isPaused = false,
    resumeCountdown = 0,
    pauseButtonCooldown = 0
}) => {
    const { activeNegotiation, negotiations, onlineUsers, waitingRoomChats } = useAppContext();
    if (!currentUser) return null;
    const floor = session.towerFloor ?? 1;

    return (
        <div className="flex flex-col h-full gap-1.5 bg-gray-900/80 rounded-lg p-2 border border-color">
            <div className="flex-shrink-0 space-y-2">
                <GameInfoPanel session={session} onClose={onClose} />
                <div className="bg-gray-800/80 rounded-xl border border-stone-700 px-3 py-2">
                    <div className="text-center">
                        <p className="text-sm font-bold text-purple-300">도전의 탑</p>
                        <p className="text-lg font-black text-yellow-300">{floor}층</p>
                    </div>
                </div>
            </div>
            <div className="flex-1 mt-2 min-h-0">
                <ChatPanel 
                    session={session}
                    isSpectator={false}
                    onAction={onAction || (() => {})}
                    waitingRoomChat={waitingRoomChats['global'] || []}
                    gameChat={gameChat}
                    onViewUser={() => {}}
                    onlineUsers={onlineUsers}
                    currentUser={currentUser}
                    activeNegotiation={activeNegotiation}
                    negotiations={Array.isArray(negotiations) ? negotiations : Object.values(negotiations || {})}
                />
            </div>
            <div className="flex-shrink-0 pt-2">
                {onTogglePause && (
                    <Button
                        onClick={onTogglePause}
                        colorScheme={isPaused ? 'green' : 'yellow'}
                        className="w-full"
                        disabled={(isPaused && resumeCountdown > 0) || (!isPaused && pauseButtonCooldown > 0)}
                    >
                        {isPaused
                            ? (resumeCountdown > 0 ? `대국 재개 (${resumeCountdown})` : '대국 재개')
                            : (pauseButtonCooldown > 0 ? `일시 정지 (${pauseButtonCooldown})` : '일시 정지')}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default TowerSidebar;

