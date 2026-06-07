import type { PairPetDetailEmbedPanelProps } from './PairPetDetailEmbedPanel.js';

/** {@link Profile} 홈 대표펫 칸·펫 관리 정보 뷰어와 동일한 임베드 옵션 */
export type PairPetHomeEmbedLayoutInput = {
    /** Profile `nativeCompactHome` — 네이티브 홈 좌측 병합 레이아웃 */
    nativeCompactHome?: boolean;
};

/**
 * 펫 관리 모달 정보 탭 — 좁은 모달에 맞춘 panelFit·촘촘 타이포.
 */
export function resolvePetInfoViewerEmbedLayout(
    _input: PairPetHomeEmbedLayoutInput = {},
): Pick<
    PairPetDetailEmbedPanelProps,
    | 'detailVariant'
    | 'contentHeight'
    | 'mobileHomeRepPet'
    | 'profileHomeColumn'
    | 'enlargedModalHero'
    | 'suppressDetailFitScale'
    | 'petManagementModal'
> {
    void _input.nativeCompactHome;
    return {
        detailVariant: 'panelFit',
        contentHeight: 'hug',
        mobileHomeRepPet: false,
        profileHomeColumn: true,
        enlargedModalHero: false,
        suppressDetailFitScale: true,
        petManagementModal: true,
    };
}

/**
 * {@link Profile} 홈 좌측 대표펫 칸 — 프로필 능력치 패널과 동일한 가독성(`profileHomeColumn`).
 */
export function resolveProfileHomePetEmbedLayout(
    _input: PairPetHomeEmbedLayoutInput = {},
): Pick<
    PairPetDetailEmbedPanelProps,
    | 'detailVariant'
    | 'contentHeight'
    | 'mobileHomeRepPet'
    | 'profileHomeColumn'
    | 'enlargedModalHero'
    | 'suppressDetailFitScale'
    | 'petManagementModal'
> {
    void _input.nativeCompactHome;
    return {
        detailVariant: 'panelFit',
        contentHeight: 'hug',
        mobileHomeRepPet: false,
        profileHomeColumn: true,
        enlargedModalHero: false,
        suppressDetailFitScale: true,
        petManagementModal: false,
    };
}

/** @deprecated {@link resolvePetInfoViewerEmbedLayout} 사용 */
export function resolvePairPetHomeEmbedLayout(
    input: PairPetHomeEmbedLayoutInput = {},
): ReturnType<typeof resolvePetInfoViewerEmbedLayout> {
    return resolvePetInfoViewerEmbedLayout(input);
}

/** @deprecated {@link resolvePetInfoViewerEmbedLayout} 사용 */
export function resolvePetManagementInfoEmbedLayout(): ReturnType<typeof resolvePetInfoViewerEmbedLayout> {
    return resolvePetInfoViewerEmbedLayout();
}

/** 챔피언십 모바일 능력치 탭 — 펫 6코어 3×2 그리드 */
export function resolveChampionshipMobilePetEmbedLayout(): Pick<
    PairPetDetailEmbedPanelProps,
    | 'detailVariant'
    | 'contentHeight'
    | 'mobileHomeRepPet'
    | 'profileHomeColumn'
    | 'enlargedModalHero'
    | 'suppressDetailFitScale'
    | 'petManagementModal'
    | 'enlargeHomeRepPhaseStrip'
> {
    return {
        detailVariant: 'panelFit',
        contentHeight: 'hug',
        mobileHomeRepPet: false,
        profileHomeColumn: true,
        enlargedModalHero: false,
        suppressDetailFitScale: true,
        petManagementModal: false,
        enlargeHomeRepPhaseStrip: true,
    };
}
