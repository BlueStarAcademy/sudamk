import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus } from '../types.js';
import type { LevelUpCelebrationPayload } from '../types/levelUpModal.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants.js';
import Avatar from './Avatar.js';
import { getXpRequiredForCurrentLevel } from '../utils/playerLevelXp.js';

type LevelUpCelebrationModalProps = {
    user: UserWithStatus;
    payload: LevelUpCelebrationPayload;
    onClose: () => void;
    isTopmost?: boolean;
};

const BranchCard: React.FC<{
    title: string;
    subtitle: string;
    from: number;
    to: number;
    currentXp: number;
    glowClass: string;
    levelToClass: string;
    panelClass: string;
    barFillClass: string;
}> = ({ title, subtitle, from, to, currentXp, glowClass, levelToClass, panelClass, barFillClass }) => {
    const cap = getXpRequiredForCurrentLevel(to);
    const pct = cap > 0 && Number.isFinite(cap) ? Math.min(100, Math.round((currentXp / cap) * 1000) / 10) : 0;
    const gain = to - from;
    return (
        <div
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_-18px_rgba(0,0,0,0.85)] ring-1 ring-inset sm:p-5 ${panelClass}`}
        >
            <div className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl ${glowClass}`} aria-hidden />
            <div className="relative flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/55">{subtitle}</p>
                        <h3 className="mt-0.5 text-lg font-black tracking-tight text-white sm:text-xl">{title}</h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/20 bg-gradient-to-b from-white/[0.12] to-black/40 px-2.5 py-2 tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_24px_-8px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/10 sm:gap-1.5 sm:px-3 sm:py-2.5">
                        <span className="text-xs font-bold text-white/45 sm:text-sm">Lv.{from}</span>
                        <span className="px-0.5 text-xs font-bold text-amber-400/90 sm:text-sm" aria-hidden>
                            →
                        </span>
                        <span
                            className={`text-xl font-black tabular-nums tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] sm:text-2xl ${levelToClass}`}
                        >
                            Lv.{to}
                        </span>
                    </div>
                </div>
                {gain > 1 && (
                    <p className="text-xs font-medium text-white/60">
                        한 번에 <span className="font-bold text-amber-100/95">{gain}레벨</span> 상승했습니다.
                    </p>
                )}
                <div>
                    <div className="mb-1 flex justify-between text-[0.7rem] font-semibold text-white/55">
                        <span>다음 레벨까지</span>
                        <span className="tabular-nums text-white/75">
                            {currentXp.toLocaleString()} / {Number.isFinite(cap) ? cap.toLocaleString() : '—'}
                        </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
                        <div
                            className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${barFillClass}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const LevelUpCelebrationModal: React.FC<LevelUpCelebrationModalProps> = ({ user, payload, onClose, isTopmost = true }) => {
    const avatarUrl = useMemo(() => AVATAR_POOL.find((a) => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b) => b.id === user.borderId)?.url, [user.borderId]);
    const displayName = user.nickname || user.username || user.id;

    const overlayZ = isTopmost ? 'z-[12050]' : 'z-[12040]';

    const node = (
        <div
            className={`fixed inset-0 ${overlayZ} flex items-center justify-center overscroll-contain px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="level-up-celebration-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-[#030508]/88 backdrop-blur-md"
                aria-label="배경 닫기"
                onClick={onClose}
            />
            <div
                className="relative w-full max-w-md animate-[levelUpPop_0.42s_cubic-bezier(0.22,1,0.36,1)_both]"
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                  @keyframes levelUpPop {
                    from { opacity: 0; transform: translateY(12px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                  }
                `}</style>
                <div className="pointer-events-none absolute -inset-px rounded-[1.35rem] bg-gradient-to-br from-amber-400/50 via-fuchsia-500/25 to-cyan-400/45 opacity-90 blur-[1px]" aria-hidden />
                <div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#161b2a] via-[#0c0f18] to-[#06070c] p-[1px] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_64px_-24px_rgba(0,0,0,0.9),0_0_120px_-48px_rgba(251,191,36,0.35)]">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.14]"
                        style={{
                            background:
                                'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(251, 191, 36, 0.55), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 110%, rgba(34, 211, 238, 0.2), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 90%, rgba(217, 70, 239, 0.18), transparent 50%)',
                        }}
                        aria-hidden
                    />
                    <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
                        <div className="mb-6 text-center">
                            <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-amber-200/80">LEVEL UP!</p>
                            <div className="relative mx-auto mt-3 inline-block">
                                <div
                                    className="pointer-events-none absolute -inset-x-6 -inset-y-2 rounded-2xl bg-gradient-to-r from-amber-500/25 via-fuchsia-500/20 to-cyan-500/25 blur-xl"
                                    aria-hidden
                                />
                                <h2
                                    id="level-up-celebration-title"
                                    className="relative bg-gradient-to-br from-amber-50 via-white to-cyan-100 bg-clip-text text-[1.85rem] font-black leading-none tracking-[0.08em] text-transparent drop-shadow-[0_2px_16px_rgba(251,191,36,0.35)] sm:text-[2.35rem] sm:tracking-[0.1em]"
                                >
                                    레벨업!
                                </h2>
                                <div
                                    className="pointer-events-none absolute -bottom-1 left-1/2 h-0.5 w-[min(88%,11rem)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-amber-300/80 to-transparent"
                                    aria-hidden
                                />
                            </div>
                            <p className="mx-auto mt-4 max-w-[20rem] text-sm leading-relaxed text-slate-200/95 sm:text-[0.9375rem]">
                                한결 넓어진 바둑판처럼, 당신의 여정에도 새 칸이 열렸습니다. 지금의 실력을 믿고, 다음 수를 더 멋지게 두어 보세요.
                            </p>
                        </div>

                        <div className="mb-6 flex flex-col items-center gap-2">
                            <div className="relative">
                                <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-amber-500/25 via-transparent to-cyan-400/20 blur-xl" aria-hidden />
                                <Avatar
                                    userId={user.id}
                                    userName={displayName}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={96}
                                    className="drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
                                />
                            </div>
                            <p className="text-lg font-bold text-white">{displayName}</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            {payload.strategy && (
                                <BranchCard
                                    title="전략 바둑"
                                    subtitle="Strategy"
                                    from={payload.strategy.from}
                                    to={payload.strategy.to}
                                    currentXp={user.strategyXp ?? 0}
                                    glowClass="bg-emerald-400/40"
                                    levelToClass="text-emerald-200"
                                    panelClass="border-emerald-500/30 from-emerald-950/80 via-[#0a1210] to-black/80 ring-emerald-400/15"
                                    barFillClass="from-emerald-400 to-teal-300"
                                />
                            )}
                            {payload.playful && (
                                <BranchCard
                                    title="놀이 바둑"
                                    subtitle="Play"
                                    from={payload.playful.from}
                                    to={payload.playful.to}
                                    currentXp={user.playfulXp ?? 0}
                                    glowClass="bg-sky-400/35"
                                    levelToClass="text-sky-200"
                                    panelClass="border-sky-500/35 from-indigo-950/85 via-[#0c101c] to-black/80 ring-sky-400/15"
                                    barFillClass="from-sky-400 to-violet-300"
                                />
                            )}
                        </div>

                        <div className="mt-7 flex justify-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="group relative inline-flex min-h-[2.5rem] w-auto min-w-[6.75rem] max-w-[9.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-400/45 bg-gradient-to-b from-amber-200/95 via-amber-100 to-amber-200/90 px-7 text-sm font-bold tracking-wide text-amber-950 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_28px_-6px_rgba(251,191,36,0.55),0_0_0_1px_rgba(0,0,0,0.2)] transition-[transform,box-shadow] duration-200 hover:border-amber-300/80 hover:shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_12px_32px_-8px_rgba(251,191,36,0.65)] active:scale-[0.98] sm:min-h-[2.625rem] sm:px-8 sm:text-[0.9375rem]"
                            >
                                <span
                                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                                    style={{
                                        background:
                                            'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%)',
                                    }}
                                    aria-hidden
                                />
                                <span className="relative">확인</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return node;
    return createPortal(node, document.body);
};

export default LevelUpCelebrationModal;
