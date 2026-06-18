export { default as i18n } from './config.js';
export {
    APP_LOCALES,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    LOCALE_NATIVE_LABELS,
    RTL_LOCALES,
    SUPPORTED_LANGUAGES,
    SETTINGS_STORAGE_KEY,
} from './constants.js';
export type { AppLocale } from './languages.js';
export {
    detectBrowserLocale,
    isAppLocale,
    readStoredLocale,
    resolveInitialLocale,
    applyDocumentLocale,
} from './config.js';
export { I18N_NAMESPACES } from './loadResources.js';
export type { I18nNamespace } from './loadResources.js';
export {
    translateGameMode,
    translateQuickUtilityPanel,
    useLocalizedGameMode,
    useLocalizedQuickUtilityPanel,
} from './localizedCatalog.js';
