import React, { useMemo, type ReactNode } from 'react';
import type { AppContextValue } from './types.js';
import {
    AppUserSliceContext,
    AppRouteSliceContext,
    AppGameStoreSliceContext,
    AppUiSliceContext,
    AppRealtimeSliceContext,
} from './AppSliceContexts.js';

type Props = {
    value: AppContextValue;
    children: ReactNode;
};

export const AppSliceProviders: React.FC<Props> = ({ value, children }) => {
    const userSlice = useMemo(
        () => ({
            currentUser: value.currentUser,
            currentUserWithStatus: value.currentUserWithStatus,
            presets: value.presets,
            setCurrentUserAndRoute: value.setCurrentUserAndRoute,
            mainOptionBonuses: value.mainOptionBonuses,
            combatSubOptionBonuses: value.combatSubOptionBonuses,
            specialStatBonuses: value.specialStatBonuses,
            aggregatedMythicStats: value.aggregatedMythicStats,
            guilds: value.guilds,
            unreadMailCount: value.unreadMailCount,
            hasClaimableQuest: value.hasClaimableQuest,
            hasClaimableExchangeSettlement: value.hasClaimableExchangeSettlement,
            hasClaimablePairPetTrainingOrHatchery: value.hasClaimablePairPetTrainingOrHatchery,
            updateTrigger: value.updateTrigger,
            singlePlayerStagesListRevision: value.singlePlayerStagesListRevision,
        }),
        [
            value.currentUser,
            value.currentUserWithStatus,
            value.presets,
            value.setCurrentUserAndRoute,
            value.mainOptionBonuses,
            value.combatSubOptionBonuses,
            value.specialStatBonuses,
            value.aggregatedMythicStats,
            value.guilds,
            value.unreadMailCount,
            value.hasClaimableQuest,
            value.hasClaimableExchangeSettlement,
            value.hasClaimablePairPetTrainingOrHatchery,
            value.updateTrigger,
            value.singlePlayerStagesListRevision,
        ],
    );

    const routeSlice = useMemo(
        () => ({
            currentRoute: value.currentRoute,
            isNarrowViewport: value.isNarrowViewport,
            isNativeMobile: value.isNativeMobile,
            usePortraitFirstShell: value.usePortraitFirstShell,
            modalLayerUsesDesignPixels: value.modalLayerUsesDesignPixels,
            pcUniformScalePolicy: value.pcUniformScalePolicy,
            isPhoneHandheldTouch: value.isPhoneHandheldTouch,
            isLargeTouchTablet: value.isLargeTouchTablet,
            showPcLikeMobileLayoutSetting: value.showPcLikeMobileLayoutSetting,
            settings: value.settings,
            updateSoundSetting: value.updateSoundSetting,
            updateFeatureSetting: value.updateFeatureSetting,
            updatePanelColor: value.updatePanelColor,
            updateTextColor: value.updateTextColor,
            updatePanelEdgeStyle: value.updatePanelEdgeStyle,
            updatePcLikeMobileLayout: value.updatePcLikeMobileLayout,
            resetGraphicsToDefault: value.resetGraphicsToDefault,
            arenaEntranceAvailability: value.arenaEntranceAvailability,
            arenaEntranceFromServer: value.arenaEntranceFromServer,
        }),
        [
            value.currentRoute,
            value.isNarrowViewport,
            value.isNativeMobile,
            value.usePortraitFirstShell,
            value.modalLayerUsesDesignPixels,
            value.pcUniformScalePolicy,
            value.isPhoneHandheldTouch,
            value.isLargeTouchTablet,
            value.showPcLikeMobileLayoutSetting,
            value.settings,
            value.updateSoundSetting,
            value.updateFeatureSetting,
            value.updatePanelColor,
            value.updateTextColor,
            value.updatePanelEdgeStyle,
            value.updatePcLikeMobileLayout,
            value.resetGraphicsToDefault,
            value.arenaEntranceAvailability,
            value.arenaEntranceFromServer,
        ],
    );

    const gameStoreSlice = useMemo(
        () => ({
            activeGame: value.activeGame,
            liveGames: value.liveGames,
            singlePlayerGames: value.singlePlayerGames,
            towerGames: value.towerGames,
            gameRejoinFailure: value.gameRejoinFailure,
            activeNegotiation: value.activeNegotiation,
            negotiations: value.negotiations,
            towerRankingsRefetchTrigger: value.towerRankingsRefetchTrigger,
            gameModeAvailability: value.gameModeAvailability,
            kataServerRuntimeConfig: value.kataServerRuntimeConfig,
            championshipAbilityKataLadder: value.championshipAbilityKataLadder,
        }),
        [
            value.activeGame,
            value.liveGames,
            value.singlePlayerGames,
            value.towerGames,
            value.gameRejoinFailure,
            value.activeNegotiation,
            value.negotiations,
            value.towerRankingsRefetchTrigger,
            value.gameModeAvailability,
            value.kataServerRuntimeConfig,
            value.championshipAbilityKataLadder,
        ],
    );

    const uiSlice = useMemo(
        () => ({
            modals: value.modals,
            handlers: value.handlers,
            enhancementOutcome: value.enhancementOutcome,
            enhancementResult: value.enhancementResult,
            showExitToast: value.showExitToast,
            serverReconnectNotice: value.serverReconnectNotice,
            connectionStatus: value.connectionStatus,
            error: value.error,
        }),
        [
            value.modals,
            value.handlers,
            value.enhancementOutcome,
            value.enhancementResult,
            value.showExitToast,
            value.serverReconnectNotice,
            value.connectionStatus,
            value.error,
        ],
    );

    const realtimeSlice = useMemo(
        () => ({
            onlineUsers: value.onlineUsers,
            allUsers: value.allUsers,
            waitingRoomChats: value.waitingRoomChats,
            gameChats: value.gameChats,
            rankedMatchingQueue: value.rankedMatchingQueue,
            rankedMatchProposal: value.rankedMatchProposal,
            rankedMatchFound: value.rankedMatchFound,
            pairRooms: value.pairRooms,
            pairRoomChatByRoomId: value.pairRoomChatByRoomId,
            pairPartnerInvites: value.pairPartnerInvites,
            pairInviteCooldownUntilByInviteeId: value.pairInviteCooldownUntilByInviteeId,
            announcements: value.announcements,
            globalOverrideAnnouncement: value.globalOverrideAnnouncement,
            announcementInterval: value.announcementInterval,
            homeBoardPosts: value.homeBoardPosts,
            unreadHomeBoardPostIds: value.unreadHomeBoardPostIds,
            hasUnreadHomeBoardPosts: value.hasUnreadHomeBoardPosts,
            adminLogs: value.adminLogs,
        }),
        [
            value.onlineUsers,
            value.allUsers,
            value.waitingRoomChats,
            value.gameChats,
            value.rankedMatchingQueue,
            value.rankedMatchProposal,
            value.rankedMatchFound,
            value.pairRooms,
            value.pairRoomChatByRoomId,
            value.pairPartnerInvites,
            value.pairInviteCooldownUntilByInviteeId,
            value.announcements,
            value.globalOverrideAnnouncement,
            value.announcementInterval,
            value.homeBoardPosts,
            value.unreadHomeBoardPostIds,
            value.hasUnreadHomeBoardPosts,
            value.adminLogs,
        ],
    );

    return (
        <AppUserSliceContext.Provider value={userSlice}>
            <AppRouteSliceContext.Provider value={routeSlice}>
                <AppGameStoreSliceContext.Provider value={gameStoreSlice}>
                    <AppUiSliceContext.Provider value={uiSlice}>
                        <AppRealtimeSliceContext.Provider value={realtimeSlice}>
                            {children}
                        </AppRealtimeSliceContext.Provider>
                    </AppUiSliceContext.Provider>
                </AppGameStoreSliceContext.Provider>
            </AppRouteSliceContext.Provider>
        </AppUserSliceContext.Provider>
    );
};
