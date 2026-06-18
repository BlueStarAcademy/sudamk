/** Supported UI locales (BCP 47). Add entries here + run `npm run i18n:sync`. */
export const SUPPORTED_LANGUAGES = [
    { code: 'ko', nativeName: '한국어', englishName: 'Korean', rtl: false },
    { code: 'en', nativeName: 'English', englishName: 'English', rtl: false },
    { code: 'ja', nativeName: '日本語', englishName: 'Japanese', rtl: false },
    { code: 'zh-CN', nativeName: '简体中文', englishName: 'Chinese (Simplified)', rtl: false },
    { code: 'zh-TW', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', rtl: false },
    { code: 'es', nativeName: 'Español', englishName: 'Spanish', rtl: false },
    { code: 'fr', nativeName: 'Français', englishName: 'French', rtl: false },
    { code: 'de', nativeName: 'Deutsch', englishName: 'German', rtl: false },
    { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', rtl: false },
    { code: 'ru', nativeName: 'Русский', englishName: 'Russian', rtl: false },
    { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', rtl: false },
    { code: 'th', nativeName: 'ไทย', englishName: 'Thai', rtl: false },
    { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', rtl: false },
    { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', rtl: true },
    { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', rtl: false },
    { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', rtl: false },
    { code: 'it', nativeName: 'Italiano', englishName: 'Italian', rtl: false },
    { code: 'pl', nativeName: 'Polski', englishName: 'Polish', rtl: false },
    { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', rtl: false },
    { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', rtl: false },
    { code: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', rtl: false },
    { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish', rtl: false },
    { code: 'cs', nativeName: 'Čeština', englishName: 'Czech', rtl: false },
    { code: 'ro', nativeName: 'Română', englishName: 'Romanian', rtl: false },
    { code: 'he', nativeName: 'עברית', englishName: 'Hebrew', rtl: true },
    { code: 'fil', nativeName: 'Filipino', englishName: 'Filipino', rtl: false },
] as const;

export type AppLocale = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const APP_LOCALES = SUPPORTED_LANGUAGES.map((l) => l.code) as AppLocale[];

export const DEFAULT_LOCALE: AppLocale = 'ko';

export const FALLBACK_LOCALE: AppLocale = 'en';

export const LOCALE_NATIVE_LABELS: Record<AppLocale, string> = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((l) => [l.code, l.nativeName]),
) as Record<AppLocale, string>;

export const RTL_LOCALES = new Set<AppLocale>(
    SUPPORTED_LANGUAGES.filter((l) => l.rtl).map((l) => l.code as AppLocale),
);

/** Map browser language tags to the closest supported locale. */
const BROWSER_LOCALE_MAP: Record<string, AppLocale> = {
    ko: 'ko',
    en: 'en',
    ja: 'ja',
    zh: 'zh-CN',
    'zh-cn': 'zh-CN',
    'zh-tw': 'zh-TW',
    'zh-hk': 'zh-TW',
    es: 'es',
    fr: 'fr',
    de: 'de',
    pt: 'pt',
    ru: 'ru',
    vi: 'vi',
    th: 'th',
    id: 'id',
    ar: 'ar',
    hi: 'hi',
    tr: 'tr',
    it: 'it',
    pl: 'pl',
    nl: 'nl',
    ms: 'ms',
    uk: 'uk',
    sv: 'sv',
    cs: 'cs',
    ro: 'ro',
    he: 'he',
    fil: 'fil',
    tl: 'fil',
};

export function isAppLocale(value: unknown): value is AppLocale {
    return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

export function detectBrowserLocale(): AppLocale {
    if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
    const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean) as string[];
    for (const raw of candidates) {
        const tag = raw.toLowerCase();
        if (BROWSER_LOCALE_MAP[tag]) return BROWSER_LOCALE_MAP[tag];
        const base = tag.split('-')[0];
        if (BROWSER_LOCALE_MAP[base]) return BROWSER_LOCALE_MAP[base];
    }
    return FALLBACK_LOCALE;
}

export function getLanguageMeta(locale: AppLocale) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === locale);
}
