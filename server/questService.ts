

import * as types from '../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';

/** 경기 요약 등에서 퀘스트 중복·제외 조건을 넘길 때 사용 */
export type QuestProgressContext = {
    /** `adventure`이면 「전략바둑 승리하기」는 카운트하지 않음(「모험에서 승리하기」 전용) */
    gameCategory?: string;
};

export type QuestProgressEvent =
    | 'win'
    | 'participate'
    | 'pvp_participate'
    | 'action_button'
    | 'tournament_participate'
    | 'enhancement_attempt'
    | 'equipment_combine_attempt'
    | 'equipment_refine_attempt'
    | 'equipment_disassemble_attempt'
    | 'craft_attempt'
    | 'chat_greeting'
    | 'championship_play'
    | 'adventure_win'
    | 'login'
    | 'claim_daily_milestone_100'
    | 'claim_weekly_milestone_100'
    | 'training_quest_claim'
    | 'tower_challenge'
    | 'guild_donate'
    | 'guild_boss_participate';

export const updateQuestProgress = (
    user: types.User,
    type: QuestProgressEvent,
    mode?: types.GameMode,
    amount: number = 1,
    questContext?: QuestProgressContext
) => {
    if (!user.quests) return;
    const isStrategic = mode ? SPECIAL_GAME_MODES.some(m => m.mode === mode) : false;
    const isPlayful = mode ? PLAYFUL_GAME_MODES.some((m: { mode: types.GameMode; }) => m.mode === mode) : false;

    const questsToUpdate: types.Quest[] = [
        ...(user.quests.daily?.quests || []),
        ...(user.quests.weekly?.quests || []),
        ...(user.quests.monthly?.quests || [])
    ];

    for (const quest of questsToUpdate) {
        if (quest.isClaimed) continue;

        let shouldUpdate = false;
        switch (quest.title) {
            case '출석하기': if (type === 'login') shouldUpdate = true; break;
            case '채팅창에 인사하기': if (type === 'chat_greeting') shouldUpdate = true; break;
            case '전략바둑 플레이하기': if (type === 'participate' && isStrategic) shouldUpdate = true; break;
            case '놀이바둑 플레이하기': if (type === 'participate' && isPlayful) shouldUpdate = true; break;
            case '전략바둑 경기하기(PVP)':
            case '전략바둑 경기하기':
                if (type === 'pvp_participate' && isStrategic) shouldUpdate = true;
                break;
            case '놀이바둑 경기하기(PVP)':
            case '놀이바둑 경기하기':
                if (type === 'pvp_participate' && isPlayful) shouldUpdate = true;
                break;
            case '전략바둑 승리하기':
                if (
                    type === 'win' &&
                    isStrategic &&
                    questContext?.gameCategory !== 'adventure'
                ) {
                    shouldUpdate = true;
                }
                break;
            case '놀이바둑 승리하기': if (type === 'win' && isPlayful) shouldUpdate = true; break;
            case '모험에서 승리하기': if (type === 'adventure_win') shouldUpdate = true; break;
            case '액션버튼 사용하기':
            case '매너액션 버튼 사용하기':
                if (type === 'action_button') shouldUpdate = true;
                break;
            case '챔피언십 경기 완료':
            case '챔피언십 경기 완료하기':
            case '챔피언십 경기 진행하기':
            case '자동대국 토너먼트 참여하기':
                if (type === 'championship_play' || type === 'tournament_participate') shouldUpdate = true;
                break;
            case '장비 강화':
            case '장비 강화시도':
                if (type === 'enhancement_attempt') shouldUpdate = true;
                break;
            case '장비 합성':
            case '장비 합성시도':
                if (type === 'equipment_combine_attempt') shouldUpdate = true;
                break;
            case '장비 제련':
            case '장비 제련시도':
                if (type === 'equipment_refine_attempt') shouldUpdate = true;
                break;
            case '장비 분해':
            case '장비 분해시도':
                if (type === 'equipment_disassemble_attempt') shouldUpdate = true;
                break;
            case '재료 합성/분해':
            case '재료 합성시도':
            case '재료 합성/분해 시도':
                if (type === 'craft_attempt') shouldUpdate = true;
                break;
            case '수련과제 수령하기': if (type === 'training_quest_claim') shouldUpdate = true; break;
            case '도전의 탑 도전하기': if (type === 'tower_challenge') shouldUpdate = true; break;
            case '일일 퀘스트 활약도 100보상 받기 (3회)':
            case '일일퀘스트 활약도100보상 받기 3회':
            case '일일퀘스트 활약도100보상 받기(3/3)':
            case '일일 퀘스트 활약도100 보상받기 10회':
                if (type === 'claim_daily_milestone_100') shouldUpdate = true;
                break;
            case '주간 퀘스트 활약도 100보상 받기 (2회)':
            case '주간퀘스트 활약도100보상 받기(2/2)':
                if (type === 'claim_weekly_milestone_100') shouldUpdate = true;
                break;
        }

        if (shouldUpdate) {
            quest.progress = Math.min(quest.target, quest.progress + amount);
        }
    }
};