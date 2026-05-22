import React, { useMemo } from 'react';
import Button from '../Button.js';
import type { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { gradeBackgrounds, gradeStyles, EQUIPMENT_GRADE_LABEL_KO } from '../../shared/constants/items.js';
import { PAIR_PET_GRADE_ORDER, pairPetSoulStoneTierGradeUpgradeUsage } from '../../shared/constants/pairPetGrade.js';
import { PAIR_PET_SHOP_SKUS, isPairPetShopSkuUnlimitedDaily } from '../../shared/constants/petLobby.js';
import { PAIR_TRAINING_SLOT_DEFS } from '../../shared/constants/pairTraining.js';
import { pairPetSoulConvertMaterialNameForGrade } from '../../shared/utils/pairPetSoulConvert.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';
import {
    PET_INFO_ACTION_BTN,
    PET_MGMT_ACTION_BAR_CLASS,
    PET_PANEL_BADGE,
    PET_PANEL_EXP,
    PET_PANEL_HERO_HEADER_ROW,
    PET_PANEL_HERO_META_COL,
    PET_PANEL_INFO_CARD_OUTER,
    PET_PANEL_META_ROW,
    PET_PANEL_NAME,
    PET_PANEL_PORTRAIT_IMG,
    PET_PANEL_PORTRAIT_SHELL,
    PET_PANEL_TRAIT_BODY,
    PET_PANEL_TRAIT_BOX,
    PET_PANEL_TRAIT_TITLE,
} from './pairPetDetailPanelUi.js';

export type PairPetLobbySoulStoneViewerProps = {
    item: InventoryItem;
    isBusy: boolean;
    primaryStackId: string | null;
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

const soulStonePrimaryBtnClass = `${PET_INFO_ACTION_BTN} border-amber-400/55 bg-gradient-to-b from-amber-600/35 via-amber-950/55 to-black/85 text-amber-50 ring-1 ring-inset ring-amber-200/15`;

const soulStoneSecondaryBtnClass = `${PET_INFO_ACTION_BTN} border-violet-400/45 bg-gradient-to-b from-violet-700/30 via-violet-950/55 to-black/85 text-violet-50 ring-1 ring-inset ring-violet-200/12`;

const traitBoxCyan = `${PET_PANEL_TRAIT_BOX} border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-zinc-950/85`;
const traitBoxAmber = `${PET_PANEL_TRAIT_BOX} border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-zinc-950/85`;

/**
 * 페어 경기장 정보 탭 — 영혼석: {@link PairPetDetailCardBody} panelFit과 동일 초상화·타이포.
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
                            <p className={`${PET_PANEL_TRAIT_BODY} text-slate-200/95 line-clamp-3`}>{item.description}</p>
                        ) : null}
                    </div>
                </div>

                <div className={PET_PANEL_META_ROW}>
                    <div className={traitBoxCyan}>
                        <p className={`${PET_PANEL_TRAIT_TITLE} text-cyan-200/90`}>사용처</p>
                        <p className={`${PET_PANEL_TRAIT_BODY} text-slate-100/95`}>
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
                                        · 펫 Lv.{usageUpgrade.minLevel}
                                    </span>
                                </span>
                            ) : null}
                        </p>
                    </div>
                    <div className={traitBoxAmber}>
                        <p className={`${PET_PANEL_TRAIT_TITLE} text-amber-200/90`}>획득처</p>
                        <div className="flex flex-col gap-1">
                            <p className={`${PET_PANEL_TRAIT_BODY} text-slate-100/95`}>
                                <span className="text-violet-300">[펫]</span>
                                <span className="mx-1 text-slate-500">-</span>
                                <span className="text-slate-200">[수련 보상]</span>
                                {acquireTraining ? <span className="ml-1 text-cyan-200">{acquireTraining}</span> : null}
                            </p>
                            <p className={`${PET_PANEL_TRAIT_BODY} text-slate-100/95`}>
                                <span className="text-violet-300">[펫]</span>
                                <span className="mx-1 text-slate-500">-</span>
                                <span className="text-slate-200">[영혼 변환]</span>
                                {acquireConvert ? <span className="ml-1 text-fuchsia-200">{acquireConvert}</span> : null}
                            </p>
                            <p className={`${PET_PANEL_TRAIT_BODY} text-slate-100/95`}>
                                <span className="text-violet-300">[펫]</span>
                                <span className="mx-1 text-slate-500">-</span>
                                <span className="text-slate-200">[펫 상점]</span>
                                {acquireShop ? <span className="ml-1 text-amber-100">{acquireShop}</span> : null}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className={PET_MGMT_ACTION_BAR_CLASS}>
                <div className="flex w-full flex-row flex-wrap items-center justify-center gap-1.5">
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
