import {
    FACTORY_GO_LOBBY_IMG,
    TRAINING_GROUND_GO_LOBBY_IMG,
    GUILD_GO_LOBBY_IMG,
    PAIR_GO_LOBBY_IMG,
    PLAYFUL_GO_LOBBY_IMG,
    SINGLE_PLAYER_LOBBY_IMG,
    STRATEGIC_GO_LOBBY_IMG,
    TOURNAMENT_LOBBY_IMG,
    TOWER_CHALLENGE_LOBBY_IMG,
} from '../../assets.js';

export type HomeEntranceSectionId = 'compete' | 'growth' | 'casual' | 'social';

export type HomeEntranceCardId =
    | 'arena'
    | 'pairArena'
    | 'championship'
    | 'stage'
    | 'tower'
    | 'adventure'
    | 'factory'
    | 'trainingGround'
    | 'friendly'
    | 'playground'
    | 'guild';

export type HomeEntranceAccent = 'amber' | 'emerald' | 'cyan' | 'indigo' | 'orange' | 'violet';

export type HomeEntranceCardDef = {
    id: HomeEntranceCardId;
    titleKey: string;
    /** optional static blurb; omitted when card uses dynamic-only info */
    metaKey?: string;
    accent: HomeEntranceAccent;
    imageSrc: string;
    alignEnd?: boolean;
};

export type HomeEntranceSectionDef = {
    id: HomeEntranceSectionId;
    accent: HomeEntranceAccent;
    cards: HomeEntranceCardDef[];
};

/** 홈 입장 카드 — 기존 Profile 로비 타일/경기장 배경 WebP */
export const HOME_ENTRANCE_SECTIONS: HomeEntranceSectionDef[] = [
    {
        id: 'growth',
        accent: 'emerald',
        cards: [
            {
                id: 'stage',
                titleKey: 'goSchool',
                accent: 'emerald',
                imageSrc: SINGLE_PLAYER_LOBBY_IMG,
            },
            {
                id: 'adventure',
                titleKey: 'adventure',
                accent: 'emerald',
                imageSrc: '/images/forest.webp',
            },
            {
                id: 'tower',
                titleKey: 'challengeTower',
                accent: 'emerald',
                imageSrc: TOWER_CHALLENGE_LOBBY_IMG,
            },
        ],
    },
    {
        id: 'compete',
        accent: 'amber',
        cards: [
            {
                id: 'arena',
                titleKey: 'matchArena',
                accent: 'amber',
                imageSrc: STRATEGIC_GO_LOBBY_IMG,
            },
            {
                id: 'pairArena',
                titleKey: 'pairArena',
                accent: 'violet',
                imageSrc: PAIR_GO_LOBBY_IMG,
            },
            {
                id: 'championship',
                titleKey: 'championship',
                accent: 'amber',
                imageSrc: TOURNAMENT_LOBBY_IMG,
            },
        ],
    },
    {
        id: 'casual',
        accent: 'cyan',
        cards: [
            {
                id: 'friendly',
                titleKey: 'friendlyMatch',
                accent: 'cyan',
                imageSrc: PAIR_GO_LOBBY_IMG,
            },
            {
                id: 'playground',
                titleKey: 'playground',
                metaKey: 'lobbyMetaPlayground',
                accent: 'cyan',
                imageSrc: PLAYFUL_GO_LOBBY_IMG,
            },
        ],
    },
    {
        id: 'social',
        accent: 'indigo',
        cards: [
            {
                id: 'factory',
                titleKey: 'productionFactory',
                accent: 'violet',
                imageSrc: FACTORY_GO_LOBBY_IMG,
            },
            {
                id: 'trainingGround',
                titleKey: 'trainingGroundHomeTile',
                accent: 'amber',
                imageSrc: TRAINING_GROUND_GO_LOBBY_IMG,
            },
            {
                id: 'guild',
                titleKey: 'guildHomeTile',
                accent: 'indigo',
                imageSrc: GUILD_GO_LOBBY_IMG,
            },
        ],
    },
];
