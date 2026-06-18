import React from 'react';
import { useTranslation } from 'react-i18next';
import { replaceAppHash, APP_HOME_ARENA_HASH } from '../utils/appUtils.js';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../shared/constants/rankingModalScrollbar.js';

export type MobileRankingGuideVariant =
    | 'game-combat'
    | 'game-manner'
    | 'game-adventure'
    | 'baduk-strategic'
    | 'baduk-pair';

type ListSection = {
    title: string;
    ordered: boolean;
    items: string[];
};

type TextSection = {
    title: string;
    body: string;
};

type GuideSections = {
    how: ListSection | TextSection;
    where?: ListSection | TextSection | null;
    cta: string;
    hash: string;
};

function isListSection(s: ListSection | TextSection): s is ListSection {
    return 'items' in s && 'ordered' in s;
}

function renderSection(
    section: ListSection | TextSection,
    accent: 'amber' | 'sky',
    icon: string
) {
    const accentWrap =
        accent === 'amber'
            ? 'border-amber-500/25 bg-amber-950/50 text-amber-200/90'
            : 'border-sky-500/25 bg-sky-950/40 text-sky-200/90';

    return (
        <div className="flex gap-2.5">
            <span
                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${accentWrap}`}
            >
                {icon}
            </span>
            <div className="min-w-0">
                <p className="mb-1 text-sm font-semibold text-zinc-200">{section.title}</p>
                {isListSection(section) ? (
                    section.ordered ? (
                        <ol className="list-inside list-decimal space-y-1 text-sm leading-snug text-zinc-300">
                            {section.items.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ol>
                    ) : (
                        <ul className="list-inside list-disc space-y-1 text-sm leading-snug text-zinc-300">
                            {section.items.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ul>
                    )
                ) : (
                    <p className="text-sm leading-snug text-zinc-300">{section.body}</p>
                )}
            </div>
        </div>
    );
}

const MobileRankingGuidePanel: React.FC<{ variant: MobileRankingGuideVariant }> = ({ variant }) => {
    const { t } = useTranslation('lobby');

    const guide: Record<MobileRankingGuideVariant, GuideSections> = {
        'game-combat': {
            how: {
                title: t('rankingGuide.howToRaise'),
                ordered: true,
                items: t('rankingGuide.gameCombatItems', { returnObjects: true }) as string[],
            },
            where: null,
            cta: t('rankingGuide.goToArena'),
            hash: APP_HOME_ARENA_HASH,
        },
        'game-manner': {
            how: {
                title: t('rankingGuide.howToRaise'),
                ordered: false,
                items: t('rankingGuide.gameMannerItems', { returnObjects: true }) as string[],
            },
            where: {
                title: t('rankingGuide.whereScoresRise'),
                ordered: false,
                items: t('rankingGuide.gameMannerWhereItems', { returnObjects: true }) as string[],
            },
            cta: t('rankingGuide.goToArena'),
            hash: APP_HOME_ARENA_HASH,
        },
        'game-adventure': {
            how: {
                title: t('rankingGuide.howToRaise'),
                body: t('rankingGuide.gameAdventureHow'),
            },
            where: {
                title: t('rankingGuide.whereScoresRise'),
                body: t('rankingGuide.gameAdventureWhere'),
            },
            cta: t('rankingGuide.goToAdventure'),
            hash: '#/adventure',
        },
        'baduk-strategic': {
            how: {
                title: t('rankingGuide.howToRaise'),
                body: t('rankingGuide.badukStrategicHow'),
            },
            where: {
                title: t('rankingGuide.whereScoresRise'),
                body: t('rankingGuide.badukStrategicWhere'),
            },
            cta: t('rankingGuide.strategicLobby'),
            hash: '#/pvp/strategic',
        },
        'baduk-pair': {
            how: {
                title: t('rankingGuide.howToRaise'),
                body: t('rankingGuide.badukPairHow'),
            },
            where: {
                title: t('rankingGuide.whereScoresRise'),
                body: t('rankingGuide.badukPairWhere'),
            },
            cta: t('rankingGuide.pairLobby'),
            hash: '#/pvp/pair',
        },
    };

    const g = guide[variant];

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-950/90 to-neutral-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div
                className="pointer-events-none absolute inset-0 rounded-lg opacity-90"
                style={{
                    background:
                        'radial-gradient(120% 80% at 0% 0%, rgba(245, 158, 11, 0.14), transparent 50%), radial-gradient(100% 60% at 100% 100%, rgba(59, 130, 246, 0.08), transparent 45%)',
                }}
            />
            <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-2.5">
                <div className="flex items-center gap-2">
                    <div className="h-0.5 w-10 shrink-0 rounded-full bg-gradient-to-r from-amber-300 via-amber-500 to-amber-600/80" />
                    <span className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/90">{t('rankingGuide.heading')}</span>
                    <div className="h-px min-w-0 flex-1 bg-gradient-to-r from-amber-500/35 to-transparent" />
                </div>

                <div className={`min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                    {renderSection(g.how, 'amber', '↑')}
                    {g.where != null && renderSection(g.where, 'sky', '◎')}
                </div>

                <button
                    type="button"
                    onClick={() => replaceAppHash(g.hash)}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-gradient-to-r from-amber-900/50 via-amber-950/60 to-zinc-950/80 px-3 py-2 text-center text-sm font-semibold text-amber-100 shadow-sm transition hover:border-amber-400/50 hover:from-amber-800/55 hover:text-white active:scale-[0.98]"
                >
                    {g.cta}
                </button>
            </div>
        </div>
    );
};

export default MobileRankingGuidePanel;
