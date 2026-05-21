import React, { useMemo } from 'react';
import { GameMode } from '../types.js';
import { GAME_RULES } from '../gameRules.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';
import GuideModal from './GuideModal.js';
import type { GuideSelection } from './guide/GuidePanelLayout.js';
import type { HelpArticle, HelpBlock, HelpCategory } from '../shared/constants/helpCenterContent.js';

interface HelpModalProps {
    mode: GameMode | 'strategic' | 'playful' | 'guild' | 'guildBoss';
    onClose: () => void;
    isTopmost?: boolean;
}

function rulesToArticle(mode: GameMode, rules: { title: string; sections: { subtitle: string; content: string[] }[] }): {
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
        title: `${rules.title} 게임 방법`,
        article: {
            id: `help-mode-${mode}`,
            title: rules.title,
            tagline: '모드별 규칙 요약',
            hero: { src: gameModeImage, alt: rules.title },
            blocks,
        },
    };
}

const LOBBY_HELP: Record<'strategic' | 'playful' | 'guild' | 'guildBoss', GuideSelection & { categoryFilter: string[]; title: string }> = {
    strategic: {
        categoryId: 'lobby',
        subId: 'lobby-common',
        categoryFilter: ['lobby', 'modes'],
        title: '전략바둑 대기실 도움말',
    },
    playful: {
        categoryId: 'lobby',
        subId: 'lobby-common',
        categoryFilter: ['lobby', 'modes'],
        title: '놀이바둑 대기실 도움말',
    },
    guild: {
        categoryId: 'guild',
        subId: 'guild-overview',
        categoryFilter: ['guild'],
        title: '길드 도움말',
    },
    guildBoss: {
        categoryId: 'guild',
        subId: 'guild-boss',
        categoryFilter: ['guild'],
        title: '길드 보스전 도움말',
    },
};

/** 단일 게임 모드 규칙 — 동적 카테고리 1개만 표시 */
const DynamicModeHelpModal: React.FC<{
    mode: GameMode;
    onClose: () => void;
    isTopmost?: boolean;
}> = ({ mode, onClose, isTopmost }) => {
    const rules = GAME_RULES[mode];
    const built = useMemo(() => (rules ? rulesToArticle(mode, rules) : null), [mode, rules]);

    if (!built) {
        return (
            <GuideModal
                title="도움말"
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
            subcategories: [{ id: built.selection.subId, label: '게임 규칙', article: built.article }],
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
    if (mode === 'strategic' || mode === 'playful' || mode === 'guild' || mode === 'guildBoss') {
        const cfg = LOBBY_HELP[mode];
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
