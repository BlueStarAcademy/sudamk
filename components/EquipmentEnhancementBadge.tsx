import React from 'react';
import {
    ENHANCE_MARKER_IMAGES,
    ENHANCE_MARKER_NUMBER_CLASS,
    ENHANCE_MARKER_SIZE_PCT,
    getEnhanceMarkerTier,
} from '../shared/constants/equipmentEnhanceMarker.js';

interface EquipmentEnhancementBadgeProps {
    stars?: number | null;
    /** 부모 슬롯 한 변 대비 마커 한 변 비율(%) — 슬롯이 줄면 동일 비율로 축소 */
    sizePct?: number;
    className?: string;
    /** 슬롯 밖(텍스트 옆 등)에서 쓸 때 — 고정 한 변(px) */
    inline?: boolean;
    /** 강화 성공 연출 등 */
    emphasize?: boolean;
}

/**
 * 장비 슬롯 우측 상단 강화 마커.
 * 코너 정사각 별 + 중앙 숫자. 장착 마커와 같이 슬롯 %로 스케일 (장비 아이콘을 거의 가리지 않음).
 */
const EquipmentEnhancementBadge: React.FC<EquipmentEnhancementBadgeProps> = ({
    stars,
    sizePct = ENHANCE_MARKER_SIZE_PCT,
    className = '',
    inline = false,
    emphasize = false,
}) => {
    const n = Math.max(0, Math.min(10, Math.floor(Number(stars) || 0)));
    const tier = getEnhanceMarkerTier(n);
    if (!tier) return null;

    const pct = Math.max(16, Math.min(28, sizePct));
    const isPrism = tier === 4;
    const isDoubleDigit = n >= 10;

    return (
        <div
            className={`${inline ? 'relative' : 'absolute right-[2%] top-[2%] z-10'} pointer-events-none aspect-square overflow-visible ${
                emphasize ? 'animate-pulse' : ''
            } ${className}`.trim()}
            style={{
                ...(inline ? { width: 18, height: 'auto' } : { width: `${pct}%`, height: 'auto' }),
                containerType: 'size',
            }}
            aria-label={`+${n}`}
            title={`+${n}`}
        >
            <img
                src={ENHANCE_MARKER_IMAGES[tier]}
                alt=""
                className={`pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] ${
                    isPrism ? 'prism-star-glow' : ''
                } ${emphasize ? 'scale-110' : ''}`}
                style={
                    isPrism
                        ? {
                              filter:
                                  'drop-shadow(0 0 6px rgba(255, 0, 255, 0.75)) drop-shadow(0 0 10px rgba(0, 255, 255, 0.5)) brightness(1.25) saturate(1.3)',
                          }
                        : undefined
                }
                draggable={false}
                decoding="async"
            />
            <span
                className={`absolute inset-0 flex items-center justify-center font-black leading-none tabular-nums ${ENHANCE_MARKER_NUMBER_CLASS[tier]} ${
                    emphasize ? 'scale-110' : ''
                }`}
                style={{
                    fontSize: isDoubleDigit ? '42cqmin' : '48cqmin',
                    letterSpacing: isDoubleDigit ? '-0.06em' : '0',
                    paddingInline: isDoubleDigit ? '6%' : '0',
                    textShadow: isPrism
                        ? '0 0 3px rgba(0,0,0,1), 0 1px 2px rgba(0,0,0,1), 1px 1px 0 rgba(0,0,0,0.95), -1px -1px 0 rgba(0,0,0,0.85)'
                        : '0 0 2px rgba(0,0,0,1), 0 1px 1px rgba(0,0,0,0.95), 1px 1px 2px rgba(0,0,0,0.9)',
                }}
            >
                {n}
            </span>
        </div>
    );
};

export default React.memo(EquipmentEnhancementBadge);
