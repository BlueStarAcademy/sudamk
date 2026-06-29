import { useEffect, useState } from 'react';

/** 활성 쿨다운일 때만 interval — 부모 트리 전체 리렌더 없이 남은 초만 갱신 */
export function useCooldownRemainingSeconds(deadlineMs: number | null | undefined): number {
    const [tick, setTick] = useState(0);
    const active = typeof deadlineMs === 'number' && deadlineMs > Date.now();

    useEffect(() => {
        if (!active) return;
        const id = window.setInterval(() => setTick((t) => t + 1), 500);
        return () => window.clearInterval(id);
    }, [active, deadlineMs]);

    void tick;
    if (!active || typeof deadlineMs !== 'number') return 0;
    return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}
