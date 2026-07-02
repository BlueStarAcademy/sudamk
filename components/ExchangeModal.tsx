import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tx } from '../shared/i18n/runtimeText.js';
import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';

/** Persisted exchange history markers (Unicode — local/server history matching, not UI copy) */
const HX_PURCHASE_DONE = '\uAD6C\uB9E4 \uC644\uB8CC';
const HX_SETTLEMENT_ONE = '\uC815\uC0B0 \uC218\uB9BD';
const HX_SETTLEMENT_ALL = '\uC815\uC0B0 \uBAA8\uB450 \uC218\uB9BD';
const HX_GOLD = '\uACE8\uB4DC';
const HX_DIA = '\uB514\uC774\uC544';
const HX_FEE = '\uC218\uC218\uB8CC';
/** 이력 파싱용 — 저장 문자열은 locale과 무관하게 고정 */
const HX_CURRENCY_SUFFIX_PATTERN = `${HX_GOLD}|${HX_DIA}|Gold|Diamonds`;

const isHistoryGoldSuffix = (suffix: string | undefined): boolean => suffix === HX_GOLD || suffix === 'Gold';
import type { InventoryItem, User, UserWithStatus, ServerAction, EquipmentSlot } from '../types.js';
import type { HandleActionResult } from '../types/api.js';
import { ItemGrade } from '../types/enums.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import InventoryGrid from './blacksmith/InventoryGrid.js';
import ResourceActionButton from './ui/ResourceActionButton.js';
import AlertModal from './AlertModal.js';
import ItemObtainedModal from './ItemObtainedModal.js';
import BulkItemObtainedModal from './BulkItemObtainedModal.js';
import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';
import { isFunctionVipActive } from '../shared/utils/rewardVip.js';
import {
    MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS,
    MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS,
    MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH,
} from '../shared/constants/mobileEquipmentDetailModal.js';
import { EQUIPMENT_POOL, gradeBackgrounds, gradeStyles } from '../constants/items.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { maxExchangeListPrice } from '../shared/constants/numericLimits.js';
import { clampDigitsOnlyInputString, clampGameInt, exchangeListingFeeFromPrice } from '../shared/utils/gameIntegerField.js';
import { formatGoldAmountKoG, formatWalletCurrencyAmount, formatWalletDiamonds } from '../shared/utils/walletAmountDisplay.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import {
    countTradeListingTickets,
    MAX_EXCHANGE_SELL_SLOTS,
    resolveAllowedListingCount,
    requiresTradeListingTicket,
    TRADE_LISTING_TICKET_NAME,
} from '../shared/utils/tradeListingTicket.js';
import ExchangeTradeTicketBadge from './exchange/ExchangeTradeTicketBadge.js';
import ExchangeCurrencyTab from './exchange/ExchangeCurrencyTab.js';

type ExchangeTab = 'buy' | 'currency' | 'sell' | 'settlement' | 'history';
type SaleCurrency = 'gold' | 'diamonds';
type InventorySortKey = 'createdAt' | 'grade' | 'name';
type BuySortColumn = 'latest' | 'name' | 'currentPrice' | 'lowestPrice';
type SortDirection = 'asc' | 'desc';
type BuySlotFilter = 'all' | EquipmentSlot;
type BuyGradeFilter = 'all' | ItemGrade;
type BuyCurrencyFilter = 'all' | SaleCurrency;

type ExchangeListing = {
    id: string;
    sellerId: string;
    sellerNickname: string;
    itemId: string;
    itemName: string;
    itemImage?: string;
    itemSlot?: EquipmentSlot;
    itemGrade?: string;
    itemStars?: number;
    itemLevel?: number;
    price: number;
    currency: SaleCurrency;
    verificationStatus: 'verifying' | 'active';
    createdAt: number;
    verificationEndsAt?: number;
    expiresAt: number;
    status: 'listed' | 'sold';
    soldAt?: number;
    /** {t('labels.registerSale')} 시점 장비 스냅샷(옵션·제련 등). {t('modals.purchase')}자 상세 표시에 사용 */
    listedEquipment?: InventoryItem;
};

type SettlementItem = {
    listingId: string;
    itemId: string;
    itemName: string;
    soldPrice: number;
    currency: SaleCurrency;
    soldAt: number;
    claimed: boolean;
};
type PendingRegistration = {
    item: InventoryItem;
    price: number;
    currency: SaleCurrency;
    fee: number;
};
type PendingCancelListing = {
    listingId: string;
    itemName: string;
    itemImage?: string;
    itemGrade?: ItemGrade;
    itemStars?: number;
};
type PurchaseSuccessData = {
    listing: ExchangeListing;
    inventoryItem?: InventoryItem | null;
};
interface ExchangeModalProps {
    currentUser: UserWithStatus;
    /** 서버 `usersMap` 배열 또는 id→유저 맵 */
    allUsers?: Record<string, UserWithStatus> | UserWithStatus[] | User[];
    onClose: () => void;
    onAction?: (action: ServerAction) => void | Promise<void | HandleActionResult | { error?: string }>;
    isTopmost?: boolean;
    /** 판매 {t('labels.registerSale')}·{t('modals.purchase')} 미리보기 장비를 ItemDetailModal로 표시 (두 번째 인자: 내 소유 여부) */
    onViewListedEquipment?: (item: InventoryItem, isOwnedByCurrentUser?: boolean) => void;
    embedded?: boolean;
}

/** 등록 직후 서버에 아직 없는 id는 {t('labels.keep', { defaultValue: 'Keep' })}하고, 동일 id는 서버 행으로 덮어씀 */
const mergeExchangeListingsPreferServer = (local: ExchangeListing[], server: ExchangeListing[]): ExchangeListing[] => {
    const serverIds = new Set(server.filter((l) => l?.id).map((l) => l.id));
    const pendingLocal = local.filter((l) => l?.id && !serverIds.has(l.id));
    const byId = new Map<string, ExchangeListing>();
    for (const l of pendingLocal) byId.set(l.id, l);
    for (const l of server) {
        if (l?.id) byId.set(l.id, l);
    }
    return [...byId.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
};

const LISTING_MAX_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const VERIFICATION_MS = 30 * 1000;
/** 모달 최초 오픈 시 구매 목록 API와 동시에 보여줄 최소 대기 시간(ms) */
const EXCHANGE_MODAL_OPENING_LOAD_MS = 3000;
/** 만료 물품 연속 회수 시 서버 검증·동기화 간격(회수 버튼 공통 쿨다운) */
const EXCHANGE_LISTING_RECOVER_COOLDOWN_MS = 5000;

function cloneListedEquipmentSnapshot(item: InventoryItem): InventoryItem {
    try {
        return JSON.parse(JSON.stringify(item)) as InventoryItem;
    } catch {
        return { ...item, options: item.options ? JSON.parse(JSON.stringify(item.options)) : undefined };
    }
}

function isListingEquipmentSnapshot(v: unknown): v is InventoryItem {
    return Boolean(
        v &&
            typeof v === 'object' &&
            (v as InventoryItem).type === 'equipment' &&
            typeof (v as InventoryItem).name === 'string' &&
            typeof (v as InventoryItem).id === 'string',
    );
}

/** 타인 등록 건: `listedEquipment` 우선, 없으면 목록 필드 + 풀 템플릿 */
function normalizeExchangeAssetPath(raw: string): string {
    const t = raw.trim();
    if (!t) return '';
    return t.startsWith('/') ? t : `/${t}`;
}

/** 거래 이력: 동일 이름 다건일 때 가격·재화(및 {t('tabs.settlement')} 시 판매가=실수령+수수료)으로 등록 건 추정 */
function pickExchangeListingForHistoryLine(
    listings: ExchangeListing[],
    line: string,
    itemName: string | undefined,
    priceAmount: number,
    priceCurrency: SaleCurrency | null,
    feeAmount: number,
    feeCurrency: SaleCurrency | null,
): ExchangeListing | null {
    const name = itemName?.trim();
    if (!name) return null;
    const byName = listings.filter((l) => l.itemName === name);
    if (byName.length === 0) return null;
    const pickNewest = (arr: ExchangeListing[]) =>
        [...arr].sort((a, b) => (b.soldAt ?? b.createdAt ?? 0) - (a.soldAt ?? a.createdAt ?? 0))[0] ?? null;

    if (line.includes(HX_PURCHASE_DONE) && priceCurrency) {
        const priced = byName.filter((l) => l.price === priceAmount && l.currency === priceCurrency);
        if (priced.length > 0) return pickNewest(priced);
    }
    if (
        line.includes(HX_SETTLEMENT_ONE) &&
        priceCurrency &&
        feeCurrency === priceCurrency &&
        feeAmount > 0 &&
        priceAmount > 0
    ) {
        const soldPrice = priceAmount + feeAmount;
        const priced = byName.filter((l) => l.price === soldPrice && l.currency === priceCurrency);
        if (priced.length > 0) return pickNewest(priced);
    }
    return pickNewest(byName);
}

function resolveExchangeHistoryRowVisual(
    itemName: string | undefined,
    listing: ExchangeListing | null,
    inventoryItem: InventoryItem | undefined,
    line: string,
): { itemImage: string; itemGrade: ItemGrade; itemStars: number } {
    const name = itemName?.trim();
    const genericFallback = '/images/Box/ResourceBox1.webp';
    if (!name) {
        return {
            itemImage: line.includes('\uC815\uC0B0') ? '/images/Box/GoldBox3.webp' : genericFallback,
            itemGrade: ItemGrade.Normal,
            itemStars: 0,
        };
    }

    const imgListed = listing?.itemImage?.trim();
    if (imgListed) {
        return {
            itemImage: imgListed.startsWith('/') ? imgListed : `/${imgListed}`,
            itemGrade: ((listing?.itemGrade as ItemGrade | undefined) ?? inventoryItem?.grade ?? ItemGrade.Normal) as ItemGrade,
            itemStars: listing?.itemStars ?? inventoryItem?.stars ?? 0,
        };
    }

    const snap = listing?.listedEquipment;
    if (isListingEquipmentSnapshot(snap) && snap.image?.trim()) {
        return {
            itemImage: normalizeExchangeAssetPath(snap.image),
            itemGrade: (snap.grade as ItemGrade) ?? (listing?.itemGrade as ItemGrade) ?? inventoryItem?.grade ?? ItemGrade.Normal,
            itemStars: snap.stars ?? listing?.itemStars ?? inventoryItem?.stars ?? 0,
        };
    }

    const gradeHint = (listing?.itemGrade as ItemGrade | undefined) ?? inventoryItem?.grade ?? ItemGrade.Normal;
    const poolMatch =
        EQUIPMENT_POOL.find((p) => p.name === name && p.grade === gradeHint) ?? EQUIPMENT_POOL.find((p) => p.name === name);
    const poolImage = poolMatch?.image ? normalizeExchangeAssetPath(poolMatch.image) : '';
    const invImg = inventoryItem?.image?.trim();
    const itemImage =
        poolImage ||
        (invImg ? (invImg.startsWith('/') ? invImg : `/${invImg}`) : '') ||
        genericFallback;

    const itemGrade = (poolMatch?.grade as ItemGrade | undefined) ??
        inventoryItem?.grade ??
        (listing?.itemGrade as ItemGrade | undefined) ??
        ItemGrade.Normal;
    const itemStars = listing?.itemStars ?? inventoryItem?.stars ?? 0;

    return { itemImage, itemGrade, itemStars };
}

function buildBuyPreviewInventoryItem(listing: ExchangeListing): InventoryItem {
    const raw = listing.listedEquipment as unknown;
    if (isListingEquipmentSnapshot(raw)) {
        return {
            ...raw,
            id: `exchange-listing:${listing.id}`,
            isExchangeListed: true,
            isEquipped: false,
        };
    }
    const grade = (listing.itemGrade ?? ItemGrade.Normal) as ItemGrade;
    const name = listing.itemName?.trim() || tx('exchange:fallbackGear');
    const templateMatch =
        EQUIPMENT_POOL.find((p) => p.name === name && p.grade === grade) ?? EQUIPMENT_POOL.find((p) => p.name === name);
    const image = (listing.itemImage && listing.itemImage.trim()) || templateMatch?.image || '';
    const slot = (listing.itemSlot ?? templateMatch?.slot ?? null) as InventoryItem['slot'];
    const levelRaw = listing.itemLevel;
    const level = typeof levelRaw === 'number' && Number.isFinite(levelRaw) ? levelRaw : 1;
    return {
        id: `exchange-listing:${listing.id}`,
        name,
        description: templateMatch?.description ?? '',
        type: 'equipment',
        slot,
        level,
        isEquipped: false,
        createdAt: listing.createdAt ?? Date.now(),
        image,
        grade,
        stars: listing.itemStars ?? 0,
        isBound: false,
        isExchangeListed: true,
    };
}

const formatCurrency = (value: number, currency: SaleCurrency): string =>
    `${formatWalletCurrencyAmount(value, currency)}${currency === 'gold' ? tx('common:resources.gold') : tx('common:resources.diamonds')}`;

/** 거래 이력 저장·파싱용 (재화 접미사 고정 — UI 언어와 무관) */
const formatHistoryCurrencyAmount = (value: number, currency: SaleCurrency): string =>
    `${formatWalletCurrencyAmount(value, currency)}${currency === 'gold' ? HX_GOLD : HX_DIA}`;

function formatExchangeHistoryTimestamp(raw: string, locale: string): string {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '-') return trimmed || '-';
    const ms = Date.parse(trimmed);
    if (Number.isNaN(ms)) return trimmed;
    return new Date(ms).toLocaleString(locale);
}

/** 거래소 정산 수령 → 공통 아이템 획득 모달(ItemObtainedModal)용 가상 인벤 행 */
function createExchangeSettlementCurrencyObtainItem(currency: SaleCurrency, quantity: number): InventoryItem {
    const now = Date.now();
    const isGold = currency === 'gold';
    return {
        id: `exchange-settlement-reward-${isGold ? 'gold' : 'diamonds'}-${now}-${Math.random().toString(36).slice(2, 9)}`,
        name: isGold ? tx('common:resources.gold') : tx('common:resources.diamonds'),
        description: '',
        type: 'consumable',
        slot: null,
        quantity: Math.max(0, quantity),
        level: 1,
        isEquipped: false,
        createdAt: now,
        image: isGold ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp',
        grade: ItemGrade.Normal,
        stars: 0,
    };
}

const minPriceByCurrency: Record<SaleCurrency, number> = {
    gold: 100,
    diamonds: 10,
};
const BAG_SCROLLBAR_Y_CLASS =
    '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/38 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/48';

/** 거래 이력 탭에 표시: 구매 완료·정산 수령(판매 대금)만 */
const isExchangeHistoryLineForDisplay = (line: string): boolean =>
    line.includes(HX_PURCHASE_DONE) || line.includes(HX_SETTLEMENT_ALL) || line.includes(HX_SETTLEMENT_ONE);

const getBuyListingGroupKey = (entry: Pick<ExchangeListing, 'itemName' | 'itemGrade' | 'itemStars' | 'itemSlot' | 'currency'>): string =>
    [entry.itemName, entry.itemGrade ?? ItemGrade.Normal, entry.itemStars ?? 0, entry.itemSlot ?? 'none', entry.currency].join('::');

const getStarVisual = (stars: number): { image: string; color: string } | null => {
    if (stars >= 10) return { image: '/images/equipments/Star4.webp', color: 'prism-text-effect' };
    if (stars >= 7) return { image: '/images/equipments/Star3.webp', color: 'text-purple-400' };
    if (stars >= 4) return { image: '/images/equipments/Star2.webp', color: 'text-amber-400' };
    if (stars >= 1) return { image: '/images/equipments/Star1.webp', color: 'text-white' };
    return null;
};

const ExchangeModal: React.FC<ExchangeModalProps> = ({
    currentUser,
    allUsers,
    onClose,
    onAction,
    isTopmost,
    onViewListedEquipment,
    embedded = false,
}) => {
    const { t, i18n: i18nInst } = useTranslation('exchange');
    const { t: tCommon } = useTranslation('common');
    const localizedGrade = useLocalizedItemGrade();
    const BUY_SLOT_FILTER_OPTIONS = useMemo<Array<{ value: BuySlotFilter; label: string }>>(
        () => [
            { value: 'all', label: t('filters.typeAll') },
            { value: 'fan', label: t('filters.slotFan') },
            { value: 'board', label: t('filters.slotBoard') },
            { value: 'top', label: t('filters.slotTop') },
            { value: 'bottom', label: t('filters.slotBottom') },
            { value: 'bowl', label: t('filters.slotBowl') },
            { value: 'stones', label: t('filters.slotStones') },
        ],
        [t],
    );
    const buyCurrencyFilterOptions = useMemo<Array<{ value: BuyCurrencyFilter; label: string }>>(
        () => [
            { value: 'all', label: t('filters.currencyAll') },
            { value: 'gold', label: t('filters.goldProducts') },
            { value: 'diamonds', label: t('filters.diamondProducts') },
        ],
        [t],
    );
    const buyGradeFilterOptions = useMemo<Array<{ value: BuyGradeFilter; label: string }>>(
        () => [
            { value: 'all', label: t('filters.gradeAll') },
            { value: ItemGrade.Normal, label: t('filters.gradeNormal') },
            { value: ItemGrade.Uncommon, label: t('filters.gradeUncommon') },
            { value: ItemGrade.Rare, label: t('filters.gradeRare') },
            { value: ItemGrade.Epic, label: t('filters.gradeEpic') },
            { value: ItemGrade.Legendary, label: t('filters.gradeLegendary') },
            { value: ItemGrade.Mythic, label: t('filters.gradeMythic') },
            { value: ItemGrade.Transcendent, label: t('filters.gradeTranscendent') },
        ],
        [t],
    );
    const { isNativeMobile } = useNativeMobileShell();
    const mobileExchange = Boolean(isNativeMobile);
    const [activeTab, setActiveTab] = useState<ExchangeTab>('buy');
    const [saleCurrency, setSaleCurrency] = useState<SaleCurrency>('gold');
    const [salePrice, setSalePrice] = useState<string>('100');
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [selectedBuyListingId, setSelectedBuyListingId] = useState<string>('');
    const [selectedSettlementId, setSelectedSettlementId] = useState<string>('');
    const [buySearchText, setBuySearchText] = useState<string>('');
    const [buySortColumn, setBuySortColumn] = useState<BuySortColumn>('latest');
    const [buySortDirection, setBuySortDirection] = useState<SortDirection>('desc');
    const [buySlotFilter, setBuySlotFilter] = useState<BuySlotFilter>('all');
    const [buyGradeFilter, setBuyGradeFilter] = useState<BuyGradeFilter>('all');
    const [buyCurrencyFilter, setBuyCurrencyFilter] = useState<BuyCurrencyFilter>('all');
    const [marketListingsRemote, setMarketListingsRemote] = useState<ExchangeListing[]>([]);
    const [marketListingsLoaded, setMarketListingsLoaded] = useState(false);
    const [isRefreshingBuyListings, setIsRefreshingBuyListings] = useState(false);
    /** 구매 탭 수동 새로고침 버튼: 클릭 후 5초간 비활성 (자동 폴링과 무관) */
    const [buyManualRefreshCooldownUntilMs, setBuyManualRefreshCooldownUntilMs] = useState(0);
    /** 최초 마운트: API로 목록을 받는 동시 최소 `EXCHANGE_MODAL_OPENING_LOAD_MS` 경과 후 구매 탭 목록 표시 */
    const [exchangeBuyListingsRevealReady, setExchangeBuyListingsRevealReady] = useState(false);
    const [inventorySortKey, setInventorySortKey] = useState<InventorySortKey>('createdAt');
    const [nowMs, setNowMs] = useState<number>(Date.now());
    const [walletGold, setWalletGold] = useState<number>(currentUser.gold ?? 0);
    const [walletDiamonds, setWalletDiamonds] = useState<number>(currentUser.diamonds ?? 0);
    React.useEffect(() => {
        setWalletGold(currentUser.gold ?? 0);
        setWalletDiamonds(currentUser.diamonds ?? 0);
    }, [currentUser.gold, currentUser.diamonds]);
    const [history, setHistory] = useState<string[]>(() => (currentUser.exchangeState?.history as string[] | undefined) ?? []);
    /** 마운트 직후 SAVE_EXCHANGE_STATE가 빈 history로 서버를 덮어쓰지 않도록 첫 1회 저장 생략 */
    const skipInitialExchangePersist = useRef(true);
    const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
    const [pendingTicketUsageRegistration, setPendingTicketUsageRegistration] = useState<PendingRegistration | null>(null);
    const [pendingCancelListing, setPendingCancelListing] = useState<PendingCancelListing | null>(null);
    const [purchaseSuccessData, setPurchaseSuccessData] = useState<PurchaseSuccessData | null>(null);
    const [settlementObtainItems, setSettlementObtainItems] = useState<InventoryItem[] | null>(null);
    const [showAlreadySoldModal, setShowAlreadySoldModal] = useState(false);
    const [sellPickerOpen, setSellPickerOpen] = useState(false);
    const [sellComposerOpen, setSellComposerOpen] = useState(false);
    const [sellSlotFocusItemId, setSellSlotFocusItemId] = useState<string>('');
    const [listings, setListings] = useState<ExchangeListing[]>(() => (currentUser.exchangeState?.listings as ExchangeListing[] | undefined) ?? []);
    const [settlements, setSettlements] = useState<SettlementItem[]>(() => (currentUser.exchangeState?.settlements as SettlementItem[] | undefined) ?? []);
    /** 0이면 비활성. 만료 회수 쿨다운 종료 시각(ms). */
    const [exchangeListingRecoverCooldownUntilMs, setExchangeListingRecoverCooldownUntilMs] = useState(0);
    const exchangeListingRecoverCooldownRef = useRef(false);
    const exchangeListingRecoverCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** 회수·등록 취소 직후 서버 exchangeState가 아직 갱신되기 전 merge가 목록을 되살리지 않도록 */
    const pendingListingRemovalIdsRef = useRef<Set<string>>(new Set());

    const functionVipActive = isFunctionVipActive(currentUser);
    const isAdminUser = Boolean(currentUser.isAdmin);
    const allEquipmentItems = useMemo(
        () => (currentUser.inventory ?? []).filter((item: InventoryItem) => item.type === 'equipment'),
        [currentUser.inventory],
    );
    const myListedItemIds = useMemo(
        () =>
            new Set(
                listings
                    .filter((listing) => listing.sellerId === currentUser.id && listing.status === 'listed')
                    .map((listing) => listing.itemId),
            ),
        [listings, currentUser.id],
    );
    const sellableItems = useMemo(
        () =>
            (currentUser.inventory ?? []).filter(
                (item: InventoryItem) =>
                    item.type === 'equipment' &&
                    !item.isEquipped &&
                    !item.isBound &&
                    // 로컬 listings가 회수·취소 직후 source of truth — isExchangeListed는 HTTP/WS 동기화 전까지 stale할 수 있음
                    !myListedItemIds.has(item.id),
            ),
        [currentUser.inventory, myListedItemIds],
    );
    const sortedSellableItems = useMemo(() => {
        const rank: Record<ItemGrade, number> = {
            normal: 0,
            uncommon: 1,
            rare: 2,
            epic: 3,
            legendary: 4,
            mythic: 5,
            transcendent: 6,
        };
        const copied = [...sellableItems];
        if (inventorySortKey === 'grade') {
            copied.sort((a, b) => {
                const gap = (rank[b.grade] ?? 0) - (rank[a.grade] ?? 0);
                if (gap !== 0) return gap;
                return (b.stars ?? 0) - (a.stars ?? 0);
            });
            return copied;
        }
        if (inventorySortKey === 'name') {
            copied.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
            return copied;
        }
        copied.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        return copied;
    }, [sellableItems, inventorySortKey]);
    const myListedCount = listings.filter((listing) => listing.sellerId === currentUser.id && listing.status === 'listed').length;
    const tradeListingTicketCount = useMemo(
        () => countTradeListingTickets(currentUser.inventory),
        [currentUser.inventory],
    );
    const allowedListingCount = resolveAllowedListingCount({
        myListedCount,
        ticketCount: tradeListingTicketCount,
        functionVipActive,
        isAdmin: isAdminUser,
    });
    const maxSaleListPrice = maxExchangeListPrice(saleCurrency);
    const saleFee = exchangeListingFeeFromPrice(clampGameInt(Math.floor(Number(salePrice || 0)), { min: 0, max: maxSaleListPrice }));
    const minimumPrice = minPriceByCurrency[saleCurrency];
    const selectedItem = allEquipmentItems.find((entry) => entry.id === selectedItemId);
    const myActiveListings = listings.filter((listing) => listing.sellerId === currentUser.id && listing.status === 'listed');
    const pullMarketListingsFromApi = React.useCallback(async (): Promise<boolean> => {
        try {
            const response = await fetch(getApiUrl('/api/exchange/listings'));
            if (!response.ok) return false;
            const data = (await response.json()) as { listings?: ExchangeListing[] };
            setMarketListingsRemote(Array.isArray(data?.listings) ? data.listings : []);
            setMarketListingsLoaded(true);
            return true;
        } catch {
            return false;
        }
    }, []);

    const refreshMarketListings = React.useCallback(async () => {
        setIsRefreshingBuyListings(true);
        try {
            await pullMarketListingsFromApi();
        } finally {
            setIsRefreshingBuyListings(false);
        }
    }, [pullMarketListingsFromApi]);

    React.useEffect(() => {
        let cancelled = false;
        const minDelay = new Promise<void>((resolve) => {
            window.setTimeout(resolve, EXCHANGE_MODAL_OPENING_LOAD_MS);
        });
        setIsRefreshingBuyListings(true);
        void (async () => {
            try {
                await Promise.all([pullMarketListingsFromApi(), minDelay]);
            } finally {
                if (!cancelled) {
                    setIsRefreshingBuyListings(false);
                    setExchangeBuyListingsRevealReady(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [pullMarketListingsFromApi]);

    React.useEffect(() => {
        if (activeTab !== 'buy') return;
        if (!exchangeBuyListingsRevealReady) return;
        const timer = window.setInterval(() => {
            void refreshMarketListings();
        }, 5000);
        return () => window.clearInterval(timer);
    }, [activeTab, exchangeBuyListingsRevealReady, refreshMarketListings]);
    const marketListings = useMemo(() => {
        const merged = new Map<string, ExchangeListing>();
        const remoteIds = new Set<string>();
        marketListingsRemote.forEach((entry) => {
            if (!entry || !entry.id) return;
            remoteIds.add(entry.id);
            merged.set(entry.id, entry);
        });
        const userRows: User[] = !allUsers
            ? []
            : Array.isArray(allUsers)
              ? (allUsers as User[])
              : (Object.values(allUsers) as User[]);
        userRows.forEach((user) => {
            const userListings = (user.exchangeState?.listings as ExchangeListing[] | undefined) ?? [];
            userListings.forEach((entry) => {
                if (!entry || !entry.id) return;
                if (marketListingsLoaded && !remoteIds.has(entry.id)) return;
                if (marketListingsLoaded && merged.has(entry.id)) return;
                const existing = merged.get(entry.id);
                if (!existing || (entry.createdAt ?? 0) >= (existing.createdAt ?? 0)) {
                    merged.set(entry.id, entry);
                }
            });
        });
        // 내 로컬 상태를 우선 반영해 저장 지연/수신 지연 중에도 구매 탭 표시를 {t('labels.keep', { defaultValue: 'Keep' })}
        listings.forEach((entry) => {
            if (!entry || !entry.id) return;
            if (marketListingsLoaded && !remoteIds.has(entry.id)) return;
            merged.set(entry.id, entry);
        });
        return Array.from(merged.values());
    }, [allUsers, listings, marketListingsLoaded, marketListingsRemote]);
    const myRecoverableListings = listings.filter(
        (listing) => listing.sellerId === currentUser.id && listing.status === 'listed' && listing.expiresAt <= nowMs,
    );
    const sellSlots = isAdminUser
        ? myActiveListings
        : Array.from({ length: MAX_EXCHANGE_SELL_SLOTS }, (_, idx) => myActiveListings[idx] ?? null);
    const selectedItemAlreadyListedByMe = Boolean(
        selectedItem &&
            listings.some(
                (entry) => entry.sellerId === currentUser.id && entry.status === 'listed' && entry.itemId === selectedItem.id,
            ),
    );
    React.useEffect(() => {
        const listedItemIdSet = new Set(
            listings
                .filter((entry) => entry.sellerId === currentUser.id && entry.status === 'listed')
                .map((entry) => entry.itemId),
        );
        const orphanedListedIds = (currentUser.inventory ?? [])
            .filter((item: InventoryItem) => item.type === 'equipment' && item.isExchangeListed && !listedItemIdSet.has(item.id))
            .map((item) => item.id);
        if (orphanedListedIds.length === 0) return;
        orphanedListedIds.forEach((itemId) => {
            void onAction?.({ type: 'UNMARK_ITEM_EXCHANGE_LISTED', payload: { itemId } });
        });
    }, [currentUser.id, currentUser.inventory, listings, onAction]);
    const lastSoldForSelected =
        selectedItem
            ? [...listings]
                  .filter((entry) => entry.status === 'sold' && entry.itemId === selectedItem.id)
                  .sort((a, b) => (b.soldAt ?? 0) - (a.soldAt ?? 0))[0]
            : null;

    React.useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    React.useEffect(() => {
        return () => {
            if (exchangeListingRecoverCooldownTimerRef.current) {
                clearTimeout(exchangeListingRecoverCooldownTimerRef.current);
                exchangeListingRecoverCooldownTimerRef.current = null;
            }
        };
    }, []);
    React.useEffect(() => {
        if (exchangeListingRecoverCooldownUntilMs <= 0) return;
        if (nowMs < exchangeListingRecoverCooldownUntilMs) return;
        exchangeListingRecoverCooldownRef.current = false;
        setExchangeListingRecoverCooldownUntilMs(0);
        if (exchangeListingRecoverCooldownTimerRef.current) {
            clearTimeout(exchangeListingRecoverCooldownTimerRef.current);
            exchangeListingRecoverCooldownTimerRef.current = null;
        }
    }, [nowMs, exchangeListingRecoverCooldownUntilMs]);
    const listingRecoverCooldownSecondsLeft = useMemo(
        () =>
            exchangeListingRecoverCooldownUntilMs > 0
                ? Math.max(0, Math.ceil((exchangeListingRecoverCooldownUntilMs - nowMs) / 1000))
                : 0,
        [exchangeListingRecoverCooldownUntilMs, nowMs],
    );
    const buyRefreshButtonDisabled =
        isRefreshingBuyListings || nowMs < buyManualRefreshCooldownUntilMs;
    const serverListingsSig = useMemo(
        () => JSON.stringify((currentUser.exchangeState?.listings as ExchangeListing[] | undefined) ?? []),
        [currentUser.exchangeState?.listings],
    );
    const serverSettlementsSig = useMemo(
        () => JSON.stringify((currentUser.exchangeState?.settlements as SettlementItem[] | undefined) ?? []),
        [currentUser.exchangeState?.settlements],
    );
    const exchangeSyncUserIdRef = useRef<string | undefined>(undefined);

    React.useEffect(() => {
        skipInitialExchangePersist.current = true;
        const serverListingsRaw = (currentUser.exchangeState?.listings as ExchangeListing[] | undefined) ?? [];
        const pendingRemoved = pendingListingRemovalIdsRef.current;
        for (const id of [...pendingRemoved]) {
            const stillListed = serverListingsRaw.some((row) => row?.id === id && row.status === 'listed');
            if (!stillListed) pendingRemoved.delete(id);
        }
        const serverListings = serverListingsRaw.filter((row) => row?.id && !pendingRemoved.has(row.id));
        const serverSettlements = (currentUser.exchangeState?.settlements as SettlementItem[] | undefined) ?? [];
        const serverHistory = (currentUser.exchangeState?.history as string[] | undefined) ?? [];
        const uid = currentUser.id;
        const userChanged = exchangeSyncUserIdRef.current !== uid;
        exchangeSyncUserIdRef.current = uid;

        if (userChanged) {
            setListings(serverListings);
            setSettlements(serverSettlements);
            setHistory(serverHistory);
            return;
        }
        setListings((prev) => mergeExchangeListingsPreferServer(prev, serverListings));
        setSettlements(serverSettlements);
    }, [currentUser.id, serverListingsSig, serverSettlementsSig]);
    /** exchangeState가 id 변경 없이 늦게 도착한 경우(로컬 이력이 아직 비어 있을 때만 서버로 채움) */
    React.useEffect(() => {
        const serverHistory = (currentUser.exchangeState?.history as string[] | undefined) ?? [];
        if (!Array.isArray(serverHistory) || serverHistory.length === 0) return;
        setHistory((prev) => (prev.length === 0 ? serverHistory : prev));
    }, [currentUser.id, currentUser.exchangeState?.history?.length]);
    React.useEffect(() => {
        if (skipInitialExchangePersist.current) {
            skipInitialExchangePersist.current = false;
            return;
        }
        void onAction?.({
            type: 'SAVE_EXCHANGE_STATE',
            payload: {
                listings: listings as unknown as Array<Record<string, unknown>>,
                settlements: settlements as unknown as Array<Record<string, unknown>>,
                history,
            },
        });
    }, [listings, settlements, history, onAction]);

    React.useEffect(() => {
        if (activeTab !== 'sell') {
            setSellPickerOpen(false);
            setSellComposerOpen(false);
            setSellSlotFocusItemId('');
            setSelectedItemId('');
        }
    }, [activeTab]);

    const appendHistory = (message: string) => {
        const timestamp = new Date().toLocaleString(i18nInst.language);
        setHistory((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 200));
    };

    const executeRegisterSale = async (
        item: InventoryItem,
        parsedPrice: number,
        currency: SaleCurrency,
        consumeTradeListingTicket: boolean,
    ) => {
        const alreadyListed = listings.some(
            (entry) => entry.sellerId === currentUser.id && entry.status === 'listed' && entry.itemId === item.id,
        );
        if (alreadyListed) {
            setPendingRegistration(null);
            setSelectedItemId('');
            setSellComposerOpen(false);
            setSellPickerOpen(false);
            return;
        }
        if (consumeTradeListingTicket) {
            const ticketItem = (currentUser.inventory ?? []).find(
                (inv) => inv.type === 'material' && inv.name === TRADE_LISTING_TICKET_NAME && (inv.quantity ?? 1) > 0,
            );
            if (!ticketItem) {
                window.alert(tx('exchange:alerts.insufficientTicket'));
                setPendingRegistration(null);
                setPendingTicketUsageRegistration(null);
                setSellComposerOpen(false);
                setSellPickerOpen(false);
                return;
            }
            const useItemResult = await onAction?.({
                type: 'USE_ITEM',
                payload: { itemId: ticketItem.id, itemName: ticketItem.name, quantity: 1 },
            });
            if (
                useItemResult &&
                typeof useItemResult === 'object' &&
                'error' in useItemResult &&
                (useItemResult as { error?: string }).error
            ) {
                window.alert(String((useItemResult as { error: string }).error));
                setPendingRegistration(null);
                setPendingTicketUsageRegistration(null);
                setSellComposerOpen(false);
                setSellPickerOpen(false);
                return;
            }
        }
        const markResult = await onAction?.({
            type: 'MARK_ITEM_EXCHANGE_LISTED',
            payload: { itemId: item.id, listPrice: parsedPrice, listCurrency: currency },
        });
        if (
            markResult &&
            typeof markResult === 'object' &&
            'error' in markResult &&
            (markResult as { error?: string }).error
        ) {
            window.alert(String((markResult as { error: string }).error));
            setPendingRegistration(null);
            setPendingTicketUsageRegistration(null);
            setSelectedItemId('');
            setSellComposerOpen(false);
            setSellPickerOpen(false);
            return;
        }

        const newListing: ExchangeListing = {
            id: `my-${Date.now()}`,
            sellerId: currentUser.id,
            sellerNickname: currentUser.nickname,
            itemId: item.id,
            itemName: item.name,
            itemImage: item.image,
            itemSlot: item.slot ?? undefined,
            itemGrade: item.grade,
            itemStars: item.stars,
            itemLevel: item.level,
            listedEquipment: cloneListedEquipmentSnapshot(item),
            price: parsedPrice,
            currency,
            verificationStatus: 'verifying',
            createdAt: Date.now(),
            verificationEndsAt: Date.now() + VERIFICATION_MS,
            expiresAt: Date.now() + LISTING_MAX_DURATION_MS,
            status: 'listed',
        };
        setListings((prev) => [newListing, ...prev]);
        setPendingRegistration(null);
        setPendingTicketUsageRegistration(null);
        setSelectedItemId('');
        setSellComposerOpen(false);
        setSellPickerOpen(false);
        setSalePrice(String(minPriceByCurrency[currency]));
    };

    const handleRegisterSale = () => {
        if (myListedCount >= allowedListingCount) {
            if (functionVipActive && !isAdminUser) {
                window.alert(tx('exchange:alerts.vipListingLimit'));
            } else if (!isAdminUser) {
                window.alert(tx('exchange:alerts.ticketHint'));
            }
            return;
        }
        const item = selectedItem;
        if (!item) {
            window.alert(tx('exchange:alerts.selectGearFromInventory'));
            return;
        }
        if (item.isBound) {
            window.alert(tx('exchange:alerts.boundGear'));
            return;
        }
        const alreadyListed = listings.some(
            (entry) => entry.sellerId === currentUser.id && entry.status === 'listed' && entry.itemId === item.id,
        );
        if (alreadyListed) {
            setSelectedItemId('');
            setSalePrice(String(minPriceByCurrency[saleCurrency]));
            return;
        }
        const parsedPrice = clampGameInt(Math.floor(Number(salePrice)), { min: minimumPrice, max: maxSaleListPrice });
        if (!Number.isFinite(parsedPrice) || parsedPrice < minimumPrice) {
            window.alert(tx('exchange:alerts.minimumPrice', { price: formatCurrency(minimumPrice, saleCurrency) }));
            return;
        }
        if (saleCurrency === 'gold' && walletGold < saleFee) {
            window.alert(tx('exchange:alerts.insufficientFee', { fee: formatCurrency(saleFee, saleCurrency) }));
            return;
        }
        if (saleCurrency === 'diamonds' && walletDiamonds < saleFee) {
            window.alert(tx('exchange:alerts.insufficientFee', { fee: formatCurrency(saleFee, saleCurrency) }));
            return;
        }
        setSellComposerOpen(false);
        setSellPickerOpen(false);
        setPendingRegistration({ item, price: parsedPrice, currency: saleCurrency, fee: saleFee });
    };
    const needsTradeListingTicket = requiresTradeListingTicket({
        myListedCount,
        functionVipActive,
        isAdmin: isAdminUser,
    });

    const handleBuy = async (listingId: string) => {
        const listing = marketListings.find((entry) => entry.id === listingId);
        if (!listing) {
            setShowAlreadySoldModal(true);
            return;
        }
        if (listing.sellerId === currentUser.id) {
            window.alert(tx('exchange:alerts.cannotBuyOwn'));
            return;
        }
        const isPurchaseAvailable =
            listing.status === 'listed' &&
            (listing.verificationStatus === 'active' || (listing.verificationEndsAt ?? 0) <= nowMs) &&
            listing.expiresAt > nowMs;
        if (!isPurchaseAvailable) {
            setListings((prev) => prev.filter((entry) => entry.id !== listingId));
            if (selectedBuyListingId === listingId) setSelectedBuyListingId('');
            setShowAlreadySoldModal(true);
            return;
        }

        if (listing.currency === 'gold' && walletGold < listing.price) {
            window.alert(tx('exchange:alerts.insufficientGold'));
            return;
        }
        if (listing.currency === 'diamonds' && walletDiamonds < listing.price) {
            window.alert(tx('exchange:alerts.insufficientDiamonds'));
            return;
        }

        const result = await onAction?.({
            type: 'PURCHASE_EXCHANGE_LISTING',
            payload: { listingId, sellerId: listing.sellerId },
        });
        if (
            result &&
            typeof result === 'object' &&
            'error' in result &&
            (result as { error?: string }).error
        ) {
            window.alert(String((result as { error: string }).error));
            return;
        }

        const cr = (result as { clientResponse?: { exchangePurchasedItem?: InventoryItem } } | undefined)?.clientResponse;
        const purchasedInventoryItem =
            cr?.exchangePurchasedItem ??
            (isListingEquipmentSnapshot(listing.listedEquipment) ? listing.listedEquipment : null);

        void refreshMarketListings();
        if (selectedBuyListingId === listingId) setSelectedBuyListingId('');
        setPurchaseSuccessData({ listing, inventoryItem: purchasedInventoryItem });
        appendHistory(`${HX_PURCHASE_DONE}: ${listing.itemName} / ${formatHistoryCurrencyAmount(listing.price, listing.currency)}`);
    };

    const handleClaimSettlement = async (listingId: string) => {
        const settlement = settlements.find((entry) => entry.listingId === listingId && !entry.claimed);
        if (!settlement) return;

        const claimFee = exchangeListingFeeFromPrice(settlement.soldPrice);
        const netAmount = Math.max(0, settlement.soldPrice - claimFee);

        const result = await onAction?.({
            type: 'CLAIM_EXCHANGE_SETTLEMENT',
            payload: { listingId },
        });
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            window.alert(String((result as { error: string }).error));
            return;
        }
        const cr = (
            result as
                | {
                      clientResponse?: {
                          exchangeSettlementClaimedGold?: number;
                          exchangeSettlementClaimedDiamonds?: number;
                      };
                  }
                | undefined
        )?.clientResponse;
        const g = Math.max(0, Math.floor(Number(cr?.exchangeSettlementClaimedGold ?? 0)));
        const d = Math.max(0, Math.floor(Number(cr?.exchangeSettlementClaimedDiamonds ?? 0)));
        const obtain: InventoryItem[] = [];
        if (g > 0) obtain.push(createExchangeSettlementCurrencyObtainItem('gold', g));
        if (d > 0) obtain.push(createExchangeSettlementCurrencyObtainItem('diamonds', d));
        if (obtain.length > 0) setSettlementObtainItems(obtain);

        appendHistory(`${HX_SETTLEMENT_ONE}: ${settlement.itemName} / \uC2E4\uC218\uB9BD ${formatHistoryCurrencyAmount(netAmount, settlement.currency)} (${HX_FEE} ${formatHistoryCurrencyAmount(claimFee, settlement.currency)})`);
    };
    const handleClaimAllSettlements = async () => {
        if (unclaimedSettlements.length === 0) return;

        const result = await onAction?.({
            type: 'CLAIM_EXCHANGE_SETTLEMENT',
            payload: { claimAll: true },
        });
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            window.alert(String((result as { error: string }).error));
            return;
        }
        const cr = (
            result as
                | {
                      clientResponse?: {
                          exchangeSettlementClaimedGold?: number;
                          exchangeSettlementClaimedDiamonds?: number;
                      };
                  }
                | undefined
        )?.clientResponse;
        const totalGoldNet = Math.max(0, Math.floor(Number(cr?.exchangeSettlementClaimedGold ?? 0)));
        const totalDiamondsNet = Math.max(0, Math.floor(Number(cr?.exchangeSettlementClaimedDiamonds ?? 0)));
        const obtain: InventoryItem[] = [];
        if (totalGoldNet > 0) obtain.push(createExchangeSettlementCurrencyObtainItem('gold', totalGoldNet));
        if (totalDiamondsNet > 0) obtain.push(createExchangeSettlementCurrencyObtainItem('diamonds', totalDiamondsNet));
        if (obtain.length > 0) setSettlementObtainItems(obtain);
        appendHistory(
            `${HX_SETTLEMENT_ALL}: ${HX_GOLD} ${formatGoldAmountKoG(totalGoldNet)} / ${HX_DIA} ${formatWalletDiamonds(totalDiamondsNet)}`,
        );
    };

    const handleCancelListing = (listingId: string) => {
        const target = listings.find((entry) => entry.id === listingId);
        if (!target || target.status !== 'listed') return;
        pendingListingRemovalIdsRef.current.add(listingId);
        setListings((prev) => prev.filter((entry) => entry.id !== listingId));
        void onAction?.({ type: 'UNMARK_ITEM_EXCHANGE_LISTED', payload: { itemId: target.itemId } });
    };
    const handleRequestCancelListing = (listingId: string) => {
        const target = listings.find((entry) => entry.id === listingId);
        if (!target || target.status !== 'listed') return;
        setPendingCancelListing({
            listingId,
            itemName: target.itemName,
            itemImage: target.itemImage,
            itemGrade: (target.itemGrade as ItemGrade | undefined) ?? ItemGrade.Normal,
            itemStars: target.itemStars ?? 0,
        });
    };

    const handleRecoverListing = (listingId: string) => {
        if (exchangeListingRecoverCooldownRef.current) return;
        const target = listings.find((entry) => entry.id === listingId);
        if (!target || target.status !== 'listed') return;
        if (exchangeListingRecoverCooldownTimerRef.current) {
            clearTimeout(exchangeListingRecoverCooldownTimerRef.current);
            exchangeListingRecoverCooldownTimerRef.current = null;
        }
        exchangeListingRecoverCooldownRef.current = true;
        const until = Date.now() + EXCHANGE_LISTING_RECOVER_COOLDOWN_MS;
        setExchangeListingRecoverCooldownUntilMs(until);
        exchangeListingRecoverCooldownTimerRef.current = setTimeout(() => {
            exchangeListingRecoverCooldownTimerRef.current = null;
            exchangeListingRecoverCooldownRef.current = false;
            setExchangeListingRecoverCooldownUntilMs(0);
        }, EXCHANGE_LISTING_RECOVER_COOLDOWN_MS);
        pendingListingRemovalIdsRef.current.add(listingId);
        setListings((prev) => prev.filter((entry) => entry.id !== listingId));
        void onAction?.({ type: 'UNMARK_ITEM_EXCHANGE_LISTED', payload: { itemId: target.itemId } });
    };

    const listingsWithComputed = marketListings.map((entry) => {
        const verificationDone = entry.verificationStatus === 'active' || (entry.verificationEndsAt ?? 0) <= nowMs;
        const effectiveVerification: 'verifying' | 'active' = verificationDone ? 'active' : 'verifying';
        const isExpired = entry.expiresAt <= nowMs;
        return { ...entry, effectiveVerification, isExpired };
    });

    const listedItems = listingsWithComputed.filter(
        (entry) => entry.status === 'listed' && entry.effectiveVerification === 'active' && !entry.isExpired,
    );
    const filteredAndSortedBuyItems = useMemo(() => {
        const keyword = buySearchText.trim().toLowerCase();
        const filtered = listedItems.filter(
            (entry) =>
                (keyword.length === 0 ? true : entry.itemName.toLowerCase().includes(keyword)) &&
                (buySlotFilter === 'all' ? true : entry.itemSlot === buySlotFilter) &&
                (buyGradeFilter === 'all' ? true : (entry.itemGrade ?? ItemGrade.Normal) === buyGradeFilter) &&
                (buyCurrencyFilter === 'all' ? true : entry.currency === buyCurrencyFilter),
        );
        const copied = [...filtered];
        if (buySortColumn === 'name') {
            copied.sort((a, b) => {
                const gap = a.itemName.localeCompare(b.itemName, 'ko-KR');
                return buySortDirection === 'asc' ? gap : -gap;
            });
        } else if (buySortColumn === 'currentPrice') {
            copied.sort((a, b) => (buySortDirection === 'asc' ? a.price - b.price : b.price - a.price));
        } else if (buySortColumn === 'lowestPrice') {
            const lowestMap = new Map<string, number>();
            copied.forEach((entry) => {
                const key = getBuyListingGroupKey(entry);
                const existing = lowestMap.get(key);
                if (existing === undefined || entry.price < existing) lowestMap.set(key, entry.price);
            });
            copied.sort((a, b) => {
                const aLowest = lowestMap.get(getBuyListingGroupKey(a)) ?? a.price;
                const bLowest = lowestMap.get(getBuyListingGroupKey(b)) ?? b.price;
                if (aLowest === bLowest) return (b.createdAt ?? 0) - (a.createdAt ?? 0);
                return buySortDirection === 'asc' ? aLowest - bLowest : bLowest - aLowest;
            });
        } else {
            copied.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        }
        return copied;
    }, [listedItems, buySearchText, buySortColumn, buySortDirection, buySlotFilter, buyGradeFilter, buyCurrencyFilter]);
    const lowestPriceByBuyGroup = useMemo(() => {
        const map = new Map<string, number>();
        filteredAndSortedBuyItems.forEach((entry) => {
            const key = getBuyListingGroupKey(entry);
            const existing = map.get(key);
            if (existing === undefined || entry.price < existing) map.set(key, entry.price);
        });
        return map;
    }, [filteredAndSortedBuyItems]);
    const selectedBuyListing = useMemo(() => {
        const byId = selectedBuyListingId
            ? filteredAndSortedBuyItems.find((entry) => entry.id === selectedBuyListingId)
            : undefined;
        if (byId) return byId;
        if (!mobileExchange) return filteredAndSortedBuyItems[0] ?? null;
        return null;
    }, [filteredAndSortedBuyItems, selectedBuyListingId, mobileExchange]);
    const selectedBuyListingIsMine = Boolean(selectedBuyListing && selectedBuyListing.sellerId === currentUser.id);
    const buyDetailDisplayItem = useMemo((): InventoryItem | null => {
        if (!selectedBuyListing) return null;
        if (selectedBuyListingIsMine) {
            const mine = allEquipmentItems.find((item) => item.id === selectedBuyListing.itemId);
            if (mine) return mine;
        }
        return buildBuyPreviewInventoryItem(selectedBuyListing);
    }, [allEquipmentItems, selectedBuyListing, selectedBuyListingIsMine]);
    const recentSoldForBuySelection = selectedBuyListing
        ? [...marketListings]
              .filter((entry) => entry.status === 'sold' && entry.itemId === selectedBuyListing.itemId)
              .sort((a, b) => (b.soldAt ?? 0) - (a.soldAt ?? 0))[0]
        : null;
    const buyRemainingMs = selectedBuyListing ? Math.max(0, selectedBuyListing.expiresAt - nowMs) : 0;
    const buyRemainingDays = Math.floor(buyRemainingMs / (24 * 60 * 60 * 1000));
    const buyRemainingHours = Math.floor((buyRemainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    React.useEffect(() => {
        if (filteredAndSortedBuyItems.length === 0) {
            if (selectedBuyListingId) setSelectedBuyListingId('');
            return;
        }
        const idValid = selectedBuyListingId && filteredAndSortedBuyItems.some((entry) => entry.id === selectedBuyListingId);
        if (mobileExchange) {
            if (selectedBuyListingId && !idValid) setSelectedBuyListingId('');
            return;
        }
        if (!selectedBuyListingId || !idValid) {
            setSelectedBuyListingId(filteredAndSortedBuyItems[0].id);
        }
    }, [filteredAndSortedBuyItems, selectedBuyListingId, mobileExchange]);
    React.useEffect(() => {
        if (!mobileExchange) return;
        if (activeTab !== 'buy' && selectedBuyListingId) setSelectedBuyListingId('');
    }, [mobileExchange, activeTab, selectedBuyListingId]);
    const currentLowestForSelected =
        selectedItem
            ? listingsWithComputed
                  .filter(
                      (entry) =>
                          entry.status === 'listed' &&
                          entry.effectiveVerification === 'active' &&
                          !entry.isExpired &&
                          entry.itemId === selectedItem.id &&
                          entry.currency === saleCurrency,
                  )
                  .sort((a, b) => a.price - b.price)[0] ?? null
            : null;
    React.useEffect(() => {
        if (!selectedItemId) return;
        if (!currentLowestForSelected) return;
        setSalePrice(String(Math.min(maxExchangeListPrice(saleCurrency), currentLowestForSelected.price)));
    }, [selectedItemId, saleCurrency, currentLowestForSelected?.price]);
    const unclaimedSettlements = settlements.filter((entry) => !entry.claimed);
    const unclaimedCurrencyReceipts = useMemo(
        () => (currentUser.exchangeState?.currencyReceipts ?? []).filter((entry) => entry && entry.claimed !== true),
        [currentUser.exchangeState?.currencyReceipts],
    );
    const settlementDisplayItems = useMemo(
        () =>
            unclaimedSettlements.map((entry) => {
                const linkedListing = listings.find((listing) => listing.id === entry.listingId);
                const fee = exchangeListingFeeFromPrice(entry.soldPrice);
                const net = Math.max(0, entry.soldPrice - fee);
                return {
                    ...entry,
                    fee,
                    net,
                    itemImage: linkedListing?.itemImage,
                    itemGrade: (linkedListing?.itemGrade as ItemGrade | undefined) ?? ItemGrade.Normal,
                    itemStars: linkedListing?.itemStars ?? 0,
                };
            }),
        [unclaimedSettlements, listings],
    );
    const settlementTotals = useMemo(() => {
        let selectedFeeGold = 0;
        let selectedFeeDiamonds = 0;
        let selectedNetGold = 0;
        let selectedNetDiamonds = 0;
        settlementDisplayItems.forEach((entry) => {
            if (entry.currency === 'gold') {
                selectedFeeGold += entry.fee;
                selectedNetGold += entry.net;
            } else {
                selectedFeeDiamonds += entry.fee;
                selectedNetDiamonds += entry.net;
            }
        });
        return {
            selectedFeeGold,
            selectedFeeDiamonds,
            selectedNetGold,
            selectedNetDiamonds,
        };
    }, [settlementDisplayItems]);
    const selectedSettlement =
        settlementDisplayItems.find((entry) => entry.listingId === selectedSettlementId) ??
        settlementDisplayItems[0] ??
        null;
    React.useEffect(() => {
        if (settlementDisplayItems.length === 0) {
            if (selectedSettlementId) setSelectedSettlementId('');
            return;
        }
        if (!selectedSettlementId || !settlementDisplayItems.some((entry) => entry.listingId === selectedSettlementId)) {
            setSelectedSettlementId(settlementDisplayItems[0].listingId);
        }
    }, [settlementDisplayItems, selectedSettlementId]);
    const visibleExchangeHistory = useMemo(
        () => history.filter(isExchangeHistoryLineForDisplay),
        [history],
    );
    const historySummary = useMemo(() => {
        const totals = {
            outGold: 0,
            outDiamonds: 0,
            inGold: 0,
            inDiamonds: 0,
        };
        const rows = visibleExchangeHistory.map((line) => {
            const timestampMatch = line.match(/^\[([^\]]+)\]/);
            const timestampText = formatExchangeHistoryTimestamp(timestampMatch?.[1] ?? '-', i18nInst.language);
            const message = line.replace(/^\[[^\]]+\]\s*/, '');
            const statusText = line.includes(HX_PURCHASE_DONE)
                ? t('labels.purchaseComplete')
                : line.includes(HX_SETTLEMENT_ONE) || line.includes(HX_SETTLEMENT_ALL)
                  ? t('labels.settlementReceived')
                  : '-';
            const itemNameMatch = message.match(/^[^:]+:\s*([^/]+?)(?:\s*\/|$)/);
            const itemName = itemNameMatch?.[1]?.trim();
            const matches = [...line.matchAll(new RegExp(`([0-9,]+)(${HX_CURRENCY_SUFFIX_PATTERN})`, 'g'))];
            const priceMatch = matches[0];
            const feeMatch = line.match(new RegExp(`${HX_FEE}[^0-9]*([0-9,]+)(${HX_CURRENCY_SUFFIX_PATTERN})`));
            const priceAmount = priceMatch ? Number((priceMatch[1] ?? '0').replace(/,/g, '')) || 0 : 0;
            const priceCurrency = (isHistoryGoldSuffix(priceMatch?.[2]) ? 'gold' : priceMatch ? 'diamonds' : null) as SaleCurrency | null;
            const feeAmount = feeMatch ? Number((feeMatch[1] ?? '0').replace(/,/g, '')) || 0 : 0;
            const feeCurrency = (isHistoryGoldSuffix(feeMatch?.[2]) ? 'gold' : feeMatch ? 'diamonds' : null) as SaleCurrency | null;
            if (line.includes(HX_PURCHASE_DONE) && priceMatch) {
                if (isHistoryGoldSuffix(priceMatch[2])) totals.outGold += priceAmount;
                else totals.outDiamonds += priceAmount;
            }
            if (line.includes(HX_SETTLEMENT_ALL)) {
                matches.forEach((m) => {
                    const amount = Number((m[1] ?? '0').replace(/,/g, '')) || 0;
                    if (isHistoryGoldSuffix(m[2])) totals.inGold += amount;
                    else totals.inDiamonds += amount;
                });
            } else if (line.includes(HX_SETTLEMENT_ONE) && priceMatch) {
                if (isHistoryGoldSuffix(priceMatch[2])) totals.inGold += priceAmount;
                else totals.inDiamonds += priceAmount;
            }
            if (line.includes(HX_SETTLEMENT_ALL)) {
                const goldBulk = line.match(new RegExp(`(?:${HX_GOLD}|Gold)\\s*([0-9,]+)`));
                const diaBulk = line.match(new RegExp(`(?:${HX_DIA}|Diamonds)\\s*([0-9,]+)`));
                const gBulk = goldBulk ? Number((goldBulk[1] ?? '0').replace(/,/g, '')) || 0 : 0;
                const dBulk = diaBulk ? Number((diaBulk[1] ?? '0').replace(/,/g, '')) || 0 : 0;
                let bulkImage = '/images/Box/GoldBox3.webp';
                if (gBulk > 0 && dBulk === 0) bulkImage = '/images/icon/Gold.webp';
                else if (dBulk > 0 && gBulk === 0) bulkImage = '/images/icon/Zem.webp';
                return {
                    line,
                    timestampText,
                    statusText,
                    itemImage: bulkImage,
                    itemGrade: ItemGrade.Normal,
                    itemStars: 0,
                    priceAmount,
                    priceCurrency,
                    feeAmount,
                    feeCurrency,
                };
            }
            const matchedListing = pickExchangeListingForHistoryLine(
                listings,
                line,
                itemName,
                priceAmount,
                priceCurrency,
                feeAmount,
                feeCurrency,
            );
            const invSameName = itemName
                ? allEquipmentItems.filter((entry) => entry.name === itemName.trim())
                : [];
            let matchedInventoryItem: InventoryItem | undefined;
            if (invSameName.length === 1) {
                matchedInventoryItem = invSameName[0];
            } else if (invSameName.length > 1 && matchedListing) {
                matchedInventoryItem =
                    invSameName.find(
                        (e) =>
                            e.grade === (matchedListing.itemGrade as ItemGrade | undefined) &&
                            (e.stars ?? 0) === (matchedListing.itemStars ?? 0),
                    ) ?? invSameName[0];
            }
            const { itemImage, itemGrade, itemStars } = resolveExchangeHistoryRowVisual(
                itemName,
                matchedListing,
                matchedInventoryItem,
                line,
            );
            return {
                line,
                timestampText,
                statusText,
                itemImage,
                itemGrade,
                itemStars,
                priceAmount,
                priceCurrency,
                feeAmount,
                feeCurrency,
            };
        });
        return { totals, rows };
    }, [visibleExchangeHistory, listings, allEquipmentItems, t, i18nInst.language]);
    const exchangeTabButtonBase =
        'rounded-md border px-2 py-2 text-sm font-semibold tracking-wide transition-all duration-150';
    /** 네이티브 모바일 거래소: 탭·본문·표 공통 11px 전후 */
    const exchangeTabButtonMobile =
        'rounded-md border px-1.5 py-1.5 text-[11px] font-semibold leading-tight tracking-wide transition-all duration-150';
    const exchM = 'text-[11px] leading-snug';
    /** 모바일 구매: 가로 스크롤 방지 — 첫 열 shrink, 좁은 고정 가격열, 작은 간격 */
    const buyListColsMobile = 'grid-cols-[minmax(0,1fr)_5.75rem_5.75rem] gap-1.5';
    const buyListColsDesktop = 'grid-cols-[minmax(0,1fr)_105px_105px] gap-4';
    const buyListCols = mobileExchange ? buyListColsMobile : buyListColsDesktop;
    const buyRowInnerCols = 'grid grid-cols-[56px_minmax(0,1fr)_56px] gap-5';
    /** 모바일 구매: 좌측 썸네일(+{t('labels.myListingBadge')}), 우측 등급·이름만 (PC는 대칭용 빈 칸 유지) */
    const buyRowInnerColsMobile = 'grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-1.5';
    const buyRowInner = mobileExchange ? buyRowInnerColsMobile : buyRowInnerCols;
    const historyGridTemplate = mobileExchange
        ? 'grid-cols-[2.25rem_minmax(3rem,4.5rem)_minmax(0,1fr)_minmax(3.75rem,1fr)_minmax(3.75rem,1fr)]'
        : 'grid-cols-[48px_96px_minmax(0,1fr)_120px_120px]';
    const historyHeaderText = mobileExchange ? 'text-[10px] font-semibold leading-tight' : 'text-xs font-semibold';
    /** 모바일 정산: 숫자 3열은 고정 rem(구매 탭과 동일한 밀도) — 20vw×3이 첫 열(썸네일+이름)을 압도하지 않게 */
    const settlementListCols = mobileExchange
        ? 'grid-cols-[minmax(0,1fr)_4.875rem_4.875rem_4.875rem] gap-1'
        : 'grid-cols-[minmax(0,1fr)_108px_108px_108px] gap-2';
    const exchangePrimaryButtonClass =
        'mx-auto !block w-[70%] min-h-[38px] py-2 text-sm font-semibold !border !border-amber-300/45 !bg-gradient-to-b !from-amber-500/85 !to-orange-600/90';
    const exchangeSecondaryButtonClass =
        'mx-auto !block w-[70%] min-h-[38px] py-2 text-sm font-semibold !border !border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95';
    const toggleBuySort = (column: Exclude<BuySortColumn, 'latest'>) => {
        if (buySortColumn === column) {
            setBuySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setBuySortColumn(column);
        setBuySortDirection('asc');
    };

    const buyListingSelectedByUser = Boolean(selectedBuyListingId && selectedBuyListing && selectedBuyListing.id === selectedBuyListingId);

    const renderBuyEquipmentOrFallback = (opts?: {
        comfortableTypography?: boolean;
        enlargedTypography?: boolean;
        optionRowsSingleLine?: boolean;
    }) => {
        if (!selectedBuyListing || !buyDetailDisplayItem) return null;
        const cozy = Boolean(opts?.comfortableTypography);
        const enlarged = Boolean(opts?.enlargedTypography);
        const singleLineOpts = Boolean(opts?.optionRowsSingleLine);
        return (
            <EquipmentDetailPanel
                item={buyDetailDisplayItem}
                showTradeStatusUnderImage
                comfortableTypography={cozy}
                enlargedTypography={enlarged}
                optionsScrollable={!cozy && !enlarged}
                optionRowsSingleLine={singleLineOpts}
            />
        );
    };

    const renderBuyStatsCard = (opts?: { comfortableTypography?: boolean }) => {
        if (!selectedBuyListing) return null;
        const cozy = Boolean(opts?.comfortableTypography);
        const cardText =
            cozy && mobileExchange
                ? 'text-[13px] leading-snug'
                : cozy
                  ? 'text-sm leading-snug'
                  : mobileExchange
                    ? 'text-[12px] leading-snug'
                    : 'text-xs';
        const statIcon =
            cozy && !mobileExchange ? 'h-4 w-4 object-contain' : cozy && mobileExchange ? 'h-4 w-4 object-contain' : 'h-3.5 w-3.5 object-contain';
        return (
            <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-2 py-2 text-slate-200 ${cardText}`}>
                <div className="flex items-center justify-between">
                    <span>{t('labels.currentPrice')}</span>
                    <span className="flex items-center gap-1 font-semibold text-amber-200">
                        <span className="tabular-nums">{formatWalletCurrencyAmount(selectedBuyListing.price, selectedBuyListing.currency)}</span>
                        <img
                            src={selectedBuyListing.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                            alt={selectedBuyListing.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                            className={statIcon}
                        />
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                    <span>{t('labels.lowestPrice')}</span>
                    <span className="flex items-center gap-1 font-semibold text-cyan-200">
                        <span className="tabular-nums">
                            {formatWalletCurrencyAmount(
                                lowestPriceByBuyGroup.get(getBuyListingGroupKey(selectedBuyListing)) ?? selectedBuyListing.price,
                                selectedBuyListing.currency,
                            )}
                        </span>
                        <img
                            src={selectedBuyListing.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                            alt={selectedBuyListing.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                            className={statIcon}
                        />
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                    <span>{t('labels.recentPrice')}</span>
                    <span className="flex items-center gap-1 font-semibold">
                        <span className="tabular-nums">
                            {recentSoldForBuySelection
                                ? formatWalletCurrencyAmount(recentSoldForBuySelection.price, recentSoldForBuySelection.currency)
                                : '-'}
                        </span>
                        {recentSoldForBuySelection ? (
                            <img
                                src={recentSoldForBuySelection.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                alt={recentSoldForBuySelection.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                className={statIcon}
                            />
                        ) : null}
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                    <span>{t('labels.timeRemaining')}</span>
                    <span className="tabular-nums font-semibold text-cyan-200">
                        {t('labels.timeDaysHours', { days: buyRemainingDays, hours: buyRemainingHours })}
                    </span>
                </div>
            </div>
        );
    };

    const renderExchangeBuyDetailScrollableMobile = () => {
        if (!selectedBuyListing) return null;
        return (
            <div className="flex flex-col gap-2">
                {renderBuyEquipmentOrFallback({ comfortableTypography: true, optionRowsSingleLine: true })}
                {renderBuyStatsCard({ comfortableTypography: true })}
            </div>
        );
    };

    const sellFormText = mobileExchange
        ? 'text-[11px] font-medium leading-snug text-slate-200'
        : 'text-sm font-medium leading-snug text-slate-200';
    const sellFormLabel = mobileExchange
        ? 'text-[11px] font-semibold leading-snug text-slate-300'
        : 'text-sm font-semibold leading-snug text-slate-300';
    const sellFormInputNums = mobileExchange ? 'text-[11px]' : 'text-sm';
    const sellFormFeeBox = mobileExchange ? 'text-[11px] font-medium leading-snug text-cyan-100' : 'text-sm font-medium leading-snug text-cyan-100';
    const sellCurrencyRadioIcon = mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-5 w-5 object-contain';
    const sellPrimarySidebarButtonClass = `${exchangePrimaryButtonClass} ${mobileExchange ? '!text-[11px] !leading-snug' : '!text-sm !leading-snug'}`;
    const settlementDetailText = mobileExchange ? 'text-[11px] leading-snug' : 'text-sm leading-snug';
    const settlementDetailLabel = mobileExchange ? 'text-[11px] font-semibold text-slate-300' : 'text-sm font-semibold text-slate-300';
    const settlementListHeaderText = mobileExchange ? 'px-1.5 py-1 text-[10px] leading-tight' : 'px-2 py-1.5 text-sm leading-snug';
    const settlementCurrencyIcon = mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain';
    const settlementRowPriceText = mobileExchange ? 'text-[11px] leading-tight' : 'text-sm leading-snug';

    const renderSellRegistrationSidebar = (opts?: { hideSubmitButton?: boolean }) => (
        <div className="flex min-h-0 flex-col">
            <div className="space-y-1.5">
                <p className={sellFormLabel}>{t('labels.sellCurrency')}</p>
                <div className="grid grid-cols-2 gap-1.5">
                    <label className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded border px-1 py-1 ${saleCurrency === 'gold' ? 'border-amber-400/70 bg-amber-900/30' : 'border-slate-600 bg-slate-800/70'}`}>
                        <input
                            type="radio"
                            name="sale-currency"
                            value="gold"
                            checked={saleCurrency === 'gold'}
                            onChange={() => {
                                setSaleCurrency('gold');
                                setSalePrice(String(minPriceByCurrency.gold));
                            }}
                            className="sr-only"
                        />
                        <img src="/images/icon/Gold.webp" alt="" className={sellCurrencyRadioIcon} aria-hidden />
                        <span className={`${sellFormText} font-semibold text-amber-100`}>{tCommon('resources.gold')}</span>
                    </label>
                    <label className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded border px-1 py-1 ${saleCurrency === 'diamonds' ? 'border-sky-400/70 bg-sky-900/30' : 'border-slate-600 bg-slate-800/70'}`}>
                        <input
                            type="radio"
                            name="sale-currency"
                            value="diamonds"
                            checked={saleCurrency === 'diamonds'}
                            onChange={() => {
                                setSaleCurrency('diamonds');
                                setSalePrice(String(minPriceByCurrency.diamonds));
                            }}
                            className="sr-only"
                        />
                        <img src="/images/icon/Zem.webp" alt="" className={sellCurrencyRadioIcon} aria-hidden />
                        <span className={`${sellFormText} font-semibold text-sky-100`}>{tCommon('resources.diamonds')}</span>
                    </label>
                </div>
                <label className={`flex flex-col gap-1 ${sellFormText}`}>
                    <span className={sellFormLabel}>{t('labels.sellPriceInput')}</span>
                    <div
                        className={`flex items-center gap-1.5 rounded border px-1.5 py-1 ${
                            saleCurrency === 'gold' ? 'border-amber-500/55 bg-amber-950/35' : 'border-sky-500/55 bg-sky-950/30'
                        }`}
                    >
                        <input
                            type="number"
                            value={salePrice}
                            min={minimumPrice}
                            max={maxSaleListPrice}
                            onChange={(e) => setSalePrice(clampDigitsOnlyInputString(e.target.value, { max: maxSaleListPrice }))}
                            className={`w-full bg-transparent text-center font-semibold tabular-nums leading-snug outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${sellFormInputNums} ${
                                saleCurrency === 'gold' ? 'text-amber-100 placeholder:text-amber-200/45' : 'text-sky-100 placeholder:text-sky-200/45'
                            }`}
                        />
                        <img
                            src={saleCurrency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                            alt={saleCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                            className={`${mobileExchange ? 'h-3.5 w-3.5' : 'h-5 w-5'} shrink-0 object-contain`}
                        />
                    </div>
                </label>
                <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-1.5 py-1 ${sellFormText}`}>
                    <div className="flex items-center justify-between gap-1.5">
                        <span>{t('labels.currentLowest')}</span>
                        {currentLowestForSelected ? (
                            <span className="flex items-center gap-0.5 font-semibold">
                                <span className="tabular-nums">{formatWalletCurrencyAmount(currentLowestForSelected.price, saleCurrency)}</span>
                                <img
                                    src={currentLowestForSelected.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                    alt={currentLowestForSelected.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                    className={`${mobileExchange ? 'h-3.5 w-3.5' : 'h-4 w-4'} object-contain`}
                                />
                            </span>
                        ) : (
                            <span className="font-semibold">-</span>
                        )}
                    </div>
                </div>
                <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-1.5 py-1 ${sellFormText}`}>
                    <div className="flex items-center justify-between gap-1.5">
                        <span>{t('labels.recentPrice')}</span>
                        <span className={`max-w-[min(8.5rem,52%)] text-right font-semibold leading-snug ${sellFormInputNums}`}>
                            {lastSoldForSelected ? formatCurrency(lastSoldForSelected.price, lastSoldForSelected.currency) : '-'}
                        </span>
                    </div>
                </div>
                <div className={`rounded border border-cyan-700/50 bg-cyan-950/35 px-1.5 py-1 ${sellFormFeeBox}`}>
                    <div className="flex items-center justify-between gap-1.5">
                        <span>{t('labels.feePercent')}</span>
                        <span className="flex items-center gap-0.5 tabular-nums font-semibold">
                            <span>{formatWalletCurrencyAmount(saleFee, saleCurrency)}</span>
                            <img
                                src={saleCurrency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                alt={saleCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                className={`${mobileExchange ? 'h-3.5 w-3.5' : 'h-4 w-4'} object-contain`}
                            />
                        </span>
                    </div>
                </div>
            </div>
            {!opts?.hideSubmitButton ? (
                <div className="mt-2 shrink-0">
                    <Button onClick={handleRegisterSale} disabled={!selectedItem || selectedItemAlreadyListedByMe} className={sellPrimarySidebarButtonClass}>
                        {t('labels.registerSale')}
                    </Button>
                </div>
            ) : null}
        </div>
    );

    const exchangeSellAuxOpen = mobileExchange && (sellPickerOpen || sellComposerOpen);
    const mobileBuyDetailOpen = mobileExchange && activeTab === 'buy' && buyListingSelectedByUser;

    const exchangeTitleContent = (
        <span className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <span className="truncate">{t('title')}</span>
            <ExchangeTradeTicketBadge count={tradeListingTicketCount} compact={mobileExchange} />
        </span>
    );

    return (
        <>
            {showAlreadySoldModal && (
                <AlertModal
                    title={t('modals.buyNotice')}
                    message={t('modals.alreadySold')}
                    onClose={() => setShowAlreadySoldModal(false)}
                    confirmText={tCommon('actions.confirm')}
                    isTopmost
                    windowId="exchange-already-sold-alert"
                />
            )}
            {pendingRegistration && (
                <DraggableWindow
                    title={t('modals.registerConfirm')}
                    windowId="exchange-register-confirm"
                    onClose={() => setPendingRegistration(null)}
                    initialWidth={390}
                    initialHeight={380}
                    isTopmost
                    variant="store"
                >
                    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] p-3 text-slate-100 shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_24px_48px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]">
                        {(() => {
                            const item = pendingRegistration.item;
                            const gradeKey = (item.grade ?? ItemGrade.Normal) as ItemGrade;
                            const gradeStyle = gradeStyles[gradeKey];
                            const starVisual = getStarVisual(item.stars ?? 0);
                            const isTranscendent = gradeKey === 'transcendent';
                            return (
                        <div className="rounded-lg border border-slate-600/60 bg-slate-900/45 p-3">
                            <div className="flex items-center gap-2">
                                <div className={`relative h-14 w-14 overflow-hidden rounded ${isTranscendent ? 'transcendent-grade-slot' : ''}`}>
                                    <img
                                        src={gradeBackgrounds[gradeKey]}
                                        alt={gradeStyle?.name ?? gradeKey}
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    <img src={item.image} alt={item.name} className="absolute inset-0 m-auto h-[72%] w-[72%] object-contain" />
                                    {starVisual ? (
                                        <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                            <img src={starVisual.image} alt="" className="h-3 w-3" />
                                            <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{item.stars}</span>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold break-words">{item.name}</p>
                                    <p className={`text-xs font-semibold ${gradeStyle?.color ?? 'text-slate-200'}`}>[{gradeStyle?.name ?? t('filters.gradeNormal')}]</p>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1 rounded border border-slate-700/60 bg-slate-950/55 p-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">{t('labels.salePrice')}</span>
                                    <span className="flex items-center gap-1 font-semibold">
                                        <span>{formatWalletCurrencyAmount(pendingRegistration.price, pendingRegistration.currency)}</span>
                                        <img src={pendingRegistration.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'} alt="" className="h-4 w-4 object-contain" />
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">{t('labels.registrationFee')}</span>
                                    <span className="flex items-center gap-1 font-semibold">
                                        <span>{formatWalletCurrencyAmount(pendingRegistration.fee, pendingRegistration.currency)}</span>
                                        <img src={pendingRegistration.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'} alt="" className="h-4 w-4 object-contain" />
                                    </span>
                                </div>
                            </div>
                        </div>
                            );
                        })()}
                        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                            <Button
                                onClick={() => setPendingRegistration(null)}
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95"
                                colorScheme="gray"
                            >
                                {tCommon('actions.cancel')}
                            </Button>
                            <Button
                                onClick={() => {
                                    if (needsTradeListingTicket) {
                                        setPendingTicketUsageRegistration(pendingRegistration);
                                        setPendingRegistration(null);
                                        return;
                                    }
                                    void executeRegisterSale(
                                        pendingRegistration.item,
                                        pendingRegistration.price,
                                        pendingRegistration.currency,
                                        false,
                                    );
                                }}
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-amber-300/45 !bg-gradient-to-b !from-amber-500/85 !to-orange-600/90"
                            >
{t('labels.registerSale')}
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {pendingTicketUsageRegistration && (
                <DraggableWindow
                    title={t('modals.useTicketTitle')}
                    windowId="exchange-ticket-usage-confirm"
                    onClose={() => setPendingTicketUsageRegistration(null)}
                    initialWidth={390}
                    initialHeight={280}
                    hideFooter
                    isTopmost
                    variant="store"
                >
                    <div className="relative flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border border-amber-500/35 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] p-3 text-slate-100 shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_24px_48px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-900/30">
                                <img src="/images/use/allowtrade.webp" alt={t('modals.useTicket')} className="h-10 w-10 object-contain" />
                            </div>
                            <p className="text-sm font-semibold text-amber-100">{t('modals.useTicket')}</p>
                        </div>
                        <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 pt-1">
                            <Button
                                onClick={() => setPendingTicketUsageRegistration(null)}
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95"
                                colorScheme="gray"
                            >
                                {tCommon('actions.cancel')}
                            </Button>
                            <Button
                                onClick={() =>
                                    void executeRegisterSale(
                                        pendingTicketUsageRegistration.item,
                                        pendingTicketUsageRegistration.price,
                                        pendingTicketUsageRegistration.currency,
                                        true,
                                    )
                                }
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-amber-300/45 !bg-gradient-to-b !from-amber-500/85 !to-orange-600/90"
                            >
{t('labels.registerSale')}
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {pendingCancelListing && (
                <DraggableWindow
                    title={t('modals.cancelSaleConfirm')}
                    windowId="exchange-cancel-confirm"
                    onClose={() => setPendingCancelListing(null)}
                    initialWidth={390}
                    initialHeight={380}
                    isTopmost
                    variant="store"
                >
                    <div className="relative flex h-full min-h-0 flex-col justify-between gap-3 overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] p-3 text-slate-100 shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_24px_48px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]">
                        <div className="space-y-2 text-center">
                            <div className="flex justify-center">
                                <div className="relative h-16 w-16 overflow-hidden rounded bg-black/25">
                                    <img
                                        src={gradeBackgrounds[(pendingCancelListing.itemGrade ?? ItemGrade.Normal) as ItemGrade]}
                                        alt={pendingCancelListing.itemName}
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    {pendingCancelListing.itemImage ? (
                                        <img
                                            src={pendingCancelListing.itemImage}
                                            alt={pendingCancelListing.itemName}
                                            className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain"
                                        />
                                    ) : null}
                                    {(() => {
                                        const stars = pendingCancelListing.itemStars ?? 0;
                                        const starVisual = getStarVisual(stars);
                                        if (!starVisual || stars <= 0) return null;
                                        return (
                                            <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                                <img src={starVisual.image} alt="" className="h-3 w-3" />
                                                <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{stars}</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <p className="text-sm font-semibold text-amber-100">{pendingCancelListing.itemName}</p>
                            <p className="text-sm leading-relaxed text-slate-200">
                                {t('alerts.registrationFeeNonRefundable')}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button
                                onClick={() => {
                                    handleCancelListing(pendingCancelListing.listingId);
                                    setPendingCancelListing(null);
                                }}
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-amber-300/45 !bg-gradient-to-b !from-amber-500/85 !to-orange-600/90"
                            >
                                {tCommon('actions.cancel')}
                            </Button>
                            <Button
                                onClick={() => setPendingCancelListing(null)}
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95"
                                colorScheme="gray"
                            >
{t('labels.keep')}
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {purchaseSuccessData && (
                <DraggableWindow
                    title={t('modals.purchaseConfirm')}
                    windowId="exchange-purchase-success"
                    onClose={() => setPurchaseSuccessData(null)}
                    initialWidth={390}
                    initialHeight={370}
                    isTopmost
                    variant="store"
                >
                    <div className="relative flex h-full min-h-0 flex-col justify-between gap-3 overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] p-3 text-slate-100 shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_24px_48px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]">
                        <div className="space-y-2 text-center">
                            <div className="flex justify-center">
                                <div className="relative h-16 w-16 overflow-hidden rounded bg-black/25">
                                    <img
                                        src={gradeBackgrounds[(purchaseSuccessData.inventoryItem?.grade ?? purchaseSuccessData.listing.itemGrade ?? ItemGrade.Normal) as ItemGrade]}
                                        alt={purchaseSuccessData.listing.itemName}
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    {(purchaseSuccessData.inventoryItem?.image ?? purchaseSuccessData.listing.itemImage) ? (
                                        <img
                                            src={purchaseSuccessData.inventoryItem?.image ?? purchaseSuccessData.listing.itemImage}
                                            alt={purchaseSuccessData.listing.itemName}
                                            className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain"
                                        />
                                    ) : null}
                                    {(() => {
                                        const stars = purchaseSuccessData.inventoryItem?.stars ?? purchaseSuccessData.listing.itemStars ?? 0;
                                        const starVisual = getStarVisual(stars);
                                        if (!starVisual || stars <= 0) return null;
                                        return (
                                            <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                                <img src={starVisual.image} alt="" className="h-3 w-3" />
                                                <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{stars}</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <p className="text-sm font-semibold text-amber-100">{purchaseSuccessData.listing.itemName}</p>
                            <p className="text-sm leading-relaxed text-slate-200">
                                {t('labels.purchaseCompleteMessage', { defaultValue: t('labels.purchaseComplete') })}
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={() => setPurchaseSuccessData(null)}
                            className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-amber-300/45 !bg-gradient-to-b !from-amber-500/85 !to-orange-600/90"
                        >
{tCommon('actions.confirm')}
                        </Button>
                    </div>
                </DraggableWindow>
            )}
            {settlementObtainItems && settlementObtainItems.length === 1 ? (
                <ItemObtainedModal
                    item={settlementObtainItems[0]}
                    onClose={() => setSettlementObtainItems(null)}
                    isTopmost
                />
            ) : null}
            {settlementObtainItems && settlementObtainItems.length > 1 ? (
                <BulkItemObtainedModal items={settlementObtainItems} onClose={() => setSettlementObtainItems(null)} isTopmost />
            ) : null}
            {mobileBuyDetailOpen && selectedBuyListing ? (
                <DraggableWindow
                    title={t('modals.purchase')}
                    windowId="exchange-buy-item"
                    onClose={() => setSelectedBuyListingId('')}
                    initialWidth={MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH}
                    shrinkHeightToContent
                    isTopmost={Boolean(isTopmost)}
                    variant="store"
                    mobileViewportFit
                    mobileViewportMaxHeightVh={98}
                    mobileViewportMaxHeightCss={MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS}
                    mobileViewportDvhBottomGapPx={8}
                    hideFooter
                    bodyScrollable
                    bodyPaddingClassName={MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS}
                >
                    <div className="flex w-full min-w-0 flex-col gap-1.5">
                        {renderExchangeBuyDetailScrollableMobile()}
                        <div className="shrink-0 border-t border-slate-700/50 pt-2">
                            <Button
                                onClick={() => void handleBuy(selectedBuyListing.id)}
                                disabled={selectedBuyListingIsMine}
                                className={`${exchangePrimaryButtonClass} !text-xs !leading-snug`}
                            >
                                {selectedBuyListingIsMine ? t('labels.myListing') : t('modals.purchase')}
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            ) : null}
            {mobileExchange && sellPickerOpen && activeTab === 'sell' && (
                <DraggableWindow
                    title={t('modals.selectGear')}
                    windowId="exchange-sell-picker"
                    onClose={() => setSellPickerOpen(false)}
                    initialWidth={520}
                    initialHeight={920}
                    isTopmost={Boolean(isTopmost) && !mobileBuyDetailOpen}
                    variant="store"
                    mobileViewportFit
                    mobileViewportMaxHeightCss="min(100dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))"
                    mobileViewportDvhBottomGapPx={0}
                    bodyScrollable={false}
                    bodyNoScroll
                    bodyPaddingClassName="!p-0 !flex !flex-col !min-h-0 !h-full"
                    mobileLockViewportHeight
                    mobileViewportMaxHeightVh={100}
                >
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="flex min-h-0 max-h-[min(50dvh,360px)] flex-[1.1_1_0] flex-row gap-2 border-b border-slate-600/40 bg-slate-950/40 px-2 pb-1.5 pt-1.5">
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/50">
                                {selectedItem ? (
                                    <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent]">
                                        <EquipmentDetailPanel
                                            item={selectedItem}
                                            showTradeStatusUnderImage
                                            comfortableTypography={mobileExchange}
                                            optionRowsSingleLine={mobileExchange}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center">
                                        <p className="text-[11px] font-semibold leading-snug text-slate-300">{t('labels.selectGearHint')}</p>
                                        <p className="text-[11px] font-medium leading-snug text-slate-500">{t('labels.selectGearSub')}</p>
                                    </div>
                                )}
                            </div>
                            <div
                                className={`flex w-[min(42%,11.75rem)] shrink-0 flex-col overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-900/45 px-1.5 py-1.5 sm:w-[min(40%,12.25rem)] ${BAG_SCROLLBAR_Y_CLASS}`}
                            >
                                {renderSellRegistrationSidebar({ hideSubmitButton: true })}
                            </div>
                        </div>
                        <div className="flex min-h-[10rem] max-h-[min(42dvh,320px)] shrink-0 flex-[1_1_0] flex-col overflow-hidden px-2 pb-1 pt-1.5">
                            <div className="mb-1.5 flex shrink-0 items-center justify-end">
                                <select
                                    value={inventorySortKey}
                                    onChange={(e) => setInventorySortKey(e.target.value as InventorySortKey)}
                                    className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[11px] font-semibold leading-snug text-slate-200"
                                    aria-label={t('sort.label', { defaultValue: 'Sort' })}
                                >
                                    <option value="createdAt">{t('sort.newest')}</option>
                                    <option value="grade">{t('sort.grade')}</option>
                                    <option value="name">{t('sort.name')}</option>
                                </select>
                            </div>
                            <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable] ${BAG_SCROLLBAR_Y_CLASS}`}>
                                <InventoryGrid
                                    inventory={sortedSellableItems}
                                    inventorySlots={Math.max(sortedSellableItems.length, 30)}
                                    onSelectItem={(item) => setSelectedItemId(item.id)}
                                    selectedItemId={selectedItemId || null}
                                    disabledItemIds={[]}
                                    columnCount={6}
                                    gapPx={6}
                                />
                            </div>
                        </div>
                        <div className={`flex shrink-0 border-t border-slate-600/50 bg-slate-900/80 px-2.5 py-2.5 ${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS}`}>
                            <Button
                                type="button"
                                onClick={handleRegisterSale}
                                disabled={!selectedItem || selectedItemAlreadyListedByMe}
                                className={`${exchangePrimaryButtonClass} min-h-[42px] !mx-0 !w-full !py-2 !text-[11px] font-bold leading-snug`}
                            >
                                {t('labels.registerSale')}
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {(() => {
                const exchangePanel = (
                    <>
                    <div className={`grid grid-cols-5 gap-1 rounded-lg border border-slate-700/60 bg-slate-900/70 p-1 ${mobileExchange ? 'mb-2' : 'mb-3'}`}>
                        <button
                            onClick={() => setActiveTab('buy')}
                            className={`${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'buy' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
{t('modals.purchase')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('currency')}
                            className={`relative overflow-visible ${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'currency' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
                            {t('tabs.currency')}
                            {unclaimedCurrencyReceipts.length > 0 ? (
                                <span
                                    className="pointer-events-none absolute right-0.5 top-0.5 h-2 w-2 rounded-full border-2 border-slate-900 bg-red-500 sm:right-1 sm:top-1 sm:h-2.5 sm:w-2.5"
                                    aria-hidden
                                />
                            ) : null}
                        </button>
                        <button
                            onClick={() => setActiveTab('sell')}
                            className={`relative overflow-visible ${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'sell' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
                            {t('labels.registerSale')}
                            {myRecoverableListings.length > 0 ? (
                                <span
                                    className="pointer-events-none absolute right-0.5 top-0.5 h-2 w-2 rounded-full border-2 border-slate-900 bg-red-500 sm:right-1 sm:top-1 sm:h-2.5 sm:w-2.5"
                                    aria-hidden
                                />
                            ) : null}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('settlement')}
                            className={`relative overflow-visible ${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'settlement' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
{t('tabs.settlement')}
                            {unclaimedSettlements.length > 0 ? (
                                <span
                                    className="pointer-events-none absolute right-0.5 top-0.5 h-2 w-2 rounded-full border-2 border-slate-900 bg-red-500 sm:right-1 sm:top-1 sm:h-2.5 sm:w-2.5"
                                    aria-hidden
                                />
                            ) : null}
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'history' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
                            {t('tabs.history')}
                        </button>
                    </div>

                    <div
                        className={`min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/55 ${mobileExchange ? 'p-2' : 'p-3'} ${
                            activeTab === 'settlement' || activeTab === 'history' || activeTab === 'currency' ? 'flex min-h-0 flex-col' : ''
                        }`}
                    >
                        {activeTab === 'currency' && (
                            <ExchangeCurrencyTab
                                currentUser={currentUser}
                                mobileExchange={mobileExchange}
                                walletGold={walletGold}
                                walletDiamonds={walletDiamonds}
                                primaryButtonClass={exchangePrimaryButtonClass}
                                onAction={onAction}
                            />
                        )}

                        {activeTab === 'buy' && (
                            <div
                                className={
                                    mobileExchange
                                        ? 'flex h-full min-h-0 flex-col gap-2'
                                        : 'grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]'
                                }
                            >
                                {!exchangeBuyListingsRevealReady ? (
                                    <div
                                        className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-cyan-500/25 bg-gradient-to-b from-slate-900/55 via-slate-950/85 to-slate-950/95 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:col-span-2 ${
                                            mobileExchange ? 'min-h-[min(50dvh,20rem)]' : 'min-h-[16rem]'
                                        }`}
                                    >
                                        <div
                                            className="h-10 w-10 shrink-0 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300"
                                            aria-hidden
                                        />
                                        <p className={`font-semibold text-slate-100 ${mobileExchange ? 'text-xs' : 'text-sm'}`}>
                                            {t('loading.items', { defaultValue: 'Loading trade items…' })}
                                        </p>
                                        <p
                                            className={`max-w-[18rem] px-2 text-slate-500 ${mobileExchange ? 'text-[11px] leading-snug' : 'text-xs leading-relaxed'}`}
                                        >
                                            {t('loading.wait', { defaultValue: 'Please wait while we fetch the latest list.' })}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`flex h-full min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/40 ${mobileExchange ? 'p-2' : 'p-3'}`}>
                                    <div className="mb-2 flex flex-col gap-2 sm:grid sm:grid-cols-[auto_auto_auto_1fr] sm:items-stretch">
                                        <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:contents">
                                            <select
                                                value={buySlotFilter}
                                                onChange={(e) => setBuySlotFilter(e.target.value as BuySlotFilter)}
                                                className="min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1.5 text-[11px] font-semibold leading-snug text-slate-200 sm:px-2 sm:text-xs"
                                            >
                                                {BUY_SLOT_FILTER_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={buyGradeFilter}
                                                onChange={(e) => setBuyGradeFilter(e.target.value as BuyGradeFilter)}
                                                className="min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1.5 text-[11px] font-semibold leading-snug text-slate-200 sm:px-2 sm:text-xs"
                                            >
                                                {buyGradeFilterOptions.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={buyCurrencyFilter}
                                                onChange={(e) => setBuyCurrencyFilter(e.target.value as BuyCurrencyFilter)}
                                                className="min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1.5 text-[11px] font-semibold leading-snug text-slate-200 sm:px-2 sm:text-xs"
                                            >
                                                {buyCurrencyFilterOptions.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex min-w-0 items-stretch gap-1.5">
                                            <input
                                                type="text"
                                                value={buySearchText}
                                                onChange={(e) => setBuySearchText(e.target.value)}
                                                placeholder={t('labels.searchPlaceholder')}
                                                className={`min-w-0 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-slate-100 outline-none placeholder:text-slate-400 ${mobileExchange ? 'text-[11px] leading-snug' : 'text-xs'}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBuyManualRefreshCooldownUntilMs(Date.now() + 5000);
                                                    void refreshMarketListings();
                                                }}
                                                aria-label={t('labels.refresh')}
                                                title={t('labels.refresh')}
                                                className={`shrink-0 rounded border border-slate-600 bg-slate-800 text-slate-200 transition hover:border-slate-400 hover:text-white ${mobileExchange ? 'w-8 text-[13px]' : 'w-9 text-sm'} ${buyRefreshButtonDisabled ? 'opacity-70' : ''}`}
                                                disabled={buyRefreshButtonDisabled}
                                            >
                                                ↻
                                            </button>
                                        </div>
                                    </div>
                                    <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                        <div
                                            className={`sticky top-0 z-10 mb-2 grid rounded border border-slate-600/70 bg-slate-900/95 font-semibold text-slate-300 backdrop-blur-sm ${buyListCols} ${mobileExchange ? 'px-1.5 py-1 text-[11px] leading-tight' : 'px-2 py-1.5 text-[11px]'}`}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>{t('labels.name')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBuySort('name')}
                                                    className={`leading-none ${buySortColumn === 'name' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {buySortColumn === 'name' && buySortDirection === 'asc' ? '▲' : '▼'}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>{t('labels.currentPrice')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBuySort('currentPrice')}
                                                    className={`leading-none ${buySortColumn === 'currentPrice' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {buySortColumn === 'currentPrice' && buySortDirection === 'asc' ? '▲' : '▼'}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>{t('labels.lowestPrice')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBuySort('lowestPrice')}
                                                    className={`leading-none ${buySortColumn === 'lowestPrice' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {buySortColumn === 'lowestPrice' && buySortDirection === 'asc' ? '▲' : '▼'}
                                                </button>
                                            </div>
                                        </div>
                                        {filteredAndSortedBuyItems.length === 0 && (
                                            <div
                                                className={`rounded border border-slate-700/60 bg-slate-900/40 px-3 py-8 text-center text-slate-300 ${mobileExchange ? `${exchM}` : 'text-sm'}`}
                                            >
                                                {t('labels.noListings')}
                                            </div>
                                        )}
                                        <div className={mobileExchange ? 'space-y-1.5' : 'space-y-2'}>
                                        {filteredAndSortedBuyItems.map((listing) => {
                                            const gradeKey = (listing.itemGrade ?? ItemGrade.Normal) as ItemGrade;
                                            const gradeLabel = localizedGrade(gradeKey);
                                            const gradeColor = gradeStyles[gradeKey]?.color ?? 'text-slate-200';
                                            const starVisual = getStarVisual(listing.itemStars ?? 0);
                                            const isMyListing = listing.sellerId === currentUser.id;
                                            return (
                                            <button
                                                key={listing.id}
                                                type="button"
                                                onClick={() => setSelectedBuyListingId(listing.id)}
                                                className={`grid w-full min-w-0 items-center rounded-lg border py-2 text-left transition ${buyListCols} ${
                                                    mobileExchange ? 'px-1.5' : 'px-2'
                                                } ${
                                                    selectedBuyListingId === listing.id
                                                        ? 'border-cyan-400/70 bg-cyan-900/25'
                                                        : 'border-slate-700/60 bg-slate-900/50 hover:border-slate-500/70'
                                                }`}
                                            >
                                                <div className={`min-w-0 items-center ${buyRowInner}`}>
                                                    <div
                                                        className={`relative shrink-0 ${mobileExchange ? 'h-10 w-10' : 'h-14 w-14'}`}
                                                        title={isMyListing ? t('labels.myListing') : undefined}
                                                    >
                                                        <div className="relative h-full w-full overflow-hidden rounded bg-black/25">
                                                            <img
                                                                src={gradeBackgrounds[gradeKey]}
                                                                alt={gradeLabel}
                                                                className="absolute inset-0 h-full w-full object-cover"
                                                            />
                                                            {listing.itemImage ? (
                                                                <img src={listing.itemImage} alt={listing.itemName} className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain" />
                                                            ) : null}
                                                            {starVisual ? (
                                                                <div
                                                                    className={`absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 ${mobileExchange ? 'px-0.5 py-px' : 'px-1 py-0.5'}`}
                                                                >
                                                                    <img src={starVisual.image} alt="" className={mobileExchange ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                                                                    <span className={`font-bold leading-none ${mobileExchange ? 'text-[8px]' : 'text-[10px]'} ${starVisual.color}`}>{listing.itemStars}</span>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        {isMyListing ? (
                                                            <span
                                                                className={`pointer-events-none absolute bottom-0 left-1/2 z-20 max-w-[calc(100%+0.25rem)] -translate-x-1/2 translate-y-1/2 truncate rounded-full border border-violet-400/60 bg-violet-950/95 px-0.5 py-px font-bold leading-none text-violet-100 shadow-md ring-1 ring-black/20 ${mobileExchange ? 'text-[8px]' : 'px-1 text-[10px]'}`}
                                                            >
                                                                {t('labels.myListingBadge')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className={`min-w-0 ${mobileExchange ? 'text-center' : 'pl-1 text-center'}`}>
                                                        <span
                                                            className={`block font-semibold leading-none ${gradeColor} ${mobileExchange ? 'text-[10px] leading-tight' : 'text-xs'}`}
                                                        >
                                                            [{gradeLabel}]
                                                        </span>
                                                        {mobileExchange ? (
                                                            <span
                                                                className="mt-0.5 block break-words text-center text-[11px] font-semibold leading-snug text-slate-100 [overflow-wrap:anywhere] line-clamp-2"
                                                                title={listing.itemName}
                                                            >
                                                                {listing.itemName}
                                                            </span>
                                                        ) : (
                                                            <span className="mt-0.5 block whitespace-nowrap text-sm font-semibold leading-none text-slate-100">{listing.itemName}</span>
                                                        )}
                                                    </div>
                                                    {!mobileExchange ? <div className="h-14 w-14" aria-hidden /> : null}
                                                </div>
                                                <div
                                                    className={`flex w-full min-w-0 max-w-full flex-row items-center justify-center font-bold text-amber-200 ${mobileExchange ? 'gap-0.5 text-[11px] leading-tight' : 'gap-1 text-sm leading-tight'}`}
                                                >
                                                    <span className={`min-w-0 tabular-nums ${mobileExchange ? 'max-w-[calc(100%-1rem)] truncate' : ''}`}>
                                                        {formatWalletCurrencyAmount(listing.price, listing.currency)}
                                                    </span>
                                                    <img
                                                        src={listing.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                        alt={listing.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                        className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'}
                                                    />
                                                </div>
                                                <div
                                                    className={`flex w-full min-w-0 max-w-full flex-row items-center justify-center font-bold text-cyan-200 ${mobileExchange ? 'gap-0.5 text-[11px] leading-tight' : 'gap-1 text-sm leading-tight'}`}
                                                >
                                                    <span className={`min-w-0 tabular-nums ${mobileExchange ? 'max-w-[calc(100%-1rem)] truncate' : ''}`}>
                                                        {formatWalletCurrencyAmount(
                                                            lowestPriceByBuyGroup.get(getBuyListingGroupKey(listing)) ?? listing.price,
                                                            listing.currency,
                                                        )}
                                                    </span>
                                                    <img
                                                        src={listing.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                        alt={listing.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                        className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'}
                                                    />
                                                </div>
                                            </button>
                                            );
                                        })}
                                        </div>
                                    </div>
                                </div>
                                {!mobileExchange ? (
                                    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                        <div className="min-h-0 flex-1 overflow-hidden">
                                            {selectedBuyListing ? (
                                                <div className="flex h-full min-h-0 flex-col gap-2">
                                                    <div className="min-h-0 flex-1 overflow-hidden">
                                                        {renderBuyEquipmentOrFallback({ enlargedTypography: true })}
                                                    </div>
                                                    {renderBuyStatsCard({ comfortableTypography: true })}
                                                </div>
                                            ) : (
                                                <div className="h-full rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                            )}
                                        </div>
                                        <div className="mt-2 shrink-0">
                                            <Button
                                                onClick={() => {
                                                    if (selectedBuyListing) void handleBuy(selectedBuyListing.id);
                                                }}
                                                disabled={!selectedBuyListing || selectedBuyListingIsMine}
                                                className={exchangePrimaryButtonClass}
                                            >
                                                {selectedBuyListingIsMine ? t('labels.myListing') : t('modals.purchase')}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                                    </>
                                )}
                            </div>
                        )}
                        {activeTab === 'sell' &&
                            (mobileExchange ? (
                                <div className="flex h-full min-h-0 flex-col gap-2">
                                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-amber-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/98 p-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]">
                                        <p className="mb-1.5 shrink-0 text-[11px] font-bold text-amber-200">{t('labels.registeredItems')}</p>
                                        <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                            <div className="space-y-2">
                                                {isAdminUser && sellSlots.length === 0 && (
                                                    <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2">
                                                        <div className="h-12 rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                                    </div>
                                                )}
                                                {sellSlots.map((slot, idx) => {
                                                    if (!slot) {
                                                        return (
                                                            <div key={`sell-slot-${idx}`} className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2">
                                                                <div className="h-12 rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                                            </div>
                                                        );
                                                    }
                                                    const computed = listingsWithComputed.find((entry) => entry.id === slot.id);
                                                    const isExpired = Boolean(computed?.isExpired);
                                                    const verification = computed?.effectiveVerification ?? 'verifying';
                                                    const remainingMs = Math.max(0, (slot.expiresAt ?? nowMs) - nowMs);
                                                    const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
                                                    const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                                                    const slotGradeKey = (slot.itemGrade ?? ItemGrade.Normal) as ItemGrade;
                                                    const slotGradeLabel = localizedGrade(slotGradeKey);
                                                    const slotGradeColor = gradeStyles[slotGradeKey]?.color ?? 'text-slate-200';
                                                    return (
                                                        <div
                                                            key={`sell-slot-${idx}`}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => {
                                                                setSellSlotFocusItemId(slot.itemId);
                                                                const inv = allEquipmentItems.find((entry) => entry.id === slot.itemId);
                                                                if (inv) onViewListedEquipment?.(inv, true);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    setSellSlotFocusItemId(slot.itemId);
                                                                    const inv = allEquipmentItems.find((entry) => entry.id === slot.itemId);
                                                                    if (inv) onViewListedEquipment?.(inv, true);
                                                                }
                                                            }}
                                                            className={`w-full cursor-pointer rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-left transition hover:border-amber-300/65 ${sellSlotFocusItemId === slot.itemId ? 'ring-2 ring-amber-300/60' : ''}`}
                                                        >
                                                            <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-2">
                                                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-black/25">
                                                                    {slot.itemGrade ? (
                                                                        <img
                                                                            src={gradeBackgrounds[slot.itemGrade as ItemGrade]}
                                                                            alt={slot.itemGrade}
                                                                            className="absolute inset-0 h-full w-full object-cover"
                                                                        />
                                                                    ) : null}
                                                                    {slot.itemImage ? (
                                                                        <img
                                                                            src={slot.itemImage}
                                                                            alt={slot.itemName}
                                                                            className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain"
                                                                        />
                                                                    ) : null}
                                                                    {(() => {
                                                                        const stars = slot.itemStars ?? 0;
                                                                        const starVisual = getStarVisual(stars);
                                                                        if (!starVisual || stars <= 0) return null;
                                                                        return (
                                                                            <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-0.5 py-px">
                                                                                <img src={starVisual.image} alt="" className="h-2.5 w-2.5" />
                                                                                <span className={`text-[8px] font-bold leading-none ${starVisual.color}`}>{stars}</span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                <div className="min-w-0 text-center">
                                                                    <span className={`block text-[10px] font-semibold leading-none ${slotGradeColor}`}>[{slotGradeLabel}]</span>
                                                                    <span
                                                                        className="mt-0.5 block break-words text-center text-[11px] font-semibold leading-snug text-slate-100 [overflow-wrap:anywhere] line-clamp-2"
                                                                        title={slot.itemName}
                                                                    >
                                                                        {slot.itemName}
                                                                    </span>
                                                                    <div className="mt-1 flex min-w-0 items-center justify-center gap-1 text-[11px] font-semibold leading-tight text-slate-100">
                                                                        <span className="max-w-full truncate tabular-nums">
                                                                            {formatWalletCurrencyAmount(slot.price, slot.currency)}
                                                                        </span>
                                                                        <img
                                                                            src={slot.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                                            alt={slot.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                                            className="h-3.5 w-3.5 shrink-0 object-contain"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex min-w-[6.25rem] shrink-0 flex-col items-center gap-0.5">
                                                                    <span
                                                                        className={`w-full text-center text-[11px] font-semibold leading-tight ${verification === 'verifying' ? 'text-cyan-200' : isExpired ? 'text-rose-300' : 'text-emerald-200'}`}
                                                                    >
                                                                        {verification === 'verifying' ? t('labels.registering') : isExpired ? t('labels.expired') : t('labels.timeDaysHours', { days: remainingDays, hours: remainingHours })}
                                                                    </span>
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <Button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                isExpired ? handleRecoverListing(slot.id) : handleRequestCancelListing(slot.id);
                                                                            }}
                                                                            disabled={isExpired && listingRecoverCooldownSecondsLeft > 0}
                                                                            title={
                                                                                isExpired && listingRecoverCooldownSecondsLeft > 0
                                                                                    ? t('labels.recoverCooldown', { seconds: listingRecoverCooldownSecondsLeft })
                                                                                    : undefined
                                                                            }
                                                                            className={`!flex !min-h-[22px] !w-[4.85rem] !shrink-0 !items-center !justify-center !border !px-1.5 !py-0.5 !text-[11px] !font-semibold !leading-none !tracking-wide rounded-md ${
                                                                                isExpired
                                                                                    ? '!border-rose-300/40 !bg-gradient-to-b !from-rose-500/80 !to-rose-700/90'
                                                                                    : '!border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95'
                                                                            }`}
                                                                        >
                                                                            {isExpired ? t('labels.recover') : t('labels.cancelSale')}
                                                                        </Button>
                                                                        {isExpired && listingRecoverCooldownSecondsLeft > 0 ? (
                                                                            <span
                                                                                className="min-w-[0.85rem] shrink-0 text-center text-[11px] font-bold tabular-nums leading-none text-rose-200"
                                                                                aria-live="polite"
                                                                            >
                                                                                {listingRecoverCooldownSecondsLeft}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 rounded-xl border border-amber-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/98 p-2.5 shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.55)]">
                                        <p className="mb-2.5 text-center text-[11px] font-medium leading-relaxed text-slate-400">
                                            {t('labels.newGearHint')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSellComposerOpen(false);
                                                setSelectedItemId('');
                                                setSellSlotFocusItemId('');
                                                setSellPickerOpen(true);
                                            }}
                                            className="w-full rounded-xl border-2 border-amber-400/55 bg-gradient-to-b from-amber-600/55 via-amber-500/35 to-orange-950/50 px-3 py-2.5 text-[11px] font-bold leading-snug text-amber-50 shadow-[0_12px_28px_-14px_rgba(251,191,36,0.55)] transition hover:border-amber-300/80 active:scale-[0.99]"
                                        >
                                            {t('modals.selectGear')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full min-h-0 flex-col gap-3">
                                    <div className="shrink-0 grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)_minmax(200px,228px)]">
                                        <div className="flex h-[340px] min-h-[340px] max-h-[340px] min-w-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                            <p className="text-sm font-semibold text-amber-200">{t('labels.registeredItems')}</p>
                                            <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                                <div className="space-y-2">
                                                    {isAdminUser && sellSlots.length === 0 && (
                                                        <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2">
                                                            <div className="h-12 rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                                        </div>
                                                    )}
                                                    {sellSlots.map((slot, idx) => {
                                                        if (!slot) {
                                                            return (
                                                                <div key={`sell-slot-pc-${idx}`} className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2">
                                                                    <div className="h-12 rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                                                </div>
                                                            );
                                                        }
                                                        const computed = listingsWithComputed.find((entry) => entry.id === slot.id);
                                                        const isExpired = Boolean(computed?.isExpired);
                                                        const verification = computed?.effectiveVerification ?? 'verifying';
                                                        const remainingMs = Math.max(0, (slot.expiresAt ?? nowMs) - nowMs);
                                                        const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
                                                        const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                                                        const slotGradeKey = (slot.itemGrade ?? ItemGrade.Normal) as ItemGrade;
                                                        const slotGradeLabel = localizedGrade(slotGradeKey);
                                                        const slotGradeColor = gradeStyles[slotGradeKey]?.color ?? 'text-slate-200';
                                                        return (
                                                            <div
                                                                key={`sell-slot-pc-${idx}`}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => setSelectedItemId(slot.itemId)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        setSelectedItemId(slot.itemId);
                                                                    }
                                                                }}
                                                                className={`w-full cursor-pointer rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-left transition hover:border-amber-300/65 ${selectedItemId === slot.itemId ? 'ring-2 ring-amber-300/60' : ''}`}
                                                            >
                                                                <div className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2">
                                                                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-black/25">
                                                                        {slot.itemGrade ? (
                                                                            <img
                                                                                src={gradeBackgrounds[slot.itemGrade as ItemGrade]}
                                                                                alt={slot.itemGrade}
                                                                                className="absolute inset-0 h-full w-full object-cover"
                                                                            />
                                                                        ) : null}
                                                                        {slot.itemImage ? (
                                                                            <img
                                                                                src={slot.itemImage}
                                                                                alt={slot.itemName}
                                                                                className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain"
                                                                            />
                                                                        ) : null}
                                                                        {(() => {
                                                                            const stars = slot.itemStars ?? 0;
                                                                            const starVisual = getStarVisual(stars);
                                                                            if (!starVisual || stars <= 0) return null;
                                                                            return (
                                                                                <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                                                                    <img src={starVisual.image} alt="" className="h-3 w-3" />
                                                                                    <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{stars}</span>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    <div className="min-w-0 pl-1 text-center">
                                                                        <span className={`block text-sm font-semibold leading-none ${slotGradeColor}`}>[{slotGradeLabel}]</span>
                                                                        <span
                                                                            className="mt-0.5 block truncate whitespace-nowrap text-base font-semibold leading-none text-slate-100"
                                                                            title={slot.itemName}
                                                                        >
                                                                            {slot.itemName}
                                                                        </span>
                                                                        <div className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold leading-tight text-slate-100">
                                                                            <span className="tabular-nums">
                                                                                {formatWalletCurrencyAmount(slot.price, slot.currency)}
                                                                            </span>
                                                                            <img
                                                                                src={slot.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                                                alt={slot.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                                                className="h-4 w-4 object-contain"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex min-w-[5.75rem] shrink-0 flex-col items-center gap-1">
                                                                        <span
                                                                            className={`w-full text-center text-sm font-semibold leading-tight ${verification === 'verifying' ? 'text-cyan-200' : isExpired ? 'text-rose-300' : 'text-emerald-200'}`}
                                                                        >
                                                                            {verification === 'verifying' ? t('labels.registering') : isExpired ? t('labels.expired') : t('labels.timeDaysHours', { days: remainingDays, hours: remainingHours })}
                                                                        </span>
                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                            <Button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    isExpired ? handleRecoverListing(slot.id) : handleRequestCancelListing(slot.id);
                                                                                }}
                                                                                disabled={isExpired && listingRecoverCooldownSecondsLeft > 0}
                                                                                title={
                                                                                    isExpired && listingRecoverCooldownSecondsLeft > 0
                                                                                        ? t('labels.recoverCooldown', { seconds: listingRecoverCooldownSecondsLeft })
                                                                                        : undefined
                                                                                }
                                                                                className={`!flex !w-[4.5rem] !shrink-0 !items-center !justify-center min-h-[26px] rounded-md !border px-1 py-0.5 text-sm leading-none font-semibold tracking-wide ${
                                                                                    isExpired
                                                                                        ? '!border-rose-300/40 !bg-gradient-to-b !from-rose-500/80 !to-rose-700/90'
                                                                                        : '!border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95'
                                                                                }`}
                                                                            >
                                                                                {isExpired ? t('labels.recover') : t('labels.cancelSale')}
                                                                            </Button>
                                                                            {isExpired && listingRecoverCooldownSecondsLeft > 0 ? (
                                                                                <span
                                                                                    className="min-w-[0.9rem] shrink-0 text-center text-xs font-bold tabular-nums leading-none text-rose-200"
                                                                                    aria-live="polite"
                                                                                >
                                                                                    {listingRecoverCooldownSecondsLeft}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="min-h-0 rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                            {selectedItem ? (
                                                <div className="h-[340px] min-h-[340px] max-h-[340px] overflow-hidden">
                                                    <EquipmentDetailPanel
                                                        item={selectedItem}
                                                        showTradeStatusUnderImage
                                                        enlargedTypography={!mobileExchange}
                                                        comfortableTypography={mobileExchange}
                                                        optionRowsSingleLine={mobileExchange}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="h-[340px] min-h-[340px] max-h-[340px] rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                            )}
                                        </div>
                                        <div className="flex min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">{renderSellRegistrationSidebar()}</div>
                                    </div>
                                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                                        <div className="mb-2 flex items-center justify-end">
                                            <select
                                                value={inventorySortKey}
                                                onChange={(e) => setInventorySortKey(e.target.value as InventorySortKey)}
                                                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-semibold leading-snug text-slate-200"
                                                aria-label={t('sort.label', { defaultValue: 'Sort' })}
                                            >
                                                <option value="createdAt">{t('sort.newest')}</option>
                                                <option value="grade">{t('sort.grade')}</option>
                                                <option value="name">{t('sort.name')}</option>
                                            </select>
                                        </div>
                                        {sellableItems.length === 0 ? (
                                            <div className="h-14 rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                        ) : (
                                            <div className={`min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950/55 p-2 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-12">
                                                    {sortedSellableItems.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => setSelectedItemId(item.id)}
                                                            className={`relative aspect-square rounded-lg border transition ${
                                                                selectedItemId === item.id
                                                                    ? 'border-cyan-400/75 bg-cyan-900/25 ring-2 ring-cyan-400/70'
                                                                    : 'border-slate-700/70 bg-slate-900/55 hover:border-slate-500/70'
                                                            }`}
                                                            title={item.name}
                                                        >
                                                            <img
                                                                src={gradeBackgrounds[item.grade as ItemGrade]}
                                                                alt={item.grade}
                                                                className="absolute inset-0 h-full w-full rounded-lg object-cover opacity-90"
                                                            />
                                                            <img
                                                                src={item.image}
                                                                alt={item.name}
                                                                className="absolute inset-0 m-auto h-[64%] w-[64%] object-contain"
                                                            />
                                                            {(() => {
                                                                const starVisual = getStarVisual(item.stars ?? 0);
                                                                if (!starVisual) return null;
                                                                return (
                                                                    <div className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                                                        <img src={starVisual.image} alt="" className="h-3 w-3" />
                                                                        <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{item.stars}</span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                        {activeTab === 'settlement' && (
                            <div className="flex h-full min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:gap-3">
                                <div
                                    className={`flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/40 ${mobileExchange ? 'min-h-0 flex-1 p-2' : 'p-3'}`}
                                >
                                    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                        <div
                                            className={`sticky top-0 z-10 mb-2 grid shrink-0 items-center rounded border border-slate-600/70 bg-slate-900/95 font-semibold text-slate-300 backdrop-blur-sm ${settlementListCols} ${settlementListHeaderText}`}
                                        >
                                            <span className="text-center">{t('labels.name')}</span>
                                            <span className="text-center">{t('labels.salePrice')}</span>
                                            <span className="text-center">{t('labels.fee')}</span>
                                            <span className="text-center">{t('labels.netAmount')}</span>
                                        </div>
                                        {settlementDisplayItems.length === 0 && (
                                            <div
                                                className={`flex flex-1 items-center justify-center rounded border border-slate-700/60 bg-slate-900/40 text-center text-slate-300 ${mobileExchange ? `min-h-[8rem] px-2 py-6 ${exchM}` : 'min-h-0 px-3 py-8 text-sm leading-snug'}`}
                                            >
                                                {t('labels.noSettlement')}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {settlementDisplayItems.map((entry) => {
                                                const gradeKey = (entry.itemGrade ?? ItemGrade.Normal) as ItemGrade;
                                                const gradeLabel = localizedGrade(gradeKey);
                                                const starVisual = getStarVisual(entry.itemStars ?? 0);
                                                const currencyIcon = entry.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp';
                                                const currencyAlt = entry.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds');
                                                return (
                                                    <button
                                                        key={entry.listingId}
                                                        type="button"
                                                        onClick={() => setSelectedSettlementId(entry.listingId)}
                                                        className={`grid w-full items-center rounded-lg border text-left transition ${settlementListCols} ${
                                                            mobileExchange ? 'px-1.5 py-1.5' : 'px-2 py-2'
                                                        } ${
                                                            selectedSettlement?.listingId === entry.listingId
                                                                ? 'border-cyan-400/70 bg-cyan-900/25'
                                                                : 'border-slate-700/60 bg-slate-900/50 hover:border-slate-500/70'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`min-w-0 items-center ${mobileExchange ? 'grid grid-cols-[48px_minmax(0,1fr)] gap-1.5' : 'grid grid-cols-[56px_minmax(0,1fr)_56px] gap-2'}`}
                                                        >
                                                            <div className={`relative shrink-0 overflow-hidden rounded bg-black/25 ${mobileExchange ? 'h-12 w-12' : 'h-14 w-14'}`}>
                                                                <img src={gradeBackgrounds[gradeKey]} alt={gradeLabel} className="absolute inset-0 h-full w-full object-cover" />
                                                                {entry.itemImage ? <img src={entry.itemImage} alt={entry.itemName} className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain" /> : null}
                                                                {starVisual ? (
                                                                    <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                                                        <img src={starVisual.image} alt="" className="h-3 w-3" />
                                                                        <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{entry.itemStars}</span>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            {mobileExchange ? (
                                                                <p className="min-w-0 text-left text-[11px] font-semibold leading-tight text-slate-100">
                                                                    <span className={`${gradeStyles[gradeKey]?.color ?? 'text-slate-200'}`}>[{gradeLabel}]</span>{' '}
                                                                    <span className="line-clamp-2 break-words">{entry.itemName}</span>
                                                                </p>
                                                            ) : (
                                                                <p
                                                                    className="min-w-0 whitespace-nowrap text-center font-semibold"
                                                                    style={{
                                                                        fontSize: `${Math.max(12, Math.min(15, Math.floor(15 - Math.max(0, (`[${gradeLabel}] ${entry.itemName}`).length - 16) * 0.22)))}px`,
                                                                        letterSpacing: '-0.015em',
                                                                    }}
                                                                >
                                                                    <span className={`${gradeStyles[gradeKey]?.color ?? 'text-slate-200'}`}>[{gradeLabel}]</span>{' '}
                                                                    <span>{entry.itemName}</span>
                                                                </p>
                                                            )}
                                                            {!mobileExchange ? <div className="h-14 w-14" aria-hidden /> : null}
                                                        </div>
                                                        <div
                                                            className={`flex items-center justify-center gap-1 font-semibold text-amber-100 ${settlementRowPriceText}`}
                                                        >
                                                            <span className="tabular-nums">{formatWalletCurrencyAmount(entry.soldPrice, entry.currency)}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className={settlementCurrencyIcon} />
                                                        </div>
                                                        <div
                                                            className={`flex items-center justify-center gap-1 font-semibold text-rose-200 ${settlementRowPriceText}`}
                                                        >
                                                            <span className="tabular-nums">{formatWalletCurrencyAmount(entry.fee, entry.currency)}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className={settlementCurrencyIcon} />
                                                        </div>
                                                        <div
                                                            className={`flex items-center justify-center gap-1 font-bold text-emerald-200 ${settlementRowPriceText}`}
                                                        >
                                                            <span className="tabular-nums">{formatWalletCurrencyAmount(entry.net, entry.currency)}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className={settlementCurrencyIcon} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className={`flex h-full min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/45 ${mobileExchange ? 'shrink-0 p-2' : 'p-3'} ${
                                        mobileExchange
                                            ? 'border-t border-amber-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/98 shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.5)]'
                                            : ''
                                    }`}
                                >
                                    {selectedSettlement ? (
                                        <div className="flex h-full min-h-0 flex-col gap-3">
                                            <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-3 py-2.5 text-slate-100 ${settlementDetailText}`}>
                                                <p className={`mb-1.5 ${settlementDetailLabel}`}>{t('labels.selectedItem')}</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-rose-200">{t('labels.fee')}</span>
                                                    <span className="flex items-center gap-1 tabular-nums font-semibold text-rose-200">
                                                        <span>{formatWalletCurrencyAmount(selectedSettlement.fee, selectedSettlement.currency)}</span>
                                                        <img
                                                            src={selectedSettlement.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                            alt={selectedSettlement.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                            className={settlementCurrencyIcon}
                                                        />
                                                    </span>
                                                </div>
                                                <div className="mt-1.5 flex items-center justify-between">
                                                    <span>{t('labels.netAmount')}</span>
                                                    <span className="flex items-center gap-1 tabular-nums font-bold text-emerald-200">
                                                        <span>{formatWalletCurrencyAmount(selectedSettlement.net, selectedSettlement.currency)}</span>
                                                        <img
                                                            src={selectedSettlement.currency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                            alt={selectedSettlement.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                            className={settlementCurrencyIcon}
                                                        />
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-3 py-2.5 text-slate-100 ${settlementDetailText}`}>
                                                <p className={`mb-1.5 ${settlementDetailLabel}`}>{t('labels.allItems')}</p>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="shrink-0 text-rose-200">{t('labels.fee')}</span>
                                                        <div className="grid min-w-0 grid-cols-2 items-center gap-1.5">
                                                            <span className="flex min-w-[4.5rem] items-center justify-end gap-1 tabular-nums font-semibold text-rose-200">
                                                                <span>{formatGoldAmountKoG(settlementTotals.selectedFeeGold)}</span>
                                                                <img src="/images/icon/Gold.webp" alt={tCommon('resources.gold')} className={settlementCurrencyIcon} />
                                                            </span>
                                                            <span className="flex min-w-[4.5rem] items-center justify-end gap-1 tabular-nums font-semibold text-rose-200">
                                                                <span>{formatWalletDiamonds(settlementTotals.selectedFeeDiamonds)}</span>
                                                                <img src="/images/icon/Zem.webp" alt={tCommon('resources.diamonds')} className={settlementCurrencyIcon} />
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="shrink-0 text-emerald-200">{t('labels.netAmount')}</span>
                                                        <div className="grid min-w-0 grid-cols-2 items-center gap-1.5">
                                                            <span className="flex min-w-[4.5rem] items-center justify-end gap-1 tabular-nums font-bold text-emerald-200">
                                                                <span>{formatGoldAmountKoG(settlementTotals.selectedNetGold)}</span>
                                                                <img src="/images/icon/Gold.webp" alt={tCommon('resources.gold')} className={settlementCurrencyIcon} />
                                                            </span>
                                                            <span className="flex min-w-[4.5rem] items-center justify-end gap-1 tabular-nums font-bold text-emerald-200">
                                                                <span>{formatWalletDiamonds(settlementTotals.selectedNetDiamonds)}</span>
                                                                <img src="/images/icon/Zem.webp" alt={tCommon('resources.diamonds')} className={settlementCurrencyIcon} />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-auto shrink-0 space-y-2 pt-1">
                                                <Button onClick={() => handleClaimSettlement(selectedSettlement.listingId)} className={exchangePrimaryButtonClass}>
                                                    {t('labels.claimSelected')}
                                                </Button>
                                                <Button onClick={handleClaimAllSettlements} disabled={settlementDisplayItems.length === 0} className={exchangeSecondaryButtonClass}>
                                                    {t('labels.claimAll')}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`flex h-full min-h-0 flex-1 items-center justify-center rounded border border-dashed border-slate-700/70 bg-slate-950/40 text-center text-slate-300 ${mobileExchange ? `px-2 py-6 ${exchM}` : 'px-3 py-10 text-sm leading-snug'}`}
                                        >
                                            {t('labels.noSettlementPending')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className={`flex min-h-0 flex-1 flex-col ${mobileExchange ? 'gap-1.5' : 'gap-2'}`}>
                                <div className="shrink-0">
                                    <div
                                        className={`mx-auto flex w-full max-w-[560px] ${mobileExchange ? 'flex-col gap-1.5' : 'flex-col gap-2 sm:flex-row sm:items-stretch'}`}
                                    >
                                        <div
                                            className={`flex w-full items-center justify-center rounded border border-slate-700/60 bg-slate-900/45 text-center font-semibold text-slate-100 ${
                                                mobileExchange
                                                    ? 'min-h-0 whitespace-normal px-2 py-2 text-[11px] leading-snug'
                                                    : 'min-h-[3.25rem] whitespace-nowrap px-3 py-2.5 text-base sm:w-[260px] sm:text-lg'
                                            }`}
                                        >
                                            {t('labels.totalHistoryCount', { count: visibleExchangeHistory.length })}
                                        </div>
                                        <div
                                            className={`flex-1 rounded border border-slate-700/60 bg-slate-900/45 text-slate-200 ${
                                                mobileExchange ? 'space-y-1.5 px-2 py-2 text-[11px] leading-snug' : 'space-y-2 px-3 py-2.5 text-base'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`font-semibold text-rose-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}>{t('labels.totalSpent')}</span>
                                                <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-1">
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-rose-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatGoldAmountKoG(historySummary.totals.outGold)}</span>
                                                        <img src="/images/icon/Gold.webp" alt={tCommon('resources.gold')} className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
                                                    </span>
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-rose-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatWalletDiamonds(historySummary.totals.outDiamonds)}</span>
                                                        <img src="/images/icon/Zem.webp" alt={tCommon('resources.diamonds')} className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`font-semibold text-emerald-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}>{t('labels.totalIncome')}</span>
                                                <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-1">
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-emerald-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatGoldAmountKoG(historySummary.totals.inGold)}</span>
                                                        <img src="/images/icon/Gold.webp" alt={tCommon('resources.gold')} className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
                                                    </span>
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-emerald-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatWalletDiamonds(historySummary.totals.inDiamonds)}</span>
                                                        <img src="/images/icon/Zem.webp" alt={tCommon('resources.diamonds')} className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <div
                                        className={`grid items-center rounded border border-slate-600/70 bg-slate-900/95 text-slate-300 ${historyGridTemplate} ${
                                            mobileExchange ? 'gap-1 px-1.5 py-1' : 'gap-2 px-2 py-1.5'
                                        } ${historyHeaderText}`}
                                    >
                                        <span />
                                        <span className="text-center">{t('labels.statusLabel')}</span>
                                        <span className="text-center">{t('labels.dateTime')}</span>
                                        <span className="text-center">{t('labels.price')}</span>
                                        <span className="text-center">{t('labels.fee')}</span>
                                    </div>
                                </div>
                                <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                    {visibleExchangeHistory.length === 0 && (
                                        <div className={`rounded border border-slate-700/60 bg-slate-900/40 px-3 py-8 text-center text-slate-300 ${mobileExchange ? exchM : 'text-sm'}`}>
                                            {t('labels.noHistory')}
                                        </div>
                                    )}
                                    <div className={mobileExchange ? 'space-y-1.5' : 'space-y-2'}>
                                        {historySummary.rows.map((row, idx) => (
                                            <div
                                                key={`${row.line}-${idx}`}
                                                className={`grid items-center rounded border border-slate-700/60 bg-slate-900/45 ${historyGridTemplate} ${
                                                    mobileExchange ? 'gap-1 px-1.5 py-1.5' : 'gap-2 px-2 py-2'
                                                } ${mobileExchange ? exchM : ''}`}
                                            >
                                                <div
                                                    className={`relative shrink-0 overflow-hidden rounded bg-black/25 ring-1 ring-slate-600/60 ${mobileExchange ? 'h-9 w-9' : 'h-10 w-10'}`}
                                                >
                                                    <img src={gradeBackgrounds[row.itemGrade]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                                    <img src={row.itemImage} alt="" className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain" />
                                                    {(() => {
                                                        const starVisual = getStarVisual(row.itemStars ?? 0);
                                                        if (!starVisual) return null;
                                                        return (
                                                            <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/60 px-0.5 py-[1px]">
                                                                <img src={starVisual.image} alt="" className="h-2.5 w-2.5 object-contain" />
                                                                <span className={`font-bold leading-none ${starVisual.color} ${mobileExchange ? 'text-[10px]' : 'text-[8px]'}`}>{row.itemStars}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <p className={`text-center font-semibold text-slate-200 ${mobileExchange ? 'text-[11px] leading-tight' : 'text-sm'}`}>{row.statusText}</p>
                                                <p
                                                    className={`break-words text-center text-slate-200 ${mobileExchange ? 'text-[11px] leading-tight' : 'text-base'}`}
                                                    title={row.timestampText}
                                                >
                                                    {row.timestampText}
                                                </p>
                                                <div
                                                    className={`flex items-center justify-center gap-0.5 font-semibold ${row.statusText === t('labels.settlementReceived') ? 'text-emerald-400' : 'text-slate-100'} ${mobileExchange ? 'text-[11px] leading-tight' : 'text-base'}`}
                                                >
                                                    {row.priceCurrency ? (
                                                        <>
                                                            <span className="min-w-0 truncate tabular-nums">
                                                                {formatWalletCurrencyAmount(row.priceAmount, row.priceCurrency)}
                                                            </span>
                                                            <img
                                                                src={row.priceCurrency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                                alt={row.priceCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                                className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'}
                                                            />
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-500">-</span>
                                                    )}
                                                </div>
                                                <div className={`flex items-center justify-center gap-0.5 font-semibold text-rose-400 ${mobileExchange ? 'text-[11px] leading-tight' : 'text-base'}`}>
                                                    {row.feeCurrency ? (
                                                        <>
                                                            <span className="min-w-0 truncate tabular-nums">
                                                                {formatWalletCurrencyAmount(row.feeAmount, row.feeCurrency)}
                                                            </span>
                                                            <img
                                                                src={row.feeCurrency === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                                                alt={row.feeCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                                className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'}
                                                            />
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-500">-</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    </>
                );
                if (embedded) {
                    return (
                        <div className={`${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS} text-slate-100 ${mobileExchange ? exchM : ''}`}>
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{exchangePanel}</div>
                        </div>
                    );
                }
                return (
                    <DraggableWindow
                        title={t('title')}
                        titleContent={exchangeTitleContent}
                        onClose={onClose}
                        windowId="exchange"
                        initialWidth={980}
                        initialHeight={820}
                        isTopmost={Boolean(isTopmost) && !mobileBuyDetailOpen && !exchangeSellAuxOpen}
                        variant="store"
                        headerShowTitle
                        mobileViewportFit={mobileExchange}
                        mobileViewportMaxHeightVh={98}
                        mobileLockViewportHeight={mobileExchange}
                        bodyScrollable={!mobileExchange}
                        bodyPaddingClassName={
                            mobileExchange
                                ? 'flex min-h-0 min-w-0 flex-1 flex-col !px-2.5 !pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] !pt-2'
                                : undefined
                        }
                    >
                        <div className={`flex h-full min-h-0 flex-col text-slate-100 ${mobileExchange ? exchM : ''}`}>
                            {exchangePanel}
                        </div>
                    </DraggableWindow>
                );
            })()}
        </>
    );
};

export default ExchangeModal;
