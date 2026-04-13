import React from 'react';
import { useResilientImgSrc } from '../../hooks/useResilientImgSrc.js';

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
    /**
     * 어두운 맵 위에서 알파가 강한 웹P가 묻히지 않도록 발 밑부근에 은은한 밝은 타원 + 대비 보정.
     * (도감 등 밝은 배경에서는 false 권장)
     */
    softBackdrop?: boolean;
}> = ({ sheetUrl, frameIndex, cols, rows, className = '', imgClassName = '', style, softBackdrop = false }) => {
    const { src, onError } = useResilientImgSrc(sheetUrl);
    const { col, row } = frameToGrid(frameIndex, cols, rows);
    const c = Math.max(1, Math.floor(cols));
    const r = Math.max(1, Math.floor(rows));
    const singleCell = c === 1 && r === 1;
    /** GPU 일부 환경에서 img+filter 합성 시 깜빡임·깨짐이 나와 drop-shadow만 유지 */
    const softImgFilter = softBackdrop ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.88))' : undefined;
    if (singleCell) {
        return (
            <div className={`relative overflow-hidden ${className}`.trim()} style={style}>
                {softBackdrop ? (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0 scale-[1.02]"
                        style={{
                            background:
                                'radial-gradient(ellipse 78% 72% at 50% 86%, rgba(255,252,245,0.58) 0%, rgba(255,255,255,0.18) 38%, transparent 70%)',
                        }}
                    />
                ) : null}
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    className={`pointer-events-none absolute left-1/2 top-1/2 z-[1] max-h-full max-w-full select-none object-contain ${imgClassName}`.trim()}
                    style={{
                        transform: 'translate3d(-50%, -50%, 0)',
                        ...(softImgFilter ? { filter: softImgFilter } : {}),
                    }}
                    onError={onError}
                />
            </div>
        );
    }
    return (
        <div className={`relative overflow-hidden [contain:strict] ${className}`.trim()} style={style}>
            {softBackdrop ? (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0 scale-[1.02]"
                    style={{
                        background:
                            'radial-gradient(ellipse 78% 72% at 50% 86%, rgba(255,252,245,0.58) 0%, rgba(255,255,255,0.18) 38%, transparent 70%)',
                    }}
                />
            ) : null}
            <img
                src={src}
                alt=""
                draggable={false}
                loading="eager"
                decoding="async"
                className={`relative z-[1] block max-h-none max-w-none select-none ${imgClassName}`.trim()}
                style={{
                    width: `${c * 100}%`,
                    height: `${r * 100}%`,
                    objectFit: 'fill',
                    transform: `translate3d(-${(col / c) * 100}%, -${(row / r) * 100}%, 0)`,
                    ...(softImgFilter ? { filter: softImgFilter } : {}),
                }}
                onError={onError}
            />
        </div>
    );
};
