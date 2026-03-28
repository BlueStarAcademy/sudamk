import React, { useState, useEffect, useRef } from 'react';
import { MythicStat } from '../types/enums.js';
import { ItemOption } from '../types.js';
import { MYTHIC_STATS_DATA } from '../constants';
import { PortalHoverBubble } from './PortalHoverBubble.js';

const MYTHIC_SET = new Set<string>(Object.values(MythicStat));

export function isMythicStatType(type: string): type is MythicStat {
    return MYTHIC_SET.has(type);
}

/** 장비에 붙은 신화 옵션 한 줄: 약식 표기 + 호버/길게 누르면 말풍선 */
export const MythicOptionAbbrev: React.FC<{
    option: Pick<ItemOption, 'type' | 'display'>;
    textClassName?: string;
    bubbleSide?: 'top' | 'right';
}> = ({ option, textClassName = '', bubbleSide = 'top' }) => {
    if (!isMythicStatType(option.type)) {
        return <span className={textClassName}>{option.display}</span>;
    }
    return <MythicStatAbbrev stat={option.type} textClassName={textClassName} bubbleSide={bubbleSide} />;
};

const bubbleShell =
    'relative w-max max-w-[min(260px,calc(100vw-32px))] rounded-lg border border-red-600 bg-zinc-900 px-2 py-1.5 text-left shadow-2xl ring-1 ring-black/50';

export const MythicStatAbbrev: React.FC<{
    stat: MythicStat;
    textClassName?: string;
    bubbleSide?: 'top' | 'right';
}> = ({ stat, textClassName = '', bubbleSide = 'top' }) => {
    const data = MYTHIC_STATS_DATA[stat];
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [bubbleHover, setBubbleHover] = useState(false);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const showBubble = hovered || pressed || bubbleHover;

    useEffect(() => {
        if (!pressed) return;
        const end = () => setPressed(false);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        return () => {
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
        };
    }, [pressed]);

    return (
        <span
            ref={anchorRef}
            className="relative inline-flex max-w-full touch-manipulation"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onPointerDown={() => setPressed(true)}
        >
            <span className={`cursor-help select-none ${textClassName}`}>{data.abbrevLabel}</span>
            <PortalHoverBubble
                show={showBubble}
                anchorRef={anchorRef}
                placement={bubbleSide}
                className="pointer-events-auto"
                onBubblePointerEnter={() => setBubbleHover(true)}
                onBubblePointerLeave={() => setBubbleHover(false)}
            >
                <div className={bubbleShell}>
                    <span className="block text-[10px] font-bold text-red-200 mb-0.5">{data.name}</span>
                    <span className="block text-[9px] text-gray-100 leading-snug">{data.description}</span>
                    {data.shortDescription ? (
                        <span className="block text-[9px] text-gray-400 mt-1 leading-snug">{data.shortDescription}</span>
                    ) : null}
                    {bubbleSide === 'top' ? (
                        <>
                            <span
                                className="absolute left-1/2 top-full -translate-x-1/2 -mt-px block h-0 w-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-red-600"
                                aria-hidden
                            />
                            <span
                                className="absolute left-1/2 top-full -translate-x-1/2 mt-[-5px] block h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-zinc-900"
                                aria-hidden
                            />
                        </>
                    ) : (
                        <>
                            <span
                                className="absolute right-full top-1/2 -translate-y-1/2 -mr-px block h-0 w-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-red-600"
                                aria-hidden
                            />
                            <span
                                className="absolute right-full top-1/2 -translate-y-1/2 mr-[-5px] block h-0 w-0 border-y-[5px] border-y-transparent border-r-[5px] border-r-zinc-900"
                                aria-hidden
                            />
                        </>
                    )}
                </div>
            </PortalHoverBubble>
        </span>
    );
};
