import React from 'react';
import type { InventoryItem, User } from '../../types.js';
import PairPetDetailCardBody from './PairPetDetailCardBody.js';

export interface PairPetHatchAcquirePanelProps {
    currentUser: User;
    item: InventoryItem;
    /** 상세(view)에서 현재 장착 펫이면 대표펫 배지 */
    showRepresentativeBadge?: boolean;
}

/** 펫 획득·상세 모달 본문 — 홈/정보 탭과 동일 {@link PairPetDetailCardBody} 레이아웃(모달용 타이포) */
const PairPetHatchAcquirePanel: React.FC<PairPetHatchAcquirePanelProps> = ({
    currentUser,
    item,
    showRepresentativeBadge = false,
}) => (
    <PairPetDetailCardBody
        currentUser={currentUser}
        item={item}
        statsGridVariant="modal"
        showRepresentativeBadge={showRepresentativeBadge}
    />
);

export default PairPetHatchAcquirePanel;
