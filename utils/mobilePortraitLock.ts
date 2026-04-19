import { computeTouchLayoutProfile } from '../hooks/useIsMobileLayout.js';

let lastLockAttempt = 0;

/**
 * 터치 폰(소형 휴대기기)에서만 OS 세로 고정 시도. 태블릿·PC 터치는 제외(computeTouchLayoutProfile).
 * 일부 브라우저는 사용자 제스처/전체화면 뒤에만 lock 성공 — 반복 시도는 이벤트 리스너에서 처리.
 */
export function tryLockPortraitForPhoneHandheld(minIntervalMs = 400): void {
    if (typeof window === 'undefined') return;
    if (!computeTouchLayoutProfile().isPhoneHandheldTouch) return;

    const now = Date.now();
    if (now - lastLockAttempt < minIntervalMs) return;
    lastLockAttempt = now;

    const orient = (screen as Screen & { orientation?: ScreenOrientation & { lock?: (o: string) => Promise<void> } })
        .orientation;
    const lockFn = orient?.lock;
    if (!lockFn) return;

    lockFn.call(orient, 'portrait').catch(() => {
        lockFn.call(orient, 'portrait-primary').catch(() => {});
    });
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
    window.addEventListener('orientationchange', () => tryLockPortraitForPhoneHandheld(0));
    document.addEventListener('visibilitychange', onVisibility);

    const orient = (screen as Screen & { orientation?: ScreenOrientation & EventTarget }).orientation;
    orient?.addEventListener?.('change', () => tryLockPortraitForPhoneHandheld(0));

    const onGesture = () => tryLockPortraitForPhoneHandheld(0);
    document.addEventListener('touchstart', onGesture, { passive: true, capture: true });
    document.addEventListener('click', onGesture, { capture: true });

    window.addEventListener('resize', () => tryLockPortraitForPhoneHandheld());
    window.addEventListener('pageshow', () => tryLockPortraitForPhoneHandheld(0));
    document.addEventListener('fullscreenchange', () => tryLockPortraitForPhoneHandheld(0));
}
