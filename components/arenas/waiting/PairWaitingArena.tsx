import React from 'react';
import PairWaitingLobby from '../../PairWaitingLobby.js';

const PairWaitingArena: React.FC = () => (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <PairWaitingLobby lobbyChannel="pair" />
    </div>
);

export default PairWaitingArena;
