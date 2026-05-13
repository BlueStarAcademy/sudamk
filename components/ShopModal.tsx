
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus, ServerAction, InventoryItemType } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { gradeStyles } from '../shared/constants/items.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { ACTION_POINT_PURCHASE_COSTS_DIAMONDS, MAX_ACTION_POINT_PURCHASES_PER_DAY, ACTION_POINT_PURCHASE_REFILL_AMOUNT } from '../constants';
import {
    isSameDayKST,
    isDifferentWeekKST,
    isDifferentMonthKST,
    shopPurchaseRecordDateMs,
} from '../shared/utils/timeUtils.js';
import {
    CASH_SHOP_DIAMOND_PACKAGE_IDS,
    CASH_SHOP_EQUIPMENT_PACKAGE_IDS,
    CASH_SHOP_REMOVE_ADS_PACKAGE_ID,
    EQUIPMENT_PACKAGE_MONTHLY_LIMIT,
} from '../shared/constants/cashShopPackages.js';
import { VIP_SHOP_DURATION_DAYS, VIP_SHOP_PRODUCT_IDS } from '../shared/constants/vipShopProducts.js';
import PurchaseQuantityModal from './PurchaseQuantityModal.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useKSTCalendarDayTick } from '../hooks/useKSTCalendarDayTick.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useAdContext } from './ads/AdProvider.js';

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
    /** 수량 선택 모달 설명·사용처 보강용 */
    description?: string;
    /** 행동력 회복제 등 이미지 위 배지 텍스트 (예: +10) */
    badge?: string;
    /** 행동력 회복제 등 가격 배열(회차별 합산용; 현재는 품목당 1단계) */
    prices?: number[];
    /** 오늘 이미 구매한 수 (prices 인덱스용) */
    purchasesToday?: number;
    /** 아이템 이미지 URL (수량 모달 뷰어용) */
    image?: string;
}

/** 패키지 탭: 다이아(매일+즉시) 또는 장비·재료 상자 구성 시각화 */
type MiscPackageVisual =
    | { type: 'diamond_combo'; dailyPerMail: number; durationDays: number; instantDiamonds: number }
    | {
          type: 'box_row';
          boxes: { imageSrc: string; quantity: number; alt: string; displayName: string }[];
          bonusLine?: string;
          /** `+ "[등급] 장비"` + 줄바꿈 + `확정지급` (장비상자 패키지) */
          equipmentBonusGradeWord?: '에픽' | '전설' | '신화';
      }
    | { type: 'remove_ads_image'; imageSrc: string };

interface MiscShopProduct {
    id: string;
    name: string;
    duration?: string;
    priceKRW: number;
    benefits: string[];
    /** VIP 카드 본문 아래에 별도로 표시 (보상 VIP 슬롯 요약 등) */
    benefitFooter?: string;
    /** 패키지 탭 전용: 이미지·수치로 혜택 표시 */
    packageVisual?: MiscPackageVisual;
}

const SHOP_DIAMOND_ICON = '/images/icon/Zem.webp';

/** 현금 다이아 탭 — 합계는 그대로, “더 주는” 느낌으로 구간만 시각 분할 */
function getCashDiamondShopSegments(total: number): readonly [number, number] | null {
    if (total === 200) return [150, 50] as const;
    if (total === 500) return [350, 150] as const;
    if (total === 1000) return [500, 500] as const;
    if (total === 2000) return [750, 1250] as const;
    return null;
}

/** 장비상자 패키지 보너스 등급 단어 → `gradeStyles`용 enum (실제 장비 등급 색상과 동일) */
const SHOP_EQUIPMENT_PACKAGE_BONUS_GRADE: Record<'에픽' | '전설' | '신화', ItemGrade> = {
    에픽: ItemGrade.Epic,
    전설: ItemGrade.Legendary,
    신화: ItemGrade.Mythic,
};

/** 원화(현금) 결제 미연동 — 일반 유저 차단, 관리자만 `BUY_CASH_PACKAGE`·`BUY_VIP_PACKAGE`·`CANCEL_VIP_SHOP_AUTO_RENEW` 허용 */
const CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE = '아직 구현되지 않았습니다.';

type ShopAdRewardTab = 'equipment' | 'materials' | 'consumables' | 'diamonds';

/** 서버 `CLAIM_SHOP_AD_REWARD`와 동일 — 탭별 일 3회 */
const SHOP_AD_TAB_DAILY_LIMIT = 3;

function getShopAdTabClaimsToday(user: UserWithStatus, tab: ShopAdRewardTab, nowMs: number): number {
    const rec = user.dailyShopPurchases?.[`ad_reward_${tab}`];
    if (!rec) return 0;
    const d = shopPurchaseRecordDateMs(rec.date);
    if (!(d > 0)) return 0;
    return isSameDayKST(d, nowMs) ? rec.quantity : 0;
}

/** 이 탭에서 오늘 남은 광고 보상 횟수(서버 `isSameDayKST`와 동일 판정). */
function getShopAdRemainingForTab(user: UserWithStatus, tab: ShopAdRewardTab, nowMs: number): number {
    return Math.max(0, SHOP_AD_TAB_DAILY_LIMIT - getShopAdTabClaimsToday(user, tab, nowMs));
}

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

/** 모바일 상점 카드 `overflow-hidden` 밖에서 설명을 보이게 하기 위한 뷰포트 고정 레이어 */
const SHOP_IMAGE_DESC_POPOVER_Z = 100_000;

type ShopMobileDescBox = { left: number; top: number; maxW: number; transform: string };

function computeShopMobileDescBox(anchor: HTMLElement): ShopMobileDescBox {
    const rect = anchor.getBoundingClientRect();
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxW = Math.min(288, vw - margin * 2);
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(margin + maxW / 2, Math.min(vw - margin - maxW / 2, centerX));
    const gap = 8;
    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const preferBelow = spaceBelow >= 96 || spaceBelow >= spaceAbove;
    if (preferBelow) {
        return { left, top: rect.bottom + gap, maxW, transform: 'translate(-50%, 0)' };
    }
    return { left, top: rect.top - gap, maxW, transform: 'translate(-50%, -100%)' };
}

const ShopMobileImageDescriptionPortal: React.FC<{
    open: boolean;
    anchorRef: React.RefObject<HTMLDivElement | null>;
    onRequestClose: () => void;
    children: React.ReactNode;
}> = ({ open, anchorRef, onRequestClose, children }) => {
    const [box, setBox] = useState<ShopMobileDescBox | null>(null);

    const recompute = useCallback(() => {
        if (!open) {
            setBox(null);
            return;
        }
        const el = anchorRef.current;
        if (!el) {
            setBox(null);
            return;
        }
        setBox(computeShopMobileDescBox(el));
    }, [open, anchorRef]);

    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        recompute();
        const el = anchorRef.current;
        const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(recompute) : null;
        if (el && ro) ro.observe(el);
        window.addEventListener('resize', recompute);
        window.addEventListener('scroll', recompute, true);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', recompute);
            window.removeEventListener('scroll', recompute, true);
        };
    }, [open, recompute, anchorRef]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <>
            <div
                className="fixed inset-0 bg-transparent"
                style={{ zIndex: SHOP_IMAGE_DESC_POPOVER_Z - 1, touchAction: 'manipulation' }}
                aria-hidden
                onPointerDown={(e) => {
                    e.preventDefault();
                    onRequestClose();
                }}
            />
            {box ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="pointer-events-auto fixed max-h-[min(50dvh,320px)] overflow-y-auto rounded-lg border border-indigo-400/50 bg-[#0b1220] p-2.5 text-left text-slate-100 shadow-2xl [scrollbar-width:thin]"
                    style={{
                        zIndex: SHOP_IMAGE_DESC_POPOVER_Z,
                        left: box.left,
                        top: box.top,
                        transform: box.transform,
                        width: box.maxW,
                        maxWidth: box.maxW,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            ) : null}
        </>,
        document.body
    );
};

const ActionPointCard: React.FC<{ currentUser: UserWithStatus, onBuy: () => void }> = ({ currentUser, onBuy }) => {
    const now = Date.now();
    const apPurchaseMs = shopPurchaseRecordDateMs(currentUser.lastActionPointPurchaseDate);
    const purchasesToday =
        apPurchaseMs > 0 && isSameDayKST(apPurchaseMs, now) ? currentUser.actionPointPurchasesToday || 0 : 0;

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
                            <img src="/images/icon/Zem.webp" alt="다이아" className="h-5 w-5 shrink-0 drop-shadow-md" />
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
    rewardDescription: string;
    /** 이 탭에서 오늘 남은 광고 보상 횟수(0이면 소진) */
    claimableRemaining: number;
    onClaim: (tab: ShopAdRewardTab) => void;
    mobile?: boolean;
}> = ({ tab, rewardDescription, claimableRemaining, onClaim, mobile = false }) => {
    const { isAdFree } = useAdContext();
    const exhausted = claimableRemaining <= 0;
    const [showDescription, setShowDescription] = useState(false);
    const imageAnchorRef = useRef<HTMLDivElement>(null);
    const refinedDescription = formatDescription(rewardDescription);

    return (
        <div
            className={`group relative flex h-full min-h-0 flex-col items-center overflow-hidden rounded-xl border border-indigo-400/35 bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 text-center shadow-[0_22px_55px_-30px_rgba(99,102,241,0.65)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-32px_rgba(129,140,248,0.65)] ${mobile ? 'p-2.5' : 'p-3'}`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent" />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-20 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_65%)]" />
            <div
                ref={imageAnchorRef}
                className="relative mb-1.5 flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)] transition-transform hover:scale-105"
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={() => {
                    if (!mobile) setShowDescription(true);
                }}
                onMouseLeave={() => {
                    if (!mobile) setShowDescription(false);
                }}
            >
                {isAdFree ? (
                    <img
                        src="/images/shop/remove_ads_package.svg"
                        alt=""
                        className="h-14 w-14 object-contain drop-shadow-[0_6px_12px_rgba(220,38,38,0.35)]"
                    />
                ) : (
                    <span className="text-3xl drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)]" role="img" aria-label="광고 보상">
                        🎬
                    </span>
                )}
            </div>
            <h3
                className={`w-full min-w-0 shrink-0 px-0 text-center font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.55)] ${
                    mobile
                        ? 'h-[1.1rem] whitespace-nowrap text-[10px] leading-[1.1rem]'
                        : 'min-h-[2.5rem] break-keep text-[11px] leading-snug sm:min-h-0 sm:text-sm'
                }`}
                title="광고 보상"
            >
                광고 보상
            </h3>
            {showDescription && mobile && (
                <ShopMobileImageDescriptionPortal
                    open
                    anchorRef={imageAnchorRef}
                    onRequestClose={() => setShowDescription(false)}
                >
                    <p className="text-left text-[11px] leading-relaxed text-slate-100">{refinedDescription}</p>
                </ShopMobileImageDescriptionPortal>
            )}
            {showDescription && !mobile && (
                <div className="absolute left-1/2 top-20 z-50 w-52 -translate-x-1/2 rounded-lg border border-indigo-400/50 bg-[#0b1220] p-2 shadow-xl">
                    <p className="text-left text-[10px] leading-relaxed text-slate-100">{refinedDescription}</p>
                </div>
            )}
            <div className="mt-1.5 flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-1">
                <Button
                    onClick={() => onClaim(tab)}
                    disabled={exhausted}
                    colorScheme="none"
                    bare
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-300/45 bg-gradient-to-r from-emerald-400/90 to-cyan-500/90 px-2 py-1.5 text-center font-semibold leading-tight text-slate-900 transition-colors hover:from-emerald-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${mobile ? 'h-[2.95rem] min-h-[2.95rem] max-h-[2.95rem] text-[11px]' : 'min-h-[3.5rem] py-2 text-xs sm:text-sm'}`}
                >
                    <span className="flex flex-wrap items-center justify-center gap-x-1">
                        <span className="font-bold">
                            {exhausted ? '오늘 수령 완료' : isAdFree ? '무료 보상' : '광고 보기'}
                        </span>
                        <span className="tabular-nums font-extrabold opacity-90">
                            ({claimableRemaining}/{SHOP_AD_TAB_DAILY_LIMIT})
                        </span>
                    </span>
                </Button>
            </div>
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
        <img src="/images/icon/Gold.webp" alt="골드" className="h-4 w-4 shrink-0 drop-shadow-md sm:h-5 sm:w-5" />
    ) : (
        <img src="/images/icon/Zem.webp" alt="다이아" className="h-4 w-4 shrink-0 drop-shadow-md sm:h-5 sm:w-5" />
    );
    const refinedDescription = formatDescription(description);
    const [showDescription, setShowDescription] = useState(false);
    const imageAnchorRef = useRef<HTMLDivElement>(null);

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
                ref={imageAnchorRef}
                className={`relative bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent rounded-lg mb-1.5 flex items-center justify-center shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)] cursor-pointer hover:scale-105 transition-transform ${mobile ? 'w-16 h-16' : 'w-16 h-16'}`}
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={() => {
                    if (!mobile) setShowDescription(true);
                }}
                onMouseLeave={() => {
                    if (!mobile) setShowDescription(false);
                }}
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
            {showDescription && mobile && (
                <ShopMobileImageDescriptionPortal
                    open
                    anchorRef={imageAnchorRef}
                    onRequestClose={() => setShowDescription(false)}
                >
                    <p className="text-[11px] leading-relaxed text-slate-100">{refinedDescription}</p>
                </ShopMobileImageDescriptionPortal>
            )}
            {showDescription && !mobile && (
                <div className="absolute left-1/2 top-20 z-50 w-48 -translate-x-1/2 rounded-lg border border-indigo-400/50 bg-[#0b1220] p-2 shadow-xl">
                    <p className="text-[10px] leading-relaxed text-slate-100">{refinedDescription}</p>
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

const PackageDiamondVisual: React.FC<{
    dailyPerMail: number;
    durationDays: number;
    instantDiamonds: number;
    /** 3열 그리드·모바일 등 좁은 폭용 */
    compact?: boolean;
    /** 모바일 2열 패키지 등 초좁은 폭 */
    denseNested?: boolean;
}> = ({ dailyPerMail, durationDays, instantDiamonds, compact = false, denseNested = false }) => {
    const dn = Boolean(compact && denseNested);
    const gemClass = compact
        ? dn
            ? 'h-5 w-5 shrink-0'
            : 'h-6 w-6 min-[380px]:h-7 min-[380px]:w-7 sm:h-8 sm:w-8'
        : 'h-12 w-12 sm:h-14 sm:w-14';
    const underClass = compact
        ? dn
            ? 'text-[9px] font-bold tabular-nums'
            : 'text-[11px] font-bold min-[380px]:text-xs sm:text-sm'
        : 'text-base font-bold';
    const daysClass = compact
        ? dn
            ? 'text-xs font-bold tabular-nums tracking-tight text-violet-100/95'
            : 'text-base font-extrabold tracking-tight min-[380px]:text-lg sm:text-xl'
        : 'text-2xl font-extrabold tracking-tight sm:text-3xl';
    const plusClass = compact
        ? dn
            ? 'text-sm font-semibold text-slate-400/90'
            : 'text-base font-bold text-slate-400 min-[380px]:text-lg'
        : 'text-lg font-bold text-slate-400 sm:text-xl';
    const groupTitleClass = compact
        ? dn
            ? 'mb-0 w-full text-center text-[8px] font-semibold leading-none tracking-tight text-violet-200/90'
            : 'mb-0.5 w-full text-center text-[10px] font-semibold leading-tight text-violet-200/95 min-[380px]:text-[11px] sm:text-xs'
        : 'mb-1 w-full text-center text-[11px] font-medium leading-tight text-violet-200/90 sm:text-xs';
    const dailyGroupBoxClass = compact
        ? dn
            ? 'flex min-h-0 min-w-0 max-w-[56%] flex-[1] flex-col items-stretch rounded border border-cyan-500/20 bg-cyan-950/15 px-0.5 py-0.5'
            : 'flex min-h-0 min-w-0 max-w-[54%] flex-[1] flex-col items-stretch rounded-md border border-cyan-500/25 bg-cyan-950/20 px-0.5 py-1 min-[380px]:max-w-[52%]'
        : 'flex min-h-0 min-w-0 max-w-[48%] flex-[1] flex-col items-stretch rounded-lg border border-cyan-500/30 bg-cyan-950/25 px-2 py-2 sm:max-w-[46%]';
    const instantGroupBoxClass = compact
        ? dn
            ? 'flex max-w-[40%] flex-none flex-col items-center rounded border border-cyan-500/20 bg-cyan-950/15 px-0.5 py-0.5'
            : 'flex max-w-[44%] flex-none flex-col items-center rounded-md border border-cyan-500/25 bg-cyan-950/20 px-0.5 py-1 min-[380px]:max-w-[42%]'
        : 'flex max-w-[36%] flex-none flex-col items-center rounded-lg border border-cyan-500/30 bg-cyan-950/25 px-1.5 py-2 sm:max-w-[34%]';
    return (
        <div
            className={`flex w-full min-w-0 items-stretch justify-center ${
                !compact ? 'gap-2 py-1' : dn ? 'gap-0 py-0' : 'gap-0.5 py-0.5 sm:gap-1'
            }`}
        >
            <div className={dailyGroupBoxClass}>
                <p className={groupTitleClass}>매일 우편</p>
                <div
                    className={`flex min-h-0 min-w-0 flex-1 flex-row items-center justify-center ${
                        dn ? 'gap-0' : compact ? 'gap-0.5 sm:gap-1' : 'gap-1'
                    }`}
                >
                    <div className="flex min-w-0 flex-col items-center gap-0">
                        <img src={SHOP_DIAMOND_ICON} alt="" className={`${gemClass} shrink-0 object-contain drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]`} />
                        <span className={`tabular-nums text-cyan-200 ${underClass}`}>{dailyPerMail}</span>
                    </div>
                    <span className={`shrink-0 text-violet-100 drop-shadow-md ${daysClass}`}>× {durationDays}일</span>
                </div>
            </div>
            <span className={`flex shrink-0 items-center self-center ${plusClass}`}>+</span>
            <div className={instantGroupBoxClass}>
                <p className={groupTitleClass}>즉시지급</p>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0">
                    <img src={SHOP_DIAMOND_ICON} alt="" className={`${gemClass} shrink-0 object-contain drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]`} />
                    <span className={`min-w-0 truncate text-center tabular-nums text-cyan-200 ${underClass}`}>{instantDiamonds}</span>
                </div>
            </div>
        </div>
    );
};

const PackageBoxRowVisual: React.FC<{
    boxes: { imageSrc: string; quantity: number; alt: string; displayName: string }[];
    bonusLine?: string;
    equipmentBonusGradeWord?: '에픽' | '전설' | '신화';
    compact?: boolean;
    denseNested?: boolean;
}> = ({ boxes, bonusLine, equipmentBonusGradeWord, compact = false, denseNested = false }) => {
    const dn = Boolean(compact && denseNested);
    const imgClass = compact
        ? dn
            ? 'h-6 w-6 shrink-0'
            : 'h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10'
        : 'h-12 w-12 sm:h-14 sm:w-14';
    const boxDisplayNameClass = compact
        ? dn
            ? 'text-[7px] leading-none tracking-tight'
            : 'text-[9px] leading-none tracking-tight min-[380px]:text-[10px] sm:text-[11px]'
        : 'text-[10px] leading-none sm:text-xs';
    const gapClass = compact ? (dn ? 'gap-x-0.5 gap-y-0.5 py-0.5' : 'gap-x-1 gap-y-1 py-1 sm:gap-x-2') : 'gap-x-3 gap-y-1.5 py-1.5 sm:gap-x-5 sm:py-2';
    const padClass = compact ? (dn ? 'p-0' : 'p-0.5') : 'p-1';
    const plusClass = compact
        ? dn
            ? 'text-xs font-semibold text-slate-400/85'
            : 'text-base font-bold text-slate-400 min-[380px]:text-lg'
        : 'text-lg font-semibold text-slate-400/90 sm:text-xl';
    const boxGroupClass = compact
        ? dn
            ? 'flex min-h-0 min-w-0 max-w-[56%] flex-1 flex-col justify-center rounded border border-indigo-500/20 bg-indigo-950/15 px-0 py-0.5'
            : 'flex min-h-0 min-w-0 max-w-[54%] flex-1 flex-col justify-center rounded-md border border-indigo-500/25 bg-indigo-950/20 px-0.5 py-1 min-[380px]:max-w-[52%]'
        : 'flex min-h-0 min-w-0 max-w-[48%] flex-1 flex-col justify-center rounded-lg border border-indigo-500/30 bg-indigo-950/25 px-1.5 py-1.5 sm:max-w-[46%] sm:px-2 sm:py-2';
    const bonusGroupClass = compact
        ? dn
            ? 'flex min-w-0 max-w-[48%] shrink-0 flex-col items-center justify-center gap-0 rounded border border-emerald-500/25 bg-emerald-950/20 px-0.5 py-0.5'
            : 'flex min-w-0 max-w-[52%] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-emerald-500/30 bg-emerald-950/25 px-1 py-1 min-[380px]:max-w-[50%]'
        : 'flex min-w-[6rem] max-w-[46%] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-2 py-1.5 sm:min-w-[6.75rem] sm:max-w-[44%] sm:px-2.5 sm:py-2';
    const bonusEquipmentLineBaseClass = compact
        ? dn
            ? 'block text-center text-[8px] font-extrabold leading-[1.05] tracking-tight'
            : 'block text-center text-[10px] font-extrabold leading-[1.08] tracking-tight min-[380px]:text-[11px] sm:text-xs'
        : 'block text-center text-xs font-extrabold leading-[1.1] tracking-tight sm:text-sm';
    const qtyBadgeClass = compact
        ? dn
            ? 'rounded px-[1px] py-0 text-[6px] font-bold tabular-nums leading-none text-amber-50 shadow ring-1 ring-amber-400/45 bg-amber-950/95'
            : 'rounded px-0.5 py-px text-[8px] font-bold tabular-nums leading-none text-amber-50 shadow ring-1 ring-amber-400/45 bg-amber-950/95 min-[380px]:text-[9px]'
        : 'rounded px-0.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-amber-50 shadow ring-1 ring-amber-400/45 bg-amber-950/95 sm:text-[11px]';

    /** 장비 확정 지급 레이아웃은 좁은 카드에서도 두 상자가 세로로 줄바꿈되지 않도록 한 줄 유지 */
    const boxesFlexRowClass = equipmentBonusGradeWord ? 'flex-nowrap' : 'flex-wrap';
    const boxesGrid = (
        <div className={`flex ${boxesFlexRowClass} items-end justify-center ${gapClass}`}>
            {boxes.map((b, i) => (
                <div key={`${b.imageSrc}-${i}`} className={`flex shrink-0 flex-col items-center ${compact ? 'gap-0' : 'gap-0.5'}`}>
                    <div className={`relative rounded-md bg-gradient-to-br from-indigo-500/20 to-slate-900/60 shadow-[0_0_20px_-6px_rgba(129,140,248,0.5)] ring-1 ring-indigo-400/25 ${padClass}`}>
                        <span
                            className={`pointer-events-none absolute right-0 top-0 z-10 -translate-y-px translate-x-px ${qtyBadgeClass}`}
                            aria-label={`수량 ${b.quantity}`}
                        >
                            ×{b.quantity}
                        </span>
                        <img src={b.imageSrc} alt={b.alt} className={`${imgClass} object-contain`} />
                    </div>
                    <span className={`whitespace-nowrap text-center font-semibold text-violet-100/90 ${boxDisplayNameClass}`} title={b.displayName}>
                        {b.displayName}
                    </span>
                </div>
            ))}
        </div>
    );

    if (equipmentBonusGradeWord) {
        const gradeForStyle = SHOP_EQUIPMENT_PACKAGE_BONUS_GRADE[equipmentBonusGradeWord];
        const gradeColorClass = gradeStyles[gradeForStyle].color;
        return (
            <div
                className={`flex w-full min-w-0 items-stretch justify-center ${
                    !compact ? 'gap-1.5 py-1 sm:gap-2' : dn ? 'gap-0 py-0' : 'gap-0.5 py-0.5 sm:gap-1'
                }`}
            >
                <div className={boxGroupClass}>{boxesGrid}</div>
                <span className={`flex shrink-0 items-center self-center ${plusClass}`}>+</span>
                <div className={bonusGroupClass}>
                    <div className="flex flex-col items-center justify-center gap-0" role="text" aria-label={`${equipmentBonusGradeWord} 장비`}>
                        <span className={`${bonusEquipmentLineBaseClass} ${gradeColorClass}`}>{equipmentBonusGradeWord}</span>
                        <span className={`${bonusEquipmentLineBaseClass} text-emerald-100`}>장비</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-stretch gap-1">
            {boxesGrid}
            {bonusLine ? (
                <p
                    className={`text-center font-bold text-emerald-200/95 ${
                        compact
                            ? dn
                                ? 'rounded border border-emerald-500/25 bg-emerald-950/20 px-0.5 py-0 text-[8px] leading-tight text-emerald-100/95'
                                : 'rounded border border-emerald-500/30 bg-emerald-950/25 px-1 py-0.5 text-[10px] leading-tight sm:text-xs'
                            : 'text-xs text-emerald-100/90'
                    }`}
                >
                    {bonusLine}
                </p>
            ) : null}
        </div>
    );
};

const MiscShopCard: React.FC<{
    product: MiscShopProduct;
    mobile?: boolean;
    threeColumn?: boolean;
    currentUser: UserWithStatus;
    onBuyCashPackage: (packageId: string) => void;
    setToastMessage: (msg: string | null) => void;
}> = ({ product, mobile = false, threeColumn = false, currentUser, onBuyCashPackage, setToastMessage }) => {
    const visual = product.packageVisual;
    const compact = threeColumn;
    const denseNested = Boolean(compact && mobile);
    const now = Date.now();
    const isDiamondPkg = (CASH_SHOP_DIAMOND_PACKAGE_IDS as readonly string[]).includes(product.id);
    const isEquipmentPkg = (CASH_SHOP_EQUIPMENT_PACKAGE_IDS as readonly string[]).includes(product.id);
    const isRemoveAdsPkg = product.id === CASH_SHOP_REMOVE_ADS_PACKAGE_ID;
    const removeAdsOwned = Boolean(currentUser.removeAdsPurchased);
    const diamondActive = (currentUser.diamondPackageExpiresAt ?? 0) > now;
    const diamondBlocked = isDiamondPkg && diamondActive;
    let equipLimit = 0;
    let equipRemaining = 0;
    let equipBlocked = false;
    if (isEquipmentPkg) {
        equipLimit = EQUIPMENT_PACKAGE_MONTHLY_LIMIT[product.id as keyof typeof EQUIPMENT_PACKAGE_MONTHLY_LIMIT];
        const rec = currentUser.dailyShopPurchases?.[product.id];
        const usedThisMonth = rec && !isDifferentMonthKST(rec.date, now) ? rec.quantity : 0;
        equipRemaining = Math.max(0, equipLimit - usedThisMonth);
        equipBlocked = !currentUser.isAdmin && equipRemaining <= 0;
    }
    const removeAdsBlocked = isRemoveAdsPkg && removeAdsOwned;
    const purchaseDisabled = diamondBlocked || equipBlocked || removeAdsBlocked;
    const handleMiscCashBuy = () => {
        if (!currentUser.isAdmin) {
            setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE);
            return;
        }
        if (removeAdsBlocked) {
            setToastMessage('이미 광고 제거 상품을 보유 중입니다.');
            return;
        }
        if (diamondBlocked) {
            setToastMessage('진행 중인 다이아 패키지가 있을 때는 추가 구매할 수 없습니다.');
            return;
        }
        if (equipBlocked) {
            setToastMessage('이번 달 구매 한도에 도달했습니다.');
            return;
        }
        onBuyCashPackage(product.id);
    };
    const visualBoxFooterClass = compact
        ? denseNested
            ? 'mt-0.5 shrink-0 border-t border-white/10 pt-0.5 text-center text-[8px] leading-tight tracking-tight text-slate-400/95'
            : 'mt-1 shrink-0 border-t border-white/10 pt-1 text-center text-[9px] leading-tight tracking-tight text-slate-400/95 min-[380px]:text-[10px]'
        : 'mt-1.5 shrink-0 border-t border-white/10 pt-1.5 text-center text-[10px] leading-snug text-slate-400/95 sm:text-xs';
    /** 다이아·장비 패키지 비주얼 영역 높이 통일 */
    const packageVisualMinHClass = compact
        ? denseNested
            ? 'min-h-[5.75rem]'
            : 'min-h-[6.75rem]'
        : 'min-h-[9rem] sm:min-h-[9.25rem]';
    const pad = compact ? (mobile ? 'p-1.5' : 'p-2') : mobile ? 'p-3' : 'p-4';
    const titleClass = compact
        ? `line-clamp-2 min-h-0 w-full min-w-0 break-words text-center font-semibold leading-tight tracking-tight text-white/95 ${mobile ? 'text-[10px]' : 'text-xs sm:text-sm'}`
        : `line-clamp-2 min-h-0 w-full text-center font-semibold leading-snug tracking-tight text-white/95 ${mobile ? 'text-sm' : 'text-base sm:text-lg'}`;

    return (
        <div
            className={`flex h-full min-h-0 min-w-0 flex-col border border-violet-400/30 bg-gradient-to-br from-[#20173a]/95 via-[#131a2f]/95 to-[#090e1a]/95 ${
                denseNested
                    ? 'rounded-md shadow-[0_10px_28px_-18px_rgba(139,92,246,0.45)]'
                    : 'rounded-xl shadow-[0_18px_45px_-28px_rgba(139,92,246,0.7)]'
            } ${pad}`}
        >
            <div className={`flex shrink-0 items-start justify-between gap-1 ${compact ? 'mb-1 flex-col items-stretch' : 'mb-2 gap-2'}`}>
                <h3 className={titleClass} title={product.name}>
                    {product.name}
                </h3>
                {product.duration && !visual && (
                    <span className="shrink-0 self-center rounded-md bg-violet-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-violet-100">
                        {product.duration}
                    </span>
                )}
            </div>
            {visual?.type === 'diamond_combo' && (
                <div
                    className={`mb-1 flex min-h-0 w-full min-w-0 shrink-0 flex-col border border-cyan-400/20 bg-black/25 ${packageVisualMinHClass} ${
                        denseNested ? 'rounded border-cyan-400/15 px-0.5 py-0.5' : compact ? 'rounded-md px-1 py-1' : 'rounded-lg px-2 py-2'
                    }`}
                >
                    <div className="flex min-h-0 flex-1 items-center justify-center">
                        <PackageDiamondVisual
                            dailyPerMail={visual.dailyPerMail}
                            durationDays={visual.durationDays}
                            instantDiamonds={visual.instantDiamonds}
                            compact={compact}
                            denseNested={denseNested}
                        />
                    </div>
                    <p className={`${visualBoxFooterClass} text-cyan-100/80`}>다이아 패키지 I,II,III 중복구매 불가</p>
                </div>
            )}
            {visual?.type === 'box_row' && (
                <div
                    className={`mb-1 flex min-h-0 w-full min-w-0 shrink-0 flex-col border border-indigo-400/25 bg-black/25 ${packageVisualMinHClass} ${
                        denseNested ? 'rounded border-indigo-400/15 px-0 py-0.5' : compact ? 'rounded-md px-0.5 py-0.5' : 'rounded-lg px-2 py-1.5'
                    }`}
                >
                    <div className="flex min-h-0 flex-1 items-center justify-center">
                        <PackageBoxRowVisual
                            boxes={visual.boxes}
                            bonusLine={visual.bonusLine}
                            equipmentBonusGradeWord={visual.equipmentBonusGradeWord}
                            compact={compact}
                            denseNested={denseNested}
                        />
                    </div>
                    {isEquipmentPkg && equipLimit > 0 ? (
                        <p className={`${visualBoxFooterClass} font-medium tabular-nums text-violet-200/90`}>
                            구매제한 월({equipRemaining}/{equipLimit}회)
                        </p>
                    ) : null}
                </div>
            )}
            {visual?.type === 'remove_ads_image' && (
                <div
                    className={`mb-1 flex min-h-0 w-full min-w-0 shrink-0 flex-col border border-rose-500/30 bg-black/25 ${packageVisualMinHClass} ${
                        denseNested ? 'rounded border-rose-500/20 px-0.5 py-0.5' : compact ? 'rounded-md px-1 py-1' : 'rounded-lg px-2 py-2'
                    }`}
                >
                    <div className="flex min-h-0 flex-1 items-center justify-center">
                        <img
                            src={visual.imageSrc}
                            alt=""
                            className={
                                denseNested
                                    ? 'h-12 w-12 object-contain sm:h-14 sm:w-14'
                                    : compact
                                      ? 'h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]'
                                      : 'h-20 w-20 object-contain sm:h-24 sm:w-24'
                            }
                        />
                    </div>
                    <p className={`${visualBoxFooterClass} text-rose-100/85`}>계정당 1회 · 영구 적용</p>
                </div>
            )}
            {!visual && (
                <ul className={`mt-2 space-y-1 text-slate-200/90 ${mobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
                    {product.benefits.map((benefit, index) => (
                        <li key={`${product.id}-benefit-${index}`}>- {benefit}</li>
                    ))}
                </ul>
            )}
            {visual && (
                <ul className="sr-only" aria-label="포함 혜택">
                    {product.benefits.map((benefit, index) => (
                        <li key={`${product.id}-benefit-${index}`}>{benefit}</li>
                    ))}
                </ul>
            )}
            <div className="mt-auto shrink-0 pt-1.5">
                <Button
                    type="button"
                    disabled={purchaseDisabled}
                    disabledWithoutDim
                    colorScheme="none"
                    bare
                    onClick={handleMiscCashBuy}
                    className={`flex w-full flex-wrap items-center justify-center gap-x-1 gap-y-0 rounded-md border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 font-semibold tabular-nums text-slate-900 shadow-[0_8px_22px_-12px_rgba(251,191,36,0.75)] disabled:cursor-not-allowed disabled:opacity-45 sm:rounded-lg sm:shadow-[0_10px_28px_-14px_rgba(251,191,36,0.85)] ${
                        compact
                            ? denseNested
                                ? 'min-h-[2.1rem] px-1 py-1 text-[10px] leading-tight sm:min-h-[2.35rem] sm:text-xs'
                                : 'min-h-[2.35rem] px-1 py-1.5 text-xs leading-tight min-[380px]:text-sm sm:min-h-[2.5rem] sm:text-sm'
                            : 'min-h-[2.65rem] px-2 py-2 text-sm sm:min-h-[2.75rem] sm:text-base'
                    }`}
                >
                    {removeAdsBlocked ? '보유 중' : `${product.priceKRW.toLocaleString()}원`}
                </Button>
            </div>
        </div>
    );
};

const VipShopCard: React.FC<{
    product: MiscShopProduct;
    mobile?: boolean;
    currentUser: UserWithStatus;
    onBuyVip: (packageId: string, billing: 'one_time' | 'subscription') => void;
    onCancelVipSubscription: (packageId: string) => void;
    setToastMessage: (msg: string | null) => void;
}> = ({ product, mobile = false, currentUser, onBuyVip, onCancelVipSubscription, setToastMessage }) => {
    const durationDays =
        product.id in VIP_SHOP_DURATION_DAYS
            ? VIP_SHOP_DURATION_DAYS[product.id as keyof typeof VIP_SHOP_DURATION_DAYS]
            : 30;
    const vipProductId = product.id as (typeof VIP_SHOP_PRODUCT_IDS)[number];
    const isSubscribed = Boolean(
        (VIP_SHOP_PRODUCT_IDS as readonly string[]).includes(product.id) && currentUser.vipShopAutoRenew?.[vipProductId],
    );

    return (
        <div
            className={`flex h-full min-h-0 flex-col rounded-xl border border-yellow-300/40 bg-gradient-to-br from-[#36270d]/95 via-[#21160f]/95 to-[#0d111f]/95 shadow-[0_20px_48px_-28px_rgba(251,191,36,0.8)] ${
                mobile ? 'p-2' : 'p-4'
            }`}
        >
            <div className="mb-1.5 flex shrink-0 items-start justify-between gap-1.5">
                <h3 className={`${mobile ? 'text-xs font-bold' : 'text-base font-extrabold'} leading-tight text-amber-200`}>{product.name}</h3>
                {product.duration && (
                    <span className="shrink-0 rounded bg-amber-400/18 px-1.5 py-px text-[8px] font-semibold leading-tight text-amber-100/95 sm:text-[9px]">
                        {product.duration}
                    </span>
                )}
            </div>
            <ul
                className={`mt-1.5 min-h-0 flex-1 space-y-0.5 text-amber-50/88 ${mobile ? 'text-[10px] leading-snug' : 'text-xs sm:text-sm'}`}
            >
                {product.benefits.map((benefit, index) => (
                    <li key={`${product.id}-vip-benefit-${index}`}>- {benefit}</li>
                ))}
            </ul>
            {product.benefitFooter ? (
                <p
                    className={`mt-1.5 shrink-0 rounded border border-amber-300/22 bg-black/30 px-1.5 py-1 text-left leading-snug text-amber-50/95 ${
                        mobile ? 'text-[9px]' : 'text-[11px] sm:text-xs'
                    }`}
                >
                    {product.benefitFooter}
                </p>
            ) : null}
            <div
                className={`mt-1.5 shrink-0 rounded border border-amber-200/30 bg-black/25 px-1 py-1 text-center font-medium leading-none tracking-tight text-amber-100/90 ${
                    mobile ? 'text-[8px] whitespace-nowrap overflow-hidden text-ellipsis' : 'text-xs sm:text-sm py-1.5 px-2'
                }`}
                title="중복 구매 시 기간 연장"
            >
                중복 구매 시 기간 연장
            </div>
            {isSubscribed ? (
                <p
                    className={`mt-1.5 shrink-0 text-center font-semibold text-emerald-300/95 ${
                        mobile ? 'text-[9px]' : 'text-[10px] sm:text-xs'
                    }`}
                >
                    자동갱신 구독 중 · 만료 시 동일 요금으로 30일 연장
                </p>
            ) : null}
            <div className={`mt-auto flex shrink-0 flex-col ${mobile ? 'gap-1 pt-1.5' : 'gap-1.5 pt-2'}`}>
                <Button
                    type="button"
                    colorScheme="none"
                    bare
                    onClick={() => {
                        if (!currentUser.isAdmin) {
                            setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE);
                            return;
                        }
                        onBuyVip(product.id, 'one_time');
                    }}
                    className={`flex w-full flex-col items-center justify-center gap-0 rounded-md border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 px-1.5 font-semibold tabular-nums text-slate-900 shadow-[0_8px_22px_-12px_rgba(251,191,36,0.75)] sm:rounded-lg sm:shadow-[0_10px_28px_-14px_rgba(251,191,36,0.85)] ${
                        mobile ? 'min-h-[2.35rem] py-1.5 text-[10px] leading-tight sm:text-xs' : 'min-h-[2.65rem] py-2 text-xs sm:min-h-[2.75rem] sm:text-sm'
                    }`}
                >
                    <span className="min-w-0 text-center leading-tight">일회성 결제</span>
                    <span className="min-w-0 text-center text-[10px] font-bold tabular-nums opacity-95 sm:text-xs">
                        {product.priceKRW.toLocaleString()}원 · {durationDays}일
                    </span>
                </Button>
                <Button
                    type="button"
                    colorScheme="none"
                    bare
                    onClick={() => {
                        if (!currentUser.isAdmin) {
                            setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE);
                            return;
                        }
                        onBuyVip(product.id, 'subscription');
                    }}
                    className={`flex w-full flex-col items-center justify-center gap-0 rounded-md border border-violet-400/55 bg-gradient-to-r from-violet-600/92 via-indigo-600/90 to-violet-700/92 px-1.5 font-semibold text-amber-50 shadow-[0_8px_22px_-12px_rgba(139,92,246,0.55)] sm:rounded-lg ${
                        mobile ? 'min-h-[2.35rem] py-1.5 text-[9px] leading-tight sm:text-[10px]' : 'min-h-[2.65rem] py-2 text-[10px] sm:min-h-[2.75rem] sm:text-xs'
                    }`}
                >
                    <span className="text-center font-bold leading-tight">구독 (30일마다 자동결제)</span>
                    <span className="text-center text-[9px] font-medium leading-tight text-violet-100/90 sm:text-[10px]">
                        만료 시점에 등록 결제로 {product.priceKRW.toLocaleString()}원 청구 후 연장
                    </span>
                </Button>
                {isSubscribed ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (!currentUser.isAdmin) {
                                setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE);
                                return;
                            }
                            onCancelVipSubscription(product.id);
                            setToastMessage('VIP 자동갱신 구독을 해지했습니다.');
                        }}
                        className={`w-full rounded-md border border-amber-200/25 bg-black/20 py-1 text-center font-medium text-amber-200/90 underline-offset-2 hover:bg-black/35 hover:underline ${
                            mobile ? 'text-[9px]' : 'text-[10px] sm:text-xs'
                        }`}
                    >
                        구독 해지
                    </button>
                ) : null}
            </div>
        </div>
    );
};

const DiamondShopCard: React.FC<{
    product: { id: string; diamonds: number; priceKRW: number };
    mobile?: boolean;
    onCashPriceClick: () => void;
}> = ({ product, mobile = false, onCashPriceClick }) => {
    const countLabel = product.diamonds.toLocaleString();
    const segments = getCashDiamondShopSegments(product.diamonds);
    const segmentGemClass = mobile ? 'h-7 w-7 shrink-0' : 'h-9 w-9 shrink-0 sm:h-10 sm:w-10';
    const segmentNumClass = mobile
        ? 'text-[9px] font-bold tabular-nums text-cyan-200'
        : 'text-[10px] font-bold tabular-nums text-cyan-200 sm:text-xs';
    const segmentBoxSplitClass =
        'flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-lg border border-cyan-500/28 bg-cyan-950/22 px-0.5 py-1 shadow-[inset_0_0_12px_-8px_rgba(34,211,238,0.25)]';
    const segmentBoxSingleClass =
        'mx-auto flex min-h-0 w-[4.75rem] shrink-0 flex-col items-center justify-center gap-0 rounded-lg border border-cyan-500/28 bg-cyan-950/22 px-1 py-1 shadow-[inset_0_0_12px_-8px_rgba(34,211,238,0.25)] sm:w-[5.25rem] sm:py-1.5';
    return (
        <div
            className={`group relative flex h-full min-h-0 flex-col items-center overflow-hidden rounded-xl border border-indigo-400/35 bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 text-center shadow-[0_22px_55px_-30px_rgba(99,102,241,0.65)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-32px_rgba(129,140,248,0.65)] ${mobile ? 'p-2.5' : 'p-3'}`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent" />
            {segments ? (
                <div
                    className={`relative mx-auto mb-1.5 flex w-full min-w-0 shrink-0 items-stretch justify-center gap-0.5 ${mobile ? 'min-h-[3.25rem]' : 'min-h-[3.75rem] gap-1 sm:min-h-[4rem]'}`}
                    aria-hidden
                >
                    <div className={segmentBoxSplitClass}>
                        <img
                            src={SHOP_DIAMOND_ICON}
                            alt=""
                            className={`${segmentGemClass} object-contain drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]`}
                        />
                        <span className={segmentNumClass}>{segments[0].toLocaleString()}</span>
                    </div>
                    <span
                        className={`flex shrink-0 items-center self-center font-bold tabular-nums text-slate-400/95 ${
                            mobile ? 'px-0 text-[10px]' : 'px-0.5 text-xs sm:text-sm'
                        }`}
                    >
                        +
                    </span>
                    <div className={segmentBoxSplitClass}>
                        <img
                            src={SHOP_DIAMOND_ICON}
                            alt=""
                            className={`${segmentGemClass} object-contain drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]`}
                        />
                        <span className={segmentNumClass}>{segments[1].toLocaleString()}</span>
                    </div>
                </div>
            ) : (
                <div
                    className={`relative mx-auto mb-1.5 flex shrink-0 justify-center ${mobile ? 'min-h-[3.25rem]' : 'min-h-[3.75rem]'}`}
                    aria-hidden
                >
                    <div className={segmentBoxSingleClass}>
                        <img
                            src={SHOP_DIAMOND_ICON}
                            alt=""
                            className={`${segmentGemClass} object-contain drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]`}
                        />
                        <span className={segmentNumClass}>{product.diamonds.toLocaleString()}</span>
                    </div>
                </div>
            )}
            <h3
                className={`w-full min-w-0 shrink-0 px-0 text-center font-semibold tabular-nums tracking-tight text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.55)] ${
                    mobile
                        ? 'h-[1.1rem] whitespace-nowrap text-[10px] leading-[1.1rem]'
                        : 'min-h-[2.5rem] break-keep text-[11px] leading-snug sm:min-h-0 sm:text-sm'
                }`}
                title={`${countLabel}개`}
            >
                {countLabel}개
            </h3>
            <div className="mt-1.5 flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-1">
                <Button
                    type="button"
                    colorScheme="none"
                    bare
                    title={CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE}
                    onClick={onCashPriceClick}
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-400/55 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 px-2 py-1.5 text-center font-bold tabular-nums text-slate-900 shadow-[0_10px_28px_-14px_rgba(251,191,36,0.85)] transition-all duration-150 hover:from-amber-300 hover:to-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                        mobile ? 'h-[2.95rem] min-h-[2.95rem] max-h-[2.95rem] text-[11px]' : 'min-h-[3.5rem] py-2 text-xs sm:text-sm'
                    }`}
                >
                    {product.priceKRW.toLocaleString()}원
                </Button>
            </div>
        </div>
    );
};

const ShopModal: React.FC<ShopModalProps> = ({ currentUser: propCurrentUser, onClose, onAction, isTopmost, initialTab }) => {
    const { currentUserWithStatus } = useAppContext();
    const { showShopAdRewardInterstitial } = useAdContext();
    const { isNativeMobile } = useNativeMobileShell();
    const mobileShop = Boolean(isNativeMobile);
    /** KST 자정마다 리렌더 → 광고 남은 횟수 등 `isSameDayKST(..., Date.now())` 표시 갱신 */
    const kstCalendarDay = useKSTCalendarDayTick();
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
        ? 'grid grid-cols-2 gap-1.5 min-[390px]:grid-cols-3 min-[390px]:gap-2 items-stretch [&>*]:min-h-0'
        : 'grid grid-cols-4 gap-3 items-stretch [&>*]:min-h-0';
    const materialItems = [
        { itemId: "material_box_1", name: "재료 상자 I", description: "하급~상급강화석 5개", price: { gold: 500 }, image: "/images/Box/ResourceBox1.webp", type: 'material' as const },
        { itemId: "material_box_2", name: "재료 상자 II", description: "하급~상급강화석 5개", price: { gold: 1000 }, image: "/images/Box/ResourceBox2.webp", type: 'material' as const },
        { itemId: "material_box_3", name: "재료 상자 III", description: "하급~상급강화석 5개", price: { gold: 3000 }, image: "/images/Box/ResourceBox3.webp", type: 'material' as const },
        { itemId: "material_box_4", name: "재료 상자 IV", description: "중급~최상급강화석 5개", price: { gold: 5000 }, image: "/images/Box/ResourceBox4.webp", type: 'material' as const },
        { itemId: "material_box_5", name: "재료 상자 V", description: "상급~신비의강화석 5개", price: { gold: 10000 }, image: "/images/Box/ResourceBox5.webp", type: 'material' as const },
        { itemId: "material_box_6", name: "재료 상자 VI", description: "상급~신비의강화석 5개", price: { diamonds: 100 }, image: "/images/Box/ResourceBox6.webp", type: 'material' as const },
        {
            itemId: 'equipment_unbind_ticket',
            name: '귀속 해제권',
            description: '귀속된 장비를 거래가능 상태로 변경. 사용처 : [가방]-[장비선택]-[귀속해제].',
            price: { diamonds: 50 },
            image: '/images/use/belong.webp',
            dailyLimit: 10,
            type: 'material' as const,
        },
        {
            itemId: 'refinement_charm',
            name: '제련의 부적',
            description: '제련이 불가능한 장비의 제련가능 횟수를 1추가. 사용처 : [대장간]-[장비제련] 제련불가 장비 선택.',
            price: { diamonds: 100 },
            image: '/images/use/refine.webp',
            dailyLimit: 1,
            type: 'material' as const,
        },
        { itemId: 'option_type_change_ticket', name: "옵션 종류 변경권", description: "장비의 주옵션, 부옵션, 특수옵션 중 하나를 다른 종류로 변경", price: { gold: 2000 }, image: "/images/use/change1.webp", dailyLimit: 3, type: 'material' as const },
        { itemId: 'option_value_change_ticket', name: "옵션 수치 변경권", description: "장비의 부옵션 또는 특수옵션 중 하나의 수치를 변경", price: { gold: 500 }, image: "/images/use/change2.webp", dailyLimit: 10, type: 'material' as const },
        { itemId: 'mythic_option_change_ticket', name: "스페셜 옵션 변경권", description: "신화 또는 초월 장비의 스페셜 옵션을 다른 스페셜 옵션으로 변경", price: { gold: 500 }, image: "/images/use/change3.webp", dailyLimit: 10, type: 'material' as const },
    ];
    const vipProducts: MiscShopProduct[] = [
        {
            id: 'reward_vip',
            name: '보상 VIP',
            duration: '30일 적용',
            priceKRW: 9900,
            benefits: [
                'VIP 보상슬롯 활성화',
                '전략바둑 승리 보상 2배',
                '페어바둑 승리 보상 2배',
                '놀이바둑 승리 보상 2배',
                '길드 코인 보상 2배',
                '일일/주간/월간 퀘스트 보상2배',
                '퀘스트 활약도 보상2배',
                '모험 보물상자 2개오픈',
            ],
            benefitFooter: 'VIP보상슬롯 : 골드/장비상자/재료상자/전설장비 중 1개 획득',
        },
        {
            id: 'function_vip',
            name: '기능 VIP',
            duration: '30일 적용',
            priceKRW: 9900,
            benefits: [
                '행동력 최대치 +20',
                '행동력 회복 속도 50% 증가',
                '행동력 회복제 III 매일 지급',
                '대장간 경험치 획득 +50%',
                '장비 강화 성공확률 +10%',
                '장비 합성 대성공 확률 +10%',
                '장비 분해 대박 확률 +10%',
                '재료 분해/합성 대박 확률 +10%',
                '거래소 물품등록 가능(3개)',
                '펫 VIP수련슬롯 개방',
                '펫 VIP부화슬롯 개방',
                '챔피언십 경기 SKIP 기능',
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
            packageVisual: { type: 'diamond_combo', dailyPerMail: 50, durationDays: 7, instantDiamonds: 100 },
        },
        {
            id: 'diamond_package_2',
            name: '다이아 패키지 II',
            duration: '15일 적용',
            priceKRW: 7900,
            benefits: ['매일 우편으로 50다이아 지급 (총 750다이아)', '즉시 250다이아 지급'],
            packageVisual: { type: 'diamond_combo', dailyPerMail: 50, durationDays: 15, instantDiamonds: 250 },
        },
        {
            id: 'diamond_package_3',
            name: '다이아 패키지 III',
            duration: '30일 적용',
            priceKRW: 12900,
            benefits: ['매일 우편으로 50다이아 지급 (총 1500다이아)', '즉시 750다이아 지급'],
            packageVisual: { type: 'diamond_combo', dailyPerMail: 50, durationDays: 30, instantDiamonds: 750 },
        },
        {
            id: 'equipment_package_1',
            name: '장비상자 패키지 I',
            priceKRW: 2900,
            benefits: ['장비상자 V 1개', '재료상자 VI 1개', '+ "에픽 장비" 확정지급'],
            packageVisual: {
                type: 'box_row',
                equipmentBonusGradeWord: '에픽',
                boxes: [
                    {
                        imageSrc: '/images/Box/EquipmentBox5.webp',
                        quantity: 1,
                        alt: '장비 상자 V',
                        displayName: '장비 상자 V',
                    },
                    {
                        imageSrc: '/images/Box/ResourceBox6.webp',
                        quantity: 1,
                        alt: '재료 상자 VI',
                        displayName: '재료 상자 VI',
                    },
                ],
            },
        },
        {
            id: 'equipment_package_2',
            name: '장비상자 패키지 II',
            priceKRW: 4900,
            benefits: ['장비상자 V 2개', '재료상자 VI 2개', '+ "전설 장비" 확정지급'],
            packageVisual: {
                type: 'box_row',
                equipmentBonusGradeWord: '전설',
                boxes: [
                    {
                        imageSrc: '/images/Box/EquipmentBox5.webp',
                        quantity: 2,
                        alt: '장비 상자 V',
                        displayName: '장비 상자 V',
                    },
                    {
                        imageSrc: '/images/Box/ResourceBox6.webp',
                        quantity: 2,
                        alt: '재료 상자 VI',
                        displayName: '재료 상자 VI',
                    },
                ],
            },
        },
        {
            id: 'equipment_package_3',
            name: '장비상자 패키지 III',
            priceKRW: 7900,
            benefits: ['장비상자 VI 2개', '재료상자 VI 5개', '+ "신화 장비" 확정지급'],
            packageVisual: {
                type: 'box_row',
                equipmentBonusGradeWord: '신화',
                boxes: [
                    {
                        imageSrc: '/images/Box/EquipmentBox6.webp',
                        quantity: 2,
                        alt: '장비 상자 VI',
                        displayName: '장비 상자 VI',
                    },
                    {
                        imageSrc: '/images/Box/ResourceBox6.webp',
                        quantity: 5,
                        alt: '재료 상자 VI',
                        displayName: '재료 상자 VI',
                    },
                ],
            },
        },
        {
            id: CASH_SHOP_REMOVE_ADS_PACKAGE_ID,
            name: '광고 제거',
            priceKRW: 9900,
            benefits: [
                '로비·대국 등 게임 내 배너·전면 광고 비표시',
                '상점 보상형 광고 없이 동일 보상 수령(일일 한도 유지)',
            ],
            packageVisual: { type: 'remove_ads_image', imageSrc: '/images/shop/remove_ads_package.svg' },
        },
    ];
    const diamondProducts = [
        { id: 'diamond_50', diamonds: 50, priceKRW: 1900 },
        { id: 'diamond_200', diamonds: 200, priceKRW: 5900 },
        { id: 'diamond_500', diamonds: 500, priceKRW: 12900 },
        { id: 'diamond_1000', diamonds: 1000, priceKRW: 19900 },
        { id: 'diamond_2000', diamonds: 2000, priceKRW: 29900 },
    ] as const;

    const handleClaimShopAdReward = (tab: ShopAdRewardTab) => {
        const remaining = getShopAdRemainingForTab(currentUser, tab, Date.now());
        if (remaining <= 0) {
            setToastMessage('오늘 이 탭 광고 보상 수령이 모두 완료되었습니다.');
            return;
        }
        showShopAdRewardInterstitial(() => {
            onAction({ type: 'CLAIM_SHOP_AD_REWARD', payload: { tab } });
        });
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
        } else if (
            itemId === 'option_type_change_ticket' ||
            itemId === 'option_value_change_ticket' ||
            itemId === 'mythic_option_change_ticket' ||
            itemId === 'equipment_unbind_ticket' ||
            itemId === 'refinement_charm' ||
            itemId === 'action_point_10' ||
            itemId === 'action_point_20' ||
            itemId === 'action_point_30'
        ) {
            // 변경권·행동력 회복제 구매
            onAction({ type: 'BUY_CONSUMABLE', payload: { itemId, quantity } });
        } else {
            const actionType = item.type === 'equipment' ? 'BUY_SHOP_ITEM' : 'BUY_MATERIAL_BOX';
            onAction({ type: actionType, payload: { itemId, quantity } });
        }
        // 컨디션 회복제는 서버 검증(골드·일일한도·인벤) 후에만 성공이며, 실패해도 이전에는 여기서 먼저 "구매 완료"가 떠 오해가 생겼음.
        if (!itemId.startsWith('condition_potion_')) {
            setToastMessage('구매 완료! 가방을 확인하세요.');
        }
        setPurchasingItem(null);
    };
    
    const handleBuyActionPoints = () => {
        onAction({ type: 'PURCHASE_ACTION_POINTS' });
        setToastMessage('행동력 구매 완료!');
    };

    const handleBuyCashPackage = (packageId: string) => {
        if (!currentUser.isAdmin) {
            setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE);
            return;
        }
        const now = Date.now();
        if ((CASH_SHOP_DIAMOND_PACKAGE_IDS as readonly string[]).includes(packageId)) {
            if (!currentUser.isAdmin && (currentUser.diamondPackageExpiresAt ?? 0) > now) {
                setToastMessage('진행 중인 다이아 패키지가 있을 때는 추가 구매할 수 없습니다.');
                return;
            }
        } else if ((CASH_SHOP_EQUIPMENT_PACKAGE_IDS as readonly string[]).includes(packageId)) {
            const limit = EQUIPMENT_PACKAGE_MONTHLY_LIMIT[packageId as keyof typeof EQUIPMENT_PACKAGE_MONTHLY_LIMIT];
            const rec = currentUser.dailyShopPurchases?.[packageId];
            const qty = rec && !isDifferentMonthKST(rec.date, now) ? rec.quantity : 0;
            if (!currentUser.isAdmin && qty >= limit) {
                setToastMessage('이번 달 구매 한도에 도달했습니다.');
                return;
            }
        }
        onAction({ type: 'BUY_CASH_PACKAGE', payload: { packageId } });
    };

    const handleBuyVipPackage = (packageId: string, billing: 'one_time' | 'subscription' = 'one_time') => {
        if (!currentUser.isAdmin) {
            setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE);
            return;
        }
        onAction({ type: 'BUY_VIP_PACKAGE', payload: { packageId, billing } });
    };

    const handleCancelVipSubscription = (packageId: string) => {
        if (!currentUser.isAdmin) {
            setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE);
            return;
        }
        onAction({ type: 'CANCEL_VIP_SHOP_AUTO_RENEW', payload: { packageId } });
    };

    const renderContent = () => {
        const equipmentItems = [
            { itemId: 'equipment_box_1', name: "장비 상자 I", description: "일반~희귀 등급 장비", price: { gold: 500 }, image: "/images/Box/EquipmentBox1.webp", type: 'equipment' as const },
            { itemId: 'equipment_box_2', name: "장비 상자 II", description: "일반~에픽 등급 장비", price: { gold: 1500 }, image: "/images/Box/EquipmentBox2.webp", type: 'equipment' as const },
            { itemId: 'equipment_box_3', name: "장비 상자 III", description: "고급~전설 등급 장비", price: { gold: 5000 }, image: "/images/Box/EquipmentBox3.webp", type: 'equipment' as const },
            { itemId: 'equipment_box_4', name: "장비 상자 IV", description: "희귀~신화 등급 장비", price: { gold: 10000 }, image: "/images/Box/EquipmentBox4.webp", type: 'equipment' as const },
            { itemId: 'equipment_box_5', name: "장비 상자 V", description: "에픽~신화 등급 장비", price: { diamonds: 100 }, image: "/images/Box/EquipmentBox5.webp", type: 'equipment' as const },
            { itemId: 'equipment_box_6', name: "장비 상자 VI", description: "전설~신화 등급 장비", price: { diamonds: 500 }, image: "/images/Box/EquipmentBox6.webp", type: 'equipment' as const },
        ];

        switch (activeTab) {
            case 'equipment':
                return (
                    <div className={gridClassName}>
                        <ShopAdRewardCard
                            tab="equipment"
                            rewardDescription="장비 상자 II를 1회 연 것과 동일한 규칙으로 장비 1개가 지급됩니다. 일반~에픽 등급 장비입니다."
                            claimableRemaining={getShopAdRemainingForTab(currentUser, 'equipment', Date.now())}
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
                            rewardDescription="재료 상자 II를 1회 연 것과 동일한 규칙으로 강화석 5개가 지급됩니다. 하급~상급 강화석이 포함됩니다."
                            claimableRemaining={getShopAdRemainingForTab(currentUser, 'materials', Date.now())}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                        />
                        {materialItems.map(item => <ShopItemCard key={item.itemId} item={item} onBuy={handleInitiatePurchase} currentUser={currentUser} mobile={mobileShop} />)}
                    </div>
                );
            case 'diamonds':
                return (
                    <div className={gridClassName}>
                        <ShopAdRewardCard
                            tab="diamonds"
                            rewardDescription="다이아몬드 10개가 지급됩니다. 서버 보상 설정에 따라 추가 보너스가 더해질 수 있습니다."
                            claimableRemaining={getShopAdRemainingForTab(currentUser, 'diamonds', Date.now())}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                        />
                        {diamondProducts.map(product => (
                            <DiamondShopCard
                                key={product.id}
                                product={product}
                                mobile={mobileShop}
                                onCashPriceClick={() => setToastMessage(CASH_PURCHASE_NOT_IMPLEMENTED_MESSAGE)}
                            />
                        ))}
                    </div>
                );
            case 'misc':
                return (
                    <div
                        className={`grid min-w-0 items-stretch [&>*]:min-h-0 [&>*]:min-w-0 ${
                            mobileShop ? 'grid-cols-2 gap-1.5' : 'grid-cols-3 gap-1.5 min-[380px]:gap-2 sm:gap-2.5'
                        }`}
                    >
                        {miscProducts.map(product => (
                            <MiscShopCard
                                key={product.id}
                                product={product}
                                mobile={mobileShop}
                                threeColumn
                                currentUser={currentUser}
                                onBuyCashPackage={handleBuyCashPackage}
                                setToastMessage={setToastMessage}
                            />
                        ))}
                    </div>
                );
            case 'vip':
                return (
                    <div
                        className={`grid items-stretch [&>*]:min-h-0 [&>*]:min-w-0 ${
                            mobileShop ? 'grid-cols-2 gap-1.5' : 'grid-cols-3 gap-2 sm:gap-3'
                        }`}
                    >
                        {vipProducts.map(product => (
                            <VipShopCard
                                key={product.id}
                                product={product}
                                mobile={mobileShop}
                                currentUser={currentUser}
                                onBuyVip={handleBuyVipPackage}
                                onCancelVipSubscription={handleCancelVipSubscription}
                                setToastMessage={setToastMessage}
                            />
                        ))}
                    </div>
                );
            case 'consumables':
            default: {
                const baseConsumableItems = [
                    { itemId: 'condition_potion_small', name: "컨디션회복제(소)", description: "긴장감을 완화시켜주는 컨디션 회복제", price: { gold: 100 }, image: "/images/use/con1.webp", dailyLimit: 3, type: 'consumable' as const },
                    { itemId: 'condition_potion_medium', name: "컨디션회복제(중)", description: "머리가 맑아지는 느낌의 컨디션 회복제", price: { gold: 150 }, image: "/images/use/con2.webp", dailyLimit: 3, type: 'consumable' as const },
                    { itemId: 'condition_potion_large', name: "컨디션회복제(대)", description: "오늘의 대회를 성공적으로 치를 것 같은 컨디션 회복제", price: { gold: 200 }, image: "/images/use/con3.webp", dailyLimit: 3, type: 'consumable' as const },
                ];
                // 행동력 회복제: 품목별 일일 1개, 고정 골드가 (ShopItemCard)
                const ACTION_POINT_ITEMS = [
                    { itemId: 'action_point_10' as const, name: '행동력 회복제(+10)', description: '뭔가 하고싶은 의욕이 생긴다.', dailyLimit: 1, prices: [1000], badge: '+10' },
                    { itemId: 'action_point_20' as const, name: '행동력 회복제(+20)', description: '뭔가 해야 할 것 같다.', dailyLimit: 1, prices: [1500], badge: '+20' },
                    { itemId: 'action_point_30' as const, name: '행동력 회복제(+30)', description: '바로 경기를 하러 가자.', dailyLimit: 1, prices: [2000], badge: '+30' },
                ];
                const actionPointShopItems = ACTION_POINT_ITEMS.map(({ itemId, name, description, dailyLimit, prices, badge }) => {
                    const purchaseRecord = currentUser.dailyShopPurchases?.[itemId];
                    const prDate = shopPurchaseRecordDateMs(purchaseRecord?.date);
                    const purchasesToday =
                        purchaseRecord && prDate > 0 && isSameDayKST(prDate, Date.now()) ? purchaseRecord.quantity : 0;
                    const nextPriceIndex = Math.min(purchasesToday, prices.length - 1);
                    const nextPrice = prices[nextPriceIndex] ?? prices[prices.length - 1];
                    return {
                        itemId,
                        name,
                        description,
                        price: { gold: nextPrice },
                        image: '/images/icon/lightning.webp',
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
                            rewardDescription="행동력 회복제(+10) 1개가 지급됩니다."
                            claimableRemaining={getShopAdRemainingForTab(currentUser, 'consumables', Date.now())}
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
                    data-kst-calendar-day={kstCalendarDay}
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
