import React, { useEffect, useState } from 'react';

const BASE_DURATION_MS = 700;
const GAIN_DURATION_MS = 600;

export interface StrategyXpResultBarProps {
    /** 이전 XP 비율 (0–100) */
    previousXpPercent: number;
    /** 최종 XP 비율 (0–100) */
    finalXpPercent: number;
    /** 획득 XP 양 (>0일 때만 초록 구간 표시) */
    xpGain: number;
    /** 트랙 높이 등 */
    className?: string;
    trackClassName?: string;
}

/**
 * 경기 결과 모달용: 먼저 기존 XP 구간(청색)이 차오른 뒤, 획득분만 초록으로 이어서 표시한다.
 */
export const StrategyXpResultBar: React.FC<StrategyXpResultBarProps> = ({
    previousXpPercent,
    finalXpPercent,
    xpGain,
    className = 'h-2.5',
    trackClassName = 'border border-amber-500/20 bg-black/45',
}) => {
    const prev = Math.min(100, Math.max(0, previousXpPercent));
    const fin = Math.min(100, Math.max(0, finalXpPercent));
    const gainPct = xpGain > 0 ? Math.max(0, Math.min(100 - prev, fin - prev)) : 0;

    const [baseW, setBaseW] = useState(0);
    const [gainW, setGainW] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setBaseW(0);
        setGainW(0);
        requestAnimationFrame(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
                if (!cancelled) setBaseW(prev);
            });
        });
        const gainTimer =
            gainPct > 0
                ? setTimeout(() => {
                      if (cancelled) return;
                      requestAnimationFrame(() => {
                          if (cancelled) return;
                          requestAnimationFrame(() => {
                              if (!cancelled) setGainW(gainPct);
                          });
                      });
                  }, BASE_DURATION_MS)
                : null;
        return () => {
            cancelled = true;
            if (gainTimer) clearTimeout(gainTimer);
        };
    }, [prev, fin, gainPct, xpGain]);

    return (
        <div className={`relative w-full overflow-hidden rounded-full ${trackClassName} ${className}`}>
            {/* 최종 XP 비율까지의 구간을 미리 깔아 두어, 채움 애니메이션 중에도 진행 ‘막대 길이(끝점)’가 변하지 않게 보이게 함 */}
            {fin > 0 && (
                <div
                    className="pointer-events-none absolute inset-y-0 left-0 z-0 rounded-l-full bg-white/[0.08]"
                    style={{ width: `${fin}%` }}
                    aria-hidden
                />
            )}
            <div
                className="absolute left-0 top-0 z-[1] h-full rounded-l-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 transition-[width] ease-out"
                style={{ width: `${baseW}%`, transitionDuration: `${BASE_DURATION_MS}ms` }}
            />
            {gainPct > 0 && (
                <div
                    className="absolute top-0 z-[2] h-full rounded-r-full bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 transition-[width] ease-out"
                    style={{
                        left: `${prev}%`,
                        width: `${gainW}%`,
                        transitionDuration: `${GAIN_DURATION_MS}ms`,
                    }}
                />
            )}
        </div>
    );
};
