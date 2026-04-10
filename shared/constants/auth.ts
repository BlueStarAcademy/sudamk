import { AVATAR_POOL } from './ui.js';

export const aiUserId = 'ai-player-01';

/** 관리자 계정 ID (서버 initialData/db와 동일해야 함) */
export const ADMIN_USER_ID = 'user-admin-static-id';

/**
 * 관리자 로그인 사용자명 (server/db.ts `ensureAdminAccount`와 동일).
 * 마이그레이션·재가입 등으로 user id가 UUID 형태여도 이 username이면 클라에서 관리자로 인식.
 */
export const ADMIN_LOGIN_USERNAME = '푸른별바둑학원';

/** 길드전 홀수 매칭 시 상대할 AI 봇 길드 (DB FK용) */
export const GUILD_WAR_BOT_USER_ID = 'guild-war-bot-user';
export const GUILD_WAR_BOT_GUILD_ID = 'guild-war-bot-guild';

/** 데모 모드: 전쟁 신청 시 봇 길드와 즉시 매칭 (테스트용) */
export const DEMO_GUILD_WAR = true;
export const ADMIN_NICKNAME = '관리자';

export const BOT_NAMES = ['알파고', '카타고', '절예', '신의한수', '딥젠고', '바둑도사', '묘수타파', '기성'];
