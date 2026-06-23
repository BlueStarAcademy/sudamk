
import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import type { PurchaseConsentTarget } from './legal/PurchaseConsentModal.js';
const PurchaseConsentModal = lazy(() => import('./legal/PurchaseConsentModal.js'));
import { UserWithStatus, ServerAction, InventoryItemType } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { gradeStyles } from '../shared/constants/items.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { ACTION_POINT_PURCHASE_COSTS_DIAMONDS, MAX_ACTION_POINT_PURCHASES_PER_DAY, ACTION_POINT_PURCHASE_REFILL_AMOUNT } from '../constants';
import { useKeyedAsyncAction } from '../hooks/useAsyncAction.js';
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
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import { useAdContext } from './ads/AdProvider.js';
import {
    formatShopItemDescription as formatDescription,
    StandardEquipmentBoxShopDescription,
} from './shopImageDescriptionPopover.js';
import { useTranslation } from 'react-i18next';
import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';
import i18n from '../shared/i18n/config.js';
import { useLocalizedShopItem } from '../shared/i18n/shopItemText.js';

const shopT = (key: string, opts?: Record<string, unknown>) => i18n.t(`shop:${key}`, opts);

interface ShopModalProps {
    currentUser?: UserWithStatus; // Optional: useAppContext에서 가져올 수 있도록
    onClose: () => void;
    onAction: (action: ServerAction) => Promise<unknown> | unknown;
    isTopmost?: boolean;
    initialTab?: ShopTab | 'misc';
    embedded?: boolean;
}

type ShopTab = 'equipment' | 'materials' | 'consumables' | 'diamonds' | 'vip';

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
          equipmentBonusGradeWord?: 'epic' | 'legendary' | 'mythic';
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
    if (total === 1250) return [1000, 250] as const;
    if (total === 2250) return [1500, 750] as const;
    return null;
}

/** 장비상자 패키지 보너스 등급 단어 → `gradeStyles`용 enum (실제 장비 등급 색상과 동일) */
const SHOP_EQUIPMENT_PACKAGE_BONUS_GRADE: Record<'epic' | 'legendary' | 'mythic', ItemGrade> = {
    epic: ItemGrade.Epic,
    legendary: ItemGrade.Legendary,
    mythic: ItemGrade.Mythic,
};

/** 원화(현금) 결제 미연동 — 일반 유저 차단, 관리자만 `BUY_CASH_PACKAGE`·`BUY_VIP_PACKAGE`·`CANCEL_VIP_SHOP_AUTO_RENEW` 허용 */


type ShopAdRewardTab = 'equipment' | 'materials' | 'consumables' | 'diamonds';

/** 서버 `CLAIM_SHOP_AD_REWARD`와 동일 — 탭별 일 3회 */
const SHOP_AD_TAB_DAILY_LIMIT = 3;

/** 장비·다이아 탭 — 일반 상품과 패키지 상품 구분 */
const ShopPackageSectionDivider: React.FC<{ label: string; mobile?: boolean }> = ({ label, mobile = false }) => (
    <div
        role="separator"
        aria-label={label}
        className={`flex w-full min-w-0 items-center gap-2 ${mobile ? 'my-2' : 'my-3'}`}
    >
        <div className="h-px min-w-0 flex-1 bg-gradient-to-r from-transparent via-violet-400/35 to-violet-400/10" />
        <span
            className={`shrink-0 rounded-full border border-violet-400/30 bg-violet-950/45 px-2 py-0.5 font-semibold text-violet-100/90 ${
                mobile ? 'text-[10px]' : 'text-xs'
            }`}
        >
            {label}
        </span>
        <div className="h-px min-w-0 flex-1 bg-gradient-to-l from-transparent via-violet-400/35 to-violet-400/10" />
    </div>
);

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

const ActionPointCard: React.FC<{ currentUser: UserWithStatus, onBuy: () => void; isPurchasePending?: boolean }> = ({ currentUser, onBuy, isPurchasePending = false }) => {
    const { t } = useTranslation(['shop', 'common']);
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
            alert(t('shop:actionPoint.insufficientDiamonds'));
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
            <h3 className="text-xl font-bold tracking-wide text-white drop-shadow-lg">{t('shop:actionPoint.title')}</h3>
            <p className="text-sm text-slate-200/85 mt-2 leading-relaxed flex-grow">
                {t('shop:actionPoint.subtitle')}
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2 w-full">
                <Button
                    onClick={handlePurchase}
                    disabled={!canPurchase || isPurchasePending}
                    colorScheme="none"
                    bare
                    className="flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-cyan-400/60 bg-gradient-to-r from-cyan-400/90 via-sky-400/90 to-blue-500/90 px-3 py-2 text-center font-semibold tracking-wide text-slate-900 shadow-[0_10px_30px_-12px_rgba(14,165,233,0.65)] transition-all duration-150 hover:from-cyan-300 hover:to-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
                        {isPurchasePending ? (
                            <span className="text-sm font-semibold">{t('shop:actionPoint.purchasing')}</span>
                        ) : (
                            <>
                        <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
                            <img src="/images/icon/Zem.webp" alt={t('common:resources.diamonds')} className="h-5 w-5 shrink-0 drop-shadow-md" />
                            <span className="tabular-nums">{cost.toLocaleString()}</span>
                        </div>
                        <span className="px-1 text-center text-[10px] leading-tight text-slate-800/95 tracking-wide">
                            {t('shop:actionPoint.todayPurchases', { current: purchasesToday, max: MAX_ACTION_POINT_PURCHASES_PER_DAY })}
                        </span>
                            </>
                        )}
                    </div>
                </Button>
                {!canPurchase && (
                    <span className="text-xs text-cyan-100/80 italic mt-1">{t('shop:actionPoint.dailyLimitReached')}</span>
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
    isClaimPending?: boolean;
}> = ({ tab, rewardDescription, claimableRemaining, onClaim, mobile = false, isClaimPending = false }) => {
    const { t } = useTranslation('shop');
    const { isAdFree } = useAdContext();
    const exhausted = claimableRemaining <= 0;
    const refinedDescription = formatDescription(rewardDescription);

    return (
        <div
            className={`group relative flex h-full min-h-0 flex-col items-center overflow-hidden rounded-xl border border-indigo-400/35 bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 text-center shadow-[0_22px_55px_-30px_rgba(99,102,241,0.65)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-32px_rgba(129,140,248,0.65)] ${mobile ? 'p-2.5' : 'p-3'}`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent" />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-20 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_65%)]" />
            <div
                className="relative mb-1.5 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)]"
            >
                {isAdFree ? (
                    <img
                        src="/images/shop/remove_ads_package.svg"
                        alt=""
                        className="h-14 w-14 object-contain drop-shadow-[0_6px_12px_rgba(220,38,38,0.35)]"
                    />
                ) : (
                    <span className="text-3xl drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)]" role="img" aria-label={t('adReward.aria')}>
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
                title={t('adReward.title')}
            >
                {t('adReward.title')}
            </h3>
            <div
                className={`mt-1 flex w-full flex-1 items-start justify-center px-0.5 ${mobile ? 'min-h-[2rem]' : 'min-h-[2.5rem]'}`}
            >
                <p
                    className={`w-full text-center leading-snug text-slate-300/90 line-clamp-2 ${mobile ? 'text-[10px]' : 'text-xs sm:text-sm'}`}
                >
                    {refinedDescription}
                </p>
            </div>
            <div className="mt-1.5 flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-1">
                <Button
                    onClick={() => onClaim(tab)}
                    disabled={exhausted || isClaimPending}
                    colorScheme="none"
                    bare
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-300/45 bg-gradient-to-r from-emerald-400/90 to-cyan-500/90 px-2 py-1.5 text-center font-semibold leading-tight text-slate-900 transition-colors hover:from-emerald-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${mobile ? 'h-[2.95rem] min-h-[2.95rem] max-h-[2.95rem] text-sm' : 'min-h-[3.5rem] py-2 text-sm sm:text-base'}`}
                >
                    <span className="flex flex-wrap items-center justify-center gap-x-1">
                        <span className="font-bold">
                            {isClaimPending ? t('adReward.claiming') : exhausted ? t('adReward.exhausted') : isAdFree ? t('adReward.freeReward') : t('adReward.watchAd')}
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
    isShopBusy?: boolean;
}> = ({ item, onBuy, currentUser, mobile = false, isShopBusy = false }) => {
    const { t } = useTranslation(['shop', 'common']);
    const { name, description, price, image, dailyLimit, weeklyLimit, badge } = item;
    const isGold = !!price.gold;
    const priceAmount = price.gold || price.diamonds || 0;
    const PriceIcon = isGold ? (
        <img src="/images/icon/Gold.webp" alt={t('common:resources.gold')} className="h-5 w-5 shrink-0 drop-shadow-md sm:h-6 sm:w-6" />
    ) : (
        <img src="/images/icon/Zem.webp" alt={t('common:resources.diamonds')} className="h-5 w-5 shrink-0 drop-shadow-md sm:h-6 sm:w-6" />
    );
    const refinedDescription = formatDescription(description);
    const subtitleTextClass = mobile ? 'text-[10px] leading-snug' : 'text-xs sm:text-sm leading-snug';

    const now = Date.now();
    const purchaseRecord = currentUser.dailyShopPurchases?.[item.itemId];
    
    let purchasesThisPeriod = 0;
    let limit = 0;
    let limitPeriodKey: 'weekly' | 'daily' | null = null;

    if (weeklyLimit) {
        purchasesThisPeriod = (purchaseRecord && !isDifferentWeekKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        limit = weeklyLimit;
        limitPeriodKey = 'weekly';
    } else if (dailyLimit) {
        purchasesThisPeriod = (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        limit = dailyLimit;
        limitPeriodKey = 'daily';
    }
    
    const remaining = limit > 0 ? limit - purchasesThisPeriod : (item.type === 'equipment' ? 100 : undefined);

    const handleBuyClick = () => {
        onBuy({ ...item, limit: remaining });
    };

    return (
        <div className={`group relative flex h-full min-h-0 flex-col items-center overflow-hidden rounded-xl border border-indigo-400/35 bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 text-center shadow-[0_22px_55px_-30px_rgba(99,102,241,0.65)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-32px_rgba(129,140,248,0.65)] ${mobile ? 'p-2.5' : 'p-3'}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent pointer-events-none" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_65%)] pointer-events-none" />
            <div
                className="relative mb-1.5 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)]"
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
            <div
                className={`mt-1 flex w-full flex-1 items-start justify-center px-0.5 ${mobile ? 'min-h-[2rem]' : 'min-h-[2.5rem]'}`}
            >
                <StandardEquipmentBoxShopDescription
                    itemId={item.itemId}
                    textClassName={`text-center ${subtitleTextClass}`}
                    fallback={
                        <p className={`w-full text-center text-slate-300/90 line-clamp-2 ${subtitleTextClass}`}>
                            {refinedDescription}
                        </p>
                    }
                />
            </div>
            <div className="mt-1.5 flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-1">
                <Button
                    onClick={handleBuyClick}
                    disabled={remaining === 0 || isShopBusy}
                    colorScheme="none"
                    bare
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-center font-semibold leading-tight transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60 ${mobile ? 'h-[2.95rem] min-h-[2.95rem] max-h-[2.95rem] py-1' : 'min-h-[3.5rem] py-2'} ${
                        isGold
                            ? 'border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500'
                            : 'border-sky-400/50 bg-gradient-to-r from-sky-400/90 via-blue-500/90 to-indigo-500/90 text-white shadow-[0_12px_32px_-18px_rgba(56,189,248,0.85)] hover:from-sky-300 hover:to-indigo-500'
                    }`}
                >
                    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
                        <div className={`flex min-w-0 items-center justify-center gap-1.5 font-semibold tracking-tight ${mobile ? 'text-sm' : 'text-sm sm:text-base'}`}>
                            {PriceIcon}
                            <span className="min-w-0 tabular-nums">{priceAmount.toLocaleString()}</span>
                        </div>
                        {limit > 0 && (
                            <span
                                className={`max-w-full px-0 text-center leading-tight ${mobile ? 'text-[10px]' : 'text-[10px] sm:text-xs'} ${isGold ? 'text-slate-800/95' : 'text-white/85'} tracking-tight`}
                            >
                                {limitPeriodKey
                                    ? t('limit.limitLine', {
                                          period: t(`limit.${limitPeriodKey}`),
                                          remaining,
                                          limit,
                                      })
                                    : null}
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
    const { t } = useTranslation('shop');
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
                <p className={groupTitleClass}>{t('dailyMail')}</p>
                <div
                    className={`flex min-h-0 min-w-0 flex-1 flex-row items-center justify-center ${
                        dn ? 'gap-0' : compact ? 'gap-0.5 sm:gap-1' : 'gap-1'
                    }`}
                >
                    <div className="flex min-w-0 flex-col items-center gap-0">
                        <img src={SHOP_DIAMOND_ICON} alt="" className={`${gemClass} shrink-0 object-contain drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]`} />
                        <span className={`tabular-nums text-cyan-200 ${underClass}`}>{dailyPerMail}</span>
                    </div>
                    <span className={`shrink-0 text-violet-100 drop-shadow-md ${daysClass}`}>{t('daysMultiplier', { days: durationDays })}</span>
                </div>
            </div>
            <span className={`flex shrink-0 items-center self-center ${plusClass}`}>+</span>
            <div className={instantGroupBoxClass}>
                <p className={groupTitleClass}>{t('instantGrant')}</p>
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
    equipmentBonusGradeWord?: 'epic' | 'legendary' | 'mythic';
    compact?: boolean;
    denseNested?: boolean;
}> = ({ boxes, bonusLine, equipmentBonusGradeWord, compact = false, denseNested = false }) => {
    const { t } = useTranslation('shop');
    const localizedGrade = useLocalizedItemGrade();
    const dn = Boolean(compact && denseNested);
    const imgClass = compact
        ? dn
            ? 'h-6 w-6 shrink-0'
            : 'h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10'
        : 'h-12 w-12 sm:h-14 sm:w-14';
    /** 장비상자 패키지: 좁은 카드에서 두 상자+보너스 등급 박스가 한 줄에 들어가도록 축소 */
    const equipmentPkgImgClass = compact
        ? dn
            ? 'h-5 w-5 shrink-0'
            : 'h-7 w-7 min-[380px]:h-8 min-[380px]:w-8 sm:h-9 sm:w-9'
        : 'h-9 w-9 sm:h-10 sm:w-10';
    const resolvedImgClass = equipmentBonusGradeWord ? equipmentPkgImgClass : imgClass;
    const boxDisplayNameClass = compact
        ? dn
            ? 'text-[7px] leading-none tracking-tight'
            : 'text-[9px] leading-none tracking-tight min-[380px]:text-[10px] sm:text-[11px]'
        : 'text-[10px] leading-none sm:text-xs';
    const equipmentPkgBoxDisplayNameClass = compact
        ? dn
            ? 'whitespace-nowrap text-[7px] leading-none tracking-tight'
            : 'whitespace-nowrap text-[9px] leading-none tracking-tight min-[380px]:text-[10px] sm:text-[11px]'
        : 'whitespace-nowrap text-[10px] leading-none sm:text-xs';
    const resolvedBoxDisplayNameClass = equipmentBonusGradeWord ? equipmentPkgBoxDisplayNameClass : boxDisplayNameClass;
    const gapClass = compact ? (dn ? 'gap-x-0.5 gap-y-0.5 py-0.5' : 'gap-x-1 gap-y-1 py-1 sm:gap-x-2') : 'gap-x-3 gap-y-1.5 py-1.5 sm:gap-x-5 sm:py-2';
    const equipmentPkgGapClass = compact
        ? dn
            ? 'gap-x-0 gap-y-0.5 py-0.5'
            : 'gap-x-0.5 gap-y-0.5 py-0.5 sm:gap-x-1'
        : 'gap-x-1 gap-y-1 py-1 sm:gap-x-1.5 sm:py-1';
    const resolvedGapClass = equipmentBonusGradeWord ? equipmentPkgGapClass : gapClass;
    const padClass = compact ? (dn ? 'p-0' : 'p-0.5') : 'p-1';
    const plusClass = compact
        ? dn
            ? 'text-xs font-semibold text-slate-400/85'
            : 'text-base font-bold text-slate-400 min-[380px]:text-lg'
        : 'text-lg font-semibold text-slate-400/90 sm:text-xl';
    const equipmentPkgBoxGroupClass = compact
        ? dn
            ? 'flex min-h-0 min-w-0 flex-[1.7] flex-col justify-center rounded border border-indigo-500/20 bg-indigo-950/15 px-0.5 py-0.5'
            : 'flex min-h-0 min-w-0 flex-[1.7] flex-col justify-center rounded-md border border-indigo-500/25 bg-indigo-950/20 px-1 py-0.5 sm:px-1.5 sm:py-1'
        : 'flex min-h-0 min-w-0 flex-[1.7] flex-col justify-center rounded-lg border border-indigo-500/30 bg-indigo-950/25 px-1.5 py-1 sm:px-2 sm:py-1.5';
    /** 에픽/전설/신화 확정 지급 박스 — 가로폭 축소(상자명 공간 확보) */
    const equipmentPkgBonusGroupClass = compact
        ? dn
            ? 'flex w-[3.35rem] shrink-0 flex-col items-center justify-center gap-0 rounded border border-emerald-500/25 bg-emerald-950/20 px-0.5 py-0.5'
            : 'flex w-[3.5rem] shrink-0 flex-col items-center justify-center gap-0 rounded-md border border-emerald-500/30 bg-emerald-950/25 px-0.5 py-0.5 sm:w-[3.65rem] sm:px-1 sm:py-1'
        : 'flex w-[3.65rem] shrink-0 flex-col items-center justify-center gap-0 rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-1 py-1 sm:w-[3.85rem] sm:px-1.5 sm:py-1.5';
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
    const equipmentPkgBoxItemClass = compact
        ? dn
            ? 'flex min-w-[3.35rem] shrink-0 flex-col items-center gap-0'
            : 'flex min-w-[3.65rem] shrink-0 flex-col items-center gap-0 sm:min-w-[3.85rem]'
        : 'flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 sm:min-w-[4.5rem]';
    const boxesGrid = (
        <div className={`flex ${boxesFlexRowClass} items-end justify-center ${resolvedGapClass}`}>
            {boxes.map((b, i) => (
                <div
                    key={`${b.imageSrc}-${i}`}
                    className={
                        equipmentBonusGradeWord
                            ? equipmentPkgBoxItemClass
                            : `flex shrink-0 flex-col items-center ${compact ? 'gap-0' : 'gap-0.5'}`
                    }
                >
                    <div className={`relative overflow-hidden rounded-md bg-gradient-to-br from-indigo-500/20 to-slate-900/60 shadow-[0_0_20px_-6px_rgba(129,140,248,0.5)] ring-1 ring-indigo-400/25 ${padClass}`}>
                        <span
                            className={`pointer-events-none absolute right-0 top-0 z-10 ${qtyBadgeClass}`}
                            aria-label={t('quantityAria', { count: b.quantity })}
                        >
                            ×{b.quantity}
                        </span>
                        <img src={b.imageSrc} alt={b.alt} className={`${resolvedImgClass} object-contain`} />
                    </div>
                    <span className={`text-center font-semibold text-violet-100/90 ${resolvedBoxDisplayNameClass}`} title={b.displayName}>
                        {b.displayName}
                    </span>
                </div>
            ))}
        </div>
    );

    if (equipmentBonusGradeWord) {
        const gradeForStyle = SHOP_EQUIPMENT_PACKAGE_BONUS_GRADE[equipmentBonusGradeWord];
        const gradeColorClass = gradeStyles[gradeForStyle].color;
        const gradeLabel = localizedGrade(gradeForStyle);
        return (
            <div
                className={`flex w-full min-w-0 items-stretch justify-center ${
                    !compact ? 'gap-1 py-1 sm:gap-1.5' : dn ? 'gap-0 py-0' : 'gap-0.5 py-0.5 sm:gap-1'
                }`}
            >
                <div className={equipmentPkgBoxGroupClass}>{boxesGrid}</div>
                <span className={`flex shrink-0 items-center self-center ${plusClass}`}>+</span>
                <div className={equipmentPkgBonusGroupClass}>
                    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0 px-0.5" role="text" aria-label={`${gradeLabel} ${t('equipmentWord')}`}>
                        <span className={`${bonusEquipmentLineBaseClass} ${gradeColorClass}`}>{gradeLabel}</span>
                        <span className={`${bonusEquipmentLineBaseClass} text-emerald-100`}>{t('equipmentWord')}</span>
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
    isPurchasePending?: boolean;
}> = ({ product, mobile = false, threeColumn = false, currentUser, onBuyCashPackage, setToastMessage, isPurchasePending = false }) => {
    const { t } = useTranslation('shop');
    const visual = product.packageVisual;
    const compact = threeColumn;
    /** 모바일 패키지는 2열 그리드 — 3열용 초소형(denseNested) 레이아웃 미사용 */
    const denseNested = Boolean(compact && mobile && !threeColumn);
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
            setToastMessage(t('notImplemented'));
            return;
        }
        if (removeAdsBlocked) {
            setToastMessage(t('ownedRemoveAds'));
            return;
        }
        if (diamondBlocked) {
            setToastMessage(t('diamondPackageBlocked'));
            return;
        }
        if (equipBlocked) {
            setToastMessage(t('monthlyLimitReached'));
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
                    <p className={`${visualBoxFooterClass} text-cyan-100/80`}>{t('diamondPackageNoDup')}</p>
                </div>
            )}
            {visual?.type === 'box_row' && (
                <div
                    className={`mb-1 flex min-h-0 w-full min-w-0 shrink-0 flex-col border border-indigo-400/25 bg-black/25 ${packageVisualMinHClass} ${
                        denseNested ? 'rounded border-indigo-400/15 px-0 py-0.5' : compact ? 'rounded-md px-0.5 py-0.5' : 'rounded-lg px-2 py-1.5'
                    }`}
                >
                    <div
                        className={`flex min-h-0 flex-1 items-center justify-center px-0.5 ${
                            isEquipmentPkg ? 'overflow-visible' : 'overflow-hidden'
                        }`}
                    >
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
                            {t('monthlyPurchaseLimit', { remaining: equipRemaining, limit: equipLimit })}
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
                    <p className={`${visualBoxFooterClass} text-rose-100/85`}>{t('accountOncePermanent')}</p>
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
                <ul className="sr-only" aria-label={t('includedBenefitsAria')}>
                    {product.benefits.map((benefit, index) => (
                        <li key={`${product.id}-benefit-${index}`}>{benefit}</li>
                    ))}
                </ul>
            )}
            <div className="mt-auto shrink-0 pt-1.5">
                <Button
                    type="button"
                    disabled={purchaseDisabled || isPurchasePending}
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
                    {removeAdsBlocked ? t('owned') : isPurchasePending ? t('purchasing') : t('priceKrw', { price: product.priceKRW.toLocaleString() })}
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
    const { t } = useTranslation('shop');
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
                title={t('duplicateExtends')}
            >
                {t('duplicateExtends')}
            </div>
            {isSubscribed ? (
                <p
                    className={`mt-1.5 shrink-0 text-center font-semibold text-emerald-300/95 ${
                        mobile ? 'text-[9px]' : 'text-[10px] sm:text-xs'
                    }`}
                >
                    {t('autoRenewActive')}
                </p>
            ) : null}
            <div className={`mt-auto flex shrink-0 flex-col ${mobile ? 'gap-1 pt-1.5' : 'gap-1.5 pt-2'}`}>
                <Button
                    type="button"
                    colorScheme="none"
                    bare
                    onClick={() => {
                        if (!currentUser.isAdmin) {
                            setToastMessage(t('notImplemented'));
                            return;
                        }
                        onBuyVip(product.id, 'one_time');
                    }}
                    className={`flex w-full flex-col items-center justify-center gap-0 rounded-md border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 px-1.5 font-semibold tabular-nums text-slate-900 shadow-[0_8px_22px_-12px_rgba(251,191,36,0.75)] sm:rounded-lg sm:shadow-[0_10px_28px_-14px_rgba(251,191,36,0.85)] ${
                        mobile ? 'min-h-[2.35rem] py-1.5 text-[10px] leading-tight sm:text-xs' : 'min-h-[2.65rem] py-2 text-xs sm:min-h-[2.75rem] sm:text-sm'
                    }`}
                >
                    <span className="min-w-0 text-center leading-tight">{t('oneTimePayment')}</span>
                    <span className="min-w-0 text-center text-[10px] font-bold tabular-nums opacity-95 sm:text-xs">
                        {t('oneTimePriceDays', { price: product.priceKRW.toLocaleString(), days: durationDays })}
                    </span>
                </Button>
                <Button
                    type="button"
                    colorScheme="none"
                    bare
                    onClick={() => {
                        if (!currentUser.isAdmin) {
                            setToastMessage(t('notImplemented'));
                            return;
                        }
                        onBuyVip(product.id, 'subscription');
                    }}
                    className={`flex w-full flex-col items-center justify-center gap-0 rounded-md border border-violet-400/55 bg-gradient-to-r from-violet-600/92 via-indigo-600/90 to-violet-700/92 px-1.5 font-semibold text-amber-50 shadow-[0_8px_22px_-12px_rgba(139,92,246,0.55)] sm:rounded-lg ${
                        mobile ? 'min-h-[2.35rem] py-1.5 text-[9px] leading-tight sm:text-[10px]' : 'min-h-[2.65rem] py-2 text-[10px] sm:min-h-[2.75rem] sm:text-xs'
                    }`}
                >
                    <span className="text-center font-bold leading-tight">{t('subscription')}</span>
                    <span className="text-center text-[9px] font-medium leading-tight text-violet-100/90 sm:text-[10px]">
                        {t('subscriptionCharge', { price: product.priceKRW.toLocaleString() })}
                    </span>
                </Button>
                {isSubscribed ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (!currentUser.isAdmin) {
                                setToastMessage(t('notImplemented'));
                                return;
                            }
                            onCancelVipSubscription(product.id);
                            setToastMessage(t('cancelSubscriptionToast'));
                        }}
                        className={`w-full rounded-md border border-amber-200/25 bg-black/20 py-1 text-center font-medium text-amber-200/90 underline-offset-2 hover:bg-black/35 hover:underline ${
                            mobile ? 'text-[9px]' : 'text-[10px] sm:text-xs'
                        }`}
                    >
                        {t('cancelSubscription')}
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
    const { t } = useTranslation('shop');
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
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-20 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_65%)]" />
            <div
                className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center ${mobile ? 'gap-1' : 'gap-1.5'}`}
            >
                {segments ? (
                    <div
                        className={`relative mx-auto flex w-full min-w-0 shrink-0 items-stretch justify-center gap-0.5 ${mobile ? 'min-h-[3.25rem]' : 'min-h-[3.75rem] gap-1 sm:min-h-[4rem]'}`}
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
                        className={`relative mx-auto flex shrink-0 items-center justify-center ${mobile ? 'min-h-[3.25rem]' : 'min-h-[3.75rem]'}`}
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
                    title={t('countUnit', { count: countLabel })}
                >
                    {t('countUnit', { count: countLabel })}
                </h3>
            </div>
            <div className="mt-1.5 flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-1">
                <Button
                    type="button"
                    colorScheme="none"
                    bare
                    title={t('notImplemented')}
                    onClick={onCashPriceClick}
                    className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-400/55 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 px-2 py-1.5 text-center font-bold tabular-nums text-slate-900 shadow-[0_10px_28px_-14px_rgba(251,191,36,0.85)] transition-all duration-150 hover:from-amber-300 hover:to-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                        mobile ? 'h-[2.95rem] min-h-[2.95rem] max-h-[2.95rem] text-sm' : 'min-h-[3.5rem] py-2 text-sm sm:text-base'
                    }`}
                >
                    {t('priceKrw', { price: product.priceKRW.toLocaleString() })}
                </Button>
            </div>
        </div>
    );
};

/** 결제 동의 모달용 패키지 라벨 — 정확한 메타데이터 없이 ID 기반으로 사람이 읽을 수 있는 이름 제공. */
const describeCashPackage = (packageId: string): string => shopT(`packages.${packageId}`, { defaultValue: packageId });
const describeVipPackage = (packageId: string): string => shopT(`vipPackages.${packageId}`, { defaultValue: packageId });

const ShopModal: React.FC<ShopModalProps> = ({
    currentUser: propCurrentUser,
    onClose,
    onAction,
    isTopmost,
    initialTab,
    embedded = false,
}) => {
    const { currentUserWithStatus } = useAppContext();
    const { t } = useTranslation('shop');
    const localizedShopItem = useLocalizedShopItem();
    const withShopItemText = <T extends Record<string, unknown>>(itemId: string, rest: T) => ({
        itemId,
        name: localizedShopItem(itemId, 'name'),
        description: localizedShopItem(itemId, 'description'),
        ...rest,
    });
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
    
    const [activeTab, setActiveTab] = useState<ShopTab>(
        initialTab === 'misc' ? 'diamonds' : (initialTab || 'equipment'),
    );
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [purchasingItem, setPurchasingItem] = useState<PurchasableItem | null>(null);
    const [pendingConsent, setPendingConsent] = useState<PurchaseConsentTarget | null>(null);
    const consentResolverRef = useRef<((accepted: boolean) => void) | null>(null);
    const shopAction = useKeyedAsyncAction();

    /** 결제 직전 약관·환불·정기결제 동의 게이트. true(동의) / false(취소) 반환. */
    const askPurchaseConsent = useCallback((target: PurchaseConsentTarget): Promise<boolean> => {
        setPendingConsent(target);
        return new Promise<boolean>((resolve) => {
            consentResolverRef.current = resolve;
        });
    }, []);

    const handleConsentConfirm = useCallback(() => {
        const resolver = consentResolverRef.current;
        consentResolverRef.current = null;
        setPendingConsent(null);
        resolver?.(true);
    }, []);

    const handleConsentCancel = useCallback(() => {
        const resolver = consentResolverRef.current;
        consentResolverRef.current = null;
        setPendingConsent(null);
        resolver?.(false);
    }, []);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab === 'misc' ? 'diamonds' : initialTab);
    }, [initialTab]);

    const gridClassName = mobileShop
        ? 'grid grid-cols-2 gap-1.5 min-[390px]:grid-cols-3 min-[390px]:gap-2 items-stretch [&>*]:min-h-0'
        : 'grid grid-cols-4 gap-3 items-stretch [&>*]:min-h-0';
    /** 장비·다이아 패키지 — PC 3열, 모바일 2열 */
    const packageProductsGridClassName = mobileShop
        ? 'grid grid-cols-2 gap-1.5 min-[390px]:gap-2 items-stretch [&>*]:min-h-0 [&>*]:min-w-0'
        : 'grid grid-cols-3 gap-2 sm:gap-3 items-stretch [&>*]:min-h-0 [&>*]:min-w-0';
    const materialItems = [
        withShopItemText('material_box_1', { price: { gold: 500 }, image: "/images/Box/ResourceBox1.webp", type: 'material' as const }),
        withShopItemText('material_box_2', { price: { gold: 1000 }, image: "/images/Box/ResourceBox2.webp", type: 'material' as const }),
        withShopItemText('material_box_3', { price: { gold: 3000 }, image: "/images/Box/ResourceBox3.webp", type: 'material' as const }),
        withShopItemText('material_box_4', { price: { gold: 5000 }, image: "/images/Box/ResourceBox4.webp", type: 'material' as const }),
        withShopItemText('material_box_5', { price: { gold: 10000 }, image: "/images/Box/ResourceBox5.webp", type: 'material' as const }),
        withShopItemText('material_box_6', { price: { diamonds: 100 }, image: "/images/Box/ResourceBox6.webp", type: 'material' as const }),
        withShopItemText('equipment_unbind_ticket', {
            price: { diamonds: 50 },
            image: '/images/use/belong.webp',
            dailyLimit: 10,
            type: 'material' as const,
        }),
        withShopItemText('refinement_charm', {
            price: { diamonds: 100 },
            image: '/images/use/refine.webp',
            dailyLimit: 1,
            type: 'material' as const,
        }),
        withShopItemText('option_type_change_ticket', { price: { gold: 2000 }, image: "/images/use/change1.webp", dailyLimit: 3, type: 'material' as const }),
        withShopItemText('option_value_change_ticket', { price: { gold: 500 }, image: "/images/use/change2.webp", dailyLimit: 10, type: 'material' as const }),
        withShopItemText('mythic_option_change_ticket', { price: { gold: 500 }, image: "/images/use/change3.webp", dailyLimit: 10, type: 'material' as const }),
    ];
    const vipProducts: MiscShopProduct[] = useMemo(() => [
        {
            id: 'reward_vip',
            name: t('vipProducts.reward_vip.name'),
            duration: t('duration30Days'),
            priceKRW: 10900,
            benefits: ['0', '1', '2', '3', '4', '5', '6', '7'].map((k) => t(`vipProducts.reward_vip.benefits.${k}`)),
            benefitFooter: t('vipProducts.reward_vip.benefitFooter'),
        },
        {
            id: 'function_vip',
            name: t('vipProducts.function_vip.name'),
            duration: t('duration30Days'),
            priceKRW: 10900,
            benefits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map((k) => t(`vipProducts.function_vip.benefits.${k}`)),
        },
        {
            id: 'vvip',
            name: t('vipProducts.vvip.name'),
            duration: t('duration30Days'),
            priceKRW: 17900,
            benefits: [t('vipProducts.vvip.benefits.0')],
        },
    ], [t]);
    const diamondPackageProducts: MiscShopProduct[] = useMemo(() => [
        {
            id: 'diamond_package_1',
            name: t('packages.diamond_package_1'),
            duration: t('duration7Days'),
            priceKRW: 10900,
            benefits: [t('packageBenefits.diamond_daily_50_350'), t('packageBenefits.diamond_instant_100')],
            packageVisual: { type: 'diamond_combo', dailyPerMail: 100, durationDays: 7, instantDiamonds: 200 },
        },
        {
            id: 'diamond_package_2',
            name: t('packages.diamond_package_2'),
            duration: t('duration15Days'),
            priceKRW: 19900,
            benefits: [t('packageBenefits.diamond_daily_50_750'), t('packageBenefits.diamond_instant_250')],
            packageVisual: { type: 'diamond_combo', dailyPerMail: 100, durationDays: 15, instantDiamonds: 500 },
        },
        {
            id: 'diamond_package_3',
            name: t('packages.diamond_package_3'),
            duration: t('duration30Days'),
            priceKRW: 29900,
            benefits: [t('packageBenefits.diamond_daily_50_1500'), t('packageBenefits.diamond_instant_750')],
            packageVisual: { type: 'diamond_combo', dailyPerMail: 100, durationDays: 30, instantDiamonds: 1000 },
        },
    ], [t]);
    const equipmentPackageProducts: MiscShopProduct[] = useMemo(() => [
        {
            id: 'equipment_package_1',
            name: t('packages.equipment_package_1'),
            priceKRW: 10900,
            benefits: [t('packageBenefits.equip_pkg1_boxes'), t('packageBenefits.equip_pkg1_mat'), t('packageBenefits.equip_pkg1_bonus')],
            packageVisual: {
                type: 'box_row',
                equipmentBonusGradeWord: 'epic',
                boxes: [
                    {
                        imageSrc: '/images/Box/EquipmentBox5.webp',
                        quantity: 3,
                        alt: t('boxNames.equipmentBox5'),
                        displayName: t('boxNames.equipmentBox5'),
                    },
                    {
                        imageSrc: '/images/Box/ResourceBox6.webp',
                        quantity: 3,
                        alt: t('boxNames.materialBox6'),
                        displayName: t('boxNames.materialBox6'),
                    },
                ],
            },
        },
        {
            id: 'equipment_package_2',
            name: t('packages.equipment_package_2'),
            priceKRW: 15900,
            benefits: [t('packageBenefits.equip_pkg2_boxes'), t('packageBenefits.equip_pkg2_mat'), t('packageBenefits.equip_pkg2_bonus')],
            packageVisual: {
                type: 'box_row',
                equipmentBonusGradeWord: 'legendary',
                boxes: [
                    {
                        imageSrc: '/images/Box/EquipmentBox5.webp',
                        quantity: 5,
                        alt: t('boxNames.equipmentBox5'),
                        displayName: t('boxNames.equipmentBox5'),
                    },
                    {
                        imageSrc: '/images/Box/ResourceBox6.webp',
                        quantity: 5,
                        alt: t('boxNames.materialBox6'),
                        displayName: t('boxNames.materialBox6'),
                    },
                ],
            },
        },
        {
            id: 'equipment_package_3',
            name: t('packages.equipment_package_3'),
            priceKRW: 20900,
            benefits: [t('packageBenefits.equip_pkg3_boxes'), t('packageBenefits.equip_pkg3_mat'), t('packageBenefits.equip_pkg3_bonus')],
            packageVisual: {
                type: 'box_row',
                equipmentBonusGradeWord: 'mythic',
                boxes: [
                    {
                        imageSrc: '/images/Box/EquipmentBox6.webp',
                        quantity: 2,
                        alt: t('boxNames.equipmentBox6'),
                        displayName: t('boxNames.equipmentBox6'),
                    },
                    {
                        imageSrc: '/images/Box/ResourceBox6.webp',
                        quantity: 10,
                        alt: t('boxNames.materialBox6'),
                        displayName: t('boxNames.materialBox6'),
                    },
                ],
            },
        },
    ], [t]);
    const removeAdsProduct: MiscShopProduct = useMemo(
        () => ({
            id: CASH_SHOP_REMOVE_ADS_PACKAGE_ID,
            name: t('packages.remove_ads'),
            priceKRW: 10900,
            benefits: [t('packageBenefits.remove_ads_1'), t('packageBenefits.remove_ads_2')],
            packageVisual: { type: 'remove_ads_image', imageSrc: '/images/shop/remove_ads_package.svg' },
        }),
        [t],
    );
    const diamondProducts = [
        { id: 'diamond_500', diamonds: 500, priceKRW: 10900 },
        { id: 'diamond_1250', diamonds: 1250, priceKRW: 19900 },
        { id: 'diamond_2250', diamonds: 2250, priceKRW: 29900 },
    ] as const;

    const handleClaimShopAdReward = (tab: ShopAdRewardTab) => {
        const remaining = getShopAdRemainingForTab(currentUser, tab, Date.now());
        if (remaining <= 0) {
            setToastMessage(t('adReward.tabExhausted'));
            return;
        }
        showShopAdRewardInterstitial(() => {
            void shopAction.run(`ad-reward-${tab}`, async () => {
                await onAction({ type: 'CLAIM_SHOP_AD_REWARD', payload: { tab } });
            });
        });
    };

    const handleInitiatePurchase = (item: PurchasableItem) => {
        setPurchasingItem(item);
    };

    const handleConfirmPurchase = async (itemId: string, quantity: number) => {
        const item = purchasingItem;
        if (!item) return;

        await shopAction.run(`purchase-${itemId}`, async () => {
            if (itemId.startsWith('condition_potion_')) {
                const potionType = itemId.replace('condition_potion_', '') as 'small' | 'medium' | 'large';
                const result = await onAction({ type: 'BUY_CONDITION_POTION', payload: { potionType, quantity } });
                const err =
                    result &&
                    typeof result === 'object' &&
                    'error' in result &&
                    typeof (result as { error?: unknown }).error === 'string'
                        ? (result as { error: string }).error
                        : undefined;
                if (err) {
                    setToastMessage(err);
                } else if (!result) {
                    setToastMessage(t('toast.purchaseFailed'));
                } else {
                    setToastMessage(t('toast.conditionPotionPurchased'));
                }
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
                await onAction({ type: 'BUY_CONSUMABLE', payload: { itemId, quantity } });
            } else {
                const actionType = item.type === 'equipment' ? 'BUY_SHOP_ITEM' : 'BUY_MATERIAL_BOX';
                await onAction({ type: actionType, payload: { itemId, quantity } });
            }
            if (!itemId.startsWith('condition_potion_')) {
                setToastMessage(t('toast.purchaseComplete'));
            }
            setPurchasingItem(null);
        });
    };
    
    const handleBuyActionPoints = () => {
        void shopAction.run('purchase-action-points', async () => {
            await onAction({ type: 'PURCHASE_ACTION_POINTS' });
            setToastMessage(t('toast.actionPointPurchased'));
        });
    };

    const handleBuyCashPackage = (packageId: string) => {
        void shopAction.run(`cash-package-${packageId}`, async () => {
            const consented = await askPurchaseConsent({
                productName: describeCashPackage(packageId),
                priceLabel: t('consent.cashPriceLabel'),
                summary: t('consent.cashSummary'),
            });
            if (!consented) {
                setToastMessage(t('toast.paymentCancelled'));
                return;
            }
            if (!currentUser.isAdmin) {
                setToastMessage(t('notImplemented'));
                return;
            }
            const now = Date.now();
            if ((CASH_SHOP_DIAMOND_PACKAGE_IDS as readonly string[]).includes(packageId)) {
                if (!currentUser.isAdmin && (currentUser.diamondPackageExpiresAt ?? 0) > now) {
                    setToastMessage(t('diamondPackageBlocked'));
                    return;
                }
            } else if ((CASH_SHOP_EQUIPMENT_PACKAGE_IDS as readonly string[]).includes(packageId)) {
                const limit = EQUIPMENT_PACKAGE_MONTHLY_LIMIT[packageId as keyof typeof EQUIPMENT_PACKAGE_MONTHLY_LIMIT];
                const rec = currentUser.dailyShopPurchases?.[packageId];
                const qty = rec && !isDifferentMonthKST(rec.date, now) ? rec.quantity : 0;
                if (!currentUser.isAdmin && qty >= limit) {
                    setToastMessage(t('monthlyLimitReached'));
                    return;
                }
            }
            await onAction({ type: 'BUY_CASH_PACKAGE', payload: { packageId } });
        });
    };

    const handleBuyVipPackage = (packageId: string, billing: 'one_time' | 'subscription' = 'one_time') => {
        void shopAction.run(`vip-package-${packageId}-${billing}`, async () => {
            const consented = await askPurchaseConsent({
                productName: describeVipPackage(packageId),
                priceLabel: billing === 'subscription' ? t('consent.subscriptionPriceLabel') : t('consent.oneTimePriceLabel'),
                isSubscription: billing === 'subscription',
                summary: t('consent.vipSummary'),
            });
            if (!consented) {
                setToastMessage(t('toast.paymentCancelled'));
                return;
            }
            if (!currentUser.isAdmin) {
                setToastMessage(t('notImplemented'));
                return;
            }
            await onAction({ type: 'BUY_VIP_PACKAGE', payload: { packageId, billing } });
        });
    };

    const handleCancelVipSubscription = (packageId: string) => {
        void shopAction.run(`vip-cancel-${packageId}`, async () => {
            if (!currentUser.isAdmin) {
                setToastMessage(t('notImplemented'));
                return;
            }
            await onAction({ type: 'CANCEL_VIP_SHOP_AUTO_RENEW', payload: { packageId } });
        });
    };

    const renderContent = () => {
        const equipmentItems = [
            withShopItemText('equipment_box_1', { price: { gold: 500 }, image: "/images/Box/EquipmentBox1.webp", type: 'equipment' as const }),
            withShopItemText('equipment_box_2', { price: { gold: 1500 }, image: "/images/Box/EquipmentBox2.webp", type: 'equipment' as const }),
            withShopItemText('equipment_box_3', { price: { gold: 5000 }, image: "/images/Box/EquipmentBox3.webp", type: 'equipment' as const }),
            withShopItemText('equipment_box_4', { price: { gold: 10000 }, image: "/images/Box/EquipmentBox4.webp", type: 'equipment' as const }),
            withShopItemText('equipment_box_5', { price: { diamonds: 100 }, image: "/images/Box/EquipmentBox5.webp", type: 'equipment' as const }),
            withShopItemText('equipment_box_6', { price: { diamonds: 500 }, image: "/images/Box/EquipmentBox6.webp", type: 'equipment' as const }),
        ];

        switch (activeTab) {
            case 'equipment':
                return (
                    <>
                        <div className={gridClassName}>
                            <ShopAdRewardCard
                                tab="equipment"
                                rewardDescription={t('adRewardDescriptions.equipment')}
                                claimableRemaining={getShopAdRemainingForTab(currentUser, 'equipment', Date.now())}
                                onClaim={handleClaimShopAdReward}
                                mobile={mobileShop}
                                isClaimPending={shopAction.isAnyPending}
                            />
                            {equipmentItems.map(item => (
                                <ShopItemCard
                                    key={item.itemId}
                                    item={item}
                                    onBuy={handleInitiatePurchase}
                                    currentUser={currentUser}
                                    mobile={mobileShop}
                                    isShopBusy={shopAction.isPending(`purchase-${item.itemId}`)}
                                />
                            ))}
                        </div>
                        <ShopPackageSectionDivider label={t('tabs.package')} mobile={mobileShop} />
                        <div className={packageProductsGridClassName}>
                            {equipmentPackageProducts.map(product => (
                                <MiscShopCard
                                    key={product.id}
                                    product={product}
                                    mobile={mobileShop}
                                    threeColumn
                                    currentUser={currentUser}
                                    onBuyCashPackage={handleBuyCashPackage}
                                    setToastMessage={setToastMessage}
                                    isPurchasePending={shopAction.isPending(`cash-package-${product.id}`)}
                                />
                            ))}
                        </div>
                    </>
                );
            case 'materials':
                 return (
                    <div className={gridClassName}>
                        <ShopAdRewardCard
                            tab="materials"
                            rewardDescription={t('adRewardDescriptions.materials')}
                            claimableRemaining={getShopAdRemainingForTab(currentUser, 'materials', Date.now())}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                            isClaimPending={shopAction.isAnyPending}
                        />
                        {materialItems.map(item => (
                            <ShopItemCard
                                key={item.itemId}
                                item={item}
                                onBuy={handleInitiatePurchase}
                                currentUser={currentUser}
                                mobile={mobileShop}
                                isShopBusy={shopAction.isPending(`purchase-${item.itemId}`)}
                            />
                        ))}
                    </div>
                );
            case 'diamonds':
                return (
                    <>
                        <div className={gridClassName}>
                            <ShopAdRewardCard
                                tab="diamonds"
                                rewardDescription={t('adRewardDescriptions.diamonds')}
                                claimableRemaining={getShopAdRemainingForTab(currentUser, 'diamonds', Date.now())}
                                onClaim={handleClaimShopAdReward}
                                mobile={mobileShop}
                                isClaimPending={shopAction.isAnyPending}
                            />
                            {diamondProducts.map(product => (
                                <DiamondShopCard
                                    key={product.id}
                                    product={product}
                                    mobile={mobileShop}
                                    onCashPriceClick={() => setToastMessage(t('notImplemented'))}
                                />
                            ))}
                        </div>
                        <ShopPackageSectionDivider label={t('tabs.package')} mobile={mobileShop} />
                        <div className={packageProductsGridClassName}>
                            {diamondPackageProducts.map(product => (
                                <MiscShopCard
                                    key={product.id}
                                    product={product}
                                    mobile={mobileShop}
                                    threeColumn
                                    currentUser={currentUser}
                                    onBuyCashPackage={handleBuyCashPackage}
                                    setToastMessage={setToastMessage}
                                    isPurchasePending={shopAction.isPending(`cash-package-${product.id}`)}
                                />
                            ))}
                        </div>
                    </>
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
                        <MiscShopCard
                            key={removeAdsProduct.id}
                            product={removeAdsProduct}
                            mobile={mobileShop}
                            currentUser={currentUser}
                            onBuyCashPackage={handleBuyCashPackage}
                            setToastMessage={setToastMessage}
                            isPurchasePending={shopAction.isPending(`cash-package-${removeAdsProduct.id}`)}
                        />
                    </div>
                );
            case 'consumables':
            default: {
                const baseConsumableItems = [
                    withShopItemText('condition_potion_small', { price: { gold: 100 }, image: "/images/use/con1.webp", dailyLimit: 3, type: 'consumable' as const }),
                    withShopItemText('condition_potion_medium', { price: { gold: 150 }, image: "/images/use/con2.webp", dailyLimit: 3, type: 'consumable' as const }),
                    withShopItemText('condition_potion_large', { price: { gold: 200 }, image: "/images/use/con3.webp", dailyLimit: 3, type: 'consumable' as const }),
                ];
                // 행동력 회복제: 품목별 일일 1개, 고정 골드가 (ShopItemCard)
                const ACTION_POINT_ITEMS = [
                    withShopItemText('action_point_10', { dailyLimit: 1, prices: [1000], badge: '+10' }),
                    withShopItemText('action_point_20', { dailyLimit: 1, prices: [1500], badge: '+20' }),
                    withShopItemText('action_point_30', { dailyLimit: 1, prices: [2000], badge: '+30' }),
                ] as const;
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
                            rewardDescription={t('adRewardDescriptions.actionPoint')}
                            claimableRemaining={getShopAdRemainingForTab(currentUser, 'consumables', Date.now())}
                            onClaim={handleClaimShopAdReward}
                            mobile={mobileShop}
                            isClaimPending={shopAction.isAnyPending}
                        />
                        {consumableItems.map(item => (
                            <ShopItemCard
                                key={item.itemId}
                                item={item}
                                onBuy={handleInitiatePurchase}
                                currentUser={currentUser}
                                mobile={mobileShop}
                                isShopBusy={shopAction.isPending(`purchase-${item.itemId}`)}
                            />
                        ))}
                    </div>
                );
            }
        }
    };

    const shopBody = (
                <div
                    className={
                        embedded
                            ? 'relative flex h-full min-h-0 flex-col'
                            : mobileShop
                              ? 'relative flex min-h-0 w-full flex-col'
                              : 'relative flex h-full min-h-0 flex-col'
                    }
                    data-kst-calendar-day={kstCalendarDay}
                >
                    <div
                        className={`mb-3 flex shrink-0 rounded-lg bg-gray-900/70 p-1 ${mobileShop ? 'sticky top-0 z-20 gap-1 backdrop-blur-sm' : ''}`}
                    >
                        <button onClick={() => setActiveTab('equipment')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'equipment' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>{t('tabs.equipment')}</button>
                        <button onClick={() => setActiveTab('materials')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'materials' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>{t('tabs.materials')}</button>
                        <button onClick={() => setActiveTab('consumables')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'consumables' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>{t('tabs.consumables')}</button>
                        <button onClick={() => setActiveTab('diamonds')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'diamonds' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>{t('tabs.diamonds')}</button>
                        <button onClick={() => setActiveTab('vip')} className={`flex-1 rounded-md transition-all ${mobileShop ? 'py-2 text-[13px] font-bold' : 'py-2 text-sm font-semibold'} ${activeTab === 'vip' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>{t('tabs.vip')}</button>
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
    );

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
            {embedded ? (
                <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{shopBody}</div>
            ) : (
                <DraggableWindow
                    title={t('title')}
                    onClose={onClose}
                    windowId="shop"
                    initialWidth={900}
                    initialHeight={750}
                    isTopmost={isTopmost && !purchasingItem && !pendingConsent}
                    bodyScrollable={!mobileShop}
                    mobileViewportFit={mobileShop}
                    mobileViewportMaxHeightVh={90}
                    bodyNoScroll={false}
                    bodyPaddingClassName={mobileShop ? 'flex min-h-0 min-w-0 flex-1 flex-col !px-2.5 !pt-2.5 !pb-[max(0.8rem,env(safe-area-inset-bottom,0px))]' : undefined}
                >
                    {shopBody}
                </DraggableWindow>
            )}
            {pendingConsent ? (
                <Suspense fallback={null}>
                    <PurchaseConsentModal
                        target={pendingConsent}
                        onConfirm={handleConsentConfirm}
                        onCancel={handleConsentCancel}
                    />
                </Suspense>
            ) : null}
        </>
    );
};

export default ShopModal;
