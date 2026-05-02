export type NewFeatureBadgeKey = 'exchange' | 'pairLobby';

const NEW_FEATURE_BADGE_START_AT_MS = Date.parse('2026-05-02T14:33:00+09:00');
const NEW_FEATURE_BADGE_END_AT_MS = NEW_FEATURE_BADGE_START_AT_MS + 7 * 24 * 60 * 60 * 1000;

export function isNewFeatureBadgeActive(key: NewFeatureBadgeKey, nowMs: number = Date.now()): boolean {
    if (key !== 'exchange' && key !== 'pairLobby') return false;
    return nowMs >= NEW_FEATURE_BADGE_START_AT_MS && nowMs < NEW_FEATURE_BADGE_END_AT_MS;
}

export const NEW_FEATURE_BADGE_CLASS =
    'pointer-events-none absolute z-30 rounded-full border border-rose-200/70 bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-wide text-white shadow-[0_0_12px_rgba(251,146,60,0.7),0_4px_10px_-6px_rgba(0,0,0,0.8)] ring-1 ring-white/20';
