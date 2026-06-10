import React, { Suspense, lazy } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import QuickUtilityPanel from '../quick-panel/QuickUtilityPanel.js';
import NavTitleBar from '../shell/NavTitleBar.js';
import {
    MOBILE_QUICK_UTILITY_BODY_SCROLL_CLASS,
    MOBILE_QUICK_UTILITY_SHELL_CLASS,
    PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS,
} from '../../shared/constants/pcShellLayout.js';
import {
    MOBILE_VIEWPORT_ENTRY_TITLES,
    type MobileViewportEntry,
} from '../../shared/types/mobileViewportStack.js';
import ModalChunkFallback from '../ui/ModalChunkFallback.js';

const ItemDetailModal = lazy(() => import('../ItemDetailModal.js'));
const GameRecordViewerModal = lazy(() => import('../GameRecordViewerModal.js'));
const SettingsModal = lazy(() => import('../SettingsModal.js'));
const MailboxModal = lazy(() => import('../MailboxModal.js'));
const ProfileEditModal = lazy(() => import('../ProfileEditModal.js'));
const StatAllocationModal = lazy(() => import('../StatAllocationModal.js'));
const UserProfileModal = lazy(() => import('../UserProfileModal.js'));
const PastRankingsModal = lazy(() => import('../modals/PastRankingsModal.js'));
const EquipmentEffectsModal = lazy(() => import('../EquipmentEffectsModal.js'));
const BlacksmithEffectsModal = lazy(() => import('../blacksmith/BlacksmithEffectsModal.js'));
const ChatQuickModal = lazy(() => import('../ChatQuickModal.js'));
const ActionPointModal = lazy(() => import('../ActionPointModal.js'));

type MobileViewportHostProps = {
    stack: MobileViewportEntry[];
    onBack: () => void;
};

const PanelLoadingFallback = () => <ModalChunkFallback />;

const MobileViewportScreenShell: React.FC<{
    title: string;
    onBack: () => void;
    chromeClass?: string;
    titleHeadingClass?: string;
    iconEmoji?: string;
    children: React.ReactNode;
}> = ({ title, onBack, chromeClass, titleHeadingClass, iconEmoji, children }) => (
    <div className={MOBILE_QUICK_UTILITY_SHELL_CLASS}>
        <NavTitleBar
            title={title}
            onBack={onBack}
            className="shrink-0 px-1 pt-0.5"
            chromeClass={chromeClass}
            titleHeadingClass={titleHeadingClass}
            iconEmoji={iconEmoji}
            flush
        />
        <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${MOBILE_QUICK_UTILITY_BODY_SCROLL_CLASS}`}>
            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}`}>
                {children}
            </div>
        </div>
    </div>
);

const MobileViewportHost: React.FC<MobileViewportHostProps> = ({ stack, onBack }) => {
    const {
        currentUserWithStatus,
        handlers,
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
        mergedPublicChatMessages,
    } = useAppContext();

    const entry = stack[stack.length - 1];
    if (!entry || !currentUserWithStatus) return null;

    if (entry.type === 'quickUtility') {
        return (
            <QuickUtilityPanel kind={entry.kind} onBack={onBack} shellVariant="mobile" />
        );
    }

    if (entry.type === 'gameRecordViewer') {
        return (
            <Suspense fallback={<PanelLoadingFallback />}>
                <GameRecordViewerModal
                    embedded
                    mobileFullScreen
                    record={entry.record}
                    onClose={onBack}
                />
            </Suspense>
        );
    }

    const renderEntryBody = () => {
        switch (entry.type) {
            case 'itemDetail':
                return (
                    <ItemDetailModal
                        embedded
                        item={entry.item}
                        isOwnedByCurrentUser={entry.isOwnedByCurrentUser}
                        hideEnhanceActions={entry.hideEnhanceActions}
                        onClose={onBack}
                        onStartEnhance={handlers.openEnhancementFromDetail}
                        onStartRefine={handlers.openRefinementFromDetail}
                    />
                );
            case 'settings':
                return <SettingsModal embedded onClose={onBack} />;
            case 'mailbox':
                return (
                    <MailboxModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                    />
                );
            case 'profileEdit':
                return (
                    <ProfileEditModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                    />
                );
            case 'statAllocation':
                return (
                    <StatAllocationModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                    />
                );
            case 'userProfile':
                return (
                    <UserProfileModal
                        embedded
                        user={entry.user}
                        onClose={onBack}
                        onViewItem={handlers.openViewingItem}
                    />
                );
            case 'pastRankings':
                return <PastRankingsModal embedded info={entry.info} onClose={onBack} />;
            case 'equipmentEffects':
                return (
                    <EquipmentEffectsModal
                        embedded
                        onClose={onBack}
                        mainOptionBonuses={mainOptionBonuses}
                        combatSubOptionBonuses={combatSubOptionBonuses}
                        specialStatBonuses={specialStatBonuses}
                        aggregatedMythicStats={aggregatedMythicStats}
                    />
                );
            case 'blacksmithEffects':
                return (
                    <BlacksmithEffectsModal
                        embedded
                        onClose={onBack}
                        blacksmithLevel={currentUserWithStatus.blacksmithLevel ?? 1}
                        currentUser={currentUserWithStatus}
                    />
                );
            case 'chatQuick':
                return (
                    <ChatQuickModal
                        embedded
                        messages={mergedPublicChatMessages}
                        onAction={handlers.handleAction}
                        onViewUser={handlers.openViewingUser}
                        onClose={onBack}
                    />
                );
            case 'actionPoint':
                return (
                    <ActionPointModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                    />
                );
            default:
                return null;
        }
    };

    const title = MOBILE_VIEWPORT_ENTRY_TITLES[entry.type];

    return (
        <MobileViewportScreenShell title={title} onBack={onBack}>
            <Suspense fallback={<PanelLoadingFallback />}>{renderEntryBody()}</Suspense>
        </MobileViewportScreenShell>
    );
};

export default MobileViewportHost;
