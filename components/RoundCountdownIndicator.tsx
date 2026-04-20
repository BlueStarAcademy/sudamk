import React, { useEffect, useState } from 'react';

interface RoundCountdownIndicatorProps {
    deadline?: number | null;
    durationSeconds: number;
    enabled?: boolean;
    label?: string;
    /** 좁은 화면에서 짧은 문구(한 줄·넘침 방지). 없으면 `label`만 사용 */
    labelShort?: string;
}

const getRemainingMs = (deadline: number | null | undefined, durationSeconds: number) => {
    const fallbackDeadline = Date.now() + (durationSeconds * 1000);
    const targetDeadline = deadline ?? fallbackDeadline;
    return Math.max(0, targetDeadline - Date.now());
};

const RoundCountdownIndicator: React.FC<RoundCountdownIndicatorProps> = ({
    deadline,
    durationSeconds,
    enabled = true,
    label = '자동 진행까지',
    labelShort,
}) => {
    const [remainingMs, setRemainingMs] = useState(() => enabled ? getRemainingMs(deadline, durationSeconds) : 0);

    useEffect(() => {
        if (!enabled) {
            setRemainingMs(0);
            return;
        }

        const updateRemaining = () => {
            setRemainingMs(getRemainingMs(deadline, durationSeconds));
        };

        updateRemaining();
        const timerId = window.setInterval(updateRemaining, 100);
        return () => clearInterval(timerId);
    }, [deadline, durationSeconds, enabled]);

    if (!enabled) {
        return null;
    }

    const displaySeconds = Math.ceil(remainingMs / 1000);
    const progressPercent = Math.max(0, Math.min(100, (remainingMs / (durationSeconds * 1000)) * 100));

    return (
        <div className="mt-1.5 sm:mt-2">
            <div className="flex items-start justify-between gap-2 text-[11px] leading-tight sm:text-sm">
                <span className="min-w-0 flex-1 text-zinc-400">
                    {labelShort ? (
                        <>
                            <span className="hidden sm:inline">{label}</span>
                            <span className="inline sm:hidden">{labelShort}</span>
                        </>
                    ) : (
                        label
                    )}
                </span>
                <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-amber-300 sm:text-2xl">{displaySeconds}초</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full border border-amber-900/40 bg-zinc-900/90 sm:mt-2 sm:h-2.5">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-yellow-200 transition-[width] duration-100 ease-linear shadow-[0_0_8px_rgba(251,191,36,0.35)]"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    );
};

export default RoundCountdownIndicator;
