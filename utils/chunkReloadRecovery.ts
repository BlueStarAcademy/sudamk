/**
 * 배포 직후 이전 번들이 lazy import로 옛 해시 청크를 요청할 때 404가 나는 경우를 완화합니다.
 * 한 번 자동 새로고침한 뒤, 앱이 잠시 안정되면 플래그를 지워 이후 배포에도 동일 복구를 허용합니다.
 */
const STORAGE_KEY = 'sudam_stale_chunk_autoreload';

export function clearStaleChunkReloadFlag(): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

function isStaleChunkLoadMessage(message: string): boolean {
    return (
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module') ||
        message.includes('Unable to preload CSS')
    );
}

export function isStaleChunkLoadError(reason: unknown): boolean {
    if (reason instanceof Error) return isStaleChunkLoadMessage(reason.message);
    if (reason && typeof reason === 'object' && 'message' in reason) {
        const m = (reason as { message: unknown }).message;
        if (typeof m === 'string') return isStaleChunkLoadMessage(m);
    }
    return isStaleChunkLoadMessage(String(reason ?? ''));
}

/** useEffect에서 반환할 정리 함수 — 앱이 잠시 안정되면 자동 새로고침 플래그를 초기화합니다. */
export function staleChunkReloadFlagResetEffect(): () => void {
    if (typeof window === 'undefined') return () => {};
    const ms = 4000;
    const id = window.setTimeout(() => {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }, ms);
    return () => window.clearTimeout(id);
}

/**
 * 오래된 청크로 인한 로드 실패로 보이면 최대 1회 자동 새로고침합니다.
 * @returns 새로고침을 시작했으면 true
 */
export function tryReloadOnceForStaleBuild(reason: unknown): boolean {
    if (typeof window === 'undefined') return false;
    if (!isStaleChunkLoadError(reason)) return false;
    try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return false;
        sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
        window.location.reload();
        return true;
    }
    window.location.reload();
    return true;
}
