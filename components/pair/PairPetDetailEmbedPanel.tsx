import React from 'react';
import Button from '../Button.js';
import PairPetDetailCardBody from './PairPetDetailCardBody.js';
import type { InventoryItem, User } from '../../types.js';

export interface PairPetDetailEmbedPanelProps {
    currentUser: User;
    item: InventoryItem;
    showRepresentativeBadge?: boolean;
    /** (선택) 하단 고정 버튼으로 모달 열기 — 로비 정보 뷰 등에서는 미사용 */
    onOpenDetail?: () => void;
    /**
     * `modal`: {@link PairPetDetailCardBody} 전체를 펫 상세 모달과 동일.
     * `panelFit`: 상단 카드는 한 칸에 맞게 축소, 바둑능력 스트립·6코어 그리드는 모달과 동일(전체는 필요 시 균등 축소).
     */
    detailVariant?: 'modal' | 'panelFit';
    /**
     * `fill`(기본): 부모 높이를 채움(`flex-1`). `hug`: 본문 높이만큼만 — 홈 등에서 패널 중앙 배치용.
     */
    contentHeight?: 'fill' | 'hug';
    /** 네이티브 홈 대표펫 칸: 스크롤 없이 한 화면에 맞추기 위한 간격·타이포 축소 */
    mobileHomeRepPet?: boolean;
    /** 챔피언십 로비: 초·중·종반 스트립·코어 그리드 여유 레이아웃 */
    enlargeHomeRepPhaseStrip?: boolean;
    /** 부모가 {@link PairPetDetailFitScale}으로 감쌀 때 내부 이중 스케일 방지 */
    suppressDetailFitScale?: boolean;
    /**
     * 부모(예: 챔피언십 PC 좌측)가 `PairPetDetailFitScale`로 전체를 축소할 때:
     * `overflow-y-auto`는 측정·스케일을 막고 스크롤만 생기므로 끄고 `overflow-hidden`으로 맡김.
     */
    parentOuterFitScale?: boolean;
}

/**
 * 홈·페어 로비 정보 탭 등에 쓰는 펫 상세 임베드 — {@link PairPetDetailCardBody} + 선택 시 모달 진입.
 */
const PairPetDetailEmbedPanel: React.FC<PairPetDetailEmbedPanelProps> = ({
    currentUser,
    item,
    showRepresentativeBadge = true,
    onOpenDetail,
    detailVariant = 'panelFit',
    contentHeight = 'fill',
    mobileHomeRepPet = false,
    enlargeHomeRepPhaseStrip = false,
    suppressDetailFitScale = false,
    parentOuterFitScale = false,
}) => {
    const isModalLayout = detailVariant === 'modal';
    const hug = contentHeight === 'hug';
    const homePack = Boolean(mobileHomeRepPet && !isModalLayout);
    const readablePanelFit = detailVariant === 'panelFit' && suppressDetailFitScale;
    const modalScrollClass =
        isModalLayout && !parentOuterFitScale
            ? 'overflow-y-auto overflow-x-hidden'
            : readablePanelFit
              ? 'overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]'
              : 'overflow-hidden';
    return (
    <div
        className={`flex min-h-0 flex-col overflow-hidden ${homePack ? 'gap-0.5' : 'gap-1'} ${
            hug
                ? homePack
                    ? 'h-full min-h-0 w-full flex-1'
                    : 'w-full min-h-0 shrink-0'
                : parentOuterFitScale
                  ? 'w-full shrink-0'
                  : 'min-h-0 flex-1'
        }`}
    >
        <div
            className={`flex min-h-0 min-w-0 flex-col ${
                hug
                    ? `h-full w-full shrink-0 overflow-hidden ${homePack ? 'px-0.5 pb-0.5 pt-0.5 sm:px-1 sm:pb-1 sm:pt-0.5' : ''}`
                    : parentOuterFitScale
                      ? `w-full shrink-0 ${modalScrollClass}`
                      : `min-h-0 flex-1 ${modalScrollClass}`
            }`}
        >
            <PairPetDetailCardBody
                currentUser={currentUser}
                item={item}
                statsGridVariant={isModalLayout ? 'modal' : 'panelFit'}
                showRepresentativeBadge={showRepresentativeBadge}
                mobileHomeRepPet={mobileHomeRepPet}
                enlargeHomeRepPhaseStrip={enlargeHomeRepPhaseStrip}
                suppressFitScale={suppressDetailFitScale}
            />
        </div>
        {onOpenDetail ? (
            <Button
                type="button"
                colorScheme="none"
                onClick={onOpenDetail}
                className="w-full shrink-0 !justify-center rounded-md border border-cyan-400/40 bg-cyan-950/45 !py-1.5 text-[0.72rem] font-bold text-cyan-50 hover:bg-cyan-900/55 sm:!text-xs"
            >
                상세보기
            </Button>
        ) : null}
    </div>
    );
};

export default PairPetDetailEmbedPanel;
