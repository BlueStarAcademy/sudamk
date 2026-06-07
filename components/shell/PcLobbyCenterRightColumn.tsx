import React, { type ReactNode } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import QuickUtilityPanel from '../quick-panel/QuickUtilityPanel.js';
import {
    PC_LOBBY_USERS_COLUMN_CLASS,
    PC_QUICK_UTILITY_CENTER_SHELL_CLASS,
} from '../../shared/constants/pcShellLayout.js';

export type PcLobbyCenterRightColumnProps = {
    center: ReactNode;
    /** 퀵 레일 제외 우측 패널(유저·랭킹 등) */
    right: ReactNode;
    centerClassName?: string;
    rightClassName?: string;
};

const DEFAULT_CENTER_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';
const DEFAULT_RIGHT_CLASS = PC_LOBBY_USERS_COLUMN_CLASS;

/**
 * 경기장 대기실 PC 중·우 workspace — 퀵 유틸 열림 시 두 열을 합쳐 한 화면으로 전환.
 * 퀵 레일은 호출부에서 `PcLobbyQuickRailColumn`으로 별도 유지한다.
 */
const PcLobbyCenterRightColumn: React.FC<PcLobbyCenterRightColumnProps> = ({
    center,
    right,
    centerClassName = DEFAULT_CENTER_CLASS,
    rightClassName = DEFAULT_RIGHT_CLASS,
}) => {
    const { modals, handlers } = useAppContext();
    const utilityKind = modals.activeQuickUtilityPanel;

    if (utilityKind) {
        return (
            <div className={`${PC_QUICK_UTILITY_CENTER_SHELL_CLASS} min-h-0 min-w-0 flex-1`}>
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" aria-hidden />
                <QuickUtilityPanel kind={utilityKind} onBack={handlers.closeQuickUtilityPanel} />
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-2 overflow-hidden">
            <div className={centerClassName}>{center}</div>
            <div className={rightClassName}>{right}</div>
        </div>
    );
};

export default PcLobbyCenterRightColumn;
