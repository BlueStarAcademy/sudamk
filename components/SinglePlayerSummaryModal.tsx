import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveGameSession, UserWithStatus, ServerAction, Player, AnalysisResult, GameMode } from '../types.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { SINGLE_PLAYER_STAGES, AVATAR_POOL, BORDER_POOL } from '../constants';
import { ScoringOverlay } from './game/ScoringOverlay.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { arenaPostGameButtonClass, formatArenaRetryLabel, formatSinglePlayerNextFooterLabel } from './game/arenaPostGameButtonStyles.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import {
    PRE_GAME_MODAL_FOOTER_CLASS,
    PRE_GAME_MODAL_LAYER_CLASS,
} from './game/PreGameDescriptionLayout.js';
import { StrategyXpResultBar } from './game/StrategyXpResultBar.js';
import { ResultModalXpRewardBadge } from './game/ResultModalXpRewardBadge.js';
import {
    ResultModalGoldCurrencySlot,
    ResultModalItemRewardSlot,
    RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_CLASS,
} from './game/ResultModalRewardSlot.js';
import { MobileGameResultTabBar, MobileResultTabPanelStack, type MobileGameResultTab } from './game/MobileGameResultTabBar.js';

/** 게임 설명 모달과 동일한 패널 박스 */
const SP_SUMMARY_PANEL_CLASS =
    'relative overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] shadow-[0_14px_44px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-400/12';
const SP_SUMMARY_INSET_CLASS =
    'rounded-lg border border-amber-500/15 bg-black/35 ring-1 ring-inset ring-white/[0.05]';
const SP_SUMMARY_SECTION_LABEL =
    'text-[0.72rem] font-bold uppercase tracking-[0.12em] text-amber-200/85 sm:text-xs min-[1024px]:text-sm';

interface SinglePlayerSummaryModalProps {
    session: LiveGameSession;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    onClose: () => void;
}

const handleClose = (session: LiveGameSession, onClose: () => void) => {
    // 확인 버튼: 모달만 닫기 (로비로 이동하지 않음)
    onClose();
};

const RewardItemDisplay: React.FC<{ item: any; isMobile: boolean }> = ({ item, isMobile }) => (
    <div
        className={`flex flex-col items-center justify-center text-center p-1 ${SP_SUMMARY_INSET_CLASS}`}
        title={item.name}
    >
        <img
            src={item.image}
            alt={item.name}
            className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} object-contain`}
        />
        <span className="mt-1 truncate w-full text-xs text-zinc-400">
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

// 계가 결과 표시 컴포넌트 (GameSummaryModal에서 가져옴)
const ScoreDetailsComponent: React.FC<{ analysis: AnalysisResult, session: LiveGameSession, isMobile?: boolean, mobileTextScale?: number }> = ({ analysis, session, isMobile = false, mobileTextScale = 1 }) => {
    const { scoreDetails } = analysis;
    const { mode, settings } = session;

    if (!scoreDetails) return <p className={`text-center text-zinc-500 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>점수 정보가 없습니다.</p>;
    
    const isSpeedMode = mode === GameMode.Speed || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Speed));
    const isBaseMode = mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base));
    const isHiddenMode = mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden));

    return (
        <div className={`space-y-1.5 ${isMobile ? 'p-1.5' : 'p-2'} ${SP_SUMMARY_INSET_CLASS} ${!isMobile ? 'text-base min-[1024px]:text-lg' : ''}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${isMobile ? 'p-1' : 'p-1.5'}`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile ? 'text-xs' : 'text-base min-[1024px]:text-lg'}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : undefined }}>흑</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>영토:</span> <span>{scoreDetails.black.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>따낸 돌:</span> <span>{scoreDetails.black.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>사석:</span> <span>{scoreDetails.black.deadStones ?? 0}</span></div>
                    {isBaseMode && <div className="flex justify-between text-blue-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>베이스 보너스:</span> <span>{scoreDetails.black.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between text-purple-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>히든 보너스:</span> <span>{scoreDetails.black.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between text-green-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>시간 보너스:</span> <span>{scoreDetails.black.timeBonus.toFixed(1)}</span></div>}
                    <div className={`flex justify-between border-t border-amber-500/20 pt-0.5 mt-0.5 font-bold ${isMobile ? 'text-xs' : 'text-base min-[1024px]:text-lg'}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : undefined }}><span>총점:</span> <span className="text-amber-200">{scoreDetails.black.total.toFixed(1)}</span></div>
                </div>
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${isMobile ? 'p-1' : 'p-1.5'}`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile ? 'text-xs' : 'text-base min-[1024px]:text-lg'}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : undefined }}>백</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>영토:</span> <span>{scoreDetails.white.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>따낸 돌:</span> <span>{scoreDetails.white.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>사석:</span> <span>{scoreDetails.white.deadStones ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>덤:</span> <span>{scoreDetails.white.komi}</span></div>
                    {isBaseMode && <div className="flex justify-between text-blue-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>베이스 보너스:</span> <span>{scoreDetails.white.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between text-purple-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>히든 보너스:</span> <span>{scoreDetails.white.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between text-green-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}><span>시간 보너스:</span> <span>{scoreDetails.white.timeBonus.toFixed(1)}</span></div>}
                    <div className={`flex justify-between border-t border-amber-500/20 pt-0.5 mt-0.5 font-bold ${isMobile ? 'text-xs' : 'text-base min-[1024px]:text-lg'}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : undefined }}><span>총점:</span> <span className="text-amber-200">{scoreDetails.white.total.toFixed(1)}</span></div>
                </div>
            </div>
        </div>
    );
};

const SinglePlayerSummaryModal: React.FC<SinglePlayerSummaryModalProps> = ({ session, currentUser, onAction, onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [mobileResultTab, setMobileResultTab] = useState<MobileGameResultTab>('match');
    const { modalLayerUsesDesignPixels } = useAppContext();
    const isScoring = session.gameStatus === 'scoring';
    const isEnded = session.gameStatus === 'ended';
    const analysisResult = session.analysisResult?.['system'];
    const summary = session.summary?.[currentUser.id];

    const currentStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === session.stageId);
    const currentStage = SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);
    
    // 계가 결과가 있으면 점수를 기반으로 승리/실패 판단, 없으면 session.winner 사용
    // 계가 중일 때는 승리/실패를 판단하지 않음 (잘못된 실패 표시 방지)
    // 살리기 바둑 모드에서는 session.winner를 우선 사용 (계가 전에 종료될 수 있음)
    const isSurvivalMode = currentStage?.survivalTurns;
    const isWinner = isSurvivalMode && session.winner !== null
        ? (session.winner === Player.Black)
        : (analysisResult 
            ? (analysisResult.scoreDetails?.black?.total ?? 0) > (analysisResult.scoreDetails?.white?.total ?? 0)
            : (session.winner === Player.Black)); // Human is always Black
    
    // summary가 없을 때도 보상을 계산해서 표시 (summary가 아직 생성되지 않았을 수 있음)
    const calculatedSummary = useMemo(() => {
        if (summary) return summary; // summary가 있으면 그대로 사용
        
        // summary가 없고 게임이 종료되었을 때만 보상 계산
        if (!isEnded || !currentStage) return null;
        
        // 최초 클리어 여부 확인
        const clearedStages = currentUser.clearedSinglePlayerStages || [];
        const isFirstClear = !clearedStages.includes(currentStage.id);
        
        if (isWinner) {
            const rewards = isFirstClear 
                ? currentStage.rewards.firstClear 
                : currentStage.rewards.repeatClear;
            
            return {
                gold: rewards.gold || 0,
                xp: {
                    initial: currentUser.strategyXp,
                    change: rewards.exp || 0,
                    final: currentUser.strategyXp + (rewards.exp || 0)
                },
                items: rewards.items ? rewards.items.map((item: any) => ({
                    id: `temp-${item.itemId}-${Date.now()}`,
                    name: item.itemId,
                    image: '/images/icon/item.png', // 기본 이미지
                    type: 'consumable',
                    grade: 'common',
                    quantity: item.quantity || 1
                })) : []
            };
        } else {
            // 실패시 보상: 재도전이고 기권이 아닌 경우에만 성공 보상의 10% 지급
            const isResign = session.winReason === 'resign';
            const isRepeatAttempt = clearedStages.includes(currentStage.id);
            
            if (isRepeatAttempt && !isResign) {
                const successRewards = currentStage.rewards.repeatClear;
                const failureRewards = {
                    gold: Math.round(successRewards.gold * 0.1),
                    exp: Math.round(successRewards.exp * 0.1)
                };
                
                return {
                    gold: failureRewards.gold,
                    xp: {
                        initial: currentUser.strategyXp,
                        change: failureRewards.exp,
                        final: currentUser.strategyXp + failureRewards.exp
                    },
                    items: []
                };
            }
        }
        
        return null;
    }, [summary, isEnded, currentStage, isWinner, currentUser, session.winReason]);
    const nextStage = SINGLE_PLAYER_STAGES[currentStageIndex + 1];
    const clearedStagesForNext = (currentUser as { clearedSinglePlayerStages?: string[] }).clearedSinglePlayerStages || [];
    const singlePlayerProgressForNext = (currentUser as { singlePlayerProgress?: number }).singlePlayerProgress ?? 0;
    const sid = session.stageId;
    const isCurrentStageAlreadyCleared =
        currentStageIndex >= 0 &&
        !!sid &&
        (clearedStagesForNext.includes(sid) || singlePlayerProgressForNext > currentStageIndex);
    const canTryNext = !!nextStage && (isWinner || isCurrentStageAlreadyCleared);
    // 서버 START_SINGLE_PLAYER_GAME과 동일: 클리어 이력 있으면 재도전 AP 0. 최초 클리어 직후 USER_UPDATE 지연 시 isWinner로 표시 보정
    const retryActionPointCost =
        isCurrentStageAlreadyCleared || isWinner ? 0 : (currentStage?.actionPointCost ?? 0);
    const nextStageActionPointCost = nextStage?.actionPointCost ?? 0;

    const failureReason = useMemo(() => {
        if (isWinner) return null;
        switch (session.winReason) {
            case 'timeout':
                if (currentStage?.blackTurnLimit) {
                    return '제한 턴이 부족하여 미션에 실패했습니다.';
                }
                return '제한시간이 초과되어 미션에 실패했습니다.';
            case 'capture_limit':
                return currentStage?.survivalTurns
                    ? '백이 정해진 턴을 모두 버텨 미션에 실패했습니다.'
                    : '상대가 목표 점수를 먼저 달성했습니다.';
            case 'score':
                return '계가 결과 상대가 더 많은 집을 차지했습니다.';
            case 'resign':
                return '기권하셨습니다.';
            case 'disconnect':
                return '연결이 끊어져 미션이 실패 처리되었습니다.';
            case 'total_score':
                return '총 점수 합계에서 상대에게 밀렸습니다.';
            case 'dice_win':
                return '주사위 점수에서 뒤처졌습니다.';
            case 'foul_limit':
                return '반칙 한도를 초과했습니다.';
            case 'thief_captured':
                return '도둑 돌이 모두 잡혔습니다.';
            case 'police_win':
                return '경찰이 더 많은 점수를 획득했습니다.';
            case 'omok_win':
                return '상대가 먼저 다섯 줄을 완성했습니다.';
            case 'alkkagi_win':
                return '알까기 승부에서 뒤졌습니다.';
            case 'curling_win':
                return '컬링 총점에서 상대에게 뒤졌습니다.';
            default:
                return null;
        }
    }, [isWinner, session.winReason, currentStage]);

    const winReasonText = useMemo(() => {
        if (!isWinner) return null;
        switch (session.winReason) {
            case 'capture_limit':
                return currentStage?.survivalTurns
                    ? '제한 턴만큼 점수를 잘 지켜냈습니다.'
                    : '목표 점수를 달성했습니다.';
            case 'score':
                return '계가 결과 승리했습니다.';
            case 'timeout':
                return '시간초과 시간패입니다.';
            case 'resign':
                return '상대방이 기권했습니다.';
            case 'disconnect':
                return '상대방의 연결이 끊어졌습니다.';
            case 'total_score':
                return '총 점수 합계에서 승리했습니다.';
            case 'dice_win':
                return '주사위 점수에서 승리했습니다.';
            case 'foul_limit':
                return '상대방이 반칙 한도를 초과했습니다.';
            case 'thief_captured':
                return '도둑 돌을 모두 잡았습니다.';
            case 'police_win':
                return '경찰로서 더 많은 점수를 획득했습니다.';
            case 'omok_win':
                return '먼저 다섯 줄을 완성했습니다.';
            case 'alkkagi_win':
                return '알까기 승부에서 승리했습니다.';
            case 'curling_win':
                return '컬링 총점에서 승리했습니다.';
            default:
                return '승리했습니다.';
        }
    }, [isWinner, session.winReason, currentStage]);
    
    // 살리기 바둑: 백의 목표 점수와 획득 점수
    const survivalModeInfo = useMemo(() => {
        if (!currentStage?.survivalTurns) return null;
        const whiteTarget = currentStage.targetScore?.black || session.effectiveCaptureTargets?.[Player.White] || 0;
        const whiteCaptured = session.captures?.[Player.White] || 0;
        return {
            target: whiteTarget,
            captured: whiteCaptured
        };
    }, [currentStage, session.effectiveCaptureTargets, session.captures]);

    // 경기 결과 모달이 열린 뒤에는 경기장 상태 업데이트로 시간이 바뀌어도
    // "총 걸린 시간"이 변하지 않도록, 처음 계산한 값을 ref에 고정한다.
    // 계가 진입 시 서버가 설정한 endTime을 쓰면 연출 구간이 포함되지 않음.
    const gameDurationRef = useRef<string | null>(null);
    if (gameDurationRef.current === null) {
        const startTime = session.gameStartTime ?? (session as any).startTime ?? session.createdAt ?? Date.now();
        const isEnded = session.gameStatus === 'ended' || session.gameStatus === 'no_contest';
        const isScoring = session.gameStatus === 'scoring';
        const serverEndTime = (session as any).endTime;
        const rawEnd = serverEndTime ?? session.turnStartTime ?? Date.now();
        const useFixedEnd = (isEnded || (isScoring && serverEndTime != null)) && typeof rawEnd === 'number' && rawEnd > 0;
        const endTime = useFixedEnd ? rawEnd : Date.now();
        const elapsedMs = Math.max(0, endTime - (startTime || 0));
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        gameDurationRef.current = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    const gameDuration = gameDurationRef.current;

    const handleRetry = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            // onAction이 완료될 때까지 기다림 (gameId 반환 가능)
            // handleAction에서 이미 라우팅을 업데이트하므로 여기서는 모달만 닫으면 됨
            const result = await onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: session.stageId! } });
            const gameId = (result as any)?.gameId;
            
            if (gameId) {
                // gameId를 받았으면 handleAction에서 이미 라우팅이 업데이트되었으므로
                // WebSocket 업데이트를 기다리면서 모달 닫기
                await new Promise(resolve => setTimeout(resolve, 200));
            } else {
                // gameId가 없으면 WebSocket 업데이트를 기다림
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            onClose();
        } catch (error) {
            console.error('[SinglePlayerSummaryModal] Failed to retry stage:', error);
            setIsProcessing(false);
        }
    };

    const handleNextStage = async () => {
        if (!canTryNext || !nextStage || isProcessing) return;
        setIsProcessing(true);
        try {
            // onAction이 완료될 때까지 기다림 (gameId 반환 가능)
            // handleAction에서 이미 라우팅을 업데이트하므로 여기서는 모달만 닫으면 됨
            const result = await onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: nextStage.id } });
            const gameId = (result as any)?.gameId;
            
            if (gameId) {
                // gameId를 받았으면 handleAction에서 이미 라우팅이 업데이트되었으므로
                // WebSocket 업데이트를 기다리면서 모달 닫기
                await new Promise(resolve => setTimeout(resolve, 200));
            } else {
                // gameId가 없으면 WebSocket 업데이트를 기다림
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            onClose();
        } catch (error) {
            console.error('[SinglePlayerSummaryModal] Failed to start next stage:', error);
            setIsProcessing(false);
        }
    };

    const handleExitToLobby = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        sessionStorage.setItem('postGameRedirect', '#/singleplayer');
        // 라우팅을 먼저 설정하여 홈화면이 보이지 않도록 함 (경기장 히스토리 항목 교체)
        replaceAppHash('#/singleplayer');
        try {
            // onAction이 완료될 때까지 기다림 (Promise 반환)
            await onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        } catch (error) {
            console.error('[SinglePlayerSummaryModal] Failed to leave AI game:', error);
        } finally {
            onClose();
        }
    };

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === currentUser.avatarId)?.url, [currentUser.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === currentUser.borderId)?.url, [currentUser.borderId]);
    // calculatedSummary를 사용하여 보상 표시 (summary가 없을 때도 계산된 보상 사용)
    const displaySummary = calculatedSummary || summary;
    const hasRewardSlots =
        !!displaySummary &&
        ((displaySummary.gold ?? 0) > 0 ||
            (displaySummary.xp?.change ?? 0) > 0 ||
            (Array.isArray(displaySummary.items) && displaySummary.items.length > 0));

    const xpRequirement = getXpRequirementForLevel(Math.max(1, currentUser.strategyLevel));
    const clampedXp = Math.min(currentUser.strategyXp, xpRequirement);
    const xpChange = displaySummary?.xp?.change ?? 0;
    const previousXp = Math.max(0, clampedXp - xpChange);
    const previousXpPercent = Math.min(100, (previousXp / (xpRequirement || 1)) * 100);
    const xpPercent = Math.min(100, (clampedXp / (xpRequirement || 1)) * 100);

    // 계가 결과가 없으면 "계가 중..." 표시, 있으면 승리/실패 판단
    const modalTitle = (!analysisResult && isScoring)
        ? "계가 중..." 
        : (analysisResult) 
            ? (isWinner ? "미션 클리어" : "미션 실패")
            : "게임 결과";

    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const useBodyScrollSizing = modalLayerUsesDesignPixels || isMobile;
    const mobileTextScale = 1;

    useEffect(() => {
        setMobileResultTab('match');
    }, [session.id]);

    const spRewardsSection = (
        <div className={`flex flex-col gap-1.5 ${SP_SUMMARY_PANEL_CLASS} shrink-0 p-2`}>
            <h2
                className={`${SP_SUMMARY_SECTION_LABEL} mb-2 border-b border-amber-500/25 pb-1.5 text-center`}
                style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
            >
                획득 보상
            </h2>
            <div
                className={
                    isMobile
                        ? RESULT_MODAL_REWARDS_ROW_MOBILE_CLASS
                        : `flex ${RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS} flex-wrap content-center items-center justify-center gap-2 sm:gap-2.5`
                }
            >
                {!displaySummary ? (
                    <p
                        className="px-2 text-center text-zinc-500"
                        style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '14px' }}
                    >
                        {isScoring ? '계가 중...' : '보상 정보가 없습니다.'}
                    </p>
                ) : !hasRewardSlots ? (
                    <p
                        className="px-2 text-center text-zinc-500"
                        style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '14px' }}
                    >
                        보상이 없습니다.
                    </p>
                ) : (
                    <>
                        {(displaySummary.gold ?? 0) > 0 && (
                            <ResultModalGoldCurrencySlot
                                amount={displaySummary.gold ?? 0}
                                compact={isMobile}
                                dimmed={!summary}
                            />
                        )}
                        {displaySummary.xp && displaySummary.xp.change > 0 && (
                            <div className={`flex flex-col items-center justify-center ${!summary ? 'opacity-80' : ''}`}>
                                <ResultModalXpRewardBadge
                                    variant="strategy"
                                    amount={displaySummary.xp.change}
                                    density={isMobile ? 'compact' : 'comfortable'}
                                />
                            </div>
                        )}
                        {displaySummary.items &&
                            displaySummary.items.length > 0 &&
                            displaySummary.items.slice(0, 2).map((item, idx) => (
                                <ResultModalItemRewardSlot
                                    key={item.id || idx}
                                    imageSrc={item.image || null}
                                    name={item.name}
                                    quantity={item.quantity}
                                    compact={isMobile}
                                    dimmed={!summary}
                                    onImageError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ))}
                    </>
                )}
            </div>
            {displaySummary && displaySummary.items && displaySummary.items.length > 2 && (
                <p
                    className="text-center text-zinc-500"
                    style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '13px' }}
                >
                    외 {displaySummary.items.length - 2}개 아이템
                </p>
            )}
        </div>
    );

    return (
        <DraggableWindow 
            title={modalTitle}
            onClose={isScoring ? undefined : () => handleClose(session, onClose)} 
            windowId="sp-summary-redesigned"
            initialWidth={800}
            initialHeight={720}
            uniformPcScale={false}
            mobileViewportFit
            mobileViewportMaxHeightVh={97}
            modal={!modalLayerUsesDesignPixels}
            closeOnOutsideClick={!modalLayerUsesDesignPixels}
            defaultPosition={modalLayerUsesDesignPixels ? { x: 400, y: 0 } : { x: 0, y: 0 }}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
            bodyPaddingClassName={isMobile ? 'p-2 pb-0 sm:p-3 sm:pb-0' : 'p-3 sm:p-4'}
            hideFooter
        >
            <>
            <div
                className={`text-on-panel ${PRE_GAME_MODAL_LAYER_CLASS} flex w-full min-h-0 flex-col ${
                    isMobile
                        ? 'min-h-0 flex-1 overflow-x-hidden overflow-y-visible'
                        : 'h-full flex-1 ' +
                          (useBodyScrollSizing ? 'overflow-x-hidden' : 'overflow-x-hidden overflow-y-visible')
                } ${isMobile ? 'text-xs sm:text-sm' : 'text-[1.0625rem] min-[1024px]:text-lg min-[1280px]:text-xl'}`}
            >
                {/* Title */}
                {(analysisResult || (isEnded && session.winner !== null)) && (
                    <div className={`${isMobile ? 'mb-1.5 p-2' : 'mb-2 p-3 sm:p-3.5'} flex-shrink-0 rounded-xl border-2 border-amber-400/45 bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-950/95 shadow-[0_0_32px_-12px_rgba(251,191,36,0.28)]`}>
                        <div className={`${SP_SUMMARY_SECTION_LABEL} text-center`}>결과</div>
                        <h1
                            className={`mt-1 text-center font-black tracking-widest ${isMobile ? 'text-lg' : 'text-2xl min-[1024px]:text-3xl min-[1280px]:text-4xl'} ${isWinner ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300' : 'text-red-400'}`}
                            style={{ fontSize: isMobile ? `${15 * mobileTextScale}px` : undefined }}
                        >
                            {isWinner ? '미션 성공' : '미션 실패'}
                        </h1>
                    </div>
                )}
                {!isMobile && !isScoring && !isEnded && !analysisResult && session.winner === null && (
                    <h1 className={`text-2xl min-[1024px]:text-3xl font-black text-center mb-1 sm:mb-2 tracking-widest flex-shrink-0 text-amber-100/90`}>
                        게임 결과
                    </h1>
                )}
                
                {isMobile ? (
                    <>
                        <MobileGameResultTabBar
                            active={mobileResultTab}
                            onChange={setMobileResultTab}
                            matchLabel="경기 결과"
                            recordLabel="기록"
                        />
                        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable] [scrollbar-width:thin]">
                                <MobileResultTabPanelStack
                                    active={mobileResultTab}
                                    matchPanel={
                                    <div
                                        className={`flex min-h-0 flex-col ${SP_SUMMARY_PANEL_CLASS} overflow-x-hidden overflow-y-visible p-1.5 sp-summary-left-panel`}
                                    >
                                        <h2
                                            className={`${SP_SUMMARY_SECTION_LABEL} mb-2 border-b border-amber-500/25 pb-1.5 text-center`}
                                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                                        >
                                            경기 결과
                                        </h2>
                                        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-visible">
                                            {(analysisResult || (isEnded && session.winner !== null)) && (
                                                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 p-1.5`}>
                                                    <div className="flex items-center justify-between" style={{ fontSize: `${10 * mobileTextScale}px` }}>
                                                        <span className="text-amber-200/65">총 걸린 시간:</span>
                                                        <span className="font-semibold text-zinc-100">{gameDuration}</span>
                                                    </div>
                                                    {(winReasonText || failureReason) && (
                                                        <div className="flex flex-col gap-0.5" style={{ fontSize: `${10 * mobileTextScale}px` }}>
                                                            <span className="text-amber-200/65">{isWinner ? '승리 이유:' : '패배 이유:'}</span>
                                                            <span className={`font-semibold ${isWinner ? 'text-emerald-300' : 'text-red-400'}`}>
                                                                {winReasonText || failureReason}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {survivalModeInfo && (
                                                        <div
                                                            className="mt-0.5 flex items-center justify-between border-t border-amber-500/15 pt-0.5"
                                                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                                                        >
                                                            <span className="text-amber-200/65">백 목표/획득 점수:</span>
                                                            <span
                                                                className={`font-semibold ${survivalModeInfo.captured < survivalModeInfo.target ? 'text-green-400' : 'text-red-400'}`}
                                                            >
                                                                {survivalModeInfo.captured}/{survivalModeInfo.target}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {isScoring && !analysisResult && (
                                                <div className="flex min-h-[100px] flex-shrink-0 flex-col items-center justify-center">
                                                    <ScoringOverlay variant="inline" />
                                                </div>
                                            )}
                                            {(isScoring && analysisResult) || (isEnded && analysisResult) ? (
                                                <ScoreDetailsComponent
                                                    analysis={analysisResult}
                                                    session={session}
                                                    isMobile={isMobile}
                                                    mobileTextScale={mobileTextScale}
                                                />
                                            ) : !isScoring && !isEnded ? (
                                                <p className="text-center text-zinc-500">계가 결과가 없습니다.</p>
                                            ) : null}
                                        </div>
                                    </div>
                                    }
                                    recordPanel={
                                    <div className={`flex flex-col gap-1.5 ${SP_SUMMARY_PANEL_CLASS} p-2`}>
                                        <h2
                                            className={`${SP_SUMMARY_SECTION_LABEL} mb-2 border-b border-amber-500/25 pb-1.5 text-center`}
                                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                                        >
                                            기록
                                        </h2>
                                        <div className={`flex flex-shrink-0 items-center gap-1.5 ${SP_SUMMARY_INSET_CLASS} p-1.5`}>
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
                                                <p className="text-amber-200/60" style={{ fontSize: `${9 * mobileTextScale}px` }}>
                                                    전략 Lv.{currentUser.strategyLevel}
                                                </p>
                                            </div>
                                        </div>
                                        {displaySummary?.xp && (
                                            <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 p-1.5`}>
                                                <StrategyXpResultBar
                                                    previousXpPercent={previousXpPercent}
                                                    finalXpPercent={xpPercent}
                                                    xpGain={xpChange}
                                                />
                                                <div
                                                    className="flex min-w-0 flex-nowrap items-center justify-between gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                                                    style={{ fontSize: `${9 * mobileTextScale}px` }}
                                                >
                                                    <span className="min-w-0 shrink font-mono whitespace-nowrap text-zinc-300/95">
                                                        {clampedXp.toLocaleString()} / {xpRequirement.toLocaleString()} XP
                                                    </span>
                                                    {xpChange > 0 && (
                                                        <span className="shrink-0 whitespace-nowrap font-semibold text-green-400">
                                                            +{xpChange.toLocaleString()} XP
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    }
                                />
                            </div>
                            {spRewardsSection}
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-0 flex-row items-stretch gap-1.5 overflow-visible sm:gap-3">
                        <div
                            className={`flex min-w-0 flex-col ${SP_SUMMARY_PANEL_CLASS} w-1/2 min-h-0 shrink-0 overflow-visible p-2.5 sp-summary-left-panel`}
                        >
                            <h2 className={`${SP_SUMMARY_SECTION_LABEL} mb-2 border-b border-amber-500/25 pb-1.5 text-center`}>
                                경기 결과
                            </h2>
                            <div className="flex flex-col gap-1.5 overflow-visible">
                                {(analysisResult || (isEnded && session.winner !== null)) && (
                                    <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 p-2`}>
                                        <div className="flex items-center justify-between" style={{ fontSize: '15px' }}>
                                            <span className="text-amber-200/65">총 걸린 시간:</span>
                                            <span className="font-semibold text-zinc-100">{gameDuration}</span>
                                        </div>
                                        {(winReasonText || failureReason) && (
                                            <div className="flex flex-col gap-0.5" style={{ fontSize: '15px' }}>
                                                <span className="text-amber-200/65">{isWinner ? '승리 이유:' : '패배 이유:'}</span>
                                                <span className={`font-semibold ${isWinner ? 'text-emerald-300' : 'text-red-400'}`}>
                                                    {winReasonText || failureReason}
                                                </span>
                                            </div>
                                        )}
                                        {survivalModeInfo && (
                                            <div className="mt-0.5 flex items-center justify-between border-t border-amber-500/15 pt-0.5" style={{ fontSize: '15px' }}>
                                                <span className="text-amber-200/65">백 목표/획득 점수:</span>
                                                <span
                                                    className={`font-semibold ${survivalModeInfo.captured < survivalModeInfo.target ? 'text-green-400' : 'text-red-400'}`}
                                                >
                                                    {survivalModeInfo.captured}/{survivalModeInfo.target}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isScoring && !analysisResult && (
                                    <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center">
                                        <ScoringOverlay variant="inline" />
                                    </div>
                                )}
                                {(isScoring && analysisResult) || (isEnded && analysisResult) ? (
                                    <ScoreDetailsComponent
                                        analysis={analysisResult}
                                        session={session}
                                        isMobile={false}
                                        mobileTextScale={mobileTextScale}
                                    />
                                ) : !isScoring && !isEnded ? (
                                    <p className="text-center text-zinc-500">계가 결과가 없습니다.</p>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-visible">
                            <div className={`flex flex-col gap-1.5 ${SP_SUMMARY_PANEL_CLASS} overflow-visible p-2.5`}>
                                <h2 className={`${SP_SUMMARY_SECTION_LABEL} mb-2 border-b border-amber-500/25 pb-1.5 text-center`}>기록</h2>
                                <div className={`flex flex-shrink-0 items-center gap-1.5 ${SP_SUMMARY_INSET_CLASS} p-2`}>
                                    <Avatar
                                        userId={currentUser.id}
                                        userName={currentUser.nickname}
                                        avatarUrl={avatarUrl}
                                        borderUrl={borderUrl}
                                        size={32}
                                    />
                                    <div>
                                        <p className="font-bold text-zinc-100" style={{ fontSize: '15px' }}>
                                            {currentUser.nickname}
                                        </p>
                                        <p className="text-amber-200/60" style={{ fontSize: '13px' }}>
                                            전략 Lv.{currentUser.strategyLevel}
                                        </p>
                                    </div>
                                </div>
                                {displaySummary?.xp && (
                                    <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 p-2`}>
                                        <StrategyXpResultBar
                                            previousXpPercent={previousXpPercent}
                                            finalXpPercent={xpPercent}
                                            xpGain={xpChange}
                                        />
                                        <div
                                            className="flex min-w-0 flex-nowrap items-center justify-between gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                                            style={{ fontSize: '13px' }}
                                        >
                                            <span className="min-w-0 shrink font-mono whitespace-nowrap text-zinc-300/95">
                                                {clampedXp.toLocaleString()} / {xpRequirement.toLocaleString()} XP
                                            </span>
                                            {xpChange > 0 && (
                                                <span className="shrink-0 whitespace-nowrap font-semibold text-green-400">
                                                    +{xpChange.toLocaleString()} XP
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {spRewardsSection}
                        </div>
                    </div>
                )}
            </div>

                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} ${PRE_GAME_MODAL_FOOTER_CLASS} mt-auto flex-shrink-0 !flex-col rounded-b-2xl ${
                        isMobile
                            ? '!gap-1.5 !p-2.5 -mx-2 -mb-2 sm:!gap-2 sm:!p-3 sm:-mx-3 sm:-mb-3'
                            : '!gap-2 !p-3 sm:!gap-3 sm:!p-3.5'
                    }`}
                >
                    <div className={`grid w-full min-w-0 flex-shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5`}>
                    <Button
                        onClick={() => {
                            if (isScoring) return;
                            handleClose(session, onClose);
                        }}
                        bare
                        colorScheme="none"
                        disabled={isScoring}
                        className={`min-w-0 w-full justify-center ${arenaPostGameButtonClass('neutral', isMobile, 'modal')} ${isScoring ? '!cursor-not-allowed !opacity-45' : ''}`}
                    >
                        확인
                    </Button>
                    <Button
                        onClick={handleNextStage}
                        bare
                        colorScheme="none"
                        className={`min-w-0 w-full justify-center ${arenaPostGameButtonClass('neutral', isMobile, 'modal')} ${!canTryNext || isProcessing ? '!cursor-not-allowed !opacity-45' : ''}`}
                        disabled={!canTryNext || isProcessing}
                    >
                        {formatSinglePlayerNextFooterLabel(nextStage, canTryNext, nextStageActionPointCost)}
                    </Button>
                    <Button
                        onClick={handleRetry}
                        bare
                        colorScheme="none"
                        className={`min-w-0 w-full justify-center ${arenaPostGameButtonClass('neutral', isMobile, 'modal')} ${isProcessing ? '!cursor-not-allowed !opacity-45' : ''}`}
                        disabled={isProcessing}
                    >
                        {formatArenaRetryLabel(retryActionPointCost)}
                    </Button>
                    <Button
                        onClick={handleExitToLobby}
                        bare
                        colorScheme="none"
                        className={`min-w-0 w-full justify-center ${arenaPostGameButtonClass('neutral', isMobile, 'modal')} ${isProcessing ? '!cursor-not-allowed !opacity-45' : ''}`}
                        disabled={isProcessing}
                    >
                        대기실로
                    </Button>
                    </div>
                </div>
            </>
        </DraggableWindow>
    );
};

export default SinglePlayerSummaryModal;