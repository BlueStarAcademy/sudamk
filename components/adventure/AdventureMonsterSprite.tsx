import React from 'react';

function frameToGrid(frameIndex: number, cols: number, rows: number): { col: number; row: number } {
    const maxIndex = cols * rows - 1;
    const idx = Math.max(0, Math.min(frameIndex, maxIndex));
    return { col: idx % cols, row: Math.floor(idx / cols) };
}

/**
 * 스프라이트 시트에서 한 칸만 표시.
 * 부모 `overflow-hidden` + 시트를 `cols×rows`배 확대한 뒤 `translate`로 한 프레임만 맞춤 (옆 칸 비침 방지).
 */
export const AdventureMonsterSpriteFrame: React.FC<{
    sheetUrl: string;
    /** 행 우선, 0부터 */
    frameIndex: number;
    cols: number;
    rows: number;
    className?: string;
    imgClassName?: string;
    style?: React.CSSProperties;
}> = ({ sheetUrl, frameIndex, cols, rows, className = '', imgClassName = '', style }) => {
    const { col, row } = frameToGrid(frameIndex, cols, rows);
    const c = Math.max(1, Math.floor(cols));
    const r = Math.max(1, Math.floor(rows));
    return (
        <div className={`overflow-hidden [contain:strict] ${className}`.trim()} style={style}>
            <img
                src={sheetUrl}
                alt=""
                draggable={false}
                className={`block max-h-none max-w-none select-none ${imgClassName}`.trim()}
                style={{
                    width: `${c * 100}%`,
                    height: `${r * 100}%`,
                    objectFit: 'fill',
                    transform: `translate(-${(col / c) * 100}%, -${(row / r) * 100}%)`,
                }}
            />
        </div>
    );
};
