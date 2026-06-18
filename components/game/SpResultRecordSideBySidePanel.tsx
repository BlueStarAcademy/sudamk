import React from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import Avatar from '../Avatar.js';
import { StrategyXpResultBar } from './StrategyXpResultBar.js';
import PairPetLevelUpCoreDelta from '../pair/PairPetLevelUpCoreDelta.js';
import { RESULT_MODAL_SCORE_MOBILE_PX } from './resultModalScoreTypography.js';
import {
    ResultModalIdentityRow,
    ResultModalPetPortrait,
    resolveResultModalPortraitPx,
} from './ResultModalIdentityRow.js';
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
    const statPx = isMobile
        ? `${RESULT_MODAL_SCORE_MOBILE_PX.dataRow * mobileTextScale}px`
        : '13px';
    const barH = isMobile ? 'h-2' : 'h-2.5';
    const portraitPx = resolveResultModalPortraitPx(isMobile, mobileTextScale, isMobile ? 1 : 1);

    const renderXpNumbers = (current: number, max: number, gain: number, gainClass: string, suffix: string) => (
        <div
            className="flex min-w-0 flex-nowrap items-center justify-between gap-1"
            style={{ fontSize: statPx }}
        >
            <span className="min-w-0 shrink truncate font-mono text-zinc-100">
                {current.toLocaleString()} / {max.toLocaleString()} {suffix}
            </span>
            {gain > 0 ? (
                <span className={`shrink-0 whitespace-nowrap font-semibold ${gainClass}`}>
                    +{gain.toLocaleString()} {suffix}
                </span>
            ) : null}
        </div>
    );

    const showPetSection =
        (showPetGradeUpgradeInsteadOfXp && displaySummary?.pairPetLevel && displaySummary?.pairPetXp) ||
        (petXpBarPercents && displaySummary?.pairPetLevel && petRecordRowIdentity);

    const alignXpColumns = Boolean(showPetSection);

    return (
        <div className="flex flex-col gap-1.5">
            {displaySummary?.xp ? (
                <div className={`${INSET} p-1.5 sm:p-2`}>
                    <ResultModalIdentityRow
                        variant="flat"
                        displayName={currentUser.nickname}
                        level={currentUser.userLevel}
                        hideLevelLine
                        portrait={
                            <Avatar
                                userId={currentUser.id}
                                userName={currentUser.nickname}
                                avatarUrl={avatarUrl}
                                borderUrl={borderUrl}
                                size={portraitPx}
                            />
                        }
                        xpAside={
                            <div className="min-w-0 space-y-0.5">
                                <StrategyXpResultBar
                                    previousXpPercent={previousXpPercent}
                                    finalXpPercent={xpPercent}
                                    xpGain={xpChange}
                                    className={barH}
                                />
                                {renderXpNumbers(clampedXp, xpRequirement, xpChange, 'text-green-400', 'XP')}
                            </div>
                        }
                        xpColumnReserved={alignXpColumns}
                        isMobile={isMobile}
                        mobileTextScale={mobileTextScale}
                    />
                </div>
            ) : null}

            {showPetGradeUpgradeInsteadOfXp && displaySummary?.pairPetLevel && displaySummary?.pairPetXp && petRecordRowIdentity ? (
                <div className={`${INSET} p-1.5 sm:p-2`}>
                    <ResultModalIdentityRow
                        variant="flat"
                        tone="pet"
                        displayName={petRecordRowIdentity.displayName}
                        level={displaySummary.pairPetLevel.final}
                        hideLevelLine
                        portrait={
                            <ResultModalPetPortrait
                                imageSrc={petRecordRowIdentity.imageSrc}
                                sizePx={portraitPx}
                                alt={petRecordRowIdentity.displayName}
                            />
                        }
                        xpAside={
                            <p
                                className="text-center font-bold uppercase tracking-[0.1em] text-fuchsia-100"
                                style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '12px' }}
                            >
                                {tx("game:resultModal.petGradeUpgradeNeeded")}
                            </p>
                        }
                        xpColumnReserved={alignXpColumns}
                        isMobile={isMobile}
                        mobileTextScale={mobileTextScale}
                    />
                </div>
            ) : petXpBarPercents && displaySummary?.pairPetLevel && petRecordRowIdentity ? (
                <>
                    <div className={`${INSET} p-1.5 sm:p-2`}>
                        <ResultModalIdentityRow
                            variant="flat"
                            tone="pet"
                            displayName={petRecordRowIdentity.displayName}
                            level={displaySummary.pairPetLevel.final}
                            hideLevelLine
                            portrait={
                                <ResultModalPetPortrait
                                    imageSrc={petRecordRowIdentity.imageSrc}
                                    sizePx={portraitPx}
                                    alt={petRecordRowIdentity.displayName}
                                />
                            }
                            xpAside={
                                <div className="min-w-0 space-y-0.5">
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
                                        tx('game:resultModal.petXpLabel'),' XP').replace(/\d+/g,'').trim() || tx('game:resultModal.petShort') + ' XP',
                                    )}
                                </div>
                            }
                            xpColumnReserved={alignXpColumns}
                            isMobile={isMobile}
                            mobileTextScale={mobileTextScale}
                        />
                    </div>
                    {displaySummary.pairPetLevelUpCoreBonuses ? (
                        <PairPetLevelUpCoreDelta
                            delta={displaySummary.pairPetLevelUpCoreBonuses}
                            title={tx("game:summary.addedStats")}
                            compact
                        />
                    ) : null}
                </>
            ) : null}
        </div>
    );
};

export default SpResultRecordSideBySidePanel;
