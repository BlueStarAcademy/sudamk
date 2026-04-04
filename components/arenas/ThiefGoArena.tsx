import React, { useMemo } from 'react';
import { GameProps, Player, Point } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { getGoLogic } from '../../client/logic/goLogic.js';
import { PLAYFUL_GAME_MODES } from '../../constants/gameModes';
import { ThiefPanel } from '../game/GameControls.js';
import Button from '../Button.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';

type ThiefPlaceUiProps = {
    mobileConfirm: boolean;
    onToggleMobileConfirm: (checked: boolean) => void;
    onConfirmMove: () => void;
};

interface ThiefGoArenaProps extends GameProps {
    isMyTurn: boolean;
    isMobile: boolean;
    showLastMoveMarker: boolean;
    captureScoreFloatMinPoints?: number;
    handleBoardClick: (x: number, y: number) => void;
    pendingMove?: { x: number; y: number; player: Player } | null;
    diceGoPlaceUi?: ThiefPlaceUiProps;
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
        diceGoPlaceUi,
    } = props;
    const { id: gameId, boardState, settings, lastMove, winningLine, gameStatus, currentPlayer, blackPlayerId, whitePlayerId, thiefPlayerId, player1, player2, lastTurnStones, justCaptured, animation } = session;

    const myPlayerEnum = blackPlayerId === currentUser.id ? Player.Black : whitePlayerId === currentUser.id ? Player.White : Player.None;

    const players = [player1, player2];
    const blackPlayer = players.find((p) => p.id === blackPlayerId) || null;
    const whitePlayer = players.find((p) => p.id === whitePlayerId) || null;

    const highlightedPoints = useMemo(() => {
        if (gameStatus !== 'thief_placing' || !isMyTurn) return [];

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
            const canPlaceFreely = session.turnInRound === 1 || noBlackStonesOnBoard;
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
    }, [gameStatus, isMyTurn, session, boardState, currentUser.id, thiefPlayerId, settings.boardSize]);

    const backgroundClass = useMemo(() => {
        if (PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode)) {
            return 'bg-transparent';
        }
        return 'bg-primary';
    }, [session.mode]);

    const showThiefPlaceChrome =
        !!diceGoPlaceUi &&
        !isSpectator &&
        (gameStatus === 'thief_rolling' || gameStatus === 'thief_rolling_animating' || gameStatus === 'thief_placing');
    const canThiefPlaceConfirm =
        gameStatus === 'thief_placing' && (session.stonesToPlace ?? 0) > 0 && !!pendingMove && !!diceGoPlaceUi?.mobileConfirm;

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
                    />
                    <div
                        className="pointer-events-auto absolute left-full ml-1 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-1 md:flex"
                        aria-label="Thief dice controls"
                    >
                        <ThiefPanel variant="mainOnly" session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} />
                        {showThiefPlaceChrome && (
                            <div className="flex min-w-[100px] flex-col items-center gap-2 rounded-xl border border-gray-700/80 bg-gray-900/70 px-2.5 py-2 shadow-xl">
                                <Button
                                    type="button"
                                    onClick={canThiefPlaceConfirm ? diceGoPlaceUi!.onConfirmMove : undefined}
                                    disabled={!canThiefPlaceConfirm}
                                    colorScheme="none"
                                    className={`w-full !py-2 rounded-xl border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-slate-900 font-bold text-sm ${!canThiefPlaceConfirm ? 'cursor-not-allowed opacity-40' : ''}`}
                                    title={
                                        !diceGoPlaceUi!.mobileConfirm
                                            ? '착수 버튼 모드가 OFF입니다.'
                                            : gameStatus !== 'thief_placing' || (session.stonesToPlace ?? 0) <= 0
                                              ? '주사위를 굴린 뒤 착수 단계에서 사용합니다.'
                                              : pendingMove
                                                ? '착수 확정'
                                                : '바둑판을 클릭해 착점을 선택하세요'
                                    }
                                >
                                    착수
                                </Button>
                                <div className="h-px w-full bg-gray-700/70" />
                                <div className="flex w-full items-center justify-between gap-1.5">
                                    <span className="whitespace-nowrap text-[10px] text-gray-300">착수 버튼</span>
                                    <ToggleSwitch checked={diceGoPlaceUi!.mobileConfirm} onChange={diceGoPlaceUi!.onToggleMobileConfirm} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div
                className="pointer-events-auto relative z-20 flex shrink-0 flex-wrap items-end justify-center gap-2 px-2 pb-1 pt-0 md:hidden"
                aria-label="Thief dice controls"
            >
                <ThiefPanel variant="mainOnly" session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} />
                {showThiefPlaceChrome && (
                    <div className="flex min-w-[100px] flex-col items-center gap-2 rounded-xl border border-gray-700/80 bg-gray-900/70 px-2.5 py-2 shadow-xl">
                        <Button
                            type="button"
                            onClick={canThiefPlaceConfirm ? diceGoPlaceUi!.onConfirmMove : undefined}
                            disabled={!canThiefPlaceConfirm}
                            colorScheme="none"
                            className={`w-full !py-2 rounded-xl border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-slate-900 font-bold text-sm ${!canThiefPlaceConfirm ? 'cursor-not-allowed opacity-40' : ''}`}
                            title={
                                !diceGoPlaceUi!.mobileConfirm
                                    ? '착수 버튼 모드가 OFF입니다.'
                                    : gameStatus !== 'thief_placing' || (session.stonesToPlace ?? 0) <= 0
                                      ? '주사위를 굴린 뒤 착수 단계에서 사용합니다.'
                                      : pendingMove
                                        ? '착수 확정'
                                        : '바둑판을 클릭해 착점을 선택하세요'
                            }
                        >
                            착수
                        </Button>
                        <div className="h-px w-full bg-gray-700/70" />
                        <div className="flex w-full items-center justify-between gap-1.5">
                            <span className="whitespace-nowrap text-[10px] text-gray-300">착수 버튼</span>
                            <ToggleSwitch checked={diceGoPlaceUi!.mobileConfirm} onChange={diceGoPlaceUi!.onToggleMobileConfirm} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ThiefGoArena;
