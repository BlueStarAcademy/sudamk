import React from 'react';

function formatHms(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** `deadlineMs`까지 남은 시간을 `H:MM:SS`로 표시합니다. */
const LiveCountdownToMs: React.FC<{
    deadlineMs: number | null | undefined;
    className?: string;
}> = ({ deadlineMs, className }) => {
    const [label, setLabel] = React.useState('');

    React.useEffect(() => {
        if (typeof deadlineMs !== 'number' || !Number.isFinite(deadlineMs)) {
            setLabel('');
            return;
        }
        const tick = () => {
            const ms = Math.max(0, deadlineMs - Date.now());
            const totalSec = Math.floor(ms / 1000);
            setLabel(formatHms(totalSec));
        };
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [deadlineMs]);

    if (!label) return null;

    return <span className={className ?? 'font-mono tabular-nums text-amber-200/90'}>({label})</span>;
};

export default LiveCountdownToMs;
