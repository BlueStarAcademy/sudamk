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
    /** 은백 별 위 남색 — 밝은 테두리 */
    1: '0 0 1px rgba(255,255,255,0.95), 0 1px 0 rgba(255,255,255,0.9), 1px 0 0 rgba(255,255,255,0.85), -1px 0 0 rgba(255,255,255,0.85), 0 -1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(0,0,0,0.45)',
    /** 금색 별 위 인디고 — 밝은 하늘 테두리 */
    2: '0 0 1px rgba(224,242,254,0.95), 0 1px 0 rgba(186,230,253,0.9), 1px 0 0 rgba(186,230,253,0.85), -1px 0 0 rgba(186,230,253,0.85), 0 -1px 0 rgba(186,230,253,0.85), 0 1px 2px rgba(0,0,0,0.4)',
    /** 보라 별 위 노랑 — 어두운 테두리 */
    3: '0 0 1px rgba(0,0,0,0.95), 0 1px 0 rgba(0,0,0,0.9), 1px 0 0 rgba(0,0,0,0.85), -1px 0 0 rgba(0,0,0,0.85), 0 -1px 0 rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.55)',
    /** 프리즘 — 검정 외곽으로 전 구간 가독성 */
    4: '0 0 2px rgba(0,0,0,1), 0 1px 0 rgba(0,0,0,1), 1px 0 0 rgba(0,0,0,1), -1px 0 0 rgba(0,0,0,1), 0 -1px 0 rgba(0,0,0,1), 1px 1px 0 rgba(0,0,0,0.95), -1px -1px 0 rgba(0,0,0,0.95), 0 0 4px rgba(255,0,255,0.45)',
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
            className={`${inline ? 'relative' : 'absolute right-[1.5%] top-[1.5%] z-10'} pointer-events-none aspect-square overflow-hidden ${
                emphasize ? 'animate-pulse' : ''
            } ${className}`.trim()}
            style={{
                ...(inline ? { width: 20, height: 'auto' } : { width: `${pct}%`, height: 'auto' }),
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
                className={`absolute inset-0 flex items-center justify-center font-black leading-none tabular-nums ${ENHANCE_MARKER_NUMBER_CLASS[tier]}`}
                style={{
                    fontSize: `${cqmin}cqmin`,
                    letterSpacing: isDoubleDigit ? '-0.08em' : '0',
                    // 오각별 광학 중심에 맞춤(기하 중심보다 살짝 아래) + 별 안쪽만 점유
                    transform: emphasize ? 'translateY(7%) scale(1.08)' : 'translateY(7%)',
                    textShadow: NUMBER_STROKE[tier],
                    WebkitTextStroke: tier === 3 || tier === 4 ? '0.35px rgba(0,0,0,0.65)' : '0.35px rgba(255,255,255,0.35)',
                }}
            >
                {n}
            </span>
        </div>
    );
};

export default React.memo(EquipmentEnhancementBadge);
