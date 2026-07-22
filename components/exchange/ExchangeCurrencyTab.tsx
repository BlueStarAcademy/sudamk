import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CurrencyExchangeOrder, ServerAction, UserWithStatus } from '../../types.js';
import type { HandleActionResult } from '../../types/api.js';
import Button from '../Button.js';
import DraggableWindow from '../DraggableWindow.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { getApiUrl } from '../../utils/apiConfig.js';
import { clampDigitsOnlyInputString, clampGameInt, exchangeListingFeeFromPrice } from '../../shared/utils/gameIntegerField.js';
import {
    clampInstantExchangeInputToDailyLimit,
    computeInstantDiamondsToGold,
    computeInstantGoldToDiamonds,
    computeDesiredExchangeAmountFromMarketRate,
    computeOrderUnitGoldPerDiamond,
    getInstantDailyRemaining,
    instantGoldPerDiamondWhenBuyingDiamonds,
    instantGoldPerDiamondWhenSellingDiamonds,
    maxInstantBasePayAffordable,
    resolveMarketDisplayGoldPerDiamondFromSnapshot,
    validateInstantExchangeDailyLimit,
} from '../../shared/utils/currencyExchange.js';
import type { CurrencyExchangeMarketRateSnapshot } from '../../shared/utils/currencyExchange.js';
import {
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_FROM_GOLD,
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT,
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_FROM_DIAMONDS,
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT,
    CURRENCY_EXCHANGE_INSTANT_DIAMONDS_TO_GOLD_BATCH,
    CURRENCY_EXCHANGE_INSTANT_GOLD_TO_DIAMONDS_BATCH,
    CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS,
    CURRENCY_EXCHANGE_INSTANT_MIN_GOLD,
    CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER,
} from '../../shared/constants/currencyExchange.js';
import { formatWalletCurrencyAmount, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';
import { maxExchangeListPrice } from '../../shared/constants/numericLimits.js';

type SaleCurrency = 'gold' | 'diamonds';
type InstantDirection = 'gold_to_diamonds' | 'diamonds_to_gold';
type MarketListTab = 'all' | InstantDirection;
type MobileCurrencySectionTab = 'market' | 'instant' | 'register';
type MarketSortColumn = 'latest' | 'quantity' | 'unitPrice' | 'price';
type SortDirection = 'asc' | 'desc';

const GOLD_ICON = '/images/icon/Gold.webp';
const DIAMOND_ICON = '/images/icon/Zem.webp';

const BAG_SCROLLBAR_Y_CLASS =
    '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/38 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/48';

function formatCurrencyAmount(value: number, currency: SaleCurrency): string {
    return currency === 'gold' ? formatWalletCurrencyAmount(value, 'gold') : formatWalletDiamonds(value);
}

const CurrencyIcon: React.FC<{ currency: SaleCurrency; className?: string }> = ({ currency, className }) => (
    <img
        src={currency === 'gold' ? GOLD_ICON : DIAMOND_ICON}
        alt=""
        className={className ?? 'h-4 w-4 shrink-0 object-contain'}
    />
);

const CurrencyAmountDisplay: React.FC<{
    amount: number;
    currency: SaleCurrency;
    className?: string;
    amountClassName?: string;
    iconClassName?: string;
}> = ({ amount, currency, className, amountClassName, iconClassName }) => (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`}>
        <CurrencyIcon currency={currency} className={iconClassName} />
        <span className={amountClassName ?? 'tabular-nums font-semibold'}>{formatCurrencyAmount(amount, currency)}</span>
    </span>
);

const CurrencyArrowPair: React.FC<{
    fromAmount: number;
    fromCurrency: SaleCurrency;
    toAmount: number;
    toCurrency: SaleCurrency;
    className?: string;
    iconClassName?: string;
    amountClassName?: string;
}> = ({ fromAmount, fromCurrency, toAmount, toCurrency, className, iconClassName, amountClassName }) => (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className ?? ''}`}>
        <CurrencyAmountDisplay
            amount={fromAmount}
            currency={fromCurrency}
            iconClassName={iconClassName}
            amountClassName={amountClassName}
        />
        <span className="text-slate-500">→</span>
        <CurrencyAmountDisplay
            amount={toAmount}
            currency={toCurrency}
            iconClassName={iconClassName}
            amountClassName={amountClassName}
        />
    </span>
);

const SectionHeader: React.FC<{
    title: string;
    subtitle?: React.ReactNode;
    action?: React.ReactNode;
    accent?: 'cyan' | 'amber' | 'slate';
    titleClassName?: string;
    subtitleClassName?: string;
}> = ({
    title,
    subtitle,
    action,
    accent = 'slate',
    titleClassName = 'text-sm font-bold tracking-wide text-slate-50',
    subtitleClassName = 'text-[11px] text-slate-400',
}) => {
    const accentBar =
        accent === 'cyan'
            ? 'from-cyan-400/80 to-blue-500/40'
            : accent === 'amber'
              ? 'from-amber-400/80 to-orange-500/40'
              : 'from-slate-400/60 to-slate-600/30';
    return (
        <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`h-4 w-0.5 shrink-0 rounded-full bg-gradient-to-b ${accentBar}`} aria-hidden />
                    <h3 className={titleClassName}>{title}</h3>
                </div>
                {subtitle ? <div className={`mt-1 pl-2.5 ${subtitleClassName}`}>{subtitle}</div> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
};

export interface ExchangeCurrencyTabProps {
    currentUser: UserWithStatus;
    mobileExchange: boolean;
    walletGold: number;
    walletDiamonds: number;
    primaryButtonClass: string;
    onAction?: (action: ServerAction) => void | Promise<void | HandleActionResult | { error?: string }>;
}

const ExchangeCurrencyTab: React.FC<ExchangeCurrencyTabProps> = ({
    currentUser,
    mobileExchange,
    walletGold,
    walletDiamonds,
    primaryButtonClass,
    onAction,
}) => {
    const { t } = useTranslation('exchange');
    const { t: tCommon } = useTranslation('common');

    const [marketListTab, setMarketListTab] = useState<MarketListTab>('all');
    const [marketSortColumn, setMarketSortColumn] = useState<MarketSortColumn>('latest');
    const [marketSortDirection, setMarketSortDirection] = useState<SortDirection>('desc');
    const [mobileSectionTab, setMobileSectionTab] = useState<MobileCurrencySectionTab>('market');
    const [instantDirection, setInstantDirection] = useState<InstantDirection>('gold_to_diamonds');
    const [instantAmount, setInstantAmount] = useState('0');
    const [orderFromCurrency, setOrderFromCurrency] = useState<SaleCurrency>('gold');
    const [orderFromAmount, setOrderFromAmount] = useState('0');
    const [orderToAmount, setOrderToAmount] = useState('0');
    const [postOrderConfirmOpen, setPostOrderConfirmOpen] = useState(false);
    const [marketOrders, setMarketOrders] = useState<CurrencyExchangeOrder[]>([]);
    const [marketRateSnapshot, setMarketRateSnapshot] = useState<CurrencyExchangeMarketRateSnapshot | null>(null);
    const [ordersLoaded, setOrdersLoaded] = useState(false);
    const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);

    const myOrders = useMemo(
        () => (currentUser.exchangeState?.currencyOrders ?? []).filter((o) => o.posterId === currentUser.id),
        [currentUser.exchangeState?.currencyOrders, currentUser.id],
    );
    const myOpenOrders = useMemo(() => myOrders.filter((o) => o.status === 'open'), [myOrders]);

    const refreshMarketOrders = useCallback(async () => {
        setIsRefreshingOrders(true);
        try {
            const response = await fetch(getApiUrl('/api/exchange/currency-orders'));
            if (!response.ok) throw new Error('fetch failed');
            const data = (await response.json()) as {
                orders?: CurrencyExchangeOrder[];
                marketRate?: CurrencyExchangeMarketRateSnapshot | null;
            };
            setMarketOrders(Array.isArray(data.orders) ? data.orders : []);
            setMarketRateSnapshot(data.marketRate && typeof data.marketRate === 'object' ? data.marketRate : null);
        } catch {
            setMarketOrders([]);
            setMarketRateSnapshot(null);
        } finally {
            setOrdersLoaded(true);
            setIsRefreshingOrders(false);
        }
    }, []);

    useEffect(() => {
        void refreshMarketOrders();
    }, [refreshMarketOrders]);

    const instantDailyRemaining = useMemo(
        () => getInstantDailyRemaining(currentUser.exchangeState?.instantDaily, Date.now()),
        [currentUser.exchangeState?.instantDaily],
    );

    const instantPreview = useMemo(() => {
        const rawAmount = Math.max(0, Math.floor(Number(instantAmount) || 0));
        const amount = clampInstantExchangeInputToDailyLimit(
            instantDirection,
            rawAmount,
            currentUser.exchangeState?.instantDaily,
        );
        if (instantDirection === 'gold_to_diamonds') {
            const { diamonds, diamondsGross, goldSpent, fee, totalGoldPaid } = computeInstantGoldToDiamonds(amount);
            return {
                pay: goldSpent,
                payCurrency: 'gold' as const,
                receive: diamonds,
                receiveGross: diamondsGross,
                receiveCurrency: 'diamonds' as const,
                fee,
                feeCurrency: 'gold' as const,
                totalPay: totalGoldPaid,
                cappedAmount: amount,
            };
        }
        const { gold, goldGross, diamondsSpent, fee, totalDiamondsPaid } = computeInstantDiamondsToGold(amount);
        return {
            pay: diamondsSpent,
            payCurrency: 'diamonds' as const,
            receive: gold,
            receiveGross: goldGross,
            receiveCurrency: 'gold' as const,
            fee,
            feeCurrency: 'diamonds' as const,
            totalPay: totalDiamondsPaid,
            cappedAmount: amount,
        };
    }, [instantAmount, instantDirection, currentUser.exchangeState?.instantDaily]);

    const instantInputMax = useMemo(() => {
        const listCap = maxExchangeListPrice(instantDirection === 'gold_to_diamonds' ? 'gold' : 'diamonds');
        if (instantDirection === 'gold_to_diamonds') {
            const affordable = maxInstantBasePayAffordable(walletGold);
            return Math.min(listCap, affordable, instantDailyRemaining.maxGoldInput);
        }
        const affordable = maxInstantBasePayAffordable(walletDiamonds);
        return Math.min(listCap, affordable, instantDailyRemaining.maxDiamondsInput);
    }, [instantDirection, walletGold, walletDiamonds, instantDailyRemaining.maxGoldInput, instantDailyRemaining.maxDiamondsInput]);

    const instantDailyUsed = useMemo(() => {
        const usage = instantDailyRemaining.usage;
        if (instantDirection === 'gold_to_diamonds') {
            const diamondsReceived = Math.floor(usage.goldSpent / instantGoldPerDiamondWhenBuyingDiamonds());
            return {
                payUsed: usage.goldSpent,
                payMax: CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT,
                payCurrency: 'gold' as const,
                receiveUsed: diamondsReceived,
                receiveMax: CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_FROM_GOLD,
                receiveCurrency: 'diamonds' as const,
            };
        }
        const goldReceived = usage.diamondsSpent * instantGoldPerDiamondWhenSellingDiamonds();
        return {
            payUsed: usage.diamondsSpent,
            payMax: CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT,
            payCurrency: 'diamonds' as const,
            receiveUsed: goldReceived,
            receiveMax: CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_FROM_DIAMONDS,
            receiveCurrency: 'gold' as const,
        };
    }, [instantDailyRemaining.usage, instantDirection]);

    const orderToCurrency: SaleCurrency = orderFromCurrency === 'gold' ? 'diamonds' : 'gold';

    const orderInstantRateBatch =
        orderFromCurrency === 'gold'
            ? CURRENCY_EXCHANGE_INSTANT_GOLD_TO_DIAMONDS_BATCH
            : CURRENCY_EXCHANGE_INSTANT_DIAMONDS_TO_GOLD_BATCH;

    const orderMarketRate = useMemo(
        () => resolveMarketDisplayGoldPerDiamondFromSnapshot(marketRateSnapshot, orderFromCurrency),
        [marketRateSnapshot, orderFromCurrency],
    );

    const orderFromParsed = useMemo(() => Math.max(0, Math.floor(Number(orderFromAmount) || 0)), [orderFromAmount]);
    const orderToParsed = useMemo(() => Math.max(0, Math.floor(Number(orderToAmount) || 0)), [orderToAmount]);
    const orderRegistrationFee = useMemo(
        () => exchangeListingFeeFromPrice(clampGameInt(orderFromParsed, { min: 0 })),
        [orderFromParsed],
    );

    const myOpenOrder = myOpenOrders[0] ?? null;

    const runAction = async (action: ServerAction): Promise<boolean> => {
        const result = await onAction?.(action);
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            window.alert(String((result as { error: string }).error));
            return false;
        }
        return true;
    };

    const handleInstantDirectionChange = (direction: InstantDirection) => {
        setInstantDirection(direction);
        setInstantAmount('0');
    };

    const handleInstantAmountChange = (raw: string) => {
        setInstantAmount(
            clampDigitsOnlyInputString(raw, {
                max: instantInputMax,
            }),
        );
    };

    const handleInstantExchange = async () => {
        const rawAmount = Math.max(0, Math.floor(Number(instantAmount) || 0));
        if (rawAmount <= 0) {
            window.alert(t('currency.alerts.invalidAmount'));
            return;
        }
        const amount = clampInstantExchangeInputToDailyLimit(
            instantDirection,
            rawAmount,
            currentUser.exchangeState?.instantDaily,
        );
        if (amount <= 0) {
            window.alert(t('currency.alerts.dailyInstantLimitExceeded'));
            return;
        }
        if (instantDirection === 'gold_to_diamonds' && amount < CURRENCY_EXCHANGE_INSTANT_MIN_GOLD) {
            window.alert(t('currency.alerts.instantMinGold', { count: CURRENCY_EXCHANGE_INSTANT_MIN_GOLD }));
            return;
        }
        if (instantDirection === 'diamonds_to_gold' && amount < CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS) {
            window.alert(t('currency.alerts.instantMinDiamonds', { count: CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS }));
            return;
        }
        if (instantPreview.receive <= 0) {
            window.alert(t('currency.alerts.instantTooSmall'));
            return;
        }
        if (instantPreview.payCurrency === 'gold' && walletGold < instantPreview.totalPay) {
            window.alert(t('alerts.insufficientGold'));
            return;
        }
        if (instantPreview.payCurrency === 'diamonds' && walletDiamonds < instantPreview.totalPay) {
            window.alert(t('alerts.insufficientDiamonds'));
            return;
        }
        const dailyError = validateInstantExchangeDailyLimit(
            instantDirection,
            currentUser.exchangeState?.instantDaily,
            instantPreview.payCurrency === 'gold' ? instantPreview.pay : 0,
            instantPreview.payCurrency === 'diamonds' ? instantPreview.pay : 0,
            instantPreview.receiveCurrency === 'diamonds' ? instantPreview.receiveGross : 0,
            instantPreview.receiveCurrency === 'gold' ? instantPreview.receiveGross : 0,
        );
        if (dailyError) {
            window.alert(dailyError);
            return;
        }
        const ok = await runAction({
            type: 'INSTANT_CURRENCY_EXCHANGE',
            payload: { direction: instantDirection, amount },
        });
        if (ok) void refreshMarketOrders();
    };

    const handleOrderFromCurrencyChange = (currency: SaleCurrency) => {
        setOrderFromCurrency(currency);
        setOrderFromAmount('0');
        setOrderToAmount('0');
    };

    const computeOrderToAmountString = useCallback(
        (fromRaw: string): string => {
            const from = Math.max(0, Math.floor(Number(fromRaw) || 0));
            if (from <= 0) return '0';
            const computed = computeDesiredExchangeAmountFromMarketRate(
                orderFromCurrency,
                from,
                orderMarketRate.goldPerDiamond,
            );
            const capped = Math.min(computed, maxExchangeListPrice(orderToCurrency));
            return String(capped);
        },
        [orderFromCurrency, orderMarketRate.goldPerDiamond, orderToCurrency],
    );

    const handleOrderFromAmountChange = (raw: string) => {
        const clamped = clampDigitsOnlyInputString(raw, {
            max: maxExchangeListPrice(orderFromCurrency),
        });
        setOrderFromAmount(clamped);
        setOrderToAmount(computeOrderToAmountString(clamped));
    };

    const handleOrderToAmountChange = (raw: string) => {
        setOrderToAmount(
            clampDigitsOnlyInputString(raw, {
                max: maxExchangeListPrice(orderToCurrency),
            }),
        );
    };

    const handlePostOrderClick = () => {
        const from = orderFromParsed;
        const to = orderToParsed;
        if (from <= 0 || to <= 0) {
            window.alert(t('currency.alerts.invalidAmount'));
            return;
        }
        if (myOpenOrders.length >= CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER) {
            window.alert(t('currency.alerts.maxOpenOrders', { count: CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER }));
            return;
        }
        if (orderFromCurrency === 'gold' && walletGold < from) {
            window.alert(t('alerts.insufficientGold'));
            return;
        }
        if (orderFromCurrency === 'diamonds' && walletDiamonds < from) {
            window.alert(t('alerts.insufficientDiamonds'));
            return;
        }
        setPostOrderConfirmOpen(true);
    };

    const handlePostOrderConfirm = async () => {
        const from = orderFromParsed;
        const to = orderToParsed;
        setPostOrderConfirmOpen(false);
        const ok = await runAction({
            type: 'POST_CURRENCY_EXCHANGE_ORDER',
            payload: { fromCurrency: orderFromCurrency, fromAmount: from, toAmount: to },
        });
        if (ok) {
            setOrderFromAmount('0');
            setOrderToAmount('0');
            void refreshMarketOrders();
        }
    };

    const handleFulfillOrder = async (order: CurrencyExchangeOrder) => {
        if (order.posterId === currentUser.id) {
            window.alert(t('currency.alerts.cannotFulfillOwn'));
            return;
        }
        if (order.toCurrency === 'gold' && walletGold < order.toAmount) {
            window.alert(t('alerts.insufficientGold'));
            return;
        }
        if (order.toCurrency === 'diamonds' && walletDiamonds < order.toAmount) {
            window.alert(t('alerts.insufficientDiamonds'));
            return;
        }
        const ok = await runAction({
            type: 'FULFILL_CURRENCY_EXCHANGE_ORDER',
            payload: { orderId: order.id, posterId: order.posterId },
        });
        if (ok) void refreshMarketOrders();
    };

    const handleCancelOrder = async (orderId: string) => {
        const ok = await runAction({ type: 'CANCEL_CURRENCY_EXCHANGE_ORDER', payload: { orderId } });
        if (ok) void refreshMarketOrders();
    };

    const visibleMarketOrders = useMemo(() => {
        const merged = new Map<string, CurrencyExchangeOrder>();
        for (const order of marketOrders) {
            if (order.status === 'open') merged.set(order.id, order);
        }
        for (const order of myOpenOrders) {
            merged.set(order.id, order);
        }
        return Array.from(merged.values()).sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    }, [marketOrders, myOpenOrders]);

    const filteredMarketOrders = useMemo(() => {
        const filtered =
            marketListTab === 'all'
                ? visibleMarketOrders
                : visibleMarketOrders.filter((o) =>
                      marketListTab === 'gold_to_diamonds' ? o.fromCurrency === 'gold' : o.fromCurrency === 'diamonds',
                  );
        if (marketSortColumn === 'latest') return filtered;
        const copied = [...filtered];
        copied.sort((a, b) => {
            let gap = 0;
            if (marketSortColumn === 'quantity') {
                gap = a.fromAmount - b.fromAmount;
            } else if (marketSortColumn === 'unitPrice') {
                gap = computeOrderUnitGoldPerDiamond(a) - computeOrderUnitGoldPerDiamond(b);
            } else {
                gap = a.toAmount - b.toAmount;
            }
            if (gap !== 0) return marketSortDirection === 'asc' ? gap : -gap;
            return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
        });
        return copied;
    }, [visibleMarketOrders, marketListTab, marketSortColumn, marketSortDirection]);

    const toggleMarketSort = (column: Exclude<MarketSortColumn, 'latest'>) => {
        if (marketSortColumn === column) {
            setMarketSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setMarketSortColumn(column);
        setMarketSortDirection('asc');
    };

    const marketTabCounts = useMemo(
        () => ({
            all: visibleMarketOrders.length,
            goldToDiamonds: visibleMarketOrders.filter((o) => o.fromCurrency === 'gold').length,
            diamondsToGold: visibleMarketOrders.filter((o) => o.fromCurrency === 'diamonds').length,
        }),
        [visibleMarketOrders],
    );

    const listPanelClass = `relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-600/45 bg-gradient-to-br from-slate-800/75 via-slate-900/90 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${mobileExchange ? 'p-3' : 'p-4'}`;
    const sidePanelClass = `relative overflow-hidden rounded-xl border border-slate-600/45 bg-gradient-to-br from-slate-800/80 via-slate-900/92 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${mobileExchange ? 'p-3' : 'p-4'}`;
    const instantPanelClass = `relative overflow-hidden rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-950/50 via-slate-900/95 to-indigo-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_48px_-16px_rgba(34,211,238,0.2)] ${mobileExchange ? 'p-3' : 'p-4'}`;
    /** 환전 화면 타이포 — 모바일·데스크톱 공통 가독성 스케일 */
    const exchTy = {
        sectionTitle: mobileExchange ? 'text-sm font-bold tracking-wide text-slate-50' : 'text-base font-bold tracking-wide text-slate-50',
        subLabel: mobileExchange ? 'text-xs font-semibold text-slate-400' : 'text-sm font-semibold text-slate-400',
        metaLabel: mobileExchange ? 'text-xs font-semibold uppercase tracking-wide text-slate-500' : 'text-sm font-semibold uppercase tracking-wide text-slate-500',
        label: mobileExchange ? 'text-xs font-semibold text-slate-300' : 'text-sm font-semibold text-slate-300',
        body: mobileExchange ? 'text-xs text-slate-400' : 'text-sm text-slate-400',
        amount: mobileExchange ? 'text-sm font-bold' : 'text-base font-bold',
        amountSm: mobileExchange ? 'text-xs font-semibold' : 'text-sm font-semibold',
        tableHeader: mobileExchange ? 'text-xs font-semibold leading-snug' : 'text-sm font-semibold',
        tableCell: mobileExchange ? 'text-xs leading-snug' : 'text-sm',
    };
    const inputClass = mobileExchange
        ? 'w-full rounded-lg border border-slate-500/40 bg-slate-950/70 px-3 py-2.5 text-base font-semibold text-slate-50 tabular-nums shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20'
        : 'w-full rounded-lg border border-slate-500/40 bg-slate-950/70 px-3 py-2.5 text-lg font-semibold text-slate-50 tabular-nums shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20';
    const directionBtnBase = mobileExchange
        ? 'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-bold transition-all duration-200'
        : 'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-bold transition-all duration-200';
    const directionBtnActive =
        'border-cyan-300/55 bg-gradient-to-b from-cyan-500/25 via-cyan-900/40 to-slate-950 text-cyan-50 shadow-[0_0_24px_-8px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]';
    const directionBtnIdle =
        'border-slate-600/50 bg-slate-950/40 text-slate-400 hover:border-slate-500/70 hover:text-slate-200';
    const marketOrderListCols = mobileExchange
        ? 'grid-cols-[minmax(4.5rem,auto)_minmax(3.25rem,1fr)_minmax(3.75rem,1fr)_minmax(3.75rem,1fr)_3.75rem] gap-1'
        : 'grid-cols-[minmax(4.75rem,auto)_minmax(4.5rem,1fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)_5.5rem] gap-2';
    const myListingBadgeClass = mobileExchange
        ? 'shrink-0 rounded-full border border-violet-400/60 bg-violet-950/95 px-0.5 py-px text-[8px] font-bold leading-tight text-violet-100 shadow-md ring-1 ring-black/20'
        : 'shrink-0 rounded-full border border-violet-400/60 bg-violet-950/95 px-1 py-px text-[10px] font-bold leading-tight text-violet-100 shadow-md ring-1 ring-black/20';
    const marketOrderListHeaderText = exchTy.tableHeader;
    const marketOrderListCellText = exchTy.tableCell;
    const marketOrderListActionBase = mobileExchange
        ? '!mx-0 !min-h-0 !w-full !rounded-md !border !px-1 !py-1.5 !text-xs !font-bold !tracking-wide !shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:!brightness-110 active:scale-[0.97]'
        : '!mx-0 !min-h-0 !w-full !rounded-md !border !px-1 !py-1.5 !text-sm !font-bold !tracking-wide !shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:!brightness-110 active:scale-[0.97]';
    const marketOrderBuyBtnClass = `${marketOrderListActionBase} !border-amber-300/50 !bg-gradient-to-b !from-amber-300/95 !via-amber-500/92 !to-orange-700/95 !text-amber-950 !shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_20px_-8px_rgba(251,191,36,0.55)] hover:!border-amber-200/70`;
    const marketOrderCancelBtnClass = `${marketOrderListActionBase} !border-rose-400/35 !bg-gradient-to-b !from-rose-800/90 !via-rose-950/95 !to-slate-950/95 !text-rose-50 !shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_20px_-10px_rgba(244,63,94,0.45)] hover:!border-rose-300/55`;
    const cancelOrderBtnClass = mobileExchange
        ? '!mx-0 !w-full !max-w-[9.5rem] !min-h-0 !rounded-lg !border !border-rose-400/30 !bg-gradient-to-b !from-rose-950/70 !via-slate-950/90 !to-rose-950/80 !px-3 !py-1.5 !text-xs !font-bold !tracking-wide !text-rose-100 !shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_22px_-12px_rgba(244,63,94,0.45)] transition hover:!border-rose-300/45 hover:!brightness-110 active:scale-[0.98]'
        : '!mx-0 !w-full !max-w-[9.5rem] !min-h-0 !rounded-lg !border !border-rose-400/30 !bg-gradient-to-b !from-rose-950/70 !via-slate-950/90 !to-rose-950/80 !px-3 !py-1.5 !text-sm !font-bold !tracking-wide !text-rose-100 !shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_22px_-12px_rgba(244,63,94,0.45)] transition hover:!border-rose-300/45 hover:!brightness-110 active:scale-[0.98]';
    const mobileSectionTabButtonBase =
        'rounded-md border px-1.5 py-1.5 text-[11px] font-semibold leading-tight tracking-wide transition-all duration-150';
    const mobileSectionTabButtonActive =
        'border-cyan-300/70 bg-gradient-to-b from-cyan-500/70 to-blue-700/80 text-white shadow-[0_10px_20px_-12px_rgba(56,189,248,0.9)]';
    const mobileSectionTabButtonIdle =
        'border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900/80 text-slate-300 hover:border-slate-400/80 hover:text-slate-100';

    const instantInputCurrency: SaleCurrency = instantDirection === 'gold_to_diamonds' ? 'gold' : 'diamonds';

    return (
        <>
            {postOrderConfirmOpen ? (
                <DraggableWindow
                    title={t('currency.postOrderConfirmTitle')}
                    windowId="currency-post-order-confirm"
                    onClose={() => setPostOrderConfirmOpen(false)}
                    initialWidth={420}
                    modal
                    closeOnOutsideClick
                    isTopmost
                    hideFooter
                >
                    <div className="space-y-4 p-4">
                        <div className="space-y-2.5 rounded-xl border border-slate-600/45 bg-slate-950/60 p-3">
                            <div className={`flex items-center justify-between gap-2 ${mobileExchange ? 'text-sm' : 'text-base'}`}>
                                <span className="font-semibold text-slate-400">{t('currency.offerAmount')}</span>
                                <CurrencyAmountDisplay
                                    amount={orderFromParsed}
                                    currency={orderFromCurrency}
                                    iconClassName="h-5 w-5"
                                    amountClassName={`${exchTy.amount} text-slate-100`}
                                />
                            </div>
                            <div className={`flex items-center justify-between gap-2 ${mobileExchange ? 'text-sm' : 'text-base'}`}>
                                <span className="font-semibold text-slate-400">{t('currency.feePercent')}</span>
                                <CurrencyAmountDisplay
                                    amount={orderRegistrationFee}
                                    currency={orderFromCurrency}
                                    iconClassName="h-5 w-5"
                                    amountClassName={`${exchTy.amount} text-rose-300/90`}
                                />
                            </div>
                            <div className={`flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 ${mobileExchange ? 'text-sm' : 'text-base'}`}>
                                <span className="font-semibold text-slate-400">{t('currency.requestAmount')}</span>
                                <CurrencyAmountDisplay
                                    amount={orderToParsed}
                                    currency={orderToCurrency}
                                    iconClassName="h-5 w-5"
                                    amountClassName={`${exchTy.amount} text-cyan-100`}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => setPostOrderConfirmOpen(false)}
                                colorScheme="gray"
                                className="flex-1 !rounded-lg"
                            >
                                {tCommon('actions.cancel')}
                            </Button>
                            <Button
                                onClick={() => void handlePostOrderConfirm()}
                                className={`${primaryButtonClass} flex-1 !rounded-lg`}
                            >
                                {t('currency.postOrder')}
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            ) : null}

            <div
                className={`flex h-full min-h-0 flex-col gap-2 ${mobileExchange ? 'overflow-hidden' : `overflow-y-auto ${BAG_SCROLLBAR_Y_CLASS} gap-3 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:overflow-hidden`}`}
            >
                {mobileExchange ? (
                    <div className="grid shrink-0 grid-cols-3 gap-1 rounded-lg border border-slate-700/60 bg-slate-900/70 p-1">
                        {(
                            [
                                { id: 'market' as const, label: t('currency.marketOrders') },
                                { id: 'instant' as const, label: t('currency.instantTitle') },
                                { id: 'register' as const, label: t('currency.postOrderTitle') },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setMobileSectionTab(tab.id)}
                                className={`${mobileSectionTabButtonBase} ${
                                    mobileSectionTab === tab.id ? mobileSectionTabButtonActive : mobileSectionTabButtonIdle
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                ) : null}

                {/* 좌측: 환전 요청 목록 */}
                {(!mobileExchange || mobileSectionTab === 'market') ? (
                <div className={`flex h-full min-h-0 flex-col ${mobileExchange ? 'min-h-0 flex-1 overflow-hidden' : 'lg:overflow-hidden lg:pr-1'}`}>
                    <div className={`${listPanelClass} h-full`}>
                        <SectionHeader
                            title={t('currency.marketOrders')}
                            accent="slate"
                            titleClassName={exchTy.sectionTitle}
                            action={
                                <ResourceActionButton
                                    variant="neutral"
                                    onClick={() => void refreshMarketOrders()}
                                    disabled={isRefreshingOrders}
                                    className={`!min-h-0 !rounded-lg !border-slate-500/50 !px-2.5 !py-1 ${mobileExchange ? '!text-xs' : '!text-sm'}`}
                                >
                                    {t('labels.refresh')}
                                </ResourceActionButton>
                            }
                        />
                        <div className="mb-3 flex gap-1.5 rounded-xl border border-white/[0.05] bg-black/20 p-1">
                            <button
                                type="button"
                                onClick={() => setMarketListTab('all')}
                                aria-label={t('currency.marketTabAll')}
                                className={`${directionBtnBase} ${
                                    marketListTab === 'all'
                                        ? 'border-cyan-400/50 bg-gradient-to-b from-cyan-500/20 via-cyan-900/35 to-slate-950 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : directionBtnIdle
                                }`}
                            >
                                <span>{t('currency.marketTabAll')}</span>
                                {marketTabCounts.all > 0 ? (
                                    <span className={`ml-0.5 min-w-[1.125rem] rounded-full bg-black/40 px-1 text-xs font-bold tabular-nums text-slate-200`}>
                                        {marketTabCounts.all}
                                    </span>
                                ) : null}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarketListTab('gold_to_diamonds')}
                                aria-label={t('currency.marketTabBuyGold')}
                                className={`${directionBtnBase} ${
                                    marketListTab === 'gold_to_diamonds'
                                        ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-amber-900/35 to-slate-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : directionBtnIdle
                                }`}
                            >
                                <CurrencyIcon currency="gold" className="h-4 w-4" />
                                <span>{t('currency.marketTabBuyGold')}</span>
                                {marketTabCounts.goldToDiamonds > 0 ? (
                                    <span className={`ml-0.5 min-w-[1.125rem] rounded-full bg-black/40 px-1 text-xs font-bold tabular-nums text-slate-200`}>
                                        {marketTabCounts.goldToDiamonds}
                                    </span>
                                ) : null}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarketListTab('diamonds_to_gold')}
                                aria-label={t('currency.marketTabBuyDiamonds')}
                                className={`${directionBtnBase} ${
                                    marketListTab === 'diamonds_to_gold'
                                        ? 'border-violet-400/50 bg-gradient-to-b from-violet-500/20 via-violet-900/35 to-slate-950 text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : directionBtnIdle
                                }`}
                            >
                                <CurrencyIcon currency="diamonds" className="h-4 w-4" />
                                <span>{t('currency.marketTabBuyDiamonds')}</span>
                                {marketTabCounts.diamondsToGold > 0 ? (
                                    <span className={`ml-0.5 min-w-[1.125rem] rounded-full bg-black/40 px-1 text-xs font-bold tabular-nums text-slate-200`}>
                                        {marketTabCounts.diamondsToGold}
                                    </span>
                                ) : null}
                            </button>
                        </div>
                        <div className={`min-h-[12rem] flex-1 overflow-y-auto pr-0.5 ${BAG_SCROLLBAR_Y_CLASS} lg:min-h-0`}>
                            {!ordersLoaded ? (
                                <p className={`py-10 text-center ${exchTy.body}`}>{t('loading.wait')}</p>
                            ) : filteredMarketOrders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                    <div className="flex items-center gap-2 opacity-40">
                                        {marketListTab === 'all' ? (
                                            <>
                                                <CurrencyIcon currency="gold" className="h-7 w-7" />
                                                <span className="text-slate-500">↔</span>
                                                <CurrencyIcon currency="diamonds" className="h-7 w-7" />
                                            </>
                                        ) : marketListTab === 'gold_to_diamonds' ? (
                                            <>
                                                <CurrencyIcon currency="gold" className="h-8 w-8" />
                                                <span className="text-slate-500">→</span>
                                                <CurrencyIcon currency="diamonds" className="h-8 w-8" />
                                            </>
                                        ) : (
                                            <>
                                                <CurrencyIcon currency="diamonds" className="h-8 w-8" />
                                                <span className="text-slate-500">→</span>
                                                <CurrencyIcon currency="gold" className="h-8 w-8" />
                                            </>
                                        )}
                                    </div>
                                    <p className={exchTy.body}>
                                        {visibleMarketOrders.length === 0
                                            ? t('currency.noMarketOrders')
                                            : marketListTab === 'gold_to_diamonds'
                                              ? t('currency.noMarketOrdersGoldToDiamonds')
                                              : t('currency.noMarketOrdersDiamondsToGold')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div
                                        className={`sticky top-0 z-10 mb-2 grid rounded border border-slate-600/70 bg-slate-900/95 text-slate-300 backdrop-blur-sm ${marketOrderListCols} ${mobileExchange ? 'px-1.5 py-1' : 'px-2 py-1.5'} ${marketOrderListHeaderText}`}
                                    >
                                        <div className="text-center" aria-hidden />
                                        <div className="flex items-center justify-center gap-1">
                                            <span>{t('currency.marketListColQuantity')}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleMarketSort('quantity')}
                                                className={`leading-none ${marketSortColumn === 'quantity' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {marketSortColumn === 'quantity' && marketSortDirection === 'asc' ? '▲' : '▼'}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-center gap-1">
                                            <span>{t('currency.marketListColUnitPrice')}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleMarketSort('unitPrice')}
                                                className={`leading-none ${marketSortColumn === 'unitPrice' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {marketSortColumn === 'unitPrice' && marketSortDirection === 'asc' ? '▲' : '▼'}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-center gap-1">
                                            <span>{t('currency.marketListColPrice')}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleMarketSort('price')}
                                                className={`leading-none ${marketSortColumn === 'price' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {marketSortColumn === 'price' && marketSortDirection === 'asc' ? '▲' : '▼'}
                                            </button>
                                        </div>
                                        <div className="text-center">{t('currency.marketListColAction')}</div>
                                    </div>
                                    <div className={mobileExchange ? 'space-y-1.5' : 'space-y-2'}>
                                        {filteredMarketOrders.map((order) => {
                                            const isOwnOrder = order.posterId === currentUser.id;
                                            const unitGoldPerDiamond = computeOrderUnitGoldPerDiamond(order);
                                            return (
                                                <div
                                                    key={order.id}
                                                    className={`grid w-full min-w-0 items-center rounded-lg border border-slate-700/60 bg-slate-900/50 ${marketOrderListCols} ${mobileExchange ? 'px-1.5 py-1.5' : 'px-2 py-2'}`}
                                                >
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <div
                                                            className={`flex shrink-0 items-center justify-center rounded bg-black/25 ${mobileExchange ? 'h-9 w-9' : 'h-10 w-10'}`}
                                                        >
                                                            <CurrencyIcon
                                                                currency={order.fromCurrency}
                                                                className={mobileExchange ? 'h-6 w-6' : 'h-7 w-7'}
                                                            />
                                                        </div>
                                                        {isOwnOrder ? (
                                                            <span className={myListingBadgeClass}>{t('labels.myListingBadge')}</span>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex justify-center">
                                                        <CurrencyAmountDisplay
                                                            amount={order.fromAmount}
                                                            currency={order.fromCurrency}
                                                            iconClassName={mobileExchange ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                                                            amountClassName={`${marketOrderListCellText} font-bold tabular-nums text-slate-100`}
                                                        />
                                                    </div>
                                                    <div className="flex justify-center">
                                                        {order.fromCurrency === 'gold' ? (
                                                            <CurrencyArrowPair
                                                                fromAmount={unitGoldPerDiamond}
                                                                fromCurrency="gold"
                                                                toAmount={1}
                                                                toCurrency="diamonds"
                                                                iconClassName={mobileExchange ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                                                                amountClassName={`${marketOrderListCellText} font-semibold text-cyan-100`}
                                                                className="justify-center"
                                                            />
                                                        ) : (
                                                            <CurrencyArrowPair
                                                                fromAmount={1}
                                                                fromCurrency="diamonds"
                                                                toAmount={unitGoldPerDiamond}
                                                                toCurrency="gold"
                                                                iconClassName={mobileExchange ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                                                                amountClassName={`${marketOrderListCellText} font-semibold text-cyan-100`}
                                                                className="justify-center"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex justify-center">
                                                        <CurrencyAmountDisplay
                                                            amount={order.toAmount}
                                                            currency={order.toCurrency}
                                                            iconClassName={mobileExchange ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                                                            amountClassName={`${marketOrderListCellText} font-bold tabular-nums text-amber-100`}
                                                        />
                                                    </div>
                                                    <div className="flex justify-center">
                                                        {isOwnOrder ? (
                                                            <Button
                                                                onClick={() => void handleCancelOrder(order.id)}
                                                                colorScheme="none"
                                                                className={marketOrderCancelBtnClass}
                                                            >
                                                                {t('currency.cancelOrder')}
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                onClick={() => void handleFulfillOrder(order)}
                                                                colorScheme="none"
                                                                className={marketOrderBuyBtnClass}
                                                            >
                                                                {t('modals.purchase')}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                ) : null}

                {/* 우측: 바로환전 → 환전 요청 등록 */}
                {(!mobileExchange || mobileSectionTab === 'instant' || mobileSectionTab === 'register') ? (
                <div
                    className={`flex h-full min-h-0 flex-col gap-2 ${mobileExchange ? 'min-h-0 flex-1 overflow-y-auto' : `overflow-y-auto ${BAG_SCROLLBAR_Y_CLASS}`} ${mobileExchange ? '' : 'lg:pl-0.5'}`}
                >
                    {(!mobileExchange || mobileSectionTab === 'instant') ? (
                    <div className={instantPanelClass}>
                        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" aria-hidden />
                        <SectionHeader title={t('currency.instantTitle')} accent="cyan" titleClassName={exchTy.sectionTitle} />

                        <div className="flex gap-1.5 rounded-xl border border-white/[0.05] bg-black/20 p-1">
                            <button
                                type="button"
                                onClick={() => handleInstantDirectionChange('gold_to_diamonds')}
                                aria-label={t('currency.goldToDiamonds')}
                                className={`${directionBtnBase} ${
                                    instantDirection === 'gold_to_diamonds' ? directionBtnActive : directionBtnIdle
                                }`}
                            >
                                <CurrencyIcon currency="gold" className="h-5 w-5" />
                                <span className="text-slate-500">→</span>
                                <CurrencyIcon currency="diamonds" className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleInstantDirectionChange('diamonds_to_gold')}
                                aria-label={t('currency.diamondsToGold')}
                                className={`${directionBtnBase} ${
                                    instantDirection === 'diamonds_to_gold' ? directionBtnActive : directionBtnIdle
                                }`}
                            >
                                <CurrencyIcon currency="diamonds" className="h-5 w-5" />
                                <span className="text-slate-500">→</span>
                                <CurrencyIcon currency="gold" className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-3 overflow-hidden rounded-xl border border-cyan-400/15 bg-black/30 shadow-[0_8px_24px_-12px_rgba(34,211,238,0.15)]">
                            <div className="flex flex-col gap-3 border-b border-white/[0.06] px-3 py-2.5 sm:flex-row sm:items-start sm:gap-4">
                                <div className="min-w-0 flex-1 text-center">
                                    <p className={`mb-1.5 ${exchTy.subLabel}`}>
                                        {t('currency.instantRate')}
                                    </p>
                                    <div className="flex justify-center">
                                        {instantDirection === 'gold_to_diamonds' ? (
                                            <CurrencyArrowPair
                                                fromAmount={CURRENCY_EXCHANGE_INSTANT_GOLD_TO_DIAMONDS_BATCH.gold}
                                                fromCurrency="gold"
                                                toAmount={CURRENCY_EXCHANGE_INSTANT_GOLD_TO_DIAMONDS_BATCH.diamonds}
                                                toCurrency="diamonds"
                                                iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                amountClassName={`${exchTy.amountSm} text-slate-100`}
                                            />
                                        ) : (
                                            <CurrencyArrowPair
                                                fromAmount={CURRENCY_EXCHANGE_INSTANT_DIAMONDS_TO_GOLD_BATCH.diamonds}
                                                fromCurrency="diamonds"
                                                toAmount={CURRENCY_EXCHANGE_INSTANT_DIAMONDS_TO_GOLD_BATCH.gold}
                                                toCurrency="gold"
                                                iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                amountClassName={`${exchTy.amountSm} text-slate-100`}
                                            />
                                        )}
                                    </div>
                                    <p className={`mt-1 ${exchTy.metaLabel} text-rose-300/80`}>
                                        {t('currency.feePercent')}
                                    </p>
                                </div>

                                <div className="hidden w-px self-stretch bg-white/[0.06] sm:block" aria-hidden />

                                <div className="min-w-0 flex-1 text-center">
                                    <p className={`mb-1.5 ${exchTy.subLabel}`}>
                                        {t('currency.dailyInstantLimit')}
                                    </p>
                                    <div className="space-y-1.5">
                                        <div className={`flex justify-center ${mobileExchange ? 'text-xs' : 'text-sm'}`}>
                                            <span className="inline-flex items-center gap-1 tabular-nums">
                                                <CurrencyAmountDisplay
                                                    amount={instantDailyUsed.payUsed}
                                                    currency={instantDailyUsed.payCurrency}
                                                    iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                    amountClassName={`${exchTy.amountSm} text-slate-200`}
                                                />
                                                <span className="text-slate-600">/</span>
                                                <CurrencyAmountDisplay
                                                    amount={instantDailyUsed.payMax}
                                                    currency={instantDailyUsed.payCurrency}
                                                    iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                    amountClassName={`${exchTy.amountSm} text-slate-400`}
                                                />
                                            </span>
                                        </div>
                                        <div className={`flex justify-center ${mobileExchange ? 'text-xs' : 'text-sm'}`}>
                                            <span className="inline-flex items-center gap-1 tabular-nums">
                                                <CurrencyAmountDisplay
                                                    amount={instantDailyUsed.receiveUsed}
                                                    currency={instantDailyUsed.receiveCurrency}
                                                    iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                    amountClassName={`${exchTy.amountSm} text-slate-200`}
                                                />
                                                <span className="text-slate-600">/</span>
                                                <CurrencyAmountDisplay
                                                    amount={instantDailyUsed.receiveMax}
                                                    currency={instantDailyUsed.receiveCurrency}
                                                    iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                    amountClassName={`${exchTy.amountSm} text-slate-400`}
                                                />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2.5 px-3 py-3">
                                <div className="space-y-2.5">
                                    <div className="flex items-end justify-center gap-2">
                                        <div className="min-w-0 flex-1 text-center">
                                            <label className={`mb-1.5 flex items-center justify-center gap-1 ${exchTy.subLabel}`}>
                                                {t('currency.inputAmount')}
                                                <CurrencyIcon currency={instantInputCurrency} className={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'} />
                                            </label>
                                            <input
                                                className={`${inputClass} !text-center`}
                                                value={instantAmount}
                                                onChange={(e) => handleInstantAmountChange(e.target.value)}
                                                inputMode="numeric"
                                                disabled={instantInputMax <= 0}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="shrink-0 pb-2 text-center">
                                            <p className={`mb-1 ${exchTy.metaLabel}`}>
                                                {t('currency.feePercent')}
                                            </p>
                                            <CurrencyAmountDisplay
                                                amount={instantPreview.fee}
                                                currency={instantPreview.feeCurrency}
                                                iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                amountClassName={`${exchTy.amountSm} text-rose-300/90`}
                                                className="justify-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className={`mb-1.5 flex items-center justify-center gap-1 ${exchTy.subLabel}`}>
                                            {t('currency.receive')}
                                            <CurrencyIcon currency={instantPreview.receiveCurrency} className={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'} />
                                        </p>
                                        <div className="flex min-h-[2.75rem] items-center justify-center rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2">
                                            <CurrencyAmountDisplay
                                                amount={instantPreview.receive}
                                                currency={instantPreview.receiveCurrency}
                                                iconClassName={mobileExchange ? 'h-5 w-5' : 'h-6 w-6'}
                                                amountClassName={`${exchTy.amount} text-violet-100`}
                                                className="justify-center"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => void handleInstantExchange()}
                                    className={`${primaryButtonClass} !w-full !rounded-lg`}
                                    disabled={instantInputMax <= 0 || instantPreview.receive <= 0}
                                >
                                    {t('currency.instantExchange')}
                                </Button>
                            </div>
                        </div>
                    </div>
                    ) : null}

                    {(!mobileExchange || mobileSectionTab === 'register') ? (
                    <div className={sidePanelClass}>
                        <SectionHeader title={t('currency.postOrderTitle')} accent="amber" titleClassName={exchTy.sectionTitle} />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                            <div className="flex min-w-0 flex-[0.88] flex-col gap-2 sm:max-w-[46%]">
                                <div className="shrink-0 rounded-xl border border-white/[0.06] bg-gradient-to-br from-slate-950/70 via-black/30 to-slate-950/80 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <div className="flex flex-col gap-2">
                                        <div className="text-center">
                                            <p className={`mb-1 ${exchTy.metaLabel}`}>
                                                {t('currency.instantRate')}
                                            </p>
                                            <div className="flex justify-center">
                                                {orderFromCurrency === 'gold' ? (
                                                    <CurrencyArrowPair
                                                        fromAmount={orderInstantRateBatch.gold}
                                                        fromCurrency="gold"
                                                        toAmount={orderInstantRateBatch.diamonds}
                                                        toCurrency="diamonds"
                                                        iconClassName={mobileExchange ? 'h-4 w-4' : 'h-4 w-4'}
                                                        amountClassName={`${exchTy.amountSm} text-slate-100`}
                                                    />
                                                ) : (
                                                    <CurrencyArrowPair
                                                        fromAmount={orderInstantRateBatch.diamonds}
                                                        fromCurrency="diamonds"
                                                        toAmount={orderInstantRateBatch.gold}
                                                        toCurrency="gold"
                                                        iconClassName={mobileExchange ? 'h-4 w-4' : 'h-4 w-4'}
                                                        amountClassName={`${exchTy.amountSm} text-slate-100`}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="h-px bg-white/[0.07]" aria-hidden />

                                        <div className="text-center">
                                            <p className={`mb-1 ${exchTy.metaLabel}`}>
                                                {t('currency.averageMarketRate')}
                                            </p>
                                            <div className="flex justify-center">
                                                {orderFromCurrency === 'gold' ? (
                                                    <CurrencyArrowPair
                                                        fromAmount={orderMarketRate.goldPerDiamond}
                                                        fromCurrency="gold"
                                                        toAmount={1}
                                                        toCurrency="diamonds"
                                                        iconClassName={mobileExchange ? 'h-4 w-4' : 'h-4 w-4'}
                                                        amountClassName={`${exchTy.amountSm} text-cyan-100`}
                                                    />
                                                ) : (
                                                    <CurrencyArrowPair
                                                        fromAmount={1}
                                                        fromCurrency="diamonds"
                                                        toAmount={orderMarketRate.goldPerDiamond}
                                                        toCurrency="gold"
                                                        iconClassName={mobileExchange ? 'h-4 w-4' : 'h-4 w-4'}
                                                        amountClassName={`${exchTy.amountSm} text-cyan-100`}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex min-h-[6.5rem] flex-1 flex-col rounded-xl border border-amber-400/10 bg-gradient-to-br from-amber-950/20 via-slate-950/75 to-slate-950/90 px-2.5 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <p className={`mb-2 ${exchTy.label} text-amber-200/80`}>
                                        {t('currency.myExchangeRequest')}
                                    </p>
                                    {myOpenOrder ? (
                                        <div className="flex flex-1 flex-col items-center justify-center gap-2.5">
                                            <div className="rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-2">
                                                <CurrencyArrowPair
                                                    fromAmount={myOpenOrder.fromAmount}
                                                    fromCurrency={myOpenOrder.fromCurrency}
                                                    toAmount={myOpenOrder.toAmount}
                                                    toCurrency={myOpenOrder.toCurrency}
                                                    iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                    amountClassName={`${exchTy.amountSm} text-slate-100`}
                                                    className="justify-center"
                                                />
                                            </div>
                                            <Button
                                                onClick={() => void handleCancelOrder(myOpenOrder.id)}
                                                colorScheme="none"
                                                className={cancelOrderBtnClass}
                                            >
                                                {t('currency.cancelOrder')}
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className={`flex flex-1 items-center justify-center ${exchTy.body} text-slate-500`}>
                                            {t('currency.noMyExchangeRequest')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="hidden w-px self-stretch bg-white/[0.06] sm:block" aria-hidden />

                            <div className="flex min-w-0 flex-[1.12] flex-col justify-center gap-2.5">
                                <div className="flex gap-1.5 rounded-xl border border-white/[0.05] bg-black/20 p-1">
                                    <button
                                        type="button"
                                        onClick={() => handleOrderFromCurrencyChange('gold')}
                                        aria-label={t('currency.goldToDiamonds')}
                                        className={`${directionBtnBase} ${
                                            orderFromCurrency === 'gold' ? directionBtnActive : directionBtnIdle
                                        }`}
                                    >
                                        <CurrencyIcon currency="gold" className="h-5 w-5" />
                                        <span className="text-slate-500">→</span>
                                        <CurrencyIcon currency="diamonds" className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOrderFromCurrencyChange('diamonds')}
                                        aria-label={t('currency.diamondsToGold')}
                                        className={`${directionBtnBase} ${
                                            orderFromCurrency === 'diamonds' ? directionBtnActive : directionBtnIdle
                                        }`}
                                    >
                                        <CurrencyIcon currency="diamonds" className="h-5 w-5" />
                                        <span className="text-slate-500">→</span>
                                        <CurrencyIcon currency="gold" className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    <div className="flex items-end justify-center gap-2">
                                        <div className="min-w-0 flex-1 text-center">
                                            <label className={`mb-1.5 flex items-center justify-center gap-1 ${exchTy.subLabel}`}>
                                                {t('currency.offerAmount')}
                                                <CurrencyIcon currency={orderFromCurrency} className={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'} />
                                            </label>
                                            <input
                                                className={`${inputClass} !text-center`}
                                                value={orderFromAmount}
                                                onChange={(e) => handleOrderFromAmountChange(e.target.value)}
                                                inputMode="numeric"
                                                placeholder="0"
                                                disabled={myOpenOrder != null}
                                            />
                                        </div>
                                        <div className="shrink-0 pb-2 text-center">
                                            <p className={`mb-1 ${exchTy.metaLabel}`}>
                                                {t('currency.feePercent')}
                                            </p>
                                            <CurrencyAmountDisplay
                                                amount={orderRegistrationFee}
                                                currency={orderFromCurrency}
                                                iconClassName={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'}
                                                amountClassName={`${exchTy.amountSm} text-rose-300/90`}
                                                className="justify-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <label className={`mb-1.5 flex items-center justify-center gap-1 ${exchTy.subLabel}`}>
                                            {t('currency.requestAmount')}
                                            <CurrencyIcon currency={orderToCurrency} className={mobileExchange ? 'h-4 w-4' : 'h-5 w-5'} />
                                        </label>
                                        <input
                                            className={`${inputClass} !text-center`}
                                            value={orderToAmount}
                                            onChange={(e) => handleOrderToAmountChange(e.target.value)}
                                            inputMode="numeric"
                                            placeholder="0"
                                            disabled={myOpenOrder != null}
                                        />
                                    </div>
                                </div>

                                <Button
                                    onClick={() => handlePostOrderClick()}
                                    className={`${primaryButtonClass} !w-full !rounded-lg`}
                                    disabled={
                                        myOpenOrder != null ||
                                        orderFromParsed <= 0 ||
                                        orderToParsed <= 0
                                    }
                                >
                                    {t('currency.postOrder')}
                                </Button>
                            </div>
                        </div>
                    </div>
                    ) : null}
                </div>
                ) : null}
            </div>
        </>
    );
};

export default ExchangeCurrencyTab;
