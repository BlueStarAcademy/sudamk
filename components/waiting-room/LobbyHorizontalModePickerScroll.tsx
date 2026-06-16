import React from 'react';
import {
    LOBBY_HORIZONTAL_MODE_PICKER_ROW_CLASS,
    LOBBY_HORIZONTAL_MODE_PICKER_ROW_LAYOUT_CLASS,
    LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS,
} from '../../shared/constants/pairLobbyDenseSettingFieldLayout.js';
import { useHorizontalDragScroll, LOBBY_HORIZONTAL_MODE_PICKER_DRAG_GUARD_CLASS } from '../../hooks/useHorizontalDragScroll.js';

type LobbyHorizontalModePickerScrollProps = {
    className?: string;
    /** flex row + scroll on one element (기본 가로 피커 줄) */
    inlineRow?: boolean;
    innerRowClassName?: string;
    children: React.ReactNode;
};

export const LobbyHorizontalModePickerScroll: React.FC<LobbyHorizontalModePickerScrollProps> = ({
    className = '',
    inlineRow = false,
    innerRowClassName,
    children,
}) => {
    const { scrollRef, scrollClassName, dragScrollProps } = useHorizontalDragScroll();
    const shellClass = `${LOBBY_HORIZONTAL_MODE_PICKER_DRAG_GUARD_CLASS} ${scrollClassName} ${className}`.trim();

    if (inlineRow) {
        return (
            <div
                ref={scrollRef}
                {...dragScrollProps}
                className={`${LOBBY_HORIZONTAL_MODE_PICKER_ROW_CLASS} ${shellClass}`}
            >
                {children}
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            {...dragScrollProps}
            className={`${LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS} ${shellClass}`}
        >
            <div className={innerRowClassName ?? `${LOBBY_HORIZONTAL_MODE_PICKER_ROW_LAYOUT_CLASS} min-h-0 pb-1`}>
                {children}
            </div>
        </div>
    );
};
