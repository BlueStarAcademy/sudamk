export const aiUserId = 'ai-player-01';

/**
 * WebSocket OTHER_DEVICE_LOGIN `payload.reason` — `ipLoginPolicy`에서만 사용.
 * 공인 IP(X-Forwarded-For) + 기기 쿠키(`sudamr_device_id`)로 잡은 슬롯에 다른 일반 계정이 들어올 때,
 * 기존 일반 세션을 끊으며 보낸다. (관리자는 별도 슬롯·일반 계정에 의해 밀리지 않음)
 * 동일 아이디 재로그인(다른 기기/탭)은 `reason` 없이 `server.ts` 로그인 경로에서 처리한다.
 */
export const OTHER_DEVICE_LOGIN_SHARED_PC_REASON = 'shared_pc_ip' as const;
/** WebSocket OTHER_DEVICE_LOGIN `payload.reason` — 점검 모드에서 비관리자 일괄 강제 로그아웃 */
export const OTHER_DEVICE_LOGIN_MAINTENANCE_REASON = 'maintenance_mode' as const;

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

/** 데모 모드: true면 신청 길드 전원이 즉시 봇과만 매칭(로컬 테스트). 운영(리얼 짝·홀수 봇)은 false. */
export const DEMO_GUILD_WAR = false;
export const ADMIN_NICKNAME = '관리자';

export const BOT_NAMES = ['알파고', '카타고', '절예', '신의한수', '딥젠고', '바둑도사', '묘수타파', '기성'];
