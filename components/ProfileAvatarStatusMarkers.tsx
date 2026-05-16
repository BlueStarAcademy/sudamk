import React from 'react';
import type { UserWithStatus } from '../types.js';
import {
    getActiveDiamondPackageRoman,
    getVipProfileMarkerLabel,
    type VipProfileMarkerLabel,
} from '../shared/utils/profileStatusMarkers.js';

type ProfileAvatarStatusMarkersProps = {
    user: UserWithStatus;
    compact?: boolean;
    placement?: 'avatar' | 'panelCorner' | 'identityCard';
};

function getVipHoverTitle(active: boolean, label: VipProfileMarkerLabel | null): string {
    if (!active) return 'VIP 비활성화';
    return label ?? 'VIP';
}

function getDiamondHoverTitle(active: boolean, roman: 'I' | 'II' | 'III' | null): string {
    if (!active) return '다이아 패키지 비활성화';
    return `다이아 패키지 ${roman ?? ''}`.trim();
}

const ProfileAvatarStatusMarkers: React.FC<ProfileAvatarStatusMarkersProps> = ({
    user,
    compact = false,
    placement = 'identityCard',
}) => {
    const vipLabel = getVipProfileMarkerLabel(user);
    const diamondPackageRoman = getActiveDiamondPackageRoman(user);
    const vipActive = vipLabel != null;
    const diamondActive = diamondPackageRoman != null;

    const badgeText = compact ? 'text-[9px]' : 'text-[10px]';
    const zemIcon = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
    const badgePad = compact ? 'px-1.5 py-px' : 'px-2 py-0.5';

    const positionClass =
        placement === 'avatar'
            ? 'left-1/2 top-0 max-w-[calc(100%+1.5rem)] -translate-x-1/2 -translate-y-[42%] flex-nowrap justify-center'
            : placement === 'identityCard'
              ? 'right-1.5 top-1.5 max-w-[calc(100%-0.75rem)] flex-wrap justify-end sm:right-2 sm:top-2'
              : 'right-0 top-0 max-w-[min(100%,9rem)] flex-wrap justify-end';

    const vipDisplay = vipActive ? vipLabel : 'VIP';

    return (
        <div className={`absolute z-20 flex items-center gap-1 ${positionClass}`}>
            <span
                title={getVipHoverTitle(vipActive, vipLabel)}
                className={`shrink-0 cursor-default rounded-full border ${badgePad} font-extrabold tracking-wide ${badgeText} ${
                    vipActive
                        ? 'border-amber-300/50 bg-gradient-to-r from-amber-500/40 to-yellow-300/20 text-amber-100 shadow-[0_8px_20px_-14px_rgba(251,191,36,0.85)]'
                        : 'border-zinc-600/55 bg-zinc-800/90 text-zinc-500 grayscale'
                }`}
            >
                {vipDisplay}
            </span>
            <span
                title={getDiamondHoverTitle(diamondActive, diamondPackageRoman)}
                className={`flex shrink-0 cursor-default items-center gap-0.5 rounded-full border ${badgePad} font-extrabold tabular-nums tracking-wide ${badgeText} ${
                    diamondActive
                        ? 'border-cyan-400/45 bg-gradient-to-r from-cyan-600/40 to-sky-500/25 text-cyan-100 shadow-[0_8px_20px_-14px_rgba(34,211,238,0.55)]'
                        : 'border-zinc-600/55 bg-zinc-800/90 text-zinc-500 grayscale'
                }`}
            >
                <img
                    src="/images/icon/Zem.webp"
                    alt=""
                    className={`${zemIcon} shrink-0 object-contain ${diamondActive ? '' : 'opacity-55'}`}
                />
                {diamondActive ? diamondPackageRoman : '◇'}
            </span>
        </div>
    );
};

export default ProfileAvatarStatusMarkers;
