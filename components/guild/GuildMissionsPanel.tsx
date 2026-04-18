import React, { useMemo, useState, useEffect } from 'react';
import { Guild as GuildType, GuildMember, GuildMission } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import DraggableWindow from '../DraggableWindow.js';
import { calculateGuildMissionXp } from '../../utils/guildUtils.js';
import { isDifferentWeekKST, getTimeUntilNextMondayKST } from '../../utils/timeUtils.js';
import { ADMIN_USER_ID } from '../../constants/index.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';

interface GuildMissionsPanelProps {
    guild: GuildType;
    myMemberInfo: GuildMember | undefined;
    onClose: () => void;
}

const MissionItem: React.FC<{
    mission: GuildMission;
    guildLevel: number;
    guild: GuildType;
    isNativeMobile: boolean;
}> = ({ mission, guildLevel, guild, isNativeMobile }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const progress = mission.progress ?? 0;
    const target = mission.target ?? 0;
    const isComplete = progress >= target;
    const percentage = target > 0 ? Math.min((progress / target) * 100, 100) : 100;

    const effectiveUserId = currentUserWithStatus!.isAdmin ? ADMIN_USER_ID : currentUserWithStatus!.id;
    const isClaimed = mission.claimedBy?.includes(effectiveUserId) ?? false;

    const now = Date.now();
    const isExpired = guild.lastMissionReset && isDifferentWeekKST(guild.lastMissionReset, now);
    const canClaim = isComplete && !isClaimed && !isExpired;

    const handleClaim = async () => {
        if (canClaim) {
            await handlers.handleAction({ type: 'GUILD_CLAIM_MISSION_REWARD', payload: { missionId: mission.id } });
            await handlers.handleAction({ type: 'GET_GUILD_INFO' });
        }
    };

    const finalXp = calculateGuildMissionXp(mission.guildReward?.guildXp ?? 0, guildLevel);

    return (
        <div
            className={[
                'relative overflow-hidden rounded-2xl border transition-all duration-300',
                'border-amber-500/25 bg-gradient-to-br from-stone-950/98 via-stone-900/95 to-violet-950/25',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_40px_-18px_rgba(0,0,0,0.65)]',
                'ring-1 ring-white/[0.04]',
                isComplete && !isClaimed && !isExpired
                    ? 'ring-amber-400/25 shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_16px_48px_-12px_rgba(245,158,11,0.12)]'
                    : 'hover:border-amber-400/35 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.55)]',
                isNativeMobile ? 'p-2.5' : 'p-3.5 sm:p-4',
            ].join(' ')}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-violet-600/[0.06]" />
            <div className={`relative z-10 flex ${isNativeMobile ? 'flex-col gap-2.5' : 'flex-row items-stretch gap-4'}`}>
                <div
                    className={`flex shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-950/50 to-stone-950/80 shadow-inner ${
                        isNativeMobile ? 'h-12 w-12' : 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]'
                    }`}
                >
                    <img
                        src="/images/guild/button/guildmission.png"
                        alt=""
                        className={isNativeMobile ? 'h-9 w-9 object-contain opacity-95' : 'h-10 w-10 object-contain opacity-95 sm:h-11 sm:w-11'}
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                        <h4
                            className={`font-bold leading-snug text-amber-50/95 ${isNativeMobile ? 'text-[13px]' : 'text-sm sm:text-[15px]'}`}
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
                        >
                            {mission.title}
                        </h4>
                        {isComplete && !isClaimed && !isExpired && (
                            <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200/95">
                                달성
                            </span>
                        )}
                    </div>
                    {mission.description ? (
                        <p
                            className={`mb-2.5 text-stone-400 ${isNativeMobile ? 'text-[11px] leading-snug line-clamp-2' : 'text-xs leading-relaxed line-clamp-2'}`}
                        >
                            {mission.description}
                        </p>
                    ) : null}

                    <div className={`mb-1.5 w-full overflow-hidden rounded-full border border-stone-700/60 bg-black/40 ${isNativeMobile ? 'h-2' : 'h-2.5'}`}>
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-violet-500 shadow-[0_0_12px_rgba(251,191,36,0.35)] transition-[width] duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    <p className={`text-right font-mono tabular-nums text-stone-400 ${isNativeMobile ? 'text-[10px]' : 'text-xs'}`}>
                        {progress.toLocaleString()} / {target.toLocaleString()}
                    </p>
                </div>

                <div
                    className={`flex shrink-0 flex-col justify-between ${isNativeMobile ? 'w-full border-t border-stone-700/50 pt-2.5' : 'w-[7.25rem] border-l border-stone-700/40 pl-4'}`}
                >
                    <div className={`flex flex-wrap justify-center gap-1.5 ${isNativeMobile ? 'mb-2' : 'mb-2'}`}>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-amber-200/95">
                            <img src="/images/guild/tokken.png" alt="" className="h-3 w-3" />
                            {mission.personalReward?.guildCoins ?? 0}
                        </span>
                        <span className="inline-flex items-center rounded-lg border border-emerald-500/25 bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-emerald-300/95">
                            길드 XP +{finalXp.toLocaleString()}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleClaim}
                        disabled={!canClaim}
                        className={`relative w-full overflow-hidden rounded-xl font-bold transition-all ${
                            isNativeMobile ? 'py-2 text-[12px]' : 'py-2.5 text-xs'
                        } ${
                            canClaim
                                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:brightness-110 active:scale-[0.98]'
                                : isClaimed
                                  ? 'cursor-not-allowed border border-stone-600/50 bg-stone-800/60 text-stone-500'
                                  : 'cursor-not-allowed border border-stone-600/50 bg-stone-800/50 text-stone-500'
                        }`}
                    >
                        {canClaim && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full transition-transform duration-700 hover:translate-x-full" />
                        )}
                        <span className="relative z-10">
                            {isExpired ? '만료됨' : isClaimed ? '보상 완료' : isComplete ? '보상 받기' : '진행 중'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const GuildMissionsPanel: React.FC<GuildMissionsPanelProps> = ({ guild, onClose }) => {
    const { currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1025);
    const now = Date.now();
    const isExpired = guild.lastMissionReset && isDifferentWeekKST(guild.lastMissionReset, now);

    const [resetCountdown, setResetCountdown] = useState('');

    useEffect(() => {
        const tick = () => {
            const ms = getTimeUntilNextMondayKST();
            const days = Math.floor(ms / (1000 * 60 * 60 * 24));
            const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            setResetCountdown(`${days}일 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} 후 갱신`);
        };
        tick();
        const id = window.setInterval(tick, 60_000);
        return () => window.clearInterval(id);
    }, []);

    const hasUnclaimedRewards = useMemo(() => {
        if (!currentUserWithStatus || !guild.weeklyMissions) return false;
        if (isExpired) return false;

        const effectiveUserId = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
        return guild.weeklyMissions.some((mission) => {
            const isComplete = (mission.progress ?? 0) >= (mission.target ?? 0);
            const isClaimed = mission.claimedBy?.includes(effectiveUserId) ?? false;
            return isComplete && !isClaimed;
        });
    }, [guild.weeklyMissions, currentUserWithStatus, isExpired]);

    return (
        <DraggableWindow
            title="주간 길드 미션"
            headerShowTitle
            onClose={onClose}
            windowId="guild-missions"
            initialWidth={620}
            initialHeight={640}
            variant="store"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            mobileLockViewportHeight={isHandheld}
            bodyNoScroll={isHandheld}
            hideFooter={isHandheld}
            bodyPaddingClassName={isNativeMobile ? 'p-3' : 'p-4 sm:p-5'}
            pcViewportMaxHeightCss="min(88dvh, 820px)"
        >
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(251,191,36,0.12),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(139,92,246,0.08),transparent_45%)]" />

                <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                    <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-stone-900/90 via-stone-900/70 to-violet-950/30 px-3 py-2.5 shadow-inner sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-600/30 to-amber-950/40 shadow-md">
                                <img src="/images/guild/button/guildmission.png" alt="" className="h-8 w-8 object-contain opacity-95" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold tracking-wide text-amber-200/80">다음 주 초기화까지</p>
                                <p className="text-xs font-medium leading-snug text-stone-300 sm:text-sm">
                                    길드원이 함께 채우는 주간 목표입니다. 달성 시{' '}
                                    <span className="text-amber-200/95">길드 코인</span>과{' '}
                                    <span className="text-emerald-300/95">길드 경험치</span>를 받을 수 있습니다.
                                </p>
                            </div>
                        </div>
                        <p className="shrink-0 text-center font-mono text-[11px] tabular-nums text-amber-100/85 sm:text-right sm:text-xs">{resetCountdown}</p>
                    </div>

                    {hasUnclaimedRewards && (
                        <div
                            className={`flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/45 bg-gradient-to-r from-amber-950/55 to-orange-950/40 px-3 py-2 shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)] ${
                                isNativeMobile ? '' : ''
                            }`}
                        >
                            <span className={`flex shrink-0 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] ${isNativeMobile ? 'h-2 w-2 animate-pulse' : 'h-2.5 w-2.5 animate-pulse'}`} />
                            <span className={`font-semibold text-amber-100 ${isNativeMobile ? 'text-[11px]' : 'text-xs'}`}>
                                수령 가능한 보상이 있습니다. 잊지 말고 받아 가세요.
                            </span>
                        </div>
                    )}

                    <div
                        className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${isNativeMobile ? 'pr-0.5' : 'pr-1'}`}
                    >
                        {guild.weeklyMissions && guild.weeklyMissions.length > 0 ? (
                            <ul className="flex flex-col gap-2.5 sm:gap-3">
                                {guild.weeklyMissions.map((mission) => (
                                    <li key={mission.id}>
                                        <MissionItem mission={mission} guildLevel={guild.level} guild={guild} isNativeMobile={isNativeMobile} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-600/50 bg-stone-950/40 px-6 text-center">
                                <span className="text-3xl opacity-40" aria-hidden>
                                    📭
                                </span>
                                <p className="text-sm font-medium text-stone-400">표시할 주간 미션이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildMissionsPanel;
