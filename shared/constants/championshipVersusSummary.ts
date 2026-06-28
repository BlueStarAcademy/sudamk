import type { ChampionshipVersusVenueKind } from '../types/entities.js';

/** Internal session.description prefix for championship versus Kata summary stubs (not user-facing). */
export const CHAMPIONSHIP_VERSUS_KATA_SUMMARY_DESCRIPTION_PREFIX = 'championship-versus-kata:' as const;

export function isChampionshipVersusKataSummaryDescription(description: unknown): boolean {
    return (
        typeof description === 'string' &&
        description.startsWith(CHAMPIONSHIP_VERSUS_KATA_SUMMARY_DESCRIPTION_PREFIX)
    );
}

export function parseChampionshipVersusKataSummaryVenue(description: unknown): ChampionshipVersusVenueKind | null {
    if (!isChampionshipVersusKataSummaryDescription(description)) return null;
    const suffix = description.slice(CHAMPIONSHIP_VERSUS_KATA_SUMMARY_DESCRIPTION_PREFIX.length);
    if (suffix === 'pvp' || suffix === 'pet' || suffix === 'petpair') return suffix;
    return null;
}
