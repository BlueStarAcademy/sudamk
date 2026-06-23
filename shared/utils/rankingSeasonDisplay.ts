/** 시즌 랭킹 헤더용 — `lobby:ranked.seasonSuffix`와 동일 규칙 */
export function formatCurrentSeasonLabel(t: (key: string, opts?: Record<string, unknown>) => string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = now.getMonth();
    let season: number;
    if (month < 3) season = 1;
    else if (month < 6) season = 2;
    else if (month < 9) season = 3;
    else season = 4;
    return t('ranked.seasonSuffix', { year, season });
}
