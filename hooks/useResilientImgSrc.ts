import { useCallback, useEffect, useRef, useState, type ReactEventHandler } from 'react';

/**
 * 정적 이미지가 가끔 깨질 때(네트워크 순간 실패, 손상된 캐시 엔트리 등) 한 번만 쿼리 붙여 재요청.
 */
export function useResilientImgSrc(originalSrc: string | undefined | null): {
    src: string;
    onError: ReactEventHandler<HTMLImageElement>;
} {
    const base = originalSrc ?? '';
    const [src, setSrc] = useState(base);
    const busted = useRef(false);

    useEffect(() => {
        setSrc(base);
        busted.current = false;
    }, [base]);

    const onError = useCallback(() => {
        if (!base || busted.current) return;
        busted.current = true;
        const sep = base.includes('?') ? '&' : '?';
        setSrc(`${base}${sep}nocache=${Date.now()}`);
    }, [base]);

    return { src, onError };
}
