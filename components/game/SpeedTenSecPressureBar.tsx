import React from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';

export type SpeedTenSecPressureBarProps = {
    secToNextDrop: number;
    /** 0~1, 1에 가까울수록 다음 페널티 구간 직전 */
    tickProgress: number;
    compact?: boolean;
    className?: string;
};

/** 스피드 바둑 수당 10초 압박: 카운트(10→1) + 진행 막대 (라벨 텍스트 없음) */
const SpeedTenSecPressureBar: React.FC<SpeedTenSecPressureBarProps> = ({
    secToNextDrop,
    tickProgress,
    compact = false,
    className = '',
}) => {
    const fillPct = Math.max(0, Math.min(100, (1 - tickProgress) * 100));
    const urgent = secToNextDrop <= 3;

    return (
        <div
            className={`flex w-full min-w-0 items-center gap-2.5 ${className}`}
            role="timer"
            aria-live="polite"
            aria-label={tx('game:speedPressure.aria', { sec: secToNextDrop })}
        >
            <span
                className={`shrink-0 min-w-[2ch] text-center font-black tabular-nums leading-none ${
                    compact ? 'text-xl' : 'text-2xl'
                } ${urgent ? 'text-red-300' : 'text-amber-200'}`}
            >
                {secToNextDrop}
            </span>
            <div
                className={`min-w-0 flex-1 overflow-hidden rounded-full bg-white/20 ${
                    compact ? 'h-3.5' : 'h-4'
                }`}
            >
                <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                        urgent ? 'bg-red-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${fillPct}%` }}
                />
            </div>
        </div>
    );
};

export default SpeedTenSecPressureBar;
