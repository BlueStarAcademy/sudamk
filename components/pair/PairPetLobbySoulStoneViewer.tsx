import React, { useMemo } from 'react';
import Button from '../Button.js';
import type { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { gradeBackgrounds, gradeStyles } from '../../shared/constants/items.js';
import { PAIR_PET_GRADE_ORDER } from '../../shared/constants/pairPetGrade.js';
import { PAIR_PET_SHOP_SKUS } from '../../shared/constants/petLobby.js';
import { PAIR_TRAINING_SLOT_DEFS } from '../../shared/constants/pairTraining.js';
import { pairPetSoulConvertMaterialNameForGrade } from '../../shared/utils/pairPetSoulConvert.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';

export type PairPetLobbySoulStoneViewerProps = {
    item: InventoryItem;
    isBusy: boolean;
    primaryStackId: string | null;
    primaryStackQty: number;
    onSellOne: () => void;
    onSellAll: () => void;
};

function itemGradeSafe(g: InventoryItem['grade']): ItemGrade {
    if (g && Object.values(ItemGrade).includes(g as ItemGrade)) return g as ItemGrade;
    return ItemGrade.Normal;
}

function soulStoneTierFromTemplateId(templateId: string | null | undefined): number {
    const m = /^pair-soul-(\d+)$/.exec(templateId ?? '');
    if (!m) return 1;
    return Math.min(5, Math.max(1, parseInt(m[1]!, 10)));
}

/** `pair-soul-k` → 펫 저장 등급 강화 구간(표시용 `gradeStyles` 색상) */
function soulGradeUpgradeUsageGrades(tier: number): { from: ItemGrade; to: ItemGrade } | null {
    const fromG = PAIR_PET_GRADE_ORDER[tier - 1];
    const toG = PAIR_PET_GRADE_ORDER[tier];
    if (!fromG || !toG) return null;
    return { from: fromG, to: toG };
}

/** 수련 영혼석 보상 테이블에 이 재료가 들어가는 슬롯 번호 */
function soulTrainingRewardUsageDetail(materialName: string): string {
    const slots: number[] = [];
    for (const def of PAIR_TRAINING_SLOT_DEFS) {
        if (def.soulTable.some((r) => r.materialName === materialName)) slots.push(def.slotIndex + 1);
    }
    if (!slots.length) return '';
    return `[슬롯 ${slots.join('·')}]`;
}

/** 영혼 변환 보상으로 이 영혼석이 나오는 펫 저장 등급 */
function soulConvertAcquireDetail(materialName: string): string {
    const grades: ItemGrade[] = [];
    for (const g of [...PAIR_PET_GRADE_ORDER, ItemGrade.Transcendent]) {
        if (pairPetSoulConvertMaterialNameForGrade(g) === materialName) grades.push(g);
    }
    const labels = grades.map((g) => gradeStyles[g]?.name ?? '').filter(Boolean);
    const uniq = [...new Set(labels)];
    if (!uniq.length) return '';
    if (uniq.length === 1) return `[${uniq[0]}]`;
    return uniq.map((u) => `[${u}]`).join('·');
}

/** 페어 펫 상점 SKU(영혼석 전용) — 가격·일일 한도 */
function soulPetShopAcquireDetail(materialName: string): string {
    const sku = PAIR_PET_SHOP_SKUS.find((s) => s.id.startsWith('pair_shop_soul_') && s.materialName === materialName);
    if (!sku) return '';
    const price =
        sku.diamonds > 0
            ? `[다이아 ${formatWalletDiamonds(sku.diamonds)}]`
            : `[골드 ${formatGoldAmountKoG(sku.gold)}]`;
    return `${price} [일일 ${sku.dailyLimit}회]`;
}

const soulStonePremiumBtnBase =
    'min-w-[min(100%,10.5rem)] rounded-xl border px-4 py-2.5 text-sm font-extrabold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_28px_-12px_rgba(0,0,0,0.75)] transition-[transform,box-shadow,filter] duration-200 hover:brightness-[1.06] active:translate-y-px active:brightness-95 disabled:!pointer-events-none disabled:!opacity-45';

const soulStonePrimaryBtnClass = `${soulStonePremiumBtnBase} border-amber-400/55 bg-gradient-to-b from-amber-600/35 via-amber-950/55 to-black/85 text-amber-50 ring-1 ring-inset ring-amber-200/15 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_36px_-10px_rgba(251,191,36,0.42)]`;

const soulStoneSecondaryBtnClass = `${soulStonePremiumBtnBase} border-violet-400/45 bg-gradient-to-b from-violet-700/30 via-violet-950/55 to-black/85 text-violet-50 ring-1 ring-inset ring-violet-200/12 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_36px_-10px_rgba(167,139,250,0.35)]`;

/**
 * 페어 경기장 정보 탭 — 영혼석 선택 시 상세 뷰(이미지·등급·설명·사용처·획득처·판매).
 */
const PairPetLobbySoulStoneViewer: React.FC<PairPetLobbySoulStoneViewerProps> = ({
    item,
    isBusy,
    primaryStackId,
    primaryStackQty,
    onSellOne,
    onSellAll,
}) => {
    const grade = itemGradeSafe(item.grade);
    const gradeMeta = gradeStyles[grade] ?? gradeStyles[ItemGrade.Normal];
    const bgSrc = gradeBackgrounds[grade] ?? gradeBackgrounds[ItemGrade.Normal];
    const isTranscendent = grade === ItemGrade.Transcendent;
    const qty = item.quantity ?? 0;

    const { usageUpgradeGrades, acquireTraining, acquireConvert, acquireShop } = useMemo(() => {
        const tier = soulStoneTierFromTemplateId(item.templateId);
        const mat = item.name;
        return {
            usageUpgradeGrades: soulGradeUpgradeUsageGrades(tier),
            acquireTraining: soulTrainingRewardUsageDetail(mat),
            acquireConvert: soulConvertAcquireDetail(mat),
            acquireShop: soulPetShopAcquireDetail(mat),
        };
    }, [item.templateId, item.name]);

    return (
        <div
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[#1a1025]/95 via-[#0f0a14]/98 to-[#060508] shadow-[0_24px_56px_-28px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-fuchsia-500/10 ${
                isTranscendent ? 'transcendent-grade-slot' : ''
            }`}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.14]"
                style={{
                    background:
                        'radial-gradient(ellipse 90% 55% at 50% -8%, rgba(192,132,252,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(251,191,36,0.08), transparent 50%)',
                }}
                aria-hidden
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/35 to-transparent" aria-hidden />

            <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-2 pt-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] sm:px-4 sm:pb-2 sm:pt-4">
            <div className="relative flex flex-col gap-2.5">
                <div className="flex flex-row items-start gap-3 sm:gap-4">
                    <div className="shrink-0">
                        <div
                            className={`relative flex h-[6.75rem] w-[6.75rem] items-center justify-center overflow-hidden rounded-2xl border border-white/12 shadow-[0_18px_42px_-16px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-violet-400/15 min-[400px]:h-[7.75rem] min-[400px]:w-[7.75rem] sm:h-[8.75rem] sm:w-[8.75rem] ${
                                isTranscendent ? '' : ''
                            }`}
                        >
                            <img src={bgSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" loading="lazy" />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/[0.04]" aria-hidden />
                            <img
                                src={item.image}
                                alt=""
                                className="relative z-[1] h-[72%] w-[72%] object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.75)]"
                                loading="lazy"
                            />
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="min-w-0 flex-1 text-left text-base font-black leading-tight tracking-tight text-violet-50 drop-shadow-[0_2px_14px_rgba(88,28,135,0.5)] min-[400px]:text-lg sm:text-xl">
                                {item.name}
                            </h3>
                            <span
                                className="shrink-0 rounded-lg border border-amber-400/35 bg-gradient-to-b from-amber-900/40 to-black/50 px-2 py-1 text-center text-[0.65rem] font-extrabold leading-none text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-300/15 sm:px-2.5 sm:py-1.5 sm:text-xs"
                                title="보유 개수"
                            >
                                보유
                                <span className="mt-0.5 block tabular-nums text-[0.8rem] text-amber-50 sm:text-sm">×{qty.toLocaleString()}</span>
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/40 px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ring-white/[0.06] ${gradeMeta.color}`}
                            >
                                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">등급</span>
                                <span className="text-sm">{gradeMeta.name}</span>
                            </span>
                        </div>

                        {item.description ? (
                            <p className="rounded-xl border border-white/[0.07] bg-black/35 px-3 py-2 text-xs leading-relaxed text-slate-300/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-violet-500/10 sm:text-[0.8125rem]">
                                {item.description}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="w-full rounded-xl border border-cyan-500/18 bg-gradient-to-r from-slate-950/90 via-[#0c0a12] to-slate-950/90 px-3 py-2 ring-1 ring-inset ring-cyan-500/10 sm:px-3.5 sm:py-2.5">
                    <p className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-cyan-200/80">사용처</p>
                    <p className="break-words text-[0.7rem] font-semibold leading-snug tracking-tight text-slate-300/95 sm:text-xs">
                        <span className="font-mono text-violet-300/90">[펫]</span>
                        <span className="mx-1 font-mono text-slate-600">-</span>
                        <span className="font-mono text-slate-200">[등급 강화]</span>
                        {usageUpgradeGrades ? (
                            <span className="ml-1.5 inline-flex flex-wrap items-center gap-x-1 font-mono font-semibold">
                                <span className={gradeStyles[usageUpgradeGrades.from]?.color ?? 'text-slate-200'}>
                                    [{gradeStyles[usageUpgradeGrades.from]?.name ?? ''}]
                                </span>
                                <span className="text-slate-600">-</span>
                                <span className={gradeStyles[usageUpgradeGrades.to]?.color ?? 'text-slate-200'}>
                                    [{gradeStyles[usageUpgradeGrades.to]?.name ?? ''}]
                                </span>
                            </span>
                        ) : null}
                    </p>
                </div>

                <div className="w-full rounded-xl border border-amber-500/20 bg-gradient-to-r from-[#1a1510]/92 via-[#0f0c0a] to-[#0a0908] px-3 py-2 ring-1 ring-inset ring-amber-500/12 sm:px-3.5 sm:py-2.5">
                    <p className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-amber-200/85">획득처</p>
                    <div className="flex flex-col gap-1.5 text-[0.7rem] font-semibold leading-snug tracking-tight text-slate-300/95 sm:text-xs">
                        <p className="break-words">
                            <span className="font-mono text-violet-300/90">[펫]</span>
                            <span className="mx-1 font-mono text-slate-600">-</span>
                            <span className="font-mono text-slate-200">[수련 보상]</span>
                            {acquireTraining ? (
                                <span className="ml-1.5 font-mono text-cyan-200/85">{acquireTraining}</span>
                            ) : null}
                        </p>
                        <p className="break-words">
                            <span className="font-mono text-violet-300/90">[펫]</span>
                            <span className="mx-1 font-mono text-slate-600">-</span>
                            <span className="font-mono text-slate-200">[영혼 변환]</span>
                            {acquireConvert ? (
                                <span className="ml-1.5 font-mono text-fuchsia-200/85">{acquireConvert}</span>
                            ) : null}
                        </p>
                        <p className="break-words">
                            <span className="font-mono text-violet-300/90">[펫]</span>
                            <span className="mx-1 font-mono text-slate-600">-</span>
                            <span className="font-mono text-slate-200">[펫 상점]</span>
                            {acquireShop ? (
                                <span className="ml-1.5 font-mono text-amber-100/90">{acquireShop}</span>
                            ) : null}
                        </p>
                    </div>
                </div>
            </div>
            </div>

            <div className="relative z-[1] shrink-0 border-t border-white/[0.12] bg-[#0a080c]/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-sm sm:px-4">
            <div className="flex flex-col flex-wrap items-center justify-center gap-2 sm:flex-row">
                <Button
                    type="button"
                    disabled={isBusy || !primaryStackId || qty < 1}
                    onClick={onSellOne}
                    colorScheme="none"
                    className={`!mx-auto !block w-full max-w-[16rem] sm:!mx-0 sm:inline-block sm:w-auto ${soulStonePrimaryBtnClass}`}
                >
                    판매 (1)
                </Button>
                {primaryStackId && primaryStackQty > 1 ? (
                    <Button
                        type="button"
                        disabled={isBusy}
                        onClick={onSellAll}
                        colorScheme="none"
                        className={`!mx-auto !block w-full max-w-[16rem] sm:!mx-0 sm:inline-block sm:w-auto ${soulStoneSecondaryBtnClass}`}
                    >
                        일괄 판매 ({primaryStackQty.toLocaleString()})
                    </Button>
                ) : null}
            </div>
            </div>
        </div>
    );
};

export default PairPetLobbySoulStoneViewer;
