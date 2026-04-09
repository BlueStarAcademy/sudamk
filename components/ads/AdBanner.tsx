import React, { useEffect, useRef, useState } from 'react';
import { useAdContext } from './AdProvider.js';
import type { AdBannerPosition, AdBannerSize } from '../../types/ads.js';
import { BANNER_SIZES, SIDEBAR_AD_SIZE, SKYSCRAPER_AD_SIZE, AD_SLOTS } from '../../constants/ads.js';

interface AdBannerProps {
  position: AdBannerPosition;
  className?: string;
}

/**
 * 배너 표시 크기. 하단(bottom)은 720px 셸·리더보드(728×90)에 맞추기 위해
 * 태블릿 중간폭(468×60)을 쓰지 않고 모바일(320) / 리더보드(pc)만 구분한다.
 */
function getBannerSize(position: AdBannerPosition, viewportWidth: number): AdBannerSize {
  if (position === 'sidebar') return SIDEBAR_AD_SIZE;
  if (position === 'left' || position === 'right') return SKYSCRAPER_AD_SIZE;
  const w = viewportWidth;
  if (position === 'bottom') {
    if (w < 768) return BANNER_SIZES.mobile;
    return BANNER_SIZES.pc;
  }
  if (w < 768) return BANNER_SIZES.mobile;
  if (w < 1025) return BANNER_SIZES.tablet;
  return BANNER_SIZES.pc;
}

function getSlotId(position: AdBannerPosition): string {
  switch (position) {
    case 'top': return AD_SLOTS.bannerTop;
    case 'bottom': return AD_SLOTS.bannerBottom;
    case 'sidebar': return AD_SLOTS.sidebar;
    case 'left': return AD_SLOTS.skyscraperLeft;
    case 'right': return AD_SLOTS.skyscraperRight;
  }
}

const AdBanner: React.FC<AdBannerProps> = ({ position, className = '' }) => {
  const { isAdReady, isProduction, clientId, isAdFree } = useAdContext();
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const size = getBannerSize(position, viewportWidth);
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
        data-sudamr-ad-ui
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
      data-sudamr-ad-ui
      className={`ad-container ad-${position} flex items-center justify-center ${className}`}
      style={{ minHeight: size.height }}
    >
      <div
        className="bg-gray-800/50 border border-dashed border-gray-600 rounded flex w-full max-w-full items-center justify-center text-gray-500 text-xs"
        style={{ height: size.height, minHeight: size.height }}
      >
        광고 영역 ({size.width}×{size.height})
      </div>
    </div>
  );
};

export default React.memo(AdBanner);
