import { useTranslation } from 'react-i18next';

/**
 * Subscribe to language changes in components that call `tx()` / `i18n.t()` in render
 * without using translated strings from the returned `t` function.
 */
export function useI18nLanguage(ns?: string | string[]) {
    return useTranslation(ns);
}
