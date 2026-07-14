import React from 'react';
import type { AdventureStageId } from '../../constants/adventureConstants.js';
import { ADVENTURE_MAP_THEMES } from '../../constants/adventureConstants.js';

type Props = {
    stageId: AdventureStageId;
    mapWebp: string;
    /** 풀 환경 모션 (스테이지 맵). false면 정적 커버만 */
    animated?: boolean;
    className?: string;
    imgClassName?: string;
};

/**
 * 모험 맵 배경 — 시네마틱 베이스 + 스테이지별 환경 모션(바람·물·빛).
 * 전투/로비는 animated=false 권장.
 */
export const AdventureMapBackdrop: React.FC<Props> = ({
    stageId,
    mapWebp,
    animated = true,
    className = '',
    imgClassName = '',
}) => {
    const theme = ADVENTURE_MAP_THEMES[stageId];
    const gridStyle: React.CSSProperties = {
        backgroundImage: `
            linear-gradient(to right, ${theme.gridColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${theme.gridColor} 1px, transparent 1px)
        `,
        backgroundSize: '28px 28px',
    };

    return (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`.trim()} aria-hidden>
            <div
                className={[
                    'absolute inset-0 z-0',
                    animated ? 'adventure-map-kenburns' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                <img
                    src={mapWebp}
                    alt=""
                    className={`h-full w-full object-cover ${imgClassName}`.trim()}
                    draggable={false}
                    decoding="async"
                />
            </div>

            <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/25 via-transparent to-black/45" />
            <div className="absolute inset-0 z-[1] opacity-[0.35]" style={gridStyle} />
            <div
                className="absolute inset-0 z-[1] opacity-40 mix-blend-soft-light"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 55% at 70% 30%, rgba(255,255,255,0.14), transparent 55%), radial-gradient(ellipse 60% 45% at 20% 75%, rgba(0,0,0,0.4), transparent 50%)',
                }}
            />
            <div
                className="absolute inset-0 z-[1]"
                style={{
                    background: `linear-gradient(to bottom, ${theme.fog} 0%, transparent 35%, transparent 65%, ${theme.fog} 100%)`,
                }}
            />

            {animated ? <StageFx stageId={stageId} /> : null}
        </div>
    );
};

function StageFx({ stageId }: { stageId: AdventureStageId }) {
    switch (stageId) {
        case 'neighborhood_hill':
            return (
                <>
                    <div className="adventure-map-fx-leaves absolute inset-0 z-[2]" />
                    <div className="adventure-map-fx-canopy absolute inset-0 z-[2] mix-blend-soft-light" />
                </>
            );
        case 'lake_park':
            return (
                <>
                    <div className="adventure-map-fx-water absolute inset-0 z-[2]" />
                    <div className="adventure-map-fx-water-shimmer absolute inset-0 z-[2] mix-blend-soft-light" />
                </>
            );
        case 'aquarium':
            return (
                <>
                    <div className="adventure-map-fx-caustic absolute inset-0 z-[2] mix-blend-screen" />
                    <div className="adventure-map-fx-bubbles absolute inset-0 z-[2]" />
                </>
            );
        case 'zoo':
            return (
                <>
                    <div className="adventure-map-fx-motes absolute inset-0 z-[2]" />
                    <div className="adventure-map-fx-haze absolute inset-0 z-[2]" />
                </>
            );
        case 'amusement_park':
            return (
                <>
                    <div className="adventure-map-fx-sparkle absolute inset-0 z-[2] mix-blend-screen" />
                    <div className="adventure-map-fx-light-sweep absolute inset-0 z-[2] mix-blend-soft-light" />
                </>
            );
        default:
            return null;
    }
}

export default AdventureMapBackdrop;
