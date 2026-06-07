import React from 'react';
import IntentWaitingArena from './IntentWaitingArena.js';

/** @deprecated Use `#/pvp/playful` via Router → IntentWaitingArena */
const PlayfulWaitingArena: React.FC = () => (
    <IntentWaitingArena lobbyChannel="playful" lobbyIntent="pvp" />
);

export default PlayfulWaitingArena;
