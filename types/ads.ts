// 광고 관련 타입 정의

declare global {
  interface Window {
    adsbygoogle: Array<Record<string, unknown>>;
  }
}

/** 광고 배너 위치 */
export type AdBannerPosition = 'top' | 'bottom' | 'sidebar';

/** 광고 배너 크기 설정 */
export interface AdBannerSize {
  width: number;
  height: number;
}

/** 전면 광고 트리거 타이밍 */
export type InterstitialTrigger =
  | 'game_end'
  | 'reward_claim'
  | 'lobby_transition'
  | 'tower_clear';

/** 전면 광고 상태 */
export interface InterstitialState {
  isVisible: boolean;
  canSkip: boolean;
  skipCountdown: number;
  trigger: InterstitialTrigger | null;
}

/** 광고 컨텍스트 값 */
export interface AdContextValue {
  /** AdSense 초기화 완료 여부 */
  isAdReady: boolean;
  /** 프로덕션 환경 여부 */
  isProduction: boolean;
  /** AdSense 클라이언트 ID */
  clientId: string | null;
  /** 전면 광고 표시 요청 */
  showInterstitial: (trigger: InterstitialTrigger) => boolean;
  /** 전면 광고 닫기 */
  closeInterstitial: () => void;
  /** 전면 광고 상태 */
  interstitial: InterstitialState;
  /** 광고 제거 활성 여부 (프리미엄) */
  isAdFree: boolean;
}

export {};
