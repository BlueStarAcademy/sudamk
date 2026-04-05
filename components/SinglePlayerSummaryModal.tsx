import React, { useMemo, useRef, useState } from 'react';
import { LiveGameSession, UserWithStatus, ServerAction, Player, AnalysisResult, GameMode } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { SINGLE_PLAYER_STAGES, AVATAR_POOL, BORDER_POOL } from '../constants';
import { ScoringOverlay } from './game/ScoringOverlay.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { formatSinglePlayerNextFooterLabel } from './game/arenaPostGameButtonStyles.js';
import {
    PRE_GAME_MODAL_FOOTER_CLASS,
    PRE_GAME_MODAL_LAYER_CLASS,
    PRE_GAME_MODAL_PRIMARY_BTN_CLASS,
    PRE_GAME_MODAL_SECONDARY_BTN_CLASS,
    PRE_GAME_MODAL_ACCENT_BTN_CLASS,
} from './game/PreGameDescriptionLayout.js';

/** 게임 설명 모달과 동일한 패널 박스 */
const SP_SUMMARY_PANEL_CLASS =
    'relative overflow-hidden rounded-xl border border-amber-500/28 bg-gradient-to-br from-[#252032] via-[#16131f] to-[#0c0a10] shadow-[0_14px_44px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-400/12';
const SP_SUMMARY_INSET_CLASS =
    'rounded-lg border border-amber-500/15 bg-black/35 ring-1 ring-inset ring-white/[0.05]';
const SP_SUMMARY_SECTION_LABEL = 'text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-200/85';

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
        <div className={`space-y-1.5 ${isMobile ? 'p-1.5' : 'p-2'} ${SP_SUMMARY_INSET_CLASS}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${isMobile ? 'p-1' : 'p-1.5'}`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '13px' }}>흑</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>영토:</span> <span>{scoreDetails.black.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>따낸 돌:</span> <span>{scoreDetails.black.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>사석:</span> <span>{scoreDetails.black.deadStones ?? 0}</span></div>
                    {isBaseMode && <div className="flex justify-between text-blue-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>베이스 보너스:</span> <span>{scoreDetails.black.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between text-purple-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>히든 보너스:</span> <span>{scoreDetails.black.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between text-green-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>시간 보너스:</span> <span>{scoreDetails.black.timeBonus.toFixed(1)}</span></div>}
                    <div className={`flex justify-between border-t border-amber-500/20 pt-0.5 mt-0.5 font-bold ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '12px' }}><span>총점:</span> <span className="text-amber-200">{scoreDetails.black.total.toFixed(1)}</span></div>
                </div>
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${isMobile ? 'p-1' : 'p-1.5'}`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '13px' }}>백</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>영토:</span> <span>{scoreDetails.white.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>따낸 돌:</span> <span>{scoreDetails.white.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>사석:</span> <span>{scoreDetails.white.deadStones ?? 0}</span></div>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>덤:</span> <span>{scoreDetails.white.komi}</span></div>
                    {isBaseMode && <div className="flex justify-between text-blue-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>베이스 보너스:</span> <span>{scoreDetails.white.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between text-purple-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>히든 보너스:</span> <span>{scoreDetails.white.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between text-green-300" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '11px' }}><span>시간 보너스:</span> <span>{scoreDetails.white.timeBonus.toFixed(1)}</span></div>}
                    <div className={`flex justify-between border-t border-amber-500/20 pt-0.5 mt-0.5 font-bold ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '12px' }}><span>총점:</span> <span className="text-amber-200">{scoreDetails.white.total.toFixed(1)}</span></div>
                </div>
            </div>
        </div>
    );
};

const SinglePlayerSummaryModal: React.FC<SinglePlayerSummaryModalProps> = ({ session, currentUser, onAction, onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const isInsideScaledCanvas = typeof document !== 'undefined' && !!document.getElementById('sudamr-modal-root');
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
    // 클리어했을 때는 계가 결과가 없어도 다음 단계 가능 (클리어 시 다음 단계 버튼 활성화)
    // 클리어 직후에는 singlePlayerProgress가 아직 업데이트되지 않았을 수 있으므로, 
    // 클리어했을 때는 isWinner만으로도 다음 단계 버튼 활성화
    const canTryNext = isWinner && !!nextStage;
    
    const retryActionPointCost = currentStage?.actionPointCost ?? 0;
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
    
    const xpRequirement = getXpRequirementForLevel(Math.max(1, currentUser.strategyLevel));
    const clampedXp = Math.min(currentUser.strategyXp, xpRequirement);
    const xpChange = displaySummary?.xp?.change ?? 0;
    const previousXp = Math.max(0, clampedXp - xpChange);
    const previousXpPercent = Math.min(100, (previousXp / (xpRequirement || 1)) * 100);
    const xpChangePercent = Math.min(100 - previousXpPercent, (xpChange / (xpRequirement || 1)) * 100);
    const xpPercent = Math.min(100, (clampedXp / (xpRequirement || 1)) * 100);

    // 계가 결과가 없으면 "계가 중..." 표시, 있으면 승리/실패 판단
    const modalTitle = (!analysisResult && isScoring)
        ? "계가 중..." 
        : (analysisResult) 
            ? (isWinner ? "미션 클리어" : "미션 실패")
            : "게임 결과";

    /** PC 레이아웃 고정 — 모바일은 DraggableWindow uniformPcScale로 축소 */
    const isMobile = false;
    const mobileTextScale = 1;

    return (
        <DraggableWindow 
            title={modalTitle}
            onClose={isScoring ? undefined : () => handleClose(session, onClose)} 
            windowId="sp-summary-redesigned"
            initialWidth={736}
            initialHeight={820}
            uniformPcScale
            modal={!isInsideScaledCanvas}
            closeOnOutsideClick={!isInsideScaledCanvas}
            defaultPosition={isInsideScaledCanvas ? { x: 400, y: 0 } : { x: 0, y: 0 }}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
            bodyPaddingClassName="p-4 pb-0"
            bodyScrollable={false}
            footerClassName="border-t border-amber-500/35 bg-gradient-to-t from-[#0c0a10] via-[#14111c] to-[#1c1828] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] text-zinc-200/90"
        >
            <div className={`text-on-panel ${PRE_GAME_MODAL_LAYER_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden text-[clamp(0.875rem,2.5vw,1.125rem)]`}>
                {/* Title */}
                {(analysisResult || (isEnded && session.winner !== null)) && (
                    <div className="mb-2 flex-shrink-0 rounded-xl border-2 border-amber-400/45 bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-950/95 p-3 shadow-[0_0_32px_-12px_rgba(251,191,36,0.28)] sm:p-3.5">
                        <div className={`${SP_SUMMARY_SECTION_LABEL} text-center`}>결과</div>
                        <h1
                            className={`mt-1 text-center font-black tracking-widest ${isMobile ? 'text-lg' : 'text-2xl'} ${isWinner ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300' : 'text-red-400'}`}
                            style={{ fontSize: isMobile ? `${15 * mobileTextScale}px` : undefined }}
                        >
                            {isWinner ? '미션 성공' : '미션 실패'}
                        </h1>
                    </div>
                )}
                {!isScoring && !isEnded && !analysisResult && session.winner === null && (
                    <h1 className={`${isMobile ? 'text-base' : 'text-2xl'} font-black text-center mb-1 sm:mb-2 tracking-widest flex-shrink-0 text-amber-100/90`} style={{ fontSize: isMobile ? `${14 * mobileTextScale}px` : undefined }}>
                        게임 결과
                    </h1>
                )}
                
                <div className="flex min-h-0 flex-1 flex-row gap-2 sm:gap-3">
                    {/* Left Panel: 경기 결과 */}
                    <div className={`flex min-h-0 w-1/2 min-w-0 flex-col ${SP_SUMMARY_PANEL_CLASS} p-2.5 sp-summary-left-panel`}>
                        <h2 className={`${SP_SUMMARY_SECTION_LABEL} mb-2 border-b border-amber-500/25 pb-1.5 text-center`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                            경기 결과
                        </h2>
                        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                            {/* 경기 정보 */}
                            {(analysisResult || (isEnded && session.winner !== null)) && (
                                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 ${isMobile ? 'p-1.5' : 'p-2'}`}>
                                    <div className="flex justify-between items-center" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '12px' }}>
                                        <span className="text-amber-200/65">총 걸린 시간:</span>
                                        <span className="font-semibold text-zinc-100">{gameDuration}</span>
                                    </div>
                                    {(winReasonText || failureReason) && (
                                        <div className="flex flex-col gap-0.5" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '12px' }}>
                                            <span className="text-amber-200/65">{isWinner ? '승리 이유:' : '패배 이유:'}</span>
                                            <span className={`font-semibold ${isWinner ? 'text-emerald-300' : 'text-red-400'}`}>
                                                {winReasonText || failureReason}
                                            </span>
                                        </div>
                                    )}
                                    {survivalModeInfo && (
                                        <div className="flex justify-between items-center pt-0.5 border-t border-amber-500/15 mt-0.5" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '12px' }}>
                                            <span className="text-amber-200/65">백 목표/획득 점수:</span>
                                            <span className={`font-semibold ${survivalModeInfo.captured < survivalModeInfo.target ? 'text-green-400' : 'text-red-400'}`}>
                                                {survivalModeInfo.captured}/{survivalModeInfo.target}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* 계가 결과 — 전략바둑과 동일한 22초 진행 연출 (최소 높이로 진행 막대·카운트 항상 표시) */}
                            {isScoring && !analysisResult && (
                                <div
                                    className={`flex flex-col items-center justify-center ${isMobile ? 'min-h-[132px]' : 'min-h-[200px] flex-1'}`}
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
                                <p className="text-center text-zinc-500">계가 결과가 없습니다.</p>
                            ) : null}
                        </div>
                    </div>
                    
                    {/* Right Panel: 획득 보상 */}
                    <div className={`flex min-h-0 w-1/2 min-w-0 flex-1 flex-col overflow-hidden ${SP_SUMMARY_PANEL_CLASS} p-2.5`}>
                        <h2 className={`${SP_SUMMARY_SECTION_LABEL} mb-2 border-b border-amber-500/25 pb-1.5 text-center`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                            획득 보상
                        </h2>
                        <div className="flex flex-col gap-1.5">
                            {/* 유저 프로필 */}
                            <div className={`flex flex-shrink-0 items-center gap-1.5 ${SP_SUMMARY_INSET_CLASS} ${isMobile ? 'p-1.5' : 'p-2'}`}>
                                <Avatar
                                    userId={currentUser.id}
                                    userName={currentUser.nickname}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={isMobile ? 24 : 32}
                                />
                                <div>
                                    <p className="font-bold text-zinc-100" style={{ fontSize: isMobile ? `${11 * mobileTextScale}px` : '12px' }}>{currentUser.nickname}</p>
                                    <p className="text-amber-200/60" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '11px' }}>
                                        전략 Lv.{currentUser.strategyLevel}
                                    </p>
                                </div>
                            </div>
                            
                            {/* 경험치 표시 */}
                            {displaySummary?.xp && (
                                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 ${isMobile ? 'p-1.5' : 'p-2'}`}>
                                    <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-amber-500/20 bg-black/40">
                                        {/* 이전 경험치 */}
                                        <div
                                            className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 transition-all duration-700 ease-out absolute left-0 top-0"
                                            style={{ width: `${previousXpPercent}%` }}
                                        />
                                        {/* 증가한 경험치 */}
                                        {xpChange > 0 && (
                                            <div
                                                className="h-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 transition-all duration-700 ease-out absolute left-0 top-0"
                                                style={{ 
                                                    width: `${xpChangePercent}%`,
                                                    left: `${previousXpPercent}%`
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '11px' }}>
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
                            
                            {/* 보상 박스들 */}
                            {displaySummary ? (
                                <>
                                    {((displaySummary.gold ?? 0) > 0 || (displaySummary.xp?.change ?? 0) > 0 || (displaySummary.items && displaySummary.items.length > 0)) ? (
                                        <div className="flex gap-1.5 justify-center items-stretch flex-wrap">
                                            {/* Gold Reward */}
                                            {(displaySummary.gold ?? 0) > 0 && (
                                                <div className={`${isMobile ? 'h-16 w-16' : 'h-24 w-24'} flex flex-col items-center justify-center rounded-xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-950/55 via-yellow-900/25 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/15 ${isMobile ? 'p-1' : 'p-2'}`}>
                                                    <img src="/images/icon/Gold.png" alt="골드" className={`${isMobile ? 'w-6 h-6' : 'w-10 h-10'} mb-0.5`} />
                                                    <p className="text-center font-bold text-amber-200" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '11px' }}>
                                                        {(displaySummary.gold ?? 0).toLocaleString()}
                                                    </p>
                                                </div>
                                            )}
                                            {/* XP Reward (박스 형태) */}
                                            {displaySummary.xp && displaySummary.xp.change > 0 && (
                                                <div className={`${isMobile ? 'h-16 w-16' : 'h-24 w-24'} flex flex-col items-center justify-center rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-green-900/20 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-emerald-400/12 ${isMobile ? 'p-1' : 'p-2'}`}>
                                                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} mb-0.5 font-bold text-emerald-200`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '12px' }}>전략</p>
                                                    <p className="text-center font-bold text-emerald-200" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '11px' }}>
                                                        +{displaySummary.xp.change} XP
                                                    </p>
                                                </div>
                                            )}
                                            {/* Item Rewards */}
                                            {displaySummary.items && displaySummary.items.length > 0 && displaySummary.items.slice(0, 2).map((item, idx) => (
                                                <div key={item.id || idx} className={`${isMobile ? 'h-16 w-16' : 'h-24 w-24'} flex flex-col items-center justify-center rounded-xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-950/50 via-purple-900/25 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-violet-400/12 ${isMobile ? 'p-1' : 'p-2'}`}>
                                                    {item.image && (
                                                        <img 
                                                            src={item.image} 
                                                            alt={item.name} 
                                                            className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} mb-0.5 object-contain`}
                                                        />
                                                    )}
                                                    <p className="text-center font-semibold leading-tight text-violet-200" style={{ fontSize: isMobile ? `${8 * mobileTextScale}px` : '10px' }}>
                                                        {item.name}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center py-4">
                                            <p className="text-center text-zinc-500" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '12px' }}>
                                                보상이 없습니다.
                                            </p>
                                        </div>
                                    )}
                                    {displaySummary.items && displaySummary.items.length > 2 && (
                                        <p className="text-center text-zinc-500" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : '11px' }}>
                                            외 {displaySummary.items.length - 2}개 아이템
                                        </p>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center py-4">
                                    <p className="text-center text-zinc-500" style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '12px' }}>
                                        {isScoring ? '계가 중...' : '보상 정보가 없습니다.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className={`${PRE_GAME_MODAL_FOOTER_CLASS} !mt-3 !flex-col !gap-2 !p-3 sm:!gap-3 sm:!p-4 ${isMobile ? '-mx-3 -mb-3' : '-mx-4 -mb-4'} rounded-b-2xl`}
                >
                    <div className={`grid w-full flex-shrink-0 ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-4 gap-2'}`}>
                    <Button
                        onClick={() => {
                            if (isScoring) return;
                            handleClose(session, onClose);
                        }}
                        colorScheme="none"
                        disabled={isScoring}
                        className={`w-full justify-center ${isMobile ? '!min-h-[2.75rem] !py-2 !text-xs' : '!min-h-[3.25rem] !py-2.5 !text-sm'} ${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} ${isScoring ? '!cursor-not-allowed !opacity-45' : ''}`}
                    >
                        확인
                    </Button>
                    <Button
                        onClick={handleNextStage}
                        colorScheme="none"
                        className={`w-full justify-center ${isMobile ? '!min-h-[2.75rem] !py-2 !text-xs' : '!min-h-[3.25rem] !py-2.5 !text-sm'} ${canTryNext && !isProcessing ? PRE_GAME_MODAL_PRIMARY_BTN_CLASS : `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} !cursor-not-allowed !opacity-45`}`}
                        disabled={!canTryNext || isProcessing}
                    >
                        {formatSinglePlayerNextFooterLabel(nextStage, canTryNext, nextStageActionPointCost)}
                    </Button>
                    <Button
                        onClick={handleRetry}
                        colorScheme="none"
                        className={`w-full justify-center ${isMobile ? '!min-h-[2.75rem] !py-2 !text-xs' : '!min-h-[3.25rem] !py-2.5 !text-sm'} ${!isProcessing ? PRE_GAME_MODAL_ACCENT_BTN_CLASS : `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} !cursor-not-allowed !opacity-45`}`}
                        disabled={isProcessing}
                    >
                        재도전 {retryActionPointCost > 0 && `⚡${retryActionPointCost}`}
                    </Button>
                    <Button
                        onClick={handleExitToLobby}
                        colorScheme="none"
                        className={`w-full justify-center ${isMobile ? '!min-h-[2.75rem] !py-2 !text-xs' : '!min-h-[3.25rem] !py-2.5 !text-sm'} ${!isProcessing ? '!min-h-[3.25rem] !rounded-xl !border-2 !border-red-400/55 !bg-gradient-to-r !from-red-600 !via-rose-600 !to-red-800 !text-white !shadow-[0_14px_40px_-12px_rgba(239,68,68,0.45)] hover:!from-red-500 hover:!via-rose-500' : `${PRE_GAME_MODAL_SECONDARY_BTN_CLASS} !cursor-not-allowed !opacity-45`}`}
                        disabled={isProcessing}
                    >
                        나가기
                    </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SinglePlayerSummaryModal;