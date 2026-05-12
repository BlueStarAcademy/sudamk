import React, { useEffect, useRef, useState } from 'react';
import { preloadImages } from '../services/assetService.js';

export type EntryImagePreloadGateProps = {
    /** 프리로드할 정적 이미지 URL 목록(모듈 상수 권장 — 매 렌더 새 배열 금지) */
    urls: readonly string[];
    /** 로딩 오버레이에 표시할 문구 */
    label: string;
    children: React.ReactNode;
    /** 최소 표시 시간(ms). 아주 짧은 로드에서 깜빡임 완화 (기본 240) */
    minDisplayMs?: number;
};

/**
 * 화면 진입 시 지정 이미지를 선로드한 뒤 자식을 표시한다.
 * 브라우저 캐시에 이미 있으면 곧바로 끝나며, 이후 동일 URL은 추가 비용이 거의 없다.
 */
const EntryImagePreloadGate: React.FC<EntryImagePreloadGateProps> = ({ urls, label, children, minDisplayMs = 240 }) => {
    const [ready, setReady] = useState(() => urls.length === 0);
    const startRef = useRef(0);

    useEffect(() => {
        if (urls.length === 0) {
            setReady(true);
            return;
        }

        let cancelled = false;
        let settleTimer: ReturnType<typeof setTimeout> | undefined;
        startRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setReady(false);

        preloadImages([...urls], {
            priority: 'low',
            maxConcurrent: 4,
            isCancelled: () => cancelled,
        })
            .catch(() => {})
            .finally(() => {
                if (cancelled) return;
                const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                const elapsed = now - startRef.current;
                const rest = Math.max(0, minDisplayMs - elapsed);
                if (rest <= 0) {
                    setReady(true);
                } else {
                    settleTimer = setTimeout(() => {
                        if (!cancelled) setReady(true);
                    }, rest);
                }
            });

        return () => {
            cancelled = true;
            if (settleTimer) clearTimeout(settleTimer);
        };
    }, [urls, minDisplayMs]);

    return (
        <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden" aria-busy={!ready}>
            {children}
            {!ready && (
                <div
                    className="absolute inset-0 z-[35] flex flex-col items-center justify-center gap-4 bg-zinc-950/75 px-6 text-center backdrop-blur-md"
                    role="status"
                    aria-live="polite"
                >
                    <div
                        className="h-11 w-11 shrink-0 rounded-full border-2 border-amber-400/30 border-t-amber-300 animate-spin"
                        aria-hidden
                    />
                    <p className="max-w-sm text-sm font-medium leading-relaxed text-stone-100">{label}</p>
                </div>
            )}
        </div>
    );
};

export default EntryImagePreloadGate;
