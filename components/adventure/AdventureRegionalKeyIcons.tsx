import React, { useId } from 'react';
import type { AdventureStageId } from '../../constants/adventureConstants.js';

type IconSizeProps = {
    compact?: boolean;
    className?: string;
};

function boxClass(compact: boolean | undefined, tall?: boolean): string {
    if (tall) {
        return compact
            ? 'h-5 max-h-5 w-auto aspect-[40/48] sm:h-6 sm:max-h-6'
            : 'h-6 max-h-6 w-auto aspect-[40/48] sm:h-7 sm:max-h-7';
    }
    return compact
        ? 'h-5 max-h-5 w-auto aspect-square sm:h-6 sm:max-h-6'
        : 'h-6 max-h-6 w-auto aspect-square sm:h-7 sm:max-h-7';
}

function rewardBoxClass(compact: boolean | undefined): string {
    return compact
        ? 'h-6 max-h-6 w-auto aspect-[40/48]'
        : 'h-9 max-h-9 w-auto aspect-[40/48] min-[1024px]:h-10 min-[1024px]:max-h-10';
}

/** 진행 바·악센트용 지역 팔레트 */
export const ADVENTURE_REGIONAL_KEY_THEME: Record<
    AdventureStageId,
    { barFrom: string; barVia: string; barTo: string; accent: string }
> = {
    neighborhood_hill: {
        barFrom: '#166534',
        barVia: '#4ade80',
        barTo: '#bbf7d0',
        accent: '#86efac',
    },
    lake_park: {
        barFrom: '#1e40af',
        barVia: '#38bdf8',
        barTo: '#e0f2fe',
        accent: '#7dd3fc',
    },
    aquarium: {
        barFrom: '#0f766e',
        barVia: '#2dd4bf',
        barTo: '#ccfbf1',
        accent: '#5eead4',
    },
    zoo: {
        barFrom: '#9a3412',
        barVia: '#fb923c',
        barTo: '#ffedd5',
        accent: '#fdba74',
    },
    amusement_park: {
        barFrom: '#9d174d',
        barVia: '#f472b6',
        barTo: '#fce7f3',
        accent: '#f9a8d4',
    },
};

function KeySvg({ stageId, uid }: { stageId: AdventureStageId; uid: string }) {
    const g = `${uid}-k`;
    switch (stageId) {
        case 'lake_park':
            return (
                <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="20%" y1="10%" x2="80%" y2="90%">
                            <stop offset="0%" stopColor="#e0f2fe" />
                            <stop offset="45%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                    </defs>
                    <circle cx="14" cy="15" r="7.2" fill={`url(#${g}-fill)`} stroke="#0c4a6e" strokeWidth="1.1" />
                    <circle cx="14" cy="15" r="2.6" fill="#082f49" />
                    <path
                        d="M20.5 17.5 L32 17.5 Q34 17.5 34 19.5 L34 21 Q34 23 32 23 L28 23 L28 26.5 Q28 28 26 28 L24.2 28 Q22.4 28 22.4 26.5 L22.4 23 L20.5 23 Q18.8 23 18.8 21.2 L18.8 19.5 Q18.8 17.5 20.5 17.5 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#0c4a6e"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                    <path d="M8 30 Q14 27 20 30 Q26 33 32 29" fill="none" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
                </svg>
            );
        case 'aquarium':
            return (
                <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="15%" y1="5%" x2="85%" y2="95%">
                            <stop offset="0%" stopColor="#ccfbf1" />
                            <stop offset="40%" stopColor="#2dd4bf" />
                            <stop offset="100%" stopColor="#0f766e" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M13 9.5 C18 7 23 9.5 24.5 14.5 C26 19.5 22.5 23.5 17.5 24.5 C12.5 25.5 8.5 22.5 8 17.5 C7.5 12.5 9.5 11 13 9.5 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#115e59"
                        strokeWidth="1.05"
                    />
                    <circle cx="14.2" cy="15.5" r="2.2" fill="#134e4a" />
                    <path
                        d="M22 18 L33 18 Q35 18 35 20 L35 21.5 Q35 23.5 33 23.5 L29.5 23.5 L29.5 27 Q29.5 28.5 28 28.5 L26.2 28.5 Q24.8 28.5 24.8 27 L24.8 23.5 L22.2 23.5 Q20.5 23.5 20.5 21.8 L20.5 20 Q20.5 18 22 18 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#115e59"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                    <circle cx="31" cy="11" r="1.3" fill="#99f6e4" opacity="0.9" />
                    <circle cx="27" cy="8.5" r="0.9" fill="#5eead4" opacity="0.75" />
                </svg>
            );
        case 'zoo':
            return (
                <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="18%" y1="8%" x2="82%" y2="92%">
                            <stop offset="0%" stopColor="#ffedd5" />
                            <stop offset="40%" stopColor="#fb923c" />
                            <stop offset="100%" stopColor="#9a3412" />
                        </linearGradient>
                    </defs>
                    <ellipse cx="14" cy="15" rx="7.4" ry="7" fill={`url(#${g}-fill)`} stroke="#7c2d12" strokeWidth="1.1" />
                    <circle cx="11.2" cy="13.2" r="1.5" fill="#431407" />
                    <circle cx="16.8" cy="13.2" r="1.5" fill="#431407" />
                    <ellipse cx="14" cy="17.2" rx="2.1" ry="1.5" fill="#431407" />
                    <path
                        d="M20.2 17.2 L32.2 17.2 Q34.2 17.2 34.2 19.2 L34.2 20.8 Q34.2 22.8 32.2 22.8 L28.5 22.8 L28.5 26.5 Q28.5 28.2 26.8 28.2 L25 28.2 Q23.3 28.2 23.3 26.5 L23.3 22.8 L20.5 22.8 Q18.7 22.8 18.7 21 L18.7 19.2 Q18.7 17.2 20.2 17.2 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#7c2d12"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                </svg>
            );
        case 'amusement_park':
            return (
                <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="20%" y1="5%" x2="80%" y2="95%">
                            <stop offset="0%" stopColor="#fce7f3" />
                            <stop offset="35%" stopColor="#f472b6" />
                            <stop offset="70%" stopColor="#db2777" />
                            <stop offset="100%" stopColor="#831843" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M14 7.5 L15.6 12.2 L20.5 12.2 L16.6 15.1 L18.1 19.8 L14 16.9 L9.9 19.8 L11.4 15.1 L7.5 12.2 L12.4 12.2 Z"
                        fill="#fde68a"
                        stroke="#a16207"
                        strokeWidth="0.9"
                        strokeLinejoin="round"
                    />
                    <circle cx="14" cy="16.5" r="6.2" fill={`url(#${g}-fill)`} stroke="#9d174d" strokeWidth="1.05" />
                    <circle cx="14" cy="16.5" r="2.3" fill="#500724" />
                    <path
                        d="M20 18.5 L32.5 18.5 Q34.5 18.5 34.5 20.5 L34.5 22 Q34.5 24 32.5 24 L29 24 L29 27.8 Q29 29.5 27.2 29.5 L25.4 29.5 Q23.6 29.5 23.6 27.8 L23.6 24 L20.3 24 Q18.5 24 18.5 22.2 L18.5 20.5 Q18.5 18.5 20 18.5 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#9d174d"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                </svg>
            );
        case 'neighborhood_hill':
        default:
            return (
                <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="18%" y1="8%" x2="85%" y2="90%">
                            <stop offset="0%" stopColor="#dcfce7" />
                            <stop offset="40%" stopColor="#4ade80" />
                            <stop offset="75%" stopColor="#15803d" />
                            <stop offset="100%" stopColor="#3f2a14" />
                        </linearGradient>
                    </defs>
                    <circle cx="14" cy="15" r="7.3" fill={`url(#${g}-fill)`} stroke="#14532d" strokeWidth="1.1" />
                    <path d="M14 9.5 C16.5 11 17.5 13.5 17 16 C15.2 15.2 13.5 14.2 12.2 12.5 C13 11 13.5 10 14 9.5 Z" fill="#86efac" opacity="0.9" />
                    <circle cx="14" cy="15" r="2.5" fill="#14532d" />
                    <path
                        d="M20.3 17.3 L32.5 17.3 Q34.5 17.3 34.5 19.3 L34.5 21 Q34.5 23 32.5 23 L28.8 23 L28.8 26.8 Q28.8 28.5 27 28.5 L25.2 28.5 Q23.4 28.5 23.4 26.8 L23.4 23 L20.6 23 Q18.8 23 18.8 21.2 L18.8 19.3 Q18.8 17.3 20.3 17.3 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#14532d"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                </svg>
            );
    }
}

function FragmentSvg({ stageId, uid }: { stageId: AdventureStageId; uid: string }) {
    const g = `${uid}-f`;
    switch (stageId) {
        case 'lake_park':
            return (
                <svg viewBox="0 0 40 48" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="20%" y1="10%" x2="80%" y2="90%">
                            <stop offset="0%" stopColor="#e0f2fe" />
                            <stop offset="50%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#1e40af" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M20 10 C14 18 11 24 11 29 C11 34.5 15 38.5 20 38.5 C25 38.5 29 34.5 29 29 C29 24 26 18 20 10 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#0c4a6e"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                    <path d="M17 24 Q20 22 23 25" fill="none" stroke="#e0f2fe" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
                </svg>
            );
        case 'aquarium':
            return (
                <svg viewBox="0 0 40 48" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="15%" y1="8%" x2="85%" y2="92%">
                            <stop offset="0%" stopColor="#ccfbf1" />
                            <stop offset="45%" stopColor="#2dd4bf" />
                            <stop offset="100%" stopColor="#0f766e" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M20 11 C24 11 28 14.5 28.5 19.5 C29 24 26.5 28 22.5 30.5 L22.5 36.5 Q20 39 17.5 36.5 L17.5 30.5 C13.5 28 11 24 11.5 19.5 C12 14.5 16 11 20 11 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#115e59"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                    <path d="M16 20 Q20 17 24 20" fill="none" stroke="#99f6e4" strokeWidth="1.15" strokeLinecap="round" />
                    <path d="M15.5 24 Q20 21.5 24.5 24" fill="none" stroke="#5eead4" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
                </svg>
            );
        case 'zoo':
            return (
                <svg viewBox="0 0 40 48" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="20%" y1="10%" x2="80%" y2="90%">
                            <stop offset="0%" stopColor="#ffedd5" />
                            <stop offset="50%" stopColor="#fb923c" />
                            <stop offset="100%" stopColor="#9a3412" />
                        </linearGradient>
                    </defs>
                    <circle cx="14" cy="18" r="4.2" fill={`url(#${g}-fill)`} stroke="#7c2d12" strokeWidth="1" />
                    <circle cx="26" cy="18" r="4.2" fill={`url(#${g}-fill)`} stroke="#7c2d12" strokeWidth="1" />
                    <circle cx="11.5" cy="26.5" r="3.6" fill={`url(#${g}-fill)`} stroke="#7c2d12" strokeWidth="1" />
                    <circle cx="28.5" cy="26.5" r="3.6" fill={`url(#${g}-fill)`} stroke="#7c2d12" strokeWidth="1" />
                    <ellipse cx="20" cy="28" rx="7.5" ry="8.2" fill={`url(#${g}-fill)`} stroke="#7c2d12" strokeWidth="1.05" />
                </svg>
            );
        case 'amusement_park':
            return (
                <svg viewBox="0 0 40 48" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="18%" y1="8%" x2="82%" y2="92%">
                            <stop offset="0%" stopColor="#fdf2f8" />
                            <stop offset="40%" stopColor="#f472b6" />
                            <stop offset="100%" stopColor="#9d174d" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M20 9 L22.4 16.2 L30 16.2 L24 20.6 L26.2 28 L20 23.4 L13.8 28 L16 20.6 L10 16.2 L17.6 16.2 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#9d174d"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                    <rect x="12" y="30" width="16" height="7" rx="1.5" fill="#fde68a" stroke="#a16207" strokeWidth="0.95" />
                    <path d="M15 33.5 H25" stroke="#a16207" strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
                </svg>
            );
        case 'neighborhood_hill':
        default:
            return (
                <svg viewBox="0 0 40 48" className="h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${g}-fill`} x1="18%" y1="8%" x2="82%" y2="92%">
                            <stop offset="0%" stopColor="#ecfccb" />
                            <stop offset="40%" stopColor="#86efac" />
                            <stop offset="75%" stopColor="#16a34a" />
                            <stop offset="100%" stopColor="#3f2a14" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M15 18 L19 18 Q23 14 27 18 L31 18 L31 22 Q35 24 31 26 L31 30 L27 30 Q23 34 19 30 L15 30 L15 26 Q11 24 15 22 Z"
                        fill={`url(#${g}-fill)`}
                        stroke="#14532d"
                        strokeWidth="1.05"
                        strokeLinejoin="round"
                    />
                </svg>
            );
    }
}

function resolveStageId(stageId?: string | null): AdventureStageId {
    if (
        stageId === 'neighborhood_hill' ||
        stageId === 'lake_park' ||
        stageId === 'aquarium' ||
        stageId === 'zoo' ||
        stageId === 'amusement_park'
    ) {
        return stageId;
    }
    return 'neighborhood_hill';
}

/** 지역 열쇠 — 챕터 테마 SVG */
export const AdventureRegionalKeyIcon: React.FC<
    IconSizeProps & { stageId?: string | null; size?: 'panel' | 'inline' }
> = ({ stageId, compact, className, size = 'panel' }) => {
    const uid = useId().replace(/:/g, '');
    const id = resolveStageId(stageId);
    const box =
        size === 'inline'
            ? compact
                ? 'h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]'
                : 'h-5 w-5 sm:h-6 sm:w-6'
            : boxClass(compact);
    return (
        <span className={`relative inline-flex shrink-0 items-center justify-center ${box} ${className ?? ''}`} aria-hidden>
            <KeySvg stageId={id} uid={uid} />
        </span>
    );
};

type FragmentProps = IconSizeProps & {
    stageId?: string | null;
    variant?: 'panel' | 'reward';
};

/** 지역 열쇠 조각 — 챕터 테마 SVG */
export const AdventureRegionalKeyFragmentIcon: React.FC<FragmentProps> = ({
    stageId,
    compact,
    variant = 'panel',
    className,
}) => {
    const uid = useId().replace(/:/g, '');
    const id = resolveStageId(stageId);
    const box = variant === 'reward' ? rewardBoxClass(compact) : boxClass(compact, true);
    return (
        <span className={`relative inline-flex shrink-0 items-center justify-center ${box} ${className ?? ''}`} aria-hidden>
            <FragmentSvg stageId={id} uid={uid} />
        </span>
    );
};
