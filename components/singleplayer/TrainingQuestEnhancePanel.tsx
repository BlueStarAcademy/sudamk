import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SinglePlayerMissionInfo } from '../../types.js';
import Button from '../Button.js';
import AlertModal from '../AlertModal.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';
import { highTierLootChancePercent } from '../../shared/utils/trainingQuestLoot.js';

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
    /** 스탯을 가로로 나란히 배치 (모달 강화 패널용) */
    horizontal?: boolean;
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
    after: string | null,
    delta: string | null,
    compact = false,
    /** 라벨(위) / 수치(아래) 세로 배치 */
    stacked = false,
) => {
    const valueNode =
        after == null ? (
            <span className="font-semibold text-emerald-200">{before}</span>
        ) : (
            <>
                <span className="text-slate-300">{before}</span>
                <span className="mx-0.5 text-slate-600">→</span>
                <span className="font-semibold text-emerald-200">{after}</span>
                {delta ? <span className="ml-0.5 font-semibold text-lime-400">{delta}</span> : null}
            </>
        );

    if (stacked) {
        return (
            <div
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded border border-white/[0.06] bg-slate-900/45 px-1 text-center leading-tight ${
                    compact ? 'py-1 text-[10px] sm:text-[11px]' : 'py-1.5 text-xs sm:text-sm'
                }`}
            >
                <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                    {icon}
                    <span className="font-medium text-slate-500">{label}</span>
                </div>
                <div className="min-w-0 whitespace-nowrap tabular-nums">{valueNode}</div>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-1 rounded border border-white/[0.06] bg-slate-900/45 px-1.5 leading-tight ${
                compact ? 'min-h-[1.35rem] py-0.5 text-[10px] sm:text-[11px]' : 'min-h-[1.65rem] py-1 text-xs sm:text-sm'
            }`}
        >
            {icon}
            <span className={`shrink-0 font-medium text-slate-500 ${compact ? 'w-7' : 'w-9'}`}>{label}</span>
            <div className="min-w-0 flex-1 text-right tabular-nums">{valueNode}</div>
        </div>
    );
};

/** 중간 열: 다음 레벨 효과 미리보기 (최대 레벨이면 현재 생산 정보만 표시) */
export const TrainingQuestNextLevelEffects: React.FC<TrainingQuestEnhancePanelProps> = (props) => {
    const { mission, currentLevel, compact = false, hideHeader = false, horizontal = false } = props;
    const { t } = useTranslation('lobby');
    const model = buildTrainingQuestEnhanceModel(props);
    const { currentLevelInfo, nextLevelInfo } = model;

    if (!currentLevelInfo && !nextLevelInfo) return null;

    const isMaxLevel = model.isMaxLevel || !nextLevelInfo;
    const statGap = compact ? 'gap-px' : 'gap-1';
    const labelSize = compact ? 'text-[9px] sm:text-[10px]' : 'text-xs sm:text-sm';
    const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]';

    const productionStat = statRow(
        <img src="/images/icon/timer.webp" alt="" className={`${iconSize} shrink-0 opacity-90`} />,
        t('singleplayer.production'),
        currentLevelInfo ? t('singleplayer.productionRateMinutes', { minutes: currentLevelInfo.productionRateMinutes }) : '—',
        isMaxLevel || !nextLevelInfo
            ? null
            : t('singleplayer.productionRateMinutes', { minutes: nextLevelInfo.productionRateMinutes }),
        !isMaxLevel && model.productionRateChange !== 0
            ? model.productionRateChange > 0
              ? `(-${model.productionRateChange.toFixed(1)})`
              : `(+${Math.abs(model.productionRateChange).toFixed(1)})`
            : null,
        compact,
        horizontal,
    );
    const amountIconSrc =
        mission.rewardType === 'gold'
            ? '/images/icon/Gold.webp'
            : mission.rewardType === 'diamonds'
              ? '/images/icon/Zem.webp'
              : mission.rewardType === 'enhance_stone'
                ? '/images/materials/materials1.webp'
                : '/images/Box/EquipmentBox1.webp';
    const amountStat = statRow(
        <img src={amountIconSrc} alt="" className={`${iconSize} shrink-0 opacity-95`} />,
        t('singleplayer.productionAmount'),
        currentLevelInfo ? currentLevelInfo.rewardAmount.toLocaleString() : '—',
        isMaxLevel || !nextLevelInfo ? null : nextLevelInfo.rewardAmount.toLocaleString(),
        !isMaxLevel && model.rewardAmountChange !== 0
            ? `(${model.rewardAmountChange > 0 ? `+${model.rewardAmountChange}` : String(model.rewardAmountChange)})`
            : null,
        compact,
        horizontal,
    );

    const itemRewardType =
        mission.rewardType === 'enhance_stone' || mission.rewardType === 'equipment_box'
            ? mission.rewardType
            : null;
    const highGradeRow =
        itemRewardType && currentLevelInfo ? (
            <div
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded border border-violet-400/20 bg-violet-950/30 px-1 text-center leading-tight ${
                    compact ? 'py-1 text-[10px] sm:text-[11px]' : 'py-1.5 text-xs sm:text-sm'
                }`}
            >
                <span className="font-medium text-violet-200/80">{t('singleplayer.highGradeLabel')}</span>
                <div className="whitespace-nowrap tabular-nums">
                    {isMaxLevel ? (
                        <span className="font-semibold text-emerald-200">
                            {highTierLootChancePercent(itemRewardType, currentLevel)}%
                        </span>
                    ) : (
                        <>
                            <span className="text-slate-300">{highTierLootChancePercent(itemRewardType, currentLevel)}%</span>
                            <span className="mx-0.5 text-slate-600">→</span>
                            <span className="font-semibold text-emerald-200">
                                {highTierLootChancePercent(itemRewardType, currentLevel + 1)}%
                            </span>
                        </>
                    )}
                </div>
            </div>
        ) : null;
    const storageStat = statRow(
        <span className={`flex ${iconSize} shrink-0 items-center justify-center rounded bg-violet-500/35 text-[8px] font-bold text-violet-100`}>
            M
        </span>,
        t('singleplayer.storage'),
        currentLevelInfo ? currentLevelInfo.maxCapacity.toLocaleString() : '—',
        isMaxLevel || !nextLevelInfo ? null : nextLevelInfo.maxCapacity.toLocaleString(),
        !isMaxLevel && model.maxCapacityChange !== 0
            ? `(${model.maxCapacityChange > 0 ? `+${model.maxCapacityChange}` : String(model.maxCapacityChange)})`
            : null,
        compact,
        horizontal,
    );

    const xpBar = isMaxLevel ? null : (
        <div
            className={`relative w-full shrink-0 overflow-hidden rounded-full bg-emerald-950/70 ring-1 ring-inset ring-white/[0.06] ${
                compact ? 'h-2.5' : horizontal ? 'h-5' : 'h-4'
            }`}
        >
            <div
                className="h-full bg-gradient-to-r from-emerald-400 via-lime-400 to-yellow-300 transition-all duration-300"
                style={{ width: `${Math.min(100, model.xpPercent)}%` }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-1">
                <span
                    className={`max-w-full whitespace-nowrap font-bold tabular-nums text-white [text-shadow:0_0_3px_rgba(0,0,0,0.85)] ${labelSize}`}
                >
                    {model.xpLabel}
                </span>
            </div>
        </div>
    );

    const header = !hideHeader ? (
        isMaxLevel ? (
            <p
                className={`font-bold text-amber-200/90 ${
                    compact
                        ? 'truncate whitespace-nowrap text-[9px] sm:text-[10px]'
                        : 'text-xs sm:text-sm'
                }`}
            >
                {t('singleplayer.maxLevelReached')}
            </p>
        ) : compact && !horizontal ? (
            <p className="truncate whitespace-nowrap text-[9px] font-bold text-violet-200/90 sm:text-[10px]">
                {t('singleplayer.nextLevelEffectsCompact', { level: currentLevel + 1 })}
            </p>
        ) : (
            <p className="text-xs font-bold text-violet-200/90 sm:text-sm">
                {t('singleplayer.nextLevelEffects', { level: currentLevel + 1 })}
            </p>
        )
    ) : null;

    if (horizontal) {
        return (
            <div className="flex min-w-0 w-full flex-col gap-1.5">
                {header}
                <div
                    className={`grid min-w-0 ${
                        highGradeRow
                            ? 'grid-cols-[minmax(0,1.3fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,0.9fr)]'
                            : 'grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(0,1fr)]'
                    } ${compact ? 'gap-1' : 'gap-1 sm:gap-1.5'}`}
                >
                    {productionStat}
                    {amountStat}
                    {storageStat}
                    {highGradeRow}
                </div>
                {xpBar}
            </div>
        );
    }

    return (
        <div className={`flex min-w-0 flex-col overflow-hidden ${compact ? 'gap-px' : 'gap-1'}`}>
            {header}
            <div className={`flex flex-col ${statGap}`}>
                {productionStat}
                {amountStat}
                {storageStat}
                {highGradeRow}
            </div>
            {xpBar}
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
    const { t } = useTranslation(['lobby', 'common']);
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
                <span className={`font-black text-amber-100 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{t('singleplayer.maxLevel')}</span>
            </div>
        );
    }

    const handleEnhance = async () => {
        if (isEnhancing) return;

        if (!hasEnoughXp) {
            setAlertMessage(t('singleplayer.alerts.insufficientXp'));
            return;
        }
        if (!hasUnlockStage && nextLevelUnlockStage) {
            setAlertMessage(t('singleplayer.alerts.enhanceAfterClear', { stageId: nextLevelUnlockStage }));
            return;
        }
        if (!model.hasEnoughGold) {
            setAlertMessage(t('singleplayer.alerts.insufficientGold'));
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

    return (
        <>
            <div className={`flex w-full shrink-0 flex-col justify-center gap-1 ${compact ? '' : 'gap-1.5'}`}>
                <Button
                    onClick={() => void handleEnhance()}
                    colorScheme="none"
                    className={`${PREMIUM_QUEST_BTN.upgrade} !w-full !flex-none ${compact ? '!py-1 !text-[9px] sm:!text-[10px]' : '!py-2.5 !text-sm sm:!text-base'}`}
                    disabled={isEnhancing || !hasEnoughXp}
                >
                    {isEnhancing ? (
                        t('singleplayer.enhancing')
                    ) : (
                        <span className="flex flex-col items-center justify-center gap-0.5 font-semibold leading-tight">
                            <span>{t('singleplayer.enhance')}</span>
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
