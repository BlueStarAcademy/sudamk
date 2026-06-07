import React from 'react';
import { Player } from '../../types.js';

export type GoStoneSvgIds = {
    slateHighlight: string;
    clamshellHighlight: string;
    clamGrain: string;
    clamGrainFilter: string;
};

export function useGoStoneSvgIds(): GoStoneSvgIds {
    const uid = React.useId().replace(/:/g, '');
    return {
        slateHighlight: `go-stone-slate-${uid}`,
        clamshellHighlight: `go-stone-clam-hl-${uid}`,
        clamGrain: `go-stone-clam-grain-${uid}`,
        clamGrainFilter: `go-stone-clam-filter-${uid}`,
    };
}

/** 경기장 GoBoard와 동일한 입체형 바둑돌 SVG defs */
export const GoStoneSvgDefs: React.FC<{ ids: GoStoneSvgIds }> = ({ ids }) => (
    <defs>
        <radialGradient id={ids.slateHighlight} cx="35%" cy="35%" r="60%" fx="30%" fy="30%">
            <stop offset="0%" stopColor="#6b7280" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#111827" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id={ids.clamshellHighlight} cx="35%" cy="35%" r="60%" fx="30%" fy="30%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.1" />
        </radialGradient>
        <filter id={ids.clamGrainFilter}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.1 0" />
        </filter>
        <pattern id={ids.clamGrain} patternUnits="userSpaceOnUse" width="100" height="100">
            <rect width="100" height="100" fill="#f5f2e8" />
            <rect width="100" height="100" filter={`url(#${ids.clamGrainFilter})`} />
        </pattern>
    </defs>
);

export const GoStoneSvgLayers: React.FC<{
    player: Player.Black | Player.White;
    cx: number;
    cy: number;
    radius: number;
    ids: GoStoneSvgIds;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
}> = ({ player, cx, cy, radius, ids, stroke, strokeWidth = 0, opacity = 1 }) => (
    <g opacity={opacity}>
        <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill={player === Player.Black ? '#111827' : '#f5f2e8'}
            stroke={stroke}
            strokeWidth={strokeWidth}
        />
        {player === Player.White && (
            <circle cx={cx} cy={cy} r={radius} fill={`url(#${ids.clamGrain})`} />
        )}
        <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill={
                player === Player.Black
                    ? `url(#${ids.slateHighlight})`
                    : `url(#${ids.clamshellHighlight})`
            }
        />
    </g>
);
