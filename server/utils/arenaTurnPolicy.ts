import * as types from '../../types/index.js';
import { GameCategory } from '../../types/enums.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { resolveArenaSessionPolicy, modeIncludesCaptureRule } from '../../shared/utils/liveSessionArenaKind.js';
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

export async function resolveArenaFixedScoringTurnLimit(game: types.LiveGameSession): Promise<number | undefined> {
    const policy = resolveArenaSessionPolicy(game as any);
    const scoringTurnLimit = Number((game.settings as any)?.scoringTurnLimit ?? 0);
    // human 1v1 PVP: 수 제한 자동계가 금지 (상호 패스만 계가)
    if (
        policy.matchAxis === 'pvp' &&
        policy.kind === GameCategory.Normal &&
        !game.isAiGame &&
        !game.isSinglePlayer &&
        !policy.isPairGame
    ) {
        return undefined;
    }
    if (policy.isPairGame) {
        return scoringTurnLimit > 0 && !modeIncludesCaptureRule(game.mode, game.settings)
            ? scoringTurnLimit
            : undefined;
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
    return resolveArenaSessionPolicy(game as any).isClientAuthoritativeForScoringSnapshot;
}

