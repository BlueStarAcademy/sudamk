/** App settings localStorage key — shared between settings state and i18n bootstrap. */
export const SETTINGS_STORAGE_KEY = 'appSettings_v2';

export {
    APP_LOCALES,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    LOCALE_NATIVE_LABELS,
    RTL_LOCALES,
    SUPPORTED_LANGUAGES,
    detectBrowserLocale,
    getLanguageMeta,
    isAppLocale,
} from './languages.js';

export type { AppLocale } from './languages.js';
