import React, { useEffect, useMemo, useState } from 'react';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';
import MobileModalTitleBar from '../mobile/MobileModalTitleBar.js';
import { useMobileModalChrome } from '../../hooks/useMobileModalChrome.js';
import GuildExpBadge from './GuildExpBadge.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';
import { PRE_GAME_MODAL_ACCENT_BTN_CLASS, PRE_GAME_MODAL_SHELL_CLASS } from '../game/PreGameDescriptionLayout.js';

export interface GuildWarRewardModalWarResult {
    isWinner: boolean;
    guild1Stars: number;
    guild2Stars: number;
    guild1Score: number;
    guild2Score: number;
}

export interface GuildWarRewardModalRewards {
    guildCoins: number;
    guildXp: number;
    researchPoints: number;
    gold: number;
    diamonds: number;
}

interface GuildWarRewardModalProps {
    onClose: () => void;
    warResult: GuildWarRewardModalWarResult;
    rewards: GuildWarRewardModalRewards;
}

type RewardCardDef = {
    key: string;
    label: string;
    amount: string;
    accent: string;
    glow: string;
    border: string;
    bg: string;
    renderIcon: () => React.ReactNode;
};

const GuildWarRewardCard: React.FC<{
    card: RewardCardDef;
    index: number;
    revealed: boolean;
    isWinner: boolean;
}> = ({ card, index, revealed, isWinner }) => (
    <div
        className={`relative transition-all duration-500 ease-out ${
            revealed ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
        style={{ transitionDelay: `${index * 90 + 120}ms` }}
    >
        <div
            className={`relative flex h-[5.5rem] flex-col items-center justify-center overflow-hidden rounded-xl border p-1.5 shadow-lg sm:h-[6.25rem] sm:p-2 ${card.border} ${card.bg} ${
                isWinner ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : ''
            }`}
        >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${card.glow}`} />
            <div className="relative z-[1] flex flex-col items-center justify-center gap-0.5 sm:gap-1">
                <div className="flex h-8 w-8 items-center justify-center sm:h-9 sm:w-9">{card.renderIcon()}</div>
                <div className="line-clamp-1 text-center text-[9px] font-semibold leading-tight text-white/90 sm:text-[10px]">
                    {card.label}
                </div>
                <div className={`text-center text-[10px] font-bold tabular-nums sm:text-xs ${card.accent}`}>{card.amount}</div>
            </div>
        </div>
    </div>
);

const GuildWarRewardModal: React.FC<GuildWarRewardModalProps> = ({ onClose, warResult, rewards }) => {
    const useMobileChrome = useMobileModalChrome();
    const isWinner = warResult.isWinner;
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setRevealed(true), 80);
        return () => window.clearTimeout(timer);
    }, []);

    const rewardCards = useMemo<RewardCardDef[]>(
        () => [
            {
                key: 'gold',
                label: '골드',
                amount: `+${formatGoldAmountKoG(rewards.gold)}`,
                accent: 'text-amber-200',
                glow: 'from-amber-500/25 via-yellow-600/10 to-transparent',
                border: 'border-amber-400/35',
                bg: 'bg-gradient-to-b from-amber-950/80 via-stone-900/90 to-stone-950/95',
                renderIcon: () => (
                    <img
                        src="/images/icon/Gold.webp"
                        alt="골드"
                        className="h-full w-full object-contain drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]"
                    />
                ),
            },
            {
                key: 'diamonds',
                label: '다이아',
                amount: `+${formatWalletDiamonds(rewards.diamonds)}`,
                accent: 'text-cyan-200',
                glow: 'from-cyan-500/25 via-sky-600/10 to-transparent',
                border: 'border-cyan-400/35',
                bg: 'bg-gradient-to-b from-cyan-950/80 via-stone-900/90 to-stone-950/95',
                renderIcon: () => (
                    <img
                        src="/images/icon/Zem.webp"
                        alt="다이아"
                        className="h-full w-full object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                    />
                ),
            },
            {
                key: 'guildCoins',
                label: '길드 코인',
                amount: `+${rewards.guildCoins.toLocaleString()}`,
                accent: 'text-orange-200',
                glow: 'from-orange-500/25 via-amber-600/10 to-transparent',
                border: 'border-orange-400/35',
                bg: 'bg-gradient-to-b from-orange-950/80 via-stone-900/90 to-stone-950/95',
                renderIcon: () => (
                    <img
                        src="/images/guild/tokken.webp"
                        alt="길드 코인"
                        className="h-full w-full object-contain drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]"
                    />
                ),
            },
            {
                key: 'guildXp',
                label: '길드 경험치',
                amount: `+${rewards.guildXp.toLocaleString()}`,
                accent: 'text-blue-200',
                glow: 'from-blue-500/25 via-indigo-600/10 to-transparent',
                border: 'border-blue-400/35',
                bg: 'bg-gradient-to-b from-blue-950/80 via-stone-900/90 to-stone-950/95',
                renderIcon: () => (
                    <GuildExpBadge className="h-7 min-w-[2.4rem] rounded-md border-blue-300/55 sm:h-8 sm:min-w-[2.6rem]" />
                ),
            },
            {
                key: 'researchPoints',
                label: '연구 포인트',
                amount: `+${rewards.researchPoints.toLocaleString()}`,
                accent: 'text-violet-200',
                glow: 'from-violet-500/25 via-purple-600/10 to-transparent',
                border: 'border-violet-400/35',
                bg: 'bg-gradient-to-b from-violet-950/80 via-stone-900/90 to-stone-950/95',
                renderIcon: () => (
                    <img
                        src="/images/guild/button/guildlab.webp"
                        alt="연구 포인트"
                        className="h-full w-full object-contain drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]"
                    />
                ),
            },
        ],
        [rewards]
    );

    const headerRing = isWinner
        ? 'from-amber-500/30 via-fuchsia-500/15 to-violet-500/30'
        : 'from-slate-500/25 via-zinc-600/10 to-slate-500/25';
    const outcomeBadge = isWinner
        ? 'border-amber-300/55 bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-orange-500/25 text-amber-100 shadow-[0_0_24px_-8px_rgba(251,191,36,0.55)]'
        : 'border-slate-400/45 bg-gradient-to-r from-slate-700/50 via-zinc-800/50 to-slate-700/50 text-slate-200';
    const outcomeTitle = isWinner
        ? 'bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-transparent'
        : 'text-slate-300';

    return (
        <div className="sudamr-modal-overlay z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
            <div
                className={`${PRE_GAME_MODAL_SHELL_CLASS} sudamr-panel-edge-host relative w-full max-w-[min(100%,34rem)] overflow-hidden ${useMobileChrome ? 'flex max-h-[min(92dvh,52rem)] flex-col' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {!useMobileChrome && (
                <>
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${headerRing}`} />
                <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

                <button
                    type="button"
                    onClick={onClose}
                    className={`absolute right-3 top-3 z-20 sm:right-4 sm:top-4 ${SUDAMR_MODAL_CLOSE_BUTTON_CLASS}`}
                    aria-label="닫기"
                >
                    닫기
                </button>
                </>
                )}
                {useMobileChrome && (
                    <MobileModalTitleBar
                        title={isWinner ? '길드 전쟁 승리' : '길드 전쟁 패배'}
                        onClose={onClose}
                    />
                )}

                <div className={`relative z-10 flex flex-col overflow-y-auto ${useMobileChrome ? 'min-h-0 flex-1' : 'max-h-[min(92dvh,52rem)]'} p-5 sm:p-6`}>
                    <div className="mb-4 flex flex-col items-center text-center sm:mb-5">
                        <div className="mb-3 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-stone-900/90 to-stone-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-16px_rgba(0,0,0,0.8)] sm:h-20 sm:w-20">
                            <img
                                src="/images/guild/button/guildwar.webp"
                                alt=""
                                className="h-12 w-12 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] sm:h-14 sm:w-14"
                            />
                        </div>
                        <div className={`mb-2 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold tracking-[0.14em] sm:text-xs ${outcomeBadge}`}>
                            {isWinner ? 'VICTORY' : 'DEFEAT'}
                        </div>
                        <h2 className={`text-2xl font-bold sm:text-3xl ${outcomeTitle}`} style={isWinner ? { textShadow: '0 0 24px rgba(251,191,36,0.28)' } : undefined}>
                            {isWinner ? '길드 전쟁 승리!' : '길드 전쟁 패배'}
                        </h2>
                        <p className="mt-1 text-xs text-white/55 sm:text-sm">전쟁 보상이 지급되었습니다</p>
                    </div>

                    <div className="mb-4 rounded-2xl border border-white/10 bg-gradient-to-b from-stone-900/75 to-stone-950/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:mb-5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-amber-100/90 sm:text-base">전쟁 결과</h3>
                            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white/55">
                                집계 완료
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div className="rounded-xl border border-amber-400/20 bg-black/20 px-3 py-2.5 text-center">
                                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-200/70 sm:text-[11px]">별 개수</div>
                                <div className="text-base font-bold tabular-nums text-amber-100 sm:text-lg">
                                    {warResult.guild1Stars}
                                    <span className="mx-1 text-white/35">:</span>
                                    {warResult.guild2Stars}
                                </div>
                            </div>
                            <div className="rounded-xl border border-violet-400/20 bg-black/20 px-3 py-2.5 text-center">
                                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-violet-200/70 sm:text-[11px]">집점수 합산</div>
                                <div className="text-base font-bold tabular-nums text-violet-100 sm:text-lg">
                                    {warResult.guild1Score.toLocaleString()}
                                    <span className="mx-1 text-white/35">:</span>
                                    {warResult.guild2Score.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-5 sm:mb-6">
                        <div className="mb-3 flex items-end justify-between gap-2">
                            <h3 className="text-sm font-semibold text-white/90 sm:text-base">획득 보상</h3>
                            <span className="text-[10px] text-white/45 sm:text-xs">총 5종</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                            {rewardCards.map((card, index) => (
                                <GuildWarRewardCard
                                    key={card.key}
                                    card={card}
                                    index={index}
                                    revealed={revealed}
                                    isWinner={isWinner}
                                />
                            ))}
                        </div>
                    </div>

                    <button type="button" onClick={onClose} className={`w-full touch-manipulation ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`}>
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuildWarRewardModal;
