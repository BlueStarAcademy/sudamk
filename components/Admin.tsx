import React, { useState } from 'react';
import AdminDashboard, { type AdminView } from './admin/AdminDashboard.js';
import UserManagementPanel from './admin/UserManagementPanel.js';
import MailSystemPanel from './admin/MailSystemPanel.js';
import ServerSettingsPanel from './admin/ServerSettingsPanel.js';
import HomeBoardPanel from './admin/HomeBoardPanel.js';
import AdminOperationsPanel from './admin/AdminOperationsPanel.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

const Admin: React.FC = () => {
    const [adminView, setAdminView] = useState<AdminView>('dashboard');
    const { currentUserWithStatus, allUsers, liveGames, adminLogs, gameModeAvailability, announcements, globalOverrideAnnouncement, announcementInterval, homeBoardPosts, handlers } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();

    const handleBack = () => {
        if (adminView === 'dashboard') {
            window.location.hash = '#/profile';
        } else {
            setAdminView('dashboard');
        }
    };

    const adminProps = {
        currentUser: currentUserWithStatus!,
        allUsers,
        liveGames: Object.values(liveGames),
        adminLogs,
        onAction: handlers.handleAction,
        onBack: handleBack,
        gameModeAvailability,
        announcements,
        globalOverrideAnnouncement,
        announcementInterval,
        homeBoardPosts,
    };

    const renderView = () => {
        switch (adminView) {
            case 'userManagement':
                return <UserManagementPanel {...adminProps} />;
            case 'mailSystem':
                return <MailSystemPanel {...adminProps} />;
            case 'serverSettings':
                return <ServerSettingsPanel {...adminProps} />;
            case 'homeBoard':
                return <HomeBoardPanel {...adminProps} />;
            case 'operations':
                return (
                    <AdminOperationsPanel
                        liveGames={adminProps.liveGames}
                        onAction={adminProps.onAction}
                        onBack={handleBack}
                        currentUser={adminProps.currentUser}
                    />
                );
            case 'dashboard':
            default:
                return (
                    <AdminDashboard
                        onNavigate={setAdminView}
                        onBackToProfile={handleBack}
                        liveGames={adminProps.liveGames}
                    />
                );
        }
    };

    return (
        <div
            className={
                isNativeMobile
                    ? 'flex min-h-0 flex-1 flex-col overflow-y-auto p-2'
                    : 'p-4 lg:p-8'
            }
        >
            {renderView()}
        </div>
    );
};

export default Admin;