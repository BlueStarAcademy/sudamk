import React from 'react';
import TrainingGroundWaitingRoomCta from '../training-ground/TrainingGroundWaitingRoomCta.js';
import { GameMode } from '../../types.js';
import { tx } from '../../shared/i18n/runtimeText.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';

export function formatLobbyAiRecordLine(rec: { wins: number; losses: number }): string {
    const w = Math.max(0, Math.floor(Number(rec.wins) || 0));
    const l = Math.max(0, Math.floor(Number(rec.losses) || 0));
    const g = w + l;
    const pct = g > 0 ? Math.round((w / g) * 100) : 0;
    return tx('lobby:aiChallengeModal.aiRecord', { wins: w, losses: l, winRate: pct });
}

const AiChallengePanel: React.FC<{
    mode: GameMode | 'strategic' | 'playful';
    onOpenModal: () => void;
    noOuterShell?: boolean;
    railLayout?: boolean;
    headingTitle?: string;
    aiRecord?: { wins: number; losses: number };
}> = ({ railLayout = false }) => {
    void PLAYFUL_GAME_MODES;
    void SPECIAL_GAME_MODES;
    return <TrainingGroundWaitingRoomCta compact={railLayout} />;
};

export default AiChallengePanel;
