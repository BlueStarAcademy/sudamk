import type { ChampionshipRealGameState, LiveGameSession, UnifiedResultContract } from '../../shared/types/index.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

export function buildLiveSessionResultContract(game: LiveGameSession): UnifiedResultContract {
    const policy = resolveArenaSessionPolicy(game);
    return {
        source: 'liveSession',
        gameId: game.id,
        status: game.gameStatus === 'no_contest' ? 'no_contest' : game.gameStatus === 'scoring' ? 'scoring' : 'ended',
        winner: game.winner ?? null,
        winReason: game.winReason ?? undefined,
        finalScores: game.finalScores ?? null,
        analysisResult: game.analysisResult ?? undefined,
        summaryByUserId: game.summary ?? undefined,
        rewardModel: policy.resultRewardModel,
        displayModel: policy.resultDisplayModel,
        postActions: policy.kind === 'adventure' ? ['close', 'leave_to_map'] : ['close', 'leave', 'rematch'],
        metadata: {
            isPairGame: policy.isPairGame,
            rankAffected: Boolean(game.isRankedGame),
        },
    };
}

export function buildChampionshipResultContract(matchId: string, game: ChampionshipRealGameState): UnifiedResultContract {
    return {
        source: 'championship',
        gameId: matchId,
        status: game.status === 'finished' ? 'finished' : game.status === 'scoring' ? 'scoring' : 'ended',
        winner: game.winnerId ?? null,
        finalScores: game.finalScore ?? null,
        rewardModel: 'championshipSummary',
        displayModel: 'waitSummary',
        postActions: ['close', 'next_match'],
    };
}

