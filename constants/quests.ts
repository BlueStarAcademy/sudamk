import { Quest, QuestReward } from '../types/index.js';

export const DAILY_QUESTS: Omit<Quest, 'id' | 'progress' | 'isClaimed'>[] = [
    { title: '모험에서 승리하기', description: '모험에서 3회 승리', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '전략바둑 승리하기', description: '전략바둑 3회 승리 (대기실 AI·일반 대국 포함)', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '놀이바둑 승리하기', description: '놀이바둑 3회 승리 (대기실 AI·일반 대국 포함)', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 강화시도', description: '장비 강화 1회 시도', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 합성시도', description: '장비 합성 1회 시도', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 제련시도', description: '장비 제련 1회 시도', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 분해시도', description: '장비 분해 1회 시도', target: 1, reward: { gold: 100 }, activityPoints: 10 },
];

export const WEEKLY_QUESTS: Omit<Quest, 'id' | 'progress' | 'isClaimed'>[] = [
    { title: '모험에서 승리하기', description: '모험에서 15회 승리', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '전략바둑 승리하기', description: '전략바둑 15회 승리 (대기실 AI·일반 대국 포함)', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '놀이바둑 승리하기', description: '놀이바둑 15회 승리 (대기실 AI·일반 대국 포함)', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 강화시도', description: '장비 강화 5회 시도', target: 5, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 합성시도', description: '장비 합성 5회 시도', target: 5, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 제련시도', description: '장비 제련 5회 시도', target: 5, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 분해시도', description: '장비 분해 5회 시도', target: 5, reward: { gold: 500 }, activityPoints: 10 },
];

export const MONTHLY_QUESTS: Omit<Quest, 'id' | 'progress' | 'isClaimed'>[] = [
    { title: '모험에서 승리하기', description: '모험에서 50회 승리', target: 50, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '전략바둑 승리하기', description: '전략바둑 30회 승리 (대기실 AI·일반 대국 포함)', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '놀이바둑 승리하기', description: '놀이바둑 30회 승리 (대기실 AI·일반 대국 포함)', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '챔피언십 경기 완료하기', description: '챔피언십 경기 15회 완료', target: 15, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 강화시도', description: '장비 강화 15회 시도', target: 15, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 합성시도', description: '장비 합성 15회 시도', target: 15, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 제련시도', description: '장비 제련 15회 시도', target: 15, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 분해시도', description: '장비 분해 15회 시도', target: 15, reward: { gold: 1500 }, activityPoints: 10 },
];

export const DAILY_MILESTONE_THRESHOLDS = [20, 40, 60, 80, 100];
export const WEEKLY_MILESTONE_THRESHOLDS = [20, 40, 60, 80, 100];
export const MONTHLY_MILESTONE_THRESHOLDS = [20, 40, 60, 80, 100];

export const DAILY_MILESTONE_REWARDS: QuestReward[] = [
    { items: [{ itemId: '골드 꾸러미1', quantity: 1 }] },
    { items: [{ itemId: '행동력 회복제(+10)', quantity: 1 }] },
    { items: [{ itemId: '재료 상자 II', quantity: 1 }] },
    { items: [{ itemId: '장비 상자 II', quantity: 1 }] },
    { items: [{ itemId: '골드 꾸러미3', quantity: 1 }] },
];

export const WEEKLY_MILESTONE_REWARDS: QuestReward[] = [
    { items: [{ itemId: '골드 꾸러미2', quantity: 1 }] },
    { items: [{ itemId: '행동력 회복제(+20)', quantity: 1 }] },
    { items: [{ itemId: '재료 상자 III', quantity: 1 }] },
    { items: [{ itemId: '장비 상자 III', quantity: 1 }] },
    { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
];

export const MONTHLY_MILESTONE_REWARDS: QuestReward[] = [
    { items: [{ itemId: '골드 꾸러미3', quantity: 1 }] },
    { items: [{ itemId: '행동력 회복제(+30)', quantity: 1 }] },
    { items: [{ itemId: '재료 상자 IV', quantity: 1 }] },
    { items: [{ itemId: '장비 상자 IV', quantity: 1 }] },
    { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
];
