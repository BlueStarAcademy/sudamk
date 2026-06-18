import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { getMannerScore, getMannerRank, getMannerStyle, MANNER_RANKS } from '../services/manner.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface MannerRankModalProps {
    user: User;
    onClose: () => void;
    isTopmost?: boolean;
}

/** 본문은 창( DraggableWindow ) 한 곳만 세로 스크롤 — 내부 max-height 스크롤 금지 */
const MannerRankModal: React.FC<MannerRankModalProps> = ({ user, onClose, isTopmost }) => {
    const { t } = useTranslation('profile');
    const { isNativeMobile } = useNativeMobileShell();
    const totalMannerScore = getMannerScore(user);
    const mannerRank = getMannerRank(totalMannerScore);
    const mannerStyle = getMannerStyle(totalMannerScore);

    const rankListRef = useRef<HTMLDivElement>(null);
    const activeRankRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!rankListRef.current || !activeRankRef.current) return;
        activeRankRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [totalMannerScore]);

    /** 통일 타이포 — 한 단계 작게 (가독성 유지) */
    const typo = {
        sectionTitle: 'text-sm font-bold tracking-tight text-slate-100 sm:text-base',
        body: 'text-xs leading-relaxed text-slate-300 sm:text-sm sm:leading-relaxed',
        bodyMuted: 'text-xs leading-relaxed text-slate-500 sm:text-sm',
        cardTitle: 'text-xs font-bold sm:text-sm',
        cardMeta: 'text-[0.65rem] font-medium tabular-nums text-slate-500 sm:text-xs',
        cardBody: 'text-xs leading-snug text-slate-400 sm:text-sm sm:leading-relaxed',
        badge: 'rounded-full border border-amber-400/45 bg-amber-500/15 px-1.5 py-px text-[0.65rem] font-bold text-amber-100 sm:text-xs',
    };

    const sectionPad = isNativeMobile ? 'p-3 sm:p-3.5' : 'p-3 sm:p-4';
    const gapMain = 'gap-3 sm:gap-4';

    return (
        <DraggableWindow
            title={t('mannerRank.title')}
            onClose={onClose}
            windowId="manner-rank"
            initialWidth={640}
            initialHeight={540}
            shrinkHeightToContent={false}
            isTopmost={isTopmost}
        >
            <div className={`relative flex w-full min-w-0 flex-col ${gapMain}`}>
                <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-16 -right-20 h-48 w-48 rounded-full bg-teal-500/[0.08] blur-3xl" aria-hidden />

                {/* 프로필 홈「매너 등급」패널과 동일한 박스 (등급 정보 버튼만 생략) */}
                <section className="min-w-0">
                    <div
                        className="w-full min-w-0 overflow-hidden rounded-lg border border-amber-500/35 bg-gradient-to-b from-zinc-800/90 to-zinc-950 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_-18px_rgba(0,0,0,0.65)] sm:p-2.5"
                    >
                        <div className="mb-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1">
                            <span className="shrink-0 font-bold text-amber-100/95 text-sm sm:text-base">{t('mannerRank.grade')}</span>
                            <span
                                className={`min-w-0 shrink truncate font-bold tabular-nums text-sm sm:text-base ${mannerRank.color}`}
                                title={t('mannerRank.mannerPointsTitle', { score: totalMannerScore, rank: mannerRank.rank })}
                            >
                                {totalMannerScore}점 ({mannerRank.rank})
                            </span>
                        </div>
                        <div className="w-full rounded-full border border-color bg-tertiary/50 h-2 sm:h-2">
                            <div className={`${mannerStyle.colorClass} h-full rounded-full`} style={{ width: `${mannerStyle.percentage}%` }} />
                        </div>
                    </div>
                </section>

                <section
                    className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/92 to-slate-950/98 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.04] ${sectionPad}`}
                >
                    <div className="mb-3">
                        <h3 className={typo.sectionTitle}>{t('mannerRank.effectsByGrade')}</h3>
                        <p className={`mt-1 ${typo.bodyMuted}`}>{t('mannerRank.rangeHint')}</p>
                    </div>
                    {/* 단일 스크롤: 창 본문만 스크롤 — 여기서는 overflow 제거 */}
                    <div ref={rankListRef} className="flex flex-col gap-2.5 sm:gap-3">
                        {MANNER_RANKS.slice()
                            .reverse()
                            .map((rank, index) => {
                                const isActive = totalMannerScore >= rank.min && totalMannerScore <= rank.max;
                                const rankColor = getMannerRank(rank.min === 0 ? 0 : rank.min).color;
                                const effects: string[] = [];

                                if (rank.min >= 2000) effects.push(t('mannerRank.allStatsPlus10'));
                                if (rank.min >= 1600) effects.push(t('mannerRank.disassembleJackpot'));
                                if (rank.min >= 1200) effects.push(t('mannerRank.winItemBonus'));
                                if (rank.min >= 800) effects.push(t('mannerRank.winGoldBonus'));
                                if (rank.min >= 400) effects.push(t('mannerRank.maxApPlus10'));
                                if (rank.max <= 0) effects.push(t('mannerRank.maxApMinus20'));
                                if (rank.max <= 49 && rank.max > 0) effects.push(t('mannerRank.apRegenBoost'));
                                if (rank.max <= 99 && rank.max > 0) effects.push(t('mannerRank.winGoldPenalty'));
                                if (rank.max <= 199 && rank.max > 0) effects.push(t('mannerRank.winItemPenalty'));
                                if (rank.min >= 200 && rank.max <= 399) effects.push(t('mannerRank.noEffect'));

                                return (
                                    <div
                                        key={index}
                                        ref={isActive ? activeRankRef : null}
                                        className={`relative overflow-hidden rounded-xl border transition-shadow duration-200 ${
                                            isActive
                                                ? 'border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-slate-950/85 to-slate-950 shadow-[0_0_0_1px_rgba(251,191,36,0.14),0_12px_32px_-16px_rgba(251,191,36,0.18)] ring-1 ring-amber-400/30'
                                                : 'border-white/[0.07] bg-black/25 ring-1 ring-inset ring-white/[0.04] hover:border-white/12'
                                        } p-3 sm:p-4`}
                                    >
                                        {isActive && (
                                            <div
                                                className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-600/80"
                                                aria-hidden
                                            />
                                        )}
                                        <div className={`flex flex-wrap items-center justify-between gap-2 ${isActive ? 'pl-1 sm:pl-1.5' : ''}`}>
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                <span className={`min-w-0 ${typo.cardTitle} ${rankColor}`}>{rank.name}</span>
                                                {isActive ? <span className={typo.badge}>{t('mannerRank.currentBadge')}</span> : null}
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-lg border border-white/[0.08] bg-black/40 px-2 py-1 font-mono ${typo.cardMeta}`}
                                            >
                                                {rank.min === 0 && rank.max === 0
                                                    ? t('mannerRank.zeroScore')
                                                    : rank.max === Infinity
                                                      ? t('mannerRank.scoreAbove', { min: rank.min })
                                                      : t('mannerRank.scoreRange', { min: rank.min, max: rank.max })}
                                            </span>
                                        </div>
                                        {effects.length > 0 && (
                                            <div
                                                className={`mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2.5 ${isActive ? 'pl-1 sm:pl-1.5' : ''}`}
                                            >
                                                {effects.map((effect, i) => (
                                                    <div key={i} className={`flex gap-2 ${typo.cardBody}`}>
                                                        <span className="shrink-0 text-slate-600" aria-hidden>
                                                            ·
                                                        </span>
                                                        <span>{effect}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </section>
            </div>
        </DraggableWindow>
    );
};

export default MannerRankModal;
