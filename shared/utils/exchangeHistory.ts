import { formatWalletCurrencyAmount } from './walletAmountDisplay.js';

/** Persisted exchange history markers (fixed Korean — UI locale independent) */
export const HX_PURCHASE_DONE = '\uAD6C\uB9E4 \uC644\uB8CC';
export const HX_SETTLEMENT_ONE = '\uC815\uC0B0 \uC218\uB9BD';
export const HX_SETTLEMENT_ALL = '\uC815\uC0B0 \uBAA8\uB450 \uC218\uB9BD';
export const HX_CURRENCY_DONE = '\uD658\uC804 \uC644\uB8CC';
export const HX_CURRENCY_CLAIM = '\uD658\uC804 \uC218\uB9BD';
export const HX_CURRENCY_CLAIM_ALL = '\uD658\uC804 \uBAA8\uB450 \uC218\uB9BD';
export const HX_GOLD = '\uACE8\uB4DC';
export const HX_DIA = '\uB514\uC774\uC544';
export const HX_FEE = '\uC218\uC218\uB8CC';
export const HX_PAY = '\uC9C0\uBD88';
export const HX_RECEIVE = '\uC218\uB9BD';
export const HX_INSTANT_LABEL = '\uBC14\uB85C\uD658\uC804';
export const HX_MARKET_LABEL = '\uC2DC\uC7A5\uD658\uC804';

export type ExchangeHistoryCurrency = 'gold' | 'diamonds';

export function formatExchangeHistoryCurrencyAmount(value: number, currency: ExchangeHistoryCurrency): string {
    return `${formatWalletCurrencyAmount(value, currency)}${currency === 'gold' ? HX_GOLD : HX_DIA}`;
}

export function buildCurrencyExchangeDoneHistoryLine(params: {
    kind: 'instant' | 'market';
    payAmount: number;
    payCurrency: ExchangeHistoryCurrency;
    receiveAmount: number;
    receiveCurrency: ExchangeHistoryCurrency;
}): string {
    const label = params.kind === 'instant' ? HX_INSTANT_LABEL : HX_MARKET_LABEL;
    return `${HX_CURRENCY_DONE}: ${label} / ${formatExchangeHistoryCurrencyAmount(params.payAmount, params.payCurrency)} \u2192 ${formatExchangeHistoryCurrencyAmount(params.receiveAmount, params.receiveCurrency)}`;
}

export function buildCurrencyExchangeClaimHistoryLine(params: {
    netAmount: number;
    currency: ExchangeHistoryCurrency;
    feeAmount: number;
}): string {
    return `${HX_CURRENCY_CLAIM}: ${HX_MARKET_LABEL} / \uC2E4\uC218\uB9BD ${formatExchangeHistoryCurrencyAmount(params.netAmount, params.currency)} (${HX_FEE} ${formatExchangeHistoryCurrencyAmount(params.feeAmount, params.currency)})`;
}

export function buildCurrencyExchangeClaimAllHistoryLine(params: {
    goldNet: number;
    diamondsNet: number;
}): string {
    return `${HX_CURRENCY_CLAIM_ALL}: ${HX_GOLD} ${formatWalletCurrencyAmount(params.goldNet, 'gold')} / ${HX_DIA} ${formatWalletCurrencyAmount(params.diamondsNet, 'diamonds')}`;
}

export function appendExchangeHistoryLine(
    exchangeState: { history?: string[] },
    message: string,
    now = Date.now(),
): void {
    if (!Array.isArray(exchangeState.history)) exchangeState.history = [];
    const timestamp = new Date(now).toLocaleString('ko-KR');
    exchangeState.history = [`[${timestamp}] ${message}`, ...exchangeState.history].slice(0, 200);
}

export function isExchangeHistoryLineForDisplay(line: string): boolean {
    return (
        line.includes(HX_PURCHASE_DONE) ||
        line.includes(HX_SETTLEMENT_ALL) ||
        line.includes(HX_SETTLEMENT_ONE) ||
        line.includes(HX_CURRENCY_DONE) ||
        line.includes(HX_CURRENCY_CLAIM) ||
        line.includes(HX_CURRENCY_CLAIM_ALL)
    );
}
