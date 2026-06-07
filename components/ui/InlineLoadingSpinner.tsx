import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
    sm: 'h-4 w-4 border',
    md: 'h-9 w-9 border-2',
    lg: 'h-16 w-16 border-2',
};

export type InlineLoadingSpinnerProps = {
    size?: SpinnerSize;
    label?: string;
    className?: string;
    labelClassName?: string;
};

const InlineLoadingSpinner: React.FC<InlineLoadingSpinnerProps> = ({
    size = 'md',
    label,
    className = '',
    labelClassName = 'text-sm text-slate-400',
}) => (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`.trim()}>
        <div
            className={`animate-spin rounded-full border-amber-400/25 border-t-amber-300 ${SIZE_CLASSES[size]}`}
            aria-hidden
        />
        {label ? <span className={labelClassName}>{label}</span> : null}
    </div>
);

export default InlineLoadingSpinner;
