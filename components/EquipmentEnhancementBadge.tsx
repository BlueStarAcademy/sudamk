import React from 'react';
import {
    ENHANCE_MARKER_IMAGES,
    ENHANCE_MARKER_NUMBER_CLASS,
    ENHANCE_MARKER_NUMBER_CQMIN,
    ENHANCE_MARKER_NUMBER_DISC,
    ENHANCE_MARKER_NUMBER_DISC_PCT,
    ENHANCE_MARKER_NUMBER_STROKE,
    ENHANCE_MARKER_NUMBER_STROKE_WIDTH,
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
 * 별 중앙 안전 영역에 보색 숫자를 넣어 별 밖으로 삐져나오지 않게 함.
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

    const pct = Math.max(20, Math.min(34, sizePct));
    const isPrism = tier === 4;
    const isDoubleDigit = n >= 10;
    const cqmin = isDoubleDigit ? ENHANCE_MARKER_NUMBER_CQMIN.double : ENHANCE_MARKER_NUMBER_CQMIN.single;
    const discPct = isDoubleDigit ? ENHANCE_MARKER_NUMBER_DISC_PCT + 4 : ENHANCE_MARKER_NUMBER_DISC_PCT;

    return (
        <div
            className={`${inline ? 'relative' : 'absolute right-[1%] top-[1%] z-10'} pointer-events-none aspect-square overflow-visible ${
                emphasize ? 'animate-pulse' : ''
            } ${className}`.trim()}
            style={{
                ...(inline ? { width: 26, height: 'auto' } : { width: `${pct}%`, height: 'auto' }),
                containerType: 'size',
            }}
            aria-label={`+${n}`}
            title={`+${n}`}
        >
            <img
                src={ENHANCE_MARKER_IMAGES[tier]}
                alt=""
                className={`pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                    isPrism ? 'prism-star-glow' : ''
                } ${emphasize ? 'scale-110' : ''}`}
                draggable={false}
                decoding="async"
            />
            {/* 별 본체 안쪽만 덮는 작은 원판 — 포인트는 그대로 노출 */}
            <span
                aria-hidden
                className={`pointer-events-none absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full ${ENHANCE_MARKER_NUMBER_DISC[tier]}`}
                style={{ width: `${discPct}%`, height: `${discPct}%` }}
            />
            {/* 안전 영역 클립 — 글리프가 별 포인트 밖으로 나가지 않게 */}
            <span
                className="absolute inset-[24%] z-[1] flex items-center justify-center overflow-hidden rounded-full"
                style={{
                    transform: emphasize ? 'translateY(6%) scale(1.06)' : 'translateY(6%)',
                }}
            >
                <span
                    className={`font-black leading-none tabular-nums tracking-tighter drop-shadow-sm ${ENHANCE_MARKER_NUMBER_CLASS[tier]}`}
                    style={{
                        fontSize: `${cqmin}cqmin`,
                        textShadow: ENHANCE_MARKER_NUMBER_STROKE[tier],
                        WebkitTextStroke: ENHANCE_MARKER_NUMBER_STROKE_WIDTH[tier],
                        paintOrder: 'stroke fill',
                    }}
                >
                    {n}
                </span>
            </span>
        </div>
    );
};

export default React.memo(EquipmentEnhancementBadge);
