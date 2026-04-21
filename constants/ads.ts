// 광고 설정 상수

import type { AdBannerSize, InterstitialTrigger } from '../types/ads.js';

/** 상점 「광고보기」 보상: 전면 모달 최소 시청 시간(초) — 이후 닫기 시 서버 수령 */
export const SHOP_AD_REWARD_INTERSTITIAL_SECONDS = 30;

/** AdSense 광고 슬롯 ID — AdSense 콘솔에서 생성 후 여기에 입력 */
export const AD_SLOTS = {
  bannerTop: '7312967741',
  bannerBottom: '4686804407',
  sidebar: '2060641067',
  skyscraperLeft: '2060641067',   // TODO: AdSense 콘솔에서 새 슬롯 생성 후 교체
  skyscraperRight: '2060641067',  // TODO: AdSense 콘솔에서 새 슬롯 생성 후 교체
} as const;

/** 네이티브 모바일 셸 최대 가로 — 하단 리더보드(728×90)·화면 설계와 맞춤 */
export const NATIVE_MOBILE_SHELL_MAX_WIDTH = 720;

/** 네이티브 모바일 모달 본문 가로 상한(레거시·일부 PC 경로) */
export const NATIVE_MOBILE_MODAL_MAX_WIDTH_PX = 720;

/** 네이티브 모바일: 모달 가로·세로 상한(컨텐츠는 그 이하로 맞춤) — DraggableWindow·App.tsx·AppModalLayer와 동일 */
export const NATIVE_MOBILE_MODAL_MAX_WIDTH_VW = 95;
/** 모달이 화면을 과도하게 가리지 않도록 세로 상한 */
export const NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH = 80;

/** 퀵 채팅 등 메시지 영역이 길게 필요한 모달 — App.tsx `#sudamr-modal-root` 상한과 맞출 것 */
export const NATIVE_MOBILE_CHAT_MODAL_MAX_HEIGHT_VH = 92;

/**
 * 광고 루트에 부여하는 data 속성.
 * `DraggableWindow` 등 document 레벨 `mousedown` 바깥클릭 닫기 시 이 안의 포인터 이벤트는 무시해,
 * 전면/배너 닫기·클릭으로 그 아래 결과 모달이 함께 닫히지 않게 한다.
 */
export const SUDAMR_AD_UI_SELECTOR = '[data-sudamr-ad-ui]';

export function isInsideSudamrAdUi(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(SUDAMR_AD_UI_SELECTOR));
}

/**
 * 네이티브 메인 컨텐츠 논리 설계 폭 — NativeMobileScaledContent 가 scale = min(셸폭/이값, 1) 로 맞춤.
 * 720이면 폰(~360px)에서 scale≈0.5로 글자가 과도하게 작아지므로 480 전후로 두어 가독성을 우선한다.
 */
export const NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX = 480;

/** 세로 논리 높이(약 9:16). 가로 맞춤 후 높이가 남으면 바깥 영역에서 세로 스크롤 */
export const NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX = 1280;

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
  shop_ad_reward: { frequency: 1, skipDelay: SHOP_AD_REWARD_INTERSTITIAL_SECONDS },
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
