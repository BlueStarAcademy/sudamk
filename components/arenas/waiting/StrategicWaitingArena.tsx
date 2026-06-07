import React from 'react';
import IntentWaitingArena from './IntentWaitingArena.js';

/** @deprecated Use `#/pvp/strategic` via Router → IntentWaitingArena */
const StrategicWaitingArena: React.FC = () => (
    <IntentWaitingArena lobbyChannel="strategic" lobbyIntent="pvp" />
);

export default StrategicWaitingArena;
