import React from 'react';
import {
    ENHANCE_MARKER_IMAGES,
    ENHANCE_MARKER_NUMBER_CLASS,
    ENHANCE_MARKER_SIZE_PCT,
    getEnhanceMarkerTier,
} from '../shared/constants/equipmentEnhanceMarker.js';

interface EquipmentEnhancementBadgeProps {
    stars?: number | null;
    /** 부모 슬롯 한 변 대비 마커 한 변 비율(%) */
    sizePct?: number;
    className?: string;
    inline?: boolean;
}

/**
 * 장비 슬롯 우측 상단 강화(+N) 마커.
 * 얇은 사각 테두리 플레이트 + 단계별 색상 숫자.
 * 1~3 흰색 · 4~6 앰버 · 7~9 퍼플 · 10 프리즘
 */
const EquipmentEnhancementBadge: React.FC<EquipmentEnhancementBadgeProps> = ({
    stars,
    sizePct = ENHANCE_MARKER_SIZE_PCT,
    className = '',
    inline = false,
}) => {
    const n = Math.max(0, Math.min(10, Math.floor(Number(stars) || 0)));
    const tier = getEnhanceMarkerTier(n);
    if (!tier) return null;

    const pct = Math.max(18, Math.min(36, sizePct));
    const isDoubleDigit = n >= 10;

    return (
        <div
            className={`${inline ? 'relative' : 'absolute right-[2%] top-[2%] z-10'} pointer-events-none aspect-square overflow-hidden ${className}`.trim()}
            style={{ width: `${pct}%`, height: 'auto', containerType: 'size' }}
            aria-label={`+${n}`}
            title={`+${n}`}
        >
            <img
                src={ENHANCE_MARKER_IMAGES[tier]}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]"
                draggable={false}
                decoding="async"
            />
            <span
                className={`absolute inset-0 flex items-center justify-center font-black leading-none tabular-nums ${ENHANCE_MARKER_NUMBER_CLASS[tier]}`}
                style={{
                    /* 한 자·두 자 모두 동일 체감 크기 (두 자리는 자간만 살짝 줄임) */
                    fontSize: '48cqmin',
                    letterSpacing: isDoubleDigit ? '-0.06em' : '0',
                    paddingInline: isDoubleDigit ? '4%' : '0',
                    textShadow: '0 1px 1px rgba(0,0,0,0.95)',
                }}
            >
                {n}
            </span>
        </div>
    );
};

export default React.memo(EquipmentEnhancementBadge);
