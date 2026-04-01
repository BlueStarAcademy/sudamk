import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameProps, Player, GameStatus, User, AnimationData, GameMode, Point } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { getGoLogic } from '../../client/logic/goLogic.js';
import { audioService } from '../../services/audioService.js';
import { PLAYFUL_GAME_MODES } from '../../constants/gameModes';
import { DicePanel } from '../game/GameControls.js';

interface DiceGoArenaProps extends GameProps {
    isMyTurn: boolean;
    isMobile: boolean;
    showLastMoveMarker: boolean;
    captureScoreFloatMinPoints?: number;
}

const DiceGoArena: React.FC<DiceGoArenaProps> = (props) => {
    const { session, onAction, currentUser, isSpectator, isMyTurn, isMobile, showLastMoveMarker, captureScoreFloatMinPoints = 2 } = props;
    const { id: gameId, boardState, settings, lastMove, winningLine, gameStatus, currentPlayer, blackPlayerId, whitePlayerId, player1, player2, animation, lastTurnStones } = session;
    
    const myPlayerEnum = blackPlayerId === currentUser.id ? Player.Black : (whitePlayerId === currentUser.id ? Player.White : Player.None);
    
    const players = [player1, player2];
    const blackPlayer = players.find(p => p.id === blackPlayerId) || null;
    const whitePlayer = players.find(p => p.id === whitePlayerId) || null;

    const highlightedPoints = useMemo(() => {
        if (gameStatus !== 'dice_placing' || !isMyTurn) return [];
        const anyWhiteStones = boardState.flat().some(s => s === Player.White);
        if (!anyWhiteStones) {
            // If no white stones, all empty points are valid.
            const points: Point[] = [];
            for (let y = 0; y < settings.boardSize; y++) {
                for (let x = 0; x < settings.boardSize; x++) {
                    if (boardState[y][x] === Player.None) {
                        points.push({ x, y });
                    }
                }
            }
            return points;
        }
        return getGoLogic(session).getAllLibertiesOfPlayer(Player.White, boardState);
    }, [session, gameStatus, isMyTurn, boardState, settings.boardSize]);

    const handleBoardClick = (x: number, y: number) => {
        if (!isMyTurn || gameStatus !== 'dice_placing') return;
        
        const isValidMove = highlightedPoints.some(p => p.x === x && p.y === y);
        if (!isValidMove) {
            return;
        }
        
        onAction({ type: 'DICE_PLACE_STONE', payload: { gameId, x, y } });
    };

    const backgroundClass = useMemo(() => {
        if (PLAYFUL_GAME_MODES.some(m => m.mode === session.mode)) {
            return 'bg-transparent';
        }
        return 'bg-primary';
    }, [session.mode]);

    return (
        <div className={`relative h-full w-full min-h-0 flex flex-col md:block ${backgroundClass}`}>
            {/* Keep the board centered; dice controls are positioned separately. */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-1 pt-1 md:absolute md:inset-0 md:flex md:flex-none md:h-full md:px-3 md:pb-2 md:pt-2">
                <div className="relative aspect-square w-full max-w-[min(840px,100%)] max-h-full shrink-0">
                    <GoBoard
                        boardState={boardState}
                        boardSize={settings.boardSize}
                        onBoardClick={handleBoardClick}
                        lastMove={lastMove}
                        lastTurnStones={lastTurnStones}
                        isBoardDisabled={!isMyTurn || gameStatus !== 'dice_placing'}
                        stoneColor={Player.Black}
                        winningLine={winningLine}
                        mode={session.mode}
                        mixedModes={session.settings.mixedModes}
                        myPlayerEnum={myPlayerEnum}
                        gameStatus={gameStatus}
                        currentPlayer={currentPlayer}
                        highlightedPoints={highlightedPoints}
                        highlightStyle="ring"
                        isSpectator={isSpectator}
                        currentUser={currentUser}
                        blackPlayerNickname={blackPlayer?.nickname || 'Black'}
                        whitePlayerNickname={whitePlayer?.nickname || 'White'}
                        isItemModeActive={false}
                        animation={animation}
                        isMobile={isMobile}
                        showLastMoveMarker={showLastMoveMarker}
                        gameId={gameId}
                        justCaptured={session.justCaptured}
                        captureScoreFloatMinPoints={captureScoreFloatMinPoints}
                    />
                </div>
            </div>
            {/* Dice controls: below on mobile, right side on md+. */}
            <div
                className="pointer-events-auto relative z-20 flex shrink-0 justify-center px-2 pb-2 pt-1 md:absolute md:right-1 md:top-1/2 md:-translate-y-1/2 md:justify-center md:px-0 md:pb-0 md:pt-0 xl:right-2"
                aria-label="Dice controls"
            >
                <DicePanel variant="mainOnly" session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} />
            </div>
        </div>
    );
};

export default DiceGoArena;
