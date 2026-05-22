import React from 'react';
import Avatar from '../Avatar.js';
import { StrategyXpResultBar } from './StrategyXpResultBar.js';
import PairPetLevelUpCoreDelta from '../pair/PairPetLevelUpCoreDelta.js';
import { RESULT_MODAL_SCORE_MOBILE_PX } from './resultModalScoreTypography.js';
import type { GameSummary } from '../../types.js';

const INSET =
    'rounded-lg border border-amber-500/15 bg-black/35 ring-1 ring-inset ring-white/[0.05]';

export type SpResultRecordPetIdentity = {
    imageSrc: string | null;
    displayName: string;
};

export type SpResultRecordPetXpPercents = {
    previous: number;
    final: number;
    gain: number;
    petMax: number;
    petFinal: number;
};

export type SpResultRecordSideBySidePanelProps = {
    currentUser: { id: string; nickname: string; userLevel: number };
    avatarUrl: string;
    borderUrl: string;
    displaySummary: Pick<GameSummary, 'xp' | 'pairPetLevel' | 'pairPetXp' | 'pairPetLevelUpCoreBonuses'> | null | undefined;
    previousXpPercent: number;
    xpPercent: number;
    xpChange: number;
    clampedXp: number;
    xpRequirement: number;
    petRecordRowIdentity: SpResultRecordPetIdentity | null;
    petXpBarPercents: SpResultRecordPetXpPercents | null;
    showPetGradeUpgradeInsteadOfXp: boolean;
    isMobile: boolean;
    mobileTextScale: number;
};

const profileColClass = 'flex w-[3.25rem] shrink-0 flex-col items-center gap-0.5 sm:w-14 min-[1024px]:w-[3.75rem]';
const xpColClass = 'min-w-0 flex-1 space-y-0.5';

const SpResultRecordSideBySidePanel: React.FC<SpResultRecordSideBySidePanelProps> = ({
    currentUser,
    avatarUrl,
    borderUrl,
    displaySummary,
    previousXpPercent,
    xpPercent,
    xpChange,
    clampedXp,
    xpRequirement,
    petRecordRowIdentity,
    petXpBarPercents,
    showPetGradeUpgradeInsteadOfXp,
    isMobile,
    mobileTextScale,
}) => {
    const namePx = isMobile ? `${11 * mobileTextScale}px` : '14px';
    const subPx = isMobile
        ? `${RESULT_MODAL_SCORE_MOBILE_PX.emptyState * mobileTextScale}px`
        : '12px';
    const statPx = isMobile
        ? `${RESULT_MODAL_SCORE_MOBILE_PX.emptyState * mobileTextScale}px`
        : '12px';
    const barH = isMobile ? 'h-2' : 'h-2.5';
    const avatarSize = isMobile ? 28 : 34;
    const petImgClass = isMobile ? 'h-7 w-7' : 'h-9 w-9 min-[1024px]:h-10 min-[1024px]:w-10';

    const renderUserProfile = () => (
        <div className={profileColClass}>
            <Avatar
                userId={currentUser.id}
                userName={currentUser.nickname}
                avatarUrl={avatarUrl}
                borderUrl={borderUrl}
                size={avatarSize}
            />
            <p
                className="w-full truncate text-center font-bold leading-tight text-zinc-100"
                style={{ fontSize: namePx }}
                title={currentUser.nickname}
            >
                {currentUser.nickname}
            </p>
            <p className="leading-none text-amber-200/60" style={{ fontSize: subPx }}>
                Lv.{currentUser.userLevel}
            </p>
        </div>
    );

    const renderPetProfile = () => {
        if (!petRecordRowIdentity) return null;
        return (
            <div className={profileColClass}>
                <div
                    className={`relative shrink-0 overflow-hidden rounded-lg border border-fuchsia-500/30 bg-black/40 ring-1 ring-inset ring-fuchsia-400/12 ${petImgClass}`}
                >
                    {petRecordRowIdentity.imageSrc ? (
                        <img
                            src={petRecordRowIdentity.imageSrc}
                            alt={petRecordRowIdentity.displayName}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-fuchsia-200/50">
                            펫
                        </div>
                    )}
                </div>
                <p
                    className="w-full truncate text-center font-bold leading-tight text-fuchsia-100"
                    style={{ fontSize: namePx }}
                    title={petRecordRowIdentity.displayName}
                >
                    {petRecordRowIdentity.displayName}
                </p>
                {displaySummary?.pairPetLevel ? (
                    <p className="leading-none text-fuchsia-200/70" style={{ fontSize: subPx }}>
                        Lv.{displaySummary.pairPetLevel.final}
                    </p>
                ) : null}
            </div>
        );
    };

    const renderXpNumbers = (current: number, max: number, gain: number, gainClass: string, suffix: string) => (
        <div
            className="flex min-w-0 flex-nowrap items-center justify-between gap-1"
            style={{ fontSize: statPx }}
        >
            <span className="min-w-0 shrink truncate font-mono text-zinc-300/95">
                {current.toLocaleString()} / {max.toLocaleString()} {suffix}
            </span>
            {gain > 0 ? (
                <span className={`shrink-0 whitespace-nowrap font-semibold ${gainClass}`}>
                    +{gain.toLocaleString()} {suffix}
                </span>
            ) : null}
        </div>
    );

    return (
        <div className="flex flex-col gap-1 sm:gap-1.5">
            {displaySummary?.xp ? (
                <div className={`flex items-center gap-1.5 ${INSET} p-1.5 sm:p-2`}>
                    {renderUserProfile()}
                    <div className={xpColClass}>
                        <StrategyXpResultBar
                            previousXpPercent={previousXpPercent}
                            finalXpPercent={xpPercent}
                            xpGain={xpChange}
                            className={barH}
                        />
                        {renderXpNumbers(clampedXp, xpRequirement, xpChange, 'text-green-400', 'XP')}
                    </div>
                </div>
            ) : null}

            {showPetGradeUpgradeInsteadOfXp && displaySummary?.pairPetLevel && displaySummary?.pairPetXp ? (
                <div className={`flex items-center gap-1.5 ${INSET} p-1.5 sm:p-2`}>
                    {renderPetProfile()}
                    <div className={`${xpColClass} flex items-center justify-center py-0.5`}>
                        <p
                            className="text-center font-bold uppercase tracking-[0.1em] text-fuchsia-200/90"
                            style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '11px' }}
                        >
                            펫 등급강화 필요
                        </p>
                    </div>
                </div>
            ) : petXpBarPercents && displaySummary?.pairPetLevel ? (
                <>
                    <div className={`flex items-center gap-1.5 ${INSET} p-1.5 sm:p-2`}>
                        {renderPetProfile()}
                        <div className={xpColClass}>
                            <StrategyXpResultBar
                                previousXpPercent={petXpBarPercents.previous}
                                finalXpPercent={petXpBarPercents.final}
                                xpGain={petXpBarPercents.gain}
                                className={barH}
                            />
                            {renderXpNumbers(
                                petXpBarPercents.petFinal,
                                petXpBarPercents.petMax,
                                petXpBarPercents.gain,
                                'text-fuchsia-300',
                                '펫 XP',
                            )}
                        </div>
                    </div>
                    {displaySummary.pairPetLevelUpCoreBonuses ? (
                        <PairPetLevelUpCoreDelta
                            delta={displaySummary.pairPetLevelUpCoreBonuses}
                            title="추가된 능력치"
                            compact
                        />
                    ) : null}
                </>
            ) : null}
        </div>
    );
};

export default SpResultRecordSideBySidePanel;
