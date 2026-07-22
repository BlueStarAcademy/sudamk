import React from 'react';
import {
    ENHANCE_MARKER_IMAGES,
    ENHANCE_MARKER_NUMBER_CLASS,
    ENHANCE_MARKER_NUMBER_CQMIN,
    ENHANCE_MARKER_NUMBER_DISC,
    ENHANCE_MARKER_SIZE_PCT,
    getEnhanceMarkerTier,
    type EnhanceMarkerTier,
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
 * 별 색상별 숫자 외곽 — Star4(+10) 베이크 스타일(검정 채움+흰 외곽)에 맞춤.
 * 밝은 별(은/금)은 어두운 숫자+밝은 외곽, 어두운 별(보라)은 밝은 숫자+검정 외곽.
 */
const NUMBER_STROKE: Record<1 | 2 | 3, string> = {
    1: [
        '0 0 1px #fff',
        '0 1px 0 #fff',
        '0 -1px 0 #fff',
        '1px 0 0 #fff',
        '-1px 0 0 #fff',
        '1px 1px 0 #f8fafc',
        '-1px -1px 0 #f8fafc',
        '1px -1px 0 #f8fafc',
        '-1px 1px 0 #f8fafc',
        '0 0 2.5px rgba(255,255,255,0.95)',
        '0 1px 2px rgba(0,0,0,0.55)',
    ].join(', '),
    2: [
        '0 0 1px #fff7ed',
        '0 1px 0 #fff7ed',
        '0 -1px 0 #fff7ed',
        '1px 0 0 #fff7ed',
        '-1px 0 0 #fff7ed',
        '1px 1px 0 #ffedd5',
        '-1px -1px 0 #ffedd5',
        '1px -1px 0 #ffedd5',
        '-1px 1px 0 #ffedd5',
        '0 0 2.5px rgba(255,247,237,0.95)',
        '0 1px 2px rgba(0,0,0,0.55)',
    ].join(', '),
    3: [
        '0 0 1.25px #000',
        '0 1px 0 #000',
        '0 -1px 0 #000',
        '1px 0 0 #000',
        '-1px 0 0 #000',
        '1px 1px 0 #000',
        '-1px -1px 0 #000',
        '1px -1px 0 #000',
        '-1px 1px 0 #000',
        '0 0 3px rgba(0,0,0,0.95)',
        '0 0 5px rgba(0,0,0,0.55)',
    ].join(', '),
};

const NUMBER_STROKE_WIDTH: Record<1 | 2 | 3, string> = {
    1: '0.55px rgba(255,255,255,0.9)',
    2: '0.55px rgba(255,247,237,0.95)',
    3: '0.65px rgba(0,0,0,0.95)',
};

/**
 * 장비 슬롯 우측 상단 강화 마커.
 * 코너 정사각 별 + 중앙 숫자(+10은 이미지에 베이크). 장착 마커와 같이 슬롯 %로 스케일.
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
    /** +10은 Star4 에셋에 숫자가 구워져 있음 — CSS 오버레이 생략 */
    const numberBakedInImage = n >= 10;
    const cqmin = ENHANCE_MARKER_NUMBER_CQMIN.single;
    const overlayTier = (tier === 4 ? 3 : tier) as 1 | 2 | 3;

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
            {!numberBakedInImage && tier !== 4 ? (
                <>
                    {/* 숫자 가독용 어두운 원판 — 별 색에 숫자가 묻히지 않게 */}
                    <span
                        aria-hidden
                        className={`pointer-events-none absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                            ENHANCE_MARKER_NUMBER_DISC[tier as Exclude<EnhanceMarkerTier, 4>]
                        }`}
                        style={{ width: '52%', height: '52%' }}
                    />
                    <span
                        className={`absolute inset-0 z-[1] flex items-center justify-center font-black leading-none tabular-nums tracking-tight ${ENHANCE_MARKER_NUMBER_CLASS[tier]}`}
                        style={{
                            fontSize: `${cqmin}cqmin`,
                            // 오각별 광학 중심에 맞춤(기하 중심보다 살짝 아래)
                            transform: emphasize ? 'translateY(7%) scale(1.08)' : 'translateY(7%)',
                            textShadow: NUMBER_STROKE[overlayTier],
                            WebkitTextStroke: NUMBER_STROKE_WIDTH[overlayTier],
                        }}
                    >
                        {n}
                    </span>
                </>
            ) : null}
        </div>
    );
};

export default React.memo(EquipmentEnhancementBadge);
