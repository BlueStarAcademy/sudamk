import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { useAdContext } from './AdProvider.js';
import {
  AD_SLOTS,
  SHOP_AD_REWARD_DEV_SIMULATION_SECONDS,
  SHOP_AD_REWARD_INTERSTITIAL_SECONDS,
} from '../../constants/ads.js';

/**
 * 상점·챔피언십 보상형 광고 UI.
 * - 프로덕션: H5 adBreak(reward) 우선 → 미제공 시 전면 디스플레이 + 시청 타이머 후 보상
 * - 개발: 시뮬레이션(짧은 타이머 + 플레이스홀더)
 */
const RewardedAdModal: React.FC = () => {
  const { t } = useTranslation('common');
  const {
    rewardedGate,
    completeRewardedGate,
    dismissRewardedGate,
    isProduction,
    clientId,
    isAdReady,
    isAdFree,
  } = useAdContext();
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  const needsViewTimer =
    rewardedGate?.phase === 'fallback' || rewardedGate?.phase === 'simulated';
  const viewSeconds = isProduction
    ? SHOP_AD_REWARD_INTERSTITIAL_SECONDS
    : SHOP_AD_REWARD_DEV_SIMULATION_SECONDS;

  const [countdown, setCountdown] = useState(viewSeconds);
  const canClaim = countdown <= 0;

  useEffect(() => {
    if (!needsViewTimer) {
      pushedRef.current = false;
      return;
    }
    setCountdown(viewSeconds);
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [needsViewTimer, viewSeconds, rewardedGate?.placementName]);

  useEffect(() => {
    if (!needsViewTimer) {
      pushedRef.current = false;
      return;
    }
    if (!isProduction || !isAdReady || !clientId || isAdFree) return;
    if (pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // 무시
    }
  }, [needsViewTimer, isProduction, isAdReady, clientId, isAdFree, rewardedGate?.placementName]);

  if (!rewardedGate || isAdFree) return null;

  if (rewardedGate.phase === 'loading') {
    return (
      <div
        data-sudamr-ad-ui
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-8 py-6 shadow-2xl">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          <p className="text-sm text-gray-200">{t('ads.loadingAd')}</p>
        </div>
      </div>
    );
  }

  if (rewardedGate.phase === 'playing_h5') {
    return (
      <div
        data-sudamr-ad-ui
        className="pointer-events-none fixed inset-0 z-[99998] flex items-end justify-center bg-black/20 pb-8"
        aria-live="polite"
      >
        <p className="rounded-full bg-black/60 px-4 py-2 text-xs text-white/90">{t('ads.playingAd')}</p>
      </div>
    );
  }

  if (!needsViewTimer) return null;

  const showRealAd = isProduction && clientId && isAdReady;
  const slotId = AD_SLOTS.rewardedFallback;

  return (
    <div
      data-sudamr-ad-ui
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) e.stopPropagation();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col items-center gap-4 rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-2xl">
        <div className="text-xs uppercase tracking-wider text-gray-500">{t('ads.label')}</div>
        <p className="text-center text-sm text-gray-300">{t('ads.watchToEarnHint')}</p>

        <div className="relative z-0 isolate flex h-[280px] w-[336px] max-w-full items-center justify-center overflow-hidden rounded">
          {showRealAd ? (
            <ins
              ref={adRef}
              className="adsbygoogle"
              style={{ display: 'block', width: 336, height: 280 }}
              data-ad-client={clientId}
              data-ad-slot={slotId}
              data-ad-format="auto"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-gray-600 bg-gray-800/50 text-xs text-gray-500">
              {t('ads.rewardedPlaceholder')}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dismissRewardedGate();
            }}
            className="min-h-[44px] rounded-lg border border-gray-600 bg-gray-800 px-5 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-700"
          >
            {t('ads.cancel')}
          </button>
          <button
            type="button"
            disabled={!canClaim}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!canClaim) return;
              completeRewardedGate();
            }}
            className={`min-h-[44px] min-w-[140px] rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
              canClaim
                ? 'cursor-pointer bg-emerald-600 text-white hover:bg-emerald-500'
                : 'cursor-not-allowed bg-gray-800 text-gray-500'
            }`}
          >
            {canClaim ? t('ads.claimReward') : t('ads.claimRewardIn', { seconds: countdown })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewardedAdModal;
