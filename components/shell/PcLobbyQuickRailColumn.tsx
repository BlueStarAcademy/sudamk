import React from 'react';
import { useTranslation } from 'react-i18next';
import QuickAccessSidebar from '../QuickAccessSidebar.js';
import {
    PC_QUICK_RAIL_COLUMN_CLASS,
    PC_QUICK_RAIL_WRAPPER_CLASS,
} from '../../shared/constants/pcShellLayout.js';

/** PC 로비 우측 고정 퀵 메뉴 레일 */
const PcLobbyQuickRailColumn: React.FC = () => {
    const { t } = useTranslation('common');
    return (
    <aside
        className={`flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}
        aria-label={t('quickMenuAria')}
    >
        <div className={PC_QUICK_RAIL_WRAPPER_CLASS}>
            <QuickAccessSidebar fillHeight />
        </div>
    </aside>
    );
};

export default PcLobbyQuickRailColumn;
