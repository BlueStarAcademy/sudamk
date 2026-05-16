import React from 'react';
import type { UserWithStatus } from '../types.js';
import {
    getActiveDiamondPackageRoman,
    getVipProfileMarkerLabel,
} from '../shared/utils/profileStatusMarkers.js';

type ProfileAvatarStatusMarkersProps = {
    user: UserWithStatus;
    /** 네이티브 홈 촘촘 레이아웃 */
    compact?: boolean;
};

const ProfileAvatarStatusMarkers: React.FC<ProfileAvatarStatusMarkersProps> = ({ user, compact = false }) => {
    const vipLabel = getVipProfileMarkerLabel(user);
    const diamondPackageRoman = getActiveDiamondPackageRoman(user);

    if (!vipLabel && !diamondPackageRoman) return null;

    const badgeText = compact ? 'text-[9px]' : 'text-[10px]';
    const zemIcon = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
    const badgePad = compact ? 'px-1.5 py-px' : 'px-2 py-0.5';

    return (
        <div
            className="pointer-events-none absolute left-1/2 top-0 z-20 flex max-w-[calc(100%+1.5rem)] -translate-x-1/2 -translate-y-[42%] flex-nowrap items-center justify-center gap-1"
            aria-hidden
        >
            {vipLabel ? (
                <span
                    className={`shrink-0 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-500/40 to-yellow-300/20 ${badgePad} font-extrabold tracking-wide text-amber-100 shadow-[0_8px_20px_-14px_rgba(251,191,36,0.85)] ${badgeText}`}
                >
                    {vipLabel}
                </span>
            ) : null}
            {diamondPackageRoman ? (
                <span
                    className={`flex shrink-0 items-center gap-0.5 rounded-full border border-cyan-400/45 bg-gradient-to-r from-cyan-600/40 to-sky-500/25 ${badgePad} font-extrabold tabular-nums tracking-wide text-cyan-100 shadow-[0_8px_20px_-14px_rgba(34,211,238,0.55)] ${badgeText}`}
                >
                    <img src="/images/icon/Zem.webp" alt="" className={`${zemIcon} shrink-0 object-contain`} />
                    {diamondPackageRoman}
                </span>
            ) : null}
        </div>
    );
};

export default ProfileAvatarStatusMarkers;
