import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LiveGameSession, UserWithStatus, ServerAction, Player, AnalysisResult, GameMode } from '../types.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants/ui.js';
import { AvatarInfo, BorderInfo } from '../types.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants/items.js';
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
import { StrategyXpResultBar } from './game/StrategyXpResultBar.js';
import { getTowerSessionFloor, isTowerHumanWinnerFromSession } from '../utils/towerPreGameDisplay.js';
import { ResultModalXpRewardBadge } from './game/ResultModalXpRewardBadge.js';
import {
    ResultModalGoldCurrencySlot,
    ResultModalItemRewardSlot,
    RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';
import { MobileGameResultTabBar, MobileResultTabPanelStack, type MobileGameResultTab } from './game/MobileGameResultTabBar.js';
import { RESULT_MODAL_SCORE_MOBILE_PX } from './game/resultModalScoreTypography.js';

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
const ScoreDetailsComponent: React.FC<{
    analysis: AnalysisResult;
    session: LiveGameSession;
    isMobile?: boolean;
    mobileTextScale?: number;
    /** 모바일에서 흑·백을 가로 2열로(도전의 탑 등) */
    compactSideBySideMobile?: boolean;
}> = ({ analysis, session, isMobile = false, mobileTextScale = 1, compactSideBySideMobile = false }) => {
    const { scoreDetails } = analysis;
    const { mode, settings } = session;
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;

    if (!scoreDetails) return <p className={`text-center text-zinc-500 ${isMobile ? 'text-sm' : ''}`} style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}>점수 정보가 없습니다.</p>;
    
    const isSpeedMode = mode === GameMode.Speed || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Speed));
    const isBaseMode = mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base));
    const isHiddenMode = mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden));

    const narrow2col = Boolean(isMobile && compactSideBySideMobile);
    const rowFs = isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined;
    const headFs = isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined;
    const totalFs = isMobile ? `${mx.totalRow * mobileTextScale}px` : undefined;
    const outerPad = narrow2col ? 'p-1 space-y-1' : isMobile ? 'p-1.5 space-y-1.5' : 'p-2 space-y-1.5';
    const innerPad = narrow2col ? 'p-0.5' : isMobile ? 'p-1' : 'p-1.5';
    const gridGap = narrow2col ? 'gap-1' : 'gap-1.5 sm:gap-2';

    return (
        <div className={`${outerPad} ${SP_SUMMARY_INSET_CLASS} ${!isMobile ? 'text-base min-[1024px]:text-lg' : ''}`}>
            <div className={`grid ${narrow2col ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} ${gridGap}`}>
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${innerPad}`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile && !narrow2col ? 'text-sm' : ''} ${!isMobile ? 'text-base min-[1024px]:text-lg' : ''}`} style={{ fontSize: headFs }}>흑</h3>
                    <div className="flex justify-between gap-0.5" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">영토</span> <span className="tabular-nums">{scoreDetails.black.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between gap-0.5" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">따낸</span> <span className="tabular-nums">{scoreDetails.black.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between gap-0.5" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">사석</span> <span className="tabular-nums">{scoreDetails.black.deadStones ?? 0}</span></div>
                    {isBaseMode && <div className="flex justify-between gap-0.5 text-blue-300" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">베이스</span> <span className="tabular-nums">{scoreDetails.black.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between gap-0.5 text-purple-300" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">히든</span> <span className="tabular-nums">{scoreDetails.black.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between gap-0.5 text-green-300" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">시간</span> <span className="tabular-nums">{Math.trunc(Number(scoreDetails.black.timeBonus ?? 0))}</span></div>}
                    <div className={`flex justify-between gap-0.5 border-t border-amber-500/20 pt-0.5 mt-0.5 font-bold ${isMobile && !narrow2col ? 'text-sm' : ''} ${!isMobile ? 'text-base min-[1024px]:text-lg' : ''}`} style={{ fontSize: totalFs }}><span>총점</span> <span className="text-amber-200 tabular-nums">{scoreDetails.black.total.toFixed(1)}</span></div>
                </div>
                <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} ${innerPad}`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile && !narrow2col ? 'text-sm' : ''} ${!isMobile ? 'text-base min-[1024px]:text-lg' : ''}`} style={{ fontSize: headFs }}>백</h3>
                    <div className="flex justify-between gap-0.5" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">영토</span> <span className="tabular-nums">{scoreDetails.white.territory.toFixed(0)}</span></div>
                    <div className="flex justify-between gap-0.5" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">따낸</span> <span className="tabular-nums">{scoreDetails.white.liveCaptures ?? 0}</span></div>
                    <div className="flex justify-between gap-0.5" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">사석</span> <span className="tabular-nums">{scoreDetails.white.deadStones ?? 0}</span></div>
                    <div className="flex justify-between gap-0.5" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">덤</span> <span className="tabular-nums">{scoreDetails.white.komi}</span></div>
                    {isBaseMode && <div className="flex justify-between gap-0.5 text-blue-300" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">베이스</span> <span className="tabular-nums">{scoreDetails.white.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className="flex justify-between gap-0.5 text-purple-300" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">히든</span> <span className="tabular-nums">{scoreDetails.white.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className="flex justify-between gap-0.5 text-green-300" style={{ fontSize: rowFs }}><span className="min-w-0 shrink">시간</span> <span className="tabular-nums">{Math.trunc(Number(scoreDetails.white.timeBonus ?? 0))}</span></div>}
                    <div className={`flex justify-between gap-0.5 border-t border-amber-500/20 pt-0.5 mt-0.5 font-bold ${isMobile && !narrow2col ? 'text-sm' : ''} ${!isMobile ? 'text-base min-[1024px]:text-lg' : ''}`} style={{ fontSize: totalFs }}><span>총점</span> <span className="text-amber-200 tabular-nums">{scoreDetails.white.total.toFixed(1)}</span></div>
                </div>
            </div>
        </div>
    );
};

const TowerSummaryModal: React.FC<TowerSummaryModalProps> = ({ session, currentUser, onAction, onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [mobileResultTab, setMobileResultTab] = useState<MobileGameResultTab>('match');

    const { modalLayerUsesDesignPixels } = useAppContext();
    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const useBodyScrollSizing = modalLayerUsesDesignPixels || isMobile;
    const isScoring = session.gameStatus === 'scoring';
    const isEnded = session.gameStatus === 'ended';
    const analysisResult = session.analysisResult?.['system'];
    const summary = session.summary?.[currentUser.id];
    
    // 계가 결과가 있으면 점수를 기반으로 승리/실패 판단, 없으면 session.winner 사용 (`towerPreGameDisplay`와 인게임 푸터 동일)
    const isWinner = isTowerHumanWinnerFromSession(session);
    const currentFloor = getTowerSessionFloor(session);
    const currentStage = TOWER_STAGES.find((s: any) => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === currentFloor;
    });
    const nextFloor = currentFloor < 100 ? currentFloor + 1 : null;
    const nextStage = nextFloor ? TOWER_STAGES.find((s: any) => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === nextFloor;
    }) : null;
    
    const userTowerFloor = currentUser.towerFloor ?? 0;
    const isCleared = currentFloor <= userTowerFloor;
    // 결과창은 서버가 확정한 실제 지급 내역(summary)만 표시한다.
    const displaySummary = summary;
    const hasRewardSlots =
        !!displaySummary &&
        ((displaySummary.gold ?? 0) > 0 ||
            (displaySummary.xp?.change ?? 0) > 0 ||
            (Array.isArray(displaySummary.items) && displaySummary.items.length > 0));
    
    // 다음 층으로 갈 수 있는지 확인: 이번 게임에서 승리했거나, 이미 이 층을 한 번이라도 클리어한 적이 있으면 다음 층 가능
    // (재도전에서 실패해도 한 번 클리어한 층이면 다음 층으로 진행 가능)
    const canTryNext = !!nextStage && (isWinner || isCleared);
    
    // 입장 시 차감이 0이었으면(이미 클리어한 층 재도전 등) 패배 후에도 재도전 ⚡0 — towerFloor 반영 지연 시 보정. 할인 반영값은 세션 우선
    const baseRetryApCost = currentStage?.actionPointCost ?? 0;
    const baseNextFloorApCost = nextStage?.actionPointCost ?? 0;
    const inferredRetryApCost = isCleared ? 0 : baseRetryApCost;
    const effectiveRetryActionPointCost =
        session.towerStartActionPointCost === 0
            ? 0
            : typeof session.towerStartActionPointCost === 'number'
              ? session.towerStartActionPointCost
              : inferredRetryApCost;
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
            await onAction({ type: 'START_TOWER_GAME', payload: { floor: currentFloor } });
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
            await onAction({ type: 'START_TOWER_GAME', payload: { floor: nextFloor } });
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

    /** 싱글/일반 결과 모달과 동일: 전략 경험치 바 + 현재/필요 XP + 변동 (summary 유무와 관계없이 표시) */
    const renderTowerStrategyXpPanel = (compact: boolean) => (
        <div className={`space-y-0.5 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 ${compact ? 'p-1' : 'p-1.5'}`}>
            <div
                className={`text-center font-bold uppercase tracking-[0.12em] text-amber-200/75 ${compact ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}
            >
                경험치
            </div>
            <StrategyXpResultBar
                previousXpPercent={previousXpPercent}
                finalXpPercent={xpPercent}
                xpGain={xpChange}
                className={compact ? 'h-2' : 'h-2.5'}
            />
            <div
                className={`flex min-w-0 flex-nowrap items-center justify-between gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] ${compact ? '' : 'text-sm'}`}
                style={{ fontSize: compact ? `${9 * mobileTextScale}px` : undefined }}
            >
                <span className="min-w-0 shrink font-mono whitespace-nowrap text-zinc-300/95">
                    {clampedXp.toLocaleString()} / {xpRequirement.toLocaleString()} XP
                </span>
                {xpChange > 0 ? (
                    <span className="shrink-0 whitespace-nowrap font-semibold text-green-400">+{xpChange.toLocaleString()} XP</span>
                ) : xpChange < 0 ? (
                    <span className="shrink-0 whitespace-nowrap font-semibold text-rose-400">{xpChange.toLocaleString()} XP</span>
                ) : (
                    <span className="shrink-0 whitespace-nowrap font-semibold text-zinc-500">변동 없음</span>
                )}
            </div>
        </div>
    );

    // 계가 결과가 없으면 "계가 중..." 표시, 있으면 승리/실패 판단
    const modalTitle = (!analysisResult && isScoring)
        ? "계가 중..." 
        : (analysisResult) 
            ? (isWinner ? "층 클리어" : "층 실패")
            : "게임 결과";

    const mobileTextScale = 1;

    const panelSizing = isMobile ? 'min-w-0 flex-1 basis-0' : 'min-w-0 min-h-0 w-1/2 shrink-0';

    useEffect(() => {
        setMobileResultTab('match');
    }, [session.id]);

    const towerRewardsSection = (
        <div className={`flex flex-col ${SP_SUMMARY_PANEL_CLASS} shrink-0 ${isMobile ? 'gap-1 p-1.5' : 'gap-1.5 p-2'}`}>
            <h2
                className={`${SP_SUMMARY_SECTION_LABEL} border-b border-amber-500/25 text-center ${isMobile ? 'mb-0.5 pb-0.5' : 'mb-1 pb-0.5 sm:mb-2 sm:pb-1'}`}
                style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '15px' }}
            >
                획득 보상
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
                        className="px-2 text-center text-gray-400"
                        style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : '14px' }}
                    >
                        {isScoring ? '계가 중...' : '보상 정보가 없습니다.'}
                    </p>
                ) : !hasRewardSlots ? (
                    <p
                        className="px-2 text-center text-gray-400"
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
                        {displaySummary?.xp && displaySummary.xp.change > 0 && (
                            <div className={`flex flex-col items-center justify-center ${!summary ? 'opacity-80' : ''}`}>
                                <ResultModalXpRewardBadge
                                    variant="strategy"
                                    amount={displaySummary.xp.change}
                                    density={isMobile ? 'compact' : 'comfortable'}
                                />
                            </div>
                        )}
                        {displaySummary?.items &&
                            displaySummary.items.length > 0 &&
                            displaySummary.items.map((item, idx) => {
                                const displayName = item.name ?? ('itemId' in item ? (item as any).itemId : undefined);
                                if (!displayName) return null;
                                const nameWithSpace = displayName.includes('골드꾸러미')
                                    ? displayName.replace('골드꾸러미', '골드 꾸러미')
                                    : displayName;
                                const nameWithoutSpace = displayName.includes('골드 꾸러미')
                                    ? displayName.replace('골드 꾸러미', '골드꾸러미')
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
        </div>
    );

    return (
        <DraggableWindow 
            title={modalTitle}
            onClose={isScoring ? undefined : () => handleClose(session, onClose)} 
            windowId="tower-summary-redesigned"
            initialWidth={840}
            shrinkHeightToContent
            uniformPcScale={false}
            mobileViewportFit
            mobileViewportMaxHeightVh={97}
            bodyPaddingClassName={isMobile ? 'p-2 pb-0 sm:p-3 sm:pb-0' : 'p-3 sm:p-4'}
            modal={!modalLayerUsesDesignPixels}
            closeOnOutsideClick={!modalLayerUsesDesignPixels}
            defaultPosition={modalLayerUsesDesignPixels ? { x: 400, y: 0 } : { x: 0, y: 0 }}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
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
                
                {isMobile ? (
                    <>
                        <MobileGameResultTabBar
                            active={mobileResultTab}
                            onChange={setMobileResultTab}
                            matchLabel="경기 결과"
                            recordLabel="내 정보"
                        />
                        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable] [scrollbar-width:thin]">
                                <MobileResultTabPanelStack
                                    active={mobileResultTab}
                                    matchPanel={
                                    <div
                                        className={`flex flex-col ${SP_SUMMARY_PANEL_CLASS} min-h-0 p-2 sp-summary-left-panel overflow-x-hidden overflow-y-visible`}
                                    >
                                        <h2
                                            className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                            style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.sectionLabel * mobileTextScale}px` }}
                                        >
                                            경기 결과
                                        </h2>
                                        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-visible">
                                            {(analysisResult || (isEnded && session.winner !== null)) && (
                                                <div className={`p-1 ${SP_SUMMARY_INSET_CLASS} flex-shrink-0 space-y-0.5`}>
                                                    <div className="flex items-center justify-between" style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.dataRow * mobileTextScale}px` }}>
                                                        <span className="text-amber-200/65">총 걸린 시간:</span>
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
                                                    compactSideBySideMobile
                                                />
                                            ) : !isScoring && !isEnded ? (
                                                <p className="text-center text-gray-400">계가 결과가 없습니다.</p>
                                            ) : null}
                                        </div>
                                    </div>
                                    }
                                    recordPanel={
                                    <div className={`flex flex-col gap-1.5 ${SP_SUMMARY_PANEL_CLASS} p-2`}>
                                        <h2
                                            className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                            style={{ fontSize: `${RESULT_MODAL_SCORE_MOBILE_PX.sectionLabel * mobileTextScale}px` }}
                                        >
                                            내 정보
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
                                                    전략 Lv.{currentUser.strategyLevel}
                                                </p>
                                            </div>
                                        </div>
                                        {renderTowerStrategyXpPanel(true)}
                                    </div>
                                    }
                                />
                            </div>
                            {towerRewardsSection}
                        </div>
                    </>
                ) : (
                    <div className="flex min-w-0 flex-row items-stretch gap-1.5 overflow-visible sm:gap-2">
                        <div
                            className={`${panelSizing} flex flex-col ${SP_SUMMARY_PANEL_CLASS} overflow-visible p-2 sp-summary-left-panel`}
                        >
                            <h2
                                className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                style={{ fontSize: '15px' }}
                            >
                                경기 결과
                            </h2>
                            <div className="flex flex-col gap-1.5 overflow-visible">
                                {(analysisResult || (isEnded && session.winner !== null)) && (
                                    <div className={`${SP_SUMMARY_INSET_CLASS} space-y-0.5 p-1.5 flex-shrink-0`}>
                                        <div className="flex items-center justify-between" style={{ fontSize: '15px' }}>
                                            <span className="text-amber-200/65">총 걸린 시간:</span>
                                            <span className="font-semibold text-zinc-100">{gameDuration}</span>
                                        </div>
                                        {(winReasonText || failureReason) && (
                                            <p className={`text-[15px] font-semibold leading-snug ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                                                {winReasonText || failureReason}
                                            </p>
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
                                    <p className="text-center text-gray-400">계가 결과가 없습니다.</p>
                                ) : null}
                            </div>
                        </div>
                        <div className={`${panelSizing} flex min-w-0 flex-col gap-1.5 overflow-visible`}>
                            <div className={`flex flex-col gap-1.5 ${SP_SUMMARY_PANEL_CLASS} overflow-visible p-2`}>
                                <h2
                                    className={`${SP_SUMMARY_SECTION_LABEL} mb-1 border-b border-amber-500/25 pb-0.5 text-center sm:mb-2 sm:pb-1`}
                                    style={{ fontSize: '15px' }}
                                >
                                    내 정보
                                </h2>
                                <div className={`${SP_SUMMARY_INSET_CLASS} flex flex-shrink-0 items-center gap-1.5 p-1.5`}>
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
                                {renderTowerStrategyXpPanel(false)}
                            </div>
                            {towerRewardsSection}
                        </div>
                    </div>
                )}
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

