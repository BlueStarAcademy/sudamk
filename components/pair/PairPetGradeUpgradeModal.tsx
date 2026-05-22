import React, { useMemo, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import { PairPetDetailFitScale } from './PairPetDetailCardBody.js';
import type { InventoryItem, User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import {
    CORE_STATS_DATA,
    gradeBackgrounds,
    gradeStyles,
    EQUIPMENT_GRADE_LABEL_KO,
    MATERIAL_ITEMS,
} from '../../shared/constants/items.js';
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
import { getPairPetDisplayName, isPairSoulStoneItem } from '../../shared/constants/petLobby.js';
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
            return `${name} +${d.pct}% → ${bumped.pct}%`;
        }
        if (d.kind === 'all') {
            return `모든 능력치 +${d.pct}% → ${bumped.pct}%`;
        }
        const fromName = CORE_STATS_DATA[d.fromStat]?.name ?? String(d.fromStat);
        const toName = CORE_STATS_DATA[d.toStat]?.name ?? String(d.toStat);
        return `${fromName}→${toName} +${d.pct}% → ${bumped.pct}%`;
    }, [meta.disposition]);

    const [gradeBlockHint, setGradeBlockHint] = useState<string | null>(null);

    const tryConfirm = () => {
        if (isBusy) return;
        if (!isPairPetUpgradeableGrade(mainGradeStored) || !nextG) {
            setGradeBlockHint('더 올릴 수 있는 등급이 없습니다.');
            return;
        }
        if (levelSafe < needLv) {
            setGradeBlockHint(`펫 레벨이 부족합니다. Lv.${needLv} 필요 (현재 Lv.${levelSafe})`);
            return;
        }
        if (soulNeed == null || soulTid == null) {
            setGradeBlockHint('등급 강화 조건을 확인할 수 없습니다.');
            return;
        }
        if (ownedSoul < soulNeed) {
            const nameKo = soulMat?.name ?? soulMatName ?? '영혼석';
            setGradeBlockHint(`${nameKo}이 부족합니다. ${soulNeed}개 필요 (보유 ${ownedSoul}개)`);
            return;
        }
        void onConfirm();
    };

    const mainSt = gradeStyles[mainGradeStored];
    const mainBg = gradeBackgrounds[mainGradeStored] ?? gradeBackgrounds[ItemGrade.Normal];
    const nextSt = nextG ? gradeStyles[nextG] : null;
    const nextBg = nextG ? gradeBackgrounds[nextG] ?? gradeBackgrounds[ItemGrade.Normal] : null;
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[mainGradeStored] ?? mainGradeStored;
    const nextGradeKo = nextG ? EQUIPMENT_GRADE_LABEL_KO[nextG] ?? nextG : null;

    if (!isOpen) return null;

    return (
        <DraggableWindow
            title="펫 등급 강화"
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
            bodyNoScroll
            bodyPaddingClassName="flex min-h-0 min-w-0 flex-1 flex-col !p-0"
        >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 pb-2.5 pt-1.5">
                <PairPetDetailFitScale itemId={mainItem.id} outerClassName="min-h-0 flex-1" stretchInnerHeightWhenUnscaled>
                <div className="flex flex-col gap-2 sm:gap-3">
                <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/95 via-violet-950/40 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.4)] ring-1 ring-amber-400/10">
                    <div
                        className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl"
                        aria-hidden
                    />
                    <div
                        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl"
                        aria-hidden
                    />

                    <div className="relative flex flex-col gap-2.5 p-2 sm:gap-4 sm:p-4">
                        <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                            <div
                                className={`relative h-[3.5rem] w-[3.5rem] shrink-0 overflow-hidden rounded-lg border border-white/15 shadow-lg sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-xl ${mainGradeStored === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`}
                            >
                                <img src={mainBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
                                <img src={mainItem.image} alt="" className="relative z-[1] h-full w-full object-contain p-1 sm:p-1.5" />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                                <p
                                    className={`break-words text-sm font-black leading-snug tracking-tight sm:text-base ${mainSt.color}`}
                                >
                                    <span className="mr-1.5 font-black tabular-nums text-amber-200">Lv.{levelSafe}</span>
                                    {getPairPetDisplayName(mainItem)}
                                </p>
                                {levelSafe < needLv ? (
                                    <p className="mt-1 text-[11px] font-semibold text-amber-300/95">등급 강화까지 Lv.{needLv}</p>
                                ) : null}
                            </div>
                        </div>

                        {nextG && nextSt && nextBg && nextGradeKo ? (
                            <div className="flex flex-row items-center gap-1.5 sm:gap-3">
                                <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/45 px-1.5 py-2 shadow-inner sm:gap-2 sm:px-3 sm:py-3">
                                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[0.65rem] sm:tracking-[0.2em]">현재</span>
                                    <div
                                        className="relative h-11 w-11 overflow-hidden rounded-lg border border-white/15 sm:h-14 sm:w-14"
                                        aria-hidden
                                    >
                                        <img src={mainBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                        <img
                                            src={mainItem.image}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1 sm:p-1.5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
                                        />
                                    </div>
                                    <span className={`text-center text-xs font-black leading-tight sm:text-sm ${mainSt.color}`}>{gradeKo}</span>
                                </div>

                                <div className="flex shrink-0 items-center justify-center px-0.5" aria-hidden>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/35 bg-gradient-to-b from-amber-600/30 to-amber-950/60 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.15)] sm:h-9 sm:w-9">
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

                                <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-950/50 to-black/50 px-1.5 py-2 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)] sm:gap-2 sm:px-3 sm:py-3">
                                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-amber-200/70 sm:text-[0.65rem] sm:tracking-[0.2em]">다음</span>
                                    <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-amber-300/25 sm:h-14 sm:w-14">
                                        <img src={nextBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                        <img
                                            src={mainItem.image}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1 sm:p-1.5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
                                        />
                                    </div>
                                    <span className={`text-center text-xs font-black leading-tight sm:text-sm ${nextSt.color}`}>{nextGradeKo}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-lg border border-white/10 bg-black/40 py-3 text-center text-sm text-slate-400">
                                더 올릴 수 있는 등급이 없습니다.
                            </p>
                        )}

                        {nextG && budgetNext != null ? (
                            <div className="rounded-xl border border-white/[0.08] bg-black/50 p-2.5 backdrop-blur-sm sm:p-3">
                                <dl className="space-y-3 text-xs sm:text-[0.8125rem]">
                                    <div className="flex flex-col gap-1 border-b border-white/[0.06] pb-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                        <dt className="text-slate-400">기본 능력치 증가</dt>
                                        <dd className="tabular-nums font-mono font-black text-amber-200 sm:text-right">+10%</dd>
                                    </div>
                                    <div className="flex flex-col gap-1 pt-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                        <dt className="break-words leading-snug text-slate-400">
                                            다음등급 구간 펫 레벨업 시 자동 분배 능력치
                                        </dt>
                                        <dd className="shrink-0 tabular-nums font-mono font-black text-violet-200 sm:text-right">+{budgetNext}</dd>
                                    </div>
                                </dl>
                                <div className="mt-2.5 min-w-0 border-t border-white/[0.06] pt-2.5">
                                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-fuchsia-300/90">성향 강화</p>
                                    <p className="mt-1.5 break-words text-left text-xs font-semibold tabular-nums leading-relaxed text-fuchsia-100/95 sm:text-[0.8125rem] sm:leading-snug">
                                        {dispositionUpgradePreview}
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {nextG ? (
                    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/35 to-black/40 p-3 shadow-inner ring-1 ring-inset ring-white/[0.04]">
                        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-violet-300/85">필요 재료</p>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/50 shadow-md">
                                {soulMat?.image ? (
                                    <img src={soulMat.image} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">영혼석</div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-extrabold text-violet-50">{soulMat?.name ?? soulMatName ?? '영혼석'}</p>
                                <p className="mt-0.5 tabular-nums text-xs font-bold text-slate-300">
                                    보유 <span className="text-fuchsia-200">{ownedSoul}</span>
                                    <span className="text-slate-500"> / 필요 </span>
                                    <span className="text-amber-200">{soulNeed ?? '—'}</span>
                                </p>
                            </div>
                        </div>
                        {ownedSoul < (soulNeed ?? 0) ? (
                            <p className="mt-2 text-xs font-semibold text-rose-300/95">영혼석이 부족합니다.</p>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex shrink-0 justify-center border-t border-white/10 pt-2">
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => tryConfirm()}
                        className="min-w-[9rem] rounded-lg border border-amber-400/45 bg-gradient-to-b from-amber-600/95 to-amber-950 px-5 py-2 text-sm font-extrabold text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.12)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        등급 강화
                    </button>
                </div>
                </div>
                </PairPetDetailFitScale>
            </div>
            {gradeBlockHint ? (
                <DraggableWindow
                    title="안내"
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
