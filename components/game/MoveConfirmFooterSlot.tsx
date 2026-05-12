import React from 'react';
import Button from '../Button.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';
import type { Point } from '../../types.js';

export type MoveConfirmFooterLayout = 'online' | 'pve';

export interface MoveConfirmFooterSlotProps {
    layout: MoveConfirmFooterLayout;
    compact: boolean;
    pendingMove: Point | null;
    mobileConfirm: boolean;
    onConfirmMove: () => void;
    onMobileConfirmToggle: (checked: boolean) => void;
}

const squareClass = (layout: MoveConfirmFooterLayout, compact: boolean): string => {
    if (layout === 'pve') {
        return compact
            ? 'h-12 w-12 shrink-0 rounded-lg sm:h-12 sm:w-12'
            : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16';
    }
    return compact
        ? 'h-10 w-10 rounded-md sm:h-10 sm:w-10 md:h-10 md:w-10'
        : 'h-[3.65rem] w-[3.65rem] rounded-lg min-[1025px]:h-14 min-[1025px]:w-14';
};

const frameClass = (layout: MoveConfirmFooterLayout): string =>
    layout === 'pve'
        ? 'border-2 border-amber-400 shadow-lg ring-1 ring-inset ring-amber-300/20'
        : 'border-2 border-amber-400/50 shadow-[0_0_24px_-10px_rgba(251,191,36,0.28)] ring-1 ring-inset ring-amber-300/14';

/**
 * 옵션「착수 버튼」ON 시 하단 대국/코어 푸터에 두는 정사각형 착수 확정 + 모드 토글(라벨 없음).
 */
export const MoveConfirmFooterSlot: React.FC<MoveConfirmFooterSlotProps> = ({
    layout,
    compact,
    pendingMove,
    mobileConfirm,
    onConfirmMove,
    onMobileConfirmToggle,
}) => {
    const sq = squareClass(layout, compact);
    const canConfirm = !!pendingMove && mobileConfirm;
    const title = !mobileConfirm
        ? '착수 버튼 모드가 OFF입니다.'
        : pendingMove
          ? '착수 확정'
          : '바둑판을 클릭해 착점을 선택하세요';

    return (
        <div className={compact ? 'flex flex-col items-center gap-0.5 shrink-0' : 'flex flex-col items-center gap-1 shrink-0'}>
            <Button
                type="button"
                onClick={canConfirm ? onConfirmMove : undefined}
                disabled={!canConfirm}
                colorScheme="none"
                title={title}
                className={`flex items-center justify-center p-0 font-bold leading-none text-slate-950 transition-transform duration-200 ease-out ${sq} ${frameClass(
                    layout,
                )} bg-gradient-to-br from-emerald-400/95 via-emerald-600/90 to-emerald-950/95 ${
                    canConfirm ? 'hover:brightness-[1.06] active:scale-[0.97]' : 'cursor-not-allowed opacity-40'
                } ${compact ? 'text-xs' : 'text-sm min-[1025px]:text-base'}`}
            >
                착수
            </Button>
            <div className="flex justify-center" role="group" aria-label="착수 버튼 모드">
                <ToggleSwitch checked={mobileConfirm} onChange={onMobileConfirmToggle} />
            </div>
        </div>
    );
};
