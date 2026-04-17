import { Quest, QuestReward } from '../types/index.js';

export const DAILY_QUESTS: Omit<Quest, 'id' | 'progress' | 'isClaimed'>[] = [
    { title: '출석하기', description: '출석 1회', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '채팅창에 인사하기', description: '대기실 채팅에 인사 1회', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '모험에서 승리하기', description: '모험에서 3회 승리', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '전략바둑 경기하기(PVP)', description: '전략바둑 PVP 대국 3회', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '놀이바둑 경기하기(PVP)', description: '놀이바둑 PVP 대국 3회', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '전략바둑 승리하기', description: '전략바둑 3회 승리 (대기실 AI·일반 대국 포함)', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '놀이바둑 승리하기', description: '놀이바둑 3회 승리 (대기실 AI·일반 대국 포함)', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '챔피언십 경기 완료', description: '챔피언십(던전) 경기 3회 완료', target: 3, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 강화', description: '장비 강화 1회', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 합성', description: '장비 합성 1회', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 제련', description: '장비 제련 1회', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '장비 분해', description: '장비 분해 1회', target: 1, reward: { gold: 100 }, activityPoints: 10 },
    { title: '재료 합성/분해', description: '재료 합성 또는 분해 1회', target: 1, reward: { gold: 100 }, activityPoints: 10 },
];

export const WEEKLY_QUESTS: Omit<Quest, 'id' | 'progress' | 'isClaimed'>[] = [
    { title: '출석하기', description: '출석 5회 (날짜당 1회)', target: 5, reward: { gold: 500 }, activityPoints: 10 },
    { title: '모험에서 승리하기', description: '모험에서 15회 승리', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '전략바둑 경기하기(PVP)', description: '전략바둑 PVP 대국 15회', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '놀이바둑 경기하기(PVP)', description: '놀이바둑 PVP 대국 15회', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '전략바둑 승리하기', description: '전략바둑 15회 승리 (대기실 AI·일반 대국 포함)', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '놀이바둑 승리하기', description: '놀이바둑 15회 승리 (대기실 AI·일반 대국 포함)', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '챔피언십 경기 완료', description: '챔피언십(던전) 경기 15회 완료', target: 15, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 강화', description: '장비 강화 10회', target: 10, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 합성', description: '장비 합성 10회', target: 10, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 제련', description: '장비 제련 10회', target: 10, reward: { gold: 500 }, activityPoints: 10 },
    { title: '장비 분해', description: '장비 분해 10회', target: 10, reward: { gold: 500 }, activityPoints: 10 },
    { title: '재료 합성/분해', description: '재료 합성 또는 분해 10회', target: 10, reward: { gold: 500 }, activityPoints: 10 },
    { title: '일일 퀘스트 활약도 100보상 받기 (3회)', description: '일일 활약도 100 달성 보상 수령 3회', target: 3, reward: { gold: 500 }, activityPoints: 10 },
];

export const MONTHLY_QUESTS: Omit<Quest, 'id' | 'progress' | 'isClaimed'>[] = [
    { title: '출석하기', description: '출석 15회 (날짜당 1회)', target: 15, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '모험에서 승리하기', description: '모험에서 30회 승리', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '전략바둑 경기하기(PVP)', description: '전략바둑 PVP 대국 30회', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '놀이바둑 경기하기(PVP)', description: '놀이바둑 PVP 대국 30회', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '전략바둑 승리하기', description: '전략바둑 30회 승리 (대기실 AI·일반 대국 포함)', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '놀이바둑 승리하기', description: '놀이바둑 30회 승리 (대기실 AI·일반 대국 포함)', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '챔피언십 경기 완료', description: '챔피언십(던전) 경기 30회 완료', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 강화', description: '장비 강화 30회', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 합성', description: '장비 합성 30회', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 제련', description: '장비 제련 30회', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '장비 분해', description: '장비 분해 30회', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '재료 합성/분해', description: '재료 합성 또는 분해 30회', target: 30, reward: { gold: 1500 }, activityPoints: 10 },
    { title: '주간 퀘스트 활약도 100보상 받기 (2회)', description: '주간 활약도 100 달성 보상 수령 2회', target: 2, reward: { gold: 1500 }, activityPoints: 10 },
];

export const DAILY_MILESTONE_THRESHOLDS = [20, 40, 60, 80, 100];
export const WEEKLY_MILESTONE_THRESHOLDS = [20, 40, 60, 80, 100];
export const MONTHLY_MILESTONE_THRESHOLDS = [20, 40, 60, 80, 100];

export const DAILY_MILESTONE_REWARDS: QuestReward[] = [
    { items: [{ itemId: '골드 꾸러미1', quantity: 1 }] },
    { items: [{ itemId: 'action_point_10', quantity: 1 }] },
    { items: [{ itemId: '재료 상자 II', quantity: 1 }] },
    { items: [{ itemId: '장비 상자 II', quantity: 1 }] },
    { items: [{ itemId: '골드 꾸러미3', quantity: 1 }] },
];

export const WEEKLY_MILESTONE_REWARDS: QuestReward[] = [
    { items: [{ itemId: '골드 꾸러미2', quantity: 1 }] },
    { items: [{ itemId: 'action_point_20', quantity: 1 }] },
    { items: [{ itemId: '재료 상자 III', quantity: 1 }] },
    { items: [{ itemId: '장비 상자 III', quantity: 1 }] },
    { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
];

export const MONTHLY_MILESTONE_REWARDS: QuestReward[] = [
    { items: [{ itemId: '골드 꾸러미3', quantity: 1 }] },
    { items: [{ itemId: 'action_point_30', quantity: 1 }] },
    { items: [{ itemId: '재료 상자 IV', quantity: 1 }] },
    { items: [{ itemId: '장비 상자 IV', quantity: 1 }] },
    { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
];
