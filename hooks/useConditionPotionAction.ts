import type { User } from '../types.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { buildOptimisticConditionPotionPatch } from '../shared/conditionPotion/apply.js';
import type { ConditionPotionUsePayload } from '../shared/conditionPotion/apply.js';
import { tx } from '../shared/i18n/runtimeText.js';

export type UseConditionPotionActionDeps = {
    getCurrentUser: () => User | null;
    applyUserUpdate: (updates: Partial<User>, source: string) => User;
    showError: (message: string) => void;
    markConnectionRestored: () => void;
    useInFlightRef: { current: boolean };
    lastHttpActionTypeRef: { current: string | null };
    lastHttpUpdateTimeRef: { current: number };
    lastHttpHadUpdatedUserRef: { current: boolean };
};

export type UseConditionPotionActionResult = { error?: string } | void;

/**
 * USE_CONDITION_POTION 전용 클라이언트 흐름: 낙관적 반영 → HTTP → 실패 시 롤백.
 */
export async function executeUseConditionPotionAction(
    deps: UseConditionPotionActionDeps,
    payload: ConditionPotionUsePayload,
): Promise<UseConditionPotionActionResult> {
    if (deps.useInFlightRef.current) {
        return { error: tx('tournament:conditionPotionAction.alreadyInUse') };
    }

    const currentUser = deps.getCurrentUser();
    if (!currentUser?.id) {
        return { error: tx('auth:loginRequired') };
    }

    deps.useInFlightRef.current = true;
    const revertUser = JSON.parse(JSON.stringify(currentUser)) as User;
    const optimisticPatch = buildOptimisticConditionPotionPatch(currentUser, payload);
    if (optimisticPatch) {
        deps.applyUserUpdate(optimisticPatch, 'USE_CONDITION_POTION-optimistic');
    }
    deps.lastHttpActionTypeRef.current = 'USE_CONDITION_POTION';

    try {
        const res = await fetch(getApiUrl('/api/action'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'USE_CONDITION_POTION', payload, userId: currentUser.id }),
        });

        if (!res.ok) {
            let errorMessage = tx('tournament:conditionPotionAction.useFailed');
            try {
                const errorData = await res.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch {
                /* ignore */
            }
            deps.applyUserUpdate(revertUser, 'USE_CONDITION_POTION-revert');
            deps.showError(typeof errorMessage === 'string' ? errorMessage : tx('tournament:conditionPotionAction.useFailed'));
            return { error: errorMessage };
        }

        const result = await res.json();
        const isHttpBodyError =
            Boolean(result.error) ||
            result.success === false ||
            (typeof result.message === 'string' && result.message.length > 0 && result.success !== true);
        if (isHttpBodyError) {
            const errorMessage = result.message || result.error || tx('common:errors.serverError');
            deps.applyUserUpdate(revertUser, 'USE_CONDITION_POTION-revert');
            deps.showError(errorMessage);
            return { error: errorMessage };
        }

        deps.markConnectionRestored();
        const updatedUserFromResponse = result.updatedUser || result.clientResponse?.updatedUser;
        if (updatedUserFromResponse) {
            deps.lastHttpUpdateTimeRef.current = Date.now();
            deps.lastHttpHadUpdatedUserRef.current = true;
            deps.applyUserUpdate(updatedUserFromResponse, 'USE_CONDITION_POTION-http');
        }
        return undefined;
    } catch (err: unknown) {
        deps.applyUserUpdate(revertUser, 'USE_CONDITION_POTION-revert');
        const message = err instanceof Error ? err.message : tx('tournament:conditionPotionAction.useError');
        deps.showError(message);
        return { error: message };
    } finally {
        deps.useInFlightRef.current = false;
    }
}
