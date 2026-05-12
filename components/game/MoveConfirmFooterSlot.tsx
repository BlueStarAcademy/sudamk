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

/** 버튼+토글+간격과 동일한 최소 높이 — 푸터 행 높이 고정 */
const outerMinHeightClass = (compact: boolean): string =>
    compact ? 'min-h-[4.625rem]' : 'min-h-[5.125rem] min-[1025px]:min-h-[5rem]';

/**
 * 착수 슬롯이 잠시 비활성(계가 등)일 때도 동일 폭·높이를 유지하는 자리 표시.
 * 인터랙션 없음(토글 미포함) — 레이아웃 점프만 방지.
 */
export const MoveConfirmFooterReservePlaceholder: React.FC<{
    layout: MoveConfirmFooterLayout;
    compact: boolean;
    withCenterPanel?: boolean;
}> = ({ layout, compact, withCenterPanel = false }) => {
    const sq = circleDiameterClass(layout, compact);
    const inner = (
        <div
            className={`flex flex-col items-center justify-center shrink-0 ${outerMinHeightClass(compact)} ${
                compact ? 'gap-0.5' : 'gap-1'
            }`}
            aria-hidden
        >
            <div className={`${sq} shrink-0 rounded-full bg-slate-950/20 ring-1 ring-slate-500/15`} />
            <div className="h-6 w-12 shrink-0 rounded-full bg-slate-950/15 ring-1 ring-slate-600/10" />
        </div>
    );

    if (!withCenterPanel) {
        return <div className="pointer-events-none select-none opacity-0">{inner}</div>;
    }

    return (
        <div
            className={`pointer-events-none select-none opacity-0 ${arenaGameRoomMoveConfirmCenterPanelClass} flex flex-col items-center justify-center ${
                compact ? 'px-1.5 py-1' : 'px-2 py-1.5 min-[1025px]:px-2.5 min-[1025px]:py-2'
            }`}
            aria-hidden
        >
            {inner}
        </div>
    );
};

/** 원형 버튼 직경 (정사각) */
const circleDiameterClass = (layout: MoveConfirmFooterLayout, compact: boolean): string => {
    if (layout === 'pve') {
        return compact ? 'h-12 w-12' : 'h-[4.35rem] w-[4.35rem] min-[1025px]:h-[4.25rem] min-[1025px]:w-[4.25rem]';
    }
    return compact ? 'h-11 w-11 sm:h-11 sm:w-11' : 'h-[3.9rem] w-[3.9rem] min-[1025px]:h-[3.75rem] min-[1025px]:w-[3.75rem]';
};

const moveButtonClass = (
    layout: MoveConfirmFooterLayout,
    compact: boolean,
    diam: string,
    canConfirm: boolean,
): string => {
    const isPve = layout === 'pve';
    const luxRing =
        'ring-[2.5px] ring-amber-100/25 ring-offset-2 ring-offset-[#0b0f14] ' +
        'shadow-[0_0_0_1px_rgba(251,191,36,0.22),0_12px_36px_-12px_rgba(251,191,36,0.35),0_4px_20px_-8px_rgba(15,23,42,0.9),inset_0_2px_14px_rgba(255,255,255,0.12)]';
    const base =
        `group relative flex items-center justify-center overflow-hidden rounded-full border-0 p-0 font-black leading-none tracking-wide text-white ` +
        `${diam} shrink-0 ` +
        (isPve
            ? 'bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.38)_0%,rgba(167,243,208,0.22)_18%,transparent_42%),radial-gradient(circle_at_70%_88%,rgba(6,78,59,0.85)_0%,transparent_55%),linear-gradient(155deg,#134e4a_0%,#0f766e_42%,#042f2e_100%)] '
            : 'bg-[radial-gradient(circle_at_32%_20%,rgba(255,255,255,0.42)_0%,rgba(253,230,138,0.18)_16%,transparent_40%),radial-gradient(circle_at_72%_90%,rgba(15,23,42,0.9)_0%,transparent_52%),linear-gradient(158deg,#1c1917_0%,#292524_38%,#0c0a09_100%)] ') +
        `${luxRing} ` +
        `transition-[transform,filter,box-shadow] duration-300 ease-out ` +
        `before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/28 before:via-white/6 before:to-transparent before:opacity-95 ` +
        `after:pointer-events-none after:absolute after:inset-[5%] after:rounded-full after:border after:border-white/14 after:opacity-50`;
    const active = canConfirm
        ? 'hover:brightness-[1.07] hover:ring-amber-50/35 hover:shadow-[0_0_0_1px_rgba(253,230,138,0.35),0_18px_44px_-10px_rgba(251,191,36,0.42),inset_0_1px_0_rgba(255,255,255,0.22)] active:scale-[0.94]'
        : 'cursor-not-allowed opacity-[0.4] grayscale-[0.4]';
    const typo = compact ? 'text-[11px]' : 'text-[12px] min-[1025px]:text-[13px]';
    return `${base} ${active} ${typo} [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]`;
};

/**
 * 옵션「착수 버튼」ON 시 하단 대국/코어 푸터에 두는 원형 착수 확정 + 모드 토글(라벨 없음).
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
    const diam = circleDiameterClass(layout, compact);
    const canConfirm = !!pendingMove && mobileConfirm;
    const title = !mobileConfirm
        ? '착수 버튼 모드가 OFF입니다.'
        : pendingMove
          ? '착수 확정'
          : '바둑판을 클릭해 착점을 선택하세요';

    const inner = (
        <div
            className={`flex flex-col items-center justify-center shrink-0 ${outerMinHeightClass(compact)} ${
                compact ? 'gap-0.5' : 'gap-1'
            }`}
        >
            <Button
                bare
                type="button"
                onClick={canConfirm ? onConfirmMove : undefined}
                disabled={!canConfirm}
                colorScheme="none"
                title={title}
                className={moveButtonClass(layout, compact, diam, canConfirm)}
            >
                <span className="relative z-[1] tracking-tight">착수</span>
            </Button>
            <div className="flex h-6 shrink-0 items-center justify-center" role="group" aria-label="착수 버튼 모드">
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
