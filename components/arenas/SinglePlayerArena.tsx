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
    const displayLastMove = useMemo(() => {
        if (!hiddenMoves || typeof hiddenMoves !== 'object' || !moveHistory?.length) return lastMove;
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const m = moveHistory[i];
            if (m.x === -1 && m.y === -1) continue;
            if (!hiddenMoves[i]) return { x: m.x, y: m.y };
        }
        return lastMove;
    }, [lastMove, moveHistory, hiddenMoves]);

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
                {/* 히든 사용 중: 테두리만 깜빡이도록 별도 레이어 사용 (바둑판은 깜빡이지 않음) */}
                {showBoardGlow && (
                    <div className="absolute inset-0 rounded-lg pointer-events-none ring-4 ring-amber-400/90 shadow-[0_0_24px_rgba(251,191,36,0.5)] animate-[pulse_2s_ease-in-out_infinite]" aria-hidden />
                )}
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
                    isItemModeActive={isItemModeActive}
                    hiddenMoves={hiddenMoves}
                    moveHistory={moveHistory}
                    permanentlyRevealedStones={permanentlyRevealedStones}
                    newlyRevealed={newlyRevealed}
                    myRevealedStones={myRevealedStones}
                    justCaptured={justCaptured}
                    baseStones={baseStones}
                    baseStones_p1={gameStatus === 'base_placement' ? baseStones_p1 : undefined}
                    baseStones_p2={gameStatus === 'base_placement' ? baseStones_p2 : undefined}
                    analysisResult={session.analysisResult?.[currentUser.id] ?? ((gameStatus === 'ended' || (gameStatus === 'scoring' && session.analysisResult?.['system'])) ? session.analysisResult?.['system'] : null)}
                    showTerritoryOverlay={showTerritoryOverlay}
                    isSinglePlayer={true}
                    onAction={props.onAction}
                    gameId={session.id}
                    pendingMove={pendingMove}
                />
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