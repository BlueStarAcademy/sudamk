import React from 'react';
import {
    ENHANCE_MARKER_IMAGES,
    ENHANCE_MARKER_NUMBER_CLASS,
    ENHANCE_MARKER_NUMBER_CQMIN,
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

const NUMBER_STROKE: Record<1 | 2 | 3 | 4, string> = {
    /** 은백 별 위 남색 — 흰 외곽 + 어두운 그림자 */
    1: '0 0 1.5px #fff, 0 1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff, 0 -1px 0 #fff, 1px 1px 0 rgba(255,255,255,0.95), -1px -1px 0 rgba(255,255,255,0.95), 0 0 3px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.75)',
    /** 금색 별 위 인디고 */
    2: '0 0 1.5px #f0f9ff, 0 1px 0 #e0f2fe, 1px 0 0 #e0f2fe, -1px 0 0 #e0f2fe, 0 -1px 0 #e0f2fe, 1px 1px 0 rgba(224,242,254,0.95), -1px -1px 0 rgba(224,242,254,0.95), 0 0 3px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.7)',
    /** 보라 별 위 노랑 — 검정 외곽 */
    3: '0 0 2px #000, 0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 0 0 3px rgba(0,0,0,0.9)',
    /** 프리즘 — 검정 숫자 + 흰 외곽(무지개 위 가독성) */
    4: '0 0 2px #fff, 0 1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff, 0 -1px 0 #fff, 1px 1px 0 #fff, -1px -1px 0 #fff, 0 0 3px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.85)',
};

/**
 * 장비 슬롯 우측 상단 강화 마커.
 * 코너 정사각 별 + 중앙(광학) 숫자. 장착 마커와 같이 슬롯 %로 스케일.
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

    const pct = Math.max(18, Math.min(30, sizePct));
    const isPrism = tier === 4;
    const isDoubleDigit = n >= 10;
    const cqmin = isDoubleDigit ? ENHANCE_MARKER_NUMBER_CQMIN.double : ENHANCE_MARKER_NUMBER_CQMIN.single;

    return (
        <div
            className={`${inline ? 'relative' : 'absolute right-[1.5%] top-[1.5%] z-10'} pointer-events-none aspect-square overflow-visible ${
                emphasize ? 'animate-pulse' : ''
            } ${className}`.trim()}
            style={{
                ...(inline ? { width: 22, height: 'auto' } : { width: `${pct}%`, height: 'auto' }),
                containerType: 'size',
            }}
            aria-label={`+${n}`}
            title={`+${n}`}
        >
            <img
                src={ENHANCE_MARKER_IMAGES[tier]}
                alt=""
                className={`pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)] ${
                    isPrism ? 'prism-star-glow' : ''
                } ${emphasize ? 'scale-110' : ''}`}
                draggable={false}
                decoding="async"
            />
            {/* 숫자 가독용 어두운 원판 — 별 색에 숫자가 묻히지 않게 */}
            <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55"
                style={{ width: '46%', height: '46%' }}
            />
            <span
                className={`absolute inset-0 z-[1] flex items-center justify-center font-black leading-none tabular-nums ${ENHANCE_MARKER_NUMBER_CLASS[tier]}`}
                style={{
                    fontSize: `${cqmin}cqmin`,
                    letterSpacing: isDoubleDigit ? '-0.06em' : '0',
                    // 오각별 광학 중심에 맞춤(기하 중심보다 살짝 아래)
                    transform: emphasize ? 'translateY(7%) scale(1.08)' : 'translateY(7%)',
                    textShadow: NUMBER_STROKE[tier],
                    WebkitTextStroke:
                        tier === 4
                            ? '0.55px rgba(255,255,255,0.95)'
                            : tier === 3
                              ? '0.45px rgba(0,0,0,0.85)'
                              : '0.45px rgba(255,255,255,0.55)',
                }}
            >
                {n}
            </span>
        </div>
    );
};

export default React.memo(EquipmentEnhancementBadge);
