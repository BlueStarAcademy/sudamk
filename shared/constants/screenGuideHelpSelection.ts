import type { ScreenGuideId } from '../../utils/screenGuideDismiss.js';

export type ScreenGuideHelpConfig = {
    categoryId: string;
    subId: string;
    /** 좌측 목차에 표시할 대분류 id (없으면 전체) */
    categoryFilter?: string[];
    modalTitle: string;
};

export const SCREEN_GUIDE_HELP_CONFIG: Record<ScreenGuideId, ScreenGuideHelpConfig> = {
    home: {
        categoryId: 'home-screen',
        subId: 'home-profile',
        categoryFilter: ['home-screen'],
        modalTitle: '홈 화면 안내',
    },
    profileEdit: {
        categoryId: 'start',
        subId: 'start-profile-edit',
        categoryFilter: ['start'],
        modalTitle: '프로필 수정 안내',
    },
    guildHome: {
        categoryId: 'guild',
        subId: 'guild-overview',
        categoryFilter: ['guild'],
        modalTitle: '길드 홈 안내',
    },
    singlePlayerAcademy: {
        categoryId: 'pve-academy',
        subId: 'pve-singleplayer',
        categoryFilter: ['pve-academy'],
        modalTitle: '바둑학원 안내',
    },
    trainingQuest: {
        categoryId: 'pve-academy',
        subId: 'pve-training-quest',
        categoryFilter: ['pve-academy'],
        modalTitle: '수련과제 안내',
    },
    tower: {
        categoryId: 'tower-championship',
        subId: 'pve-tower',
        categoryFilter: ['tower-championship'],
        modalTitle: '도전의 탑 안내',
    },
    pvpArena: {
        categoryId: 'lobby',
        subId: 'lobby-pair',
        categoryFilter: ['lobby', 'modes'],
        modalTitle: 'PVP 경기장 안내',
    },
    championship: {
        categoryId: 'tower-championship',
        subId: 'pve-championship',
        categoryFilter: ['tower-championship'],
        modalTitle: '챔피언십 안내',
    },
    adventure: {
        categoryId: 'adventure',
        subId: 'adventure-chapters',
        categoryFilter: ['adventure'],
        modalTitle: '모험 안내',
    },
    petManagement: {
        categoryId: 'pet-management',
        subId: 'pet-mgmt-overview',
        categoryFilter: ['pet-management'],
        modalTitle: '펫 관리 안내',
    },
};
