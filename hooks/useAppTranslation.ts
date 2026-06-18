import { useTranslation } from 'react-i18next';
import type { I18nNamespace } from '../shared/i18n/loadResources.js';

/** Preferred hook for UI copy — defaults to common + settings namespaces. */
export function useAppTranslation(namespaces?: I18nNamespace | I18nNamespace[]) {
    const ns = namespaces ?? (['common', 'settings'] as I18nNamespace[]);
    return useTranslation(ns);
}

export { useTranslation } from 'react-i18next';
