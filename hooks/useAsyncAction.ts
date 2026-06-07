import { useCallback, useEffect, useRef, useState } from 'react';
import { MIN_ACTION_FEEDBACK_MS } from '../shared/constants/uiFeedback.js';

export type UseAsyncActionOptions = {
    /** Minimum time to keep isPending true (avoids flicker). Default 300ms. */
    minFeedbackMs?: number;
    /** If set, concurrent runs with the same key are ignored until the first completes. */
    dedupeKey?: string | null;
};

const inFlightByDedupeKey = new Map<string, Promise<unknown>>();

export type UseAsyncActionResult<TArgs extends unknown[]> = {
    run: (...args: TArgs) => Promise<void>;
    isPending: boolean;
    error: unknown;
    resetError: () => void;
};

export function useAsyncAction<TArgs extends unknown[] = []>(
    action: (...args: TArgs) => void | Promise<void>,
    options: UseAsyncActionOptions = {},
): UseAsyncActionResult<TArgs> {
    const { minFeedbackMs = MIN_ACTION_FEEDBACK_MS, dedupeKey = null } = options;

    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const pendingCountRef = useRef(0);
    const actionRef = useRef(action);
    const optionsRef = useRef(options);

    actionRef.current = action;
    optionsRef.current = options;

    const setPending = useCallback((next: boolean) => {
        pendingCountRef.current = Math.max(0, pendingCountRef.current + (next ? 1 : -1));
        setIsPending(pendingCountRef.current > 0);
    }, []);

    const resetError = useCallback(() => {
        setError(null);
    }, []);

    const run = useCallback(
        async (...args: TArgs) => {
            const key = optionsRef.current.dedupeKey ?? dedupeKey;
            if (key && inFlightByDedupeKey.has(key)) {
                await inFlightByDedupeKey.get(key);
                return;
            }

            const startedAt = Date.now();
            setPending(true);
            setError(null);

            const execute = async () => {
                try {
                    await actionRef.current(...args);
                } catch (err) {
                    setError(err);
                    throw err;
                } finally {
                    const minMs = optionsRef.current.minFeedbackMs ?? minFeedbackMs;
                    const elapsed = Date.now() - startedAt;
                    if (elapsed < minMs) {
                        await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
                    }
                    setPending(false);
                }
            };

            const promise = execute();
            if (key) {
                inFlightByDedupeKey.set(key, promise);
                promise.finally(() => {
                    if (inFlightByDedupeKey.get(key) === promise) {
                        inFlightByDedupeKey.delete(key);
                    }
                });
            }

            await promise;
        },
        [dedupeKey, minFeedbackMs, setPending],
    );

    useEffect(() => {
        return () => {
            pendingCountRef.current = 0;
        };
    }, []);

    return { run, isPending, error, resetError };
}

/** Per-key pending state for lists (shop rows, quest claims, mail actions). */
export function useKeyedAsyncAction() {
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    const run = useCallback(
        async (key: string, action: () => void | Promise<void>) => {
            if (pendingKey !== null) {
                return;
            }
            const startedAt = Date.now();
            setPendingKey(key);
            try {
                await action();
            } finally {
                const elapsed = Date.now() - startedAt;
                if (elapsed < MIN_ACTION_FEEDBACK_MS) {
                    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_FEEDBACK_MS - elapsed));
                }
                setPendingKey(null);
            }
        },
        [pendingKey],
    );

    const isPending = useCallback((key: string) => pendingKey === key, [pendingKey]);

    return {
        pendingKey,
        isAnyPending: pendingKey !== null,
        isPending,
        run,
    };
}

/** Clears module-level dedupe map — for tests only. */
export function clearAsyncActionDedupeForTests(): void {
    inFlightByDedupeKey.clear();
}
