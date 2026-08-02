import React from 'react';
import IntentWaitingArena from './IntentWaitingArena.js';

/** @deprecated Use `#/pvp/friendly` via Router → IntentWaitingArena */
const PairWaitingArena: React.FC = () => (
    <IntentWaitingArena lobbyChannel="pair" lobbyIntent="pvp" />
);

export default PairWaitingArena;
