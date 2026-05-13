/**
 * 배포 후 오래된 번들이 lazy 청크 404를 내기 전에,
 * 루트의 build-version.txt(서버 현재 빌드 ID)와 번들에 박힌 __SHIPPED_BUILD_ID__ 를 맞춥니다.
 */
const PATH = '/build-version.txt';
const POLL_MS = 60_000;

export function startShippedBuildVersionWatcher(): void {
    if (typeof window === 'undefined') return;
    const proto = window.location.protocol;
    if (proto !== 'http:' && proto !== 'https:') return;

    if (import.meta.env.DEV) return;

    const mine = typeof __SHIPPED_BUILD_ID__ !== 'undefined' ? __SHIPPED_BUILD_ID__.trim() : '';
    if (!mine || mine === 'dev') return;

    let inFlight = false;
    const check = async () => {
        if (inFlight || document.visibilityState !== 'visible') return;
        inFlight = true;
        try {
            const r = await fetch(`${PATH}?t=${Date.now()}`, {
                cache: 'no-store',
                credentials: 'same-origin',
            });
            if (!r.ok) return;
            const server = (await r.text()).trim();
            if (server && server !== mine) {
                window.location.reload();
            }
        } catch {
            /* ignore */
        } finally {
            inFlight = false;
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check();
    });
    window.addEventListener('focus', () => void check());
    window.addEventListener('online', () => void check());

    void check();
    window.setInterval(() => void check(), POLL_MS);
}
