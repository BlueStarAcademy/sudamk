import { describe, expect, it } from 'vitest';
import {
    computeCurrencyExchangePostingFees,
    validateCurrencyExchangeOrderAmounts,
} from '../../../shared/utils/currencyExchange.js';
import { CURRENCY_EXCHANGE_MIN_DIAMONDS } from '../../../shared/constants/currencyExchange.js';

describe('currency exchange posting fees / min diamonds', () => {
    it('requires at least 10 diamonds on either side of a P2P order', () => {
        expect(CURRENCY_EXCHANGE_MIN_DIAMONDS).toBe(10);
        expect(validateCurrencyExchangeOrderAmounts('diamonds', 1, 1_000_000_000)).toMatch(/10/);
        expect(validateCurrencyExchangeOrderAmounts('diamonds', 9, 1_000_000_000)).toMatch(/10/);
        expect(validateCurrencyExchangeOrderAmounts('gold', 500_000, 1)).toMatch(/10/);
        expect(validateCurrencyExchangeOrderAmounts('diamonds', 10, 1_000_000_000)).toBeNull();
        expect(validateCurrencyExchangeOrderAmounts('gold', 500_000, 10)).toBeNull();
    });

    it('charges 10% gold and 10% diamonds when posting diamonds→gold', () => {
        const fees = computeCurrencyExchangePostingFees('diamonds', 10, 1_000_000_000);
        expect(fees.diamondFee).toBe(1);
        expect(fees.goldFee).toBe(100_000_000);
        expect(fees.diamondDeduct).toBe(11); // escrow 10 + fee 1
        expect(fees.goldDeduct).toBe(100_000_000);
    });

    it('charges 10% gold and 10% diamonds when posting gold→diamonds', () => {
        const fees = computeCurrencyExchangePostingFees('gold', 50_000, 10);
        expect(fees.goldFee).toBe(5_000);
        expect(fees.diamondFee).toBe(1);
        expect(fees.goldDeduct).toBe(55_000); // escrow 50_000 + fee 5_000
        expect(fees.diamondDeduct).toBe(1);
    });

    it('waives fees for admin posting', () => {
        const fees = computeCurrencyExchangePostingFees('diamonds', 10, 1_000_000_000, { waiveFees: true });
        expect(fees.goldFee).toBe(0);
        expect(fees.diamondFee).toBe(0);
        expect(fees.diamondDeduct).toBe(10);
        expect(fees.goldDeduct).toBe(0);
    });
});
