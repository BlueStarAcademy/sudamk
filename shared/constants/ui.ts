import { AvatarInfo, BorderInfo, GameMode, ShopBorderItem } from '../types/index.js';

export const AVATAR_POOL: AvatarInfo[] = [
    { id: 'profile_1', name: '기본 아바타 1', url: '/images/profiles/profile1.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_2', name: '기본 아바타 2', url: '/images/profiles/profile2.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_3', name: '기본 아바타 3', url: '/images/profiles/profile3.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_4', name: '기본 아바타 4', url: '/images/profiles/profile4.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_5', name: '기본 아바타 5', url: '/images/profiles/profile5.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_6', name: '기본 아바타 6', url: '/images/profiles/profile6.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_7', name: '기본 아바타 7', url: '/images/profiles/profile7.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_8', name: '기본 아바타 8', url: '/images/profiles/profile8.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_9', name: '기본 아바타 9', url: '/images/profiles/profile9.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_10', name: '기본 아바타 10', url: '/images/profiles/profile10.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_11', name: '기본 아바타 11', url: '/images/profiles/profile11.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_12', name: '기본 아바타 12', url: '/images/profiles/profile12.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_13', name: '기본 아바타 13', url: '/images/profiles/profile13.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_14', name: '기본 아바타 14', url: '/images/profiles/profile14.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_15', name: '기본 아바타 15', url: '/images/profiles/profile15.webp', requiredLevel: 1, type: 'any' },
    // New Group 1
    { id: 'profile_16', name: '기본 아바타 16', url: '/images/profiles/profile16.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_17', name: '기본 아바타 17', url: '/images/profiles/profile17.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_18', name: '기본 아바타 18', url: '/images/profiles/profile18.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_19', name: '기본 아바타 19', url: '/images/profiles/profile19.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_20', name: '기본 아바타 20', url: '/images/profiles/profile20.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_21', name: '기본 아바타 21', url: '/images/profiles/profile21.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_22', name: '기본 아바타 22', url: '/images/profiles/profile22.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_23', name: '기본 아바타 23', url: '/images/profiles/profile23.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_24', name: '기본 아바타 24', url: '/images/profiles/profile24.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_25', name: '기본 아바타 25', url: '/images/profiles/profile25.webp', requiredLevel: 1, type: 'any' },
    // New Group 2
    { id: 'profile_26', name: '기본 아바타 26', url: '/images/profiles/profile26.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_27', name: '기본 아바타 27', url: '/images/profiles/profile27.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_28', name: '기본 아바타 28', url: '/images/profiles/profile28.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_29', name: '기본 아바타 29', url: '/images/profiles/profile29.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_30', name: '기본 아바타 30', url: '/images/profiles/profile30.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_31', name: '기본 아바타 31', url: '/images/profiles/profile31.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_32', name: '기본 아바타 32', url: '/images/profiles/profile32.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_33', name: '기본 아바타 33', url: '/images/profiles/profile33.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_34', name: '기본 아바타 34', url: '/images/profiles/profile34.webp', requiredLevel: 1, type: 'any' },
    { id: 'profile_35', name: '기본 아바타 35', url: '/images/profiles/profile35.webp', requiredLevel: 1, type: 'any' },
];

export const BORDER_POOL: BorderInfo[] = [
    { id: 'default', name: '심플 화이트', url: '#FFFFFF', description: '기본으로 제공되는 흰색 테두리입니다.' },
    { id: 'simple_black', name: '심플 블랙', url: '#000000', description: '기본으로 제공되는 세련된 검은색 테두리입니다.' },
    { id: 'red', name: '레드', url: '#ef4444', description: '전략/놀이 레벨 합 3 이상 사용 가능.', requiredLevelSum: 3 },
    { id: 'orange', name: '오렌지', url: '#f97316', description: '전략/놀이 레벨 합 4 이상 사용 가능.', requiredLevelSum: 4 },
    { id: 'yellow', name: '옐로우', url: '#eab308', description: '전략/놀이 레벨 합 5 이상 사용 가능.', requiredLevelSum: 5 },
    { id: 'green', name: '그린', url: '#22c55e', description: '전략/놀이 레벨 합 6 이상 사용 가능.', requiredLevelSum: 6 },
    { id: 'blue', name: '블루', url: '#3b82f6', description: '전략/놀이 레벨 합 7 이상 사용 가능.', requiredLevelSum: 7 },
    { id: 'indigo', name: '인디고', url: '#6366f1', description: '전략/놀이 레벨 합 8 이상 사용 가능.', requiredLevelSum: 8 },
    { id: 'purple', name: '퍼플', url: '#8b5cf6', description: '전략/놀이 레벨 합 9 이상 사용 가능.', requiredLevelSum: 9 },
    { id: 'rainbow', name: '레인보우', url: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', description: '전략/놀이 레벨 합 10 이상 사용 가능.', requiredLevelSum: 10 },
    { id: 'bronze_reward', name: '브론즈 보상', url: '/images/tire/Round1.webp', description: '지난 시즌 브론즈 티어 달성 보상입니다.', unlockTier: '브론즈' },
    { id: 'silver_reward', name: '실버 보상', url: '/images/tire/Round2.webp', description: '지난 시즌 실버 티어 달성 보상입니다.', unlockTier: '실버' },
    { id: 'gold_reward', name: '골드 보상', url: '/images/tire/Round3.webp', description: '지난 시즌 골드 티어 달성 보상입니다.', unlockTier: '골드' },
    { id: 'platinum_reward', name: '플래티넘 보상', url: '/images/tire/Round4.webp', description: '지난 시즌 플래티넘 티어 달성 보상입니다.', unlockTier: '플래티넘' },
    { id: 'diamond_reward', name: '다이아 보상', url: '/images/tire/Round5.webp', description: '지난 시즌 다이아 티어 달성 보상입니다.', unlockTier: '다이아' },
    { id: 'master_reward', name: '마스터 보상', url: '/images/tire/Round6.webp', description: '지난 시즌 마스터 티어 달성 보상입니다.', unlockTier: '마스터' },
    { id: 'challenger_reward', name: '챌린저 보상', url: '/images/tire/Round7.webp', description: '지난 시즌 챌린저 티어 달성 보상입니다.', unlockTier: '챌린저' },
    { id: 'tier_ring_1', name: '브론즈심플', url: '/images/tire/Ring1.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
    { id: 'tier_ring_2', name: '실버심플', url: '/images/tire/Ring2.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
    { id: 'tier_ring_3', name: '골드심플', url: '/images/tire/Ring3.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
    { id: 'tier_ring_4', name: '플레티넘심플', url: '/images/tire/Ring4.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
    { id: 'tier_ring_5', name: '프리미엄1', url: '/images/tire/Ring5.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
    { id: 'tier_ring_6', name: '프리미엄2', url: '/images/tire/Ring6.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
    { id: 'tier_ring_7', name: '챌린저잡기', url: '/images/tire/Ring7.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
    { id: 'tier_ring_8', name: 'VIP', url: '/images/tire/Ring8.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.' },
];

export const SHOP_BORDER_ITEMS: ShopBorderItem[] = [
    { id: 'tier_ring_1', name: '브론즈심플', url: '/images/tire/Ring1.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { gold: 10000 } },
    { id: 'tier_ring_2', name: '실버심플', url: '/images/tire/Ring2.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { gold: 15000 } },
    { id: 'tier_ring_3', name: '골드심플', url: '/images/tire/Ring3.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { gold: 30000 } },
    { id: 'tier_ring_4', name: '플레티넘심플', url: '/images/tire/Ring4.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { diamonds: 200 } },
    { id: 'tier_ring_5', name: '프리미엄1', url: '/images/tire/Ring5.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { diamonds: 1000 } },
    { id: 'tier_ring_6', name: '프리미엄2', url: '/images/tire/Ring6.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { diamonds: 1000 } },
    { id: 'tier_ring_7', name: '챌린저잡기', url: '/images/tire/Ring7.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { diamonds: 1000 } },
    { id: 'tier_ring_8', name: 'VIP', url: '/images/tire/Ring8.webp', description: '프로필 편집에서 구매 가능한 티어 링입니다.', price: { diamonds: 2000 } },
];

export const RANDOM_DESCRIPTIONS: Partial<Record<GameMode, string[]>> = {
  [GameMode.Standard]: ["정통의 미학, 클래식 바둑 한 판!", "고요한 수읽기의 세계로 초대합니다.", "최고의 전략가가 누구인지 가려봅시다."],
  [GameMode.Capture]: ["돌 따내기 스피드전!", "누가 먼저 목표를 달성할까요?", "짜릿한 따내기 바둑 한 판!"],
  [GameMode.Speed]: ["수당 10초 초읽기! 스피드 바둑!", "10초 초과마다 상대 +1점", "신속·정확한 착수가 승부"],
  [GameMode.Base]: ["형세분석의 승부, 베이스 바둑!", "덤 설정으로 원하는 돌", "베이스돌 배치를 읽어라"],
  [GameMode.Hidden]: ["보이지 않는 위협, 히든 바둑!", "심리전의 대가를 가려봅시다.", "재미있는 히든 바둑 시간!"],
  [GameMode.Missile]: ["신의 한 수, 미사일 발사!", "예측불허 미사일 바둑!", "판을 뒤흔드는 전략!"],
  [GameMode.Uniform]: ["모든 돌이 한 색!", "보이는 것과 다른 수읽기", "일색 바둑 심리전!"],
  [GameMode.Castle]: ["캐슬을 활용한 영토전!", "한 돌만 잡아도 승리", "무착수면 영토로 승부"],
  [GameMode.Mix]: ["규칙이 뒤섞인 믹스룰 바둑!", "혼돈 속에서 피어나는 전략", "어떤 조합이 기다릴까요?"],
  [GameMode.Dice]: ["주사위 운에 모든 것을!", "운과 실력의 조화", "과연 주사위의 선택은?"],
  [GameMode.Omok]: ["다섯개의 돌, 승리를 향한 길", "클래식 오목 한 판!", "누가 먼저 오목을 완성할까요?"],
  [GameMode.Ttamok]: ["따내거나, 만들거나! 따목!", "오목과 따내기의 짜릿한 만남", "전략적인 따목 대결"],
  [GameMode.Thief]: ["잡느냐, 튀느냐! 도둑과 경찰", "심리 추리 게임 한 판!", "최고의 도둑, 최고의 경찰은?"],
  [GameMode.Alkkagi]: ["손맛이 짜릿한 알까기 대결!", "집중력과 컨트롤의 싸움", "한 방에 판을 뒤집어 보세요!"],
  [GameMode.Curling]: ["얼음 위의 체스, 바둑 컬링!", "정교한 샷 대결", "하우스를 점령하세요!"],
};

// --- Chat Settings ---
export const PREDEFINED_EMOJIS = ['👍', '😄', '🔥', '🤔', '🎉', '😭', '🙏', '😅', '🤝'];

// For Game Room - Canned Messages
export const GAME_CHAT_MESSAGES = [
  '안녕하세요, 잘 부탁드립니다.',
  '좋은 수입니다!',
  '실수했습니다. 아쉽네요.',
  '시간이 부족해요!',
  '잠시만요, 생각 좀 하겠습니다.',
  '대국이 흥미진진하네요.',
  'GG! 좋은 대국이었습니다.',
  '복기하시겠습니까?',
];

// For Game Room - Emojis
export const GAME_CHAT_EMOJIS = ['👍', '👏', '🔥', '🤔', '😱', '😂', '🎉', '🙏', '🤝'];