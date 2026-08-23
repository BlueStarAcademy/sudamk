
// This file centralizes all image assets for the game for easy management and future updates.

// White base stone: Triquetra symbol
export const WHITE_BASE_STONE_IMG = "/images/Base.webp";
// Black base stone: Triskelion symbol
export const BLACK_BASE_STONE_IMG = "/images/Base.webp";

// White hidden stone: Odal rune
export const WHITE_HIDDEN_STONE_IMG = "/images/Hidden.webp";
// Black hidden stone: Heart-shaped knot
export const BLACK_HIDDEN_STONE_IMG = "/images/Hidden.webp";

// Lobby card images — 각 경기장 인게임 뒷배경과 동일 WebP
export const STRATEGIC_GO_LOBBY_IMG = "/images/bg/strategicbg.webp";
export const PLAYFUL_GO_LOBBY_IMG = "/images/bg/playfulbg.webp";
/** 경기장 홈 PVP / AI 대전 입장 카드 */
export const PVP_ARENA_ENTRY_IMG = "/images/bg/pvp.webp";
export const AI_ARENA_ENTRY_IMG = "/images/bg/ai.webp";
export const PAIR_GO_LOBBY_IMG = "/images/bg/pairbg.webp";
/** 챔피언십 홈 입장·로비 타일 — 시네마틱 `bg/champ4` (세로형 Championship.webp는 16:9 크롭에 불리) */
export const TOURNAMENT_LOBBY_IMG = "/images/bg/champ4.webp";
export const SINGLE_PLAYER_LOBBY_IMG = "/images/bg/adventure-lobby.png";
export const TOWER_CHALLENGE_LOBBY_IMG = "/images/tower/towergo.webp";
/** 네이티브 모바일 도전의 탑 대기실 히어로(가로형 WebP, `public/images/tower/towergo.webp`) */
export const TOWER_MOBILE_HERO_WEBP = "/images/tower/towergo.webp";
/** PC 스테이지 패널 등반 배경 — 세로형 탑(하단=1층 입구·상단=100층 꼭대기), 스크롤 연동 translate */
export const TOWER_STAGE_SCROLL_BG_WEBP = "/images/tower/tower-stage-scroll.webp";
/** 생산소 홈 입장 — 성소형 생산 게이트 (`bg/factorybg`) */
export const FACTORY_GO_LOBBY_IMG = "/images/bg/factorybg.webp";
/** 훈련장 홈 입장 — 도장 (`bg/trainingground`) */
export const TRAINING_GROUND_GO_LOBBY_IMG = "/images/bg/trainingground.webp";
/** 길드 홈 입장 — 시네마틱 길드 홀 (`bg/guildbg1`) */
export const GUILD_GO_LOBBY_IMG = "/images/bg/guildbg1.webp";

// Guild Boss Images
export const GUILD_BOSS_1_IMG = "/images/guild/boss/boss1.webp";
export const GUILD_BOSS_2_IMG = "/images/guild/boss/boss2.webp";
export const GUILD_BOSS_3_IMG = "/images/guild/boss/boss3.webp";
export const GUILD_BOSS_4_IMG = "/images/guild/boss/boss4.webp";
export const GUILD_BOSS_5_IMG = "/images/guild/boss/boss5.webp";

// Guild Boss Skill Icons
export const BOSS_SKILL_IMG_1_1 = "/images/guild/skill/boss1skill1.webp";
export const BOSS_SKILL_IMG_1_2 = "/images/guild/skill/boss1skill2.webp";
export const BOSS_SKILL_IMG_1_3 = "/images/guild/skill/boss1skill3.webp";
export const BOSS_SKILL_IMG_2_1 = "/images/guild/skill/boss2skill1.webp";
export const BOSS_SKILL_IMG_2_2 = "/images/guild/skill/boss2skill2.webp";
export const BOSS_SKILL_IMG_2_3 = "/images/guild/skill/boss2skill3.webp";
export const BOSS_SKILL_IMG_3_1 = "/images/guild/skill/boss3skill1.webp";
export const BOSS_SKILL_IMG_3_2 = "/images/guild/skill/boss3skill2.webp";
export const BOSS_SKILL_IMG_3_3 = "/images/guild/skill/boss3skill3.webp";
export const BOSS_SKILL_IMG_4_1 = "/images/guild/skill/boss4skill1.webp";
export const BOSS_SKILL_IMG_4_2 = "/images/guild/skill/boss4skill2.webp";
export const BOSS_SKILL_IMG_4_3 = "/images/guild/skill/boss4skill3.webp";
export const BOSS_SKILL_IMG_5_1 = "/images/guild/skill/boss5skill1.webp";
export const BOSS_SKILL_IMG_5_2 = "/images/guild/skill/boss5skill2.webp";
export const BOSS_SKILL_IMG_5_3 = "/images/guild/skill/boss5skill3.webp";

// Boss Skill Icon Map (by skill ID string)
export const BOSS_SKILL_ICON_MAP: Record<string, string> = {
    // Boss 1 (청해)
    '청해_물결의압박': BOSS_SKILL_IMG_1_1,
    '청해_심해의고요': BOSS_SKILL_IMG_1_2,
    '청해_회복억제': BOSS_SKILL_IMG_1_3,
    // Boss 2 (홍염)
    '홍염_불꽃돌파': BOSS_SKILL_IMG_2_1,
    '홍염_광열의폭발': BOSS_SKILL_IMG_2_2,
    '홍염_화상': BOSS_SKILL_IMG_2_3,
    // Boss 3 (녹수)
    '녹수_숲의압박': BOSS_SKILL_IMG_3_1,
    '녹수_포자확산': BOSS_SKILL_IMG_3_2,
    '녹수_자연의치유': BOSS_SKILL_IMG_3_3,
    // Boss 4 (현묘)
    '현묘_혼란의수수께끼': BOSS_SKILL_IMG_4_1,
    '현묘_뒤바뀐계산': BOSS_SKILL_IMG_4_2,
    '현묘_심리전': BOSS_SKILL_IMG_4_3,
    // Boss 5 (백광)
    '백광_천벌의일격': BOSS_SKILL_IMG_5_1,
    '백광_광휘의결계': BOSS_SKILL_IMG_5_2,
    '백광_심판의빛': BOSS_SKILL_IMG_5_3,
};

// Guild Research Images
export const GUILD_ATTACK_ICON = "/images/guild/skill/attack.webp";
export const GUILD_RESEARCH_HEAL_BLOCK_IMG = "/images/guild/lab/bosslab2.webp";
export const GUILD_RESEARCH_IGNITE_IMG = "/images/guild/lab/bosslab4.webp";
export const GUILD_RESEARCH_REGEN_IMG = "/images/guild/skill/userskill3.webp";
export const GUILD_RESEARCH_EVASION_IMG = "/images/guild/skill/boss-evasion.webp";
export const GUILD_RESEARCH_HIT_DAMAGE_REDUCTION_IMG = "/images/guild/skill/boss-hit-reduction.webp";