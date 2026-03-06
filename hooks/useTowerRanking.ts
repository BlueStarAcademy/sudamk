import { useEffect, useState } from 'react';

export interface TowerRankingEntry {
    id: string;
    nickname: string;
    avatarId?: string;
    borderId?: string;
    rank: number;
    towerFloor?: number;
    monthlyTowerFloor?: number;
    lastTowerClearTime?: number;
}

export interface TowerRankingResponse {
    type: 'tower';
    rankings: TowerRankingEntry[];
    total: number;
    cached: boolean;
}

const DEFAULT_STALE_TIME_MS = 60 * 1000;

type TowerRankingCache = TowerRankingResponse & {
    timestamp: number;
};

let towerRankingCache: TowerRankingCache | null = null;
let towerRankingRequest: Promise<TowerRankingResponse> | null = null;

const normalizeTowerRankingResponse = (data: Partial<TowerRankingResponse>): TowerRankingResponse => {
    const rankings = Array.isArray(data.rankings) ? data.rankings : [];
    return {
        type: 'tower',
        rankings,
        total: typeof data.total === 'number' ? data.total : rankings.length,
        cached: Boolean(data.cached),
    };
};

const getCachedTowerRanking = (staleTimeMs: number): TowerRankingCache | null => {
    if (!towerRankingCache) return null;
    if ((Date.now() - towerRankingCache.timestamp) >= staleTimeMs) return null;
    return towerRankingCache;
};

const fetchTowerRanking = async (forceRefresh = false, staleTimeMs = DEFAULT_STALE_TIME_MS): Promise<TowerRankingResponse> => {
    const cachedData = !forceRefresh ? getCachedTowerRanking(staleTimeMs) : null;
    if (cachedData) {
        return {
            type: cachedData.type,
            rankings: cachedData.rankings,
            total: cachedData.total,
            cached: true,
        };
    }

    if (towerRankingRequest) {
        return towerRankingRequest;
    }

    towerRankingRequest = (async () => {
        const { getApiUrl } = await import('../utils/apiConfig.js');
        const response = await fetch(getApiUrl('/api/ranking/tower'));
        if (!response.ok) {
            throw new Error(`Failed to fetch tower rankings: ${response.statusText}`);
        }

        const data = normalizeTowerRankingResponse(await response.json());
        towerRankingCache = {
            ...data,
            timestamp: Date.now(),
        };
        return data;
    })();

    try {
        return await towerRankingRequest;
    } finally {
        towerRankingRequest = null;
    }
};

export const invalidateTowerRankingCache = () => {
    towerRankingCache = null;
};

export function useTowerRanking(refreshKey = 0, staleTimeMs = DEFAULT_STALE_TIME_MS) {
    const initialCache = refreshKey > 0 ? null : getCachedTowerRanking(staleTimeMs);

    const [rankings, setRankings] = useState<TowerRankingEntry[]>(() => initialCache?.rankings ?? []);
    const [loading, setLoading] = useState(() => !initialCache);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(() => initialCache?.total ?? 0);
    const [cached, setCached] = useState(() => Boolean(initialCache));

    useEffect(() => {
        let isCancelled = false;

        const cachedData = refreshKey > 0 ? null : getCachedTowerRanking(staleTimeMs);
        if (cachedData) {
            setRankings(cachedData.rankings);
            setTotal(cachedData.total);
            setCached(true);
            setError(null);
            setLoading(false);
            return () => {
                isCancelled = true;
            };
        }

        const forceRefresh = refreshKey > 0;
        if (!forceRefresh || rankings.length === 0) {
            setLoading(true);
        }
        setError(null);

        const load = async () => {
            try {
                const data = await fetchTowerRanking(forceRefresh, staleTimeMs);
                if (!isCancelled) {
                    setRankings(data.rankings);
                    setTotal(data.total);
                    setCached(data.cached);
                    setLoading(false);
                }
            } catch (err) {
                if (!isCancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch tower rankings');
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            isCancelled = true;
        };
    }, [refreshKey, staleTimeMs]);

    const refetch = async () => {
        invalidateTowerRankingCache();
        const data = await fetchTowerRanking(true, staleTimeMs);
        setRankings(data.rankings);
        setTotal(data.total);
        setCached(data.cached);
        setError(null);
        setLoading(false);
        return data;
    };

    return { rankings, loading, error, total, cached, refetch };
}
