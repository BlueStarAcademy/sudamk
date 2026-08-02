import React, { useEffect, useState } from 'react';
import PairWaitingLobby from '../../PairWaitingLobby.js';
import type { ArenaChannel, ArenaLobbyIntent } from '../../../shared/types/api.js';
import { parseStrategicMatchQueueFromHash } from '../../../shared/utils/arenaLobbyDestination.js';

export type IntentWaitingArenaProps = {
    lobbyChannel: ArenaChannel;
    lobbyIntent: ArenaLobbyIntent;
};

const IntentWaitingArena: React.FC<IntentWaitingArenaProps> = ({ lobbyChannel, lobbyIntent }) => {
    const [matchQueueKind, setMatchQueueKind] = useState<'ranked' | 'normal'>(() => {
        if (typeof window === 'undefined') return 'ranked';
        return parseStrategicMatchQueueFromHash(window.location.hash) ?? 'ranked';
    });

    useEffect(() => {
        const sync = () => {
            if (lobbyChannel !== 'strategic' || lobbyIntent !== 'pvp') {
                setMatchQueueKind('ranked');
                return;
            }
            setMatchQueueKind(parseStrategicMatchQueueFromHash(window.location.hash) ?? 'ranked');
        };
        sync();
        window.addEventListener('hashchange', sync);
        return () => window.removeEventListener('hashchange', sync);
    }, [lobbyChannel, lobbyIntent]);

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            <PairWaitingLobby
                lobbyChannel={lobbyChannel}
                lobbyIntent={lobbyIntent}
                matchQueueKind={matchQueueKind}
            />
        </div>
    );
};

export default IntentWaitingArena;
