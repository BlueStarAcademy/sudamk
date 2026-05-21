import type { PairPetDetailEmbedPanelProps } from './PairPetDetailEmbedPanel.js';

/** {@link Profile} 홈 대표펫 칸·펫 관리 정보 뷰어와 동일한 임베드 옵션 */
export type PairPetHomeEmbedLayoutInput = {
    /** Profile `nativeCompactHome` — 네이티브 홈 좌측 병합 레이아웃 */
    nativeCompactHome?: boolean;
};

export function resolvePairPetHomeEmbedLayout(
    input: PairPetHomeEmbedLayoutInput = {},
): Pick<
    PairPetDetailEmbedPanelProps,
    | 'detailVariant'
    | 'contentHeight'
    | 'mobileHomeRepPet'
    | 'profileHomeColumn'
    | 'enlargedModalHero'
    | 'suppressDetailFitScale'
> {
    void input.nativeCompactHome;
    /** 홈 대표펫 — 프로필 능력치 패널과 동일 밀도, FitScale 없음 */
    return {
        detailVariant: 'panelFit',
        contentHeight: 'hug',
        mobileHomeRepPet: true,
        profileHomeColumn: true,
        enlargedModalHero: false,
        suppressDetailFitScale: true,
    };
}

/** 펫 관리 모달 정보 탭 — 고정 3×2·읽기 가능 타이포, FitScale 없음(스크롤) */
export function resolvePetManagementInfoEmbedLayout(): Pick<
    PairPetDetailEmbedPanelProps,
    | 'detailVariant'
    | 'contentHeight'
    | 'mobileHomeRepPet'
    | 'profileHomeColumn'
    | 'suppressDetailFitScale'
    | 'enlargedModalHero'
    | 'petManagementModal'
> {
    return {
        detailVariant: 'panelFit',
        contentHeight: 'hug',
        mobileHomeRepPet: false,
        profileHomeColumn: false,
        suppressDetailFitScale: true,
        enlargedModalHero: false,
        petManagementModal: true,
    };
}
