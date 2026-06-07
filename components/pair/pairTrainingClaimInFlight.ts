import { normalizePairPetTrainingSlots } from '../../shared/constants/pairTraining.js';
import type { PairPetTrainingSlotState } from '../../types/entities.js';
import type { PairTrainingClaimClientSummary } from '../../shared/types/pairTrainingClaim.js';

/** 동일 슬롯 중복 `PAIR_PET_CLAIM_TRAINING`(더블 탭·Strict Mode) 시 같은 Promise 공유 */
export const pairTrainingClaimInFlightBySlotIndex = new Map<number, Promise<unknown>>();

/** 백그라운드 수령 완료 후 재수련 시 중복 CLAIM 방지 */
export const pairTrainingClaimCompletedBySlotIndex = new Set<number>();

export const PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR = '수령할 수련이 없습니다.';

export function clearPairTrainingClaimCompleted(slotIndex: number) {
    pairTrainingClaimCompletedBySlotIndex.delete(slotIndex);
}

export function markPairTrainingClaimCompleted(slotIndex: number) {
    pairTrainingClaimCompletedBySlotIndex.add(slotIndex);
}

function isAlreadyClaimedClaimError(error: string | undefined): boolean {
    return error === PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR;
}

type ClaimResponseShape = {
    error?: string;
    pairTrainingClaimSummary?: PairTrainingClaimClientSummary;
    clientResponse?: { pairTrainingClaimSummary?: PairTrainingClaimClientSummary };
    data?: { pairTrainingClaimSummary?: PairTrainingClaimClientSummary };
};

export function parsePairTrainingClaimResponse(raw: unknown): {
    error?: string;
    summary: PairTrainingClaimClientSummary | null;
} {
    const res = (raw as ClaimResponseShape | null) ?? null;
    if (res?.error) return { error: String(res.error), summary: null };
    if (!res) return { summary: null };
    const summary =
        res.pairTrainingClaimSummary ??
        res.clientResponse?.pairTrainingClaimSummary ??
        res.data?.pairTrainingClaimSummary ??
        null;
    return { summary: summary ?? null };
}

export function registerPairTrainingClaimInflight(slotIndex: number, inflight: Promise<unknown>) {
    pairTrainingClaimInFlightBySlotIndex.set(slotIndex, inflight);
    void inflight.finally(() => {
        if (pairTrainingClaimInFlightBySlotIndex.get(slotIndex) === inflight) {
            pairTrainingClaimInFlightBySlotIndex.delete(slotIndex);
        }
    });
}

/**
 * 재수련 전 수령 상태 확정 — 진행 중이면 대기, 이미 수령됐으면 재요청하지 않음.
 */
export async function awaitPairTrainingClaimSettled(
    slotIndex: number,
    options: {
        petItemId: string;
        commitClaim: () => Promise<unknown>;
        getTrainingSlots: () => PairPetTrainingSlotState[] | null | undefined;
    },
): Promise<{ error?: string; summary: PairTrainingClaimClientSummary | null }> {
    const { petItemId, commitClaim, getTrainingSlots } = options;

    if (pairTrainingClaimCompletedBySlotIndex.has(slotIndex)) {
        return { summary: null };
    }

    let inflight = pairTrainingClaimInFlightBySlotIndex.get(slotIndex);
    if (!inflight) {
        const slots = normalizePairPetTrainingSlots(getTrainingSlots());
        const session = slots[slotIndex];
        if (!session) {
            markPairTrainingClaimCompleted(slotIndex);
            return { summary: null };
        }
        if (session.itemId !== petItemId) {
            return { error: '수련 슬롯 상태가 일치하지 않습니다.', summary: null };
        }
        inflight = commitClaim();
        registerPairTrainingClaimInflight(slotIndex, inflight);
    }

    const parsed = parsePairTrainingClaimResponse(await inflight);
    if (parsed.error) {
        if (isAlreadyClaimedClaimError(parsed.error)) {
            markPairTrainingClaimCompleted(slotIndex);
            return { summary: null };
        }
        return parsed;
    }
    if (parsed.summary) {
        markPairTrainingClaimCompleted(slotIndex);
    }
    return parsed;
}
