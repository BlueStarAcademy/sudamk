import React from 'react';
import { useGameResultModalContentFit } from './useGameResultModalContentFit.js';

type GameResultModalFitContentProps = {
    children: React.ReactNode;
    /** false면 축소 없이 본문 스크롤(모바일 기본) */
    enabled?: boolean;
    className?: string;
    contentClassName?: string;
};

/**
 * PVE/PVP 경기 결과 모달 본문 래퍼 — 데스크톱은 뷰포트 높이에 맞춰 균일 축소, 모바일·폴백은 스크롤.
 */
const GameResultModalFitContent: React.FC<GameResultModalFitContentProps> = ({
    children,
    enabled = true,
    className = '',
    contentClassName = '',
}) => {
    const { containerRef, contentRef, scale, isScaled, useScrollFallback } =
        useGameResultModalContentFit(enabled);

    return (
        <div
            ref={containerRef}
            className={`flex min-h-0 min-w-0 flex-1 flex-col ${
                useScrollFallback
                    ? 'overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]'
                    : 'overflow-hidden'
            } ${className}`.trim()}
        >
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
