import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameProps, Player, Point, Move, SinglePlayerStageInfo } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { ScoringOverlay, SCORING_PROGRESS_DURATION_MS } from '../game/ScoringOverlay.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { resolveSinglePlayerSurvivalMode } from '../../shared/utils/singlePlayerStrategicRulePreset.js';

interface SinglePlayerArenaProps extends GameProps {
    isMyTurn: boolean;
    myPlayerEnum: Player;
    handleBoardClick: (x: number, y: number) => void;
    isItemModeActive: boolean;
    showTerritoryOverlay: boolean;
    isMobile: boolean;
    showLastMoveMarker: boolean;
    isPaused?: boolean;
    /** 히든 아이템 사용 시 / AI 히든 연출 시 바둑판 패널 테두리 빛나는 효과 */
    showBoardGlow?: boolean;
    resumeCountdown?: number;
    isBoardLocked?: boolean;
    // 착수 버튼 모드/AI 낙관 표시용 임시 돌 (예상착점)
    pendingMove?: { x: number; y: number; player: Player } | null;
    captureScoreFloatMinPoints?: number;
    onboardingDemoAnchorPoint?: Point | null;
    onboardingForcedFirstMovePoint?: Point | null;
    intro1TutorialHighlight?: Point | null;
}

const getStageModeLabel = (stage: SinglePlayerStageInfo): string => {
    if (stage.hiddenCount !== undefined) return '히든 바둑';
    if (stage.missileCount !== undefined) return '미사일 바둑';
    if (resolveSinglePlayerSurvivalMode(stage)) return '살리기 바둑';
    if (stage.blackTurnLimit !== undefined) return '따내기 바둑';
    if (stage.autoScoringTurns !== undefined) return '계가 목표 바둑';
    if (stage.timeControl?.type === 'fischer') return '스피드 바둑';
    return '정통 바둑';
};

const getStageDescriptionText = (stage: SinglePlayerStageInfo): string => {
    const custom = stage.description?.trim();
    if (custom) return custom;

    const notes: string[] = [
        `${getStageModeLabel(stage)} 규칙으로 진행되는 ${stage.id}입니다.`,
    ];
    if (stage.blackTurnLimit) notes.push(`흑은 ${stage.blackTurnLimit}턴 안에 목표를 달성해야 합니다.`);
    if (stage.survivalTurns) notes.push(`상대가 ${stage.survivalTurns}턴 동안 버티지 못하게 압박하세요.`);
    if (stage.autoScoringTurns) notes.push(`${stage.autoScoringTurns}수 이후 자동 계가가 진행됩니다.`);
    if (stage.missileCount) notes.push(`미사일 ${stage.missileCount}개를 활용할 수 있습니다.`);
    if (stage.hiddenCount) notes.push(`히든 ${stage.hiddenCount}개와 스캔 ${stage.scanCount ?? 0}개를 활용할 수 있습니다.`);
    return notes.join('\n');
};

const StageDescriptionScroll: React.FC<{
    stage: SinglePlayerStageInfo;
    compact?: boolean;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
    mobileOverlay?: boolean;
}> = ({ stage, compact = false, collapsed = false, onToggleCollapsed, mobileOverlay = false }) => {
    const description = getStageDescriptionText(stage);
    const canCollapse = !compact && !!onToggleCollapsed;
    return (
        <section
            onClick={canCollapse ? onToggleCollapsed : undefined}
            className={`pointer-events-auto relative overflow-hidden border border-amber-900/35 bg-[#ead8aa] text-amber-950 shadow-[0_12px_34px_rgba(0,0,0,0.35),inset_0_0_38px_rgba(120,53,15,0.14)] transition-[max-height,border-radius,opacity] duration-300 ease-out ${
                compact
                    ? 'max-h-[70dvh] w-full rounded-2xl p-4'
                    : mobileOverlay
                        ? `w-full ${collapsed ? 'max-h-[38px] cursor-pointer rounded-full px-3 py-1 hover:brightness-105' : 'max-h-[calc(58dvh)] cursor-pointer rounded-2xl p-4'}`
                        : `w-[230px] shrink-0 xl:w-[260px] ${collapsed ? 'max-h-[58px] cursor-pointer rounded-full px-4 py-2 hover:brightness-105' : 'max-h-[calc(100dvh-8rem)] cursor-pointer rounded-2xl p-4'}`
            }`}
            role={canCollapse ? 'button' : undefined}
            tabIndex={canCollapse ? 0 : undefined}
            onKeyDown={canCollapse ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleCollapsed();
                }
            } : undefined}
            aria-expanded={canCollapse ? !collapsed : undefined}
            title={canCollapse ? (collapsed ? '두루마리 펼치기' : '두루마리 말기') : undefined}
        >
            <div className={`pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-amber-900/30 to-transparent transition-all duration-500 ${collapsed ? 'h-full rounded-full' : 'h-3'}`} />
            <div className={`pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900/25 to-transparent transition-all duration-500 ${collapsed ? 'h-full rounded-full' : 'h-3'}`} />
            {!collapsed && (
                <div className="pointer-events-none absolute left-3 right-3 top-2 h-2 rounded-full bg-gradient-to-b from-amber-900/30 via-amber-700/20 to-transparent shadow-inner" />
            )}
            <div className={`${collapsed ? 'mb-0 border-transparent pb-0' : 'mb-3 border-amber-900/30 pb-2'} relative border-b transition-all duration-500`}>
                <div className={`${collapsed ? 'items-center' : 'items-start'} flex justify-between gap-2`}>
                    <div className="min-w-0">
                        <p className={`${collapsed ? 'hidden' : 'block'} text-[11px] font-black uppercase tracking-[0.22em] text-amber-900/75`}>Stage Note</p>
                        <h3 className={`${collapsed ? 'text-sm' : 'mt-1 text-lg'} truncate font-black leading-tight`}>{stage.id}</h3>
                        <p className={`${collapsed ? 'hidden' : 'block'} truncate text-xs font-bold text-amber-900/70`}>{stage.name} · {getStageModeLabel(stage)}</p>
                    </div>
                </div>
            </div>
            <div
                className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                    collapsed ? 'max-h-0 opacity-0' : 'max-h-[56dvh] opacity-100'
                }`}
            >
                <div className="overflow-y-auto whitespace-pre-wrap pr-1 text-sm font-semibold leading-6 text-amber-950/90">
                    {description}
                </div>
            </div>
        </section>
    );
};

const SinglePlayerArena: React.FC<SinglePlayerArenaProps> = (props) => {
    const {
        session,
        currentUser,
        isSpectator,
        isMyTurn,
        myPlayerEnum,
        handleBoardClick,
        isItemModeActive,
        showTerritoryOverlay,
        isMobile,
        showLastMoveMarker,
        isPaused = false,
        showBoardGlow = false,
        resumeCountdown = 0,
        isBoardLocked = false,
        pendingMove = null,
        captureScoreFloatMinPoints = 2,
        onboardingDemoAnchorPoint = null,
        onboardingForcedFirstMovePoint = null,
        intro1TutorialHighlight = null,
    } = props;
    
    const {
        boardState,
        settings,
        lastMove,
        winningLine,
        gameStatus,
        currentPlayer,
        blackPlayerId,
        whitePlayerId,
        player1,
        player2,
        animation,
        blackPatternStones,
        whitePatternStones,
        lastTurnStones,
        hiddenMoves,
        permanentlyRevealedStones,
        newlyRevealed,
        moveHistory,
        revealedHiddenMoves,
        justCaptured,
        baseStones,
        baseStones_p1,
        baseStones_p2,
    } = session;
    const scoringOverlayStorageKey = `scoringOverlayPlayed_${session.id}`;
    const [hasPlayedScoringOverlay, setHasPlayedScoringOverlay] = useState<boolean>(() => {
        try {
            return sessionStorage.getItem(scoringOverlayStorageKey) === '1';
        } catch {
            return false;
        }
    });
    const [showScoringOverlay, setShowScoringOverlay] = useState(false);
    const [stageDescriptionCollapsed, setStageDescriptionCollapsed] = useState(false);
    const arenaFrameRef = useRef<HTMLDivElement | null>(null);
    const [leftGutterWidth, setLeftGutterWidth] = useState(0);

    useEffect(() => {
        try {
            setHasPlayedScoringOverlay(sessionStorage.getItem(scoringOverlayStorageKey) === '1');
        } catch {
            setHasPlayedScoringOverlay(false);
        }
    }, [scoringOverlayStorageKey]);

    useEffect(() => {
        if (gameStatus === 'scoring' && !hasPlayedScoringOverlay) {
            setHasPlayedScoringOverlay(true);
            setShowScoringOverlay(true);
            try {
                sessionStorage.setItem(scoringOverlayStorageKey, '1');
            } catch {
                // ignore storage failure
            }
            const timer = window.setTimeout(() => {
                setShowScoringOverlay(false);
            }, SCORING_PROGRESS_DURATION_MS);
            return () => window.clearTimeout(timer);
        }
        if (gameStatus !== 'scoring') {
            setShowScoringOverlay(false);
        }
    }, [gameStatus, hasPlayedScoringOverlay, scoringOverlayStorageKey]);

    const showPlacedBaseStoneArrays =
        gameStatus === 'base_placement' ||
        gameStatus === 'komi_bidding' ||
        gameStatus === 'komi_bid_reveal' ||
        gameStatus === 'base_color_roulette' ||
        gameStatus === 'base_komi_result' ||
        gameStatus === 'base_game_start_confirmation';

    const myRevealedMoveIndices = useMemo(() => {
        const uid = currentUser?.id;
        const raw = uid && revealedHiddenMoves ? revealedHiddenMoves[uid] : undefined;
        return Array.isArray(raw) ? raw : undefined;
    }, [revealedHiddenMoves, currentUser?.id]);

    const myRevealedStones = useMemo(() => {
        const opp = myPlayerEnum === Player.Black ? Player.White : Player.Black;
        const board = session.boardState;
        const points: Point[] = [];
        if (moveHistory && revealedHiddenMoves && currentUser?.id) {
            const indices = revealedHiddenMoves[currentUser.id];
            if (Array.isArray(indices)) {
                indices
                    .map((index: number) => moveHistory[index])
                    .filter((move: Move | undefined): move is Move => !!move)
                    .filter((move: Move) => {
                        const row = board?.[move.y];
                        const cell = row?.[move.x];
                        return cell === move.player && move.player === opp;
                    })
                    .forEach((move: Move) => points.push({ x: move.x, y: move.y }));
            }
        }
        const aiInitial = (session as { aiInitialHiddenStone?: Point }).aiInitialHiddenStone;
        const scannedByMe = (session as { scannedAiInitialHiddenByUser?: Record<string, boolean> }).scannedAiInitialHiddenByUser?.[currentUser?.id ?? ''];
        if (aiInitial && scannedByMe) {
            const row = board?.[aiInitial.y];
            const cell = row?.[aiInitial.x];
            if (cell === opp && !points.some((p) => p.x === aiInitial.x && p.y === aiInitial.y)) {
                points.push({ x: aiInitial.x, y: aiInitial.y });
            }
        }
        return points;
    }, [moveHistory, revealedHiddenMoves, currentUser?.id, session, myPlayerEnum]);

    // 히든 모드: 마지막 수 표시를 '마지막 비히든 수'로 (새로고침 후 마지막 수가 히든 돌 위치로 겹치는 버그 방지)
    const displayLastMoveKey = useMemo(() => {
        if (!hiddenMoves || typeof hiddenMoves !== 'object' || !moveHistory?.length) {
            return lastMove != null ? `${lastMove.x},${lastMove.y}` : '';
        }
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const m = moveHistory[i];
            if (m.x === -1 && m.y === -1) continue;
            if (!hiddenMoves[i]) return `${m.x},${m.y}`;
        }
        return lastMove != null ? `${lastMove.x},${lastMove.y}` : '';
    }, [lastMove, moveHistory, hiddenMoves]);

    const displayLastMove = useMemo((): Point | null => {
        if (!displayLastMoveKey) return null;
        const [x, y] = displayLastMoveKey.split(',').map(Number);
        return { x, y };
    }, [displayLastMoveKey]);

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player2 : player1;

    // 남은 턴이 0이면 계가 진행되므로, 그 순간부터 클릭 불가 (빠르게 눌러서 추가 착수되는 버그 방지)
    const isBoardDisabledDueToTurnLimit = useMemo(() => {
        if (gameStatus !== 'playing' && gameStatus !== 'hidden_placing') return false;
        const moves = session.moveHistory ?? [];
        const validMovesCount = moves.filter(m => m.x !== -1 && m.y !== -1).length;
        const isTower = session.gameCategory === 'tower';
        if ((session.isSinglePlayer || isTower) && session.stageId) {
            const stage = isTower
                ? TOWER_STAGES.find(s => s.id === session.stageId)
                : SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);
            if (stage?.autoScoringTurns) {
                const totalTurns = (session.totalTurns != null && session.totalTurns > 0)
                    ? Math.max(session.totalTurns, validMovesCount)
                    : validMovesCount;
                const remainingTurns = Math.max(0, stage.autoScoringTurns - totalTurns);
                if (remainingTurns <= 0) return true;
            }
        }
        return false;
    }, [gameStatus, session.isSinglePlayer, session.gameCategory, session.stageId, session.moveHistory, session.totalTurns]);

    const adventureRegionalHeadStartCaptureBonus =
        session.gameCategory === 'adventure'
            ? Math.max(
                  0,
                  Math.floor(
                      Number((session as { adventureRegionalHumanFlatScoreBonus?: unknown }).adventureRegionalHumanFlatScoreBonus ?? 0),
                  ),
              )
            : 0;
    const singlePlayerStage = useMemo(() => {
        if (!session.isSinglePlayer || !session.stageId) return undefined;
        const snap = session.singlePlayerStageDisplay;
        if (snap && snap.id === session.stageId) return snap;
        return SINGLE_PLAYER_STAGES.find((stage) => stage.id === session.stageId);
    }, [session.isSinglePlayer, session.stageId, session.singlePlayerStageDisplay, session.gameStatus]);

    useEffect(() => {
        if (isMobile || !singlePlayerStage) {
            setLeftGutterWidth(0);
            return;
        }
        const updateGutter = () => {
            const frame = arenaFrameRef.current;
            if (!frame) return;
            const frameRect = frame.getBoundingClientRect();
            const centeredBoardSize = Math.min(frameRect.width, frameRect.height);
            setLeftGutterWidth(Math.max(0, (frameRect.width - centeredBoardSize) / 2));
        };
        updateGutter();
        window.addEventListener('resize', updateGutter);
        let frameObserver: ResizeObserver | undefined;
        if (typeof ResizeObserver !== 'undefined') {
            frameObserver = new ResizeObserver(updateGutter);
            if (arenaFrameRef.current) frameObserver.observe(arenaFrameRef.current);
        }
        return () => {
            window.removeEventListener('resize', updateGutter);
            frameObserver?.disconnect();
        };
    }, [isMobile, singlePlayerStage]);

    useEffect(() => {
        if (isMobile && singlePlayerStage) {
            // 모바일 인게임 진입 시 두루마리를 기본 펼침 상태로 시작
            setStageDescriptionCollapsed(false);
        }
    }, [isMobile, singlePlayerStage?.id, session.id]);

    const shouldShowMobileStageDescription =
        isMobile &&
        !!singlePlayerStage &&
        (gameStatus === 'playing' || gameStatus === 'hidden_placing' || gameStatus === 'scoring');
    const isMobileStageDescriptionExpanded = shouldShowMobileStageDescription && !stageDescriptionCollapsed;
    const isMissileAnimating = gameStatus === 'missile_animating';

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* 계가 중: 바둑판 위 오버레이. 결과 수신 시 즉시 숨김(연출 즉시 종료) */}
            {gameStatus === 'scoring' && showScoringOverlay && (
                <ScoringOverlay variant="fullscreen" />
            )}
            <div
                className={`relative w-full h-full transition-opacity duration-500 ${
                    isPaused ? 'opacity-0 pointer-events-none' : 'opacity-100'
                } ${isMobile ? 'flex flex-col' : ''}`}
            >
                {/* 바둑판은 항상 정사각형으로, 주어진 공간 안에 맞춰 축소/확대 */}
                <div
                    ref={arenaFrameRef}
                    className={`relative w-full flex items-center justify-center rounded-lg min-w-0 overflow-hidden ${
                        isMobile ? 'flex-1 min-h-0' : 'h-full'
                    }`}
                >
                {!isMobile && singlePlayerStage && leftGutterWidth > 0 && (
                    <div
                        className="pointer-events-none absolute left-0 top-2 z-[12] flex justify-center px-2"
                        style={{ width: Math.max(180, leftGutterWidth) }}
                    >
                        <StageDescriptionScroll
                            stage={singlePlayerStage}
                            collapsed={stageDescriptionCollapsed}
                            onToggleCollapsed={() => setStageDescriptionCollapsed((prev) => !prev)}
                        />
                    </div>
                )}
                {shouldShowMobileStageDescription && stageDescriptionCollapsed && (
                    <div className="absolute left-2 right-2 top-2 z-[14]">
                        <StageDescriptionScroll
                            stage={singlePlayerStage}
                            collapsed={stageDescriptionCollapsed}
                            onToggleCollapsed={() => setStageDescriptionCollapsed((prev) => !prev)}
                            mobileOverlay
                        />
                    </div>
                )}
                <div className="relative w-full flex-1 max-w-full max-h-full aspect-square min-w-0 min-h-0">
                {shouldShowMobileStageDescription && !stageDescriptionCollapsed && (
                    <div className="absolute left-2 right-2 top-2 z-[14]">
                        <StageDescriptionScroll
                            stage={singlePlayerStage}
                            collapsed={stageDescriptionCollapsed}
                            onToggleCollapsed={() => setStageDescriptionCollapsed((prev) => !prev)}
                            mobileOverlay
                        />
                    </div>
                )}
                <GoBoard
                    boardState={boardState}
                    boardSize={settings.boardSize}
                    onBoardClick={handleBoardClick}
                    onMissileLaunch={(from: Point, direction: 'up' | 'down' | 'left' | 'right') => {
                        // 클라이언트의 boardState를 서버로 전송하여 정확한 검증 가능하도록 함
                        props.onAction({ 
                            type: 'LAUNCH_MISSILE', 
                            payload: { 
                                gameId: session.id, 
                                from, 
                                direction,
                                boardState: boardState, // 클라이언트의 현재 boardState 전송
                                moveHistory: moveHistory || [] // 클라이언트의 moveHistory 전송
                            } 
                        });
                    }}
                    lastMove={displayLastMove}
                    lastTurnStones={lastTurnStones}
                    isBoardDisabled={
                        !isMyTurn ||
                        isSpectator ||
                        isPaused ||
                        isBoardLocked ||
                        isBoardDisabledDueToTurnLimit ||
                        isMobileStageDescriptionExpanded ||
                        isMissileAnimating
                    }
                    stoneColor={myPlayerEnum}
                    winningLine={winningLine}
                    mode={session.mode}
                    myPlayerEnum={myPlayerEnum}
                    gameStatus={gameStatus}
                    currentPlayer={currentPlayer}
                    isSpectator={isSpectator}
                    currentUser={currentUser}
                    blackPlayerNickname={blackPlayer.nickname}
                    whitePlayerNickname={whitePlayer.nickname}
                    animation={animation}
                    isMobile={isMobile}
                    showLastMoveMarker={showLastMoveMarker}
                    blackPatternStones={blackPatternStones}
                    whitePatternStones={whitePatternStones}
                    consumedPatternIntersections={(session as any).consumedPatternIntersections}
                    isItemModeActive={isItemModeActive || showBoardGlow}
                    hiddenMoves={hiddenMoves}
                    moveHistory={moveHistory}
                    permanentlyRevealedStones={permanentlyRevealedStones}
                    newlyRevealed={newlyRevealed}
                    myRevealedStones={myRevealedStones}
                    myRevealedMoveIndices={myRevealedMoveIndices}
                    justCaptured={justCaptured}
                    captures={session.captures}
                    baseStones={baseStones}
                    baseStones_p1={showPlacedBaseStoneArrays ? baseStones_p1 : undefined}
                    baseStones_p2={showPlacedBaseStoneArrays ? baseStones_p2 : undefined}
                    analysisResult={session.analysisResult?.[currentUser.id] ?? ((gameStatus === 'ended' || (gameStatus === 'scoring' && session.analysisResult?.['system'])) ? session.analysisResult?.['system'] : null)}
                    showTerritoryOverlay={showTerritoryOverlay}
                    isSinglePlayer={true}
                    onAction={props.onAction}
                    gameId={session.id}
                    pendingMove={pendingMove}
                    captureScoreFloatMinPoints={captureScoreFloatMinPoints}
                    adventureRegionalHeadStartCaptureBonus={adventureRegionalHeadStartCaptureBonus}
                    onBoardRuleFlash={props.onBoardRuleFlash}
                    onboardingDemoAnchorPoint={onboardingDemoAnchorPoint}
                    onboardingForcedFirstMovePoint={onboardingForcedFirstMovePoint}
                    highlightedPoints={intro1TutorialHighlight ? [intro1TutorialHighlight] : undefined}
                    highlightStyle="ring"
                />
                {showBoardGlow && (
                    <div
                        className="pointer-events-none absolute inset-0 z-[8] rounded-lg ring-[6px] ring-amber-300/95 shadow-[0_0_38px_rgba(251,191,36,0.8),0_0_74px_rgba(244,114,182,0.52),inset_0_0_24px_rgba(251,191,36,0.18)] animate-[pulse_1.05s_cubic-bezier(0.4,0,0.2,1)_infinite]"
                        aria-hidden
                    />
                )}
                </div>
                </div>
            </div>
            {isPaused && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none text-white drop-shadow-lg">
                    <h2 className="text-3xl font-bold tracking-wide">일시 정지</h2>
                    {resumeCountdown > 0 && (
                        <p className="text-lg font-semibold text-amber-200">
                            재개 가능까지 {resumeCountdown}초
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default SinglePlayerArena;