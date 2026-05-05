import type { User } from '../types/index.js';
import {
    STRATEGIC_RANKED_STAT_KEY,
    PAIR_RANKED_STAT_KEY,
    STRATEGIC_RANKED_MATCH_RECORD_KEY,
    PAIR_RANKED_MATCH_RECORD_KEY,
} from '../shared/constants/userRankedStats.js';
import { RANKED_ELO_BASE_SCORE } from '../shared/constants/rules.js';

/**
 * 전략·페어 랭킹전 전적 전용 필드를 초기화하고 레이팅을 기준점으로 맞춘다.
 * `- 서버 스크립트·관리자 일괄 초기화에서 공통 사용.
 */
export function applyRankedMatchStatsFullResetToUser(user: User, now: number): void {
    if (!user.stats) user.stats = {};
    const st = user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>;

    st[STRATEGIC_RANKED_MATCH_RECORD_KEY] = { wins: 0, losses: 0 };
    st[PAIR_RANKED_MATCH_RECORD_KEY] = { wins: 0, losses: 0 };
    st[STRATEGIC_RANKED_STAT_KEY] = { rankingScore: RANKED_ELO_BASE_SCORE };
    st[PAIR_RANKED_STAT_KEY] = { rankingScore: RANKED_ELO_BASE_SCORE };

    if (!user.cumulativeRankingScore) user.cumulativeRankingScore = {};
    user.cumulativeRankingScore.standard = 0;
    user.cumulativeRankingScore.pair = 0;

    if (!user.dailyRankings) {
        user.dailyRankings = {};
    }
    user.dailyRankings.strategic = { rank: 0, score: 0, lastUpdated: now };
    user.dailyRankings.pair = { rank: 0, score: 0, lastUpdated: now };
}
