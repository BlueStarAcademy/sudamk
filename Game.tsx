import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// FIX: Import types from the new centralized types barrel file
import {
    Player,
    GameMode,
    GameStatus,
    Point,
    GameProps,
    LiveGameSession,
    ServerAction,
    FeatureSettings,
} from './types/index.js';
import GameArena from './components/GameArena.js';
import Header from './components/Header.js';
import Sidebar from './components/game/Sidebar.js';
import PlayerPanel from './components/game/PlayerPanel.js';
import GameModals from './components/game/GameModals.js';
import TurnDisplay from './components/game/TurnDisplay.js';
import { audioService } from './services/audioService.js';
import { TerritoryAnalysisWindow, HintWindow } from './components/game/AnalysisWindows.js';
import GameControls from './components/game/GameControls.js';
import { PLAYFUL_GAME_MODES, SPECIAL_GAME_MODES, aiUserId } from './constants.js';
import { useAppContext } from './hooks/useAppContext.js';
import DisconnectionModal from './components/DisconnectionModal.js';
// FIX: Import TimeoutFoulModal component to resolve 'Cannot find name' error.
import TimeoutFoulModal from './components/TimeoutFoulModal.js';
import AiChallengeModal from './components/waiting-room/AiChallengeModal.js';
import SinglePlayerControls from './components/game/SinglePlayerControls.js';
import SinglePlayerInfoPanel from './components/game/SinglePlayerInfoPanel.js';
import SinglePlayerGameDescriptionModal from './components/SinglePlayerGameDescriptionModal.js';
import SinglePlayerSidebar from './components/game/SinglePlayerSidebar.js';
import TowerControls from './components/game/TowerControls.js';
import TowerSidebar from './components/game/TowerSidebar.js';
import GuildWarMissileTowerControls from './components/game/GuildWarMissileTowerControls.js';
import GuildWarHiddenTowerControls from './components/game/GuildWarHiddenTowerControls.js';
import GuildWarTowerSidebar from './components/game/GuildWarTowerSidebar.js';
import { ScoringOverlay } from './components/game/ScoringOverlay.js';
import { useClientTimer } from './hooks/useClientTimer.js';
import { useIsHandheldDevice } from './hooks/useIsMobileLayout.js';
import { calculateSimpleAiMove } from './client/goAiBotClient.js';
import { processMoveClient } from './client/goLogicClient.js';
import Button from './components/Button.js';
import ToggleSwitch from './components/ui/ToggleSwitch.js';
import { DraggableMoveConfirmPanel } from './components/game/DraggableMoveConfirmPanel.js';
import { buildPveItemActionClientSync } from './utils/pveItemClientSync.js';
import { useAdContext } from './components/ads/AdProvider.js';
import { InGameModalLayoutProvider } from './contexts/InGameModalLayoutContext.js';
// AI 유저 ID (싱글플레이에서 AI 차례 판단용)
const AI_USER_ID = aiUserId;

const KO_RULE_FLASH_MESSAGE = '패 모양(단순 코)입니다. 바로 다시 따낼 수 없습니다.';

interface MoveConfirmDraggableProps {
    layoutMode: 'mobile' | 'desktop';
    pendingMove: Point | null;
    handleConfirmMove: () => void;
    mobileConfirm: boolean;
    updateFeatureSetting: <K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => void;
    setPendingMove: (p: Point | null) => void;
}

const MoveConfirmDraggable: React.FC<MoveConfirmDraggableProps> = ({
    layoutMode,
    pendingMove,
    handleConfirmMove,
    mobileConfirm,
    updateFeatureSetting,
    setPendingMove,
}) => (
    <DraggableMoveConfirmPanel layoutMode={layoutMode}>
        <Button
            onClick={pendingMove ? handleConfirmMove : undefined}
            disabled={!pendingMove || !mobileConfirm}
            colorScheme="none"
            className={`w-full !py-2 rounded-xl border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-slate-900 font-bold ${!pendingMove || !mobileConfirm ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={!mobileConfirm ? '착수 버튼 모드가 OFF입니다.' : pendingMove ? '착수 확정' : '바둑판을 클릭해 착점을 선택하세요'}
        >
            착수
        </Button>
        <div className="w-full h-px bg-gray-700/70" />
        <div className="flex w-full items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[10px] text-gray-300">착수 버튼</span>
            <ToggleSwitch
                checked={mobileConfirm}
                onChange={(checked) => {
                    updateFeatureSetting('mobileConfirm', checked);
                    if (!checked) setPendingMove(null);
                }}
            />
        </div>
    </DraggableMoveConfirmPanel>
);

const isSamePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const isUnrevealedUserHiddenStoneAt = (game: LiveGameSession, x: number, y: number): boolean => {
    if (!game.moveHistory || !game.hiddenMoves) return false;

    for (let i = game.moveHistory.length - 1; i >= 0; i--) {
        const move = game.moveHistory[i];
        if (move.x !== x || move.y !== y) continue;
        if (move.player !== Player.Black) return false;
        if (!game.hiddenMoves[i]) return false;
        return !(game.permanentlyRevealedStones || []).some(point => isSamePoint(point, { x, y }));
    }

    return false;
};

const getMaskedBoardForHiddenAi = (game: LiveGameSession, boardState: Player[][]): Player[][] => {
    const maskedBoard = boardState.map(row => [...row]);
    if (!game.moveHistory || !game.hiddenMoves) {
        return maskedBoard;
    }

    for (let i = 0; i < game.moveHistory.length; i++) {
        const move = game.moveHistory[i];
        if (move.player !== Player.Black || !game.hiddenMoves[i]) continue;
        if ((game.permanentlyRevealedStones || []).some(point => isSamePoint(point, { x: move.x, y: move.y }))) continue;
        if (maskedBoard[move.y]?.[move.x] === Player.Black) {
            maskedBoard[move.y][move.x] = Player.None;
        }
    }

    return maskedBoard;
};

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

interface GameComponentProps {
    session: LiveGameSession;
}

const Game: React.FC<GameComponentProps> = ({ session }) => {
    const {
        currentUser,
        currentUserWithStatus,
        handlers,
        onlineUsers,
        waitingRoomChats,
        gameChats,
        negotiations,
        activeNegotiation,
        settings,
        updateFeatureSetting,
        isNativeMobile,
    } = useAppContext();
    const { showInterstitial } = useAdContext();

    const { id: gameId, currentPlayer, gameStatus, player1, player2, mode, blackPlayerId, whitePlayerId } = session;

    if (!player1?.id || !player2?.id || !currentUser || !currentUserWithStatus) {
        return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;
    }

    const [confirmModalType, setConfirmModalType] = useState<'resign' | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [showFinalTerritory, setShowFinalTerritory] = useState(false);
    const [justScanned, setJustScanned] = useState(false);
    const [pendingMove, setPendingMove] = useState<Point | null>(null);
    useEffect(() => {
        if (!settings.features.moveConfirmButtonBox) setPendingMove(null);
    }, [settings.features.moveConfirmButtonBox]);
    const [isAnalysisActive, setIsAnalysisActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [resumeCountdown, setResumeCountdown] = useState(0);
    const pauseStartedAtRef = useRef<number | null>(null);
    const pauseCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [pauseButtonCooldown, setPauseButtonCooldown] = useState(0);
    // 연속 클릭 방지: 수 처리 중에는 추가 클릭 무시
    const [isMoveInFlight, setIsMoveInFlight] = useState(false);
    const [boardRuleFlashMessage, setBoardRuleFlashMessage] = useState<string | null>(null);
    const boardRuleFlashClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clientTimes = useClientTimer(session, (session.isSinglePlayer || (session.gameCategory === 'tower')) ? { isPaused } : {});
    const [isAiRematchModalOpen, setIsAiRematchModalOpen] = useState(false);
    // 싱글플레이 고급 히든: AI 히든 아이템 연출 종료 시각 (이 시각까지 바둑판 패널 테두리만 빛남)
    const [aiHiddenItemEffectEndTime, setAiHiddenItemEffectEndTime] = useState<number | null>(null);
    const aiHiddenMoveExecutedRef = useRef(false);
    // 연출 중 시간 경과로 빛/일시정지 갱신용 (0.5초마다)
    const [effectTick, setEffectTick] = useState(0);

    // 보드 잠금 메커니즘: AI가 돌을 둔 직후 최신 serverRevision을 받을 때까지 보드 잠금
    const [lastReceivedServerRevision, setLastReceivedServerRevision] = useState<number>(session.serverRevision ?? 0);
    const [isBoardLocked, setIsBoardLocked] = useState(false);
    
    // isSpectator를 먼저 선언 (isBoardRotated 초기화에서 사용)
    const isSpectator = useMemo(() => currentUserWithStatus?.status === 'spectating', [currentUserWithStatus]);
    
    // 바둑판 회전: 백 진영만 기본 회전(AI 대국도 흑/백 좌석으로만 결정). 새로고침 시 currentPlayer에 따른 분기는 180° 뒤집힘을 유발하므로 제외.
    const [isBoardRotated, setIsBoardRotated] = useState(() => {
        try {
            if (typeof sessionStorage !== 'undefined') {
                const storedState = sessionStorage.getItem(`gameState_${gameId}`);
                if (storedState) {
                    const parsed = JSON.parse(storedState);
                    if (parsed.gameId === gameId && typeof parsed.isBoardRotated === 'boolean') {
                        return parsed.isBoardRotated;
                    }
                }
            }
        } catch {
            /* ignore */
        }
        if (isSpectator) return false;
        return whitePlayerId === currentUser.id;
    });
    
    const prevGameStatus = usePrevious(gameStatus);
    const prevCurrentPlayer = usePrevious(currentPlayer);
    const prevCaptures = usePrevious(session.captures);
    const prevAnimationType = usePrevious(session.animation?.type);
    const warningSoundPlayedForTurn = useRef(false);
    /** 주사위/도둑: lastMove·moveHistory 보강 이펙트가 같은 착점에서 placeStone을 두 번 재생하지 않도록 */
    const lastDiceThiefPlaceSoundKeyRef = useRef<string>('');
    /** 전략바둑·오목류: lastMove만으로는 낙관적/모바일 확정 경로에서 갱신이 빠져 소리가 안 날 수 있어 moveHistory 꼬리로 통일 */
    const strategicPlaceSoundKeyRef = useRef<string>('');
    const prevMoveCount = usePrevious(session.moveHistory?.length);
    const myBaseStoneCountForUnlock = useMemo(() => {
        if (gameStatus !== 'base_placement') return undefined;
        const stones = currentUser.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
        return stones?.length ?? 0;
    }, [gameStatus, currentUser.id, player1.id, session.baseStones_p1, session.baseStones_p2]);
    const prevMyBaseStoneCountForUnlock = usePrevious(myBaseStoneCountForUnlock);
    const prevAnalysisResult = usePrevious(session.analysisResult?.['system']);
    const isSinglePlayer = session.isSinglePlayer;
    const isTower = session.gameCategory === 'tower';
    const isGuildWarGame = session.gameCategory === 'guildwar';
    const isGuildWarTowerStyleUi =
        isGuildWarGame && (mode === GameMode.Missile || mode === GameMode.Hidden);
    const isPlayfulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
    const showMoveConfirmPanel = !isPlayfulMode && settings.features.moveConfirmButtonBox;
    const aiHiddenTurnsFromSession = (session as any).aiHiddenItemTurns;
    const plannedAiHiddenTurns = Array.isArray(aiHiddenTurnsFromSession)
        ? aiHiddenTurnsFromSession
            .map((turn: unknown) => Number(turn))
            .filter((turn: number) => Number.isInteger(turn) && turn > 0)
            .sort((a: number, b: number) => a - b)
        : (() => {
            const legacyTurn = Number((session as any).aiHiddenItemTurn ?? 0);
            return Number.isInteger(legacyTurn) && legacyTurn > 0 ? [legacyTurn] : [];
        })();
    const aiHiddenItemsUsedCount = Math.max(
        0,
        Number(
            (session as any).aiHiddenItemsUsedCount ??
            ((session as any).aiHiddenItemUsed ? (plannedAiHiddenTurns.length || 1) : 0)
        )
    );
    const nextAiHiddenItemTurn = plannedAiHiddenTurns[aiHiddenItemsUsedCount];
    const isTowerHiddenStage = isTower && (session.towerFloor ?? 0) >= 21 && plannedAiHiddenTurns.length > 0;
    const isGuildWarHiddenPresentation =
        isGuildWarGame && mode === GameMode.Hidden && ((session.settings?.hiddenStoneCount ?? 0) > 0);
    const isAiHiddenPresentationStage =
        (isSinglePlayer && ((session.settings?.hiddenStoneCount ?? 0) > 0)) ||
        isTowerHiddenStage ||
        isGuildWarHiddenPresentation;
    /** 온라인 대기실 히든/믹스(히든): 스캔 연출 후 서버 WS가 늦을 때 로컬에서 playing 복귀 */
    const isOnlineHiddenStrategic =
        !isSinglePlayer &&
        !isTower &&
        !isGuildWarGame &&
        (mode === GameMode.Hidden ||
            (mode === GameMode.Mix && !!session.settings?.mixedModes?.includes?.(GameMode.Hidden)) ||
            ((session.settings as { hiddenStoneCount?: number })?.hiddenStoneCount ?? 0) > 0);
    // 전략바둑 AI/PVP 수순 제한: 새로고침 후 totalTurns·moveHistory 복원/저장에 포함
    const hasStrategicTurnLimit =
        mode !== GameMode.Capture &&
        ((session.settings?.scoringTurnLimit ?? 0) > 0 || ((session.settings as any)?.autoScoringTurns ?? 0) > 0);
    
    // 클라이언트에서 게임 상태 저장/복원 (새로고침 시 바둑판 복원)
    const GAME_STATE_STORAGE_KEY = `gameState_${gameId}`;
    
    // 게임 상태를 sessionStorage에서 복원 (종료 후에도 결과 모달 동안 종료된 화면 유지를 위해 ended/scoring에서도 복원 허용)
    const restoredBoardState = useMemo(() => {
        try {
            const storedState = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
            if (storedState) {
                const parsed = JSON.parse(storedState);
                    if (parsed.gameId === gameId && parsed.boardState && Array.isArray(parsed.boardState) && parsed.boardState.length > 0) {
                    // 서버 moveHistory가 더 길면 서버가 최신(AI 수 등) → 서버 boardState 또는 moveHistory 복원 (AI가 둔 수가 사라지는 버그 방지)
                    const serverMoveCount = session.moveHistory?.length ?? 0;
                    const storedMoveCount = parsed.moveHistory?.length ?? 0;
                    if (serverMoveCount > storedMoveCount) {
                        if (session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
                            console.log(`[Game] Using server boardState (server moves: ${serverMoveCount}, stored: ${storedMoveCount}) for game ${gameId}`);
                            return session.boardState;
                        }
                        // IMPORTANT: moveHistory 기반 단순 복원은 포획을 반영하지 못해 "없던 돌이 생김" 버그를 만든다.
                        // 서버 boardState가 비어 있으면, 일단 저장된 boardState(포획 반영)를 유지한다.
                        console.warn(`[Game] Server has more moves but no boardState; keeping stored boardState to avoid capture desync (server moves: ${serverMoveCount}, stored: ${storedMoveCount}) for game ${gameId}`);
                        return parsed.boardState;
                    }
                    // 아직 한 수도 두지 않았을 때(배치변경 직후 등)는 서버 boardState 우선 → 새로 랜덤 배치가 바로 반영되도록
                    if (serverMoveCount === 0 && storedMoveCount === 0 && session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
                        return session.boardState;
                    }
                    // 주사위/도둑: 한 턴에 여러 돌 — 클라는 moveHistory를 늘리지 않고 boardState·stonesPlacedThisTurn만 낙관 갱신한다.
                    // moveHistory 길이가 같으면 아래에서 sessionStorage 보드를 쓰게 되는데, 저장 useEffect가 한 틱 늦어
                    // 옛 판이 덮여 "주사위 수만큼 클릭해야 돌이 한꺼번에 보이는" 현상이 난다.
                    const isMultiStonePlacingTurn =
                        gameStatus === 'dice_placing' || gameStatus === 'thief_placing';
                    if (
                        isMultiStonePlacingTurn &&
                        session.boardState &&
                        Array.isArray(session.boardState) &&
                        session.boardState.length > 0
                    ) {
                        const optimisticN = (session as LiveGameSession).stonesPlacedThisTurn?.length ?? 0;
                        if (optimisticN > 0) {
                            return session.boardState;
                        }
                        const countColor = (board: Player[][], color: Player) =>
                            board.reduce((n, row) => n + row.filter((c) => c === color).length, 0);
                        const sB = countColor(session.boardState, Player.Black);
                        const pB = countColor(parsed.boardState, Player.Black);
                        const sW = countColor(session.boardState, Player.White);
                        const pW = countColor(parsed.boardState, Player.White);
                        if (sB > pB || sW < pW) {
                            return session.boardState;
                        }
                    }
                    // 진행 중이거나 종료/계가 중일 때 모두 sessionStorage 보드 사용 → 결과 모달 시에도 바둑판 유지
                    console.log(`[Game] Restored boardState from sessionStorage for game ${gameId} (gameStatus: ${gameStatus})`);
                    return parsed.boardState;
                }
            }
        } catch (e) {
            console.error(`[Game] Failed to restore game state from sessionStorage:`, e);
        }
        
        // sessionStorage에 없으면 서버에서 받은 boardState 사용
        if (session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
            return session.boardState;
        }
        
        // 싱글플레이어 게임과 도전의 탑 게임의 경우 blackPatternStones와 whitePatternStones로부터 복원
        if ((isSinglePlayer || isTower) && (session.blackPatternStones || session.whitePatternStones)) {
            const boardSize = session.settings.boardSize;
            const restored = Array(boardSize).fill(null).map(() => Array(boardSize).fill(Player.None));
            
            // blackPatternStones 복원
            if (session.blackPatternStones && Array.isArray(session.blackPatternStones)) {
                for (const stone of session.blackPatternStones) {
                    if (stone.x >= 0 && stone.x < boardSize && stone.y >= 0 && stone.y < boardSize) {
                        restored[stone.y][stone.x] = Player.Black;
                    }
                }
            }
            
            // whitePatternStones 복원
            if (session.whitePatternStones && Array.isArray(session.whitePatternStones)) {
                for (const stone of session.whitePatternStones) {
                    if (stone.x >= 0 && stone.x < boardSize && stone.y >= 0 && stone.y < boardSize) {
                        restored[stone.y][stone.x] = Player.White;
                    }
                }
            }
            
            // moveHistory를 통해 이후의 수를 복원
            if (session.moveHistory && Array.isArray(session.moveHistory)) {
                for (const move of session.moveHistory) {
                    if (move.x >= 0 && move.x < boardSize && move.y >= 0 && move.y < boardSize) {
                        restored[move.y][move.x] = move.player;
                    }
                }
            }
            
            return restored;
        }
        
        return session.boardState;
    }, [
        isSinglePlayer,
        isTower,
        session.boardState,
        session.blackPatternStones,
        session.whitePatternStones,
        session.moveHistory?.length,
        session.settings.boardSize,
        gameId,
        gameStatus,
        session.stonesPlacedThisTurn?.length,
        session.stonesToPlace,
    ]);
    
    // 게임 상태를 sessionStorage에 저장 (매 수마다). 종료 후에는 삭제/덮어쓰지 않아 결과 모달에서 바둑판 유지
    useEffect(() => {
        if (['ended', 'no_contest', 'scoring'].includes(gameStatus)) return;
        if (restoredBoardState && Array.isArray(restoredBoardState) && restoredBoardState.length > 0) {
            try {
                // totalTurns: 서버가 비워 보낸 경우(새로고침 직후) 기존 sessionStorage 값 유지 (자동계가까지 남은 턴이 Max로 초기화되는 버그 방지)
                let totalTurnsToSave = session.totalTurns;
                if ((totalTurnsToSave == null || totalTurnsToSave === 0) && (isSinglePlayer || session.gameCategory === 'tower' || hasStrategicTurnLimit)) {
                    try {
                        const stored = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            if (parsed.gameId === gameId && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0) {
                                totalTurnsToSave = parsed.totalTurns;
                            }
                        }
                    } catch { /* ignore */ }
                    if (totalTurnsToSave == null || totalTurnsToSave === 0) {
                        const validCount = (session.moveHistory || []).filter((m: { x: number; y: number }) => m.x !== -1 && m.y !== -1).length;
                        if (validCount > 0) totalTurnsToSave = validCount;
                    }
                }
                const gameStateToSave = {
                    gameId,
                    isBoardRotated,
                    boardState: restoredBoardState,
                    moveHistory: session.moveHistory || [],
                    captures: session.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                    gameStatus: session.gameStatus,
                    currentPlayer: session.currentPlayer,
                    itemUseDeadline: session.itemUseDeadline,
                    pausedTurnTimeLeft: session.pausedTurnTimeLeft,
                    turnDeadline: session.turnDeadline,
                    turnStartTime: session.turnStartTime,
                    revealAnimationEndTime: session.revealAnimationEndTime,
                    animation: session.animation,
                    pendingCapture: session.pendingCapture,
                    newlyRevealed: session.newlyRevealed || [],
                    revealedHiddenMoves: session.revealedHiddenMoves || {},
                    baseStoneCaptures: session.baseStoneCaptures,
                    hiddenStoneCaptures: session.hiddenStoneCaptures,
                    permanentlyRevealedStones: session.permanentlyRevealedStones || [],
                    blackPatternStones: session.blackPatternStones,
                    whitePatternStones: session.whitePatternStones,
                    consumedPatternIntersections: (session as any).consumedPatternIntersections,
                    hiddenMoves: session.hiddenMoves || {},
                    hidden_stones_p1: (session as any).hidden_stones_p1,
                    hidden_stones_p2: (session as any).hidden_stones_p2,
                    aiInitialHiddenStone: (session as any).aiInitialHiddenStone,
                    aiInitialHiddenStoneIsPrePlaced: (session as any).aiInitialHiddenStoneIsPrePlaced,
                    totalTurns: totalTurnsToSave,
                    ...(session.gameCategory === 'tower' && (session as any).blackTurnLimitBonus != null
                        ? { blackTurnLimitBonus: Number((session as any).blackTurnLimitBonus) || 0 }
                        : {}),
                    timestamp: Date.now()
                };
                sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameStateToSave));
            } catch (e) {
                console.error(`[Game] Failed to save game state to sessionStorage:`, e);
            }
        }
    }, [restoredBoardState, session.moveHistory, session.captures, session.gameStatus, session.currentPlayer, session.itemUseDeadline, session.pausedTurnTimeLeft, session.turnDeadline, session.turnStartTime, session.revealAnimationEndTime, session.animation, session.pendingCapture, session.newlyRevealed, session.revealedHiddenMoves, session.baseStoneCaptures, session.hiddenStoneCaptures, session.permanentlyRevealedStones, session.blackPatternStones, session.whitePatternStones, (session as any).consumedPatternIntersections, session.hiddenMoves, session.totalTurns, gameId, gameStatus, isSinglePlayer, session.gameCategory, hasStrategicTurnLimit, (session as any).hidden_stones_p1, (session as any).hidden_stones_p2, (session as any).aiInitialHiddenStone, (session as any).aiInitialHiddenStoneIsPrePlaced, (session as any).blackTurnLimitBonus, isBoardRotated]);
    
    // 도전의 탑/싱글/전략바둑 수순 제한: 새로고침 후 서버 페이로드에 문양돌·totalTurns·moveHistory가 없을 수 있으므로 sessionStorage에서 복원해 표시
    const sessionWithRestoredPatternStones = useMemo(() => {
        if (!isSinglePlayer && !isTower && !hasStrategicTurnLimit) return session;
        let next = session;
        try {
            const stored = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.gameId === gameId) {
                    const storedMoveCount = Array.isArray(parsed.moveHistory) ? parsed.moveHistory.length : 0;
                    const serverMoveCount = Array.isArray(next.moveHistory) ? next.moveHistory.length : 0;
                    const canPreferStoredVisualState = storedMoveCount >= serverMoveCount;
                    // 스토리지는 useEffect 저장보다 한 틱 늦게 갱신될 수 있음. scanning_animating·missile_animating을 여기 넣으면
                    // 서버가 이미 playing인데 저장분이 애니메이션 상태라 본경기를 덮어 "스캔 연속 사용 후 재개 불가"가 된다.
                    const storedItemModeRecoveryStatuses: GameStatus[] = [
                        'hidden_placing',
                        'scanning',
                        'hidden_reveal_animating',
                        'hidden_final_reveal',
                        'missile_selecting',
                    ];
                    // sessionStorage는 useEffect보다 한 틱 늦게 갱신될 수 있음. 서버/세션이 이미 playing·스캔 연출 종료 등으로
                    // 앞서 나간 경우 저장된 scanning 등으로 덮으면 스캔 후 본경기로 복귀하지 못한다.
                    const serverDismissesStoredItemModeRecovery = [
                        'playing',
                        'scanning_animating',
                        'missile_animating',
                        'hidden_reveal_animating',
                        'hidden_final_reveal',
                        'scoring',
                        'ended',
                        'no_contest',
                    ].includes(next.gameStatus);
                    if (
                        !serverDismissesStoredItemModeRecovery &&
                        storedItemModeRecoveryStatuses.includes(parsed.gameStatus) &&
                        !storedItemModeRecoveryStatuses.includes(next.gameStatus)
                    ) {
                        next = {
                            ...next,
                            gameStatus: parsed.gameStatus,
                            currentPlayer: parsed.currentPlayer ?? next.currentPlayer,
                            itemUseDeadline: parsed.itemUseDeadline ?? next.itemUseDeadline,
                            pausedTurnTimeLeft: parsed.pausedTurnTimeLeft ?? next.pausedTurnTimeLeft,
                            turnDeadline: parsed.turnDeadline ?? next.turnDeadline,
                            turnStartTime: parsed.turnStartTime ?? next.turnStartTime,
                            revealAnimationEndTime: parsed.revealAnimationEndTime ?? next.revealAnimationEndTime,
                            animation: parsed.animation ?? next.animation,
                            pendingCapture: parsed.pendingCapture ?? next.pendingCapture,
                            newlyRevealed: Array.isArray(parsed.newlyRevealed) ? parsed.newlyRevealed : next.newlyRevealed,
                        };
                    }
                    const hasPattern = (session.blackPatternStones?.length ?? 0) > 0 || (session.whitePatternStones?.length ?? 0) > 0;
                    const serverHasPatternField =
                        Array.isArray(next.blackPatternStones) || Array.isArray(next.whitePatternStones);
                    if ((!hasPattern || canPreferStoredVisualState) && !serverHasPatternField) {
                        const storedBlack = Array.isArray(parsed.blackPatternStones) ? parsed.blackPatternStones : null;
                        const storedWhite = Array.isArray(parsed.whitePatternStones) ? parsed.whitePatternStones : null;
                        if (storedBlack || storedWhite) {
                            next = { ...next, blackPatternStones: storedBlack ?? next.blackPatternStones, whitePatternStones: storedWhite ?? next.whitePatternStones };
                        }
                    }
                    if (
                        !Array.isArray((next as any).consumedPatternIntersections) &&
                        Array.isArray(parsed.consumedPatternIntersections)
                    ) {
                        next = { ...next, consumedPatternIntersections: parsed.consumedPatternIntersections } as any;
                    }
                    // 턴 제한 경기: totalTurns가 없거나 0이면 sessionStorage 값으로 복원 (남은 턴이 Max로 초기화되는 현상 방지)
                    const serverTotalTurns = next.totalTurns;
                    if ((serverTotalTurns === undefined || serverTotalTurns === null || serverTotalTurns === 0) && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0) {
                        next = { ...next, totalTurns: parsed.totalTurns };
                    }
                    // INITIAL_STATE 등에서 moveHistory가 생략된 경우 복원 (남은 턴 계산에 사용)
                    const restoredServerMoveCount = next.moveHistory?.filter((m: { x: number; y: number }) => m.x !== -1 && m.y !== -1).length ?? 0;
                    if (restoredServerMoveCount === 0 && Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0) {
                        next = { ...next, moveHistory: parsed.moveHistory };
                    }
                    // 히든 영구 공개 목록: 서버에 없거나 비어있으면 sessionStorage에서 복원 (따냄/따임·상대 착수 시도 후 새로고침 시 반영)
                    const serverRevealed = next.permanentlyRevealedStones?.length ?? 0;
                    if ((serverRevealed === 0 || canPreferStoredVisualState) && Array.isArray(parsed.permanentlyRevealedStones) && parsed.permanentlyRevealedStones.length > 0) {
                        next = { ...next, permanentlyRevealedStones: parsed.permanentlyRevealedStones };
                    }
                    // 히든 착수 정보: 서버에 없거나 비어있으면 sessionStorage에서 복원 (히든 돌이 일반 돌로 보이는 현상 방지)
                    const hasServerHiddenMoves = next.hiddenMoves && Object.keys(next.hiddenMoves).length > 0;
                    if ((!hasServerHiddenMoves || canPreferStoredVisualState) && parsed.hiddenMoves && Object.keys(parsed.hiddenMoves).length > 0) {
                        next = { ...next, hiddenMoves: parsed.hiddenMoves };
                    }
                    if ((canPreferStoredVisualState || !next.revealedHiddenMoves) && parsed.revealedHiddenMoves && typeof parsed.revealedHiddenMoves === 'object') {
                        next = { ...next, revealedHiddenMoves: parsed.revealedHiddenMoves };
                    }
                    if (canPreferStoredVisualState) {
                        next = {
                            ...next,
                            captures: parsed.captures ?? next.captures,
                            baseStoneCaptures: parsed.baseStoneCaptures ?? next.baseStoneCaptures,
                            hiddenStoneCaptures: parsed.hiddenStoneCaptures ?? next.hiddenStoneCaptures,
                            ...(parsed.aiInitialHiddenStone !== undefined ? { aiInitialHiddenStone: parsed.aiInitialHiddenStone } as any : {}),
                            ...(parsed.aiInitialHiddenStoneIsPrePlaced !== undefined ? { aiInitialHiddenStoneIsPrePlaced: parsed.aiInitialHiddenStoneIsPrePlaced } as any : {}),
                        };
                    }
                    // 히든 아이템 개수: 서버에 없으면 sessionStorage 값 사용
                    if ((next as any).hidden_stones_p1 == null && typeof parsed.hidden_stones_p1 === 'number') {
                        next = { ...next, hidden_stones_p1: parsed.hidden_stones_p1 } as any;
                    }
                    if ((next as any).hidden_stones_p2 == null && typeof parsed.hidden_stones_p2 === 'number') {
                        next = { ...next, hidden_stones_p2: parsed.hidden_stones_p2 } as any;
                    }
                    // 도전의 탑: 턴 추가 보너스 — 세션·저장분 중 큰 값 (저장에 키가 없어도 세션만으로 반영)
                    if (isTower) {
                        const pb = Number(parsed.blackTurnLimitBonus);
                        const nb = Number((next as any).blackTurnLimitBonus);
                        if (Number.isFinite(pb) || Number.isFinite(nb)) {
                            next = {
                                ...next,
                                blackTurnLimitBonus: Math.max(
                                    Number.isFinite(pb) ? pb : 0,
                                    Number.isFinite(nb) ? nb : 0
                                ),
                            } as any;
                        }
                    }
                }
            }
            // totalTurns가 0이거나 없는데 moveHistory에 유효 수가 있으면 moveHistory 기준으로 설정 (sessionStorage 유무와 관계없이, 한 수 둔 뒤 턴이 Max로 돌아가는 버그 방지)
            const validCount = next.moveHistory?.filter((m: { x: number; y: number }) => m.x !== -1 && m.y !== -1).length ?? 0;
            if (validCount > 0 && (next.totalTurns === undefined || next.totalTurns === null || next.totalTurns === 0)) {
                next = { ...next, totalTurns: validCount };
            }
            return next;
        } catch {
            return session;
        }
    }, [session, isSinglePlayer, isTower, hasStrategicTurnLimit, gameId, (session as any).blackTurnLimitBonus]);
    
    // --- UI State ---
    // 스케일 셸(PC동일): 항상 PC 레이아웃. 네이티브 모바일: 드로어/슬라이드 분기 사용.
    const isHandheld = useIsHandheldDevice(1025);
    const isMobile = isNativeMobile;
    const isMobileSafeArea = isHandheld;
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    // 우측 사이드바 접기/펼치기 (전략·놀이바둑 경기장)
    const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
    const gameChat = useMemo(() => gameChats[session.id] || [], [gameChats, session.id]);
    const prevChatLength = usePrevious(gameChat.length);

    useEffect(() => {
        if (!isMobileSidebarOpen && prevChatLength !== undefined && gameChat.length > prevChatLength) {
            setHasNewMessage(true);
        }
    }, [gameChat.length, prevChatLength, isMobileSidebarOpen]);

    const openMobileSidebar = () => {
        setIsMobileSidebarOpen(true);
        setHasNewMessage(false);
    };

    useEffect(() => {
        const gameHasJustEnded =
            (gameStatus === 'ended' || gameStatus === 'no_contest') &&
            prevGameStatus !== 'ended' &&
            prevGameStatus !== 'no_contest' &&
            prevGameStatus !== 'rematch_pending';

        // 분석 결과가 도착했을 때만 모달 표시 (바둑판 초기화 방지)
        // scoring 상태일 때는 모달을 열지 않고, 바둑판 위 22초 연출(ScoringOverlay)만 표시. 연출 후 계가 결과가 나올 때 결과 모달 표시
        // 기권/접속 끊김 등 즉시 종료되는 경우에는 analysisResult 없이도 모달 표시
        const currentAnalysisResult = session.analysisResult?.['system'];
        const analysisResultJustArrived = currentAnalysisResult && !prevAnalysisResult;
        const isImmediateEnd = gameHasJustEnded && (session.winReason === 'resign' || session.winReason === 'disconnect' || session.winReason === 'timeout');
        const shouldShowModal = gameHasJustEnded || 
            ((isSinglePlayer || isTower)
                ? (isImmediateEnd || (gameStatus === 'ended' && currentAnalysisResult && prevGameStatus !== 'ended') ||
                   (gameStatus === 'scoring' && currentAnalysisResult && analysisResultJustArrived))
                : ((gameStatus === 'ended' && currentAnalysisResult && prevGameStatus !== 'ended') ||
                   (gameStatus === 'scoring' && currentAnalysisResult && analysisResultJustArrived)));

        if (shouldShowModal) {
            setShowResultModal(true);
            if (gameStatus === 'ended') {
                setShowFinalTerritory(true);
            }
            // 게임 종료 후 전면 광고 트리거 (빈도 제한은 useAds에서 처리)
            if (isTower) {
                showInterstitial('tower_clear');
            } else {
                showInterstitial('game_end');
            }
        }
        
        // 계가가 완료되었을 때(analysisResult가 있을 때) 영토 표시 활성화
        if (gameStatus === 'ended' || gameStatus === 'scoring') {
            if (currentAnalysisResult) {
                setShowFinalTerritory(true);
            }
        }
    }, [gameStatus, prevGameStatus, session.analysisResult, prevAnalysisResult, isSinglePlayer, isTower]);
    
    const myPlayerEnum = useMemo(() => {
        if (isSpectator) {
            // 놀이바둑 관전 시 흑 유저 입장 화면으로 통일 (알까기/컬링 등 좌표 겹침 방지)
            if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) return Player.Black;
            return Player.None;
        }
        if (blackPlayerId === currentUser.id) return Player.Black;
        if (whitePlayerId === currentUser.id) return Player.White;
        if ((mode === GameMode.Base || (mode === GameMode.Mix && session.settings.mixedModes?.includes(GameMode.Base))) && gameStatus === 'base_placement') {
             return currentUser.id === player1.id ? Player.Black : Player.White;
        }
        return Player.None;
    }, [currentUser.id, blackPlayerId, whitePlayerId, isSpectator, mode, gameStatus, player1.id, player2.id, session.settings.mixedModes]);

    const pendingMoveForBoard = useMemo(() => {
        if (!settings.features.moveConfirmButtonBox || !settings.features.mobileConfirm || !pendingMove) return null;
        if (myPlayerEnum === Player.None) return null;
        return { x: pendingMove.x, y: pendingMove.y, player: myPlayerEnum };
    }, [settings.features.moveConfirmButtonBox, settings.features.mobileConfirm, pendingMove, myPlayerEnum]);
    
    const isMyTurn = useMemo(() => {
        if (isSpectator) return false;
        if (gameStatus === 'alkkagi_simultaneous_placement' && session.settings.alkkagiPlacementType === '일괄 배치') {
            const myStonesOnBoard = (session.alkkagiStones || []).filter(s => s.player === myPlayerEnum).length;
            const myStonesInPlacement = (currentUser.id === player1.id ? session.alkkagiStones_p1 : session.alkkagiStones_p2)?.length || 0;
            return (myStonesOnBoard + myStonesInPlacement) < (session.settings.alkkagiStoneCount || 5);
        }
        switch (gameStatus) {
            case 'dice_turn_rolling': return session.turnOrderRolls?.[currentUser.id] === null;
            case 'dice_turn_choice': return session.turnChooserId === currentUser.id;
            case 'scanning': {
                if (myPlayerEnum === Player.None) return false;
                if (myPlayerEnum === currentPlayer) return true;
                // 서버(towerPlayerHidden / singlePlayerHidden): 내 착수 직후 턴은 AI로 넘어갔지만 START_SCANNING 허용 — 스캔 좌표 클릭도 동일하게 허용
                if ((session.isSinglePlayer || isTower) && session.moveHistory?.length) {
                    const last = session.moveHistory[session.moveHistory.length - 1];
                    if (last && last.player === myPlayerEnum) return true;
                }
                return false;
            }
            case 'playing': case 'hidden_placing': case 'missile_selecting': 
            case 'alkkagi_placement': case 'alkkagi_playing': case 'curling_playing':
            case 'dice_rolling':
            case 'dice_rolling_animating':
            case 'dice_placing':
            case 'thief_rolling':
            case 'thief_rolling_animating':
            case 'thief_placing':
                return myPlayerEnum !== Player.None && myPlayerEnum === currentPlayer;
            case 'base_placement': {
                 const myStones = currentUser.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
                 return (myStones?.length || 0) < (session.settings.baseStones || 4);
            }
            default: return false;
        }
    }, [myPlayerEnum, currentPlayer, gameStatus, isSpectator, session, currentUser.id, player1.id, session.settings, isTower]);
    
    // --- Sound Effects ---
    const prevIsMyTurn = usePrevious(isMyTurn);
    useEffect(() => {
        if (isMyTurn && !prevIsMyTurn) {
            const isPlayfulTurnSoundMode = [ GameMode.Dice, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling, ].includes(session.mode);
            // 알까기 교차 배치: 턴이 넘어올 때 턴 소리 대신 돌 두는 소리
            if (session.mode === GameMode.Alkkagi && (gameStatus === 'alkkagi_placement' || gameStatus === 'alkkagi_simultaneous_placement')) {
                audioService.placeStone();
            } else if (isPlayfulTurnSoundMode) {
                audioService.myTurn();
            }
        }
    }, [isMyTurn, prevIsMyTurn, session.mode, gameStatus]);

    const moveHistoryTail = useMemo(() => {
        const h = session.moveHistory;
        if (!h?.length) return undefined;
        const t = h[h.length - 1];
        if (t.x < 0 || t.y < 0) return undefined;
        return t;
    }, [session.moveHistory]);
    const prevMoveHistoryTail = usePrevious(moveHistoryTail);

    // 전략바둑·오목·따목: 착점 소리는 moveHistory 꼬리 변화 기준 (낙관적 갱신·모바일 확정·서버 응답 모두 커버)
    useEffect(() => {
        if (session.mode === GameMode.Dice || session.mode === GameMode.Thief) return;
        const isStrategicLike =
            SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ||
            session.mode === GameMode.Omok ||
            session.mode === GameMode.Ttamok;
        if (!isStrategicLike) return;
        if (!['playing', 'hidden_placing'].includes(gameStatus)) return;
        if (!moveHistoryTail) return;
        if (prevMoveHistoryTail === undefined) {
            const len = session.moveHistory?.length ?? 0;
            if (len !== 1) return;
        } else if (JSON.stringify(moveHistoryTail) === JSON.stringify(prevMoveHistoryTail)) {
            return;
        }
        const key = `${session.moveHistory?.length ?? 0}:${moveHistoryTail.x},${moveHistoryTail.y}`;
        if (strategicPlaceSoundKeyRef.current === key) return;
        strategicPlaceSoundKeyRef.current = key;
        void audioService.initialize();
        audioService.placeStone();
    }, [session.mode, gameStatus, moveHistoryTail, prevMoveHistoryTail, session.moveHistory?.length]);

    // 주사위/도둑: 한 턴에 여러 돌 — 클라 낙관은 moveHistory를 늘리지 않고, 도둑 모드는 서버도 moveHistory에 착수를 쌓지 않아
    // moveHistory 꼬리만으로는 마지막 착점(또는 턴 종료 시점)에만 소리가 난다. stonesPlacedThisTurn·lastMove로 매 돌마다 1회 재생.
    const diceThiefPlacedSignature = useMemo(() => {
        if (session.mode !== GameMode.Dice && session.mode !== GameMode.Thief) return '';
        const pts = session.stonesPlacedThisTurn;
        if (!pts?.length) return '';
        return `${pts.length}:${pts.map((p) => `${p.x},${p.y}`).join('|')}`;
    }, [session.mode, session.stonesPlacedThisTurn]);
    useEffect(() => {
        if (session.mode !== GameMode.Dice && session.mode !== GameMode.Thief) return;
        if (session.gameStatus !== 'dice_placing' && session.gameStatus !== 'thief_placing') return;
        const lm = session.lastMove;
        if (!lm || lm.x < 0 || lm.y < 0) return;
        const n = session.stonesPlacedThisTurn?.length ?? 0;
        if (n <= 0) return;
        const key = `${diceThiefPlacedSignature}:${lm.x},${lm.y}`;
        if (lastDiceThiefPlaceSoundKeyRef.current === key) return;
        lastDiceThiefPlaceSoundKeyRef.current = key;
        void audioService.initialize();
        audioService.placeStone();
    }, [session.mode, session.gameStatus, session.lastMove, diceThiefPlacedSignature]);
    
    useEffect(() => { if (prevCaptures) { /* Capture sounds removed */ } }, [session.captures, prevCaptures, session.justCaptured, session.blackPlayerId, currentUser.id]);

    useEffect(() => {
        if (gameStatus === 'scanning' && prevGameStatus !== 'scanning') audioService.playScanBgm();
        else if (gameStatus !== 'scanning' && prevGameStatus === 'scanning') audioService.stopScanBgm();
        return () => { if (gameStatus === 'scanning') audioService.stopScanBgm(); };
    }, [gameStatus, prevGameStatus]);

    useEffect(() => {
        const anim = session.animation;
        const skipSound = ['scoring', 'ended', 'no_contest'].includes(session.gameStatus ?? '');
        if (anim && anim.type !== prevAnimationType) { 
            switch(anim.type) {
                case 'missile': case 'hidden_missile': if (!skipSound) audioService.launchMissile(); break;
                case 'hidden_reveal': if (!justScanned) audioService.revealHiddenStone(); break;
                case 'scan':
                    setJustScanned(true); setTimeout(() => setJustScanned(false), 1000);
                    if (anim.success) audioService.scanSuccess(); else audioService.scanFail();
                    break;
                case 'dice_roll_main': {
                    // 상대(AI) 굴림: 본인 클릭 시 GameControls에서 이미 재생함
                    const isDiceOrThief = session.mode === GameMode.Dice || session.mode === GameMode.Thief;
                    if (!skipSound && isDiceOrThief && !isMyTurn) {
                        const diceCount =
                            session.mode === GameMode.Thief
                                ? session.currentPlayer === Player.Black
                                    ? 1
                                    : 2
                                : 1;
                        audioService.rollDice(diceCount);
                    }
                    break;
                }
            }
        }
    }, [session.animation, session.gameStatus, session.mode, prevAnimationType, justScanned, isMyTurn]);

    useEffect(() => {
        const activeStartStatuses: GameStatus[] = [ 'playing', 'alkkagi_placement', 'alkkagi_simultaneous_placement', 'curling_playing', 'dice_rolling', 'thief_rolling' ];
        if (activeStartStatuses.includes(gameStatus) && (prevGameStatus === undefined || !activeStartStatuses.includes(prevGameStatus))) audioService.gameStart();
    }, [gameStatus, prevGameStatus]);

    useEffect(() => { return () => audioService.stopScanBgm(); }, []);

    // AI 히든 연출 중 0.5초마다 갱신 (테두리 빛 표시)
    useEffect(() => {
        if (aiHiddenItemEffectEndTime == null) return;
        const id = setInterval(() => setEffectTick((t) => t + 1), 500);
        return () => clearInterval(id);
    }, [aiHiddenItemEffectEndTime]);

    const isGuildWarHiddenClientEffects =
        session.gameCategory === 'guildwar' && mode === GameMode.Hidden;

    const useScanAnimationFallback =
        isSinglePlayer || isTower || isGuildWarHiddenClientEffects || isOnlineHiddenStrategic;

    useEffect(() => {
        if (!(isSinglePlayer || isTower || isGuildWarHiddenClientEffects)) return;
        const hasRevealToFinalize =
            !!session.revealAnimationEndTime &&
            (session.gameStatus === 'hidden_reveal_animating' || !!session.pendingCapture);
        if (!hasRevealToFinalize) return;

        const remaining = Math.max(0, session.revealAnimationEndTime - Date.now());
        const id = window.setTimeout(() => {
            handlers.handleAction({
                type: 'LOCAL_HIDDEN_REVEAL_COMPLETE',
                payload: {
                    gameId: session.id,
                    gameType: isTower ? 'tower' : isGuildWarHiddenClientEffects ? 'guildwar' : 'singleplayer'
                }
            } as any);
        }, remaining + 50);

        return () => window.clearTimeout(id);
    }, [session.gameStatus, session.revealAnimationEndTime, session.pendingCapture, session.id, isSinglePlayer, isTower, isGuildWarHiddenClientEffects, handlers.handleAction]);

    // 스캔 결과 애니메이션 종료 시 본경기(playing) 복귀 — 서버 updateGameStates/WS가 늦어도 착수 가능 (PVE + 온라인 히든)
    useEffect(() => {
        if (!useScanAnimationFallback) return;
        if (session.gameStatus !== 'scanning_animating') return;
        const anim = session.animation as { type?: string; startTime?: number; duration?: number } | null | undefined;
        const scanAnimGameType: 'tower' | 'singleplayer' | 'guildwar' | 'normal' = isTower
            ? 'tower'
            : isGuildWarHiddenClientEffects
              ? 'guildwar'
              : isSinglePlayer
                ? 'singleplayer'
                : 'normal';
        const finish = () => {
            handlers.handleAction({
                type: 'LOCAL_PVE_SCAN_ANIMATION_COMPLETE',
                payload: {
                    gameId: session.id,
                    gameType: scanAnimGameType,
                },
            } as any);
        };
        if (!anim || anim.type !== 'scan') {
            const id = window.setTimeout(finish, 50);
            return () => window.clearTimeout(id);
        }
        const end = (anim.startTime ?? 0) + (anim.duration ?? 2000);
        const remaining = Math.max(0, end - Date.now());
        const id = window.setTimeout(finish, remaining + 50);
        return () => window.clearTimeout(id);
    }, [useScanAnimationFallback, session.id, session.gameStatus, session.animation, handlers.handleAction, isTower, isGuildWarHiddenClientEffects, isSinglePlayer]);

    // 계가 턴 히든 공개(hidden_final_reveal) 애니메이션 종료 시 로컬에서 즉시 scoring으로 전환 → 계가 연출(ScoringOverlay) 표시
    useEffect(() => {
        if (!(isSinglePlayer || isTower || isGuildWarHiddenClientEffects)) return;
        if (session.gameStatus !== 'hidden_final_reveal' || !session.revealAnimationEndTime) return;
        const remaining = Math.max(0, session.revealAnimationEndTime - Date.now());
        const id = window.setTimeout(() => {
            handlers.handleAction({
                type: 'LOCAL_HIDDEN_FINAL_REVEAL_COMPLETE',
                payload: {
                    gameId: session.id,
                    gameType: isTower ? 'tower' : isGuildWarHiddenClientEffects ? 'guildwar' : 'singleplayer',
                }
            } as any);
        }, remaining + 50);
        return () => window.clearTimeout(id);
    }, [session.gameStatus, session.revealAnimationEndTime, session.id, isSinglePlayer, isTower, isGuildWarHiddenClientEffects, handlers.handleAction]);

    useEffect(() => {
        if (prevGameStatus === 'hidden_reveal_animating' && gameStatus === 'playing' && currentPlayer === Player.White) {
            lastAiMoveRef.current = null;
        }
    }, [prevGameStatus, gameStatus, currentPlayer]);

    // 게임이 바뀌면 히든 연출 실행 여부 ref 초기화 (새 게임에서 1회 히든 턴이 동작하도록)
    useEffect(() => {
        aiHiddenMoveExecutedRef.current = false;
    }, [session.id]);

    // 싱글플레이/도전의 탑 히든: 6초 연출 종료 시점이 지나면 AI 히든 착수 실행 (한 번만)
    useEffect(() => {
        if (aiHiddenItemEffectEndTime == null) return;
        if (Date.now() < aiHiddenItemEffectEndTime) return;
        if (aiHiddenMoveExecutedRef.current) {
            setAiHiddenItemEffectEndTime(null);
            return;
        }
        aiHiddenMoveExecutedRef.current = true;
        setAiHiddenItemEffectEndTime(null);
        const boardStateToUse = restoredBoardState || session.boardState;
        const moveHistoryLength = session.moveHistory?.length ?? 0;
        if (!boardStateToUse?.length || !session.id || session.gameStatus !== 'playing') return;

        const aiPlayerEnum = session.currentPlayer;
        if (aiPlayerEnum !== Player.Black && aiPlayerEnum !== Player.White) return;
        const opponentPlayerEnum = aiPlayerEnum === Player.Black ? Player.White : Player.Black;
        const maskedBoardState = getMaskedBoardForHiddenAi(session, boardStateToUse);
        const koInfoAtCalculation = session.koInfo ? JSON.parse(JSON.stringify(session.koInfo)) : null;
        const aiMove = calculateSimpleAiMove(
            JSON.parse(JSON.stringify(maskedBoardState)),
            aiPlayerEnum,
            opponentPlayerEnum,
            koInfoAtCalculation,
            moveHistoryLength,
            session.settings?.aiDifficulty ?? 1
        );
        if (!aiMove) return;
        if (isUnrevealedUserHiddenStoneAt(session, aiMove.x, aiMove.y)) {
            lastAiMoveRef.current = { gameId: session.id, moveHistoryLength, player: aiPlayerEnum, timestamp: Date.now() };
            handlers.handleAction({
                type: 'LOCAL_HIDDEN_REVEAL_TRIGGER',
                payload: {
                    gameId: session.id,
                    gameType: isTower ? 'tower' : isGuildWarGame ? 'guildwar' : 'singleplayer',
                    point: { x: aiMove.x, y: aiMove.y },
                    // Reveal target belongs to the opponent of the AI placing this hidden stone.
                    player: opponentPlayerEnum,
                    keepTurn: true
                }
            } as any);
            return;
        }
        const aiMoveResult = processMoveClient(
            boardStateToUse,
            { x: aiMove.x, y: aiMove.y, player: aiPlayerEnum },
            session.koInfo,
            moveHistoryLength
        );
        if (!aiMoveResult.isValid) return;
        lastAiMoveRef.current = { gameId: session.id, moveHistoryLength, player: aiPlayerEnum, timestamp: Date.now() };
        // 길드전은 liveGames만 사용하므로 싱글/탑 클라이언트 무브가 적용되지 않음 → 서버 PLACE_STONE(clientSideAi + 히든)으로 동기화
        if (isGuildWarGame) {
            handlers.handleAction({
                type: 'PLACE_STONE',
                payload: {
                    gameId: session.id,
                    x: aiMove.x,
                    y: aiMove.y,
                    isClientAiMove: true,
                    isHidden: true,
                },
            } as ServerAction);
            return;
        }
        handlers.handleAction({
            type: isTower ? 'TOWER_CLIENT_MOVE' : 'SINGLE_PLAYER_CLIENT_MOVE',
            payload: {
                gameId: session.id,
                x: aiMove.x,
                y: aiMove.y,
                newBoardState: aiMoveResult.newBoardState,
                capturedStones: aiMoveResult.capturedStones,
                newKoInfo: aiMoveResult.newKoInfo,
                isHidden: true,
            },
        } as any);
    }, [
        aiHiddenItemEffectEndTime,
        effectTick,
        session.id,
        session.gameStatus,
        session.currentPlayer,
        session.moveHistory?.length,
        session.koInfo,
        session.settings?.aiDifficulty,
        restoredBoardState,
        session.boardState,
        handlers.handleAction,
        isTower,
        isGuildWarGame,
    ]);

    useEffect(() => {
        const isGameOver = ['ended', 'no_contest', 'scoring'].includes(gameStatus);
        const hasTurnChanged = prevMoveCount !== undefined && session.moveHistory && session.moveHistory.length > prevMoveCount;
    
        if (!isMyTurn || hasTurnChanged || isGameOver) {
            if (warningSoundPlayedForTurn.current) {
                audioService.stopTimerWarning();
                warningSoundPlayedForTurn.current = false;
            }
        }
        
        if (isMyTurn && !isGameOver) {
            const hasTimeControl = (session.settings?.timeLimit ?? 0) > 0 || ((session.settings?.byoyomiCount ?? 0) > 0 && (session.settings?.byoyomiTime ?? 0) > 0);
            const noCountdownSound = !hasTimeControl || session.isAiGame; // 싱글/AI 대국: 초읽기 소리 없음
            if (noCountdownSound) return;
            const myTime = myPlayerEnum === Player.Black ? clientTimes.clientTimes.black : clientTimes.clientTimes.white;
            if (myTime <= 10 && myTime > 0 && !warningSoundPlayedForTurn.current) {
                audioService.timerWarning();
                warningSoundPlayedForTurn.current = true;
            }
        }
    }, [isMyTurn, clientTimes.clientTimes, myPlayerEnum, session.moveHistory, prevMoveCount, gameStatus]);

    // 한 수가 실제로 반영되었거나 상태가 바뀌면 클릭 잠금 해제
    useEffect(() => {
        if (!isMoveInFlight) return;
        const currentMoveCount = session.moveHistory?.length ?? 0;
        const moveIncreased = prevMoveCount !== undefined && currentMoveCount > prevMoveCount;
        const statusChanged = prevGameStatus !== undefined && prevGameStatus !== gameStatus;
        // 베이스돌 배치: moveHistory/phase가 안 바뀌어도 서버가 baseStones_p1/p2를 갱신하므로 그때 잠금 해제
        const basePlacementAck =
            gameStatus === 'base_placement' &&
            myBaseStoneCountForUnlock !== undefined &&
            prevMyBaseStoneCountForUnlock !== undefined &&
            myBaseStoneCountForUnlock > prevMyBaseStoneCountForUnlock;
        if (moveIncreased || statusChanged || basePlacementAck) {
            setIsMoveInFlight(false);
        }
    }, [isMoveInFlight, session.moveHistory?.length, prevMoveCount, gameStatus, prevGameStatus, myBaseStoneCountForUnlock, prevMyBaseStoneCountForUnlock]);

    const showKoRuleFlash = useCallback(() => {
        if (boardRuleFlashClearRef.current) clearTimeout(boardRuleFlashClearRef.current);
        setBoardRuleFlashMessage(KO_RULE_FLASH_MESSAGE);
        boardRuleFlashClearRef.current = setTimeout(() => {
            setBoardRuleFlashMessage(null);
            boardRuleFlashClearRef.current = null;
        }, 5000);
    }, []);

    useEffect(() => () => {
        if (boardRuleFlashClearRef.current) clearTimeout(boardRuleFlashClearRef.current);
    }, []);

    const isItemModeActive = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating'].includes(gameStatus);

    const handleBoardClick = useCallback((x: number, y: number) => {
        audioService.stopTimerWarning();
        if (isSpectator || gameStatus === 'missile_animating') return;
        const isPausableAiGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';
        if ((session.isSinglePlayer || isTower || isPausableAiGame) && isPaused) return;
        if ((session.isSinglePlayer || isTower) && isBoardLocked) {
            console.log('[Game] Board is locked, ignoring click', { isBoardLocked, serverRevision: session.serverRevision });
            return;
        }

        // 새로고침 직후: 서버에서 아직 boardState가 동기화되지 않은 상태에서는 클릭을 막아
        // "빈 판에서 클릭 후 돌이 한꺼번에 보이는" 현상을 방지
        const effectiveBoard = restoredBoardState || session.boardState;
        const moveCount = session.moveHistory?.length ?? 0;
        if (!isSinglePlayer && !isTower && moveCount > 0) {
            const hasValidBoard =
                effectiveBoard &&
                Array.isArray(effectiveBoard) &&
                effectiveBoard.length > 0 &&
                effectiveBoard.some(
                    (row: Player[]) =>
                        row &&
                        Array.isArray(row) &&
                        row.some((cell: Player) => cell !== Player.None && cell != null)
                );
            if (!hasValidBoard) {
                console.log('[Game] Board state not yet synced from server; ignoring click to avoid desync', {
                    gameId,
                    moveCount,
                    hasBoardState: !!session.boardState
                });
                return;
            }
        }

        // 이미 한 수가 처리 중이면 추가 클릭 무시
        if (isMoveInFlight) {
            console.log('[Game] Move in flight, ignoring additional click');
            return;
        }

        // 착수 버튼 모드(ON)면 PC/모바일 모두 pendingMove로 확정 처리
        if (
            settings.features.moveConfirmButtonBox &&
            settings.features.mobileConfirm &&
            isMyTurn &&
            !isItemModeActive
        ) {
            if (
                mode === GameMode.Dice &&
                gameStatus === 'dice_placing' &&
                (session.stonesToPlace ?? 0) <= 0
            ) {
                return;
            }
            if (
                mode === GameMode.Thief &&
                gameStatus === 'thief_placing' &&
                (session.stonesToPlace ?? 0) <= 0
            ) {
                return;
            }
            if (pendingMove && pendingMove.x === x && pendingMove.y === y) return;
            setPendingMove({ x, y });
            return;
        }
        
        let actionType: ServerAction['type'] | null = null;
        let payload: any = { gameId, x, y };

        if ((mode === GameMode.Omok || mode === GameMode.Ttamok) && gameStatus === 'playing' && isMyTurn) {
            actionType = 'OMOK_PLACE_STONE';
        } else if (gameStatus === 'scanning' && isMyTurn) {
            audioService.stopScanBgm();
            actionType = 'SCAN_BOARD';
        } else if (gameStatus === 'base_placement') {
            const myStones = currentUser.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
            if ((myStones?.length || 0) < (session.settings.baseStones || 4)) actionType = 'PLACE_BASE_STONE';
        } else if (mode === GameMode.Dice && gameStatus === 'dice_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            actionType = 'DICE_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (mode === GameMode.Thief && gameStatus === 'thief_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            actionType = 'THIEF_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            // 도전의 탑 21층+ 히든 아이템: 서버에 PLACE_STONE(isHidden) 전송 후 로컬에도 반영 (전략바둑 히든과 동일)
            if (isTower && gameStatus === 'hidden_placing') {
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) return;
                if (x === -1 || y === -1) return;
                const boardSize = session.settings.boardSize;
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return;
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                const stoneAtTarget = boardStateToUse[y][x];
                const moveIndexAtTarget = (session.moveHistory || []).findIndex(m => m.x === x && m.y === y);
                const isHiddenTarget = stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    !!session.hiddenMoves?.[moveIndexAtTarget] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                if (stoneAtTarget === opponentPlayerEnum && !isHiddenTarget) return;
                if (stoneAtTarget === opponentPlayerEnum && isHiddenTarget) {
                    handlers.handleAction({
                        type: 'PLACE_STONE',
                        payload: {
                            gameId,
                            x,
                            y,
                            isHidden: true,
                            boardState: boardStateToUse,
                            moveHistory: session.moveHistory || [],
                        }
                    } as ServerAction);
                    if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                    return;
                }
                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        { ignoreSuicide: false, isSinglePlayer: true, opponentPlayer: opponentPlayerEnum }
                    );
                } catch (e) {
                    console.error('[Game] Tower hidden placement processMoveClient error:', e);
                    return;
                }
                if (!moveResult.isValid) {
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    return;
                }
                // 로컬 즉시 반영 (히든 표시 및 playing 전환)
                handlers.handleAction({
                    type: 'TOWER_CLIENT_MOVE',
                    payload: {
                        gameId,
                        x,
                        y,
                        newBoardState: moveResult.newBoardState,
                        capturedStones: moveResult.capturedStones,
                        newKoInfo: moveResult.newKoInfo,
                        isHidden: true,
                    }
                } as any);
                // 서버에 히든 착수 전송 (서버가 hiddenMoves 기록·AI에 비공개)
                handlers.handleAction({
                    type: 'PLACE_STONE',
                    payload: {
                        gameId,
                        x,
                        y,
                        isHidden: true,
                        boardState: boardStateToUse,
                        moveHistory: session.moveHistory || [],
                    }
                } as ServerAction);
                if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                return;
            }
            // 싱글플레이 히든 아이템 착수: 클라이언트에 히든 반영 후 서버로 PLACE_STONE(isHidden) 전송
            if (isSinglePlayer && gameStatus === 'hidden_placing') {
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) return;
                if (x === -1 || y === -1) return;
                const boardSize = session.settings.boardSize;
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return;
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                const stoneAtTarget = boardStateToUse[y][x];
                const moveIndexAtTarget = (session.moveHistory || []).findIndex(m => m.x === x && m.y === y);
                const isHiddenTarget = stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    !!session.hiddenMoves?.[moveIndexAtTarget] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                if (stoneAtTarget === opponentPlayerEnum && !isHiddenTarget) return;
                if (stoneAtTarget === opponentPlayerEnum && isHiddenTarget) {
                    handlers.handleAction({
                        type: 'PLACE_STONE',
                        payload: {
                            gameId,
                            x,
                            y,
                            isHidden: true,
                            boardState: boardStateToUse,
                            moveHistory: session.moveHistory || [],
                        }
                    } as ServerAction);
                    if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                    return;
                }
                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        { ignoreSuicide: false, isSinglePlayer: true, opponentPlayer: opponentPlayerEnum }
                    );
                } catch (e) {
                    console.error('[Game] Single player hidden placement processMoveClient error:', e);
                    return;
                }
                if (!moveResult.isValid) {
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    return;
                }
                handlers.handleAction({
                    type: 'SINGLE_PLAYER_CLIENT_MOVE',
                    payload: {
                        gameId,
                        x,
                        y,
                        newBoardState: moveResult.newBoardState,
                        capturedStones: moveResult.capturedStones,
                        newKoInfo: moveResult.newKoInfo,
                        isHidden: true,
                    }
                } as any);
                handlers.handleAction({
                    type: 'PLACE_STONE',
                    payload: {
                        gameId,
                        x,
                        y,
                        isHidden: true,
                        boardState: moveResult.newBoardState,
                        moveHistory: [...(session.moveHistory || []), { x, y, player: myPlayerEnum }],
                    }
                } as ServerAction);
                if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                return;
            }
            // 도전의 탑·싱글플레이 일반 착수: 클라이언트에서만 처리 (서버로 전송하지 않음)
            if (isTower || isSinglePlayer) {
                // 클라이언트에서 직접 게임 상태 업데이트 (검증 없이 무조건 실행)
                console.log(`[Game] ${isTower ? 'Tower' : 'Single player'} game - processing move client-side (no validation):`, { x, y, gameId, currentPlayer: myPlayerEnum });
                
                // boardState가 유효한지 확인 (복원된 boardState 사용)
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - boardState is invalid, cannot process move`);
                    return;
                }
                
                // 치명적 버그 방지: 패 위치(-1, -1)에 돌을 놓으려는 시도 차단
                if (x === -1 || y === -1) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - CRITICAL BUG PREVENTION: Attempted to place stone at pass position (${x}, ${y})`);
                    // TODO: 에러 메시지를 사용자에게 표시
                    return;
                }

                // 치명적 버그 방지: 보드 범위를 벗어나는 위치에 돌을 놓으려는 시도 차단
                const boardSize = session.settings.boardSize;
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - CRITICAL BUG PREVENTION: Attempted to place stone out of bounds (${x}, ${y}), boardSize=${boardSize}`);
                    // TODO: 에러 메시지를 사용자에게 표시
                    return;
                }

                // 싱글플레이/도전의 탑에서 AI 돌 위에 착점하는 것 차단
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                const stoneAtTarget = boardStateToUse[y][x];
                const moveIndexAtTarget = (session.moveHistory || []).findIndex(m => m.x === x && m.y === y);
                const isHiddenTarget = stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    !!session.hiddenMoves?.[moveIndexAtTarget] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                if ((isSinglePlayer || isTower) && stoneAtTarget === opponentPlayerEnum && isHiddenTarget) {
                    handlers.handleAction({
                        type: 'LOCAL_HIDDEN_REVEAL_TRIGGER',
                        payload: {
                            gameId,
                            gameType: isTower ? 'tower' : 'singleplayer',
                            point: { x, y },
                            player: opponentPlayerEnum,
                            keepTurn: true
                        }
                    } as any);
                    return;
                }
                if ((isSinglePlayer || isTower) && stoneAtTarget === opponentPlayerEnum) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - CRITICAL BUG PREVENTION: Attempted to place stone on AI stone at (${x}, ${y})`);
                    // TODO: 에러 메시지를 사용자에게 표시
                    return;
                }

                // 클라이언트에서 move 처리 (바둑 규칙 검증 적용)
                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        {
                            ignoreSuicide: false,
                            isSinglePlayer: isSinglePlayer || isTower,
                            opponentPlayer: (isSinglePlayer || isTower) ? opponentPlayerEnum : undefined
                        }
                    );
                } catch (e) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - processMoveClient error:`, e);
                    // TODO: 에러 메시지를 사용자에게 표시
                    return;
                }
                
                // 검증 실패 시 돌을 놓지 않음 (바둑 규칙 준수)
                if (!moveResult.isValid) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - Invalid move blocked:`, moveResult.reason);
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    return;
                }
                
                // 게임 상태 업데이트 (handlers를 통해, 서버로 전송하지 않음)
                handlers.handleAction({
                    type: isTower ? 'TOWER_CLIENT_MOVE' : 'SINGLE_PLAYER_CLIENT_MOVE',
                    payload: {
                        gameId,
                        x,
                        y,
                        newBoardState: moveResult.newBoardState,
                        capturedStones: moveResult.capturedStones,
                        newKoInfo: moveResult.newKoInfo,
                    }
                } as any);
                return;
            }
            // 전략바둑 AI 대국 포함: 모든 온라인 게임은 서버에서만 검증/반영
            actionType = 'PLACE_STONE'; 
            payload.isHidden = gameStatus === 'hidden_placing';
            // 클라이언트의 boardState와 moveHistory를 서버로 전송하여 정확한 검증 가능하도록 함
            payload.boardState = restoredBoardState || session.boardState;
            payload.moveHistory = session.moveHistory || [];
            if (payload.isHidden) audioService.stopScanBgm();
        }

        if (actionType === 'SCAN_BOARD' && (isTower || isSinglePlayer || isGuildWarGame)) {
            const sync = buildPveItemActionClientSync(session);
            if (sync) payload.clientSync = sync;
        }

        if (actionType) {
            console.log('[Game] Sending action:', { actionType, payload, isMyTurn, myPlayerEnum, currentPlayer, gameStatus });
            // 전략 AI/길드전 AI 대국: 서버 응답 전에도 유저 수를 즉시 보드에 반영
            if (actionType === 'PLACE_STONE' &&
                session.isAiGame &&
                !session.isSinglePlayer &&
                session.gameCategory !== 'tower' &&
                gameStatus === 'playing' &&
                x >= 0 &&
                y >= 0) {
                const boardStateToUse = restoredBoardState || session.boardState;
                if (boardStateToUse && Array.isArray(boardStateToUse) && boardStateToUse.length > 0) {
                    try {
                        const moveResult = processMoveClient(
                            boardStateToUse,
                            { x, y, player: myPlayerEnum },
                            session.koInfo,
                            session.moveHistory?.length || 0
                        );
                        if (moveResult.isValid) {
                            handlers.handleAction({
                                type: 'AI_GAME_CLIENT_MOVE',
                                payload: {
                                    gameId,
                                    x,
                                    y,
                                    newBoardState: moveResult.newBoardState,
                                    capturedStones: moveResult.capturedStones,
                                    newKoInfo: moveResult.newKoInfo,
                                }
                            } as any);
                        }
                    } catch (e) {
                        console.warn('[Game] AI_GAME_CLIENT_MOVE optimistic update skipped:', e);
                    }
                }
            }
            setIsMoveInFlight(true);
            void Promise.resolve(handlers.handleAction({ type: actionType, payload } as ServerAction)).then((res) => {
                const hasErr = res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error;
                if (hasErr) {
                    setIsMoveInFlight(false);
                    const err = String((res as { error: string }).error);
                    if (actionType === 'PLACE_STONE' && (err.includes('패 모양') || err.includes('코 금지') || (err.includes('바로') && err.includes('따낼')))) {
                        showKoRuleFlash();
                    }
                } else if (actionType === 'DICE_PLACE_STONE' || actionType === 'THIEF_PLACE_STONE') {
                    // 주사위/도둑: 낙관적 갱신은 moveHistory를 늘리지 않아 moveHistory 기반 잠금 해제가 되지 않음 → 매 수마다 해제
                    setIsMoveInFlight(false);
                }
            });
        } else {
            console.log('[Game] No action type determined', { 
                isMyTurn, 
                myPlayerEnum, 
                currentPlayer, 
                gameStatus,
                mode,
                blackPlayerId: session.blackPlayerId,
                whitePlayerId: session.whitePlayerId,
                currentUser: currentUser.id
            });
        }
    }, [isSpectator, gameStatus, isMyTurn, gameId, handlers.handleAction, currentUser.id, player1.id, session.baseStones_p1, session.baseStones_p2, session.settings.baseStones, mode, isMobile, settings.features.moveConfirmButtonBox, settings.features.mobileConfirm, pendingMove, isItemModeActive, session.isSinglePlayer, session.isAiGame, session.gameCategory, isPaused, isBoardLocked, restoredBoardState, session.boardState, session.moveHistory, session.stonesToPlace, isMoveInFlight, isTower, isSinglePlayer, isGuildWarGame, showKoRuleFlash]);

    const handleConfirmMove = useCallback(() => {
        audioService.stopTimerWarning();
        if (!pendingMove) return;
        const x = pendingMove.x;
        const y = pendingMove.y;

        // 이미 한 수가 처리 중이면 추가 확정 무시
        if (isMoveInFlight) {
            console.log('[Game] Move in flight, ignoring confirm');
            return;
        }

        const isTower = session.gameCategory === 'tower';
        const isPVEGame = session.isSinglePlayer || isTower || session.gameCategory === 'singleplayer';

        let actionType: ServerAction['type'] | null = null;
        let payload: any = { gameId, x, y };

        if ((mode === GameMode.Omok || mode === GameMode.Ttamok) && gameStatus === 'playing' && isMyTurn) {
            actionType = 'OMOK_PLACE_STONE';
        } else if (mode === GameMode.Dice && gameStatus === 'dice_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            actionType = 'DICE_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (mode === GameMode.Thief && gameStatus === 'thief_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            actionType = 'THIEF_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            // PVE(싱글/타워): 클라이언트에서 즉시 반영
            if (isPVEGame) {
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) {
                    setPendingMove(null);
                    return;
                }
                const boardSize = session.settings.boardSize;
                if (x === -1 || y === -1) {
                    setPendingMove(null);
                    return;
                }
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
                    setPendingMove(null);
                    return;
                }

                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;

                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        { ignoreSuicide: false, isSinglePlayer: true, opponentPlayer: opponentPlayerEnum }
                    );
                } catch (e) {
                    console.error('[Game] Confirm move processMoveClient error:', e);
                    setPendingMove(null);
                    return;
                }
                if (!moveResult.isValid) {
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    setPendingMove(null);
                    return;
                }

                actionType = isTower ? ('TOWER_CLIENT_MOVE' as any) : ('SINGLE_PLAYER_CLIENT_MOVE' as any);
                payload = {
                    gameId,
                    x,
                    y,
                    newBoardState: moveResult.newBoardState,
                    capturedStones: moveResult.capturedStones,
                    newKoInfo: moveResult.newKoInfo,
                    // 히든 배치 상태에서는 히든 착수로 처리(타워 21층+ 등)
                    ...(gameStatus === 'hidden_placing' ? { isHidden: true } : {}),
                };
            } else {
                // 온라인 게임(전략바둑 AI 대국 포함): 서버에서 검증/반영
                actionType = 'PLACE_STONE';
                payload.isHidden = gameStatus === 'hidden_placing';
                payload.boardState = restoredBoardState || session.boardState;
                payload.moveHistory = session.moveHistory || [];
            }
        }

        if (actionType) {
            setIsMoveInFlight(true);
            const at = actionType;
            void Promise.resolve(handlers.handleAction({ type: at, payload } as ServerAction)).then((res) => {
                const hasErr = res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error;
                if (hasErr) {
                    setIsMoveInFlight(false);
                    const err = String((res as { error: string }).error);
                    if (at === 'PLACE_STONE' && (err.includes('패 모양') || err.includes('코 금지') || (err.includes('바로') && err.includes('따낼')))) {
                        showKoRuleFlash();
                    }
                } else if (at === 'DICE_PLACE_STONE' || at === 'THIEF_PLACE_STONE') {
                    setIsMoveInFlight(false);
                }
            });
        }
        setPendingMove(null);
    }, [pendingMove, gameId, handlers, gameStatus, isMyTurn, mode, restoredBoardState, isMoveInFlight, session.gameCategory, session.isSinglePlayer, session.boardState, session.settings.boardSize, session.koInfo, session.moveHistory?.length, session.stonesToPlace, myPlayerEnum, showKoRuleFlash]);

    const handleCancelMove = useCallback(() => setPendingMove(null), []);

    const clearPauseCountdown = useCallback(() => {
        if (pauseCountdownIntervalRef.current) {
            clearInterval(pauseCountdownIntervalRef.current);
            pauseCountdownIntervalRef.current = null;
        }
    }, []);

    const resumeFromPause = useCallback(() => {
        if (!isPaused) return;
        if (resumeCountdown > 0) return;

        setIsPaused(false);
        setResumeCountdown(0);
        setPauseButtonCooldown(5);
        // 싱글플레이/도전의 탑은 클라이언트가 타이머를 직접 조정(로컬 실행)
        // 일반 AI 대국은 서버가 타이머를 관리하므로 여기서 deadline을 조정하지 않음
        const isTower = session.gameCategory === 'tower';
        const shouldAdjustDeadlinesLocally = session.isSinglePlayer || isTower;

        if (shouldAdjustDeadlinesLocally && pauseStartedAtRef.current) {
            const pausedDuration = Date.now() - pauseStartedAtRef.current;
            pauseStartedAtRef.current = null;
            const newTurnDeadline = session.turnDeadline ? session.turnDeadline + pausedDuration : undefined;
            const newItemDeadline = session.itemUseDeadline ? session.itemUseDeadline + pausedDuration : undefined;
            const newSharedDeadline = session.basePlacementDeadline ? session.basePlacementDeadline + pausedDuration : undefined;
            if (newTurnDeadline || newItemDeadline || newSharedDeadline) {
                session.turnDeadline = newTurnDeadline ?? session.turnDeadline;
                session.itemUseDeadline = newItemDeadline ?? session.itemUseDeadline;
                session.basePlacementDeadline = newSharedDeadline ?? session.basePlacementDeadline;
            }
        }
        clearPauseCountdown();
    }, [isPaused, resumeCountdown, clearPauseCountdown, session]);

    const initiatePause = useCallback(() => {
        if (isPaused || pauseButtonCooldown > 0) return;
        audioService.stopTimerWarning();
        pauseStartedAtRef.current = Date.now();
        setIsPaused(true);
        setResumeCountdown(5);
        clearPauseCountdown();
        pauseCountdownIntervalRef.current = setInterval(() => {
            setResumeCountdown(prev => {
                if (prev <= 1) {
                    clearPauseCountdown();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [isPaused, pauseButtonCooldown, clearPauseCountdown]);

    const handlePauseToggle = useCallback(() => {
        const isTower = session.gameCategory === 'tower';
        const isPausableAiGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';
        if (!(session.isSinglePlayer || isTower || isPausableAiGame)) return;
        if (!isPaused) {
            initiatePause();
            if (isPausableAiGame) {
                handlers.handleAction({ type: 'PAUSE_AI_GAME', payload: { gameId: session.id } } as any);
            }
        } else {
            resumeFromPause();
            if (isPausableAiGame) {
                handlers.handleAction({ type: 'RESUME_AI_GAME', payload: { gameId: session.id } } as any);
            }
        }
    }, [isPaused, initiatePause, resumeFromPause, session.isSinglePlayer, session.gameCategory, session.isAiGame, session.id, handlers.handleAction]);

    useEffect(() => {
        if (pauseButtonCooldown <= 0) return;
        const interval = setInterval(() => {
            setPauseButtonCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [pauseButtonCooldown]);

    const analysisResult = useMemo(() => session.analysisResult?.[currentUser.id] ?? (['ended','no_contest'].includes(gameStatus) ? session.analysisResult?.['system'] : null), [session.analysisResult, currentUser.id, gameStatus]);

    const isNoContestLeaveAvailable = useMemo(() => {
        if (isSpectator || session.isAiGame) return false;
        return !!session.canRequestNoContest?.[currentUser.id];
    }, [session.canRequestNoContest, currentUser.id, isSpectator, session.isAiGame]);

    const handleLeaveOrResignClick = useCallback(() => {
        if (isSpectator) {
            handlers.handleAction({ type: 'LEAVE_SPECTATING' });
            return;
        }
        if (['ended', 'no_contest', 'rematch_pending'].includes(gameStatus)) {
            const actionType = session.isAiGame ? 'LEAVE_AI_GAME' : 'LEAVE_GAME_ROOM';
            // AI/일반 게임 종료 후 나가기 시 해당 종류의 대기실로 이동 (전략/놀이 대기실 AI를 먼저 판별해 싱글·탑으로 잘못 나가는 버그 방지)
            if (session.gameCategory === 'guildwar') {
                sessionStorage.setItem('postGameRedirect', '#/guildwar');
            } else if (session.gameCategory === 'tower') {
                sessionStorage.setItem('postGameRedirect', '#/tower');
            } else if (session.isAiGame && (SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || PLAYFUL_GAME_MODES.some(m => m.mode === session.mode))) {
                const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const : 'playful' as const;
                sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
            } else if (session.gameCategory === 'singleplayer' || session.isSinglePlayer) {
                sessionStorage.setItem('postGameRedirect', '#/singleplayer');
            } else {
                // 일반 게임(전략/놀이바둑): 전략이면 전략 대기실, 그 외는 놀이바둑 대기실로 이동
                const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const : 'playful' as const;
                sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
            }
            handlers.handleAction({ type: actionType, payload: { gameId } });
            return;
        }
        if (isNoContestLeaveAvailable) {
            if (window.confirm("상대방의 장고로 인해 페널티 없이 무효 처리하고 나가시겠습니까?")) {
                handlers.handleAction({ type: 'REQUEST_NO_CONTEST_LEAVE', payload: { gameId } });
            }
        } else {
            setConfirmModalType('resign');
        }
    }, [isSpectator, handlers.handleAction, session.isAiGame, session.isSinglePlayer, session.gameCategory, session.mode, gameId, gameStatus, isNoContestLeaveAvailable]);

    useEffect(() => {
        return () => {
            clearPauseCountdown();
        };
    }, [clearPauseCountdown]);

    useEffect(() => {
        const isTower = session.gameCategory === 'tower';
        if (!(session.isSinglePlayer || isTower)) return;
        if (isPaused && ['ended', 'no_contest'].includes(gameStatus)) {
            resumeFromPause();
        }
    }, [session.isSinglePlayer, isPaused, gameStatus, resumeFromPause, session.gameCategory]);

    // 게임 ID가 바뀔 때만 일시정지/재개 상태 초기화 (다른 게임으로 이동)
    useEffect(() => {
        setIsPaused(false);
        setResumeCountdown(0);
        setPauseButtonCooldown(0);
        pauseStartedAtRef.current = null;
        clearPauseCountdown();
        setIsBoardLocked(false);
        setLastReceivedServerRevision(session.serverRevision ?? 0);
    }, [session.id, clearPauseCountdown]);

    // 같은 게임 내 serverRevision 변경 시: 최신 리비전 반영 및 보드 잠금 해제 (일시정지 상태는 유지)
    useEffect(() => {
        if (session.serverRevision !== undefined) {
            setLastReceivedServerRevision(session.serverRevision);
            setIsBoardLocked(false);
        }
    }, [session.serverRevision]);

    // currentPlayer 변경 감지: AI가 돌을 둔 경우 보드 잠금
    useEffect(() => {
        if (session.isSinglePlayer && prevCurrentPlayer !== undefined) {
            // 싱글플레이에서는 blackPlayerId가 사용자, whitePlayerId가 AI
            const myPlayerEnum = blackPlayerId === currentUser.id ? Player.Black : (whitePlayerId === currentUser.id ? Player.White : Player.None);
            const wasMyTurn = prevCurrentPlayer === myPlayerEnum;
            const isNowMyTurn = currentPlayer === myPlayerEnum;
            
            // AI가 돌을 둔 경우 (내 턴이 아니었다가 내 턴이 된 경우는 제외)
            if (wasMyTurn && !isNowMyTurn) {
                console.log('[Game] AI moved, locking board until serverRevision update', { 
                    prevCurrentPlayer, 
                    currentPlayer, 
                    myPlayerEnum,
                    wasMyTurn,
                    isNowMyTurn
                });
                setIsBoardLocked(true);
            }
        }
    }, [currentPlayer, prevCurrentPlayer, session.isSinglePlayer, currentUser.id, blackPlayerId, whitePlayerId]);

    // serverRevision 변경 감지: 최신 상태를 받은 경우 보드 잠금 해제
    useEffect(() => {
        if ((session.isSinglePlayer || isTower) && session.serverRevision !== undefined) {
            const newRevision = session.serverRevision;
            if (newRevision > lastReceivedServerRevision) {
                setLastReceivedServerRevision(newRevision);
                // 최신 상태를 받았으므로 잠금 해제
                if (isBoardLocked) {
                    console.log('[Game] Received latest serverRevision, unlocking board');
                    setIsBoardLocked(false);
                }
            }
        }
    }, [session.serverRevision, session.isSinglePlayer, isTower, lastReceivedServerRevision, isBoardLocked]);

    // 싱글플레이: 클라이언트 측 AI 자동 처리 (서버 부하 최소화)
    // 보드 잠금은 사용자 입력만 막는 것이므로, AI 수 계산은 보드 잠금과 독립적으로 실행
    const aiMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAiMoveRef = useRef<{ gameId: string; moveHistoryLength: number; player: Player; timestamp: number } | null>(null);
    
    // moveHistoryLength 변경 시 lastAiMoveRef 검증 및 초기화
    useEffect(() => {
        if (lastAiMoveRef.current) {
            const currentMoveHistoryLength = session.moveHistory?.length || 0;
            // moveHistoryLength가 증가했거나, 타임스탬프가 3초 이상 지났으면 초기화
            const timeSinceLastMove = Date.now() - lastAiMoveRef.current.timestamp;
            if (currentMoveHistoryLength > lastAiMoveRef.current.moveHistoryLength || timeSinceLastMove > 3000) {
                console.log('[Game] Resetting lastAiMoveRef:', {
                    reason: currentMoveHistoryLength > lastAiMoveRef.current.moveHistoryLength ? 'moveHistoryLength increased' : 'timeout',
                    lastMove: lastAiMoveRef.current,
                    currentMoveHistoryLength,
                    timeSinceLastMove
                });
                lastAiMoveRef.current = null;
            }
        }
    }, [session.moveHistory?.length]);
    
    useEffect(() => {
        // 이전 timeout이 있으면 취소
        if (aiMoveTimeoutRef.current) {
            clearTimeout(aiMoveTimeoutRef.current);
            aiMoveTimeoutRef.current = null;
        }
        
        const isTower = session.gameCategory === 'tower';
        const isPlayfulAiGame = session.isAiGame && PLAYFUL_GAME_MODES.some(m => m.mode === mode);
        // 게임이 종료되었거나 일시정지되었거나 플레이 중이 아니면 AI 수를 보내지 않음
        // 놀이바둑 AI 게임도 클라이언트에서 처리
        if (!(session.isSinglePlayer || isTower || isPlayfulAiGame) || isPaused || gameStatus !== 'playing') {
            lastAiMoveRef.current = null;
            return;
        }
        if (currentPlayer === Player.None) {
            lastAiMoveRef.current = null;
            return;
        }
        
        // 게임이 제대로 초기화되지 않았으면 AI 수를 보내지 않음
        const boardStateToCheck = restoredBoardState || session.boardState;
        if (!boardStateToCheck || !Array.isArray(boardStateToCheck) || boardStateToCheck.length === 0) return;
        if (!session.blackPlayerId || !session.whitePlayerId) return;
        
        // 게임 ID가 유효한지 확인 (재도전 시 게임 ID가 변경될 수 있음)
        if (!session.id || typeof session.id !== 'string') return;

        const aiPlayerId = currentPlayer === Player.Black ? session.blackPlayerId : session.whitePlayerId;
        // 놀이바둑 AI 게임도 클라이언트에서 처리
        const isAiTurn = aiPlayerId === AI_USER_ID || (session.isAiGame && aiPlayerId === 'ai-player-01');

        // Safety: during server-driven hidden animation (ai_thinking), do not calculate/send any AI move.
        const aiHiddenItemAnimationEndTime = (session as any).aiHiddenItemAnimationEndTime as number | undefined;
        const isServerAiHiddenAnimationInProgress =
            session.animation?.type === 'ai_thinking' &&
            aiHiddenItemAnimationEndTime != null &&
            Date.now() < aiHiddenItemAnimationEndTime;
        if (isServerAiHiddenAnimationInProgress) {
            lastAiMoveRef.current = null;
            return;
        }

        // 디버깅: AI 차례 판단 로그 (도전의 탑과 싱글플레이에서 상세하게)
        if ((isTower || session.isSinglePlayer) && (currentPlayer === Player.Black || currentPlayer === Player.White)) {
            const logData = {
                gameId: session.id,
                gameCategory: session.gameCategory,
                isTower,
                isSinglePlayer: session.isSinglePlayer,
                currentPlayer,
                'currentPlayer === Player.White': currentPlayer === Player.White,
                'currentPlayer === Player.Black': currentPlayer === Player.Black,
                aiPlayerId,
                AI_USER_ID,
                'aiPlayerId === AI_USER_ID': aiPlayerId === AI_USER_ID,
                isAiTurn,
                blackPlayerId: session.blackPlayerId,
                whitePlayerId: session.whitePlayerId,
                'whitePlayerId === AI_USER_ID': session.whitePlayerId === AI_USER_ID,
                'blackPlayerId === AI_USER_ID': session.blackPlayerId === AI_USER_ID,
                gameStatus,
                lastAiMove: lastAiMoveRef.current,
                moveHistoryLength: session.moveHistory?.length || 0
            };
            console.log(`[Game] ${isTower ? 'Tower' : 'Single player'} AI turn check:`, logData);
            if (currentPlayer === Player.White && session.whitePlayerId !== AI_USER_ID) {
                console.error(`[Game] MISMATCH: Current player is White but whitePlayerId is not AI_USER_ID!`, {
                    whitePlayerId: session.whitePlayerId,
                    AI_USER_ID,
                    blackPlayerId: session.blackPlayerId,
                    gameCategory: session.gameCategory,
                    isSinglePlayer: session.isSinglePlayer
                });
            }
            // 싱글플레이에서는 blackPlayerId가 유저 ID여야 하고, whitePlayerId가 AI_USER_ID여야 함
            if (currentPlayer === Player.Black && session.blackPlayerId !== currentUser.id && session.isSinglePlayer) {
                console.error(`[Game] MISMATCH: Single player - Current player is Black but blackPlayerId is not current user!`, {
                    blackPlayerId: session.blackPlayerId,
                    whitePlayerId: session.whitePlayerId,
                    AI_USER_ID,
                    currentUserId: currentUser.id
                });
            }
        }

        if (isAiTurn) {
            const moveCount = session.moveHistory?.length ?? 0;
            const aiTurnIndex = Math.floor(moveCount / 2) + 1; // 지금 둘 차례인 백 = 1번째 AI턴(1), 2번째 AI턴(2), ...
            const hiddenStoneCount = session.settings?.hiddenStoneCount ?? 0;
            const aiIsPlayer1 = session.player1?.id != null && aiPlayerId === session.player1.id;
            const aiHiddenLeft = Number(
                (aiIsPlayer1 ? (session as any).hidden_stones_p1 : (session as any).hidden_stones_p2) ??
                hiddenStoneCount ??
                0
            );
            const maxHiddenTurns = plannedAiHiddenTurns.length || 1;
            // 이미 사용한 히든 턴 수가 계획된 수 이상이면 더 이상 히든 연출하지 않음 (두 번째 AI 수가 히든으로 겹치는 버그 방지)
            const hasHiddenSlotsLeft = aiHiddenItemsUsedCount < maxHiddenTurns;
            // 유저 턴이 한 번이라도 지났으면(이미 히든 연출 실행 후) 다음 AI 수는 반드시 일반 돌
            const neverExecutedHiddenThisGame = !aiHiddenMoveExecutedRef.current;
            const isAiHiddenItemTurn =
                isAiHiddenPresentationStage &&
                aiHiddenLeft > 0 &&
                hasHiddenSlotsLeft &&
                neverExecutedHiddenThisGame &&
                nextAiHiddenItemTurn != null &&
                aiTurnIndex === nextAiHiddenItemTurn;
            if (isAiHiddenItemTurn && aiHiddenItemEffectEndTime == null) {
                aiHiddenMoveExecutedRef.current = false;
                setAiHiddenItemEffectEndTime(Date.now() + 6000);
                return;
            }
            if (aiHiddenItemEffectEndTime != null) return;

            // 게임이 이미 종료되었는지 확인
            if (gameStatus !== 'playing' && (gameStatus === 'ended' || gameStatus === 'no_contest' || gameStatus === 'scoring')) {
                console.log(`[Game] ${isTower ? 'Tower' : 'Single player'} game already ended, skipping AI move:`, {
                    gameId: session.id,
                    gameStatus
                });
                return;
            }
            
            console.log('[Game] Entering AI move calculation block:', {
                gameId: session.id,
                gameCategory: session.gameCategory,
                isTower,
                currentPlayer,
                moveHistoryLength: session.moveHistory?.length || 0
            });
            const moveHistoryLength = session.moveHistory?.length || 0;
            
            // 이미 같은 게임, 같은 moveHistory 길이, 같은 플레이어에 대해 AI 수를 보냈는지 확인
            // (중복 전송 방지)
            // 단, AI 수 계산 중이거나 전송 대기 중인 경우(타임스탬프가 2초 이내)는 제외
            if (lastAiMoveRef.current &&
                lastAiMoveRef.current.gameId === session.id &&
                lastAiMoveRef.current.moveHistoryLength === moveHistoryLength &&
                lastAiMoveRef.current.player === currentPlayer) {
                const timeSinceLastMove = Date.now() - lastAiMoveRef.current.timestamp;
                // 2초 이내면 아직 전송 대기 중이거나 계산 중일 수 있으므로 무시
                if (timeSinceLastMove < 2000) {
                    console.log('[Game] AI move calculation/transmission in progress, skipping:', {
                        gameId: session.id,
                        lastMove: lastAiMoveRef.current,
                        currentMoveHistoryLength: moveHistoryLength,
                        currentPlayer,
                        timeSinceLastMove
                    });
                    return;
                }
                // 3초 이상 지났으면 초기화하고 재시도
                if (timeSinceLastMove > 3000) {
                    console.log('[Game] lastAiMoveRef timeout, resetting and retrying:', {
                        gameId: session.id,
                        lastMove: lastAiMoveRef.current,
                        timeSinceLastMove
                    });
                    lastAiMoveRef.current = null;
                    // 초기화 후 계속 진행하여 AI 수 재계산
                } else {
                    // 이미 이 상태에 대해 AI 수를 보냈으므로 무시
                    console.log('[Game] AI move already sent, skipping:', {
                        gameId: session.id,
                        lastAiMove: lastAiMoveRef.current,
                        currentMoveHistoryLength: moveHistoryLength,
                        currentPlayer,
                        timeSinceLastMove
                    });
                    return;
                }
            }
            
            // 놀이바둑 게임은 바둑 AI를 사용할 수 없으므로 서버로 전송
            const isPlayfulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
            if (isPlayfulMode) {
                // 놀이바둑 게임은 서버에서 AI 처리 (DICE, ALKKAGI, CURLING, THIEF 등)
                // 서버로 액션 전송하여 AI가 처리하도록 함
                console.log('[Game] Playful AI game - sending action to server for AI processing:', {
                    gameId: session.id,
                    mode,
                    currentPlayer
                });
                // 서버에서 AI가 처리하도록 PLACE_STONE 액션 전송 (서버가 AI 차례를 감지하여 처리)
                handlers.handleAction({
                    type: 'PLACE_STONE',
                    payload: {
                        gameId: session.id,
                        x: -1, // 서버에서 AI가 처리하도록 표시
                        y: -1,
                        isClientAiMove: false,
                    },
                } as ServerAction);
                return;
            }
            
            // 클라이언트 측에서 AI 수 계산 (바둑 모드만)
            const aiLevel = session.settings.aiDifficulty || 1;
            const opponentPlayer = currentPlayer === Player.Black ? Player.White : Player.Black;
            
            // 현재 게임 ID와 상태를 저장 (timeout 내에서 사용)
            const currentGameId = session.id;
            const currentGameStatus = session.gameStatus;
            const currentPlayerAtCalculation = currentPlayer;
            const moveHistoryLengthAtCalculation = moveHistoryLength;
            
            // 히든 모드에서는 유저의 미공개 히든 돌을 AI에게 빈칸처럼 보이게 처리한다.
            const boardStateToUse = restoredBoardState || session.boardState;
            const boardStateForAi =
                session.isSinglePlayer || session.gameCategory === 'tower' || session.gameCategory === 'guildwar'
                    ? getMaskedBoardForHiddenAi(session, boardStateToUse)
                    : boardStateToUse;
            const boardStateAtCalculation = JSON.parse(JSON.stringify(boardStateForAi));
            const actualBoardStateAtCalculation = JSON.parse(JSON.stringify(boardStateToUse));
            const koInfoAtCalculation = session.koInfo ? JSON.parse(JSON.stringify(session.koInfo)) : null;
            
            const aiMove = calculateSimpleAiMove(
                boardStateAtCalculation,
                currentPlayer,
                opponentPlayer,
                koInfoAtCalculation,
                moveHistoryLengthAtCalculation,
                aiLevel
            );

            if (aiMove) {
                console.log('[Game] AI move calculated:', {
                    gameId: currentGameId,
                    gameCategory: session.gameCategory,
                    isTower: session.gameCategory === 'tower',
                    aiMove,
                    currentPlayer: currentPlayerAtCalculation,
                    aiLevel,
                    moveHistoryLength: moveHistoryLengthAtCalculation
                });
                
                // 약 1초 지연 후 AI 수 전송 (봇도 시간을 사용해야 하므로)
                const delay = 1000; // 1초 고정
                aiMoveTimeoutRef.current = setTimeout(() => {
                    // 게임 상태가 여전히 'playing'이고 AI 차례인지 다시 확인
                    // 게임 ID가 변경되지 않았는지도 확인
                    // moveHistory 길이가 변경되지 않았는지 확인 (다른 수가 이미 둬졌는지 확인)
                    const currentMoveHistoryLength = session.moveHistory?.length || 0;
                    if (session.gameStatus === 'playing' && 
                        session.currentPlayer === currentPlayerAtCalculation &&
                        session.id === currentGameId &&
                        session.gameStatus === currentGameStatus &&
                        currentMoveHistoryLength === moveHistoryLengthAtCalculation) {
                        // 타워 게임, 싱글플레이 게임, 놀이바둑 AI 게임의 AI move도 클라이언트에서만 처리
                        const isPlayfulAiGame = session.isAiGame && PLAYFUL_GAME_MODES.some(m => m.mode === mode);
                        if (session.gameCategory === 'tower' || session.isSinglePlayer || isPlayfulAiGame) {
                            console.log(`[Game] ${session.gameCategory === 'tower' ? 'Tower' : 'Single player'} game - processing AI move client-side:`, {
                                gameId: currentGameId,
                                x: aiMove.x,
                                y: aiMove.y,
                                currentPlayer: currentPlayerAtCalculation
                            });

                            const aiTriedUserHiddenStone =
                                (session.isSinglePlayer || session.gameCategory === 'tower') &&
                                isUnrevealedUserHiddenStoneAt(session, aiMove.x, aiMove.y);
                            if (aiTriedUserHiddenStone) {
                                lastAiMoveRef.current = {
                                    gameId: currentGameId,
                                    moveHistoryLength: moveHistoryLengthAtCalculation,
                                    player: currentPlayerAtCalculation,
                                    timestamp: Date.now()
                                };
                                handlers.handleAction({
                                    type: 'LOCAL_HIDDEN_REVEAL_TRIGGER',
                                    payload: {
                                        gameId: currentGameId,
                                        gameType: session.gameCategory === 'tower' ? 'tower' : 'singleplayer',
                                        point: { x: aiMove.x, y: aiMove.y },
                                        player: Player.Black,
                                        keepTurn: true
                                    }
                                } as any);
                                aiMoveTimeoutRef.current = null;
                                return;
                            }
                            
                            // 클라이언트에서 AI move 처리
                            const aiMoveResult = processMoveClient(
                                actualBoardStateAtCalculation,
                                { x: aiMove.x, y: aiMove.y, player: currentPlayerAtCalculation },
                                koInfoAtCalculation,
                                moveHistoryLengthAtCalculation
                            );
                            
                            if (!aiMoveResult.isValid) {
                                console.warn(`[Game] ${session.gameCategory === 'tower' ? 'Tower' : 'Single player'} game - Invalid AI move:`, aiMoveResult.reason);
                                lastAiMoveRef.current = null;
                                return;
                            }
                            
                            // AI 수를 실제로 전송한 후에만 lastAiMoveRef 설정 (중복 전송 방지)
                            lastAiMoveRef.current = {
                                gameId: currentGameId,
                                moveHistoryLength: moveHistoryLengthAtCalculation,
                                player: currentPlayerAtCalculation,
                                timestamp: Date.now()
                            };
                            
                            // 게임 상태 업데이트 (handlers를 통해)
                            handlers.handleAction({
                                type: session.gameCategory === 'tower' ? 'TOWER_CLIENT_MOVE' : 'SINGLE_PLAYER_CLIENT_MOVE',
                                payload: {
                                    gameId: currentGameId,
                                    x: aiMove.x,
                                    y: aiMove.y,
                                    newBoardState: aiMoveResult.newBoardState,
                                    capturedStones: aiMoveResult.capturedStones,
                                    newKoInfo: aiMoveResult.newKoInfo,
                                }
                            } as any);
                        } else {
                        if (
                            session.gameCategory === 'guildwar' &&
                            isUnrevealedUserHiddenStoneAt(session, aiMove.x, aiMove.y)
                        ) {
                            lastAiMoveRef.current = {
                                gameId: currentGameId,
                                moveHistoryLength: moveHistoryLengthAtCalculation,
                                player: currentPlayerAtCalculation,
                                timestamp: Date.now(),
                            };
                            handlers.handleAction({
                                type: 'LOCAL_HIDDEN_REVEAL_TRIGGER',
                                payload: {
                                    gameId: currentGameId,
                                    gameType: 'guildwar',
                                    point: { x: aiMove.x, y: aiMove.y },
                                    player: Player.Black,
                                    keepTurn: true,
                                },
                            } as any);
                            aiMoveTimeoutRef.current = null;
                            return;
                        }
                        console.log('[Game] Sending AI move:', {
                            gameId: currentGameId,
                            x: aiMove.x,
                            y: aiMove.y,
                            isClientAiMove: true
                        });
                        handlers.handleAction({
                            type: 'PLACE_STONE',
                            payload: {
                                gameId: currentGameId,
                                x: aiMove.x,
                                y: aiMove.y,
                                isClientAiMove: true, // 클라이언트가 계산한 AI 수임을 표시
                            },
                        } as ServerAction);
                        }
                    } else {
                        console.log('[Game] AI move cancelled due to state change:', {
                            gameStatus: session.gameStatus,
                            currentPlayer: session.currentPlayer,
                            gameId: session.id,
                            moveHistoryLength: currentMoveHistoryLength,
                            expectedLength: moveHistoryLengthAtCalculation
                        });
                        // 상태가 변경되었으므로 lastAiMoveRef 초기화
                        lastAiMoveRef.current = null;
                    }
                    aiMoveTimeoutRef.current = null;
                }, delay);
            } else {
                console.warn('[Game] calculateSimpleAiMove returned null:', {
                    gameId: currentGameId,
                    gameCategory: session.gameCategory,
                    isTower: session.gameCategory === 'tower',
                    currentPlayer: currentPlayerAtCalculation,
                    aiLevel,
                    boardSize: boardStateAtCalculation.length,
                    moveHistoryLength: moveHistoryLengthAtCalculation
                });
                // AI 수를 계산할 수 없으면 lastAiMoveRef 초기화하여 다음 시도 허용
                lastAiMoveRef.current = null;
            }
        } else {
            // AI 차례가 아니면 lastAiMoveRef 초기화 (다음 AI 차례를 위해)
            lastAiMoveRef.current = null;
        }
        
        // cleanup: 게임 ID가 변경되거나 컴포넌트가 unmount될 때 timeout 취소
        return () => {
            if (aiMoveTimeoutRef.current) {
                clearTimeout(aiMoveTimeoutRef.current);
                aiMoveTimeoutRef.current = null;
            }
        };
    }, [
        session.isSinglePlayer,
        session.gameCategory,
        isPaused,
        gameStatus,
        currentPlayer,
        session.blackPlayerId,
        session.whitePlayerId,
        restoredBoardState,
        session.koInfo,
        session.moveHistory?.length,
        session.settings?.aiDifficulty,
        isBoardLocked,
        session.id,
        session.gameStatus,
        handlers.handleAction,
        aiHiddenItemEffectEndTime,
        isAiHiddenPresentationStage,
        nextAiHiddenItemTurn,
        (session as any).hidden_stones_p1,
        (session as any).hidden_stones_p2,
        session.player1?.id,
        session.animation?.type,
        (session as any).aiHiddenItemAnimationEndTime
    ]);
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    
    const handleCloseResults = useCallback(() => {
        setShowResultModal(false);
        if (!session.analysisResult?.['system']) {
            setShowFinalTerritory(false);
        }
        // 도전의 탑·싱글플레이·(전략/놀이 대기실에서 시작한) AI 대국:
        // "확인"은 모달만 닫고 경기장에 머물고, "나가기"에서만 퇴장 후 대기실로 이동
        const isTowerOrSingle = session.gameCategory === 'tower' || session.isSinglePlayer;
        const isLobbyAiGame =
            session.isAiGame &&
            (SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || PLAYFUL_GAME_MODES.some(m => m.mode === session.mode));
        if (isTowerOrSingle || isLobbyAiGame) return;
        // 그 외(PVP 등): 경기 종료 후 결과 모달 "확인" 시 퇴장 + 해당 대기실로 이동
        if ((gameStatus === 'ended' || gameStatus === 'no_contest') && gameId) {
            // 전략이면 전략 대기실, 그 외는 놀이바둑 대기실로 이동
            const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const : 'playful' as const;
            sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
            const actionType = session.isAiGame ? 'LEAVE_AI_GAME' : 'LEAVE_GAME_ROOM';
            handlers.handleAction({ type: actionType, payload: { gameId } });
        }
    }, [session.analysisResult, session.gameCategory, session.isSinglePlayer, session.mode, gameStatus, gameId, session.isAiGame, handlers.handleAction]);

    // 싱글플레이 게임 설명창 표시 여부
    const showGameDescription = isSinglePlayer && gameStatus === 'pending';
    // 도전의 탑 게임 설명창 표시 여부
    const showTowerGameDescription = isTower && gameStatus === 'pending';
    
    // 도전의 탑 배경 이미지 설정
    const towerBackgroundImage = isTower && session.towerFloor 
        ? (session.towerFloor === 100 ? '/images/tower/Tower100.png' : '/images/tower/InTower.png')
        : null;
    
    // 디버깅: 게임 상태 확인
    useEffect(() => {
        if (isSinglePlayer) {
            console.log('[Game] Single player game status:', {
                gameStatus,
                isSinglePlayer,
                showGameDescription,
                gameId: session.id,
                stageId: session.stageId
            });
        }
        if (isTower) {
            console.log('[Game] Tower game status:', {
                gameStatus,
                isTower,
                showTowerGameDescription,
                gameId: session.id,
                towerFloor: session.towerFloor
            });
        }
    }, [isSinglePlayer, isTower, gameStatus, showGameDescription, showTowerGameDescription, session.id, session.stageId, session.towerFloor]);

    const handleStartGame = useCallback(() => {
        console.log('[Game] handleStartGame called', { gameId, gameStatus, isSinglePlayer, isTower, sessionId: session.id });
        if (!gameId) {
            console.error('[Game] handleStartGame: gameId is missing', { sessionId: session.id, gameStatus });
            return;
        }
        
        if (isSinglePlayer) {
            console.log('[Game] handleStartGame: Sending CONFIRM_SINGLE_PLAYER_GAME_START', { gameId, gameStatus });
            handlers.handleAction({ 
                type: 'CONFIRM_SINGLE_PLAYER_GAME_START', 
                payload: { gameId } 
            } as ServerAction).then(result => {
                console.log('[Game] handleStartGame: CONFIRM_SINGLE_PLAYER_GAME_START completed', result);
            }).catch(err => {
                console.error('[Game] handleStartGame: CONFIRM_SINGLE_PLAYER_GAME_START failed', err);
            });
        } else if (isTower) {
            console.log('[Game] handleStartGame: Sending CONFIRM_TOWER_GAME_START', { gameId, gameStatus, isTower });
            handlers.handleAction({ 
                type: 'CONFIRM_TOWER_GAME_START', 
                payload: { gameId } 
            } as ServerAction);
        }
    }, [handlers.handleAction, gameId, isSinglePlayer, isTower, session.id, gameStatus]);

    // 도전의 탑: 싱글플레이와 동일하게 시작 모달에서 시작 버튼을 눌러 확정
    
    // 싱글플레이어/도전의 탑/전략바둑 수순 제한: restoredBoardState + totalTurns/moveHistory 복원을 포함한 표시용 session (PlayerPanel 남은 턴 등에 사용)
    const sessionWithRestoredBoard = useMemo(() => {
        if (!isSinglePlayer && !isTower && !hasStrategicTurnLimit) {
            return session;
        }
        // totalTurns·moveHistory·문양돌이 복원된 세션을 베이스로 사용 (새로고침 후 남은 턴이 Max로 초기화되는 버그 방지)
        const base = sessionWithRestoredPatternStones;
        // restoredBoardState가 있으면 보드만 추가로 반영
        if (restoredBoardState && restoredBoardState !== base.boardState) {
            return { ...base, boardState: restoredBoardState };
        }
        return base;
    }, [isSinglePlayer, isTower, hasStrategicTurnLimit, sessionWithRestoredPatternStones, restoredBoardState]);

    const isAiHiddenPresentationActive = aiHiddenItemEffectEndTime != null && Date.now() < aiHiddenItemEffectEndTime;
    const sessionWithAiHiddenPresentation = useMemo(() => {
        if (!isAiHiddenPresentationActive) return sessionWithRestoredBoard;
        return {
            ...sessionWithRestoredBoard,
            foulInfo: {
                message: 'AI봇이 히든 아이템을 사용했습니다!',
                expiry: aiHiddenItemEffectEndTime,
            }
        };
    }, [isAiHiddenPresentationActive, sessionWithRestoredBoard, aiHiddenItemEffectEndTime]);
    
    const gameProps: GameProps = {
        session: sessionWithAiHiddenPresentation, onAction: handlers.handleAction, currentUser: currentUserWithStatus, waitingRoomChat: globalChat,
        gameChat: gameChat, isSpectator, onlineUsers, activeNegotiation, negotiations: Object.values(negotiations), onViewUser: handlers.openViewingUser
    };

    // AI 게임 일시 정지 관련 변수 (gameControlsProps보다 먼저 정의)
    const isPausableAiGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';

    const gameControlsProps = {
        session, isMyTurn, isSpectator, onAction: handlers.handleAction, setShowResultModal, setConfirmModalType, currentUser: currentUserWithStatus,
        onlineUsers, pendingMove, onConfirmMove: handleConfirmMove, onCancelMove: handleCancelMove, settings, isMobile,
        onUpdateFeatureSetting: updateFeatureSetting,
        showResultModal,
        isMoveInFlight,
        isBoardLocked,
        // AI 게임 일시 정지 관련 props
        isPaused: isPausableAiGame ? isPaused : undefined,
        resumeCountdown: isPausableAiGame ? resumeCountdown : undefined,
        pauseButtonCooldown: isPausableAiGame ? pauseButtonCooldown : undefined,
        onPauseToggle: isPausableAiGame ? handlePauseToggle : undefined,
        onOpenRematchSettings: (session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer' && session.gameCategory !== 'guildwar')
            ? () => setIsAiRematchModalOpen(true)
            : undefined,
        onOpenGameRecordList: handlers.openGameRecordList,
        onLeaveOrResign: handleLeaveOrResignClick,
    };

    if (isSinglePlayer) {
        return (
            <InGameModalLayoutProvider>
            <div className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full bg-single-player-background text-stone-200 min-h-0`} style={{ height: '100%', maxHeight: '100%', paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>
                {showGameDescription && (
                    <SinglePlayerGameDescriptionModal 
                        session={sessionWithRestoredPatternStones}
                        onStart={handleStartGame}
                    />
                )}
                <Header compact />
                <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden">
                    <main className="flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden">
                        <div className="w-full h-full max-h-full max-w-full flex flex-col items-center gap-1 lg:gap-2">
                        <div className="flex-shrink-0 w-full flex items-center gap-2">
                                <div className="flex-1 min-w-0 px-2 pt-1">
                                    <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isSinglePlayer={true} isMobile={isMobile} />
                                </div>
                            </div>
                            <div className="flex-1 w-full relative min-w-0 min-h-0 overflow-hidden">
                                <div className="absolute inset-0">
                                    <GameArena 
                                        {...gameProps}
                                        isMyTurn={isMyTurn} 
                                        myPlayerEnum={myPlayerEnum} 
                                        handleBoardClick={handleBoardClick} 
                                        isItemModeActive={isItemModeActive} 
                                        showTerritoryOverlay={showFinalTerritory} 
                                        isMobile={isMobile}
                                        pendingMove={pendingMoveForBoard}
                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                        captureScoreFloatMinPoints={settings.features.captureScoreAnimation ? 1 : 2}
                                        isSinglePlayerPaused={isPaused}
                                        showBoardGlow={gameStatus === 'hidden_placing' || isAiHiddenPresentationActive}
                                        resumeCountdown={resumeCountdown}
                                        isBoardLocked={isBoardLocked}
                                        isBoardRotated={isBoardRotated}
                                        onToggleBoardRotation={() => setIsBoardRotated(prev => !prev)}
                                    />
                                    {/* 착수 확정: 드래그로 위치 조절 가능 (위치는 기기별 localStorage 저장) */}
                                    {showMoveConfirmPanel && (
                                        <MoveConfirmDraggable
                                            layoutMode={isMobile ? 'mobile' : 'desktop'}
                                            pendingMove={pendingMove}
                                            handleConfirmMove={handleConfirmMove}
                                            mobileConfirm={settings.features.mobileConfirm}
                                            updateFeatureSetting={updateFeatureSetting}
                                            setPendingMove={setPendingMove}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="flex-shrink-0 w-full flex flex-col gap-1">
                                <TurnDisplay
                                    session={sessionWithAiHiddenPresentation}
                                    isPaused={isPaused}
                                    isMobile={isMobile}
                                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                                    onAction={handlers.handleAction}
                                    boardRuleFlashMessage={boardRuleFlashMessage}
                                />
                                <SinglePlayerControls {...gameControlsProps} />
                            </div>
                        </div>
                    </main>
                    
                    {!isMobile && (
                        <div
                            className={`relative flex-shrink-0 transition-[width] duration-200 ${
                                isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                            }`}
                        >
                            {!isRightSidebarCollapsed && (
                                <div className="flex h-full items-stretch border-l border-gray-700/80 bg-gray-900/50 rounded-r-lg overflow-hidden">
                                    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                                        <SinglePlayerSidebar
                                            session={sessionWithRestoredPatternStones}
                                            gameChat={gameChat}
                                            onAction={handlers.handleAction}
                                            currentUser={currentUserWithStatus}
                                            isPaused={isPaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                            onTogglePause={handlePauseToggle}
                                        />
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                                className="absolute top-1/2 -left-6 -translate-y-1/2 w-7 h-9 flex items-center justify-center rounded-md bg-gray-800/90 hover:bg-gray-700/90 text-gray-300 hover:text-white transition-colors border border-gray-700/80"
                                title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                                aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            >
                                <span className="text-sm font-bold leading-none">
                                    {isRightSidebarCollapsed ? '<' : '>'}
                                </span>
                            </button>
                        </div>
                    )}
                    
                    {isMobile && (
                        <>
                            <div className={`fixed top-0 right-0 h-full w-[280px] bg-secondary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                                <SinglePlayerSidebar 
                                    session={sessionWithRestoredPatternStones}
                                    gameChat={gameChat}
                                    onAction={handlers.handleAction}
                                    currentUser={currentUserWithStatus}
                                    onClose={() => setIsMobileSidebarOpen(false)}
                                    isPaused={isPaused}
                                    resumeCountdown={resumeCountdown}
                                    pauseButtonCooldown={pauseButtonCooldown}
                                    onTogglePause={handlePauseToggle}
                                />
                            </div>
                            {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                        </>
                    )}
                </div>
                
                <GameModals 
                    {...gameProps}
                    confirmModalType={confirmModalType}
                    onHideConfirmModal={() => setConfirmModalType(null)}
                    showResultModal={showResultModal}
                    onCloseResults={handleCloseResults}
                    onOpenGameRecordList={handlers.openGameRecordList}
                />
            </div>
            </InGameModalLayoutProvider>
        );
    }

    if (isTower) {
        return (
            <InGameModalLayoutProvider>
            <div 
                className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full text-stone-200 min-h-0`}
                style={{
                    height: '100%',
                    maxHeight: '100%',
                    paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                    ...(towerBackgroundImage ? {
                        backgroundImage: `url(${towerBackgroundImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                    } : {})
                }}
            >
                {showTowerGameDescription && (
                    <SinglePlayerGameDescriptionModal 
                        session={sessionWithRestoredPatternStones}
                        onStart={handleStartGame}
                    />
                )}
                <Header compact />
                <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden">
                    <main className="flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden">
                        <div className="w-full h-full max-h-full max-w-full flex flex-col items-center gap-1 lg:gap-2">
                        <div className="flex-shrink-0 w-full flex items-center gap-2">
                            <div className="flex-1 min-w-0 px-2 pt-1">
                                    <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isSinglePlayer={true} isMobile={isMobile} />
                                </div>
                            </div>
                            <div className="flex-1 w-full relative min-w-0 min-h-0 overflow-hidden">
                                <div className="absolute inset-0">
                                <GameArena 
                                        {...gameProps}
                                        isMyTurn={isMyTurn} 
                                        myPlayerEnum={myPlayerEnum} 
                                        handleBoardClick={handleBoardClick} 
                                        isItemModeActive={isItemModeActive} 
                                        showTerritoryOverlay={showFinalTerritory} 
                                        isMobile={isMobile}
                                        pendingMove={pendingMoveForBoard}
                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                        captureScoreFloatMinPoints={settings.features.captureScoreAnimation ? 1 : 2}
                                        isSinglePlayerPaused={isPaused}
                                        showBoardGlow={gameStatus === 'hidden_placing' || isAiHiddenPresentationActive}
                                        resumeCountdown={resumeCountdown}
                                        isBoardLocked={isBoardLocked}
                                    />
                                {/* 착수 확정: 드래그로 위치 조절 가능 (위치는 기기별 localStorage 저장) */}
                                {showMoveConfirmPanel && (
                                    <MoveConfirmDraggable
                                        layoutMode={isMobile ? 'mobile' : 'desktop'}
                                        pendingMove={pendingMove}
                                        handleConfirmMove={handleConfirmMove}
                                        mobileConfirm={settings.features.mobileConfirm}
                                        updateFeatureSetting={updateFeatureSetting}
                                        setPendingMove={setPendingMove}
                                    />
                                )}
                                </div>
                            </div>
                            <div className="flex-shrink-0 w-full flex flex-col gap-1">
                                <TurnDisplay
                                    session={sessionWithAiHiddenPresentation}
                                    isPaused={isPaused}
                                    isMobile={isMobile}
                                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                                    onAction={handlers.handleAction}
                                    boardRuleFlashMessage={boardRuleFlashMessage}
                                />
                                <TowerControls {...gameControlsProps} />
                            </div>
                        </div>
                    </main>
                    
                    {!isMobile && (
                        <div
                            className={`relative flex-shrink-0 transition-[width] duration-200 ${
                                isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                            }`}
                        >
                            {!isRightSidebarCollapsed && (
                                <div className="flex h-full items-stretch border-l border-gray-700/80 bg-gray-900/50 rounded-r-lg overflow-hidden">
                                    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                                        <TowerSidebar
                                            session={sessionWithRestoredPatternStones}
                                            gameChat={gameChat}
                                            onAction={handlers.handleAction}
                                            currentUser={currentUserWithStatus}
                                            onTogglePause={handlePauseToggle}
                                            isPaused={isPaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                        />
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                                className="absolute top-1/2 -left-6 -translate-y-1/2 w-7 h-9 flex items-center justify-center rounded-md bg-gray-800/90 hover:bg-gray-700/90 text-gray-300 hover:text-white transition-colors border border-gray-700/80"
                                title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                                aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            >
                                <span className="text-sm font-bold leading-none">
                                    {isRightSidebarCollapsed ? '<' : '>'}
                                </span>
                            </button>
                        </div>
                    )}
                    
                    {isMobile && (
                        <>
                            <div className={`fixed top-0 right-0 h-full w-[280px] bg-secondary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                                <TowerSidebar 
                                    session={sessionWithRestoredPatternStones}
                                    gameChat={gameChat}
                                    onAction={handlers.handleAction}
                                    currentUser={currentUserWithStatus}
                                    onClose={() => setIsMobileSidebarOpen(false)}
                                    onTogglePause={handlePauseToggle}
                                    isPaused={isPaused}
                                    resumeCountdown={resumeCountdown}
                                    pauseButtonCooldown={pauseButtonCooldown}
                                />
                            </div>
                            {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                        </>
                    )}
                </div>
                
                <GameModals 
                    {...gameProps}
                    confirmModalType={confirmModalType}
                    onHideConfirmModal={() => setConfirmModalType(null)}
                    showResultModal={showResultModal}
                    onCloseResults={handleCloseResults}
                    onOpenGameRecordList={handlers.openGameRecordList}
                />
            </div>
            </InGameModalLayoutProvider>
        );
    }

    // PVP 게임 배경 이미지 결정
    const pvpBackgroundClass = useMemo(() => {
        if (isGuildWarGame) {
            return '';
        }
        if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
            return 'bg-strategic-background';
        }
        if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
            return 'bg-playful-background';
        }
        return 'bg-tertiary';
    }, [mode, isGuildWarGame]);

    // AI 게임도 클라이언트 일시 정지 상태 사용 (싱글플레이어와 동일한 방식)
    // isPausableAiGame은 위에서 이미 정의됨
    const effectivePaused = (session.isSinglePlayer || isTower || isPausableAiGame) ? isPaused : false;

    return (
        <InGameModalLayoutProvider>
        <div
            className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full min-h-0 ${pvpBackgroundClass}`}
            style={{
                height: '100%',
                maxHeight: '100%',
                paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                ...(isGuildWarGame
                    ? {
                          backgroundImage: "url('/images/guild/guildwar/warmap.png')",
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                      }
                    : {}),
            }}
        >
            {session.disconnectionState && <DisconnectionModal session={session} currentUser={currentUser} />}
            {isAiRematchModalOpen && (
                <AiChallengeModal
                    lobbyType={SPECIAL_GAME_MODES.some(m => m.mode === mode) ? 'strategic' : 'playful'}
                    onClose={() => setIsAiRematchModalOpen(false)}
                    onAction={(action) => {
                        // 기존 대국 상태를 깨끗하게 제거하고 새 대국 시작
                        try {
                            sessionStorage.removeItem(`gameState_${session.id}`);
                        } catch {
                            // ignore
                        }
                        setIsAiRematchModalOpen(false);
                        handlers.handleAction(action);
                    }}
                />
            )}
            {/* 전략·놀이바둑 경기장 상단 헤더 (행동력, 재화, 설정 등) */}
            <Header compact />
            <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden">
                <main className="flex-1 flex min-w-0 min-h-0 overflow-hidden items-stretch justify-center">
                    <div className="w-full h-full max-h-full max-w-full flex min-h-0 flex-col items-stretch gap-1 lg:gap-2">
                        <div className="flex-shrink-0 w-full flex items-center gap-2">
                            <div className="flex-1 min-w-0 px-2 pt-1">
                                <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isMobile={isMobile} />
                            </div>
                        </div>
                        <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
                            <div className="absolute inset-0 flex min-h-0 flex-col">
                                <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
                                    <div
                                        className={`flex min-h-0 w-full flex-1 items-center justify-center overflow-auto ${effectivePaused ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-500`}
                                    >
                                        <GameArena 
                                            {...gameProps}
                                            isMyTurn={isMyTurn} 
                                            myPlayerEnum={myPlayerEnum} 
                                            handleBoardClick={handleBoardClick} 
                                            isItemModeActive={isItemModeActive} 
                                            showTerritoryOverlay={showFinalTerritory} 
                                            isMobile={isMobile}
                                            pendingMove={pendingMoveForBoard}
                                            myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                            showLastMoveMarker={settings.features.lastMoveMarker}
                                            captureScoreFloatMinPoints={settings.features.captureScoreAnimation ? 1 : 2}
                                            isBoardRotated={isBoardRotated}
                                            onToggleBoardRotation={() => setIsBoardRotated(prev => !prev)}
                                            showBoardGlow={
                                                isGuildWarTowerStyleUi &&
                                                (gameStatus === 'hidden_placing' || isAiHiddenPresentationActive)
                                            }
                                            diceGoPlaceUi={
                                                settings.features.moveConfirmButtonBox
                                                    ? {
                                                          mobileConfirm: settings.features.mobileConfirm,
                                                          onToggleMobileConfirm: (checked) => {
                                                              updateFeatureSetting('mobileConfirm', checked);
                                                              if (!checked) setPendingMove(null);
                                                          },
                                                          onConfirmMove: handleConfirmMove,
                                                      }
                                                    : undefined
                                            }
                                        />
                                    </div>
                                    {/* 착수 확정: 드래그로 위치 조절 가능 (위치는 기기별 localStorage 저장) */}
                                    {showMoveConfirmPanel && (
                                        <MoveConfirmDraggable
                                            layoutMode={isMobile ? 'mobile' : 'desktop'}
                                            pendingMove={pendingMove}
                                            handleConfirmMove={handleConfirmMove}
                                            mobileConfirm={settings.features.mobileConfirm}
                                            updateFeatureSetting={updateFeatureSetting}
                                            setPendingMove={setPendingMove}
                                        />
                                    )}
                                    {effectivePaused && (
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
                            </div>
                            {/* 계가 중: 바둑판 위 22초 연출만 표시 (모달 없음). 싱글/탑은 Arena에서 fullscreen 오버레이 표시 */}
                            {session.gameStatus === 'scoring' &&
                                !session.isSinglePlayer &&
                                session.gameCategory !== 'tower' &&
                                (!session.analysisResult?.['system'] || session.isAnalyzing) && (
                                    <ScoringOverlay />
                                )}
                        </div>
                        <div className="flex-shrink-0 w-full flex flex-col gap-1">
                            <TurnDisplay
                                session={sessionWithRestoredPatternStones}
                                isMobile={isMobile}
                                onOpenSidebar={isMobile ? openMobileSidebar : undefined}
                                sidebarNotification={hasNewMessage}
                                onAction={handlers.handleAction}
                                boardRuleFlashMessage={boardRuleFlashMessage}
                            />
                            {isGuildWarTowerStyleUi && mode === GameMode.Missile ? (
                                <GuildWarMissileTowerControls
                                    session={session}
                                    onAction={handlers.handleAction}
                                    setShowResultModal={setShowResultModal}
                                    setConfirmModalType={setConfirmModalType}
                                    isMoveInFlight={isMoveInFlight}
                                    isBoardLocked={isBoardLocked}
                                    isMobile={isMobile}
                                />
                            ) : isGuildWarTowerStyleUi && mode === GameMode.Hidden ? (
                                <GuildWarHiddenTowerControls
                                    session={session}
                                    onAction={handlers.handleAction}
                                    currentUser={currentUserWithStatus}
                                    setShowResultModal={setShowResultModal}
                                    setConfirmModalType={setConfirmModalType}
                                    isMoveInFlight={isMoveInFlight}
                                    isBoardLocked={isBoardLocked}
                                    isMobile={isMobile}
                                />
                            ) : (
                                <GameControls {...gameControlsProps} />
                            )}
                        </div>
                    </div>
                </main>
                
                {!isMobile && (
                    <div
                        className={`relative flex-shrink-0 transition-[width] duration-200 ${
                            isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                        }`}
                    >
                        {!isRightSidebarCollapsed && (
                            <div className="flex h-full items-stretch border-l border-gray-700/80 bg-gray-900/50 rounded-r-lg overflow-hidden">
                                <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                                    {isGuildWarTowerStyleUi ? (
                                        <GuildWarTowerSidebar
                                            session={sessionWithRestoredPatternStones}
                                            gameChat={gameChat}
                                            onAction={handlers.handleAction}
                                            currentUser={currentUserWithStatus}
                                            onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                            isPaused={effectivePaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                        />
                                    ) : (
                                        <Sidebar
                                            {...gameProps}
                                            onLeaveOrResign={handleLeaveOrResignClick}
                                            isNoContestLeaveAvailable={isNoContestLeaveAvailable}
                                            onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                            isPaused={effectivePaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                            pauseDisabledBecauseAiTurn={isPausableAiGame && !isMyTurn}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                            className="absolute top-1/2 -left-6 -translate-y-1/2 w-7 h-9 flex items-center justify-center rounded-md bg-gray-800/90 hover:bg-gray-700/90 text-gray-300 hover:text-white transition-colors border border-gray-700/80"
                            title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                        >
                            <span className="text-sm font-bold leading-none">
                                {isRightSidebarCollapsed ? '<' : '>'}
                            </span>
                        </button>
                    </div>
                )}
                
                {isMobile && (
                    <>
                        <div className={`fixed top-0 right-0 h-full w-[280px] bg-secondary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            {isGuildWarTowerStyleUi ? (
                                <GuildWarTowerSidebar
                                    session={sessionWithRestoredPatternStones}
                                    gameChat={gameChat}
                                    onAction={handlers.handleAction}
                                    currentUser={currentUserWithStatus}
                                    onClose={() => setIsMobileSidebarOpen(false)}
                                    onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                    isPaused={effectivePaused}
                                    resumeCountdown={resumeCountdown}
                                    pauseButtonCooldown={pauseButtonCooldown}
                                />
                            ) : (
                                <Sidebar
                                    {...gameProps}
                                    onLeaveOrResign={handleLeaveOrResignClick}
                                    isNoContestLeaveAvailable={isNoContestLeaveAvailable}
                                    onClose={() => setIsMobileSidebarOpen(false)}
                                    onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                    isPaused={effectivePaused}
                                    resumeCountdown={resumeCountdown}
                                    pauseButtonCooldown={pauseButtonCooldown}
                                    pauseDisabledBecauseAiTurn={isPausableAiGame && !isMyTurn}
                                />
                            )}
                        </div>
                        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                    </>
                )}
            </div>
            
            {isAnalysisActive && analysisResult && (
                <TerritoryAnalysisWindow session={session} result={analysisResult} onClose={() => setIsAnalysisActive(false)} />
            )}
            
            <GameModals 
                {...gameProps}
                confirmModalType={confirmModalType}
                onHideConfirmModal={() => setConfirmModalType(null)}
                showResultModal={showResultModal}
                onCloseResults={handleCloseResults}
                onOpenGameRecordList={handlers.openGameRecordList}
            />
        </div>
        </InGameModalLayoutProvider>
    );
};

export default Game;