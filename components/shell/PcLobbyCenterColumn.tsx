import React, { type ReactNode } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import QuickUtilityPanel from '../quick-panel/QuickUtilityPanel.js';
import {
    PC_GUILD_CENTER_INNER_CLASS,
    PC_GUILD_CENTER_SHELL_CLASS,
    PC_HOME_CENTER_INNER_LOBBY_CLASS,
    PC_HOME_CENTER_SHELL_CLASS,
    PC_QUICK_UTILITY_CENTER_SHELL_CLASS,
} from '../../shared/constants/pcShellLayout.js';

type PcLobbyCenterColumnProps = {
    children: ReactNode;
    /** 입장카드 셸 대신 배경·테두리 없는 투명 뷰포트 (길드 홈·도전의 탑 등) */
    transparentShell?: boolean;
    /** transparentShell일 때 inner max-width 제거 — 중앙 열 가로 전폭 사용 */
    fullWidth?: boolean;
};

/**
 * PC 로비 중앙 열: 기본은 입장카드 셸, 퀵 유틸 열림 시 뷰포트 꽉 찬 인라인 패널로 전환.
 */
const PcLobbyCenterColumn: React.FC<PcLobbyCenterColumnProps> = ({
    children,
    transparentShell = false,
    fullWidth = false,
}) => {
    const { modals, handlers } = useAppContext();
    const utilityKind = modals.activeQuickUtilityPanel;

    if (utilityKind) {
        return (
            <div className={PC_QUICK_UTILITY_CENTER_SHELL_CLASS}>
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" aria-hidden />
                <QuickUtilityPanel kind={utilityKind} onBack={handlers.closeQuickUtilityPanel} />
            </div>
        );
    }

    if (transparentShell) {
        const innerClass = fullWidth
            ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden'
            : PC_GUILD_CENTER_INNER_CLASS;
        return (
            <div className={PC_GUILD_CENTER_SHELL_CLASS}>
                <div className={innerClass}>{children}</div>
            </div>
        );
    }

    return (
        <div className={PC_HOME_CENTER_SHELL_CLASS}>
            <div
                className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
            <div className={`relative z-[2] ${PC_HOME_CENTER_INNER_LOBBY_CLASS}`}>{children}</div>
        </div>
    );
};

export default PcLobbyCenterColumn;
