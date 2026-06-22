import { aiUserId } from '../../shared/constants/auth.js';
import { PLAYFUL_ACTION_POINT_COST, STRATEGIC_ACTION_POINT_COST } from '../../constants/rules.js';
import { PLAYFUL_GAME_MODES, SPECIAL_GAME_MODES } from '../../shared/constants/gameModes.js';
import { getAdventureMonsterAttackActionPointCost } from '../../constants/adventureMonstersCodex.js';
import { getAdventureStageById } from '../../constants/adventureConstants.js';
import type { LiveGameSession, User } from '../../shared/types/entities.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import {
    effectiveAiLobbyApCostForUser,
    effectivePairAiLobbyApCostForUser,
    effectivePairRankedApCostForUser,
    effectivePvpEntryApCostForUser,
    effectiveStrategicRankedQueueApCostForUser,
} from '../../shared/utils/pairPetArenaApDiscount.js';
import { getPairHumanParticipantIds } from '../../shared/utils/pairGameTurn.js';
import { applyPassiveActionPointRegenToUser, recordActionPointSpend } from '../effectService.js';
import * as db from '../db.js';

export type ActionPointChargePolicy = 'on_pve_victory' | 'on_in_game_start' | 'none';

export function resolveActionPointChargePolicy(session: Partial<LiveGameSession>): ActionPointChargePolicy {
    const policy = resolveArenaSessionPolicy(session);
    if (policy.kind === 'singleplayer' || policy.kind === 'tower') {
        return 'on_pve_victory';
    }
    if (policy.matchAxis === 'pvp') {
        return 'on_in_game_start';
    }
    if (policy.kind === 'adventure') {
        return 'on_in_game_start';
    }
    if (session.isAiGame) {
        return 'on_in_game_start';
    }
    return 'none';
}

export function assertSufficientActionPoints(user: User, cost: number): boolean {
    if (user.isAdmin || cost <= 0) return true;
    return user.actionPoints.current >= cost;
}

function pairRankedBaseCostFromGame(game: LiveGameSession): number {
    const ch = game.settings?.pairGame?.lobbyChannel ?? 'pair';
    if (ch === 'playful') return PLAYFUL_ACTION_POINT_COST;
    if (ch === 'strategic') return STRATEGIC_ACTION_POINT_COST;
    const mode = game.mode;
    if (SPECIAL_GAME_MODES.some((m) => m.mode === mode)) return STRATEGIC_ACTION_POINT_COST;
    if (PLAYFUL_GAME_MODES.some((m) => m.mode === mode)) return PLAYFUL_ACTION_POINT_COST;
    return STRATEGIC_ACTION_POINT_COST;
}

export function resolveInGameActionPointCost(user: User, game: LiveGameSession): number {
    const arenaPolicy = resolveArenaSessionPolicy(game);

    if (arenaPolicy.kind === 'adventure') {
        const stage = getAdventureStageById(game.adventureStageId ?? '');
        const stageIndex = stage?.stageIndex ?? 1;
        const codexId = game.adventureMonsterCodexId ?? '';
        return getAdventureMonsterAttackActionPointCost(stageIndex, codexId);
    }

    if (game.isAiGame && arenaPolicy.isPairGame && game.settings?.pairGame) {
        return effectivePairAiLobbyApCostForUser(user, game.mode, game.settings ?? {}, {
            lobbyChannel: game.settings.pairGame.lobbyChannel,
        });
    }

    if (game.isAiGame) {
        return effectiveAiLobbyApCostForUser(user, game.mode, game.settings ?? {});
    }

    if (game.isRankedGame && arenaPolicy.isPairGame) {
        const base = pairRankedBaseCostFromGame(game);
        return effectivePairRankedApCostForUser(user, base, {
            lobbyChannel: game.settings?.pairGame?.lobbyChannel,
        });
    }

    if (game.isRankedGame) {
        return effectiveStrategicRankedQueueApCostForUser(user);
    }

    const lobbyCh = game.settings?.pairGame?.lobbyChannel;
    return effectivePvpEntryApCostForUser(user, game.mode, lobbyCh);
}

export function resolveHumanParticipantIdsForApCharge(game: LiveGameSession): string[] {
    const pairGame = game.settings?.pairGame;
    if (pairGame) {
        return getPairHumanParticipantIds(pairGame).filter((id) => id !== aiUserId && !id.startsWith('pet-ai-'));
    }
    const ids: string[] = [];
    if (game.player1?.id && game.player1.id !== aiUserId && !String(game.player1.id).startsWith('dungeon-bot-')) {
        ids.push(game.player1.id);
    }
    if (game.player2?.id && game.player2.id !== aiUserId && !String(game.player2.id).startsWith('dungeon-bot-')) {
        ids.push(game.player2.id);
    }
    return [...new Set(ids)];
}

export type ActionPointChargeResult = {
    charged: boolean;
    updatedUsers: User[];
    totalCharged: number;
};

const apChargeInFlight = new Set<string>();

/** 인게임(`playing`) 진입 시 1회 차감 — singleplayer/tower는 정책상 스킵 */
export async function chargeActionPointsOnInGameStart(
    game: LiveGameSession,
    nowMs: number = Date.now(),
): Promise<ActionPointChargeResult> {
    if (game.actionPointsChargedAtStart || apChargeInFlight.has(game.id)) {
        return { charged: false, updatedUsers: [], totalCharged: 0 };
    }
    if (resolveActionPointChargePolicy(game) !== 'on_in_game_start') {
        return { charged: false, updatedUsers: [], totalCharged: 0 };
    }
    if (game.gameStatus !== 'playing') {
        return { charged: false, updatedUsers: [], totalCharged: 0 };
    }

    apChargeInFlight.add(game.id);
    try {
    const participantIds = resolveHumanParticipantIdsForApCharge(game);
    if (participantIds.length === 0) {
        game.actionPointsChargedAtStart = true;
        return { charged: false, updatedUsers: [], totalCharged: 0 };
    }

    const updatedUsers: User[] = [];
    let totalCharged = 0;

    for (const userId of participantIds) {
        const freshUser = await db.getUser(userId);
        if (!freshUser) continue;
        const cost = resolveInGameActionPointCost(freshUser, game);
        if (cost <= 0 || freshUser.isAdmin) continue;

        await applyPassiveActionPointRegenToUser(freshUser, nowMs);
        if (freshUser.actionPoints.current < cost) {
            console.warn(
                `[AP] In-game charge skipped for ${userId} game=${game.id}: insufficient AP (need ${cost}, have ${freshUser.actionPoints.current})`,
            );
            continue;
        }
        recordActionPointSpend(freshUser, cost, nowMs);
        totalCharged += cost;
        await db.updateUser(freshUser);
        updatedUsers.push(freshUser);
    }

    game.actionPointsChargedAtStart = true;
    return { charged: totalCharged > 0, updatedUsers, totalCharged };
    } finally {
        apChargeInFlight.delete(game.id);
    }
}

/** PVE 승리 정산 시 1회 차감 — 학원·도전의탑 */
export async function chargeActionPointsOnPveVictory(
    user: User,
    game: LiveGameSession,
    plannedCost: number,
    nowMs: number = Date.now(),
): Promise<number> {
    if (game.actionPointsChargedOnVictory) return 0;
    if (resolveActionPointChargePolicy(game) !== 'on_pve_victory') return 0;
    if (plannedCost <= 0 || user.isAdmin) {
        game.actionPointsChargedOnVictory = true;
        return 0;
    }

    await applyPassiveActionPointRegenToUser(user, nowMs);
    const spendAmount = Math.min(plannedCost, Math.max(0, user.actionPoints.current));
    if (spendAmount > 0) {
        recordActionPointSpend(user, spendAmount, nowMs);
    }
    game.actionPointsChargedOnVictory = true;
    return spendAmount;
}

export async function assertSufficientActionPointsForParticipants(
    participants: User[],
    resolveCost: (user: User) => number,
    nowMs: number = Date.now(),
    errorMessage = '행동력이 부족합니다.',
): Promise<{ ok: true } | { ok: false; error: string }> {
    for (const u of participants) {
        await applyPassiveActionPointRegenToUser(u, nowMs);
        const cost = resolveCost(u);
        if (!assertSufficientActionPoints(u, cost)) {
            return { ok: false, error: errorMessage };
        }
    }
    return { ok: true };
}
