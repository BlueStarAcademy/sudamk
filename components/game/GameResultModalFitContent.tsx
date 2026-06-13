import React from 'react';
import { useGameResultModalContentFit } from './useGameResultModalContentFit.js';

type GameResultModalFitContentProps = {
    children: React.ReactNode;
    enabled?: boolean;
    className?: string;
    contentClassName?: string;
};

/**
 * PVE/PVP 경기 결과 모달 본문 래퍼 — 뷰포트 높이에 맞춰 균일 축소해 스크롤 없이 한 화면에 표시.
 */
const GameResultModalFitContent: React.FC<GameResultModalFitContentProps> = ({
    children,
    enabled = true,
    className = '',
    contentClassName = '',
}) => {
    const { containerRef, contentRef, scale, isScaled } = useGameResultModalContentFit(enabled);

    return (
        <div ref={containerRef} className={`min-h-0 flex-1 overflow-hidden ${className}`.trim()}>
            <div
                ref={contentRef}
                className={`mx-auto flex w-full max-w-full flex-col origin-top ${contentClassName}`.trim()}
                style={
                    isScaled
                        ? {
                              transform: `scale(${scale})`,
                              width: `${100 / scale}%`,
                          }
                        : undefined
                }
            >
                {children}
            </div>
        </div>
    );
};

export default GameResultModalFitContent;
