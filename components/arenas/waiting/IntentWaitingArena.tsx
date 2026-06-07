import React from 'react';
import PairWaitingLobby from '../../PairWaitingLobby.js';
import type { ArenaChannel, ArenaLobbyIntent } from '../../../shared/types/api.js';

export type IntentWaitingArenaProps = {
    lobbyChannel: ArenaChannel;
    lobbyIntent: ArenaLobbyIntent;
};

const IntentWaitingArena: React.FC<IntentWaitingArenaProps> = ({ lobbyChannel, lobbyIntent }) => (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <PairWaitingLobby lobbyChannel={lobbyChannel} lobbyIntent={lobbyIntent} />
    </div>
);

export default IntentWaitingArena;
