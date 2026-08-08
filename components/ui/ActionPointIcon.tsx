import React, { useState } from 'react';
import {
    ACTION_POINT_ICON_PATH,
    ACTION_POINT_ICON_WEBP_PATH,
    resourceIcons,
} from '../resourceIcons.js';
import { resolvePublicUrl } from '../../utils/publicAssetUrl.js';

type ActionPointIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ActionPointIconSize, string> = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5 sm:h-4 sm:w-4',
    md: 'h-4 w-4 sm:h-5 sm:w-5',
    lg: 'h-6 w-6 sm:h-7 sm:w-7',
    xl: 'h-10 w-10 sm:h-12 sm:w-12',
};

export type ActionPointIconProps = {
    size?: ActionPointIconSize;
    className?: string;
    /**
     * `auto`/`raster`: PNG (모바일 WebView에서 webp/CSS filter 이슈 회피)
     * `svg`: 선명 SVG
     */
    variant?: 'auto' | 'svg' | 'raster';
    alt?: string;
    title?: string;
};

const PNG_SRC = resolvePublicUrl(ACTION_POINT_ICON_PATH);
const WEBP_SRC = resolvePublicUrl(ACTION_POINT_ICON_WEBP_PATH);

/**
 * 행동력 번개 아이콘 — 이모지(⚡) 대신 사용.
 */
const ActionPointIcon: React.FC<ActionPointIconProps> = ({
    size = 'sm',
    className = '',
    variant = 'auto',
    alt = '',
    title,
}) => {
    const [src, setSrc] = useState(() =>
        variant === 'svg' ? resourceIcons.actionPointSvg : PNG_SRC,
    );

    return (
        <img
            src={src}
            alt={alt}
            title={title}
            aria-hidden={alt ? undefined : true}
            className={`inline-block shrink-0 object-contain ${SIZE_CLASS[size]} ${className}`}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            draggable={false}
            onError={() => {
                if (src === PNG_SRC) setSrc(WEBP_SRC);
                else if (src === WEBP_SRC) setSrc(resourceIcons.actionPointSvg);
            }}
        />
    );
};

function hasActionPointCost(cost: number | string | null | undefined, showWhenZero: boolean): boolean {
    if (cost == null || cost === '') return false;
    if (typeof cost === 'string') return true;
    return cost > 0 || showWhenZero;
}

/** 버튼·비용 표기: 아이콘 + 숫자 */
export const ActionPointCostInline: React.FC<{
    cost: number | string;
    size?: ActionPointIconSize;
    className?: string;
    wrapParens?: boolean;
}> = ({ cost, size = 'xs', className = '', wrapParens = false }) => (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${className}`}>
        {wrapParens ? <span aria-hidden>(</span> : null}
        <ActionPointIcon size={size} />
        <span>{cost}</span>
        {wrapParens ? <span aria-hidden>)</span> : null}
    </span>
);

/** 라벨 + (아이콘 비용) — 버튼 children용 */
export const ActionPointLabelWithCost: React.FC<{
    label: React.ReactNode;
    cost?: number | string | null;
    size?: ActionPointIconSize;
    className?: string;
    showWhenZero?: boolean;
}> = ({ label, cost, size = 'xs', className = '', showWhenZero = false }) => (
    <span className={`inline-flex items-center justify-center gap-1 ${className}`}>
        <span>{label}</span>
        {hasActionPointCost(cost, showWhenZero) ? (
            <ActionPointCostInline cost={cost as number | string} size={size} wrapParens />
        ) : null}
    </span>
);

export default ActionPointIcon;
