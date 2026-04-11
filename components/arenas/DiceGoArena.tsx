import React, { useMemo } from 'react';
import { GameProps, Player, GameMode, Point } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { getGoLogic } from '../../client/logic/goLogic.js';
import { PLAYFUL_GAME_MODES } from '../../constants/gameModes';
import { DicePanel } from '../game/GameControls.js';
import Button from '../Button.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';

type DiceGoPlaceUiProps = {
    mobileConfirm: boolean;
    onToggleMobileConfirm: (checked: boolean) => void;
    onConfirmMove: () => void;
};

interface DiceGoArenaProps extends GameProps {
    isMyTurn: boolean;
    isMobile: boolean;
    showLastMoveMarker: boolean;
    captureScoreFloatMinPoints?: number;
    handleBoardClick: (x: number, y: number) => void;
    pendingMove?: { x: number; y: number; player: Player } | null;
    diceGoPlaceUi?: DiceGoPlaceUiProps;
}

const DiceGoArena: React.FC<DiceGoArenaProps> = (props) => {
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
    const { id: gameId, boardState, settings, lastMove, winningLine, gameStatus, currentPlayer, blackPlayerId, whitePlayerId, player1, player2, animation, lastTurnStones, stonesToPlace } = session;
    
    const myPlayerEnum = blackPlayerId === currentUser.id ? Player.Black : (whitePlayerId === currentUser.id ? Player.White : Player.None);
    
    const players = [player1, player2];
    const blackPlayer = players.find(p => p.id === blackPlayerId) || null;
    const whitePlayer = players.find(p => p.id === whitePlayerId) || null;

    const highlightedPoints = useMemo(() => {
        if (gameStatus !== 'dice_placing' || !isMyTurn || (stonesToPlace ?? 0) <= 0) return [];
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
    }, [session, gameStatus, isMyTurn, stonesToPlace, boardState, settings.boardSize]);

    const backgroundClass = useMemo(() => {
        if (PLAYFUL_GAME_MODES.some(m => m.mode === session.mode)) {
            return isMobile ? 'bg-slate-950/50' : 'bg-transparent';
        }
        return 'bg-primary';
    }, [session.mode, isMobile]);

    const showDicePlaceChrome =
        !!diceGoPlaceUi &&
        !isSpectator &&
        (gameStatus === 'dice_rolling' ||
            gameStatus === 'dice_rolling_animating' ||
            gameStatus === 'dice_placing');
    const canDicePlaceConfirm =
        gameStatus === 'dice_placing' && (stonesToPlace ?? 0) > 0 && !!pendingMove && !!diceGoPlaceUi?.mobileConfirm;

    return (
        <div className={`relative h-full w-full min-h-0 flex flex-col ${backgroundClass}`}>
            {/* Keep board at max size; place desktop dice controls absolutely next to board. */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-1 pt-1 md:px-3 md:pb-2 md:pt-2">
                <div className="relative aspect-square w-full max-w-[min(840px,100%)] max-h-full shrink-0">
                    <GoBoard
                        boardState={boardState}
                        boardSize={settings.boardSize}
                        onBoardClick={handleBoardClick}
                        lastMove={lastMove}
                        lastTurnStones={lastTurnStones}
                        isBoardDisabled={!isMyTurn || gameStatus !== 'dice_placing' || (stonesToPlace ?? 0) <= 0}
                        pendingMove={pendingMove ?? null}
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
                        captures={session.captures}
                        captureScoreFloatMinPoints={captureScoreFloatMinPoints}
                    />
                    {/* Dice controls (desktop): outside board box but not affecting board size */}
                    <div
                        className="pointer-events-auto absolute left-full ml-1 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-1 md:flex"
                        aria-label="Dice controls"
                    >
                        <DicePanel variant="mainOnly" session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} />
                        {showDicePlaceChrome && (
                                <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-700/80 bg-gray-900/70 px-2.5 py-2 shadow-xl min-w-[100px]">
                                    <Button
                                        type="button"
                                        onClick={canDicePlaceConfirm ? diceGoPlaceUi!.onConfirmMove : undefined}
                                        disabled={!canDicePlaceConfirm}
                                        colorScheme="none"
                                        className={`w-full !py-2 rounded-xl border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-slate-900 font-bold text-sm ${!canDicePlaceConfirm ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        title={
                                            !diceGoPlaceUi!.mobileConfirm
                                                ? '착수 버튼 모드가 OFF입니다.'
                                                : gameStatus !== 'dice_placing' || (stonesToPlace ?? 0) <= 0
                                                  ? '주사위를 굴린 뒤 착수 단계에서 사용합니다.'
                                                  : pendingMove
                                                    ? '착수 확정'
                                                    : '바둑판을 클릭해 착점을 선택하세요'
                                        }
                                    >
                                        착수
                                    </Button>
                                    <div className="w-full h-px bg-gray-700/70" />
                                    <div className="flex w-full items-center justify-between gap-1.5">
                                        <span className="text-[10px] text-gray-300 whitespace-nowrap">착수 버튼</span>
                                        <ToggleSwitch
                                            checked={diceGoPlaceUi!.mobileConfirm}
                                            onChange={diceGoPlaceUi!.onToggleMobileConfirm}
                                        />
                                    </div>
                                </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Dice controls (mobile): below board */}
            <div
                className="pointer-events-auto relative z-20 flex w-full max-w-full min-w-0 shrink-0 flex-wrap items-end justify-center gap-2 px-2 pb-1 pt-0 md:hidden"
                aria-label="Dice controls"
            >
                <div className="flex min-w-0 max-w-full shrink justify-center">
                    <DicePanel
                        variant="mainOnly"
                        session={session}
                        isMyTurn={isMyTurn}
                        onAction={onAction}
                        currentUser={currentUser}
                        compactMain={isMobile}
                    />
                </div>
                {showDicePlaceChrome && (
                        <div className="flex min-w-0 max-w-[min(100%,7.5rem)] shrink-0 flex-col items-stretch gap-2 rounded-xl border border-slate-600/55 bg-slate-900/92 px-2 py-2 shadow-xl backdrop-blur-sm">
                            <Button
                                type="button"
                                onClick={canDicePlaceConfirm ? diceGoPlaceUi!.onConfirmMove : undefined}
                                disabled={!canDicePlaceConfirm}
                                colorScheme="none"
                                className={`w-full !py-2 rounded-xl border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-slate-900 font-bold text-sm ${!canDicePlaceConfirm ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title={
                                    !diceGoPlaceUi!.mobileConfirm
                                        ? '착수 버튼 모드가 OFF입니다.'
                                        : gameStatus !== 'dice_placing' || (stonesToPlace ?? 0) <= 0
                                          ? '주사위를 굴린 뒤 착수 단계에서 사용합니다.'
                                          : pendingMove
                                            ? '착수 확정'
                                            : '바둑판을 클릭해 착점을 선택하세요'
                                }
                            >
                                착수
                            </Button>
                            <div className="w-full h-px bg-gray-700/70" />
                            <div className="flex w-full items-center justify-between gap-1.5">
                                <span className="text-[10px] text-gray-300 whitespace-nowrap">착수 버튼</span>
                                <ToggleSwitch
                                    checked={diceGoPlaceUi!.mobileConfirm}
                                    onChange={diceGoPlaceUi!.onToggleMobileConfirm}
                                />
                            </div>
                        </div>
                )}
            </div>
        </div>
    );
};

export default DiceGoArena;
