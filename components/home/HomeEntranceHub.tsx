import React from 'react';
import { useTranslation } from 'react-i18next';
import HomeEntranceCard, {
    type HomeEntranceGuildCtas,
    type HomeEntranceGuildInfo,
} from './HomeEntranceCard.js';
import { WaitingLobbyAnnouncementBoard } from '../waiting-room/WaitingLobbyAnnouncementBoard.js';
import PetOnboardingHomeBanner from './PetOnboardingHomeBanner.js';
import {
    HOME_ENTRANCE_SECTIONS,
    type HomeEntranceCardId,
    type HomeEntranceSectionDef,
    type HomeEntranceSectionId,
} from './homeEntranceSections.js';

export type HomeEntranceHandlers = Record<HomeEntranceCardId, () => void>;

export type HomeEntranceCardState = Partial<
    Record<
        HomeEntranceCardId,
        {
            /** @deprecated use infoLines */
            meta?: string;
            infoLines?: string[];
            footerLeft?: string;
            footerRight?: string;
            tierIcon?: string;
            scoreText?: string;
            progressPercent?: number;
            progressLabel?: string;
            guild?: HomeEntranceGuildInfo | null;
            guildCtas?: HomeEntranceGuildCtas;
            locked?: boolean;
            lockReason?: string;
            badge?: boolean;
            /** true면 섹션 metaKey blurb를 숨김 */
            hideBlurb?: boolean;
        }
    >
>;

const SECTION_RULE: Record<HomeEntranceSectionId, string> = {
    compete: 'via-amber-300/35',
    growth: 'via-emerald-300/35',
    casual: 'via-cyan-300/35',
    social: 'via-indigo-300/35',
};

export type HomeEntranceHubProps = {
    handlers: HomeEntranceHandlers;
    cardState?: HomeEntranceCardState;
    className?: string;
    showAnnouncementBoard?: boolean;
};

const HomeEntranceHub: React.FC<HomeEntranceHubProps> = ({
    handlers,
    cardState,
    className,
    showAnnouncementBoard = false,
}) => {
    const { t } = useTranslation('profile');

    const renderSection = (section: HomeEntranceSectionDef, index: number) => (
        <section key={section.id} className="min-w-0 shrink-0" aria-label={section.id}>
            {index > 0 ? (
                <div
                    className={`mb-3 h-px bg-gradient-to-r from-transparent ${SECTION_RULE[section.id]} to-transparent`}
                    aria-hidden
                />
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
                {section.cards.map((card) => {
                    const state = cardState?.[card.id];
                    const blurb =
                        !state?.hideBlurb && card.metaKey ? t(card.metaKey) : undefined;
                    const resolvedLines = state?.infoLines
                        ? state.infoLines
                        : [state?.meta, blurb].filter(
                              (line, i, arr): line is string => !!line && arr.indexOf(line) === i,
                          );

                    return (
                        <HomeEntranceCard
                            key={card.id}
                            title={t(card.titleKey)}
                            infoLines={resolvedLines.length ? resolvedLines : undefined}
                            footerLeft={state?.footerLeft}
                            footerRight={state?.footerRight}
                            tierIcon={state?.tierIcon}
                            scoreText={state?.scoreText}
                            progressPercent={state?.progressPercent}
                            progressLabel={state?.progressLabel}
                            guild={state?.guild}
                            guildCtas={state?.guildCtas}
                            imageSrc={card.imageSrc}
                            accent={card.accent}
                            locked={state?.locked}
                            lockReason={state?.lockReason}
                            badge={state?.badge}
                            className={card.alignEnd ? 'sm:col-start-3' : undefined}
                            onEnter={handlers[card.id]}
                        />
                    );
                })}
            </div>
        </section>
    );

    return (
        <div
            className={`flex h-full min-h-0 w-full flex-col overflow-hidden px-0.5 pt-0.5 ${className ?? ''}`}
        >
            {showAnnouncementBoard ? (
                <div className="shrink-0 pb-1.5 pt-0.5">
                    <WaitingLobbyAnnouncementBoard mode="home" />
                </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-y-contain pb-2 [scrollbar-gutter:stable] sm:gap-4">
                <PetOnboardingHomeBanner />
                {HOME_ENTRANCE_SECTIONS.map((section, index) => renderSection(section, index))}
            </div>
        </div>
    );
};

export default HomeEntranceHub;
