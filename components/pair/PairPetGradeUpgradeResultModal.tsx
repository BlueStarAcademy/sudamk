import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow, { ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS } from '../DraggableWindow.js';
import Button from '../Button.js';
import { CORE_STATS_DATA } from '../../constants/index.js';
import type { InventoryItem, User } from '../../types.js';
import { CoreStat, ItemGrade } from '../../types/enums.js';
import {
    gradeBackgrounds,
    gradeStyles,
} from '../../shared/constants/items.js';
import { useLocalizedItemGrade, useLocalizedPairPetText } from '../../shared/i18n/localizedCatalog.js';
import { pairPetKataAbilityScore, type PairPetKataPhase } from '../../shared/constants/pairArena.js';
import { PAIR_PET_MAX_LEVEL, pairPetLevelUpStatBudget } from '../../shared/constants/pairPetGrade.js';
import { getPairPetDefinition } from '../../shared/constants/petLobby.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import { computePairPetKataCoreStatsSixFromMeta } from '../../shared/utils/pairPetKataStatsFromMeta.js';
import {
    computePairPetBadukTotalPower,
    computePairPetCoreGridShownBonusPerStat,
} from './PairPetCoreStatsGrid.js';

const CORE_LIST = Object.values(CoreStat) as CoreStat[];



export interface PairPetGradeUpgradeResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    itemAfter: InventoryItem;
    fromGrade: ItemGrade;
    toGrade: ItemGrade;
    isTopmost?: boolean;
}

const PairPetGradeUpgradeResultModal: React.FC<PairPetGradeUpgradeResultModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    itemAfter,
    fromGrade,
    toGrade,
    isTopmost = true,
}) => {
    const { t } = useTranslation(['pair', 'common', 'profile', 'game']);
    const { t: tCommon } = useTranslation('common');
    const localizedGrade = useLocalizedItemGrade();
    const { localizePetName } = useLocalizedPairPetText();
    const phaseDefs = useMemo(
        () =>
            [
                { phase: 'opening' as const, label: t('game:controls.phaseOpening') },
                { phase: 'midgame' as const, label: t('game:controls.phaseMidgame') },
                { phase: 'endgame' as const, label: t('game:controls.phaseEndgame') },
            ] as const,
        [t],
    );
    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(itemAfter), [itemAfter]);
    const levelSafe = useMemo(
        () => Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1)),
        [meta.level],
    );

    const petImg =
        itemAfter.image ??
        (itemAfter.templateId ? getPairPetDefinition(itemAfter.templateId)?.image : undefined) ??
        '';

    const fromBg = gradeBackgrounds[fromGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const toBg = gradeBackgrounds[toGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const fromSt = gradeStyles[fromGrade];
    const toSt = gradeStyles[toGrade];
    const fromKo = localizedGrade(fromGrade);
    const toKo = localizedGrade(toGrade);

    const beforeCells = useMemo(
        () =>
            computePairPetCoreGridShownBonusPerStat(
                currentUser,
                meta.disposition,
                fromGrade,
                meta.levelUpCoreBonuses,
                meta.birthCoreBases,
            ),
        [currentUser, meta.disposition, fromGrade, meta.levelUpCoreBonuses, meta.birthCoreBases],
    );
    const afterCells = useMemo(
        () =>
            computePairPetCoreGridShownBonusPerStat(
                currentUser,
                meta.disposition,
                toGrade,
                meta.levelUpCoreBonuses,
                meta.birthCoreBases,
            ),
        [currentUser, meta.disposition, toGrade, meta.levelUpCoreBonuses, meta.birthCoreBases],
    );

    const kataBefore = useMemo(() => computePairPetKataCoreStatsSixFromMeta(meta, fromGrade), [meta, fromGrade]);
    const kataAfter = useMemo(() => computePairPetKataCoreStatsSixFromMeta(meta, toGrade), [meta, toGrade]);

    const powerBefore = useMemo(
        () =>
            computePairPetBadukTotalPower(
                currentUser,
                meta.disposition,
                fromGrade,
                meta.levelUpCoreBonuses,
                meta.birthCoreBases,
            ),
        [currentUser, meta.disposition, fromGrade, meta.levelUpCoreBonuses, meta.birthCoreBases],
    );
    const powerAfter = useMemo(
        () =>
            computePairPetBadukTotalPower(
                currentUser,
                meta.disposition,
                toGrade,
                meta.levelUpCoreBonuses,
                meta.birthCoreBases,
            ),
        [currentUser, meta.disposition, toGrade, meta.levelUpCoreBonuses, meta.birthCoreBases],
    );
    const powerDelta = powerAfter - powerBefore;

    const budgetBefore = pairPetLevelUpStatBudget(fromGrade);
    const budgetAfter = pairPetLevelUpStatBudget(toGrade);

    if (!isOpen) return null;

    return (
        <DraggableWindow
            title={t('gradeUpgrade.completeTitle')}
            onClose={onClose}
            windowId="pair-pet-grade-upgrade-result"
            initialWidth={580}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={74}
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
            hideFooter
            bodyPaddingClassName="!p-0"
        >
            <div className="flex flex-col gap-2 overflow-x-hidden px-1.5 pb-2 pt-1.5 sm:gap-2.5 sm:px-2.5 sm:pb-2.5 sm:pt-2">
                <div className="relative min-w-0 rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-zinc-900/95 via-emerald-950/25 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.4)] ring-1 ring-emerald-400/15">
                    <div className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-emerald-400/12 blur-3xl" aria-hidden />
                    <div className="relative flex min-w-0 flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-3.5">
                        <div className="flex items-start gap-2.5 sm:items-center sm:gap-3">
                            <div
                                className={`relative h-[3.75rem] w-[3.75rem] shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-lg sm:h-[4.75rem] sm:w-[4.75rem] ${
                                    toGrade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''
                                }`}
                            >
                                <img src={toBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
                                {petImg ? (
                                    <img src={petImg} alt="" className="relative z-[1] h-full w-full object-contain p-1 sm:p-1.5" />
                                ) : null}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                                <p className="break-words text-sm font-black leading-snug tracking-tight text-fuchsia-100 sm:text-base">
                                    <span className="mr-1.5 font-black tabular-nums text-amber-200">Lv.{levelSafe}</span>
                                    {localizePetName(itemAfter)}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-row items-center gap-1.5 sm:gap-3">
                            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/45 px-1.5 py-2 shadow-inner sm:gap-2 sm:px-3 sm:py-3">
                                <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[0.62rem] sm:tracking-[0.18em]">{t('gradeUpgrade.before')}</span>
                                <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-white/12 sm:h-14 sm:w-14">
                                    <img src={fromBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                    {petImg ? (
                                        <img
                                            src={petImg}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
                                        />
                                    ) : null}
                                </div>
                                <span className={`text-center text-xs font-black leading-tight sm:text-sm ${fromSt.color}`}>{fromKo}</span>
                            </div>
                            <div className="flex shrink-0 items-center justify-center px-0.5" aria-hidden>
                                <div
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/35 bg-gradient-to-b from-emerald-600/25 to-emerald-950/55 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.12)] sm:h-9 sm:w-9"
                                    aria-hidden
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-95 sm:h-[18px] sm:w-[18px]">
                                        <path
                                            d="M5 12h14m0 0-4-4m4 4-4 4"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border border-emerald-400/30 bg-gradient-to-b from-emerald-950/40 to-black/50 px-1.5 py-2 shadow-[inset_0_1px_0_rgba(16,185,129,0.1)] sm:gap-2 sm:px-3 sm:py-3">
                                <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-emerald-200/75 sm:text-[0.62rem] sm:tracking-[0.18em]">{t('gradeUpgrade.after')}</span>
                                <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-emerald-300/25 sm:h-14 sm:w-14">
                                    <img src={toBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                    {petImg ? (
                                        <img
                                            src={petImg}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
                                        />
                                    ) : null}
                                </div>
                                <span className={`text-center text-xs font-black leading-tight sm:text-sm ${toSt.color}`}>{toKo}</span>
                            </div>
                        </div>

                        <div className="rounded-xl border border-sky-500/25 bg-gradient-to-r from-sky-950/35 to-zinc-950/80 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-2.5 sm:py-2">
                            <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0.5 text-center text-xs sm:text-sm">
                                <span className="font-semibold text-slate-400">{t('gradeUpgrade.levelUpRandomBudget')}</span>
                                <span className="font-mono font-bold tabular-nums text-amber-100">{budgetBefore}</span>
                                <span className="font-bold text-slate-500">→</span>
                                <span className="font-mono font-bold tabular-nums text-amber-100">{budgetAfter}</span>
                                <span className="font-bold tabular-nums text-emerald-300">
                                    (+{budgetAfter - budgetBefore})
                                </span>
                            </div>
                            <div className="my-1.5 border-t border-white/10" />
                            <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
                                <span className="text-[0.65rem] font-bold text-amber-100/95 sm:text-xs">{t('profile:badukAbility')}</span>
                                <span className="font-mono text-sm font-black tabular-nums text-amber-50 sm:text-base">{powerBefore}</span>
                                <span className="text-xs font-bold text-slate-500">→</span>
                                <span className="font-mono text-sm font-black tabular-nums text-amber-50 sm:text-base">{powerAfter}</span>
                                <span
                                    className={`text-xs font-black tabular-nums sm:text-sm ${
                                        powerDelta > 0 ? 'text-emerald-300' : powerDelta < 0 ? 'text-rose-300' : 'text-slate-500'
                                    }`}
                                >
                                    ({powerDelta > 0 ? '+' : ''}
                                    {powerDelta})
                                </span>
                            </div>
                            <div className="mt-1.5 flex flex-col gap-1 border-t border-white/10 pt-1.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-2 sm:gap-y-0.5">
                                {phaseDefs.map(({ phase, label }) => {
                                    const b = pairPetKataAbilityScore(phase, kataBefore);
                                    const a = pairPetKataAbilityScore(phase, kataAfter);
                                    const d = a - b;
                                    return (
                                        <span key={phase} className="flex items-baseline justify-center gap-1 sm:inline-flex sm:gap-0.5">
                                            <span className="font-semibold text-slate-400">{label}</span>
                                            <span className="font-mono font-bold text-sky-100/95">{b}</span>
                                            <span className="text-slate-500">→</span>
                                            <span className="font-mono font-bold text-sky-50">{a}</span>
                                            <span className={d > 0 ? 'font-bold text-emerald-300' : d < 0 ? 'font-bold text-rose-300' : 'text-slate-500'}>
                                                ({d > 0 ? '+' : ''}
                                                {d})
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-w-0">
                            <p className="mb-1.5 text-center text-sm font-medium leading-snug text-slate-300 sm:text-[0.9375rem]">
                                {t('gradeUpgrade.statChanges')}
                            </p>
                            <ul className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
                                {CORE_LIST.map((stat) => {
                                    const label = CORE_STATS_DATA[stat]?.name ?? stat;
                                    const bShown = beforeCells[stat]!.shown + beforeCells[stat]!.bonus;
                                    const aShown = afterCells[stat]!.shown + afterCells[stat]!.bonus;
                                    const d = aShown - bShown;
                                    return (
                                        <li
                                            key={stat}
                                            className="min-w-0 rounded-lg border border-white/10 bg-black/35 px-2 py-1.5 ring-1 ring-inset ring-white/[0.04] sm:px-2.5 sm:py-2"
                                        >
                                            <p className="truncate text-[0.65rem] font-semibold leading-tight text-slate-400 sm:text-xs">
                                                {label}
                                            </p>
                                            <p className="mt-0.5 whitespace-nowrap text-[0.7rem] font-mono font-bold leading-tight tabular-nums text-slate-100 sm:text-xs">
                                                <span>{bShown}</span>
                                                <span className="text-slate-500"> → </span>
                                                <span>{aShown}</span>
                                                <span
                                                    className={`ml-1 ${
                                                        d > 0 ? 'text-emerald-300' : d < 0 ? 'text-rose-300' : 'text-slate-500'
                                                    }`}
                                                >
                                                    ({d > 0 ? '+' : ''}
                                                    {d})
                                                </span>
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center px-1 pb-1 sm:px-2">
                    <Button type="button" onClick={onClose} bare colorScheme="none" className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}>
                        {tCommon('actions.confirm')}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairPetGradeUpgradeResultModal;
