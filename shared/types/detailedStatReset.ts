/** 상세 전적 초기화 범위 — PVP 승패, AI 승패, 또는 둘 다 */
export type DetailedStatResetScope = 'pvp' | 'ai' | 'both';

export type DetailedStatRecordSlice = {
    wins: number;
    losses: number;
};
