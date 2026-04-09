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

  return (
    <div
      data-sudamr-ad-ui
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        // 배경 클릭 시 스킵 가능하면 닫기 (이벤트가 아래 경기장 UI로 새지 않도록 차단)
        if (interstitial.canSkip && e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          closeInterstitial();
        }
      }}
    >
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 max-w-[90vw] max-h-[80vh] flex flex-col items-center gap-4">
        {/* 광고 라벨 */}
        <div className="text-xs text-gray-500 uppercase tracking-wider">광고</div>

        {/* 광고 콘텐츠 영역 */}
        <div className="w-[336px] h-[280px] max-w-full flex items-center justify-center">
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

        {/* 스킵/닫기 버튼 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeInterstitial();
          }}
          disabled={!interstitial.canSkip}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all min-w-[120px] min-h-[44px] ${
            interstitial.canSkip
              ? 'bg-gray-700 hover:bg-gray-600 text-white cursor-pointer'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {interstitial.canSkip ? '닫기' : `${interstitial.skipCountdown}초 후 스킵 가능`}
        </button>
      </div>
    </div>
  );
};

export default AdInterstitial;
