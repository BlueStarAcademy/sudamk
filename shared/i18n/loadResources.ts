import type { Resource } from 'i18next';
import ar from './locales/ar.json';
import cs from './locales/cs.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
import he from './locales/he.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ms from './locales/ms.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';
import sv from './locales/sv.json';
import th from './locales/th.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';

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

const LOCALE_BUNDLES: Record<string, Record<string, unknown>> = {
    ar,
    cs,
    de,
    en,
    es,
    fil,
    fr,
    he,
    hi,
    id,
    it,
    ja,
    ko,
    ms,
    nl,
    pl,
    pt,
    ro,
    ru,
    sv,
    th,
    tr,
    uk,
    vi,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
};

export function buildI18nResources(): Resource {
    const resources: Resource = {};

    for (const [locale, bundle] of Object.entries(LOCALE_BUNDLES)) {
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
