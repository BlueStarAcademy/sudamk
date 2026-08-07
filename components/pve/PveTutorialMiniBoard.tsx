import React, { useMemo } from 'react';
import type { PveTutorialStone } from '../../shared/constants/pveTutorials.js';
import { BLACK_HIDDEN_STONE_IMG } from '../../assets.js';

type Props = {
    boardSize: number;
    stones: PveTutorialStone[];
    highlight?: { x: number; y: number } | null;
    /** 계가 연출: 확정 집(빈 칸) 색 표시 */
    territory?: PveTutorialStone[] | null;
    interactive?: boolean;
    /** true면 하이라이트된 돌(점유 칸)도 클릭 가능 — 미사일 돌 선택 */
    allowSelectOccupied?: boolean;
    onCellClick?: (x: number, y: number) => void;
    className?: string;
};

/** 튜토리얼 전용 경량 바둑판 */
const PveTutorialMiniBoard: React.FC<Props> = ({
    boardSize,
    stones,
    highlight = null,
    territory = null,
    interactive = false,
    allowSelectOccupied = false,
    onCellClick,
    className = '',
}) => {
    const occupied = useMemo(() => {
        const m = new Map<string, PveTutorialStone>();
        for (const s of stones) m.set(`${s.x},${s.y}`, s);
        return m;
    }, [stones]);

    const territoryMap = useMemo(() => {
        const m = new Map<string, PveTutorialStone['color']>();
        if (!territory) return m;
        for (const t of territory) m.set(`${t.x},${t.y}`, t.color);
        return m;
    }, [territory]);

    const cells = useMemo(() => {
        const out: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) out.push({ x, y });
        }
        return out;
    }, [boardSize]);

    const gridTemplate = `repeat(${boardSize}, minmax(0, 1fr))`;
    // 교차점 = 각 셀 중심: 반칸 inset + (N-1)/N 크기
    const gridInsetPct = 100 / (2 * boardSize);
    const gridSpanPct = (100 * (boardSize - 1)) / boardSize;

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
                {/* 격자선 — 돌/셀 중심과 교차점 정렬 */}
                <svg
                    className="pointer-events-none absolute text-amber-950/55"
                    style={{
                        left: `${gridInsetPct}%`,
                        top: `${gridInsetPct}%`,
                        width: `${gridSpanPct}%`,
                        height: `${gridSpanPct}%`,
                    }}
                    viewBox={`0 0 ${boardSize - 1} ${boardSize - 1}`}
                    preserveAspectRatio="none"
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
                    const stone = occupied.get(`${x},${y}`);
                    const color = stone?.color;
                    const terr = !color ? territoryMap.get(`${x},${y}`) : undefined;
                    const isHi = highlight != null && highlight.x === x && highlight.y === y;
                    const canClick =
                        interactive && isHi && (!color || (allowSelectOccupied && Boolean(color)));
                    const showHiddenMark = Boolean(stone?.hiddenMark || stone?.hiddenMine || stone?.scanned);
                    const patternSrc =
                        stone?.pattern && color
                            ? color === 'B'
                                ? '/images/single/BlackDouble.webp'
                                : '/images/single/WhiteDouble.webp'
                            : null;
                    return (
                        <button
                            key={`${x}-${y}`}
                            type="button"
                            disabled={!canClick}
                            onClick={() => onCellClick?.(x, y)}
                            className={`relative z-[1] flex items-center justify-center rounded-sm ${
                                canClick ? 'cursor-pointer' : 'cursor-default'
                            }`}
                            aria-label={canClick ? (color ? `select ${x},${y}` : `place ${x},${y}`) : undefined}
                        >
                            {terr ? (
                                <span
                                    className={`absolute inset-[12%] rounded-sm transition-opacity duration-500 ${
                                        terr === 'B'
                                            ? 'bg-zinc-900/45 ring-1 ring-inset ring-zinc-950/40'
                                            : 'bg-white/55 ring-1 ring-inset ring-white/70'
                                    }`}
                                    aria-hidden
                                />
                            ) : null}
                            {isHi && !color ? (
                                <span className="absolute h-[72%] w-[72%] animate-pulse rounded-full bg-emerald-400/45 ring-2 ring-emerald-300/80" />
                            ) : null}
                            {color ? (
                                <span
                                    className={`relative flex h-[86%] w-[86%] items-center justify-center overflow-hidden rounded-full shadow-md transition-transform duration-200 ${
                                        color === 'B'
                                            ? 'bg-gradient-to-br from-zinc-700 to-black'
                                            : 'bg-gradient-to-br from-white to-zinc-200'
                                    } ${isHi ? 'scale-105 animate-pulse ring-2 ring-amber-300' : ''} ${
                                        stone?.pattern ? 'ring-2 ring-cyan-300/90' : ''
                                    } ${stone?.hiddenMine ? 'opacity-55' : ''} ${
                                        stone?.scanned ? 'opacity-55' : ''
                                    }`}
                                >
                                    {patternSrc ? (
                                        <img
                                            src={patternSrc}
                                            alt=""
                                            className="h-[70%] w-[70%] object-contain"
                                            draggable={false}
                                        />
                                    ) : null}
                                    {showHiddenMark ? (
                                        <img
                                            src={BLACK_HIDDEN_STONE_IMG}
                                            alt=""
                                            className="pointer-events-none absolute h-[70%] w-[70%] object-contain"
                                            draggable={false}
                                        />
                                    ) : null}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PveTutorialMiniBoard;
