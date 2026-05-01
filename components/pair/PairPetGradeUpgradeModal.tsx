import React, { useMemo } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import type { InventoryItem, User } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import {
    gradeBackgrounds,
    gradeStyles,
    EQUIPMENT_GRADE_LABEL_KO,
    MATERIAL_ITEMS,
} from '../../shared/constants/items.js';
import {
    nextPairPetGrade,
    PAIR_PET_MAX_LEVEL,
    pairPetGradeUpgradeSoulStoneCount,
    pairPetGradeUpgradeSoulStoneMaterialName,
    pairPetGradeUpgradeSoulTemplateId,
    pairPetLevelUpStatBudget,
    pairPetMinLevelForNextGrade,
} from '../../shared/constants/pairPetGrade.js';
import { getPairPetDisplayName, isPairSoulStoneItem } from '../../shared/constants/petLobby.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';

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

    const canAttempt = Boolean(nextG && soulNeed != null && soulTid && levelSafe >= needLv && ownedSoul >= soulNeed);

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
            initialWidth={520}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={72}
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <div className="flex max-h-[min(78vh,36rem)] flex-col gap-3 px-1 pb-2 pt-1 sm:px-2">
                <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/95 via-violet-950/40 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.4)] ring-1 ring-amber-400/10">
                    <div
                        className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl"
                        aria-hidden
                    />
                    <div
                        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl"
                        aria-hidden
                    />

                    <div className="relative flex flex-col gap-4 p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={`relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-lg ${mainGradeStored === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`}
                            >
                                <img src={mainBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
                                <img src={mainItem.image} alt="" className="relative z-[1] h-full w-full object-contain p-1.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`truncate text-base font-black tracking-tight ${mainSt.color}`}>
                                    {getPairPetDisplayName(mainItem)}
                                </p>
                                <p className="mt-0.5 text-xs font-medium text-slate-400">Lv.{levelSafe}</p>
                                {levelSafe < needLv ? (
                                    <p className="mt-1 text-[11px] font-semibold text-amber-300/95">등급 강화까지 Lv.{needLv}</p>
                                ) : null}
                            </div>
                        </div>

                        {nextG && nextSt && nextBg && nextGradeKo ? (
                            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-3 py-3 shadow-inner">
                                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">현재</span>
                                    <div
                                        className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/15"
                                        aria-hidden
                                    >
                                        <img src={mainBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                        <img
                                            src={mainItem.image}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1.5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
                                        />
                                    </div>
                                    <span className={`text-center text-sm font-black ${mainSt.color}`}>{gradeKo}</span>
                                </div>

                                <div className="flex shrink-0 flex-row items-center justify-center gap-1 py-0 sm:flex-col sm:py-2">
                                    <span className="hidden text-amber-200/40 sm:block" aria-hidden>
                                        ···
                                    </span>
                                    <div
                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/35 bg-gradient-to-b from-amber-600/30 to-amber-950/60 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                                        aria-hidden
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-95">
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

                                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-950/50 to-black/50 px-3 py-3 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)]">
                                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-200/70">다음</span>
                                    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-amber-300/25">
                                        <img src={nextBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                                        <img
                                            src={mainItem.image}
                                            alt=""
                                            className="relative z-[1] h-full w-full object-contain p-1.5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
                                        />
                                    </div>
                                    <span className={`text-center text-sm font-black ${nextSt.color}`}>{nextGradeKo}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-lg border border-white/10 bg-black/40 py-3 text-center text-sm text-slate-400">
                                더 올릴 수 있는 등급이 없습니다.
                            </p>
                        )}

                        {nextG && budgetNext != null ? (
                            <div className="rounded-xl border border-white/[0.08] bg-black/50 p-3 backdrop-blur-sm">
                                <dl className="space-y-2.5 text-[0.8125rem]">
                                    <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                                        <dt className="shrink-0 text-slate-400">기본 능력치 증가</dt>
                                        <dd className="tabular-nums font-mono text-right font-black text-amber-200">+10%</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-0.5">
                                        <dt className="min-w-0 text-slate-400">다음등급 구간 펫 레벨업 시 자동 분배 능력치</dt>
                                        <dd className="shrink-0 tabular-nums font-mono text-right font-black text-violet-200">+{budgetNext}</dd>
                                    </div>
                                </dl>
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
                        disabled={!canAttempt || isBusy}
                        onClick={() => void onConfirm()}
                        className="min-w-[9rem] rounded-lg border border-amber-400/45 bg-gradient-to-b from-amber-600/95 to-amber-950 px-5 py-2 text-sm font-extrabold text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.12)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        등급 강화
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairPetGradeUpgradeModal;
