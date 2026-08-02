import React from 'react';

export type FantasyRankPlace = 1 | 2 | 3;
export type FantasyRankBadgeSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<FantasyRankBadgeSize, number> = {
    xs: 18,
    sm: 28,
    md: 36,
    lg: 46,
};

type RankTheme = {
    rim: [string, string, string, string];
    plate: [string, string, string, string];
    gem: string;
    gemEdge: string;
    text: string;
    textShadow: string;
    glow: string;
    label: string;
};

const RANK_THEME: Record<FantasyRankPlace, RankTheme> = {
    1: {
        rim: ['#fff8d6', '#f0d060', '#b8860b', '#6b4e0a'],
        plate: ['#fff3a8', '#ffd54a', '#e0a800', '#9a6b00'],
        gem: '#7dd3fc',
        gemEdge: '#0369a1',
        text: '#3b2410',
        textShadow: '0 1px 0 rgba(255,245,200,0.75)',
        glow: 'drop-shadow(0 0 7px rgba(251,191,36,0.72)) drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
        label: '1st place',
    },
    2: {
        rim: ['#f8fafc', '#c9d4e0', '#7b8ea3', '#3f4d5c'],
        plate: ['#f1f5f9', '#cbd5e1', '#94a3b8', '#64748b'],
        gem: '#a5b4fc',
        gemEdge: '#4338ca',
        text: '#1e293b',
        textShadow: '0 1px 0 rgba(255,255,255,0.7)',
        glow: 'drop-shadow(0 0 6px rgba(148,163,184,0.55)) drop-shadow(0 2px 3px rgba(0,0,0,0.45))',
        label: '2nd place',
    },
    3: {
        rim: ['#ffd7b0', '#d97706', '#9a3412', '#5c1d0e'],
        plate: ['#fdba74', '#ea580c', '#c2410c', '#7c2d12'],
        gem: '#fcd34d',
        gemEdge: '#b45309',
        text: '#fff7ed',
        textShadow: '0 1px 1px rgba(0,0,0,0.55)',
        glow: 'drop-shadow(0 0 6px rgba(249,115,22,0.5)) drop-shadow(0 2px 3px rgba(0,0,0,0.45))',
        label: '3rd place',
    },
};

export function isFantasyRankPlace(rank: number): rank is FantasyRankPlace {
    return rank === 1 || rank === 2 || rank === 3;
}

interface FantasyRankBadgeProps {
    place: FantasyRankPlace;
    size?: FantasyRankBadgeSize;
    className?: string;
}

/** 랭킹 1–3위용 판타지 메달리온 뱃지 */
const FantasyRankBadge: React.FC<FantasyRankBadgeProps> = ({ place, size = 'md', className = '' }) => {
    const theme = RANK_THEME[place];
    const px = SIZE_PX[size];
    const reactId = React.useId().replace(/:/g, '');
    const uid = `frb-${place}-${reactId}`;

    return (
        <span
            className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
            style={{ width: px, height: px, filter: theme.glow }}
            role="img"
            aria-label={theme.label}
        >
            <svg viewBox="0 0 64 64" width={px} height={px} className="block overflow-visible" aria-hidden>
                <defs>
                    <linearGradient id={`${uid}-rim`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={theme.rim[0]} />
                        <stop offset="35%" stopColor={theme.rim[1]} />
                        <stop offset="70%" stopColor={theme.rim[2]} />
                        <stop offset="100%" stopColor={theme.rim[3]} />
                    </linearGradient>
                    <radialGradient id={`${uid}-plate`} cx="38%" cy="32%" r="68%">
                        <stop offset="0%" stopColor={theme.plate[0]} />
                        <stop offset="42%" stopColor={theme.plate[1]} />
                        <stop offset="78%" stopColor={theme.plate[2]} />
                        <stop offset="100%" stopColor={theme.plate[3]} />
                    </radialGradient>
                    <linearGradient id={`${uid}-shine`} x1="18" y1="10" x2="46" y2="40" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
                        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id={`${uid}-gem`} x1="28" y1="6" x2="36" y2="16" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="45%" stopColor={theme.gem} />
                        <stop offset="100%" stopColor={theme.gemEdge} />
                    </linearGradient>
                </defs>

                {/* 외곽 장식 링 */}
                <circle cx="32" cy="34" r="27" fill={`url(#${uid}-rim)`} />
                <circle cx="32" cy="34" r="27" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
                {/* 톱니 느낌 포인트 */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const x = 32 + Math.cos(rad) * 27.2;
                    const y = 34 + Math.sin(rad) * 27.2;
                    return <circle key={deg} cx={x} cy={y} r="2.1" fill={`url(#${uid}-rim)`} stroke="rgba(0,0,0,0.28)" strokeWidth="0.5" />;
                })}

                {/* 내부 플레이트 */}
                <circle cx="32" cy="34" r="20.5" fill={`url(#${uid}-plate)`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                <circle cx="32" cy="34" r="17.5" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
                <ellipse cx="26" cy="26" rx="10" ry="7" fill={`url(#${uid}-shine)`} />

                {/* 1위 왕관 */}
                {place === 1 && (
                    <g transform="translate(20, 2)">
                        <path
                            d="M2 14 L6 5 L12 11 L18 4 L22 14 Z"
                            fill={`url(#${uid}-rim)`}
                            stroke="rgba(80,50,0,0.55)"
                            strokeWidth="0.8"
                            strokeLinejoin="round"
                        />
                        <circle cx="6" cy="5" r="1.5" fill={`url(#${uid}-gem)`} />
                        <circle cx="12" cy="10" r="1.3" fill={`url(#${uid}-gem)`} />
                        <circle cx="18" cy="4" r="1.5" fill={`url(#${uid}-gem)`} />
                    </g>
                )}

                {/* 상단 보석 */}
                {place !== 1 && (
                    <circle cx="32" cy="12" r="3.2" fill={`url(#${uid}-gem)`} stroke={theme.gemEdge} strokeWidth="0.7" />
                )}

                <text
                    x="32"
                    y="38.5"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={place === 1 ? 22 : 20}
                    fontWeight="900"
                    fill={theme.text}
                    style={{ textShadow: theme.textShadow, fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                    {place}
                </text>
            </svg>
        </span>
    );
};

interface RankPlaceMarkProps {
    rank: number;
    size?: FantasyRankBadgeSize;
    /** 1–3위가 아닐 때 숫자/대시 스타일 */
    fallbackClassName?: string;
    dashPlaceholder?: boolean;
    className?: string;
}

/** 1–3위는 판타지 뱃지, 그 외는 숫자(또는 -) */
export const RankPlaceMark: React.FC<RankPlaceMarkProps> = ({
    rank,
    size = 'md',
    fallbackClassName = '',
    dashPlaceholder = false,
    className = '',
}) => {
    if (dashPlaceholder) {
        return <span className={fallbackClassName}>-</span>;
    }
    if (isFantasyRankPlace(rank)) {
        return <FantasyRankBadge place={rank} size={size} className={className} />;
    }
    return <span className={fallbackClassName}>{rank}</span>;
};

export default FantasyRankBadge;
