/** 카카오·라인 등 메신저 인앱 브라우저 — 세로 잠금·safe-area와 충돌해 외부 브라우저 유도 */
export const IN_APP_BROWSER_ESCAPE_STORAGE_KEY = 'sudamr.inAppBrowserEscape.v1';

declare global {
    interface Window {
        __SUDAMR_IN_APP_BROWSER__?: boolean;
    }
}

export function isKakaoTalkInAppBrowser(userAgent?: string): boolean {
    const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    return /KAKAOTALK/i.test(ua);
}

/** 메신저·SNS 인앱 WebView (외부 브라우저 권장) */
export function isMessagingInAppBrowser(userAgent?: string): boolean {
    const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    if (isKakaoTalkInAppBrowser(ua)) return true;
    if (/Line\//i.test(ua)) return true;
    if (/Instagram/i.test(ua)) return true;
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return true;
    if (/NAVER\(inapp/i.test(ua)) return true;
    return false;
}

export function buildKakaoOpenExternalUrl(targetUrl: string): string {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(targetUrl)}`;
}

/** Android: Chrome 등 시스템 브라우저 Intent (카카오 외 인앱용 보조) */
export function buildAndroidHttpsIntentUrl(targetUrl: string): string {
    const stripped = targetUrl.replace(/^https?:\/\//i, '');
    return `intent://${stripped}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end`;
}

export function markInAppBrowserEscapeAttempted(): void {
    if (typeof window === 'undefined') return;
    window.__SUDAMR_IN_APP_BROWSER__ = true;
    try {
        sessionStorage.setItem(IN_APP_BROWSER_ESCAPE_STORAGE_KEY, 'redirected');
    } catch {
        // private mode
    }
}

export function wasInAppBrowserEscapeAttempted(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return sessionStorage.getItem(IN_APP_BROWSER_ESCAPE_STORAGE_KEY) === 'redirected';
    } catch {
        return false;
    }
}

/**
 * 인앱 브라우저면 시스템 브라우저로 열기 시도.
 * @returns 리다이렉트를 시도했으면 true (이후 스크립트 중단 권장)
 */
export function tryRedirectToSystemBrowser(targetUrl?: string): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent ?? '';
    if (!isMessagingInAppBrowser(ua)) return false;

    window.__SUDAMR_IN_APP_BROWSER__ = true;

    if (wasInAppBrowserEscapeAttempted()) {
        return false;
    }

    markInAppBrowserEscapeAttempted();

    const url = targetUrl ?? window.location.href;

    if (isKakaoTalkInAppBrowser(ua)) {
        window.location.replace(buildKakaoOpenExternalUrl(url));
        return true;
    }

    if (/Android/i.test(ua)) {
        window.location.replace(buildAndroidHttpsIntentUrl(url));
        return true;
    }

    return false;
}

export function shouldSkipHandheldOrientationLock(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.__SUDAMR_IN_APP_BROWSER__) return true;
    return isMessagingInAppBrowser();
}
