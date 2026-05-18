import { describe, expect, it } from 'vitest';
import { formatBlacksmithPercentInt } from '../../../shared/utils/formatBlacksmithPercentInt.js';
import { BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES } from '../../../constants/rules.js';

describe('formatBlacksmithPercentInt', () => {
    it('rounds fractional display values', () => {
        expect(formatBlacksmithPercentInt(12.1875)).toBe('12');
        expect(formatBlacksmithPercentInt(33.7)).toBe('34');
    });

    it('legendary great-success rates in rules are integers', () => {
        const lv20 = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[19];
        expect(Number.isInteger(lv20.legendary)).toBe(true);
        expect(Number.isInteger(lv20.mythic)).toBe(true);
    });
});
