import * as types from '../../types/index.js';
import { GameCategory } from '../../types/enums.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { resolveArenaSessionPolicy, modeIncludesCaptureRule } from '../../shared/utils/liveSessionArenaKind.js';
import { isRankedFixedTurnScoringSession } from '../../shared/utils/rankedFixedTurnScoring.js';
import { resolveSinglePlayerAutoScoringTurnCap } from '../../shared/utils/singlePlayerStrategicRulePreset.js';
import { getEffectiveSinglePlayerStages } from '../singlePlayerStageConfigService.js';

export type ArenaTurnLimitState = {
    fixedScoringTurnLimit?: number;
    countPassAsTurn: boolean;
    currentTurnCount: number;
};

export function getValidStoneMoveCount(game: types.LiveGameSession): number {
    return (game.moveHistory || []).filter((m) => m && m.x !== -1 && m.y !== -1).length;
}

export function getArenaTurnCount(game: types.LiveGameSession): number {
    const policy = resolveArenaSessionPolicy(game as any);
    return policy.countPassAsTurn ? (game.moveHistory || []).length : getValidStoneMoveCount(game);
}

/** Synchronous configured limit (no stage-table lookup). 0 when policy says no limit. */
export function resolveArenaConfiguredTurnLimit(game: types.LiveGameSession): number {
    const policy = resolveArenaSessionPolicy(game as any);
    if (policy.turnLimitMode === 'none') return 0;
    const scoring = Number((game.settings as any)?.scoringTurnLimit ?? 0);
    const auto = Number((game.settings as any)?.autoScoringTurns ?? 0);
    if (policy.turnLimitMode === 'scoringTurnLimit') return scoring > 0 ? scoring : auto;
    if (policy.turnLimitMode === 'autoScoringTurns') return auto > 0 ? auto : scoring;
    // stageAutoScoring: stage lookup is async; configured fields are the sync approximation.
    return auto > 0 ? auto : scoring;
}

export async function resolveArenaFixedScoringTurnLimit(game: types.LiveGameSession): Promise<number | undefined> {
    const policy = resolveArenaSessionPolicy(game as any);
    const scoringTurnLimit = Number((game.settings as any)?.scoringTurnLimit ?? 0);
    // human 1v1 PVP: 랭킹전만 수순 제한 계가 (상호 패스 계가 없음)
    if (policy.matchAxis === 'pvp' && policy.kind === GameCategory.Normal && !policy.isPairGame && !policy.isPveLike) {
        if (isRankedFixedTurnScoringSession(game)) {
            return scoringTurnLimit;
        }
        return undefined;
    }
    if (policy.isPairGame) {
        return policy.turnLimitMode === 'scoringTurnLimit' && scoringTurnLimit > 0 ? scoringTurnLimit : undefined;
    }
    if (policy.turnLimitMode === 'none' || modeIncludesCaptureRule(game.mode, game.settings)) {
        return undefined;
    }
    if (policy.kind === GameCategory.GuildWar || policy.kind === GameCategory.Tower) {
        if ((game.settings as any)?.autoScoringTurns != null) return (game.settings as any).autoScoringTurns;
        if (policy.kind === GameCategory.Tower && (game.stageId != null || game.towerFloor != null)) {
            const stage =
                game.stageId != null
                    ? TOWER_STAGES.find((s: { id: string }) => s.id === game.stageId)
                    : game.towerFloor != null && Number(game.towerFloor) >= 1
                      ? TOWER_STAGES[Number(game.towerFloor) - 1]
                      : undefined;
            return stage?.autoScoringTurns;
        }
        return undefined;
    }
    if (policy.kind === GameCategory.SinglePlayer && game.stageId) {
        const stage = (await getEffectiveSinglePlayerStages()).find((s) => s.id === game.stageId);
        return resolveSinglePlayerAutoScoringTurnCap(game.settings as any, stage);
    }
    return (game.settings as any)?.autoScoringTurns ?? (game.settings as any)?.scoringTurnLimit;
}

export async function resolveArenaTurnLimitState(game: types.LiveGameSession): Promise<ArenaTurnLimitState> {
    const policy = resolveArenaSessionPolicy(game as any);
    const currentTurnCount = policy.countPassAsTurn ? (game.moveHistory || []).length : getValidStoneMoveCount(game);
    return {
        fixedScoringTurnLimit: await resolveArenaFixedScoringTurnLimit(game),
        countPassAsTurn: policy.countPassAsTurn,
        currentTurnCount,
    };
}

export function arenaUsesClientAuthoritativeScoringSnapshot(game: types.LiveGameSession): boolean {
    return resolveArenaSessionPolicy(game as any).scoringAuthority === 'clientSnapshot';
}

