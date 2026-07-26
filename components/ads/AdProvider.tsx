import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { AdContextValue } from '../../types/ads.js';
import { useAds } from '../../hooks/useAds.js';
import { bootstrapH5GamesAdPlacement, syncH5AdConfig } from '../../utils/h5GamesAdPlacement.js';
import { IS_ADSENSE_APPROVAL_MODE } from '../../utils/adsenseApprovalMode.js';
import RewardedAdModal from './RewardedAdModal.js';

const AdContext = createContext<AdContextValue | null>(null);

export const useAdContext = () => {
  const ctx = useContext(AdContext);
  if (!ctx) throw new Error('useAdContext must be used within AdProvider');
  return ctx;
};

/** 프로덕션 환경 판별 */
const checkIsProduction = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && !host.includes('127.0.0.1');
};

interface AdProviderProps {
  children: React.ReactNode;
  /** 광고 제거 프리미엄 활성 여부 */
  isAdFree?: boolean;
}

const AdProvider: React.FC<AdProviderProps> = ({ children, isAdFree = false }) => {
  const [isAdReady, setIsAdReady] = useState(false);
  const isProduction = useMemo(checkIsProduction, []);
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined ?? null;
  /** 승인 심사 모드는 광고 제거 구매와 동일 취급 — 스크립트 주입·전면·보상형·배너 전부 소거 */
  const effectiveAdFree = isAdFree || IS_ADSENSE_APPROVAL_MODE;

  // AdSense + H5 Games Ad Placement API (프로덕션에서만)
  useEffect(() => {
    if (!isProduction || !clientId || effectiveAdFree) return;

    bootstrapH5GamesAdPlacement();

    // 이미 로드된 경우
    if (document.querySelector(`script[src*="adsbygoogle"]`)) {
      syncH5AdConfig(true);
      setIsAdReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      syncH5AdConfig(true);
      setIsAdReady(true);
    };
    script.onerror = () => {
      // 광고 차단기 등으로 실패 → 무시
      console.warn('[AdProvider] AdSense script failed to load');
    };
    document.head.appendChild(script);
  }, [isProduction, clientId, effectiveAdFree]);

  const {
    interstitial,
    rewardedGate,
    showInterstitial,
    showShopAdRewardInterstitial,
    closeInterstitial,
    completeRewardedGate,
    dismissRewardedGate,
  } = useAds(
    isProduction,
    effectiveAdFree
  );

  const value = useMemo<AdContextValue>(() => ({
    isAdReady,
    isProduction,
    clientId,
    showInterstitial,
    showShopAdRewardInterstitial,
    closeInterstitial,
    interstitial,
    rewardedGate,
    completeRewardedGate,
    dismissRewardedGate,
    isAdFree: effectiveAdFree,
  }), [
    isAdReady,
    isProduction,
    clientId,
    showInterstitial,
    showShopAdRewardInterstitial,
    closeInterstitial,
    interstitial,
    rewardedGate,
    completeRewardedGate,
    dismissRewardedGate,
    effectiveAdFree,
  ]);

  return (
    <AdContext.Provider value={value}>
      {children}
      <RewardedAdModal />
    </AdContext.Provider>
  );
};

export default AdProvider;
