import React from 'react';
import {
    PAIR_PET_RPS_IMAGE_BY_ATTR,
    PAIR_PET_RPS_BADGE_SHELL_SIZE_CSS,
    isPairPetRpsAttribute,
    pairPetRpsBadgePxFromAnchor,
} from '../../shared/utils/pairPetRps.js';
import type { PairPetRpsAttribute } from '../../types/entities.js';

const ATTR_ALT: Record<PairPetRpsAttribute, string> = {
    1: '가위',
    2: '바위',
    3: '보',
};

/** 펫 초상 좌측 상단 — 가위·바위·보 */
const PairPetRpsBadge: React.FC<{
    attribute: PairPetRpsAttribute | null | undefined;
    /** `anchorSizePx`·`scaleWithParent`가 없을 때만 사용 (레거시) */
    size?: 'sm' | 'md';
    /** 초상/아바타 한 변(px) — 이 값에 비례해 뱃지 크기 */
    anchorSizePx?: number;
    /** 부모가 `relative`인 타일·셸 너비의 %로 크기(최소·최대 px) — 펫 이미지와 함께 스케일 */
    scaleWithParent?: boolean;
    className?: string;
}> = ({ attribute, size = 'md', anchorSizePx, scaleWithParent = false, className = '' }) => {
    if (!isPairPetRpsAttribute(attribute)) return null;
    const src = PAIR_PET_RPS_IMAGE_BY_ATTR[attribute];

    const presetPx = size === 'sm' ? 16 : 22;
    const anchorPx =
        typeof anchorSizePx === 'number' && Number.isFinite(anchorSizePx) && anchorSizePx > 0
            ? pairPetRpsBadgePxFromAnchor(anchorSizePx)
            : null;
    const fixedPx = anchorPx ?? presetPx;

    const shellStyle =
        scaleWithParent === true
            ? ({ width: PAIR_PET_RPS_BADGE_SHELL_SIZE_CSS, height: PAIR_PET_RPS_BADGE_SHELL_SIZE_CSS } as const)
            : undefined;

    return (
        <img
            src={src}
            {...(shellStyle ? { style: shellStyle } : { width: fixedPx, height: fixedPx })}
            alt={ATTR_ALT[attribute]}
            title={ATTR_ALT[attribute]}
            className={`pointer-events-none relative z-0 select-none rounded border border-white/40 bg-black/55 object-contain shadow-md ring-1 ring-black/30 ${className}`.trim()}
            loading="lazy"
        />
    );
};

export default PairPetRpsBadge;
