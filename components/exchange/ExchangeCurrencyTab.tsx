import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CurrencyExchangeOrder, CurrencyExchangeReceipt, InventoryItem, ServerAction, UserWithStatus } from '../../types.js';
import type { HandleActionResult } from '../../types/api.js';
import { ItemGrade } from '../../types/enums.js';
import Button from '../Button.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import ItemObtainedModal from '../ItemObtainedModal.js';
import BulkItemObtainedModal from '../BulkItemObtainedModal.js';
import { getApiUrl } from '../../utils/apiConfig.js';
import { clampDigitsOnlyInputString, exchangeListingFeeFromPrice } from '../../shared/utils/gameIntegerField.js';
import {
    averageGoldPerDiamond,
    computeInstantDiamondsToGold,
    computeInstantGoldToDiamonds,
    instantGoldPerDiamondWhenBuyingDiamonds,
    instantGoldPerDiamondWhenSellingDiamonds,
} from '../../shared/utils/currencyExchange.js';
import { formatWalletCurrencyAmount, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';
import { maxExchangeListPrice } from '../../shared/constants/numericLimits.js';
import { CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER } from '../../shared/constants/currencyExchange.js';

type SaleCurrency = 'gold' | 'diamonds';
type InstantDirection = 'gold_to_diamonds' | 'diamonds_to_gold';

const BAG_SCROLLBAR_Y_CLASS =
    '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/38 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/48';

function createCurrencyObtainItem(currency: SaleCurrency, quantity: number, label: string): InventoryItem {
    const now = Date.now();
    const isGold = currency === 'gold';
    return {
        id: `currency-exchange-reward-${isGold ? 'gold' : 'diamonds'}-${now}-${Math.random().toString(36).slice(2, 9)}`,
        name: label,
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

    const [instantDirection, setInstantDirection] = useState<InstantDirection>('gold_to_diamonds');
    const [instantAmount, setInstantAmount] = useState('1000');
    const [orderFromCurrency, setOrderFromCurrency] = useState<SaleCurrency>('gold');
    const [orderFromAmount, setOrderFromAmount] = useState('10000');
    const [orderToAmount, setOrderToAmount] = useState('90');
    const [marketOrders, setMarketOrders] = useState<CurrencyExchangeOrder[]>([]);
    const [ordersLoaded, setOrdersLoaded] = useState(false);
    const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
    const [selectedReceiptId, setSelectedReceiptId] = useState('');
    const [obtainItems, setObtainItems] = useState<InventoryItem[] | null>(null);

    const myOrders = useMemo(
        () => (currentUser.exchangeState?.currencyOrders ?? []).filter((o) => o.posterId === currentUser.id),
        [currentUser.exchangeState?.currencyOrders, currentUser.id],
    );
    const myOpenOrders = useMemo(() => myOrders.filter((o) => o.status === 'open'), [myOrders]);
    const myReceipts = useMemo(
        () => (currentUser.exchangeState?.currencyReceipts ?? []).filter((r) => !r.claimed),
        [currentUser.exchangeState?.currencyReceipts],
    );

    const refreshMarketOrders = useCallback(async () => {
        setIsRefreshingOrders(true);
        try {
            const response = await fetch(getApiUrl('/api/exchange/currency-orders'));
            if (!response.ok) throw new Error('fetch failed');
            const data = (await response.json()) as { orders?: CurrencyExchangeOrder[] };
            setMarketOrders(Array.isArray(data.orders) ? data.orders : []);
        } catch {
            setMarketOrders([]);
        } finally {
            setOrdersLoaded(true);
            setIsRefreshingOrders(false);
        }
    }, []);

    useEffect(() => {
        void refreshMarketOrders();
    }, [refreshMarketOrders]);

    const instantPreview = useMemo(() => {
        const amount = Math.max(0, Math.floor(Number(instantAmount) || 0));
        if (instantDirection === 'gold_to_diamonds') {
            const { diamonds, goldSpent } = computeInstantGoldToDiamonds(amount);
            return { pay: goldSpent, payCurrency: 'gold' as const, receive: diamonds, receiveCurrency: 'diamonds' as const };
        }
        const { gold, diamondsSpent } = computeInstantDiamondsToGold(amount);
        return { pay: diamondsSpent, payCurrency: 'diamonds' as const, receive: gold, receiveCurrency: 'gold' as const };
    }, [instantAmount, instantDirection]);

    const orderToCurrency: SaleCurrency = orderFromCurrency === 'gold' ? 'diamonds' : 'gold';

    const formatCurrency = (value: number, currency: SaleCurrency) =>
        currency === 'gold' ? formatWalletCurrencyAmount(value, 'gold') : formatWalletDiamonds(value);

    const runAction = async (action: ServerAction): Promise<boolean> => {
        const result = await onAction?.(action);
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            window.alert(String((result as { error: string }).error));
            return false;
        }
        return true;
    };

    const handleInstantExchange = async () => {
        const amount = Math.max(0, Math.floor(Number(instantAmount) || 0));
        if (amount <= 0) {
            window.alert(t('currency.alerts.invalidAmount'));
            return;
        }
        if (instantPreview.receive <= 0) {
            window.alert(t('currency.alerts.instantTooSmall'));
            return;
        }
        if (instantPreview.payCurrency === 'gold' && walletGold < instantPreview.pay) {
            window.alert(t('alerts.insufficientGold'));
            return;
        }
        if (instantPreview.payCurrency === 'diamonds' && walletDiamonds < instantPreview.pay) {
            window.alert(t('alerts.insufficientDiamonds'));
            return;
        }
        const ok = await runAction({
            type: 'INSTANT_CURRENCY_EXCHANGE',
            payload: { direction: instantDirection, amount },
        });
        if (ok) void refreshMarketOrders();
    };

    const handlePostOrder = async () => {
        const from = Math.max(0, Math.floor(Number(orderFromAmount) || 0));
        const to = Math.max(0, Math.floor(Number(orderToAmount) || 0));
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
        const ok = await runAction({
            type: 'POST_CURRENCY_EXCHANGE_ORDER',
            payload: { fromCurrency: orderFromCurrency, fromAmount: from, toAmount: to },
        });
        if (ok) void refreshMarketOrders();
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

    const handleClaimReceipt = async (orderId: string) => {
        const receipt = myReceipts.find((r) => r.orderId === orderId);
        if (!receipt) return;
        const fee = exchangeListingFeeFromPrice(receipt.amount);
        const net = Math.max(0, receipt.amount - fee);
        const result = await onAction?.({ type: 'CLAIM_CURRENCY_EXCHANGE_RECEIPT', payload: { orderId } });
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            window.alert(String((result as { error: string }).error));
            return;
        }
        const cr = (
            result as
                | { clientResponse?: { currencyExchangeClaimedGold?: number; currencyExchangeClaimedDiamonds?: number } }
                | undefined
        )?.clientResponse;
        const g = Math.max(0, Math.floor(Number(cr?.currencyExchangeClaimedGold ?? 0)));
        const d = Math.max(0, Math.floor(Number(cr?.currencyExchangeClaimedDiamonds ?? 0)));
        const items: InventoryItem[] = [];
        if (g > 0) items.push(createCurrencyObtainItem('gold', g, tCommon('resources.gold')));
        if (d > 0) items.push(createCurrencyObtainItem('diamonds', d, tCommon('resources.diamonds')));
        if (items.length === 0 && net > 0) {
            items.push(
                createCurrencyObtainItem(
                    receipt.currency,
                    net,
                    receipt.currency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds'),
                ),
            );
        }
        if (items.length > 0) setObtainItems(items);
        if (selectedReceiptId === orderId) setSelectedReceiptId('');
    };

    const handleClaimAllReceipts = async () => {
        if (myReceipts.length === 0) return;
        const result = await onAction?.({ type: 'CLAIM_CURRENCY_EXCHANGE_RECEIPT', payload: { claimAll: true } });
        if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
            window.alert(String((result as { error: string }).error));
            return;
        }
        const cr = (
            result as
                | { clientResponse?: { currencyExchangeClaimedGold?: number; currencyExchangeClaimedDiamonds?: number } }
                | undefined
        )?.clientResponse;
        const g = Math.max(0, Math.floor(Number(cr?.currencyExchangeClaimedGold ?? 0)));
        const d = Math.max(0, Math.floor(Number(cr?.currencyExchangeClaimedDiamonds ?? 0)));
        const items: InventoryItem[] = [];
        if (g > 0) items.push(createCurrencyObtainItem('gold', g, tCommon('resources.gold')));
        if (d > 0) items.push(createCurrencyObtainItem('diamonds', d, tCommon('resources.diamonds')));
        if (items.length > 0) setObtainItems(items);
        setSelectedReceiptId('');
    };

    const visibleMarketOrders = useMemo(
        () => marketOrders.filter((o) => o.status === 'open' && o.posterId !== currentUser.id),
        [marketOrders, currentUser.id],
    );

    const selectedReceipt: CurrencyExchangeReceipt | null =
        myReceipts.find((r) => r.orderId === selectedReceiptId) ?? myReceipts[0] ?? null;

    const sectionTitleClass = mobileExchange ? 'text-xs font-bold text-slate-100' : 'text-sm font-bold text-slate-100';
    const panelClass = `rounded-lg border border-slate-700/60 bg-slate-900/40 ${mobileExchange ? 'p-2' : 'p-3'}`;
    const inputClass =
        'w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-100 tabular-nums';

    return (
        <>
            {obtainItems && obtainItems.length === 1 ? (
                <ItemObtainedModal items={obtainItems} onClose={() => setObtainItems(null)} />
            ) : null}
            {obtainItems && obtainItems.length > 1 ? (
                <BulkItemObtainedModal items={obtainItems} onClose={() => setObtainItems(null)} />
            ) : null}

            <div
                className={`flex h-full min-h-0 flex-col gap-2 overflow-y-auto ${BAG_SCROLLBAR_Y_CLASS} ${mobileExchange ? '' : 'gap-3 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:overflow-hidden'}`}
            >
                <div className={`flex min-h-0 flex-col gap-2 ${mobileExchange ? '' : 'lg:overflow-y-auto lg:pr-1'}`}>
                    <div className={panelClass}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h3 className={sectionTitleClass}>{t('currency.instantTitle')}</h3>
                            <p className="text-[11px] text-slate-400">
                                {t('currency.marketRateHint', { rate: averageGoldPerDiamond() })}
                            </p>
                        </div>
                        <div className="mb-2 grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => setInstantDirection('gold_to_diamonds')}
                                className={`rounded border px-2 py-1.5 text-[11px] font-bold ${
                                    instantDirection === 'gold_to_diamonds'
                                        ? 'border-cyan-400/70 bg-cyan-900/30 text-cyan-100'
                                        : 'border-slate-600 bg-slate-800/80 text-slate-300'
                                }`}
                            >
                                {t('currency.goldToDiamonds')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setInstantDirection('diamonds_to_gold')}
                                className={`rounded border px-2 py-1.5 text-[11px] font-bold ${
                                    instantDirection === 'diamonds_to_gold'
                                        ? 'border-cyan-400/70 bg-cyan-900/30 text-cyan-100'
                                        : 'border-slate-600 bg-slate-800/80 text-slate-300'
                                }`}
                            >
                                {t('currency.diamondsToGold')}
                            </button>
                        </div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                            {instantDirection === 'gold_to_diamonds'
                                ? t('currency.inputGoldAmount')
                                : t('currency.inputDiamondAmount')}
                        </label>
                        <input
                            className={inputClass}
                            value={instantAmount}
                            onChange={(e) =>
                                setInstantAmount(
                                    clampDigitsOnlyInputString(e.target.value, {
                                        max: maxExchangeListPrice(instantDirection === 'gold_to_diamonds' ? 'gold' : 'diamonds'),
                                    }),
                                )
                            }
                            inputMode="numeric"
                        />
                        <div className="mt-2 space-y-1 rounded border border-slate-700/60 bg-slate-950/50 px-2 py-1.5 text-[11px] text-slate-300">
                            <p>
                                {t('currency.instantRate')}:{' '}
                                {instantDirection === 'gold_to_diamonds'
                                    ? t('currency.goldPerDiamondRate', { rate: instantGoldPerDiamondWhenBuyingDiamonds() })
                                    : t('currency.goldPerDiamondReceiveRate', { rate: instantGoldPerDiamondWhenSellingDiamonds() })}
                            </p>
                            <p className="font-semibold text-amber-100">
                                {t('currency.pay')}: {formatCurrency(instantPreview.pay, instantPreview.payCurrency)}{' '}
                                {instantPreview.payCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                            </p>
                            <p className="font-semibold text-cyan-100">
                                {t('currency.receive')}: {formatCurrency(instantPreview.receive, instantPreview.receiveCurrency)}{' '}
                                {instantPreview.receiveCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                            </p>
                        </div>
                        <Button onClick={() => void handleInstantExchange()} className={`${primaryButtonClass} mt-2 !w-full`}>
                            {t('currency.instantExchange')}
                        </Button>
                    </div>

                    <div className={panelClass}>
                        <h3 className={`${sectionTitleClass} mb-2`}>{t('currency.postOrderTitle')}</h3>
                        <div className="mb-2 grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => setOrderFromCurrency('gold')}
                                className={`rounded border px-2 py-1.5 text-[11px] font-bold ${
                                    orderFromCurrency === 'gold'
                                        ? 'border-amber-400/70 bg-amber-900/25 text-amber-100'
                                        : 'border-slate-600 bg-slate-800/80 text-slate-300'
                                }`}
                            >
                                {t('currency.offerGold')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setOrderFromCurrency('diamonds')}
                                className={`rounded border px-2 py-1.5 text-[11px] font-bold ${
                                    orderFromCurrency === 'diamonds'
                                        ? 'border-violet-400/70 bg-violet-900/25 text-violet-100'
                                        : 'border-slate-600 bg-slate-800/80 text-slate-300'
                                }`}
                            >
                                {t('currency.offerDiamonds')}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="mb-1 block text-[11px] font-semibold text-slate-300">{t('currency.offerAmount')}</label>
                                <input
                                    className={inputClass}
                                    value={orderFromAmount}
                                    onChange={(e) =>
                                        setOrderFromAmount(
                                            clampDigitsOnlyInputString(e.target.value, { max: maxExchangeListPrice(orderFromCurrency) }),
                                        )
                                    }
                                    inputMode="numeric"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-semibold text-slate-300">{t('currency.requestAmount')}</label>
                                <input
                                    className={inputClass}
                                    value={orderToAmount}
                                    onChange={(e) =>
                                        setOrderToAmount(
                                            clampDigitsOnlyInputString(e.target.value, { max: maxExchangeListPrice(orderToCurrency) }),
                                        )
                                    }
                                    inputMode="numeric"
                                />
                            </div>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">{t('currency.postOrderHint')}</p>
                        <Button onClick={() => void handlePostOrder()} className={`${primaryButtonClass} mt-2 !w-full`}>
                            {t('currency.postOrder')}
                        </Button>
                    </div>

                    {myOpenOrders.length > 0 ? (
                        <div className={panelClass}>
                            <h3 className={`${sectionTitleClass} mb-2`}>{t('currency.myOpenOrders')}</h3>
                            <div className="space-y-1.5">
                                {myOpenOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700/60 bg-slate-950/40 px-2 py-1.5 text-[11px]"
                                    >
                                        <span className="font-semibold text-slate-200">
                                            {formatCurrency(order.fromAmount, order.fromCurrency)} →{' '}
                                            {formatCurrency(order.toAmount, order.toCurrency)}
                                        </span>
                                        <Button
                                            onClick={() => void handleCancelOrder(order.id)}
                                            className="!mx-0 !min-h-0 !px-2 !py-1 !text-[10px]"
                                        >
                                            {t('currency.cancelOrder')}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className={`flex min-h-0 flex-col gap-2 ${mobileExchange ? '' : 'lg:overflow-hidden'}`}>
                    <div className={`${panelClass} flex min-h-0 flex-1 flex-col`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className={sectionTitleClass}>{t('currency.marketOrders')}</h3>
                            <ResourceActionButton
                                variant="neutral"
                                onClick={() => void refreshMarketOrders()}
                                disabled={isRefreshingOrders}
                                className="!min-h-0 !px-2 !py-1 !text-[10px]"
                            >
                                {t('labels.refresh')}
                            </ResourceActionButton>
                        </div>
                        <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BAG_SCROLLBAR_Y_CLASS}`}>
                            {!ordersLoaded ? (
                                <p className="py-6 text-center text-xs text-slate-400">{t('loading.wait')}</p>
                            ) : visibleMarketOrders.length === 0 ? (
                                <p className="py-6 text-center text-xs text-slate-400">{t('currency.noMarketOrders')}</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {visibleMarketOrders.map((order) => (
                                        <div
                                            key={order.id}
                                            className="rounded border border-slate-700/60 bg-slate-950/40 px-2 py-2 text-[11px]"
                                        >
                                            <p className="mb-1 font-semibold text-slate-200">{order.posterNickname}</p>
                                            <p className="mb-2 text-slate-300">
                                                {t('currency.offerLabel')}: {formatCurrency(order.fromAmount, order.fromCurrency)}{' '}
                                                {order.fromCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                                <br />
                                                {t('currency.requestLabel')}: {formatCurrency(order.toAmount, order.toCurrency)}{' '}
                                                {order.toCurrency === 'gold' ? tCommon('resources.gold') : tCommon('resources.diamonds')}
                                            </p>
                                            <Button
                                                onClick={() => void handleFulfillOrder(order)}
                                                className={`${primaryButtonClass} !w-full !text-[11px]`}
                                            >
                                                {t('currency.fulfillOrder')}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={panelClass}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className={sectionTitleClass}>{t('currency.claimTitle')}</h3>
                            {myReceipts.length > 0 ? (
                                <Button onClick={() => void handleClaimAllReceipts()} className="!mx-0 !min-h-0 !px-2 !py-1 !text-[10px]">
                                    {t('labels.claimAll')}
                                </Button>
                            ) : null}
                        </div>
                        {myReceipts.length === 0 ? (
                            <p className="py-4 text-center text-xs text-slate-400">{t('currency.noClaimPending')}</p>
                        ) : (
                            <div className="space-y-1.5">
                                {myReceipts.map((receipt) => {
                                    const fee = exchangeListingFeeFromPrice(receipt.amount);
                                    const net = Math.max(0, receipt.amount - fee);
                                    const isSelected = selectedReceipt?.orderId === receipt.orderId;
                                    return (
                                        <button
                                            key={receipt.orderId}
                                            type="button"
                                            onClick={() => setSelectedReceiptId(receipt.orderId)}
                                            className={`grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-1 rounded border px-2 py-1.5 text-left text-[11px] ${
                                                isSelected
                                                    ? 'border-cyan-400/70 bg-cyan-900/20'
                                                    : 'border-slate-700/60 bg-slate-950/40 hover:border-slate-500/70'
                                            }`}
                                        >
                                            <span className="min-w-0 font-semibold text-slate-200">
                                                {formatCurrency(receipt.fromAmount, receipt.fromCurrency)} →{' '}
                                                {formatCurrency(receipt.amount, receipt.currency)}
                                            </span>
                                            <span className="text-rose-200">{formatCurrency(fee, receipt.currency)}</span>
                                            <span className="font-bold text-emerald-200">{formatCurrency(net, receipt.currency)}</span>
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleClaimReceipt(receipt.orderId);
                                                }}
                                                className="!mx-0 !min-h-0 !px-2 !py-1 !text-[10px]"
                                            >
                                                {t('currency.claim')}
                                            </Button>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {myReceipts.length > 0 ? (
                            <p className="mt-2 text-[10px] text-slate-500">{t('currency.claimFeeHint')}</p>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ExchangeCurrencyTab;
