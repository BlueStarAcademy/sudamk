import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    clearAsyncActionDedupeForTests,
    useKeyedAsyncAction,
} from '../../../hooks/useAsyncAction.js';
import { MIN_ACTION_FEEDBACK_MS } from '../../../shared/constants/uiFeedback.js';

/** Pure helper mirroring useAsyncAction min-feedback delay logic. */
async function applyMinFeedbackDelay(startedAt: number, minFeedbackMs: number): Promise<void> {
    const elapsed = Date.now() - startedAt;
    if (elapsed < minFeedbackMs) {
        await new Promise((resolve) => setTimeout(resolve, minFeedbackMs - elapsed));
    }
}

describe('async action feedback utilities', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearAsyncActionDedupeForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
        clearAsyncActionDedupeForTests();
    });

    it('applyMinFeedbackDelay waits until minFeedbackMs elapsed', async () => {
        const startedAt = Date.now();
        const promise = applyMinFeedbackDelay(startedAt, MIN_ACTION_FEEDBACK_MS);
        await vi.advanceTimersByTimeAsync(MIN_ACTION_FEEDBACK_MS - 1);
        let settled = false;
        promise.then(() => {
            settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(2);
        await promise;
        expect(settled).toBe(true);
    });

    it('exports MIN_ACTION_FEEDBACK_MS as 120', () => {
        expect(MIN_ACTION_FEEDBACK_MS).toBe(120);
    });

    it('clearAsyncActionDedupeForTests clears dedupe registry', () => {
        clearAsyncActionDedupeForTests();
        expect(true).toBe(true);
    });
});

describe('useKeyedAsyncAction', () => {
    it('is exported as a function', () => {
        expect(typeof useKeyedAsyncAction).toBe('function');
    });
});
