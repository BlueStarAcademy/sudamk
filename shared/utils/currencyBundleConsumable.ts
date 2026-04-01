/**
 * 골드/다이아 꾸러미 소모품 이름을 서버 `currencyBundles` 키 형태로 통일 (표기·공백 차이 제거).
 */
export function resolveCurrencyBundleConsumableKey(name: string): string | null {
    const collapsed = (name || '').replace(/\s+/g, ' ').trim();
    if (!collapsed) return null;
    let n = collapsed;
    if (n.startsWith('골드꾸러미')) n = '골드 꾸러미' + n.slice('골드꾸러미'.length);
    else if (n.startsWith('다이아꾸러미')) n = '다이아 꾸러미' + n.slice('다이아꾸러미'.length);
    const strict = n.match(/^(골드|다이아)\s+꾸러미\s*(\d+)$/);
    if (strict) return `${strict[1]} 꾸러미${strict[2]}`;
    const loose = n.match(/(골드|다이아)\s*꾸러미\s*(\d+)/);
    if (loose) return `${loose[1]} 꾸러미${loose[2]}`;
    return null;
}
