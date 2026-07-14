import React from 'react';
import { AdventureRegionalKeyFragmentIcon } from './AdventureRegionalKeyIcons.js';

type Props = {
    /** 좁은 사이드바·맵 패널 */
    compact?: boolean;
    /** 결과 모달 보상 슬롯 등 */
    variant?: 'panel' | 'reward';
    className?: string;
    /** 지역별 조각 디자인 (없으면 동네뒷산) */
    stageId?: string | null;
};

/** 모험 열쇠 경험치(조각) — 지역 테마 SVG */
const AdventureKeyFragmentIcon: React.FC<Props> = ({ compact, variant = 'panel', className, stageId }) => (
    <AdventureRegionalKeyFragmentIcon
        stageId={stageId}
        compact={compact}
        variant={variant}
        className={className}
    />
);

export default AdventureKeyFragmentIcon;
