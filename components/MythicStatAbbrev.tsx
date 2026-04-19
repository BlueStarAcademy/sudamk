import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MythicStat } from '../types/enums.js';
import { ItemOption } from '../types.js';
import { MYTHIC_STATS_DATA } from '../constants';
import { PortalHoverBubble } from './PortalHoverBubble.js';

const MYTHIC_SET = new Set<string>(Object.values(MythicStat));

export function isMythicStatType(type: string): type is MythicStat {
    return MYTHIC_SET.has(type);
}

/** 장비에 붙은 스페셜 옵션 한 줄: 약식 표기, 클릭 시 상세 말풍선 */
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
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const bubbleMountRef = useRef<HTMLDivElement | null>(null);

    const toggle = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onDocDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (anchorRef.current?.contains(t)) return;
            if (bubbleMountRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <span ref={anchorRef} className="relative inline-flex max-w-full touch-manipulation">
            <span
                role="button"
                tabIndex={0}
                aria-expanded={open}
                aria-label={`${data.name} 상세`}
                className={`cursor-pointer select-none border-b border-dotted border-current/40 underline-offset-2 ${textClassName}`}
                onClick={toggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen((v) => !v);
                    }
                }}
            >
                {data.abbrevLabel}
            </span>
            <PortalHoverBubble
                show={open}
                anchorRef={anchorRef}
                placement={bubbleSide}
                className="pointer-events-auto"
                bubbleMountRef={bubbleMountRef}
            >
                <div className={bubbleShell}>
                    <span className="mb-0.5 block text-[10px] font-bold text-red-200">{data.name}</span>
                    <span className="block text-[9px] leading-snug text-gray-100">{data.description}</span>
                    {data.shortDescription ? (
                        <span className="mt-1 block text-[9px] leading-snug text-gray-400">{data.shortDescription}</span>
                    ) : null}
                    {bubbleSide === 'top' ? (
                        <>
                            <span
                                className="absolute left-1/2 top-full -mt-px block h-0 w-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-red-600"
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
