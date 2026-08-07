import React from 'react';
import { resourceIcons } from '../resourceIcons.js';

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
     * `auto`/`raster`: webp (모바일·헤더에서 SVG 필터/img 조합이 빈 칸으로 나오는 경우 회피)
     * `svg`: 선명 SVG (데스크톱 인라인 등 명시적 요청 시)
     */
    variant?: 'auto' | 'svg' | 'raster';
    alt?: string;
    title?: string;
};

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
    // 기본은 래스터: 헤더/비용 표기 등 작은 UI가 모바일에서도 골드·다이아와 동일하게 보이게
    const useSvg = variant === 'svg';
    const src = useSvg ? resourceIcons.actionPointSvg : resourceIcons.actionPoint;
    return (
        <img
            src={src}
            alt={alt}
            title={title}
            aria-hidden={alt ? undefined : true}
            className={`inline-block shrink-0 object-contain drop-shadow-[0_0_6px_rgba(34,211,238,0.35)] ${SIZE_CLASS[size]} ${className}`}
            loading="eager"
            decoding="async"
            fetchPriority="high"
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
