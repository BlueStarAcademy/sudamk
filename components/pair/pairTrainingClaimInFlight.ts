import type { PairTrainingClaimClientSummary } from '../../shared/types/pairTrainingClaim.js';

/** 동일 슬롯 중복 `PAIR_PET_CLAIM_TRAINING`(더블 탭·Strict Mode) 시 같은 Promise 공유 */
export const pairTrainingClaimInFlightBySlotIndex = new Map<number, Promise<unknown>>();

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
