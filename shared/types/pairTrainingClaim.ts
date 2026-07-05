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
    /** 광고 시청으로 이 수련 보상을 1회 더 받을 때 사용하는 서버 검증 ID */
    adDoubleClaimId?: string;
    /** 광고 보상 2배를 이미 수령했는지 */
    adDoubled?: boolean;
    /** 광고로 추가 지급된 골드(표시용) */
    adGoldBonus?: number;
    /** 광고로 추가 지급된 펫 경험치(표시용) */
    adXpBonus?: number;
    /** 광고로 추가 지급된 영혼석(표시용) */
    adSoulDropBonus?: { materialName: string; quantity: number } | null;
};
