import React, { useMemo, useState } from 'react';
import type { InventoryItem, UserWithStatus, ServerAction, ItemGrade, EquipmentSlot } from '../types.js';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
} from './DraggableWindow.js';
import Button from './Button.js';
import AlertModal from './AlertModal.js';
import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';
import { isFunctionVipActive } from '../shared/utils/rewardVip.js';
import { gradeBackgrounds, gradeStyles } from '../constants/items.js';

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
type SettlementClaimResultData = {
    isAll: boolean;
    itemName?: string;
    amount?: number;
    currency?: SaleCurrency;
    totalGold?: number;
    totalDiamonds?: number;
};

interface ExchangeModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction?: (action: ServerAction) => void | Promise<void>;
    isTopmost?: boolean;
}

const MAX_SELL_SLOTS = 3;
const LISTING_MAX_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const VERIFICATION_MS = 30 * 1000;
const TRADE_LISTING_TICKET_NAME = '거래 등록권';

const formatCurrency = (value: number, currency: SaleCurrency): string =>
    `${value.toLocaleString()}${currency === 'gold' ? '골드' : '다이아'}`;

const minPriceByCurrency: Record<SaleCurrency, number> = {
    gold: 100,
    diamonds: 10,
};
const BAG_SCROLLBAR_Y_CLASS =
    '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/38 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/48';
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

const ExchangeModal: React.FC<ExchangeModalProps> = ({ currentUser, onClose, onAction, isTopmost }) => {
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
    const [inventorySortKey, setInventorySortKey] = useState<InventorySortKey>('createdAt');
    const [nowMs, setNowMs] = useState<number>(Date.now());
    const [walletGold, setWalletGold] = useState<number>(currentUser.gold ?? 0);
    const [walletDiamonds, setWalletDiamonds] = useState<number>(currentUser.diamonds ?? 0);
    const [history, setHistory] = useState<string[]>([]);
    const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
    const [pendingCancelListing, setPendingCancelListing] = useState<PendingCancelListing | null>(null);
    const [purchaseSuccessData, setPurchaseSuccessData] = useState<PurchaseSuccessData | null>(null);
    const [settlementClaimResult, setSettlementClaimResult] = useState<SettlementClaimResultData | null>(null);
    const [showAlreadySoldModal, setShowAlreadySoldModal] = useState(false);
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
    const saleFee = Math.floor((Number(salePrice || 0) * 10) / 100);
    const minimumPrice = minPriceByCurrency[saleCurrency];
    const selectedItem = allEquipmentItems.find((entry) => entry.id === selectedItemId);
    const myActiveListings = listings.filter((listing) => listing.sellerId === currentUser.id && listing.status === 'listed');
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
    React.useEffect(() => {
        const serverListings = (currentUser.exchangeState?.listings as ExchangeListing[] | undefined) ?? [];
        const serverSettlements = (currentUser.exchangeState?.settlements as SettlementItem[] | undefined) ?? [];
        const serverHistory = (currentUser.exchangeState?.history as string[] | undefined) ?? [];
        setListings(serverListings);
        setSettlements(serverSettlements);
        setHistory(serverHistory);
    }, [currentUser.id]);
    React.useEffect(() => {
        void onAction?.({
            type: 'SAVE_EXCHANGE_STATE',
            payload: {
                listings: listings as unknown as Array<Record<string, unknown>>,
                settlements: settlements as unknown as Array<Record<string, unknown>>,
                history,
            },
        });
    }, [listings, settlements, history]);

    const appendHistory = (message: string) => {
        const timestamp = new Date().toLocaleString();
        setHistory((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 40));
    };

    const executeRegisterSale = async (item: InventoryItem, parsedPrice: number, currency: SaleCurrency, fee: number) => {
        const alreadyListed = listings.some(
            (entry) => entry.sellerId === currentUser.id && entry.status === 'listed' && entry.itemId === item.id,
        );
        if (alreadyListed) {
            setPendingRegistration(null);
            setSelectedItemId('');
            return;
        }
        if (!functionVipActive && !isAdminUser) {
            const ticketItem = (currentUser.inventory ?? []).find(
                (inv) => inv.type === 'material' && inv.name === TRADE_LISTING_TICKET_NAME && (inv.quantity ?? 1) > 0,
            );
            if (!ticketItem) {
                window.alert('거래 등록권이 부족합니다.');
                setPendingRegistration(null);
                return;
            }
            await onAction?.({
                type: 'USE_ITEM',
                payload: { itemId: ticketItem.id, itemName: ticketItem.name, quantity: 1 },
            });
        }
        if (currency === 'gold') setWalletGold((prev) => prev - fee);
        else setWalletDiamonds((prev) => prev - fee);

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
            price: parsedPrice,
            currency,
            verificationStatus: 'verifying',
            createdAt: Date.now(),
            verificationEndsAt: Date.now() + VERIFICATION_MS,
            expiresAt: Date.now() + LISTING_MAX_DURATION_MS,
            status: 'listed',
        };
        setListings((prev) => [newListing, ...prev]);
        await onAction?.({ type: 'MARK_ITEM_EXCHANGE_LISTED', payload: { itemId: item.id } });
        appendHistory(`판매 등록: ${item.name} / ${formatCurrency(parsedPrice, currency)} (등록 수수료 ${formatCurrency(fee, currency)})`);
        setPendingRegistration(null);
        setSelectedItemId('');
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
        const parsedPrice = Math.floor(Number(salePrice));
        if (!Number.isFinite(parsedPrice) || parsedPrice < minimumPrice) {
            window.alert(`최소 판매가는 ${formatCurrency(minimumPrice, saleCurrency)}입니다.`);
            return;
        }
        if (saleCurrency === 'gold' && walletGold < saleFee) {
            window.alert(`등록 수수료가 부족합니다. 필요: ${saleFee.toLocaleString()}골드`);
            return;
        }
        if (saleCurrency === 'diamonds' && walletDiamonds < saleFee) {
            window.alert(`등록 수수료가 부족합니다. 필요: ${saleFee.toLocaleString()}다이아`);
            return;
        }
        setPendingRegistration({ item, price: parsedPrice, currency: saleCurrency, fee: saleFee });
    };

    const handleBuy = (listingId: string) => {
        const listing = listings.find((entry) => entry.id === listingId);
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

        if (listing.currency === 'gold') setWalletGold((prev) => prev - listing.price);
        else setWalletDiamonds((prev) => prev - listing.price);

        setListings((prev) =>
            prev.map((entry) =>
                entry.id === listingId ? { ...entry, status: 'sold', soldAt: Date.now() } : entry,
            ),
        );
        const purchasedInventoryItem = allEquipmentItems.find((item) => item.id === listing.itemId) ?? null;
        setPurchaseSuccessData({ listing, inventoryItem: purchasedInventoryItem });

        if (listing.sellerId === currentUser.id) {
            setSettlements((prev) => [
                {
                    listingId: listing.id,
                    itemId: listing.itemId,
                    itemName: listing.itemName,
                    soldPrice: listing.price,
                    currency: listing.currency,
                    soldAt: Date.now(),
                    claimed: false,
                },
                ...prev,
            ]);
        }

        appendHistory(`구매 완료: ${listing.itemName} / ${formatCurrency(listing.price, listing.currency)}`);
    };

    const handleClaimSettlement = (listingId: string) => {
        const settlement = settlements.find((entry) => entry.listingId === listingId && !entry.claimed);
        if (!settlement) return;

        const claimFee = Math.floor((settlement.soldPrice * 10) / 100);
        const netAmount = Math.max(0, settlement.soldPrice - claimFee);

        if (settlement.currency === 'gold') setWalletGold((prev) => prev + netAmount);
        else setWalletDiamonds((prev) => prev + netAmount);

        setSettlements((prev) =>
            prev.map((entry) => (entry.listingId === listingId ? { ...entry, claimed: true } : entry)),
        );
        setSettlementClaimResult({
            isAll: false,
            itemName: settlement.itemName,
            amount: netAmount,
            currency: settlement.currency,
        });
        appendHistory(`정산 수령: ${settlement.itemName} / 실수령 ${formatCurrency(netAmount, settlement.currency)} (판매 수수료 ${formatCurrency(claimFee, settlement.currency)})`);
    };
    const handleClaimAllSettlements = () => {
        if (unclaimedSettlements.length === 0) return;
        let totalGoldNet = 0;
        let totalDiamondsNet = 0;
        unclaimedSettlements.forEach((entry) => {
            const claimFee = Math.floor((entry.soldPrice * 10) / 100);
            const netAmount = Math.max(0, entry.soldPrice - claimFee);
            if (entry.currency === 'gold') totalGoldNet += netAmount;
            else totalDiamondsNet += netAmount;
        });
        if (totalGoldNet > 0) setWalletGold((prev) => prev + totalGoldNet);
        if (totalDiamondsNet > 0) setWalletDiamonds((prev) => prev + totalDiamondsNet);
        setSettlements((prev) => prev.map((entry) => (entry.claimed ? entry : { ...entry, claimed: true })));
        setSettlementClaimResult({
            isAll: true,
            totalGold: totalGoldNet,
            totalDiamonds: totalDiamondsNet,
        });
        appendHistory(
            `정산 모두 수령: 골드 ${totalGoldNet.toLocaleString()} / 다이아 ${totalDiamondsNet.toLocaleString()}`,
        );
    };

    const handleCancelListing = (listingId: string) => {
        const target = listings.find((entry) => entry.id === listingId);
        if (!target || target.status !== 'listed') return;
        setListings((prev) => prev.filter((entry) => entry.id !== listingId));
        void onAction?.({ type: 'UNMARK_ITEM_EXCHANGE_LISTED', payload: { itemId: target.itemId } });
        appendHistory(`판매 취소: ${target.itemName}`);
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
        appendHistory(`판매 만료 회수: ${target.itemName}`);
    };

    const listingsWithComputed = listings.map((entry) => {
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
    const selectedBuyListing = filteredAndSortedBuyItems.find((entry) => entry.id === selectedBuyListingId) ?? filteredAndSortedBuyItems[0] ?? null;
    const selectedBuyListingIsMine = Boolean(selectedBuyListing && selectedBuyListing.sellerId === currentUser.id);
    const selectedBuyInventoryItem = selectedBuyListing
        ? allEquipmentItems.find((item) => item.id === selectedBuyListing.itemId)
        : null;
    const recentSoldForBuySelection = selectedBuyListing
        ? [...listings]
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
        if (!selectedBuyListingId || !filteredAndSortedBuyItems.some((entry) => entry.id === selectedBuyListingId)) {
            setSelectedBuyListingId(filteredAndSortedBuyItems[0].id);
        }
    }, [filteredAndSortedBuyItems, selectedBuyListingId]);
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
        setSalePrice(String(currentLowestForSelected.price));
    }, [selectedItemId, saleCurrency, currentLowestForSelected?.price]);
    const unclaimedSettlements = settlements.filter((entry) => !entry.claimed);
    const settlementDisplayItems = useMemo(
        () =>
            unclaimedSettlements.map((entry) => {
                const linkedListing = listings.find((listing) => listing.id === entry.listingId);
                const fee = Math.floor((entry.soldPrice * 10) / 100);
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
    const historySummary = useMemo(() => {
        const totals = {
            outGold: 0,
            outDiamonds: 0,
            inGold: 0,
            inDiamonds: 0,
        };
        const rows = history.map((line) => {
            const isOut = line.includes('구매 완료') || line.includes('판매 등록');
            const isIn = line.includes('정산 수령') || line.includes('정산 모두 수령');
            const timestampMatch = line.match(/^\[([^\]]+)\]/);
            const timestampText = timestampMatch?.[1] ?? '-';
            const message = line.replace(/^\[[^\]]+\]\s*/, '');
            const statusText = line.includes('판매 등록')
                ? '판매 등록'
                : line.includes('구매 완료')
                  ? '구매 완료'
                  : line.includes('판매 취소')
                    ? '판매 취소'
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
            // 총 지출은 "수수료" 합계만 집계
            if (feeMatch) {
                if (feeMatch[2] === '골드') totals.outGold += feeAmount;
                else totals.outDiamonds += feeAmount;
            }
            // 총 수입은 "정산 수령" 합계만 집계
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
            const matchedListing = itemName ? listings.find((entry) => entry.itemName === itemName) : null;
            const matchedInventoryItem = itemName ? allEquipmentItems.find((entry) => entry.name === itemName) : null;
            const itemGrade = ((matchedListing?.itemGrade as ItemGrade | undefined) ?? matchedInventoryItem?.grade ?? 'normal') as ItemGrade;
            const itemStars = matchedListing?.itemStars ?? matchedInventoryItem?.stars ?? 0;
            const itemImage =
                matchedListing?.itemImage ??
                matchedInventoryItem?.image ??
                (line.includes('구매 완료')
                    ? '/images/icon/Zem.png'
                    : line.includes('정산')
                      ? '/images/Box/GoldBox3.png'
                      : '/images/Box/ResourceBox1.png');
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
    }, [history, listings, allEquipmentItems]);
    const vipStatusText = `기능VIP ${functionVipActive ? '활성' : '비활성'}`;
    const exchangeTabButtonBase =
        'rounded-md border px-2 py-2 text-sm font-semibold tracking-wide transition-all duration-150';
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
                                        <span>{pendingRegistration.price.toLocaleString()}</span>
                                        <img src={pendingRegistration.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt="" className="h-4 w-4 object-contain" />
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">등록 수수료(10%)</span>
                                    <span className="flex items-center gap-1 font-semibold">
                                        <span>{pendingRegistration.fee.toLocaleString()}</span>
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
                                onClick={() =>
                                    executeRegisterSale(
                                        pendingRegistration.item,
                                        pendingRegistration.price,
                                        pendingRegistration.currency,
                                        pendingRegistration.fee,
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
            {settlementClaimResult && (
                <DraggableWindow
                    title="정산 수령"
                    windowId="exchange-settlement-claim-result"
                    onClose={() => setSettlementClaimResult(null)}
                    initialWidth={390}
                    initialHeight={350}
                    isTopmost
                    variant="store"
                >
                    <>
                        <div className="flex min-h-0 w-full max-w-[min(100vw-1.5rem,22rem)] flex-col self-center px-2 pt-1 sm:max-w-[22rem] sm:px-3 sm:pt-2">
                            <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_28px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)]">
                                <div className="relative flex min-h-0 flex-col gap-3 p-3 sm:gap-4 sm:px-6 sm:pb-6 sm:pt-6">
                                    <div className="flex min-w-0 flex-col items-center gap-3 sm:gap-4">
                                        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-black/25">
                                            <img src="/images/icon/Gold.png" alt="" className="h-10 w-10 object-contain opacity-90" />
                                            <img src="/images/icon/Zem.png" alt="" className="absolute bottom-1 right-1 h-5 w-5 object-contain" />
                                        </div>
                                        <div className="flex min-w-0 flex-col items-center text-center">
                                            <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-slate-800/80 px-3 py-0.5 text-[11px] font-semibold text-amber-100">
                                                {settlementClaimResult.isAll ? '모두 수령' : '선택 수령'}
                                            </span>
                                            <h2 className="mt-1 max-w-full text-center text-base font-black leading-snug tracking-tight text-amber-50 break-words">
                                                {settlementClaimResult.isAll ? '정산금 수령 완료' : settlementClaimResult.itemName}
                                            </h2>
                                            <div className="mt-2 space-y-1 text-sm">
                                                {settlementClaimResult.isAll ? (
                                                    <>
                                                        <p className="flex items-center justify-center gap-1 font-semibold text-amber-100">
                                                            <span>골드 {settlementClaimResult.totalGold?.toLocaleString() ?? 0}</span>
                                                            <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 object-contain" />
                                                        </p>
                                                        <p className="flex items-center justify-center gap-1 font-semibold text-sky-100">
                                                            <span>다이아 {settlementClaimResult.totalDiamonds?.toLocaleString() ?? 0}</span>
                                                            <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 object-contain" />
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="flex items-center justify-center gap-1 font-semibold text-emerald-100">
                                                        <span>{settlementClaimResult.amount?.toLocaleString() ?? 0}</span>
                                                        <img
                                                            src={settlementClaimResult.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                            alt={settlementClaimResult.currency === 'gold' ? '골드' : '다이아'}
                                                            className="h-4 w-4 object-contain"
                                                        />
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS}>
                            <button
                                type="button"
                                onClick={() => setSettlementClaimResult(null)}
                                className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}
                            >
                                확인
                            </button>
                        </div>
                    </>
                </DraggableWindow>
            )}
            <DraggableWindow
                title="거래소"
                titleContent={
                    <div className="flex w-full items-center justify-start">
                        <span className={`text-sm font-bold ${functionVipActive ? 'text-emerald-300' : 'text-rose-300'}`}>{vipStatusText}</span>
                    </div>
                }
                onClose={onClose}
                windowId="exchange"
                initialWidth={980}
                initialHeight={820}
                isTopmost={isTopmost}
                variant="store"
                headerShowTitle
                headerContent={
                    <div className="flex items-center gap-3 text-xs sm:text-sm">
                        <div className="flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-900/20 px-2 py-1 text-amber-200">
                            <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 object-contain" />
                            <span className="tabular-nums font-semibold">{walletGold.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-900/20 px-2 py-1 text-sky-200">
                            <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 object-contain" />
                            <span className="tabular-nums font-semibold">{walletDiamonds.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-900/20 px-2 py-1 text-emerald-200">
                            <img src="/images/use/allowtrade.webp" alt="거래 등록권" className="h-4 w-4 object-contain" />
                            <span className="tabular-nums font-semibold">{tradeListingTicketCount.toLocaleString()}</span>
                        </div>
                    </div>
                }
            >
                <div className="flex h-full min-h-0 flex-col text-slate-100">
                    <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg border border-slate-700/60 bg-slate-900/70 p-1">
                        <button onClick={() => setActiveTab('buy')} className={`${exchangeTabButtonBase} ${activeTab === 'buy' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}>구매</button>
                        <button onClick={() => setActiveTab('sell')} className={`${exchangeTabButtonBase} ${activeTab === 'sell' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}>판매등록</button>
                        <button onClick={() => setActiveTab('settlement')} className={`${exchangeTabButtonBase} ${activeTab === 'settlement' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}>정산</button>
                        <button onClick={() => setActiveTab('history')} className={`${exchangeTabButtonBase} ${activeTab === 'history' ? 'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]' : 'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100'}`}>거래이력</button>
                    </div>
    
                    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/55 p-3">
                        {activeTab === 'buy' && (
                            <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                                <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                                    <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_auto_1fr]">
                                        <select
                                            value={buySlotFilter}
                                            onChange={(e) => setBuySlotFilter(e.target.value as BuySlotFilter)}
                                            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200"
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
                                            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200"
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
                                            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200"
                                        >
                                            {BUY_CURRENCY_FILTER_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            value={buySearchText}
                                            onChange={(e) => setBuySearchText(e.target.value)}
                                            placeholder="아이템 검색"
                                            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                        <div className="sticky top-0 z-10 mb-2 grid grid-cols-[minmax(0,1fr)_105px_105px] gap-4 rounded border border-slate-600/70 bg-slate-900/95 px-2 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur-sm">
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
                                            <div className="rounded border border-slate-700/60 bg-slate-900/40 px-3 py-8 text-center text-sm text-slate-300">
                                                등록된 판매 물품이 없습니다.
                                            </div>
                                        )}
                                        <div className="space-y-2">
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
                                                className={`grid w-full grid-cols-[minmax(0,1fr)_105px_105px] items-center gap-4 rounded-lg border px-2 py-2 text-left transition ${
                                                    selectedBuyListing?.id === listing.id
                                                        ? 'border-cyan-400/70 bg-cyan-900/25'
                                                        : 'border-slate-700/60 bg-slate-900/50 hover:border-slate-500/70'
                                                }`}
                                            >
                                                <div className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-5">
                                                    <div className="relative h-14 w-14 overflow-hidden rounded bg-black/25">
                                                        <img
                                                            src={gradeBackgrounds[gradeKey]}
                                                            alt={gradeLabel}
                                                            className="absolute inset-0 h-full w-full object-cover"
                                                        />
                                                        {listing.itemImage ? (
                                                            <img src={listing.itemImage} alt={listing.itemName} className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain" />
                                                        ) : null}
                                                        {starVisual ? (
                                                            <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                                                <img src={starVisual.image} alt="" className="h-3 w-3" />
                                                                <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{listing.itemStars}</span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div className="min-w-0 pl-1 text-center">
                                                        <span className={`block text-xs font-semibold leading-none ${gradeColor}`}>[{gradeLabel}]</span>
                                                        <span className="mt-0.5 block whitespace-nowrap text-sm font-semibold leading-none">{listing.itemName}</span>
                                                        {isMyListing ? (
                                                            <span className="mt-0.5 inline-block rounded-full border border-violet-400/50 bg-violet-900/35 px-1.5 py-0.5 text-[10px] font-bold leading-none text-violet-200">
                                                                내 등록
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="h-14 w-14" aria-hidden />
                                                </div>
                                                <div className="flex items-center justify-center gap-1 text-sm font-bold text-amber-200">
                                                    <span className="tabular-nums">{listing.price.toLocaleString()}</span>
                                                    <img
                                                        src={listing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                        alt={listing.currency === 'gold' ? '골드' : '다이아'}
                                                        className="h-4 w-4 object-contain"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-center gap-1 text-sm font-bold text-cyan-200">
                                                    <span className="tabular-nums">
                                                        {(lowestPriceByBuyGroup.get(getBuyListingGroupKey(listing)) ?? listing.price).toLocaleString()}
                                                    </span>
                                                    <img
                                                        src={listing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                        alt={listing.currency === 'gold' ? '골드' : '다이아'}
                                                        className="h-4 w-4 object-contain"
                                                    />
                                                </div>
                                            </button>
                                            );
                                        })}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                    <div className="min-h-0 flex-1 overflow-hidden">
                                        {selectedBuyListing ? (
                                            <div className="flex h-full min-h-0 flex-col gap-2">
                                                <div className="min-h-0 flex-1">
                                                    {selectedBuyInventoryItem ? (
                                                        <EquipmentDetailPanel item={selectedBuyInventoryItem} showTradeStatusUnderImage />
                                                    ) : (
                                                        <div className="rounded-lg border border-slate-700/60 bg-slate-950/45 p-3">
                                                            <div className="flex items-center gap-2">
                                                                {selectedBuyListing.itemImage ? (
                                                                    <img src={selectedBuyListing.itemImage} alt={selectedBuyListing.itemName} className="h-14 w-14 rounded bg-black/35 object-contain p-1" />
                                                                ) : null}
                                                                <div className="min-w-0">
                                                                    <p className="text-base font-bold break-words">{selectedBuyListing.itemName}</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex items-center justify-between rounded border border-slate-700/60 bg-slate-900/45 px-2 py-2">
                                                                <span className="text-xs text-slate-300">가격</span>
                                                                <span className="flex items-center gap-1 text-sm font-semibold text-amber-100">
                                                                    <span className="tabular-nums">{selectedBuyListing.price.toLocaleString()}</span>
                                                                    <img
                                                                        src={selectedBuyListing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                        alt={selectedBuyListing.currency === 'gold' ? '골드' : '다이아'}
                                                                        className="h-4 w-4 object-contain"
                                                                    />
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="rounded border border-slate-700/60 bg-slate-950/55 px-2 py-2 text-xs text-slate-200">
                                                    <div className="flex items-center justify-between">
                                                        <span>현재가</span>
                                                        <span className="flex items-center gap-1 font-semibold text-amber-200">
                                                            <span className="tabular-nums">{selectedBuyListing.price.toLocaleString()}</span>
                                                            <img
                                                                src={selectedBuyListing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                alt={selectedBuyListing.currency === 'gold' ? '골드' : '다이아'}
                                                                className="h-3.5 w-3.5 object-contain"
                                                            />
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-between">
                                                        <span>최저가</span>
                                                        <span className="flex items-center gap-1 font-semibold text-cyan-200">
                                                            <span className="tabular-nums">
                                                                {(lowestPriceByBuyGroup.get(getBuyListingGroupKey(selectedBuyListing)) ?? selectedBuyListing.price).toLocaleString()}
                                                            </span>
                                                            <img
                                                                src={selectedBuyListing.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                alt={selectedBuyListing.currency === 'gold' ? '골드' : '다이아'}
                                                                className="h-3.5 w-3.5 object-contain"
                                                            />
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-between">
                                                        <span>최근 거래가</span>
                                                        <span className="flex items-center gap-1 font-semibold">
                                                            <span className="tabular-nums">{recentSoldForBuySelection ? recentSoldForBuySelection.price.toLocaleString() : '-'}</span>
                                                            {recentSoldForBuySelection ? (
                                                                <img
                                                                    src={recentSoldForBuySelection.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                    alt={recentSoldForBuySelection.currency === 'gold' ? '골드' : '다이아'}
                                                                    className="h-3.5 w-3.5 object-contain"
                                                                />
                                                            ) : null}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-between">
                                                        <span>남은 시간</span>
                                                        <span className="tabular-nums font-semibold text-cyan-200">{buyRemainingDays}일 {buyRemainingHours}시간</span>
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-between">
                                                        <span>판매자</span>
                                                        <span className={`font-semibold ${selectedBuyListingIsMine ? 'text-violet-200' : 'text-slate-200'}`}>
                                                            {selectedBuyListing.sellerNickname}
                                                            {selectedBuyListingIsMine ? ' (나)' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <Button
                                            onClick={() => selectedBuyListing && handleBuy(selectedBuyListing.id)}
                                            disabled={!selectedBuyListing || selectedBuyListingIsMine}
                                            className={exchangePrimaryButtonClass}
                                        >
                                            {selectedBuyListingIsMine ? '내 등록 물품' : '구매'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'sell' && (
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
                                                    return (
                                                        <button
                                                            key={`sell-slot-${idx}`}
                                                            type="button"
                                                            onClick={() => setSelectedItemId(slot.itemId)}
                                                            className={`w-full rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-left transition hover:border-amber-300/65 ${selectedItemId === slot.itemId ? 'ring-2 ring-amber-300/60' : ''}`}
                                                        >
                                                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                                                                <div className="relative h-14 w-14 overflow-hidden rounded bg-black/25">
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
                                                                <div className="min-w-0">
                                                                    <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-100">
                                                                        <span className="tabular-nums text-[13px]">{slot.price.toLocaleString()}</span>
                                                                        <img
                                                                            src={slot.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                            alt={slot.currency === 'gold' ? '골드' : '다이아'}
                                                                            className="h-4 w-4 object-contain"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex min-w-[92px] flex-col items-center gap-1">
                                                                    <span className={`w-full text-center text-[11px] font-semibold ${verification === 'verifying' ? 'text-cyan-200' : isExpired ? 'text-rose-300' : 'text-emerald-200'}`}>
                                                                        {verification === 'verifying' ? '등록중' : isExpired ? '만료됨' : `${remainingDays}일 ${remainingHours}시간`}
                                                                    </span>
                                                                    <Button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            isExpired ? handleRecoverListing(slot.id) : handleRequestCancelListing(slot.id);
                                                                        }}
                                                                        className={`!flex !w-[78px] !items-center !justify-center min-h-[24px] rounded-md !border px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide ${
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
                                                <EquipmentDetailPanel item={selectedItem} showTradeStatusUnderImage />
                                            </div>
                                        ) : (
                                            <div className="h-[380px] min-h-[380px] max-h-[380px] rounded border border-dashed border-slate-700/70 bg-slate-950/40" />
                                        )}
                                    </div>

                                    <div className="flex min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                        <div className="space-y-2.5">
                                            <p className="text-xs font-semibold text-slate-300">판매 재화 종류</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border px-2 py-2 ${saleCurrency === 'gold' ? 'border-amber-400/70 bg-amber-900/30' : 'border-slate-600 bg-slate-800/70'}`}>
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
                                                    <img src="/images/icon/Gold.png" alt="골드" className="h-5 w-5 object-contain" />
                                                    <span className="text-sm font-semibold text-amber-100">골드</span>
                                                </label>
                                                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border px-2 py-2 ${saleCurrency === 'diamonds' ? 'border-sky-400/70 bg-sky-900/30' : 'border-slate-600 bg-slate-800/70'}`}>
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
                                                    <img src="/images/icon/Zem.png" alt="다이아" className="h-5 w-5 object-contain" />
                                                    <span className="text-sm font-semibold text-sky-100">다이아</span>
                                                </label>
                                            </div>
                                            <label className="flex flex-col gap-1.5 text-sm">
                                                <span>판매 가격 입력</span>
                                                <div
                                                    className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
                                                        saleCurrency === 'gold'
                                                            ? 'border-amber-500/55 bg-amber-950/35'
                                                            : 'border-sky-500/55 bg-sky-950/30'
                                                    }`}
                                                >
                                                    <input
                                                        type="number"
                                                        value={salePrice}
                                                        min={minimumPrice}
                                                        onChange={(e) => setSalePrice(e.target.value)}
                                                        className={`w-full bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                                            saleCurrency === 'gold' ? 'text-amber-100 placeholder:text-amber-200/45' : 'text-sky-100 placeholder:text-sky-200/45'
                                                        }`}
                                                    />
                                                    <img
                                                        src={saleCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                        alt={saleCurrency === 'gold' ? '골드' : '다이아'}
                                                        className="h-5 w-5 shrink-0 object-contain"
                                                    />
                                                </div>
                                            </label>
                                            <div className="rounded border border-slate-700/60 bg-slate-950/55 px-2 py-2 text-xs text-slate-200">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>현재 최저가</span>
                                                    {currentLowestForSelected ? (
                                                        <span className="flex items-center gap-1 font-semibold">
                                                            <span className="tabular-nums">{currentLowestForSelected.price.toLocaleString()}</span>
                                                            <img
                                                                src={currentLowestForSelected.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                alt={currentLowestForSelected.currency === 'gold' ? '골드' : '다이아'}
                                                                className="h-4 w-4 object-contain"
                                                            />
                                                        </span>
                                                    ) : (
                                                        <span className="font-semibold">-</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded border border-slate-700/60 bg-slate-950/55 px-2 py-2 text-xs text-slate-200">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>최근 거래가</span>
                                                    <span className="text-right font-semibold">
                                                        {lastSoldForSelected ? formatCurrency(lastSoldForSelected.price, lastSoldForSelected.currency) : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="rounded border border-cyan-700/50 bg-cyan-950/35 px-2 py-2 text-xs text-cyan-100">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>수수료(10%)</span>
                                                    <span className="flex items-center gap-1 tabular-nums font-semibold">
                                                        <span>{saleFee.toLocaleString()}</span>
                                                        <img
                                                            src={saleCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                            alt={saleCurrency === 'gold' ? '골드' : '다이아'}
                                                            className="h-4 w-4 object-contain"
                                                        />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-auto pt-3">
                                            <Button
                                                onClick={handleRegisterSale}
                                                disabled={!selectedItem || selectedItemAlreadyListedByMe}
                                                className={exchangePrimaryButtonClass}
                                            >
                                                판매 등록
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                                    <div className="mb-2 flex items-center justify-end">
                                        <select
                                            value={inventorySortKey}
                                            onChange={(e) => setInventorySortKey(e.target.value as InventorySortKey)}
                                            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200"
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
                        )}

                        {activeTab === 'settlement' && (
                            <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                                <div className="min-h-0 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                                    <div className={`overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`} style={{ maxHeight: 'calc(100vh - 360px)' }}>
                                        <div className="sticky top-0 z-10 mb-2 grid grid-cols-[minmax(0,1fr)_108px_108px_108px] gap-2 rounded border border-slate-600/70 bg-slate-900/95 px-2 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur-sm">
                                            <span className="text-center">이름</span>
                                            <span className="text-center">판매가</span>
                                            <span className="text-center">수수료</span>
                                            <span className="text-center">수령액</span>
                                        </div>
                                        {settlementDisplayItems.length === 0 && (
                                            <div className="rounded border border-slate-700/60 bg-slate-900/40 px-3 py-8 text-center text-sm text-slate-300">
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
                                                        className={`grid w-full grid-cols-[minmax(0,1fr)_108px_108px_108px] items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                                                            selectedSettlement?.listingId === entry.listingId
                                                                ? 'border-cyan-400/70 bg-cyan-900/25'
                                                                : 'border-slate-700/60 bg-slate-900/50 hover:border-slate-500/70'
                                                        }`}
                                                    >
                                                        <div className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-2">
                                                            <div className="relative h-14 w-14 overflow-hidden rounded bg-black/25">
                                                                <img src={gradeBackgrounds[gradeKey]} alt={gradeLabel} className="absolute inset-0 h-full w-full object-cover" />
                                                                {entry.itemImage ? <img src={entry.itemImage} alt={entry.itemName} className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain" /> : null}
                                                                {starVisual ? (
                                                                    <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/55 px-1 py-0.5">
                                                                        <img src={starVisual.image} alt="" className="h-3 w-3" />
                                                                        <span className={`text-[10px] font-bold leading-none ${starVisual.color}`}>{entry.itemStars}</span>
                                                                    </div>
                                                                ) : null}
                                                            </div>
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
                                                            <div className="h-14 w-14" aria-hidden />
                                                        </div>
                                                        <div className="flex items-center justify-center gap-1 text-sm font-semibold text-amber-100">
                                                            <span className="tabular-nums">{entry.soldPrice.toLocaleString()}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className="h-4 w-4 object-contain" />
                                                        </div>
                                                        <div className="flex items-center justify-center gap-1 text-sm font-semibold text-rose-200">
                                                            <span className="tabular-nums">{entry.fee.toLocaleString()}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className="h-4 w-4 object-contain" />
                                                        </div>
                                                        <div className="flex items-center justify-center gap-1 text-sm font-bold text-emerald-200">
                                                            <span className="tabular-nums">{entry.net.toLocaleString()}</span>
                                                            <img src={currencyIcon} alt={currencyAlt} className="h-4 w-4 object-contain" />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-3">
                                    {selectedSettlement ? (
                                        <div className="space-y-2">
                                            <div className="rounded border border-slate-700/60 bg-slate-950/55 px-3 py-2 text-xs text-slate-100">
                                                <p className="mb-1 text-[11px] font-semibold text-slate-300">선택 항목</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-rose-200">수수료</span>
                                                    <span className="flex items-center gap-1 tabular-nums font-semibold text-rose-200">
                                                        <span>{selectedSettlement.fee.toLocaleString()}</span>
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
                                                        <span>{selectedSettlement.net.toLocaleString()}</span>
                                                        <img
                                                            src={selectedSettlement.currency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                            alt={selectedSettlement.currency === 'gold' ? '골드' : '다이아'}
                                                            className="h-3.5 w-3.5 object-contain"
                                                        />
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="rounded border border-slate-700/60 bg-slate-950/55 px-3 py-2 text-xs text-slate-100">
                                                <p className="mb-1 text-[11px] font-semibold text-slate-300">모든 항목</p>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-rose-200">수수료</span>
                                                        <div className="grid grid-cols-2 items-center gap-1">
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-semibold text-rose-200">
                                                                <span>{settlementTotals.selectedFeeGold.toLocaleString()}</span>
                                                                <img src="/images/icon/Gold.png" alt="골드" className="h-3.5 w-3.5 object-contain" />
                                                            </span>
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-semibold text-rose-200">
                                                                <span>{settlementTotals.selectedFeeDiamonds.toLocaleString()}</span>
                                                                <img src="/images/icon/Zem.png" alt="다이아" className="h-3.5 w-3.5 object-contain" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-emerald-200">수령액</span>
                                                        <div className="grid grid-cols-2 items-center gap-1">
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-bold text-emerald-200">
                                                                <span>{settlementTotals.selectedNetGold.toLocaleString()}</span>
                                                                <img src="/images/icon/Gold.png" alt="골드" className="h-3.5 w-3.5 object-contain" />
                                                            </span>
                                                            <span className="flex min-w-[72px] items-center justify-end gap-1 tabular-nums font-bold text-emerald-200">
                                                                <span>{settlementTotals.selectedNetDiamonds.toLocaleString()}</span>
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
                                        <div className="rounded border border-dashed border-slate-700/70 bg-slate-950/40 px-3 py-10 text-center text-sm text-slate-300">
                                            정산 대기 항목이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-2">
                                <div className="mx-auto flex w-full max-w-[560px] items-stretch gap-2">
                                    <div className="flex w-[260px] items-center justify-center whitespace-nowrap rounded border border-slate-700/60 bg-slate-900/45 px-3 py-2.5 text-center text-lg font-semibold text-slate-100">
                                        총 거래 이력 {history.length}건
                                    </div>
                                    <div className="flex-1 space-y-2 rounded border border-slate-700/60 bg-slate-900/45 px-3 py-2.5 text-base text-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-base font-semibold text-rose-400">총 지출</span>
                                            <div className="grid grid-cols-2 items-center gap-1">
                                                <span className="flex min-w-[98px] items-center justify-end gap-1 tabular-nums text-base font-semibold text-rose-400">
                                                    <span>{historySummary.totals.outGold.toLocaleString()}</span>
                                                    <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 object-contain" />
                                                </span>
                                                <span className="flex min-w-[98px] items-center justify-end gap-1 tabular-nums text-base font-semibold text-rose-400">
                                                    <span>{historySummary.totals.outDiamonds.toLocaleString()}</span>
                                                    <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 object-contain" />
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-base font-semibold text-emerald-400">총 수입</span>
                                            <div className="grid grid-cols-2 items-center gap-1">
                                                <span className="flex min-w-[98px] items-center justify-end gap-1 tabular-nums text-base font-semibold text-emerald-400">
                                                    <span>{historySummary.totals.inGold.toLocaleString()}</span>
                                                    <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 object-contain" />
                                                </span>
                                                <span className="flex min-w-[98px] items-center justify-end gap-1 tabular-nums text-base font-semibold text-emerald-400">
                                                    <span>{historySummary.totals.inDiamonds.toLocaleString()}</span>
                                                    <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 object-contain" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-[48px_96px_minmax(0,1fr)_120px_120px] items-center gap-2 rounded border border-slate-600/70 bg-slate-900/95 px-2 py-1.5 text-xs font-semibold text-slate-300">
                                    <span />
                                    <span className="text-center">상태</span>
                                    <span className="text-center">날짜/시간</span>
                                    <span className="text-center">가격</span>
                                    <span className="text-center">수수료</span>
                                </div>
                                {history.length === 0 && (
                                    <div className="rounded border border-slate-700/60 bg-slate-900/40 px-3 py-8 text-center text-sm text-slate-300">
                                        거래 이력이 없습니다.
                                    </div>
                                )}
                                {historySummary.rows.map((row, idx) => (
                                    <div key={`${row.line}-${idx}`} className="grid grid-cols-[48px_96px_minmax(0,1fr)_120px_120px] items-center gap-2 rounded border border-slate-700/60 bg-slate-900/45 px-2 py-2">
                                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-black/25 ring-1 ring-slate-600/60">
                                            <img src={gradeBackgrounds[row.itemGrade]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                            <img src={row.itemImage} alt="" className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain" />
                                            {(() => {
                                                const starVisual = getStarVisual(row.itemStars ?? 0);
                                                if (!starVisual) return null;
                                                return (
                                                    <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-black/60 px-0.5 py-[1px]">
                                                        <img src={starVisual.image} alt="" className="h-2.5 w-2.5 object-contain" />
                                                        <span className={`text-[8px] font-bold leading-none ${starVisual.color}`}>{row.itemStars}</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <p className="text-center text-sm font-semibold text-slate-200">{row.statusText}</p>
                                        <p className="text-center text-base text-slate-200">{row.timestampText}</p>
                                        <div className={`flex items-center justify-center gap-1 text-base font-semibold ${row.statusText === '정산 수령' ? 'text-emerald-400' : 'text-slate-100'}`}>
                                            {row.priceCurrency ? (
                                                <>
                                                    <span className="tabular-nums">{row.priceAmount.toLocaleString()}</span>
                                                    <img src={row.priceCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt={row.priceCurrency === 'gold' ? '골드' : '다이아'} className="h-4 w-4 object-contain" />
                                                </>
                                            ) : (
                                                <span className="text-slate-500">-</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-center gap-1 text-base font-semibold text-rose-400">
                                            {row.feeCurrency ? (
                                                <>
                                                    <span className="tabular-nums">{row.feeAmount.toLocaleString()}</span>
                                                    <img src={row.feeCurrency === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt={row.feeCurrency === 'gold' ? '골드' : '다이아'} className="h-4 w-4 object-contain" />
                                                </>
                                            ) : (
                                                <span className="text-slate-500">-</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DraggableWindow>
        </>
    );
};

export default ExchangeModal;
