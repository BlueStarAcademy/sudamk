import { useEffect, useRef } from 'react';

type Options = {
    deadline?: number;
    enabled?: boolean;
    alreadySubmitted?: boolean;
    blocking?: boolean;
    onSubmit: () => void;
    pollMs?: number;
};

/**
 * 프리게임 모달: deadline 도달 시 1회 onSubmit (ColorAssignmentStickyFooter 패턴).
 */
export function usePreGameDeadlineAutoSubmit({
    deadline,
    enabled = true,
    alreadySubmitted = false,
    blocking = false,
    onSubmit,
    pollMs = 250,
}: Options): void {
    const sentRef = useRef(false);

    useEffect(() => {
        sentRef.current = false;
    }, [deadline, alreadySubmitted]);

    useEffect(() => {
        if (!enabled || deadline == null || !Number.isFinite(deadline) || alreadySubmitted || blocking) return;

        const trySubmit = () => {
            if (Date.now() < deadline) return;
            if (sentRef.current) return;
            sentRef.current = true;
            onSubmit();
        };

        trySubmit();
        const timerId = window.setInterval(trySubmit, pollMs);
        return () => window.clearInterval(timerId);
    }, [enabled, deadline, alreadySubmitted, blocking, onSubmit, pollMs]);
}
