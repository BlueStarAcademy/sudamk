import React, { useEffect, useRef } from 'react';
import { useAdContext } from './AdProvider.js';
import type { AdBannerPosition, AdBannerSize } from '../../types/ads.js';
import { BANNER_SIZES, SIDEBAR_AD_SIZE, AD_SLOTS } from '../../constants/ads.js';

interface AdBannerProps {
  position: AdBannerPosition;
  className?: string;
}

/** 현재 뷰포트에 맞는 배너 크기 반환 */
function getBannerSize(position: AdBannerPosition): AdBannerSize {
  if (position === 'sidebar') return SIDEBAR_AD_SIZE;
  if (typeof window === 'undefined') return BANNER_SIZES.pc;
  const w = window.innerWidth;
  if (w < 768) return BANNER_SIZES.mobile;
  if (w < 1025) return BANNER_SIZES.tablet;
  return BANNER_SIZES.pc;
}

function getSlotId(position: AdBannerPosition): string {
  switch (position) {
    case 'top': return AD_SLOTS.bannerTop;
    case 'bottom': return AD_SLOTS.bannerBottom;
    case 'sidebar': return AD_SLOTS.sidebar;
  }
}

const AdBanner: React.FC<AdBannerProps> = ({ position, className = '' }) => {
  const { isAdReady, isProduction, clientId, isAdFree } = useAdContext();
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const size = getBannerSize(position);
  const slotId = getSlotId(position);

  useEffect(() => {
    if (!isProduction || !isAdReady || !clientId || isAdFree || !slotId) return;
    if (pushedRef.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // 광고 로드 실패 시 조용히 무시
    }
  }, [isProduction, isAdReady, clientId, isAdFree, slotId]);

  // 광고 제거 유저
  if (isAdFree) return null;

  // 프로덕션: AdSense ins 태그
  if (isProduction && clientId && slotId) {
    return (
      <div
        className={`ad-container ad-${position} flex items-center justify-center ${className}`}
        style={{ minHeight: size.height }}
      >
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: size.height }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // 개발 환경: 플레이스홀더
  return (
    <div
      className={`ad-container ad-${position} flex items-center justify-center ${className}`}
      style={{ minHeight: size.height }}
    >
      <div
        className="bg-gray-800/50 border border-dashed border-gray-600 rounded flex items-center justify-center text-gray-500 text-xs"
        style={{ width: size.width, height: size.height, maxWidth: '100%' }}
      >
        광고 영역 ({size.width}×{size.height})
      </div>
    </div>
  );
};

export default React.memo(AdBanner);
