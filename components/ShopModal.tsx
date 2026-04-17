
import React, { useState, useEffect } from 'react';
import { UserWithStatus, ServerAction, InventoryItemType } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { ACTION_POINT_PURCHASE_COSTS_DIAMONDS, MAX_ACTION_POINT_PURCHASES_PER_DAY, ACTION_POINT_PURCHASE_REFILL_AMOUNT } from '../constants';
import { isDifferentWeekKST } from '../utils/timeUtils.js';
import PurchaseQuantityModal from './PurchaseQuantityModal.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface ShopModalProps {
    currentUser?: UserWithStatus; // Optional: useAppContext에서 가져올 수 있도록
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
    initialTab?: ShopTab;
}

type ShopTab = 'equipment' | 'materials' | 'consumables' | 'diamonds' | 'misc' | 'vip';

interface PurchasableItem {
    itemId: string;
    name: string;
    price: { gold?: number; diamonds?: number };
    limit?: number;
    type: InventoryItemType;
    /** 행동력 회복제 등 이미지 위 배지 텍스트 (예: +10) */
    badge?: string;
    /** 행동력 회복제 등 가격 배열(회차별 합산용; 현재는 품목당 1단계) */
    prices?: number[];
    /** 오늘 이미 구매한 수 (prices 인덱스용) */
    purchasesToday?: number;
    /** 아이템 이미지 URL (수량 모달 뷰어용) */
    image?: string;
}

interface MiscShopProduct {
    id: string;
    name: string;
    duration?: string;
    priceKRW: number;
    benefits: string[];
}

type ShopAdRewardTab = 'equipment' | 'materials' | 'consumables' | 'diamonds';

const isSameDayKST = (ts1: number, ts2: number): boolean => {
    if (!ts1 || !ts2) return false;
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const d1 = new Date(ts1 + KST_OFFSET);
    const d2 = new Date(ts2 + KST_OFFSET);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
};

const formatDescription = (desc: string): string => {
    if (!desc) return '';
    const cleaned = desc
        .replace(/~/g, ' ~ ')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.endsWith('획득')) {
        return `${cleaned}합니다.`;
    }

    if (!/[.!?]$/.test(cleaned)) {
        return `${cleaned}.`;
    }

    return cleaned;
};

const ActionPointCard: React.FC<{ currentUser: UserWithStatus, onBuy: () => void }> = ({ currentUser, onBuy }) => {
    const now = Date.now();
    const purchasesToday = isSameDayKST(currentUser.lastActionPointPurchaseDate || 0, now) 
        ? (currentUser.actionPointPurchasesToday || 0) 
        : 0;

    const costIndex = Math.min(purchasesToday, ACTION_POINT_PURCHASE_COSTS_DIAMONDS.length - 1);
    const cost = ACTION_POINT_PURCHASE_COSTS_DIAMONDS[costIndex] ?? ACTION_POINT_PURCHASE_COSTS_DIAMONDS[ACTION_POINT_PURCHASE_COSTS_DIAMONDS.length - 1];
    const canPurchase = purchasesToday < MAX_ACTION_POINT_PURCHASES_PER_DAY;
    
    const handlePurchase = () => {
        if (!canPurchase) return;
        const canAfford = currentUser.diamonds >= cost;
        if (!canAfford) {
            alert('다이아가 부족합니다.');
            return;
        }
        onBuy();
    };

    return (
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c1f3e]/95 via-[#0f172a]/95 to-[#060b15]/95 border border-cyan-400/30 shadow-[0_25px_60px_-25px_rgba(34,211,238,0.55)] p-5 flex flex-col items-center text-center transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-30px_rgba(59,130,246,0.65)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent pointer-events-none" />
            <div className="absolute inset-0 opacity-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.3),transparent_55%)]" />
            <div className="w-24 h-24 bg-gradient-to-br from-[#14b8a6]/30 via-[#06b6d4]/20 to-transparent rounded-xl mb-4 flex items-center justify-center relative">
                <span className="text-5xl text-cyan-300 drop-shadow-[0_0_18px_rgba(14,165,233,0.35)]">⚡</span>
                <span className="absolute bottom-2 right-2 text-2xl font-bold text-cyan-200 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]">{ACTION_POINT_PURCHASE_REFILL_AMOUNT}</span>
            </div>
            <h3 className="text-xl font-bold tracking-wide text-white drop-shadow-lg">행동력 충전</h3>
            <p className="text-sm text-slate-200/85 mt-2 leading-relaxed flex-grow">
                최대치 초과가능. 바로 지급
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2 w-full">
                <Button
                    onClick={handlePurchase}
                    disabled={!canPurchase}
                    colorScheme="none"
                    bare
                    className="flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-cyan-400/60 bg-gradient-to-r from-cyan-400/90 via-sky-400/90 to-blue-500/90 px-3 py-2 text-center font-semibold tracking-wide text-slate-900 shadow-[0_10px_30px_-12px_rgba(14,165,233,0.65)] transition-all duration-150 hover:from-cyan-300 hover:to-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
                        <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
                            <img src="/images/icon/Zem.png" alt="다이아" className="h-5 w-5 shrink-0 drop-shadow-md" />
                            <span className="tabular-nums">{cost.toLocaleString()}</span>
                        </div>
                        <span className="px-1 text-center text-[10px] leading-tight text-slate-800/95 tracking-wide">
                            오늘 구매 {purchasesToday}/{MAX_ACTION_POINT_PURCHASES_PER_DAY}
                        </span>
                    </div>
                </Button>
                {!canPurchase && (
                    <span className="text-xs text-cyan-100/80 italic mt-1">오늘 구매 한도에 도달했습니다.</span>
                )}
            </div>
        </div>
    );
};

const ShopAdRewardCard: React.FC<{
    tab: ShopAdRewardTab;
    rewardLabel: string;
    remaining: number;
    onClaim: (tab: ShopAdRewardTab) => void;
    mobile?: boolean;
}> = ({ tab, rewardLabel, remaining, onClaim, mobile = false }) => {
    const exhausted = remaining <= 0;
    return (
        <div className={`group relative overflow-hidden rounded-xl border border-emerald-400/35 bg-gradient-to-br from-[#102b24]/95 via-[#0f172a]/95 to-[#06130f]/95 shadow-[0_22px_55px_-30px_rgba(16,185,129,0.6)] transition-transform duration-300 hover:-translate-y-1 ${mobile ? 'p-2.5' : 'p-3'}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent pointer-events-none" />
            <div className="relative mx-auto mb-1.5 flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-transparent shadow-[0_0_20px_-8px_rgba(16,185,129,0.8)]">
                <span className="text-3xl" role="img" aria-label="광고 보상">🎬</span>
            </div>
            <h3 className={`text-center font-bold text-emerald-100 ${mobile ? 'text-[11px]' : 'text-sm'}`}>광고보기 보상</h3>
            <p className={`mt-1 text-center font-semibold text-cyan-200 ${mobile ? 'text-[10px]' : 'text-xs'}`}>
                {rewardLabel} ({remaining}/3)
            </p>
            <Button
                onClick={() => onClaim(tab)}
                disabled={exhausted}
                colorScheme="none"
                bare
                className="mt-2 flex min-h-[2.7rem] w-full items-center justify-center rounded-lg border border-emerald-300/45 bg-gradient-to-r from-emerald-400/90 to-cyan-500/90 px-2 py-1.5 text-xs font-bold text-slate-900 transition-colors hover:from-emerald-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {exhausted ? '오늘 수령 완료' : '광고보기'}
            </Button>
        </div>
    );
};

const ShopItemCard: React.FC<{ 
    item: { itemId: string, name: string, description: string, price: { gold?: number, diamonds?: number }, image: string, dailyLimit?: number, weeklyLimit?: number, type: InventoryItemType, badge?: string, prices?: number[], purchasesToday?: number },
    onBuy: (item: PurchasableItem) => void; 
    currentUser: UserWithStatus;
    mobile?: boolean;
}> = ({ item, onBuy, currentUser, mobile = false }) => {
    const { name, description, price, image, dailyLimit, weeklyLimit, badge } = item;
    const isGold = !!price.gold;
    const priceAmount = price.gold || price.diamonds || 0;
    const PriceIcon = isGold ? (
        <img src="/images/icon/Gold.png" alt="골드" className="h-4 w-4 shrink-0 drop-shadow-md sm:h-5 sm:w-5" />
    ) : (
        <img src="/images/icon/Zem.png" alt="다이아" className="h-4 w-4 shrink-0 drop-shadow-md sm:h-5 sm:w-5" />
    );
    const refinedDescription = formatDescription(description);
    const [showDescription, setShowDescription] = useState(false);

    const now = Date.now();
    const purchaseRecord = currentUser.dailyShopPurchases?.[item.itemId];
    
    let purchasesThisPeriod = 0;
    let limit = 0;
    let limitText = '';

    if (weeklyLimit) {
        purchasesThisPeriod = (purchaseRecord && !isDifferentWeekKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        limit = weeklyLimit;
        limitText = '주간';
    } else if (dailyLimit) {
        purchasesThisPeriod = (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        limit = dailyLimit;
        limitText = '일일';
    }
    
    const remaining = limit > 0 ? limit - purchasesThisPeriod : (item.type === 'equipment' ? 100 : undefined);

    const handleBuyClick = () => {
        onBuy({ ...item, limit: remaining });
    };

    return (
        <div className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 border border-indigo-400/35 shadow-[0_22px_55px_-30px_rgba(99,102,241,0.65)] flex flex-col items-center text-center transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-32px_rgba(129,140,248,0.65)] ${mobile ? 'p-2.5' : 'p-3'}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent pointer-events-none" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_65%)] pointer-events-none" />
            <div 
                className={`relative bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent rounded-lg mb-1.5 flex items-center justify-center shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)] cursor-pointer hover:scale-105 transition-transform ${mobile ? 'w-16 h-16' : 'w-16 h-16'}`}
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={() => setShowDescription(true)}
                onMouseLeave={() => setShowDescription(false)}
            >
                {(item.itemId === 'action_point_10' || item.itemId === 'action_point_20' || item.itemId === 'action_point_30') ? (
                    <span className="text-3xl drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)]" aria-label={name}>⚡</span>
                ) : (
                    <img src={image} alt={name} className={`w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)] ${mobile ? 'p-1' : 'p-1.5'}`} />
                )}
                {badge && (
                    <span className="absolute top-0 right-0 text-[10px] font-bold text-cyan-300 bg-gray-900/90 px-1 rounded-bl leading-tight shadow-md">
                        {badge}
                    </span>
                )}
            </div>
            <h3
                className={`w-full min-w-0 px-0 text-center font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.55)] ${
                    mobile
                        ? 'h-[1.1rem] whitespace-nowrap text-[10px] leading-[1.1rem]'
                        : 'min-h-[2.5rem] break-keep text-[11px] leading-snug sm:min-h-0 sm:text-sm'
                }`}
                title={name}
            >
                {name}
            </h3>
            {showDescription && (
                <div className={`absolute z-50 left-1/2 -translate-x-1/2 bg-gray-900/95 border border-indigo-400/50 rounded-lg shadow-xl ${mobile ? 'top-24 w-56 p-2.5' : 'top-20 w-48 p-2'}`}>
                    <p className={`${mobile ? 'text-[11px]' : 'text-[10px]'} text-slate-200/90 leading-relaxed`}>
                        {refinedDescription}
                    </p>
                </div>
            )}
            <div className="mt-1.5 flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-1">
                <Button
                    onClick={handleBuyClick}
                    disabled={remaining === 0}
                    colorScheme="none"
                    bare
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-center font-semibold leading-tight transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60 ${mobile ? 'h-[2.95rem] min-h-[2.95rem] max-h-[2.95rem] py-1' : 'min-h-[3.5rem] py-2'} ${
                        isGold
                            ? 'border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500'
                            : 'border-sky-400/50 bg-gradient-to-r from-sky-400/90 via-blue-500/90 to-indigo-500/90 text-white shadow-[0_12px_32px_-18px_rgba(56,189,248,0.85)] hover:from-sky-300 hover:to-indigo-500'
                    }`}
                >
                    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
                        <div className={`flex min-w-0 items-center justify-center gap-1 font-semibold tracking-tight ${mobile ? 'text-[11px]' : 'text-[11px] sm:text-xs'}`}>
                            {PriceIcon}
                            <span className="min-w-0 tabular-nums">{priceAmount.toLocaleString()}</span>
                        </div>
                        {limit > 0 && (
                            <span
                                className={`max-w-full px-0 text-center leading-tight ${mobile ? 'text-[9px]' : 'text-[9px]'} ${isGold ? 'text-slate-800/95' : 'text-white/85'} tracking-tight`}
                            >
                                {limitText} 한도 {remaining}/{limit}
                            </span>
                        )}
                    </div>
                </Button>
            </div>
        </div>
    );
};

const MiscShopCard: React.FC<{ product: MiscShopProduct; mobile?: boolean }> = ({ product, mobile = false }) => {
    return (
        <div className={`rounded-xl border border-violet-400/35 bg-gradient-to-br from-[#20173a]/95 via-[#131a2f]/95 to-[#090e1a]/95 shadow-[0_18px_45px_-28px_rgba(139,92,246,0.7)] ${mobile ? 'p-3' : 'p-4'}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className={`${mobile ? 'text-sm' : 'text-base'} font-bold text-white`}>{product.name}</h3>
                {product.duration && (
                    <span className="shrink-0 rounded-md bg-violet-500/25 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                        {product.duration}
                    </span>
                )}
            </div>
            <p className={`${mobile ? 'text-xs' : 'text-sm'} font-semibold text-amber-300`}>{product.priceKRW.toLocaleString()}원</p>
            <ul className={`mt-2 space-y-1 text-slate-200/90 ${mobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
                {product.benefits.map((benefit, index) => (
                    <li key={`${product.id}-benefit-${index}`}>- {benefit}</li>
                ))}
            </ul>
            <div className="mt-3 rounded-md border border-slate-500/40 bg-slate-900/50 px-2 py-1 text-center text-[10px] text-slate-300/85">
                이미지 및 구매 기능은 추후 업데이트 예정
            </div>
        </div>
    );
};

const VipShopCard: React.FC<{ product: MiscShopProduct; mobile?: boolean }> = ({ product, mobile = false }) => {
    return (
        <div className={`rounded-xl border border-yellow-300/40 bg-gradient-to-br from-[#36270d]/95 via-[#21160f]/95 to-[#0d111f]/95 shadow-[0_20px_48px_-28px_rgba(251,191,36,0.8)] ${mobile ? 'p-3' : 'p-4'}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className={`${mobile ? 'text-sm' : 'text-base'} font-extrabold text-amber-200`}>{product.name}</h3>
                {product.duration && (
                    <span className="shrink-0 rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                        {product.duration}
                    </span>
                )}
            </div>
            <p className={`${mobile ? 'text-xs' : 'text-sm'} font-semibold text-amber-300`}>{product.priceKRW.toLocaleString()}원</p>
            <ul className={`mt-2 space-y-1 text-amber-50/90 ${mobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
                {product.benefits.map((benefit, index) => (
                    <li key={`${product.id}-vip-benefit-${index}`}>- {benefit}</li>
                ))}
            </ul>
            <div className="mt-3 rounded-md border border-amber-200/35 bg-black/30 px-2 py-1 text-center text-[10px] text-amber-100/85">
                중복 구매 시 기간 연장
            </div>
        </div>
    );
};

const DiamondShopCard: React.FC<{ product: { id: string; diamonds: number; priceKRW: number }; mobile?: boolean }> = ({ product, mobile = false }) => {
    return (
        <div className={`rounded-xl border border-sky-300/40 bg-gradient-to-br from-[#102744]/95 via-[#111827]/95 to-[#0a111d]/95 shadow-[0_20px_50px_-30px_rgba(56,189,248,0.75)] ${mobile ? 'p-3' : 'p-4'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className={`${mobile ? 'text-sm' : 'text-base'} font-extrabold text-cyan-100`}>다이아 {product.diamonds.toLocaleString()}개</h3>
                <span className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">충전</span>
            </div>
            <p className={`${mobile ? 'text-xs' : 'text-sm'} font-semibold text-amber-300`}>{product.priceKRW.toLocaleString()}원</p>
            <div className="mt-3 rounded-md border border-sky-300/35 bg-black/30 px-2 py-1 text-center text-[10px] text-sky-100/85">
                결제 연동 예정
            </div>
        </div>
    );
};

const ShopModal: React.FC<ShopModalProps> = ({ currentUser: propCurrentUser, onClose, onAction, isTopmost, initialTab }) => {
    const { currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const mobileShop = Boolean(isNativeMobile);
    // useAppContext의 currentUserWithStatus를 우선 사용 (최신 상태 보장)
    const currentUser = currentUserWithStatus || propCurrentUser;
    
    if (!currentUser) {
        return null;
    }
    
    const [activeTab, setActiveTab] = useState<ShopTab>(initialTab || 'equipment');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [purchasingItem, setPurchasingItem] = useState<PurchasableItem | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    const gridClassName = mobileShop
        ? 'grid grid-cols-2 gap-1.5 min-[390px]:grid-cols-3 min-[390px]:gap-2'
        : 'grid grid-cols-4 gap-3';
    const materialItems = [
        { itemId: "material_box_1", name: "재료 상자 I", description: "하급~상급강화석 5개", price: { gold: 500 }, image: "/images/Box/ResourceBox1.png", dailyLimit: 10, type: 'material' as const },
        { itemId: "material_box_2", name: "재료 상자 II", description: "하급~상급강화석 5개", price: { gold: 1000 }, image: "/images/Box/ResourceBox2.png", dailyLimit: 10, type: 'material' as const },
        { itemId: "material_box_3", name: "재료 상자 III", description: "하급~상급강화석 5개", price: { gold: 3000 }, image: "/images/Box/ResourceBox3.png", dailyLimit: 10, type: 'material' as const },
        { itemId: "material_box_4", name: "재료 상자 IV", description: "중급~최상급강화석 5개", price: { gold: 5000 }, image: "/images/Box/ResourceBox4.png", dailyLimit: 10, type: 'material' as const },
        { itemId: "material_box_5", name: "재료 상자 V", description: "상급~신비의강화석 5개", price: { gold: 10000 }, image: "/images/Box/ResourceBox5.png", dailyLimit: 10, type: 'material' as const },
        { itemId: "material_box_6", name: "재료 상자 VI", description: "상급~신비의강화석 5개", price: { diamonds: 100 }, image: "/images/Box/ResourceBox6.png", dailyLimit: 10, type: 'material' as const },
        { itemId: 'option_type_change_ticket', name: "옵션 종류 변경권", description: "장비의 주옵션, 부옵션, 특수옵션 중 하나를 다른 종류로 변경", price: { gold: 2000 }, image: "/images/use/change1.png", dailyLimit: 3, type: 'material' as const },
        { itemId: 'option_value_change_ticket', name: "옵션 수치 변경권", description: "장비의 부옵션 또는 특수옵션 중 하나의 수치를 변경", price: { gold: 500 }, image: "/images/use/change2.png", dailyLimit: 10, type: 'material' as const },
        { itemId: 'mythic_option_change_ticket', name: "신화 옵션 종류 변경권", description: "신화 또는 초월 장비의 신화 옵션을 다른 신화 옵션으로 변경", price: { gold: 500 }, image: "/images/use/change3.png", dailyLimit: 10, type: 'material' as const },
    ];
    const vipProducts: MiscShopProduct[] = [
        {
            id: 'reward_vip',
            name: '보상 VIP',
            duration: '30일 적용',
            priceKRW: 9900,
            benefits: [
                '[VIP 보상슬롯]',
                'VIP 보상슬롯 위치 : 전략바둑, 놀이바둑, 모험 승리 보상화면, 길드보스전 보상화면',
                'VIP 보상(확률성) : 골드200% 추가보상 or 장비 획득(일반~에픽) or 재료 획득(하급~상급)(1~5개)',
                '길드 코인 획득량 2배(출석,기부,길드보스전)',
                '일일/주간/월간 퀘스트 보상2배',
                '퀘스트 활약도 보상2배',
            ],
        },
        {
            id: 'function_vip',
            name: '기능 VIP',
            duration: '30일 적용',
            priceKRW: 9900,
            benefits: [
                '행동력 최대치 +20',
                '행동력 회복 속도 50% 증가',
                '행동력 회복제 III 우편으로 매일 1개 지급',
                '대장간 경험치 획득 +50%',
                '장비 강화 성공확률 +10% (최대 100%)',
                '장비 합성 대성공 확률 +10% (최대 100%)',
                '장비 분해 대박 확률 +10%',
                '재료 분해/합성 대박 확률 +10%',
            ],
        },
        {
            id: 'vvip',
            name: 'VVIP',
            duration: '30일 적용',
            priceKRW: 15900,
            benefits: ['보상 VIP + 기능 VIP 통합 혜택'],
        },
    ];
    const miscProducts: MiscShopProduct[] = [
        {
            id: 'diamond_package_1',
            name: '다이아 패키지 I',
            duration: '7일 적용',
            priceKRW: 4900,
            benefits: ['매일 우편으로 50다이아 지급 (총 350다이아)', '즉시 100다이아 지급'],
        },
        {
            id: 'diamond_package_2',
            name: '다이아 패키지 II',
            duration: '15일 적용',
            priceKRW: 7900,
            benefits: ['매일 우편으로 50다이아 지급 (총 750다이아)', '즉시 250다이아 지급'],
        },
        {
            id: 'diamond_package_3',
            name: '다이아 패키지 III',
            duration: '30일 적용',
            priceKRW: 12900,
            benefits: ['매일 우편으로 50다이아 지급 (총 1500다이아)', '즉시 750다이아 지급'],
        },
        {
            id: 'equipment_package_1',
            name: '장비상자패키지 I',
            priceKRW: 2900,
            benefits: ['장비상자 V 1개', '재료상자 VI 1개'],
        },
        {
            id: 'equipment_package_2',
            name: '장비상자패키지 II',
            priceKRW: 4900,
            benefits: ['장비상자 V 2개', '재료상자 VI 2개'],
        },
        {
            id: 'equipment_package_3',
            name: '장비상자패키지 III',
            priceKRW: 7900,
            benefits: ['장비상자 V 2개', '장비상자 VI 1개', '재료상자 VI 5개'],
        },
    ];
    const diamondProducts = [
        { id: 'diamond_50', diamonds: 50, priceKRW: 1900 },
        { id: 'diamond_200', diamonds: 200, priceKRW: 5900 },
        { id: 'diamond_500', diamonds: 500, priceKRW: 12900 },
        { id: 'diamond_1000', diamonds: 1000, priceKRW: 19900 },
        { id: 'diamond_2000', diamonds: 2000, priceKRW: 29900 },
    ] as const;

    const getAdRewardRemaining = (tab: ShopAdRewardTab) => {
        const rec = currentUser.dailyShopPurchases?.[`ad_reward_${tab}`];
        const used = rec && isSameDayKST(rec.date, Date.now()) ? rec.quantity : 0;
        return Math.max(0, 3 - used);
    };

    const handleClaimShopAdReward = (tab: ShopAdRewardTab) => {
        const remaining = getAdRewardRemaining(tab);
        if (remaining <= 0) {
            setToastMessage('오늘 광고 보상 수령이 모두 완료되었습니다.');
            return;
        }
        onAction({ type: 'CLAIM_SHOP_AD_REWARD', payload: { tab } });
        setToastMessage('광고 보상을 수령했습니다.');
    };

    const handleInitiatePurchase = (item: PurchasableItem) => {
        setPurchasingItem(item);
    };

    const handleConfirmPurchase = (itemId: string, quantity: number) => {
        const item = purchasingItem;
        if (!item) return;

        // 컨디션 회복제는 별도의 액션 사용
        if (itemId.startsWith('condition_potion_')) {
            const potionType = itemId.replace('condition_potion_', '') as 'small' | 'medium' | 'large';
            onAction({ type: 'BUY_CONDITION_POTION', payload: { potionType, quantity } });
        } else if (itemId === 'option_type_change_ticket' || itemId === 'option_value_change_ticket' || itemId === 'mythic_option_change_ticket' || itemId === 'action_point_10' || itemId === 'action_point_20' || itemId === 'action_point_30') {
            // 변경권·행동력 회복제 구매
            onAction({ type: 'BUY_CONSUMABLE', payload: { itemId, quantity } });
        } else {
            const actionType = item.type === 'equipment' ? 'BUY_SHOP_ITEM' : 'BUY_MATERIAL_BOX';
            onAction({ type: actionType, payload: { itemId, quantity } });
        }
        setToastMessage('구매 완료! 가방을 확인하세요.');
        setPurchasingItem(null);
    };
    
    const handleBuyActionPoints = () => {
        onAction({ type: 'PURCHASE_ACTION_POINTS' });
        setToastMessage('행동력 구매 완료!');
    };

    const renderContent = () => {
        const equipmentItems = [
            { itemId: 'equipment_box_1', name: "장비 상자 I", description: "일반~희귀 등급 장비", price: { gold: 500 }, image: "/images/Box/EquipmentBox1.png", type: 'equipment' as const },
            { itemId: 'equipment_box_2', name: "장비 상자 II", description: "일반~에픽 등급 장비", price: { gold: 1500 }, image: "/images/Box/EquipmentBox2.png", type: 'equipment' as const },
            { itemId: 'equipment_box_3', name: "장비 상자 III", description: "고급~전설 등급 장비", price: { gold: 5000 }, image: "/images/Box/EquipmentBox3.png", type: 'equipment' as const },
            { itemId: 'equipment_box_4', name: "장비 상자 IV", description: "희귀~신화 등급 장비", price: { gold: 10000 }, image: "/images/Box/EquipmentBox4.png", type: 'equipment' as const },
            { itemId: 'equipment_box_5', name: "장비 상자 V", description: "에픽~신화 등급 장비", price: { diamonds: 100 }, image: "/images/Box/EquipmentBox5.png", type: 'equipment' as const },
            { itemId: 'equipment_box_6', name: "장비 상자 VI", description: "전설~신화 등급 장비", price: { diamonds: 500 }, image: "/images/Box/EquipmentBox6.png", type: 'equipment' as const },
        ];

        switch (activeTab) {
            case 'equipment':
                return (
                    <div className={gridClassName}>
                        <ShopAdRewardCard
                            tab="equipment"
                            rewardLabel="장비상자II"
                            remaining={getAdRewardRemaining('equipment')}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                        />
                        {equipmentItems.map(item => <ShopItemCard key={item.itemId} item={item} onBuy={handleInitiatePurchase} currentUser={currentUser} mobile={mobileShop} />)}
                    </div>
                );
            case 'materials':
                 return (
                    <div className={gridClassName}>
                        <ShopAdRewardCard
                            tab="materials"
                            rewardLabel="재료상자II"
                            remaining={getAdRewardRemaining('materials')}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                        />
                        {materialItems.map(item => <ShopItemCard key={item.itemId} item={item} onBuy={handleInitiatePurchase} currentUser={currentUser} mobile={mobileShop} />)}
                    </div>
                );
            case 'diamonds':
                return (
                    <div className={`${mobileShop ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-2 gap-3'}`}>
                        <ShopAdRewardCard
                            tab="diamonds"
                            rewardLabel="다이아5"
                            remaining={getAdRewardRemaining('diamonds')}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                        />
                        {diamondProducts.map(product => (
                            <DiamondShopCard key={product.id} product={product} mobile={mobileShop} />
                        ))}
                    </div>
                );
            case 'misc':
                return (
                    <div className={`${mobileShop ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-2 gap-3'}`}>
                        {miscProducts.map(product => (
                            <MiscShopCard key={product.id} product={product} mobile={mobileShop} />
                        ))}
                    </div>
                );
            case 'vip':
                return (
                    <div className={`${mobileShop ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-2 gap-3'}`}>
                        {vipProducts.map(product => (
                            <VipShopCard key={product.id} product={product} mobile={mobileShop} />
                        ))}
                    </div>
                );
            case 'consumables':
            default: {
                const baseConsumableItems = [
                    { itemId: 'condition_potion_small', name: "컨디션회복제(소)", description: "컨디션 1~10회복", price: { gold: 100 }, image: "/images/use/con1.png", dailyLimit: 3, type: 'consumable' as const },
                    { itemId: 'condition_potion_medium', name: "컨디션회복제(중)", description: "컨디션 10~20회복", price: { gold: 150 }, image: "/images/use/con2.png", dailyLimit: 3, type: 'consumable' as const },
                    { itemId: 'condition_potion_large', name: "컨디션회복제(대)", description: "컨디션 20~30회복", price: { gold: 200 }, image: "/images/use/con3.png", dailyLimit: 3, type: 'consumable' as const },
                ];
                // 행동력 회복제: 품목별 일일 1개, 고정 골드가 (ShopItemCard)
                const ACTION_POINT_ITEMS = [
                    { itemId: 'action_point_10' as const, name: '행동력 회복제(+10)', description: '가방으로 지급', dailyLimit: 1, prices: [100], badge: '+10' },
                    { itemId: 'action_point_20' as const, name: '행동력 회복제(+20)', description: '가방으로 지급', dailyLimit: 1, prices: [300], badge: '+20' },
                    { itemId: 'action_point_30' as const, name: '행동력 회복제(+30)', description: '가방으로 지급', dailyLimit: 1, prices: [1000], badge: '+30' },
                ];
                const actionPointShopItems = ACTION_POINT_ITEMS.map(({ itemId, name, description, dailyLimit, prices, badge }) => {
                    const purchaseRecord = currentUser.dailyShopPurchases?.[itemId];
                    const purchasesToday = (purchaseRecord && isSameDayKST(purchaseRecord.date, Date.now())) ? purchaseRecord.quantity : 0;
                    const nextPriceIndex = Math.min(purchasesToday, prices.length - 1);
                    const nextPrice = prices[nextPriceIndex] ?? prices[prices.length - 1];
                    return {
                        itemId,
                        name,
                        description,
                        price: { gold: nextPrice },
                        image: '/images/icon/applus.png',
                        dailyLimit,
                        type: 'consumable' as const,
                        badge,
                        prices,
                        purchasesToday,
                    };
                });
                const consumableItems = [...baseConsumableItems, ...actionPointShopItems];
                return (
                    <div className={gridClassName}>
                        <ShopAdRewardCard
                            tab="consumables"
                            rewardLabel="행동력 회복제(+10)"
                            remaining={getAdRewardRemaining('consumables')}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                        />
                        {consumableItems.map(item => (
                            <ShopItemCard key={item.itemId} item={item} onBuy={handleInitiatePurchase} currentUser={currentUser} mobile={mobileShop} />
                        ))}
                    </div>
                );
            }
        }
    };

    return (
        <>
            {purchasingItem && (
                <PurchaseQuantityModal 
                    item={purchasingItem}
                    currentUser={currentUser}
                    onClose={() => setPurchasingItem(null)}
                    onConfirm={handleConfirmPurchase}
                />
            )}
            <DraggableWindow
                title="상점"
                onClose={onClose}
                windowId="shop"
                initialWidth={900}
                initialHeight={750}
                isTopmost={isTopmost && !purchasingItem}
                bodyScrollable={!mobileShop}
                mobileViewportFit={mobileShop}
                mobileViewportMaxHeightVh={90}
                bodyNoScroll={false}
                bodyPaddingClassName={mobileShop ? 'flex min-h-0 min-w-0 flex-1 flex-col !px-2.5 !pt-2.5 !pb-[max(0.8rem,env(safe-area-inset-bottom,0px))]' : undefined}
            >
                <div
                    className={
                        mobileShop
                            ? 'relative flex min-h-0 w-full flex-col'
                            : 'relative flex h-full min-h-0 flex-col'
                    }
                >
                    <div
                        className={`mb-3 flex shrink-0 rounded-lg bg-gray-900/70 p-1 ${mobileShop ? 'sticky top-0 z-20 gap-1 backdrop-blur-sm' : ''}`}
                    >
                        <button onClick={() => setActiveTab('equipment')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'equipment' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>장비</button>
                        <button onClick={() => setActiveTab('materials')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'materials' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>재료</button>
                        <button onClick={() => setActiveTab('consumables')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'consumables' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>소모품</button>
                        <button onClick={() => setActiveTab('diamonds')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'diamonds' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>다이아</button>
                        <button onClick={() => setActiveTab('misc')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'misc' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>패키지</button>
                        <button onClick={() => setActiveTab('vip')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'vip' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>VIP</button>
                    </div>

                    <div
                        className={
                            mobileShop
                                ? 'w-full min-w-0 pr-0.5'
                                : 'min-h-0 flex-1 overflow-y-auto pr-2'
                        }
                    >
                        {renderContent()}
                    </div>

                    {toastMessage && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in z-10">
                            {toastMessage}
                        </div>
                    )}
                </div>
            </DraggableWindow>
        </>
    );
};

export default ShopModal;
