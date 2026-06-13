import React from 'react';

export type SpeedTenSecPressureBarProps = {
    secToNextDrop: number;
    /** 0~1, 1에 가까울수록 다음 페널티 구간 직전 */
    tickProgress: number;
    compact?: boolean;
    className?: string;
};

/** 스피드 바둑 수당 10초 압박: 카운트(10→1) + 진행 막대 */
const SpeedTenSecPressureBar: React.FC<SpeedTenSecPressureBarProps> = ({
    secToNextDrop,
    tickProgress,
    compact = false,
    className = '',
}) => {
    const fillPct = Math.max(0, Math.min(100, (1 - tickProgress) * 100));

    return (
        <div
            className={`flex w-full min-w-0 items-center gap-2 ${className}`}
            role="timer"
            aria-live="polite"
            aria-label={`수당 시간 ${secToNextDrop}초`}
        >
            <span
                className={`shrink-0 font-semibold tabular-nums text-amber-200 ${
                    compact ? 'text-xs' : 'text-sm'
                }`}
            >
                {secToNextDrop}초
            </span>
            <div
                className={`min-w-0 flex-1 overflow-hidden rounded-full bg-white/15 ${
                    compact ? 'h-2' : 'h-2.5'
                }`}
            >
                <div
                    className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
                    style={{ width: `${fillPct}%` }}
                />
            </div>
        </div>
    );
};

export default SpeedTenSecPressureBar;
