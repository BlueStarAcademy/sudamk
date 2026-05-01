import React from 'react';
import type { InventoryItem, User } from '../../types.js';
import PairPetDetailCardBody from './PairPetDetailCardBody.js';

export interface PairPetHatchAcquirePanelProps {
    currentUser: User;
    item: InventoryItem;
}

/** 펫 획득·상세 모달 본문 — 카드 레이아웃 공유 */
const PairPetHatchAcquirePanel: React.FC<PairPetHatchAcquirePanelProps> = ({ currentUser, item }) => (
    <PairPetDetailCardBody currentUser={currentUser} item={item} statsGridVariant="modal" />
);

export default PairPetHatchAcquirePanel;
