import React, { useEffect, useMemo, useState } from 'react';
import { GameProps, Player, Point, GameStatus, Move, GameMode } from '../../types.js';
import GoBoard from '../GoBoard.js';
import { ScoringOverlay, SCORING_PROGRESS_DURATION_MS } from '../game/ScoringOverlay.js';
import { BOARD_SETTLE_BEFORE_SCORING_MS } from '../../shared/constants/boardSettleTiming.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/gameModes';
import { resolveSinglePlayerAutoScoringCapForClientSession } from '../../shared/utils/liveSessionSinglePlayerStage.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { getEffectivePairLobbyOwnerId } from '../../shared/utils/effectivePairLobbyOwnerId.js';
import { canViewerPlaceMoreBaseStones } from '../../shared/utils/basePlacementCanPlaceMore.js';
import { resolveBasePlacementSeatColors } from '../../shared/utils/basePlacementSeatColors.js';
import { modeIncludesBaseCaptureMix } from '../../shared/utils/liveSessionArenaKind.js';

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
    strategicPetHintBoardOverlay?: { x: number; y: number; message: string; showBubble: boolean } | null;
    strategicPetHintRewardAnimation?: { id: string; x: number; y: number; iconSrc: string; quantityLabel: string } | null;
    boardRuleFlashMessage?: string | null;
}

function modeIncludesCaptureRule(mode: GameMode, settings: { mixedModes?: GameMode[] }): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
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
        singlePlayerStagesListRevision = 0,
        strategicPetHintBoardOverlay = null,
        strategicPetHintRewardAnimation = null,
        boardRuleFlashMessage = null,
    } = props;

    const { blackPlayerId, whitePlayerId, player1, player2, settings, lastMove, gameStatus, mode, moveHistory, hiddenMoves } = session;
    const strategicPetHintDotOverlay = useMemo(() => {
        if (!strategicPetHintBoardOverlay) return null;
        const { x, y } = strategicPetHintBoardOverlay;
        if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0) return null;
        return { x, y };
    }, [strategicPetHintBoardOverlay]);

    const scoringOverlayStorageKey = `scoringOverlayPlayed_${session.id}`;
    const [hasPlayedScoringOverlay, setHasPlayedScoringOverlay] = useState<boolean>(() => {
        try {
            return sessionStorage.getItem(scoringOverlayStorageKey) === '1';
        } catch {
            return false;
        }
    });
    const [showScoringOverlay, setShowScoringOverlay] = useState(false);

    useEffect(() => {
        try {
            setHasPlayedScoringOverlay(sessionStorage.getItem(scoringOverlayStorageKey) === '1');
        } catch {
            setHasPlayedScoringOverlay(false);
        }
    }, [scoringOverlayStorageKey]);

    useEffect(() => {
        if (gameStatus === 'scoring' && !hasPlayedScoringOverlay) {
            setHasPlayedScoringOverlay(true);
            try {
                sessionStorage.setItem(scoringOverlayStorageKey, '1');
            } catch {
                // ignore storage failure
            }
            let hideTimer: ReturnType<typeof setTimeout> | undefined;
            const showTimer = window.setTimeout(() => {
                setShowScoringOverlay(true);
                hideTimer = window.setTimeout(() => {
                    setShowScoringOverlay(false);
                }, SCORING_PROGRESS_DURATION_MS);
            }, BOARD_SETTLE_BEFORE_SCORING_MS);
            return () => {
                window.clearTimeout(showTimer);
                if (hideTimer) window.clearTimeout(hideTimer);
            };
        }
        if (gameStatus !== 'scoring') {
            setShowScoringOverlay(false);
        }
    }, [gameStatus, hasPlayedScoringOverlay, scoringOverlayStorageKey]);

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
        gameStatus === 'base_stone_color_choice' ||
        gameStatus === 'base_same_color_points_bid' ||
        gameStatus === 'base_game_start_confirmation' ||
        (gameStatus === 'capture_bidding' && modeIncludesBaseCaptureMix(mode, session.settings));
    /**
     * 사전 단계에서는 임시 좌석(`basePlacementBlackPlayerId`)을, 시작 확인 이후에는 본대국 좌석을 사용한다.
     * 배치 단계에 본대국 좌석(`session.blackPlayerId`)은 비어 있어야 정상이라 직접 읽지 않는다.
     */
    const { baseStonesP1Player, baseStonesP2Player } = resolveBasePlacementSeatColors(session);

    const isPairBasePlacementHost = useMemo(() => {
        if (gameStatus !== 'base_placement') return false;
        const owner = getEffectivePairLobbyOwnerId(session);
        return Boolean(owner && props.currentUser.id === owner);
    }, [gameStatus, session, props.currentUser.id]);

    const canPlaceMoreBaseStones = useMemo(
        () => canViewerPlaceMoreBaseStones(session, props.currentUser.id),
        [session, props.currentUser.id]
    );

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
        const isPairGame = Boolean(session.settings?.pairGame);
        const moveHistory = session.moveHistory ?? [];
        // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
        const turnCount = moveHistory.length;
        const validMovesCount = moveHistory.filter(m => m && m.x !== -1 && m.y !== -1).length;

        // 싱글플레이/도전의 탑: 자동계가 턴 수 제한
        const isTower = session.gameCategory === 'tower';
        if ((session.isSinglePlayer || isTower) && session.stageId) {
            const cap = isTower
                ? TOWER_STAGES.find(s => s.id === session.stageId)?.autoScoringTurns
                : resolveSinglePlayerAutoScoringCapForClientSession(session as any);
            if (cap) {
                const totalTurns = Math.max(validMovesCount, session.totalTurns ?? 0);
                const remainingTurns = Math.max(0, cap - totalTurns);
                if (remainingTurns <= 0) return true;
            }
        }

        // 전략바둑 로비: 수순 제한(scoringTurnLimit) 도달 시 (따내기는 목표 점수만으로 승패)
        const isStrategicMode = SPECIAL_GAME_MODES.some(m => m.mode === mode);
        const limit = settings.scoringTurnLimit;
        if (
            isStrategicMode &&
            !modeIncludesCaptureRule(mode, settings) &&
            !session.isSinglePlayer &&
            session.gameCategory !== 'tower' &&
            limit != null &&
            limit > 0
        ) {
            const current = isPairGame
                ? Math.max(validMovesCount, session.totalTurns ?? 0)
                : (turnCount > 0 ? turnCount : (session.totalTurns ?? 0));
            if (current >= limit) return true;
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
        session.settings?.pairGame,
        settings.scoringTurnLimit,
        mode,
    ]);

    const isAdventureBoardLayout = session.gameCategory === 'adventure';

    return (
        <div
            className={`w-full h-full flex items-center justify-center ${backgroundClass} relative ${
                isAdventureBoardLayout ? 'min-h-0 min-w-0 overflow-hidden' : ''
            }`}
        >
            {/* 계가 중: 바둑판 위 오버레이. 착점·따낸 점수 등 안정화 후 표시 → 끝나면 영토/결과 표시에 맞춤 */}
            {gameStatus === 'scoring' && showScoringOverlay && (
                <ScoringOverlay variant="fullscreen" />
            )}
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
            <div className="relative flex h-full max-h-full w-full max-w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
                <div
                    className={`aspect-square h-full max-h-full w-full max-w-full min-h-0 min-w-0 overflow-hidden ${
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
                humanHiddenStonePoints={(session as { humanHiddenStonePoints?: Array<Point & { player?: Player }> }).humanHiddenStonePoints}
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
                analysisResult={session.analysisResult?.[props.currentUser.id] ?? ((gameStatus === 'ended' || (gameStatus === 'scoring' && !showScoringOverlay && session.analysisResult?.['system'])) ? session.analysisResult?.['system'] : null)}
                showTerritoryOverlay={showTerritoryOverlay}
                showHintOverlay={false}
                showLastMoveMarker={showLastMoveMarker}
                baseStones_p1={showPlacedBaseStoneArrays ? session.baseStones_p1 : undefined}
                baseStones_p2={showPlacedBaseStoneArrays ? session.baseStones_p2 : undefined}
                baseStonesP1Player={baseStonesP1Player}
                baseStonesP2Player={baseStonesP2Player}
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
                strategicPetHintOverlay={strategicPetHintDotOverlay}
                strategicPetHintRewardAnimation={strategicPetHintRewardAnimation}
                boardRuleFlashMessage={boardRuleFlashMessage}
                isPairBasePlacementHost={isPairBasePlacementHost}
                canPlaceMoreBaseStones={canPlaceMoreBaseStones}
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
