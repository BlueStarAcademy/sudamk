import React from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
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
        <radialGradient id={ids.slateHighlight} cx="32%" cy="30%" r="72%" fx="28%" fy="26%">
            <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.85" />
            <stop offset="42%" stopColor="#374151" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={ids.clamshellHighlight} cx="32%" cy="28%" r="74%" fx="30%" fy="26%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="28%" stopColor="#f8f5ec" />
            <stop offset="62%" stopColor="#d9d2c4" />
            <stop offset="100%" stopColor="#8f8778" />
        </radialGradient>
        <filter id={ids.clamGrainFilter} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.08 0" />
        </filter>
        <pattern id={ids.clamGrain} patternUnits="userSpaceOnUse" width="100" height="100">
            <rect width="100" height="100" fill="#f5f2e8" fillOpacity="0" />
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
            fill={player === Player.Black ? '#111827' : `url(#${ids.clamshellHighlight})`}
            stroke={
                stroke ??
                (player === Player.White ? 'rgba(15,23,42,0.18)' : undefined)
            }
            strokeWidth={
                stroke != null
                    ? strokeWidth
                    : player === Player.White
                      ? Math.max(0.6, radius * 0.04)
                      : 0
            }
        />
        {player === Player.White && (
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={`url(#${ids.clamGrain})`}
                opacity={0.45}
            />
        )}
        {player === Player.Black && (
            <circle cx={cx} cy={cy} r={radius} fill={`url(#${ids.slateHighlight})`} />
        )}
    </g>
);
