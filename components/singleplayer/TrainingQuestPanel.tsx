import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { UserWithStatus } from '../../types.js';
import { SINGLE_PLAYER_MISSIONS } from '../../constants/singlePlayerConstants.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import TrainingQuestLevelUpModal from './TrainingQuestLevelUpModal.js';
import ClaimAllTrainingQuestRewardsModal from './ClaimAllTrainingQuestRewardsModal.js';
import TrainingQuestStartInfoModal from './TrainingQuestStartInfoModal.js';
import { audioService } from '../../services/audioService.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';
import {
    getPhase8TrainingTutorialStep,
    subscribePhase8TrainingTutorialStep,
} from '../../utils/phase8TrainingTutorialStep.js';

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
    const { handlers } = useAppContext();
    const [selectedMissionForUpgrade, setSelectedMissionForUpgrade] = useState<string | null>(null);
    const [selectedMissionForStart, setSelectedMissionForStart] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [levelUpResult, setLevelUpResult] = useState<{
        missionName: string;
        previousLevel: number;
        newLevel: number;
    } | null>(null);
    const [claimAllRewards, setClaimAllRewards] = useState<{
        rewards: Array<{
            missionId: string;
            missionName: string;
            missionLevel?: number;
            rewardType: 'gold' | 'diamonds';
            rewardAmount: number;
        }>;
        totalGold: number;
        totalDiamonds: number;
    } | null>(null);
    const [isClaimingAll, setIsClaimingAll] = useState(false);
    const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
    const [phase8TutorialTick, setPhase8TutorialTick] = useState(0);
    const onboardingPhase8 = (currentUser as { onboardingTutorialPhase?: number }).onboardingTutorialPhase ?? 0;
    const phase8OnboardingStep = useMemo(
        () => (onboardingPhase8 === 8 ? getPhase8TrainingTutorialStep() : -1),
        [onboardingPhase8, phase8TutorialTick],
    );

    const bumpPhase8Tutorial = useCallback(() => setPhase8TutorialTick((t) => t + 1), []);

    useEffect(() => subscribePhase8TrainingTutorialStep(bumpPhase8Tutorial), [bumpPhase8Tutorial]);

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
        bumpPhase8Tutorial();
    }, [onboardingPhase8, bumpPhase8Tutorial]);

    useEffect(() => {
        if (!actionErrorMessage) return;
        const timer = window.setTimeout(() => setActionErrorMessage(null), 5000);
        return () => window.clearTimeout(timer);
    }, [actionErrorMessage]);

    const getActionFailureMessage = (error: unknown, fallback: string): string => {
        if (error && typeof error === 'object' && 'error' in error) {
            const message = String((error as { error?: unknown }).error || '');
            if (message) return message;
        }
        if (error instanceof Error && error.message) return error.message;
        return fallback;
    };

    // 미션 언락 확인
    const isMissionUnlocked = (unlockStageId: string, clearedStages: string[]): boolean => {
        return clearedStages.includes(unlockStageId);
    };

    // 사용자의 수련 과제 상태
    const trainingQuests = useMemo(() => {
        const userMissions = (currentUser as any).singlePlayerMissions || {};
        const clearedStages = (currentUser as any).clearedSinglePlayerStages || [];
        return SINGLE_PLAYER_MISSIONS.map(mission => {
            const missionState = userMissions[mission.id];
            const currentLevel = missionState?.level || 0;
            const levelInfo = currentLevel > 0 && currentLevel <= mission.levels.length 
                ? mission.levels[currentLevel - 1] 
                : null;
            const isUnlocked = isMissionUnlocked(mission.unlockStageId, clearedStages);
            
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
        
        // 레벨 0일 때는 현재 레벨 정보가 없으므로 다음 레벨 정보를 사용
        const currentLevelInfo = quest.levelInfo || (quest.currentLevel === 0 ? null : (quest.levels && quest.levels[quest.currentLevel - 1]));
        
        // 레벨 0에서 레벨 1로 올릴 때는 수집 요구사항 없음
        const requiredCollection = quest.currentLevel === 0 ? 0 : (currentLevelInfo ? currentLevelInfo.maxCapacity * quest.currentLevel * 10 : 0);
        const accumulatedCollection = quest.missionState?.accumulatedCollection || 0;
        const progress = requiredCollection === 0 ? 100 : Math.min(100, (accumulatedCollection / requiredCollection) * 100);
        
        // 레벨업 비용 (레벨 0일 때는 다음 레벨의 maxCapacity 사용)
        const costBaseCapacity = currentLevelInfo ? currentLevelInfo.maxCapacity : nextLevelInfo.maxCapacity;
        let upgradeCost: number;
        if (quest.rewardType === 'gold') {
            upgradeCost = costBaseCapacity * 5;
        } else {
            upgradeCost = costBaseCapacity * 1000;
        }
        
        // 다음 레벨 오픈조건 확인
        const clearedStages = (currentUser as any).clearedSinglePlayerStages || [];
        // 레벨 0에서 레벨 1로 올릴 때는 항상 가능 (수집 요구사항 없음)
        const canLevelUp = quest.currentLevel === 0 ? 
            (!nextLevelInfo?.unlockStageId || clearedStages.includes(nextLevelInfo.unlockStageId)) :
            (accumulatedCollection >= requiredCollection && 
            (!nextLevelInfo?.unlockStageId || clearedStages.includes(nextLevelInfo.unlockStageId)));
        
        return {
            requiredCollection,
            accumulatedCollection,
            progress,
            upgradeCost,
            canLevelUp,
            nextLevelUnlockStage: nextLevelInfo?.unlockStageId,
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
                setActionErrorMessage(getActionFailureMessage(result, '수련 과제를 시작하지 못했습니다. 다시 시도해주세요.'));
                return;
            }
            setSelectedMissionForStart(null);
        } catch (error) {
            console.error('[TrainingQuestPanel] Start mission error:', error);
            setActionErrorMessage(getActionFailureMessage(error, '수련 과제를 시작하지 못했습니다. 다시 시도해주세요.'));
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
                setActionErrorMessage(getActionFailureMessage(result, '보상을 수령하지 못했습니다. 다시 시도해주세요.'));
            }
        } catch (error) {
            console.error('[TrainingQuestPanel] Collect reward error:', error);
            setActionErrorMessage(getActionFailureMessage(error, '보상을 수령하지 못했습니다. 다시 시도해주세요.'));
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
                setActionErrorMessage(getActionFailureMessage(result, '수련 과제를 강화하지 못했습니다. 다시 시도해주세요.'));
                return;
            }
            
            // 강화 완료 결과 확인
            const levelUpData = (result as any)?.trainingQuestLevelUp;
            if (levelUpData) {
                setLevelUpResult({
                    missionName: levelUpData.missionName,
                    previousLevel: levelUpData.previousLevel,
                    newLevel: levelUpData.newLevel
                });
                // 3초 후 자동으로 닫기
                setTimeout(() => {
                    setLevelUpResult(null);
                }, 3000);
            }
            
            // 모달을 닫지 않고 유지하여 강화된 정보로 동기화되도록 함
            // WebSocket 업데이트를 기다려서 인벤토리가 업데이트되면 모달이 자동으로 강화된 정보를 표시
            // 모달은 사용자가 직접 닫을 때까지 열려있음
            await new Promise(resolve => setTimeout(resolve, 200)); // WebSocket 업데이트 대기
        } catch (error) {
            console.error('[TrainingQuestPanel] Level up error:', error);
            setActionErrorMessage(getActionFailureMessage(error, '수련 과제를 강화하지 못했습니다. 다시 시도해주세요.'));
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
    
    // 일괄 수령 핸들러
    const handleClaimAllRewards = async () => {
        if (isClaimingAll || claimableQuestsCount === 0) return;
        
        setIsClaimingAll(true);
        setActionErrorMessage(null);
        try {
            // 아이템 획득 사운드 재생
            audioService.claimReward();
            
            const result = await handlers.handleAction({
                type: 'CLAIM_ALL_TRAINING_QUEST_REWARDS'
            }) as any;
            if (result?.error) {
                setActionErrorMessage(getActionFailureMessage(result, '보상을 일괄 수령하지 못했습니다. 다시 시도해주세요.'));
                return;
            }
            
            // 응답 구조 확인: handleAction에서 반환된 값
            const claimAllData = result?.claimAllTrainingQuestRewards;
            
            if (claimAllData) {
                setClaimAllRewards({
                    rewards: claimAllData.rewards || [],
                    totalGold: claimAllData.totalGold || 0,
                    totalDiamonds: claimAllData.totalDiamonds || 0
                });
            } else {
                console.warn('[TrainingQuestPanel] Claim all rewards - No claimAllTrainingQuestRewards in response:', result);
                setActionErrorMessage('보상 수령 결과를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
            }
        } catch (error) {
            console.error('[TrainingQuestPanel] Claim all rewards error:', error);
            setActionErrorMessage(getActionFailureMessage(error, '보상을 일괄 수령하지 못했습니다. 다시 시도해주세요.'));
        } finally {
            setIsClaimingAll(false);
        }
    };

    const effectiveCompactTop = compactTopSlot && !embeddedInTab;
    const inModal = embeddedInModal;
    /** 모바일 탭·네이티브 상단: 컴팩트 카드. PC 모달은 2×3 그리드 */
    const useCompactQuestCard = effectiveCompactTop || embeddedInTab;
    const embeddedTabNarrow = embeddedInTab && !effectiveCompactTop;
    const embeddedQuestBtnTight = embeddedTabNarrow
        ? ' !text-[9px] !leading-tight !px-0.5 !py-0.5 [&_img]:!h-2.5 [&_img]:!w-2.5'
        : '';
    const phase8BlockQuestClicks = phase8OnboardingStep >= 0 && phase8OnboardingStep <= 2;
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
                            ? 'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.05] sm:p-1'
                            : 'h-full rounded-lg bg-panel p-1.5 shadow-lg sm:p-2'
                }`}
            >
                {embeddedInTab ? (
                    <div className="mb-2 flex flex-shrink-0 justify-end border-b border-color/60 pb-2">
                        <Button
                            onClick={handleClaimAllRewards}
                            colorScheme="none"
                            className={`${PREMIUM_QUEST_BTN.claimAll} !text-sm sm:!text-base`}
                            disabled={isClaimingAll || claimableQuestsCount === 0}
                        >
                            {isClaimingAll ? '수령 중...' : `일괄 수령 (${claimableQuestsCount})`}
                        </Button>
                    </div>
                ) : inModal ? (
                    <div className="relative mb-px flex flex-shrink-0 items-center justify-end border-b border-emerald-500/20 pb-px">
                        <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[13px] font-bold tracking-tight text-amber-100 sm:text-sm">
                            수련과제
                        </h2>
                        <Button
                            onClick={handleClaimAllRewards}
                            colorScheme="none"
                            className={`${PREMIUM_QUEST_BTN.claimAll} !px-2 !py-0.5 !text-[10px] !leading-tight shrink-0 sm:!text-[11px]`}
                            disabled={isClaimingAll || claimableQuestsCount === 0}
                        >
                            {isClaimingAll ? '수령 중...' : `일괄 수령 (${claimableQuestsCount})`}
                        </Button>
                    </div>
                ) : (
                    <div
                        className={`flex flex-shrink-0 items-center justify-between border-b border-color ${effectiveCompactTop ? 'mb-0.5 pb-0.5' : 'mb-1 pb-0.5 sm:mb-1.5 sm:pb-1'}`}
                    >
                        <h2 className={`font-bold text-on-panel ${effectiveCompactTop ? 'text-sm' : 'text-base sm:text-lg'}`}>수련 과제</h2>
                        <Button
                            onClick={handleClaimAllRewards}
                            colorScheme="none"
                            className={PREMIUM_QUEST_BTN.claimAll}
                            disabled={isClaimingAll || claimableQuestsCount === 0}
                        >
                            {isClaimingAll ? '수령 중...' : `일괄 수령 (${claimableQuestsCount})`}
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

                {/* 2x3 그리드 */}
                <div
                    className={`min-h-0 flex-1 ${
                        embeddedInTab || effectiveCompactTop
                            ? 'min-h-0 overflow-hidden'
                            : inModal
                              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                              : 'overflow-hidden'
                    }`}
                >
                    <div
                        className={`grid min-h-0 ${
                            effectiveCompactTop
                                ? 'h-full grid-cols-2 grid-rows-3 gap-1.5'
                                : embeddedInTab
                                  ? 'h-full grid-cols-3 grid-rows-2 gap-1'
                                  : inModal
                                    ? 'h-full min-h-0 w-full flex-1 grid-cols-2 grid-rows-3 items-start gap-0.5 overflow-hidden sm:gap-1'
                                    : 'grid h-full grid-cols-2 gap-1 sm:gap-1.5'
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
                                    {...(quest.id === 'mission_attendance'
                                        ? { 'data-onboarding-target': 'onboarding-sp-training-quest-1-card' }
                                        : quest.id === 'mission_complete_game'
                                          ? { 'data-onboarding-target': 'onboarding-sp-training-quest-2-card' }
                                          : {})}
                                    className={
                                        inModal
                                            ? `relative flex min-h-0 w-full min-w-0 self-start flex-col overflow-hidden rounded-lg border-2 p-1 shadow-sm sm:p-1.5 ${
                                                  quest.isUnlocked
                                                      ? 'border-emerald-400/45 bg-gradient-to-b from-zinc-800/92 via-zinc-900 to-zinc-950 ring-1 ring-white/[0.06]'
                                                      : 'border-zinc-600/80 bg-gradient-to-b from-zinc-900/90 to-black/90'
                                              } ${phase8BlockQuestClicks ? 'pointer-events-none' : ''}`
                                            : `
                                        relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2
                                        ${useCompactQuestCard ? `h-full min-h-0 ${embeddedTabNarrow ? 'p-1' : 'p-1.5'}` : 'h-auto p-1 sm:p-1.5'}
                                        ${quest.isUnlocked ? 'border-primary bg-tertiary' : 'border-gray-600 bg-tertiary'}
                                        ${phase8BlockQuestClicks ? 'pointer-events-none' : ''}
                                    `
                                    }
                                >
                                    {!quest.isUnlocked && (
                                        <>
                                            {/* 잠김 오버레이 - 반투명 배경 (버튼 클릭은 막지만 UI는 보이도록) */}
                                            <div
                                                className={`pointer-events-none absolute inset-0 z-30 bg-gray-900/50 ${inModal ? 'rounded-lg' : embeddedTabNarrow ? 'rounded-md' : 'rounded-lg'}`}
                                            />
                                            {/* 잠김 아이콘 및 텍스트 - 카드 중앙 배치 */}
                                            <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
                                                <div className={`flex flex-col items-center ${inModal ? 'gap-1' : 'gap-1.5'}`}>
                                                    <div
                                                        className={`filter drop-shadow-[0_3px_8px_rgba(0,0,0,0.85)] ${inModal ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-[1.75rem]'}`}
                                                    >
                                                        🔒
                                                    </div>
                                                    <div
                                                        className={`rounded-lg border border-amber-200/60 bg-black/90 shadow-lg ${inModal ? 'px-2 py-1' : 'px-3 py-1.5 sm:px-3.5 sm:py-2'}`}
                                                    >
                                                        <span
                                                            className={`block whitespace-nowrap text-center font-black leading-tight text-amber-100 ${
                                                                inModal
                                                                    ? 'text-[10px]'
                                                                    : useCompactQuestCard
                                                                      ? embeddedTabNarrow
                                                                          ? 'text-[10px]'
                                                                          : 'text-[13px] sm:text-[14px]'
                                                                      : 'text-xs sm:text-sm'
                                                            }`}
                                                        >
                                                            {quest.unlockStageId} 필요
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {inModal ? (
                                        <>
                                            {/* PC 모달: 좌측 썸네일+Lv만, 우측 텍스트·막대·버튼 */}
                                            <div className="relative z-0 flex h-full min-h-0 w-full min-w-0 flex-row items-start gap-2 overflow-hidden antialiased sm:gap-2.5">
                                                <div
                                                    className={`flex w-[5.25rem] shrink-0 flex-col sm:w-[5.75rem] ${!quest.isUnlocked ? 'opacity-45' : ''}`}
                                                >
                                                    <div className="flex flex-col overflow-hidden rounded-lg bg-gray-700 ring-1 ring-white/12">
                                                        <div className="relative aspect-square w-full overflow-hidden">
                                                            <img
                                                                src={quest.image}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    if (target.src.includes('.webp')) {
                                                                        target.src = target.src.replace(/\.webp($|\?)/, '.png$1');
                                                                        return;
                                                                    }
                                                                    target.style.display = 'none';
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex w-full shrink-0 items-center justify-center border-t border-amber-400/45 bg-gradient-to-b from-zinc-950 to-black py-0.5 sm:py-1">
                                                            <span className="text-[11px] font-black tabular-nums tracking-tight text-amber-100 sm:text-[12px]">
                                                                Lv.{quest.currentLevel || 0}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden ${!quest.isUnlocked ? 'opacity-45' : ''}`}>
                                                    <div className="flex min-h-0 shrink-0 flex-col gap-px">
                                                        <h3 className="truncate text-left text-[13px] font-semibold leading-snug tracking-normal text-on-panel antialiased sm:text-sm">
                                                            {quest.name}
                                                        </h3>
                                                        <p
                                                            className="line-clamp-2 text-left text-[11px] font-medium leading-relaxed text-slate-200/95 antialiased sm:text-xs"
                                                            title={quest.description}
                                                        >
                                                            {quest.description}
                                                        </p>
                                                    </div>

                                                    <div className="flex shrink-0 flex-col gap-0.5">
                                                        {!quest.isUnlocked && quest.levelInfo ? (
                                                            <div className="flex w-full shrink-0 gap-0.5">
                                                                <Button
                                                                    disabled
                                                                    colorScheme="none"
                                                                    className={`${PREMIUM_QUEST_BTN.claim} !min-h-0 !py-0.5 !text-[10px] opacity-50`}
                                                                >
                                                                    <span className="flex items-center gap-0.5">
                                                                        <span>수령</span>
                                                                        <img
                                                                            src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                            alt=""
                                                                            className="h-2.5 w-2.5 object-contain"
                                                                        />
                                                                        <span>0</span>
                                                                    </span>
                                                                </Button>
                                                                <Button
                                                                    disabled
                                                                    colorScheme="none"
                                                                    className={`${PREMIUM_QUEST_BTN.upgrade} !min-h-0 !py-0.5 !text-[10px] opacity-50`}
                                                                >
                                                                    강화
                                                                </Button>
                                                            </div>
                                                        ) : quest.isUnlocked && !quest.isStarted ? (
                                                            <div className="flex w-full shrink-0 gap-0.5">
                                                                <Button
                                                                    {...(quest.id === 'mission_attendance'
                                                                        ? { 'data-onboarding-target': 'onboarding-sp-training-quest-1-start' }
                                                                        : {})}
                                                                    onClick={() => handleOpenStartMissionModal(quest.id)}
                                                                    colorScheme="none"
                                                                    className={`${PREMIUM_QUEST_BTN.start} !min-h-0 !shrink-0 !py-1.5 !text-[11px] sm:!text-xs ${
                                                                        phase8OnboardingStep === 1 && quest.id === 'mission_attendance'
                                                                            ? ' relative z-[70] !pointer-events-auto'
                                                                            : ''
                                                                    }`}
                                                                >
                                                                    시작하기
                                                                </Button>
                                                                {isAdminUser && quest.id === 'mission_attendance' && (
                                                                    <Button
                                                                        onClick={() => handleOpenStartMissionModal(quest.id)}
                                                                        colorScheme="none"
                                                                        className="!rounded-lg !border !border-amber-300/50 !bg-gradient-to-b !from-amber-400/90 !via-orange-700 !to-amber-950 !px-2 !py-1.5 !text-[11px] !font-bold !text-amber-50 !shadow-[0_2px_12px_rgba(245,158,11,0.35)] hover:!brightness-110 sm:!text-xs"
                                                                    >
                                                                        시작샘플
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ) : quest.levelInfo && quest.isStarted ? (
                                                            <>
                                                                <div className="mb-0 flex min-w-0 flex-col gap-px">
                                                                    <div className="flex min-w-0 justify-end gap-2 text-[11px] font-semibold leading-none text-slate-100 antialiased sm:text-xs">
                                                                        <span
                                                                            className={`flex min-w-0 max-w-[70%] items-center gap-0.5 truncate sm:max-w-[75%] ${quest.isUnlocked ? 'text-sky-200' : 'text-gray-400'}`}
                                                                            title={`생산 ${quest.levelInfo.productionRateMinutes}분 / ${quest.levelInfo.rewardAmount}`}
                                                                        >
                                                                            <span className="min-w-0 truncate tabular-nums whitespace-nowrap">
                                                                                {quest.levelInfo.productionRateMinutes}분 / {quest.levelInfo.rewardAmount}
                                                                            </span>
                                                                            <img
                                                                                src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                                alt=""
                                                                                className="h-3 w-3 shrink-0 object-contain opacity-95"
                                                                            />
                                                                        </span>
                                                                        <span className="shrink-0 tabular-nums tracking-tight text-slate-100">
                                                                            {quest.isUnlocked && quest.isStarted && !isMax && timeUntilNext > 0 ? (
                                                                                formatTime(timeUntilNext)
                                                                            ) : quest.isUnlocked && quest.isStarted && isMax ? (
                                                                                <span className="font-bold text-emerald-300">MAX</span>
                                                                            ) : quest.isUnlocked && quest.isStarted ? (
                                                                                <span className="text-slate-400">--:--</span>
                                                                            ) : (
                                                                                <span className="text-slate-500">--</span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="relative h-3.5 w-full shrink-0 overflow-hidden rounded-full bg-gray-900 ring-1 ring-white/10">
                                                                    <div
                                                                        className={`h-full transition-all duration-300 ${isMax ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-1">
                                                                        <span className="text-[10px] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-[11px]">
                                                                            {`${reward.toLocaleString()} / ${quest.levelInfo.maxCapacity.toLocaleString()}`}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {levelUpInfo && !isMaxLevel && (
                                                                    <div className="relative h-2.5 w-full shrink-0 overflow-hidden rounded-full bg-gray-900/95 ring-1 ring-amber-400/40">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-300"
                                                                            style={{ width: `${levelUpInfo.progress}%` }}
                                                                        />
                                                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-1">
                                                                            <span className="text-[10px] font-bold tabular-nums text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-[11px]">
                                                                                {Math.floor(levelUpInfo.progress)}%
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="flex min-h-0 w-full shrink-0 gap-0.5">
                                                                    <Button
                                                                        onClick={() => handleCollectReward(quest.id)}
                                                                        colorScheme="none"
                                                                        className={`${PREMIUM_QUEST_BTN.claim} !min-h-0 !py-0.5 !text-[10px] sm:!text-[11px]`}
                                                                        disabled={!canCollect}
                                                                    >
                                                                        <span className="flex items-center justify-center gap-0.5">
                                                                            <span>수령</span>
                                                                            <img
                                                                                src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                                alt=""
                                                                                className="h-2.5 w-2.5 shrink-0 object-contain sm:h-3 sm:w-3"
                                                                            />
                                                                            <span>{reward > 0 ? reward.toLocaleString() : 0}</span>
                                                                        </span>
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => handleLevelUpClick(quest.id)}
                                                                        colorScheme="none"
                                                                        className={`${PREMIUM_QUEST_BTN.upgrade} !min-h-0 !py-0.5 !text-[10px] sm:!text-[11px]`}
                                                                        disabled={isMaxLevel}
                                                                    >
                                                                        강화
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <p className="shrink-0 text-left text-[11px] font-medium leading-snug text-slate-400 antialiased">시작 후 표시됩니다.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : useCompactQuestCard ? (
                                        <>
                                            {embeddedTabNarrow ? (
                                                <>
                                                    {/* 모바일 탭: 썸네일·설명 → 생산/타이머는 게이지 바로 위(우측) */}
                                                    <div className={`mb-0.5 flex flex-shrink-0 flex-col items-center ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                        <div className="flex w-[58px] shrink-0 flex-col overflow-hidden rounded-xl bg-gray-700 ring-1 ring-white/10">
                                                            <div className="relative aspect-square w-full overflow-hidden">
                                                                <img
                                                                    src={quest.image}
                                                                    alt={quest.name}
                                                                    className="h-full w-full object-cover"
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        if (target.src.includes('.webp')) {
                                                                            target.src = target.src.replace(/\.webp($|\?)/, '.png$1');
                                                                            return;
                                                                        }
                                                                        target.style.display = 'none';
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex w-full shrink-0 items-center justify-center border-t border-amber-400/45 bg-gradient-to-b from-zinc-950 to-black py-0.5">
                                                                <span className="text-[10px] font-black tabular-nums text-amber-100">
                                                                    Lv.{quest.currentLevel || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p
                                                            className="mt-0.5 line-clamp-2 w-full px-0.5 text-center text-[10px] font-medium leading-snug text-slate-300 antialiased"
                                                            title={quest.description}
                                                        >
                                                            {quest.description}
                                                        </p>
                                                        {!quest.levelInfo && (
                                                            <p className="mt-0.5 text-center text-[10px] leading-tight text-slate-500">시작 후 표시 | --:--</p>
                                                        )}
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
                                                                            const target = e.target as HTMLImageElement;
                                                                            if (target.src.includes('.webp')) {
                                                                                target.src = target.src.replace(/\.webp($|\?)/, '.png$1');
                                                                                return;
                                                                            }
                                                                            target.style.display = 'none';
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
                                                                        <div>생산 시작 후 표시</div>
                                                                        <div>타이머 --:--</div>
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
                                                                title={`생산 ${quest.levelInfo.productionRateMinutes}분 / ${quest.levelInfo.rewardAmount}`}
                                                            >
                                                                {embeddedTabNarrow ? (
                                                                    <>
                                                                        <span className="min-w-0 truncate tabular-nums whitespace-nowrap">
                                                                            {quest.levelInfo.productionRateMinutes}분/{quest.levelInfo.rewardAmount}
                                                                        </span>
                                                                        <img
                                                                            src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                            alt={quest.rewardType === 'gold' ? '골드' : '다이아'}
                                                                            className="h-3 w-3 shrink-0 object-contain opacity-95"
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="shrink-0 whitespace-nowrap">
                                                                            생산 {quest.levelInfo.productionRateMinutes}분 / {quest.levelInfo.rewardAmount}
                                                                        </span>
                                                                        <img
                                                                            src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                            alt={quest.rewardType === 'gold' ? '골드' : '다이아'}
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
                                                                    <span className="text-slate-500">{quest.isUnlocked ? '--:--' : '잠김'}</span>
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
                                                                <span>수령</span>
                                                                <img
                                                                    src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                    alt={quest.rewardType === 'gold' ? '골드' : '다이아'}
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
                                                            강화
                                                        </Button>
                                                    </>
                                                ) : !quest.isStarted ? (
                                                    <>
                                                        <Button
                                                            {...(quest.id === 'mission_attendance'
                                                                ? { 'data-onboarding-target': 'onboarding-sp-training-quest-1-start' }
                                                                : {})}
                                                            onClick={() => handleOpenStartMissionModal(quest.id)}
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.start}${embeddedQuestBtnTight}${
                                                                phase8OnboardingStep === 1 && quest.id === 'mission_attendance'
                                                                    ? ' relative z-[70] !pointer-events-auto'
                                                                    : ''
                                                            }`}
                                                        >
                                                            시작하기
                                                        </Button>
                                                        {isAdminUser && quest.id === 'mission_attendance' && (
                                                            <Button
                                                                onClick={() => handleOpenStartMissionModal(quest.id)}
                                                                colorScheme="none"
                                                                className={`!rounded-lg !border !border-amber-300/50 !bg-gradient-to-b !from-amber-400/90 !via-orange-700 !to-amber-950 !text-[11px] !font-bold !text-amber-50 !shadow-[0_2px_12px_rgba(245,158,11,0.35)] hover:!brightness-110 sm:!text-xs${embeddedQuestBtnTight}`}
                                                            >
                                                                시작샘플
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
                                                                <span>수령</span>
                                                                <img
                                                                    src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                    alt={quest.rewardType === 'gold' ? '골드' : '다이아'}
                                                                    className={`flex-shrink-0 object-contain ${embeddedTabNarrow ? 'h-2.5 w-2.5' : 'h-3 w-3'}`}
                                                                />
                                                                <span>{reward > 0 ? reward.toLocaleString() : 0}</span>
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleLevelUpClick(quest.id)}
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.upgrade}${embeddedQuestBtnTight}`}
                                                            disabled={isMaxLevel}
                                                        >
                                                            강화
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
                                                            const target = e.target as HTMLImageElement;
                                                            if (target.src.includes('.webp')) {
                                                                target.src = target.src.replace(/\.webp($|\?)/, '.png$1');
                                                                return;
                                                            }
                                                            target.style.display = 'none';
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
                                                                title={`생산 ${quest.levelInfo.productionRateMinutes}분 / ${quest.levelInfo.rewardAmount}`}
                                                            >
                                                                <span className="truncate whitespace-nowrap">
                                                                    생산 {quest.levelInfo.productionRateMinutes}분 / {quest.levelInfo.rewardAmount}
                                                                </span>
                                                                <img
                                                                    src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                    alt={quest.rewardType === 'gold' ? '골드' : '다이아'}
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
                                                                {!quest.isUnlocked && <span className="text-slate-500">잠김</span>}
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
                                                                <span>시작 후 표시</span>
                                                            </span>
                                                            {!quest.isUnlocked && <span className="text-gray-500">잠김</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {levelUpInfo && !isMaxLevel && quest.isStarted && (
                                                <div className={`mb-0.5 flex-shrink-0 sm:mb-1 ${!quest.isUnlocked ? 'opacity-50' : ''}`}>
                                                    <div className="mb-0.5 flex items-center justify-between">
                                                        <span className="text-[8px] text-amber-200/90 sm:text-[9px]">경험치</span>
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
                                                                <span>수령</span>
                                                                <img
                                                                    src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                    alt={quest.rewardType === 'gold' ? '골드' : '다이아'}
                                                                    className="h-3 w-3 object-contain"
                                                                />
                                                                <span>0</span>
                                                            </span>
                                                        </Button>
                                                        <Button disabled colorScheme="none" className={`${PREMIUM_QUEST_BTN.upgrade} opacity-50`}>
                                                            강화
                                                        </Button>
                                                    </>
                                                ) : !quest.isStarted ? (
                                                    <>
                                                        <Button
                                                            {...(quest.id === 'mission_attendance'
                                                                ? { 'data-onboarding-target': 'onboarding-sp-training-quest-1-start' }
                                                                : {})}
                                                            onClick={() => handleOpenStartMissionModal(quest.id)}
                                                            colorScheme="none"
                                                            className={`${PREMIUM_QUEST_BTN.start}${
                                                                phase8OnboardingStep === 1 && quest.id === 'mission_attendance'
                                                                    ? ' relative z-[70] !pointer-events-auto'
                                                                    : ''
                                                            }`}
                                                        >
                                                            시작하기
                                                        </Button>
                                                        {isAdminUser && quest.id === 'mission_attendance' && (
                                                            <Button
                                                                onClick={() => handleOpenStartMissionModal(quest.id)}
                                                                colorScheme="none"
                                                                className="!rounded-lg !border !border-amber-300/50 !bg-gradient-to-b !from-amber-400/90 !via-orange-700 !to-amber-950 !px-1.5 !py-1 !text-[11px] !font-bold !text-amber-50 !shadow-[0_2px_12px_rgba(245,158,11,0.35)] hover:!brightness-110 sm:!px-2 sm:!py-1.5 sm:!text-xs"
                                                            >
                                                                시작샘플
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
                                                                <span>수령</span>
                                                                <img
                                                                    src={quest.rewardType === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png'}
                                                                    alt={quest.rewardType === 'gold' ? '골드' : '다이아'}
                                                                    className="h-3 w-3 flex-shrink-0 object-contain"
                                                                />
                                                                <span>{reward > 0 ? reward.toLocaleString() : 0}</span>
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleLevelUpClick(quest.id)}
                                                            colorScheme="none"
                                                            className={PREMIUM_QUEST_BTN.upgrade}
                                                            disabled={isMaxLevel}
                                                        >
                                                            강화
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
            </div>

            {/* 레벨업 모달 */}
            {selectedQuest && (
                <TrainingQuestLevelUpModal
                    mission={selectedQuest}
                    currentLevel={selectedQuest.currentLevel}
                    upgradeCost={selectedLevelUpInfo?.upgradeCost || 0}
                    canLevelUp={selectedLevelUpInfo?.canLevelUp || false}
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

            {/* 강화 완료 토스트 */}
            {levelUpResult && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-[100] animate-slide-down">
                    <div className="bg-success border-2 border-green-400 rounded-lg shadow-2xl p-6 text-center">
                        <div className="text-6xl mb-3 animate-bounce">🎉</div>
                        <h3 className="text-2xl font-bold text-green-400 mb-2">강화 완료!</h3>
                        <p className="text-white text-lg mb-1">
                            <span className="font-semibold">{levelUpResult.missionName}</span>
                        </p>
                        <div className="flex items-center justify-center gap-3 text-xl font-bold">
                            <span className="text-yellow-400">Lv.{levelUpResult.previousLevel}</span>
                            <span className="text-white">→</span>
                            <span className="text-green-400">Lv.{levelUpResult.newLevel}</span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 일괄 수령 모달 */}
            {claimAllRewards && (
                <ClaimAllTrainingQuestRewardsModal
                    rewards={claimAllRewards.rewards}
                    totalGold={claimAllRewards.totalGold}
                    totalDiamonds={claimAllRewards.totalDiamonds}
                    onClose={() => setClaimAllRewards(null)}
                    isTopmost={true}
                />
            )}
        </>
    );
};

export default TrainingQuestPanel;
