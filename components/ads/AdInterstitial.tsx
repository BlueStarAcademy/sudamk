import React, { useEffect, useRef } from 'react';
import { useAdContext } from './AdProvider.js';

/**
 * 전면 광고 모달.
 * AdProvider의 interstitial 상태에 따라 자동 표시/숨김.
 */
const AdInterstitial: React.FC = () => {
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

  if (!interstitial.isVisible || isAdFree) return null;

  const isShopAdReward = interstitial.trigger === 'shop_ad_reward';

  return (
    <div
      data-sudamr-ad-ui
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        // 상점 광고 보상은 배경 탭으로 보상·취소를 구분할 수 없어 닫기 비활성화
        if (isShopAdReward) {
          e.stopPropagation();
          return;
        }
        if (interstitial.canSkip && e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          closeInterstitial();
        }
      }}
    >
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 max-w-[90vw] max-h-[80vh] flex flex-col items-center gap-4">
        {!isShopAdReward && (
          <div className="text-xs text-gray-500 uppercase tracking-wider">광고</div>
        )}

        {/* 광고 콘텐츠 영역 — iframe이 영역 밖으로 나와 버튼을 가리지 않도록 잘라냄 */}
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
              전면 광고 영역 (336×280)
            </div>
          )}
        </div>

        {/* 상점 광고: 취소(항상) + 보상 받기(30초 후) / 기타 전면: 단일 닫기 */}
        {isShopAdReward ? (
          <div className="relative z-20 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeInterstitial({ grantShopAdReward: false });
              }}
              className="order-2 min-h-[44px] flex-1 rounded-lg border border-stone-500/50 bg-stone-800/90 px-4 py-2 text-sm font-semibold text-stone-200 transition-colors hover:border-rose-400/40 hover:bg-stone-700/90 hover:text-white sm:order-1 sm:flex-none sm:min-w-[120px]"
            >
              취소
            </button>
            <button
              type="button"
              aria-disabled={!interstitial.canSkip}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!interstitial.canSkip) return;
                closeInterstitial({ grantShopAdReward: true });
              }}
              className={`order-1 min-h-[44px] flex-1 touch-manipulation rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:order-2 sm:flex-none sm:min-w-[140px] ${
                interstitial.canSkip
                  ? 'cursor-pointer bg-emerald-700 text-white hover:bg-emerald-600 active:bg-emerald-500'
                  : 'pointer-events-none cursor-not-allowed bg-gray-800 text-gray-500'
              }`}
            >
              {interstitial.canSkip ? '보상 받기' : `${interstitial.skipCountdown}초 후 보상 받기`}
            </button>
          </div>
        ) : (
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
            {interstitial.canSkip ? '닫기' : `${interstitial.skipCountdown}초 후 스킵 가능`}
          </button>
        )}
      </div>
    </div>
  );
};

export default AdInterstitial;
