import React from 'react';
import { RESULT_MODAL_SCORE_MOBILE_PX } from './resultModalScoreTypography.js';

/** PVE 결과 모달 기록 탭: 펫 경험치/등급강화 구간 상단 — 프로필·이름·레벨 */
const SpResultRecordPetIdentityRow: React.FC<{
    imageSrc: string | null;
    displayName: string;
    level: number;
    isMobile: boolean;
    mobileTextScale: number;
}> = ({ imageSrc, displayName, level, isMobile, mobileTextScale }) => (
    <div className={`mb-1 flex flex-shrink-0 items-center gap-1.5 ${isMobile ? '' : 'mb-1.5'}`}>
        <div
            className={`relative shrink-0 overflow-hidden rounded-lg border border-fuchsia-500/30 bg-black/40 ring-1 ring-inset ring-fuchsia-400/12 ${
                isMobile ? 'h-7 w-7' : 'h-10 w-10 min-[1024px]:h-11 min-[1024px]:w-11'
            }`}
        >
            {imageSrc ? (
                <img src={imageSrc} alt={displayName} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-fuchsia-200/50">펫</div>
            )}
        </div>
        <div className="min-w-0 flex-1">
            <p
                className="truncate font-bold text-fuchsia-100"
                style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '15px' }}
                title={displayName}
            >
                {displayName}
            </p>
            <p
                className="text-fuchsia-200/70"
                style={{
                    fontSize: isMobile
                        ? `${RESULT_MODAL_SCORE_MOBILE_PX.emptyState * mobileTextScale}px`
                        : '13px',
                }}
            >
                Lv.{level}
            </p>
        </div>
    </div>
);

export default SpResultRecordPetIdentityRow;
