import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import QuickAccessSidebar from '../QuickAccessSidebar.js';
import PcLobbyCenterColumn from './PcLobbyCenterColumn.js';
import {
    PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS,
    PC_QUICK_RAIL_COLUMN_CLASS,
    PC_QUICK_RAIL_WRAPPER_CLASS,
} from '../../shared/constants/pcShellLayout.js';

export type PcLobbyThreeColumnShellProps = {
    left: ReactNode;
    center: ReactNode;
    /** false면 퀵 레일 열 생략 (퀵메뉴 없는 화면) */
    showQuickRail?: boolean;
    /** 중앙 셸·max-width 래핑 생략 (로비가 자체 셸을 쓸 때) */
    wrapCenter?: boolean;
    /** `PcLobbyCenterColumn` 입장카드 셸(`bg-panel`) 대신 투명 뷰포트 */
    centerTransparentShell?: boolean;
    /** centerTransparentShell일 때 중앙 열 가로 전폭 */
    centerFullWidth?: boolean;
    className?: string;
};

/**
 * Profile 홈과 동일한 PC 3열 폭: 좌측 고정 | 중앙 flex-1 | 퀵 레일 고정.
 * 좌측 슬롯은 호출부에서 `PC_HOME_LEFT_COLUMN_CLASS`를 적용한다.
 */
const PcLobbyThreeColumnShell: React.FC<PcLobbyThreeColumnShellProps> = ({
    left,
    center,
    showQuickRail = true,
    wrapCenter = true,
    centerTransparentShell = false,
    centerFullWidth = false,
    className = '',
}) => {
    const { t } = useTranslation('common');
    const centerNode = wrapCenter ? (
        <PcLobbyCenterColumn transparentShell={centerTransparentShell} fullWidth={centerFullWidth}>
            {center}
        </PcLobbyCenterColumn>
    ) : (
        center
    );

    return (
        <div
            className={`flex h-full min-h-0 min-w-0 flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS} ${className}`}
        >
            {left}
            {centerNode}
            {showQuickRail ? (
                <div
                    className={`flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}
                    aria-label={t('quickMenuAria')}
                >
                    <div className={PC_QUICK_RAIL_WRAPPER_CLASS}>
                        <QuickAccessSidebar fillHeight />
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default PcLobbyThreeColumnShell;
