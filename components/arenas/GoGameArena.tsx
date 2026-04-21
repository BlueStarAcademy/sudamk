import React, { useMemo } from 'react';
import { GameProps, Player, Point, GameStatus, Move, GameMode } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { ScoringOverlay } from '../game/ScoringOverlay.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/gameModes';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';

interface GoGameArenaProps extends GameProps {
    isMyTurn: boolean;
    myPlayerEnum: Player;
    handleBoardClick: (x: number, y: number) => void;
    isItemModeActive: boolean;
    showTerritoryOverlay: boolean;
    isMobile: boolean;
    myRevealedMoves: number[];
    showLastMoveMarker: boolean;
    /** 히든 아이템 사용·AI 히든 연출 중 바둑판 패널 테두리 */
    showBoardGlow?: boolean;
    isBoardRotated?: boolean;
    onToggleBoardRotation?: () => void;
    // 온라인 전략바둑 AI 대국용: 서버 응답 전 낙관적 표시용 임시 돌
    pendingMove?: { x: number; y: number; player: Player } | null;
    captureScoreFloatMinPoints?: number;
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
        showBoardGlow = false,
        isBoardRotated = false,
        onToggleBoardRotation,
        pendingMove,
        captureScoreFloatMinPoints = 2,
    } = props;

    const { blackPlayerId, whitePlayerId, player1, player2, settings, lastMove, gameStatus, mode, moveHistory, hiddenMoves } = session;

    const adventureRegionalHeadStartCaptureBonus =
        session.gameCategory === 'adventure'
            ? Math.max(
                  0,
                  Math.floor(
                      Number((session as { adventureRegionalHumanFlatScoreBonus?: unknown }).adventureRegionalHumanFlatScoreBonus ?? 0),
                  ),
              )
            : 0;

    const adventurePregameHideBoard =
        session.gameCategory === 'adventure' &&
        ['nigiri_reveal', 'color_start_confirmation', 'nigiri_choosing', 'nigiri_guessing'].includes(gameStatus);
    const boardStateForDisplay =
        adventurePregameHideBoard && settings?.boardSize
            ? Array.from({ length: settings.boardSize }, () =>
                  Array.from({ length: settings.boardSize }, () => Player.None)
              )
            : session.boardState;

    /** 좌표가 같으면 객체 참조를 유지해 GoBoard 따낸 점수 effect 등이 매 렌더 불필요하게 돌지 않게 함 */
    const displayLastMoveKey = useMemo(() => {
        if (!moveHistory?.length) {
            return lastMove != null ? `${lastMove.x},${lastMove.y}` : '';
        }
        // hiddenMoves가 없거나 직렬화로 빠진 경우에도 수순 꼬리가 진실원천 (lastMove만 보면 AI 수 직후 한 박자 늦거나 이전 수에 고정되는 버그)
        if (!hiddenMoves || typeof hiddenMoves !== 'object') {
            for (let i = moveHistory.length - 1; i >= 0; i--) {
                const m = moveHistory[i];
                if (!m || (m.x === -1 && m.y === -1)) continue;
                return `${m.x},${m.y}`;
            }
            return lastMove != null ? `${lastMove.x},${lastMove.y}` : '';
        }
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const m = moveHistory[i];
            if (!m || (m.x === -1 && m.y === -1)) continue;
            if (!hiddenMoves[i]) return `${m.x},${m.y}`;
        }
        return lastMove != null ? `${lastMove.x},${lastMove.y}` : '';
    }, [lastMove, moveHistory, hiddenMoves]);

    const displayLastMove = useMemo((): Point | null => {
        if (!displayLastMoveKey) return null;
        const [x, y] = displayLastMoveKey.split(',').map(Number);
        return { x, y };
    }, [displayLastMoveKey]);

    const players = [player1, player2];
    const blackPlayer = players.find(p => p.id === blackPlayerId) || null;
    const whitePlayer = players.find(p => p.id === whitePlayerId) || null;

    const myRevealedStones = useMemo(() => {
        const opp = myPlayerEnum === Player.Black ? Player.White : Player.Black;
        const board = session.boardState;
        return (myRevealedMoves || [])
            .map((index) => session.moveHistory?.[index])
            .filter((move): move is Move => !!move)
            .filter((move) => {
                const row = board?.[move.y];
                const cell = row?.[move.x];
                return cell === move.player && move.player === opp;
            })
            .map((move) => ({ x: move.x, y: move.y }));
    }, [myRevealedMoves, session.moveHistory, session.boardState, myPlayerEnum]);

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

    /** 베이스 배치·덤 입찰 단계: 바둑판에 양측 베이스돌 좌표 전달(덤 배팅 중에도 배치 상태 표시) */
    const showPlacedBaseStoneArrays =
        gameStatus === 'base_placement' ||
        gameStatus === 'komi_bidding' ||
        gameStatus === 'komi_bid_reveal' ||
        gameStatus === 'base_color_roulette' ||
        gameStatus === 'base_komi_result' ||
        gameStatus === 'base_game_start_confirmation';

    const backgroundClass = useMemo(() => {
        if (session.gameCategory === 'guildwar') {
            // 길드전은 Game.tsx에서 별도 전용 배경을 그리므로 경기장 패널은 투명 처리
            return 'bg-transparent';
        }
        if (session.gameCategory === 'adventure') {
            // 모험은 AdventureArena에서 맵 배경을 이미 깔아주므로 바둑판 패널 배경은 비움
            return 'bg-transparent';
        }
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

    // 남은 턴이 0이면 계가 진행되므로, 그 순간부터 클릭 불가 (빠르게 눌러서 추가 착수되는 버그 방지)
    const isBoardDisabledDueToTurnLimit = useMemo(() => {
        if (gameStatus !== 'playing' && gameStatus !== 'hidden_placing') return false;
        const moveHistory = session.moveHistory ?? [];
        // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
        const turnCount = moveHistory.length;
        const validMovesCount = moveHistory.filter(m => m && m.x !== -1 && m.y !== -1).length;

        // 싱글플레이/도전의 탑: 자동계가 턴 수 제한
        const isTower = session.gameCategory === 'tower';
        if ((session.isSinglePlayer || isTower) && session.stageId) {
            const stage = isTower
                ? TOWER_STAGES.find(s => s.id === session.stageId)
                : SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);
            if (stage?.autoScoringTurns) {
                const totalTurns = validMovesCount;
                const remainingTurns = Math.max(0, stage.autoScoringTurns - totalTurns);
                if (remainingTurns <= 0) return true;
            }
        }

        // 전략바둑 로비: 수순 제한(scoringTurnLimit) 도달 시 (따내기는 목표 점수만으로 승패)
        const isStrategicMode = SPECIAL_GAME_MODES.some(m => m.mode === mode);
        const limit = settings.scoringTurnLimit;
        if (
            isStrategicMode &&
            mode !== GameMode.Capture &&
            !session.isSinglePlayer &&
            session.gameCategory !== 'tower' &&
            limit != null &&
            limit > 0
        ) {
            const current = turnCount > 0 ? turnCount : (session.totalTurns ?? 0);
            if (current >= limit) return true;
        }

        return false;
    }, [gameStatus, session.isSinglePlayer, session.gameCategory, session.stageId, session.moveHistory, session.totalTurns, settings.scoringTurnLimit, mode]);

    const isAdventureBoardLayout = session.gameCategory === 'adventure';

    return (
        <div
            className={`w-full h-full flex items-center justify-center ${backgroundClass} relative ${
                isAdventureBoardLayout ? 'min-h-0 min-w-0 overflow-hidden' : ''
            }`}
        >
            {/* 계가 중: 바둑판 위 오버레이. 결과 수신 시 즉시 숨김(연출 즉시 종료) */}
            {gameStatus === 'scoring' && !session.analysisResult?.['system'] && <ScoringOverlay variant="fullscreen" />}
            {/* 회전 버튼: 흑/백 입장 전환 (이모지로 표현) */}
            {onToggleBoardRotation && (
                <button
                    onClick={onToggleBoardRotation}
                    className={`absolute top-2 right-2 z-10 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-600 transition-all ${
                        isMobile ? 'rounded-md p-1.5' : 'rounded-lg p-2'
                    }`}
                    title={props.isSpectator
                        ? (isBoardRotated ? '흑의 입장으로 보기' : '백의 입장으로 보기')
                        : '바둑판 180도 회전'}
                >
                    <span
                        className={`${isMobile ? 'text-base' : 'text-xl'} leading-none`}
                        style={{ transform: isBoardRotated ? 'rotate(180deg)' : 'none', display: 'inline-block' }}
                    >
                        🔄
                    </span>
                </button>
            )}
            {/* 바둑판은 항상 정사각형으로, 주어진 공간 안에 맞춰 축소/확대 */}
            <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center min-w-0 min-h-0">
                <div
                    className={`w-full h-full max-w-full max-h-full aspect-square min-w-0 min-h-0 ${
                        isAdventureBoardLayout ? 'shrink-0' : ''
                    }`}
                >
                <GoBoard
                boardState={boardStateForDisplay}
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
                lastMove={displayLastMove}
                lastTurnStones={session.lastTurnStones}
                isBoardDisabled={props.isSpectator || (!isMyTurn && gameStatus !== 'base_placement') || isBoardDisabledDueToTurnLimit}
                stoneColor={myPlayerEnum}
                winningLine={session.winningLine}
                mode={session.mode}
                mixedModes={session.settings.mixedModes}
                hiddenMoves={session.hiddenMoves}
                moveHistory={session.moveHistory}
                baseStones={session.baseStones}
                blackPatternStones={session.blackPatternStones}
                whitePatternStones={session.whitePatternStones}
                consumedPatternIntersections={(session as any).consumedPatternIntersections}
                aiInitialHiddenStone={(session as { aiInitialHiddenStone?: Point }).aiInitialHiddenStone}
                myPlayerEnum={myPlayerEnum}
                gameStatus={gameStatus}
                currentPlayer={session.currentPlayer}
                highlightedPoints={[]}
                myRevealedStones={myRevealedStones}
                myRevealedMoveIndices={myRevealedMoves}
                allRevealedStones={allRevealedStones}
                newlyRevealed={session.newlyRevealed}
                justCaptured={session.justCaptured}
                captures={session.captures}
                permanentlyRevealedStones={session.permanentlyRevealedStones}
                isSpectator={props.isSpectator}
                analysisResult={session.analysisResult?.[props.currentUser.id] ?? ((gameStatus === 'ended' || (gameStatus === 'scoring' && session.analysisResult?.['system'])) ? session.analysisResult?.['system'] : null)}
                showTerritoryOverlay={showTerritoryOverlay}
                showHintOverlay={false}
                showLastMoveMarker={showLastMoveMarker}
                baseStones_p1={showPlacedBaseStoneArrays ? session.baseStones_p1 : undefined}
                baseStones_p2={showPlacedBaseStoneArrays ? session.baseStones_p2 : undefined}
                currentUser={props.currentUser}
                blackPlayerNickname={blackPlayer?.nickname || '흑'}
                whitePlayerNickname={whitePlayer?.nickname || '백'}
                    isItemModeActive={isItemModeActive || showBoardGlow}
                animation={session.animation}
                isMobile={isMobile}
                isRotated={isBoardRotated}
                pendingMove={pendingMove}
                captureScoreFloatMinPoints={captureScoreFloatMinPoints}
                adventureRegionalHeadStartCaptureBonus={adventureRegionalHeadStartCaptureBonus}
                onBoardRuleFlash={props.onBoardRuleFlash}
                />
                </div>
                {showBoardGlow && (
                    <div
                        className="pointer-events-none absolute inset-0 z-[8] rounded-lg ring-[6px] ring-amber-300/95 shadow-[0_0_38px_rgba(251,191,36,0.8),0_0_74px_rgba(244,114,182,0.52),inset_0_0_24px_rgba(251,191,36,0.18)] animate-[pulse_1.05s_cubic-bezier(0.4,0,0.2,1)_infinite]"
                        aria-hidden
                    />
                )}
            </div>
        </div>
    );
}

export default GoGameArena;
