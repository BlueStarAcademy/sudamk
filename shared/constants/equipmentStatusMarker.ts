/** 장비 슬롯 장착(E) / 프리셋(P) — 투명 배경 심플 원형(글자 이미지에 포함) */

export const EQUIP_STATUS_MARKER_SIZE_PCT = 24;

export type EquipStatusMarkerKind = 'equipped' | 'preset';

export const EQUIP_STATUS_MARKER_IMAGES: Record<EquipStatusMarkerKind, string> = {
    equipped: '/images/equipments/EquipStatusMarkerE.webp',
    preset: '/images/equipments/EquipStatusMarkerP.webp',
};

export const EQUIP_STATUS_MARKER_LABEL: Record<EquipStatusMarkerKind, string> = {
    equipped: 'E',
    preset: 'P',
};
