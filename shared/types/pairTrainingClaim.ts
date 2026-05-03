import type { CoreStat } from './enums.js';

/** `PAIR_PET_CLAIM_TRAINING` 성공 시 클라이언트 보상 표시용 */
export type PairTrainingClaimClientSummary = {
    goldGain: number;
    /** 슬롯 롤 기본(특화 배율 적용 전). 없으면 구버전·클라는 `goldGain`만 사용 */
    goldBase?: number;
    /** `goldGain - goldBase` (특화 골드% 등). 0이면 생략 가능 */
    goldFromSpecialization?: number;
    xpGain: number;
    xpBase?: number;
    xpFromSpecialization?: number;
    soulDrop: { materialName: string; quantity: number } | null;
    petImage: string | null;
    petDisplayName: string | null;
    pairPetXp: { change: number } | null;
    pairPetLevel: {
        initial: number;
        final: number;
        progress: { initial: number; final: number; max: number };
    } | null;
    /** 이번 수령으로 펫이 레벨업하며 추가된 6코어 보너스(없으면 생략) */
    pairPetLevelUpCoreBonuses?: Partial<Record<CoreStat, number>>;
};
