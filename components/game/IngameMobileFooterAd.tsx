import React from 'react';
import AdBanner from '../ads/AdBanner.js';

/** 인게임 모바일: 조작 패널(footer) 하단 320×50 배너 슬롯 */
const IngameMobileFooterAd: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
    if (!isMobile) return null;
    return (
        <div className="mt-1 flex w-full shrink-0 justify-center border-t border-slate-600/25 pt-1.5">
            <div
                className="h-[50px] w-[320px] max-w-full shrink-0 overflow-hidden rounded-md border border-slate-600/20 bg-black/20"
                aria-label="광고"
            >
                <AdBanner position="ingame_footer" className="min-h-0" />
            </div>
        </div>
    );
};

export default IngameMobileFooterAd;
