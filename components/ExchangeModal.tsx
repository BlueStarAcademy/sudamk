import React, { useMemo, useRef, useState } from 'react';
import type { InventoryItem, UserWithStatus, ServerAction, ItemGrade, EquipmentSlot } from '../types.js';
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

type ExchangeTab = 'buy' | 'sell' | 'settlement' | 'history';
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
    /** 등록 시점 장비 스냅샷(옵션·제련 등). 구매자 상세 표시에 사용 */
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
    allUsers?: Record<string, UserWithStatus>;
    onClose: () => void;
    onAction?: (action: ServerAction) => void | Promise<void | { error?: string }>;
    isTopmost?: boolean;
    /** 판매 등록·구매 미리보기 장비를 ItemDetailModal로 표시 (두 번째 인자: 내 소유 여부) */
    onViewListedEquipment?: (item: InventoryItem, isOwnedByCurrentUser?: boolean) => void;
}

/** 등록 직후 서버에 아직 없는 id는 유지하고, 동일 id는 서버 행으로 덮어씀 */
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

const MAX_SELL_SLOTS = 3;
const LISTING_MAX_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const VERIFICATION_MS = 30 * 1000;
const TRADE_LISTING_TICKET_NAME = '거래 등록권';

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

/** 거래 이력: 동일 이름 다건일 때 가격·재화(및 정산 시 판매가=실수령+수수료)으로 등록 건 추정 */
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

    if (line.includes('구매 완료') && priceCurrency) {
        const priced = byName.filter((l) => l.price === priceAmount && l.currency === priceCurrency);
        if (priced.length > 0) return pickNewest(priced);
    }
    if (
        line.includes('정산 수령') &&
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
    const genericFallback = '/images/Box/ResourceBox1.png';
    if (!name) {
        return {
            itemImage: line.includes('정산') ? '/images/Box/GoldBox3.png' : genericFallback,
            itemGrade: 'normal',
            itemStars: 0,
        };
    }

    const imgListed = listing?.itemImage?.trim();
    if (imgListed) {
        return {
            itemImage: imgListed.startsWith('/') ? imgListed : `/${imgListed}`,
            itemGrade: ((listing?.itemGrade as ItemGrade | undefined) ?? inventoryItem?.grade ?? 'normal') as ItemGrade,
            itemStars: listing?.itemStars ?? inventoryItem?.stars ?? 0,
        };
    }

    const snap = listing?.listedEquipment;
    if (isListingEquipmentSnapshot(snap) && snap.image?.trim()) {
        return {
            itemImage: normalizeExchangeAssetPath(snap.image),
            itemGrade: (snap.grade as ItemGrade) ?? (listing?.itemGrade as ItemGrade) ?? inventoryItem?.grade ?? 'normal',
            itemStars: snap.stars ?? listing?.itemStars ?? inventoryItem?.stars ?? 0,
        };
    }

    const gradeHint = (listing?.itemGrade as ItemGrade | undefined) ?? inventoryItem?.grade ?? 'normal';
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
        'normal';
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
    const grade = (listing.itemGrade ?? 'normal') as ItemGrade;
    const name = listing.itemName?.trim() || '장비';
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
    `${formatWalletCurrencyAmount(value, currency)}${currency === 'gold' ? '골드' : '다이아'}`;

/** 거래소 정산 수령 → 공통 아이템 획득 모달(ItemObtainedModal)용 가상 인벤 행 */
function createExchangeSettlementCurrencyObtainItem(currency: SaleCurrency, quantity: number): InventoryItem {
    const now = Date.now();
    const isGold = currency === 'gold';
    return {
        id: `exchange-settlement-reward-${isGold ? 'gold' : 'diamonds'}-${now}-${Math.random().toString(36).slice(2, 9)}`,
        name: isGold ? '골드' : '다이아몬드',
        description: '',
        type: 'consumable',
        slot: null,
        quantity: Math.max(0, quantity),
        level: 1,
        isEquipped: false,
        createdAt: now,
        image: isGold ? '/images/icon/Gold.png' : '/images/icon/Zem.png',
        grade: 'normal',
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
    line.includes('구매 완료') || line.includes('정산 모두 수령') || line.includes('정산 수령');

const getBuyListingGroupKey = (entry: Pick<ExchangeListing, 'itemName' | 'itemGrade' | 'itemStars' | 'itemSlot' | 'currency'>): string =>
    [entry.itemName, entry.itemGrade ?? 'normal', entry.itemStars ?? 0, entry.itemSlot ?? 'none', entry.currency].join('::');

const getStarVisual = (stars: number): { image: string; color: string } | null => {
    if (stars >= 10) return { image: '/images/equipments/Star4.png', color: 'prism-text-effect' };
    if (stars >= 7) return { image: '/images/equipments/Star3.png', color: 'text-purple-400' };
    if (stars >= 4) return { image: '/images/equipments/Star2.png', color: 'text-amber-400' };
    if (stars >= 1) return { image: '/images/equipments/Star1.png', color: 'text-white' };
    return null;
};

const BUY_SLOT_FILTER_OPTIONS: Array<{ value: BuySlotFilter; label: string }> = [
    { value: 'all', label: '종류(전체)' },
    { value: 'fan', label: '부채' },
    { value: 'board', label: '바둑판' },
    { value: 'top', label: '상의' },
    { value: 'bottom', label: '하의' },
    { value: 'bowl', label: '바둑통' },
    { value: 'stones', label: '바둑알' },
];
const BUY_CURRENCY_FILTER_OPTIONS: Array<{ value: BuyCurrencyFilter; label: string }> = [
    { value: 'all', label: '재화(전체)' },
    { value: 'gold', label: '골드상품' },
    { value: 'diamonds', label: '다이아상품' },
];
const BUY_GRADE_FILTER_OPTIONS: Array<{ value: BuyGradeFilter; label: string }> = [
    { value: 'all', label: '등급(전체)' },
    { value: 'normal', label: '일반' },
    { value: 'uncommon', label: '고급' },
    { value: 'rare', label: '희귀' },
    { value: 'epic', label: '에픽' },
    { value: 'legendary', label: '전설' },
    { value: 'mythic', label: '신화' },
    { value: 'transcendent', label: '초월' },
];

const ExchangeModal: React.FC<ExchangeModalProps> = ({ currentUser, allUsers, onClose, onAction, isTopmost, onViewListedEquipment }) => {
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
                    !item.isExchangeListed &&
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
        () =>
            (currentUser.inventory ?? [])
                .filter((item: InventoryItem) => item.type === 'material' && item.name === TRADE_LISTING_TICKET_NAME)
                .reduce((sum, item) => sum + (item.quantity ?? 1), 0),
        [currentUser.inventory],
    );
    const allowedListingCount = isAdminUser ? Number.POSITIVE_INFINITY : functionVipActive ? MAX_SELL_SLOTS : tradeListingTicketCount;
    const maxSaleListPrice = maxExchangeListPrice(saleCurrency);
    const saleFee = exchangeListingFeeFromPrice(clampGameInt(Math.floor(Number(salePrice || 0)), { min: 0, max: maxSaleListPrice }));
    const minimumPrice = minPriceByCurrency[saleCurrency];
    const selectedItem = allEquipmentItems.find((entry) => entry.id === selectedItemId);
    const myActiveListings = listings.filter((listing) => listing.sellerId === currentUser.id && listing.status === 'listed');
    const refreshMarketListings = React.useCallback(async () => {
        setIsRefreshingBuyListings(true);
        try {
            const response = await fetch(getApiUrl('/api/exchange/listings'));
            if (!response.ok) return;
            const data = (await response.json()) as { listings?: ExchangeListing[] };
            setMarketListingsRemote(Array.isArray(data?.listings) ? data.listings : []);
            setMarketListingsLoaded(true);
        } catch {
            // noop: keep previous data on fetch failure
        } finally {
            setIsRefreshingBuyListings(false);
        }
    }, []);
    React.useEffect(() => {
        if (activeTab !== 'buy') return;
        void refreshMarketListings();
        const timer = window.setInterval(() => {
            void refreshMarketListings();
        }, 5000);
        return () => window.clearInterval(timer);
    }, [activeTab, refreshMarketListings]);
    const marketListings = useMemo(() => {
        const merged = new Map<string, ExchangeListing>();
        const remoteIds = new Set<string>();
        marketListingsRemote.forEach((entry) => {
            if (!entry || !entry.id) return;
            remoteIds.add(entry.id);
            merged.set(entry.id, entry);
        });
        Object.values(allUsers ?? {}).forEach((user) => {
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
        // 내 로컬 상태를 우선 반영해 저장 지연/수신 지연 중에도 구매 탭 표시를 유지
        listings.forEach((entry) => {
            if (!entry || !entry.id) return;
            if (marketListingsLoaded && !remoteIds.has(entry.id)) return;
            merged.set(entry.id, entry);
        });
        return Array.from(merged.values());
    }, [allUsers, listings, marketListingsLoaded, marketListingsRemote]);
    const sellSlots = isAdminUser
        ? myActiveListings
        : Array.from({ length: MAX_SELL_SLOTS }, (_, idx) => myActiveListings[idx] ?? null);
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
        const serverListings = (currentUser.exchangeState?.listings as ExchangeListing[] | undefined) ?? [];
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
        const timestamp = new Date().toLocaleString();
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
                window.alert('거래 등록권이 부족합니다.');
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
                window.alert('기능 VIP는 최대 3개 상품까지만 판매 등록할 수 있습니다.');
            } else if (!isAdminUser) {
                window.alert('거래 등록권이 부족합니다. 등록권 1장으로 판매물품 1개를 등록할 수 있습니다.');
            }
            return;
        }
        const item = selectedItem;
        if (!item) {
            window.alert('인벤토리에서 판매할 장비를 선택해주세요.');
            return;
        }
        if (item.isBound) {
            window.alert('귀속된 장비는 판매할 수 없습니다. 귀속 해제권을 사용해주세요.');
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
            window.alert(`최소 판매가는 ${formatCurrency(minimumPrice, saleCurrency)}입니다.`);
            return;
        }
        if (saleCurrency === 'gold' && walletGold < saleFee) {
            window.alert(`등록 수수료가 부족합니다. 필요: ${formatCurrency(saleFee, saleCurrency)}`);
            return;
        }
        if (saleCurrency === 'diamonds' && walletDiamonds < saleFee) {
            window.alert(`등록 수수료가 부족합니다. 필요: ${formatCurrency(saleFee, saleCurrency)}`);
            return;
        }
        setSellComposerOpen(false);
        setSellPickerOpen(false);
        setPendingRegistration({ item, price: parsedPrice, currency: saleCurrency, fee: saleFee });
    };
    const requiresTradeListingTicket = !functionVipActive && !isAdminUser;

    const handleBuy = async (listingId: string) => {
        const listing = marketListings.find((entry) => entry.id === listingId);
        if (!listing) {
            setShowAlreadySoldModal(true);
            return;
        }
        if (listing.sellerId === currentUser.id) {
            window.alert('본인이 등록한 물품은 구매할 수 없습니다.');
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
            window.alert('골드가 부족합니다.');
            return;
        }
        if (listing.currency === 'diamonds' && walletDiamonds < listing.price) {
            window.alert('다이아가 부족합니다.');
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
        appendHistory(`구매 완료: ${listing.itemName} / ${formatCurrency(listing.price, listing.currency)}`);
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

        appendHistory(`정산 수령: ${settlement.itemName} / 실수령 ${formatCurrency(netAmount, settlement.currency)} (판매 수수료 ${formatCurrency(claimFee, settlement.currency)})`);
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
            `정산 모두 수령: 골드 ${formatGoldAmountKoG(totalGoldNet)} / 다이아 ${formatWalletDiamonds(totalDiamondsNet)}`,
        );
    };

    const handleCancelListing = (listingId: string) => {
        const target = listings.find((entry) => entry.id === listingId);
        if (!target || target.status !== 'listed') return;
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
            itemGrade: (target.itemGrade as ItemGrade | undefined) ?? 'normal',
            itemStars: target.itemStars ?? 0,
        });
    };

    const handleRecoverListing = (listingId: string) => {
        const target = listings.find((entry) => entry.id === listingId);
        if (!target || target.status !== 'listed') return;
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
                (buyGradeFilter === 'all' ? true : (entry.itemGrade ?? 'normal') === buyGradeFilter) &&
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
                    itemGrade: (linkedListing?.itemGrade as ItemGrade | undefined) ?? 'normal',
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
            const timestampText = timestampMatch?.[1] ?? '-';
            const message = line.replace(/^\[[^\]]+\]\s*/, '');
            const statusText = line.includes('구매 완료')
                ? '구매 완료'
                : line.includes('정산 수령') || line.includes('정산 모두 수령')
                  ? '정산 수령'
                  : '-';
            const itemNameMatch = message.match(/^[^:]+:\s*([^/]+?)(?:\s*\/|$)/);
            const itemName = itemNameMatch?.[1]?.trim();
            const matches = [...line.matchAll(/([0-9,]+)(골드|다이아)/g)];
            const priceMatch = matches[0];
            const feeMatch = line.match(/수수료[^0-9]*([0-9,]+)(골드|다이아)/);
            const priceAmount = priceMatch ? Number((priceMatch[1] ?? '0').replace(/,/g, '')) || 0 : 0;
            const priceCurrency = (priceMatch?.[2] === '다이아' ? 'diamonds' : priceMatch ? 'gold' : null) as SaleCurrency | null;
            const feeAmount = feeMatch ? Number((feeMatch[1] ?? '0').replace(/,/g, '')) || 0 : 0;
            const feeCurrency = (feeMatch?.[2] === '다이아' ? 'diamonds' : feeMatch ? 'gold' : null) as SaleCurrency | null;
            // 총 지출: 구매 완료 결제 금액만
            if (line.includes('구매 완료') && priceMatch) {
                if (priceMatch[2] === '골드') totals.outGold += priceAmount;
                else totals.outDiamonds += priceAmount;
            }
            // 총 수입: 정산 실수령(모두 수령은 줄에 있는 골드·다이아 각각)
            if (line.includes('정산 모두 수령')) {
                matches.forEach((m) => {
                    const amount = Number((m[1] ?? '0').replace(/,/g, '')) || 0;
                    if (m[2] === '골드') totals.inGold += amount;
                    else totals.inDiamonds += amount;
                });
            } else if (line.includes('정산 수령') && priceMatch) {
                if (priceMatch[2] === '골드') totals.inGold += priceAmount;
                else totals.inDiamonds += priceAmount;
            }
            if (line.includes('정산 모두 수령')) {
                const goldBulk = line.match(/골드\s*([0-9,]+)/);
                const diaBulk = line.match(/다이아\s*([0-9,]+)/);
                const gBulk = goldBulk ? Number((goldBulk[1] ?? '0').replace(/,/g, '')) || 0 : 0;
                const dBulk = diaBulk ? Number((diaBulk[1] ?? '0').replace(/,/g, '')) || 0 : 0;
                let bulkImage = '/images/Box/GoldBox3.png';
                if (gBulk > 0 && dBulk === 0) bulkImage = '/images/icon/Gold.png';
                else if (dBulk > 0 && gBulk === 0) bulkImage = '/images/icon/Zem.png';
                return {
                    line,
                    timestampText,
                    statusText,
                    itemImage: bulkImage,
                    itemGrade: 'normal' as ItemGrade,
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
    }, [visibleExchangeHistory, listings, allEquipmentItems]);
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
    /** 모바일 구매: 좌측 썸네일(+내 등록), 우측 등급·이름만 (PC는 대칭용 빈 칸 유지) */
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

    const renderBuyEquipmentOrFallback = (opts?: { comfortableTypography?: boolean; optionRowsSingleLine?: boolean }) => {
        if (!selectedBuyListing || !buyDetailDisplayItem) return null;
        const cozy = Boolean(opts?.comfortableTypography);
        const singleLineOpts = Boolean(opts?.optionRowsSingleLine);
        return (
            <EquipmentDetailPanel
                item={buyDetailDisplayItem}
                showTradeStatusUnderImage
                comfortableTypography={cozy}
                optionsScrollable={!cozy}
                optionRowsSingleLine={singleLineOpts}
            />
        );
    };

    const renderBuyStatsCard = (opts?: { comfortableTypography?: boolean }) => {
        if (!selectedBuyListing) return null;
        const cozy = Boolean(opts?.comfortableTypography);
        const cardText =
            cozy && mobileExchange ? 'text-[13px] leading-snug' : mobileExchange ? 'text-[12px] leading-snug' : 'text-xs';
        const statIcon = cozy && mobileExchange ? 'h-4 w-4 object-contain' : 'h-3.5 w-3.5 object-contain';
        return (
            <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-2 py-2 text-slate-200 ${cardText}`}>
                <div className="flex items-center justify-between">
                    <span>현재가</span>
                    <span className="flex items-center gap-1 font-semibold text-amber-200">
                        <span className="tabular-nums">{formatWalletCurrencyAmount(selectedBuyListing.price, selectedBuyListing.currency)}</span>
                        <img
                            src={selectedBuyListing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                            alt={selectedBuyListing.currency === 'gold' ? '골드' : '다이아'}
                            className={statIcon}
                        />
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                    <span>최저가</span>
                    <span className="flex items-center gap-1 font-semibold text-cyan-200">
                        <span className="tabular-nums">
                            {formatWalletCurrencyAmount(
                                lowestPriceByBuyGroup.get(getBuyListingGroupKey(selectedBuyListing)) ?? selectedBuyListing.price,
                                selectedBuyListing.currency,
                            )}
                        </span>
                        <img
                            src={selectedBuyListing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                            alt={selectedBuyListing.currency === 'gold' ? '골드' : '다이아'}
                            className={statIcon}
                        />
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                    <span>최근 거래가</span>
                    <span className="flex items-center gap-1 font-semibold">
                        <span className="tabular-nums">
                            {recentSoldForBuySelection
                                ? formatWalletCurrencyAmount(recentSoldForBuySelection.price, recentSoldForBuySelection.currency)
                                : '-'}
                        </span>
                        {recentSoldForBuySelection ? (
                            <img
                                src={recentSoldForBuySelection.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                alt={recentSoldForBuySelection.currency === 'gold' ? '골드' : '다이아'}
                                className={statIcon}
                            />
                        ) : null}
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                    <span>남은 시간</span>
                    <span className="tabular-nums font-semibold text-cyan-200">
                        {buyRemainingDays}일 {buyRemainingHours}시간
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
        : 'text-xs font-medium leading-snug text-slate-200';
    const sellFormLabel = mobileExchange
        ? 'text-[11px] font-semibold leading-snug text-slate-300'
        : 'text-xs font-semibold leading-snug text-slate-300';
    const sellFormInputNums = mobileExchange ? 'text-[11px]' : 'text-xs';
    const sellFormFeeBox = mobileExchange ? 'text-[11px] font-medium leading-snug text-cyan-100' : 'text-xs font-medium leading-snug text-cyan-100';
    const sellCurrencyRadioIcon = mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain';
    const sellPrimarySidebarButtonClass = `${exchangePrimaryButtonClass} ${mobileExchange ? '!text-[11px] !leading-snug' : '!text-xs !leading-snug'}`;

    const renderSellRegistrationSidebar = (opts?: { hideSubmitButton?: boolean }) => (
        <div className="flex min-h-0 flex-col">
            <div className="space-y-1.5">
                <p className={sellFormLabel}>판매 재화 종류</p>
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
                        <img src="/images/icon/Gold.png" alt="" className={sellCurrencyRadioIcon} aria-hidden />
                        <span className={`${sellFormText} font-semibold text-amber-100`}>골드</span>
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
                        <img src="/images/icon/Zem.png" alt="" className={sellCurrencyRadioIcon} aria-hidden />
                        <span className={`${sellFormText} font-semibold text-sky-100`}>다이아</span>
                    </label>
                </div>
                <label className={`flex flex-col gap-1 ${sellFormText}`}>
                    <span className={sellFormLabel}>판매 가격 입력</span>
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
                            src={saleCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                            alt={saleCurrency === 'gold' ? '골드' : '다이아'}
                            className={`${mobileExchange ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 object-contain`}
                        />
                    </div>
                </label>
                <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-1.5 py-1 ${sellFormText}`}>
                    <div className="flex items-center justify-between gap-1.5">
                        <span>현재 최저가</span>
                        {currentLowestForSelected ? (
                            <span className="flex items-center gap-0.5 font-semibold">
                                <span className="tabular-nums">{formatWalletCurrencyAmount(currentLowestForSelected.price, saleCurrency)}</span>
                                <img
                                    src={currentLowestForSelected.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                    alt={currentLowestForSelected.currency === 'gold' ? '골드' : '다이아'}
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
                        <span>최근 거래가</span>
                        <span className={`max-w-[min(8.5rem,52%)] text-right font-semibold leading-snug ${sellFormInputNums}`}>
                            {lastSoldForSelected ? formatCurrency(lastSoldForSelected.price, lastSoldForSelected.currency) : '-'}
                        </span>
                    </div>
                </div>
                <div className={`rounded border border-cyan-700/50 bg-cyan-950/35 px-1.5 py-1 ${sellFormFeeBox}`}>
                    <div className="flex items-center justify-between gap-1.5">
                        <span>수수료(10%)</span>
                        <span className="flex items-center gap-0.5 tabular-nums font-semibold">
                            <span>{formatWalletCurrencyAmount(saleFee, saleCurrency)}</span>
                            <img
                                src={saleCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                alt={saleCurrency === 'gold' ? '골드' : '다이아'}
                                className={`${mobileExchange ? 'h-3.5 w-3.5' : 'h-4 w-4'} object-contain`}
                            />
                        </span>
                    </div>
                </div>
            </div>
            {!opts?.hideSubmitButton ? (
                <div className="mt-2 shrink-0">
                    <Button onClick={handleRegisterSale} disabled={!selectedItem || selectedItemAlreadyListedByMe} className={sellPrimarySidebarButtonClass}>
                        판매 등록
                    </Button>
                </div>
            ) : null}
        </div>
    );

    const exchangeSellAuxOpen = mobileExchange && (sellPickerOpen || sellComposerOpen);
    const mobileBuyDetailOpen = mobileExchange && activeTab === 'buy' && buyListingSelectedByUser;

    return (
        <>
            {showAlreadySoldModal && (
                <AlertModal
                    title="구매 안내"
                    message="이미 판매된 아이템입니다."
                    onClose={() => setShowAlreadySoldModal(false)}
                    confirmText="확인"
                    isTopmost
                    windowId="exchange-already-sold-alert"
                />
            )}
            {pendingRegistration && (
                <DraggableWindow
                    title="판매 등록 확인"
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
                            const gradeKey = (item.grade ?? 'normal') as ItemGrade;
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
                                    <p className={`text-xs font-semibold ${gradeStyle?.color ?? 'text-slate-200'}`}>[{gradeStyle?.name ?? '일반'}]</p>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1 rounded border border-slate-700/60 bg-slate-950/55 p-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">판매 가격</span>
                                    <span className="flex items-center gap-1 font-semibold">
                                        <span>{formatWalletCurrencyAmount(pendingRegistration.price, pendingRegistration.currency)}</span>
                                        <img src={pendingRegistration.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt="" className="h-4 w-4 object-contain" />
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">등록 수수료(10%)</span>
                                    <span className="flex items-center gap-1 font-semibold">
                                        <span>{formatWalletCurrencyAmount(pendingRegistration.fee, pendingRegistration.currency)}</span>
                                        <img src={pendingRegistration.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt="" className="h-4 w-4 object-contain" />
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
                                취소
                            </Button>
                            <Button
                                onClick={() => {
                                    if (requiresTradeListingTicket) {
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
                                등록
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {pendingTicketUsageRegistration && (
                <DraggableWindow
                    title="거래등록권 1장 사용"
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
                                <img src="/images/use/allowtrade.webp" alt="거래 등록권" className="h-10 w-10 object-contain" />
                            </div>
                            <p className="text-sm font-semibold text-amber-100">거래등록권 1장 사용</p>
                        </div>
                        <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 pt-1">
                            <Button
                                onClick={() => setPendingTicketUsageRegistration(null)}
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95"
                                colorScheme="gray"
                            >
                                취소
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
                                등록
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {pendingCancelListing && (
                <DraggableWindow
                    title="판매 취소 확인"
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
                                        src={gradeBackgrounds[(pendingCancelListing.itemGrade ?? 'normal') as ItemGrade]}
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
                                등록시 발생한 수수료는 반납되지 않습니다.
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
                                등록취소
                            </Button>
                            <Button
                                onClick={() => setPendingCancelListing(null)}
                                className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95"
                                colorScheme="gray"
                            >
                                유지
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {purchaseSuccessData && (
                <DraggableWindow
                    title="구매 확인"
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
                                        src={gradeBackgrounds[(purchaseSuccessData.inventoryItem?.grade ?? purchaseSuccessData.listing.itemGrade ?? 'normal') as ItemGrade]}
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
                                구매가 완료되었습니다.
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={() => setPurchaseSuccessData(null)}
                            className="min-h-[40px] py-2.5 text-sm font-semibold leading-none !border !border-amber-300/45 !bg-gradient-to-b !from-amber-500/85 !to-orange-600/90"
                        >
                            확인
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
                    title="구매"
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
                                {selectedBuyListingIsMine ? '내 등록 물품' : '구매'}
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            ) : null}
            {mobileExchange && sellPickerOpen && activeTab === 'sell' && (
                <DraggableWindow
                    title="장비 선택"
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
                                        <p className="text-[11px] font-semibold leading-snug text-slate-300">장비를 선택하세요</p>
                                        <p className="text-[11px] font-medium leading-snug text-slate-500">아래 그리드에서 탭한 뒤 오른쪽에서 가격·수수료를 확인하세요.</p>
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
                                    aria-label="인벤토리 정렬"
                                >
                                    <option value="createdAt">최신순</option>
                                    <option value="grade">등급순</option>
                                    <option value="name">이름순</option>
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
                                판매등록
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            <DraggableWindow
                title="거래소"
                onClose={onClose}
                windowId="exchange"
                initialWidth={980}
                initialHeight={820}
                isTopmost={Boolean(isTopmost) && !mobileBuyDetailOpen && !exchangeSellAuxOpen}
                variant="store"
                headerShowTitle={!mobileExchange}
                mobileViewportFit={mobileExchange}
                mobileViewportMaxHeightVh={98}
                mobileLockViewportHeight={mobileExchange}
                bodyScrollable={!mobileExchange}
                bodyPaddingClassName={
                    mobileExchange
                        ? 'flex min-h-0 min-w-0 flex-1 flex-col !px-2.5 !pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] !pt-2'
                        : undefined
                }
                headerContent={
                    <div
                        className={
                            mobileExchange
                                ? 'flex flex-wrap items-center gap-1.5 text-[11px] font-semibold leading-tight text-slate-100'
                                : 'flex items-center gap-3 text-xs sm:text-sm'
                        }
                    >
                        <div
                            className={`flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-900/20 text-amber-200 ${mobileExchange ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
                        >
                            <img src="/images/icon/Gold.png" alt="골드" className={mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain'} />
                            <span className="tabular-nums">{formatGoldAmountKoG(walletGold)}</span>
                        </div>
                        <div
                            className={`flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-900/20 text-sky-200 ${mobileExchange ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
                        >
                            <img src="/images/icon/Zem.png" alt="다이아" className={mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain'} />
                            <span className="tabular-nums">{formatWalletDiamonds(walletDiamonds)}</span>
                        </div>
                        <div
                            className={`flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-900/20 text-emerald-200 ${mobileExchange ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
                        >
                            <img src="/images/use/allowtrade.webp" alt="거래 등록권" className={mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain'} />
                            <span className="tabular-nums">{tradeListingTicketCount.toLocaleString()}</span>
                        </div>
                    </div>
                }
            >
                <div className={`flex h-full min-h-0 flex-col text-slate-100 ${mobileExchange ? exchM : ''}`}>
                    <div className={`grid grid-cols-4 gap-1 rounded-lg border border-slate-700/60 bg-slate-900/70 p-1 ${mobileExchange ? 'mb-2' : 'mb-3'}`}>
                        <button
                            onClick={() => setActiveTab('buy')}
                            className={`${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'buy' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
                            구매
                        </button>
                        <button
                            onClick={() => setActiveTab('sell')}
                            className={`${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'sell' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
                            판매등록
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('settlement')}
                            className={`relative overflow-visible ${mobileExchange ? exchangeTabButtonMobile : exchangeTabButtonBase} ${activeTab === 'settlement' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}
                        >
                            정산
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
                            거래이력
                        </button>
                    </div>

                    <div
                        className={`min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/55 ${mobileExchange ? 'p-2' : 'p-3'} ${
                            (activeTab === 'settlement' && mobileExchange) || activeTab === 'history' ? 'flex min-h-0 flex-col' : ''
                        }`}
                    >
                        {activeTab === 'buy' && (
                            <div
                                className={
                                    mobileExchange
                                        ? 'flex h-full min-h-0 flex-col gap-2'
                                        : 'grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]'
                                }
                            >
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
                                                {BUY_GRADE_FILTER_OPTIONS.map((opt) => (
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
                                                {BUY_CURRENCY_FILTER_OPTIONS.map((opt) => (
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
                                                placeholder="아이템 검색"
                                                className={`min-w-0 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-slate-100 outline-none placeholder:text-slate-400 ${mobileExchange ? 'text-[11px] leading-snug' : 'text-xs'}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void refreshMarketListings()}
                                                aria-label="거래소 목록 새로고침"
                                                title="새로고침"
                                                className={`shrink-0 rounded border border-slate-600 bg-slate-800 text-slate-200 transition hover:border-slate-400 hover:text-white ${mobileExchange ? 'w-8 text-[13px]' : 'w-9 text-sm'} ${isRefreshingBuyListings ? 'opacity-70' : ''}`}
                                                disabled={isRefreshingBuyListings}
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
                                                <span>이름</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBuySort('name')}
                                                    className={`leading-none ${buySortColumn === 'name' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {buySortColumn === 'name' && buySortDirection === 'asc' ? '▲' : '▼'}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>현재가</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBuySort('currentPrice')}
                                                    className={`leading-none ${buySortColumn === 'currentPrice' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {buySortColumn === 'currentPrice' && buySortDirection === 'asc' ? '▲' : '▼'}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-center gap-1">
                                                <span>최저가</span>
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
                                                등록된 판매 물품이 없습니다.
                                            </div>
                                        )}
                                        <div className={mobileExchange ? 'space-y-1.5' : 'space-y-2'}>
                                        {filteredAndSortedBuyItems.map((listing) => {
                                            const gradeKey = (listing.itemGrade ?? 'normal') as ItemGrade;
                                            const gradeLabel = gradeStyles[gradeKey]?.name ?? '일반';
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
                                                        title={isMyListing ? '내가 등록한 판매' : undefined}
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
                                                                내 등록
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
                                                        src={listing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                        alt={listing.currency === 'gold' ? '골드' : '다이아'}
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
                                                        src={listing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                        alt={listing.currency === 'gold' ? '골드' : '다이아'}
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
                                                    <div className="min-h-0 flex-1 overflow-hidden">{renderBuyEquipmentOrFallback()}</div>
                                                    {renderBuyStatsCard()}
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
                                                {selectedBuyListingIsMine ? '내 등록 물품' : '구매'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                        {activeTab === 'sell' &&
                            (mobileExchange ? (
                                <div className="flex h-full min-h-0 flex-col gap-2">
                                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-amber-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/98 p-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]">
                                        <p className="mb-1.5 shrink-0 text-[11px] font-bold text-amber-200">등록된 아이템</p>
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
                                                    const slotGradeKey = (slot.itemGrade ?? 'normal') as ItemGrade;
                                                    const slotGradeLabel = gradeStyles[slotGradeKey]?.name ?? '일반';
                                                    const slotGradeColor = gradeStyles[slotGradeKey]?.color ?? 'text-slate-200';
                                                    return (
                                                        <button
                                                            key={`sell-slot-${idx}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setSellSlotFocusItemId(slot.itemId);
                                                                const inv = allEquipmentItems.find((entry) => entry.id === slot.itemId);
                                                                if (inv) onViewListedEquipment?.(inv, true);
                                                            }}
                                                            className={`w-full rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-left transition hover:border-amber-300/65 ${sellSlotFocusItemId === slot.itemId ? 'ring-2 ring-amber-300/60' : ''}`}
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
                                                                            src={slot.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                            alt={slot.currency === 'gold' ? '골드' : '다이아'}
                                                                            className="h-3.5 w-3.5 shrink-0 object-contain"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex min-w-[5.5rem] shrink-0 flex-col items-center gap-0.5">
                                                                    <span
                                                                        className={`w-full text-center text-[11px] font-semibold leading-tight ${verification === 'verifying' ? 'text-cyan-200' : isExpired ? 'text-rose-300' : 'text-emerald-200'}`}
                                                                    >
                                                                        {verification === 'verifying' ? '등록중' : isExpired ? '만료됨' : `${remainingDays}일 ${remainingHours}시간`}
                                                                    </span>
                                                                    <Button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            isExpired ? handleRecoverListing(slot.id) : handleRequestCancelListing(slot.id);
                                                                        }}
                                                                        className={`!flex !min-h-[22px] !w-[4.85rem] !items-center !justify-center !border !px-1.5 !py-0.5 !text-[11px] !font-semibold !leading-none !tracking-wide rounded-md ${
                                                                            isExpired
                                                                                ? '!border-rose-300/40 !bg-gradient-to-b !from-rose-500/80 !to-rose-700/90'
                                                                                : '!border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95'
                                                                        }`}
                                                                    >
                                                                        {isExpired ? '회수' : '판매취소'}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 rounded-xl border border-amber-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/98 p-2.5 shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.55)]">
                                        <p className="mb-2.5 text-center text-[11px] font-medium leading-relaxed text-slate-400">
                                            새로 판매할 장비는 <span className="font-semibold text-amber-200/95">「장비 선택」</span>에서 고릅니다. 위 목록에서 등록된 물품 상태를
                                            확인하고 취소할 수 있습니다.
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
                                            장비 선택
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full min-h-0 flex-col gap-3">
                                    <div className="shrink-0 grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[380px_minmax(0,1.15fr)_220px]">
                                        <div className="flex h-[380px] min-h-[380px] max-h-[380px] min-w-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                            <p className="text-xs font-semibold text-amber-200">등록된 아이템</p>
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
                                                        const slotGradeKey = (slot.itemGrade ?? 'normal') as ItemGrade;
                                                        const slotGradeLabel = gradeStyles[slotGradeKey]?.name ?? '일반';
                                                        const slotGradeColor = gradeStyles[slotGradeKey]?.color ?? 'text-slate-200';
                                                        return (
                                                            <button
                                                                key={`sell-slot-pc-${idx}`}
                                                                type="button"
                                                                onClick={() => setSelectedItemId(slot.itemId)}
                                                                className={`w-full rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-left transition hover:border-amber-300/65 ${selectedItemId === slot.itemId ? 'ring-2 ring-amber-300/60' : ''}`}
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
                                                                        <span className={`block text-xs font-semibold leading-none ${slotGradeColor}`}>[{slotGradeLabel}]</span>
                                                                        <span
                                                                            className="mt-0.5 block truncate whitespace-nowrap text-sm font-semibold leading-none text-slate-100"
                                                                            title={slot.itemName}
                                                                        >
                                                                            {slot.itemName}
                                                                        </span>
                                                                        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold leading-tight text-slate-100">
                                                                            <span className="tabular-nums">
                                                                                {formatWalletCurrencyAmount(slot.price, slot.currency)}
                                                                            </span>
                                                                            <img
                                                                                src={slot.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                                alt={slot.currency === 'gold' ? '골드' : '다이아'}
                                                                                className="h-3.5 w-3.5 object-contain"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex min-w-[5.5rem] shrink-0 flex-col items-center gap-1">
                                                                        <span
                                                                            className={`w-full text-center text-xs font-semibold leading-tight ${verification === 'verifying' ? 'text-cyan-200' : isExpired ? 'text-rose-300' : 'text-emerald-200'}`}
                                                                        >
                                                                            {verification === 'verifying' ? '등록중' : isExpired ? '만료됨' : `${remainingDays}일 ${remainingHours}시간`}
                                                                        </span>
                                                                        <Button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                isExpired ? handleRecoverListing(slot.id) : handleRequestCancelListing(slot.id);
                                                                            }}
                                                                            className={`!flex !w-[78px] !items-center !justify-center min-h-[26px] rounded-md !border px-1.5 py-0.5 text-xs leading-none font-semibold tracking-wide ${
                                                                                isExpired
                                                                                    ? '!border-rose-300/40 !bg-gradient-to-b !from-rose-500/80 !to-rose-700/90'
                                                                                    : '!border-slate-500/50 !bg-gradient-to-b !from-slate-700/90 !to-slate-900/95'
                                                                            }`}
                                                                        >
                                                                            {isExpired ? '회수' : '판매취소'}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="min-h-0 rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                            {selectedItem ? (
                                                <div className="h-[380px] min-h-[380px] max-h-[380px] overflow-hidden">
                                                    <EquipmentDetailPanel
                                            item={selectedItem}
                                            showTradeStatusUnderImage
                                            comfortableTypography={mobileExchange}
                                            optionRowsSingleLine={mobileExchange}
                                        />
                                                </div>
                                            ) : (
                                                <div className="h-[380px] min-h-[380px] max-h-[380px] rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
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
                                                aria-label="인벤토리 정렬"
                                            >
                                                <option value="createdAt">최신순</option>
                                                <option value="grade">등급순</option>
                                                <option value="name">이름순</option>
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
                            <div className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-3">
                                <div
                                    className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/40 ${mobileExchange ? 'min-h-0 flex-1 p-2' : 'min-h-0 p-3'}`}
                                >
                                    <div
                                        className={`min-h-0 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS} ${mobileExchange ? 'flex-1' : ''}`}
                                        style={mobileExchange ? undefined : { maxHeight: 'calc(100vh - 360px)' }}
                                    >
                                        <div
                                            className={`sticky top-0 z-10 mb-2 grid items-center rounded border border-slate-600/70 bg-slate-900/95 font-semibold text-slate-300 backdrop-blur-sm ${settlementListCols} ${
                                                mobileExchange ? 'px-1.5 py-1 text-[10px] leading-tight' : 'px-2 py-1.5 text-[11px]'
                                            }`}
                                        >
                                            <span className="text-center">이름</span>
                                            <span className="text-center">판매가</span>
                                            <span className="text-center">수수료</span>
                                            <span className="text-center">수령액</span>
                                        </div>
                                        {settlementDisplayItems.length === 0 && (
                                            <div
                                                className={`rounded border border-slate-700/60 bg-slate-900/40 text-center text-slate-300 ${mobileExchange ? `px-2 py-6 ${exchM}` : 'px-3 py-8 text-xs leading-snug'}`}
                                            >
                                                정산 가능한 판매 내역이 없습니다.
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {settlementDisplayItems.map((entry) => {
                                                const gradeKey = (entry.itemGrade ?? 'normal') as ItemGrade;
                                                const gradeLabel = gradeStyles[gradeKey]?.name ?? '일반';
                                                const starVisual = getStarVisual(entry.itemStars ?? 0);
                                                const currencyIcon = entry.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png';
                                                const currencyAlt = entry.currency === 'gold' ? '골드' : '다이아';
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
                                                                        fontSize: `${Math.max(10, Math.min(14, Math.floor(14 - Math.max(0, (`[${gradeLabel}] ${entry.itemName}`).length - 16) * 0.24)))}px`,
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
                                                            className={`flex items-center justify-center gap-1 font-semibold text-amber-100 ${mobileExchange ? 'text-[11px] leading-tight' : 'text-sm'}`}
                                                        >
                                                            <span className="tabular-nums">{formatWalletCurrencyAmount(entry.soldPrice, entry.currency)}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className={mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain'} />
                                                        </div>
                                                        <div
                                                            className={`flex items-center justify-center gap-1 font-semibold text-rose-200 ${mobileExchange ? 'text-[11px] leading-tight' : 'text-sm'}`}
                                                        >
                                                            <span className="tabular-nums">{formatWalletCurrencyAmount(entry.fee, entry.currency)}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className={mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain'} />
                                                        </div>
                                                        <div
                                                            className={`flex items-center justify-center gap-1 font-bold text-emerald-200 ${mobileExchange ? 'text-[11px] leading-tight' : 'text-sm'}`}
                                                        >
                                                            <span className="tabular-nums">{formatWalletCurrencyAmount(entry.net, entry.currency)}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className={mobileExchange ? 'h-3.5 w-3.5 object-contain' : 'h-4 w-4 object-contain'} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className={`shrink-0 rounded-lg border border-slate-700/60 bg-slate-900/45 ${mobileExchange ? 'p-2' : 'p-3'} ${
                                        mobileExchange
                                            ? 'border-t border-amber-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/98 shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.5)]'
                                            : ''
                                    }`}
                                >
                                    {selectedSettlement ? (
                                        <div className="space-y-2">
                                            <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-3 py-2 text-slate-100 ${mobileExchange ? 'text-[11px] leading-snug' : 'text-xs'}`}>
                                                <p className="mb-1 text-[11px] font-semibold text-slate-300">선택 항목</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-rose-200">수수료</span>
                                                    <span className="flex items-center gap-1 tabular-nums font-semibold text-rose-200">
                                                        <span>{formatWalletCurrencyAmount(selectedSettlement.fee, selectedSettlement.currency)}</span>
                                                        <img
                                                            src={selectedSettlement.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                            alt={selectedSettlement.currency === 'gold' ? '골드' : '다이아'}
                                                            className="h-3.5 w-3.5 object-contain"
                                                        />
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between">
                                                    <span>수령액</span>
                                                    <span className="flex items-center gap-1 tabular-nums font-bold text-emerald-200">
                                                        <span>{formatWalletCurrencyAmount(selectedSettlement.net, selectedSettlement.currency)}</span>
                                                        <img
                                                            src={selectedSettlement.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                            alt={selectedSettlement.currency === 'gold' ? '골드' : '다이아'}
                                                            className="h-3.5 w-3.5 object-contain"
                                                        />
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`rounded border border-slate-700/60 bg-slate-950/55 px-3 py-2 text-slate-100 ${mobileExchange ? 'text-[11px] leading-snug' : 'text-xs'}`}>
                                                <p className="mb-1 text-[11px] font-semibold text-slate-300">모든 항목</p>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-rose-200">수수료</span>
                                                        <div className="grid grid-cols-2 items-center gap-1">
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-semibold text-rose-200">
                                                                <span>{formatGoldAmountKoG(settlementTotals.selectedFeeGold)}</span>
                                                                <img src="/images/icon/Gold.png" alt="골드" className="h-3.5 w-3.5 object-contain" />
                                                            </span>
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-semibold text-rose-200">
                                                                <span>{formatWalletDiamonds(settlementTotals.selectedFeeDiamonds)}</span>
                                                                <img src="/images/icon/Zem.png" alt="다이아" className="h-3.5 w-3.5 object-contain" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-emerald-200">수령액</span>
                                                        <div className="grid grid-cols-2 items-center gap-1">
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-bold text-emerald-200">
                                                                <span>{formatGoldAmountKoG(settlementTotals.selectedNetGold)}</span>
                                                                <img src="/images/icon/Gold.png" alt="골드" className="h-3.5 w-3.5 object-contain" />
                                                            </span>
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-bold text-emerald-200">
                                                                <span>{formatWalletDiamonds(settlementTotals.selectedNetDiamonds)}</span>
                                                                <img src="/images/icon/Zem.png" alt="다이아" className="h-3.5 w-3.5 object-contain" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button onClick={() => handleClaimSettlement(selectedSettlement.listingId)} className={exchangePrimaryButtonClass}>
                                                선택 항목 수령
                                            </Button>
                                            <Button onClick={handleClaimAllSettlements} disabled={settlementDisplayItems.length === 0} className={exchangeSecondaryButtonClass}>
                                                모두 수령
                                            </Button>
                                        </div>
                                    ) : (
                                        <div
                                            className={`rounded border border-dashed border-slate-700/70 bg-slate-950/40 text-center text-slate-300 ${mobileExchange ? `px-2 py-6 ${exchM}` : 'px-3 py-10 text-xs leading-snug'}`}
                                        >
                                            정산 대기 항목이 없습니다.
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
                                            총 거래 이력 {visibleExchangeHistory.length}건
                                        </div>
                                        <div
                                            className={`flex-1 rounded border border-slate-700/60 bg-slate-900/45 text-slate-200 ${
                                                mobileExchange ? 'space-y-1.5 px-2 py-2 text-[11px] leading-snug' : 'space-y-2 px-3 py-2.5 text-base'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`font-semibold text-rose-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}>총 지출</span>
                                                <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-1">
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-rose-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatGoldAmountKoG(historySummary.totals.outGold)}</span>
                                                        <img src="/images/icon/Gold.png" alt="골드" className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
                                                    </span>
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-rose-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatWalletDiamonds(historySummary.totals.outDiamonds)}</span>
                                                        <img src="/images/icon/Zem.png" alt="다이아" className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`font-semibold text-emerald-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}>총 수입</span>
                                                <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-1">
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-emerald-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatGoldAmountKoG(historySummary.totals.inGold)}</span>
                                                        <img src="/images/icon/Gold.png" alt="골드" className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
                                                    </span>
                                                    <span
                                                        className={`flex min-w-0 items-center justify-end gap-0.5 tabular-nums font-semibold text-emerald-400 ${mobileExchange ? 'text-[11px]' : 'text-base'}`}
                                                    >
                                                        <span className="min-w-0 truncate">{formatWalletDiamonds(historySummary.totals.inDiamonds)}</span>
                                                        <img src="/images/icon/Zem.png" alt="다이아" className={mobileExchange ? 'h-3.5 w-3.5 shrink-0 object-contain' : 'h-4 w-4 object-contain'} />
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
                                        <span className="text-center">상태</span>
                                        <span className="text-center">날짜/시간</span>
                                        <span className="text-center">가격</span>
                                        <span className="text-center">수수료</span>
                                    </div>
                                </div>
                                <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                    {visibleExchangeHistory.length === 0 && (
                                        <div className={`rounded border border-slate-700/60 bg-slate-900/40 px-3 py-8 text-center text-slate-300 ${mobileExchange ? exchM : 'text-sm'}`}>
                                            거래 이력이 없습니다.
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
                                                    className={`flex items-center justify-center gap-0.5 font-semibold ${row.statusText === '정산 수령' ? 'text-emerald-400' : 'text-slate-100'} ${mobileExchange ? 'text-[11px] leading-tight' : 'text-base'}`}
                                                >
                                                    {row.priceCurrency ? (
                                                        <>
                                                            <span className="min-w-0 truncate tabular-nums">
                                                                {formatWalletCurrencyAmount(row.priceAmount, row.priceCurrency)}
                                                            </span>
                                                            <img
                                                                src={row.priceCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                alt={row.priceCurrency === 'gold' ? '골드' : '다이아'}
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
                                                                src={row.feeCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                alt={row.feeCurrency === 'gold' ? '골드' : '다이아'}
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
                </div>
            </DraggableWindow>
        </>
    );
};

export default ExchangeModal;
