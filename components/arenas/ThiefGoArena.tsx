import React, { useMemo } from 'react';
import { GameProps, Player, Point } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { getGoLogic } from '../../client/logic/goLogic.js';
import { PLAYFUL_GAME_MODES } from '../../constants/gameModes';
import { ThiefPanel } from '../game/GameControls.js';

interface ThiefGoArenaProps extends GameProps {
    isMyTurn: boolean;
    isMobile: boolean;
    showLastMoveMarker: boolean;
    captureScoreFloatMinPoints?: number;
    handleBoardClick: (x: number, y: number) => void;
    pendingMove?: { x: number; y: number; player: Player } | null;
}

const ThiefGoArena: React.FC<ThiefGoArenaProps> = (props) => {
    const {
        session,
        onAction,
        currentUser,
        isSpectator,
        isMyTurn,
        isMobile,
        showLastMoveMarker,
        captureScoreFloatMinPoints = 2,
        handleBoardClick,
        pendingMove,
        onBoardRuleFlash,
    } = props;
    const { id: gameId, boardState, settings, lastMove, winningLine, gameStatus, currentPlayer, blackPlayerId, whitePlayerId, thiefPlayerId, player1, player2, lastTurnStones, justCaptured, animation } = session;

    const myPlayerEnum = blackPlayerId === currentUser.id ? Player.Black : whitePlayerId === currentUser.id ? Player.White : Player.None;

    const players = [player1, player2];
    const blackPlayer = players.find((p) => p.id === blackPlayerId) || null;
    const whitePlayer = players.find((p) => p.id === whitePlayerId) || null;

    const highlightedPoints = useMemo(() => {
        // 인간 착수 직후 deferHandoff: currentPlayer는 아직 본인인데 stonesToPlace=0.
        // 이 구간에 활로/전판 링을 그리면 다음 턴(AI) 유효자리가 유저에게 보이는 것처럼 보임.
        if (gameStatus !== 'thief_placing' || !isMyTurn || (session.stonesToPlace ?? 0) <= 0) return [];

        const logic = getGoLogic(session);
        const myRole = currentUser.id === thiefPlayerId ? '도둑' : '경찰';
        const allEmptyPoints = () => {
            const points: Point[] = [];
            for (let y = 0; y < settings.boardSize; y++) {
                for (let x = 0; x < settings.boardSize; x++) {
                    if (boardState[y][x] === Player.None) {
                        points.push({ x, y });
                    }
                }
            }
            return points;
        };

        if (myRole === '도둑') {
            const noBlackStonesOnBoard = !boardState.flat().includes(Player.Black);
            const canPlaceFreely =
                session.turnInRound === 1 || noBlackStonesOnBoard || !!session.thiefFreestyleThiefPlacing;
            if (canPlaceFreely) {
                return allEmptyPoints();
            }
            const blackStonesOnBoard = boardState.flat().includes(Player.Black);
            if (blackStonesOnBoard) {
                const liberties = logic.getAllLibertiesOfPlayer(Player.Black, boardState);
                return liberties.length > 0 ? liberties : allEmptyPoints();
            }
            return allEmptyPoints();
        }
        const blackStonesOnBoard = boardState.flat().includes(Player.Black);
        if (blackStonesOnBoard) {
            const liberties = logic.getAllLibertiesOfPlayer(Player.Black, boardState);
            return liberties.length > 0 ? liberties : allEmptyPoints();
        }
        return allEmptyPoints();
    }, [gameStatus, isMyTurn, session, session.thiefFreestyleThiefPlacing, boardState, currentUser.id, thiefPlayerId, settings.boardSize]);

    const backgroundClass = useMemo(() => {
        if (PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode)) {
            return 'bg-transparent';
        }
        return 'bg-primary';
    }, [session.mode]);

    return (
        <div className={`relative h-full w-full min-h-0 flex flex-col ${backgroundClass}`}>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-1 pt-1 md:px-3 md:pb-2 md:pt-2">
                <div className="relative aspect-square w-full max-w-[min(840px,100%)] max-h-full shrink-0">
                    <GoBoard
                        boardState={boardState}
                        boardSize={settings.boardSize}
                        onBoardClick={handleBoardClick}
                        lastMove={lastMove}
                        lastTurnStones={lastTurnStones}
                        isBoardDisabled={!isMyTurn || gameStatus !== 'thief_placing' || (session.stonesToPlace ?? 0) <= 0}
                        pendingMove={pendingMove ?? null}
                        stoneColor={myPlayerEnum}
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
                        blackPlayerNickname={blackPlayer?.nickname || '흑'}
                        whitePlayerNickname={whitePlayer?.nickname || '백'}
                        isItemModeActive={false}
                        animation={animation}
                        isMobile={isMobile}
                        showLastMoveMarker={showLastMoveMarker}
                        gameId={gameId}
                        justCaptured={justCaptured}
                        captures={session.captures}
                        captureScoreFloatMinPoints={captureScoreFloatMinPoints}
                        onBoardRuleFlash={onBoardRuleFlash}
                    />
                    <div
                        className="pointer-events-auto absolute left-full ml-1 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-1 md:flex"
                        aria-label="Thief dice controls"
                    >
                        <ThiefPanel variant="mainOnly" session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} />
                    </div>
                </div>
            </div>
            <div
                className="pointer-events-auto relative z-20 flex shrink-0 flex-wrap items-end justify-center gap-2 px-2 pb-1 pt-0 md:hidden"
                aria-label="Thief dice controls"
            >
                <ThiefPanel variant="mainOnly" session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} />
            </div>
        </div>
    );
};

export default ThiefGoArena;
