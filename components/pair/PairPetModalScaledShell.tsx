import React from 'react';
import { PAIR_PET_MODAL_UI_SCALE } from '../../shared/constants/pairPetModal.js';

const inverseSizePct = `${(100 / PAIR_PET_MODAL_UI_SCALE).toFixed(4)}%`;

/**
 * 펫 모달 본문: 설계 레이아웃(1×)을 유지한 채 `PAIR_PET_MODAL_UI_SCALE`만큼 균일 확대.
 * 부모(확대된 DraggableWindow) 안에서 역비율 폭·높이 + zoom으로 창 크기와 맞춘다.
 */
export const PairPetModalScaledShell: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => {
    const scale = PAIR_PET_MODAL_UI_SCALE;
    if (!(scale > 1.001)) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div className={`min-h-0 min-w-0 overflow-hidden ${className}`.trim()}>
            <div
                className="flex min-h-0 min-w-0 origin-top-left flex-col"
                style={{
                    zoom: scale,
                    width: inverseSizePct,
                    height: inverseSizePct,
                    minHeight: inverseSizePct,
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default PairPetModalScaledShell;
