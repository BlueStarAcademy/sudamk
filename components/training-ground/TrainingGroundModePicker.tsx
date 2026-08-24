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
        <div className="flex w-full min-w-0 flex-col justify-center gap-1 sm:min-w-0 sm:flex-1">
            <p className="px-0.5 text-[10px] font-extrabold tracking-wide text-amber-200/80 sm:text-[11px]">
                {t('trainingGroundUi.gameKind')}
            </p>
            <div
                ref={scrollRef}
                {...dragScrollProps}
                className={`min-w-0 ${LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS} ${LOBBY_HORIZONTAL_MODE_PICKER_DRAG_GUARD_CLASS} ${scrollClassName} pb-1`}
            >
                <div className="flex w-max gap-1.5 pr-1 sm:gap-2">
                    {modes.map(({ mode, name, image }) => {
                        const selected = selectedMode === mode;
                        return (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => onSelect(mode)}
                                title={name}
                                className="flex shrink-0 flex-col items-center gap-1"
                            >
                                <span
                                    className={`block overflow-hidden rounded-xl border-2 transition ${
                                        selected
                                            ? 'border-amber-300 ring-2 ring-amber-300/70'
                                            : 'border-amber-900/50 hover:border-amber-500/70'
                                    }`}
                                >
                                    <img
                                        src={image}
                                        alt=""
                                        className="h-11 w-11 object-contain bg-black/40 p-0.5 sm:h-14 sm:w-14"
                                        draggable={false}
                                    />
                                </span>
                                <span
                                    className={`max-w-[3.5rem] truncate text-center text-[9px] font-bold leading-none sm:max-w-[3.75rem] sm:text-[10px] ${
                                        selected ? 'text-amber-200' : 'text-amber-100/65'
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
