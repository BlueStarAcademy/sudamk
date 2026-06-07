import React from 'react';
import Button from '../Button.js';
import InlineLoadingSpinner from './InlineLoadingSpinner.js';
import { DEFAULT_ACTION_PENDING_LABEL } from '../../shared/constants/uiFeedback.js';

type ButtonProps = React.ComponentProps<typeof Button>;

export type AsyncActionButtonProps = Omit<ButtonProps, 'disabled' | 'onClick'> & {
    isPending?: boolean;
    disabled?: boolean;
    pendingLabel?: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
    showSpinnerWhenPending?: boolean;
};

const AsyncActionButton: React.FC<AsyncActionButtonProps> = ({
    isPending = false,
    disabled = false,
    pendingLabel = DEFAULT_ACTION_PENDING_LABEL,
    onClick,
    showSpinnerWhenPending = false,
    children,
    className = '',
    ...rest
}) => {
    const isDisabled = disabled || isPending;

    return (
        <Button
            {...rest}
            className={className}
            disabled={isDisabled}
            onClick={isPending ? undefined : onClick}
        >
            {isPending ? (
                showSpinnerWhenPending ? (
                    <span className="inline-flex items-center gap-2">
                        <InlineLoadingSpinner size="sm" className="!flex-row gap-2" />
                        <span>{pendingLabel}</span>
                    </span>
                ) : (
                    pendingLabel
                )
            ) : (
                children
            )}
        </Button>
    );
};

export default AsyncActionButton;
