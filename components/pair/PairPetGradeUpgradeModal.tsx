import React, { useMemo, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import type { InventoryItem, User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import {
    CORE_STATS_DATA,
    gradeBackgrounds,
    gradeStyles,
    MATERIAL_ITEMS,
} from '../../shared/constants/items.js';
import { useLocalizedItemGrade, useLocalizedPairPetText } from '../../shared/i18n/localizedCatalog.js';
import {
    isPairPetUpgradeableGrade,
    nextPairPetGrade,
    PAIR_PET_MAX_LEVEL,
    pairPetGradeUpgradeSoulStoneCount,
    pairPetGradeUpgradeSoulStoneMaterialName,
    pairPetGradeUpgradeSoulTemplateId,
    pairPetLevelUpStatBudget,
    pairPetMinLevelForNextGrade,
} from '../../shared/constants/pairPetGrade.js';
import { isPairSoulStoneItem } from '../../shared/constants/petLobby.js';
import {
    bumpPairPetDispositionPctOnGradeUpgrade,
    resolvePairPetMetaFromInventoryRow,
} from '../../shared/utils/pairPetRoll.js';
import {
    PAIR_PET_DETAIL_MODAL_INITIAL_WIDTH,
    PAIR_PET_GRADE_UPGRADE_MODAL_INITIAL_HEIGHT,
    PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX,
    PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS,
} from '../../shared/constants/pairPetModal.js';

export interface PairPetGradeUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    mainItem: InventoryItem;
    isBusy: boolean;
    onConfirm: () => void | Promise<void>;
    isTopmost?: boolean;
}

const PairPetGradeUpgradeModal: React.FC<PairPetGradeUpgradeModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    mainItem,
    isBusy,
    onConfirm,
    isTopmost = true,
}) => {
    const { t } = useTranslation(['pair', 'common']);
    const { t: tCommon } = useTranslation('common');
    const localizedGrade = useLocalizedItemGrade();
    const { localizePetName } = useLocalizedPairPetText();
    const mainGradeStored = mainItem.grade ?? ItemGrade.Normal;
    const nextG = nextPairPetGrade(mainGradeStored);
    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(mainItem), [mainItem]);
    const levelSafe = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
    const needLv = pairPetMinLevelForNextGrade(mainGradeStored);

    const soulTid = pairPetGradeUpgradeSoulTemplateId(mainGradeStored);
    const soulNeed = pairPetGradeUpgradeSoulStoneCount(mainGradeStored);
    const soulMatName = pairPetGradeUpgradeSoulStoneMaterialName(mainGradeStored);

    const soulMat =
        soulMatName && soulMatName in MATERIAL_ITEMS
            ? MATERIAL_ITEMS[soulMatName as keyof typeof MATERIAL_ITEMS]
            : null;

    const ownedSoul = useMemo(() => {
        if (!soulTid) return 0;
        return (currentUser.inventory || []).reduce((sum, it) => {
            if (!isPairSoulStoneItem(it) || it.templateId !== soulTid) return sum;
            return sum + (it.quantity ?? 1);
        }, 0);
    }, [currentUser.inventory, soulTid]);

    const budgetNext = nextG ? pairPetLevelUpStatBudget(nextG) : null;

    const dispositionUpgradePreview = useMemo(() => {
        const d = meta.disposition;
        const bumped = bumpPairPetDispositionPctOnGradeUpgrade(d);
        if (d.kind === 'single') {
            const name = CORE_STATS_DATA[d.stat]?.name ?? String(d.stat);
            return t('pet.dispositionUpgradeSingle', { stat: name, from: d.pct, to: bumped.pct });
        }
        if (d.kind === 'all') {
            return t('pet.dispositionUpgradeAll', { from: d.pct, to: bumped.pct });
        }
        const fromName = CORE_STATS_DATA[d.fromStat]?.name ?? String(d.fromStat);
        const toName = CORE_STATS_DATA[d.toStat]?.name ?? String(d.toStat);
        return t('pet.dispositionUpgradeConvert', { from: fromName, to: toName, fromPct: d.pct, toPct: bumped.pct });
    }, [meta.disposition]);

    const [gradeBlockHint, setGradeBlockHint] = useState<string | null>(null);

    const tryConfirm = () => {
        if (isBusy) return;
        if (!isPairPetUpgradeableGrade(mainGradeStored) || !nextG) {
            setGradeBlockHint(t('gradeUpgrade.noHigherGrade'));
            return;
        }
        if (levelSafe < needLv) {
            setGradeBlockHint(t('gradeUpgrade.levelInsufficient', { need: needLv, current: levelSafe }));
            return;
        }
        if (soulNeed == null || soulTid == null) {
            setGradeBlockHint(t('gradeUpgrade.conditionsUnknown'));
            return;
        }
        if (ownedSoul < soulNeed) {
            const nameKo = soulMat?.name ?? soulMatName ?? t('gradeUpgrade.soulStoneFallback');
            setGradeBlockHint(t('gradeUpgrade.soulInsufficient', { name: nameKo, need: soulNeed, owned: ownedSoul }));
            return;
        }
        void onConfirm();
    };

    const mainSt = gradeStyles[mainGradeStored];
    const mainBg = gradeBackgrounds[mainGradeStored] ?? gradeBackgrounds[ItemGrade.Normal];
    const nextSt = nextG ? gradeStyles[nextG] : null;
    const nextBg = nextG ? gradeBackgrounds[nextG] ?? gradeBackgrounds[ItemGrade.Normal] : null;
    const gradeKo = localizedGrade(mainGradeStored);
    const nextGradeKo = nextG ? localizedGrade(nextG) : null;

    if (!isOpen) return null;

    return (
        <DraggableWindow
            title={t('gradeUpgrade.title')}
            onClose={onClose}
            windowId="pair-pet-grade-upgrade"
            initialWidth={PAIR_PET_DETAIL_MODAL_INITIAL_WIDTH}
            initialHeight={PAIR_PET_GRADE_UPGRADE_MODAL_INITIAL_HEIGHT}
            isTopmost={isTopmost}
            zIndex={72}
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileLockViewportHeight
            mobileViewportMaxHeightVh={99}
            mobileViewportMaxHeightCss={PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS}
            mobileViewportDvhBottomGapPx={PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX}
            hideFooter
            bodyPaddingClassName="flex min-h-0 min-w-0 flex-1 flex-col !p-0"
        >
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2 sm:gap-3.5 sm:px-4 sm:pb-5 sm:pt-2.5">
                <div className="flex flex-col gap-2.5 sm:gap-3.5">
                <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/95 via-violet-950/40 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.4)] ring-1 ring-amber-400/10">
                    <div
                        className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl"
                        aria-hidden
                    />
                    <div
                        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl"
                        aria-hidden
                    />

                    <div className="relative flex flex-col gap-3 p-3 sm:gap-4 sm:p-4">
                        <div className="flex items-start gap-2.5 sm:items-center sm:gap-3.5">
                            <div
                                className={`relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-lg border border-white/15 shadow-lg sm:h-[5rem] sm:w-[5rem] sm:rounded-xl ${mainGradeStored === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`}
                            >
                                <img src={mainBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
                                <img src={mainItem.image} alt="" className="relative z-[1] h-full w-full object-contain p-1 sm:p-1.5" />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                                <p
                                    className={`break-words text-base font-black leading-snug tracking-tight sm:text-lg ${mainSt.color}`}
                                >
                                    <span className="mr-1.5 font-black tabular-nums text-amber-200">Lv.{levelSafe}</span>
                                    {localizePetName(mainItem)}
                                </p>
                                {levelSafe < needLv ? (
                                    <p className="mt-1 text-xs font-semibold text-amber-300/95 sm:text-sm">{t('gradeUpgrade.untilLevel', { level: needLv })}</p>
                                ) : null}
                            </div>
                        </div>

                        {nextG && nextSt && nextBg && nextGradeKo ? (
                            <div className="flex flex-row items-center gap-2 sm:gap-3.5">
                                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-black/45 px-2 py-2.5 shadow-inner sm:gap-2 sm:px-3 sm:py-3.5">
                                    <span className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">{t('gradeUpgrade.current')}</span>
                                    <div
                                        className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/15 sm:h-16 sm:w-16"
                                        aria-hidden
                                    >
                                        <img src={mainBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                        <img
                                            src={mainItem.image}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1 sm:p-1.5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
                                        />
                                    </div>
                                    <span className={`text-center text-sm font-black leading-tight sm:text-base ${mainSt.color}`}>{gradeKo}</span>
                                </div>

                                <div className="flex shrink-0 items-center justify-center px-0.5" aria-hidden>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/35 bg-gradient-to-b from-amber-600/30 to-amber-950/60 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.15)] sm:h-10 sm:w-10">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-95 sm:h-5 sm:w-5">
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

                                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-950/50 to-black/50 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)] sm:gap-2 sm:px-3 sm:py-3.5">
                                    <span className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-amber-200/70 sm:text-xs sm:tracking-[0.2em]">{t('gradeUpgrade.next')}</span>
                                    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-amber-300/25 sm:h-16 sm:w-16">
                                        <img src={nextBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                        <img
                                            src={mainItem.image}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1 sm:p-1.5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
                                        />
                                    </div>
                                    <span className={`text-center text-sm font-black leading-tight sm:text-base ${nextSt.color}`}>{nextGradeKo}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-lg border border-white/10 bg-black/40 py-3 text-center text-base text-slate-400">
                                {t('gradeUpgrade.noHigherGrade')}
                            </p>
                        )}

                        {nextG && budgetNext != null ? (
                            <div className="rounded-xl border border-white/[0.08] bg-black/50 p-3 backdrop-blur-sm sm:p-3.5">
                                <dl className="space-y-3 text-sm sm:text-[0.9375rem]">
                                    <div className="flex flex-col gap-1 border-b border-white/[0.06] pb-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                        <dt className="text-slate-400">{t('gradeUpgrade.baseStatIncrease')}</dt>
                                        <dd className="tabular-nums font-mono font-black text-amber-200 sm:text-right">{t('gradeUpgrade.percentTen')}</dd>
                                    </div>
                                    <div className="flex flex-col gap-1 pt-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                        <dt className="break-words leading-snug text-slate-400">
                                            {t('gradeUpgrade.nextGradeLevelUpBudget')}
                                        </dt>
                                        <dd className="shrink-0 tabular-nums font-mono font-black text-violet-200 sm:text-right">+{budgetNext}</dd>
                                    </div>
                                </dl>
                                <div className="mt-2.5 min-w-0 border-t border-white/[0.06] pt-2.5">
                                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-fuchsia-300/90 sm:text-[0.8125rem]">{t('gradeUpgrade.dispositionBoost')}</p>
                                    <p className="mt-1.5 break-words text-left text-sm font-semibold tabular-nums leading-relaxed text-fuchsia-100/95 sm:text-[0.9375rem] sm:leading-snug">
                                        {dispositionUpgradePreview}
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {nextG ? (
                    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/35 to-black/40 p-3.5 shadow-inner ring-1 ring-inset ring-white/[0.04] sm:p-4">
                        <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-300/85 sm:text-[0.8125rem]">{t('gradeUpgrade.requiredMaterials')}</p>
                        <div className="flex flex-wrap items-center gap-3.5">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/50 shadow-md sm:h-[4.5rem] sm:w-[4.5rem]">
                                {soulMat?.image ? (
                                    <img src={soulMat.image} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">{t('gradeUpgrade.soulStoneFallback')}</div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-base font-extrabold text-violet-50 sm:text-lg">{soulMat?.name ?? soulMatName ?? t('gradeUpgrade.soulStoneFallback')}</p>
                                <p className="mt-1 tabular-nums text-sm font-bold text-slate-300">
                                    <Trans
                                        i18nKey="pair:gradeUpgrade.ownedCount"
                                        values={{ owned: ownedSoul, need: soulNeed ?? '—' }}
                                        components={{
                                            owned: <span className="text-fuchsia-200" />,
                                            sep: <span className="text-slate-500" />,
                                            need: <span className="text-amber-200" />,
                                        }}
                                    />
                                </p>
                            </div>
                        </div>
                        {ownedSoul < (soulNeed ?? 0) ? (
                            <p className="mt-2 text-sm font-semibold text-rose-300/95">{t('gradeUpgrade.soulInsufficientInline')}</p>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex shrink-0 justify-center border-t border-white/10 pb-0.5 pt-3">
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => tryConfirm()}
                        className="min-w-[10rem] rounded-lg border border-amber-400/45 bg-gradient-to-b from-amber-600/95 to-amber-950 px-6 py-2.5 text-base font-extrabold text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.12)] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[11rem] sm:py-3"
                    >
                        {t('gradeUpgrade.action')}
                    </button>
                </div>
                </div>
            </div>
            {gradeBlockHint ? (
                <DraggableWindow
                    title={t('lobby.noticeTitle')}
                    onClose={() => setGradeBlockHint(null)}
                    windowId="pair-pet-grade-upgrade-modal-hint"
                    initialWidth={420}
                    shrinkHeightToContent
                    isTopmost
                    zIndex={73}
                    skipSavedPosition
                    variant="store"
                    hideFooter
                    bodyPaddingClassName="!p-4 sm:!p-5"
                >
                    <p className="text-center text-sm font-medium leading-relaxed text-slate-200 sm:text-[0.95rem]">
                        {gradeBlockHint}
                    </p>
                </DraggableWindow>
            ) : null}
        </DraggableWindow>
    );
};

export default PairPetGradeUpgradeModal;
