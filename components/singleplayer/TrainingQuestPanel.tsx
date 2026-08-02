import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { InventoryItem, UserWithStatus } from '../../types.js';
import { SINGLE_PLAYER_MISSIONS } from '../../constants/singlePlayerConstants.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import TrainingQuestLevelUpModal from './TrainingQuestLevelUpModal.js';
import { TrainingQuestNextLevelEffects, TrainingQuestEnhanceActions } from './TrainingQuestEnhancePanel.js';
import ClaimAllTrainingQuestRewardsModal from './ClaimAllTrainingQuestRewardsModal.js';
import TrainingQuestStartInfoModal from './TrainingQuestStartInfoModal.js';
import { audioService } from '../../services/audioService.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';
import {
    requiredEnhanceXpForLevel,
    upgradeGoldCostForLevel,
    type TrainingQuestRewardType,
} from '../../shared/utils/trainingQuestEconomy.js';

const rewardTypeIcon = (rewardType: TrainingQuestRewardType): string => {
    if (rewardType === 'gold') return '/images/icon/Gold.webp';
    if (rewardType === 'diamonds') return '/images/icon/Zem.webp';
    if (rewardType === 'enhance_stone') return '/images/materials/materials1.webp';
    return '/images/Box/EquipmentBox1.webp';
};

interface TrainingQuestPanelProps {
    currentUser: UserWithStatus;
    /** 네이티브 싱글플레이 상단 우측: 2×3 그리드로 6과제를 스크롤 없이 채움 */
    compactTopSlot?: boolean;
    /** 싱글플레이 로비 하단 탭(모바일): 제목 숨김·일괄수령, 컴팩트 카드 + 3×2 그리드(스크롤 없음) */
    embeddedInTab?: boolean;
    /** 프로필 홈 모달: 스크롤·카드 높이·크롬 최적화(창 제목과 중복되지 않게 헤더 생략) */
    embeddedInModal?: boolean;
}

const TrainingQuestPanel: React.FC<TrainingQuestPanelProps> = ({
    currentUser,
    compactTopSlot = false,
    embeddedInTab = false,
    embeddedInModal = false,
}) => {
    const { t } = useTranslation(['lobby', 'common']);
    const { handlers } = useAppContext();
    const [selectedMissionForUpgrade, setSelectedMissionForUpgrade] = useState<string | null>(null);
    const [selectedMissionForStart, setSelectedMissionForStart] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [claimAllRewards, setClaimAllRewards] = useState<{
        rewards: Array<{
            missionId: string;
            missionName: string;
            missionLevel?: number;
            rewardType: TrainingQuestRewardType;
            rewardAmount: number;
            claimCycles?: number;
        }>;
        totalGold: number;
        totalDiamonds: number;
        totalItemCycles?: number;
        items?: InventoryItem[];
        mode: 'preview' | 'claimed';
    } | null>(null);
    const [isClaimingAll, setIsClaimingAll] = useState(false);
    const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

    // 실시간 타이머 업데이트 (1초마다)
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    
    // currentUser가 변경되면 currentTime을 강제로 업데이트하여 claimableQuestsCount 재계산
    useEffect(() => {
        setCurrentTime(Date.now());
    }, [currentUser]);

    useEffect(() => {
        if (!actionErrorMessage) return;
        const timer = window.setTimeout(() => setActionErrorMessage(null), 5000);
        return () => window.clearTimeout(timer);
    }, [actionErrorMessage]);

    const getActionFailureMessage = (error: unknown, fallback: string): string => {
        if (error && typeof error === 'object') {
            const obj = error as { error?: unknown; message?: unknown };
            const fromError = typeof obj.error === 'string' ? obj.error : '';
            const fromMessage = typeof obj.message === 'string' ? obj.message : '';
            if (fromError) return fromError;
            if (fromMessage) return fromMessage;
        }
        if (error instanceof Error && error.message) return error.message;
        return fallback;
    };

    // 사용자의 수련 과제 상태
    const trainingQuests = useMemo(() => {
        const userMissions = (currentUser as any).singlePlayerMissions || {};
        const userLevel =
            Number((currentUser as { userLevel?: number; level?: number }).userLevel) ||
            Number((currentUser as { level?: number }).level) ||
            1;
        return SINGLE_PLAYER_MISSIONS.map(mission => {
            const missionState = userMissions[mission.id];
            const currentLevel = missionState?.level || 0;
            const levelInfo = currentLevel > 0 && currentLevel <= mission.levels.length 
                ? mission.levels[currentLevel - 1] 
                : null;
            const isUnlocked = userLevel >= (mission.unlockUserLevel ?? 1);
            
            return {
                ...mission,
                missionState,
                currentLevel,
                levelInfo,
                isUnlocked,
                isStarted: missionState?.isStarted || false,
            };
        });
    }, [currentUser]);

    // 실시간 재화 계산 (막대그래프용)
    const calculateRewardAndProgress = (quest: any) => {
        if (!quest.isUnlocked || !quest.isStarted || !quest.levelInfo) {
            return { reward: 0, progress: 0, timeUntilNext: 0, isMax: false };
        }
        
        const productionRateMs = quest.levelInfo.productionRateMinutes * 60 * 1000;
        const lastCollectionTime = quest.missionState?.lastCollectionTime || currentTime;
        const elapsed = currentTime - lastCollectionTime;
        const cycles = Math.floor(elapsed / productionRateMs);
        const accumulatedAmount = quest.missionState?.accumulatedAmount || 0;
        
        // Max 상태 확인 (서버에서도 체크하지만 클라이언트에서도 확인)
        const isMax = accumulatedAmount >= quest.levelInfo.maxCapacity;
        
        // Max일 때는 타이머 멈춤
        if (isMax) {
            return {
                reward: accumulatedAmount,
                progress: 100,
                timeUntilNext: 0,
                isMax: true,
            };
        }
        
        // 생산량 계산
        let reward = accumulatedAmount;
        if (cycles > 0) {
            const generatedAmount = cycles * quest.levelInfo.rewardAmount;
            reward = Math.min(quest.levelInfo.maxCapacity, accumulatedAmount + generatedAmount);
        }
        
        // 진행도 계산 (0-100%)
        const progress = (reward / quest.levelInfo.maxCapacity) * 100;
        
        // 다음 생산까지 남은 시간 계산
        const timeSinceLastCycle = elapsed % productionRateMs;
        const timeUntilNext = productionRateMs - timeSinceLastCycle;
        
        return {
            reward,
            progress: Math.min(100, progress),
            timeUntilNext,
            isMax: reward >= quest.levelInfo.maxCapacity,
        };
    };
    
    // 레벨업 조건 계산
    const getLevelUpInfo = (quest: any) => {
        if (!quest.isStarted || quest.currentLevel >= 10) return null;
        
        // 다음 레벨 정보 확인 (필수)
        const nextLevelInfo = quest.levels && quest.levels[quest.currentLevel];
        if (!nextLevelInfo) return null;
        
        const requiredCollection =
            quest.currentLevel === 0 || !quest.levelInfo
                ? 0
                : requiredEnhanceXpForLevel(quest.levelInfo, quest.currentLevel);
        const accumulatedCollection = quest.missionState?.accumulatedCollection || 0;
        const progress = requiredCollection === 0 ? 100 : Math.min(100, (accumulatedCollection / requiredCollection) * 100);
        const upgradeCost =
            quest.levelInfo && quest.currentLevel > 0
                ? upgradeGoldCostForLevel(quest.levelInfo, quest.rewardType)
                : quest.levels?.[0]
                  ? upgradeGoldCostForLevel(quest.levels[0], quest.rewardType)
                  : 0;

        const hasEnoughXp =
            quest.currentLevel === 0 || accumulatedCollection >= requiredCollection;
        const userLevel =
            Number((currentUser as { userLevel?: number; level?: number }).userLevel) ||
            Number((currentUser as { level?: number }).level) ||
            1;
        const hasUnlockStage = userLevel >= (quest.unlockUserLevel ?? 1);
        const canLevelUp = hasEnoughXp && hasUnlockStage;

        return {
            requiredCollection,
            accumulatedCollection,
            progress,
            upgradeCost,
            canLevelUp,
            hasEnoughXp,
            hasUnlockStage,
            nextLevelUnlockStage: undefined,
        };
    };

    // 시간 포맷팅 (분:초)
    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // 미션 시작
    const handleOpenStartMissionModal = (missionId: string) => {
        setSelectedMissionForStart(missionId);
    };

    const handleStartMission = async (missionId: string) => {
        setActionErrorMessage(null);
        try {
            const result = await handlers.handleAction({
                type: 'START_SINGLE_PLAYER_MISSION',
                payload: { missionId }
            });
            if ((result as any)?.error) {
                setActionErrorMessage(getActionFailureMessage(result, t('singleplayer.errors.startMissionFailed')));
                return;
            }
            setSelectedMissionForStart(null);
        } catch (error) {
            console.error('[TrainingQuestPanel] Start mission error:', error);
            setActionErrorMessage(getActionFailureMessage(error, t('singleplayer.errors.startMissionFailed')));
        }
    };

    // 재화 수령
    const handleCollectReward = async (missionId: string) => {
        setActionErrorMessage(null);
        try {
            // 사운드는 RewardSummaryModal(useApp)에서 한 번만 재생
            const result = await handlers.handleAction({
                type: 'CLAIM_SINGLE_PLAYER_MISSION_REWARD',
                payload: { missionId }
            });
            if ((result as any)?.error) {
                setActionErrorMessage(getActionFailureMessage(result, t('singleplayer.errors.claimRewardFailed')));
            }
        } catch (error) {
            console.error('[TrainingQuestPanel] Collect reward error:', error);
            setActionErrorMessage(getActionFailureMessage(error, t('singleplayer.errors.claimRewardFailed')));
        }
    };

    // 레벨업 모달 열기
    const handleLevelUpClick = (missionId: string) => {
        setSelectedMissionForUpgrade(missionId);
    };

    // 레벨업 확인
    const handleLevelUpConfirm = async (missionId: string) => {
        setActionErrorMessage(null);
        try {
            const result = await handlers.handleAction({
                type: 'LEVEL_UP_TRAINING_QUEST',
                payload: { missionId }
            });
            if ((result as any)?.error) {
                setActionErrorMessage(getActionFailureMessage(result, t('singleplayer.errors.enhanceFailed')));
                return;
            }

            // 모달을 닫지 않고 유지하여 강화된 정보로 동기화되도록 함
            // WebSocket 업데이트를 기다려서 인벤토리가 업데이트되면 모달이 자동으로 강화된 정보를 표시
            // 모달은 사용자가 직접 닫을 때까지 열려있음
            await new Promise(resolve => setTimeout(resolve, 200)); // WebSocket 업데이트 대기
        } catch (error) {
            console.error('[TrainingQuestPanel] Level up error:', error);
            setActionErrorMessage(getActionFailureMessage(error, t('singleplayer.errors.enhanceFailed')));
        }
    };

    // 선택된 미션 정보
    const selectedQuest = selectedMissionForUpgrade 
        ? trainingQuests.find(q => q.id === selectedMissionForUpgrade)
        : null;
    const selectedLevelUpInfo = selectedQuest ? getLevelUpInfo(selectedQuest) : null;
    const selectedStartQuest = selectedMissionForStart
        ? trainingQuests.find((q) => q.id === selectedMissionForStart)
        : null;
    const selectedStartLevelInfo = selectedStartQuest?.levels?.[0];
    
    // 수령 가능한 과제 수 계산
    const claimableQuestsCount = useMemo(() => {
        return trainingQuests.filter(quest => {
            if (!quest.isUnlocked || !quest.isStarted || !quest.levelInfo) return false;
            const { reward } = calculateRewardAndProgress(quest);
            return reward > 0;
        }).length;
    }, [trainingQuests, currentTime]);
    
    const parseClaimAllData = (result: any) =>
        result?.claimAllTrainingQuestRewards ?? result?.clientResponse?.claimAllTrainingQuestRewards ?? null;

    // 일괄 수령 핸들러: 먼저 미리보기만 불러와 사용자가 수령 방식을 고르게 한다.
    const handleClaimAllRewards = async () => {
        if (isClaimingAll || claimableQuestsCount === 0) return;
        
        setIsClaimingAll(true);
        setActionErrorMessage(null);
        try {
            const result = await handlers.handleAction({
                type: 'CLAIM_ALL_TRAINING_QUEST_REWARDS',
                payload: { previewOnly: true },
            }) as any;
            if (result?.error) {
                setActionErrorMessage(getActionFailureMessage(result, t('singleplayer.errors.claimAllFailed')));
                return;
            }
            
            // 응답 구조 확인: handleAction에서 반환된 값
            const claimAllData = parseClaimAllData(result);
            
            if (claimAllData) {
                setClaimAllRewards({
                    rewards: claimAllData.rewards || [],
                    totalGold: claimAllData.totalGold || 0,
                    totalDiamonds: claimAllData.totalDiamonds || 0,
                    items: undefined,
                    mode: 'preview',
                });
            } else {
                console.warn('[TrainingQuestPanel] Claim all rewards - No claimAllTrainingQuestRewards in response:', result);
                setActionErrorMessage(t('singleplayer.errors.claimAllResultMissing'));
            }
        } catch (error) {
            console.error('[TrainingQuestPanel] Claim all rewards error:', error);
            setActionErrorMessage(getActionFailureMessage(error, t('singleplayer.errors.claimAllFailed')));
        } finally {
            setIsClaimingAll(false);
        }
    };

    const claimAllFromPreview = async (adDouble: boolean): Promise<boolean> => {
        if (isClaimingAll) return false;
        setIsClaimingAll(true);
        setActionErrorMessage(null);
        try {
            const result = await handlers.handleAction({
                type: 'CLAIM_ALL_TRAINING_QUEST_REWARDS',
                payload: { adDouble },
            }) as any;
            if (result?.error) {
                setActionErrorMessage(getActionFailureMessage(result, t('singleplayer.errors.claimAllFailed')));
                return false;
            }
            const claimAllData = parseClaimAllData(result);
            if (!claimAllData) {
                console.warn('[TrainingQuestPanel] Claim all rewards - No claimAllTrainingQuestRewards in response:', result);
                setActionErrorMessage(t('singleplayer.errors.claimAllResultMissing'));
                return false;
            }

            audioService.claimReward();
            setClaimAllRewards({
                rewards: claimAllData.rewards || [],
                totalGold: claimAllData.totalGold || 0,
                totalDiamonds: claimAllData.totalDiamonds || 0,
                items: Array.isArray(claimAllData.items) ? claimAllData.items : [],
                mode: 'claimed',
            });
            return true;
        } catch (error) {
            console.error('[TrainingQuestPanel] Claim all rewards error:', error);
            setActionErrorMessage(getActionFailureMessage(error, t('singleplayer.errors.claimAllFailed')));
            return false;
        } finally {
            setIsClaimingAll(false);
        }
    };

    const effectiveCompactTop = compactTopSlot && !embeddedInTab;
    const inModal = embeddedInModal;
    /** 모바일 탭·네이티브 상단: 컴팩트 카드. PC 모달·홈 인라인: 스크롤 가능한 시설 카드 + 인라인 강화 */
    const useCompactQuestCard = effectiveCompactTop || embeddedInTab;
    const embeddedTabNarrow = embeddedInTab && !effectiveCompactTop;
    const embeddedQuestBtnTight = embeddedTabNarrow
        ? ' !text-[9px] !leading-tight !px-0.5 !py-0.5 [&_img]:!h-2.5 [&_img]:!w-2.5'
        : '';
    const isAdminUser = !!currentUser.isAdmin;

    return (
        <>
            <div
                className={`flex flex-col overflow-hidden ${
                    embeddedInTab
                        ? 'h-full min-h-0 rounded-lg bg-panel p-1.5 shadow-lg'
                        : effectiveCompactTop
                          ? 'h-full min-h-0 rounded-lg bg-panel p-1.5 shadow-lg'
                          : inModal
                            ? 'relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#1a1710] via-[#0c0e12] to-black p-2 shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_20px_48px_-28px_rgba(0,0,0,0.9)] ring-1 ring-amber-100/10 sm:p-2.5'
                            : 'h-full rounded-lg bg-panel p-1.5 shadow-lg sm:p-2'
                }`}
            >
                {inModal ? null : embeddedInTab ? (
                    <div className="mb-2 flex flex-shrink-0 justify-end border-b border-color/60 pb-2">
                        <Button
                            onClick={handleClaimAllRewards}
                            colorScheme="none"
                            className={`${PREMIUM_QUEST_BTN.claimAll} !text-sm sm:!text-base`}
                            disabled={isClaimingAll || claimableQuestsCount === 0}
                        >
                            {isClaimingAll ? t('singleplayer.claiming') : t('singleplayer.claimAll', { count: claimableQuestsCount })}
                        </Button>
                    </div>
                ) : (
                    <div
                        className={`flex flex-shrink-0 items-center justify-between border-b border-color ${effectiveCompactTop ? 'mb-0.5 pb-0.5' : 'mb-1 pb-0.5 sm:mb-1.5 sm:pb-1'}`}
                    >
                        <h2 className={`font-bold text-on-panel ${effectiveCompactTop ? 'text-sm' : 'text-base sm:text-lg'}`}>{t('singleplayer.trainingQuest')}</h2>
                        <Button
                            onClick={handleClaimAllRewards}
                            colorScheme="none"
                            className={PREMIUM_QUEST_BTN.claimAll}
                            disabled={isClaimingAll || claimableQuestsCount === 0}
                        >
                            {isClaimingAll ? t('singleplayer.claiming') : t('singleplayer.claimAll', { count: claimableQuestsCount })}
                        </Button>
                    </div>
                )}

                {actionErrorMessage && (
                    <div
                        className={`mb-1 rounded-lg border border-red-400/50 bg-red-950/70 px-2 py-1 text-center font-medium leading-snug text-red-100 ${
                            embeddedInTab || effectiveCompactTop || inModal ? 'text-[10px]' : 'text-xs sm:text-sm'
                        }`}
                        role="alert"
                    >
                        {actionErrorMessage}
                    </div>
                )}

                {/* 시설 카드 그리드 */}
                <div
                    className={`min-h-0 flex-1 ${
                        embeddedInTab || effectiveCompactTop
                            ? 'min-h-0 overflow-hidden'
                            : inModal
                              ? 'min-h-0 flex-1 overflow-hidden'
                              : 'overflow-hidden'
                    }`}
                >
                    <div
                        className={`grid min-h-0 ${
                            effectiveCompactTop
                                ? 'h-full grid-cols-2 grid-rows-4 gap-1.5'
                                : embeddedInTab
                                  ? 'h-full grid-cols-2 grid-rows-4 gap-1'
                                  : inModal
                                    ? 'h-full min-h-0 w-full grid-cols-2 grid-rows-4 items-stretch gap-1.5 overflow-hidden sm:gap-2'
                                    : 'grid h-full grid-cols-2 grid-rows-4 gap-1 sm:gap-1.5'
                        }`}
                    >
                        {trainingQuests.map((quest) => {
                            const { reward, progress, timeUntilNext, isMax } = calculateRewardAndProgress(quest);
                            const isMaxLevel = quest.currentLevel >= 10;
                            const levelUpInfo = getLevelUpInfo(quest);
                            const canCollect = reward > 0;
                            return (
                                <div
                                    key={quest.id}
                                    className={
                                        inModal
                                            ? `group/factory relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-2 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.85)] transition-[border-color,box-shadow] duration-300 sm:p-2.5 ${
                                                  quest.isUnlocked
                                                      ? 'border-amber-400/35 bg-gradient-to-br from-[#2a2318]/95 via-[#12151c] to-[#0a0c10] ring-1 ring-inset ring-amber-200/10 hover:border-amber-300/50 hover:shadow-[0_16px_36px_-16px_rgba(245,158,11,0.28)]'
                                                      : 'border-zinc-700/70 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black ring-1 ring-inset ring-white/[0.04]'
                                              }`
                                            : `
                                        relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2
                                        ${useCompactQuestCard ? `h-full min-h-0 ${embeddedTabNarrow ? 'p-1' : 'p-1.5'}` : 'h-auto p-1 sm:p-1.5'}
                                        ${quest.isUnlocked ? 'border-primary bg-tertiary' : 'border-gray-600 bg-tertiary'}
                                    `
                                    }
                                >
                                    {inModal && quest.isUnlocked ? (
                                        <div
                                            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.16),transparent_68%)] opacity-90"
                                            aria-hidden
                                        />
                                    ) : null}
                                    {!quest.isUnlocked && (
                                        <>
                                            {/* 잠김 오버레이 - 반투명 배경 (버튼 클릭은 막지만 UI는 보이도록) */}
                                            <div
                                                className={`pointer-events-none absolute inset-0 z-30 ${
                                                    inModal
                                                        ? 'rounded-2xl bg-gradient-to-b from-black/55 via-zinc-950/70 to-black/80 backdrop-blur-[1px]'
                                                        : embeddedTabNarrow
                                                          ? 'rounded-md bg-gray-900/50'
                                                          : 'rounded-lg bg-gray-900/50'
                                                }`}
                                            />
                                            {/* 잠김 아이콘 및 텍스트 - 카드 중앙 배치 */}
                                            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
                                                <div className={`flex flex-col items-center ${inModal ? 'gap-1.5' : 'gap-1.5'}`}>
                                                    <div
                                                        className={`filter drop-shadow-[0_3px_8px_rgba(0,0,0,0.85)] ${
                                                            inModal ? 'text-[1.75rem]' : 'text-2xl sm:text-[1.75rem]'
                                                        }`}
                                                        aria-hidden
                                                    >
                                                        🔒
                                                    </div>
                                                    <div
                                                        className={`rounded-lg border border-amber-200/60 bg-black/90 shadow-lg ${inModal ? 'px-2.5 py-1' : 'px-3 py-1.5 sm:px-3.5 sm:py-2'}`}
                                                    >
                                                        <span
                                                            className={`block whitespace-nowrap text-center font-black leading-tight text-amber-100 ${
                                                                inModal
                                                                    ? 'text-[10px] tracking-wide'
                                                                    : useCompactQuestCard
                                                                      ? embeddedTabNarrow
                                                                          ? 'text-[10px]'
                                                                          : 'text-[13px] sm:text-[14px]'
                                                                      : 'text-xs sm:text-sm'
                                                            }`}
                                                        >
                                                            {t('singleplayer.unlockRequiredLevel', { level: quest.unlockUserLevel })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {inModal ? (
                                        <div
                                            className={`relative z-0 flex h-full min-h-0 w-full min-w-0 flex-col gap-1.5 antialiased ${
                                                !quest.isUnlocked ? 'opacity-55' : ''
                                            }`}
                                        >
                                            {/*
                                              [이미지][제목]
                                                         [부제목]
                                                         [생산현황] [수령]
                                              [생산정보][강화버튼]
                                            */}
                                            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
                                                <div className="flex min-w-0 items-start gap-2.5">
                                                    <div className="relative h-[5rem] w-[5rem] shrink-0 overflow-hidden rounded-xl bg-zinc-950 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.9)] ring-1 ring-amber-200/30 sm:h-[5.5rem] sm:w-[5.5rem]">
                                                        <img
                                                            src={quest.image}
                                                            alt=""
                                                            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover/factory:scale-[1.04]"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                        <div className="flex min-w-0 items-center gap-1.5">
                                                            <span className="inline-flex shrink-0 items-center rounded-md border border-amber-300/50 bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-black tabular-nums leading-none tracking-wide text-amber-100">
                                                                Lv.{quest.currentLevel || 0}
                                                            </span>
                                                            <h3
                                                                className="min-w-0 text-[13px] font-black leading-snug tracking-wide text-amber-50 sm:text-sm"
                                                                style={{ textShadow: '0 1px 8px rgba(0,0,0,0.65)' }}
                                                            >
                                                                {quest.name}
                                                            </h3>
                                                        </div>
                                                        <p className="line-clamp-2 text-[10px] font-medium leading-snug text-amber-100/65 sm:text-[11px]">
                                                            {quest.description}
                                                        </p>

                                                        {quest.isUnlocked && quest.isStarted && quest.levelInfo ? (
                                                            <div className="flex min-w-0 items-stretch gap-1.5">
                                                                {/* 생산현황: 주기 + 타이머·보관 + 게이지 */}
                                                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                                                                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5 text-[10px] font-semibold sm:text-[11px]">
                                                                        <span
                                                                            className="inline-flex min-w-0 items-center gap-1 text-emerald-100"
                                                                            title={t('singleplayer.productionRateTitle', {
                                                                                minutes: quest.levelInfo.productionRateMinutes,
                                                                                amount: quest.levelInfo.rewardAmount,
                                                                            })}
                                                                        >
                                                                            <span className="tabular-nums">
                                                                                {t('singleplayer.productionRate', {
                                                                                    minutes: quest.levelInfo.productionRateMinutes,
                                                                                    amount: quest.levelInfo.rewardAmount,
                                                                                })}
                                                                            </span>
                                                                            <img
                                                                                src={
                                                                                    rewardTypeIcon(quest.rewardType)
                                                                                }
                                                                                alt=""
                                                                                className="h-3.5 w-3.5 shrink-0"
                                                                            />
                                                                        </span>
                                                                        <span className="shrink-0 tabular-nums text-amber-50/90">
                                                                            {!isMax && timeUntilNext > 0 ? (
                                                                                formatTime(timeUntilNext)
                                                                            ) : isMax ? (
                                                                                <span className="font-bold text-emerald-300">MAX</span>
                                                                            ) : (
                                                                                <span className="text-slate-400">--:--</span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-black/70 ring-1 ring-amber-200/15">
                                                                        <div
                                                                            className={`h-full transition-all duration-300 ${
                                                                                isMax
                                                                                    ? 'bg-gradient-to-r from-emerald-500 to-lime-400'
                                                                                    : 'bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300'
                                                                            }`}
                                                                            style={{ width: `${progress}%` }}
                                                                        />
                                                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-1">
                                                                            <span className="text-[9px] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[10px]">
                                                                                {`${reward.toLocaleString()} / ${quest.levelInfo.maxCapacity.toLocaleString()}`}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {/* 수령 — 강화 버튼과 동일 폭 */}
                                                                <Button
                                                                    onClick={() => handleCollectReward(quest.id)}
                                                                    colorScheme="none"
                                                                    className={`${PREMIUM_QUEST_BTN.claim} !w-[5.75rem] !min-w-[5.75rem] !max-w-[5.75rem] !flex-none !px-1.5 !py-1 !text-[11px] sm:!text-xs`}
                                                                    disabled={!canCollect}
                                                                >
                                                                    <span className="inline-flex items-center justify-center gap-0.5 leading-tight">
                                                                        <span>{t('singleplayer.claim')}</span>
                                                                        <img
                                                                            src={
                                                                                rewardTypeIcon(quest.rewardType)
                                                                            }
                                                                            alt=""
                                                                            className="h-3 w-3 shrink-0"
                                                                        />
                                                                        <span className="tabular-nums">
                                                                            {reward > 0 ? reward.toLocaleString() : 0}
                                                                        </span>
                                                                    </span>
                                                                </Button>
                                                            </div>
                                                        ) : !quest.isUnlocked ? (
                                                            <p className="text-[10px] leading-snug text-zinc-400 sm:text-[11px]">
                                                                {t('singleplayer.unlockedAfterClear')}
                                                            </p>
                                                        ) : !quest.isStarted ? (
                                                            <div className="flex min-w-0 items-center gap-1.5">
                                                                <p className="min-w-0 flex-1 text-[10px] leading-snug text-amber-100/70 sm:text-[11px]">
                                                                    {t('singleplayer.productionInfoAfterStart')}
                                                                </p>
                                                                <Button
                                                                    onClick={() => handleOpenStartMissionModal(quest.id)}
                                                                    colorScheme="none"
                                                                    className={`${PREMIUM_QUEST_BTN.start} !w-[5.75rem] !min-w-[5.75rem] !max-w-[5.75rem] !flex-none !px-1.5 !py-1 !text-xs`}
                                                                >
                                                                    {t('singleplayer.start')}
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] text-slate-400">{t('singleplayer.shownAfterStart')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* [생산정보] [강화버튼] — 최대 레벨이어도 생산/생산량/저장 표시 */}
                                            {quest.isUnlocked && quest.isStarted && quest.levelInfo ? (
                                                <div className="flex min-h-0 min-w-0 shrink-0 items-stretch gap-1.5">
                                                    <div className="flex min-w-0 flex-1 flex-col justify-center rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-950/35 via-black/40 to-orange-950/25 p-1.5 ring-1 ring-inset ring-amber-200/10 sm:p-2">
                                                        {isMaxLevel || levelUpInfo ? (
                                                            <TrainingQuestNextLevelEffects
                                                                mission={quest}
                                                                currentLevel={quest.currentLevel}
                                                                upgradeCost={levelUpInfo?.upgradeCost ?? 0}
                                                                canLevelUp={levelUpInfo?.canLevelUp ?? false}
                                                                nextLevelUnlockStage={levelUpInfo?.nextLevelUnlockStage}
                                                                currentUserGold={currentUser.gold}
                                                                accumulatedCollection={levelUpInfo?.accumulatedCollection ?? 0}
                                                                requiredCollection={levelUpInfo?.requiredCollection ?? 0}
                                                                progressPercent={levelUpInfo?.progress ?? 100}
                                                                onConfirm={() => handleLevelUpConfirm(quest.id)}
                                                                hideHeader
                                                                compact
                                                                horizontal
                                                            />
                                                        ) : null}
                                                    </div>
                                                    {!isMaxLevel && levelUpInfo ? (
                                                        <div className="flex w-[5.75rem] shrink-0 flex-col justify-center">
                                                            <TrainingQuestEnhanceActions
                                                                mission={quest}
                                                                currentLevel={quest.currentLevel}
                                                                upgradeCost={levelUpInfo.upgradeCost}
                                                                canLevelUp={levelUpInfo.canLevelUp}
                                                                hasEnoughXp={levelUpInfo.hasEnoughXp}
                                                                hasUnlockStage={levelUpInfo.hasUnlockStage}
                                                                nextLevelUnlockStage={levelUpInfo.nextLevelUnlockStage}
                                                                currentUserGold={currentUser.gold}
                                                                accumulatedCollection={levelUpInfo.accumulatedCollection}
                                                                requiredCollection={levelUpInfo.requiredCollection}
                                                                progressPercent={levelUpInfo.progress}
                                                                onConfirm={() => handleLevelUpConfirm(quest.id)}
                                                                compact
                                                            />
                                                        </div>
                                                    ) : isMaxLevel ? (
                                                        <div className="flex w-[5.75rem] shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-950/20">
                                                            <span className="text-[10px] font-black text-amber-100">
                                                                {t('singleplayer.maxLevel')}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : useCompactQuestCard ? (
                                        <>
                                            {embeddedTabNarrow ? (
                                                <>
                                                    <div className={`mb-0.5 flex flex-shrink-0 flex-col items-center ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                        <div className="flex w-[58px] shrink-0 flex-col overflow-hidden rounded-xl bg-gray-700 ring-1 ring-white/10">
                                                            <div className="relative aspect-square w-full overflow-hidden">
                                                                <img
                                                                    src={quest.image}
                                                                    alt={quest.name}
                                                                    className="h-full w-full object-cover"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex w-full shrink-0 items-center justify-center border-t border-amber-400/45 bg-gradient-to-b from-zinc-950 to-black py-0.5">
                                                                <span className="text-[10px] font-black tabular-nums text-amber-100">
                                                                    Lv.{quest.currentLevel || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <h3
                                                            className={`mt-0.5 line-clamp-2 w-full px-0.5 text-center text-[10px] font-bold leading-snug antialiased ${
                                                                quest.isUnlocked ? 'text-on-panel' : 'text-gray-400'
                                                            }`}
                                                            title={quest.name}
                                                        >
                                                            {quest.name}
                                                        </h3>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {/* 네이티브 상단: 썸네일 + 제목/설명 (생산·타이머는 게이지 바로 위) */}
                                                    <div className={`mb-0.5 sm:mb-1 flex-shrink-0 ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                        <div className="flex items-start gap-1.5">
                                                            <div className="flex w-[56px] shrink-0 flex-col overflow-hidden rounded-xl bg-gray-700 ring-1 ring-white/10">
                                                                <div className="relative aspect-square w-full overflow-hidden">
                                                                    <img
                                                                        src={quest.image}
                                                                        alt={quest.name}
                                                                        className="h-full w-full object-cover"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="flex w-full shrink-0 items-center justify-center border-t border-amber-400/45 bg-gradient-to-b from-zinc-950 to-black py-0.5">
                                                                    <span className="text-[10px] font-black tabular-nums text-amber-100 sm:text-[11px]">
                                                                        Lv.{quest.currentLevel || 0}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="mb-0.5 flex items-center justify-between gap-1">
                                                                    <h3 className={`truncate text-[13px] font-bold antialiased ${quest.isUnlocked ? 'text-on-panel' : 'text-gray-400'}`}>
                                                                        {quest.name}
                                                                    </h3>
                                                                </div>
                                                                <p
                                                                    className="mb-0.5 line-clamp-2 text-left text-[11px] font-medium leading-snug text-slate-300 antialiased"
                                                                    title={quest.description}
                                                                >
                                                                    {quest.description}
                                                                </p>
                                                                {!quest.levelInfo && (
                                                                    <div className="text-[11px] font-medium leading-snug text-slate-500">
                                                                        <div>{t('singleplayer.productionAfterStart')}</div>
                                                                        <div>{t('singleplayer.timerPlaceholder')}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <div className={`mb-0.5 sm:mb-1 flex min-w-0 flex-shrink-0 flex-col gap-0.5 sm:gap-0.5 ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                {quest.levelInfo ? (
                                                    <>
                                                        <div
                                                            className={`flex min-w-0 justify-end gap-2 font-semibold leading-none text-slate-100 antialiased ${embeddedTabNarrow ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}
                                                        >
                                                            <span
                                                                className={`flex min-w-0 items-center gap-0.5 ${embeddedTabNarrow ? 'max-w-[58%]' : 'max-w-[80%]'} ${quest.isUnlocked ? 'text-sky-200' : 'text-gray-500'}`}
                                                                title={t('singleplayer.productionRateTitle', { minutes: quest.levelInfo.productionRateMinutes, amount: quest.levelInfo.rewardAmount })}
                                                            >
                                                                {embeddedTabNarrow ? (
                                                                    <>
                                                                        <span className="min-w-0 truncate tabular-nums whitespace-nowrap">
                                                                            {t('singleplayer.productionRateCompact', { minutes: quest.levelInfo.productionRateMinutes, amount: quest.levelInfo.rewardAmount })}
                                                                        </span>
                                                                        <img
                                                                            src={rewardTypeIcon(quest.rewardType)}
                                                                            alt={quest.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds')}
                                                                            className="h-3 w-3 shrink-0 object-contain opacity-95"
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="shrink-0 whitespace-nowrap">
                                                                            {t('singleplayer.productionRate', { minutes: quest.levelInfo.productionRateMinutes, amount: quest.levelInfo.rewardAmount })}
                                                                        </span>
                                                                        <img
                                                                            src={rewardTypeIcon(quest.rewardType)}
                                                                            alt={quest.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds')}
                                                                            className="h-3.5 w-3.5 shrink-0 object-contain opacity-95"
                                                                        />
                                                                    </>
                                                                )}
                                                            </span>
                                                            <span className="shrink-0 tabular-nums tracking-tight text-slate-100">
                                                                {quest.isUnlocked && quest.isStarted && !isMax && timeUntilNext > 0 ? (
                                                                    formatTime(timeUntilNext)
                                                                ) : quest.isUnlocked && quest.isStarted && isMax ? (
                                                                    <span className="font-bold text-emerald-300">MAX</span>
                                                                ) : quest.isUnlocked && quest.isStarted ? (
                                                                    <span className="text-slate-400">--:--</span>
                                                                ) : (
                                                                    <span className="text-slate-500">{quest.isUnlocked ? '--:--' : t('singleplayer.locked')}</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="relative">
                                                            <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-700">
                                                                {quest.isUnlocked && quest.isStarted ? (
                                                                    <div
                                                                        className={`h-full transition-all duration-300 ${
                                                                            isMax ? 'bg-green-500' : 'bg-blue-500'
                                                                        }`}
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                ) : (
                                                                    <div className="h-full bg-gray-600" style={{ width: '0%' }} />
                                                                )}
                                                            </div>
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <span className="text-[11px] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-xs">
                                                                    {quest.isUnlocked && quest.isStarted
                                                                        ? `${reward.toLocaleString()} / ${quest.levelInfo.maxCapacity.toLocaleString()}`
                                                                        : `0 / ${quest.levelInfo.maxCapacity.toLocaleString()}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="space-y-0.5 sm:space-y-1">
                                                        <div className="relative">
                                                            <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-700">
                                                                <div className="h-full bg-gray-600" style={{ width: '0%' }} />
                                                            </div>
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <span className="text-[10px] font-bold drop-shadow-md text-white">0 / -</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {levelUpInfo && !isMaxLevel && quest.isStarted && (
                                                <div className={`mb-0.5 sm:mb-1 flex-shrink-0 ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-700/70">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-300"
                                                            style={{ width: `${levelUpInfo.progress}%` }}
                                                        />
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <span className="text-[10px] font-bold tabular-nums text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[11px]">
                                                                    {Math.floor(levelUpInfo.progress)}%
                                                                </span>
                                                            </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className={`mt-auto flex flex-shrink-0 flex-row ${embeddedTabNarrow ? 'gap-0.5' : 'gap-0.5 sm:gap-1'}`}>
                                                {!quest.isUnlocked ? (
                                                    <>
                                                        <Button
                                                            disabled
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.claim} opacity-50${embeddedQuestBtnTight}`}
                                                        >
                                                            <span className={`flex items-center ${embeddedTabNarrow ? 'gap-0.5' : 'gap-1'}`}>
                                                                <span>{t('singleplayer.claim')}</span>
                                                                <img
                                                                    src={rewardTypeIcon(quest.rewardType)}
                                                                    alt={quest.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds')}
                                                                    className={`object-contain ${embeddedTabNarrow ? 'h-2.5 w-2.5' : 'h-3 w-3'}`}
                                                                />
                                                                <span>0</span>
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            disabled
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.upgrade} opacity-50${embeddedQuestBtnTight}`}
                                                        >
                                                            {t('singleplayer.enhance')}
                                                        </Button>
                                                    </>
                                                ) : !quest.isStarted ? (
                                                    <>
                                                        <Button
                                                            onClick={() => handleOpenStartMissionModal(quest.id)}
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.start}${embeddedQuestBtnTight}`}
                                                        >
                                                            {t('singleplayer.start')}
                                                        </Button>
                                                        {isAdminUser && quest.id === 'mission_attendance' && (
                                                            <Button
                                                                onClick={() => handleOpenStartMissionModal(quest.id)}
                                                                colorScheme="none"
                                                                className={`!rounded-lg !border !border-amber-300/50 !bg-gradient-to-b !from-amber-400/90 !via-orange-700 !to-amber-950 !text-[11px] !font-bold !text-amber-50 !shadow-[0_2px_12px_rgba(245,158,11,0.35)] hover:!brightness-110 sm:!text-xs${embeddedQuestBtnTight}`}
                                                            >
                                                                {t('singleplayer.startSample')}
                                                            </Button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            onClick={() => handleCollectReward(quest.id)}
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.claim}${embeddedQuestBtnTight}`}
                                                            disabled={!canCollect}
                                                        >
                                                            <span className={`flex items-center ${embeddedTabNarrow ? 'gap-0.5' : 'gap-1'}`}>
                                                                <span>{t('singleplayer.claim')}</span>
                                                                <img
                                                                    src={rewardTypeIcon(quest.rewardType)}
                                                                    alt={quest.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds')}
                                                                    className={`flex-shrink-0 object-contain ${embeddedTabNarrow ? 'h-2.5 w-2.5' : 'h-3 w-3'}`}
                                                                />
                                                                <span>{reward > 0 ? reward.toLocaleString() : 0}</span>
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleLevelUpClick(quest.id)}
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.upgrade}${embeddedQuestBtnTight}`}
                                                            disabled={isMaxLevel || !(levelUpInfo?.hasEnoughXp ?? false)}
                                                        >
                                                            {t('singleplayer.enhance')}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* PC: 썸네일 + 하단 Lv 패널 */}
                                            <div
                                                className={`mx-auto mb-0.5 flex w-[46%] max-w-[108px] flex-shrink-0 flex-col overflow-hidden rounded-xl bg-gray-700 ring-1 ring-white/10 sm:mb-1 sm:max-w-[120px] ${
                                                    !quest.isUnlocked ? 'opacity-50' : ''
                                                }`}
                                            >
                                                <div className="relative aspect-square w-full overflow-hidden">
                                                    <img
                                                        src={quest.image}
                                                        alt={quest.name}
                                                        className="h-full w-full object-cover object-center"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex w-full shrink-0 items-center justify-center border-t border-amber-400/45 bg-gradient-to-b from-zinc-950 to-black py-1 sm:py-1.5">
                                                    <span className="text-[11px] font-black tabular-nums tracking-tight text-amber-100 sm:text-[12px]">
                                                        Lv.{quest.currentLevel || 0}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mb-0.5 min-h-0 flex-shrink-0 sm:mb-1">
                                                <h3
                                                    className={`truncate text-[13px] font-bold antialiased sm:text-sm ${
                                                        quest.isUnlocked ? 'text-on-panel' : 'text-gray-400'
                                                    }`}
                                                >
                                                    {quest.name}
                                                </h3>
                                                <p
                                                    className="mt-0.5 line-clamp-3 text-left text-[11px] font-medium leading-snug text-slate-300 antialiased sm:line-clamp-4 sm:text-xs"
                                                    title={quest.description}
                                                >
                                                    {quest.description}
                                                </p>
                                            </div>

                                            <div className={`mb-0.5 flex min-h-0 flex-1 flex-col gap-1 sm:mb-1 ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                {quest.levelInfo ? (
                                                    <>
                                                        <div className="flex justify-end gap-3 text-xs font-semibold leading-none text-slate-100 antialiased sm:text-[13px]">
                                                            <span
                                                                className={`flex min-w-0 max-w-[72%] items-center gap-1 truncate sm:max-w-[78%] ${
                                                                    quest.isUnlocked ? 'text-sky-200' : 'text-gray-500'
                                                                }`}
                                                                title={t('singleplayer.productionRateTitle', { minutes: quest.levelInfo.productionRateMinutes, amount: quest.levelInfo.rewardAmount })}
                                                            >
                                                                <span className="truncate whitespace-nowrap">
                                                                    {t('singleplayer.productionRate', { minutes: quest.levelInfo.productionRateMinutes, amount: quest.levelInfo.rewardAmount })}
                                                                </span>
                                                                <img
                                                                    src={rewardTypeIcon(quest.rewardType)}
                                                                    alt={quest.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds')}
                                                                    className="h-4 w-4 shrink-0 object-contain opacity-95 sm:h-[18px] sm:w-[18px]"
                                                                />
                                                            </span>
                                                            <span className="shrink-0 whitespace-nowrap tabular-nums tracking-tight text-slate-100">
                                                                {quest.isUnlocked && quest.isStarted && !isMax && timeUntilNext > 0 && (
                                                                    <span>{formatTime(timeUntilNext)}</span>
                                                                )}
                                                                {quest.isUnlocked && quest.isStarted && isMax && (
                                                                    <span className="font-bold text-emerald-300">MAX</span>
                                                                )}
                                                                {quest.isUnlocked && !quest.isStarted && (
                                                                    <span className="text-slate-400">--:--</span>
                                                                )}
                                                                {!quest.isUnlocked && <span className="text-slate-500">{t('singleplayer.locked')}</span>}
                                                            </span>
                                                        </div>
                                                        <div className="relative">
                                                            <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-700 sm:h-4">
                                                                {quest.isUnlocked && quest.isStarted ? (
                                                                    <div
                                                                        className={`h-full transition-all duration-300 ${
                                                                            isMax ? 'bg-green-500' : 'bg-blue-500'
                                                                        }`}
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                ) : (
                                                                    <div className="h-full bg-gray-600" style={{ width: '0%' }} />
                                                                )}
                                                            </div>
                                                            <div className="absolute inset-0 flex items-center justify-center px-1">
                                                                <span
                                                                    className={`text-[11px] font-bold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-xs ${
                                                                        !quest.isUnlocked ? 'text-gray-500' : 'text-white'
                                                                    }`}
                                                                >
                                                                    {quest.isUnlocked && quest.isStarted
                                                                        ? `${reward.toLocaleString()} / ${quest.levelInfo.maxCapacity.toLocaleString()}`
                                                                        : `0 / ${quest.levelInfo.maxCapacity.toLocaleString()}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="space-y-1 sm:space-y-1.5">
                                                        <div className="relative">
                                                            <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-700 sm:h-4">
                                                                <div className="h-full bg-gray-600" style={{ width: '0%' }} />
                                                            </div>
                                                            <div className="absolute inset-0 flex items-center justify-center px-1">
                                                                <span
                                                                    className={`text-[10px] font-bold drop-shadow-md sm:text-[11px] ${
                                                                        !quest.isUnlocked ? 'text-gray-500' : 'text-white'
                                                                    }`}
                                                                >
                                                                    0 / -
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex min-h-[2.25rem] items-center justify-between gap-2 text-[11px] font-semibold sm:text-xs">
                                                            <span
                                                                className={`flex items-center gap-1 ${
                                                                    quest.isUnlocked ? 'text-tertiary' : 'text-gray-500'
                                                                }`}
                                                            >
                                                                <span>{t('singleplayer.shownAfterStart')}</span>
                                                            </span>
                                                            {!quest.isUnlocked && <span className="text-gray-500">{t('singleplayer.locked')}</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {levelUpInfo && !isMaxLevel && quest.isStarted && (
                                                <div className={`mb-0.5 flex-shrink-0 sm:mb-1 ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                    <div className="mb-0.5 flex items-center justify-between">
                                                        <span className="text-[8px] text-amber-200/90 sm:text-[9px]">{t('singleplayer.experience')}</span>
                                                        <span className="text-[8px] font-bold text-amber-200/90 sm:text-[9px]">
                                                            {Math.floor(levelUpInfo.progress)}%
                                                        </span>
                                                    </div>
                                                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700/70 sm:h-2.5">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-300"
                                                            style={{ width: `${levelUpInfo.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-auto flex flex-shrink-0 flex-row gap-0.5 sm:gap-1">
                                                {!quest.isUnlocked ? (
                                                    <>
                                                        <Button disabled colorScheme="none" className={`${PREMIUM_QUEST_BTN.claim} opacity-50`}>
                                                            <span className="flex items-center gap-1">
                                                                <span>{t('singleplayer.claim')}</span>
                                                                <img
                                                                    src={rewardTypeIcon(quest.rewardType)}
                                                                    alt={quest.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds')}
                                                                    className="h-3 w-3 object-contain"
                                                                />
                                                                <span>0</span>
                                                            </span>
                                                        </Button>
                                                        <Button disabled colorScheme="none" className={`${PREMIUM_QUEST_BTN.upgrade} opacity-50`}>
                                                            {t('singleplayer.enhance')}
                                                        </Button>
                                                    </>
                                                ) : !quest.isStarted ? (
                                                    <>
                                                        <Button
                                                            onClick={() => handleOpenStartMissionModal(quest.id)}
                                                            colorScheme="none"
                                                            className={PREMIUM_QUEST_BTN.start}
                                                        >
                                                            {t('singleplayer.start')}
                                                        </Button>
                                                        {isAdminUser && quest.id === 'mission_attendance' && (
                                                            <Button
                                                                onClick={() => handleOpenStartMissionModal(quest.id)}
                                                                colorScheme="none"
                                                                className="!rounded-lg !border !border-amber-300/50 !bg-gradient-to-b !from-amber-400/90 !via-orange-700 !to-amber-950 !px-1.5 !py-1 !text-[11px] !font-bold !text-amber-50 !shadow-[0_2px_12px_rgba(245,158,11,0.35)] hover:!brightness-110 sm:!px-2 sm:!py-1.5 sm:!text-xs"
                                                            >
                                                                {t('singleplayer.startSample')}
                                                            </Button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            onClick={() => handleCollectReward(quest.id)}
                                                            colorScheme="none"
                                                            className={PREMIUM_QUEST_BTN.claim}
                                                            disabled={!canCollect}
                                                        >
                                                            <span className="flex items-center gap-1">
                                                                <span>{t('singleplayer.claim')}</span>
                                                                <img
                                                                    src={rewardTypeIcon(quest.rewardType)}
                                                                    alt={quest.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds')}
                                                                    className="h-3 w-3 flex-shrink-0 object-contain"
                                                                />
                                                                <span>{reward > 0 ? reward.toLocaleString() : 0}</span>
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleLevelUpClick(quest.id)}
                                                            colorScheme="none"
                                                            className={PREMIUM_QUEST_BTN.upgrade}
                                                            disabled={isMaxLevel || !(levelUpInfo?.hasEnoughXp ?? false)}
                                                        >
                                                            {t('singleplayer.enhance')}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {inModal ? (
                    <div className="flex flex-shrink-0 justify-center border-t border-emerald-500/25 pt-2 sm:pt-2.5">
                        <Button
                            onClick={handleClaimAllRewards}
                            colorScheme="none"
                            className={`${PREMIUM_QUEST_BTN.claimAllConfirm} !w-auto !min-w-[9.75rem] !max-w-[11.5rem] !px-5 !text-xs sm:!min-w-[10.75rem] sm:!text-sm`}
                            disabled={isClaimingAll || claimableQuestsCount === 0}
                        >
                            {isClaimingAll ? t('singleplayer.claiming') : t('singleplayer.claimAll', { count: claimableQuestsCount })}
                        </Button>
                    </div>
                ) : null}
            </div>

            {/* 레벨업 모달 — 홈 인라인 뷰포트(embeddedInModal)에서는 행 내 강화 패널 사용 */}
            {selectedQuest && !inModal && (
                <TrainingQuestLevelUpModal
                    mission={selectedQuest}
                    currentLevel={selectedQuest.currentLevel}
                    upgradeCost={selectedLevelUpInfo?.upgradeCost || 0}
                    canLevelUp={selectedLevelUpInfo?.canLevelUp || false}
                    hasEnoughXp={selectedLevelUpInfo?.hasEnoughXp ?? true}
                    hasUnlockStage={selectedLevelUpInfo?.hasUnlockStage ?? true}
                    nextLevelUnlockStage={selectedLevelUpInfo?.nextLevelUnlockStage}
                    currentUserGold={currentUser.gold}
                    accumulatedCollection={selectedLevelUpInfo?.accumulatedCollection ?? 0}
                    requiredCollection={selectedLevelUpInfo?.requiredCollection ?? 0}
                    progressPercent={selectedLevelUpInfo?.progress ?? 0}
                    onConfirm={() => handleLevelUpConfirm(selectedQuest.id)}
                    onClose={() => setSelectedMissionForUpgrade(null)}
                />
            )}

            {/* 과제 시작 안내 모달 */}
            {selectedStartQuest && selectedStartLevelInfo && (
                <TrainingQuestStartInfoModal
                    mission={selectedStartQuest}
                    levelInfo={selectedStartLevelInfo}
                    onClose={() => setSelectedMissionForStart(null)}
                    onConfirmStart={() => handleStartMission(selectedStartQuest.id)}
                />
            )}

            {/* 일괄 수령 모달 */}
            {claimAllRewards && (
                <ClaimAllTrainingQuestRewardsModal
                    rewards={claimAllRewards.rewards}
                    totalGold={claimAllRewards.totalGold}
                    totalDiamonds={claimAllRewards.totalDiamonds}
                    items={claimAllRewards.items}
                    mode={claimAllRewards.mode}
                    onClaimNormal={() => claimAllFromPreview(false)}
                    onClaimAdDouble={() => claimAllFromPreview(true)}
                    onClose={() => setClaimAllRewards(null)}
                    isTopmost={true}
                />
            )}
        </>
    );
};

export default TrainingQuestPanel;
