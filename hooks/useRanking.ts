import { useState, useEffect } from 'react';

export interface RankingEntry {
    id: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    rank: number;
    score: number;
    totalGames: number;
    wins: number;
    losses: number;
    league?: string;
    userLevel?: number;
    /** 탐험 랭킹: 몬스터 이해도(도감 완성도) % */
    monsterUnderstandingPercent?: number;
    /** 챔피언십 랭킹: 초반/중반/종반·종합 능력치 */
    openingAbility?: number;
    midgameAbility?: number;
    endgameAbility?: number;
    totalAbility?: number;
}

export interface RankingResponse {
    type: string;
    rankings: RankingEntry[];
    total: number;
    cached: boolean;
}

export function useRanking(type: 'strategic' | 'pair' | 'championship' | 'combat' | 'manner' | 'adventure', limit?: number, offset?: number, season?: boolean) {
    const [rankings, setRankings] = useState<RankingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [cached, setCached] = useState(false);

    useEffect(() => {
        let isCancelled = false;

        const fetchRankings = async () => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams();
                if (limit !== undefined) params.append('limit', limit.toString());
                if (offset !== undefined) params.append('offset', offset.toString());
                if (season === true) params.append('season', 'true');

                const { getApiUrl } = await import('../utils/apiConfig.js');
                const response = await fetch(getApiUrl(`/api/ranking/${type}?${params.toString()}`));
                if (!response.ok) {
                    throw new Error(`Failed to fetch rankings: ${response.statusText}`);
                }

                const data: RankingResponse = await response.json();
                
                if (!isCancelled) {
                    setRankings(data.rankings);
                    setTotal(data.total);
                    setCached(data.cached);
                    setLoading(false);
                }
            } catch (err) {
                if (!isCancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch rankings');
                    setLoading(false);
                }
            }
        };

        fetchRankings();

        return () => {
            isCancelled = true;
        };
    }, [type, limit, offset, season]);

    return { rankings, loading, error, total, cached };
}

