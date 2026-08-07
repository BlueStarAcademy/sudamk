import React, { useMemo } from 'react';
import type { PveTutorialStone } from '../../shared/constants/pveTutorials.js';

type Props = {
    boardSize: number;
    stones: PveTutorialStone[];
    highlight?: { x: number; y: number } | null;
    interactive?: boolean;
    onCellClick?: (x: number, y: number) => void;
    className?: string;
};

/** 튜토리얼 전용 경량 바둑판 */
const PveTutorialMiniBoard: React.FC<Props> = ({
    boardSize,
    stones,
    highlight = null,
    interactive = false,
    onCellClick,
    className = '',
}) => {
    const occupied = useMemo(() => {
        const m = new Map<string, PveTutorialStone['color']>();
        for (const s of stones) m.set(`${s.x},${s.y}`, s.color);
        return m;
    }, [stones]);

    const cells = useMemo(() => {
        const out: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) out.push({ x, y });
        }
        return out;
    }, [boardSize]);

    const gridTemplate = `repeat(${boardSize}, minmax(0, 1fr))`;

    return (
        <div
            className={`relative mx-auto aspect-square w-full max-w-[17.5rem] rounded-xl border-2 border-amber-700/50 bg-[#d4a574] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_28px_-12px_rgba(0,0,0,0.55)] sm:max-w-[19rem] ${className}`}
            role="img"
            aria-label="tutorial board"
        >
            <div
                className="relative grid h-full w-full gap-0"
                style={{ gridTemplateColumns: gridTemplate, gridTemplateRows: gridTemplate }}
            >
                {/* 격자선 */}
                <svg
                    className="pointer-events-none absolute inset-[6%] h-[88%] w-[88%] text-amber-950/55"
                    viewBox={`0 0 ${boardSize - 1} ${boardSize - 1}`}
                    aria-hidden
                >
                    {Array.from({ length: boardSize }, (_, i) => (
                        <React.Fragment key={i}>
                            <line x1={0} y1={i} x2={boardSize - 1} y2={i} stroke="currentColor" strokeWidth={0.04} />
                            <line x1={i} y1={0} x2={i} y2={boardSize - 1} stroke="currentColor" strokeWidth={0.04} />
                        </React.Fragment>
                    ))}
                </svg>

                {cells.map(({ x, y }) => {
                    const color = occupied.get(`${x},${y}`);
                    const isHi = highlight != null && highlight.x === x && highlight.y === y;
                    const canClick = interactive && !color && isHi;
                    return (
                        <button
                            key={`${x}-${y}`}
                            type="button"
                            disabled={!canClick}
                            onClick={() => onCellClick?.(x, y)}
                            className={`relative z-[1] flex items-center justify-center rounded-sm ${
                                canClick ? 'cursor-pointer' : 'cursor-default'
                            }`}
                            aria-label={canClick ? `place ${x},${y}` : undefined}
                        >
                            {isHi && !color ? (
                                <span className="absolute h-[72%] w-[72%] animate-pulse rounded-full bg-emerald-400/45 ring-2 ring-emerald-300/80" />
                            ) : null}
                            {color ? (
                                <span
                                    className={`relative h-[86%] w-[86%] rounded-full shadow-md transition-transform duration-200 ${
                                        color === 'B'
                                            ? 'bg-gradient-to-br from-zinc-700 to-black'
                                            : 'bg-gradient-to-br from-white to-zinc-200'
                                    } ${isHi ? 'scale-105 ring-2 ring-amber-300' : ''}`}
                                />
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PveTutorialMiniBoard;
