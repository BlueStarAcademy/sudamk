import React from 'react';
import {
    EQUIP_STATUS_MARKER_IMAGES,
    EQUIP_STATUS_MARKER_LABEL,
    EQUIP_STATUS_MARKER_SIZE_PCT,
    type EquipStatusMarkerKind,
} from '../shared/constants/equipmentStatusMarker.js';

interface EquipmentStatusBadgeProps {
    kind?: EquipStatusMarkerKind | null;
    /** 부모 슬롯 한 변 대비 마커 한 변 비율(%) */
    sizePct?: number;
    className?: string;
    inline?: boolean;
}

/**
 * 장비 슬롯 좌측 상단 장착(E) / 프리셋(P) 마커.
 * 이미지 자체에 글자가 포함되어 있으며 배경은 투명합니다.
 */
const EquipmentStatusBadge: React.FC<EquipmentStatusBadgeProps> = ({
    kind,
    sizePct = EQUIP_STATUS_MARKER_SIZE_PCT,
    className = '',
    inline = false,
}) => {
    if (!kind) return null;

    const pct = Math.max(16, Math.min(34, sizePct));
    const label = EQUIP_STATUS_MARKER_LABEL[kind];

    return (
        <div
            className={`${inline ? 'relative' : 'absolute left-[2%] top-[2%] z-10'} pointer-events-none aspect-square ${className}`.trim()}
            style={{ width: `${pct}%`, height: 'auto' }}
            aria-label={label}
            title={label}
        >
            <img
                src={EQUIP_STATUS_MARKER_IMAGES[kind]}
                alt={label}
                className="pointer-events-none h-full w-full object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]"
                draggable={false}
                decoding="async"
            />
        </div>
    );
};

export function resolveEquipmentStatusMarkerKind(opts: {
    isEquipped?: boolean;
    isPresetEquipped?: boolean;
}): EquipStatusMarkerKind | null {
    if (opts.isEquipped) return 'equipped';
    if (opts.isPresetEquipped) return 'preset';
    return null;
}

export default React.memo(EquipmentStatusBadge);
