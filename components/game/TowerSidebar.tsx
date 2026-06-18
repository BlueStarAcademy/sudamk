import React from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { LiveGameSession, GameProps } from '../../types.js';
import { GameInfoPanel, ChatPanel } from './Sidebar.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { mergeWaitingRoomPublicChatMessages } from '../../shared/utils/waitingRoomGlobalChatMerge.js';

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
    const publicChatMessages = React.useMemo(
        () => mergeWaitingRoomPublicChatMessages(waitingRoomChats),
        [waitingRoomChats],
    );
    if (!currentUser) return null;
    const floor = session.towerFloor ?? 1;

    return (
        <div className="flex min-h-0 flex-1 flex-col h-full gap-1.5 bg-gray-900/80 rounded-lg p-2 border border-color">
            <div className="flex-shrink-0 space-y-2">
                <GameInfoPanel session={session} currentUser={currentUser} onClose={onClose} onAction={onAction} />
                <div className="bg-gray-800/80 rounded-xl border border-stone-700 px-3 py-2">
                    <div className="text-center">
                        <p className="text-sm font-bold text-purple-300">{tx("game:towerSidebar.title")}</p>
                        <p className="text-lg font-black text-yellow-300">{tx("game:towerSidebar.floor", { floor })}</p>
                    </div>
                </div>
            </div>
            <div className="flex-1 mt-2 min-h-0">
                <ChatPanel 
                    session={session}
                    isSpectator={false}
                    onAction={onAction || (() => {})}
                    waitingRoomChat={publicChatMessages}
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
                            ? (resumeCountdown > 0 ? tx("game:controls.resumeGameCountdown", { count: resumeCountdown }) : tx("game:controls.resumeGame"))
                            : (pauseButtonCooldown > 0 ? tx("game:controls.pauseGameCountdown", { count: pauseButtonCooldown }) : tx("game:controls.pauseGame"))}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default TowerSidebar;

