import React from 'react';
import GuildMark from '../guild/GuildMark.js';
import type { HomeEntranceAccent } from './homeEntranceSections.js';

const ACCENT: Record<
    HomeEntranceAccent,
    {
        bar: string;
        ring: string;
        glow: string;
        scrim: string;
        plate: string;
        marker: string;
        foil: string;
        progress: string;
    }
> = {
    amber: {
        bar: 'from-amber-300/95 via-amber-500/75 to-amber-800/35',
        ring: 'hover:border-amber-300/60 hover:ring-amber-400/30',
        glow: 'group-hover:shadow-[0_18px_40px_-18px_rgba(251,191,36,0.55)]',
        scrim: 'from-black/80 via-black/35 to-amber-950/25',
        plate: 'from-amber-950/80 via-black/55 to-transparent',
        marker: 'border-amber-300/45 bg-amber-950/85 text-amber-50 shadow-[0_6px_16px_-8px_rgba(251,191,36,0.65)]',
        foil: 'via-amber-200/35',
        progress: 'stroke-amber-300',
    },
    emerald: {
        bar: 'from-emerald-300/95 via-emerald-500/75 to-emerald-900/35',
        ring: 'hover:border-emerald-300/60 hover:ring-emerald-400/30',
        glow: 'group-hover:shadow-[0_18px_40px_-18px_rgba(52,211,153,0.5)]',
        scrim: 'from-black/80 via-black/35 to-emerald-950/25',
        plate: 'from-emerald-950/80 via-black/55 to-transparent',
        marker: 'border-emerald-300/45 bg-emerald-950/85 text-emerald-50 shadow-[0_6px_16px_-8px_rgba(52,211,153,0.55)]',
        foil: 'via-emerald-200/35',
        progress: 'stroke-emerald-300',
    },
    cyan: {
        bar: 'from-cyan-300/95 via-cyan-500/75 to-cyan-900/35',
        ring: 'hover:border-cyan-300/60 hover:ring-cyan-400/30',
        glow: 'group-hover:shadow-[0_18px_40px_-18px_rgba(34,211,238,0.5)]',
        scrim: 'from-black/80 via-black/35 to-cyan-950/25',
        plate: 'from-cyan-950/80 via-black/55 to-transparent',
        marker: 'border-cyan-300/45 bg-cyan-950/85 text-cyan-50 shadow-[0_6px_16px_-8px_rgba(34,211,238,0.55)]',
        foil: 'via-cyan-200/35',
        progress: 'stroke-cyan-300',
    },
    indigo: {
        bar: 'from-indigo-300/95 via-indigo-500/75 to-indigo-900/35',
        ring: 'hover:border-indigo-300/60 hover:ring-indigo-400/30',
        glow: 'group-hover:shadow-[0_18px_40px_-18px_rgba(129,140,248,0.5)]',
        scrim: 'from-black/80 via-black/35 to-indigo-950/25',
        plate: 'from-indigo-950/80 via-black/55 to-transparent',
        marker: 'border-indigo-300/45 bg-indigo-950/85 text-indigo-50 shadow-[0_6px_16px_-8px_rgba(129,140,248,0.55)]',
        foil: 'via-indigo-200/35',
        progress: 'stroke-indigo-300',
    },
    orange: {
        bar: 'from-orange-300/95 via-orange-500/75 to-orange-900/35',
        ring: 'hover:border-orange-300/60 hover:ring-orange-400/30',
        glow: 'group-hover:shadow-[0_18px_40px_-18px_rgba(251,146,60,0.55)]',
        scrim: 'from-black/80 via-black/35 to-orange-950/25',
        plate: 'from-orange-950/80 via-black/55 to-transparent',
        marker: 'border-orange-300/45 bg-orange-950/85 text-orange-50 shadow-[0_6px_16px_-8px_rgba(251,146,60,0.6)]',
        foil: 'via-orange-200/35',
        progress: 'stroke-orange-300',
    },
    violet: {
        bar: 'from-violet-300/95 via-violet-500/75 to-violet-900/35',
        ring: 'hover:border-violet-300/60 hover:ring-violet-400/30',
        glow: 'group-hover:shadow-[0_18px_40px_-18px_rgba(167,139,250,0.55)]',
        scrim: 'from-black/80 via-black/35 to-violet-950/25',
        plate: 'from-violet-950/80 via-black/55 to-transparent',
        marker: 'border-violet-300/45 bg-violet-950/85 text-violet-50 shadow-[0_6px_16px_-8px_rgba(167,139,250,0.6)]',
        foil: 'via-violet-200/35',
        progress: 'stroke-violet-300',
    },
};

export type HomeEntranceGuildInfo = {
    name: string;
    level: number;
    icon?: string | null;
    emblem?: string | null;
};

export type HomeEntranceGuildCtas = {
    onJoin: () => void;
    onCreate: () => void;
    joinLabel: string;
    createLabel: string;
};

export type HomeEntranceCardProps = {
    title: string;
    /** 하단 안내 줄(칩/문구) */
    infoLines?: string[];
    /** 하단 좌·우 한 줄 (예: 싱글 캠페인 · N/100) */
    footerLeft?: string;
    footerRight?: string;
    tierIcon?: string;
    scoreText?: string;
    /** 0~100 원형 완성도 */
    progressPercent?: number;
    progressLabel?: string;
    guild?: HomeEntranceGuildInfo | null;
    guildCtas?: HomeEntranceGuildCtas;
    imageSrc: string;
    accent: HomeEntranceAccent;
    locked?: boolean;
    lockReason?: string;
    badge?: boolean;
    className?: string;
    onEnter: () => void;
};

const HomeEntranceCard: React.FC<HomeEntranceCardProps> = ({
    title,
    infoLines,
    footerLeft,
    footerRight,
    tierIcon,
    scoreText,
    progressPercent,
    progressLabel,
    guild,
    guildCtas,
    imageSrc,
    accent,
    locked = false,
    lockReason,
    badge = false,
    className,
    onEnter,
}) => {
    const a = ACCENT[accent];
    const showTierRow = !!(tierIcon || scoreText);
    const showProgress = typeof progressPercent === 'number' && Number.isFinite(progressPercent);
    const pct = showProgress ? Math.min(100, Math.max(0, progressPercent)) : 0;
    const r = 18;
    const c = 2 * Math.PI * r;
    const dash = (pct / 100) * c;
    const lines = (infoLines ?? []).filter(Boolean);
    const hasGuild = !!guild;
    const showGuildCtas = !hasGuild && !!guildCtas && !locked;

    return (
        <button
            type="button"
            disabled={locked}
            title={locked ? lockReason : title}
            aria-label={locked && lockReason ? `${title}: ${lockReason}` : title}
            onClick={() => {
                if (!locked && !showGuildCtas) onEnter();
            }}
            className={`group relative flex aspect-[16/10] w-full flex-col overflow-hidden rounded-2xl border border-white/14 bg-zinc-950 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/5 transition duration-300 ${a.ring} ${a.glow} ${
                locked
                    ? 'cursor-not-allowed opacity-55 grayscale-[0.35]'
                    : showGuildCtas
                      ? 'cursor-default'
                      : 'cursor-pointer hover:-translate-y-1'
            } ${className ?? ''}`}
        >
            <img
                src={imageSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                decoding="async"
                loading="lazy"
            />
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${a.scrim}`} aria-hidden />
            <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(255,255,255,0.14),transparent_55%)]"
                aria-hidden
            />
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${a.bar}`} aria-hidden />
            <div
                className={`pointer-events-none absolute inset-x-3 top-[3px] h-px bg-gradient-to-r from-transparent ${a.foil} to-transparent opacity-80`}
                aria-hidden
            />

            <span
                className={`absolute left-1/2 top-0 z-[2] max-w-[88%] -translate-x-1/2 truncate rounded-b-xl border border-t-0 px-2.5 py-1 text-[11px] font-black tracking-wide backdrop-blur-sm sm:px-3 sm:text-xs ${a.marker}`}
            >
                {title}
            </span>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[62%] bg-gradient-to-t from-black/75 via-black/35 to-transparent" aria-hidden />
            <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-gradient-to-t ${a.plate}`}
                aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 z-[1] p-2.5 pb-2 sm:p-3 sm:pb-2.5">
                <div className="relative space-y-1">
                    {locked && lockReason ? (
                        <div className="truncate text-[11px] font-bold text-rose-100 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                            {lockReason}
                        </div>
                    ) : null}

                    {showTierRow ? (
                        <div className="flex items-center gap-1.5">
                            {tierIcon ? (
                                <img
                                    src={tierIcon}
                                    alt=""
                                    className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] sm:h-8 sm:w-8"
                                    decoding="async"
                                    loading="lazy"
                                />
                            ) : null}
                            {scoreText ? (
                                <span className="truncate text-[13px] font-black tabular-nums tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-sm">
                                    {scoreText}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    {showProgress ? (
                        <div className="flex items-center gap-2">
                            <div className="relative h-11 w-11 shrink-0">
                                <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden>
                                    <circle
                                        cx="22"
                                        cy="22"
                                        r={r}
                                        fill="none"
                                        stroke="rgba(255,255,255,0.14)"
                                        strokeWidth="4"
                                    />
                                    <circle
                                        cx="22"
                                        cy="22"
                                        r={r}
                                        fill="none"
                                        className={a.progress}
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeDasharray={`${dash} ${c}`}
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black tabular-nums text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                                    {progressLabel ?? `${Math.round(pct)}%`}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {hasGuild ? (
                        <div className="flex min-w-0 items-center gap-2">
                            <GuildMark
                                icon={guild.icon}
                                emblem={guild.emblem}
                                size={36}
                                tone="plain"
                                alt=""
                            />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-black text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)] sm:text-[13px]">
                                    {guild.name}
                                </div>
                                <div className="truncate text-[11px] font-bold text-zinc-200/90">
                                    Lv.{guild.level}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {showGuildCtas ? (
                        <div className="flex gap-1.5">
                            <span
                                role="button"
                                tabIndex={0}
                                className="inline-flex flex-1 items-center justify-center rounded-md border border-indigo-300/40 bg-indigo-500/25 px-1.5 py-1 text-[10px] font-black text-indigo-50 transition hover:bg-indigo-500/40 sm:text-[11px]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    guildCtas.onJoin();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        guildCtas.onJoin();
                                    }
                                }}
                            >
                                {guildCtas.joinLabel}
                            </span>
                            <span
                                role="button"
                                tabIndex={0}
                                className="inline-flex flex-1 items-center justify-center rounded-md border border-white/25 bg-white/10 px-1.5 py-1 text-[10px] font-black text-white transition hover:bg-white/20 sm:text-[11px]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    guildCtas.onCreate();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        guildCtas.onCreate();
                                    }
                                }}
                            >
                                {guildCtas.createLabel}
                            </span>
                        </div>
                    ) : null}

                    {footerLeft || footerRight ? (
                        <div className="flex min-w-0 items-end justify-between gap-2">
                            {footerLeft ? (
                                <span className="min-w-0 truncate text-[11px] font-bold text-zinc-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-xs">
                                    {footerLeft}
                                </span>
                            ) : (
                                <span />
                            )}
                            {footerRight ? (
                                <span className="shrink-0 text-[12px] font-black tabular-nums tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[13px]">
                                    {footerRight}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    {lines.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {lines.map((line) => (
                                <span
                                    key={line}
                                    className="inline-flex max-w-full truncate rounded-md border border-white/15 bg-black/35 px-1.5 py-0.5 text-[10px] font-bold text-zinc-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-[11px]"
                                >
                                    {line}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {badge ? (
                <span
                    className="absolute right-2.5 top-3 z-[2] h-2 w-2 rounded-full border-2 border-zinc-950 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.75)]"
                    aria-hidden
                />
            ) : null}
            {locked ? (
                <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-black/40">
                    <span className="text-xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]" aria-hidden>
                        🔒
                    </span>
                </div>
            ) : null}
        </button>
    );
};

export default HomeEntranceCard;
