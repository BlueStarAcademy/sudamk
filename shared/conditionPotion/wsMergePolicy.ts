import type { InventoryItem, User } from '../types/index.js';
import {
    countConditionPotionsInInventory,
    stripInventoryIfFewerConditionPotions,
    stripInventoryIfMoreConditionPotions,
} from '../utils/conditionPotionInventory.js';

/** 회복제 사용 낙관 반영 이후 낡은 인벤 WS/INITIAL_STATE가 되돌리지 못하도록 막는 시간 */
export const CONDITION_POTION_USE_GUARD_MS = 30_000;

export type ConditionPotionWsMergeContext = {
    lastHttpActionType: string | null;
    useInFlight: boolean;
    prevInventory: InventoryItem[] | undefined;
    /** USE_CONDITION_POTION 낙관 반영 시각(ms). lastHttpActionType가 바뀌어도 잠시 보호 */
    useCommittedAt?: number | null;
    /** applyUserUpdate source — 낙관/롤백 패치는 stripFewer 대상에서 제외 */
    updateSource?: string;
};

function shouldStripFewerConditionPotions(ctx: ConditionPotionWsMergeContext): boolean {
    const source = ctx.updateSource ?? '';
    if (
        source.includes('USE_CONDITION_POTION-optimistic') ||
        source.includes('USE_CONDITION_POTION-revert') ||
        source.includes('USE_CONDITION_POTION-http')
    ) {
        return false;
    }
    if (ctx.lastHttpActionType === 'BUY_CONDITION_POTION') return true;
    return !shouldStripMoreConditionPotions(ctx);
}

function shouldStripMoreConditionPotions(ctx: ConditionPotionWsMergeContext): boolean {
    const source = ctx.updateSource ?? '';
    // 서버 HTTP 응답은 권위값 — 사용 직후 인벤 차감을 절대 버리지 않는다.
    if (source.includes('USE_CONDITION_POTION-http')) return false;
    if (ctx.useInFlight) return true;
    if (ctx.lastHttpActionType === 'USE_CONDITION_POTION') return true;
    if (ctx.useCommittedAt != null && Date.now() - ctx.useCommittedAt < CONDITION_POTION_USE_GUARD_MS) {
        return true;
    }
    return false;
}

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
    ctx: Pick<ConditionPotionWsMergeContext, 'lastHttpActionType' | 'useInFlight' | 'useCommittedAt'>,
): boolean {
    if (!Array.isArray(patch.inventory)) return false;
    const refQty = countConditionPotionsInInventory(prevInventory);
    const incomingQty = countConditionPotionsInInventory(patch.inventory);
    if (incomingQty <= refQty) return false;
    if (ctx.lastHttpActionType === 'USE_CONDITION_POTION' || ctx.useInFlight) return false;
    if (
        ctx.useCommittedAt != null &&
        Date.now() - ctx.useCommittedAt < CONDITION_POTION_USE_GUARD_MS
    ) {
        return false;
    }
    return true;
}

/** USER_UPDATE·INITIAL_STATE 등 병합 전 회복제 관련 낡은 인벤 패치 제거 */
export function sanitizeConditionPotionUserUpdatePatch<T extends Partial<User>>(
    patch: T,
    ctx: ConditionPotionWsMergeContext,
): T {
    let next = patch;
    if (shouldStripFewerConditionPotions(ctx)) {
        next = stripInventoryIfFewerConditionPotions(next, ctx.prevInventory);
    }
    if (shouldStripMoreConditionPotions(ctx)) {
        next = stripInventoryIfMoreConditionPotions(next, ctx.prevInventory);
    }
    return next;
}
