import React from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode } from '../../types.js';
import { trainingGroundSelectableGameModes } from '../../shared/utils/trainingGroundGameSettings.js';
import { LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS } from '../../shared/constants/pairLobbyDenseSettingFieldLayout.js';
import {
    LOBBY_HORIZONTAL_MODE_PICKER_DRAG_GUARD_CLASS,
    useHorizontalDragScroll,
} from '../../hooks/useHorizontalDragScroll.js';

type TrainingGroundModePickerProps = {
    selectedMode: GameMode;
    onSelect: (mode: GameMode) => void;
};

const TrainingGroundModePicker: React.FC<TrainingGroundModePickerProps> = ({
    selectedMode,
    onSelect,
}) => {
    const { t } = useTranslation('profile');
    const modes = trainingGroundSelectableGameModes();
    const { scrollRef, scrollClassName, dragScrollProps } = useHorizontalDragScroll();

    return (
        <div className="flex w-full min-w-0 flex-col justify-center gap-1 sm:flex-1">
            <p className="px-0.5 text-[10px] font-extrabold tracking-wide text-amber-200/80 sm:text-[11px]">
                {t('trainingGroundUi.gameKind')}
            </p>
            <div
                ref={scrollRef}
                {...dragScrollProps}
                className={`min-w-0 ${LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS} ${LOBBY_HORIZONTAL_MODE_PICKER_DRAG_GUARD_CLASS} ${scrollClassName} pb-1`}
            >
                <div className="flex w-max min-w-full gap-2 pr-1 sm:gap-1.5">
                    {modes.map(({ mode, name, image }) => {
                        const selected = selectedMode === mode;
                        return (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => onSelect(mode)}
                                title={name}
                                className={`flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-lg border px-0.5 py-1.5 transition sm:w-[3.5rem] sm:gap-0.5 sm:py-1 ${
                                    selected
                                        ? 'border-amber-300 bg-amber-400/20 ring-1 ring-amber-300/80'
                                        : 'border-amber-800/55 bg-black/35 hover:border-amber-500/65'
                                }`}
                            >
                                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-black/40 p-0.5 sm:h-9 sm:w-9">
                                    <img src={image} alt="" className="h-full w-full object-contain" draggable={false} />
                                </span>
                                <span
                                    className={`max-w-full truncate text-center text-[9px] font-bold leading-tight sm:text-[9px] ${
                                        selected ? 'text-amber-100' : 'text-amber-100/75'
                                    }`}
                                >
                                    {name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TrainingGroundModePicker;
