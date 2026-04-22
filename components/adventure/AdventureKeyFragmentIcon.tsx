import React from 'react';

const SRC = '/images/icon/adventure-key-fragment.svg';

type Props = {
    /** 좁은 사이드바·맵 패널 */
    compact?: boolean;
    /** 결과 모달 보상 슬롯 등 */
    variant?: 'panel' | 'reward';
    className?: string;
};

/** 모험 열쇠 경험치(조각) — 직소 퍼즐 탭 실루엣 SVG */
const AdventureKeyFragmentIcon: React.FC<Props> = ({ compact, variant = 'panel', className }) => {
    const reward = variant === 'reward';
    const box =
        reward && compact
            ? 'h-6 max-h-6 w-auto aspect-[40/48]'
            : reward && !compact
              ? 'h-9 max-h-9 w-auto aspect-[40/48] min-[1024px]:h-10 min-[1024px]:max-h-10'
              : compact
                ? 'h-5 max-h-5 w-auto aspect-[40/48] sm:h-6 sm:max-h-6'
                : 'h-6 max-h-6 w-auto aspect-[40/48] sm:h-7 sm:max-h-7';
    return (
        <span className={`relative inline-flex shrink-0 items-center justify-center ${box} ${className ?? ''}`} aria-hidden>
            <img src={SRC} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
        </span>
    );
};

export default AdventureKeyFragmentIcon;
