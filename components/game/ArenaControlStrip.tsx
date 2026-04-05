import React from 'react';

function flattenChildren(children: React.ReactNode): React.ReactNode[] {
    return React.Children.toArray(children).filter((c) => c != null && typeof c !== 'boolean');
}

/**
 * - grid: 자식 개수만큼 균등 열(1행) — 각 칸 중앙 정렬.
 * - cluster: 자식을 한 덩어리로 묶어 가로 중앙(필요 시 줄바꿈) — 대국/특수 패널 등에 사용.
 */
export const ArenaControlStrip: React.FC<{
    children: React.ReactNode;
    className?: string;
    gapClass?: string;
    layout?: 'grid' | 'cluster';
}> = ({ children, className = '', gapClass = 'gap-2 sm:gap-3', layout = 'grid' }) => {
    const nodes = flattenChildren(children);
    if (nodes.length === 0) return null;
    if (layout === 'cluster') {
        return (
            <div className={`flex w-full min-w-0 flex-wrap items-center justify-center ${gapClass} ${className}`}>
                {nodes.map((child, i) => (
                    <div key={i} className="flex shrink-0 items-center justify-center">
                        {child}
                    </div>
                ))}
            </div>
        );
    }
    const n = nodes.length;
    return (
        <div
            className={`grid w-full min-w-0 ${gapClass} ${className}`}
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
            {nodes.map((child, i) => (
                <div key={i} className="flex min-h-0 min-w-0 items-center justify-center">
                    {child}
                </div>
            ))}
        </div>
    );
};

/** 고정 열 수 (주사위 아이템 4칸, 도둑 2칸 등) */
export const ArenaFixedColsGrid: React.FC<{
    cols: number;
    children: React.ReactNode;
    className?: string;
    gapClass?: string;
}> = ({ cols, children, className = '', gapClass = 'gap-2 sm:gap-3' }) => {
    const nodes = flattenChildren(children);
    if (nodes.length === 0) return null;
    const c = Math.max(1, cols);
    return (
        <div
            className={`grid w-full min-w-0 ${gapClass} ${className}`}
            style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))` }}
        >
            {nodes.map((child, i) => (
                <div key={i} className="flex min-h-0 min-w-0 items-center justify-center">
                    {child}
                </div>
            ))}
        </div>
    );
};
