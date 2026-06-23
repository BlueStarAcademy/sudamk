
// FIX: Import missing types from the centralized types file.
import { User } from '../types/index.js';
import {
    MANNER_RANK_COLORS,
    MANNER_RANK_DEFINITIONS,
    resolveMannerRankFromScore,
    type MannerRankId,
} from '../shared/constants/mannerRanks.js';

export type { MannerRankId } from '../shared/constants/mannerRanks.js';
export { MANNER_RANK_DEFINITIONS as MANNER_RANKS, resolveMannerRankIdFromLabel } from '../shared/constants/mannerRanks.js';

export const getMannerScore = (user: User): number => {
    return user.mannerScore ?? 200;
};

export const getMannerRank = (score: number): { rank: string; rankId: MannerRankId; color: string } => {
    const tier = resolveMannerRankFromScore(score);
    return { rank: tier.name, rankId: tier.id, color: MANNER_RANK_COLORS[tier.id] ?? 'text-gray-300' };
};

export const getMannerStyle = (score: number): { percentage: number, colorClass: string } => {
    const percentage = Math.max(0, Math.min(100, (score / 2000) * 100));
    let colorClass = 'bg-red-700';
    if (score >= 2000) colorClass = 'bg-purple-400';
    else if (score >= 1600) colorClass = 'bg-blue-400';
    else if (score >= 1200) colorClass = 'bg-cyan-400';
    else if (score >= 800) colorClass = 'bg-teal-400';
    else if (score >= 400) colorClass = 'bg-green-400';
    else if (score >= 200) colorClass = 'bg-gray-300';
    else if (score >= 100) colorClass = 'bg-yellow-400';
    else if (score >= 50) colorClass = 'bg-orange-400';
    else if (score >= 1) colorClass = 'bg-red-500';
    return { percentage, colorClass };
};
