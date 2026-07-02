import { useState, useCallback, useRef } from 'react';
import type { InterstitialTrigger, InterstitialState, RewardedAdGateState, ShowShopAdRewardOptions } from '../types/ads.js';
import {
  INTERSTITIAL_CONFIG,
  INTERSTITIAL_LIMITS,
  REWARDED_AD_H5_LOAD_TIMEOUT_MS,
} from '../constants/ads.js';
import { requestRewardedAdBreak } from '../utils/h5GamesAdPlacement.js';

/** 전면 광고 빈도/쿨다운 관리 훅 */
export function useAds(isProduction: boolean, isAdFree: boolean) {
  const [interstitial, setInterstitial] = useState<InterstitialState>({
    isVisible: false,
    canSkip: false,
    skipCountdown: 0,
    trigger: null,
  });
  const [rewardedGate, setRewardedGate] = useState<RewardedAdGateState | null>(null);
  const rewardedGateRef = useRef<RewardedAdGateState | null>(null);

  const syncRewardedGateRef = (next: RewardedAdGateState | null) => {
    rewardedGateRef.current = next;
    setRewardedGate(next);
  };

  // 트리거별 카운터
  const triggerCountsRef = useRef<Record<InterstitialTrigger, number>>({
    game_end: 0,
    reward_claim: 0,
    lobby_transition: 0,
    tower_clear: 0,
    shop_ad_reward: 0,
  });

  // 글로벌 제한 추적
  const lastShownAtRef = useRef<number>(0);
  const sessionCountRef = useRef<number>(0);
  const skipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rewardedLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const h5RewardStartedRef = useRef(false);

  const clearRewardedLoadTimeout = useCallback(() => {
    if (rewardedLoadTimeoutRef.current) {
      clearTimeout(rewardedLoadTimeoutRef.current);
      rewardedLoadTimeoutRef.current = null;
    }
  }, []);

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

  const closeInterstitial = useCallback((_options?: { grantShopAdReward?: boolean }) => {
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

  const completeRewardedGate = useCallback(() => {
    const gate = rewardedGateRef.current;
    syncRewardedGateRef(null);
    clearRewardedLoadTimeout();
    h5RewardStartedRef.current = false;
    gate?.onRewarded();
  }, [clearRewardedLoadTimeout]);

  const dismissRewardedGate = useCallback(() => {
    const gate = rewardedGateRef.current;
    syncRewardedGateRef(null);
    clearRewardedLoadTimeout();
    h5RewardStartedRef.current = false;
    gate?.onDismissed?.();
  }, [clearRewardedLoadTimeout]);

  /**
   * 보상형 광고: 프로덕션은 H5 adBreak(reward) → 실패·로딩 타임아웃 시 전면 폴백 UI.
   * 개발 환경은 시뮬레이션 모달(타이머 후 보상).
   */
  const showShopAdRewardInterstitial = useCallback(
    (onRewarded: () => void, options?: ShowShopAdRewardOptions) => {
      if (isAdFree) {
        queueMicrotask(() => onRewarded());
        return;
      }

      clearRewardedLoadTimeout();
      h5RewardStartedRef.current = false;

      const gate: RewardedAdGateState = {
        placementName: options?.placementName ?? 'shop-ad-reward',
        phase: 'loading',
        onRewarded,
        onDismissed: options?.onDismissed,
      };
      syncRewardedGateRef(gate);

      if (!isProduction) {
        syncRewardedGateRef({ ...gate, phase: 'simulated' });
        return;
      }

      rewardedLoadTimeoutRef.current = setTimeout(() => {
        rewardedLoadTimeoutRef.current = null;
        const current = rewardedGateRef.current;
        if (!current || current.phase !== 'loading') return;
        syncRewardedGateRef({ ...current, phase: 'fallback' });
      }, REWARDED_AD_H5_LOAD_TIMEOUT_MS);

      const started = requestRewardedAdBreak({
        name: gate.placementName,
        onBeforeShow: () => {
          h5RewardStartedRef.current = true;
          clearRewardedLoadTimeout();
          const current = rewardedGateRef.current;
          if (current) syncRewardedGateRef({ ...current, phase: 'playing_h5' });
        },
        onRewarded: () => {
          clearRewardedLoadTimeout();
          h5RewardStartedRef.current = false;
          syncRewardedGateRef(null);
          onRewarded();
        },
        onDismissed: () => {
          clearRewardedLoadTimeout();
          const hadStarted = h5RewardStartedRef.current;
          h5RewardStartedRef.current = false;
          if (hadStarted) {
            syncRewardedGateRef(null);
            options?.onDismissed?.();
            return;
          }
          const current = rewardedGateRef.current;
          if (current) syncRewardedGateRef({ ...current, phase: 'fallback' });
        },
      });

      if (!started) {
        clearRewardedLoadTimeout();
        syncRewardedGateRef({ ...gate, phase: 'fallback' });
      }
    },
    [isAdFree, isProduction, clearRewardedLoadTimeout],
  );

  return {
    interstitial,
    rewardedGate,
    showInterstitial,
    showShopAdRewardInterstitial,
    closeInterstitial,
    completeRewardedGate,
    dismissRewardedGate,
  };
}
