import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SinglePlayerMissionInfo } from '../../types.js';
import Button from '../Button.js';
import AlertModal from '../AlertModal.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';

const ENHANCE_GAUGE_DURATION = 3000;

export type TrainingQuestEnhancePanelProps = {
    mission: SinglePlayerMissionInfo;
    currentLevel: number;
    upgradeCost: number;
    canLevelUp: boolean;
    hasEnoughXp?: boolean;
    hasUnlockStage?: boolean;
    nextLevelUnlockStage?: string;
    currentUserGold: number;
    accumulatedCollection: number;
    requiredCollection: number;
    progressPercent: number;
    onConfirm: () => Promise<void>;
    /** 2×3 그리드 셀 등 좁은 공간 */
    compact?: boolean;
    /** 상위 구역에서 제목을 표시할 때 */
    hideHeader?: boolean;
};

type EnhanceModel = {
    currentLevelInfo: SinglePlayerMissionInfo['levels'][number] | null;
    nextLevelInfo: SinglePlayerMissionInfo['levels'][number] | null;
    productionRateChange: number;
    rewardAmountChange: number;
    maxCapacityChange: number;
    xpPercent: number;
    xpLabel: string;
    hasEnoughGold: boolean;
    isMaxLevel: boolean;
};

export function buildTrainingQuestEnhanceModel({
    mission,
    currentLevel,
    canLevelUp,
    currentUserGold,
    upgradeCost,
    accumulatedCollection,
    requiredCollection,
    progressPercent,
}: TrainingQuestEnhancePanelProps): EnhanceModel {
    const nextLevelInfo = mission.levels?.[currentLevel] ?? null;
    const currentLevelInfo = currentLevel > 0 ? mission.levels[currentLevel - 1] : null;
    const productionRateChange = currentLevelInfo
        ? currentLevelInfo.productionRateMinutes - (nextLevelInfo?.productionRateMinutes ?? 0)
        : 0;
    const rewardAmountChange = currentLevelInfo
        ? (nextLevelInfo?.rewardAmount ?? 0) - currentLevelInfo.rewardAmount
        : nextLevelInfo?.rewardAmount ?? 0;
    const maxCapacityChange = currentLevelInfo
        ? (nextLevelInfo?.maxCapacity ?? 0) - currentLevelInfo.maxCapacity
        : nextLevelInfo?.maxCapacity ?? 0;

    const normalizedRequired = Math.max(0, requiredCollection);
    const normalizedAccumulated = Math.max(0, accumulatedCollection);
    const xpPercent =
        normalizedRequired > 0
            ? Math.min(100, Math.floor((normalizedAccumulated / normalizedRequired) * 100))
            : canLevelUp
              ? 100
              : Math.max(0, Math.floor(progressPercent));
    const xpLabel =
        normalizedRequired > 0
            ? `${Math.min(normalizedAccumulated, normalizedRequired).toLocaleString()} / ${normalizedRequired.toLocaleString()} (${xpPercent}%)`
            : `— / — (${xpPercent}%)`;

    return {
        currentLevelInfo,
        nextLevelInfo,
        productionRateChange,
        rewardAmountChange,
        maxCapacityChange,
        xpPercent,
        xpLabel,
        hasEnoughGold: currentUserGold >= upgradeCost,
        isMaxLevel: !nextLevelInfo,
    };
}

const statRow = (
    icon: React.ReactNode,
    label: string,
    before: string,
    after: string,
    delta: string | null,
    compact = false,
) => (
    <div
        className={`flex items-center gap-1 rounded border border-white/[0.06] bg-slate-900/45 px-1.5 leading-none whitespace-nowrap ${
            compact ? 'min-h-[1.25rem] py-0.5 text-[10px] sm:text-[11px]' : 'min-h-[1.65rem] py-1 text-xs sm:text-sm'
        }`}
    >
        {icon}
        <span className={`shrink-0 font-medium text-slate-500 ${compact ? 'w-7' : 'w-9'}`}>{label}</span>
        <div className="min-w-0 flex-1 truncate text-right tabular-nums">
            <span className="text-slate-300">{before}</span>
            <span className="mx-0.5 text-slate-600">→</span>
            <span className="font-semibold text-emerald-200">{after}</span>
            {delta ? <span className="ml-0.5 font-semibold text-lime-400">{delta}</span> : null}
        </div>
    </div>
);

/** 중간 열: 다음 레벨 효과 미리보기 */
export const TrainingQuestNextLevelEffects: React.FC<TrainingQuestEnhancePanelProps> = (props) => {
    const { mission, currentLevel, canLevelUp, nextLevelUnlockStage, compact = false, hideHeader = false } = props;
    const model = buildTrainingQuestEnhanceModel(props);

    if (model.isMaxLevel) {
        return (
            <p className={`font-semibold text-amber-200/90 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-[11px]'}`}>
                최대 레벨에 도달했습니다.
            </p>
        );
    }

    const { currentLevelInfo, nextLevelInfo } = model;
    if (!nextLevelInfo) return null;

    const statGap = compact ? 'gap-px' : 'gap-1';
    const labelSize = compact ? 'text-[9px] sm:text-[10px]' : 'text-xs sm:text-sm';
    const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]';

    return (
        <div className={`flex min-w-0 flex-col overflow-hidden ${compact ? 'gap-px' : 'gap-1'}`}>
            {!hideHeader &&
                (!compact ? (
                    <p className="truncate whitespace-nowrap text-xs font-bold text-violet-200/90 sm:text-sm">
                        다음 레벨 (Lv.{currentLevel + 1}) 효과
                    </p>
                ) : (
                    <p className="truncate whitespace-nowrap text-[9px] font-bold text-violet-200/90 sm:text-[10px]">
                        Lv.{currentLevel + 1} 효과
                    </p>
                ))}
            <div className={`flex flex-col ${statGap}`}>
                {statRow(
                    <img src="/images/icon/timer.webp" alt="" className={`${iconSize} shrink-0 opacity-90`} />,
                    '생산',
                    currentLevelInfo ? `${currentLevelInfo.productionRateMinutes}분` : '—',
                    `${nextLevelInfo.productionRateMinutes}분`,
                    model.productionRateChange !== 0
                        ? model.productionRateChange > 0
                          ? `(-${model.productionRateChange.toFixed(1)})`
                          : `(+${Math.abs(model.productionRateChange).toFixed(1)})`
                        : null,
                    compact,
                )}
                {statRow(
                    <img
                        src={mission.rewardType === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                        alt=""
                        className={`${iconSize} shrink-0 opacity-95`}
                    />,
                    '생산량',
                    currentLevelInfo ? currentLevelInfo.rewardAmount.toLocaleString() : '—',
                    nextLevelInfo.rewardAmount.toLocaleString(),
                    model.rewardAmountChange !== 0
                        ? `(${model.rewardAmountChange > 0 ? `+${model.rewardAmountChange}` : String(model.rewardAmountChange)})`
                        : null,
                    compact,
                )}
                {statRow(
                    <span className={`flex ${iconSize} shrink-0 items-center justify-center rounded bg-violet-500/35 text-[8px] font-bold text-violet-100`}>
                        M
                    </span>,
                    '저장',
                    currentLevelInfo ? currentLevelInfo.maxCapacity.toLocaleString() : '—',
                    nextLevelInfo.maxCapacity.toLocaleString(),
                    model.maxCapacityChange !== 0
                        ? `(${model.maxCapacityChange > 0 ? `+${model.maxCapacityChange}` : String(model.maxCapacityChange)})`
                        : null,
                    compact,
                )}
            </div>

            <div
                className={`relative w-full shrink-0 overflow-hidden rounded-full bg-emerald-950/70 ring-1 ring-inset ring-white/[0.06] ${compact ? 'h-2.5' : 'h-4'}`}
            >
                <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-lime-400 to-yellow-300 transition-all duration-300"
                    style={{ width: `${Math.min(100, model.xpPercent)}%` }}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-1">
                    <span
                        className={`max-w-full truncate font-bold tabular-nums text-white [text-shadow:0_0_3px_rgba(0,0,0,0.85)] ${labelSize}`}
                    >
                        {model.xpLabel}
                    </span>
                </div>
            </div>

            {nextLevelUnlockStage ? (
                <p
                    className={`truncate whitespace-nowrap leading-tight text-amber-200/90 ${compact ? 'text-[8px] sm:text-[9px]' : 'text-xs sm:text-sm'}`}
                    title={nextLevelUnlockStage}
                >
                    <span className="font-semibold">{nextLevelUnlockStage}</span> 클리어 후 강화
                </p>
            ) : null}
        </div>
    );
};

/** 우측 열: 강화 버튼 + 게이지 */
export const TrainingQuestEnhanceActions: React.FC<TrainingQuestEnhancePanelProps> = (props) => {
    const {
        currentLevel,
        upgradeCost,
        canLevelUp,
        hasEnoughXp: hasEnoughXpProp,
        hasUnlockStage: hasUnlockStageProp,
        nextLevelUnlockStage,
        requiredCollection,
        accumulatedCollection,
        onConfirm,
        compact = false,
    } = props;
    const model = buildTrainingQuestEnhanceModel(props);
    const hasEnoughXp =
        hasEnoughXpProp ??
        (currentLevel === 0 || requiredCollection === 0 || accumulatedCollection >= requiredCollection);
    const hasUnlockStage = hasUnlockStageProp ?? (!nextLevelUnlockStage || canLevelUp);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancementProgress, setEnhancementProgress] = useState(0);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const enhanceIntervalRef = useRef<number | null>(null);
    const enhanceTimeoutRef = useRef<number | null>(null);

    const clearEnhanceTimers = useCallback(() => {
        if (enhanceIntervalRef.current != null) {
            window.clearInterval(enhanceIntervalRef.current);
            enhanceIntervalRef.current = null;
        }
        if (enhanceTimeoutRef.current != null) {
            window.clearTimeout(enhanceTimeoutRef.current);
            enhanceTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => () => clearEnhanceTimers(), [clearEnhanceTimers]);

    if (model.isMaxLevel) {
        return (
            <div
                className={`flex shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-950/20 px-2 text-center ${compact ? 'w-full py-2' : 'w-[5.5rem] py-3 sm:w-[6.25rem]'}`}
            >
                <span className={`font-black text-amber-100 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>최대 레벨</span>
            </div>
        );
    }

    const handleEnhance = async () => {
        if (isEnhancing) return;

        if (!hasEnoughXp) {
            setAlertMessage('경험치가 부족합니다.');
            return;
        }
        if (!hasUnlockStage && nextLevelUnlockStage) {
            setAlertMessage(`${nextLevelUnlockStage} 클리어 후 강화할 수 있습니다.`);
            return;
        }
        if (!model.hasEnoughGold) {
            setAlertMessage('골드가 부족합니다.');
            return;
        }

        setIsEnhancing(true);
        setEnhancementProgress(0);
        clearEnhanceTimers();

        const startTime = Date.now();
        enhanceIntervalRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const percent = Math.min(100, Math.round((elapsed / ENHANCE_GAUGE_DURATION) * 100));
            setEnhancementProgress(percent);
            if (elapsed >= ENHANCE_GAUGE_DURATION && enhanceIntervalRef.current != null) {
                window.clearInterval(enhanceIntervalRef.current);
                enhanceIntervalRef.current = null;
            }
        }, 50);

        enhanceTimeoutRef.current = window.setTimeout(() => {
            enhanceTimeoutRef.current = null;
            void (async () => {
                try {
                    setEnhancementProgress(100);
                    await onConfirm();
                } finally {
                    clearEnhanceTimers();
                    setIsEnhancing(false);
                    setEnhancementProgress(0);
                }
            })();
        }, ENHANCE_GAUGE_DURATION);
    };

    const canStartEnhance = hasEnoughXp && hasUnlockStage && model.hasEnoughGold;

    return (
        <>
            <div className={`flex w-full shrink-0 flex-col justify-center gap-1 ${compact ? '' : 'gap-1.5'}`}>
                <Button
                    onClick={() => void handleEnhance()}
                    colorScheme="none"
                    className={`${PREMIUM_QUEST_BTN.upgrade} !w-full !flex-none ${compact ? '!py-1 !text-[9px] sm:!text-[10px]' : '!py-2.5 !text-sm sm:!text-base'} ${isEnhancing ? '!cursor-wait !opacity-70' : !canStartEnhance ? '!opacity-90' : ''}`}
                    disabled={isEnhancing}
                >
                    {isEnhancing ? (
                        '강화 중...'
                    ) : (
                        <span className="flex flex-col items-center justify-center gap-0.5 font-semibold leading-tight">
                            <span>강화</span>
                            <span className="flex items-center gap-0.5 text-xs sm:text-sm">
                                <img src="/images/icon/Gold.webp" alt="" className="h-4 w-4 shrink-0" />
                                <span>{upgradeCost.toLocaleString()}</span>
                            </span>
                        </span>
                    )}
                </Button>

                <div className="flex items-center gap-0.5">
                    <span className="shrink-0 text-[8px] font-semibold tabular-nums text-slate-500 sm:text-[9px]">Lv.{currentLevel}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-slate-700/60 bg-slate-800/80">
                        <div
                            className={`h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 transition-[width] duration-100 ease-linear ${isEnhancing ? '' : 'opacity-0'}`}
                            style={{ width: `${isEnhancing ? enhancementProgress : 0}%` }}
                        />
                    </div>
                    <span className="shrink-0 text-[8px] font-semibold tabular-nums text-slate-500 sm:text-[9px]">
                        Lv.{currentLevel + 1}
                    </span>
                </div>
            </div>

            {alertMessage ? (
                <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} windowId="training-quest-enhance-alert" />
            ) : null}
        </>
    );
};

/** @deprecated 행 통합 레이아웃에서는 NextLevelEffects + EnhanceActions 분리 사용 */
const TrainingQuestEnhancePanel: React.FC<TrainingQuestEnhancePanelProps> = (props) => (
    <div className="flex w-[10.5rem] shrink-0 flex-col gap-1 border-l border-violet-400/25 pl-2 sm:w-[12.5rem]">
        <TrainingQuestNextLevelEffects {...props} />
        <TrainingQuestEnhanceActions {...props} />
    </div>
);

export default TrainingQuestEnhancePanel;
