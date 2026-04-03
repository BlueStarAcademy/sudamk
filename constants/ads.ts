// 광고 설정 상수

import type { AdBannerSize, InterstitialTrigger } from '../types/ads.js';

/** AdSense 광고 슬롯 ID — AdSense 콘솔에서 생성 후 여기에 입력 */
export const AD_SLOTS = {
  bannerTop: '7312967741',
  bannerBottom: '4686804407',
  sidebar: '2060641067',
  skyscraperLeft: '2060641067',   // TODO: AdSense 콘솔에서 새 슬롯 생성 후 교체
  skyscraperRight: '2060641067',  // TODO: AdSense 콘솔에서 새 슬롯 생성 후 교체
} as const;

/** 네이티브 모바일 셸 가로(하단 728×90 배너·콘텐츠 정렬) */
export const NATIVE_MOBILE_SHELL_MAX_WIDTH = 728;

/** 네이티브 모바일에서 모달 본문 가로 상한(셸 728px보다 약간 좁게) */
export const NATIVE_MOBILE_MODAL_MAX_WIDTH_PX = 720;

/** 디바이스별 배너 크기 */
export const BANNER_SIZES: Record<'pc' | 'tablet' | 'mobile', AdBannerSize> = {
  pc: { width: 728, height: 90 },
  tablet: { width: 468, height: 60 },
  mobile: { width: 320, height: 50 },
};

/** 사이드바 광고 크기 (PC 전용) */
export const SIDEBAR_AD_SIZE: AdBannerSize = { width: 300, height: 250 };

/** 스카이스크래퍼 광고 크기 (좌/우 세로 배너) */
export const SKYSCRAPER_AD_SIZE: AdBannerSize = { width: 160, height: 600 };

/** 전면 광고 빈도 설정 */
export const INTERSTITIAL_CONFIG: Record<InterstitialTrigger, {
  /** N회마다 1회 표시 */
  frequency: number;
  /** 스킵 가능까지 대기 시간 (초) */
  skipDelay: number;
}> = {
  game_end: { frequency: 3, skipDelay: 5 },
  reward_claim: { frequency: 3, skipDelay: 5 },
  lobby_transition: { frequency: 5, skipDelay: 3 },
  tower_clear: { frequency: 3, skipDelay: 5 },
};

/** 전면 광고 글로벌 제한 */
export const INTERSTITIAL_LIMITS = {
  /** 최소 간격 (밀리초) — 3분 */
  minIntervalMs: 3 * 60 * 1000,
  /** 세션당 최대 표시 횟수 */
  maxPerSession: 5,
} as const;

/** 배너 숨김 대상 게임 상태 */
export const BANNER_HIDDEN_GAME_STATUSES = [
  'playing',
  'scoring',
  'base_placement',
  'hidden_placing',
  'scanning',
] as const;

/** 전면 광고 금지 게임 상태 */
export const INTERSTITIAL_BLOCKED_GAME_STATUSES = [
  'playing',
  'scoring',
  'base_placement',
  'hidden_placing',
  'scanning',
  'negotiating',
] as const;
