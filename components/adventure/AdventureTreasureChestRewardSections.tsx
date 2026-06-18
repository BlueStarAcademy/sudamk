import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdventureTreasureUserRewardSections } from '../../shared/utils/adventureMapTreasureRewards.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';

const GOLD_SRC = '/images/icon/Gold.webp';

type Props = {
    sections: AdventureTreasureUserRewardSections;
    /** 모바일·좁은 말풍선 */
    compact?: boolean;
    /** 골드·장비·재료·행동력 2×2 그리드(모바일 보물상자 등) */
    grid2x2?: boolean;
};

const tileBase =
    'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-b from-zinc-900/90 to-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/[0.06]';

/** 보물상자 보상 — 가로 전폭 밴드(모바일 세로 스택), 행동력은 번개만 강조 */
const AdventureTreasureChestRewardSections: React.FC<Props> = ({ sections, compact, grid2x2 }) => {
    const { t } = useTranslation('lobby');
    const imgSm = grid2x2 ? 'h-10 w-10' : compact ? 'h-7 w-7' : 'h-9 w-9 sm:h-10 sm:w-10';
    const imgMd = grid2x2 ? 'h-11 w-11' : compact ? 'h-8 w-8' : 'h-10 w-10 sm:h-11 sm:w-11';
    const goldIcon = grid2x2 ? 'h-[3.25rem] w-[3.25rem]' : compact ? 'h-10 w-10' : 'h-12 w-12 sm:h-14 sm:w-14';

    const padGrid = 'p-3 sm:p-3.5';
    const pad = compact ? 'p-2 sm:p-2.5' : 'p-3 sm:p-3.5';
    const rowGap = compact ? 'gap-2' : 'gap-3 sm:gap-3.5';

    if (grid2x2) {
        const cell = `${tileBase} ${padGrid} flex min-h-[7rem] w-full min-w-0 flex-col justify-center sm:min-h-[7.25rem]`;
        return (
            <div className="w-full min-w-0 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/45 via-zinc-950/85 to-violet-950/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-3.5">
                <div className="grid w-full grid-cols-2 gap-3 sm:gap-3.5">
                    <section className={cell} aria-label={t('adventure.goldRewardRangeAria')}>
                        <span className="sr-only">{t('adventure.gold')}</span>
                        <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
                            <img src={GOLD_SRC} alt="" className={`${goldIcon} shrink-0 object-contain drop-shadow-md`} draggable={false} />
                            <p className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-center font-mono text-xs font-black tabular-nums leading-none text-transparent sm:text-[13px]">
                                {formatGoldAmountKoG(sections.goldMin)}
                                <span className="mx-0.5 text-amber-500/80" aria-hidden>
                                    —
                                </span>
                                {formatGoldAmountKoG(sections.goldMax)}
                            </p>
                        </div>
                    </section>
                    <section
                        className={cell}
                        aria-label={t('adventure.equipmentBoxGradeAria', { count: sections.equipmentPoolSize })}
                    >
                        <span className="sr-only">{t('adventure.equipmentBox')}</span>
                        <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5">
                            {sections.equipmentImages.map((src, i) => (
                                <img key={`eq-g-${i}`} src={src} alt="" className={`${imgSm} shrink-0 object-contain drop-shadow`} draggable={false} />
                            ))}
                        </div>
                    </section>
                    <section
                        className={cell}
                        aria-label={t('adventure.materialBoxGradeAria', { count: sections.materialPoolSize })}
                    >
                        <span className="sr-only">{t('adventure.materialBox')}</span>
                        <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5">
                            {sections.materialImages.map((src, i) => (
                                <img key={`mat-g-${i}`} src={src} alt="" className={`${imgMd} shrink-0 object-contain drop-shadow`} draggable={false} />
                            ))}
                        </div>
                    </section>
                    <section className={cell} aria-label={t('adventure.actionPointsRecoverAria', { points: sections.actionPoints })}>
                        <span className="sr-only">{t('adventure.actionPointsRecovery')}</span>
                        <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
                            <span className="text-3xl leading-none drop-shadow-md sm:text-[2rem]" aria-hidden>
                                ⚡
                            </span>
                            <p className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-center font-mono text-sm font-black tabular-nums leading-none text-transparent">
                                {t('adventure.recoverPoints', { points: sections.actionPoints })}
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div
            className={
                compact
                    ? `w-full min-w-0 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-zinc-950/80 to-violet-950/30 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`
                    : `w-full min-w-0 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/50 via-zinc-950/85 to-violet-950/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_40px_-20px_rgba(0,0,0,0.65)] sm:p-3.5`
            }
        >
            <div className={`flex w-full min-w-0 flex-col ${rowGap} sm:flex-row sm:items-stretch`}>
                <section className={`${tileBase} ${pad} order-1 w-full shrink-0 sm:order-1 sm:w-[6.75rem] sm:max-w-[7rem]`} aria-label={t('adventure.goldRewardRangeAria')}>
                    <span className="sr-only">{t('adventure.gold')}</span>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
                        <img src={GOLD_SRC} alt="" className={`${goldIcon} shrink-0 object-contain drop-shadow-md`} draggable={false} />
                        <p className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-center font-mono text-[11px] font-black tabular-nums leading-none text-transparent sm:text-xs">
                            {formatGoldAmountKoG(sections.goldMin)}
                            <span className="mx-0.5 text-amber-500/80" aria-hidden>
                                —
                            </span>
                            {formatGoldAmountKoG(sections.goldMax)}
                        </p>
                    </div>
                </section>

                <section
                    className={`${tileBase} ${pad} order-3 w-full min-w-0 flex-1 sm:order-2 sm:min-w-[9.25rem]`}
                    aria-label={t('adventure.equipmentBoxGradeAria', { count: sections.equipmentPoolSize })}
                >
                    <span className="sr-only">{t('adventure.equipmentBox')}</span>
                    <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                        {sections.equipmentImages.map((src, i) => (
                            <img key={`eq-${i}`} src={src} alt="" className={`${imgSm} shrink-0 object-contain drop-shadow`} draggable={false} />
                        ))}
                    </div>
                </section>

                <section
                    className={`${tileBase} ${pad} order-4 w-full min-w-0 flex-1 sm:order-3 sm:min-w-[9.25rem]`}
                    aria-label={t('adventure.materialBoxGradeAria', { count: sections.materialPoolSize })}
                >
                    <span className="sr-only">{t('adventure.materialBox')}</span>
                    <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                        {sections.materialImages.map((src, i) => (
                            <img key={`mat-${i}`} src={src} alt="" className={`${imgMd} shrink-0 object-contain drop-shadow`} draggable={false} />
                        ))}
                    </div>
                </section>

                <section
                    className={`${tileBase} ${pad} order-2 w-full shrink-0 sm:order-4 sm:w-[6.75rem] sm:max-w-[7rem]`}
                    aria-label={t('adventure.actionPointsRecoverAria', { points: sections.actionPoints })}
                >
                    <span className="sr-only">{t('adventure.actionPointsRecovery')}</span>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
                        <span className="text-[1.75rem] leading-none drop-shadow-md sm:text-[2rem]" aria-hidden>
                            ⚡
                        </span>
                        <p className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-center font-mono text-xs font-black tabular-nums leading-none text-transparent sm:text-[13px]">
                            {t('adventure.recoverPoints', { points: sections.actionPoints })}
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdventureTreasureChestRewardSections;
