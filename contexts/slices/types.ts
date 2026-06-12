import type { useApp } from '../../hooks/useApp.js';

export type AppContextValue = ReturnType<typeof useApp>;

export type AppUserSlice = Pick<
    AppContextValue,
    | 'currentUser'
    | 'currentUserWithStatus'
    | 'presets'
    | 'setCurrentUserAndRoute'
    | 'mainOptionBonuses'
    | 'combatSubOptionBonuses'
    | 'specialStatBonuses'
    | 'aggregatedMythicStats'
    | 'guilds'
    | 'unreadMailCount'
    | 'hasClaimableQuest'
    | 'hasClaimableExchangeSettlement'
    | 'hasClaimablePairPetTrainingOrHatchery'
    | 'updateTrigger'
    | 'singlePlayerStagesListRevision'
>;

export type AppRouteSlice = Pick<
    AppContextValue,
    | 'currentRoute'
    | 'isNarrowViewport'
    | 'isNativeMobile'
    | 'usePortraitFirstShell'
    | 'modalLayerUsesDesignPixels'
    | 'pcUniformScalePolicy'
    | 'isPhoneHandheldTouch'
    | 'isLargeTouchTablet'
    | 'showPcLikeMobileLayoutSetting'
    | 'settings'
    | 'updateSoundSetting'
    | 'updateFeatureSetting'
    | 'updatePanelColor'
    | 'updateTextColor'
    | 'updatePanelEdgeStyle'
    | 'updatePcLikeMobileLayout'
    | 'resetGraphicsToDefault'
    | 'arenaEntranceAvailability'
    | 'arenaEntranceFromServer'
>;

export type AppGameStoreSlice = Pick<
    AppContextValue,
    | 'activeGame'
    | 'liveGames'
    | 'singlePlayerGames'
    | 'towerGames'
    | 'gameRejoinFailure'
    | 'activeNegotiation'
    | 'negotiations'
    | 'towerRankingsRefetchTrigger'
    | 'gameModeAvailability'
    | 'kataServerRuntimeConfig'
    | 'championshipAbilityKataLadder'
>;

export type AppUiSlice = Pick<
    AppContextValue,
    'modals' | 'handlers' | 'enhancementOutcome' | 'enhancementResult' | 'showExitToast' | 'serverReconnectNotice' | 'connectionStatus' | 'error'
>;

export type AppRealtimeSlice = Pick<
    AppContextValue,
    | 'onlineUsers'
    | 'allUsers'
    | 'waitingRoomChats'
    | 'gameChats'
    | 'rankedMatchingQueue'
    | 'rankedMatchProposal'
    | 'rankedMatchFound'
    | 'pairRooms'
    | 'pairRoomChatByRoomId'
    | 'pairPartnerInvites'
    | 'pairInviteCooldownUntilByInviteeId'
    | 'announcements'
    | 'globalOverrideAnnouncement'
    | 'announcementInterval'
    | 'homeBoardPosts'
    | 'unreadHomeBoardPostIds'
    | 'hasUnreadHomeBoardPosts'
    | 'adminLogs'
>;
