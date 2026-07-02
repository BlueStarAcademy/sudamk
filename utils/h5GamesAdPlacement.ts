/** Google H5 Games Ad Placement API — 보상형 광고(adBreak type: reward) */

type AdPlacementFn = (config: Record<string, unknown>) => void;

export interface RewardedAdBreakOptions {
  /** adBreak placement name (shop-ad-reward, championship-dungeon-entry 등) */
  name: string;
  /** 광고 시청 완료 시 보상 콜백 */
  onRewarded: () => void;
  /** 광고 스킵·미표시·조기 종료 */
  onDismissed?: () => void;
  /** Google 보상형 광고 재생 직전(showAdFn 호출 직전) */
  onBeforeShow?: () => void;
}

function getAdBreakFn(): AdPlacementFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { adBreak?: AdPlacementFn };
  return typeof w.adBreak === 'function' ? w.adBreak : null;
}

/** AdSense 스크립트 로드 전 adBreak/adConfig 폴백 및 preload */
export function bootstrapH5GamesAdPlacement(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { adBreak?: AdPlacementFn; adConfig?: AdPlacementFn };
  window.adsbygoogle = window.adsbygoogle || [];
  if (typeof w.adBreak !== 'function') {
    const fn: AdPlacementFn = (o) => {
      window.adsbygoogle.push(o);
    };
    w.adBreak = fn;
    w.adConfig = fn;
  }
  window.adsbygoogle.push({ preloadAdBreaks: 'on' });
}

/** 게임 사운드 상태 변경 시 호출 (선택) */
export function syncH5AdConfig(soundOn: boolean): void {
  const adConfig = (window as Window & { adConfig?: AdPlacementFn }).adConfig;
  if (typeof adConfig !== 'function') return;
  adConfig({ sound: soundOn ? 'on' : 'off' });
}

/**
 * 사용자가 이미 「광고 보기」 등으로 opt-in한 직후 호출.
 * beforeReward에서 즉시 showAdFn() — 별도 30초 강제 시청 모달 없음.
 */
export function requestRewardedAdBreak(options: RewardedAdBreakOptions): boolean {
  const adBreak = getAdBreakFn();
  if (!adBreak) {
    console.warn('[h5GamesAdPlacement] adBreak unavailable');
    options.onDismissed?.();
    return false;
  }

  let rewarded = false;
  adBreak({
    type: 'reward',
    name: options.name,
    beforeReward: (showAdFn: () => void) => {
      options.onBeforeShow?.();
      showAdFn();
    },
    adViewed: () => {
      rewarded = true;
      options.onRewarded();
    },
    adDismissed: () => {
      if (!rewarded) options.onDismissed?.();
    },
  });
  return true;
}
