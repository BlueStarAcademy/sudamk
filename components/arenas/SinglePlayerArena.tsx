import React, { useMemo } from 'react';
import { GameProps, Player, Point, Move } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { ScoringOverlay } from '../game/ScoringOverlay.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';

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

    const showPlacedBaseStoneArrays =
        gameStatus === 'base_placement' ||
        gameStatus === 'komi_bidding' ||
        gameStatus === 'komi_bid_reveal' ||
        gameStatus === 'base_color_roulette' ||
        gameStatus === 'base_komi_result' ||
        gameStatus === 'base_game_start_confirmation';

    const myRevealedStones = useMemo(() => {
        const points: Point[] = [];
        if (moveHistory && revealedHiddenMoves && currentUser?.id) {
            const indices = revealedHiddenMoves[currentUser.id];
            if (Array.isArray(indices)) {
                indices
                    .map((index: number) => moveHistory[index])
                    .filter((move: Move | undefined): move is Move => !!move)
                    .forEach((move: Move) => points.push({ x: move.x, y: move.y }));
            }
        }
        const aiInitial = (session as { aiInitialHiddenStone?: Point }).aiInitialHiddenStone;
        const scannedByMe = (session as { scannedAiInitialHiddenByUser?: Record<string, boolean> }).scannedAiInitialHiddenByUser?.[currentUser?.id ?? ''];
        if (aiInitial && scannedByMe && !points.some(p => p.x === aiInitial.x && p.y === aiInitial.y)) {
            points.push({ x: aiInitial.x, y: aiInitial.y });
        }
        return points;
    }, [moveHistory, revealedHiddenMoves, currentUser?.id, session]);

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

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* 계가 중: 바둑판 위 오버레이. 결과 수신 시 즉시 숨김(연출 즉시 종료) */}
            {gameStatus === 'scoring' && !session.analysisResult?.['system'] && <ScoringOverlay variant="fullscreen" />}
            <div className={`relative w-full h-full transition-opacity duration-500 ${isPaused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {/* 바둑판은 항상 정사각형으로, 주어진 공간 안에 맞춰 축소/확대 */}
                <div className="w-full h-full flex items-center justify-center rounded-lg min-w-0 min-h-0 overflow-hidden">
                <div className="w-full h-full max-w-full max-h-full aspect-square min-w-0 min-h-0">
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
                    isBoardDisabled={!isMyTurn || isSpectator || isPaused || isBoardLocked || isBoardDisabledDueToTurnLimit}
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
                    onBoardRuleFlash={props.onBoardRuleFlash}
                    onboardingDemoAnchorPoint={onboardingDemoAnchorPoint}
                    onboardingForcedFirstMovePoint={onboardingForcedFirstMovePoint}
                    highlightedPoints={intro1TutorialHighlight ? [intro1TutorialHighlight] : undefined}
                    highlightStyle="ring"
                />
                </div>
                </div>
                {/* 히든 사용 중: 테두리만 깜빡이도록 보드 위 오버레이 (뒤에 두면 판에 가려짐) */}
                {showBoardGlow && (
                    <div
                        className="pointer-events-none absolute inset-0 z-[8] rounded-lg ring-[6px] ring-amber-300/95 shadow-[0_0_38px_rgba(251,191,36,0.8),0_0_74px_rgba(244,114,182,0.52),inset_0_0_24px_rgba(251,191,36,0.18)] animate-[pulse_1.05s_cubic-bezier(0.4,0,0.2,1)_infinite]"
                        aria-hidden
                    />
                )}
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