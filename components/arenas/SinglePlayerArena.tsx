import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GameProps, GameStatus, Player, Point, Move } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { resolveSinglePlayerAutoScoringCapForClientSession } from '../../shared/utils/liveSessionSinglePlayerStage.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
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

const SinglePlayerArena: React.FC<SinglePlayerArenaProps> = (props) => {
    const { t } = useTranslation('game');
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
    const missileTimeoutRequestKeyRef = useRef<string | null>(null);

    const basePrePlayStatusesForBoard: readonly GameStatus[] = [
        'base_placement',
        'base_stone_color_choice',
        'base_same_color_points_bid',
        'base_game_start_confirmation',
    ];
    const isBaseCaptureMixBidOnBoard = gameStatus === 'capture_bidding' && modeIncludesBaseCaptureMix(mode, settings);
    const isBasePrePlayOnBoard = basePrePlayStatusesForBoard.includes(gameStatus) || isBaseCaptureMixBidOnBoard;
    const showPlacedBaseStoneArrays = isBasePrePlayOnBoard;
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
                    className={`relative w-full min-w-0 overflow-hidden rounded-lg ${
                        isMobile
                            ? 'flex flex-1 min-h-0 flex-col items-stretch'
                            : 'flex h-full items-center justify-center'
                    }`}
                >
                <div
                    className={
                        isMobile
                            ? 'relative flex min-h-0 w-full min-w-0 flex-1 items-center justify-center'
                            : 'relative aspect-square min-h-0 w-full max-h-full max-w-full flex-1'
                    }
                >
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
                        isMissileAnimating
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
                </div>
                </div>
                </div>
            </div>
            {isPaused && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none text-white drop-shadow-lg">
                    <h2 className="text-3xl font-bold tracking-wide">{t('board.paused')}</h2>
                    {resumeCountdown > 0 && (
                        <p className="text-lg font-semibold text-amber-200">
                            {t('board.resumeIn', { seconds: resumeCountdown })}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default SinglePlayerArena;