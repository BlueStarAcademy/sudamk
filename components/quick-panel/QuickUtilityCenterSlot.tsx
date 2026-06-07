import React, { type ReactNode } from 'react';
import PcLobbyCenterColumn from '../shell/PcLobbyCenterColumn.js';

type QuickUtilityCenterSlotProps = {
    children: ReactNode;
};

/**
 * @deprecated PcLobbyCenterColumn 사용 권장 — 셸 포함 전체 중앙 열 전환.
 * 레거시 호환: 자식만 넘기면 PcLobbyCenterColumn이 셸·유틸 모드를 처리한다.
 */
export const QuickUtilityCenterSlot: React.FC<QuickUtilityCenterSlotProps> = ({ children }) => (
    <PcLobbyCenterColumn>{children}</PcLobbyCenterColumn>
);

export default QuickUtilityCenterSlot;
