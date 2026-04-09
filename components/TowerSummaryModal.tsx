import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveGameSession, UserWithStatus, ServerAction, Player, AnalysisResult, GameMode } from '../types.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants/ui.js';
import { AvatarInfo, BorderInfo } from '../types.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants/items.js';
import { shouldUseClientSideAi } from '../services/wasmGnuGo.js';
import { ScoringOverlay } from './game/ScoringOverlay.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { arenaPostGameButtonClass, formatArenaRetryLabel, formatTowerNextFooterLabel } from './game/arenaPostGameButtonStyles.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import {
    PRE_GAME_MODAL_FOOTER_CLASS,
    PRE_GAME_MODAL_LAYER_CLASS,
} from './game/PreGameDescriptionLayout.js';

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
    'text-[0.72rem] font-bold uppercase tracking-[0.12em] text-amber-200/85 sm:text-xs min-[1024px]:text-sm';

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

const TowerSummaryModal: React.FC<TowerSummaryModalProps> = ({ session, currentUser, onAction, onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    // 게이지 애니메이션: 처음엔 이전 퍼센트로 고정 후, 다음 프레임에 최종 퍼센트로 전환해 CSS transition으로 차오르게 함
    const [xpGaugePercent, setXpGaugePercent] = useState<number | null>(null);

    const { modalLayerUsesDesignPixels } = useAppContext();
    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const useBodyScrollSizing = modalLayerUsesDesignPixels || isMobile;
    const isScoring = session.gameStatus === 'scoring';
    const isEnded = session.gameStatus === 'ended';
    const analysisResult = session.analysisResult?.['system'];
    const summary = session.summary?.[currentUser.id];
    
    // 계가 결과가 있으면 점수를 기반으로 승리/실패 판단, 없으면 session.winner 사용
    // 계가 중일 때는 승리/실패를 판단하지 않음 (잘못된 실패 표시 방지)
    // 도전의 탑에서는 session.winner를 우선 사용 (클라이언트에서 정확히 판정함)
    const isWinner = (isEnded && session.winner !== null)
        ? (session.winner === Player.Black)
        : (analysisResult 
            ? (analysisResult.scoreDetails?.black?.total ?? 0) > (analysisResult.scoreDetails?.white?.total ?? 0)
            : (session.winner === Player.Black)); // Human is always Black
    const currentFloor = session.towerFloor ?? 1;
    const currentStage = TOWER_STAGES.find((s: any) => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === currentFloor;
    });
    const nextFloor = currentFloor < 100 ? currentFloor + 1 : null;
    const nextStage = nextFloor ? TOWER_STAGES.find((s: any) => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === nextFloor;
    }) : null;
    
    // summary가 없을 때 예상 보상 계산 (즉시 표시를 위해)
    const userTowerFloor = currentUser.towerFloor ?? 0;
    const isCleared = currentFloor <= userTowerFloor;
    const expectedRewards = useMemo(() => {
        if (!summary && isWinner && !isCleared && currentStage) {
            // 승리했고 최초 클리어인 경우 예상 보상 표시
            const rewards = currentStage.rewards?.firstClear;
            if (rewards) {
                return {
                    gold: rewards.gold ?? 0,
                    xp: { change: rewards.exp ?? 0 },
                    items: rewards.items ? rewards.items.map((item: any) => ({ name: item.itemId ?? item.name, quantity: item.quantity || 1 })) : []
                };
            }
        }
        return null;
    }, [summary, isWinner, isCleared, currentStage]);
    
    // summary가 있으면 summary 사용, 없으면 expectedRewards 사용
    // summary가 나중에 도착하더라도 expectedRewards를 먼저 표시하여 0.5초 안에 보상 정보가 나타나도록 함
    const displaySummary = summary || expectedRewards;
    
    // 다음 층으로 갈 수 있는지 확인: 이번 게임에서 승리했거나, 이미 이 층을 한 번이라도 클리어한 적이 있으면 다음 층 가능
    // (재도전에서 실패해도 한 번 클리어한 층이면 다음 층으로 진행 가능)
    const canTryNext = !!nextStage && (isWinner || isCleared);
    
    // 서버 START_TOWER_GAME과 동일: 이미 클리어한 층(floor <= userTowerFloor)은 행동력 0
    const baseRetryApCost = currentStage?.actionPointCost ?? 0;
    const baseNextFloorApCost = nextStage?.actionPointCost ?? 0;
    const effectiveRetryActionPointCost = isCleared ? 0 : baseRetryApCost;
    const isNextFloorAlreadyCleared = nextFloor != null && userTowerFloor >= nextFloor;
    const effectiveNextFloorActionPointCost = isNextFloorAlreadyCleared ? 0 : baseNextFloorApCost;

    const failureReason = useMemo(() => {
        if (isWinner) return null;
        switch (session.winReason) {
            case 'timeout':
                if (currentStage?.blackTurnLimit) {
                    return '제한 턴이 부족하여 층에 실패했습니다.';
                }
                return '제한시간이 초과되어 층에 실패했습니다.';
            case 'capture_limit':
                return currentStage?.survivalTurns
                    ? '백이 정해진 턴을 모두 버텨 층에 실패했습니다.'
                    : '상대가 목표 점수를 먼저 달성했습니다.';
            case 'score':
                return '계가 결과 상대가 더 많은 집을 차지했습니다.';
            case 'resign':
                return '기권하여 층이 종료되었습니다.';
            case 'disconnect':
                return '연결이 끊어져 층이 실패 처리되었습니다.';
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
                    ? '백이 정해진 턴을 모두 버텼습니다.'
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

    const handleRetry = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            // onAction이 완료될 때까지 기다림 (gameId 반환 가능)
            // handleAction에서 이미 라우팅을 업데이트하므로 즉시 모달 닫기 (지연 제거)
            await onAction({ type: 'START_TOWER_GAME', payload: { floor: currentFloor, useClientSideAi: shouldUseClientSideAi() } });
            onClose();
        } catch (error) {
            console.error('[TowerSummaryModal] Failed to retry floor:', error);
            setIsProcessing(false);
        }
    };

    const handleNextFloor = async () => {
        if (!canTryNext || !nextStage || !nextFloor || isProcessing) return;
        setIsProcessing(true);
        try {
            // onAction이 완료될 때까지 기다림 (gameId 반환 가능)
            // handleAction에서 이미 라우팅을 업데이트하므로 즉시 모달 닫기 (지연 제거)
            await onAction({ type: 'START_TOWER_GAME', payload: { floor: nextFloor, useClientSideAi: shouldUseClientSideAi() } });
            onClose();
        } catch (error) {
            console.error('[TowerSummaryModal] Failed to start next floor:', error);
            setIsProcessing(false);
        }
    };

    const handleExitToLobby = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        sessionStorage.setItem('postGameRedirect', '#/tower');
        replaceAppHash('#/tower');
        try {
            // onAction이 완료될 때까지 기다림 (Promise 반환)
            await onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        } catch (error) {
            console.error('[TowerSummaryModal] Failed to leave AI game:', error);
        } finally {
            onClose();
        }
    };

    const avatarUrl = useMemo(() => AVATAR_POOL.find((a: AvatarInfo) => a.id === currentUser.avatarId)?.url, [currentUser.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b: BorderInfo) => b.id === currentUser.borderId)?.url, [currentUser.borderId]);
    const xpRequirement = getXpRequirementForLevel(Math.max(1, currentUser.strategyLevel));
    const clampedXp = Math.min(currentUser.strategyXp, xpRequirement);
    const xpChange = displaySummary?.xp?.change ?? summary?.xp?.change ?? 0;
    const previousXp = Math.max(0, clampedXp - xpChange);
    const previousXpPercent = Math.min(100, (previousXp / (xpRequirement || 1)) * 100);
    const xpPercent = Math.min(100, (clampedXp / (xpRequirement || 1)) * 100);

    // 게이지 애니메이션: XP 섹션이 보일 때 처음엔 이전 값으로 세팅 후 다음 프레임에 최종 값으로 전환
    const showXpSection = !!(displaySummary?.xp || summary?.xp);
    useEffect(() => {
        if (!showXpSection) {
            setXpGaugePercent(null);
            return;
        }
        setXpGaugePercent(previousXpPercent);
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setXpGaugePercent(xpPercent));
        });
        return () => cancelAnimationFrame(t);
    }, [showXpSection, previousXpPercent, xpPercent]);

    // 계가 결과가 없으면 "계가 중..." 표시, 있으면 승리/실패 판단
    const modalTitle = (!analysisResult && isScoring)
        ? "계가 중..." 
        : (analysisResult) 
            ? (isWinner ? "층 클리어" : "층 실패")
            : "게임 결과";

    const mobileTextScale = 1;

    const panelSizing = isMobile ? 'min-w-0 flex-1 basis-0' : 'min-w-0 w-1/2 shrink-0';

    return (
        <DraggableWindow 
            title={modalTitle}
            onClose={isScoring ? undefined : () => handleClose(session, onClose)} 
            windowId="tower-summary-redesigned"
            initialWidth={840}
            initialHeight={700}
            uniformPcScale={false}
            mobileViewportFit
            mobileViewportMaxHeightVh={97}
            bodyPaddingClassName={isMobile ? 'p-2 pb-0 sm:p-3 sm:pb-0' : 'p-3 sm:p-4'}
            modal={!modalLayerUsesDesignPixels}
            closeOnOutsideClick={!modalLayerUsesDesignPixels}
            defaultPosition={modalLayerUsesDesignPixels ? { x: 400, y: 0 } : { x: 0, y: 0 }}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
            hideFooter
        >
            <>
            <div
                className={`flex w-full min-h-0 flex-col text-white ${
                    isMobile
                        ? 'min-h-0 flex-1 overflow-x-hidden overflow-y-visible'
                        : useBodyScrollSizing
                          ? 'overflow-x-hidden'
                          : 'overflow-x-hidden overflow-y-visible'
                } ${PRE_GAME_MODAL_LAYER_CLASS} ${isMobile ? 'text-xs sm:text-sm' : 'text-[1.0625rem] min-[1024px]:text-lg min-[1280px]:text-xl'}`}
            >
                {/* Title */}
                {(analysisResult || (isEnded && session.winner !== null)) && (
                    <h1 className={`${isMobile ? 'text-base' : 'text-2xl min-[1024px]:text-3xl min-[1280px]:text-4xl'} font-black text-center mb-1 sm:mb-2 tracking-widest flex-shrink-0 ${isWinner ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300' : 'text-red-400'}`} style={{ fontSize: isMobile ? `${14 * mobileTextScale}px` : undefined }}>
                        {isWinner ? '도전 성공' : '도전 실패'}
                    </h1>
                )}
                {!isMobile && !isScoring && !isEnded && !analysisResult && session.winner === null && (
                    <h1 className="text-2xl min-[1024px]:text-3xl font-black text-center mb-1 sm:mb-2 tracking-widest flex-shrink-0 text-gray-300">
                        게임 결과
                    </h1>
                )}
                
                <div
                    className={`flex min-w-0 flex-row gap-1.5 sm:gap-2 ${
                        isMobile ? 'min-h-0 flex-1 overflow-x-hidden overflow-y-visible' : 'items-start overflow-visible'
                    }`}
                >
                    {/* Left Panel: 경기 결과 */}
                    <div
                        className={`${panelSizing} flex flex-col ${SP_SUMMARY_PANEL_CLASS} p-2 sp-summary-left-panel ${
                            isMobile ? 'min-h-0 overflow-x-hidden overflow-y-visible' : 'overflow-visible'
                        }`}
                    >
                        <h2 className={`${SP_SUMMARY_SECTION_LABEL} mb-1 sm:mb-2 border-b border-amber-500/25 pb-0.5 sm:pb-1 text-center`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '15px' }}>경기 결과</h2>
                        <div
                            className={
                                isMobile
                                    ? 'flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-visible'
                                    : 'flex flex-col gap-1.5 overflow-visible'
                            }
                        >
                            {/* 경기 정보 */}
                            {(analysisResult || (isEnded && session.winner !== null)) && (
                                <div className={`${isMobile ? 'p-1' : 'p-1.5'} ${SP_SUMMARY_INSET_CLASS} space-y-0.5 flex-shrink-0`}>
                                    <div className="flex justify-between items-center" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '15px' }}>
                                        <span className="text-amber-200/65">총 걸린 시간:</span>
                                        <span className="text-zinc-100 font-semibold">{gameDuration}</span>
                                    </div>
                                    {(winReasonText || failureReason) && (
                                        <div className="flex flex-col gap-0.5" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '15px' }}>
                                            <span className="text-amber-200/65">{isWinner ? '승리 이유:' : '패배 이유:'}</span>
                                            <span className={`font-semibold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                                                {winReasonText || failureReason}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* 계가 결과 — 전략바둑과 동일한 22초 진행 연출 */}
                            {isScoring && !analysisResult && (
                                <div
                                    className={`flex flex-col items-center justify-center ${isMobile ? 'min-h-[100px] flex-shrink-0' : 'min-h-[200px] flex-1'}`}
                                >
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
                                <p className="text-center text-gray-400">계가 결과가 없습니다.</p>
                            ) : null}
                        </div>
                    </div>
                    
                    {/* Right Panel: 획득 보상 */}
                    <div
                        className={`${panelSizing} flex min-w-0 flex-col ${SP_SUMMARY_PANEL_CLASS} p-2 ${
                            isMobile ? 'min-h-0 overflow-x-hidden overflow-y-visible' : 'overflow-visible'
                        }`}
                    >
                        <h2 className={`${SP_SUMMARY_SECTION_LABEL} mb-1 sm:mb-2 border-b border-amber-500/25 pb-0.5 sm:pb-1 text-center`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '15px' }}>획득 보상</h2>
                        <div
                            className={
                                isMobile
                                    ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-1.5'
                                    : 'flex min-w-0 flex-col gap-1.5 overflow-visible'
                            }
                        >
                            {/* 유저 프로필 */}
                            <div className={`${isMobile ? 'p-1' : 'p-1.5'} ${SP_SUMMARY_INSET_CLASS} flex items-center gap-1.5 flex-shrink-0`}>
                                <Avatar
                                    userId={currentUser.id}
                                    userName={currentUser.nickname}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={isMobile ? 24 : 32}
                                />
                                <div>
                                    <p className="font-bold text-zinc-100" style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '15px' }}>{currentUser.nickname}</p>
                                    <p className="text-amber-200/60" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '13px' }}>
                                        전략 Lv.{currentUser.strategyLevel}
                                    </p>
                                </div>
                            </div>
                            
                            {/* 경험치 표시: 막대는 항상 고정, 안쪽 게이지만 차오르는 애니메이션 */}
                            {(displaySummary?.xp || summary?.xp) && (
                                <div className={`${isMobile ? 'p-1' : 'p-1.5'} ${SP_SUMMARY_INSET_CLASS} space-y-0.5 flex-shrink-0`}>
                                    <div className="w-full bg-black/45 border border-amber-500/20 rounded-full h-2.5 overflow-hidden relative">
                                        {/* 단일 게이지: width만 transition으로 변경되어 차오름 */}
                                        <div
                                            className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 rounded-full transition-[width] duration-700 ease-out"
                                            style={{ width: `${xpGaugePercent !== null ? xpGaugePercent : xpPercent}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '13px' }}>
                                        <span className="font-mono text-zinc-300/95">
                                            {clampedXp.toLocaleString()} / {xpRequirement.toLocaleString()} XP
                                        </span>
                                        {xpChange > 0 && (
                                            <span className="font-semibold text-green-400">
                                                +{xpChange.toLocaleString()} XP
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* 보상 박스들 — 최소 높이로 영역 고정해 모달 크기 흔들림 방지 */}
                            <div
                                className={
                                    isMobile
                                        ? 'flex min-h-0 min-w-0 flex-1 flex-col'
                                        : 'flex min-w-0 flex-col overflow-visible'
                                }
                            >
                            {displaySummary ? (
                                <>
                                    {((displaySummary.gold ?? 0) > 0 || (displaySummary.xp?.change ?? 0) > 0 || (displaySummary.items && displaySummary.items.length > 0)) ? (
                                        <div className="flex gap-1.5 justify-start items-stretch flex-wrap w-full">
                                            {/* Gold Reward */}
                                            {(displaySummary.gold ?? 0) > 0 && (
                                                <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-gradient-to-br from-yellow-600/30 to-yellow-800/30 border-2 border-yellow-500/50 rounded-lg flex flex-col items-center justify-center ${isMobile ? 'p-1' : 'p-2'} shadow-lg ${!summary ? 'opacity-80' : ''}`}>
                                                    <img src="/images/icon/Gold.png" alt="골드" className={`${isMobile ? 'w-6 h-6' : 'w-10 h-10'} mb-0.5`} />
                                                    <p className="font-bold text-yellow-300 text-center" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '13px' }}>
                                                        {(displaySummary.gold ?? 0).toLocaleString()}
                                                    </p>
                                                </div>
                                            )}
                                            {/* XP Reward (박스 형태) */}
                                            {displaySummary.xp && displaySummary.xp.change > 0 && (
                                                <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-gradient-to-br from-green-600/30 to-green-800/30 border-2 border-green-500/50 rounded-lg flex flex-col items-center justify-center ${isMobile ? 'p-1' : 'p-2'} shadow-lg ${!summary ? 'opacity-80' : ''}`}>
                                                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-green-300 mb-0.5`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '13px' }}>전략</p>
                                                    <p className="font-bold text-green-300 text-center" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '13px' }}>
                                                        +{displaySummary.xp.change} XP
                                                    </p>
                                                </div>
                                            )}
                                            {/* Item Rewards */}
                                            {displaySummary.items && displaySummary.items.length > 0 && displaySummary.items.map((item, idx) => {
                                                // 표시 이름: 서버는 name, 스테이지 예상 보상은 itemId로 옴
                                                const displayName = item.name ?? ('itemId' in item ? (item as any).itemId : undefined);
                                                if (!displayName) return null;
                                                // 이미지 경로 찾기: item.image가 없으면 CONSUMABLE_ITEMS나 MATERIAL_ITEMS에서 찾기
                                                const nameWithSpace = displayName.includes('골드꾸러미') ? displayName.replace('골드꾸러미', '골드 꾸러미') : displayName;
                                                const nameWithoutSpace = displayName.includes('골드 꾸러미') ? displayName.replace('골드 꾸러미', '골드꾸러미') : displayName;
                                                const imagePath = ('image' in item && item.image) ||
                                                    CONSUMABLE_ITEMS.find(ci => ci.name === displayName || ci.name === nameWithSpace || ci.name === nameWithoutSpace)?.image ||
                                                    MATERIAL_ITEMS[displayName]?.image ||
                                                    MATERIAL_ITEMS[nameWithSpace]?.image ||
                                                    MATERIAL_ITEMS[nameWithoutSpace]?.image;
                                                return (
                                                    <div key={'id' in item && item.id ? item.id : idx} className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-gradient-to-br from-purple-600/30 to-purple-800/30 border-2 border-purple-500/50 rounded-lg flex flex-col items-center justify-center ${isMobile ? 'p-1' : 'p-2'} shadow-lg ${!summary ? 'opacity-80' : ''}`}>
                                                        {imagePath ? (
                                                            <img
                                                                src={imagePath}
                                                                alt={displayName}
                                                                className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} mb-0.5 object-contain`}
                                                                onError={(e) => {
                                                                    console.error(`[TowerSummaryModal] Failed to load image: ${imagePath} for item:`, item);
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} mb-0.5 flex items-center justify-center`}>
                                                                <span className="text-xs text-gray-300 text-center px-1 line-clamp-2">{displayName}</span>
                                                            </div>
                                                        )}
                                                        <p className="font-semibold text-purple-300 text-center leading-tight" style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : '12px' }}>
                                                            {displayName}
                                                            {item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ''}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center py-4">
                                            <p className="text-gray-400 text-center" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '14px' }}>
                                                보상이 없습니다.
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={`flex items-center justify-center py-4 ${isMobile ? 'flex-1' : ''}`}>
                                    <p className="text-gray-400 text-center" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '14px' }}>
                                        {isScoring ? '계가 중...' : '보상 정보가 없습니다.'}
                                    </p>
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

                {/* Buttons */}
                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} ${PRE_GAME_MODAL_FOOTER_CLASS} flex-shrink-0 !flex-col rounded-b-2xl ${
                        isMobile
                            ? 'mt-2 !gap-1.5 !p-2.5 -mx-2 -mb-2 sm:mt-3 sm:!gap-2 sm:!p-3 sm:-mx-3 sm:-mb-3'
                            : 'mt-2 !gap-2 !p-3 sm:!gap-3 sm:!p-3.5'
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
                        onClick={handleNextFloor}
                        bare
                        colorScheme="none"
                        className={`min-w-0 w-full justify-center ${arenaPostGameButtonClass('neutral', isMobile, 'modal')} ${!canTryNext || isProcessing ? '!cursor-not-allowed !opacity-45' : ''}`}
                        disabled={!canTryNext || isProcessing}
                    >
                        {formatTowerNextFooterLabel(nextFloor, canTryNext, effectiveNextFloorActionPointCost)}
                    </Button>
                    <Button
                        onClick={handleRetry}
                        bare
                        colorScheme="none"
                        className={`min-w-0 w-full justify-center ${arenaPostGameButtonClass('neutral', isMobile, 'modal')} ${isProcessing ? '!cursor-not-allowed !opacity-45' : ''}`}
                        disabled={isProcessing}
                    >
                        {formatArenaRetryLabel(effectiveRetryActionPointCost)}
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

export default TowerSummaryModal;

