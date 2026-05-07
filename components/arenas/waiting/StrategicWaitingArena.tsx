import React from 'react';
import PairWaitingLobby from '../../PairWaitingLobby.js';

const StrategicWaitingArena: React.FC = () => (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <PairWaitingLobby lobbyChannel="strategic" />
    </div>
);

export default StrategicWaitingArena;
