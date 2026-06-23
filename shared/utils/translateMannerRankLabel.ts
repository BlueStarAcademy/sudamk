import type { TFunction } from 'i18next';
import type { MannerRankId } from '../constants/mannerRanks.js';
import { MANNER_RANK_DEFINITIONS, resolveMannerRankIdFromLabel } from '../constants/mannerRanks.js';

const MANNER_RANK_IDS = new Set<string>([
    'worst',
    'veryBad',
    'bad',
    'caution',
    'normal',
    'good',
    'veryGood',
    'dignified',
    'pro',
    'master',
]);

export function translateMannerRankLabel(t: TFunction, rankLabelOrId: string): string {
    const id: MannerRankId | null = MANNER_RANK_IDS.has(rankLabelOrId)
        ? (rankLabelOrId as MannerRankId)
        : resolveMannerRankIdFromLabel(rankLabelOrId);
    if (!id) return rankLabelOrId;
    const fallback =
        MANNER_RANK_DEFINITIONS.find((rank) => rank.id === id)?.name ?? rankLabelOrId;
    return t(`profile:mannerRank.grades.${id}`, { defaultValue: fallback });
}
