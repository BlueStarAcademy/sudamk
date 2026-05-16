import React from 'react';
import type { UserWithStatus } from '../../types.js';
import UserNicknameText from '../UserNicknameText.js';
import ProfileAvatarStatusMarkers from '../ProfileAvatarStatusMarkers.js';
import { getXpRequirementForLevel } from '../../shared/utils/strategyLevelXp.js';

type ProfileHomeIdentityHeaderProps = {
    user: UserWithStatus;
    level: number;
    nickname: string;
    isAdmin?: boolean;
    staffNicknameDisplayEligibility?: boolean;
    compact?: boolean;
    denseNative?: boolean;
    userLevel?: number;
    userXp?: number;
    xpDense?: boolean;
    xpBumpText?: boolean;
};

const ProfileHomeIdentityHeader: React.FC<ProfileHomeIdentityHeaderProps> = ({
    user,
    level,
    nickname,
    isAdmin,
    staffNicknameDisplayEligibility,
    compact = false,
    denseNative = false,
    userLevel,
    userXp,
    xpDense = false,
    xpBumpText = false,
}) => {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    const showXp = userLevel != null && userXp != null;
    const safeUserLevel = Math.max(1, Math.floor(Number(userLevel) || 1));
    const safeXp = Math.max(0, Math.floor(Number(userXp) || 0));
    const maxXp = showXp ? getXpRequirementForLevel(safeUserLevel) : 0;
    const xpPercent = maxXp > 0 ? Math.min((safeXp / maxXp) * 100, 100) : 0;
    const xpFs = xpDense
        ? 'clamp(0.56rem, 1.35vw, 0.68rem)'
        : xpBumpText
          ? 'clamp(0.6875rem, 1.65vw, 0.8125rem)'
          : 'clamp(0.625rem, 1.5vw, 0.75rem)';
    const expMarkerFs = xpDense ? '0.5rem' : '0.5625rem';

    return (
        <div
            className={`relative overflow-hidden rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_28px_-14px_rgba(0,0,0,0.65)] ${
                compact
                    ? 'border-amber-500/35 bg-gradient-to-br from-zinc-800/98 via-zinc-900 to-zinc-950 px-2 py-1.5'
                    : 'border-amber-500/40 bg-gradient-to-br from-zinc-800/95 via-zinc-900 to-black px-2.5 py-1.5 sm:px-3 sm:py-2'
            }`}
        >
            <div
                className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/55 to-transparent"
                aria-hidden
            />
            <ProfileAvatarStatusMarkers user={user} compact={compact} placement="identityCard" />
            <div className={`relative flex min-w-0 flex-col ${compact ? 'pt-3.5' : 'pt-4'}`}>
                <div
                    className={`flex min-w-0 items-end ${compact ? 'gap-1.5' : 'gap-2'} ${showXp ? (compact ? 'mb-0.5' : 'mb-1') : ''}`}
                >
                    <div
                        className={`flex shrink-0 flex-col items-center justify-center rounded-lg border border-amber-400/45 bg-gradient-to-b from-amber-500/25 via-amber-950/40 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
                            compact ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'
                        }`}
                    >
                        <span
                            className={`font-extrabold uppercase leading-none tracking-wide text-amber-100/90 ${
                                compact ? 'text-[7px]' : 'text-[8px]'
                            }`}
                        >
                            Lv
                        </span>
                        <span
                            className={`font-black tabular-nums leading-none text-amber-50 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)] ${
                                compact ? 'text-xs' : 'text-sm sm:text-base'
                            }`}
                        >
                            {safeLevel}
                        </span>
                    </div>
                    <UserNicknameText
                        user={{ nickname, isAdmin, staffNicknameDisplayEligibility }}
                        as="h2"
                        title={nickname}
                        style={{
                            fontSize: denseNative
                                ? 'clamp(0.8rem, 2.1vw, 0.95rem)'
                                : compact
                                  ? 'clamp(0.72rem, 1.9vw, 0.88rem)'
                                  : undefined,
                        }}
                        className={`min-w-0 flex-1 truncate pb-px font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
                            compact ? 'text-sm' : 'text-base sm:text-lg'
                        }`}
                    />
                    {showXp && (
                        <div className="relative shrink-0 pb-px text-right leading-none">
                            <span
                                className="absolute bottom-full right-0 mb-px block font-bold uppercase tracking-[0.12em] text-slate-400/90"
                                style={{ fontSize: expMarkerFs }}
                                aria-hidden
                            >
                                EXP
                            </span>
                            <span
                                className="whitespace-nowrap font-mono font-semibold tabular-nums text-amber-100"
                                style={{ fontSize: xpFs }}
                            >
                                {safeXp} / {maxXp}
                            </span>
                        </div>
                    )}
                </div>
                {showXp && (
                    <div
                        className={`w-full rounded-full border border-color bg-tertiary/50 ${xpDense ? 'h-1.5' : 'h-2'}`}
                    >
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width] duration-500"
                            style={{ width: `${xpPercent}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileHomeIdentityHeader;
