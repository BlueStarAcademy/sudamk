/**
 * 개발 모드 성능 기준 측정 유틸.
 * Chrome Performance / React Profiler와 함께 사용해 병목 지표를 기록한다.
 */

export type PerfMark = {
    label: string;
    at: number;
    detail?: Record<string, unknown>;
};

const marks: PerfMark[] = [];
const MAX_MARKS = 200;

function isEnabled(): boolean {
    return import.meta.env.DEV && typeof performance !== 'undefined';
}

/** 개발 모드에서만 성능 마크를 기록한다. */
export function markPerf(label: string, detail?: Record<string, unknown>): void {
    if (!isEnabled()) return;
    marks.push({ label, at: performance.now(), detail });
    if (marks.length > MAX_MARKS) marks.shift();
    if (typeof performance.mark === 'function') {
        try {
            performance.mark(label);
        } catch {
            /* ignore duplicate mark names */
        }
    }
}

/** 개발 모드에서만 구간 측정을 시작한다. */
export function startPerfMeasure(name: string): void {
    if (!isEnabled() || typeof performance.measure !== 'function') return;
    try {
        performance.mark(`${name}:start`);
    } catch {
        /* ignore */
    }
}

/** 개발 모드에서만 구간 측정을 종료하고 duration(ms)을 반환한다. */
export function endPerfMeasure(name: string, detail?: Record<string, unknown>): number | null {
    if (!isEnabled()) return null;
    const endLabel = `${name}:end`;
    try {
        performance.mark(endLabel);
        performance.measure(name, `${name}:start`, endLabel);
    } catch {
        return null;
    }
    const entries = performance.getEntriesByName(name, 'measure');
    const last = entries[entries.length - 1];
    const duration = last?.duration ?? null;
    if (duration != null) {
        markPerf(name, { durationMs: Math.round(duration * 100) / 100, ...detail });
    }
    performance.clearMeasures(name);
    performance.clearMarks(`${name}:start`);
    performance.clearMarks(endLabel);
    return duration;
}

/** React Profiler onRender 콜백용 — commit 시간을 기록한다. */
export function recordRenderCommit(
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
): void {
    if (!isEnabled()) return;
    if (actualDuration < 4 && phase === 'update') return;
    markPerf(`render:${id}`, {
        phase,
        actualDurationMs: Math.round(actualDuration * 100) / 100,
        baseDurationMs: Math.round(baseDuration * 100) / 100,
    });
}

/** 최근 마크 목록(디버그 콘솔용). */
export function getRecentPerfMarks(): readonly PerfMark[] {
    return marks;
}

/** 개발 콘솔에서 `window.__SUDAMR_PERF__`로 조회 가능하게 노출. */
export function exposePerfBaselineOnWindow(): void {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    (window as Window & { __SUDAMR_PERF__?: { marks: () => readonly PerfMark[] } }).__SUDAMR_PERF__ = {
        marks: getRecentPerfMarks,
    };
}
