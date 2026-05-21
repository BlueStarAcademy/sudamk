import React, { useMemo } from 'react';
import Button from '../Button.js';
import type { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { gradeBackgrounds, gradeStyles } from '../../shared/constants/items.js';
import { PAIR_PET_GRADE_ORDER } from '../../shared/constants/pairPetGrade.js';
import { PAIR_PET_SHOP_SKUS, isPairPetShopSkuUnlimitedDaily } from '../../shared/constants/petLobby.js';
import { PAIR_TRAINING_SLOT_DEFS } from '../../shared/constants/pairTraining.js';
import { pairPetSoulConvertMaterialNameForGrade } from '../../shared/utils/pairPetSoulConvert.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';

export type PairPetLobbySoulStoneViewerProps = {
    item: InventoryItem;
    isBusy: boolean;
    primaryStackId: string | null;
    /** 동일 종류 영혼석 합산 보유(여러 스택 포함) — 일괄 판매 버튼 표시용 */
    totalSoulQuantity: number;
    onSellOne: () => void;
    onOpenBulkSell: () => void;
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

function soulGradeUpgradeUsageGrades(tier: number): { from: ItemGrade; to: ItemGrade } | null {
    const fromG = PAIR_PET_GRADE_ORDER[tier - 1];
    const toG = PAIR_PET_GRADE_ORDER[tier];
    if (!fromG || !toG) return null;
    return { from: fromG, to: toG };
}

function soulTrainingRewardUsageDetail(materialName: string): string {
    const slots: number[] = [];
    for (const def of PAIR_TRAINING_SLOT_DEFS) {
        if (def.soulTable.some((r) => r.materialName === materialName)) slots.push(def.slotIndex + 1);
    }
    if (!slots.length) return '';
    return `[슬롯 ${slots.join('·')}]`;
}

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

function soulPetShopAcquireDetail(materialName: string): string {
    const sku = PAIR_PET_SHOP_SKUS.find((s) => s.id.startsWith('pair_shop_soul_') && s.materialName === materialName);
    if (!sku) return '';
    const price =
        sku.diamonds > 0
            ? `[다이아 ${formatWalletDiamonds(sku.diamonds)}]`
            : `[골드 ${formatGoldAmountKoG(sku.gold)}]`;
    if (isPairPetShopSkuUnlimitedDaily(sku.dailyLimit)) return price;
    return `${price} [일일 ${sku.dailyLimit}회]`;
}

const soulStonePremiumBtnBase =
    'min-w-[min(100%,8.5rem)] rounded-lg border px-2.5 py-1.5 text-[0.65rem] font-extrabold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_22px_-10px_rgba(0,0,0,0.75)] transition-[transform,box-shadow,filter] duration-200 hover:brightness-[1.06] active:translate-y-px active:brightness-95 disabled:!pointer-events-none disabled:!opacity-45';

const soulStonePrimaryBtnClass = `${soulStonePremiumBtnBase} border-amber-400/55 bg-gradient-to-b from-amber-600/35 via-amber-950/55 to-black/85 text-amber-50 ring-1 ring-inset ring-amber-200/15`;

const soulStoneSecondaryBtnClass = `${soulStonePremiumBtnBase} border-violet-400/45 bg-gradient-to-b from-violet-700/30 via-violet-950/55 to-black/85 text-violet-50 ring-1 ring-inset ring-violet-200/12`;

const soulMetaLineClass = 'break-words text-[0.62rem] font-medium leading-snug text-slate-100';

/**
 * 페어 경기장 정보 탭 — 영혼석 선택 시 상세 뷰(이미지·설명·사용처·획득처·판매).
 */
const PairPetLobbySoulStoneViewer: React.FC<PairPetLobbySoulStoneViewerProps> = ({
    item,
    isBusy,
    primaryStackId,
    totalSoulQuantity,
    onSellOne,
    onOpenBulkSell,
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
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-br from-[#1a1025]/95 via-[#0f0a14]/98 to-[#060508] shadow-[0_20px_48px_-24px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-fuchsia-500/10 ${
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

            <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 pb-1 pt-1 antialiased">
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                    <div className="flex shrink-0 flex-row items-start gap-2">
                        <div className="shrink-0">
                            <div
                                className="relative flex h-[4rem] w-[4rem] items-center justify-center overflow-hidden rounded-lg border border-white/12 shadow-[0_16px_36px_-14px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-violet-400/15"
                            >
                                <img src={bgSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" loading="lazy" />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/[0.04]" aria-hidden />
                                <img
                                    src={item.image}
                                    alt=""
                                    className="relative z-[1] h-[74%] w-[74%] object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.8)]"
                                    loading="lazy"
                                />
                            </div>
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex items-start justify-between gap-1">
                                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                                    <h3 className="min-w-0 text-left text-xs font-black leading-tight tracking-tight text-violet-50">
                                        {item.name}
                                    </h3>
                                    <span
                                        className={`shrink-0 text-[0.65rem] font-extrabold leading-none ${gradeMeta.color}`}
                                        title="등급"
                                    >
                                        {gradeMeta.name}
                                    </span>
                                </div>
                                <span
                                    className="shrink-0 rounded border border-amber-400/35 bg-gradient-to-b from-amber-900/40 to-black/50 px-1.5 py-0.5 text-center text-[0.62rem] font-extrabold leading-tight text-amber-100 ring-1 ring-inset ring-amber-300/15"
                                    title="보유 개수"
                                >
                                    보유
                                    <span className="mt-px block tabular-nums text-[0.7rem] text-amber-50">×{qty.toLocaleString()}</span>
                                </span>
                            </div>

                            {item.description ? (
                                <p className="line-clamp-2 rounded border border-white/[0.07] bg-black/35 px-1.5 py-0.5 text-[0.62rem] font-medium leading-snug text-slate-100 ring-1 ring-inset ring-violet-500/10">
                                    {item.description}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col justify-between gap-1 overflow-hidden">
                        <div className="shrink-0 rounded border border-cyan-500/18 bg-gradient-to-r from-slate-950/90 via-[#0c0a12] to-slate-950/90 px-1.5 py-0.5 ring-1 ring-inset ring-cyan-500/10">
                            <p className="mb-0.5 text-[0.58rem] font-semibold text-cyan-200">사용처</p>
                            <p className={soulMetaLineClass}>
                                <span className="text-violet-300">[펫]</span>
                                <span className="mx-0.5 text-slate-500">-</span>
                                <span className="text-slate-200">[등급 강화]</span>
                                {usageUpgradeGrades ? (
                                    <span className="ml-1 inline-flex flex-wrap items-center gap-x-0.5">
                                        <span className={gradeStyles[usageUpgradeGrades.from]?.color ?? 'text-slate-200'}>
                                            [{gradeStyles[usageUpgradeGrades.from]?.name ?? ''}]
                                        </span>
                                        <span className="text-slate-500">-</span>
                                        <span className={gradeStyles[usageUpgradeGrades.to]?.color ?? 'text-slate-200'}>
                                            [{gradeStyles[usageUpgradeGrades.to]?.name ?? ''}]
                                        </span>
                                    </span>
                                ) : null}
                            </p>
                        </div>

                        <div className="min-h-0 shrink rounded border border-amber-500/20 bg-gradient-to-r from-[#1a1510]/92 via-[#0f0c0a] to-[#0a0908] px-1.5 py-0.5 ring-1 ring-inset ring-amber-500/12">
                            <p className="mb-0.5 text-[0.58rem] font-semibold text-amber-200">획득처</p>
                            <div className="flex flex-col gap-0.5">
                                <p className={soulMetaLineClass}>
                                    <span className="text-violet-300">[펫]</span>
                                    <span className="mx-0.5 text-slate-500">-</span>
                                    <span className="text-slate-200">[수련 보상]</span>
                                    {acquireTraining ? <span className="ml-1 text-cyan-200">{acquireTraining}</span> : null}
                                </p>
                                <p className={soulMetaLineClass}>
                                    <span className="text-violet-300">[펫]</span>
                                    <span className="mx-0.5 text-slate-500">-</span>
                                    <span className="text-slate-200">[영혼 변환]</span>
                                    {acquireConvert ? <span className="ml-1 text-fuchsia-200">{acquireConvert}</span> : null}
                                </p>
                                <p className={soulMetaLineClass}>
                                    <span className="text-violet-300">[펫]</span>
                                    <span className="mx-0.5 text-slate-500">-</span>
                                    <span className="text-slate-200">[펫 상점]</span>
                                    {acquireShop ? <span className="ml-1 text-amber-100">{acquireShop}</span> : null}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-[1] shrink-0 border-t border-white/[0.12] bg-[#0a080c]/95 px-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1 backdrop-blur-sm">
                <div className="flex flex-row flex-wrap items-center justify-center gap-1">
                    <Button
                        type="button"
                        disabled={isBusy || !primaryStackId || qty < 1}
                        onClick={onSellOne}
                        colorScheme="none"
                        className={`!mx-0 !inline-block !w-auto ${soulStonePrimaryBtnClass}`}
                    >
                        판매
                    </Button>
                    {primaryStackId && totalSoulQuantity > 1 ? (
                        <Button
                            type="button"
                            disabled={isBusy}
                            onClick={onOpenBulkSell}
                            colorScheme="none"
                            className={`!mx-0 !inline-block !w-auto ${soulStoneSecondaryBtnClass}`}
                        >
                            일괄 판매
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default PairPetLobbySoulStoneViewer;
