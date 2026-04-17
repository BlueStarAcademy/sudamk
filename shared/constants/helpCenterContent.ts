import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from './gameModes.js';
import { GUILD_BOSS_MAX_ATTEMPTS } from './guildConstants.js';
import { ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP, ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import { ADVENTURE_REGIONAL_BUFF_ACTION_GOLD } from '../../utils/adventureRegionalSpecialtyBuff.js';

export type HelpImageRef = { src: string; alt: string; caption?: string };

export type HelpBlock =
    | { type: 'heading'; text: string; level?: 2 | 3 }
    | { type: 'paragraph'; text: string }
    | { type: 'bullets'; items: string[] }
    | { type: 'callout'; tone: 'tip' | 'info' | 'warn'; title?: string; text: string }
    | { type: 'imageRow'; images: HelpImageRef[]; compact?: boolean }
    | { type: 'figure'; src: string; alt: string; caption?: string };

export type HelpArticle = {
    id: string;
    title: string;
    tagline?: string;
    hero?: HelpImageRef;
    blocks: HelpBlock[];
};

export type HelpSubcategory = {
    id: string;
    label: string;
    article: HelpArticle;
};

export type HelpCategory = {
    id: string;
    label: string;
    iconSrc?: string;
    accentClass?: string;
    subcategories: HelpSubcategory[];
};

const strategicGallery: HelpImageRef[] = SPECIAL_GAME_MODES.map((g) => ({
    src: g.image,
    alt: g.name,
    caption: g.name,
}));

const playfulGallery: HelpImageRef[] = PLAYFUL_GAME_MODES.map((g) => ({
    src: g.image,
    alt: g.name,
    caption: g.name,
}));

const adventureChapterGallery: HelpImageRef[] = ADVENTURE_STAGES.map((s) => ({
    src: s.mapWebp,
    alt: s.title,
    caption: s.title,
}));

export const HELP_CENTER_CATEGORIES: HelpCategory[] = [
    {
        id: 'start',
        label: '시작하기',
        iconSrc: '/images/button/help.webp',
        accentClass: 'from-amber-500/20 to-yellow-600/10',
        subcategories: [
            {
                id: 'start-home',
                label: '홈 · 퀵메뉴',
                article: {
                    id: 'start-home',
                    title: '홈 화면과 퀵메뉴',
                    tagline: '한 화면에서 입장부터 성장 콘텐츠까지 연결됩니다.',
                    hero: { src: '/images/bg/mainbg.webp', alt: '홈 배경' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '홈에는 프로필·바둑 능력·각 경기장 입장 카드가 모여 있습니다. 카드에는 대표 이미지와 핵심 정보가 함께 표시되어 원하는 모드로 바로 이동할 수 있습니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: '/images/quickmenu/quest.png', alt: '퀘스트', caption: '퀘스트' },
                                { src: '/images/quickmenu/gibo.png', alt: '기보', caption: '기보' },
                                { src: '/images/quickmenu/enhance.png', alt: '대장간', caption: '대장간' },
                                { src: '/images/quickmenu/store.png', alt: '상점', caption: '상점' },
                                { src: '/images/quickmenu/bag.png', alt: '가방', caption: '가방' },
                                { src: '/images/button/help.webp', alt: '도움말', caption: '도움말' },
                            ],
                        },
                        {
                            type: 'heading',
                            text: '우측(또는 상단) 퀵 메뉴',
                            level: 3,
                        },
                        {
                            type: 'bullets',
                            items: [
                                '퀘스트: 일일·주간 목표를 확인하고 보상을 수령합니다.',
                                '기보: 저장된 대국 기록을 열어 복기합니다.',
                                '대장간: 장비 강화·조합·분해 등 성장 탭으로 이동합니다.',
                                '상점: 재화로 아이템을 구매합니다.',
                                '가방: 장비·소모품·재료 인벤토리를 정리합니다.',
                                '랭킹·채팅: 순위표와 채널 대화를 빠르게 엽니다.',
                                '도감: 아이템 도감(별도 창)에서 전체 아이콘과 옵션을 봅니다.',
                                '도움말: 지금 보고 있는 통합 안내입니다. 모험·챕터·탐험도는 「모험」 범주, 바둑학원·도전의 탑은 「바둑학원 · 도전의 탑」에서 확인합니다.',
                                '공지: 운영 공지와 이벤트를 확인합니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '팁',
                            text: '대기실·길드 등 서브 화면에서도 동일한 퀵 메뉴 구성을 유지해, 어디서든 성장 루틴을 끊지 않도록 설계되어 있습니다.',
                        },
                    ],
                },
            },
            {
                id: 'start-settings',
                label: '설정 · 계정',
                article: {
                    id: 'start-settings',
                    title: '설정과 계정',
                    tagline: '그래픽·알림·프로필 편집은 설정에서 한곳에 모았습니다.',
                    hero: { src: '/images/simbols/simbol1.png', alt: '설정' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '설정 창에서는 게임 환경(효과음·알림 등), 프로필 편집, 앱 관련 옵션을 조정할 수 있습니다. 변경 사항은 대부분 즉시 반영됩니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '닉네임·대표 이미지 등 프로필 정보는 프로필/설정 경로에서 수정합니다.',
                                '공지·도움말은 퀵 메뉴에서 언제든 다시 열 수 있습니다.',
                                '문제가 지속되면 공지에 안내된 고객 지원 채널을 이용해 주세요.',
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'lobby',
        label: '대기실 · 매칭',
        iconSrc: '/images/PlayingArena.png',
        accentClass: 'from-cyan-500/15 to-sky-600/10',
        subcategories: [
            {
                id: 'lobby-common',
                label: '대기실 이용법',
                article: {
                    id: 'lobby-common',
                    title: '대기실에서 할 수 있는 것',
                    tagline: '접속자 목록부터 관전·채팅까지 한 공간에서 처리합니다.',
                    hero: { src: '/images/PlayingArena.png', alt: '대기실' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전략·놀이 대기실에서는 접속 중인 플레이어 목록, 진행 중인 대국, 채팅, 랭킹 패널을 동시에 볼 수 있습니다. 상대에게 대국을 신청하거나 AI 봇과 연습할 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '플레이어를 선택해 대국을 신청하면 상대가 수락할 때 경기가 열립니다.',
                                '진행 중인 방은 관전해 수읽기 학습에 활용할 수 있습니다.',
                                '우측 퀵 메뉴로 퀘스트·가방·상점·도움말 등을 그대로 이용합니다.',
                                '각 게임 모드의 세부 규칙은 통합 도움말(퀵 메뉴의 도움말)에서 모드별로 확인할 수 있습니다.',
                            ],
                        },
                        {
                            type: 'imageRow',
                            images: [
                                { src: '/images/bg/strategicbg.png', alt: '전략 대기실', caption: '전략 바둑' },
                                { src: '/images/bg/playfulbg.png', alt: '놀이 대기실', caption: '놀이 바둑' },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'lobby-ranked',
                label: '랭크 · 티어',
                article: {
                    id: 'lobby-ranked',
                    title: '랭크전과 티어 표시',
                    tagline: '시즌 점수와 배치 경기가 티어 자격에 영향을 줍니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '랭크 모드에서는 모드별 랭킹 점수가 오르고 내립니다. 대기실 랭킹 패널에서 순위를 확인하고, 티어 안내(아이콘)를 눌러 구간 설명을 볼 수 있습니다.',
                        },
                        {
                            type: 'callout',
                            tone: 'info',
                            title: '시즌과 연동',
                            text: '시즌제·최소 대국 수(배치) 등은 「랭킹 · 시즌」 도움말 항목에서 자세히 설명합니다.',
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'pve',
        label: '바둑학원 · 도전의 탑',
        iconSrc: '/images/tower/Tower.png',
        accentClass: 'from-emerald-500/15 to-amber-600/10',
        subcategories: [
            {
                id: 'pve-singleplayer',
                label: '바둑학원',
                article: {
                    id: 'pve-singleplayer',
                    title: '바둑학원',
                    tagline: '난이도별 스테이지와 수련과제로 AI와 수읽기를 연습합니다.',
                    hero: { src: '/images/single/Map.png', alt: '바둑학원' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '입문·초급·중급·고급 등 반(난이도 구간)을 고르고 스테이지를 순서대로 진행합니다. 각 스테이지는 AI 상대와의 대국으로 클리어 여부가 결정됩니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '상단에서 반을 바꾸면 해당 구간의 스테이지 격자가 열립니다.',
                                '수련과제는 시간이 지나 쌓이는 보상을 수령하는 성장 루틴입니다. 과제마다 해금 스테이지가 있습니다.',
                                '모바일에서는 하단 탭으로 수련과제와 스테이지 화면을 전환할 수 있습니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '팁',
                            text: '진행도는 계정에 저장되며, 프로필에서 입장한 뒤에도 퀵 메뉴로 퀘스트·가방 등을 그대로 이용할 수 있습니다.',
                        },
                    ],
                },
            },
            {
                id: 'pve-tower',
                label: '도전의 탑',
                article: {
                    id: 'pve-tower',
                    title: '도전의 탑',
                    tagline: '100층 PvE, 월간 랭킹과 보상이 함께 갱신됩니다.',
                    hero: { src: '/images/tower/Tower.png', alt: '도전의 탑' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '도전의 탑은 100층으로 구성된 PvE 콘텐츠입니다. 층을 올라갈수록 난이도가 높아지며, 클리어 시 보상을 받을 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '랭킹은 달성한 층수와 기록 시간 등으로 정해집니다.',
                                '로비에서 인벤토리·아이템 상점 등 탑 전용 도구를 사용할 수 있습니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'warn',
                            title: '월간 초기화',
                            text: '매월 1일 0시(KST)에 층 진행이 초기화됩니다. 월간 최고 층에 따른 정산 보상 구간과 상세 내역은 로비의 「보상정보」에서 확인하세요.',
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'modes',
        label: '게임 모드',
        iconSrc: '/images/simbols/simbol7.png',
        accentClass: 'from-violet-500/15 to-fuchsia-600/10',
        subcategories: [
            {
                id: 'modes-strategic',
                label: '전략 바둑 모드',
                article: {
                    id: 'modes-strategic',
                    title: '전략 바둑 모드 안내',
                    tagline: '클래식부터 미사일·믹스룰까지, 수읽기 중심 라인업입니다.',
                    hero: { src: '/images/bg/strategicbg.png', alt: '전략 바둑' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전략 바둑은 정통 규칙과 변형 규칙을 바탕으로 한 모드 묶음입니다. 각 모드의 승리 조건·특수 규칙·아이템은 통합 도움말(퀵 메뉴의 도움말)에서 게임별로 확인하는 것이 가장 정확합니다.',
                        },
                        { type: 'heading', text: '모드 아이콘', level: 3 },
                        {
                            type: 'imageRow',
                            images: strategicGallery,
                            compact: true,
                        },
                        {
                            type: 'bullets',
                            items: SPECIAL_GAME_MODES.map(
                                (g) => `${g.name}: ${g.description}`,
                            ),
                        },
                    ],
                },
            },
            {
                id: 'modes-playful',
                label: '놀이 바둑 모드',
                article: {
                    id: 'modes-playful',
                    title: '놀이 바둑 모드 안내',
                    tagline: '주사위·역할·액션형 등 가볍게 즐기는 라인업입니다.',
                    hero: { src: '/images/bg/playfulbg.png', alt: '놀이 바둑' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '놀이 바둑은 바둑판과 돌을 활용한 캐주얼·파티 게임 성격의 모드입니다. 모드마다 턴 구조와 승패 판정이 다르므로, 첫 플레이 전에 통합 도움말(퀵 메뉴의 도움말)을 권장합니다.',
                        },
                        { type: 'heading', text: '모드 아이콘', level: 3 },
                        {
                            type: 'imageRow',
                            images: playfulGallery,
                            compact: true,
                        },
                        {
                            type: 'bullets',
                            items: PLAYFUL_GAME_MODES.map((g) => `${g.name}: ${g.description}`),
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'adventure',
        label: '모험',
        iconSrc: '/images/adventure.png',
        accentClass: 'from-amber-500/22 via-fuchsia-600/12 to-violet-900/15',
        subcategories: [
            {
                id: 'adventure-chapters',
                label: '챕터 맵 · 몬스터',
                article: {
                    id: 'adventure-chapters',
                    title: '챕터 맵과 몬스터',
                    tagline: '입장부터 맵 탐색·대국까지 한눈에.',
                    hero: { src: '/images/adventure.png', alt: '모험' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '홈·프로필에서 모험에 들어가 챕터를 고릅니다. 맵에서 몬스터를 선택해 대국하면 행동력이 소모되고, 승리 시 보상·이해도가 쌓입니다.',
                        },
                        { type: 'imageRow', compact: true, images: adventureChapterGallery },
                        {
                            type: 'bullets',
                            items: [
                                '챕터마다 몬스터 종류·맵·보상 테이블이 다릅니다.',
                                '몬스터 도감은 종별 승리 누적로 이해도 레벨이 오르며, 챕터·전체 완성도에 반영됩니다.',
                                '이어서 열리는 챕터는 앞 챕터 조건을 만족해야 합니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'adventure-exploration',
                label: '지역 탐험도',
                article: {
                    id: 'adventure-exploration',
                    title: '지역 탐험도 XP',
                    tagline: '챕터별로 쌓이는 탐험도와 보정 요약.',
                    hero: { src: '/images/forest.webp', alt: '챕터 맵 예시' },
                    blocks: [
                        { type: 'heading', text: 'XP · 티어 · 슬롯', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '해당 챕터 몬스터 전투 승리 시 그 챕터의 지역 탐험도 XP가 오릅니다.',
                                '티어가 오를 때마다 그 지역 전용 강화 포인트가 늘고, 효과 슬롯이 하나씩 열립니다.',
                            ],
                        },
                        { type: 'heading', text: '패시브 보너스', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '모험 골드·드롭 등 일부 보정은 XP 곡선으로 합산되며, 일지에 숫자로 표시됩니다.',
                                `「친숙함」 이상을 달성한 지역 수에 따라 코어 능력치에 소폭 보너스가 붙을 수 있으며, 상한은 ${ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP}%입니다.`,
                            ],
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: adventureChapterGallery,
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            text: '탐험도·슬롯·강화 포인트는 챕터마다 따로 관리됩니다.',
                        },
                    ],
                },
            },
            {
                id: 'adventure-slots',
                label: '효과 슬롯',
                article: {
                    id: 'adventure-slots',
                    title: '지역 특화 효과',
                    tagline: '슬롯에서 뽑는 챕터 전용 버프.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '지역 탐험도 패널에서 챕터 탭을 고르면, 그 지역에서 적용되는 특화 효과 슬롯을 볼 수 있습니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: '/images/icon/Gold.png', alt: '골드', caption: '변경·강화 비용' },
                                { src: '/images/adventure.png', alt: '모험', caption: '효과 획득·변경' },
                            ],
                        },
                        {
                            type: 'bullets',
                            items: [
                                '빈 슬롯: 「효과 획득」으로 무료 랜덤 1종이 들어갑니다.',
                                `효과가 있는 슬롯: 「변경」 시 ${ADVENTURE_REGIONAL_BUFF_ACTION_GOLD.toLocaleString()}골드로 다시 뽑습니다. 강화 단계가 있었다면 확인 후 1단계로 돌아가고 포인트가 환급됩니다.`,
                                `「강화」는 ${ADVENTURE_REGIONAL_BUFF_ACTION_GOLD.toLocaleString()}골드와 강화 포인트 1을 써서 수치를 올립니다. 종류마다 최대 단계가 있습니다.`,
                                '이미 끼운 종류는 가능한 한 나오지 않도록 뽑힙니다.',
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'growth',
        label: '성장 · 스탯',
        iconSrc: '/images/quickmenu/enhance.png',
        accentClass: 'from-emerald-500/15 to-teal-600/10',
        subcategories: [
            {
                id: 'growth-level',
                label: '레벨 · 스탯 포인트',
                article: {
                    id: 'growth-level',
                    title: '레벨과 스탯 포인트',
                    tagline: '전략·놀이 경험치는 각각 쌓이며, 레벨업 시 보너스 포인트가 생깁니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전략 바둑과 놀이 바둑을 플레이하면 각 트랙에 경험치가 쌓입니다. 게이지가 100%가 되면 해당 트랙 레벨이 오릅니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '전략 레벨과 놀이 레벨이 오를 때마다 보너스 스탯 포인트가 지급됩니다.',
                                '프로필의 「포인트 분배」에서 전투력·집중력·판단력 등 핵심 능력치에 투자합니다.',
                                '능력치는 챔피언십·길드 보스전 등 시뮬레이션 콘텐츠 결과에 반영됩니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'growth-ap',
                label: '행동력',
                article: {
                    id: 'growth-ap',
                    title: '행동력(액션)',
                    tagline: '일부 콘텐츠 입장에 소모되며, 시간에 따라 회복됩니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '행동력은 대국 입장 등에 사용되는 자원입니다. 부족할 때는 안내 모달에서 회복 수단이나 남은 시간을 확인할 수 있습니다.',
                        },
                        {
                            type: 'callout',
                            tone: 'warn',
                            title: '매너와 연동',
                            text: '매너 등급이 낮아지면 최대 행동력이 줄거나 회복 속도에 불리한 효과가 붙을 수 있습니다. 「매너 등급」 항목을 참고하세요.',
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'gear',
        label: '장비 · 대장간',
        iconSrc: '/images/quickmenu/enhance.png',
        accentClass: 'from-orange-500/15 to-amber-600/10',
        subcategories: [
            {
                id: 'gear-basics',
                label: '장비 개요',
                article: {
                    id: 'gear-basics',
                    title: '장비 시스템',
                    tagline: '부위·등급·옵션이 캐릭터 성능을 만듭니다.',
                    hero: { src: '/images/button/itembook.png', alt: '도감' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '부채·바둑판·의상 등 여러 부위의 장비를 착용해 능력치를 올립니다. 등급은 일반에서 신화까지 단계가 있으며, 높을수록 주옵션·부옵션·특수 효과가 강해집니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '신화 등급에는 다른 등급에 없는 신화 전용 옵션이 붙을 수 있습니다.',
                                '가방에서 장착·교체하고, 대장간에서 강화·분해·조합 등을 진행합니다.',
                                '도감에서는 모든 아이템의 아이콘과 설명을 미리 볼 수 있습니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'gear-blacksmith',
                label: '대장간 기능',
                article: {
                    id: 'gear-blacksmith',
                    title: '대장간 탭 안내',
                    tagline: '강화·조합·분해·전환·정련으로 장비를 다듬습니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '대장간은 장비 성장의 중심입니다. 탭마다 재료와 골드·다이아 등 비용 규칙이 다르므로, 화면 상단 도움말(대장간 전용)을 함께 열어두면 안전합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '강화: 성공 시 주옵션이 크게 상승하고, 부옵션이 추가되거나 강화될 수 있습니다.',
                                '분해: 불필요 장비를 재료로 바꿉니다. 대박 시 추가 보상이 있습니다.',
                                '조합·전환·정련: 보유 재료에 따라 상위 장비나 옵션 조정을 시도합니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '도감과 연계',
                            text: '주옵션 +4·+7·+10 구간에서 보너스가 달라지는 등 세부 규칙은 「도감 · 옵션 규칙」 항목에 정리했습니다.',
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'rank',
        label: '랭킹 · 시즌',
        iconSrc: '/images/quickmenu/store.png',
        accentClass: 'from-indigo-500/15 to-purple-600/10',
        subcategories: [
            {
                id: 'rank-season',
                label: '랭킹 점수 · 시즌',
                article: {
                    id: 'rank-season',
                    title: '랭킹과 시즌 제도',
                    tagline: '모드별 점수와 분기 시즌이 티어 보상을 나눕니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '게임 모드마다 랭킹 점수가 있으며 승리 시 오르고 패배 시 내려갑니다. 이 점수로 순위가 매겨집니다.',
                        },
                        {
                            type: 'heading',
                            text: '시즌(분기) 요약',
                            level: 3,
                        },
                        {
                            type: 'bullets',
                            items: [
                                '시즌은 약 3개월 단위(분기)로 돌아갑니다.',
                                '시즌 동안 각 모드에서 최소 20경기(배치)를 채워야 해당 모드 티어 보상 자격이 생깁니다.',
                                '20경기 미만이면 시즌 종료 시 「새싹」 티어로 마감됩니다.',
                                '시즌이 끝나면 배치를 완료한 플레이어에게 순위에 따른 티어와 우편 보상이 지급됩니다.',
                                '새 시즌이 시작되면 전적·랭킹 점수가 초기화되고 다시 배치 20경기가 필요합니다.',
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'manner',
        label: '매너 등급',
        iconSrc: '/images/button/help.webp',
        accentClass: 'from-rose-500/10 to-red-900/10',
        subcategories: [
            {
                id: 'manner-detail',
                label: '점수 · 보상 · 페널티',
                article: {
                    id: 'manner-detail',
                    title: '매너 등급 시스템',
                    tagline: '모든 모드에서 공통으로 관리되는 신뢰 지표입니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '매너 점수는 접속 종료·시간 초과 등 비매너 행동에 감소하고, 정상 플레이에 증가합니다. 등급이 높으면 보상·분해 등에 유리한 효과가 붙고, 낮아지면 골드·상자·행동력 등에 불리한 효과가 단계적으로 쌓입니다. 등급을 회복하면 최근 페널티부터 순서대로 해제됩니다.',
                        },
                        {
                            type: 'heading',
                            text: '등급별 요약',
                            level: 3,
                        },
                        {
                            type: 'bullets',
                            items: [
                                '마스터 (2000+): 모든 능력치 +10',
                                '프로 (1600~1999): 장비 분해 대박 확률 +20%',
                                '품격 (1200~1599): 승리 시 보상 상자 확률 +20%',
                                '매우 좋음 (800~1199): 승리 시 골드 +20%',
                                '좋음 (400~799): 최대 행동력 +10',
                                '보통 (200~399): 기본',
                                '주의 (100~199): 보상 상자 확률 절반',
                                '나쁨 (50~99): 승리 골드 절반',
                                '매우 나쁨 (1~49): 행동력 회복 느려짐',
                                '최악 (0): 최대 행동력 감소',
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'pve',
        label: '도전의 탑 · 챔피언십',
        iconSrc: '/images/simbols/simbol3.png',
        accentClass: 'from-fuchsia-500/15 to-pink-600/10',
        subcategories: [
            {
                id: 'pve-tower',
                label: '도전의 탑',
                article: {
                    id: 'pve-tower',
                    title: '도전의 탑',
                    tagline: '월간 층수·시간·순위가 핵심입니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '도전의 탑은 정해진 기간 안에 얼마나 높은 층에 도달하느냐를 겨루는 PvE 콘텐츠입니다. 현재 층, 남은 시간, 랭킹 정보를 통해 진행도를 파악할 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '층이 올라갈수록 난이도와 보상이 함께 상승하는 구조입니다.',
                                '화면 내 도움말 버튼으로 시즌·규칙 세부를 확인할 수 있습니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'pve-championship',
                label: '챔피언십',
                article: {
                    id: 'pve-championship',
                    title: '챔피언십(시뮬 대회)',
                    tagline: '능력치·장비 세팅으로 자동 시뮬레이션 결과를 받습니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '챔피언십은 AI 시뮬레이션으로 진행되는 대회 형식입니다. 프로필에서 분배한 스탯과 착용 장비가 가상 경기 결과에 반영되며, 일별로 다른 종류의 대회에 참가할 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '시즌 점수와 현재 순위가 장기 성장 지표로 표시됩니다.',
                                '동네·전국·월드 등 단계별 진행도를 통해 목표 설정에 활용하세요.',
                                '3·6·9·10단계는 관문 보상이 강화됩니다. 동네는 골드, 전국은 강화석 티어·신비의 강화석 저확률, 월드는 장비 등급 확률이 단계마다 달라집니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'pve-training',
                label: '연습 · AI 스테이지',
                article: {
                    id: 'pve-training',
                    title: '연습 모드와 AI 스테이지',
                    tagline: '봇과의 대국·미션형 스테이지로 실력을 다듬습니다.',
                    hero: { src: '/images/simbols/simbol1.png', alt: '연습' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '대기실에서 AI 봇과 바로 대국을 신청해 규칙을 익히거나, 싱글/연습 콘텐츠에서 스테이지 조건을 클리어하며 보상을 받을 수 있습니다. 스테이지마다 목표(승리 조건·턴 제한 등)가 다를 수 있으니 입장 전 설명을 확인하세요.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '훈련·성장 퀘스트와 연동된 스테이지는 퀘스트 창에서 진행도와 보상을 함께 봅니다.',
                                '히든·미사일 등 특수 규칙이 있는 모드는 인게임 도움말과 아이템 안내를 참고하세요.',
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'guild',
        label: '길드',
        iconSrc: '/images/guild/profile/icon1.png',
        accentClass: 'from-emerald-600/15 to-green-900/10',
        subcategories: [
            {
                id: 'guild-overview',
                label: '길드 개요',
                article: {
                    id: 'guild-overview',
                    title: '길드란?',
                    tagline: '기부·연구·보스·전쟁·미션으로 함께 성장하는 커뮤니티입니다.',
                    hero: { src: '/images/guild/profile/icon1.png', alt: '길드' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '길드에 가입하면 길드 전용 화면에서 여러 협동 콘텐츠를 이용합니다. 길드 레벨이 오르면 혜택이 늘어나는 구조입니다.',
                        },
                        {
                            type: 'imageRow',
                            images: [
                                { src: '/images/guild/button/bossraid1.png', alt: '보스', caption: '보스전' },
                                { src: '/images/guild/button/guildwar.png', alt: '전쟁', caption: '전쟁' },
                                { src: '/images/guild/button/guildlab.png', alt: '연구', caption: '연구소' },
                                { src: '/images/guild/button/guildmission.png', alt: '미션', caption: '미션' },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'guild-donate',
                label: '기부 · 성장',
                article: {
                    id: 'guild-donate',
                    title: '기부와 길드 성장',
                    tagline: '골드·다이아 기부로 길드 코인·연구 포인트·기여도를 얻습니다.',
                    blocks: [
                        {
                            type: 'bullets',
                            items: [
                                '기부는 일일 한도가 있으며 매일 초기화됩니다.',
                                '길드 경험치와 개인 기여도가 함께 쌓입니다.',
                                '길드 코인은 길드 상점 등에서 사용합니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'guild-boss',
                label: '길드 보스전',
                article: {
                    id: 'guild-boss',
                    title: '길드 보스전',
                    tagline: '주간 보스에게 입힌 피해로 등급과 보상이 결정됩니다.',
                    hero: { src: '/images/guild/button/bossraid1.png', alt: '보스전' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: `길드원이 같은 주간 보스에게 도전해 피해량을 기록합니다. 매주 월요일 0시(한국 시간)에 보스가 바뀝니다. 하루 최대 ${GUILD_BOSS_MAX_ATTEMPTS}회 도전할 수 있으며 횟수는 매일 초기화됩니다.`,
                        },
                        {
                            type: 'bullets',
                            items: [
                                '「도전하기」를 누르면 자동 전투가 진행되고, 능력치·연구 스킬이 결과에 반영됩니다.',
                                '피해량 구간에 따라 E부터 SSS까지 12등급이 정해지고 보상이 달라집니다.',
                                '일정 확률로 로또 슬롯이 발동되어 한 단계 위 등급 보상을 추가로 받을 수 있습니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'info',
                            title: '등급 구간(절대 데미지)',
                            text: 'E 2만 미만 · D- 2~4만 · D 4~6만 · C- 6~8만 · C 8~10만 · B- 10~12만 · B 12~14만 · A- 14~16만 · A 16~18만 · S 18~20만 · SS 20~25만 · SSS 25만 이상 (세부는 패치에 따라 조정될 수 있습니다)',
                        },
                    ],
                },
            },
            {
                id: 'guild-war',
                label: '길드 전쟁',
                article: {
                    id: 'guild-war',
                    title: '길드 전쟁',
                    tagline: '다른 길드와 영토 점령률로 승패를 가립니다.',
                    hero: { src: '/images/guild/button/guildwar.png', alt: '길드 전쟁' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전쟁 기간 동안 길드원이 참여해 점령률을 높입니다. 상대 길드와 비교해 우위에 서면 승리 보상을 받을 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '인원·일일 참여 제한 등 세부 규칙은 전쟁 화면 안내를 따릅니다.',
                                '길드 채팅·미션과 병행하면 참여율을 올리기 쉽습니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'guild-lab-mission',
                label: '연구소 · 미션 · 상점',
                article: {
                    id: 'guild-lab-mission',
                    title: '연구소 · 미션 · 길드 상점',
                    tagline: '연구 포인트와 미션으로 길드 효과와 개인 보상을 동시에 챙깁니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '연구소에서는 연구 포인트로 프로젝트를 진행합니다. 완료 시 길드원 전체에 유리한 효과 또는 보스전 특화 효과가 적용될 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '미션은 주기적으로 갱신되며, 달성 시 개인·길드 보상이 함께 주어질 수 있습니다.',
                                '길드 상점에서는 길드 코인으로 한정 아이템을 구매합니다.',
                            ],
                        },
                        {
                            type: 'imageRow',
                            images: [
                                { src: '/images/guild/button/guildlab.png', alt: '연구소', caption: '연구소' },
                                { src: '/images/guild/button/guildmission.png', alt: '미션', caption: '미션' },
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'util',
        label: '우편 · 퀘스트 · 기타',
        iconSrc: '/images/quickmenu/bag.png',
        accentClass: 'from-slate-500/15 to-zinc-700/10',
        subcategories: [
            {
                id: 'util-mail-quest',
                label: '우편 · 퀘스트 · 상점',
                article: {
                    id: 'util-mail-quest',
                    title: '우편과 퀘스트·상점',
                    tagline: '보상 수령과 일일 루틴을 잊지 마세요.',
                    blocks: [
                        {
                            type: 'bullets',
                            items: [
                                '우편: 시즌 보상·이벤트·운영 지급품을 수령합니다. 기한이 있는 우편은 만료 전에 받으세요.',
                                '퀘스트: 일일·주간 목표를 달성해 재화·아이템을 획득합니다. 퀵 메뉴 아이콘에 알림이 뜰 수 있습니다.',
                                '상점: 골드·다이아 등으로 소모품·재화를 구매합니다. 한정 상품은 주기를 확인하세요.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'util-inventory-record',
                label: '가방 · 기보',
                article: {
                    id: 'util-inventory-record',
                    title: '가방과 기보',
                    tagline: '장비 정리와 복기를 한곳에서.',
                    blocks: [
                        {
                            type: 'bullets',
                            items: [
                                '가방: 장비·소모품·재료 탭으로 나뉘며, 장착·사용·정렬이 가능합니다.',
                                '기보: 저장된 대국을 열어 특정 수로부터 다시 보거나 공유합니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'util-quick',
                label: '퀵 랭킹 · 채팅 · 도감',
                article: {
                    id: 'util-quick',
                    title: '퀵 모달들',
                    tagline: '이동 없이 자주 쓰는 정보를 띄웁니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '랭킹 퀵 모달에서는 주요 랭킹을 빠르게 훑고, 채팅 퀵 모달에서는 채널 대화를 이어갑니다. 도감은 별도 창에서 전체 아이템 스펙을 검색·확인합니다.',
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'encyclopedia',
        label: '도감 · 옵션 규칙',
        iconSrc: '/images/button/itembook.png',
        accentClass: 'from-amber-600/10 to-orange-900/10',
        subcategories: [
            {
                id: 'ency-rules',
                label: '도감 사용 · 옵션 규칙',
                article: {
                    id: 'ency-rules',
                    title: '도감과 장비 옵션 규칙',
                    tagline: '아이콘을 눌러 말풍선으로 상세 스펙을 확인합니다.',
                    hero: { src: '/images/button/itembook.png', alt: '도감' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '도감에서는 게임 내 장비·재료·소모품의 상세 정보를 모두 열람할 수 있습니다. 장비는 부위별로 등급이 나열되고, 아이콘을 누르면 옵션 말풍선이 뜹니다.',
                        },
                        {
                            type: 'heading',
                            text: '주옵션',
                            level: 3,
                        },
                        {
                            type: 'paragraph',
                            text: '강화 1단계마다 획득 시 부여된 수치만큼 주옵션이 증가합니다. 별 색이 은색→금색(+4)→푸른색(+7)→프리즘(+10)으로 바뀔 때마다 해당 구간에서 강화 보너스가 2배로 적용됩니다.',
                        },
                        {
                            type: 'heading',
                            text: '부옵션',
                            level: 3,
                        },
                        {
                            type: 'paragraph',
                            text: '최대 4개까지 붙습니다. 강화 시 부옵션이 4개 미만이면 빈 칸부터 채우고, 4개가 모두 있으면 그중 하나가 임의로 강화됩니다.',
                        },
                        {
                            type: 'heading',
                            text: '특수 · 신화 옵션',
                            level: 3,
                        },
                        {
                            type: 'paragraph',
                            text: '강화로 수치가 늘지 않는 고정 옵션이 있습니다. 신화 옵션은 신화 등급 장비에서만 등장합니다.',
                        },
                        {
                            type: 'callout',
                            tone: 'info',
                            title: '업데이트 메모',
                            text: '장비 주옵션 강화 보너스 규칙(+4/+7/+10 구간 2배) 및 소모품 탭 정렬 개선 등 최근 변경은 패치 노트·공지와 함께 확인해 주세요.',
                        },
                    ],
                },
            },
        ],
    },
];

/** flat lookup for mobile/desktop selection sync */
export function findHelpArticle(categoryId: string, subId: string): HelpArticle | null {
    const cat = HELP_CENTER_CATEGORIES.find((c) => c.id === categoryId);
    const sub = cat?.subcategories.find((s) => s.id === subId);
    return sub?.article ?? null;
}

export function getDefaultHelpSelection(): { categoryId: string; subId: string } {
    const first = HELP_CENTER_CATEGORIES[0];
    const sub = first?.subcategories[0];
    if (!first || !sub) return { categoryId: 'start', subId: 'start-home' };
    return { categoryId: first.id, subId: sub.id };
}
