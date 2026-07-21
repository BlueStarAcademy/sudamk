import { randomUUID } from 'crypto';
import * as db from '../db.js';
import type * as types from '../../types/index.js';
import type { HandleActionResult } from '../../types/api.js';
import { maxExchangeListPrice } from '../../shared/constants/numericLimits.js';
import { CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS, CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER } from '../../shared/constants/currencyExchange.js';
import {
    applyInstantDailyUsage,
    clampInstantExchangeInputToDailyLimit,
    computeInstantDiamondsToGold,
    computeInstantGoldToDiamonds,
    validateCurrencyExchangeOrderAmounts,
    validateInstantExchangeDailyLimit,
} from '../../shared/utils/currencyExchange.js';
import { clampGameInt, exchangeListingFeeFromPrice } from '../../shared/utils/gameIntegerField.js';
import {
    appendExchangeHistoryLine,
    buildCurrencyExchangeClaimAllHistoryLine,
    buildCurrencyExchangeClaimHistoryLine,
    buildCurrencyExchangeDoneHistoryLine,
} from '../../shared/utils/exchangeHistory.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';

type CurrencyKind = 'gold' | 'diamonds';

function ensureExchangeState(user: types.User): NonNullable<types.User['exchangeState']> {
    if (!user.exchangeState) {
        user.exchangeState = { listings: [], settlements: [], history: [], currencyOrders: [], currencyReceipts: [] };
    }
    if (!Array.isArray(user.exchangeState.currencyOrders)) user.exchangeState.currencyOrders = [];
    if (!Array.isArray(user.exchangeState.currencyReceipts)) user.exchangeState.currencyReceipts = [];
    if (!user.exchangeState.instantDaily) {
        user.exchangeState.instantDaily = { lastResetDayKST: 0, goldSpent: 0, diamondsSpent: 0 };
    }
    if (!Array.isArray(user.exchangeState.history)) user.exchangeState.history = [];
    return user.exchangeState;
}

function oppositeCurrency(c: CurrencyKind): CurrencyKind {
    return c === 'gold' ? 'diamonds' : 'gold';
}

function deductCurrency(user: types.User, currency: CurrencyKind, amount: number): boolean {
    const n = clampGameInt(amount, { min: 0 });
    if (n <= 0) return false;
    if (currency === 'gold') {
        if ((user.gold ?? 0) < n) return false;
        user.gold = Math.max(0, (user.gold ?? 0) - n);
        return true;
    }
    if ((user.diamonds ?? 0) < n) return false;
    user.diamonds = Math.max(0, (user.diamonds ?? 0) - n);
    return true;
}

function addCurrency(user: types.User, currency: CurrencyKind, amount: number): void {
    const n = clampGameInt(amount, { min: 0 });
    if (n <= 0) return;
    if (currency === 'gold') user.gold = Math.max(0, (user.gold ?? 0) + n);
    else user.diamonds = Math.max(0, (user.diamonds ?? 0) + n);
}

export async function handleCurrencyExchangeAction(
    action: types.ServerAction & { userId: string },
    user: types.User,
): Promise<HandleActionResult> {
    const { type, payload } = action as { type: string; payload?: Record<string, unknown> };

    switch (type) {
        case 'INSTANT_CURRENCY_EXCHANGE': {
            const { direction, amount } = (payload || {}) as {
                direction?: 'gold_to_diamonds' | 'diamonds_to_gold';
                amount?: number;
            };
            if (direction !== 'gold_to_diamonds' && direction !== 'diamonds_to_gold') {
                return { error: '유효하지 않은 환전 방향입니다.' };
            }
            const inputAmount = clampGameInt(amount, { min: 0 });
            if (inputAmount <= 0) return { error: '환전 수량을 입력해 주세요.' };

            const exchange = ensureExchangeState(user);
            const now = Date.now();
            // 요청량이 일일 남은 한도보다 크면 남은 한도(100%)만 환전
            const cappedAmount = clampInstantExchangeInputToDailyLimit(
                direction,
                inputAmount,
                exchange.instantDaily,
                now,
            );
            if (cappedAmount <= 0) {
                return { error: '일일 바로환전 한도를 모두 사용했습니다.' };
            }

            if (direction === 'gold_to_diamonds') {
                const { diamonds, diamondsGross, goldSpent, fee, totalGoldPaid } = computeInstantGoldToDiamonds(cappedAmount);
                if (diamondsGross <= 0 || diamonds <= 0) return { error: '환전 가능한 다이아 수량이 없습니다.' };
                const dailyError = validateInstantExchangeDailyLimit(
                    direction,
                    exchange.instantDaily,
                    goldSpent,
                    0,
                    diamondsGross,
                    0,
                    now,
                );
                if (dailyError) return { error: dailyError };
                if ((user.gold ?? 0) < totalGoldPaid) return { error: '골드가 부족합니다.' };
                if (diamondsGross > maxExchangeListPrice('diamonds')) {
                    return { error: '한 번에 환전할 수 있는 다이아 한도를 초과했습니다.' };
                }
                user.gold = Math.max(0, (user.gold ?? 0) - totalGoldPaid);
                user.diamonds = Math.max(0, (user.diamonds ?? 0) + diamonds);
                exchange.instantDaily = applyInstantDailyUsage(exchange.instantDaily, direction, goldSpent, 0, now);
                appendExchangeHistoryLine(
                    exchange,
                    buildCurrencyExchangeDoneHistoryLine({
                        kind: 'instant',
                        payAmount: goldSpent,
                        payCurrency: 'gold',
                        receiveAmount: diamonds,
                        receiveCurrency: 'diamonds',
                        feeAmount: fee,
                        feeCurrency: 'gold',
                    }),
                    now,
                );
            } else {
                if (cappedAmount < CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS) {
                    return {
                        error: `다이아→골드 바로환전은 최소 ${CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS}다이아부터 가능합니다.`,
                    };
                }
                const { gold, goldGross, diamondsSpent, fee, totalDiamondsPaid } = computeInstantDiamondsToGold(cappedAmount);
                if (goldGross <= 0 || gold <= 0) return { error: '환전 가능한 골드 수량이 없습니다.' };
                const dailyError = validateInstantExchangeDailyLimit(
                    direction,
                    exchange.instantDaily,
                    0,
                    diamondsSpent,
                    0,
                    goldGross,
                    now,
                );
                if (dailyError) return { error: dailyError };
                if ((user.diamonds ?? 0) < totalDiamondsPaid) return { error: '다이아가 부족합니다.' };
                if (goldGross > maxExchangeListPrice('gold')) {
                    return { error: '한 번에 환전할 수 있는 골드 한도를 초과했습니다.' };
                }
                user.diamonds = Math.max(0, (user.diamonds ?? 0) - totalDiamondsPaid);
                user.gold = Math.max(0, (user.gold ?? 0) + gold);
                exchange.instantDaily = applyInstantDailyUsage(exchange.instantDaily, direction, 0, diamondsSpent, now);
                appendExchangeHistoryLine(
                    exchange,
                    buildCurrencyExchangeDoneHistoryLine({
                        kind: 'instant',
                        payAmount: diamondsSpent,
                        payCurrency: 'diamonds',
                        receiveAmount: gold,
                        receiveCurrency: 'gold',
                        feeAmount: fee,
                        feeCurrency: 'diamonds',
                    }),
                    now,
                );
            }

            try {
                await db.updateUser(user);
            } catch (err) {
                console.error('[INSTANT_CURRENCY_EXCHANGE] DB save failed:', err);
                return { error: '환전 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
            }
            db.invalidateUserCache(user.id);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['gold', 'diamonds', 'exchangeState']);
            return { clientResponse: { updatedUser: getSelectiveUserUpdate(user, 'INSTANT_CURRENCY_EXCHANGE') } };
        }

        case 'POST_CURRENCY_EXCHANGE_ORDER': {
            const { fromCurrency, fromAmount, toAmount } = (payload || {}) as {
                fromCurrency?: CurrencyKind;
                toAmount?: number;
                fromAmount?: number;
            };
            if (fromCurrency !== 'gold' && fromCurrency !== 'diamonds') {
                return { error: '유효하지 않은 재화 종류입니다.' };
            }
            const from = clampGameInt(fromAmount, { min: 0 });
            const to = clampGameInt(toAmount, { min: 0 });
            const validationError = validateCurrencyExchangeOrderAmounts(fromCurrency, from, to);
            if (validationError) return { error: validationError };
            if (from > maxExchangeListPrice(fromCurrency) || to > maxExchangeListPrice(oppositeCurrency(fromCurrency))) {
                return { error: '환전 수량이 허용 범위를 벗어났습니다.' };
            }

            const exchange = ensureExchangeState(user);
            const openCount = exchange.currencyOrders!.filter((o) => o.status === 'open').length;
            if (openCount >= CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER) {
                return { error: `동시에 등록할 수 있는 환전 요청은 ${CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER}건까지입니다.` };
            }
            if (!deductCurrency(user, fromCurrency, from)) {
                return { error: fromCurrency === 'gold' ? '골드가 부족합니다.' : '다이아가 부족합니다.' };
            }

            const now = Date.now();
            const order: types.CurrencyExchangeOrder = {
                id: `cx-${randomUUID()}`,
                posterId: user.id,
                posterNickname: user.nickname,
                fromCurrency,
                fromAmount: from,
                toCurrency: oppositeCurrency(fromCurrency),
                toAmount: to,
                status: 'open',
                createdAt: now,
            };
            exchange.currencyOrders = [order, ...exchange.currencyOrders!];

            try {
                await db.updateUser(user);
            } catch (err) {
                console.error('[POST_CURRENCY_EXCHANGE_ORDER] DB save failed:', err);
                return { error: '환전 요청 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
            }
            db.invalidateUserCache(user.id);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['exchangeState', 'gold', 'diamonds']);
            return { clientResponse: { updatedUser: getSelectiveUserUpdate(user, 'POST_CURRENCY_EXCHANGE_ORDER') } };
        }

        case 'CANCEL_CURRENCY_EXCHANGE_ORDER': {
            const { orderId } = (payload || {}) as { orderId?: string };
            if (!orderId || typeof orderId !== 'string') return { error: '유효하지 않은 요청입니다.' };

            const exchange = ensureExchangeState(user);
            const idx = exchange.currencyOrders!.findIndex((o) => o.id === orderId && o.posterId === user.id);
            if (idx === -1) return { error: '환전 요청을 찾을 수 없습니다.' };
            const order = exchange.currencyOrders![idx];
            if (order.status !== 'open') return { error: '이미 체결되었거나 취소된 요청입니다.' };

            addCurrency(user, order.fromCurrency, order.fromAmount);
            exchange.currencyOrders![idx] = { ...order, status: 'cancelled' };

            try {
                await db.updateUser(user);
            } catch (err) {
                console.error('[CANCEL_CURRENCY_EXCHANGE_ORDER] DB save failed:', err);
                return { error: '환전 요청 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
            }
            db.invalidateUserCache(user.id);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['exchangeState', 'gold', 'diamonds']);
            return { clientResponse: { updatedUser: getSelectiveUserUpdate(user, 'CANCEL_CURRENCY_EXCHANGE_ORDER') } };
        }

        case 'FULFILL_CURRENCY_EXCHANGE_ORDER': {
            const { orderId, posterId } = (payload || {}) as { orderId?: string; posterId?: string };
            if (!orderId || typeof orderId !== 'string' || !posterId || typeof posterId !== 'string') {
                return { error: '유효하지 않은 요청입니다.' };
            }
            if (posterId === user.id) return { error: '본인이 등록한 환전 요청은 체결할 수 없습니다.' };

            const poster = await db.getUser(posterId, { includeEquipment: false, includeInventory: false });
            if (!poster) return { error: '요청자를 찾을 수 없습니다.' };

            const posterExchange = ensureExchangeState(poster);
            const orderIdx = posterExchange.currencyOrders!.findIndex((o) => o.id === orderId && o.status === 'open');
            if (orderIdx === -1) return { error: '이미 체결되었거나 취소된 환전 요청입니다.' };
            const order = posterExchange.currencyOrders![orderIdx];
            if (order.posterId !== posterId) return { error: '환전 요청 정보가 일치하지 않습니다.' };

            if (!deductCurrency(user, order.toCurrency, order.toAmount)) {
                return { error: order.toCurrency === 'gold' ? '골드가 부족합니다.' : '다이아가 부족합니다.' };
            }
            addCurrency(user, order.fromCurrency, order.fromAmount);

            const now = Date.now();
            const fulfillerExchange = ensureExchangeState(user);
            appendExchangeHistoryLine(
                fulfillerExchange,
                buildCurrencyExchangeDoneHistoryLine({
                    kind: 'market',
                    payAmount: order.toAmount,
                    payCurrency: order.toCurrency,
                    receiveAmount: order.fromAmount,
                    receiveCurrency: order.fromCurrency,
                }),
                now,
            );
            posterExchange.currencyOrders![orderIdx] = {
                ...order,
                status: 'filled',
                filledAt: now,
                filledByUserId: user.id,
                filledByNickname: user.nickname,
            };
            posterExchange.currencyReceipts = [
                {
                    orderId: order.id,
                    amount: order.toAmount,
                    currency: order.toCurrency,
                    fromCurrency: order.fromCurrency,
                    fromAmount: order.fromAmount,
                    filledAt: now,
                    claimed: false,
                },
                ...(posterExchange.currencyReceipts ?? []),
            ];

            try {
                await db.updateUser(poster);
                await db.updateUser(user);
            } catch (err) {
                console.error('[FULFILL_CURRENCY_EXCHANGE_ORDER] DB save failed:', err);
                return { error: '환전 체결 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
            }
            db.invalidateUserCache(poster.id);
            db.invalidateUserCache(user.id);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(poster, ['exchangeState']);
            broadcastUserUpdate(user, ['gold', 'diamonds', 'exchangeState']);

            const updatedUser = getSelectiveUserUpdate(user, 'FULFILL_CURRENCY_EXCHANGE_ORDER');
            return { clientResponse: { updatedUser } };
        }

        case 'CLAIM_CURRENCY_EXCHANGE_RECEIPT': {
            const { orderId, claimAll } = (payload || {}) as { orderId?: string; claimAll?: boolean };
            const exchange = ensureExchangeState(user);
            const receipts = [...(exchange.currencyReceipts ?? [])];

            const indicesToClaim: number[] = [];
            if (claimAll === true) {
                receipts.forEach((row, idx) => {
                    if (row && row.claimed !== true) indicesToClaim.push(idx);
                });
            } else if (orderId && typeof orderId === 'string') {
                const idx = receipts.findIndex((row) => row.orderId === orderId);
                if (idx === -1) return { error: '수령할 환전 내역을 찾을 수 없습니다.' };
                if (receipts[idx].claimed === true) return { error: '이미 수령한 환전 내역입니다.' };
                indicesToClaim.push(idx);
            } else {
                return { error: '유효하지 않은 요청입니다.' };
            }

            if (indicesToClaim.length === 0) return { error: '수령할 환전 내역이 없습니다.' };

            let goldNet = 0;
            let diamondsNet = 0;
            const now = Date.now();
            for (const idx of indicesToClaim) {
                const row = receipts[idx];
                const gross = clampGameInt(row.amount, { min: 0 });
                const fee = exchangeListingFeeFromPrice(gross);
                const net = Math.max(0, gross - fee);
                if (row.currency === 'gold') {
                    goldNet += net;
                } else {
                    diamondsNet += net;
                }
                receipts[idx] = { ...row, claimed: true };
                if (claimAll !== true) {
                    appendExchangeHistoryLine(
                        exchange,
                        buildCurrencyExchangeClaimHistoryLine({
                            netAmount: net,
                            currency: row.currency,
                            feeAmount: fee,
                        }),
                        now,
                    );
                }
            }
            if (claimAll === true) {
                appendExchangeHistoryLine(
                    exchange,
                    buildCurrencyExchangeClaimAllHistoryLine({ goldNet, diamondsNet }),
                    now,
                );
            }

            user.gold = Math.max(0, (user.gold ?? 0) + goldNet);
            user.diamonds = Math.max(0, (user.diamonds ?? 0) + diamondsNet);
            user.exchangeState = { ...exchange, currencyReceipts: receipts };

            try {
                await db.updateUser(user);
            } catch (err) {
                console.error('[CLAIM_CURRENCY_EXCHANGE_RECEIPT] DB save failed:', err);
                return { error: '환전 수령 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
            }
            db.invalidateUserCache(user.id);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['exchangeState', 'gold', 'diamonds']);

            return {
                clientResponse: {
                    updatedUser: getSelectiveUserUpdate(user, 'CLAIM_CURRENCY_EXCHANGE_RECEIPT'),
                    currencyExchangeClaimedGold: goldNet,
                    currencyExchangeClaimedDiamonds: diamondsNet,
                },
            };
        }

        default:
            return { error: 'Unknown currency exchange action.' };
    }
}

export const CURRENCY_EXCHANGE_ACTION_TYPES = [
    'INSTANT_CURRENCY_EXCHANGE',
    'POST_CURRENCY_EXCHANGE_ORDER',
    'FULFILL_CURRENCY_EXCHANGE_ORDER',
    'CANCEL_CURRENCY_EXCHANGE_ORDER',
    'CLAIM_CURRENCY_EXCHANGE_RECEIPT',
] as const;
