import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameProps, GameStatus, Player, Point, Move, SinglePlayerStageInfo } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { getSinglePlayerStages } from '../../constants/singlePlayerConstants.js';
import { resolveSinglePlayerAutoScoringCapForClientSession } from '../../shared/utils/liveSessionSinglePlayerStage.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { resolveSinglePlayerSurvivalMode } from '../../shared/utils/singlePlayerStrategicRulePreset.js';
import { canViewerPlaceMoreBaseStones } from '../../shared/utils/basePlacementCanPlaceMore.js';
import { resolveBasePlacementSeatColors } from '../../shared/utils/basePlacementSeatColors.js';
import { modeIncludesBaseCaptureMix } from '../../shared/utils/liveSessionArenaKind.js';

interface SinglePlayerArenaProps extends GameProps {
    /** 전략 대표펫 힌트: Game.tsx → GameArena → 바둑판 파란 점 */
    strategicPetHintBoardOverlay?: { x: number; y: number; message: string; showBubble: boolean } | null;
    strategicPetHintRewardAnimation?: { id: string; x: number; y: number; iconSrc: string; quantityLabel: string } | null;
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
    intro1TutorialHighlight?: Point | null;
    boardRuleFlashMessage?: string | null;
    blockScoringBoardAnalysis?: boolean;
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
            title={canCollapse ? (collapsed ? '두루마리 펼치기' : '두루마리 접기') : undefined}
        >
            <div className={`pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-amber-900/30 to-transparent transition-all duration-500 ${collapsed ? 'h-full rounded-full' : 'h-3'}`} />
            <div className={`pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900/25 to-transparent transition-all duration-500 ${collapsed ? 'h-full rounded-full' : 'h-3'}`} />
            {!collapsed && (
                <div className="pointer-events-none absolute left-3 right-3 top-2 h-2 rounded-full bg-gradient-to-b from-amber-900/30 via-amber-700/20 to-transparent shadow-inner" />
            )}
            {mobileOverlay && !collapsed && onToggleCollapsed && (
                <div className="relative z-[1] mb-2 flex shrink-0 justify-center">
                    <button
                        type="button"
                        className="pointer-events-auto rounded-full border border-amber-900/40 bg-amber-900/15 px-3 py-1 text-xs font-black tracking-wide text-amber-950 shadow-sm hover:bg-amber-900/25 active:scale-[0.98]"
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleCollapsed();
                        }}
                    >
                        접기
                    </button>
                </div>
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
        intro1TutorialHighlight = null,
        boardRuleFlashMessage = null,
        blockScoringBoardAnalysis = false,
        singlePlayerStagesListRevision = 0,
        strategicPetHintBoardOverlay = null,
        strategicPetHintRewardAnimation = null,
    } = props;

    const strategicPetHintDotOverlay = useMemo(() => {
        if (!strategicPetHintBoardOverlay) return null;
        const { x, y } = strategicPetHintBoardOverlay;
        if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0) return null;
        return { x, y };
    }, [strategicPetHintBoardOverlay]);
    
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
        mode,
    } = session;
    const [stageDescriptionCollapsed, setStageDescriptionCollapsed] = useState(false);
    const arenaFrameRef = useRef<HTMLDivElement | null>(null);
    const missileTimeoutRequestKeyRef = useRef<string | null>(null);
    const [leftGutterWidth, setLeftGutterWidth] = useState(0);

    /** 모바일에서 스테이지 두루마리를 펼쳐도, 베이스 사전 단계에서는 판에 놓인 베이스돌을 항상 표시해야 함(그렇지 않으면 배치·덤 UI가 깨져 보임). */
    const basePrePlayStatusesForBoard: readonly GameStatus[] = [
        'base_placement',
        'base_stone_color_choice',
        'base_same_color_points_bid',
        'base_game_start_confirmation',
    ];
    const isBaseCaptureMixBidOnBoard = gameStatus === 'capture_bidding' && modeIncludesBaseCaptureMix(mode, settings);
    const isBasePrePlayOnBoard = basePrePlayStatusesForBoard.includes(gameStatus) || isBaseCaptureMixBidOnBoard;
    const allowBackBoardBaseStonesOnMobile = !isMobile || stageDescriptionCollapsed || isBasePrePlayOnBoard;
    const showPlacedBaseStoneArrays = allowBackBoardBaseStonesOnMobile && isBasePrePlayOnBoard;
    /**
     * 사전 단계는 임시 좌석을 사용해 베이스돌 색을 결정한다.
     * 본대국 좌석(`session.blackPlayerId`)은 색 확정 전에는 비어 있어야 정상이다.
     */
    const { baseStonesP1Player, baseStonesP2Player } = resolveBasePlacementSeatColors(session);

    const canPlaceMoreBaseStones = useMemo(
        () => canViewerPlaceMoreBaseStones(session, currentUser.id),
        [session, currentUser.id]
    );

    useEffect(() => {
        if (gameStatus !== 'missile_selecting' || typeof session.itemUseDeadline !== 'number') {
            missileTimeoutRequestKeyRef.current = null;
            return undefined;
        }

        const requestKey = `${session.id}:${session.itemUseDeadline}`;
        const requestTimeout = () => {
            if (missileTimeoutRequestKeyRef.current === requestKey) return;
            missileTimeoutRequestKeyRef.current = requestKey;
            props.onAction({
                type: 'MISSILE_ITEM_TIMEOUT',
                payload: { gameId: session.id },
            });
        };

        const delayMs = session.itemUseDeadline - Date.now() + 250;
        if (delayMs <= 0) {
            requestTimeout();
            return undefined;
        }

        const timeoutId = window.setTimeout(requestTimeout, delayMs);
        return () => window.clearTimeout(timeoutId);
    }, [gameStatus, session.id, session.itemUseDeadline, props.onAction]);

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
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;

    // 남은 턴이 0이면 계가 진행되므로, 그 순간부터 클릭 불가 (빠르게 눌러서 추가 착수되는 버그 방지)
    const isBoardDisabledDueToTurnLimit = useMemo(() => {
        if (gameStatus !== 'playing' && gameStatus !== 'hidden_placing') return false;
        const moves = session.moveHistory ?? [];
        const validMovesCount = moves.filter(m => m.x !== -1 && m.y !== -1).length;
        const isTower = session.gameCategory === 'tower';
        if ((session.isSinglePlayer || isTower) && session.stageId) {
            const cap = isTower
                ? TOWER_STAGES.find(s => s.id === session.stageId)?.autoScoringTurns
                : resolveSinglePlayerAutoScoringCapForClientSession(session as any);
            if (cap) {
                const totalTurns = (session.totalTurns != null && session.totalTurns > 0)
                    ? Math.max(session.totalTurns, validMovesCount)
                    : validMovesCount;
                const remainingTurns = Math.max(0, cap - totalTurns);
                if (remainingTurns <= 0) return true;
            }
        }
        return false;
    }, [
        gameStatus,
        session.isSinglePlayer,
        session.gameCategory,
        session.stageId,
        session.moveHistory,
        session.totalTurns,
        session.settings,
        (session as any).singlePlayerStageDisplay,
        singlePlayerStagesListRevision,
    ]);

    const adventureRegionalHeadStartCaptureBonus =
        session.gameCategory === 'adventure'
            ? Math.max(
                  0,
                  Math.floor(
                      Number((session as { adventureRegionalHumanFlatScoreBonus?: unknown }).adventureRegionalHumanFlatScoreBonus ?? 0),
                  ),
              )
            : 0;
    const singlePlayerStage = useMemo((): SinglePlayerStageInfo | undefined => {
        if (!session.isSinglePlayer || !session.stageId) return undefined;
        const snap = session.singlePlayerStageDisplay;
        if (snap && snap.id === session.stageId) return snap;
        const fromList = getSinglePlayerStages().find((stage) => stage.id === session.stageId);
        if (fromList) return fromList;
        // 관리자 스테이지 순서 재배치 등으로 stageId는 갱신됐는데 스냅샷 id만 남은 경우: 두루마리·규칙 표시용 폴백
        if (snap && typeof snap.id === 'string') {
            return { ...snap, id: session.stageId };
        }
        return undefined;
    }, [
        session.isSinglePlayer,
        session.stageId,
        session.singlePlayerStageDisplay,
        session.gameStatus,
        singlePlayerStagesListRevision,
    ]);

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

    // 모바일: 스테이지 진입 시 두루마리를 펼친 상태로 시작
    useEffect(() => {
        if (isMobile && singlePlayerStage) {
            setStageDescriptionCollapsed(false);
        }
    }, [isMobile, singlePlayerStage?.id, session.id]);

    const shouldShowMobileStageDescription =
        isMobile &&
        !!singlePlayerStage &&
        (gameStatus === 'playing' ||
            gameStatus === 'hidden_placing' ||
            gameStatus === 'scoring' ||
            gameStatus === 'ended' ||
            gameStatus === 'no_contest');
    const mobileStageScrollExpanded =
        shouldShowMobileStageDescription && !stageDescriptionCollapsed;
    const isMissileAnimating = gameStatus === 'missile_animating';

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            <div
                className={`relative w-full h-full transition-opacity duration-500 ${
                    isPaused ? 'opacity-0 pointer-events-none' : 'opacity-100'
                } ${isMobile ? 'flex flex-col' : ''}`}
            >
                {/* 바둑판은 항상 정사각형으로, 주어진 공간 안에 맞춰 축소/확대 */}
                <div
                    ref={arenaFrameRef}
                    className={`relative w-full min-w-0 overflow-hidden rounded-lg ${
                        isMobile
                            ? 'flex flex-1 min-h-0 flex-col items-stretch'
                            : 'flex h-full items-center justify-center'
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
                {/* 모바일 상단 슬롯: 높이를 항상 pt-2(8px) + 38px로 고정 → 접힘/펼침 시 바둑판 패널 위치 동일 */}
                {shouldShowMobileStageDescription && (
                    <div className="relative z-10 box-border flex h-[46px] w-full shrink-0 flex-col px-2 pt-2">
                        <div className="flex h-[38px] min-h-0 w-full items-center overflow-hidden">
                            {stageDescriptionCollapsed ? (
                                <StageDescriptionScroll
                                    stage={singlePlayerStage}
                                    collapsed
                                    onToggleCollapsed={() => setStageDescriptionCollapsed((prev) => !prev)}
                                    mobileOverlay
                                />
                            ) : (
                                <div className="h-full w-full shrink-0" aria-hidden />
                            )}
                        </div>
                    </div>
                )}
                <div
                    className={
                        isMobile
                            ? 'relative flex min-h-0 w-full min-w-0 flex-1 items-center justify-center'
                            : 'relative aspect-square min-h-0 w-full max-h-full max-w-full flex-1'
                    }
                >
                {shouldShowMobileStageDescription && !stageDescriptionCollapsed && (
                    <div className="absolute left-2 right-2 top-2 z-[30]">
                        <StageDescriptionScroll
                            stage={singlePlayerStage}
                            collapsed={stageDescriptionCollapsed}
                            onToggleCollapsed={() => setStageDescriptionCollapsed(true)}
                            mobileOverlay
                        />
                    </div>
                )}
                <div
                    className={
                        isMobile
                            ? 'relative aspect-square h-auto max-h-full w-full min-h-0 max-w-full'
                            : 'relative h-full w-full'
                    }
                >
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
                        // 베이스 배치: 양쪽(유저·AI) 동시 배치 단계 — 턴 표시와 무관하게 유저가 찍어야 함 (GoGameArena와 동일)
                        (!isMyTurn && gameStatus !== 'base_placement') ||
                        isSpectator ||
                        isPaused ||
                        // 미사일 좌표 선택 중에는 응답 대기 등으로 isBoardLocked여도 판 조작이 필요하다.
                        (isBoardLocked && gameStatus !== 'missile_selecting') ||
                        isBoardDisabledDueToTurnLimit ||
                        isMissileAnimating ||
                        mobileStageScrollExpanded
                    }
                    stoneColor={myPlayerEnum}
                    winningLine={winningLine}
                    mode={session.mode}
                    mixedModes={session.settings?.mixedModes}
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
                    isItemModeActive={isItemModeActive}
                    showBoardGlow={showBoardGlow}
                    hiddenMoves={hiddenMoves}
                    moveHistory={moveHistory}
                    permanentlyRevealedStones={permanentlyRevealedStones}
                    newlyRevealed={newlyRevealed}
                    myRevealedStones={myRevealedStones}
                    myRevealedMoveIndices={myRevealedMoveIndices}
                    justCaptured={justCaptured}
                    captures={session.captures}
                    speedTimePressureGranted={(session.settings as any)?.__speedTimePressureGranted}
                    baseStones={baseStones}
                    baseStones_p1={showPlacedBaseStoneArrays ? baseStones_p1 : undefined}
                    baseStones_p2={showPlacedBaseStoneArrays ? baseStones_p2 : undefined}
                    baseStonesP1Player={baseStonesP1Player}
                    baseStonesP2Player={baseStonesP2Player}
                    analysisResult={
                        blockScoringBoardAnalysis
                            ? null
                            : session.analysisResult?.[currentUser.id] ??
                              ((gameStatus === 'ended' || gameStatus === 'scoring')
                                  ? session.analysisResult?.['system']
                                  : null)
                    }
                    showTerritoryOverlay={showTerritoryOverlay}
                    isSinglePlayer={true}
                    onAction={props.onAction}
                    gameId={session.id}
                    pendingMove={pendingMove}
                    captureScoreFloatMinPoints={captureScoreFloatMinPoints}
                    adventureRegionalHeadStartCaptureBonus={adventureRegionalHeadStartCaptureBonus}
                    onBoardRuleFlash={props.onBoardRuleFlash}
                    highlightedPoints={intro1TutorialHighlight ? [intro1TutorialHighlight] : undefined}
                    highlightStyle="ring"
                    canPlaceMoreBaseStones={canPlaceMoreBaseStones}
                    strategicPetHintOverlay={strategicPetHintDotOverlay}
                    strategicPetHintRewardAnimation={strategicPetHintRewardAnimation}
                    boardRuleFlashMessage={boardRuleFlashMessage}
                    uniformStoneDisplayColor={session.uniformStoneDisplayColor ?? null}
                />
                {mobileStageScrollExpanded && (
                    <div
                        className="absolute inset-0 z-[20] bg-transparent touch-none"
                        aria-hidden
                    />
                )}
                </div>
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