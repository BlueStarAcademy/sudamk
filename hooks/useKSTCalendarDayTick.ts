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

        /** 마운트 직후·탭 복귀 시에도 즉시 반영 (전날 한도 UI가 남는 경우 방지) */
        sync();

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

        /** 백그라운드 탭에서 setTimeout이 지연될 때를 대비해 주기적으로 KST 일자 확인 */
        const intervalId = window.setInterval(sync, 60_000);

        const onVisibility = () => {
            if (document.visibilityState === 'visible') sync();
        };
        window.addEventListener('focus', sync);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearTimeout(timeoutId);
            window.clearInterval(intervalId);
            window.removeEventListener('focus', sync);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    return kstDayKey;
}
