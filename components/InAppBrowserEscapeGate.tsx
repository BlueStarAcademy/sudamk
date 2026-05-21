import React, { useCallback, useEffect, useState } from 'react';
import {
    buildAndroidHttpsIntentUrl,
    buildKakaoOpenExternalUrl,
    isKakaoTalkInAppBrowser,
    isMessagingInAppBrowser,
    tryRedirectToSystemBrowser,
    wasInAppBrowserEscapeAttempted,
} from '../utils/inAppBrowserEscape.js';

/**
 * 자동 리다이렉트가 막힌 경우(특히 iOS) 사용자 제스처로 외부 브라우저를 여는 안내.
 */
const InAppBrowserEscapeGate: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isMessagingInAppBrowser()) return;
        if (tryRedirectToSystemBrowser()) return;

        const t = window.setTimeout(() => {
            if (isMessagingInAppBrowser() && wasInAppBrowserEscapeAttempted()) {
                setVisible(true);
            }
        }, 600);
        return () => window.clearTimeout(t);
    }, []);

    const openExternal = useCallback(() => {
        const url = window.location.href;
        const ua = navigator.userAgent ?? '';
        if (isKakaoTalkInAppBrowser(ua)) {
            window.location.href = buildKakaoOpenExternalUrl(url);
            return;
        }
        if (/Android/i.test(ua)) {
            window.location.href = buildAndroidHttpsIntentUrl(url);
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="in-app-browser-escape-title"
        >
            <div className="w-full max-w-sm rounded-xl border border-white/15 bg-slate-900/95 p-5 text-center shadow-2xl">
                <h2 id="in-app-browser-escape-title" className="text-lg font-bold text-white">
                    브라우저에서 열기
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    카카오톡·메신저 안에서는 화면이 돌아가거나 위쪽이 잘리는 문제가 있을 수 있습니다. Chrome·Safari 등
                    <strong className="font-semibold text-white"> 기본 브라우저</strong>에서 플레이해 주세요.
                </p>
                <button
                    type="button"
                    onClick={openExternal}
                    className="mt-5 w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500 active:bg-sky-700"
                >
                    외부 브라우저에서 열기
                </button>
                <p className="mt-3 text-xs text-slate-500">
                    버튼이 동작하지 않으면 ⋯ 메뉴에서 「Safari/Chrome에서 열기」를 선택해 주세요.
                </p>
            </div>
        </div>
    );
};

export default InAppBrowserEscapeGate;
