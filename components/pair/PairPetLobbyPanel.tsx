import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import InventorySlotExpandDiamondBody from '../inventory/InventorySlotExpandDiamondBody.js';
import PairPetProfilePanel from './PairPetProfilePanel.js';
import PairPetLobbyInfoPetViewer from './PairPetLobbyInfoPetViewer.js';
import PairPetLobbySoulStoneViewer from './PairPetLobbySoulStoneViewer.js';
import PairPetSoulConvertModal from './PairPetSoulConvertModal.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import PurchaseQuantityModal from '../PurchaseQuantityModal.js';
import type { User, UserWithStatus, InventoryItem, ServerAction } from '../../types.js';
import { MATERIAL_ITEMS, gradeBackgrounds } from '../../shared/constants/items.js';
import { ItemGrade } from '../../types/enums.js';
import { isSameDayKST } from '../../utils/timeUtils.js';
import { effectivePairPetGradeFromRow, PAIR_PET_MAX_LEVEL } from '../../shared/constants/pairPetGrade.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import {
    PAIR_PET_SHOP_SKUS,
    type PairPetShopSku,
    PAIR_PET_LOBBY_INV_EXPAND_STEP,
    PAIR_PET_LOBBY_INV_MAX_SLOTS,
    PAIR_SOULSTONE_NAMES,
    PAIR_EGG_DISPLAY_IMAGE,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_SOULSTONE_TEMPLATE_IDS,
    getPairPetDefinition,
    isPairEggItem,
    isPairPetMaterial,
    isPairSoulStoneItem,
    pairPetLobbyInventorySlots,
    pairPetLobbyExpandDiamondCost,
} from '../../shared/constants/petLobby.js';
import {
    PAIR_TRAINING_SLOT_DEFS,
    PAIR_TRAINING_UNLOCK_WINS,
    getPairTrainingSlotDisplayName,
    getPairWins,
    isItemIdInPairTraining,
    isPairTrainingSlotUnlocked,
    minPetLevelForTrainingSlot,
    normalizePairPetTrainingSlots,
    trainingEndsAt,
} from '../../shared/constants/pairTraining.js';
import {
    PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE,
    PAIR_HATCHERY_SLOT_DEFS,
    PAIR_HATCHERY_VIP_SLOT_INDEX,
    canUnlockPairHatcherySlot,
    canUsePairHatcherySlot,
    getPairHatcherySlotDef,
    hatcheryEndsAt,
    normalizePairPetHatcherySessions,
    normalizePairPetHatcherySlotUnlocked,
    type PairHatcherySlotDef,
} from '../../shared/constants/pairHatchery.js';
import { isFunctionVipActive } from '../../shared/utils/rewardVip.js';
type AiTab = 'info' | 'training' | 'hatchery' | 'shop';
type InvFilter = 'pet' | 'soul';
type ShopSkuTab = 'egg' | 'soul';
type PairExpandCategory = 'pet';
type InvSortMode = 'recent' | 'oldest' | 'name';

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

function pickAwardedPairPetFromInventoryDelta(before: InventoryItem[], after: InventoryItem[]): InventoryItem | null {
    const beforePets = before.filter(isPairPetMaterial);
    const afterPets = after.filter(isPairPetMaterial);
    const beforeById = new Map(beforePets.map((p) => [p.id, p]));
    for (const ap of afterPets) {
        if (!beforeById.has(ap.id)) return ap;
    }
    for (const ap of afterPets) {
        const bp = beforeById.get(ap.id);
        if (bp && (ap.quantity ?? 1) > (bp.quantity ?? 1)) return ap;
    }
    return null;
}

/** 확정 단일 레벨은 `N`, 범위만 `lo ~ hi` */
function hatcheryLevelOutcomeLine(def: PairHatcherySlotDef): React.ReactNode {
    const rule = def.levelRule;
    if (rule.kind === 'default') {
        return (
            <span className="text-[clamp(0.62rem,1.85vmin,0.8125rem)] font-semibold tabular-nums leading-snug text-amber-200">
                부화 펫 레벨 : 1
            </span>
        );
    }
    if (rule.kind === 'fixed') {
        const n = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(rule.level)));
        return (
            <span className="text-[clamp(0.62rem,1.85vmin,0.8125rem)] font-semibold tabular-nums leading-snug text-amber-200">
                부화 펫 레벨 : {n}
            </span>
        );
    }
    const lo = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.min(rule.min, rule.max)));
    const hi = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.max(rule.min, rule.max)));
    if (lo === hi) {
        return (
            <span className="text-[clamp(0.62rem,1.85vmin,0.8125rem)] font-semibold tabular-nums leading-snug text-amber-200">
                부화 펫 레벨 : {lo}
            </span>
        );
    }
    return (
        <span className="text-[clamp(0.62rem,1.85vmin,0.8125rem)] font-semibold tabular-nums leading-snug text-amber-200">
            부화 펫 레벨 : {lo} ~ {hi}
        </span>
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
    title,
}: {
    item: InventoryItem;
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
    /** 페어 로비 인벤: 대표로 장착된 펫 썸네일 상단 표시 */
    showRepresentativeBadge?: boolean;
    title?: string;
}) {
    const qty = item.quantity ?? 1;
    const showStackBadge = !isPairPetMaterial(item) && qty > 1;
    const petThumb = isPairPetMaterial(item) && !isPairEggItem(item);
    const petG = effectivePairPetGradeFromRow(item);
    const petBg = petThumb ? (gradeBackgrounds[petG] ?? gradeBackgrounds[ItemGrade.Normal]) : null;
    const petTrans = petThumb && petG === ItemGrade.Transcendent;
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
            {petThumb && showRepresentativeBadge ? (
                <span
                    className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex justify-center px-0.5 pt-px"
                    title="대표 펫"
                >
                    <span className="max-w-[95%] truncate rounded-b bg-cyan-600 px-[3px] py-[1px] text-[clamp(0.45rem,2.4vmin,0.5625rem)] font-black leading-none tracking-tight text-white shadow-sm ring-1 ring-black/35">
                        대표펫
                    </span>
                </span>
            ) : null}
            {petBg ? (
                <img src={petBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-88" loading="lazy" />
            ) : null}
            <img
                src={item.image}
                alt=""
                className={`relative z-[1] shrink-0 object-contain ${petThumb ? 'h-[72%] w-[72%] drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]' : 'h-9 w-9 rounded'}`}
                loading="lazy"
            />
            {showStackBadge ? (
                <span className="absolute bottom-0.5 right-0.5 z-[2] rounded bg-black/70 px-1 py-0.5 text-xs font-black text-amber-200">
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

/** 메인 상점 `ShopItemCard`와 유사한 카드형 레이아웃 */
function PairPetShopSkuCard({
    sku,
    currentUser,
    isBusy,
    onBuyClick,
    descOpen,
    onOpenDesc,
    onCloseDesc,
}: {
    sku: PairPetShopSku;
    currentUser: User;
    isBusy: boolean;
    onBuyClick: (sku: PairPetShopSku) => void;
    descOpen: boolean;
    onOpenDesc: () => void;
    onCloseDesc: () => void;
}) {
    const now = Date.now();
    const rec = currentUser.dailyShopPurchases?.[sku.id];
    const boughtToday = rec && isSameDayKST(rec.date, now) ? rec.quantity : 0;
    const remaining = Math.max(0, sku.dailyLimit - boughtToday);
    const isGold = sku.gold > 0;
    const priceAmount = isGold ? sku.gold : sku.diamonds;
    const refinedDescription = formatPairShopDescription(sku.description);

    return (
        <div className="group relative flex flex-col items-center overflow-hidden rounded-xl border border-indigo-400/35 bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 p-2.5 text-center shadow-[0_22px_55px_-30px_rgba(99,102,241,0.55)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-32px_rgba(129,140,248,0.55)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent" />
            <div
                role="button"
                tabIndex={0}
                className="relative mb-1.5 flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_22px_-8px_rgba(129,140,248,0.55)] transition-transform hover:scale-[1.03]"
                onClick={onOpenDesc}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenDesc();
                    }
                }}
                onMouseEnter={onOpenDesc}
                onMouseLeave={onCloseDesc}
            >
                <img src={sku.image} alt="" className="h-full w-full object-contain p-1 drop-shadow-[0_6px_12px_rgba(30,64,175,0.35)]" loading="lazy" />
                {sku.quantity > 1 ? (
                    <span className="absolute right-0 top-0 rounded-bl bg-gray-900/90 px-1 text-xs font-bold text-cyan-300 shadow-md">×{sku.quantity}</span>
                ) : null}
            </div>
            {descOpen ? (
                <div className="absolute left-1/2 top-[4.5rem] z-40 w-[min(100%,14rem)] -translate-x-1/2 rounded-lg border border-indigo-400/50 bg-gray-900/95 p-2 shadow-xl">
                    <p className="text-left text-xs leading-relaxed text-slate-200/90">{refinedDescription}</p>
                </div>
            ) : null}
            <h3 className="line-clamp-2 min-h-[2.25rem] w-full px-0.5 text-center text-xs font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_10px_rgba(99,102,241,0.45)] sm:text-sm">
                {sku.label}
            </h3>
            <div className="mt-1.5 flex w-full flex-1 flex-col justify-end">
                <Button
                    type="button"
                    onClick={() => onBuyClick(sku)}
                    disabled={isBusy || remaining === 0}
                    colorScheme="none"
                    bare
                    className={`flex w-full min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-center text-xs font-semibold leading-tight transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isGold
                            ? 'border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_10px_28px_-16px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500'
                            : 'border-sky-400/50 bg-gradient-to-r from-sky-400/90 via-blue-500/90 to-indigo-500/90 text-white shadow-[0_10px_28px_-16px_rgba(56,189,248,0.75)] hover:from-sky-300 hover:to-indigo-500'
                    }`}
                >
                    <div className="flex min-w-0 items-center justify-center gap-1 font-semibold tracking-tight">
                        {isGold ? (
                            <img src="/images/icon/Gold.png" alt="" className="h-4 w-4 shrink-0 drop-shadow-md" />
                        ) : (
                            <img src="/images/icon/Zem.png" alt="" className="h-4 w-4 shrink-0 drop-shadow-md" />
                        )}
                        <span className="tabular-nums">{priceAmount.toLocaleString()}</span>
                    </div>
                    <span className={`max-w-full px-0.5 text-center text-xs leading-tight ${isGold ? 'text-slate-800/95' : 'text-white/85'}`}>
                        일일 한도 {remaining}/{sku.dailyLimit}
                    </span>
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
    const [aiTab, setAiTab] = useState<AiTab>('info');
    const [shopSkuTab, setShopSkuTab] = useState<ShopSkuTab>('egg');
    const [shopDescSkuId, setShopDescSkuId] = useState<string | null>(null);
    const [pairShopPurchaseSku, setPairShopPurchaseSku] = useState<PairPetShopSku | null>(null);
    const [invFilter, setInvFilter] = useState<InvFilter>('pet');
    const [expandTarget, setExpandTarget] = useState<PairExpandCategory | null>(null);
    const [selectedLobbyItemId, setSelectedLobbyItemId] = useState<string | null>(null);
    const [invSort, setInvSort] = useState<InvSortMode>('recent');
    const [trainingTick, setTrainingTick] = useState(0);
    const [hatcheryTick, setHatcheryTick] = useState(0);
    const [hatcheryConfirmSlotIndex, setHatcheryConfirmSlotIndex] = useState<number | null>(null);
    const [hatcheryInstantConfirmSlotIndex, setHatcheryInstantConfirmSlotIndex] = useState<number | null>(null);
    const [hatcheryPetInvFullModalOpen, setHatcheryPetInvFullModalOpen] = useState(false);
    const [soulConvertItem, setSoulConvertItem] = useState<InventoryItem | null>(null);
    /** 모바일: 빈 수련 슬롯 탭 후 인벤에서 펫 선택 */
    const [trainingMobilePickSlotIndex, setTrainingMobilePickSlotIndex] = useState<number | null>(null);
    /** 수련 시작 직전 확인(드롭·모바일 탭 공통) */
    const [trainingStartConfirm, setTrainingStartConfirm] = useState<{ slotIndex: number; itemId: string } | null>(null);

    const equippedTid = currentUser.equippedPairPetTemplateId ?? null;
    /** 저장되어 있으면 해당 행만 대표 표시(동종 다마리 구분). 없으면 템플릿 일치 행 전체에 표시(구버전 호환). */
    const equippedItemId = currentUser.equippedPairPetInventoryItemId ?? null;

    const inventory = currentUser.inventory || [];

    const pairShopQuantityModalLimit = useMemo(() => {
        if (!pairShopPurchaseSku) return 0;
        const rec = currentUser.dailyShopPurchases?.[pairShopPurchaseSku.id];
        const now = Date.now();
        const bought = rec && isSameDayKST(rec.date, now) ? rec.quantity : 0;
        return Math.max(0, pairShopPurchaseSku.dailyLimit - bought);
    }, [pairShopPurchaseSku, currentUser.dailyShopPurchases, currentUser]);

    const eggCount = useMemo(
        () => inventory.filter(isPairEggItem).reduce((s, it) => s + (it.quantity ?? 1), 0),
        [inventory]
    );

    const shopSkusVisible = useMemo(
        () =>
            PAIR_PET_SHOP_SKUS.filter((sku) =>
                shopSkuTab === 'egg' ? sku.id.startsWith('pair_shop_egg_') : sku.id.startsWith('pair_shop_soul_')
            ),
        [shopSkuTab]
    );

    /** 수련 탭은 펫 인벤만 사용 (영혼석 탭 없음). 정보 탭은 기존 펫/영혼석 필터 유지. */
    const effectiveInvFilter: InvFilter = aiTab === 'training' ? 'pet' : invFilter;

    const filteredInv = useMemo(() => {
        if (effectiveInvFilter === 'pet') return inventory.filter(isPairPetMaterial);
        return inventory.filter(isPairSoulStoneItem);
    }, [inventory, effectiveInvFilter]);

    const sortedFilteredInv = useMemo(() => {
        const arr = [...filteredInv];
        switch (invSort) {
            case 'oldest':
                return arr.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
            case 'name':
                return arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
            case 'recent':
            default:
                return arr.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
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
        () => inventory.filter(isPairPetMaterial).length,
        [inventory]
    );

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

    const selectedSoulPrimaryStackQty = useMemo(() => {
        if (!selectedSoulPrimaryStackId) return 0;
        return inventory.find((i) => i.id === selectedSoulPrimaryStackId)?.quantity ?? 0;
    }, [inventory, selectedSoulPrimaryStackId]);

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
        if (aiTab !== 'hatchery') {
            setHatcheryConfirmSlotIndex(null);
            setHatcheryInstantConfirmSlotIndex(null);
        }
    }, [aiTab]);

    useEffect(() => {
        if (aiTab !== 'training') {
            setTrainingMobilePickSlotIndex(null);
            setTrainingStartConfirm(null);
        }
    }, [aiTab]);

    const purchase = async (sku: string, quantity = 1) => {
        await applyPetAction({ type: 'PAIR_PET_PURCHASE', payload: { sku, quantity } });
    };

    const onPairPetShopBuyClick = (sku: PairPetShopSku) => {
        if (sku.dailyLimit > 1) {
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
        setAiTab('info');
        setInvFilter('pet');
        setExpandTarget(null);
    }, []);

    const confirmSoulConvert = async () => {
        if (!soulConvertItem || isBusy) return;
        const itemId = soulConvertItem.id;
        // 영혼변환 창(zIndex 72)이 획득 모달(70)보다 위라서, 닫기 전에 획득 모달이 가려지지 않도록 먼저 내린다.
        flushSync(() => setSoulConvertItem(null));
        const res = await applyPetAction({ type: 'PAIR_PET_CONVERT_PET', payload: { itemId } });
        const err = (res as { error?: string })?.error;
        if (err) {
            window.alert(err);
            return;
        }
        setSelectedLobbyItemId((cur) => (cur === itemId ? null : cur));
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

    const handleHatcheryClaim = async (slotIndex: number) => {
        const before = JSON.parse(JSON.stringify(currentUser.inventory || [])) as InventoryItem[];
        const res = await applyPetAction({ type: 'PAIR_PET_HATCHERY_CLAIM', payload: { slotIndex } });
        const claimErr = res && (res as { error?: string }).error;
        if (claimErr) {
            if (claimErr === PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE) setHatcheryPetInvFullModalOpen(true);
            return;
        }
        const updated = readUpdatedUserFromActionResult(res);
        if (updated?.inventory) {
            const pet = pickAwardedPairPetFromInventoryDelta(before, updated.inventory);
            if (pet) handlers.openPairPetDetailModal(pet, 'obtain');
        }
    };

    const instantFinishHatch = async (slotIndex: number) => {
        const before = JSON.parse(JSON.stringify(currentUser.inventory || [])) as InventoryItem[];
        const res = await applyPetAction({ type: 'PAIR_PET_HATCHERY_INSTANT_FINISH', payload: { slotIndex } });
        if (res && (res as { error?: string }).error) return res;
        const updated = readUpdatedUserFromActionResult(res);
        if (updated?.inventory) {
            const pet = pickAwardedPairPetFromInventoryDelta(before, updated.inventory);
            if (pet) handlers.openPairPetDetailModal(pet, 'obtain');
        }
        return res;
    };

    const showInvStrip = aiTab === 'info' || aiTab === 'training' || aiTab === 'hatchery';

    /** 수련 탭은 펫 인벤만 쓰므로 탭 하이라이트는 항상 펫; 영혼석 버튼은 비활성 */
    const invStripTabHighlight: InvFilter = aiTab === 'training' ? 'pet' : invFilter;

    const hatcheryTabContent = (() => {
        void hatcheryTick;
        const sessions = normalizePairPetHatcherySessions(currentUser.pairPetHatcherySessions);
        const unlocked = normalizePairPetHatcherySlotUnlocked(currentUser.pairPetHatcherySlotUnlocked);
        const pairWins = getPairWins(currentUser);
        const vipActive = isFunctionVipActive(currentUser);
        const now = Date.now();

        const unlockSlot = async (slotIndex: number) => {
            await applyPetAction({ type: 'PAIR_PET_HATCHERY_UNLOCK', payload: { slotIndex } });
        };

        const cancelHatchery = async (slotIndex: number) => {
            await applyPetAction({ type: 'PAIR_PET_HATCHERY_CANCEL', payload: { slotIndex } });
        };

        const renderSlot = (slotIndex: number) => {
            const def = getPairHatcherySlotDef(slotIndex);
            if (!def) return null;
            const usable = canUsePairHatcherySlot(currentUser, slotIndex);
            const session = sessions[slotIndex];
            const endAt = session ? hatcheryEndsAt(session.startedAt, slotIndex) : 0;
            const canClaim = Boolean(session && now >= endAt);
            const remainMs = session && !canClaim ? Math.max(0, endAt - now) : 0;
            const instantDiamondCost =
                session && !canClaim && remainMs > 0 ? Math.max(1, Math.ceil(remainMs / 60_000)) : 0;
            const hasEnoughInstantDiamonds =
                Boolean(currentUser.isAdmin) || (currentUser.diamonds ?? 0) >= instantDiamondCost;
            const isVip = def.displayNumber === 'vip';
            const gate = slotIndex >= 1 && slotIndex < PAIR_HATCHERY_VIP_SLOT_INDEX ? canUnlockPairHatcherySlot(currentUser, slotIndex) : null;
            const winsOk = pairWins >= (def.unlockWinsRequired ?? 0);
            const showUnlockBtn = !isVip && slotIndex > 0 && !unlocked[slotIndex] && winsOk;

            const levelOutcome = hatcheryLevelOutcomeLine(def);
            const eggImgForSlot =
                MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ?? PAIR_EGG_DISPLAY_IMAGE;

            const durationHMS = formatHatcheryDurationHMS(def.durationMs);

            const infoPanel = (
                <div
                    className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-black/40 via-black/25 to-fuchsia-950/15 p-[clamp(0.35rem,1.1vmin,0.65rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[2px]"
                >
                    <div className="shrink-0 border-b border-white/[0.08] pb-[clamp(0.25rem,0.85vmin,0.45rem)] leading-snug text-amber-100/95">
                        {levelOutcome}
                    </div>
                    {usable && !session ? (
                        <Button
                            type="button"
                            disabled={isBusy || eggCount < 1}
                            onClick={() => setHatcheryConfirmSlotIndex(slotIndex)}
                            colorScheme="none"
                            className="mt-[clamp(0.35rem,1vmin,0.6rem)] !w-auto !min-w-0 self-center !rounded-lg !border !border-fuchsia-400/60 !bg-gradient-to-b !from-fuchsia-600/95 !to-fuchsia-900/95 !px-[clamp(0.65rem,2vmin,1.1rem)] !py-[clamp(0.2rem,0.75vmin,0.55rem)] !text-[clamp(0.58rem,1.5vmin,0.75rem)] !font-black !uppercase !tracking-widest !text-fuchsia-50 !shadow-[0_6px_18px_rgba(192,38,211,0.35)] hover:!from-fuchsia-500 hover:!to-fuchsia-800 disabled:!opacity-40"
                        >
                            부화 시작
                        </Button>
                    ) : null}
                    {usable && session && !canClaim ? (
                        <div className="mt-[clamp(0.35rem,1vmin,0.6rem)] flex min-w-0 flex-row flex-nowrap items-stretch gap-[clamp(0.25rem,0.85vmin,0.45rem)]">
                            <Button
                                type="button"
                                disabled={isBusy || !hasEnoughInstantDiamonds}
                                title={!hasEnoughInstantDiamonds ? '다이아가 부족합니다.' : undefined}
                                onClick={() => setHatcheryInstantConfirmSlotIndex(slotIndex)}
                                colorScheme="none"
                                className="!flex !min-w-0 !flex-1 !basis-0 !flex-row !items-center !justify-center !gap-1 !rounded-lg !border !border-cyan-400/55 !bg-gradient-to-b !from-cyan-600/90 !to-cyan-950/95 !px-[clamp(0.25rem,1vmin,0.55rem)] !py-[clamp(0.22rem,0.8vmin,0.5rem)] !text-[clamp(0.48rem,1.25vmin,0.68rem)] !font-black !uppercase !tracking-wide !text-cyan-50 !shadow-[0_4px_14px_rgba(6,182,212,0.28)] hover:!from-cyan-500 hover:!to-cyan-900 disabled:!opacity-40"
                            >
                                <span className="min-w-0 shrink truncate">즉시 완료</span>
                                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-cyan-300/35 bg-black/25 px-[clamp(0.12rem,0.55vmin,0.28rem)] py-0.5 tabular-nums">
                                    <img src="/images/icon/Zem.png" alt="" className="h-[clamp(0.75rem,2.1vmin,0.9rem)] w-[clamp(0.75rem,2.1vmin,0.9rem)] shrink-0" />
                                    <span>{instantDiamondCost}</span>
                                </span>
                            </Button>
                            <Button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void cancelHatchery(slotIndex)}
                                colorScheme="none"
                                className="!min-w-0 !flex-1 !basis-0 !rounded-lg !border !border-white/20 !bg-white/[0.06] !px-[clamp(0.25rem,1vmin,0.55rem)] !py-[clamp(0.2rem,0.75vmin,0.48rem)] !text-[clamp(0.48rem,1.25vmin,0.68rem)] !font-bold !text-zinc-200 hover:!border-white/30 hover:!bg-white/[0.1] disabled:!opacity-40"
                            >
                                취소
                            </Button>
                        </div>
                    ) : null}
                    {usable && session && canClaim ? (
                        <Button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleHatcheryClaim(slotIndex)}
                            colorScheme="none"
                            className="mt-[clamp(0.35rem,1vmin,0.6rem)] !flex !w-full !min-w-0 !flex-row !items-center !justify-center !gap-1 !rounded-lg !border !border-amber-400/55 !bg-gradient-to-b !from-amber-500/95 !to-amber-800/95 !px-[clamp(0.25rem,1vmin,0.55rem)] !py-[clamp(0.22rem,0.8vmin,0.5rem)] !text-[clamp(0.48rem,1.25vmin,0.68rem)] !font-black !uppercase !tracking-wide !text-amber-50 !shadow-[0_4px_14px_rgba(245,158,11,0.3)] hover:!from-amber-500 hover:!to-amber-800 disabled:!opacity-40"
                        >
                            펫 받기
                        </Button>
                    ) : null}
                    {isVip && !vipActive ? (
                        <div className="mt-[clamp(0.35rem,1vmin,0.6rem)] flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-950/20 py-[clamp(0.25rem,0.8vmin,0.45rem)] text-amber-200/90">
                            <HatcheryFunctionVipHintIcon />
                        </div>
                    ) : null}
                    {showUnlockBtn ? (
                        <Button
                            type="button"
                            disabled={isBusy || !gate?.ok}
                            title={!gate?.ok ? gate?.reason : undefined}
                            onClick={() => void unlockSlot(slotIndex)}
                            colorScheme="none"
                            className="mt-[clamp(0.35rem,1vmin,0.6rem)] !w-full !min-h-0 !rounded-lg !border !border-amber-400/50 !bg-gradient-to-b !from-amber-600/90 !to-amber-900/90 !py-[clamp(0.2rem,0.75vmin,0.5rem)] !text-[clamp(0.58rem,1.5vmin,0.75rem)] !font-extrabold !text-amber-50 !shadow-[0_4px_14px_rgba(245,158,11,0.25)] hover:!from-amber-500 hover:!to-amber-800 disabled:!opacity-45"
                        >
                            해금
                        </Button>
                    ) : null}
                </div>
            );

            const chamberBusy = usable && Boolean(session);

            const eggBox = 'h-[clamp(1.45rem,10.5vmin,2.5rem)] w-[clamp(1.45rem,10.5vmin,2.5rem)]';

            return (
                <div
                    key={`hatch-def-${slotIndex}`}
                    className={`group relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-2xl border p-[clamp(0.35rem,1vmin,0.65rem)] text-[clamp(0.58rem,1.45vmin,0.75rem)] shadow-lg transition-[box-shadow,transform] duration-300 hover:shadow-xl ${
                        usable
                            ? 'border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/45 via-zinc-950/80 to-violet-950/35 shadow-[0_0_28px_rgba(192,38,211,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-fuchsia-400/15 hover:-translate-y-[1px]'
                            : 'border-white/[0.09] bg-gradient-to-br from-zinc-900/70 via-black/70 to-zinc-950/90 ring-1 ring-black/50'
                    }`}
                >
                    <div
                        className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl ${
                            usable ? 'bg-fuchsia-600/20' : 'bg-zinc-600/10'
                        }`}
                        aria-hidden
                    />
                    <div
                        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
                            usable ? 'via-fuchsia-400/40' : 'via-white/15'
                        } to-transparent`}
                        aria-hidden
                    />
                    <div className="relative flex min-h-0 flex-1 items-stretch gap-[clamp(0.35rem,1.1vmin,0.65rem)]">
                        <div className="relative min-h-0 w-[clamp(4.15rem,26vw,6.75rem)] shrink-0">
                            {isVip ? (
                                <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 justify-center">
                                    <span className="rounded-md border border-amber-200/50 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 px-[clamp(0.35rem,1.2vmin,0.55rem)] py-[clamp(0.1rem,0.35vmin,0.2rem)] text-[clamp(0.5rem,1.35vmin,0.625rem)] font-black uppercase tracking-[0.12em] text-amber-950 shadow-[0_3px_10px_rgba(245,158,11,0.4),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-amber-400/50">
                                        VIP
                                    </span>
                                </div>
                            ) : null}
                            <div
                                className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border p-[clamp(0.25rem,0.9vmin,0.45rem)] shadow-inner transition ${
                                    !usable
                                        ? 'border-white/10 bg-gradient-to-b from-zinc-900/50 to-black/70'
                                        : chamberBusy
                                          ? 'border-fuchsia-400/40 bg-gradient-to-b from-fuchsia-950/40 via-black/60 to-violet-950/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.12)]'
                                          : 'border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-900/25 to-black/50 shadow-[inset_0_0_24px_rgba(217,70,239,0.08)]'
                                }`}
                            >
                                <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
                                {!usable ? (
                                    <div className="flex min-h-0 flex-col items-center justify-center gap-[clamp(0.2rem,0.8vmin,0.45rem)] px-0.5 text-center">
                                        <span
                                            className="flex h-[clamp(1.65rem,7.5vmin,2.35rem)] w-[clamp(1.65rem,7.5vmin,2.35rem)] shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[clamp(0.85rem,3.5vmin,1.1rem)] leading-none text-zinc-400 shadow-inner"
                                            aria-hidden
                                        >
                                            🔒
                                        </span>
                                        {isVip ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <HatcheryFunctionVipHintIcon />
                                                <p className="max-w-full px-0.5 text-center text-[clamp(0.58rem,1.55vmin,0.7rem)] font-extrabold leading-tight text-amber-200/95">
                                                    기능VIP활성화
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="max-w-full bg-gradient-to-r from-amber-100 to-amber-300 bg-clip-text px-0.5 text-center text-[clamp(0.58rem,1.55vmin,0.7rem)] font-extrabold leading-tight text-transparent">
                                                페어 {def.unlockWinsRequired}승
                                            </p>
                                        )}
                                    </div>
                                ) : session ? (
                                    <>
                                        <div className="relative shrink-0">
                                            <div
                                                className={`absolute inset-0 rounded-full blur-md ${canClaim ? 'bg-amber-400/35' : 'bg-fuchsia-500/30'}`}
                                                aria-hidden
                                            />
                                            <img
                                                src={eggImgForSlot}
                                                alt=""
                                                className={`relative ${eggBox} shrink-0 rounded-lg object-contain ring-[3px] ring-fuchsia-300/55 ring-offset-2 ring-offset-fuchsia-950/80 shadow-[0_0_20px_rgba(217,70,239,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]`}
                                                loading="lazy"
                                            />
                                        </div>
                                        <span
                                            className={`mt-[clamp(0.1rem,0.4vmin,0.25rem)] text-[clamp(0.5rem,1.35vmin,0.625rem)] font-black uppercase tracking-[0.12em] ${
                                                canClaim ? 'text-amber-200/95' : 'text-fuchsia-200/90'
                                            }`}
                                        >
                                            {canClaim ? '부화 완료' : '부화 중'}
                                        </span>
                                    </>
                                ) : (
                                    <div className="relative flex min-h-0 w-full flex-col items-center justify-center px-1 py-1">
                                        <div
                                            className="pointer-events-none absolute left-1/2 top-1/2 h-[clamp(2.75rem,18vmin,4rem)] w-[clamp(2.75rem,18vmin,4rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-fuchsia-500/35 via-violet-500/20 to-transparent blur-2xl"
                                            aria-hidden
                                        />
                                        <div
                                            className="pointer-events-none absolute inset-x-[12%] top-[18%] h-px bg-gradient-to-r from-transparent via-fuchsia-300/40 to-transparent"
                                            aria-hidden
                                        />
                                        <div className="relative w-[min(100%,5.75rem)]">
                                            <div
                                                className="absolute -inset-[1.5px] rounded-[13px] bg-gradient-to-br from-fuchsia-400/70 via-violet-500/50 to-fuchsia-600/55 opacity-95 shadow-[0_0_18px_rgba(192,38,211,0.35)]"
                                                aria-hidden
                                            />
                                            <div className="relative overflow-hidden rounded-xl border border-white/[0.14] bg-gradient-to-b from-fuchsia-950/85 via-zinc-950/92 to-violet-950/80 px-[clamp(0.4rem,1.35vmin,0.6rem)] py-[clamp(0.42rem,1.45vmin,0.62rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-12px_20px_rgba(0,0,0,0.35)]">
                                                <div
                                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(244,114,182,0.22),transparent_55%)]"
                                                    aria-hidden
                                                />
                                                <div className="relative flex items-center justify-center gap-[0.35em]">
                                                    <span
                                                        className="select-none text-[clamp(0.55rem,1.35vmin,0.68rem)] leading-none text-fuchsia-300/90 drop-shadow-[0_0_6px_rgba(232,121,249,0.65)]"
                                                        aria-hidden
                                                    >
                                                        ✦
                                                    </span>
                                                    <p className="bg-gradient-to-b from-fuchsia-50 via-white to-violet-100 bg-clip-text text-center text-[clamp(0.58rem,1.55vmin,0.74rem)] font-black leading-none tracking-[0.06em] text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.5)]">
                                                        부화 가능
                                                    </p>
                                                    <span
                                                        className="select-none text-[clamp(0.55rem,1.35vmin,0.68rem)] leading-none text-violet-300/90 drop-shadow-[0_0_6px_rgba(167,139,250,0.55)]"
                                                        aria-hidden
                                                    >
                                                        ✦
                                                    </span>
                                                </div>
                                                <div
                                                    className="pointer-events-none mx-auto mt-[clamp(0.2rem,0.65vmin,0.3rem)] flex h-0.5 w-[42%] justify-center gap-1"
                                                    aria-hidden
                                                >
                                                    <span className="h-full flex-1 rounded-full bg-fuchsia-400/55 shadow-[0_0_6px_rgba(244,114,182,0.5)]" />
                                                    <span className="h-full flex-1 rounded-full bg-violet-400/45 shadow-[0_0_6px_rgba(167,139,250,0.45)]" />
                                                    <span className="h-full flex-1 rounded-full bg-fuchsia-400/55 shadow-[0_0_6px_rgba(244,114,182,0.5)]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                </div>
                                <div
                                    className={`shrink-0 border-t border-white/[0.07] pt-[clamp(0.12rem,0.45vmin,0.28rem)] text-center font-mono text-[clamp(0.5rem,1.3vmin,0.65rem)] font-bold tabular-nums leading-none tracking-tight ${
                                    usable && session && !canClaim
                                        ? 'text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]'
                                        : 'text-fuchsia-200/90'
                                    }`}
                                >
                                    {usable && session
                                        ? canClaim
                                            ? formatPairHatcheryRemainHMS(0)
                                            : formatPairHatcheryRemainHMS(remainMs)
                                        : durationHMS}
                                </div>
                            </div>
                        </div>
                        {infoPanel}
                    </div>
                </div>
            );
        };

        const eggThumbSrc =
            MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ?? PAIR_EGG_DISPLAY_IMAGE;

        return (
            <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.25rem,0.9vmin,0.5rem)] overflow-hidden">
                <div className="flex shrink-0 justify-end">
                    <div className="flex items-center gap-[clamp(0.25rem,0.9vmin,0.45rem)] rounded-xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-950/50 to-violet-950/40 px-[clamp(0.45rem,1.4vmin,0.75rem)] py-[clamp(0.2rem,0.75vmin,0.45rem)] shadow-[0_0_20px_rgba(192,38,211,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-fuchsia-500/10">
                        <div className="relative shrink-0">
                            <div className="absolute inset-0 rounded-lg bg-fuchsia-500/25 blur-md" aria-hidden />
                            <img
                                src={eggThumbSrc}
                                alt=""
                                className="relative h-[clamp(1.35rem,6vmin,2rem)] w-[clamp(1.35rem,6vmin,2rem)] shrink-0 rounded-lg object-contain ring-1 ring-white/20"
                                loading="lazy"
                            />
                        </div>
                        <span className="text-[clamp(0.72rem,2vmin,0.875rem)] font-black tabular-nums tracking-tight text-fuchsia-50 drop-shadow-sm">
                            {eggCount}
                        </span>
                    </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col [gap:clamp(0.2rem,0.85vmin,0.5rem)]">
                    {PAIR_HATCHERY_SLOT_DEFS.map((d) => renderSlot(d.slotIndex))}
                </div>
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
        if (aiTab === 'info') {
            return (
                <InvThumb
                    key={it.id}
                    item={it}
                    selected={selectedLobbyItemId === it.id}
                    disabled={isBusy}
                    onClick={() => {
                        setSelectedLobbyItemId(it.id);
                    }}
                    showRepresentativeBadge={representativeThumb}
                />
            );
        }
        if (aiTab === 'training') {
            const slotsNorm = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
            const inTrain = isItemIdInPairTraining(slotsNorm, it.id);
            const isRepPet = Boolean(
                isPairPetMaterial(it) &&
                    !isPairEggItem(it) &&
                    it.templateId &&
                    equippedTid &&
                    it.templateId === equippedTid &&
                    (!equippedItemId || equippedItemId === it.id),
            );
            const dragPet =
                isPairPetMaterial(it) && !isPairEggItem(it) && !inTrain && !isRepPet && !useTapTrainingFlow;
            const canTapPetToTrain =
                useTapTrainingFlow && isPairPetMaterial(it) && !isPairEggItem(it) && !inTrain && !isRepPet;
            const trainInvTitle = useTapTrainingFlow
                ? trainingMobilePickSlotIndex == null
                    ? '먼저 위쪽 빈 수련 슬롯을 누른 뒤 펫을 선택하세요.'
                    : isRepPet
                      ? '대표 펫은 수련에 보낼 수 없습니다.'
                      : undefined
                : isRepPet
                  ? '대표 펫은 수련에 보낼 수 없습니다.'
                  : undefined;
            return (
                <div
                    key={it.id}
                    draggable={!isBusy && dragPet}
                    onDragStart={(e) => {
                        if (!dragPet || isBusy) return;
                        e.dataTransfer.setData('text/pair-training-pet', it.id);
                        e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="min-w-0"
                >
                    <InvThumb
                        item={it}
                        selected={false}
                        disabled={isBusy || inTrain || isRepPet}
                        onClick={() => {
                            if (!canTapPetToTrain || trainingMobilePickSlotIndex == null) return;
                            setTrainingStartConfirm({ slotIndex: trainingMobilePickSlotIndex, itemId: it.id });
                            setTrainingMobilePickSlotIndex(null);
                        }}
                        showRepresentativeBadge={representativeThumb}
                        title={trainInvTitle}
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
                    onClick={() => void equipPet(tid, it.id)}
                    showRepresentativeBadge={representativeThumb}
                />
            );
        }
        return <InvReadonly key={it.id} item={it} />;
    };

    const expandLabel = expandTarget === 'pet' ? '펫' : '';

    const trainingTabContent = (() => {
        void trainingTick;
        const trainingSlots = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
        const now = Date.now();

        const formatRemain = (ms: number) => {
            const s = Math.ceil(ms / 1000);
            const m = Math.floor(s / 60);
            const r = s % 60;
            return `${m}:${r.toString().padStart(2, '0')}`;
        };

        const onDropStart = (slotIndex: number, e: React.DragEvent) => {
            e.preventDefault();
            if (trainingStartConfirm != null || isBusy) return;
            const itemId = e.dataTransfer.getData('text/pair-training-pet');
            if (!itemId) return;
            setTrainingStartConfirm({ slotIndex, itemId });
        };

        const claim = async (slotIndex: number) => {
            await applyPetAction({ type: 'PAIR_PET_CLAIM_TRAINING', payload: { slotIndex } });
        };

        const padTime2 = (n: number) => String(n).padStart(2, '0');

        /** 수련 탭: 모바일 한 화면 정보 밀도 */
        const trLbl =
            'whitespace-nowrap text-xs font-extrabold leading-none tracking-wide sm:text-sm';
        const trAmt = 'text-center text-xs font-bold tabular-nums leading-tight sm:text-sm';
        const trSlotTitle =
            'line-clamp-2 text-center text-xs font-extrabold leading-snug text-violet-100 sm:text-sm';
        const trSlotHint = 'text-center text-xs font-semibold leading-tight sm:text-sm';
        const trMono = 'text-xs font-bold tabular-nums font-mono leading-none sm:text-sm';

        return (
            <div className="space-y-2">
                {useTapTrainingFlow ? (
                    <p className="rounded-md border border-violet-500/25 bg-violet-950/30 px-2 py-1.5 text-center text-[0.65rem] font-semibold leading-snug text-violet-100/95 sm:text-xs">
                        빈 수련 슬롯을 누른 뒤 아래 인벤토리에서 펫을 고르면 확인 창이 열립니다. 대표 펫은 수련에 보낼 수 없습니다.
                    </p>
                ) : (
                    <p className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-center text-[0.65rem] font-semibold text-slate-400 sm:text-xs">
                        펫을 슬롯에 놓으면 확인 후 수련이 시작됩니다.
                    </p>
                )}
                    {PAIR_TRAINING_SLOT_DEFS.map((def) => {
                        const i = def.slotIndex;
                        const unlocked = isPairTrainingSlotUnlocked(currentUser, i);
                        const reqW = PAIR_TRAINING_UNLOCK_WINS[i]!;
                        const minLv = minPetLevelForTrainingSlot(i);
                        const isVipTrainingSlot = Boolean(def.requiresFunctionVip);
                        const session = trainingSlots[i];
                        const petRow = session ? inventory.find((x) => x.id === session.itemId) : null;
                        const endAt = session ? trainingEndsAt(session.startedAt, i) : 0;
                        const canClaim = Boolean(session && now >= endAt);
                        const remainMs = session && !canClaim ? Math.max(0, endAt - now) : 0;
                        const durationTotalSec = Math.max(0, Math.floor(def.durationMs / 1000));
                        const durationHh = Math.floor(durationTotalSec / 3600);
                        const durationMm = Math.floor((durationTotalSec % 3600) / 60);
                        const durationSs = durationTotalSec % 60;
                        const durationHhMmSs = `${padTime2(durationHh)}:${padTime2(durationMm)}:${padTime2(durationSs)}`;

                        const showSoulCandidates = def.soulDropChance > 0 && def.soulTable.length > 0;
                        const rewardScrollRow =
                            'flex min-w-0 max-w-full flex-nowrap items-end justify-center overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
                        const goldDisplay =
                            def.goldMin === def.goldMax
                                ? def.goldMin.toLocaleString()
                                : `${def.goldMin.toLocaleString()}~${def.goldMax.toLocaleString()}`;
                        const rewardPanel = (
                            <div
                                className={`flex min-h-0 min-w-0 flex-1 flex-row flex-nowrap items-center justify-center gap-1 self-stretch overflow-x-auto border-l pl-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                                    isVipTrainingSlot ? 'border-amber-500/25' : 'border-white/10'
                                }`}
                            >
                                <div className="flex shrink-0 flex-col items-center gap-1">
                                    <span className={`${trLbl} text-amber-100/95`}>확정보상</span>
                                    <div className="rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-950/35 via-black/30 to-zinc-950/40 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                        <div className={`${rewardScrollRow} gap-2`}>
                                            <div className="flex shrink-0 flex-col items-center gap-1">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/35 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                                    <img
                                                        src="/images/icon/Gold.png"
                                                        alt=""
                                                        className="h-8 w-8 object-contain"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <span className={`${trAmt} text-amber-50`}>{goldDisplay}</span>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-center gap-1">
                                                <div
                                                    className="flex h-10 w-10 flex-col items-center justify-center rounded-md border border-violet-400/45 bg-violet-950/55 px-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                                                    title="펫 경험치"
                                                >
                                                    <span className="text-sm font-black leading-none text-violet-100">펫</span>
                                                    <span className="mt-px text-sm font-black leading-none text-violet-100">EXP</span>
                                                </div>
                                                <span className={`${trAmt} text-violet-100`}>
                                                    {def.xpMin}~{def.xpMax}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {showSoulCandidates ? (
                                    <div className="flex shrink-0 flex-col items-center gap-1">
                                        <span className={`${trLbl} text-cyan-100/95`}>
                                            {def.soulTable.length > 1 ? '확률보상(1종류)' : '확률보상'}
                                        </span>
                                        <div className="rounded-lg border border-cyan-500/25 bg-black/30 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                            <div className={`${rewardScrollRow} gap-1.5`}>
                                                {def.soulTable.map((row, si) => {
                                                    const mat = MATERIAL_ITEMS[row.materialName as keyof typeof MATERIAL_ITEMS];
                                                    const src = mat?.image ?? '/images/materials/soulstone1.webp';
                                                    const grade = mat?.grade ?? ItemGrade.Normal;
                                                    const bgSrc = gradeBackgrounds[grade] ?? gradeBackgrounds[ItemGrade.Normal];
                                                    const isTranscendent = grade === ItemGrade.Transcendent;
                                                    return (
                                                        <div
                                                            key={`train-soul-${i}-${si}`}
                                                            className="flex w-[3rem] shrink-0 flex-col items-center gap-1"
                                                            title={row.materialName}
                                                        >
                                                            <div
                                                                className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border ${
                                                                    isTranscendent
                                                                        ? 'transcendent-grade-slot border-white/25'
                                                                        : 'border-white/20'
                                                                }`}
                                                            >
                                                                <img
                                                                    src={bgSrc}
                                                                    alt=""
                                                                    className="absolute inset-0 h-full w-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                                <img
                                                                    src={src}
                                                                    alt=""
                                                                    className="relative z-[1] h-[58%] w-[58%] object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]"
                                                                    loading="lazy"
                                                                />
                                                            </div>
                                                            <span className={`${trAmt} text-slate-100`}>×{row.quantity}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        );

                        return (
                            <div
                                key={`train-slot-${i}`}
                                className={`flex items-stretch gap-1.5 rounded-xl border p-2 text-sm ${
                                    isVipTrainingSlot
                                        ? unlocked
                                            ? 'border-amber-500/45 bg-gradient-to-br from-amber-950/30 via-zinc-950/50 to-amber-950/20 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-amber-500/15'
                                            : 'border-amber-800/35 bg-amber-950/12 ring-1 ring-amber-900/25'
                                        : unlocked
                                          ? 'border-violet-500/35 bg-violet-950/20'
                                          : 'border-white/10 bg-black/30'
                                }`}
                            >
                                <div className="flex w-[5.5rem] shrink-0 flex-col items-stretch gap-1">
                                    <span
                                        className={`${trSlotTitle} flex flex-col items-center gap-0.5 ${
                                            isVipTrainingSlot ? 'text-amber-100' : ''
                                        }`}
                                    >
                                        {isVipTrainingSlot ? (
                                            <span className="rounded border border-amber-400/50 bg-amber-500/20 px-1 py-px text-[0.55rem] font-black uppercase tracking-wider text-amber-200">
                                                VIP
                                            </span>
                                        ) : null}
                                        <span>{getPairTrainingSlotDisplayName(i)}</span>
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
                                            if (!useTapTrainingFlow || !unlocked || session || isBusy) return;
                                            setTrainingMobilePickSlotIndex((cur) => (cur === i ? null : i));
                                        }}
                                        className={`flex aspect-square w-full shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed p-0.5 ${
                                            unlocked && !session
                                                ? isVipTrainingSlot
                                                    ? 'border-amber-400/55 bg-amber-950/20'
                                                    : 'border-violet-400/50 bg-black/25'
                                                : 'border-white/12 bg-black/20'
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
                                                    <p className="text-center text-[0.65rem] font-extrabold leading-tight text-amber-200/95">
                                                        기능VIP활성화
                                                    </p>
                                                ) : (
                                                    <p className="text-center text-[0.65rem] font-semibold leading-tight text-amber-200/95">
                                                        승리 {reqW}회
                                                    </p>
                                                )}
                                                {minLv > 1 ? (
                                                    <p className="text-center text-[0.62rem] leading-tight text-slate-500">펫 Lv.{minLv}+</p>
                                                ) : (
                                                    <p className="text-center text-[0.62rem] leading-tight text-slate-500">조건 없음</p>
                                                )}
                                            </div>
                                        ) : session && petRow ? (
                                            <img
                                                src={petRow.image}
                                                alt=""
                                                className="max-h-full max-w-full rounded object-contain"
                                                loading="lazy"
                                            />
                                        ) : unlocked ? (
                                            <span
                                                className={`px-0.5 text-center text-xs font-semibold leading-tight ${
                                                    isVipTrainingSlot ? 'text-amber-200/95' : 'text-violet-200/90'
                                                }`}
                                            >
                                                {useTapTrainingFlow
                                                    ? trainingMobilePickSlotIndex === i
                                                        ? '펫 선택'
                                                        : '슬롯 탭'
                                                    : '펫 드롭'}
                                            </span>
                                        ) : null}
                                    </div>
                                    {unlocked && session && petRow ? (
                                        <div className="flex min-h-0 w-full flex-col items-center gap-0.5">
                                            <span className={`${trSlotHint} line-clamp-2 w-full font-bold text-slate-100`}>
                                                {getPairPetDefinition(petRow.templateId!)?.displayName ?? petRow.name}
                                            </span>
                                            {canClaim ? (
                                                <Button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => void claim(i)}
                                                    colorScheme="none"
                                                    className="!min-h-0 w-full !rounded-md !border !border-amber-400/60 !bg-amber-950/40 !px-1 !py-0.5 !text-xs !font-extrabold !text-amber-100"
                                                >
                                                    보상 수령
                                                </Button>
                                            ) : (
                                                <span className={`${trMono} text-cyan-200`}>{formatRemain(remainMs)}</span>
                                            )}
                                        </div>
                                    ) : null}
                                    <span
                                        className={`${trMono} text-center tracking-tight ${
                                            isVipTrainingSlot ? 'text-amber-200/90' : 'text-violet-200/90'
                                        }`}
                                        aria-label={`수련 소요 ${durationHhMmSs}`}
                                    >
                                        {durationHhMmSs}
                                    </span>
                                </div>
                                {rewardPanel}
                            </div>
                        );
                    })}
            </div>
        );
    })();

    const trainingSlotsForUi = normalizePairPetTrainingSlots(currentUser.pairPetTrainingSlots);
    const selectedPetInTraining = Boolean(
        selectedItem && isPairPetMaterial(selectedItem) && isItemIdInPairTraining(trainingSlotsForUi, selectedItem.id),
    );

    const infoDetailPanel =
        aiTab === 'info' ? (
            !selectedItem ? null : isPairPetMaterial(selectedItem) && selectedItem.templateId ? (
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
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2">
                    <PairPetLobbySoulStoneViewer
                        item={selectedItem}
                        isBusy={isBusy}
                        primaryStackId={selectedSoulPrimaryStackId}
                        primaryStackQty={selectedSoulPrimaryStackQty}
                        onSellOne={() => {
                            if (selectedSoulPrimaryStackId) void sellItem(selectedSoulPrimaryStackId, 1);
                        }}
                        onSellAll={() => {
                            if (selectedSoulPrimaryStackId) void sellItem(selectedSoulPrimaryStackId, selectedSoulPrimaryStackQty);
                        }}
                    />
                </div>
            ) : (
                <div
                    className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1.5 sm:p-2 ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS}`}
                >
                    <p className="text-xs text-slate-400 sm:text-sm">이 카테고리에서 지원하지 않는 아이템입니다.</p>
                </div>
            )
        ) : null;

    const tabContent = (
        <>
            {aiTab === 'shop' && (
                <div className="space-y-2 sm:space-y-2.5">
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
                                className={`rounded-md px-1.5 py-1.5 text-[0.65rem] font-extrabold sm:px-2 sm:py-2 sm:text-sm ${
                                    shopSkuTab === id
                                        ? 'bg-amber-500 text-amber-950 shadow-sm shadow-amber-900/40'
                                        : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {shopSkusVisible.map((sku) => (
                            <PairPetShopSkuCard
                                key={sku.id}
                                sku={sku}
                                currentUser={currentUser}
                                isBusy={isBusy}
                                onBuyClick={onPairPetShopBuyClick}
                                descOpen={shopDescSkuId === sku.id}
                                onOpenDesc={() => setShopDescSkuId(sku.id)}
                                onCloseDesc={() => setShopDescSkuId((cur) => (cur === sku.id ? null : cur))}
                            />
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden sm:gap-2">
            <PairPetProfilePanel
                currentUser={currentUser}
                currentUserId={currentUserId}
                isBusy={isBusy}
                onOpenEquippedPetDetail={openEquippedPetDetail}
                onFocusPetInventory={focusInfoPetInventory}
            />

            <div className="grid shrink-0 grid-cols-4 gap-0.5 rounded-lg border border-white/10 bg-black/30 p-0.5 sm:gap-1 sm:p-1">
                <button
                    type="button"
                    onClick={() => setAiTab('info')}
                    className={`rounded-md px-0.5 py-1 text-[0.7rem] font-bold leading-tight sm:px-1 sm:py-1.5 sm:text-sm ${aiTab === 'info' ? 'bg-sky-500 text-sky-950' : 'text-sky-100 hover:bg-sky-950/45'}`}
                >
                    정보
                </button>
                <button
                    type="button"
                    onClick={() => setAiTab('training')}
                    className={`rounded-md px-0.5 py-1 text-[0.7rem] font-bold leading-tight sm:px-1 sm:py-1.5 sm:text-sm ${aiTab === 'training' ? 'bg-violet-500 text-violet-950' : 'text-violet-100 hover:bg-violet-950/45'}`}
                >
                    수련
                </button>
                <button
                    type="button"
                    onClick={() => setAiTab('hatchery')}
                    className={`rounded-md px-0.5 py-1 text-[0.7rem] font-bold leading-tight sm:px-1 sm:py-1.5 sm:text-sm ${aiTab === 'hatchery' ? 'bg-fuchsia-600 text-fuchsia-50' : 'text-fuchsia-100 hover:bg-fuchsia-950/45'}`}
                >
                    부화장
                </button>
                <button
                    type="button"
                    onClick={() => setAiTab('shop')}
                    className={`rounded-md px-0.5 py-1 text-[0.7rem] font-bold leading-tight sm:px-1 sm:py-1.5 sm:text-sm ${aiTab === 'shop' ? 'bg-amber-500 text-amber-950' : 'text-amber-100 hover:bg-amber-950/45'}`}
                >
                    펫 상점
                </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                {showInvStrip ? (
                    <>
                        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                            <div
                                className={`min-h-0 flex-1 rounded-lg border border-white/10 bg-black/25 text-[0.7rem] text-slate-200 sm:text-xs ${
                                    aiTab === 'hatchery'
                                        ? 'flex flex-col overflow-hidden p-1.5 sm:p-2'
                                        : aiTab === 'info'
                                          ? `flex min-h-0 flex-col overflow-hidden p-0 sm:p-0`
                                          : `overflow-y-auto overscroll-y-contain p-1.5 sm:p-2 ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS}`
                                }`}
                            >
                                {aiTab === 'info' ? infoDetailPanel : null}
                                {aiTab === 'training' ? trainingTabContent : null}
                                {aiTab === 'hatchery' ? hatcheryTabContent : null}
                            </div>
                        </div>
                        {aiTab !== 'hatchery' ? (
                        <div className="flex min-h-0 min-w-0 shrink-0 grow-0 basis-[30%] flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/40">
                            <div className="mb-1 shrink-0 rounded-md bg-gray-900/50 p-1 sm:mb-1.5 sm:p-1.5">
                                <div className="flex min-w-0 flex-nowrap items-center gap-2">
                                    <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
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
                                                    className={`rounded-md px-1.5 py-1.5 text-[0.65rem] font-extrabold sm:px-2 sm:py-2 sm:text-sm ${
                                                        invStripTabHighlight === id
                                                            ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-900/40'
                                                            : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                                                    } ${soulLocked ? 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-300' : ''}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <label className="flex shrink-0 items-center gap-1 text-[0.65rem] font-bold text-slate-400 sm:gap-1.5 sm:text-xs">
                                        <span className="sr-only">정렬</span>
                                        <select
                                            value={invSort}
                                            onChange={(e) => setInvSort(e.target.value as InvSortMode)}
                                            disabled={isBusy || effectiveInvFilter === 'soul'}
                                            className={`max-w-[8.5rem] rounded-md border border-white/15 bg-black/50 py-1 pl-1.5 pr-6 text-[0.7rem] font-bold text-slate-100 shadow-inner shadow-black/30 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-45 sm:max-w-[9.5rem] sm:py-1.5 sm:pl-2 sm:pr-7 sm:text-sm ${
                                                effectiveInvFilter === 'pet' ? 'cursor-pointer' : ''
                                            }`}
                                        >
                                            <option value="recent">최근 획득순</option>
                                            <option value="oldest">오래된순</option>
                                            <option value="name">이름순</option>
                                        </select>
                                    </label>
                                    <div
                                        className="ml-auto min-w-[6ch] shrink-0 tabular-nums text-right sm:min-w-[7ch]"
                                        title={
                                            effectiveInvFilter === 'pet' && hiddenInvCount > 0
                                                ? `슬롯 밖 ${hiddenInvCount}개`
                                                : undefined
                                        }
                                    >
                                        <div
                                            className={`text-sm font-extrabold tracking-tight text-slate-100 sm:text-lg ${
                                                effectiveInvFilter === 'soul' ? 'invisible' : ''
                                            }`}
                                        >
                                            {Math.min(pairPetMaterialCount, slotCountPet)} / {slotCountPet}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div
                                className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-md bg-black/30 p-1.5 ${PET_LOBBY_BAG_SCROLLBAR_Y_CLASS}`}
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                {effectiveInvFilter === 'soul' ? (
                                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                                        {PAIR_SOULSTONE_TEMPLATE_IDS.map((tid, idx) => {
                                            const name = PAIR_SOULSTONE_NAMES[idx]!;
                                            const meta = MATERIAL_ITEMS[name as keyof typeof MATERIAL_ITEMS];
                                            const img = meta?.image ?? `/images/materials/soulstone${idx + 1}.webp`;
                                            const soulGrade = meta?.grade ?? ItemGrade.Normal;
                                            const qty = soulQtyByTemplateId.get(tid) ?? 0;
                                            const slotKey = `${SOUL_SLOT_PREFIX}${tid}`;
                                            return (
                                                <SoulStoneFixedThumb
                                                    key={tid}
                                                    imageUrl={img}
                                                    qty={qty}
                                                    grade={soulGrade}
                                                    selected={aiTab === 'info' && selectedLobbyItemId === slotKey}
                                                    disabled={isBusy || aiTab !== 'info'}
                                                    onClick={() => setSelectedLobbyItemId(slotKey)}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                                        {Array.from({ length: slotCount }, (_, i) => renderLobbyGridSlot(sortedFilteredInv[i], i))}
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
                        ) : null}
                    </>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-2 text-xs text-slate-200">
                        {aiTab === 'shop' ? tabContent : null}
                    </div>
                )}
            </div>

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
                    isBusy={isBusy}
                    onClose={() => setSoulConvertItem(null)}
                    onConfirm={() => void confirmSoulConvert()}
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
                    initialWidth={420}
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
                        return (
                            <div className="relative overflow-hidden">
                                <div
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-18%,rgba(139,92,246,0.32),transparent_55%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)48%,rgba(59,7,100,0.32)100%)]"
                                    aria-hidden
                                />
                                <div className="relative px-5 pb-5 pt-6 text-center sm:px-6 sm:pb-6 sm:pt-7">
                                    {petRow ? (
                                        <div className="mx-auto mb-4 flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-xl border border-violet-400/40 bg-black/35 p-1 shadow-inner sm:h-[5.75rem] sm:w-[5.75rem]">
                                            <img src={petRow.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                                        </div>
                                    ) : null}
                                    <h3 className="text-base font-black leading-snug text-violet-50 sm:text-lg">
                                        <span className="text-white">{petName}</span> 펫을
                                        <br />
                                        <span className="text-violet-200">{slotLabel}</span>에 보낼까요?
                                    </h3>
                                    <p className="mx-auto mt-3 max-w-sm text-left text-[0.7rem] font-semibold leading-relaxed text-slate-300 sm:text-xs">
                                        수련이 진행되는 동안 이 펫은 페어바둑에 출전할 수 없습니다. 대표 펫으로 지정된 펫은 수련에 보낼 수 없으며, 수련 중에는
                                        대표 펫으로 바꿀 수 없습니다.
                                    </p>
                                    <div className="mx-auto mt-5 flex max-w-sm flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setTrainingStartConfirm(null)}
                                            disabled={isBusy}
                                            className="order-2 w-full min-w-[8rem] rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-45 sm:order-1 sm:w-auto"
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
                                            className="order-1 w-full min-w-[8rem] !rounded-full !border !border-violet-400/55 !bg-gradient-to-r !from-violet-600 !via-violet-500 !to-fuchsia-600 !px-6 !py-2.5 !text-sm !font-black !text-white !shadow-[0_8px_26px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.18)] hover:!from-violet-500 hover:!via-violet-400 hover:!to-fuchsia-500 disabled:!opacity-40 sm:order-2 sm:w-auto"
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

            {hatcheryPetInvFullModalOpen ? (
                <DraggableWindow
                    title="안내"
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
                            <p className="text-[0.95rem] font-semibold leading-relaxed text-rose-100/95">
                                {PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE}
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
                        const outcome = d ? hatcheryLevelOutcomeLine(d) : null;
                        const eggImg =
                            MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS]?.image ?? PAIR_EGG_DISPLAY_IMAGE;
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
                                            신비로운알 ×1
                                        </h3>
                                        {d ? (
                                            <p className="mt-3 font-mono text-sm font-semibold tabular-nums tracking-tight text-fuchsia-200/95">
                                                부화 시간 : {formatHatcheryDurationHMS(d.durationMs)}
                                            </p>
                                        ) : null}
                                        {outcome ? (
                                            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/25 px-3 py-2 text-xs font-semibold text-amber-100/95">
                                                {outcome}
                                            </div>
                                        ) : null}
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
                                                if (res && (res as { error?: string }).error) return;
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
                        const endM = sessionM && si !== null ? hatcheryEndsAt(sessionM.startedAt, si) : 0;
                        const canClaimM = Boolean(sessionM && nowM >= endM);
                        const remainMsM = sessionM && !canClaimM ? Math.max(0, endM - nowM) : 0;
                        const costM =
                            sessionM && !canClaimM && remainMsM > 0 ? Math.max(1, Math.ceil(remainMsM / 60_000)) : 0;
                        const hasEnoughM =
                            Boolean(currentUser.isAdmin) || (currentUser.diamonds ?? 0) >= costM;
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
                                                    <img src="/images/icon/Zem.png" alt="" className="h-5 w-5 shrink-0" />
                                                    <span className="text-lg font-black text-cyan-50">{costM}</span>
                                                </span>
                                            </div>
                                            {!currentUser.isAdmin ? (
                                                <p className="mt-2 text-[0.7rem] text-slate-400">
                                                    보유{' '}
                                                    <span className="font-bold tabular-nums text-slate-200">
                                                        {(currentUser.diamonds ?? 0).toLocaleString()}
                                                    </span>
                                                </p>
                                            ) : null}
                                            {!hasEnoughM && !currentUser.isAdmin ? (
                                                <p className="mt-2 text-xs font-semibold text-rose-300">다이아가 부족합니다.</p>
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
                                                !hasEnoughM
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
                                                    <img src="/images/icon/Zem.png" alt="" className="h-3.5 w-3.5" />
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
                        image: pairShopPurchaseSku.image,
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
