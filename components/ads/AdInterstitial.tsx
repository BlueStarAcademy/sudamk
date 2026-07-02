import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef } from 'react';
import { useAdContext } from './AdProvider.js';

/**
 * 전면 광고 모달 (game_end 등 showInterstitial 트리거용).
 * 보상형(상점·챔피언십)은 H5 adBreak API로 처리 — 이 모달을 쓰지 않음.
 */
const AdInterstitial: React.FC = () => {
  const { t } = useTranslation('common');
  const { interstitial, closeInterstitial, isProduction, clientId, isAdReady, isAdFree } = useAdContext();
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!interstitial.isVisible) {
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
  }, [interstitial.isVisible, isProduction, isAdReady, clientId, isAdFree]);

  if (!interstitial.isVisible || isAdFree || interstitial.trigger === 'shop_ad_reward') return null;

  return (
    <div
      data-sudamr-ad-ui
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (interstitial.canSkip && e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          closeInterstitial();
        }
      }}
    >
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 max-w-[90vw] max-h-[80vh] flex flex-col items-center gap-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider">{t('ads.label')}</div>

        <div className="relative z-0 isolate w-[336px] h-[280px] max-w-full overflow-hidden rounded flex items-center justify-center">
          {isProduction && clientId ? (
            <ins
              ref={adRef}
              className="adsbygoogle"
              style={{ display: 'block', width: 336, height: 280 }}
              data-ad-client={clientId}
              data-ad-slot=""
              data-ad-format="auto"
            />
          ) : (
            <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded flex items-center justify-center text-gray-500 text-xs w-full h-full">
              {t('ads.interstitialPlaceholder')}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeInterstitial();
          }}
          disabled={!interstitial.canSkip}
          className={`min-h-[44px] min-w-[120px] rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
            interstitial.canSkip
              ? 'cursor-pointer bg-gray-700 text-white hover:bg-gray-600'
              : 'cursor-not-allowed bg-gray-800 text-gray-500'
          }`}
        >
          {interstitial.canSkip ? t('ads.close') : t('ads.skipIn', { seconds: interstitial.skipCountdown })}
        </button>
      </div>
    </div>
  );
};

export default AdInterstitial;
