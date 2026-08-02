import React, { type ReactNode } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import QuickUtilityPanel from '../quick-panel/QuickUtilityPanel.js';
import { WaitingLobbyAnnouncementBoard } from '../waiting-room/WaitingLobbyAnnouncementBoard.js';
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

/** 홈 뷰어 상단 전광판 — 스테이지/탑/모험/길드(transparentShell)에서는 표시하지 않음 */
const HomeViewerAnnouncementStrip: React.FC = () => (
    <div className="relative z-[3] w-full shrink-0 self-stretch px-1.5 pb-1 pt-1.5 sm:px-2 sm:pb-1.5 sm:pt-2">
        <WaitingLobbyAnnouncementBoard mode="home" />
    </div>
);

/**
 * PC 로비 중앙 열: 기본은 입장카드 셸, 퀵 유틸 열림 시 뷰포트 꽉 찬 인라인 패널로 전환.
 * 홈 뷰어에서는 전광판을 셸에 고정해 입장카드↔퀵유틸 전환 시에도 유지한다.
 */
const PcLobbyCenterColumn: React.FC<PcLobbyCenterColumnProps> = ({
    children,
    transparentShell = false,
    fullWidth = false,
}) => {
    const { modals, handlers } = useAppContext();
    const utilityKind = modals.activeQuickUtilityPanel;

    // 퀵유틸을 transparentShell보다 먼저 처리해야 길드/탑/모험 등에서도 패널이 마운트된다.
    // (transparentShell을 먼저 return하면 activeQuickUtilityPanel만 켜지고 호스트가 없어 버튼이 죽은 것처럼 보인다)
    if (utilityKind) {
        return (
            <div className={PC_QUICK_UTILITY_CENTER_SHELL_CLASS}>
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" aria-hidden />
                {!transparentShell ? <HomeViewerAnnouncementStrip /> : null}
                <div className="relative z-[2] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <QuickUtilityPanel kind={utilityKind} onBack={handlers.closeQuickUtilityPanel} />
                </div>
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
            <HomeViewerAnnouncementStrip />
            <div
                className={`relative z-[2] w-full min-h-0 flex-1 self-stretch overflow-hidden ${PC_HOME_CENTER_INNER_LOBBY_CLASS}`}
            >
                {children}
            </div>
        </div>
    );
};

export default PcLobbyCenterColumn;
