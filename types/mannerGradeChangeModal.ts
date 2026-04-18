export type MannerGradeChangePayload = {
    direction: 'up' | 'down';
    previousRank: string;
    newRank: string;
    previousScore: number;
    newScore: number;
};
