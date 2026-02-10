import React, { useMemo } from 'react';
import { GameProps, Player, Point, GameStatus, Move, GameMode } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/gameModes';

interface GoGameArenaProps extends GameProps {
    isMyTurn: boolean;
    myPlayerEnum: Player;
    handleBoardClick: (x: number, y: number) => void;
    isItemModeActive: boolean;
    showTerritoryOverlay: boolean;
    isMobile: boolean;
    myRevealedMoves: number[];
    showLastMoveMarker: boolean;
}

const GoGameArena: React.FC<GoGameArenaProps> = (props) => {
    const {
        session,
        onAction,
        myPlayerEnum,
        handleBoardClick,
        isItemModeActive,
        showTerritoryOverlay,
        isMyTurn,
        isMobile,
        myRevealedMoves,
        showLastMoveMarker,
        isBoardRotated = false,
        onToggleBoardRotation,
    } = props;
    
    const { blackPlayerId, whitePlayerId, player1, player2, settings, lastMove, gameStatus, mode } = session;

    const players = [player1, player2];
    const blackPlayer = players.find(p => p.id === blackPlayerId) || null;
    const whitePlayer = players.find(p => p.id === whitePlayerId) || null;

    const myRevealedStones = useMemo(() => {
        return (myRevealedMoves || [])
            .map(index => session.moveHistory?.[index])
            .filter((move): move is Move => !!move)
            .map(move => ({ x: move.x, y: move.y }));
    }, [myRevealedMoves, session.moveHistory]);

    const allRevealedStones = useMemo(() => {
        if (!session.moveHistory || !session.revealedHiddenMoves) {
            return {};
        }
        const result: { [playerId: string]: Point[] } = {};
        for (const playerId in session.revealedHiddenMoves) {
            result[playerId] = session.revealedHiddenMoves[playerId]
                .map(index => session.moveHistory?.[index])
                .filter((move): move is Move => !!move)
                .map(move => ({ x: move.x, y: move.y }));
        }
        return result;
    }, [session.revealedHiddenMoves, session.moveHistory]);

    const backgroundClass = useMemo(() => {
        // AI 게임인 경우 배경을 투명하게 (전략바둑, 놀이바둑 대기실에서 생성된 게임)
        const isAiGameFromLobby = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';
        const isStrategicMode = SPECIAL_GAME_MODES.some(m => m.mode === mode);
        const isPlayfulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
        
        // 전략바둑 또는 놀이바둑 모드에서 AI 게임인 경우 투명 배경
        if (isAiGameFromLobby && (isStrategicMode || isPlayfulMode)) {
            return 'bg-transparent';
        }
        
        // 놀이바둑 모드에서는 항상 투명 배경 (바둑판 패널의 뒷배경만 제거)
        if (isPlayfulMode) {
            return 'bg-transparent';
        }
        
        if (isStrategicMode) {
            return 'bg-strategic-background';
        }
        return 'bg-primary';
    }, [mode, session.isAiGame, session.isSinglePlayer, session.gameCategory]);

    return (
        <div className={`w-full h-full flex items-center justify-center ${backgroundClass} relative`}>
            {/* 회전 버튼 */}
            {onToggleBoardRotation && (
                <button
                    onClick={onToggleBoardRotation}
                    className="absolute top-2 right-2 z-10 bg-gray-800/80 hover:bg-gray-700/80 rounded-lg p-2 border border-gray-600 transition-all"
                    title="바둑판 180도 회전"
                >
                    <svg 
                        className="w-6 h-6 text-gray-300"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        style={{ transform: isBoardRotated ? 'rotate(180deg)' : 'none' }}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            )}
            <GoBoard
                boardState={session.boardState}
                boardSize={settings.boardSize}
                onBoardClick={handleBoardClick}
                onMissileLaunch={(from: Point, direction: 'up' | 'down' | 'left' | 'right') => {
                    // 클라이언트의 boardState를 서버로 전송하여 정확한 검증 가능하도록 함
                    onAction({ 
                        type: 'LAUNCH_MISSILE', 
                        payload: { 
                            gameId: session.id, 
                            from, 
                            direction,
                            boardState: session.boardState, // 클라이언트의 현재 boardState 전송
                            moveHistory: session.moveHistory || [] // 클라이언트의 moveHistory 전송
                        } 
                    });
                }}
                onAction={onAction}
                gameId={session.id}
                lastMove={lastMove}
                lastTurnStones={session.lastTurnStones}
                isBoardDisabled={props.isSpectator || (!isMyTurn && gameStatus !== 'base_placement')}
                stoneColor={myPlayerEnum}
                winningLine={session.winningLine}
                mode={session.mode}
                mixedModes={session.settings.mixedModes}
                hiddenMoves={session.hiddenMoves}
                moveHistory={session.moveHistory}
                baseStones={session.baseStones}
                myPlayerEnum={myPlayerEnum}
                gameStatus={gameStatus}
                currentPlayer={session.currentPlayer}
                highlightedPoints={[]}
                myRevealedStones={myRevealedStones}
                allRevealedStones={allRevealedStones}
                newlyRevealed={session.newlyRevealed}
                justCaptured={session.justCaptured}
                permanentlyRevealedStones={session.permanentlyRevealedStones}
                isSpectator={props.isSpectator}
                analysisResult={session.analysisResult?.[props.currentUser.id] ?? ((gameStatus === 'ended' || (gameStatus === 'scoring' && session.analysisResult?.['system'])) ? session.analysisResult?.['system'] : null)}
                showTerritoryOverlay={showTerritoryOverlay}
                showHintOverlay={false}
                showLastMoveMarker={showLastMoveMarker}
                baseStones_p1={gameStatus === 'base_placement' ? session.baseStones_p1 : undefined}
                baseStones_p2={gameStatus === 'base_placement' ? session.baseStones_p2 : undefined}
                currentUser={props.currentUser}
                blackPlayerNickname={blackPlayer?.nickname || '흑'}
                whitePlayerNickname={whitePlayer?.nickname || '백'}
                isItemModeActive={isItemModeActive}
                animation={session.animation}
                isMobile={isMobile}
                isRotated={isBoardRotated}
            />
        </div>
    );
}

export default GoGameArena;
