import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameRecord, Player } from '../../types.js';
import SgfViewer, { parseSgf } from '../SgfViewer.js';

export interface GameRecordBoardMinimapProps {
    record: GameRecord;
    className?: string;
    /** sideRail: 대국 정보 패널 우측·세로 높이 맞춤 / fullWidth: 가로 전체 폭 */
    layout?: 'sideRail' | 'fullWidth';
}

/** 모바일 대국 정보 패널용 — 최종 국면 미니 기보판 */
const GameRecordBoardMinimap: React.FC<GameRecordBoardMinimapProps> = ({
    record,
    className = '',
    layout = 'sideRail',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [boardPx, setBoardPx] = useState(72);
    const isSideRail = layout === 'sideRail';

    const parsed = useMemo(() => parseSgf(record.sgfContent), [record.sgfContent]);
    const totalMoves = parsed?.moves.length ?? 0;
    const isRotated = record.myColor === Player.White;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
            const side = isSideRail ? Math.min(width, height) : width;
            if (side > 0) setBoardPx(Math.max(isSideRail ? 56 : 72, Math.floor(side)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [record.id, isSideRail]);

    const shellClass = isSideRail
        ? 'relative h-full max-h-full aspect-square w-auto shrink-0 min-h-[4.25rem] max-w-[5.75rem]'
        : 'relative aspect-square w-full';

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden rounded-lg border border-amber-500/25 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${shellClass} ${className}`}
            aria-hidden
        >
            {parsed && totalMoves > 0 ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <SgfViewer
                        timeElapsed={0}
                        fileIndex={null}
                        showLastMoveOnly={false}
                        sgfContent={record.sgfContent}
                        isRotated={isRotated}
                        replayMoveCount={totalMoves}
                        boardSizePx={boardPx}
                    />
                </div>
            ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-slate-500">—</div>
            )}
        </div>
    );
};

export default GameRecordBoardMinimap;
