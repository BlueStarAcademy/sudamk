import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import InventorySlotExpandDiamondBody from '../inventory/InventorySlotExpandDiamondBody.js';
import PairPetProfilePanel from './PairPetProfilePanel.js';
import PairPetLobbyInfoPetViewer from './PairPetLobbyInfoPetViewer.js';
import PairPetLobbySoulStoneViewer from './PairPetLobbySoulStoneViewer.js';
import PairPetSoulConvertModal from './PairPetSoulConvertModal.js';
import PairTrainingRewardModal from './PairTrainingRewardModal.js';
import PairPetDetailCardBody from './PairPetDetailCardBody.js';
import {
    PET_MGMT_BASE,
    PET_MGMT_BOLD,
    PET_MGMT_HATCHERY_GRID_CLASS,
    PET_MGMT_HATCHERY_MOBILE_STACK_CLASS,
    PET_MGMT_HATCHERY_MOBILE_SLOTS_ROW_CLASS,
    PET_MGMT_HATCHERY_EGG_INVENTORY_MOBILE_CLASS,
    PET_MGMT_HATCHERY_BTN_CLASS,
    PET_MGMT_HATCHERY_BTN_STACK_CLASS,
    PET_MGMT_HATCHERY_CHAMBER_CLASS,
    PET_MGMT_CAPTION,
    PET_MGMT_SHOP_BTN_TEXT,
    PET_MGMT_SHOP_GRID_CLASS,
    PET_MGMT_SHOP_LIMIT_TEXT,
    PET_MGMT_SHOP_SUBTAB_BTN,
    PET_MGMT_SHOP_TITLE,
    PET_MGMT_TR_EXP_LABEL,
    PET_MGMT_TR_HINT_TEXT,
    PET_MGMT_TR_ICON_BOX,
    PET_MGMT_TR_ICON_IMG,
    PET_MGMT_TR_ICON_BOX_2_CLASS,
    PET_MGMT_TR_ICON_BOX_3_CLASS,
    PET_MGMT_TR_REWARD_AMT_CLASS,
    PET_MGMT_TR_REWARD_BLOCK_CLASS,
    PET_MGMT_TR_REWARD_BOX_CLASS,
    PET_MGMT_TR_REWARD_LBL_CLASS,
    PET_MGMT_TR_REWARD_ROW_INNER_CLASS,
    PET_MGMT_TR_SOUL_COL_2_CLASS,
    PET_MGMT_TR_SOUL_COL_3_CLASS,
    PET_MGMT_TR_SOUL_FG_IMG_CLASS,
    PET_MGMT_TR_SOUL_FG_IMG_MD_CLASS,
    PET_MGMT_TR_SOUL_FG_IMG_SM_CLASS,
    PET_MGMT_TR_SLOTS_DESKTOP_CLASS,
    PET_MGMT_TR_SLOTS_GRID_CLASS,
    PET_MGMT_TR_PET_IMG_CLASS,
    PET_MGMT_TR_PET_IMG_MOBILE_CLASS,
    PET_MGMT_TR_SLOT_CARD_CLASS,
    PET_MGMT_TR_SLOT_CARD_MOBILE_CLASS,
    PET_MGMT_TR_SLOT_COL,
    PET_MGMT_TR_SLOT_COL_MOBILE_CLASS,
    PET_MGMT_TR_SLOT_DROP_CLASS,
    PET_MGMT_TR_SLOT_DROP_MOBILE_CLASS,
    PET_MGMT_TR_SOUL_COL,
    PET_MGMT_HATCHERY_EGG_IMG_CLASS,
    PET_MGMT_HATCHERY_EGG_IMG_MOBILE_CLASS,
    PET_MGMT_HATCHERY_ACTION_ROW_CLASS,
    PET_MGMT_HATCHERY_INFO_CLASS,
    PET_MGMT_HATCHERY_STATUS_ROW_CLASS,
    PET_MGMT_HATCHERY_TIMER_ROW_CLASS,
    PET_MGMT_HATCHERY_SLOT_HEADER_CLASS,
    PET_MGMT_HATCHERY_SLOT_OUTER_CLASS,
    PET_MGMT_HATCHERY_SLOT_OUTER_MOBILE_CLASS,
    PET_MGMT_INFO_COLUMN_CLASS,
    PET_MGMT_INFO_SCROLL_CLASS,
    PET_MGMT_INV_DOCK_DESKTOP_CLASS,
    PET_MGMT_INV_DOCK_MOBILE_CLASS,
    PET_MGMT_INV_GRID_DESKTOP_CLASS,
    PET_MGMT_INV_GRID_MOBILE_CLASS,
    PET_MGMT_INV_GRID_SCROLL_CLASS,
    PET_MGMT_INV_HEADER_CLASS,
    PET_MGMT_MAIN_COLUMN_CLASS,
    PET_MGMT_MAIN_TAB_BAR,
    PET_MGMT_RIGHT_COLUMN_CLASS,
    PET_MGMT_ROOT_CLASS,
    PET_MGMT_SCROLL_CLASS,
    PET_MGMT_SEMI,
    PET_MGMT_SHOP_GRID_DESKTOP_CLASS,
    PET_MGMT_SHOP_SCROLL_CLASS,
    PET_MGMT_SHOP_SECTION_CLASS,
    PET_MGMT_SHOP_SECTION_TITLE,
    PET_MGMT_SHOP_SHORT_TEXT,
    PET_MGMT_SOUL_GRID_DESKTOP_CLASS,
    PET_MGMT_SOUL_GRID_MOBILE_CLASS,
    PET_MGMT_TAB_BTN_BASE,
    PET_MGMT_TAB_PANEL_CLASS,
    PET_MGMT_TITLE,
    PET_MGMT_TOP_SPLIT_CLASS,
    PET_MGMT_VIEWER_FRAME_CLASS,
    PET_MGMT_XBOLD,
    petMgmtMainTabClass,
} from './pairPetManagementModalUi.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import PurchaseQuantityModal from '../PurchaseQuantityModal.js';
import { ShopMobileImageDescriptionPortal } from '../shopImageDescriptionPopover.js';
import SellItemConfirmModal from '../SellItemConfirmModal.js';
import SellMaterialBulkModal from '../SellMaterialBulkModal.js';
import type { User, UserWithStatus, InventoryItem, ServerAction, PairPetLobbyInventorySortMode } from '../../types.js';
import { MATERIAL_ITEMS, gradeBackgrounds, gradeStyles, EQUIPMENT_GRADE_LABEL_KO } from '../../shared/constants/items.js';
import { ItemGrade } from '../../types/enums.js';
import { isSameDayKST } from '../../utils/timeUtils.js';
import { effectivePairPetGradeFromRow, PAIR_PET_MAX_LEVEL, pairPetGradeIndex } from '../../shared/constants/pairPetGrade.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';
import {
    PAIR_PET_SHOP_SKUS,
    isPairPetShopSkuUnlimitedDaily,
    type PairPetShopSku,
    PAIR_PET_LOBBY_INV_EXPAND_STEP,
    PAIR_PET_LOBBY_INV_MAX_SLOTS,
    PAIR_SOULSTONE_NAMES,
    PAIR_EGG_DISPLAY_IMAGE,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_TEMPLATE_ID,
    PAIR_SOULSTONE_TEMPLATE_IDS,
    findFirstHatchablePairEgg,
    getPairPetDefinition,
    isPairEggItem,
    isPairWelcomeEggItem,
    isPairPetMaterial,
    isPairSoulStoneItem,
    pairPetLobbyInventorySlots,
    pairPetLobbyExpandDiamondCost,
    countPairLobbyPetEntriesInInventory,
    isPairLobbyPetInventoryFull,
    normalizePairPetLobbyInventorySort,
    pairPetLobbyInventoryKindOrderIndex,
} from '../../shared/constants/petLobby.js';
import {
    PAIR_TRAINING_SLOT_DEFS,
    getPairTrainingSlotDisplayName,
    getPairTrainingSlotUnlockProgress,
    getPairWins,
    isItemIdInPairTraining,
    isPairTrainingSlotUnlocked,
    isValidPairPetTrainingPrecomputedRewards,
    minPetLevelForTrainingSlot,
    normalizePairPetTrainingSlots,
    trainingEndsAt,
} from '../../shared/constants/pairTraining.js';
import type { PairTrainingClaimClientSummary } from '../../shared/types/pairTrainingClaim.js';
import { buildPairTrainingClaimSummaryFromPrecomputed } from '../../shared/utils/pairTrainingClaimSummary.js';
import { computeOptimisticPairPetSoulConvert } from '../../shared/utils/pairPetSoulConvert.js';
import {
    PAIR_HATCHERY_MAIN_SLOT_INDEX,
    PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE,
    PAIR_HATCHERY_UPGRADE_TIER_DEFS,
    PAIR_HATCHERY_VIP_SLOT_INDEX,
    canUnlockPairHatcheryUpgrade,
    canUsePairHatcherySlot,
    getPairHatcheryDurationMs,
    getPairHatcheryHighestUpgradeTier,
    getPairHatcheryMainSlotEffectiveDef,
    getPairHatcherySlotDef,
    hatcheryEndsAt,
    normalizePairPetHatcherySessions,
    normalizePairPetHatcheryUpgradeTiers,
    type PairHatcheryLevelRule,
    type PairHatcherySlotDef,
    type PairHatcheryUpgradeTierDef,
} from '../../shared/constants/pairHatchery.js';
import {
    collectPairPetInventoryIds,
    readObtainedPetFromHatcheryActionResult,
} from '../../shared/utils/pairHatcheryClaim.js';
import { isFunctionVipActive } from '../../shared/utils/rewardVip.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import {
    hasPairPetHatcheryClaimReadyForQuickMenu,
    hasPairPetTrainingClaimReadyForQuickMenu,
} from '../../shared/utils/pairPetQuickClaimNotification.js';
import { resolvePairPetRpsAttributeFromMeta } from '../../shared/utils/pairPetRps.js';
import PairPetRpsBadge from './PairPetRpsBadge.js';
type AiTab = 'info' | 'training' | 'hatchery' | 'shop';
type InvFilter = 'pet' | 'soul';
type ShopSkuTab = 'egg' | 'soul';
type PairExpandCategory = 'pet';

function pairPetShopSkuImage(sku: PairPetShopSku): string {
    if (sku.materialName === PAIR_EGG_MATERIAL_NAME) return PAIR_EGG_DISPLAY_IMAGE;
    const mat = MATERIAL_ITEMS[sku.materialName as keyof typeof MATERIAL_ITEMS];
    return (mat?.image as string | undefined) ?? PAIR_EGG_DISPLAY_IMAGE;
}

type PairTrainingRewardModalOpen = {
    slotIndex: number;
    petItem: InventoryItem;
    claimSummary: PairTrainingClaimClientSummary | null;
    /** `precomputedRewards` 없는 구세션 — 서버 수령 후 표시 */
    claimViaServer: boolean;
};

/** 인벤 썸네일 배지: 슬롯에 있으면서 타이머 종료 후 수령 전이면 `claim_ready` */
function pairTrainingBadgeVariantForItem(currentUser: User, itemId: string): 'in_progress' | 'claim_ready' | undefined {
    const slots = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
    if (!isItemIdInPairTraining(slots, itemId)) return undefined;
    const now = Date.now();
    for (let si = 0; si < slots.length; si += 1) {
        const sess = slots[si];
        if (!sess || sess.itemId !== itemId) continue;
        const petRowForSess = currentUser.inventory.find((x) => x.id === sess.itemId);
        const sessMeta = petRowForSess ? resolvePairPetMetaFromInventoryRow(petRowForSess) : null;
        return now >= trainingEndsAt(sess.startedAt, si, sessMeta) ? 'claim_ready' : 'in_progress';
    }
    return 'in_progress';
}

const SOUL_SLOT_PREFIX = 'soul-slot:';

function formatHatcheryDurationHMS(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 부화장 남은 시간(슬롯 하단·즉시 완료 모달 공통) */
function formatPairHatcheryRemainHMS(ms: number): string {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}


/** 부화장 슬롯 — 짧은 레벨 표기 (줄바꿈·줄임 없음) */
function hatcheryLevelOutcomeFromRule(rule: PairHatcheryLevelRule): React.ReactNode {
    const cls = `${PET_MGMT_SEMI} tabular-nums text-amber-100`;
    if (rule.kind === 'default') {
        return <span className={cls}>펫 Lv.1</span>;
    }
    if (rule.kind === 'fixed') {
        const n = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(rule.level)));
        return <span className={cls}>펫 Lv.{n}</span>;
    }
    const lo = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.min(rule.min, rule.max)));
    const hi = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.max(rule.min, rule.max)));
    if (lo === hi) {
        return <span className={cls}>펫 Lv.{lo}</span>;
    }
    return (
        <span className={cls}>
            펫 Lv.{lo}~{hi}
        </span>
    );
}

function hatcheryLevelOutcomeLine(def: Pick<PairHatcherySlotDef, 'levelRule'>): React.ReactNode {
    return hatcheryLevelOutcomeFromRule(def.levelRule);
}

function HatcheryOwnedEggThumb({
    imageUrl,
    qty,
    title,
    showSpecialBadge = false,
    compact = false,
}: {
    imageUrl: string;
    qty: number;
    title: string;
    showSpecialBadge?: boolean;
    compact?: boolean;
}) {
    return (
        <div
            className={`relative flex shrink-0 items-center justify-center ${
                compact ? 'h-8 w-8' : 'h-[3.75rem] w-[3.75rem] sm:h-[4.5rem] sm:w-[4.5rem]'
            }`}
            title={title}
        >
            <img
                src={imageUrl}
                alt=""
                className={`object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)] ${
                    compact ? 'h-7 w-7' : 'h-[3rem] w-[3rem] sm:h-[3.75rem] sm:w-[3.75rem]'
                }`}
                loading="lazy"
            />
            {showSpecialBadge ? (
                <span className="absolute right-0 top-0 z-[2] min-w-[1.1rem] rounded-bl bg-fuchsia-600/90 px-1 py-0.5 text-[0.7rem] font-black leading-none text-white ring-1 ring-black/45">
                    특
                </span>
            ) : null}
            <span className="absolute -bottom-0.5 -right-0.5 z-[2] rounded bg-black/75 px-1 py-px text-[0.65rem] font-black tabular-nums text-amber-200 ring-1 ring-black/50">
                {qty}
            </span>
        </div>
    );
}

function HatcheryFunctionVipHintIcon() {
    return (
        <svg
            className="h-[clamp(1rem,4.2vmin,1.5rem)] w-[clamp(1rem,4.2vmin,1.5rem)] shrink-0 text-amber-300"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
        >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
    );
}

/** 가방 인벤·수련 상세 등 세로 스크롤: 얇은 트랙/썸 */
const PET_LOBBY_BAG_SCROLLBAR_Y_CLASS =
    '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.28)_transparent] [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/55';

function InvThumb({
    item,
    selected,
    onClick,
    disabled,
    showRepresentativeBadge,
    showTrainingBadge,
    trainingBadgeVariant,
    title,
}: {
    item: InventoryItem;
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
    /** 페어 로비 인벤: 대표로 장착된 펫 썸네일 상단 표시 */
    showRepresentativeBadge?: boolean;
    /** 수련 슬롯에 올라간 펫 */
    showTrainingBadge?: boolean;
    /** 수련 배지: 진행 중 vs 타이머 종료(슬롯에서 수령 전) */
    trainingBadgeVariant?: 'in_progress' | 'claim_ready';
    title?: string;
}) {
    const qty = item.quantity ?? 1;
    const showStackBadge = !isPairPetMaterial(item) && qty > 1;
    const petThumb = isPairPetMaterial(item) && !isPairEggItem(item);
    const petG = effectivePairPetGradeFromRow(item);
    const petBg = petThumb ? (gradeBackgrounds[petG] ?? gradeBackgrounds[ItemGrade.Normal]) : null;
    const petTrans = petThumb && petG === ItemGrade.Transcendent;
    const petLevel = petThumb ? resolvePairPetMetaFromInventoryRow(item).level : null;
    const petRpsAttr = useMemo(() => {
        if (!petThumb) return undefined;
        const m = resolvePairPetMetaFromInventoryRow(item);
        return resolvePairPetRpsAttributeFromMeta(m, item.id, item.createdAt ?? Date.now());
    }, [petThumb, item]);
    const badgeChip =
        'whitespace-nowrap px-[2px] py-px text-[0.45rem] font-black leading-none tracking-tight text-white shadow-sm ring-1 ring-black/35';
    return (
        <button
            type="button"
            disabled={disabled}
            title={title}
            onClick={onClick}
            className={`relative flex aspect-square w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border p-0.5 text-xs font-bold transition ${
                selected ? 'border-cyan-300 bg-cyan-950/60 text-cyan-50' : 'border-white/15 bg-black/40 text-slate-200 hover:border-white/35'
            } ${petTrans ? 'transcendent-grade-slot' : ''} disabled:opacity-40`}
        >
            {petThumb && (showRepresentativeBadge || showTrainingBadge) ? (
                <span className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-px px-0.5 pt-px">
                    {showRepresentativeBadge ? (
                        <span className="flex w-full justify-center" title="대표 펫">
                            <span className={`${badgeChip} rounded-b bg-cyan-600`}>대표펫</span>
                        </span>
                    ) : null}
                    {showTrainingBadge ? (
                        <span
                            className="flex w-full justify-center"
                            title={trainingBadgeVariant === 'claim_ready' ? '수련 완료 — 슬롯에서 보상 수령' : '수련 중'}
                        >
                            <span
                                className={`${badgeChip} rounded-b ${
                                    trainingBadgeVariant === 'claim_ready' ? 'bg-lime-600' : 'bg-violet-600'
                                }`}
                            >
                                {trainingBadgeVariant === 'claim_ready' ? '수련완료' : '수련중'}
                            </span>
                        </span>
                    ) : null}
                </span>
            ) : null}
            {petThumb && petLevel != null ? (
                <span
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-0.5 pb-px"
                    title={`레벨 ${petLevel}`}
                >
                    <span
                        className={`${badgeChip} rounded-t bg-slate-900/92 tabular-nums text-amber-100 ring-amber-500/25`}
                    >
                        Lv.{petLevel}
                    </span>
                </span>
            ) : null}
            {petBg ? (
                <img src={petBg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover opacity-88" loading="lazy" />
            ) : null}
            <img
                src={item.image}
                alt=""
                className={`relative z-[1] shrink-0 object-contain ${petThumb ? 'h-[72%] w-[72%] drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]' : 'h-9 w-9 rounded'}`}
                loading="lazy"
            />
            {petThumb ? (
                <span className="pointer-events-none absolute left-0.5 top-0.5 z-[2] sm:left-1 sm:top-1">
                    <PairPetRpsBadge attribute={petRpsAttr} scaleWithParent />
                </span>
            ) : null}
            {showStackBadge ? (
                <span className="absolute bottom-0.5 right-0.5 z-20 rounded bg-black/70 px-1 py-0.5 text-xs font-black text-amber-200">
                    ×{qty}
                </span>
            ) : null}
        </button>
    );
}

function SoulStoneFixedThumb({
    imageUrl,
    qty,
    grade,
    selected,
    disabled,
    onClick,
}: {
    imageUrl: string;
    qty: number;
    grade: ItemGrade;
    selected: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    const bgSrc = gradeBackgrounds[grade] ?? gradeBackgrounds[ItemGrade.Normal];
    const isTranscendent = grade === ItemGrade.Transcendent;
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`relative flex aspect-square w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border p-0.5 text-xs font-bold transition ${
                selected ? 'border-cyan-300 ring-1 ring-cyan-300/80' : 'border-white/20 hover:border-white/40'
            } ${isTranscendent ? 'transcendent-grade-slot' : ''} disabled:opacity-40`}
        >
            <img src={bgSrc} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            <img
                src={imageUrl}
                alt=""
                className="relative z-[1] h-[62%] w-[62%] shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)] sm:h-[58%] sm:w-[58%]"
                loading="lazy"
            />
            <span className="absolute bottom-0.5 right-0.5 z-[2] rounded bg-black/70 px-1 py-0.5 text-xs font-black text-amber-200">
                ×{qty}
            </span>
        </button>
    );
}

function InvReadonly({ item }: { item: InventoryItem }) {
    const qty = item.quantity ?? 1;
    const showStackBadge = !isPairPetMaterial(item) && qty > 1;
    return (
        <div className="relative flex aspect-square w-full min-w-0 flex-col items-center justify-center rounded-lg border border-white/12 bg-black/35 p-0.5">
            <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded object-contain" loading="lazy" />
            {showStackBadge ? (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.5 text-xs font-black text-amber-200">×{qty}</span>
            ) : null}
        </div>
    );
}

function formatPairShopDescription(desc: string): string {
    const t = desc.trim();
    if (!t) return '';
    if (!/[.!?]$/.test(t)) return `${t}.`;
    return t;
}

const PAIR_PET_SHOP_GRADE_ARROW = '➝';

const PAIR_PET_SHOP_GRADE_NAME_COLOR: Record<string, string> = Object.fromEntries(
    Object.entries(EQUIPMENT_GRADE_LABEL_KO).map(([gradeKey, gradeName]) => [
        gradeName,
        gradeStyles[gradeKey as ItemGrade]?.color ?? 'text-slate-200',
    ]),
);

function renderPairPetShopBracketGrades(segment: string, segmentKey: string) {
    const parts = segment.split(/(\[[^\]]+\])/g).filter((part) => part.length > 0);
    return parts.map((part, partIndex) => {
        const bracketMatch = part.match(/^\[([^\]]+)\]$/);
        if (!bracketMatch) {
            return <React.Fragment key={`${segmentKey}-plain-${partIndex}`}>{part}</React.Fragment>;
        }
        const gradeName = bracketMatch[1];
        const gradeColor = PAIR_PET_SHOP_GRADE_NAME_COLOR[gradeName] ?? 'text-slate-200';
        return (
            <span key={`${segmentKey}-grade-${partIndex}`} className={`font-semibold ${gradeColor}`}>
                [{gradeName}]
            </span>
        );
    });
}

function PairPetShopShortDescription({ text }: { text: string }) {
    const segments = text.split(PAIR_PET_SHOP_GRADE_ARROW);
    if (segments.length < 2) {
        return (
            <p className={PET_MGMT_SHOP_SHORT_TEXT} title={text}>
                {renderPairPetShopBracketGrades(text, 'single')}
            </p>
        );
    }
    return (
        <p className={PET_MGMT_SHOP_SHORT_TEXT} title={text}>
            {segments.map((segment, index) => (
                <React.Fragment key={`${index}-${segment}`}>
                    {index > 0 ? (
                        <span className="mx-0.5 inline-block bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text font-bold text-transparent drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
                            {PAIR_PET_SHOP_GRADE_ARROW}
                        </span>
                    ) : null}
                    {renderPairPetShopBracketGrades(segment, `seg-${index}`)}
                </React.Fragment>
            ))}
        </p>
    );
}

/** 메인 상점 `ShopItemCard`와 유사한 카드형 레이아웃 */
function PairPetShopSkuCard({
    sku,
    currentUser,
    isBusy,
    mobile,
    onBuyClick,
    descOpen,
    onOpenDesc,
    onCloseDesc,
}: {
    sku: PairPetShopSku;
    currentUser: User;
    isBusy: boolean;
    mobile: boolean;
    onBuyClick: (sku: PairPetShopSku) => void;
    descOpen: boolean;
    onOpenDesc: () => void;
    onCloseDesc: () => void;
}) {
    const imageAnchorRef = useRef<HTMLDivElement>(null);
    const now = Date.now();
    const rec = currentUser.dailyShopPurchases?.[sku.id];
    const boughtToday = rec && isSameDayKST(rec.date, now) ? rec.quantity : 0;
    const unlimitedDaily = isPairPetShopSkuUnlimitedDaily(sku.dailyLimit);
    const remaining = unlimitedDaily ? Number.POSITIVE_INFINITY : Math.max(0, sku.dailyLimit - boughtToday);
    const isGold = sku.gold > 0;
    const priceAmount = isGold ? sku.gold : sku.diamonds;
    const refinedDescription = formatPairShopDescription(sku.description);

    const handleImageClick = () => {
        if (mobile) {
            if (descOpen) onCloseDesc();
            else onOpenDesc();
        } else {
            onOpenDesc();
        }
    };

    return (
        <div className="group relative flex w-full flex-col items-center overflow-hidden rounded-xl border border-indigo-400/35 bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 p-2.5 text-center shadow-[0_22px_55px_-30px_rgba(99,102,241,0.55)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-32px_rgba(129,140,248,0.55)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent" />
            <div
                ref={imageAnchorRef}
                role="button"
                tabIndex={0}
                title={sku.label}
                className="relative mb-1.5 flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)] transition-transform hover:scale-105"
                onClick={handleImageClick}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleImageClick();
                    }
                }}
                onMouseEnter={() => {
                    if (!mobile) onOpenDesc();
                }}
                onMouseLeave={() => {
                    if (!mobile) onCloseDesc();
                }}
            >
                <img src={pairPetShopSkuImage(sku)} alt="" className="h-full w-full object-contain p-1 drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)]" loading="lazy" />
                {sku.quantity > 1 ? (
                    <span className="absolute right-0 top-0 rounded-bl bg-gray-900/90 px-1 text-xs font-bold text-cyan-300 shadow-md">×{sku.quantity}</span>
                ) : null}
            </div>
            {descOpen ? (
                <ShopMobileImageDescriptionPortal
                    open
                    anchorRef={imageAnchorRef}
                    onRequestClose={onCloseDesc}
                    fullscreenBackdrop={mobile}
                >
                    <p className={`text-left leading-relaxed text-slate-200/90 ${PET_MGMT_SEMI}`}>{refinedDescription}</p>
                </ShopMobileImageDescriptionPortal>
            ) : null}
            <h3
                className={`line-clamp-2 min-h-[2.5rem] w-full min-w-0 break-keep px-0 text-center font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.55)] ${PET_MGMT_SHOP_TITLE}`}
                title={sku.label}
            >
                {sku.label}
            </h3>
            {sku.shortDescription ? <PairPetShopShortDescription text={sku.shortDescription} /> : null}
            <div className="mt-1.5 flex w-full shrink-0 flex-col items-stretch justify-center gap-1">
                <Button
                    type="button"
                    onClick={() => onBuyClick(sku)}
                    disabled={isBusy || (!unlimitedDaily && remaining === 0)}
                    colorScheme="none"
                    bare
                    className={`flex h-[2.95rem] min-h-[2.95rem] max-h-[2.95rem] w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 text-center ${PET_MGMT_SHOP_BTN_TEXT} transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isGold
                            ? 'border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_10px_28px_-16px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500'
                            : 'border-sky-400/50 bg-gradient-to-r from-sky-400/90 via-blue-500/90 to-indigo-500/90 text-white shadow-[0_10px_28px_-16px_rgba(56,189,248,0.75)] hover:from-sky-300 hover:to-indigo-500'
                    }`}
                >
                    <div className="flex min-w-0 items-center justify-center gap-1 font-semibold tracking-tight">
                        {isGold ? (
                            <img src="/images/icon/Gold.webp" alt="" className="h-4 w-4 shrink-0 drop-shadow-md" />
                        ) : (
                            <img src="/images/icon/Zem.webp" alt="" className="h-4 w-4 shrink-0 drop-shadow-md" />
                        )}
                        <span className="tabular-nums">
                            {isGold ? formatGoldAmountKoG(priceAmount) : formatWalletDiamonds(priceAmount)}
                        </span>
                    </div>
                    {!unlimitedDaily ? (
                        <span
                            className={`max-w-full px-0 text-center text-[9px] leading-tight tracking-tight ${isGold ? 'text-slate-800/95' : 'text-white/85'}`}
                        >
                            일일 한도 {remaining}/{sku.dailyLimit}
                        </span>
                    ) : null}
                </Button>
            </div>
        </div>
    );
}

export interface PairPetLobbyPanelProps {
    currentUser: User;
    currentUserId: string;
    isBusy: boolean;
    applyPetAction: (action: ServerAction) => Promise<unknown>;
}

const PairPetLobbyPanel: React.FC<PairPetLobbyPanelProps> = ({ currentUser, currentUserId, isBusy, applyPetAction }) => {
    const { handlers } = useAppContext();
    const { isNativeMobile, isNarrowViewport, pcLikeMobileLayout } = useNativeMobileShell();
    /** 터치·좁은 화면: 드롭 대신 슬롯 탭 → 펫 탭 */
    const useTapTrainingFlow = isNativeMobile || (isNarrowViewport && !pcLikeMobileLayout);
    /** 모바일 전용 레이아웃(부화장 스택·인벤 축소 등) — PC 뷰포트 폭과 분리 */
    const petMgmtMobileShell = useTapTrainingFlow;
    const [aiTab, setAiTab] = useState<AiTab>(() => (petMgmtMobileShell ? 'info' : 'training'));
    const [shopSkuTab, setShopSkuTab] = useState<ShopSkuTab>('egg');
    const [shopDescSkuId, setShopDescSkuId] = useState<string | null>(null);
    const [pairShopPurchaseSku, setPairShopPurchaseSku] = useState<PairPetShopSku | null>(null);
    const [invFilter, setInvFilter] = useState<InvFilter>('pet');
    const [expandTarget, setExpandTarget] = useState<PairExpandCategory | null>(null);
    const [selectedLobbyItemId, setSelectedLobbyItemId] = useState<string | null>(null);
    const [invSort, setInvSort] = useState<PairPetLobbyInventorySortMode>(() =>
        normalizePairPetLobbyInventorySort(currentUser.pairPetLobbyInventorySort) ?? 'recent',
    );

    useEffect(() => {
        if (!petMgmtMobileShell && aiTab === 'info') setAiTab('training');
    }, [petMgmtMobileShell, aiTab]);

    useEffect(() => {
        const persisted = normalizePairPetLobbyInventorySort(currentUser.pairPetLobbyInventorySort);
        if (persisted !== undefined) setInvSort(persisted);
    }, [currentUser.pairPetLobbyInventorySort]);

    /** 클라·서버 수련 슬롯 불일치·진행 중 고아 세션 복구 — 로비 진입 시 1회(백그라운드) */
    const pairTrainingSlotsResyncedRef = useRef(false);
    useEffect(() => {
        if (pairTrainingSlotsResyncedRef.current) return;
        pairTrainingSlotsResyncedRef.current = true;
        void handlers.handleAction({ type: 'PAIR_PET_RESYNC_TRAINING_SLOTS' });
    }, [handlers.handleAction]);

    const [trainingTick, setTrainingTick] = useState(0);
    const [hatcheryTick, setHatcheryTick] = useState(0);
    /** 수련·부화 탭 붉은점: 다른 탭에 있어도 완료 시각이 지나면 갱신 */
    const [pairLobbyPendingTick, setPairLobbyPendingTick] = useState(0);
    const [hatcheryConfirmSlotIndex, setHatcheryConfirmSlotIndex] = useState<number | null>(null);
    const [hatcheryInstantConfirmSlotIndex, setHatcheryInstantConfirmSlotIndex] = useState<number | null>(null);
    const [hatcheryPetInvFullModalOpen, setHatcheryPetInvFullModalOpen] = useState(false);
    const [soulConvertItem, setSoulConvertItem] = useState<InventoryItem | null>(null);
    const soulConvertInFlightRef = useRef(false);
    /** 영혼석 판매 확인(스택 행 + 판매 개수) */
    const [soulStoneSellConfirm, setSoulStoneSellConfirm] = useState<{ stackItem: InventoryItem; quantity: number } | null>(
        null,
    );
    /** 영혼석 일괄 판매: 수량 조절 모달(가방 일괄 판매와 동일 로직) */
    const [soulStoneSellBulkItem, setSoulStoneSellBulkItem] = useState<InventoryItem | null>(null);
    /** 모바일: 빈 수련 슬롯 탭 후 인벤에서 펫 선택 */
    const [trainingMobilePickSlotIndex, setTrainingMobilePickSlotIndex] = useState<number | null>(null);
    /** 수련 시작 직전 확인(드롭·모바일 탭 공통) */
    const [trainingStartConfirm, setTrainingStartConfirm] = useState<{ slotIndex: number; itemId: string } | null>(null);
    /** 수련 완료 보상 모달: 수령 후에도 슬롯이 비워져도 펫·슬롯 정보 유지 */
    const [trainingRewardModal, setTrainingRewardModal] = useState<PairTrainingRewardModalOpen | null>(null);
    /** 수련 진행 중 취소 확인 모달(슬롯 인덱스) */
    const [trainingCancelConfirmSlotIndex, setTrainingCancelConfirmSlotIndex] = useState<number | null>(null);

    /** 수련 시작 시 확정된 `precomputedRewards`로 결과 숫자를 즉시 표시하고, 수령 API는 백그라운드 동기화 */
    const openPairTrainingClaimResultModal = useCallback(
        (slotIndex: number, petRow: InventoryItem) => {
            if (isBusy) return;
            const slots = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
            const pre = slots[slotIndex]?.precomputedRewards;
            const claimSummary =
                pre && isValidPairPetTrainingPrecomputedRewards(pre)
                    ? buildPairTrainingClaimSummaryFromPrecomputed(petRow, pre)
                    : null;
            setTrainingRewardModal({
                slotIndex,
                petItem: petRow,
                claimSummary,
                claimViaServer: !claimSummary,
            });
        },
        [isBusy, currentUser.pairPetTrainingSlots],
    );

    const equippedTid = currentUser.equippedPairPetTemplateId ?? null;
    /** 저장되어 있으면 해당 행만 대표 표시(동종 다마리 구분). 없으면 템플릿 일치 행 전체에 표시(구버전 호환). */
    const equippedItemId = currentUser.equippedPairPetInventoryItemId ?? null;
    const equippedPetRow = useMemo(() => getEquippedPairPetInventoryRow(currentUser), [currentUser]);

    const inventory = currentUser.inventory || [];

    const pairShopQuantityModalLimit = useMemo(() => {
        if (!pairShopPurchaseSku) return 0;
        if (isPairPetShopSkuUnlimitedDaily(pairShopPurchaseSku.dailyLimit)) return 999;
        const rec = currentUser.dailyShopPurchases?.[pairShopPurchaseSku.id];
        const now = Date.now();
        const bought = rec && isSameDayKST(rec.date, now) ? rec.quantity : 0;
        return Math.max(0, pairShopPurchaseSku.dailyLimit - bought);
    }, [pairShopPurchaseSku, currentUser.dailyShopPurchases, currentUser]);

    const eggCount = useMemo(
        () => inventory.filter(isPairEggItem).reduce((s, it) => s + (it.quantity ?? 1), 0),
        [inventory]
    );

    const welcomeEggCount = useMemo(
        () => inventory.filter(isPairWelcomeEggItem).reduce((s, it) => s + (it.quantity ?? 1), 0),
        [inventory]
    );

    const standardMysteryEggCount = useMemo(
        () =>
            inventory
                .filter((it) => isPairEggItem(it) && !isPairWelcomeEggItem(it))
                .reduce((s, it) => s + (it.quantity ?? 1), 0),
        [inventory]
    );

    const pairHatcheryHasClaimReady = useMemo(() => {
        void hatcheryTick;
        void pairLobbyPendingTick;
        return hasPairPetHatcheryClaimReadyForQuickMenu(currentUser, Date.now());
    }, [currentUser, hatcheryTick, pairLobbyPendingTick]);

    const pairTrainingHasClaimReady = useMemo(() => {
        void trainingTick;
        void pairLobbyPendingTick;
        return hasPairPetTrainingClaimReadyForQuickMenu(currentUser, Date.now());
    }, [currentUser, trainingTick, pairLobbyPendingTick]);

    const shopSkusVisible = useMemo(
        () =>
            PAIR_PET_SHOP_SKUS.filter((sku) =>
                shopSkuTab === 'egg' ? sku.id.startsWith('pair_shop_egg_') : sku.id.startsWith('pair_shop_soul_')
            ),
        [shopSkuTab]
    );

    const shopEggSkus = useMemo(
        () => PAIR_PET_SHOP_SKUS.filter((sku) => sku.id.startsWith('pair_shop_egg_')),
        [],
    );
    const shopSoulSkus = useMemo(
        () => PAIR_PET_SHOP_SKUS.filter((sku) => sku.id.startsWith('pair_shop_soul_')),
        [],
    );

    /** 수련 탭은 펫 인벤만 사용 (영혼석 탭 없음). 정보 탭은 기존 펫/영혼석 필터 유지. */
    const effectiveInvFilter: InvFilter = aiTab === 'training' ? 'pet' : invFilter;

    const filteredInv = useMemo(() => {
        if (effectiveInvFilter === 'pet') return inventory.filter(isPairPetMaterial);
        return inventory.filter(isPairSoulStoneItem);
    }, [inventory, effectiveInvFilter]);

    const sortedFilteredInv = useMemo(() => {
        const arr = [...filteredInv];
        const byRecent = (a: InventoryItem, b: InventoryItem) => (b.createdAt ?? 0) - (a.createdAt ?? 0);
        const petLevel = (it: InventoryItem) => resolvePairPetMetaFromInventoryRow(it).level;
        const petGradeRank = (it: InventoryItem) => pairPetGradeIndex(effectivePairPetGradeFromRow(it));

        switch (invSort) {
            case 'oldest':
                return arr.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
            case 'name':
                return arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
            case 'petLevel':
                return arr.sort((a, b) => {
                    const ld = petLevel(b) - petLevel(a);
                    if (ld !== 0) return ld;
                    const gd = petGradeRank(b) - petGradeRank(a);
                    if (gd !== 0) return gd;
                    return byRecent(a, b);
                });
            case 'gradeHigh':
                return arr.sort((a, b) => {
                    const gd = petGradeRank(b) - petGradeRank(a);
                    if (gd !== 0) return gd;
                    const ld = petLevel(b) - petLevel(a);
                    if (ld !== 0) return ld;
                    return byRecent(a, b);
                });
            case 'petNumber':
                return arr.sort((a, b) => {
                    const kd = pairPetLobbyInventoryKindOrderIndex(a) - pairPetLobbyInventoryKindOrderIndex(b);
                    if (kd !== 0) return kd;
                    return byRecent(a, b);
                });
            case 'recent':
            default:
                return arr.sort(byRecent);
        }
    }, [filteredInv, invSort]);

    const soulQtyByTemplateId = useMemo(() => {
        const m = new Map<string, number>();
        for (const it of inventory) {
            if (!isPairSoulStoneItem(it) || !it.templateId) continue;
            m.set(it.templateId, (m.get(it.templateId) ?? 0) + (it.quantity ?? 1));
        }
        return m;
    }, [inventory]);

    const pairPetMaterialCount = useMemo(
        () => countPairLobbyPetEntriesInInventory(inventory),
        [inventory]
    );

    const pairLobbyPetInvFull = useMemo(() => isPairLobbyPetInventoryFull(currentUser), [currentUser]);

    const slotCountPet = pairPetLobbyInventorySlots(
        currentUser.pairPetLobbyPetSlotCount ?? currentUser.pairPetLobbySlotCount
    );
    const slotCount = effectiveInvFilter === 'pet' ? slotCountPet : 0;

    const canExpandSlots = effectiveInvFilter === 'pet' && slotCount < PAIR_PET_LOBBY_INV_MAX_SLOTS;
    const hiddenInvCount = effectiveInvFilter === 'pet' ? Math.max(0, sortedFilteredInv.length - slotCount) : 0;

    const modalSlotCount = expandTarget === 'pet' ? slotCountPet : 0;
    const expansionDiamondCost = expandTarget ? pairPetLobbyExpandDiamondCost(modalSlotCount) : 0;
    const nextSlotCountAfterExpand = Math.min(PAIR_PET_LOBBY_INV_MAX_SLOTS, modalSlotCount + PAIR_PET_LOBBY_INV_EXPAND_STEP);
    const hasEnoughDiamondsExpand = (currentUser.diamonds ?? 0) >= expansionDiamondCost;

    const selectedItem = useMemo((): InventoryItem | null => {
        if (!selectedLobbyItemId) return null;
        if (selectedLobbyItemId.startsWith(SOUL_SLOT_PREFIX)) {
            const tid = selectedLobbyItemId.slice(SOUL_SLOT_PREFIX.length);
            const stacks = inventory.filter((i) => i.templateId === tid && isPairSoulStoneItem(i));
            const sum = stacks.reduce((s, it) => s + (it.quantity ?? 1), 0);
            const first = stacks[0];
            const tierMatch = /^pair-soul-(\d+)$/.exec(tid);
            const tier = tierMatch ? Math.min(5, Math.max(1, parseInt(tierMatch[1]!, 10))) : 1;
            const displayName = PAIR_SOULSTONE_NAMES[tier - 1]!;
            const meta = MATERIAL_ITEMS[displayName as keyof typeof MATERIAL_ITEMS];
            if (!meta) return null;
            return {
                id: first?.id ?? `${SOUL_SLOT_PREFIX}${tid}-virt`,
                name: meta.name,
                description: meta.description,
                type: 'material',
                slot: null,
                level: 1,
                stars: 0,
                isEquipped: false,
                createdAt: first?.createdAt ?? Date.now(),
                image: meta.image,
                grade: meta.grade,
                quantity: sum,
                templateId: tid,
            } as InventoryItem;
        }
        return inventory.find((i) => i.id === selectedLobbyItemId) ?? null;
    }, [inventory, selectedLobbyItemId]);

    const selectedSoulPrimaryStackId = useMemo(() => {
        if (!selectedLobbyItemId?.startsWith(SOUL_SLOT_PREFIX)) return null;
        const tid = selectedLobbyItemId.slice(SOUL_SLOT_PREFIX.length);
        return inventory.find((i) => i.templateId === tid && isPairSoulStoneItem(i))?.id ?? null;
    }, [inventory, selectedLobbyItemId]);

    useEffect(() => {
        if (!selectedLobbyItemId) return;
        if (selectedLobbyItemId.startsWith(SOUL_SLOT_PREFIX)) return;
        if (!inventory.some((i) => i.id === selectedLobbyItemId)) {
            setSelectedLobbyItemId(null);
            return;
        }
        const row = inventory.find((i) => i.id === selectedLobbyItemId);
        if (row && isPairEggItem(row)) setSelectedLobbyItemId(null);
    }, [inventory, selectedLobbyItemId]);

    useEffect(() => {
        setSelectedLobbyItemId(null);
        setInvSort('recent');
    }, [invFilter]);

    useEffect(() => {
        if (aiTab !== 'info') setSelectedLobbyItemId(null);
    }, [aiTab]);

    useEffect(() => {
        if (aiTab !== 'training') return undefined;
        const id = window.setInterval(() => setTrainingTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, [aiTab]);

    useEffect(() => {
        if (aiTab !== 'hatchery') return undefined;
        const id = window.setInterval(() => setHatcheryTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, [aiTab]);

    useEffect(() => {
        const id = window.setInterval(() => setPairLobbyPendingTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        if (aiTab !== 'hatchery') {
            setHatcheryConfirmSlotIndex(null);
            setHatcheryInstantConfirmSlotIndex(null);
        }
    }, [aiTab]);

    useEffect(() => {
        if (aiTab !== 'training') {
            setTrainingMobilePickSlotIndex(null);
            setTrainingStartConfirm(null);
            setTrainingCancelConfirmSlotIndex(null);
        }
    }, [aiTab]);

    const purchase = async (sku: string, quantity = 1) => {
        await applyPetAction({ type: 'PAIR_PET_PURCHASE', payload: { sku, quantity } });
    };

    const onPairPetShopBuyClick = (sku: PairPetShopSku) => {
        if (isPairPetShopSkuUnlimitedDaily(sku.dailyLimit) || sku.dailyLimit > 1) {
            setPairShopPurchaseSku(sku);
            return;
        }
        void purchase(sku.id, 1);
    };

    const equipPet = async (templateId: string, inventoryItemId: string) => {
        await applyPetAction({
            type: 'PAIR_PET_SET_EQUIPPED',
            payload: { templateId, inventoryItemId },
        });
    };

    const clearEquip = async () => {
        await applyPetAction({ type: 'PAIR_PET_SET_EQUIPPED', payload: { templateId: null } });
    };

    const openEquippedPetDetail = useCallback(() => {
        const tid = currentUser.equippedPairPetTemplateId;
        if (!tid) return;
        const row = getEquippedPairPetInventoryRow(currentUser);
        if (row) handlers.openPairPetDetailModal(row, 'view');
    }, [currentUser, handlers]);

    const focusInfoPetInventory = useCallback(() => {
        if (petMgmtMobileShell) setAiTab('info');
        setInvFilter('pet');
        setExpandTarget(null);
    }, [petMgmtMobileShell]);

    const confirmSoulConvert = () => {
        if (!soulConvertItem || soulConvertInFlightRef.current) return;
        const itemId = soulConvertItem.id;
        soulConvertInFlightRef.current = true;
        const inv = currentUser.inventory || [];
        const slots = currentUser.inventorySlots ?? { equipment: 30, consumable: 30, material: 30 };
        const optimistic = computeOptimisticPairPetSoulConvert(inv, slots, itemId);
        if (!optimistic.ok) {
            window.alert(optimistic.error);
            return;
        }
        const invSnapshot = JSON.parse(JSON.stringify(inv)) as InventoryItem[];
        // 영혼변환 창(zIndex 72)이 획득 모달(70)보다 위라서, 닫기 전에 획득 모달이 가려지지 않도록 먼저 내린다.
        flushSync(() => setSoulConvertItem(null));
        handlers.applyDeferredUserUpdate(
            { inventory: optimistic.nextInventory },
            'PAIR_PET_CONVERT_PET-optimistic',
        );
        handlers.showObtainedItemsBulk([optimistic.soulStack]);
        setSelectedLobbyItemId((cur) => (cur === itemId ? null : cur));

        void handlers
            .handleAction({
                type: 'PAIR_PET_CONVERT_PET',
                payload: { itemId, __clientSkipObtainedModal: true },
            })
            .then((raw) => {
                const err = (raw as { error?: string } | null)?.error;
                if (err) {
                    handlers.applyDeferredUserUpdate({ inventory: invSnapshot }, 'PAIR_PET_CONVERT_PET-optimistic-rollback');
                    window.alert(err);
                }
            })
            .finally(() => {
                soulConvertInFlightRef.current = false;
            });
    };

    const sellItem = async (itemId: string, quantity: number) => {
        await applyPetAction({ type: 'SELL_ITEM', payload: { itemId, quantity } });
    };

    const confirmExpandLobbySlots = async () => {
        if (!expandTarget || isBusy) return;
        const result = await applyPetAction({
            type: 'PAIR_PET_EXPAND_LOBBY_SLOTS',
            payload: { category: expandTarget },
        });
        if (result && !(result as { error?: string })?.error) {
            setExpandTarget(null);
        }
    };

    const readUpdatedUserFromActionResult = (res: unknown): User | undefined => {
        const r = res as { updatedUser?: User; clientResponse?: { updatedUser?: User } };
        return r.updatedUser ?? r.clientResponse?.updatedUser;
    };

    const openHatcheryObtainedPetModal = useCallback(
        (res: unknown, beforePetIds: ReadonlySet<string>) => {
            const pet = readObtainedPetFromHatcheryActionResult(res, beforePetIds);
            if (pet) flushSync(() => handlers.openPairPetDetailModal(pet, 'obtain'));
        },
        [handlers.openPairPetDetailModal],
    );

    const handleHatcheryClaim = async (slotIndex: number) => {
        if (isPairLobbyPetInventoryFull(currentUser)) {
            setHatcheryPetInvFullModalOpen(true);
            return;
        }
        const beforePetIds = collectPairPetInventoryIds(currentUser.inventory);
        const res = await applyPetAction({ type: 'PAIR_PET_HATCHERY_CLAIM', payload: { slotIndex } });
        const claimErr = res && (res as { error?: string }).error;
        if (claimErr) {
            if (claimErr === PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE) setHatcheryPetInvFullModalOpen(true);
            return;
        }
        openHatcheryObtainedPetModal(res, beforePetIds);
    };

    const instantFinishHatch = async (slotIndex: number) => {
        if (isPairLobbyPetInventoryFull(currentUser)) {
            setHatcheryPetInvFullModalOpen(true);
            return { error: PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE };
        }
        const beforePetIds = collectPairPetInventoryIds(currentUser.inventory);
        const res = await applyPetAction({ type: 'PAIR_PET_HATCHERY_INSTANT_FINISH', payload: { slotIndex } });
        if (res && (res as { error?: string }).error) return res;
        openHatcheryObtainedPetModal(res, beforePetIds);
        return res;
    };

    const showInvStrip = aiTab === 'info' || aiTab === 'training' || aiTab === 'hatchery';

    /** 수련 탭은 펫 인벤만 쓰므로 탭 하이라이트는 항상 펫; 영혼석 버튼은 비활성 */
    const invStripTabHighlight: InvFilter = aiTab === 'training' ? 'pet' : invFilter;

    const hatcheryTabContent = (() => {
        void hatcheryTick;
        const sessions = normalizePairPetHatcherySessions(currentUser.pairPetHatcherySessions);
        const upgradeTiers = normalizePairPetHatcheryUpgradeTiers(currentUser.pairPetHatcherySlotUnlocked);
        const mainEffective = getPairHatcheryMainSlotEffectiveDef(currentUser);
        const highestUpgrade = getPairHatcheryHighestUpgradeTier(currentUser);
        const pairWins = getPairWins(currentUser);
        const vipActive = isFunctionVipActive(currentUser);
        const now = Date.now();

        const unlockUpgradeTier = async (tierIndex: number) => {
            await applyPetAction({ type: 'PAIR_PET_HATCHERY_UNLOCK', payload: { slotIndex: tierIndex } });
        };

        const cancelHatchery = async (slotIndex: number) => {
            await applyPetAction({ type: 'PAIR_PET_HATCHERY_CANCEL', payload: { slotIndex } });
        };

        const renderSessionSlot = (slotIndex: number) => {
            const def = getPairHatcherySlotDef(slotIndex, currentUser);
            if (!def) return null;
            const usable = canUsePairHatcherySlot(currentUser, slotIndex);
            const session = sessions[slotIndex];
            const endAt = session ? hatcheryEndsAt(session.startedAt, slotIndex, session, currentUser) : 0;
            const canClaim = Boolean(session && now >= endAt);
            const remainMs = session && !canClaim ? Math.max(0, endAt - now) : 0;
            const instantDiamondCost =
                session && !canClaim && remainMs > 0 ? Math.max(1, Math.ceil(remainMs / 60_000)) : 0;
            const hasEnoughInstantDiamonds =
                Boolean(currentUser.isAdmin) || (currentUser.diamonds ?? 0) >= instantDiamondCost;
            const isVip = slotIndex === PAIR_HATCHERY_VIP_SLOT_INDEX;

            const firstHatchEgg = findFirstHatchablePairEgg(currentUser.inventory);
            const hatchUsesWelcomeEgg = Boolean(
                (session && session.eggTemplateId === PAIR_WELCOME_EGG_TEMPLATE_ID) ||
                    (!session && firstHatchEgg && isPairWelcomeEggItem(firstHatchEgg)),
            );
            const levelOutcome = hatchUsesWelcomeEgg ? (
                <span className={`${PET_MGMT_SEMI} tabular-nums text-amber-100`}>펫 Lv.5</span>
            ) : (
                hatcheryLevelOutcomeLine(def)
            );
            const eggImgForSlot =
                MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ?? PAIR_EGG_DISPLAY_IMAGE;

            const effectiveDurationMs = session
                ? getPairHatcheryDurationMs(slotIndex, session, currentUser)
                : firstHatchEgg && isPairWelcomeEggItem(firstHatchEgg)
                  ? 60_000
                  : def.durationMs;
            const durationHMS = formatHatcheryDurationHMS(effectiveDurationMs);

            const hatchStartBtn = isVip
                ? '!border !border-amber-400/65 !bg-gradient-to-b !from-amber-500/95 !to-amber-900/95 !text-amber-50 !shadow-[0_6px_18px_rgba(245,158,11,0.38)] hover:!from-amber-400 hover:!to-amber-800'
                : '!border !border-fuchsia-400/60 !bg-gradient-to-b !from-fuchsia-600/95 !to-fuchsia-900/95 !text-fuchsia-50 !shadow-[0_6px_18px_rgba(192,38,211,0.35)] hover:!from-fuchsia-500 hover:!to-fuchsia-800';

            const hatchBtnStart = `${PET_MGMT_HATCHERY_BTN_CLASS} !h-full disabled:!opacity-40 ${hatchStartBtn}`;
            const hatchBtnClaim = `${PET_MGMT_HATCHERY_BTN_CLASS} !h-full !border !border-amber-400/55 !bg-gradient-to-b !from-amber-500/95 !to-amber-800/95 !text-amber-50 disabled:!opacity-40`;
            const hatchBtnInstant = `${PET_MGMT_HATCHERY_BTN_STACK_CLASS} !h-full !border !border-cyan-400/55 !bg-gradient-to-b !from-cyan-600/90 !to-cyan-950/95 !text-cyan-50 disabled:!opacity-40`;
            const hatchBtnCancel = `${PET_MGMT_HATCHERY_BTN_CLASS} !h-full !border !border-white/20 !bg-white/[0.06] !text-zinc-200 hover:!border-white/30 hover:!bg-white/[0.1] disabled:!opacity-40`;

            const slotHeaderLabel = isVip ? (
                <span
                    className={`shrink-0 rounded border border-amber-200/50 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 px-1 py-px ${PET_MGMT_XBOLD} uppercase tracking-wide text-amber-950 ring-1 ring-amber-400/50`}
                >
                    VIP
                </span>
            ) : (
                <span className={`inline-flex min-w-0 items-center gap-1 ${PET_MGMT_XBOLD} tabular-nums text-fuchsia-200/85`}>
                    <span>#1</span>
                    {mainEffective.upgradeLabel ? (
                        <span className="truncate rounded border border-fuchsia-400/35 bg-fuchsia-950/50 px-1 py-px text-[0.6rem] font-bold text-fuchsia-100/95">
                            {mainEffective.upgradeLabel}
                        </span>
                    ) : null}
                </span>
            );

            const hasActionPanel =
                (usable && !session) ||
                (usable && session && !canClaim) ||
                (usable && session && canClaim) ||
                (isVip && !vipActive);

            const actionPanel = hasActionPanel ? (
                <div className={`${PET_MGMT_HATCHERY_INFO_CLASS} min-h-[2.125rem]`}>
                    {usable && !session ? (
                        <Button
                            type="button"
                            bare
                            disabled={isBusy || eggCount < 1}
                            onClick={() => setHatcheryConfirmSlotIndex(slotIndex)}
                            colorScheme="none"
                            className={hatchBtnStart}
                        >
                            부화 시작
                        </Button>
                    ) : null}
                    {usable && session && !canClaim ? (
                        <div className={PET_MGMT_HATCHERY_ACTION_ROW_CLASS}>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy || !hasEnoughInstantDiamonds || pairLobbyPetInvFull}
                                title={
                                    pairLobbyPetInvFull
                                        ? PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE
                                        : !hasEnoughInstantDiamonds
                                          ? '다이아가 부족합니다.'
                                          : undefined
                                }
                                onClick={() => setHatcheryInstantConfirmSlotIndex(slotIndex)}
                                colorScheme="none"
                                className={hatchBtnInstant}
                            >
                                <span>즉시완료</span>
                                <span className="inline-flex items-center gap-0.5 tabular-nums">
                                    <img src="/images/icon/Zem.webp" alt="" className="h-2.5 w-2.5 shrink-0" />
                                    <span>{instantDiamondCost}</span>
                                </span>
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => void cancelHatchery(slotIndex)}
                                colorScheme="none"
                                className={hatchBtnCancel}
                            >
                                취소
                            </Button>
                        </div>
                    ) : null}
                    {usable && session && canClaim ? (
                        <Button
                            type="button"
                            bare
                            disabled={isBusy}
                            title={
                                pairLobbyPetInvFull
                                    ? '펫 인벤토리가 가득 찼습니다. 눌러 안내를 확인하세요.'
                                    : undefined
                            }
                            onClick={() => void handleHatcheryClaim(slotIndex)}
                            colorScheme="none"
                            className={hatchBtnClaim}
                        >
                            펫 받기
                        </Button>
                    ) : null}
                    {isVip && !vipActive ? (
                        <div
                            className={`flex h-[2.125rem] items-center justify-center rounded border border-amber-500/20 bg-amber-950/20 ${PET_MGMT_SEMI} text-amber-200/90`}
                        >
                            <HatcheryFunctionVipHintIcon />
                        </div>
                    ) : null}
                </div>
            ) : null;

            const chamberBusy = usable && Boolean(session);

            const eggStatusCls = `${PET_MGMT_SEMI} whitespace-nowrap leading-none`;

            const outerUsable = isVip
                ? 'border-amber-500/38 bg-gradient-to-br from-amber-950/42 via-zinc-950/82 to-orange-950/28 shadow-[0_0_28px_rgba(245,158,11,0.16),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/22 hover:-translate-y-[1px]'
                : 'border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/45 via-zinc-950/80 to-violet-950/35 shadow-[0_0_28px_rgba(192,38,211,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-fuchsia-400/15 hover:-translate-y-[1px]';
            const outerLocked = 'border-white/[0.09] bg-gradient-to-br from-zinc-900/70 via-black/70 to-zinc-950/90 ring-1 ring-black/50';
            const glowOrb = usable ? (isVip ? 'bg-amber-500/22' : 'bg-fuchsia-600/20') : 'bg-zinc-600/10';
            const topHairline = usable ? (isVip ? 'via-amber-400/45' : 'via-fuchsia-400/40') : 'via-white/15';

            return (
                <div
                    key={`hatch-def-${slotIndex}`}
                    className={`group relative ${petMgmtMobileShell ? PET_MGMT_HATCHERY_SLOT_OUTER_MOBILE_CLASS : PET_MGMT_HATCHERY_SLOT_OUTER_CLASS} gap-0.5 rounded-lg border p-1 shadow-md ${PET_MGMT_BASE} ${
                        usable ? outerUsable : outerLocked
                    }`}
                >
                    <div className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-xl ${glowOrb}`} aria-hidden />
                    <div
                        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${topHairline} to-transparent`}
                        aria-hidden
                    />
                    <div className={`relative z-10 ${PET_MGMT_HATCHERY_SLOT_HEADER_CLASS}`}>
                        {slotHeaderLabel}
                        <div
                            className={`min-w-0 truncate text-right ${PET_MGMT_SEMI} tabular-nums leading-none ${
                                isVip ? 'text-amber-100' : 'text-amber-100/95'
                            }`}
                        >
                            {levelOutcome}
                        </div>
                    </div>
                    <div className="relative z-10 flex min-h-0 min-w-0 flex-col py-px">
                            <div
                                className={`${PET_MGMT_HATCHERY_CHAMBER_CLASS} min-h-0 flex-1 p-0.5 ${petMgmtMobileShell ? '!overflow-visible' : ''} ${
                                    !usable
                                        ? isVip
                                            ? 'border-amber-900/25 bg-gradient-to-b from-amber-950/35 to-black/72'
                                            : 'border-white/10 bg-gradient-to-b from-zinc-900/50 to-black/70'
                                        : chamberBusy
                                          ? isVip
                                              ? 'border-amber-400/45 bg-gradient-to-b from-amber-950/45 via-black/58 to-orange-950/28 shadow-[inset_0_0_20px_rgba(251,191,36,0.12)]'
                                              : 'border-fuchsia-400/40 bg-gradient-to-b from-fuchsia-950/40 via-black/60 to-violet-950/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.12)]'
                                          : isVip
                                            ? 'border-amber-400/50 bg-gradient-to-b from-amber-900/28 to-black/50 shadow-[inset_0_0_24px_rgba(251,191,36,0.1)]'
                                            : 'border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-900/25 to-black/50 shadow-[inset_0_0_24px_rgba(217,70,239,0.08)]'
                                }`}
                            >
                                {!usable ? (
                                    <div className="col-span-full row-span-3 flex min-h-0 flex-col items-center justify-center gap-0.5 px-0.5 text-center">
                                        <span
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm leading-none text-zinc-400 shadow-inner"
                                            aria-hidden
                                        >
                                            🔒
                                        </span>
                                        {isVip ? (
                                            <p className={`max-w-full px-0.5 text-center ${PET_MGMT_XBOLD} text-amber-200/95`}>
                                                기능VIP활성화
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <>
                                        <div className={`flex min-h-0 items-center justify-center p-px ${petMgmtMobileShell ? 'overflow-visible' : 'overflow-hidden'}`}>
                                            <div className="relative flex shrink-0 items-center justify-center">
                                                <div
                                                    className={`absolute inset-0 rounded-full blur-md ${
                                                        session
                                                            ? canClaim
                                                                ? 'bg-amber-400/35'
                                                                : isVip
                                                                  ? 'bg-amber-500/28'
                                                                  : 'bg-fuchsia-500/30'
                                                            : isVip
                                                              ? 'bg-amber-500/22'
                                                              : 'bg-fuchsia-500/24'
                                                    }`}
                                                    aria-hidden
                                                />
                                                <img
                                                    src={eggImgForSlot}
                                                    alt=""
                                                    className={`relative ${petMgmtMobileShell ? PET_MGMT_HATCHERY_EGG_IMG_MOBILE_CLASS : PET_MGMT_HATCHERY_EGG_IMG_CLASS} ring-[3px] ring-offset-2 ${
                                                        session
                                                            ? isVip
                                                                ? 'ring-amber-300/65 ring-offset-amber-950/85 shadow-[0_0_20px_rgba(245,158,11,0.42),inset_0_1px_0_rgba(255,255,255,0.15)]'
                                                                : 'ring-fuchsia-300/55 ring-offset-fuchsia-950/80 shadow-[0_0_20px_rgba(217,70,239,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]'
                                                            : isVip
                                                              ? 'ring-amber-300/50 ring-offset-amber-950/85 opacity-92 shadow-[0_0_16px_rgba(245,158,11,0.32),inset_0_1px_0_rgba(255,255,255,0.12)]'
                                                              : 'ring-fuchsia-300/48 ring-offset-fuchsia-950/80 opacity-92 shadow-[0_0_16px_rgba(217,70,239,0.3),inset_0_1px_0_rgba(255,255,255,0.12)]'
                                                    }`}
                                                    loading="lazy"
                                                />
                                            </div>
                                        </div>
                                        <div className={PET_MGMT_HATCHERY_STATUS_ROW_CLASS}>
                                            <span
                                                className={`${eggStatusCls} ${
                                                    session
                                                        ? canClaim
                                                            ? 'text-amber-200/95'
                                                            : isVip
                                                              ? 'text-amber-100/92'
                                                              : 'text-fuchsia-200/90'
                                                        : isVip
                                                          ? 'text-amber-200/88'
                                                          : 'text-fuchsia-200/88'
                                                }`}
                                            >
                                                {session ? (canClaim ? '부화 완료' : '부화 중') : '부화 가능'}
                                            </span>
                                        </div>
                                        <div
                                            className={`${PET_MGMT_HATCHERY_TIMER_ROW_CLASS} ${PET_MGMT_BOLD} leading-none ${
                                                usable && session && !canClaim
                                                    ? 'text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]'
                                                    : usable && !session && isVip
                                                      ? 'text-amber-200/88'
                                                      : 'text-fuchsia-200/90'
                                            }`}
                                        >
                                            {usable && session
                                                ? canClaim
                                                    ? formatPairHatcheryRemainHMS(0)
                                                    : formatPairHatcheryRemainHMS(remainMs)
                                                : durationHMS}
                                        </div>
                                    </>
                                )}
                            </div>
                    </div>
                    {actionPanel}
                </div>
            );
        };

        const renderUpgradeTierCard = (tierDef: PairHatcheryUpgradeTierDef) => {
            const tierIndex = tierDef.tierIndex;
            const tierUnlocked = upgradeTiers[tierIndex - 1];
            const isActive = highestUpgrade === tierIndex;
            const winsOk = pairWins >= tierDef.unlockWinsRequired;
            const gate = canUnlockPairHatcheryUpgrade(currentUser, tierIndex);
            const durationHMS = formatHatcheryDurationHMS(tierDef.durationMs);
            const hatchBtnUnlock = `${PET_MGMT_HATCHERY_BTN_CLASS} !h-full !border !border-amber-400/50 !bg-gradient-to-b !from-amber-600/90 !to-amber-900/90 !text-amber-50 disabled:!opacity-45`;

            return (
                <div
                    key={`hatch-upgrade-${tierIndex}`}
                    className={`flex min-h-[5.75rem] flex-col gap-1 rounded-lg border p-1.5 shadow-md ${PET_MGMT_BASE} ${
                        tierUnlocked
                            ? isActive
                                ? 'border-fuchsia-400/45 bg-gradient-to-br from-fuchsia-950/50 via-zinc-950/85 to-violet-950/35 ring-1 ring-fuchsia-400/25'
                                : 'border-white/12 bg-gradient-to-br from-zinc-900/70 via-black/70 to-zinc-950/90'
                            : winsOk
                              ? 'border-amber-500/30 bg-gradient-to-br from-amber-950/35 via-zinc-950/85 to-zinc-950/90'
                              : 'border-white/[0.09] bg-gradient-to-br from-zinc-900/70 via-black/70 to-zinc-950/90 opacity-90'
                    }`}
                >
                    <div className="flex items-center justify-between gap-1">
                        <span className={`${PET_MGMT_XBOLD} text-fuchsia-200/90`}>{tierDef.displayLabel}</span>
                        {tierUnlocked ? (
                            <span
                                className={`rounded px-1 py-px ${PET_MGMT_CAPTION} font-bold ${
                                    isActive ? 'bg-fuchsia-500/25 text-fuchsia-100' : 'bg-white/10 text-slate-400'
                                }`}
                            >
                                {isActive ? '적용 중' : '해금됨'}
                            </span>
                        ) : (
                            <span className={`${PET_MGMT_CAPTION} tabular-nums text-amber-200/85`}>페어 {tierDef.unlockWinsRequired}승</span>
                        )}
                    </div>
                    <div className={`min-h-0 flex-1 ${PET_MGMT_SEMI} leading-snug text-amber-100/90`}>
                        {hatcheryLevelOutcomeFromRule(tierDef.levelRule)}
                        <span className="mx-1 text-slate-600">·</span>
                        <span className="font-mono tabular-nums text-fuchsia-200/85">{durationHMS}</span>
                    </div>
                    {!tierUnlocked ? (
                        winsOk ? (
                            <Button
                                type="button"
                                bare
                                disabled={isBusy || !gate.ok}
                                title={!gate.ok ? gate.reason : undefined}
                                onClick={() => void unlockUpgradeTier(tierIndex)}
                                colorScheme="none"
                                className={hatchBtnUnlock}
                            >
                                강화 ({tierDef.unlockGold.toLocaleString()} G)
                            </Button>
                        ) : (
                            <div
                                className={`flex h-[1.85rem] items-center justify-center rounded border border-white/10 bg-black/30 ${PET_MGMT_CAPTION} text-slate-500`}
                            >
                                페어 {tierDef.unlockWinsRequired}승 필요
                            </div>
                        )
                    ) : null}
                </div>
            );
        };

        const eggThumbSrc =
            MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ?? PAIR_EGG_DISPLAY_IMAGE;
        const welcomeEggThumbSrc =
            MATERIAL_ITEMS[PAIR_WELCOME_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ?? eggThumbSrc;

        const renderEggInventoryCell = () =>
            petMgmtMobileShell ? (
                <div key="hatch-egg-inventory" className={PET_MGMT_HATCHERY_EGG_INVENTORY_MOBILE_CLASS}>
                    <div className="flex min-w-0 shrink-0 flex-col leading-none">
                        <span className={`${PET_MGMT_XBOLD} text-[11px] text-slate-300`}>보유 알</span>
                        <span className={`${PET_MGMT_CAPTION} text-slate-500`}>부화 시 1개</span>
                    </div>
                    <span className={`${PET_MGMT_BOLD} shrink-0 tabular-nums text-xs text-amber-100`}>{eggCount}</span>
                    <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
                        <HatcheryOwnedEggThumb
                            imageUrl={welcomeEggThumbSrc}
                            qty={welcomeEggCount}
                            title={PAIR_WELCOME_EGG_MATERIAL_NAME}
                            showSpecialBadge
                            compact
                        />
                        <HatcheryOwnedEggThumb
                            imageUrl={eggThumbSrc}
                            qty={standardMysteryEggCount}
                            title={PAIR_EGG_MATERIAL_NAME}
                            compact
                        />
                    </div>
                </div>
            ) : (
            <div
                key="hatch-egg-inventory"
                className={`relative ${PET_MGMT_HATCHERY_SLOT_OUTER_CLASS} gap-0.5 rounded-lg border border-white/[0.09] bg-gradient-to-br from-zinc-900/70 via-black/70 to-zinc-950/90 p-1 shadow-md ${PET_MGMT_BASE} ring-1 ring-black/50`}
            >
                <div className={`relative z-10 ${PET_MGMT_HATCHERY_SLOT_HEADER_CLASS}`}>
                    <span className={`${PET_MGMT_XBOLD} text-slate-300`}>보유 알</span>
                    <span className={`${PET_MGMT_BOLD} tabular-nums text-amber-100`}>합계 {eggCount}</span>
                </div>
                <div className="relative z-10 flex min-h-0 flex-1 flex-row items-center justify-center gap-3 overflow-hidden px-1 py-1 sm:gap-4">
                    <HatcheryOwnedEggThumb
                        imageUrl={welcomeEggThumbSrc}
                        qty={welcomeEggCount}
                        title={PAIR_WELCOME_EGG_MATERIAL_NAME}
                        showSpecialBadge
                    />
                    <HatcheryOwnedEggThumb
                        imageUrl={eggThumbSrc}
                        qty={standardMysteryEggCount}
                        title={PAIR_EGG_MATERIAL_NAME}
                    />
                </div>
                <p className={`relative z-10 shrink-0 text-center ${PET_MGMT_CAPTION} leading-none text-slate-500`}>부화 시 1개 소모</p>
            </div>
            );

        const upgradeTierPanel = (
            <div className={`grid w-full gap-2 ${petMgmtMobileShell ? 'grid-cols-1' : 'grid-cols-3'}`}>
                {PAIR_HATCHERY_UPGRADE_TIER_DEFS.map((tierDef) => renderUpgradeTierCard(tierDef))}
            </div>
        );

        if (petMgmtMobileShell) {
            return (
                <div className={PET_MGMT_HATCHERY_MOBILE_STACK_CLASS}>
                    {renderEggInventoryCell()}
                    <div className={PET_MGMT_HATCHERY_MOBILE_SLOTS_ROW_CLASS}>
                        {renderSessionSlot(PAIR_HATCHERY_VIP_SLOT_INDEX)}
                        {renderSessionSlot(PAIR_HATCHERY_MAIN_SLOT_INDEX)}
                    </div>
                    {upgradeTierPanel}
                </div>
            );
        }

        return (
            <div className="flex w-full flex-col gap-2">
                <div className={PET_MGMT_HATCHERY_GRID_CLASS}>
                    {renderSessionSlot(PAIR_HATCHERY_MAIN_SLOT_INDEX)}
                    {renderSessionSlot(PAIR_HATCHERY_VIP_SLOT_INDEX)}
                    {renderEggInventoryCell()}
                </div>
                {upgradeTierPanel}
            </div>
        );
    })();

    const renderLobbyGridSlot = (it: InventoryItem | undefined, index: number) => {
        if (!it) {
            return (
                <div
                    key={`pet-inv-empty-${index}`}
                    className="aspect-square w-full min-w-0 rounded-lg border-2 border-gray-700/50 bg-gray-800/50"
                    aria-hidden
                />
            );
        }
        const representativeThumb =
            Boolean(
                isPairPetMaterial(it) &&
                    !isPairEggItem(it) &&
                    it.templateId &&
                    equippedTid &&
                    it.templateId === equippedTid &&
                    (!equippedItemId || equippedItemId === it.id),
            );
        const trainingSlotsNorm = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
        const inTraining =
            isPairPetMaterial(it) && !isPairEggItem(it) && isItemIdInPairTraining(trainingSlotsNorm, it.id);
        const trainingBadgeVariant = inTraining ? pairTrainingBadgeVariantForItem(currentUser, it.id) : undefined;
        if (aiTab === 'info') {
            return (
                <InvThumb
                    key={it.id}
                    item={it}
                    selected={selectedLobbyItemId === it.id}
                    disabled={isBusy}
                    onClick={() => {
                        if (inTraining && !isBusy) {
                            handlers.openPairPetDetailModal(it, 'view');
                            return;
                        }
                        setSelectedLobbyItemId(it.id);
                    }}
                    showRepresentativeBadge={representativeThumb}
                    showTrainingBadge={inTraining}
                    trainingBadgeVariant={trainingBadgeVariant}
                    title={
                        inTraining
                            ? trainingBadgeVariant === 'claim_ready'
                                ? '수련 완료 — 클릭하면 상세 정보'
                                : '수련 중 — 클릭하면 상세 정보'
                            : undefined
                    }
                />
            );
        }
        if (aiTab === 'training') {
            const isRepPet = Boolean(
                isPairPetMaterial(it) &&
                    !isPairEggItem(it) &&
                    it.templateId &&
                    equippedTid &&
                    it.templateId === equippedTid &&
                    (!equippedItemId || equippedItemId === it.id),
            );
            const dragPet =
                isPairPetMaterial(it) && !isPairEggItem(it) && !inTraining && !isRepPet && !useTapTrainingFlow;
            const canTapPetToTrain =
                useTapTrainingFlow && isPairPetMaterial(it) && !isPairEggItem(it) && !inTraining && !isRepPet;
            const trainInvTitle = useTapTrainingFlow
                ? trainingMobilePickSlotIndex == null
                    ? '빈 수련 슬롯을 먼저 터치한 뒤 펫을 선택하세요.'
                    : isRepPet
                      ? '대표 펫은 수련에 보낼 수 없습니다.'
                      : undefined
                : isRepPet
                  ? '대표 펫은 수련에 보낼 수 없습니다.'
                  : undefined;
            const petDetailTitle = inTraining
                ? trainingBadgeVariant === 'claim_ready'
                    ? '수련 완료 — 클릭하면 상세 정보'
                    : '수련 중 — 클릭하면 상세 정보'
                : isRepPet
                  ? '대표 펫 — 클릭하면 상세 정보'
                  : trainInvTitle;
            return (
                <div
                    key={it.id}
                    draggable={!isBusy && dragPet}
                    onDragStart={(e) => {
                        if (!dragPet || isBusy) return;
                        e.dataTransfer.setData('text/pair-training-pet', it.id);
                        e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className={`min-w-0${inTraining || isRepPet ? ' opacity-[0.72]' : ''}`}
                >
                    <InvThumb
                        item={it}
                        selected={false}
                        disabled={isBusy}
                        onClick={() => {
                            const canDetail = isPairPetMaterial(it) && !isPairEggItem(it) && it.templateId;
                            if (!canDetail) return;
                            if (inTraining && !isBusy) {
                                handlers.openPairPetDetailModal(it, 'view');
                                return;
                            }
                            if (canTapPetToTrain && trainingMobilePickSlotIndex != null) {
                                setTrainingStartConfirm({ slotIndex: trainingMobilePickSlotIndex, itemId: it.id });
                                setTrainingMobilePickSlotIndex(null);
                                return;
                            }
                            handlers.openPairPetDetailModal(it, 'view');
                        }}
                        showRepresentativeBadge={representativeThumb}
                        showTrainingBadge={inTraining}
                        trainingBadgeVariant={trainingBadgeVariant}
                        title={petDetailTitle}
                    />
                </div>
            );
        }
        const tid = it.templateId;
        const sel = Boolean(
            tid &&
                equippedTid === tid &&
                isPairPetMaterial(it) &&
                (!equippedItemId || equippedItemId === it.id),
        );
        if (isPairPetMaterial(it) && tid) {
            return (
                <InvThumb
                    key={it.id}
                    item={it}
                    selected={sel}
                    disabled={isBusy}
                    onClick={() => {
                        if (inTraining && !isBusy) {
                            handlers.openPairPetDetailModal(it, 'view');
                            return;
                        }
                        void equipPet(tid, it.id);
                    }}
                    showRepresentativeBadge={representativeThumb}
                    showTrainingBadge={inTraining}
                    trainingBadgeVariant={trainingBadgeVariant}
                    title={
                        inTraining
                            ? trainingBadgeVariant === 'claim_ready'
                                ? '수련 완료 — 클릭하면 상세 정보'
                                : '수련 중 — 클릭하면 상세 정보'
                            : undefined
                    }
                />
            );
        }
        return <InvReadonly key={it.id} item={it} />;
    };

    const confirmPairTrainingCancel = async () => {
        const slotIndex = trainingCancelConfirmSlotIndex;
        if (slotIndex == null || isBusy) return;
        const res = await applyPetAction({ type: 'PAIR_PET_CANCEL_TRAINING', payload: { slotIndex } });
        const err = (res as { error?: string })?.error;
        if (err) {
            window.alert(err);
            return;
        }
        setTrainingCancelConfirmSlotIndex(null);
    };

    const expandLabel = expandTarget === 'pet' ? '펫' : '';

    const trainingTabContent = (() => {
        void trainingTick;
        const trainingSlots = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
        const now = Date.now();

        const formatRemainHMS = (ms: number) => {
            const s = Math.ceil(ms / 1000);
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            return `${padTime2(h)}:${padTime2(m)}:${padTime2(sec)}`;
        };

        const onDropStart = (slotIndex: number, e: React.DragEvent) => {
            e.preventDefault();
            if (trainingStartConfirm != null || isBusy) return;
            const itemId = e.dataTransfer.getData('text/pair-training-pet');
            if (!itemId) return;
            setTrainingStartConfirm({ slotIndex, itemId });
        };

        const padTime2 = (n: number) => String(n).padStart(2, '0');

        const trLbl = PET_MGMT_TR_REWARD_LBL_CLASS;
        const trAmt = PET_MGMT_TR_REWARD_AMT_CLASS;
        const trSlotTitle = `${PET_MGMT_TITLE} text-violet-100`;
        const trMono = `tabular-nums font-mono ${PET_MGMT_BOLD}`;
        const trIconBox = useTapTrainingFlow ? 'h-[2.5rem] w-[2.5rem] shrink-0' : PET_MGMT_TR_ICON_BOX;
        const trIconImg = useTapTrainingFlow ? 'h-6 w-6' : PET_MGMT_TR_ICON_IMG;
        const trSoulCol = useTapTrainingFlow ? 'w-[2.5rem] shrink-0 gap-0.5' : PET_MGMT_TR_SOUL_COL;
        const trSlotCol = useTapTrainingFlow ? PET_MGMT_TR_SLOT_COL_MOBILE_CLASS : PET_MGMT_TR_SLOT_COL;
        const trPetImgClass = useTapTrainingFlow ? PET_MGMT_TR_PET_IMG_MOBILE_CLASS : PET_MGMT_TR_PET_IMG_CLASS;
        const trSlotDropClass = useTapTrainingFlow ? PET_MGMT_TR_SLOT_DROP_MOBILE_CLASS : PET_MGMT_TR_SLOT_DROP_CLASS;
        const trSlotCardClass = useTapTrainingFlow ? PET_MGMT_TR_SLOT_CARD_MOBILE_CLASS : PET_MGMT_TR_SLOT_CARD_CLASS;
        const getSoulRewardSizing = (soulItemCount: number) => {
            if (soulItemCount >= 3) {
                return {
                    colClass: PET_MGMT_TR_SOUL_COL_3_CLASS,
                    iconBoxClass: PET_MGMT_TR_ICON_BOX_3_CLASS,
                    fgImgClass: PET_MGMT_TR_SOUL_FG_IMG_SM_CLASS,
                };
            }
            if (soulItemCount === 2) {
                return {
                    colClass: PET_MGMT_TR_SOUL_COL_2_CLASS,
                    iconBoxClass: PET_MGMT_TR_ICON_BOX_2_CLASS,
                    fgImgClass: PET_MGMT_TR_SOUL_FG_IMG_MD_CLASS,
                };
            }
            return {
                colClass: `flex shrink-0 flex-col items-center justify-center ${trSoulCol}`,
                iconBoxClass: trIconBox,
                fgImgClass: PET_MGMT_TR_SOUL_FG_IMG_CLASS,
            };
        };

        return (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2 pb-1">
                {useTapTrainingFlow ? (
                    <p className={`rounded border border-violet-500/25 bg-violet-950/30 px-1.5 py-1 text-center ${PET_MGMT_TR_HINT_TEXT} text-violet-100/95`}>
                        빈 슬롯 터치 후 펫 선택
                    </p>
                ) : (
                    <p className={`rounded border border-white/10 bg-black/25 px-1.5 py-1 text-center ${PET_MGMT_TR_HINT_TEXT} text-slate-400`}>
                        펫을 슬롯에 놓으면 수련 시작
                    </p>
                )}
                <div className={petMgmtMobileShell ? PET_MGMT_TR_SLOTS_GRID_CLASS : PET_MGMT_TR_SLOTS_DESKTOP_CLASS}>
                    {[...PAIR_TRAINING_SLOT_DEFS]
                        .sort((a, b) => Number(!!b.requiresFunctionVip) - Number(!!a.requiresFunctionVip))
                        .map((def) => {
                        const i = def.slotIndex;
                        const unlocked = isPairTrainingSlotUnlocked(currentUser, i);
                        const unlockProgress = getPairTrainingSlotUnlockProgress(currentUser, i);
                        const minLv = minPetLevelForTrainingSlot(i);
                        const isVipTrainingSlot = Boolean(def.requiresFunctionVip);
                        const session = trainingSlots[i];
                        const petRow = session ? inventory.find((x) => x.id === session.itemId) : null;
                        const sessionMeta = petRow ? resolvePairPetMetaFromInventoryRow(petRow) : null;
                        const endAt = session ? trainingEndsAt(session.startedAt, i, sessionMeta) : 0;
                        const canClaim = Boolean(session && now >= endAt);
                        const rowClaimReady = Boolean(unlocked && session && petRow && canClaim);
                        const remainMs = session && !canClaim ? Math.max(0, endAt - now) : 0;
                        const durationTotalSec = Math.max(0, Math.floor(def.durationMs / 1000));
                        const durationHh = Math.floor(durationTotalSec / 3600);
                        const durationMm = Math.floor((durationTotalSec % 3600) / 60);
                        const durationSs = durationTotalSec % 60;
                        const durationHhMmSs = `${padTime2(durationHh)}:${padTime2(durationMm)}:${padTime2(durationSs)}`;

                        const showSoulCandidates = def.soulDropChance > 0 && def.soulTable.length > 0;
                        const goldDisplay =
                            def.goldMin === def.goldMax
                                ? formatGoldAmountKoG(def.goldMin)
                                : `${formatGoldAmountKoG(def.goldMin)}~${formatGoldAmountKoG(def.goldMax)}`;
                        const soulRewardSizing = getSoulRewardSizing(def.soulTable.length);

                        const fixedRewardBox = (
                            <div className={`${PET_MGMT_TR_REWARD_BOX_CLASS} border-amber-400/35 bg-amber-950/45`}>
                                <div className={PET_MGMT_TR_REWARD_ROW_INNER_CLASS}>
                                    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
                                        <div
                                            className={`flex items-center justify-center rounded-md border border-amber-400/40 bg-black/50 ${trIconBox}`}
                                        >
                                            <img
                                                src="/images/icon/Gold.webp"
                                                alt=""
                                                className={`shrink-0 object-contain ${trIconImg}`}
                                                loading="lazy"
                                                decoding="sync"
                                            />
                                        </div>
                                        <span className={`${trAmt} whitespace-nowrap text-amber-50`} title={goldDisplay}>
                                            {goldDisplay}
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
                                        <div
                                            className={`flex flex-col items-center justify-center rounded-md border border-violet-400/45 bg-violet-950/60 px-0.5 ${trIconBox}`}
                                            title="펫 경험치"
                                        >
                                            <span className={`${PET_MGMT_TR_EXP_LABEL} text-violet-100`}>펫</span>
                                            <span className={`${PET_MGMT_TR_EXP_LABEL} text-violet-100`}>EXP</span>
                                        </div>
                                        <span className={`${trAmt} text-violet-100`}>
                                            {def.xpMin}~{def.xpMax}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                        const soulRewardBox = showSoulCandidates ? (
                            <div className={`${PET_MGMT_TR_REWARD_BOX_CLASS} border-cyan-500/30 bg-zinc-950/55`}>
                                <div className={PET_MGMT_TR_REWARD_ROW_INNER_CLASS}>
                                    {def.soulTable.map((row, si) => {
                                        const mat = MATERIAL_ITEMS[row.materialName as keyof typeof MATERIAL_ITEMS];
                                        const src = mat?.image ?? '/images/pets/soulstone1.webp';
                                        const grade = mat?.grade ?? ItemGrade.Normal;
                                        const bgSrc = gradeBackgrounds[grade] ?? gradeBackgrounds[ItemGrade.Normal];
                                        const isTranscendent = grade === ItemGrade.Transcendent;
                                        return (
                                            <div
                                                key={`train-soul-${i}-${si}`}
                                                className={soulRewardSizing.colClass}
                                                title={row.materialName}
                                            >
                                                <div
                                                    className={`relative isolate flex items-center justify-center overflow-hidden rounded-md border bg-black/40 ${soulRewardSizing.iconBoxClass} ${
                                                        isTranscendent
                                                            ? 'transcendent-grade-slot border-white/25'
                                                            : 'border-white/20'
                                                    }`}
                                                >
                                                    <img
                                                        src={bgSrc}
                                                        alt=""
                                                        className="absolute inset-0 z-0 h-full w-full object-cover"
                                                        loading="lazy"
                                                        decoding="sync"
                                                    />
                                                    <img
                                                        src={src}
                                                        alt=""
                                                        className={soulRewardSizing.fgImgClass}
                                                        loading="lazy"
                                                        decoding="sync"
                                                    />
                                                </div>
                                                <span className={`${trAmt} text-slate-100`}>×{row.quantity}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null;
                        const fixedRewardBlock = (
                            <div className={PET_MGMT_TR_REWARD_BLOCK_CLASS}>
                                <span className={`${trLbl} whitespace-nowrap text-amber-100/95`}>확정보상</span>
                                {fixedRewardBox}
                            </div>
                        );
                        const soulRewardBlock = showSoulCandidates ? (
                            <div className={PET_MGMT_TR_REWARD_BLOCK_CLASS}>
                                <span className={`${trLbl} whitespace-nowrap text-center leading-tight text-cyan-100/95`}>
                                    {def.soulTable.length > 1 ? '확률(1종)' : '확률보상'}
                                </span>
                                {soulRewardBox}
                            </div>
                        ) : null;

                        return (
                            <div
                                key={`train-slot-${i}`}
                                className={`${trSlotCardClass} ${
                                    rowClaimReady
                                        ? isVipTrainingSlot
                                            ? 'border-lime-400/75 bg-gradient-to-br from-lime-950/40 via-amber-950/35 to-emerald-950/30 shadow-[0_0_26px_rgba(163,230,53,0.28),inset_0_1px_0_rgba(217,249,157,0.12)] ring-2 ring-lime-400/55 ring-offset-2 ring-offset-zinc-950'
                                            : 'border-lime-400/70 bg-gradient-to-br from-lime-950/35 via-violet-950/25 to-emerald-950/25 shadow-[0_0_24px_rgba(52,211,153,0.22),inset_0_1px_0_rgba(167,243,208,0.1)] ring-2 ring-lime-400/50 ring-offset-2 ring-offset-zinc-950'
                                        : isVipTrainingSlot
                                          ? unlocked
                                              ? 'border-amber-500/45 bg-gradient-to-br from-amber-950/30 via-zinc-950/50 to-amber-950/20 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-amber-500/15'
                                              : 'border-amber-800/35 bg-amber-950/12 ring-1 ring-amber-900/25'
                                          : unlocked
                                            ? 'border-violet-500/35 bg-violet-950/20'
                                            : 'border-white/10 bg-black/30'
                                }`}
                            >
                                <div className={trSlotCol}>
                                    <span
                                        className={`${trSlotTitle} flex w-full min-w-0 flex-row flex-wrap items-center justify-center gap-0.5 ${
                                            isVipTrainingSlot ? 'text-amber-100' : ''
                                        }`}
                                    >
                                        {isVipTrainingSlot ? (
                                            <span className={`shrink-0 rounded border border-amber-400/50 bg-amber-500/20 px-1 py-px font-black uppercase tracking-wider text-amber-200 ${PET_MGMT_CAPTION}`}>
                                                VIP
                                            </span>
                                        ) : null}
                                        <span className={`min-w-0 flex-1 text-center ${PET_MGMT_SEMI} leading-none`}>
                                            {getPairTrainingSlotDisplayName(i)}
                                        </span>
                                    </span>
                                    <div
                                        role={useTapTrainingFlow && unlocked && !session ? 'button' : undefined}
                                        tabIndex={useTapTrainingFlow && unlocked && !session ? 0 : undefined}
                                        onKeyDown={(e) => {
                                            if (!useTapTrainingFlow || !unlocked || session || isBusy) return;
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setTrainingMobilePickSlotIndex((cur) => (cur === i ? null : i));
                                            }
                                        }}
                                        onClick={() => {
                                            if (unlocked && session && canClaim && petRow && !isBusy) {
                                                void openPairTrainingClaimResultModal(i, petRow);
                                                return;
                                            }
                                            if (!useTapTrainingFlow || !unlocked || session || isBusy) return;
                                            setTrainingMobilePickSlotIndex((cur) => (cur === i ? null : i));
                                        }}
                                        className={`${trSlotDropClass} ${
                                            rowClaimReady
                                                ? 'border-lime-300/85 border-solid bg-gradient-to-b from-lime-500/15 via-emerald-950/40 to-zinc-950/80 shadow-[inset_0_0_18px_rgba(163,230,53,0.2),0_0_14px_rgba(52,211,153,0.25)]'
                                                : unlocked && !session
                                                  ? isVipTrainingSlot
                                                      ? 'border-amber-400/55 bg-amber-950/20'
                                                      : 'border-violet-400/50 bg-black/25'
                                                  : 'border-white/12 bg-black/20'
                                        } ${
                                            unlocked && session && canClaim && petRow
                                                ? `cursor-pointer outline-none transition ${
                                                      isVipTrainingSlot ? 'hover:border-lime-200/90' : 'hover:border-lime-300/85'
                                                  }`
                                                : ''
                                        } ${
                                            useTapTrainingFlow && unlocked && !session
                                                ? `cursor-pointer outline-none transition ${
                                                      isVipTrainingSlot ? 'hover:border-amber-300/75' : 'hover:border-violet-300/70'
                                                  } ${
                                                      trainingMobilePickSlotIndex === i
                                                          ? isVipTrainingSlot
                                                              ? 'ring-2 ring-amber-400/85 ring-offset-2 ring-offset-zinc-950'
                                                              : 'ring-2 ring-cyan-400/80 ring-offset-2 ring-offset-zinc-950'
                                                          : ''
                                                  }`
                                                : ''
                                        }`}
                                        onDragOver={(e) => {
                                            if (unlocked && !session && trainingStartConfirm == null) e.preventDefault();
                                        }}
                                        onDrop={(e) => {
                                            if (!unlocked || session || isBusy || trainingStartConfirm != null) return;
                                            onDropStart(i, e);
                                        }}
                                    >
                                        {!unlocked ? (
                                            <div className="flex max-h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5 text-center">
                                                <span className="text-lg leading-none opacity-90" aria-hidden>
                                                    🔒
                                                </span>
                                                {isVipTrainingSlot ? (
                                                    <p className={`text-center font-extrabold leading-tight text-amber-200/95 ${PET_MGMT_BOLD}`}>
                                                        기능VIP{' '}
                                                        <span className="tabular-nums">
                                                            ({unlockProgress.current}/{unlockProgress.required})
                                                        </span>
                                                    </p>
                                                ) : (
                                                    <p className={`text-center font-semibold leading-tight text-amber-200/95 ${PET_MGMT_SEMI}`}>
                                                        페어{' '}
                                                        <span className="tabular-nums">
                                                            ({unlockProgress.current}/{unlockProgress.required})
                                                        </span>
                                                        승
                                                    </p>
                                                )}
                                                {minLv > 1 ? (
                                                    <p className={`text-center leading-tight text-slate-500 ${PET_MGMT_CAPTION}`}>펫 Lv.{minLv}+</p>
                                                ) : (
                                                    <p className={`text-center leading-tight text-slate-500 ${PET_MGMT_CAPTION}`}>조건 없음</p>
                                                )}
                                            </div>
                                        ) : session && petRow ? (
                                            <div
                                                className={`relative flex h-full w-full items-center justify-center rounded ${
                                                    canClaim ? 'overflow-hidden' : 'overflow-visible'
                                                }`}
                                            >
                                                {canClaim ? (
                                                    <>
                                                        <img
                                                            src={petRow.image}
                                                            alt=""
                                                            className={trPetImgClass}
                                                            loading="lazy"
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            tabIndex={0}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isBusy) void openPairTrainingClaimResultModal(i, petRow);
                                                            }}
                                                            className="absolute inset-0 flex items-center justify-center rounded-md bg-gradient-to-b from-lime-600/88 via-emerald-800/82 to-zinc-950/90 px-0.5 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:from-lime-500/90 hover:via-emerald-700/85 focus-visible:ring-2 focus-visible:ring-lime-200/90 disabled:opacity-45"
                                                            aria-label="수련 보상 수령"
                                                        >
                                                            <span className={`text-center font-black leading-tight tracking-tight text-lime-50 [text-shadow:0_1px_2px_rgba(0,0,0,0.85),0_0_12px_rgba(190,242,100,0.55)] ${PET_MGMT_BOLD}`}>
                                                                수련완료
                                                            </span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-visible rounded">
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            tabIndex={0}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isBusy) handlers.openPairPetDetailModal(petRow, 'view');
                                                            }}
                                                            className="relative z-[1] flex min-h-0 flex-1 w-full items-center justify-center rounded outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-45"
                                                            aria-label="펫 상세 정보"
                                                        >
                                                            <img
                                                                src={petRow.image}
                                                                alt=""
                                                                className={trPetImgClass}
                                                                loading="lazy"
                                                            />
                                                        </button>
                                                        <div
                                                            className="pointer-events-none absolute bottom-[-6px] left-1/2 z-[4] flex max-w-[calc(100%-4px)] -translate-x-1/2 justify-center sm:bottom-[-7px]"
                                                            aria-label={`남은 시간 ${formatRemainHMS(remainMs)}`}
                                                        >
                                                            <div
                                                                className={`w-max rounded-md border border-white/18 px-1.5 py-px text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-[4px] ${
                                                                    isVipTrainingSlot
                                                                        ? 'bg-amber-950/82 text-amber-50'
                                                                        : 'bg-zinc-950/82 text-violet-50'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`${trMono} inline-block font-black tabular-nums tracking-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.92),0_0_6px_rgba(0,0,0,0.55)]`}
                                                                >
                                                                    {formatRemainHMS(remainMs)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : unlocked ? (
                                            <span
                                                className={`px-1 text-center font-semibold leading-tight ${PET_MGMT_SEMI} ${
                                                    isVipTrainingSlot ? 'text-amber-200/95' : 'text-violet-200/90'
                                                }`}
                                            >
                                                {useTapTrainingFlow
                                                    ? trainingMobilePickSlotIndex === i
                                                        ? '펫 선택'
                                                        : '터치'
                                                    : '펫 끌어넣기'}
                                            </span>
                                        ) : null}
                                    </div>
                                    {unlocked && session && petRow && !canClaim ? (
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isBusy) setTrainingCancelConfirmSlotIndex(i);
                                            }}
                                            className={`w-full shrink-0 rounded border px-1 py-1 font-bold leading-tight transition ${PET_MGMT_BOLD} ${
                                                isVipTrainingSlot
                                                    ? 'border-rose-400/45 bg-rose-950/35 text-rose-100 hover:border-rose-300/60'
                                                    : 'border-rose-500/40 bg-rose-950/25 text-rose-200/95 hover:border-rose-400/55'
                                            } disabled:opacity-45`}
                                        >
                                            수련 취소
                                        </button>
                                    ) : unlocked && session && petRow && canClaim ? null : (
                                        <span
                                            className={`${trMono} text-center tracking-tight ${
                                                isVipTrainingSlot ? 'text-amber-200/90' : 'text-violet-200/90'
                                            }`}
                                            aria-label={`수련 소요 ${durationHhMmSs}`}
                                        >
                                            {durationHhMmSs}
                                        </span>
                                    )}
                                </div>
                                {fixedRewardBlock}
                                {soulRewardBlock}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    })();

    const trainingSlotsForUi = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
    const selectedPetInTraining = Boolean(
        selectedItem && isPairPetMaterial(selectedItem) && isItemIdInPairTraining(trainingSlotsForUi, selectedItem.id),
    );

    const infoDetailPanelBody = !selectedItem ? (
        <div
            className={`flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-2 py-3 ${PET_MGMT_SEMI} text-slate-400`}
        >
            아래 인벤에서 펫 또는 영혼석을 선택하세요
        </div>
    ) : isPairPetMaterial(selectedItem) && selectedItem.templateId ? (
        <PairPetLobbyInfoPetViewer
            currentUser={currentUser}
            item={selectedItem}
            isBusy={isBusy}
            equippedTemplateId={equippedTid}
            petInTraining={selectedPetInTraining}
            onSetRepresentative={(templateId, inventoryItemId) => void equipPet(templateId, inventoryItemId)}
            onClearRepresentative={() => void clearEquip()}
            onSoulConvert={(item) => setSoulConvertItem(item)}
            applyPetAction={applyPetAction}
        />
    ) : isPairSoulStoneItem(selectedItem) ? (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <PairPetLobbySoulStoneViewer
                item={selectedItem}
                isBusy={isBusy}
                totalSoulQuantity={selectedItem.quantity ?? 0}
                onSellOne={() => {
                    const tid = selectedItem.templateId;
                    if (!tid) return;
                    const row =
                        (selectedSoulPrimaryStackId
                            ? inventory.find((i) => i.id === selectedSoulPrimaryStackId)
                            : null) ??
                        inventory.find((i) => i.templateId === tid && isPairSoulStoneItem(i));
                    if (row) setSoulStoneSellConfirm({ stackItem: row, quantity: 1 });
                }}
                onOpenBulkSell={() => {
                    if (!selectedItem || !isPairSoulStoneItem(selectedItem)) return;
                    setSoulStoneSellBulkItem(selectedItem);
                }}
            />
        </div>
    ) : (
        <div
            className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1.5 sm:p-2 ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS}`}
        >
            <p className="text-xs text-slate-400 sm:text-sm">이 카테고리에서 지원하지 않는 아이템입니다.</p>
        </div>
    );

    const infoDetailPanelMobile = aiTab === 'info' ? infoDetailPanelBody : null;

    const renderShopSkuSection = (title: string, skus: PairPetShopSku[]) => (
        <section className={PET_MGMT_SHOP_SECTION_CLASS}>
            <h3 className={PET_MGMT_SHOP_SECTION_TITLE}>{title}</h3>
            <div className={PET_MGMT_SHOP_GRID_DESKTOP_CLASS}>
                {skus.map((sku) => (
                    <PairPetShopSkuCard
                        key={sku.id}
                        sku={sku}
                        currentUser={currentUser}
                        isBusy={isBusy}
                        mobile={false}
                        onBuyClick={onPairPetShopBuyClick}
                        descOpen={shopDescSkuId === sku.id}
                        onOpenDesc={() => setShopDescSkuId(sku.id)}
                        onCloseDesc={() => setShopDescSkuId((cur) => (cur === sku.id ? null : cur))}
                    />
                ))}
            </div>
        </section>
    );

    const shopTabContent = (
        <>
            {renderShopSkuSection('알', shopEggSkus)}
            {renderShopSkuSection('영혼석', shopSoulSkus)}
        </>
    );

    const invDockClass = petMgmtMobileShell ? PET_MGMT_INV_DOCK_MOBILE_CLASS : PET_MGMT_INV_DOCK_DESKTOP_CLASS;
    const invGridClass = petMgmtMobileShell ? PET_MGMT_INV_GRID_MOBILE_CLASS : PET_MGMT_INV_GRID_DESKTOP_CLASS;
    const soulGridClass = petMgmtMobileShell ? PET_MGMT_SOUL_GRID_MOBILE_CLASS : PET_MGMT_SOUL_GRID_DESKTOP_CLASS;
    const soulThumbDisabled = isBusy || (petMgmtMobileShell && aiTab !== 'info');
    const soulThumbSelected = petMgmtMobileShell
        ? aiTab === 'info' && selectedLobbyItemId !== null
        : selectedLobbyItemId !== null;

    const invDockPanel = (
        <div className={petMgmtMobileShell ? `${invDockClass} !h-[11rem]` : invDockClass}>
            <div className={PET_MGMT_INV_HEADER_CLASS}>
                <div className="grid shrink-0 grid-cols-2 gap-0.5 rounded border border-white/10 bg-black/40 p-0.5">
                    {(
                        [
                            { id: 'pet' as const, label: '펫' },
                            { id: 'soul' as const, label: '영혼석' },
                        ] as const
                    ).map(({ id, label }) => {
                        const soulLocked = id === 'soul' && aiTab === 'training';
                        const tabDisabled = soulLocked;
                        return (
                            <button
                                key={id}
                                type="button"
                                disabled={tabDisabled}
                                onClick={() => {
                                    if (tabDisabled) return;
                                    setInvFilter(id);
                                    setExpandTarget(null);
                                }}
                                title={soulLocked ? '수련에서는 펫 인벤만 사용합니다.' : undefined}
                                className={`${PET_MGMT_TAB_BTN_BASE} px-1 py-0.5 ${
                                    invStripTabHighlight === id
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                                } ${soulLocked ? 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-300' : ''}`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
                <label className={`flex shrink-0 items-center gap-0.5 ${PET_MGMT_SEMI} text-slate-400`}>
                    <span className="sr-only">정렬</span>
                    <select
                        value={invSort}
                        onChange={(e) => {
                            const next = normalizePairPetLobbyInventorySort(e.target.value);
                            if (!next) return;
                            setInvSort(next);
                            void applyPetAction({
                                type: 'UPDATE_PAIR_PET_LOBBY_INVENTORY_SORT',
                                payload: { sortMode: next },
                            });
                        }}
                        disabled={isBusy || effectiveInvFilter === 'soul'}
                        className={`max-w-[7.5rem] rounded border border-white/15 bg-black/50 py-px pl-1 pr-4 ${PET_MGMT_BOLD} text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-45 ${
                            effectiveInvFilter === 'pet' ? 'cursor-pointer' : ''
                        }`}
                    >
                        <option value="recent">최근 획득순</option>
                        <option value="oldest">오래된순</option>
                        <option value="name">이름순</option>
                        <option value="petLevel">펫 레벨순</option>
                        <option value="gradeHigh">높은 등급순</option>
                        <option value="petNumber">종류순</option>
                    </select>
                </label>
                <div
                    className="ml-auto min-w-[6ch] shrink-0 tabular-nums text-right"
                    title={
                        effectiveInvFilter === 'pet' && hiddenInvCount > 0
                            ? `슬롯 밖 ${hiddenInvCount}개`
                            : undefined
                    }
                >
                    <div
                        className={`${PET_MGMT_XBOLD} tracking-tight text-slate-100 ${
                            effectiveInvFilter === 'soul' ? 'invisible' : ''
                        }`}
                    >
                        {pairPetMaterialCount} / {slotCountPet}
                    </div>
                </div>
            </div>
            <div
                className={`${PET_MGMT_INV_GRID_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS}`}
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {effectiveInvFilter === 'soul' ? (
                    <div className={soulGridClass}>
                        {PAIR_SOULSTONE_TEMPLATE_IDS.map((tid, idx) => {
                            const name = PAIR_SOULSTONE_NAMES[idx]!;
                            const meta = MATERIAL_ITEMS[name as keyof typeof MATERIAL_ITEMS];
                            const img = meta?.image ?? `/images/pets/soulstone${idx + 1}.webp`;
                            const soulGrade = meta?.grade ?? ItemGrade.Normal;
                            const qty = soulQtyByTemplateId.get(tid) ?? 0;
                            const slotKey = `${SOUL_SLOT_PREFIX}${tid}`;
                            return (
                                <SoulStoneFixedThumb
                                    key={tid}
                                    imageUrl={img}
                                    qty={qty}
                                    grade={soulGrade}
                                    selected={soulThumbSelected && selectedLobbyItemId === slotKey}
                                    disabled={soulThumbDisabled}
                                    onClick={() => setSelectedLobbyItemId(slotKey)}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className={invGridClass}>
                        {Array.from({ length: Math.max(slotCount, sortedFilteredInv.length) }, (_, i) =>
                            renderLobbyGridSlot(sortedFilteredInv[i], i)
                        )}
                        {canExpandSlots ? (
                            <button
                                type="button"
                                key="pair-pet-inv-expand"
                                disabled={isBusy}
                                onClick={() => {
                                    if (effectiveInvFilter === 'pet') setExpandTarget('pet');
                                }}
                                title="슬롯 확장"
                                className="flex aspect-square w-full min-w-0 items-center justify-center rounded-lg border-2 border-gray-700/50 bg-gray-800/50 text-4xl font-light leading-none text-gray-400 transition hover:border-accent hover:bg-gray-700/50 hover:text-gray-200 active:bg-gray-600/50 disabled:opacity-40"
                            >
                                +
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );

    const tabContent = (
        <>
            {aiTab === 'shop' && (
                <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
                    <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
                        {(
                            [
                                { id: 'egg' as const, label: '알' },
                                { id: 'soul' as const, label: '영혼석' },
                            ] as const
                        ).map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => {
                                    setShopSkuTab(id);
                                    setShopDescSkuId(null);
                                }}
                                className={`${PET_MGMT_SHOP_SUBTAB_BTN} ${
                                    shopSkuTab === id
                                        ? 'bg-amber-500 text-amber-950 shadow-sm shadow-amber-900/40'
                                        : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className={`${PET_MGMT_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1`}>
                        <div className={PET_MGMT_SHOP_GRID_CLASS}>
                        {shopSkusVisible.map((sku) => (
                            <PairPetShopSkuCard
                                key={sku.id}
                                sku={sku}
                                currentUser={currentUser}
                                isBusy={isBusy}
                                mobile={petMgmtMobileShell}
                                onBuyClick={onPairPetShopBuyClick}
                                descOpen={shopDescSkuId === sku.id}
                                onOpenDesc={() => setShopDescSkuId(sku.id)}
                                onCloseDesc={() => setShopDescSkuId((cur) => (cur === sku.id ? null : cur))}
                            />
                        ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <div className={PET_MGMT_ROOT_CLASS}>
            {petMgmtMobileShell ? (
                <>
                    <div className="flex shrink-0 flex-col gap-0.5">
                        <PairPetProfilePanel
                            currentUser={currentUser}
                            currentUserId={currentUserId}
                            isBusy={isBusy}
                            compact
                            petManagementModal
                            detailButtonLabel="상세보기"
                            hideInlineBadukChip
                            showRepresentativeBadge={Boolean(equippedPetRow)}
                            onOpenEquippedPetDetail={openEquippedPetDetail}
                            onFocusPetInventory={focusInfoPetInventory}
                        />
                    </div>

                    <div className="grid shrink-0 grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
                        <button
                            type="button"
                            onClick={() => setAiTab('info')}
                            className={`${PET_MGMT_TAB_BTN_BASE} ${aiTab === 'info' ? 'bg-sky-500 text-sky-950' : 'text-sky-100 hover:bg-sky-950/45'}`}
                        >
                            정보
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiTab('training')}
                            title={pairTrainingHasClaimReady ? '수련 보상을 수령할 수 있습니다' : undefined}
                            className={`relative ${PET_MGMT_TAB_BTN_BASE} ${aiTab === 'training' ? 'bg-violet-500 text-violet-950' : 'text-violet-100 hover:bg-violet-950/45'}`}
                        >
                            수련
                            {pairTrainingHasClaimReady ? (
                                <span
                                    className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-zinc-900/90"
                                    aria-hidden
                                />
                            ) : null}
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiTab('hatchery')}
                            title={pairHatcheryHasClaimReady ? '부화가 완료된 슬롯이 있습니다' : undefined}
                            className={`relative ${PET_MGMT_TAB_BTN_BASE} ${aiTab === 'hatchery' ? 'bg-fuchsia-600 text-fuchsia-50' : 'text-fuchsia-100 hover:bg-fuchsia-950/45'}`}
                        >
                            부화장
                            {pairHatcheryHasClaimReady ? (
                                <span
                                    className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-zinc-900/90"
                                    aria-hidden
                                />
                            ) : null}
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiTab('shop')}
                            className={`${PET_MGMT_TAB_BTN_BASE} ${aiTab === 'shop' ? 'bg-amber-500 text-amber-950' : 'text-amber-100 hover:bg-amber-950/45'}`}
                        >
                            펫 상점
                        </button>
                    </div>

                    <div className={PET_MGMT_MAIN_COLUMN_CLASS}>
                        {showInvStrip ? (
                            <>
                                <div className={PET_MGMT_VIEWER_FRAME_CLASS}>
                                    <div
                                        className={`flex h-full min-h-0 w-full flex-1 flex-col rounded-lg border border-white/10 bg-black/25 ${PET_MGMT_TAB_PANEL_CLASS}`}
                                    >
                                        {aiTab === 'info' ? (
                                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                                {infoDetailPanelMobile}
                                            </div>
                                        ) : null}
                                        {aiTab === 'training' ? (
                                            <div
                                                className={`${PET_MGMT_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1 px-0.5`}
                                            >
                                                {trainingTabContent}
                                            </div>
                                        ) : null}
                                        {aiTab === 'hatchery' ? (
                                            <div
                                                className={`${PET_MGMT_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1 px-0.5`}
                                            >
                                                {hatcheryTabContent}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                {aiTab !== 'hatchery' ? invDockPanel : null}
                            </>
                        ) : (
                            <div className={PET_MGMT_VIEWER_FRAME_CLASS}>
                                <div
                                    className={`flex h-full min-h-0 w-full flex-1 flex-col rounded-lg border border-white/10 bg-black/25 ${PET_MGMT_TAB_PANEL_CLASS}`}
                                >
                                    {aiTab === 'shop' ? (
                                        <div
                                            className={`${PET_MGMT_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1`}
                                        >
                                            {tabContent}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className={PET_MGMT_MAIN_COLUMN_CLASS}>
                    <div className={PET_MGMT_TOP_SPLIT_CLASS}>
                        <div className={PET_MGMT_INFO_COLUMN_CLASS}>
                            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                <div className="shrink-0 border-b border-white/10 bg-black/25 px-2 py-1.5">
                                    <PairPetProfilePanel
                                        currentUser={currentUser}
                                        currentUserId={currentUserId}
                                        isBusy={isBusy}
                                        compact
                                        embed
                                        petManagementModal
                                        detailButtonLabel="상세보기"
                                        hideInlineBadukChip
                                        showRepresentativeBadge={Boolean(equippedPetRow)}
                                        onOpenEquippedPetDetail={openEquippedPetDetail}
                                        onFocusPetInventory={focusInfoPetInventory}
                                    />
                                </div>
                                <div
                                    className={`${PET_MGMT_INFO_SCROLL_CLASS} ${PET_MGMT_TAB_PANEL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1`}
                                >
                                    {infoDetailPanelBody}
                                </div>
                            </div>
                        </div>

                        <div className={PET_MGMT_RIGHT_COLUMN_CLASS}>
                            <div className={PET_MGMT_MAIN_TAB_BAR}>
                                <button
                                    type="button"
                                    onClick={() => setAiTab('training')}
                                    title={pairTrainingHasClaimReady ? '수련 보상을 수령할 수 있습니다' : undefined}
                                    className={`relative ${petMgmtMainTabClass(aiTab === 'training', 'training')}`}
                                >
                                    수련
                                    {pairTrainingHasClaimReady ? (
                                        <span
                                            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-zinc-900/90"
                                            aria-hidden
                                        />
                                    ) : null}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAiTab('hatchery')}
                                    title={pairHatcheryHasClaimReady ? '부화가 완료된 슬롯이 있습니다' : undefined}
                                    className={`relative ${petMgmtMainTabClass(aiTab === 'hatchery', 'hatchery')}`}
                                >
                                    부화장
                                    {pairHatcheryHasClaimReady ? (
                                        <span
                                            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-zinc-900/90"
                                            aria-hidden
                                        />
                                    ) : null}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAiTab('shop')}
                                    className={petMgmtMainTabClass(aiTab === 'shop', 'shop')}
                                >
                                    펫 상점
                                </button>
                            </div>

                            <div className={PET_MGMT_VIEWER_FRAME_CLASS}>
                                <div
                                    className={`flex h-full min-h-0 w-full flex-1 flex-col rounded-lg border border-white/10 bg-black/25 ${PET_MGMT_TAB_PANEL_CLASS}`}
                                >
                                    {aiTab === 'training' ? (
                                        <div
                                            className={`${PET_MGMT_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1 px-0.5`}
                                        >
                                            {trainingTabContent}
                                        </div>
                                    ) : null}
                                    {aiTab === 'hatchery' ? (
                                        <div
                                            className={`${PET_MGMT_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1 px-0.5`}
                                        >
                                            {hatcheryTabContent}
                                        </div>
                                    ) : null}
                                    {aiTab === 'shop' ? (
                                        <div
                                            className={`${PET_MGMT_SHOP_SCROLL_CLASS} ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} min-h-0 flex-1 px-0.5`}
                                        >
                                            {shopTabContent}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    {invDockPanel}
                </div>
            )}

            {expandTarget ? (
                <DraggableWindow
                    title={`${expandLabel} 인벤 확장`}
                    onClose={() => setExpandTarget(null)}
                    windowId="pairPetLobbyExpandSlots"
                    isTopmost
                    variant="store"
                    initialWidth={400}
                    shrinkHeightToContent
                    bodyNoScroll
                    bodyPaddingClassName="p-0"
                >
                    <InventorySlotExpandDiamondBody
                        eyebrow="Pair lobby"
                        question={`${expandLabel} 인벤을 확장하시겠습니까?`}
                        currentSlots={modalSlotCount}
                        nextSlots={nextSlotCountAfterExpand}
                        slotsHint={`+${PAIR_PET_LOBBY_INV_EXPAND_STEP}칸 추가 (최대 ${PAIR_PET_LOBBY_INV_MAX_SLOTS}칸)`}
                        diamondCost={expansionDiamondCost}
                        hasEnoughDiamonds={hasEnoughDiamondsExpand}
                        onCancel={() => setExpandTarget(null)}
                        onConfirm={() => void confirmExpandLobbySlots()}
                        confirmDisabled={isBusy}
                    />
                </DraggableWindow>
            ) : null}

            {soulConvertItem ? (
                <PairPetSoulConvertModal
                    isOpen
                    item={soulConvertItem}
                    isBusy={false}
                    onClose={() => setSoulConvertItem(null)}
                    onConfirm={() => confirmSoulConvert()}
                    isTopmost
                />
            ) : null}

            {soulStoneSellConfirm ? (
                <SellItemConfirmModal
                    item={soulStoneSellConfirm.stackItem}
                    materialSellQuantity={soulStoneSellConfirm.quantity}
                    windowId="pairLobbySoulStoneSellConfirm"
                    onClose={() => setSoulStoneSellConfirm(null)}
                    onConfirm={() => {
                        const pending = soulStoneSellConfirm;
                        setSoulStoneSellConfirm(null);
                        if (pending) void sellItem(pending.stackItem.id, pending.quantity);
                    }}
                    isTopmost
                />
            ) : null}

            {soulStoneSellBulkItem ? (
                <SellMaterialBulkModal
                    item={soulStoneSellBulkItem}
                    currentUser={currentUser as UserWithStatus}
                    onClose={() => setSoulStoneSellBulkItem(null)}
                    onConfirm={async (quantity) => {
                        const anchor = soulStoneSellBulkItem;
                        if (!anchor) return;
                        const itemsToSell = (currentUser.inventory || [])
                            .filter((i) => i.type === anchor.type && i.name === anchor.name)
                            .sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
                        let remaining = quantity;
                        for (const it of itemsToSell) {
                            if (remaining <= 0) break;
                            const sellQty = Math.min(remaining, it.quantity || 1);
                            await sellItem(it.id, sellQty);
                            remaining -= sellQty;
                        }
                        setSoulStoneSellBulkItem(null);
                    }}
                    isTopmost
                />
            ) : null}

            {trainingStartConfirm ? (
                <DraggableWindow
                    title="펫 수련 확인"
                    onClose={() => {
                        if (!isBusy) setTrainingStartConfirm(null);
                    }}
                    windowId="pairPetTrainingStartConfirm"
                    isTopmost
                    variant="store"
                    initialWidth={520}
                    shrinkHeightToContent
                    bodyNoScroll
                    bodyPaddingClassName="p-0"
                >
                    {(() => {
                        const { slotIndex, itemId } = trainingStartConfirm;
                        const petRow = inventory.find((x) => x.id === itemId);
                        const slotLabel = getPairTrainingSlotDisplayName(slotIndex);
                        const petName = petRow
                            ? getPairPetDefinition(petRow.templateId!)?.displayName ?? petRow.name
                            : '펫';
                        const repPet = getEquippedPairPetInventoryRow(currentUser);
                        return (
                            <div className="relative overflow-hidden">
                                <div
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-18%,rgba(139,92,246,0.32),transparent_55%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)48%,rgba(59,7,100,0.32)100%)]"
                                    aria-hidden
                                />
                                <div className="relative px-3 pb-4 pt-4 text-center sm:px-5 sm:pb-6 sm:pt-6">
                                    <h3 className="text-sm font-bold leading-snug text-violet-50 sm:text-lg sm:font-black">
                                        <span className="text-white">{petName}</span> 펫을
                                        <br />
                                        <span className="text-violet-200">{slotLabel}</span>에 보낼까요?
                                    </h3>
                                    {petRow ? (
                                        <div
                                            className={`mx-auto mt-4 w-full max-w-[min(100%,30rem)] text-left ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS} max-h-[min(52vh,480px)] overflow-y-auto overflow-x-hidden px-0.5 sm:px-1`}
                                        >
                                            <PairPetDetailCardBody
                                                currentUser={currentUser}
                                                item={petRow}
                                                statsGridVariant="panelFit"
                                                petManagementModal
                                                showRepresentativeBadge={repPet?.id === petRow.id}
                                            />
                                        </div>
                                    ) : null}
                                    <p className="mx-auto mt-3 max-w-sm text-left text-[0.65rem] font-medium leading-relaxed text-slate-400 sm:mt-4 sm:text-xs sm:font-semibold sm:text-slate-300">
                                        수련이 진행되는 동안 이 펫은 페어바둑에 출전할 수 없습니다. 대표 펫으로 지정된 펫은 수련에 보낼 수 없으며, 수련 중에는
                                        대표 펫으로 바꿀 수 없습니다.
                                    </p>
                                    <div className="mx-auto mt-4 flex max-w-sm flex-row items-stretch justify-center gap-2 sm:mt-5 sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setTrainingStartConfirm(null)}
                                            disabled={isBusy}
                                            className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-45 sm:min-w-[8rem] sm:flex-none sm:px-5 sm:py-2.5 sm:text-sm"
                                        >
                                            취소
                                        </button>
                                        <Button
                                            type="button"
                                            disabled={isBusy || !petRow}
                                            onClick={async () => {
                                                if (!petRow) return;
                                                const res = await applyPetAction({
                                                    type: 'PAIR_PET_START_TRAINING',
                                                    payload: { slotIndex, itemId },
                                                });
                                                if (res && (res as { error?: string }).error) return;
                                                setTrainingStartConfirm(null);
                                            }}
                                            colorScheme="none"
                                            className="min-w-0 flex-1 !rounded-full !border !border-violet-400/50 !bg-gradient-to-r !from-violet-600 !via-violet-500 !to-fuchsia-600 !px-3 !py-2 !text-xs !font-bold !text-white !shadow-[0_6px_20px_rgba(124,58,237,0.35),inset_0_1px_0_rgba(255,255,255,0.16)] hover:!from-violet-500 hover:!via-violet-400 hover:!to-fuchsia-500 disabled:!opacity-40 sm:!min-w-[8rem] sm:!flex-none sm:!px-6 sm:!py-2.5 sm:!text-sm sm:!font-black sm:!shadow-[0_8px_26px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.18)]"
                                        >
                                            수련 보내기
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DraggableWindow>
            ) : null}

            {trainingCancelConfirmSlotIndex !== null ? (
                <DraggableWindow
                    title="수련 취소"
                    onClose={() => {
                        if (!isBusy) setTrainingCancelConfirmSlotIndex(null);
                    }}
                    windowId="pairPetTrainingCancelConfirm"
                    isTopmost
                    variant="store"
                    initialWidth={420}
                    shrinkHeightToContent
                    bodyNoScroll
                    bodyPaddingClassName="p-0"
                >
                    <div className="relative overflow-hidden">
                        <div
                            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-18%,rgba(244,63,94,0.22),transparent_55%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)48%,rgba(59,7,20,0.28)100%)]"
                            aria-hidden
                        />
                        <div className="relative px-3 pb-4 pt-5 text-center sm:px-6 sm:pb-6 sm:pt-7">
                            <p className="mx-auto max-w-sm text-[0.7rem] font-medium leading-relaxed text-slate-300 sm:text-sm sm:font-semibold sm:text-slate-200">
                                수련을 취소하면{' '}
                                <span className="font-bold text-rose-200 sm:font-black">진행 중인 시간이 초기화</span>되고 슬롯이 비워집니다.
                                펫은 가방에 그대로 남습니다.
                            </p>
                            <p className="mx-auto mt-1.5 max-w-sm text-[0.6rem] leading-relaxed text-slate-500 sm:mt-2 sm:text-xs">
                                슬롯:{' '}
                                <span className="font-bold text-violet-200/95">
                                    {getPairTrainingSlotDisplayName(trainingCancelConfirmSlotIndex)}
                                </span>
                            </p>
                            <div className="mx-auto mt-4 flex max-w-sm flex-row items-stretch justify-center gap-2 sm:mt-5 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTrainingCancelConfirmSlotIndex(null)}
                                    disabled={isBusy}
                                    className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-45 sm:min-w-[8rem] sm:flex-none sm:px-5 sm:py-2.5 sm:text-sm"
                                >
                                    유지
                                </button>
                                <Button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void confirmPairTrainingCancel()}
                                    colorScheme="none"
                                    className="min-w-0 flex-1 !rounded-full !border !border-rose-400/50 !bg-gradient-to-r !from-rose-600 !via-rose-500 !to-orange-600 !px-3 !py-2 !text-xs !font-bold !text-white !shadow-[0_6px_20px_rgba(225,29,72,0.3),inset_0_1px_0_rgba(255,255,255,0.16)] hover:!from-rose-500 hover:!via-rose-400 hover:!to-orange-500 disabled:!opacity-40 sm:!min-w-[8rem] sm:!flex-none sm:!px-6 sm:!py-2.5 sm:!text-sm sm:!font-black sm:!shadow-[0_8px_26px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]"
                                >
                                    취소
                                </Button>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            ) : null}

            {trainingRewardModal ? (
                <PairTrainingRewardModal
                    key={`ptr-${trainingRewardModal.slotIndex}-${trainingRewardModal.petItem.id}`}
                    slotIndex={trainingRewardModal.slotIndex}
                    slotLabel={getPairTrainingSlotDisplayName(trainingRewardModal.slotIndex)}
                    petItem={trainingRewardModal.petItem}
                    claimSummary={trainingRewardModal.claimSummary}
                    autoClaimOnMount={trainingRewardModal.claimViaServer}
                    persistClaimOnMount={!trainingRewardModal.claimViaServer}
                    commitClaimWithoutBusy={handlers.handleAction}
                    onClose={() => setTrainingRewardModal(null)}
                    applyPetAction={applyPetAction}
                    isBusy={isBusy}
                />
            ) : null}

            {hatcheryPetInvFullModalOpen ? (
                <DraggableWindow
                    title="경고"
                    onClose={() => setHatcheryPetInvFullModalOpen(false)}
                    windowId="pairPetHatcheryPetInvFull"
                    isTopmost
                    variant="store"
                    initialWidth={400}
                    shrinkHeightToContent
                    bodyNoScroll
                    bodyPaddingClassName="p-0"
                >
                    <div className="relative overflow-hidden">
                        <div
                            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-15%,rgba(251,113,133,0.22),transparent_55%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)50%,rgba(76,5,25,0.28)100%)]"
                            aria-hidden
                        />
                        <div className="relative px-6 pb-6 pt-7 text-center">
                            <p className="text-lg font-bold leading-snug text-rose-100/95 sm:text-xl">
                                {PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE}
                            </p>
                            <p className="mt-3 text-sm font-medium leading-relaxed text-rose-200/85 sm:text-base">
                                인벤토리에 빈 칸을 확보하세요
                            </p>
                            <Button
                                type="button"
                                colorScheme="none"
                                className="mt-6 !w-full !rounded-xl !border !border-rose-400/45 !bg-gradient-to-b !from-rose-600/90 !to-rose-950/95 !py-2.5 !text-sm !font-black !text-rose-50 hover:!from-rose-500 hover:!to-rose-900"
                                onClick={() => setHatcheryPetInvFullModalOpen(false)}
                            >
                                확인
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            ) : null}

            {hatcheryConfirmSlotIndex !== null ? (
                <DraggableWindow
                    title="부화 시작"
                    onClose={() => {
                        if (!isBusy) setHatcheryConfirmSlotIndex(null);
                    }}
                    windowId="pairPetHatcheryStartConfirm"
                    isTopmost
                    variant="store"
                    initialWidth={420}
                    shrinkHeightToContent
                    bodyNoScroll
                    bodyPaddingClassName="p-0"
                >
                    {(() => {
                        const idx = hatcheryConfirmSlotIndex;
                        const d = idx !== null ? getPairHatcherySlotDef(idx) : undefined;
                        const startEgg = findFirstHatchablePairEgg(currentUser.inventory);
                        const startWelcome = Boolean(startEgg && isPairWelcomeEggItem(startEgg));
                        const outcome =
                            startWelcome ? (
                                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/25 px-3 py-2 text-xs font-semibold text-amber-100/95">
                                    <span className="tabular-nums">부화 펫 레벨 : 5</span>
                                </div>
                            ) : d ? (
                                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/25 px-3 py-2 text-xs font-semibold text-amber-100/95">
                                    {hatcheryLevelOutcomeLine(d)}
                                </div>
                            ) : null;
                        const eggImg =
                            MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ?? PAIR_EGG_DISPLAY_IMAGE;
                        const confirmDurMs =
                            startWelcome && d ? 60_000 : d ? d.durationMs : 0;
                        const eggTitle = startWelcome ? `${PAIR_WELCOME_EGG_MATERIAL_NAME} ×1` : '신비로운알 ×1';
                        return (
                            <div className="relative overflow-hidden">
                                <div
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(217,70,239,0.35),transparent_55%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)45%,rgba(59,7,100,0.35)100%)]"
                                    aria-hidden
                                />
                                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" aria-hidden />
                                <div className="relative px-6 pb-6 pt-8 text-center">
                                    <div className="mx-auto mb-5 flex max-w-[14rem] flex-col items-center">
                                        <div className="relative mb-4">
                                            <div
                                                className="absolute -inset-3 rounded-full bg-gradient-to-b from-fuchsia-500/40 via-violet-600/20 to-transparent blur-xl"
                                                aria-hidden
                                            />
                                            <div
                                                className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-fuchsia-400/30 to-violet-600/20 opacity-80"
                                                aria-hidden
                                            />
                                            <img
                                                src={eggImg}
                                                alt=""
                                                className="relative h-[5.5rem] w-[5.5rem] rounded-2xl object-contain p-1 ring-2 ring-fuchsia-300/40 ring-offset-2 ring-offset-zinc-950 drop-shadow-[0_12px_28px_rgba(192,38,211,0.45)]"
                                                loading="lazy"
                                            />
                                        </div>
                                        <h3 className="bg-gradient-to-r from-fuchsia-100 via-white to-violet-200 bg-clip-text text-lg font-black tracking-tight text-transparent sm:text-xl">
                                            {eggTitle}
                                        </h3>
                                        {confirmDurMs > 0 ? (
                                            <p className="mt-3 font-mono text-sm font-semibold tabular-nums tracking-tight text-fuchsia-200/95">
                                                부화 시간 : {formatHatcheryDurationHMS(confirmDurMs)}
                                            </p>
                                        ) : null}
                                        {outcome}
                                    </div>
                                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setHatcheryConfirmSlotIndex(null)}
                                            disabled={isBusy}
                                            className="order-2 w-full min-w-[8.5rem] rounded-full border border-white/15 bg-white/[0.04] px-6 py-2.5 text-sm font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-45 sm:order-1 sm:w-auto"
                                        >
                                            취소
                                        </button>
                                        <Button
                                            type="button"
                                            disabled={isBusy || eggCount < 1}
                                            onClick={async () => {
                                                if (hatcheryConfirmSlotIndex === null) return;
                                                const res = await applyPetAction({
                                                    type: 'PAIR_PET_HATCHERY_START',
                                                    payload: { slotIndex: hatcheryConfirmSlotIndex },
                                                });
                                                const startErr = res && (res as { error?: string }).error;
                                                if (startErr) {
                                                    return;
                                                }
                                                setHatcheryConfirmSlotIndex(null);
                                            }}
                                            colorScheme="none"
                                            className="order-1 w-full min-w-[8.5rem] !rounded-full !border !border-fuchsia-300/50 !bg-gradient-to-r !from-fuchsia-600 !via-fuchsia-500 !to-violet-600 !px-8 !py-2.5 !text-sm !font-black !tracking-wide !text-white !shadow-[0_8px_28px_rgba(147,51,234,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] hover:!from-fuchsia-500 hover:!via-fuchsia-400 hover:!to-violet-500 disabled:!opacity-40 sm:order-2 sm:w-auto"
                                        >
                                            시작
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DraggableWindow>
            ) : null}

            {hatcheryInstantConfirmSlotIndex !== null ? (
                <DraggableWindow
                    title="다이아 사용 확인"
                    onClose={() => {
                        if (!isBusy) setHatcheryInstantConfirmSlotIndex(null);
                    }}
                    windowId="pairPetHatcheryInstantConfirm"
                    isTopmost
                    variant="store"
                    initialWidth={440}
                    shrinkHeightToContent
                    bodyNoScroll
                    bodyPaddingClassName="p-0"
                >
                    {(() => {
                        void hatcheryTick;
                        const si = hatcheryInstantConfirmSlotIndex;
                        const sessionsM = normalizePairPetHatcherySessions(currentUser.pairPetHatcherySessions);
                        const sessionM = si !== null ? sessionsM[si] : null;
                        const nowM = Date.now();
                        const endM =
                            sessionM && si !== null ? hatcheryEndsAt(sessionM.startedAt, si, sessionM) : 0;
                        const canClaimM = Boolean(sessionM && nowM >= endM);
                        const remainMsM = sessionM && !canClaimM ? Math.max(0, endM - nowM) : 0;
                        const costM =
                            sessionM && !canClaimM && remainMsM > 0 ? Math.max(1, Math.ceil(remainMsM / 60_000)) : 0;
                        const hasEnoughM =
                            Boolean(currentUser.isAdmin) || (currentUser.diamonds ?? 0) >= costM;
                        const petInvFullModal = isPairLobbyPetInventoryFull(currentUser);
                        const eggImgModal =
                            MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ??
                            PAIR_EGG_DISPLAY_IMAGE;

                        return (
                            <div className="relative overflow-hidden">
                                <div
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-15%,rgba(6,182,212,0.28),transparent_50%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)48%,rgba(15,23,42,0.45)100%)]"
                                    aria-hidden
                                />
                                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/45 to-transparent" aria-hidden />
                                <div className="relative px-6 pb-6 pt-7 text-center">
                                    {!sessionM ? (
                                        <p className="mt-4 text-sm text-amber-200/90">부화 중인 알이 없습니다. 창을 닫아 주세요.</p>
                                    ) : canClaimM ? (
                                        <p className="mt-4 text-sm text-amber-200/90">
                                            이미 부화가 끝났습니다. 창을 닫고 <span className="font-bold">펫 받기</span>를 눌러 주세요.
                                        </p>
                                    ) : (
                                        <>
                                            <div className="mx-auto mt-4 flex max-w-[19rem] flex-row items-center justify-center gap-4 rounded-xl border border-white/[0.1] bg-black/35 px-4 py-3 shadow-inner">
                                                <div className="relative shrink-0">
                                                    <div
                                                        className="pointer-events-none absolute inset-0 rounded-lg bg-fuchsia-500/30 blur-md"
                                                        aria-hidden
                                                    />
                                                    <img
                                                        src={eggImgModal}
                                                        alt=""
                                                        className="relative h-[clamp(3.25rem,12vmin,4.25rem)] w-[clamp(3.25rem,12vmin,4.25rem)] rounded-lg object-contain ring-2 ring-fuchsia-400/45 ring-offset-2 ring-offset-zinc-950/90"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1 text-left">
                                                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">남은 시간</p>
                                                    <p className="mt-0.5 font-mono text-[clamp(1.35rem,4.5vmin,1.85rem)] font-black tabular-nums leading-none tracking-tight text-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]">
                                                        {formatPairHatcheryRemainHMS(remainMsM)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mx-auto mt-4 flex max-w-[16rem] items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-950/25 px-4 py-2.5">
                                                <span className="text-xs font-semibold text-cyan-100/90">사용 다이아</span>
                                                <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-black/30 px-2.5 py-1 tabular-nums">
                                                    <img src="/images/icon/Zem.webp" alt="" className="h-5 w-5 shrink-0" />
                                                    <span className="text-lg font-black text-cyan-50">{costM}</span>
                                                </span>
                                            </div>
                                            {!currentUser.isAdmin ? (
                                                <p className="mt-2 text-[0.7rem] text-slate-400">
                                                    보유{' '}
                                                    <span className="font-bold tabular-nums text-slate-200">
                                                        {formatWalletDiamonds(currentUser.diamonds ?? 0)}
                                                    </span>
                                                </p>
                                            ) : null}
                                            {!hasEnoughM && !currentUser.isAdmin ? (
                                                <p className="mt-2 text-xs font-semibold text-rose-300">다이아가 부족합니다.</p>
                                            ) : null}
                                            {petInvFullModal ? (
                                                <p className="mt-2 text-xs font-semibold text-amber-200/95">{PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE}</p>
                                            ) : null}
                                        </>
                                    )}
                                    <div className="mx-auto mt-6 flex max-w-sm flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!isBusy) setHatcheryInstantConfirmSlotIndex(null);
                                            }}
                                            disabled={isBusy}
                                            className="order-2 w-full min-w-[8.5rem] rounded-full border border-white/15 bg-white/[0.04] px-6 py-2.5 text-sm font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-45 sm:order-1 sm:w-auto"
                                        >
                                            취소
                                        </button>
                                        <Button
                                            type="button"
                                            disabled={
                                                isBusy ||
                                                !sessionM ||
                                                canClaimM ||
                                                costM < 1 ||
                                                !hasEnoughM ||
                                                petInvFullModal
                                            }
                                            onClick={async () => {
                                                if (hatcheryInstantConfirmSlotIndex === null || isBusy) return;
                                                const slot = hatcheryInstantConfirmSlotIndex;
                                                // 응답으로 세션이 비워지기 전에 모달을 닫지 않으면, 한 프레임 동안「부화 중인 알 없음」이 잠깐 보입니다.
                                                setHatcheryInstantConfirmSlotIndex(null);
                                                const res = await instantFinishHatch(slot);
                                                const instErr = res && (res as { error?: string }).error;
                                                if (instErr) {
                                                    if (instErr === PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE) {
                                                        setHatcheryPetInvFullModalOpen(true);
                                                    } else {
                                                        setHatcheryInstantConfirmSlotIndex(slot);
                                                    }
                                                }
                                            }}
                                            colorScheme="none"
                                            className="order-1 flex w-full min-w-[8.5rem] !flex-row !items-center !justify-center !gap-2 !rounded-full !border !border-cyan-400/55 !bg-gradient-to-r !from-cyan-600 !via-cyan-500 !to-teal-600 !px-7 !py-2.5 !text-sm !font-black !tracking-wide !text-white !shadow-[0_8px_28px_rgba(6,182,212,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:!from-cyan-500 hover:!via-cyan-400 hover:!to-teal-500 disabled:!opacity-40 sm:order-2 sm:w-auto"
                                        >
                                            <span>즉시 완료</span>
                                            {sessionM && !canClaimM && costM > 0 ? (
                                                <span className="inline-flex items-center gap-0.5 rounded-md border border-white/25 bg-black/25 px-1.5 py-0.5 text-xs tabular-nums">
                                                    <img src="/images/icon/Zem.webp" alt="" className="h-3.5 w-3.5" />
                                                    {costM}
                                                </span>
                                            ) : null}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DraggableWindow>
            ) : null}

            {pairShopPurchaseSku ? (
                <PurchaseQuantityModal
                    item={{
                        itemId: pairShopPurchaseSku.id,
                        name: pairShopPurchaseSku.label,
                        price:
                            pairShopPurchaseSku.gold > 0
                                ? { gold: pairShopPurchaseSku.gold }
                                : { diamonds: pairShopPurchaseSku.diamonds },
                        limit: pairShopQuantityModalLimit,
                        type: 'material',
                        image: pairPetShopSkuImage(pairShopPurchaseSku),
                        description: pairShopPurchaseSku.description,
                    }}
                    currentUser={currentUser as UserWithStatus}
                    onClose={() => setPairShopPurchaseSku(null)}
                    onConfirm={(itemId, quantity) => {
                        void purchase(itemId, quantity);
                    }}
                />
            ) : null}
        </div>
    );
};

export default PairPetLobbyPanel;
