import { GameMode } from '../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from './gameModes.js';
import { GUILD_BOSS_MAX_ATTEMPTS } from './guildConstants.js';
import { ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP, ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import { ADVENTURE_REGIONAL_BUFF_ACTION_GOLD } from '../../utils/adventureRegionalSpecialtyBuff.js';
import { PAIR_GO_GAME_MODES } from '../utils/pairGameTurn.js';
import { PAIR_EGG_DISPLAY_IMAGE } from './petLobby.js';
import { AVATAR_POOL, BORDER_POOL } from './ui.js';

/** 프로필 편집 안내 — `ProfileEditModal`과 동일한 아바타·테두리 에셋 */
const PROFILE_EDIT_GUIDE_AVATAR = AVATAR_POOL.find((a) => a.id === 'profile_1') ?? AVATAR_POOL[0]!;
const PROFILE_EDIT_GUIDE_BORDER =
    BORDER_POOL.find((b) => b.id === 'tier_ring_3') ??
    BORDER_POOL.find((b) => typeof b.url === 'string' && b.url.startsWith('/images'))!;
const PROFILE_EDIT_GUIDE_BORDER_URL = PROFILE_EDIT_GUIDE_BORDER.url ?? '/images/button/help.webp';

/** 도움말·홈 안내용 — `assets.ts`·로비 UI와 동일한 경로 */
const ADVENTURE_HELP_IMAGE = '/images/adventure.png';
const ADVENTURE_HOME_ENTRY_IMAGE = ADVENTURE_STAGES[0].mapWebp;
const SINGLE_PLAYER_ACADEMY_IMAGE = '/images/single/single.webp';
const TOWER_ENTRY_IMAGE = '/images/tower/towergo.webp';
const CHAMPIONSHIP_ENTRY_IMAGE = '/images/championship/Champ1.webp';
const STRATEGIC_LOBBY_IMAGE = '/images/RatingArena.webp';
const PLAYFUL_LOBBY_IMAGE = '/images/PlayingArena.webp';
const PAIR_LOBBY_IMAGE = '/images/2v2.webp';
const PVP_HELP_IMAGE = '/images/bg/pvp.webp';
const TOURNAMENT_LOBBY_IMAGE = '/images/Championship.webp';
const HOME_BG_IMAGE = '/images/bg/mainbg.webp';
const HELP_BUTTON_IMAGE = '/images/button/help.webp';
const PET_HELP_HERO_IMAGE = '/images/bg/pet.webp';
const PET_SAMPLE_IMAGE = '/images/pets/pet1.webp';
const MIX_MODE_IMAGE =
    SPECIAL_GAME_MODES.find((g) => g.mode === GameMode.Mix)?.image ?? '/images/simbols/simbol10.webp';

const pairGoModeGallery: HelpImageRef[] = PAIR_GO_GAME_MODES.map((mode) => {
    const spec = SPECIAL_GAME_MODES.find((g) => g.mode === mode);
    if (!spec) return { src: MIX_MODE_IMAGE, alt: String(mode), caption: String(mode) };
    return { src: spec.image, alt: spec.name, caption: spec.name };
});

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
                    hero: { src: HOME_BG_IMAGE, alt: '홈 배경' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '홈에는 프로필·바둑 능력·각 경기장 입장 카드가 모여 있습니다. 카드에는 대표 이미지와 핵심 정보가 함께 표시되어 원하는 모드로 바로 이동할 수 있습니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: '/images/quickmenu/quest.webp', alt: '퀘스트', caption: '퀘스트' },
                                { src: '/images/quickmenu/gibo.webp', alt: '기보', caption: '기보' },
                                { src: '/images/quickmenu/enhance.webp', alt: '대장간', caption: '대장간' },
                                { src: '/images/quickmenu/store.webp', alt: '상점', caption: '상점' },
                                { src: '/images/quickmenu/bag.webp', alt: '가방', caption: '가방' },
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
                                '도움말: 지금 보고 있는 통합 안내입니다. 모험·챕터·탐험도는 「모험」, 바둑학원·도전의 탑은 「바둑학원 · 도전의 탑」, 대장간·강화·합성 규칙은 「장비 · 대장간」에서 확인합니다.',
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
                id: 'start-first-route',
                label: '처음 추천 루트',
                article: {
                    id: 'start-first-route',
                    title: '처음 시작하면 무엇을 할까요?',
                    tagline: '처음 접속한 유저가 헤매지 않도록 가장 쉬운 순서로 안내합니다.',
                    hero: { src: HOME_BG_IMAGE, alt: '처음 시작' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '처음에는 모든 메뉴를 한 번에 이해하려고 하기보다, 홈 화면에서 내 상태를 확인하고 AI 연습으로 기본 조작을 익힌 뒤 PVP나 성장 콘텐츠로 넓혀가는 것이 좋습니다.',
                        },
                        { type: 'heading', text: '추천 순서', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '1단계: 홈 프로필에서 닉네임, 레벨, 매너점수, 보유 재화를 확인합니다.',
                                '2단계: 우편과 퀘스트 보상을 먼저 수령합니다. 시작 보상이나 일일 보상이 있을 수 있습니다.',
                                '3단계: 바둑학원 또는 AI 대국으로 착수, 시간, 계가, 기권 위치를 익힙니다.',
                                '4단계: 전략/놀이 대기실에서 친선 대국이나 관전으로 다른 유저의 진행 방식을 봅니다.',
                                '5단계: 규칙과 시간 운영이 익숙해지면 랭크전, 페어, 모험, 도전의 탑, 챔피언십으로 목표를 넓힙니다.',
                            ],
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: SINGLE_PLAYER_ACADEMY_IMAGE, alt: '바둑학원', caption: 'AI로 연습' },
                                { src: PVP_HELP_IMAGE, alt: 'PVP', caption: '친선·랭크' },
                                { src: ADVENTURE_HELP_IMAGE, alt: '모험', caption: '성장 콘텐츠' },
                                { src: '/images/quickmenu/quest.webp', alt: '퀘스트', caption: '보상 루틴' },
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '초보자 팁',
                            text: '처음부터 랭크전에 들어가기보다 관전과 AI 대국으로 UI를 익히면 시간패, PASS 착오, 접속 복귀 실수를 줄일 수 있습니다.',
                        },
                    ],
                },
            },
            {
                id: 'start-basic-terms',
                label: '기본 용어',
                article: {
                    id: 'start-basic-terms',
                    title: '기본 바둑 · 게임 용어',
                    tagline: '도움말 전체에서 반복되는 단어를 먼저 정리합니다.',
                    hero: { src: '/images/simbols/simbol1.webp', alt: '기본 용어' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '수담R은 바둑 규칙을 바탕으로 여러 변형 모드를 더한 게임입니다. 아래 용어를 알고 있으면 대국 전 설정과 대국 중 안내를 훨씬 쉽게 이해할 수 있습니다.',
                        },
                        { type: 'heading', text: '바둑 기본', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '착수: 내 차례에 바둑판 교차점에 돌을 하나 놓는 행동입니다.',
                                '집: 내 돌로 둘러싼 빈 공간입니다. 클래식 계열에서는 집이 많을수록 유리합니다.',
                                '따내기: 상대 돌의 활로를 모두 막아 판에서 제거하는 것입니다.',
                                '덤: 후공인 백에게 주어지는 보정 점수입니다.',
                                '계가: 대국 종료 후 집, 덤, 보너스 점수를 계산해 승패를 정하는 단계입니다.',
                                'PASS: 더 둘 곳이 없다고 판단해 차례를 넘기는 행동입니다. 모든 모드에서 가능한 것은 아닙니다.',
                            ],
                        },
                        { type: 'heading', text: '수담R에서 자주 보는 말', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '친선: 부담 없이 유저와 두는 대국입니다. 설정을 서로 확인하고 시작합니다.',
                                '랭크: 전적, 랭킹 점수, 시즌 보상에 반영되는 대국입니다.',
                                '관전: 진행 중인 대국을 보는 기능입니다. 관전자는 비밀 정보와 채팅이 제한됩니다.',
                                '메인 시계: 대국 전체에서 쓰는 제한시간입니다. 모두 쓰면 시간패가 될 수 있습니다.',
                                '스피드바: 스피드 바둑에서 한 수마다 별도로 도는 10초 바입니다. 초과하면 상대 점수가 1점 오릅니다.',
                                '접속장애: 대국 중 연결 끊김이 발생한 상태입니다. 90초 안에 돌아오지 못하거나 반복되면 패배할 수 있습니다.',
                            ],
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
                    hero: { src: HELP_BUTTON_IMAGE, alt: '설정 · 도움말' },
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
            {
                id: 'start-profile-edit',
                label: '프로필 수정',
                article: {
                    id: 'start-profile-edit',
                    title: '프로필 수정',
                    tagline: '닉네임·외형·MBTI를 한곳에서 관리합니다.',
                    hero: { src: PROFILE_EDIT_GUIDE_AVATAR.url, alt: '프로필 아바타' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '프로필 영역을 누르거나 설정에서 「프로필 수정」을 열면 아바타·테두리·닉네임·MBTI를 바꿀 수 있습니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                {
                                    src: PROFILE_EDIT_GUIDE_AVATAR.url,
                                    alt: PROFILE_EDIT_GUIDE_AVATAR.name,
                                    caption: '아바타',
                                },
                                {
                                    src: PROFILE_EDIT_GUIDE_BORDER_URL,
                                    alt: PROFILE_EDIT_GUIDE_BORDER.name,
                                    caption: '테두리',
                                },
                            ],
                        },
                        {
                            type: 'bullets',
                            items: [
                                '닉네임 변경에는 다이아가 소모될 수 있습니다.',
                                'MBTI 설문 결과는 프로필에 표시되며, 바둑 스타일 참고용입니다.',
                                '일부 테두리는 레벨·구매·시즌 보상으로 해금됩니다.',
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'home-screen',
        label: '홈 화면',
        iconSrc: HOME_BG_IMAGE,
        accentClass: 'from-amber-500/25 to-orange-600/12',
        subcategories: [
            {
                id: 'home-profile',
                label: '1. 프로필',
                article: {
                    id: 'home-profile',
                    title: '프로필',
                    tagline: '레벨·매너·MBTI와 함께 나만의 프로필을 꾸밉니다.',
                    hero: { src: HOME_BG_IMAGE, alt: '홈 프로필' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '홈 상단 프로필에는 전략·놀이 레벨, 매너점수, MBTI, 시즌 티어 등이 표시됩니다. 프로필을 누르면 닉네임·아바타·테두리·MBTI를 수정할 수 있습니다.',
                        },
                        {
                            type: 'imageRow',
                            images: [
                                {
                                    src: PROFILE_EDIT_GUIDE_AVATAR.url,
                                    alt: PROFILE_EDIT_GUIDE_AVATAR.name,
                                    caption: '아바타',
                                },
                                {
                                    src: PROFILE_EDIT_GUIDE_BORDER_URL,
                                    alt: PROFILE_EDIT_GUIDE_BORDER.name,
                                    caption: '테두리',
                                },
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            text: '매너점수는 대국 매너·접속 습관에 따라 변하며, 일부 보상·행동력에 영향을 줄 수 있습니다.',
                        },
                    ],
                },
            },
            {
                id: 'home-gear',
                label: '2. 장비',
                article: {
                    id: 'home-gear',
                    title: '장비',
                    tagline: '장비를 장착하면 바둑 능력과 전투 스탯이 올라갑니다.',
                    hero: { src: '/images/quickmenu/enhance.webp', alt: '대장간' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '부채·바둑판·의상 등 부위별 장비를 장착해 능력치를 올립니다. 대장간에서 강화·합성·제련·분해로 성장시킬 수 있습니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: '/images/equipments/moru.webp', alt: '대장간', caption: '대장간' },
                                { src: '/images/quickmenu/bag.webp', alt: '가방', caption: '가방' },
                                { src: '/images/button/itembook.webp', alt: '도감', caption: '도감' },
                            ],
                        },
                        {
                            type: 'bullets',
                            items: [
                                '등급이 높을수록 주옵션·부옵션·특수 효과가 강해집니다.',
                                '홈에서 장비 슬롯을 누르면 가방·장착 화면으로 이동합니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'home-ability',
                label: '3. 바둑능력',
                article: {
                    id: 'home-ability',
                    title: '바둑능력',
                    tagline: '6가지 능력치가 바둑 스타일과 시뮬 결과를 만듭니다.',
                    hero: { src: '/images/PlayingArena.webp', alt: '능력치' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '집중력·사고속도·판단력·계산력·전투력·안정감 6종 능력치를 포인트로 분배합니다. 스타일에 맞게 투자해 챔피언십·길드 보스전에 대비하세요.',
                        },
                        {
                            type: 'figure',
                            src: '/images/championship/Champ1.webp',
                            alt: '챔피언십 시뮬',
                            caption: '챔피언십 시뮬레이션 경기장에서 능력치·컨디션이 결과에 반영됩니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '초반·중반·종반마다 중요한 능력치 비중이 다릅니다.',
                                '길드 보스전은 보스 특성에 맞는 능력치·연구 스킬이 유리합니다.',
                            ],
                        },
                        {
                            type: 'imageRow',
                            images: [
                                { src: '/images/guild/button/bossraid1.webp', alt: '보스전', caption: '길드 보스' },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'home-guild',
                label: '4. 길드',
                article: {
                    id: 'home-guild',
                    title: '길드',
                    tagline: '5레벨 이후 협동 콘텐츠로 길드를 성장시킵니다.',
                    hero: { src: '/images/guild/profile/icon1.webp', alt: '길드' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전략·놀이 레벨 합산 5레벨이 되면 길드에 가입·창설할 수 있습니다. 길드전·보스전·연구·미션으로 길드와 개인 모두 성장합니다.',
                        },
                        {
                            type: 'imageRow',
                            images: [
                                { src: '/images/guild/button/guildwar.webp', alt: '길드전', caption: '길드전' },
                                { src: '/images/guild/button/bossraid1.webp', alt: '보스', caption: '보스전' },
                                { src: '/images/guild/button/guildlab.webp', alt: '연구', caption: '연구소' },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'home-pet',
                label: '5. 펫',
                article: {
                    id: 'home-pet',
                    title: '펫',
                    tagline: '바둑을 두는 펫을 육성하고 함께 대국합니다.',
                    hero: { src: PET_HELP_HERO_IMAGE, alt: '펫' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '펫은 페어 경기장·대전 등에서 파트너로 함께합니다. 우측 퀵 버튼에서 펫 관리·부화·장착을 할 수 있습니다.',
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '시작 보상',
                            text: '게임을 처음 시작하면 우편에 (특)신비로운알이 도착합니다. 5레벨 펫을 부화시킨 뒤 본격적으로 플레이하는 것을 권장합니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: PET_SAMPLE_IMAGE, alt: 'AI 펫', caption: 'AI 펫' },
                                { src: PAIR_EGG_DISPLAY_IMAGE, alt: '신비로운알', caption: '신비로운알' },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'home-entries',
                label: '6. 입장카드',
                article: {
                    id: 'home-entries',
                    title: '각종 입장카드',
                    tagline: '바둑학원부터 PVP·챔피언십·모험까지.',
                    hero: { src: ADVENTURE_HELP_IMAGE, alt: '모험' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '홈 중앙 입장 카드로 각 컨텐츠에 이동합니다. 바둑학원에서 기본기를 익힌 뒤 도전의 탑·PVP·챔피언십·모험을 순서대로 즐겨 보세요.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: SINGLE_PLAYER_ACADEMY_IMAGE, alt: '바둑학원', caption: '바둑학원' },
                                { src: TOWER_ENTRY_IMAGE, alt: '도전의 탑', caption: '도전의 탑' },
                                { src: PVP_HELP_IMAGE, alt: 'PVP', caption: 'PVP' },
                                { src: '/images/championship/Champ1.webp', alt: '챔피언십', caption: '챔피언십' },
                                { src: ADVENTURE_HOME_ENTRY_IMAGE, alt: '모험', caption: '모험' },
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'pet-management',
        label: '펫 관리',
        iconSrc: PET_HELP_HERO_IMAGE,
        accentClass: 'from-sky-500/20 to-fuchsia-600/10',
        subcategories: [
            {
                id: 'pet-mgmt-overview',
                label: '1. 개요',
                article: {
                    id: 'pet-mgmt-overview',
                    title: '펫 관리 창',
                    tagline: '펫 정보·수련·부화·상점을 한곳에서 다룹니다.',
                    hero: { src: PET_HELP_HERO_IMAGE, alt: '펫 관리' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '홈·대기실 퀵 메뉴의 「펫」 또는 페어 경기장에서 펫 관리를 열면 이 창이 표시됩니다. 상단 탭으로 기능을 나누고, 하단 인벤에서 펫·알·영혼석을 선택해 각 탭 작업에 사용합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '정보: 장착 펫·스탯·등급 강화·영혼 변환·가위바위보 속성을 확인합니다.',
                                '수련: 펫을 슬롯에 보내 시간이 지나면 골드·경험치·영혼석을 받습니다.',
                                '부화장: 알을 넣어 AI 펫을 부화시킵니다.',
                                '상점: 신비로운알·영혼석을 골드·다이아로 구매합니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '시작 팁',
                            text: '처음 접속 시 우편의 (특)신비로운 알로 5레벨 펫을 부화한 뒤 정보 탭에서 장착하면 페어·펫 대국을 바로 이용할 수 있습니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: PET_SAMPLE_IMAGE, alt: '펫', caption: 'AI 펫' },
                                { src: PAIR_EGG_DISPLAY_IMAGE, alt: '알', caption: '신비로운알' },
                                { src: '/images/pets/soulstone1.webp', alt: '영혼석', caption: '영혼석' },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'pet-mgmt-info',
                label: '2. 정보 · 장착',
                article: {
                    id: 'pet-mgmt-info',
                    title: '정보 탭과 장착',
                    tagline: '대표 펫을 정하고 성장·등급을 관리합니다.',
                    hero: { src: PET_SAMPLE_IMAGE, alt: '펫 프로필' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '정보 탭 왼쪽에서 현재 장착 펫의 레벨·등급·경험치·가위바위보 속성을 봅니다. 인벤에서 펫을 선택하면 상세 카드가 열리고, 「장착」으로 페어 경기장·홈 대표 펫을 바꿀 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '영혼석을 소모해 등급 강화를 시도할 수 있습니다. 실패 시에도 일부 자원이 돌아올 수 있습니다.',
                                '영혼 변환: 불필요한 펫을 영혼석으로 바꿔 등급 강화 재료를 모읍니다.',
                                '인벤 하단 「펫」/「영혼석」 필터로 목록을 전환하고, 정렬·슬롯 확장(다이아)으로 보관 칸을 늘릴 수 있습니다.',
                                '페어 승리 누적·행동력 등은 페어 경기장 플레이와 연동됩니다.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'pet-mgmt-training',
                label: '3. 수련',
                article: {
                    id: 'pet-mgmt-training',
                    title: '수련 탭',
                    tagline: '펫을 보내 두고 골드·경험치·영혼석을 받습니다.',
                    hero: { src: '/images/quickmenu/quest.webp', alt: '수련' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '수련 탭에는 최대 6개 슬롯(기술·사활·수상전·정석·기보·수담)이 있습니다. 페어 바둑 승리 횟수에 따라 슬롯이 해금되며, 슬롯마다 필요 최소 펫 레벨이 다릅니다. 인벤에서 펫을 고른 뒤 빈 슬롯에 배치하면 타이머가 돌아가고, 완료 후 보상을 수령합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '슬롯별 수련 시간·골드·경험치·영혼석 확률이 다릅니다.',
                                '맨 오른쪽 수담 수련은 기능 VIP 전용 슬롯입니다.',
                                '수련 중인 펫은 다른 슬롯·부화에 쓸 수 없으니 배치 전에 확인하세요.',
                                '수령 가능할 때 탭·퀵 메뉴에 알림이 표시될 수 있습니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'info',
                            title: '해금 조건',
                            text: '2번 슬롯부터는 페어 승 1·10·50·100·250회 누적이 필요합니다. VIP 슬롯은 승리 조건 없이 VIP 활성 시 이용합니다.',
                        },
                    ],
                },
            },
            {
                id: 'pet-mgmt-hatchery',
                label: '4. 부화장',
                article: {
                    id: 'pet-mgmt-hatchery',
                    title: '부화장 탭',
                    tagline: '알을 넣어 새 AI 펫을 얻습니다.',
                    hero: { src: PAIR_EGG_DISPLAY_IMAGE, alt: '부화장' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '부화장에는 1번 부화 슬롯·강화 단계·VIP 슬롯이 있습니다. 인벤의 알을 1번 또는 VIP 슬롯에 넣으면 부화 시간이 시작되고, 완료 후 펫 인벤으로 받습니다. 페어 승리에 따라 1번 슬롯을 강화하면 부화 시간과 나오는 레벨 범위가 좋아집니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '1번 부화 슬롯: 기본 부화(환영 알은 약 1분·레벨 5 고정).',
                                '강화 I~III: 페어 승리·골드로 1번 슬롯을 단계적으로 강화(시간 단축·레벨 범위 확대).',
                                'VIP 슬롯: 기능 VIP 활성 시 고정 레벨 10 펫을 빠르게 부화.',
                                '즉시 완료(다이아)·펫 인벤 가득 참 시 수령 불가 — 인벤 슬롯을 비우거나 확장하세요.',
                            ],
                        },
                    ],
                },
            },
            {
                id: 'pet-mgmt-shop',
                label: '5. 상점',
                article: {
                    id: 'pet-mgmt-shop',
                    title: '펫 상점 탭',
                    tagline: '알과 영혼석을 재화로 구매합니다.',
                    hero: { src: '/images/quickmenu/store.webp', alt: '펫 상점' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '상점 탭에서 신비로운알(골드·다이아)과 5종 영혼석을 살 수 있습니다. 일부 상품은 KST 기준 일일 구매 한도가 있습니다. 구매한 알은 부화장으로, 영혼석은 정보 탭 등급 강화에 사용합니다.',
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: PAIR_EGG_DISPLAY_IMAGE, alt: '신비로운알', caption: '신비로운알' },
                                { src: '/images/pets/soulstone3.webp', alt: '심연영혼석', caption: '영혼석' },
                            ],
                        },
                        {
                            type: 'bullets',
                            items: [
                                '인벤에서 영혼석을 선택하면 골드로 판매(상점 가격의 10%)할 수 있습니다.',
                                '영혼석 일괄 판매·재료 판매는 가방과 비슷한 확인 창을 거칩니다.',
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
        iconSrc: PVP_HELP_IMAGE,
        accentClass: 'from-cyan-500/15 to-sky-600/10',
        subcategories: [
            {
                id: 'lobby-common',
                label: '전략 · 놀이 대기실',
                article: {
                    id: 'lobby-common',
                    title: '전략 · 놀이 대기실',
                    tagline: '1:1 매칭·관전·랭크전이 있는 클래식 PVP 로비입니다.',
                    hero: { src: PVP_HELP_IMAGE, alt: 'PVP 대기실' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전략·놀이 경기장 대기실에서는 접속 중인 플레이어, 친구 탭, 진행 중인 대국, 채팅, 랭킹 패널을 함께 봅니다. 상대에게 대국을 신청하거나 AI 봇과 연습할 수 있고, 이미 진행 중인 대국은 관전으로 배울 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '플레이어를 선택해 대국을 신청하면 상대가 수락할 때 경기가 열립니다. 상대가 대국 중이면 상태가 「대국 중」으로 표시됩니다.',
                                '진행 중인 대국 목록이나 방 번호가 보이는 항목에서는 「관전」으로 들어가 수읽기와 운영을 볼 수 있습니다.',
                                '대기실 채팅은 로비 대화이며, 실제 대국 관전자는 대국 채팅을 보낼 수 없습니다.',
                                '우측 퀵 메뉴로 퀘스트·가방·상점·도움말 등을 그대로 이용합니다.',
                                '각 게임 모드의 세부 규칙은 「게임 모드」 항목, 실시간 대국 중 시간·PASS·접속 규칙은 「실시간 PVP 대국」 항목에서 확인합니다.',
                            ],
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: STRATEGIC_LOBBY_IMAGE, alt: '전략 경기장', caption: '전략 바둑' },
                                { src: PLAYFUL_LOBBY_IMAGE, alt: '놀이 경기장', caption: '놀이 바둑' },
                                { src: PAIR_LOBBY_IMAGE, alt: '페어 경기장', caption: '페어 바둑' },
                            ],
                        },
                    ],
                },
            },
            {
                id: 'lobby-pair',
                label: '페어 바둑',
                article: {
                    id: 'lobby-pair',
                    title: '페어 바둑 경기장',
                    tagline: '2인·4인 팀 대국, AI·펫 파트너, 진행 중 방 관전이 있는 2v2 바둑입니다.',
                    hero: { src: PAIR_LOBBY_IMAGE, alt: '페어 바둑' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '페어 경기장은 흑·백 각 팀이 두 명씩 번갈아 한 수를 두는 2v2 바둑입니다. 방 번호 그리드에서 방을 만들거나 참가하고, 파트너·펫·AI 슬롯을 채운 뒤 대국을 시작합니다. 진행 중인 방은 입장 대신 「관전」 버튼이 표시되며, 친구 탭에서 대국 중인 친구의 경기도 관전할 수 있습니다.',
                        },
                        {
                            type: 'heading',
                            text: '방 종류',
                            level: 3,
                        },
                        {
                            type: 'bullets',
                            items: [
                                '4인 친선: 네 명이 모두 유저인 친선 대국. 네 좌석이 정해진 순서대로 번갈아 착수합니다.',
                                '2인 친선: 두 명이 한 팀으로 상대 팀(2인)과 대국합니다.',
                                '2인 AI대전: 내 팀은 유저 2명, 상대 팀은 AI 2명과 대결합니다.',
                                '펫 페어(AI와 대결): 내 펫·파트너 펫과 AI 펫이 좌석을 나눠 두는 연습·도전 형식입니다.',
                                '페어 랭킹전: 펫 페어 또는 2인 페어 팀으로 매칭되는 랭크 대국(행동력 소모).',
                                '관전: 진행 중인 방 또는 친구 탭의 관전 버튼으로 들어가며, 미공개 히든돌과 개인 스캔 정보는 보이지 않습니다.',
                            ],
                        },
                        {
                            type: 'heading',
                            text: '페어에서 쓸 수 있는 바둑 종류',
                            level: 3,
                        },
                        {
                            type: 'imageRow',
                            images: pairGoModeGallery,
                            compact: true,
                        },
                        {
                            type: 'bullets',
                            items: SPECIAL_GAME_MODES.filter((g) =>
                                PAIR_GO_GAME_MODES.includes(g.mode),
                            ).map((g) => `${g.name}: ${g.description}`),
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '참고',
                            text: '놀이바둑(주사위·오목·알까기 등)은 페어 경기장 친선 방이 아닌 전략·놀이 1:1 대기실에서 플레이합니다. 페어 대국의 실제 진행 규칙(PASS, 좌석 순서, AI 지연)은 「실시간 PVP 대국」의 페어 항목에서 확인하세요.',
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
        id: 'pvp-live',
        label: '실시간 PVP 대국',
        iconSrc: PVP_HELP_IMAGE,
        accentClass: 'from-red-500/15 via-amber-500/10 to-slate-900/10',
        subcategories: [
            {
                id: 'pvp-overview',
                label: '처음 PVP 시작',
                article: {
                    id: 'pvp-overview',
                    title: 'PVP를 처음 시작할 때',
                    tagline: '상대 신청부터 대국 진행, 관전, 재접속까지 한 흐름으로 이해합니다.',
                    hero: { src: PVP_HELP_IMAGE, alt: 'PVP 경기장' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: 'PVP는 다른 유저와 실시간으로 두는 대국입니다. 전략 경기장, 놀이 경기장, 페어 경기장에서 각각 다른 방식으로 상대를 만나며, 랭크전은 전적과 보상에 더 직접적으로 반영됩니다.',
                        },
                        { type: 'heading', text: '기본 흐름', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '대기실에서 유저를 선택하거나 방을 만들어 대국을 신청합니다.',
                                '대국 시작 전 판 크기, 제한시간, 모드, 고정 수순, 따내기 목표 같은 조건을 확인합니다.',
                                '대국 중에는 메인 시계와 특수 모드 UI를 함께 보며 차례에 맞춰 착수합니다.',
                                '진행 중인 다른 대국은 관전할 수 있지만, 관전자는 채팅과 비밀 정보 확인이 제한됩니다.',
                                '연결이 끊기면 90초 안에 복귀해야 하며, 반복 끊김은 패배와 매너 불이익으로 이어질 수 있습니다.',
                            ],
                        },
                        {
                            type: 'imageRow',
                            compact: true,
                            images: [
                                { src: STRATEGIC_LOBBY_IMAGE, alt: '전략 경기장', caption: '전략 PVP' },
                                { src: PLAYFUL_LOBBY_IMAGE, alt: '놀이 경기장', caption: '놀이 PVP' },
                                { src: PAIR_LOBBY_IMAGE, alt: '페어 경기장', caption: '페어 PVP' },
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '추천 순서',
                            text: '처음이라면 AI 연습이나 친선 대국으로 모드 UI를 익힌 뒤 랭크전에 들어가세요. 특히 스피드, 히든, 페어는 시간·정보·좌석 규칙이 일반 바둑과 다릅니다.',
                        },
                    ],
                },
            },
            {
                id: 'pvp-spectating',
                label: '관전하기',
                article: {
                    id: 'pvp-spectating',
                    title: '관전하기',
                    tagline: '진행 중인 대국을 보되, 승부에 영향을 줄 정보는 숨깁니다.',
                    hero: { src: PVP_HELP_IMAGE, alt: 'PVP 관전' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '관전은 다른 유저의 실시간 대국을 보는 기능입니다. 수읽기, 포석, 시간 운영을 배울 수 있지만 대국자에게 유리한 비밀 정보는 관전자에게도 보이지 않습니다.',
                        },
                        { type: 'heading', text: '어디서 관전하나요?', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '전략·놀이 대기실: 진행 중인 대국 목록이나 방 번호 항목에서 「관전」을 누릅니다.',
                                '페어 경기장: 방 목록에서 상태가 진행 중인 방은 「입장」 대신 「관전」 버튼이 표시됩니다.',
                                '페어 친구 탭: 친구가 대국 중이면 우측에 「관전」 버튼이 표시될 수 있습니다.',
                                '관전을 나가면 기존 대기실 또는 현재 화면으로 돌아옵니다.',
                            ],
                        },
                        { type: 'heading', text: '관전자에게 보이지 않는 것', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '히든돌은 전체 공개, 영구 공개, 계가/종료처럼 모두가 알아도 되는 시점이 되기 전까지 보이지 않습니다.',
                                '스캔으로 알게 된 개인 정보, 유저별 공개 상태, 새로 공개된 히든 정보는 관전자에게 전달되지 않습니다.',
                                '관전자는 대국 채팅을 보낼 수 없습니다. 대국자는 외부 조언 없이 직접 승부해야 합니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'info',
                            title: '공정성 원칙',
                            text: '관전 화면은 학습용입니다. 부계정 관전으로 히든돌 위치나 스캔 결과를 알아내는 일이 없도록 서버에서 관전자용 대국 정보를 따로 만들어 보냅니다.',
                        },
                    ],
                },
            },
            {
                id: 'pvp-disconnect-rejoin',
                label: '접속 끊김 · 재접속',
                article: {
                    id: 'pvp-disconnect-rejoin',
                    title: '접속 끊김과 재접속',
                    tagline: '실시간 대국에서는 연결 안정성과 복귀 시간이 승패에 직접 영향을 줍니다.',
                    hero: { src: PVP_HELP_IMAGE, alt: '접속 끊김 안내' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: 'PVP 대국 중 브라우저 종료, 로그아웃, 네트워크 끊김이 발생하면 접속 끊김 상태로 처리됩니다. 이때 대국의 메인 제한시간은 멈추고, 복귀를 기다리는 90초 몰수 카운트만 진행됩니다.',
                        },
                        { type: 'heading', text: '끊김이 발생하면', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '현재 차례의 메인 시계는 일시 정지됩니다. 상대가 기다리는 동안 시간패가 같이 흐르지 않습니다.',
                                '대국 화면에는 접속 끊김 연출과 남은 복귀 시간이 표시됩니다.',
                                '90초 안에 재접속하면 끊김 연출이 사라지고 멈췄던 메인 시계가 다시 이어집니다.',
                                '재로그인 후에도 진행 중인 내 대국이 있으면 자동 복귀를 시도합니다.',
                            ],
                        },
                        { type: 'heading', text: '몰수와 3회 접속장애', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '90초 안에 돌아오지 못하면 해당 대국은 접속장애/시간 초과로 패배 처리될 수 있습니다.',
                                '한 대국에서 접속 끊김이 반복되어 3회에 도달하면 즉시 접속장애 패배가 처리될 수 있습니다.',
                                '승자는 기권승과 같은 정상 승리 보상을 받을 수 있고, 랭크 대국에서는 결과가 전적과 보상에 반영됩니다.',
                                '랭크 PVP의 접속장애 패배는 매너 점수에도 큰 불이익이 있을 수 있습니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'warn',
                            title: '복귀 팁',
                            text: '실수로 새로고침하거나 브라우저를 닫았다면 같은 계정으로 바로 다시 로그인하세요. 복귀 창은 길지 않으므로 다른 메뉴를 먼저 열지 말고 대국 복귀를 우선하세요.',
                        },
                    ],
                },
            },
            {
                id: 'pvp-pass-scoring',
                label: '통과(PASS) · 계가',
                article: {
                    id: 'pvp-pass-scoring',
                    title: '통과(PASS)와 계가',
                    tagline: 'PASS 버튼이 보이는지는 대국 시작 전 정한 규칙에 따라 달라집니다.',
                    hero: { src: STRATEGIC_LOBBY_IMAGE, alt: 'PASS와 계가' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: 'PASS는 더 둘 곳이 없다고 판단할 때 차례를 넘기는 행동입니다. 하지만 모든 대국에서 사용할 수 있는 것은 아닙니다. 목표 수순이나 따내기 목표가 정해진 대국은 그 조건으로 승패가 정해지므로 PASS가 표시되지 않습니다.',
                        },
                        { type: 'heading', text: 'PASS가 없는 경우', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '계가까지 정해진 수순이 있는 대국: 정해진 수순까지 진행한 뒤 자동으로 계가합니다.',
                                '따내기 목표 개수가 있는 대국: 목표 개수만큼 먼저 따내는 것이 승리 조건이므로 PASS하지 않습니다.',
                                '따내기 규칙이 섞인 믹스 대국: 캡처 목표가 있으면 PASS 대신 목표 달성으로 승패를 봅니다.',
                            ],
                        },
                        { type: 'heading', text: 'PASS가 있는 경우', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '고정 수순이나 따내기 목표가 없는 클래식 계열 대국에서는 PASS 버튼이 표시됩니다.',
                                '1:1 대국은 두 플레이어가 연속으로 PASS하면 계가 단계로 넘어갑니다.',
                                '4인 페어 PVP는 네 좌석 모두 PASS해야 계가가 시작됩니다.',
                                '히든 바둑은 계가 전에 아직 공개되지 않은 히든돌을 전체 공개하는 단계가 먼저 진행될 수 있습니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '초보자 기준',
                            text: 'PASS 버튼이 없다면 오류가 아니라 그 대국의 승리 조건이 다른 것입니다. 화면의 목표 수순, 따내기 목표, 자동계가 안내를 먼저 확인하세요.',
                        },
                    ],
                },
            },
            {
                id: 'pvp-timers-speed',
                label: '시간 · 스피드 바둑',
                article: {
                    id: 'pvp-timers-speed',
                    title: '시간과 스피드 바둑',
                    tagline: '메인 시계와 스피드 10초 바는 서로 다른 의미를 가집니다.',
                    hero: { src: STRATEGIC_LOBBY_IMAGE, alt: '스피드 바둑 시간' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: 'PVP 대국에는 기본 제한시간이 있습니다. 제한시간을 모두 사용하면 시간패가 될 수 있습니다. 스피드 바둑은 여기에 별도의 10초 스피드바가 추가되는 모드입니다.',
                        },
                        { type: 'heading', text: '메인 시계', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '대국 전체에서 사용하는 기본 제한시간입니다.',
                                '초읽기나 피셔 방식이 설정되어 있으면 화면의 메인 시계와 함께 표시됩니다.',
                                '연결 끊김 상태에서는 이 메인 시계가 멈추고, 90초 복귀 카운트만 진행됩니다.',
                                '메인 시계를 모두 쓰면 시간패가 될 수 있습니다.',
                            ],
                        },
                        { type: 'heading', text: '10초 스피드바', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '스피드 바둑에서 한 수마다 따로 표시되는 10초 압박 게이지입니다.',
                                '10초 안에 두면 다음 수에 다시 10초부터 시작합니다.',
                                '10초를 넘길 때마다 상대의 점수가 1점씩 올라갑니다.',
                                '스피드바 초과는 곧바로 시간패가 아닙니다. 시간패는 메인 시계가 모두 소진될 때 발생합니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'info',
                            title: '구분해서 보기',
                            text: '화면의 큰 시간 표시는 메인 제한시간, 별도로 표시되는 「10초 스피드바」는 상대 점수 +1 압박입니다. 둘을 같은 타이머로 보지 마세요.',
                        },
                    ],
                },
            },
            {
                id: 'pvp-pair-gameplay',
                label: '페어 대국 진행',
                article: {
                    id: 'pvp-pair-gameplay',
                    title: '페어 대국 진행 규칙',
                    tagline: '팀 색은 같지만 좌석마다 차례가 따로 돌아갑니다.',
                    hero: { src: PAIR_LOBBY_IMAGE, alt: '페어 대국 진행' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '페어 대국은 흑 팀과 백 팀이 있고, 각 팀 안에 두 좌석이 있습니다. 팀원은 같은 색 돌을 두지만, 착수 순서는 좌석 단위로 돌아갑니다.',
                        },
                        { type: 'heading', text: '좌석과 차례', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '4인 친선은 네 명이 정해진 좌석 순서대로 한 수씩 둡니다.',
                                '2인/AI/펫 페어는 빈 좌석을 AI 또는 펫이 맡을 수 있습니다.',
                                '현재 차례가 아닌 팀원은 대신 둘 수 없습니다. 같은 팀이어도 좌석 순서를 지켜야 합니다.',
                                'AI 또는 펫 좌석은 사용자가 수순을 알아보기 쉽도록 약 1초 정도 생각한 뒤 착수합니다.',
                            ],
                        },
                        { type: 'heading', text: '페어에서 PASS와 계가', level: 3 },
                        {
                            type: 'bullets',
                            items: [
                                '고정 수순이나 따내기 목표가 없는 4인 페어 PVP에서는 네 좌석이 모두 PASS해야 계가로 넘어갑니다.',
                                '일부 AI/펫 페어 또는 목표형 대국은 PASS 대신 자동계가나 목표 달성으로 진행될 수 있습니다.',
                                '팀 단위 기권, 연결 끊김, 관전 규칙은 일반 PVP와 같은 공정성 원칙을 따릅니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            title: '처음 할 때',
                            text: '내가 어느 팀의 몇 번째 좌석인지 먼저 확인하세요. 팀 색이 같아도 내 차례가 아닐 때는 착수할 수 없습니다.',
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'pve-academy',
        label: '바둑학원 · 수련',
        iconSrc: SINGLE_PLAYER_ACADEMY_IMAGE,
        accentClass: 'from-emerald-500/15 to-amber-600/10',
        subcategories: [
            {
                id: 'pve-singleplayer',
                label: '바둑학원',
                article: {
                    id: 'pve-singleplayer',
                    title: '바둑학원',
                    tagline: '난이도별 스테이지와 수련과제로 AI와 수읽기를 연습합니다.',
                    hero: { src: SINGLE_PLAYER_ACADEMY_IMAGE, alt: '바둑학원' },
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
                id: 'pve-training-quest',
                label: '수련과제',
                article: {
                    id: 'pve-training-quest',
                    title: '수련과제',
                    tagline: '시간이 지나 쌓이는 보상으로 성장 루틴을 챙깁니다.',
                    hero: { src: '/images/quickmenu/quest.webp', alt: '수련과제' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '홈·바둑학원에서 수련과제를 열 수 있습니다. 과제를 완료하면 골드·다이아·재료 등을 받고, 바둑학원 진행과 함께 하면 성장이 빨라집니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '완료한 과제는 반드시 보상을 수령하세요.',
                                '일부 과제는 특정 스테이지 클리어 후 해금됩니다.',
                            ],
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'modes',
        label: '게임 모드',
        iconSrc: MIX_MODE_IMAGE,
        accentClass: 'from-violet-500/15 to-fuchsia-600/10',
        subcategories: [
            {
                id: 'modes-strategic',
                label: '전략 바둑 모드',
                article: {
                    id: 'modes-strategic',
                    title: '전략 바둑 모드 안내',
                    tagline: '클래식부터 미사일·믹스룰까지, 수읽기 중심 라인업입니다.',
                    hero: { src: STRATEGIC_LOBBY_IMAGE, alt: '전략 바둑' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전략 바둑은 정통 규칙과 변형 규칙을 바탕으로 한 모드 묶음입니다. 각 모드의 승리 조건·특수 규칙·아이템을 먼저 확인하고, 실제 PVP에서의 시간·PASS·접속·관전 규칙은 「실시간 PVP 대국」 항목과 함께 보세요.',
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
                        {
                            type: 'callout',
                            tone: 'info',
                            title: 'PVP 공통 규칙',
                            text: '모드 설명은 “무엇을 목표로 두는가”를 알려줍니다. PASS 버튼 표시, 90초 재접속, 스피드 10초 바, 관전 정보 보호처럼 실시간 대국에서 공통으로 적용되는 규칙은 별도 PVP 항목에서 확인하세요.',
                        },
                    ],
                },
            },
            {
                id: 'modes-pair',
                label: '페어 바둑 규칙',
                article: {
                    id: 'modes-pair',
                    title: '페어 바둑에서 선택 가능한 규칙',
                    tagline: '전략바둑 7종만 지원 — 팀이 번갈아 같은 판에 둡니다.',
                    hero: { src: PAIR_LOBBY_IMAGE, alt: '페어 바둑' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '페어 경기장·2인 페어 랭킹전에서 방을 만들 때 아래 전략 모드 중 하나를 고릅니다. 믹스 모드는 여러 규칙을 섞어 진행할 수 있습니다. 좌석 순서, 4인 PASS, 관전, AI/펫 착수 지연 같은 실제 진행 규칙은 「실시간 PVP 대국」의 페어 항목을 함께 확인하세요.',
                        },
                        { type: 'heading', text: '지원 모드', level: 3 },
                        {
                            type: 'imageRow',
                            images: pairGoModeGallery,
                            compact: true,
                        },
                        {
                            type: 'bullets',
                            items: SPECIAL_GAME_MODES.filter((g) =>
                                PAIR_GO_GAME_MODES.includes(g.mode),
                            ).map((g) => `${g.name}: ${g.description}`),
                        },
                        {
                            type: 'callout',
                            tone: 'tip',
                            text: '페어에서도 고정 수순이나 따내기 목표가 있으면 PASS가 없고, 목표가 없는 4인 PVP에서는 네 좌석 모두 PASS해야 계가합니다.',
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
                    hero: { src: PLAYFUL_LOBBY_IMAGE, alt: '놀이 바둑' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '놀이 바둑은 바둑판과 돌을 활용한 캐주얼·파티 게임 성격의 모드입니다. 모드마다 턴 구조와 승패 판정이 다르므로, 첫 플레이 전에 통합 도움말(퀵 메뉴의 도움말)을 권장합니다. 실시간 대국의 접속 끊김·관전·시간 규칙은 전략 경기장과 같은 공정성 원칙을 따릅니다.',
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
        iconSrc: ADVENTURE_HELP_IMAGE,
        accentClass: 'from-amber-500/22 via-fuchsia-600/12 to-violet-900/15',
        subcategories: [
            {
                id: 'adventure-chapters',
                label: '챕터 맵 · 몬스터',
                article: {
                    id: 'adventure-chapters',
                    title: '챕터 맵과 몬스터',
                    tagline: '입장부터 맵 탐색·대국까지 한눈에.',
                    hero: { src: ADVENTURE_HELP_IMAGE, alt: '모험' },
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
                                { src: '/images/icon/Gold.webp', alt: '골드', caption: '변경·강화 비용' },
                                { src: ADVENTURE_HELP_IMAGE, alt: '모험', caption: '효과 획득·변경' },
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
        iconSrc: '/images/quickmenu/enhance.webp',
        accentClass: 'from-emerald-500/15 to-teal-600/10',
        subcategories: [
            {
                id: 'growth-level',
                label: '레벨 · 스탯 포인트',
                article: {
                    id: 'growth-level',
                    title: '레벨과 스탯 포인트',
                    tagline: 'EXP와 놀이 경험치는 각각 쌓이며, 레벨업 시 보너스 포인트가 생깁니다.',
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '전략 바둑을 플레이하면 EXP가 쌓이고, 놀이 바둑을 플레이하면 놀이 경험치가 쌓입니다. 게이지가 100%가 되면 해당 트랙 레벨이 오릅니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                'EXP 레벨과 놀이 레벨이 오를 때마다 보너스 스탯 포인트가 지급됩니다.',
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
        iconSrc: '/images/quickmenu/enhance.webp',
        accentClass: 'from-orange-500/15 to-amber-600/10',
        subcategories: [
            {
                id: 'gear-basics',
                label: '장비 개요',
                article: {
                    id: 'gear-basics',
                    title: '장비 시스템',
                    tagline: '부위·등급·옵션이 캐릭터 성능을 만듭니다.',
                    hero: { src: '/images/button/itembook.webp', alt: '도감' },
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
                    title: '대장간 안내',
                    tagline: '강화·합성·제련·분해·재료 변환과 대장간 경험치까지 한곳에 정리합니다.',
                    hero: { src: '/images/equipments/moru.webp', alt: '대장간' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '대장간은 장비 성장의 중심입니다. 탭마다 재료·골드·다이아 등 비용 규칙이 다르므로, 작업 전에 아래 설명과 화면 안내를 함께 확인하는 것을 권장합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '강화·합성·분해·재료 변환·제련: 각 절의 설명에 맞춰 재료와 대상 장비를 준비합니다.',
                                '대장간 레벨: 합성 가능 등급, 대박·대성공 확률 등이 오릅니다. 대장간 창의 「대장간 효과」에서 현재·다음 레벨 수치를 확인할 수 있습니다.',
                            ],
                        },
                        { type: 'heading', text: '장비 강화', level: 3 },
                        {
                            type: 'paragraph',
                            text: '재료와 골드로 장비 강화 등급(★)을 올립니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '강화 성공 시 주옵션 능력치 증가 (+3, +6, +9 시 2배)',
                                '부옵션 생성 또는 강화',
                                '실패 시 다음 강화 성공 확률 증가',
                                '최대 +10강화까지 가능',
                            ],
                        },
                        { type: 'heading', text: '장비 합성', level: 3 },
                        {
                            type: 'paragraph',
                            text: '동일 등급 장비 3개를 조합하여 새 장비를 획득합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '같은 등급의 새로운 장비 획득',
                                '대성공 시 한 등급 높은 장비 획득 (신화 3개 합성 대성공 시 초월; 확률은 대장간 레벨에 따라 증가)',
                                '대장간 레벨에 따라 합성 가능 등급 제한',
                                '장착 중인 장비는 사용 불가',
                            ],
                        },
                        { type: 'heading', text: '제련 · 스페셜 옵션', level: 3 },
                        {
                            type: 'paragraph',
                            text: '변경권으로 옵션 종류·수치·스페셜 옵션을 바꿀 수 있습니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '신화 장비에는 스페셜 옵션이 최대 1줄, 초월에는 더 강한 효과가 1줄 붙습니다.',
                                '신화·초월 스페셜은 각각 1~7번 줄이 같은 번호끼리 짝입니다. 1번(보스 보상등급 / 보스 보상추가)만 서로 동시 적용되고, 2~7번은 신화와 초월이 겹치면 한쪽만(강한 쪽) 적용됩니다.',
                                '같은 스페셜을 여러 장비에 착용해도 2~7번 부류는 한 번만 적용됩니다. 초월 「길드 보스전 보상추가」는 장비마다 누적될 수 있습니다.',
                            ],
                        },
                        { type: 'heading', text: '장비 분해', level: 3 },
                        {
                            type: 'paragraph',
                            text: '불필요한 장비를 분해하여 강화 재료를 획득합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '다음 강화에 필요한 강화석의 10~20%를 랜덤으로 획득',
                                '강화가 붙은 장비는 +0부터 현재까지 강화석을 모두 썼다고 가정할 때 그 총량의 10%를 추가로 획득',
                                '대박 발생 시 위에서 나온 재료 합이 2배 (확률: 대장간 레벨에 따라 증가)',
                                '장착 중/프리셋 등록 장비 분해 불가',
                                '전설 등급 이상 또는 7강화 이상은 확인 필요',
                            ],
                        },
                        { type: 'heading', text: '재료 변환', level: 3 },
                        {
                            type: 'paragraph',
                            text: '강화 재료를 상위/하위 등급으로 변환합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '합성: 하위 10개 → 상위 1~2개 (대박 시 2개)',
                                '분해: 상위 1개 → 하위 3~14개 (대박 시 2배)',
                                '대박 확률: 대장간 레벨에 따라 증가',
                                '등급: 하급 → 중급 → 상급 → 최상급 → 신비의 강화석',
                            ],
                        },
                        { type: 'heading', text: '대장간 경험치', level: 3 },
                        {
                            type: 'paragraph',
                            text: '모든 기능 사용 시 경험치를 획득하며, 레벨업 시 효과가 증가합니다.',
                        },
                        {
                            type: 'bullets',
                            items: [
                                '강화/합성/분해/재료 변환 시 경험치 획득',
                                '레벨업 시 합성 가능 등급, 대박 확률, 대성공 확률 증가',
                                '높은 등급 장비일수록 더 많은 경험치 획득',
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
        iconSrc: '/images/quickmenu/store.webp',
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
                        {
                            type: 'heading',
                            text: 'PVP 접속장애와 매너',
                            level: 3,
                        },
                        {
                            type: 'bullets',
                            items: [
                                'PVP 대국 중 연결이 끊기면 메인 시계는 멈추지만 90초 복귀 카운트가 진행됩니다.',
                                '복귀하지 못해 패배하거나 한 대국에서 3회 접속 끊김에 도달하면 접속장애 패배로 처리될 수 있습니다.',
                                '랭크 PVP의 접속장애 패배는 일반 패배보다 매너 점수에 더 큰 불이익이 있을 수 있습니다.',
                                '상대가 접속 끊김 상태일 때는 기다림 시간이 따로 표시되며, 무리한 새로고침보다 안정적인 재접속이 중요합니다.',
                            ],
                        },
                        {
                            type: 'callout',
                            tone: 'warn',
                            title: '주의',
                            text: '실시간 PVP는 상대 유저의 시간도 함께 쓰는 콘텐츠입니다. 반복적인 종료·새로고침·네트워크 방치는 매너 등급과 보상 경험에 영향을 줄 수 있습니다.',
                        },
                    ],
                },
            },
        ],
    },
    {
        id: 'tower-championship',
        label: '도전의 탑 · 챔피언십',
        iconSrc: TOWER_ENTRY_IMAGE,
        accentClass: 'from-fuchsia-500/15 to-pink-600/10',
        subcategories: [
            {
                id: 'pve-tower',
                label: '도전의 탑',
                article: {
                    id: 'pve-tower',
                    title: '도전의 탑',
                    tagline: '월간 층수·시간·순위가 핵심입니다.',
                    hero: { src: TOWER_ENTRY_IMAGE, alt: '도전의 탑' },
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
                    hero: { src: CHAMPIONSHIP_ENTRY_IMAGE, alt: '챔피언십' },
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
                    hero: { src: STRATEGIC_LOBBY_IMAGE, alt: '연습 · AI 대국' },
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
        iconSrc: '/images/guild/profile/icon1.webp',
        accentClass: 'from-emerald-600/15 to-green-900/10',
        subcategories: [
            {
                id: 'guild-overview',
                label: '길드 개요',
                article: {
                    id: 'guild-overview',
                    title: '길드란?',
                    tagline: '기부·연구·보스·전쟁·미션으로 함께 성장하는 커뮤니티입니다.',
                    hero: { src: '/images/guild/profile/icon1.webp', alt: '길드' },
                    blocks: [
                        {
                            type: 'paragraph',
                            text: '길드에 가입하면 길드 전용 화면에서 여러 협동 콘텐츠를 이용합니다. 길드 레벨이 오르면 혜택이 늘어나는 구조입니다.',
                        },
                        {
                            type: 'imageRow',
                            images: [
                                { src: '/images/guild/button/bossraid1.webp', alt: '보스', caption: '보스전' },
                                { src: '/images/guild/button/guildwar.webp', alt: '전쟁', caption: '전쟁' },
                                { src: '/images/guild/button/guildlab.webp', alt: '연구', caption: '연구소' },
                                { src: '/images/guild/button/guildmission.webp', alt: '미션', caption: '미션' },
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
                    hero: { src: '/images/guild/button/bossraid1.webp', alt: '보스전' },
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
                    hero: { src: '/images/guild/button/guildwar.webp', alt: '길드 전쟁' },
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
                                '「행동력 회복속도 증가」 연구는 레벨마다 행동력 1회복당 간격이 5초씩 추가로 줄어듭니다. (예: 3레벨이면 총 15초 단축)',
                            ],
                        },
                        {
                            type: 'imageRow',
                            images: [
                                { src: '/images/guild/button/guildlab.webp', alt: '연구소', caption: '연구소' },
                                { src: '/images/guild/button/guildmission.webp', alt: '미션', caption: '미션' },
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
        iconSrc: '/images/quickmenu/bag.webp',
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
                id: 'util-exchange',
                label: '거래소',
                article: {
                    id: 'util-exchange',
                    title: '거래소 이용 안내',
                    tagline: '판매등록·구매·정산·거래이력 탭으로 거래를 관리합니다.',
                    blocks: [
                        {
                            type: 'bullets',
                            items: [
                                '판매 등록은 누구나 가능하며, 구매도 누구나 가능합니다.',
                                '모든 유저는 거래 등록권 없이 1개 슬롯까지 무료로 판매 등록할 수 있습니다.',
                                '2·3번째 슬롯 등록에는 거래 등록권이 필요합니다. 챔피언십 상점 등에서 구매할 수 있습니다.',
                                '기능 VIP는 등록권 없이 최대 3개까지 동시 판매 등록할 수 있습니다.',
                                '판매 등록 시 등록 금액의 10%가 등록 수수료로 즉시 차감됩니다.',
                                '판매 완료 후 정산 수령 시 판매 금액의 10%가 판매 수수료로 차감됩니다.',
                                '등록 수수료가 부족하면 판매 등록이 되지 않습니다.',
                                '판매 재화는 골드/다이아 중 선택할 수 있습니다.',
                                '최소 판매 가격은 100골드 또는 10다이아입니다.',
                                '판매 완료 후 빈 슬롯에 재등록할 수 있습니다.',
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
        iconSrc: '/images/button/itembook.webp',
        accentClass: 'from-amber-600/10 to-orange-900/10',
        subcategories: [
            {
                id: 'ency-rules',
                label: '도감 사용 · 옵션 규칙',
                article: {
                    id: 'ency-rules',
                    title: '도감과 장비 옵션 규칙',
                    tagline: '아이콘을 눌러 말풍선으로 상세 스펙을 확인합니다.',
                    hero: { src: '/images/button/itembook.webp', alt: '도감' },
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
                            text: '특수 · 스페셜 옵션',
                            level: 3,
                        },
                        {
                            type: 'paragraph',
                            text: '특수 옵션은 강화(+4·+7·+10)마다 수치가 늘어나는 모험·챔피언십·길드 보스전 등 전용 보너스입니다. 스페셜 옵션(구 신화 옵션)은 신화 등급 장비에 1종, 초월 등급에는 초월 전용 스페셜이 1종 붙습니다. 신화 전용 줄은 신화 장비에서만, 초월 전용 줄은 초월 장비에서만 효과가 있습니다. 신화 스페셜 1~7번과 초월 스페셜 1~7번은 같은 줄 번호가 짝이며, 1번(신화 「보스 보상등급」·초월 「보스 보상추가」)만 서로 동시에 적용될 수 있고 2~7번 줄은 신화와 초월이 겹치면 한쪽만(강한 쪽) 적용됩니다. 같은 스페셜 옵션을 여러 장비에 착용해도 2~7번 부류는 한 번만 적용됩니다. 초월 「길드 보스전 보상추가」는 초월 장비마다 한 번씩 보상 한 줄을 더 받을 수 있어 여러 벌이면 누적됩니다.',
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
