export type MannerRankId =
    | 'worst'
    | 'veryBad'
    | 'bad'
    | 'caution'
    | 'normal'
    | 'good'
    | 'veryGood'
    | 'dignified'
    | 'pro'
    | 'master';

export type MannerRankDefinition = {
    id: MannerRankId;
    /** 서버·로직용 한국어 정식 라벨 */
    name: string;
    min: number;
    max: number;
};

export const MANNER_RANK_DEFINITIONS: MannerRankDefinition[] = [
    { id: 'worst', name: '최악', min: 0, max: 0 },
    { id: 'veryBad', name: '매우 나쁨', min: 1, max: 49 },
    { id: 'bad', name: '나쁨', min: 50, max: 99 },
    { id: 'caution', name: '주의', min: 100, max: 199 },
    { id: 'normal', name: '보통', min: 200, max: 399 },
    { id: 'good', name: '좋음', min: 400, max: 799 },
    { id: 'veryGood', name: '매우 좋음', min: 800, max: 1199 },
    { id: 'dignified', name: '품격', min: 1200, max: 1599 },
    { id: 'pro', name: '프로', min: 1600, max: 1999 },
    { id: 'master', name: '마스터', min: 2000, max: Infinity },
];

export const MANNER_RANK_COLORS: Record<MannerRankId, string> = {
    worst: 'text-red-700',
    veryBad: 'text-red-500',
    bad: 'text-orange-400',
    caution: 'text-yellow-400',
    normal: 'text-gray-300',
    good: 'text-green-400',
    veryGood: 'text-teal-400',
    dignified: 'text-cyan-400',
    pro: 'text-blue-400',
    master: 'text-purple-400',
};

export function resolveMannerRankFromScore(score: number): MannerRankDefinition {
    return [...MANNER_RANK_DEFINITIONS].reverse().find((tier) => score >= tier.min) ?? MANNER_RANK_DEFINITIONS[0];
}

export function resolveMannerRankIdFromLabel(label: string): MannerRankId | null {
    return MANNER_RANK_DEFINITIONS.find((rank) => rank.name === label)?.id ?? null;
}
