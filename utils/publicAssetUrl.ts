/** Vite `public/` 자산 — `base` 서브경로 배포 대응 */
export function resolvePublicUrl(path: string): string {
    const base = import.meta.env.BASE_URL || '/';
    const p = path.replace(/^\//, '');
    if (base === '/') return `/${p}`;
    return `${base.replace(/\/?$/, '/')}${p}`;
}

export function getMainBackgroundUrl(): string {
    return resolvePublicUrl('images/mainbg.webp');
}
