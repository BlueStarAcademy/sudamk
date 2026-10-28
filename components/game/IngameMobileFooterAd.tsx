import React from 'react';

/**
 * 인게임 모바일 하단 배너 — 바둑판 공간을 확보하기 위해 비활성화.
 * 호출부는 유지하되 렌더하지 않는다(푸터 고정 높이도 광고 슬롯 없이 축소됨).
 */
const IngameMobileFooterAd: React.FC<{ isMobile: boolean; gameStatus?: string }> = () => null;

export default IngameMobileFooterAd;
