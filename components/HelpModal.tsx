import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import { GameMode } from '../types.js';
import { GAME_RULES } from '../gameRules.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';
import GuideModal from './GuideModal.js';
import type { GuideSelection } from './guide/GuidePanelLayout.js';
import type { HelpArticle, HelpBlock, HelpCategory } from '../shared/constants/helpCenterContent.js';
import type { TFunction } from 'i18next';

interface HelpModalProps {
    mode: GameMode | 'strategic' | 'playful' | 'guild' | 'guildBoss';
    onClose: () => void;
    isTopmost?: boolean;
}

function rulesToArticle(
    t: TFunction<'common'>,
    mode: GameMode,
    rules: { title: string; sections: { subtitle: string; content: string[] }[] },
): {
    selection: GuideSelection;
    categoryFilter: string[];
    title: string;
    article: HelpArticle;
} {
    const gameModeImage =
        SPECIAL_GAME_MODES.find((gm) => gm.mode === mode)?.image ||
        PLAYFUL_GAME_MODES.find((gm) => gm.mode === mode)?.image ||
        '/images/simbols/simbol1.webp';

    const blocks: HelpBlock[] = rules.sections.flatMap((section, index) => {
        const items: HelpBlock[] = [{ type: 'heading', text: section.subtitle, level: 3 }];
        if (index === 0) {
            items.push({
                type: 'figure',
                src: gameModeImage,
                alt: rules.title,
                caption: rules.title,
            });
        }
        items.push({ type: 'bullets', items: section.content });
        return items;
    });

    return {
        selection: { categoryId: `help-mode-${mode}`, subId: `help-mode-${mode}` },
        categoryFilter: [`help-mode-${mode}`],
        title: t('help.modeHowTo', { mode: rules.title }),
        article: {
            id: `help-mode-${mode}`,
            title: rules.title,
            tagline: t('help.modeRulesSummary'),
            hero: { src: gameModeImage, alt: rules.title },
            blocks,
        },
    };
}

function lobbyHelpConfig(t: TFunction<'common'>): Record<
    'strategic' | 'playful' | 'guild' | 'guildBoss',
    GuideSelection & { categoryFilter: string[]; title: string }
> {
    return {
        strategic: {
            categoryId: 'lobby',
            subId: 'lobby-common',
            categoryFilter: ['lobby', 'pvp-live', 'modes'],
            title: t('help.strategicLobby'),
        },
        playful: {
            categoryId: 'lobby',
            subId: 'lobby-common',
            categoryFilter: ['lobby', 'pvp-live', 'modes'],
            title: t('help.playfulLobby'),
        },
        guild: {
            categoryId: 'guild',
            subId: 'guild-overview',
            categoryFilter: ['guild'],
            title: t('help.guild'),
        },
        guildBoss: {
            categoryId: 'guild',
            subId: 'guild-boss',
            categoryFilter: ['guild'],
            title: t('help.guildBoss'),
        },
    };
}

/** 단일 게임 모드 규칙 — 동적 카테고리 1개만 표시 */
const DynamicModeHelpModal: React.FC<{
    mode: GameMode;
    onClose: () => void;
    isTopmost?: boolean;
}> = ({ mode, onClose, isTopmost }) => {
    const { t } = useTranslation('common');
    const rules = GAME_RULES[mode];
    const built = useMemo(() => (rules ? rulesToArticle(t, mode, rules) : null), [mode, rules, t]);

    if (!built) {
        return (
            <GuideModal
                title={t('help.title')}
                windowId={`help-${mode}`}
                onClose={onClose}
                isTopmost={isTopmost}
                initialSelection={{ categoryId: 'start', subId: 'start-home' }}
            />
        );
    }

    const extraCategories: HelpCategory[] = [
        {
            id: built.selection.categoryId,
            label: built.article.title,
            iconSrc: built.article.hero?.src,
            subcategories: [{ id: built.selection.subId, label: t('help.gameRules'), article: built.article }],
        },
    ];

    return (
        <GuideModal
            title={built.title}
            windowId={`help-${mode}`}
            onClose={onClose}
            isTopmost={isTopmost}
            initialSelection={built.selection}
            categoryFilter={built.categoryFilter}
            extraCategories={extraCategories}
        />
    );
};

const HelpModal: React.FC<HelpModalProps> = ({ mode, onClose, isTopmost }) => {
    const { t } = useTranslation('common');
    if (mode === 'strategic' || mode === 'playful' || mode === 'guild' || mode === 'guildBoss') {
        const cfg = lobbyHelpConfig(t)[mode];
        return (
            <GuideModal
                title={cfg.title}
                windowId={`help-${mode}`}
                onClose={onClose}
                isTopmost={isTopmost}
                initialSelection={{ categoryId: cfg.categoryId, subId: cfg.subId }}
                categoryFilter={cfg.categoryFilter}
            />
        );
    }

    return <DynamicModeHelpModal mode={mode} onClose={onClose} isTopmost={isTopmost} />;
};

export default HelpModal;
