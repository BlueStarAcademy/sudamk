import React from 'react';
import Button from '../Button.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';
import type { Point } from '../../types.js';
import { arenaGameRoomMoveConfirmCenterPanelClass } from './arenaGameRoomStyles.js';

export type MoveConfirmFooterLayout = 'online' | 'pve';

export interface MoveConfirmFooterSlotProps {
    layout: MoveConfirmFooterLayout;
    compact: boolean;
    pendingMove: Point | null;
    mobileConfirm: boolean;
    onConfirmMove: () => void;
    onMobileConfirmToggle: (checked: boolean) => void;
    /**
     * true면 하단 바 중앙 슬롯용 외곽 패널(에메랄드 톤)을 씌움.
     * `GameControls` 등 3열 레이아웃의 가운데 칸에 넣을 때 사용.
     */
    withCenterPanel?: boolean;
}

const squareClass = (layout: MoveConfirmFooterLayout, compact: boolean): string => {
    if (layout === 'pve') {
        return compact
            ? 'h-12 w-12 shrink-0 rounded-xl sm:h-12 sm:w-12'
            : 'h-[4.35rem] w-[4.35rem] rounded-2xl min-[1025px]:h-[4.25rem] min-[1025px]:w-[4.25rem]';
    }
    return compact
        ? 'h-10 w-10 shrink-0 rounded-xl sm:h-10 sm:w-10 md:h-10 md:w-10'
        : 'h-[3.85rem] w-[3.85rem] rounded-2xl min-[1025px]:h-14 min-[1025px]:w-14';
};

const moveButtonClass = (
    layout: MoveConfirmFooterLayout,
    compact: boolean,
    sq: string,
    canConfirm: boolean,
): string => {
    const glow =
        layout === 'pve'
            ? 'shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_8px_28px_-8px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.22)]'
            : 'shadow-[0_0_0_1px_rgba(52,211,153,0.28),0_10px_32px_-10px_rgba(45,212,191,0.45),inset_0_1px_0_rgba(255,255,255,0.18)]';
    const base =
        `group relative flex items-center justify-center overflow-hidden border-0 p-0 font-black leading-none tracking-wide text-white ` +
        `bg-gradient-to-br from-teal-300 via-emerald-500 to-emerald-950 ${sq} ${glow} ` +
        `ring-2 ring-emerald-200/35 ring-offset-2 ring-offset-slate-950/90 transition-[transform,filter,box-shadow] duration-200 ease-out ` +
        `before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/25 before:via-white/5 before:to-transparent before:opacity-90 ` +
        `after:pointer-events-none after:absolute after:inset-[3px] after:rounded-lg after:border after:border-white/18 after:opacity-45`;
    const active = canConfirm
        ? 'hover:brightness-[1.08] hover:shadow-[0_0_0_1px_rgba(110,231,183,0.5),0_14px_40px_-8px_rgba(52,211,153,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] active:scale-[0.96]'
        : 'cursor-not-allowed opacity-[0.38] grayscale-[0.35]';
    const typo = compact ? 'text-xs' : 'text-sm min-[1025px]:text-[15px]';
    return `${base} ${active} ${typo} [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]`;
};

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
    withCenterPanel = false,
}) => {
    const sq = squareClass(layout, compact);
    const canConfirm = !!pendingMove && mobileConfirm;
    const title = !mobileConfirm
        ? '착수 버튼 모드가 OFF입니다.'
        : pendingMove
          ? '착수 확정'
          : '바둑판을 클릭해 착점을 선택하세요';

    const inner = (
        <div className={compact ? 'flex flex-col items-center gap-0.5 shrink-0' : 'flex flex-col items-center gap-1 shrink-0'}>
            <Button
                bare
                type="button"
                onClick={canConfirm ? onConfirmMove : undefined}
                disabled={!canConfirm}
                colorScheme="none"
                title={title}
                className={moveButtonClass(layout, compact, sq, canConfirm)}
            >
                <span className="relative z-[1]">착수</span>
            </Button>
            <div className="flex justify-center" role="group" aria-label="착수 버튼 모드">
                <ToggleSwitch checked={mobileConfirm} onChange={onMobileConfirmToggle} />
            </div>
        </div>
    );

    if (!withCenterPanel) {
        return inner;
    }

    return (
        <div
            className={`${arenaGameRoomMoveConfirmCenterPanelClass} flex flex-col items-center justify-center ${
                compact ? 'px-1.5 py-1' : 'px-2 py-1.5 min-[1025px]:px-2.5 min-[1025px]:py-2'
            }`}
        >
            {inner}
        </div>
    );
};
