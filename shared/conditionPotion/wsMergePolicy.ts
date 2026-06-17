import type { InventoryItem, User } from '../types/index.js';
import {
    countConditionPotionsInInventory,
    stripInventoryIfFewerConditionPotions,
    stripInventoryIfMoreConditionPotions,
} from '../utils/conditionPotionInventory.js';

export type ConditionPotionWsMergeContext = {
    lastHttpActionType: string | null;
    useInFlight: boolean;
    prevInventory: InventoryItem[] | undefined;
};

export function isConditionPotionUseSyncWs(
    lastHttpActionType: string | null,
    patch: Partial<User>,
): boolean {
    if (lastHttpActionType !== 'USE_CONDITION_POTION') return false;
    return (
        Array.isArray(patch.inventory) ||
        patch.lastNeighborhoodTournament !== undefined ||
        patch.lastNationalTournament !== undefined ||
        patch.lastWorldTournament !== undefined ||
        patch.dungeonConditionSnapshot !== undefined ||
        patch.championshipVersusConditionSnapshot !== undefined
    );
}

export function isConditionPotionBuySyncWs(
    lastHttpActionType: string | null,
    patch: Partial<User>,
): boolean {
    if (lastHttpActionType !== 'BUY_CONDITION_POTION') return false;
    return (
        Array.isArray(patch.inventory) ||
        patch.gold !== undefined ||
        patch.dailyShopPurchases !== undefined
    );
}

export function isConditionPotionInventoryIncreaseWs(
    patch: Partial<User>,
    prevInventory: InventoryItem[] | undefined,
    ctx: Pick<ConditionPotionWsMergeContext, 'lastHttpActionType' | 'useInFlight'>,
): boolean {
    if (!Array.isArray(patch.inventory)) return false;
    const refQty = countConditionPotionsInInventory(prevInventory);
    const incomingQty = countConditionPotionsInInventory(patch.inventory);
    if (incomingQty <= refQty) return false;
    if (ctx.lastHttpActionType === 'USE_CONDITION_POTION' || ctx.useInFlight) return false;
    return true;
}

/** USER_UPDATE 병합 전 회복제 관련 낡은 인벤 패치 제거 */
export function sanitizeConditionPotionUserUpdatePatch<T extends Partial<User>>(
    patch: T,
    ctx: ConditionPotionWsMergeContext,
): T {
    let next = stripInventoryIfFewerConditionPotions(patch, ctx.prevInventory);
    if (ctx.useInFlight || ctx.lastHttpActionType === 'USE_CONDITION_POTION') {
        next = stripInventoryIfMoreConditionPotions(next, ctx.prevInventory);
    }
    return next;
}
