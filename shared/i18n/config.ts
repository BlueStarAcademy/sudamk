import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
    APP_LOCALES,
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    RTL_LOCALES,
    detectBrowserLocale,
    isAppLocale,
} from './languages.js';
import { SETTINGS_STORAGE_KEY } from './constants.js';
import { buildI18nResources, I18N_NAMESPACES } from './loadResources.js';

export { isAppLocale, detectBrowserLocale };

export function readStoredLocale() {
    if (typeof localStorage === 'undefined') return null;
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as { graphics?: { locale?: unknown } };
        const locale = parsed.graphics?.locale;
        return isAppLocale(locale) ? locale : null;
    } catch {
        return null;
    }
}

export function resolveInitialLocale() {
    return readStoredLocale() ?? detectBrowserLocale();
}

export function applyDocumentLocale(locale: string) {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.has(locale as never) ? 'rtl' : 'ltr';
}

void i18n.use(initReactI18next).init({
    resources: buildI18nResources(),
    lng: resolveInitialLocale(),
    react: {
        useSuspense: false,
        bindI18n: 'languageChanged',
        bindI18nStore: 'added removed',
    },
    fallbackLng: {
        default: [DEFAULT_LOCALE, FALLBACK_LOCALE],
        en: [FALLBACK_LOCALE, DEFAULT_LOCALE],
        'zh-TW': ['zh-CN', DEFAULT_LOCALE, FALLBACK_LOCALE],
        fil: [FALLBACK_LOCALE, DEFAULT_LOCALE],
    },
    supportedLngs: [...APP_LOCALES],
    ns: [...I18N_NAMESPACES],
    defaultNS: 'common',
    fallbackNS: ['common', 'settings', 'game', 'nav'],
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
});

applyDocumentLocale(resolveInitialLocale());

export default i18n;
