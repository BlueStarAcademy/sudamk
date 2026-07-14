import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, UserWithStatus, ServerAction, Player, AnalysisResult } from '../types.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants/ui.js';
import { AvatarInfo, BorderInfo } from '../types.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants/items.js';
import { ScoringOverlay } from './game/ScoringOverlay.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import {
    PRE_GAME_MODAL_ACCENT_BTN_CLASS,
    PRE_GAME_MODAL_LAYER_CLASS,
} from './game/PreGameDescriptionLayout.js';
import { StrategyXpResultBar } from './game/StrategyXpResultBar.js';
import { getTowerSessionFloor, isTowerHumanWinnerFromSession } from '../utils/towerPreGameDisplay.js';
import { formatScoreDetailNumber, hasRenderableScoreDetails } from '../shared/utils/scoreDetailsGuards.js';
import { GoStoneIcon } from './game/arenaRoundEndShared.js';
import { ResultModalXpRewardBadge, ResultModalPetGradeUpgradeNeededSlot } from './game/ResultModalXpRewardBadge.js';
import {
    ResultModalGoldCurrencySlot,
    ResultModalItemRewardSlot,
    RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';
import PairPetLevelUpCoreDelta from './pair/PairPetLevelUpCoreDelta.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../shared/constants/petLobby.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { effectivePairPetGradeFromRow, pairPetShowsGradeUpgradeNeededInsteadOfXp } from '../shared/constants/pairPetGrade.js';
import { RESULT_MODAL_SCORE_MOBILE_PX } from './game/resultModalScoreTypography.js';
import SpResultRecordPetIdentityRow from './game/SpResultRecordPetIdentityRow.js';
import { useGameResultModalLayout } from './game/useGameResultModalLayout.js';
import GameResultModalFitContent from './game/GameResultModalFitContent.js';
import ResultAdGoldDoubleButton from './game/ResultAdGoldDoubleButton.js';

interface TowerSummaryModalProps {
    session: LiveGameSession;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    onClose: () => void;
}

const handleClose = (session: LiveGameSession, onClose: () => void) => {
    // 확인 버튼: 모달만 닫기 (로비로 이동하지 않음)
    onClose();
};

/** SinglePlayer/GameSummary와 통일된 결과 모달 톤 */
const SP_SUMMARY_PANEL_CLASS =
    'relative overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] shadow-[0_14px_44px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-400/12';
const SP_SUMMARY_INSET_CLASS =
    'rounded-lg border border-amber-500/15 bg-black/35 ring-1 ring-inset ring-white/[0.05]';
const SP_SUMMARY_SECTION_LABEL =
    'text-[0.75rem] font-bold uppercase tracking-[0.12em] text-amber-100 sm:text-xs min-[1024px]:text-sm';

const RewardItemDisplay: React.FC<{ item: any; isMobile: boolean }> = ({ item, isMobile }) => (
    <div
        className="flex flex-col items-center justify-center text-center p-1 bg-gray-900/50 rounded-md"
        title={item.name}
    >
        <img
            src={item.image}
            alt={item.name}
            className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} object-contain`}
        />
        <span className="text-xs mt-1 text-gray-300 truncate w-full">
            {item.name}
            {item.quantity > 1 ? ` x${item.quantity}` : ''}
        </span>
    </div>
);

const getXpRequirementForLevel = (level: number): number => {
    if (level < 1) return 0;
    if (level > 100) return Infinity; // Max level
    
    // 레벨 1~10: 200 + (레벨 x 100)
    if (level <= 10) {
        return 200 + (level * 100);
    }
    
    // 레벨 11~20: 300 + (레벨 x 150)
    if (level <= 20) {
        return 300 + (level * 150);
    }
    
    // 레벨 21~50: 이전 필요경험치 x 1.2
    // 레벨 51~100: 이전 필요경험치 x 1.3
    // 레벨 20의 필요 경험치를 먼저 계산
    let xp = 300 + (20 * 150); // 레벨 20의 필요 경험치
    
    // 레벨 21부터 현재 레벨까지 반복
    for (let l = 21; l <= level; l++) {
        if (l <= 50) {
            xp = Math.round(xp * 1.2);
        } else {
            xp = Math.round(xp * 1.3);
        }
    }
    
    return xp;
};

// 계가 결과 표시 컴포넌트 (SinglePlayerSummaryModal에서 가져옴)
const ScoreDetailsComponent: React.FC<{
    analysis: AnalysisResult;
    session: LiveGameSession;
    isMobile?: boolean;
    mobileTextScale?: number;
    desktopTextScale?: number;
    /** 모바일에서 흑·백을 가로 2열로(도전의 탑 등) */
    compactSideBySideMobile?: boolean;
}> = ({ analysis, isMobile = false, mobileTextScale = 1, desktopTextScale = 1, compactSideBySideMobile = false }) => {
    const { t } = useTranslation('game');
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;

    if (!hasRenderableScoreDetails(analysis)) {
        return <p className={`text-center text-zinc-500 ${isMobile ? 'text-sm' : ''}`} style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}>{t('summary.noScoreInfo')}</p>;
    }
    const scoreDetails = analysis.scoreDetails!;

    const narrow2col = Boolean(isMobile && compactSideBySideMobile);
    const rowFs = `${(isMobile ? mx.dataRow : 13) * (isMobile ? mobileTextScale : desktopTextScale)}px`;
    const totalFs = `${(isMobile ? mx.totalRow : 16) * (isMobile ? mobileTextScale : desktopTextScale)}px`;
    const outerPad = narrow2col ? 'p-1 space-y-1' : isMobile ? 'p-1.5 space-y-1.5' : 'p-2 space-y-1.5';
    const innerPad = narrow2col ? 'p-0.5' : isMobile ? 'p-1' : 'p-1.5';
    const gridGap = narrow2col ? 'gap-1' : 'gap-1.5 sm:gap-2';

    return (
        <div className={`${outerPad} ${SP_SUMMARY_INSET_CLASS} ${!isMobile ? 'text-base min-[1024px]:text-lg' : 'text-zinc-100'}`}>
            <div className={`grid ${narrow2col ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} ${gridGap}`}>
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${innerPad}`}>
                    <div className="mb-0.5 flex justify-center">
                        <GoStoneIcon color="black" className={narrow2col ? 'h-3.5 w-3.5' : isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                    </div>
                    <div className="flex justify-between gap-0.5 text-zinc-200" style={{ fontSize: rowFs }}><span className="min-w-0 shrink text-zinc-300">{t('summary.territory')}</span> <span className="tabular-nums font-medium text-zinc-50">{formatScoreDetailNumber(scoreDetails.black.territory, 0)}</span></div>
                    <div className="flex justify-between gap-0.5 text-zinc-200" style={{ fontSize: rowFs }}><span className="min-w-0 shrink text-zinc-300">{t('summary.captures')}</span> <span className="tabular-nums font-medium text-zinc-50">{scoreDetails.black.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between gap-0.5 text-zinc-200" style={{ fontSize: rowFs }}><span className="min-w-0 shrink text-zinc-300">{t('summary.deadStones')}</span> <span className="tabular-nums font-medium text-zinc-50">{scoreDetails.black.deadStones ?? 0}</span></div>
                    <div className="mt-0.5 flex justify-between gap-0.5 border-t border-amber-500/20 pt-0.5 font-bold text-zinc-50" style={{ fontSize: totalFs }}><span>{t('summary.total')}</span> <span className="text-amber-200 tabular-nums">{formatScoreDetailNumber(scoreDetails.black.total, 1)}</span></div>
                </div>
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${innerPad}`}>
                    <div className="mb-0.5 flex justify-center">
                        <GoStoneIcon color="white" className={narrow2col ? 'h-3.5 w-3.5' : isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                    </div>
                    <div className="flex justify-between gap-0.5 text-zinc-200" style={{ fontSize: rowFs }}><span className="min-w-0 shrink text-zinc-300">{t('summary.territory')}</span> <span className="tabular-nums font-medium text-zinc-50">{formatScoreDetailNumber(scoreDetails.white.territory, 0)}</span></div>
                    <div className="flex justify-between gap-0.5 text-zinc-200" style={{ fontSize: rowFs }}><span className="min-w-0 shrink text-zinc-300">{t('summary.captures')}</span> <span className="tabular-nums font-medium text-zinc-50">{scoreDetails.white.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between gap-0.5 text-zinc-200" style={{ fontSize: rowFs }}><span className="min-w-0 shrink text-zinc-300">{t('summary.deadStones')}</span> <span className="tabular-nums font-medium text-zinc-50">{scoreDetails.white.deadStones ?? 0}</span></div>
                    <div className="flex justify-between gap-0.5 text-zinc-200" style={{ fontSize: rowFs }}><span className="min-w-0 shrink text-zinc-300">{t('summary.komi')}</span> <span className="tabular-nums font-medium text-zinc-50">{scoreDetails.white.komi}</span></div>
                    <div className="mt-0.5 flex justify-between gap-0.5 border-t border-amber-500/20 pt-0.5 font-bold text-zinc-50" style={{ fontSize: totalFs }}><span>{t('summary.total')}</span> <span className="text-amber-200 tabular-nums">{formatScoreDetailNumber(scoreDetails.white.total, 1)}</span></div>
                </div>
            </div>
        </div>
    );
};

const TowerSummaryModal: React.FC<TowerSummaryModalProps> = ({ session, currentUser, onAction, onClose }) => {
    const { t } = useTranslation('game');
    const { modalLayerUsesDesignPixels } = useAppContext();
    const isCompactViewport = useIsHandheldDevice(900);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const { mobileTextScale, desktopTextScale, commonWindowProps: commonResultWindowProps } = useGameResultModalLayout({
        isMobile,
        designWidth: 1000,
        designHeight: 900,
    });
    const useBodyScrollSizing = modalLayerUsesDesignPixels || isMobile;
    const isScoring = session.gameStatus === 'scoring';
    const isEnded = session.gameStatus === 'ended';
    const analysisResult = session.analysisResult?.['system'];
    const renderableScoreDetails = hasRenderableScoreDetails(analysisResult);
    const summary = session.summary?.[currentUser.id];
    const [localAdGoldBonus, setLocalAdGoldBonus] = useState(0);

    useEffect(() => {
        setLocalAdGoldBonus(0);
    }, [session.id]);
    
    // 계가 결과가 있으면 점수를 기반으로 승리/실패 판단, 없으면 session.winner 사용 (`towerPreGameDisplay`와 인게임 푸터 동일)
    const isWinner = isTowerHumanWinnerFromSession(session);
    const currentFloor = getTowerSessionFloor(session);
    const currentStage = TOWER_STAGES.find((s: any) => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === currentFloor;
    });
    
    // 결과창은 서버가 확정한 실제 지급 내역(summary)만 표시한다.
    const displaySummary = summary;
    const optimisticAdGoldBonus = (summary?.adGoldBonus ?? 0) > 0 ? 0 : localAdGoldBonus;

    const failureReason = useMemo(() => {
        if (isWinner) return null;
        switch (session.winReason) {
            case 'timeout':
                if (currentStage?.blackTurnLimit) {
                    return t('towerSummary.failTurnLimit');
                }
                return t('towerSummary.failTimeLimit');
            case 'capture_limit':
                return currentStage?.survivalTurns
                    ? t('towerSummary.failSurvival')
                    : t('towerSummary.failCaptureTarget');
            case 'score':
                return t('towerSummary.failScoring');
            case 'resign':
                return t('towerSummary.failResign');
            case 'disconnect':
                return t('towerSummary.failDisconnect');
            case 'total_score':
                return t('towerSummary.failTotalScore');
            case 'dice_win':
                return t('towerSummary.failDice');
            case 'foul_limit':
                return t('towerSummary.failFoul');
            case 'thief_captured':
                return t('towerSummary.failThiefCaught');
            case 'police_win':
                return t('towerSummary.failPoliceScore');
            case 'omok_win':
                return t('towerSummary.failOmok');
            case 'alkkagi_win':
                return t('towerSummary.failAlkkagi');
            case 'curling_win':
                return t('towerSummary.failCurling');
            default:
                return null;
        }
    }, [isWinner, session.winReason, currentStage, t]);

    const winReasonText = useMemo(() => {
        if (!isWinner) return null;
        switch (session.winReason) {
            case 'capture_limit':
                return currentStage?.survivalTurns
                    ? t('towerSummary.winSurvival')
                    : t('towerSummary.winCaptureTarget');
            case 'score':
                return t('towerSummary.winScoring');
            case 'timeout':
                return t('towerSummary.winTime');
            case 'resign':
                return t('towerSummary.winResign');
            case 'disconnect':
                return t('towerSummary.winDisconnect');
            case 'total_score':
                return t('towerSummary.winTotalScore');
            case 'dice_win':
                return t('towerSummary.winDice');
            case 'foul_limit':
                return t('towerSummary.winFoul');
            case 'thief_captured':
                return t('towerSummary.winThiefCaught');
            case 'police_win':
                return t('towerSummary.winPoliceScore');
            case 'omok_win':
                return t('towerSummary.winOmok');
            case 'alkkagi_win':
                return t('towerSummary.winAlkkagi');
            case 'curling_win':
                return t('towerSummary.winCurling');
            default:
                return t('towerSummary.winGeneric');
        }
    }, [isWinner, session.winReason, currentStage, t]);

    // 결과 모달이 열린 뒤에는 경기장 타이머 초기화 등의 영향을 받지 않도록
    // "총 걸린 시간"을 처음 계산된 값으로 고정한다.
    const gameDurationRef = useRef<string | null>(null);
    if (gameDurationRef.current === null) {
        const startTime = session.gameStartTime ?? (session as any).startTime ?? session.createdAt;
        const endTime = (session as any).endTime ?? session.turnStartTime ?? Date.now();
        const elapsedMs = Math.max(0, endTime - startTime);
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        gameDurationRef.current = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    const gameDuration = gameDurationRef.current;

    const avatarUrl = useMemo(() => AVATAR_POOL.find((a: AvatarInfo) => a.id === currentUser.avatarId)?.url, [currentUser.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b: BorderInfo) => b.id === currentUser.borderId)?.url, [currentUser.borderId]);
    const xpRequirement = getXpRequirementForLevel(Math.max(1, currentUser.userLevel));
    const clampedXp = Math.min(currentUser.userXp, xpRequirement);
    const xpChange = displaySummary?.xp?.change ?? 0;
    const previousXp = Math.max(0, clampedXp - xpChange);
    const previousXpPercent = Math.min(100, (previousXp / (xpRequirement || 1)) * 100);
    const xpPercent = Math.min(100, (clampedXp / (xpRequirement || 1)) * 100);

    const petXpBarPercents = useMemo(() => {
        const pl = displaySummary?.pairPetLevel;
        const px = displaySummary?.pairPetXp;
        if (!pl || !px || (px.change ?? 0) <= 0) return null;
        const petMax = Math.max(1, pl.progress.max);
        const petInitial = pl.progress.initial;
        const petFinal = pl.progress.final;
        return {
            previous: Math.min(100, (petInitial / petMax) * 100),
            final: Math.min(100, (petFinal / petMax) * 100),
            gain: px.change,
            petMax,
            petFinal,
        };
    }, [displaySummary]);

    const showPetGradeUpgradeInsteadOfXp = useMemo(() => {
        const row = getEquippedPairPetInventoryRow(currentUser);
        return pairPetShowsGradeUpgradeNeededInsteadOfXp({
            grade: row ? effectivePairPetGradeFromRow(row) : undefined,
            petFinalLevel: displaySummary?.pairPetLevel?.final,
            xpChange: displaySummary?.pairPetXp?.change,
        });
    }, [currentUser, displaySummary?.pairPetLevel?.final, displaySummary?.pairPetXp?.change]);

    const petRecordRowIdentity = useMemo(() => {
        const row = getEquippedPairPetInventoryRow(currentUser);
        if (!row) return null;
        const def = row.templateId ? getPairPetDefinition(row.templateId) : undefined;
        const raw = (typeof row.image === 'string' && row.image.length > 0 ? row.image : null) ?? def?.image ?? null;
        const imageSrc =
            raw && typeof raw === 'string'
                ? raw.startsWith('/') || raw.startsWith('http')
                    ? raw
                    : `/${raw.replace(/^\//, '')}`
                : null;
        return { imageSrc, displayName: getPairPetDisplayName(row) };
    }, [currentUser]);

    const hasRewardSlots = useMemo(
        () =>
            !!displaySummary &&
            (((displaySummary.gold ?? 0) + optimisticAdGoldBonus) > 0 ||
                (displaySummary.xp?.change ?? 0) > 0 ||
                (displaySummary.pairPetXp?.change ?? 0) > 0 ||
                (showPetGradeUpgradeInsteadOfXp && displaySummary.pairPetXp != null) ||
                (Array.isArray(displaySummary.items) && displaySummary.items.length > 0)),
        [displaySummary, optimisticAdGoldBonus, showPetGradeUpgradeInsteadOfXp],
    );

    /** 싱글플레이 기록 탭과 동일: 요약에 `xp`가 있을 때만 표시 */
    const renderTowerStrategyXpPanel = (compact: boolean) => {
        if (!displaySummary?.xp) return null;
        return (
            <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 ${compact ? 'p-1.5' : 'p-2'}`}>
                <StrategyXpResultBar previousXpPercent={previousXpPercent} finalXpPercent={xpPercent} xpGain={xpChange} />
                <div
                    className="flex min-w-0 flex-nowrap items-center justify-between gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                    style={{
                        fontSize: compact
                            ? `${RESULT_MODAL_SCORE_MOBILE_PX.dataRow * mobileTextScale}px`
                            : '13px',
                    }}
                >
                    <span className="min-w-0 shrink truncate font-mono text-zinc-100">
                        {clampedXp.toLocaleString()} / {xpRequirement.toLocaleString()} XP
                    </span>
                    {xpChange > 0 ? (
                        <span className="shrink-0 whitespace-nowrap font-semibold text-green-400">
                            +{xpChange.toLocaleString()} XP
                        </span>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderTowerPetXpPanel = (compact: boolean) => {
        if (showPetGradeUpgradeInsteadOfXp && displaySummary?.pairPetLevel && displaySummary?.pairPetXp) {
            return (
                <div className={`space-y-1 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 ${compact ? 'p-1.5' : 'p-2'}`}>
                    {petRecordRowIdentity ? (
                        <SpResultRecordPetIdentityRow
                            imageSrc={petRecordRowIdentity.imageSrc}
                            displayName={petRecordRowIdentity.displayName}
                            level={displaySummary.pairPetLevel.final}
                            isMobile={compact}
                            mobileTextScale={mobileTextScale}
                        />
                    ) : null}
                    {compact ? (
                        <p
                            className="text-center font-bold uppercase tracking-[0.12em] text-fuchsia-200/90"
                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                        >
                            {t('summary.petGradeUpgradeNeeded')}
                        </p>
                    ) : (
                        <div className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-fuchsia-200/90 sm:text-xs">
                            {t('summary.petGradeUpgradeNeeded')}
                        </div>
                    )}
                </div>
            );
        }
        if (!petXpBarPercents || !displaySummary?.pairPetLevel) return null;
        return (
            <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 ${compact ? 'p-1.5' : 'p-2'}`}>
                {petRecordRowIdentity ? (
                    <SpResultRecordPetIdentityRow
                        imageSrc={petRecordRowIdentity.imageSrc}
                        displayName={petRecordRowIdentity.displayName}
                        level={displaySummary.pairPetLevel.final}
                        isMobile={compact}
                        mobileTextScale={mobileTextScale}
                    />
                ) : null}
                <StrategyXpResultBar
                    previousXpPercent={petXpBarPercents.previous}
                    finalXpPercent={petXpBarPercents.final}
                    xpGain={petXpBarPercents.gain}
                />
                <div
                    className="flex min-w-0 flex-nowrap items-center justify-between gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                    style={{
                        fontSize: compact
                            ? `${RESULT_MODAL_SCORE_MOBILE_PX.dataRow * mobileTextScale}px`
                            : '13px',
                    }}
                >
                    <span className="min-w-0 shrink truncate font-mono text-zinc-100">
                        {t('towerSummary.petXp', { current: petXpBarPercents.petFinal.toLocaleString(), max: petXpBarPercents.petMax.toLocaleString() })}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-fuchsia-300">
                        +{t('towerSummary.petXpGain', { gain: petXpBarPercents.gain.toLocaleString() })}
                    </span>
                </div>
                {displaySummary.pairPetLevelUpCoreBonuses ? (
                    <PairPetLevelUpCoreDelta
                        delta={displaySummary.pairPetLevelUpCoreBonuses}
                        title={t('summary.addedStats')}
                        compact
                        className="mt-1"
                    />
                ) : null}
            </div>
        );
    };

    // 계가 결과가 없으면 "계가 중..." 표시, 있으면 승리/실패 판단
    const modalTitle = (!renderableScoreDetails && isScoring)
        ? t('towerSummary.scoring')
        : renderableScoreDetails
            ? (isWinner ? t('towerSummary.floorClear') : t('towerSummary.floorFail'))
            : t('towerSummary.gameResult');

    const towerRewardsSection = (
        <div className={`flex flex-col ${SP_SUMMARY_PANEL_CLASS} shrink-0 ${isMobile ? 'gap-1 p-1.5' : 'gap-1.5 p-2'}`}>
            <h2
                className={`${SP_SUMMARY_SECTION_LABEL} border-b border-amber-500/25 text-center ${isMobile ? 'mb-0.5 pb-0.5' : 'mb-1 pb-0.5 sm:mb-2 sm:pb-1'}`}
                style={{ fontSize: isMobile ? `${RESULT_MODAL_SCORE_MOBILE_PX.sectionLabel * mobileTextScale}px` : '15px' }}
            >
                {t('towerSummary.rewardsTitle')}
            </h2>
            <div
                className={
                    isMobile
                        ? RESULT_MODAL_REWARDS_ROW_MOBILE_COMPACT_CLASS
                        : `flex ${RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS} flex-wrap content-center items-center justify-center gap-2 sm:gap-2.5`
                }
            >
                {!displaySummary ? (
                    <p
                        className="px-2 text-center font-medium text-zinc-200"
                        style={{ fontSize: isMobile ? `${RESULT_MODAL_SCORE_MOBILE_PX.emptyState * mobileTextScale}px` : '14px' }}
                    >
                        {isScoring ? t('towerSummary.scoring') : t('towerSummary.noRewardInfo')}
                    </p>
                ) : !hasRewardSlots ? (
                    <p
                        className="px-2 text-center font-medium text-zinc-200"
                        style={{ fontSize: isMobile ? `${RESULT_MODAL_SCORE_MOBILE_PX.emptyState * mobileTextScale}px` : '14px' }}
                    >
                        {t('towerSummary.noRewards')}
                    </p>
                ) : (
                    <>
                        {((displaySummary.gold ?? 0) + optimisticAdGoldBonus) > 0 && (
                            <ResultModalGoldCurrencySlot
                                amount={(displaySummary.gold ?? 0) + optimisticAdGoldBonus}
                                compact={isMobile}
                                dimmed={!summary}
                            />
                        )}
                        {displaySummary?.xp && displaySummary.xp.change > 0 && (
                            <div className={`flex flex-col items-center justify-center ${!summary ? 'opacity-80' : ''}`}>
                                <ResultModalXpRewardBadge
                                    variant="strategy"
                                    amount={displaySummary.xp.change}
                                    density={isMobile ? 'compact' : 'comfortable'}
                                />
                            </div>
                        )}
                        {displaySummary?.pairPetXp && displaySummary.pairPetXp.change > 0 && (
                            <div className={`flex flex-col items-center justify-center ${!summary ? 'opacity-80' : ''}`}>
                                <ResultModalXpRewardBadge
                                    variant="pet"
                                    amount={displaySummary.pairPetXp.change}
                                    density={isMobile ? 'compact' : 'comfortable'}
                                />
                            </div>
                        )}
                        {displaySummary?.pairPetXp && showPetGradeUpgradeInsteadOfXp && (
                            <div className={`flex flex-col items-center justify-center ${!summary ? 'opacity-80' : ''}`}>
                                <ResultModalPetGradeUpgradeNeededSlot density={isMobile ? 'compact' : 'comfortable'} />
                            </div>
                        )}
                        {displaySummary?.items &&
                            displaySummary.items.length > 0 &&
                            displaySummary.items.map((item, idx) => {
                                const displayName = item.name ?? ('itemId' in item ? (item as any).itemId : undefined);
                                if (!displayName) return null;
                                const nameWithSpace = displayName.includes(t('summary.goldBundleCompact'))
                                    ? displayName.replace(t('summary.goldBundleCompact'), t('summary.goldBundleSpaced'))
                                    : displayName;
                                const nameWithoutSpace = displayName.includes(t('summary.goldBundleSpaced'))
                                    ? displayName.replace(t('summary.goldBundleSpaced'), t('summary.goldBundleCompact'))
                                    : displayName;
                                const imagePath =
                                    ('image' in item && item.image) ||
                                    CONSUMABLE_ITEMS.find(
                                        (ci) =>
                                            ci.name === displayName ||
                                            ci.name === nameWithSpace ||
                                            ci.name === nameWithoutSpace
                                    )?.image ||
                                    MATERIAL_ITEMS[displayName]?.image ||
                                    MATERIAL_ITEMS[nameWithSpace]?.image ||
                                    MATERIAL_ITEMS[nameWithoutSpace]?.image;
                                return (
                                    <ResultModalItemRewardSlot
                                        key={'id' in item && item.id ? item.id : idx}
                                        imageSrc={imagePath || null}
                                        name={displayName}
                                        quantity={item.quantity}
                                        compact={isMobile}
                                        dimmed={!summary}
                                        onImageError={(e) => {
                                            console.error(
                                                `[TowerSummaryModal] Failed to load image: ${imagePath} for item:`,
                                                item
                                            );
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                );
                            })}
                    </>
                )}
            </div>
            {displaySummary ? (
                <ResultAdGoldDoubleButton
                    session={session}
                    summary={displaySummary}
                    isWinner={isWinner === true}
                    onAction={onAction}
                    onClaimed={(amount) => setLocalAdGoldBonus((prev) => prev + amount)}
                    className="pt-1"
                />
            ) : null}
        </div>
    );

    return (
        <DraggableWindow 
            title={modalTitle}
            onClose={isScoring ? undefined : () => handleClose(session, onClose)} 
            windowId="tower-summary-redesigned"
            viewportPortal
            skipSavedPosition
            {...commonResultWindowProps}
            hideFooter
            bodyPaddingClassName={isMobile ? 'p-2 sm:p-3' : 'p-3 sm:p-4'}
            modal={!modalLayerUsesDesignPixels}
            closeOnOutsideClick={!modalLayerUsesDesignPixels}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
        >
            <div
                className={`flex w-full min-h-0 flex-col text-white ${
                    isMobile
                        ? 'h-full min-h-0 flex-1 overflow-hidden'
                        : useBodyScrollSizing
                          ? 'overflow-x-hidden'
                          : 'overflow-x-hidden overflow-y-visible'
                } ${PRE_GAME_MODAL_LAYER_CLASS} ${isMobile ? 'text-xs sm:text-sm' : 'text-[1.0625rem] min-[1024px]:text-lg min-[1280px]:text-xl'}`}
                style={!isMobile ? { fontSize: `${14 * desktopTextScale}px` } : undefined}
            >
                {/* Title */}
                {(analysisResult || (isEnded && session.winner !== null)) && (
                    <h1 className={`${isMobile ? 'text-base' : 'text-2xl min-[1024px]:text-3xl min-[1280px]:text-4xl'} font-black text-center mb-1 sm:mb-2 tracking-widest flex-shrink-0 ${isWinner ? 'sudamr-stable-gradient-text text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300' : 'text-red-400'}`} style={{ fontSize: isMobile ? `${14 * mobileTextScale}px` : undefined }}>
                        {isWinner ? t('towerSummary.challengeSuccess') : t('towerSummary.challengeFail')}
                    </h1>
                )}
                {!isMobile && !isScoring && !isEnded && !analysisResult && session.winner === null && (
                    <h1 className="text-2xl min-[1024px]:text-3xl font-black text-center mb-1 sm:mb-2 tracking-widest flex-shrink-0 text-gray-300">
                        {t('towerSummary.gameResult')}
                    </h1>
                )}
                
                {isMobile ? (
                    <GameResultModalFitContent className="flex-1 basis-0" enabled={false}>
                    <div className="flex flex-col gap-1.5 overflow-x-hidden">
                        <div className={`flex flex-col ${SP_SUMMARY_PANEL_CLASS} shrink-0 p-2 sp-summary-left-panel overflow-x-hidden`}>
                            <h2
                                className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.sectionLabel * mobileTextScale}px` }}
                            >
                                {t('towerSummary.matchResult')}
                            </h2>
                            <div className="flex flex-col gap-1.5 overflow-x-hidden">
                                {(analysisResult || (isEnded && session.winner !== null)) && (
                                    <div className={`p-1 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 space-y-0.5`}>
                                        <div className="flex items-center justify-between" style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.dataRow * mobileTextScale}px` }}>
                                            <span className="text-amber-200/65">{t('towerSummary.totalElapsed')}</span>
                                            <span className="font-semibold text-zinc-100">{gameDuration}</span>
                                        </div>
                                        {(winReasonText || failureReason) && (
                                            <p
                                                className={`leading-snug ${isWinner ? 'text-green-400' : 'text-red-400'}`}
                                                style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.dataRow * mobileTextScale}px` }}
                                            >
                                                {winReasonText || failureReason}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {isScoring && !renderableScoreDetails && (
                                    <div className="flex min-h-[100px] flex-shrink-0 flex-col items-center justify-center">
                                        <ScoringOverlay variant="inline" />
                                    </div>
                                )}
                                {(isScoring && renderableScoreDetails) || (isEnded && renderableScoreDetails) ? (
                                    <ScoreDetailsComponent
                                        analysis={analysisResult!}
                                        session={session}
                                        isMobile={isMobile}
                                        mobileTextScale={mobileTextScale}
                                        desktopTextScale={desktopTextScale}
                                        compactSideBySideMobile
                                    />
                                ) : !isScoring && !isEnded ? (
                                    <p className="text-center text-gray-400">{t('towerSummary.noScoringResult')}</p>
                                ) : null}
                            </div>
                        </div>
                        <div className={`flex flex-col gap-1.5 ${SP_SUMMARY_PANEL_CLASS} shrink-0 p-2`}>
                            <h2
                                className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.sectionLabel * mobileTextScale}px` }}
                            >
                                {t('towerSummary.myInfo')}
                            </h2>
                            <div className={`p-1 ${SP_SUMMARY_INSET_CLASS} flex flex-shrink-0 items-center gap-1.5`}>
                                <Avatar
                                    userId={currentUser.id}
                                    userName={currentUser.nickname}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={24}
                                />
                                <div>
                                    <p className="font-bold text-zinc-100" style={{ fontSize: `${11 * mobileTextScale}px` }}>
                                        {currentUser.nickname}
                                    </p>
                                    <p className="text-amber-200/60" style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.emptyState * mobileTextScale}px` }}>
                                        Lv.{currentUser.userLevel}
                                    </p>
                                </div>
                            </div>
                            {renderTowerStrategyXpPanel(true)}
                            {renderTowerPetXpPanel(true)}
                        </div>
                        {towerRewardsSection}
                    </div>
                    </GameResultModalFitContent>
                ) : (
                    <GameResultModalFitContent className="min-h-0 flex-1">
                    <div className="flex min-h-0 flex-col gap-2 overflow-x-hidden">
                        <div className={`flex flex-col ${SP_SUMMARY_PANEL_CLASS} shrink-0 overflow-visible p-2 sp-summary-left-panel`}>
                            <h2
                                className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                style={{ fontSize: '15px' }}
                            >
                                {t('towerSummary.matchResult')}
                            </h2>
                            <div className="flex flex-col gap-1.5 overflow-visible">
                                {(analysisResult || (isEnded && session.winner !== null)) && (
                                    <div className={`${SP_SUMMARY_INSET_CLASS} space-y-0.5 p-1.5 flex-shrink-0`}>
                                        <div className="flex items-center justify-between" style={{ fontSize: '15px' }}>
                                            <span className="text-amber-200/65">{t('towerSummary.totalElapsed')}</span>
                                            <span className="font-semibold text-zinc-100">{gameDuration}</span>
                                        </div>
                                        {(winReasonText || failureReason) && (
                                            <p className={`font-semibold leading-snug ${isWinner ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: `${13 * desktopTextScale}px` }}>
                                                {winReasonText || failureReason}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {isScoring && !renderableScoreDetails && (
                                    <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center">
                                        <ScoringOverlay variant="inline" />
                                    </div>
                                )}
                                {(isScoring && renderableScoreDetails) || (isEnded && renderableScoreDetails) ? (
                                    <ScoreDetailsComponent
                                        analysis={analysisResult!}
                                        session={session}
                                        isMobile={false}
                                        mobileTextScale={mobileTextScale}
                                        desktopTextScale={desktopTextScale}
                                    />
                                ) : !isScoring && !isEnded ? (
                                    <p className="text-center text-gray-400">{t('towerSummary.noScoringResult')}</p>
                                ) : null}
                            </div>
                        </div>
                        <div className={`flex min-w-0 flex-col gap-1.5 ${SP_SUMMARY_PANEL_CLASS} shrink-0 overflow-visible p-2`}>
                            <h2
                                className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                style={{ fontSize: '15px' }}
                            >
                                {t('towerSummary.myInfo')}
                            </h2>
                            <div className={`${SP_SUMMARY_INSET_CLASS} flex min-w-0 flex-shrink-0 items-center gap-1.5 p-1.5`}>
                                <Avatar
                                    userId={currentUser.id}
                                    userName={currentUser.nickname}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={32}
                                />
                                <div className="min-w-0">
                                    <p className="truncate font-bold text-zinc-100" style={{ fontSize: '15px' }}>
                                        {currentUser.nickname}
                                    </p>
                                    <p className="text-amber-200/60" style={{ fontSize: '13px' }}>
                                        Lv.{currentUser.userLevel}
                                    </p>
                                </div>
                            </div>
                            {renderTowerStrategyXpPanel(false)}
                            {renderTowerPetXpPanel(false)}
                        </div>
                        {towerRewardsSection}
                    </div>
                    </GameResultModalFitContent>
                )}
            </div>
            {!isScoring ? (
                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex shrink-0 justify-center border-t border-amber-500/25 bg-gradient-to-t from-[#0c0a10] via-[#14111c]/95 to-transparent px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-4 sm:pb-3 sm:pt-2.5`}
                >
                    <Button
                        bare
                        colorScheme="none"
                        onClick={() => handleClose(session, onClose)}
                        className={`w-full max-w-md px-8 ${PRE_GAME_MODAL_ACCENT_BTN_CLASS} ${
                            isMobile ? '!min-h-[2.75rem] !text-[13px] !font-bold' : ''
                        }`}
                    >
                        {t('summary.confirm')}
                    </Button>
                </div>
            ) : null}
        </DraggableWindow>
    );
};

export default TowerSummaryModal;

