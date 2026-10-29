// Compatibility re-export — canonical AppRoute lives in shared/types/navigation.
export {
    type AppRoute,
    parseHash,
    getAppRouteNavigationKey,
    APP_HOME_HASH,
    APP_HOME_ARENA_HASH,
    APP_HOME_RANKING_HASH,
    LEGACY_APP_HOME_HASH,
    isAppHomeHash,
    normalizeLegacyAppHash,
    normalizeLegacyHomeHash,
    type LegacyWaitingMode,
} from '../shared/types/navigation.js';
