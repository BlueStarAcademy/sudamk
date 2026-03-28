import { useState, useCallback, useRef } from 'react';
import type { InterstitialTrigger, InterstitialState } from '../types/ads.js';
import { INTERSTITIAL_CONFIG, INTERSTITIAL_LIMITS } from '../constants/ads.js';

/** 전면 광고 빈도/쿨다운 관리 훅 */
export function useAds(isProduction: boolean, isAdFree: boolean) {
  const [interstitial, setInterstitial] = useState<InterstitialState>({
    isVisible: false,
    canSkip: false,
    skipCountdown: 0,
    trigger: null,
  });

  // 트리거별 카운터
  const triggerCountsRef = useRef<Record<InterstitialTrigger, number>>({
    game_end: 0,
    reward_claim: 0,
    lobby_transition: 0,
    tower_clear: 0,
  });

  // 글로벌 제한 추적
  const lastShownAtRef = useRef<number>(0);
  const sessionCountRef = useRef<number>(0);
  const skipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showInterstitial = useCallback((trigger: InterstitialTrigger): boolean => {
    if (isAdFree) return false;

    // 세션 최대 초과
    if (sessionCountRef.current >= INTERSTITIAL_LIMITS.maxPerSession) return false;

    // 최소 간격 미충족
    const now = Date.now();
    if (now - lastShownAtRef.current < INTERSTITIAL_LIMITS.minIntervalMs) return false;

    // 빈도 체크
    const config = INTERSTITIAL_CONFIG[trigger];
    triggerCountsRef.current[trigger] += 1;
    if (triggerCountsRef.current[trigger] % config.frequency !== 0) return false;

    // 전면 광고 표시
    lastShownAtRef.current = now;
    sessionCountRef.current += 1;

    const skipDelay = config.skipDelay;
    setInterstitial({
      isVisible: true,
      canSkip: skipDelay === 0,
      skipCountdown: skipDelay,
      trigger,
    });

    // 스킵 카운트다운
    if (skipDelay > 0) {
      let remaining = skipDelay;
      skipTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (skipTimerRef.current) clearInterval(skipTimerRef.current);
          skipTimerRef.current = null;
          setInterstitial(prev => ({ ...prev, canSkip: true, skipCountdown: 0 }));
        } else {
          setInterstitial(prev => ({ ...prev, skipCountdown: remaining }));
        }
      }, 1000);
    }

    return true;
  }, [isAdFree]);

  const closeInterstitial = useCallback(() => {
    if (skipTimerRef.current) {
      clearInterval(skipTimerRef.current);
      skipTimerRef.current = null;
    }
    setInterstitial({
      isVisible: false,
      canSkip: false,
      skipCountdown: 0,
      trigger: null,
    });
  }, []);

  return {
    interstitial,
    showInterstitial,
    closeInterstitial,
  };
}
