/**
 * One-off: cancel open P2P currency exchange orders that violate current rules
 * (min 10 diamonds, etc.), refund escrowed fromAmount (listing fees stay sunk).
 *
 * Dry-run:  npx tsx --tsconfig server/tsconfig.json server/scripts/resetAbnormalCurrencyExchangeOrders.ts
 * Apply:    npx tsx --tsconfig server/tsconfig.json server/scripts/resetAbnormalCurrencyExchangeOrders.ts --apply
 * All open: ... --apply --all-open
 */
import * as db from '../db.js';
import type { CurrencyExchangeOrder, User } from '../../types/index.js';
import { validateCurrencyExchangeOrderAmounts } from '../../shared/utils/currencyExchange.js';
import { clampGameInt } from '../../shared/utils/gameIntegerField.js';

const APPLY = process.argv.includes('--apply');
const ALL_OPEN = process.argv.includes('--all-open');

function ensureExchange(user: User) {
    if (!user.exchangeState) {
        user.exchangeState = { listings: [], settlements: [], history: [], currencyOrders: [], currencyReceipts: [] };
    }
    if (!Array.isArray(user.exchangeState.currencyOrders)) user.exchangeState.currencyOrders = [];
    return user.exchangeState;
}

function refundEscrow(user: User, order: CurrencyExchangeOrder): void {
    const amount = clampGameInt(order.fromAmount, { min: 0 });
    if (amount <= 0) return;
    if (order.fromCurrency === 'gold') {
        user.gold = Math.max(0, (user.gold ?? 0) + amount);
    } else {
        user.diamonds = Math.max(0, (user.diamonds ?? 0) + amount);
    }
}

function shouldCancel(order: CurrencyExchangeOrder): { cancel: boolean; reason: string } {
    if (order.status !== 'open') return { cancel: false, reason: '' };
    if (ALL_OPEN) return { cancel: true, reason: 'all-open' };
    const err = validateCurrencyExchangeOrderAmounts(order.fromCurrency, order.fromAmount, order.toAmount);
    if (err) return { cancel: true, reason: err };
    return { cancel: false, reason: '' };
}

async function main() {
    const users = await db.getAllUsers({ includeEquipment: false, includeInventory: false, skipCache: true });
    console.log(`[resetAbnormalCurrencyExchange] scanned=${users.length} apply=${APPLY} allOpen=${ALL_OPEN}`);

    let openSeen = 0;
    let cancelled = 0;
    let usersTouched = 0;

    for (const user of users) {
        const exchange = user.exchangeState;
        const orders = Array.isArray(exchange?.currencyOrders) ? exchange!.currencyOrders! : [];
        const openOrders = orders.filter((o) => o.status === 'open');
        if (openOrders.length === 0) continue;

        openSeen += openOrders.length;
        let dirty = false;
        const nextOrders = [...orders];

        for (let i = 0; i < nextOrders.length; i++) {
            const order = nextOrders[i];
            const { cancel, reason } = shouldCancel(order);
            if (!cancel) continue;

            console.log(
                `  ${APPLY ? 'CANCEL' : 'WOULD_CANCEL'} user=${user.nickname}(${user.id}) ` +
                    `${order.fromAmount}${order.fromCurrency}→${order.toAmount}${order.toCurrency} ` +
                    `id=${order.id} reason=${reason}`,
            );

            if (APPLY) {
                refundEscrow(user, order);
                nextOrders[i] = { ...order, status: 'cancelled' };
                dirty = true;
            }
            cancelled += 1;
        }

        if (APPLY && dirty) {
            const ex = ensureExchange(user);
            user.exchangeState = { ...ex, currencyOrders: nextOrders };
            await db.updateUser(user);
            db.invalidateUserCache(user.id);
            usersTouched += 1;
        }
    }

    console.log(
        `[resetAbnormalCurrencyExchange] openSeen=${openSeen} cancelled=${cancelled} usersTouched=${usersTouched} mode=${APPLY ? 'APPLY' : 'DRY_RUN'}`,
    );
    if (!APPLY && cancelled > 0) {
        console.log('[resetAbnormalCurrencyExchange] Re-run with --apply to commit. Add --all-open to cancel every open order.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('[resetAbnormalCurrencyExchange] failed:', e);
        process.exit(1);
    });
