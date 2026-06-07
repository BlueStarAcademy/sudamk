import React, { useMemo } from 'react';
import type { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { gradeBackgrounds, gradeStyles, EQUIPMENT_GRADE_LABEL_KO } from '../../shared/constants/items.js';
import { PAIR_PET_GRADE_ORDER, pairPetSoulStoneTierGradeUpgradeUsage } from '../../shared/constants/pairPetGrade.js';
import { PAIR_PET_SHOP_SKUS, isPairPetShopSkuUnlimitedDaily } from '../../shared/constants/petLobby.js';
import { PAIR_TRAINING_SLOT_DEFS } from '../../shared/constants/pairTraining.js';
import { pairPetSoulConvertMaterialNameForGrade } from '../../shared/utils/pairPetSoulConvert.js';
import { resolveBagItemAcquireLines } from '../../shared/utils/itemAcquireSourceLines.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';
import {
    PET_PANEL_BADGE,
    PET_PANEL_EXP,
    PET_PANEL_HERO_HEADER_ROW,
    PET_PANEL_HERO_META_COL,
    PET_PANEL_INFO_CARD_OUTER,
    PET_PANEL_ROW_PAD,
    PET_PANEL_TRAIT_GAP,
    PET_PANEL_NAME,
    PET_PANEL_PORTRAIT_IMG,
    PET_PANEL_PORTRAIT_SHELL,
    PET_PANEL_TRAIT_TITLE,
} from './pairPetDetailPanelUi.js';

export type PairPetLobbySoulStoneViewerProps = {
    item: InventoryItem;
    isBusy: boolean;
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

/** `PET_PANEL_TRAIT_BOX`의 `flex-1 basis-0`는 세로 스택에서 높이 0으로 접힘 — 영혼석 전용 */
const soulTraitBoxBase =
    'flex w-full shrink-0 flex-col rounded-md border px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const soulTraitBody = 'mt-0.5 min-w-0 text-[15px] font-semibold leading-snug antialiased';

const traitBoxCyan = `${soulTraitBoxBase} border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-zinc-950/85`;
const traitBoxAmber = `${soulTraitBoxBase} border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-zinc-950/85`;

/** 가방 인벤 푸터와 동일 계열 — 반투명·backdrop-blur 없이 선명한 면 */
const SOUL_STONE_ACTION_BAR_CLASS =
    'relative z-[2] flex min-h-[3rem] shrink-0 flex-nowrap items-stretch gap-2 border-t border-white/15 bg-zinc-950 px-2 py-2';

const SOUL_STONE_ACTION_BTN_BASE =
    'inline-flex min-h-[2.55rem] min-w-0 flex-1 items-center justify-center rounded-xl border px-2 text-[0.875rem] font-bold leading-none tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_14px_-4px_rgba(0,0,0,0.55)] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-55';

const soulSellBtnClass = `${SOUL_STONE_ACTION_BTN_BASE} border-rose-900/55 bg-gradient-to-b from-rose-500 via-rose-600 to-rose-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_4px_16px_-2px_rgba(244,63,94,0.5)] hover:border-rose-400/55 hover:from-rose-400 hover:via-rose-500 hover:to-rose-900`;
const soulBulkSellBtnClass = `${SOUL_STONE_ACTION_BTN_BASE} border-amber-800/50 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-900 text-amber-950 shadow-[inset_0_1px_0_rgba(255,251,235,0.45),0_4px_16px_-2px_rgba(217,119,6,0.45)] hover:border-amber-300/55 hover:from-amber-300 hover:via-amber-400 hover:to-amber-800`;

/**
 * 페어 경기장 정보 탭 — 영혼석: {@link PairPetDetailCardBody} panelFit과 동일 초상화·타이포.
 */
const PairPetLobbySoulStoneViewer: React.FC<PairPetLobbySoulStoneViewerProps> = ({
    item,
    isBusy,
    totalSoulQuantity,
    onSellOne,
    onOpenBulkSell,
}) => {
    const grade = itemGradeSafe(item.grade);
    const gradeStyle = gradeStyles[grade] ?? gradeStyles[ItemGrade.Normal];
    const gradeKo = EQUIPMENT_GRADE_LABEL_KO[grade] ?? grade;
    const bgSrc = gradeBackgrounds[grade] ?? gradeBackgrounds[ItemGrade.Normal];
    const isTranscendent = grade === ItemGrade.Transcendent;
    const qty = item.quantity ?? 0;

    const { usageUpgrade, acquireTraining, acquireConvert, acquireShop } = useMemo(() => {
        const tier = soulStoneTierFromTemplateId(item.templateId);
        const mat = item.name;
        return {
            usageUpgrade: pairPetSoulStoneTierGradeUpgradeUsage(tier),
            acquireTraining: soulTrainingRewardUsageDetail(mat),
            acquireConvert: soulConvertAcquireDetail(mat),
            acquireShop: soulPetShopAcquireDetail(mat),
        };
    }, [item.templateId, item.name]);

    const acquireFallbackLines = useMemo(() => {
        const lines = resolveBagItemAcquireLines(item);
        return lines.filter((line) => !line.includes('사용'));
    }, [item]);

    return (
        <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${PET_PANEL_INFO_CARD_OUTER} ${
                isTranscendent ? 'transcendent-grade-slot' : ''
            }`}
        >
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]">
                <div className={PET_PANEL_HERO_HEADER_ROW}>
                    <div className="flex min-w-0 flex-col items-center justify-center py-0.5">
                        <div className={PET_PANEL_PORTRAIT_SHELL}>
                            <img
                                src={bgSrc}
                                alt=""
                                aria-hidden
                                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-[0.92]"
                            />
                            <img src={item.image} alt="" className={PET_PANEL_PORTRAIT_IMG} loading="lazy" />
                        </div>
                    </div>
                    <div className={PET_PANEL_HERO_META_COL}>
                        <div className="flex min-w-0 flex-nowrap items-center gap-0.5">
                            <span className={`${PET_PANEL_BADGE} ${gradeStyle.color} bg-black/45`}>{gradeKo}</span>
                        </div>
                        <h3 className={PET_PANEL_NAME}>{item.name}</h3>
                        <div className={`flex min-w-0 justify-end ${PET_PANEL_EXP}`}>
                            <span className="font-mono font-semibold tabular-nums text-amber-200">
                                보유 ×{qty.toLocaleString()}
                            </span>
                        </div>
                        {item.description ? (
                            <p className={`${soulTraitBody} text-slate-200/95 line-clamp-3`}>{item.description}</p>
                        ) : null}
                    </div>
                </div>

                <div
                    className={`relative z-[1] flex min-h-0 min-w-0 flex-col items-stretch bg-zinc-950/92 ${PET_PANEL_ROW_PAD} ${PET_PANEL_TRAIT_GAP}`}
                >
                    <div className={traitBoxCyan}>
                        <p className={`${PET_PANEL_TRAIT_TITLE} text-cyan-200/90`}>사용처</p>
                        <p className={`${soulTraitBody} text-slate-100/95`}>
                            <span className="text-violet-300">[펫]</span>
                            <span className="mx-1 text-slate-500">-</span>
                            <span className="text-slate-200">[등급 강화]</span>
                            {usageUpgrade ? (
                                <span className="ml-1 inline-flex flex-wrap items-center gap-x-0.5">
                                    <span className={gradeStyles[usageUpgrade.from]?.color ?? 'text-slate-200'}>
                                        [{gradeStyles[usageUpgrade.from]?.name ?? ''}]
                                    </span>
                                    <span className="text-slate-500">-</span>
                                    <span className={gradeStyles[usageUpgrade.to]?.color ?? 'text-slate-200'}>
                                        [{gradeStyles[usageUpgrade.to]?.name ?? ''}]
                                    </span>
                                    <span className="text-amber-200/95 tabular-nums">
                                        · 펫 Lv.{usageUpgrade.minLevel} 이상
                                    </span>
                                </span>
                            ) : (
                                <span className="ml-1 text-slate-400">등급 강화에 사용</span>
                            )}
                        </p>
                    </div>
                    <div className={traitBoxAmber}>
                        <p className={`${PET_PANEL_TRAIT_TITLE} text-amber-200/90`}>획득처</p>
                        <div className="flex flex-col gap-1">
                            <p className={`${soulTraitBody} text-slate-100/95`}>
                                <span className="text-violet-300">[펫]</span>
                                <span className="mx-1 text-slate-500">-</span>
                                <span className="text-slate-200">[수련 보상]</span>
                                <span className="ml-1 text-cyan-200">
                                    {acquireTraining || '해당 슬롯 없음'}
                                </span>
                            </p>
                            <p className={`${soulTraitBody} text-slate-100/95`}>
                                <span className="text-violet-300">[펫]</span>
                                <span className="mx-1 text-slate-500">-</span>
                                <span className="text-slate-200">[영혼 변환]</span>
                                <span className="ml-1 text-fuchsia-200">
                                    {acquireConvert || '해당 등급 없음'}
                                </span>
                            </p>
                            <p className={`${soulTraitBody} text-slate-100/95`}>
                                <span className="text-violet-300">[펫]</span>
                                <span className="mx-1 text-slate-500">-</span>
                                <span className="text-slate-200">[펫 상점]</span>
                                <span className="ml-1 text-amber-100">{acquireShop || '판매 없음'}</span>
                            </p>
                            {acquireFallbackLines.length > 0 &&
                            !acquireTraining &&
                            !acquireConvert &&
                            !acquireShop ? (
                                acquireFallbackLines.map((line) => (
                                    <p key={line} className={`${soulTraitBody} text-slate-300/90`}>
                                        {line}
                                    </p>
                                ))
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className={SOUL_STONE_ACTION_BAR_CLASS}>
                <button
                    type="button"
                    disabled={isBusy || qty < 1}
                    onClick={onSellOne}
                    className={soulSellBtnClass}
                >
                    판매
                </button>
                {totalSoulQuantity > 1 ? (
                    <button
                        type="button"
                        disabled={isBusy || qty < 1}
                        onClick={onOpenBulkSell}
                        className={soulBulkSellBtnClass}
                    >
                        일괄 판매
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default PairPetLobbySoulStoneViewer;
