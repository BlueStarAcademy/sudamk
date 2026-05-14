import React from 'react';
import LiveCountdownToMs from './LiveCountdownToMs.js';

/**
 * 결투권이 최대 미만일 때 다음 충전 시각(`getChampionshipVersusDuelTicketNextAtForVenue`)까지 남은 시간을 `H:MM:SS`로 표시합니다.
 * (경기장별 `championshipVersusDuelTicketNextAtByVenue`; 구 단일 필드는 PVP 미러용)
 */
const ChampionshipVersusDuelTicketCountdown: React.FC<{
    current: number;
    max: number;
    nextAt?: number;
    className?: string;
}> = ({ current, max, nextAt, className }) => {
    if (current >= max || typeof nextAt !== 'number' || !Number.isFinite(nextAt)) return null;
    return (
        <LiveCountdownToMs
            deadlineMs={nextAt}
            className={className ?? 'font-mono tabular-nums text-amber-200/90'}
        />
    );
};

export default ChampionshipVersusDuelTicketCountdown;
