import type { Player } from './enums.js';
import type { Point } from './enums.js';
import type { GameSummary, LiveGameSession } from './entities.js';

export type UnifiedResultRewardModel = 'pvpSummary' | 'pveSummary' | 'pairSummary' | 'championshipSummary';
export type UnifiedResultDisplayModel = 'instantEnd' | 'waitSummary' | 'waitScoringOverlay';

export type UnifiedResultContract = {
    source: 'liveSession' | 'championship';
    gameId: string;
    status: 'scoring' | 'ended' | 'no_contest' | 'finished';
    winner: Player | string | null;
    winReason?: string;
    finalScores?: LiveGameSession['finalScores'] | { black: number; white: number; scoreLead: number } | null;
    analysisResult?: LiveGameSession['analysisResult'];
    summaryByUserId?: Record<string, GameSummary>;
    rewardModel: UnifiedResultRewardModel;
    displayModel: UnifiedResultDisplayModel;
    postActions?: Array<'close' | 'leave' | 'rematch' | 'leave_to_map' | 'next_match'>;
    metadata?: {
        isPairGame?: boolean;
        rankAffected?: boolean;
        highlightedPoints?: Point[];
    };
};

