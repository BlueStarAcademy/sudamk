import React, { useEffect, useState } from 'react';

interface RoundCountdownIndicatorProps {
    deadline?: number | null;
    durationSeconds: number;
    enabled?: boolean;
    label?: string;
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
        <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{label}</span>
                <span className="text-2xl font-mono font-bold text-yellow-400 tabular-nums">{displaySeconds}초</span>
            </div>
            <div className="mt-2 w-full h-2.5 rounded-full overflow-hidden bg-gray-700/80 border border-gray-600/70">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-500 via-amber-400 to-orange-400 transition-[width] duration-100 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    );
};

export default RoundCountdownIndicator;
