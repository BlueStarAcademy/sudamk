import type { Resource } from 'i18next';

/** Namespaces loaded from each locale bundle JSON top-level key. */
export const I18N_NAMESPACES = [
    'common',
    'nav',
    'auth',
    'footer',
    'gameModes',
    'game',
    'settings',
    'lobby',
    'profile',
    'shop',
    'mail',
    'quests',
    'inventory',
    'exchange',
    'tournament',
    'tower',
    'pair',
    'blacksmith',
    'negotiation',
    'championshipVersus',
    'guild',
    'mailReward',
    'legal',
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

const localeModules = import.meta.glob('./locales/*.json', { eager: true, import: 'default' });

export function buildI18nResources(): Resource {
    const resources: Resource = {};

    for (const [path, mod] of Object.entries(localeModules)) {
        const match = path.match(/\/([^/]+)\.json$/);
        const locale = match?.[1];
        if (!locale) continue;

        const bundle = mod as Record<string, unknown>;
        resources[locale] = {};

        for (const ns of I18N_NAMESPACES) {
            const chunk = bundle[ns];
            if (chunk && typeof chunk === 'object') {
                resources[locale]![ns] = chunk as Record<string, unknown>;
            }
        }
    }

    return resources;
}
