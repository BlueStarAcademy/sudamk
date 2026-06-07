import React from 'react';
import IntentWaitingArena from './IntentWaitingArena.js';

/** @deprecated Use `#/pvp/pair` via Router → IntentWaitingArena */
const PairWaitingArena: React.FC = () => (
    <IntentWaitingArena lobbyChannel="pair" lobbyIntent="pvp" />
);

export default PairWaitingArena;
