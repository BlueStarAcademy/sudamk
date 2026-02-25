import React, { useState, useEffect, useRef } from 'react';

interface AttackToTurnGaugeProps {
    /** 애니메이션 시작 시각 (서버/클라이언트 공통 기준) */
    startTime: number;
    /** 애니메이션 총 길이 (ms). 이 시간이 지나면 턴 전환 */
    durationMs: number;
    /** 게이지 옆에 표시할 라벨 (예: "턴 전환까지") */
    label?: string;
    /** 막대 색상 클래스 (기본: 청록 그라데이션) */
    barClassName?: string;
}

/**
 * 공격(플릭) 후 턴이 넘어가기까지 남은 시간을 막대 게이지로 표시합니다.
 * 알까기·바둑 컬링에서 animating 상태일 때 사용합니다.
 */
export const AttackToTurnGauge: React.FC<AttackToTurnGaugeProps> = ({
    startTime,
    durationMs,
    label = '턴 전환까지',
    barClassName = 'bg-gradient-to-r from-cyan-400 to-blue-500',
}) => {
    const [progress, setProgress] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const endTime = startTime + durationMs;

        const tick = () => {
            const now = Date.now();
            if (now >= endTime) {
                setProgress(1);
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
                return;
            }
            const elapsed = now - startTime;
            setProgress(Math.min(1, elapsed / durationMs));
            rafRef.current = requestAnimationFrame(tick);
        };

        const now = Date.now();
        if (now >= endTime) {
            setProgress(1);
            return () => {
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
            };
        }
        setProgress(Math.min(1, (now - startTime) / durationMs));
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [startTime, durationMs]);

    const remainingSec = Math.max(0, (1 - progress) * (durationMs / 1000));

    return (
        <div className="flex flex-col gap-1 w-full min-w-[140px] max-w-[240px]">
            <div className="flex justify-between items-center text-xs text-gray-300">
                <span>{label}</span>
                <span className="tabular-nums font-medium">
                    {progress >= 1 ? '0.0초' : `${remainingSec.toFixed(1)}초`}
                </span>
            </div>
            <div className="h-2.5 bg-gray-800 rounded-full border border-gray-600 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-[width] duration-75 ease-linear ${barClassName}`}
                    style={{ width: `${progress * 100}%` }}
                />
            </div>
        </div>
    );
};

export default AttackToTurnGauge;
