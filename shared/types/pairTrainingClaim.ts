/** `PAIR_PET_CLAIM_TRAINING` 성공 시 클라이언트 보상 표시용 */
export type PairTrainingClaimClientSummary = {
    goldGain: number;
    xpGain: number;
    soulDrop: { materialName: string; quantity: number } | null;
    petImage: string | null;
    petDisplayName: string | null;
    pairPetXp: { change: number } | null;
    pairPetLevel: {
        initial: number;
        final: number;
        progress: { initial: number; final: number; max: number };
    } | null;
};
