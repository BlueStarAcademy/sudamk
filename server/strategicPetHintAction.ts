import * as db from './db.js';
import * as types from '../types/index.js';
import { SPECIAL_GAME_MODES } from '../shared/constants/index.js';
import {
    pairPetKataLevelForTotalPly,
    pairPetKataPhaseFromTotalPly,
    type PairPetKataPhase,
} from '../shared/constants/pairArena.js';
import { getKataServerRuntimeSnapshot } from './kataServerRuntimeStore.js';
import { pairPetKataStatsSixFromEquippedUser } from '../shared/utils/pairPetKataStatsFromEquippedUser.js';
import { pickStrategicPetHintLine } from '../shared/utils/strategicPetHintDialogue.js';
import { computeStrategicPetKataHintMove } from './goAiBot.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { addItemsToInventory, createItemInstancesFromReward } from '../utils/inventoryUtils.js';

type HintPhaseState = { opening?: boolean; midgame?: boolean; endgame?: boolean };
type PendingHint = {
    x: number;
    y: number;
    phase: PairPetKataPhase;
    moveHistoryLength: number;
    claimed?: boolean;
};
type BonusReward =
    | { kind: 'gold'; amount: number; label: string }
    | { kind: 'material'; itemName: string; quantity: number; label: string }
    | { kind: 'actionPoints'; amount: number; label: string }
    | { kind: 'diamonds'; amount: number; label: string };

function readHintUsage(game: types.LiveGameSession, userId: string): HintPhaseState {
    const bag = (game.settings as any)?.strategicPetHintByUserId as Record<string, HintPhaseState> | undefined;
    return bag?.[userId] ?? {};
}

function markHintPhaseUsed(game: types.LiveGameSession, userId: string, phase: PairPetKataPhase): void {
    const s = game.settings as any;
    if (!s.strategicPetHintByUserId) s.strategicPetHintByUserId = {};
    const cur = s.strategicPetHintByUserId[userId] ?? {};
    cur[phase] = true;
    s.strategicPetHintByUserId[userId] = cur;
}

function setPendingHint(game: types.LiveGameSession, userId: string, pending: PendingHint): void {
    const s = game.settings as any;
    if (!s.strategicPetHintPendingByUserId) s.strategicPetHintPendingByUserId = {};
    s.strategicPetHintPendingByUserId[userId] = pending;
}

function readPendingHint(game: types.LiveGameSession, userId: string): PendingHint | null {
    const pending = (game.settings as any)?.strategicPetHintPendingByUserId?.[userId] as PendingHint | undefined;
    if (!pending || !Number.isInteger(pending.x) || !Number.isInteger(pending.y)) return null;
    return pending;
}

function clearPendingHint(game: types.LiveGameSession, userId: string): void {
    const bag = (game.settings as any)?.strategicPetHintPendingByUserId as Record<string, PendingHint> | undefined;
    if (bag) delete bag[userId];
}

function isStrategicPetHintContext(game: types.LiveGameSession): boolean {
    if (!SPECIAL_GAME_MODES.some((m) => m.mode === game.mode)) return false;
    const policy = resolveArenaSessionPolicy(game as any);
    if (policy.isPairGame) return false;
    return true;
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick<T extends { weight: number }>(rows: readonly T[]): T {
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    let roll = Math.random() * total;
    for (const row of rows) {
        roll -= row.weight;
        if (roll < 0) return row;
    }
    return rows[rows.length - 1];
}

function rollStrategicPetHintBonus(petLevel: number): BonusReward {
    const category = weightedPick([
        { kind: 'gold' as const, weight: 70 },
        { kind: 'enhancementStone' as const, weight: 15 },
        { kind: 'soulStone' as const, weight: 10 },
        { kind: 'actionPoints' as const, weight: 4 },
        { kind: 'diamonds' as const, weight: 1 },
    ]);

    if (category.kind === 'gold') {
        const amount = randomInt(10, 500 + Math.max(0, petLevel) * 2);
        return { kind: 'gold', amount, label: `골드 ${amount.toLocaleString('ko-KR')}` };
    }
    if (category.kind === 'enhancementStone') {
        const row = weightedPick([
            { itemName: '하급 강화석', weight: 60, min: 1, max: 5 },
            { itemName: '중급 강화석', weight: 20, min: 1, max: 3 },
            { itemName: '상급 강화석', weight: 15, min: 1, max: 2 },
            { itemName: '최상급 강화석', weight: 4, min: 1, max: 1 },
            { itemName: '신비의 강화석', weight: 1, min: 1, max: 1 },
        ]);
        const quantity = randomInt(row.min, row.max);
        return { kind: 'material', itemName: row.itemName, quantity, label: `${row.itemName} ${quantity}개` };
    }
    if (category.kind === 'soulStone') {
        const row = weightedPick([
            { itemName: '새싹영혼석', weight: 60, min: 1, max: 3 },
            { itemName: '파동영혼석', weight: 20, min: 1, max: 2 },
            { itemName: '심연영혼석', weight: 15, min: 1, max: 1 },
            { itemName: '화염영혼석', weight: 4, min: 1, max: 1 },
            { itemName: '천광영혼석', weight: 1, min: 1, max: 1 },
        ]);
        const quantity = randomInt(row.min, row.max);
        return { kind: 'material', itemName: row.itemName, quantity, label: `${row.itemName} ${quantity}개` };
    }
    if (category.kind === 'actionPoints') {
        const amount = randomInt(3, 10);
        return { kind: 'actionPoints', amount, label: `행동력 ${amount}` };
    }
    const amount = randomInt(1, 5);
    return { kind: 'diamonds', amount, label: `다이아 ${amount}` };
}

function bonusSpeech(rewardLabel: string): string {
    const lines = [
        `나를 믿어줘서 고마워! 보너스로 ${rewardLabel}를 찾았어.`,
        `내 힌트를 따라와 줬구나! ${rewardLabel} 보너스야.`,
        `역시 우리 호흡이 좋아! ${rewardLabel}를 챙겨 줄게.`,
    ];
    return lines[randomInt(0, lines.length - 1)];
}

function isStrategicPetHintBonusEligible(game: types.LiveGameSession): boolean {
    const policy = resolveArenaSessionPolicy(game as any);
    if (policy.isPairGame) return false;
    if (policy.kind === 'tower' && Number((game as any).towerStartActionPointCost ?? 0) <= 0) return false;
    return true;
}

async function grantStrategicPetHintBonus(user: types.User, reward: BonusReward): Promise<void> {
    if (reward.kind === 'gold') {
        user.gold = (user.gold || 0) + reward.amount;
    } else if (reward.kind === 'diamonds') {
        user.diamonds = (user.diamonds || 0) + reward.amount;
    } else if (reward.kind === 'actionPoints') {
        user.actionPoints = user.actionPoints || { current: 0, max: 100 };
        user.actionPoints.current = (user.actionPoints.current || 0) + reward.amount;
    } else {
        const items = createItemInstancesFromReward([{ itemId: reward.itemName, quantity: reward.quantity }]);
        const { updatedInventory } = addItemsToInventory(
            user.inventory || [],
            user.inventorySlots || { equipment: 30, consumable: 30, material: 30 },
            items,
            { allowMaterialSlotOverflow: true },
        );
        user.inventory = updatedInventory;
    }
    await db.updateUser(user);
    const { broadcastUserUpdate } = await import('./socket.js');
    broadcastUserUpdate(user, ['gold', 'diamonds', 'actionPoints', 'inventory']);
}

/**
 * 전략바둑 대표펫 힌트 요청 — 게임 설정에 페이즈별 1회 사용 기록을 남긴다.
 */
export async function handleStrategicPetHintRequest(
    game: types.LiveGameSession,
    user: types.User,
    ctx: {
        pairClassicGame: boolean;
        isMyTurn: boolean;
        myPlayerEnum: types.Player;
    },
): Promise<types.HandleActionResult> {
    if (!isStrategicPetHintContext(game)) {
        return { error: '이 경기에서는 펫 힌트를 쓸 수 없습니다.' };
    }
    if (game.gameStatus !== 'playing') {
        return { error: '지금은 펫 힌트를 쓸 수 없습니다.' };
    }
    if (!ctx.isMyTurn || ctx.myPlayerEnum === types.Player.None) {
        return { error: '내 차례에만 펫 힌트를 쓸 수 있어요.' };
    }
    if (ctx.pairClassicGame) {
        return { error: '페어 경기장에서는 이 힌트를 사용할 수 없습니다.' };
    }

    const freshUser = await db.getUser(user.id);
    if (!freshUser) {
        return { error: '유저 정보를 불러오지 못했습니다.' };
    }
    const petRow = getEquippedPairPetInventoryRow(freshUser);
    if (!petRow) {
        return { error: '대표 펫이 있을 때만 힌트를 쓸 수 있어요.' };
    }
    const stats = pairPetKataStatsSixFromEquippedUser(freshUser);
    if (!stats) {
        return { error: '펫 정보를 불러오지 못했습니다.' };
    }

    const boardSize = game.settings.boardSize || 19;
    const totalPly =
        (game.moveHistory || []).filter((m) => m && m.x !== -1 && m.y !== -1).length + 1;
    const phase = pairPetKataPhaseFromTotalPly(boardSize, totalPly);
    const used = readHintUsage(game, user.id);
    if (used[phase]) {
        return { error: '이 국면 구간에서는 이미 펫 힌트를 썼어요.' };
    }

    const kataRuntime = getKataServerRuntimeSnapshot().pairPet;
    const kataLevel = pairPetKataLevelForTotalPly(boardSize, totalPly, stats, kataRuntime);
    const pt = await computeStrategicPetKataHintMove(game, ctx.myPlayerEnum, kataLevel);
    if (!pt || !Number.isInteger(pt.x) || !Number.isInteger(pt.y)) {
        return { error: '지금은 추천 수를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }

    markHintPhaseUsed(game, user.id, phase);
    setPendingHint(game, user.id, {
        x: pt.x,
        y: pt.y,
        phase,
        moveHistoryLength: game.moveHistory?.length ?? 0,
    });
    const message = pickStrategicPetHintLine({
        phase,
        petTemplateId: petRow.templateId,
        gameId: game.id,
        moveCount: game.moveHistory?.length ?? 0,
    });

    return {
        clientResponse: {
            strategicPetHint: {
                x: pt.x,
                y: pt.y,
                message,
                phase,
            },
        },
    };
}

export async function handleStrategicPetHintBonusClaim(
    game: types.LiveGameSession,
    user: types.User,
    point: { x: number; y: number; expectedMoveHistoryLength?: number },
): Promise<types.HandleActionResult | null> {
    if (!isStrategicPetHintContext(game) || !isStrategicPetHintBonusEligible(game)) return null;

    const pending = readPendingHint(game, user.id);
    if (!pending || pending.claimed || pending.x !== point.x || pending.y !== point.y) return null;

    const expectedMoveHistoryLength = Number(point.expectedMoveHistoryLength ?? game.moveHistory?.length ?? 0);
    if (expectedMoveHistoryLength !== pending.moveHistoryLength + 1) return null;

    const freshUser = await db.getUser(user.id);
    if (!freshUser) return null;
    const petRow = getEquippedPairPetInventoryRow(freshUser);
    if (!petRow) return null;

    clearPendingHint(game, user.id);
    const petLevel = Math.max(1, Math.floor(Number(petRow.level ?? 1) || 1));
    const reward = rollStrategicPetHintBonus(petLevel);
    await grantStrategicPetHintBonus(freshUser, reward);

    return {
        clientResponse: {
            updatedUser: freshUser,
            strategicPetHintBonus: {
                x: point.x,
                y: point.y,
                message: bonusSpeech(reward.label),
                reward,
            },
        },
    };
}
