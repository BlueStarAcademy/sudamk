import { computeTouchLayoutProfile } from '../hooks/useIsMobileLayout.js';

let lastLockAttempt = 0;

function doLockOnce(): void {
    const orient = (screen as Screen & { orientation?: ScreenOrientation & { lock?: (o: string) => Promise<void> } })
        .orientation;
    const lockFn = orient?.lock;
    if (!lockFn) return;
    lockFn.call(orient, 'portrait').catch(() => {
        lockFn.call(orient, 'portrait-primary').catch(() => {});
    });
}

/**
 * 터치 폰(소형)에서만 OS 세로 고정 시도. CSS로 돌리지 않음(회전 연출·세로폭 축소 방지).
 * lock 성공 시 기기가 가로로 돌아가도 뷰포트는 세로로 유지되는 경우가 많음.
 */
export function tryLockPortraitForPhoneHandheld(minIntervalMs = 400): void {
    if (typeof window === 'undefined') return;
    if (!computeTouchLayoutProfile().isPhoneHandheldTouch) return;

    const now = Date.now();
    if (now - lastLockAttempt < minIntervalMs) return;
    lastLockAttempt = now;

    doLockOnce();
}

/** 회전 직후 등: 스로틀 없이 여러 번 시도(브라우저가 회전 완료 후에야 lock 받는 경우) */
function burstLockPortraitNoThrottle(): void {
    if (typeof window === 'undefined') return;
    if (!computeTouchLayoutProfile().isPhoneHandheldTouch) return;
    doLockOnce();
    requestAnimationFrame(() => doLockOnce());
    [32, 120, 320, 700].forEach((ms) => setTimeout(() => doLockOnce(), ms));
}

/** 앱 부팅 직후·로드 이후 세로 잠금을 계속 재시도(첫 화면이 가로로 잡히는 경우 완화). */
export function installPortraitLockLifecycleForPhoneHandheld(): void {
    const onVisibility = () => {
        if (document.visibilityState === 'visible') tryLockPortraitForPhoneHandheld(0);
    };

    tryLockPortraitForPhoneHandheld(0);
    if (document.readyState !== 'complete') {
        window.addEventListener('load', () => tryLockPortraitForPhoneHandheld(0), { once: true });
    }
    window.addEventListener('focus', () => tryLockPortraitForPhoneHandheld());
    const onOrientation = () => burstLockPortraitNoThrottle();
    window.addEventListener('orientationchange', onOrientation);
    document.addEventListener('visibilitychange', onVisibility);

    const orient = (screen as Screen & { orientation?: ScreenOrientation & EventTarget }).orientation;
    orient?.addEventListener?.('change', onOrientation);

    const onGesture = () => tryLockPortraitForPhoneHandheld(0);
    document.addEventListener('touchstart', onGesture, { passive: true, capture: true });
    document.addEventListener('click', onGesture, { capture: true });

    window.addEventListener('resize', () => tryLockPortraitForPhoneHandheld(120));
    window.addEventListener('pageshow', () => burstLockPortraitNoThrottle());
    document.addEventListener('fullscreenchange', () => tryLockPortraitForPhoneHandheld(0));
}
