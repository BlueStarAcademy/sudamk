export {
    buildConditionPotionUserPatch,
    buildOptimisticConditionPotionPatch,
    applyConditionPotionPatchInPlace,
    parseConditionPotionUseContext,
    resolveDungeonBaseCondition,
    resolveVersusBaseCondition,
    consumeConditionPotionInventory,
    canAffordConditionPotionUse,
    CONDITION_POTION_USE_BROADCAST_FIELDS,
    type ConditionPotionUseContext,
    type ConditionPotionUsePayload,
    type ConditionPotionApplyResult,
} from './apply.js';

export {
    sanitizeConditionPotionUserUpdatePatch,
    isConditionPotionUseSyncWs,
    isConditionPotionBuySyncWs,
    isConditionPotionInventoryIncreaseWs,
    type ConditionPotionWsMergeContext,
} from './wsMergePolicy.js';
