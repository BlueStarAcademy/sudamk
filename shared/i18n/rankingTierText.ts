import { tx } from './runtimeText.js';

const TIER_KEY_BY_KO_NAME: Record<string, string> = {
    챌린저: 'champion',
    마스터: 'master',
    다이아: 'diamond',
    플래티넘: 'platinum',
    골드: 'gold',
    실버: 'silver',
    브론즈: 'bronze',
    루키: 'iron',
    새싹: 'unranked',
};

/** RANKING_TIERS 등 한국어 `name` → 로케일 표시명 */
export function translateRankingTierName(koName: string): string {
    const key = TIER_KEY_BY_KO_NAME[koName];
    if (!key) return koName;
    return tx(`inventory:tierInfo.names.${key}`, { defaultValue: koName });
}
