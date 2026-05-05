import { useEffect, useState } from 'react';
import { getStartOfDayKST, getTodayKSTDateString } from '../shared/utils/timeUtils.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * KST 자정이 지나면 상태가 바뀌어, 서버 user 객체가 그대로여도 일일 한도·남은 횟수 UI가 갱신되도록 합니다.
 */
export function useKSTCalendarDayTick(): string {
    const [kstDayKey, setKstDayKey] = useState(() => getTodayKSTDateString());

    useEffect(() => {
        const sync = () => {
            setKstDayKey((prev) => {
                const next = getTodayKSTDateString();
                return next === prev ? prev : next;
            });
        };

        let timeoutId: ReturnType<typeof setTimeout>;

        const scheduleMidnight = () => {
            const now = Date.now();
            const nextKstMidnight = getStartOfDayKST(now) + DAY_MS;
            const ms = Math.max(50, nextKstMidnight - now);
            timeoutId = setTimeout(() => {
                sync();
                scheduleMidnight();
            }, ms);
        };

        scheduleMidnight();

        const onVisibility = () => {
            if (document.visibilityState === 'visible') sync();
        };
        window.addEventListener('focus', sync);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('focus', sync);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    return kstDayKey;
}
