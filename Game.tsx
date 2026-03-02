import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// FIX: Import types from the new centralized types barrel file
import { Player, GameMode, GameStatus, Point, GameProps, LiveGameSession, ServerAction } from './types/index.js';
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
import { ScoringOverlay } from './components/game/ScoringOverlay.js';
import { useClientTimer } from './hooks/useClientTimer.js';
import { useIsMobileLayout } from './hooks/useIsMobileLayout.js';
import { calculateSimpleAiMove } from './client/goAiBotClient.js';
import { processMoveClient } from './client/goLogicClient.js';

// AI 유저 ID (싱글플레이에서 AI 차례 판단용)
const AI_USER_ID = aiUserId;

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
    } = useAppContext();

    const { id: gameId, currentPlayer, gameStatus, player1, player2, mode, blackPlayerId, whitePlayerId } = session;

    if (!player1?.id || !player2?.id || !currentUser || !currentUserWithStatus) {
        return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;
    }

    const [confirmModalType, setConfirmModalType] = useState<'resign' | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [showFinalTerritory, setShowFinalTerritory] = useState(false);
    const [justScanned, setJustScanned] = useState(false);
    const [pendingMove, setPendingMove] = useState<Point | null>(null);
    const [isAnalysisActive, setIsAnalysisActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [resumeCountdown, setResumeCountdown] = useState(0);
    const pauseStartedAtRef = useRef<number | null>(null);
    const pauseCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [pauseButtonCooldown, setPauseButtonCooldown] = useState(0);
    // 연속 클릭 방지: 수 처리 중에는 추가 클릭 무시
    const [isMoveInFlight, setIsMoveInFlight] = useState(false);
    const clientTimes = useClientTimer(session, (session.isSinglePlayer || (session.gameCategory === 'tower')) ? { isPaused } : {});
    const [isAiRematchModalOpen, setIsAiRematchModalOpen] = useState(false);
    
    // 보드 잠금 메커니즘: AI가 돌을 둔 직후 최신 serverRevision을 받을 때까지 보드 잠금
    const [lastReceivedServerRevision, setLastReceivedServerRevision] = useState<number>(session.serverRevision ?? 0);
    const [isBoardLocked, setIsBoardLocked] = useState(false);
    
    // isSpectator를 먼저 선언 (isBoardRotated 초기화에서 사용)
    const isSpectator = useMemo(() => currentUserWithStatus?.status === 'spectating', [currentUserWithStatus]);
    
    // 바둑판 회전 상태 (백 유저/AI봇은 기본적으로 회전)
    const [isBoardRotated, setIsBoardRotated] = useState(() => {
        // 백 유저 또는 AI봇인 경우 기본적으로 회전
        if (isSpectator) return false;
        const isWhitePlayer = whitePlayerId === currentUser.id;
        const isAiGame = session.isAiGame && (session.whitePlayerId === 'ai-player-01' || session.blackPlayerId === 'ai-player-01');
        return isWhitePlayer || (isAiGame && session.currentPlayer === Player.White);
    });
    
    const prevGameStatus = usePrevious(gameStatus);
    const prevCurrentPlayer = usePrevious(currentPlayer);
    const prevCaptures = usePrevious(session.captures);
    const prevAnimationType = usePrevious(session.animation?.type);
    const warningSoundPlayedForTurn = useRef(false);
    const prevMoveCount = usePrevious(session.moveHistory?.length);
    const prevAnalysisResult = usePrevious(session.analysisResult?.['system']);
    const isSinglePlayer = session.isSinglePlayer;
    const isTower = session.gameCategory === 'tower';
    // 전략바둑 AI/PVP 수순 제한: 새로고침 후 totalTurns·moveHistory 복원/저장에 포함
    const hasStrategicTurnLimit = (session.settings?.scoringTurnLimit ?? 0) > 0 || ((session.settings as any)?.autoScoringTurns ?? 0) > 0;
    
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
    }, [isSinglePlayer, isTower, session.boardState, session.blackPatternStones, session.whitePatternStones, session.moveHistory?.length, session.settings.boardSize, gameId, gameStatus]);
    
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
                    boardState: restoredBoardState,
                    moveHistory: session.moveHistory || [],
                    captures: session.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                    baseStoneCaptures: session.baseStoneCaptures,
                    hiddenStoneCaptures: session.hiddenStoneCaptures,
                    permanentlyRevealedStones: session.permanentlyRevealedStones || [],
                    blackPatternStones: session.blackPatternStones,
                    whitePatternStones: session.whitePatternStones,
                    hiddenMoves: session.hiddenMoves || {},
                    hidden_stones_p1: (session as any).hidden_stones_p1,
                    hidden_stones_p2: (session as any).hidden_stones_p2,
                    totalTurns: totalTurnsToSave,
                    timestamp: Date.now()
                };
                sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameStateToSave));
            } catch (e) {
                console.error(`[Game] Failed to save game state to sessionStorage:`, e);
            }
        }
    }, [restoredBoardState, session.moveHistory, session.captures, session.baseStoneCaptures, session.hiddenStoneCaptures, session.permanentlyRevealedStones, session.blackPatternStones, session.whitePatternStones, session.totalTurns, gameId, gameStatus, isSinglePlayer, session.gameCategory, hasStrategicTurnLimit]);
    
    // 도전의 탑/싱글/전략바둑 수순 제한: 새로고침 후 서버 페이로드에 문양돌·totalTurns·moveHistory가 없을 수 있으므로 sessionStorage에서 복원해 표시
    const sessionWithRestoredPatternStones = useMemo(() => {
        if (!isSinglePlayer && !isTower && !hasStrategicTurnLimit) return session;
        let next = session;
        try {
            const stored = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.gameId === gameId) {
                    const hasPattern = (session.blackPatternStones?.length ?? 0) > 0 || (session.whitePatternStones?.length ?? 0) > 0;
                    if (!hasPattern) {
                        const storedBlack = Array.isArray(parsed.blackPatternStones) ? parsed.blackPatternStones : null;
                        const storedWhite = Array.isArray(parsed.whitePatternStones) ? parsed.whitePatternStones : null;
                        if (storedBlack || storedWhite) {
                            next = { ...next, blackPatternStones: storedBlack ?? next.blackPatternStones, whitePatternStones: storedWhite ?? next.whitePatternStones };
                        }
                    }
                    // 턴 제한 경기: totalTurns가 없거나 0이면 sessionStorage 값으로 복원 (남은 턴이 Max로 초기화되는 현상 방지)
                    const serverTotalTurns = next.totalTurns;
                    if ((serverTotalTurns === undefined || serverTotalTurns === null || serverTotalTurns === 0) && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0) {
                        next = { ...next, totalTurns: parsed.totalTurns };
                    }
                    // INITIAL_STATE 등에서 moveHistory가 생략된 경우 복원 (남은 턴 계산에 사용)
                    const serverMoveCount = next.moveHistory?.filter((m: { x: number; y: number }) => m.x !== -1 && m.y !== -1).length ?? 0;
                    if (serverMoveCount === 0 && Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0) {
                        next = { ...next, moveHistory: parsed.moveHistory };
                    }
                    // 히든 영구 공개 목록: 서버에 없거나 비어있으면 sessionStorage에서 복원 (따냄/따임·상대 착수 시도 후 새로고침 시 반영)
                    const serverRevealed = next.permanentlyRevealedStones?.length ?? 0;
                    if (serverRevealed === 0 && Array.isArray(parsed.permanentlyRevealedStones) && parsed.permanentlyRevealedStones.length > 0) {
                        next = { ...next, permanentlyRevealedStones: parsed.permanentlyRevealedStones };
                    }
                    // 히든 착수 정보: 서버에 없거나 비어있으면 sessionStorage에서 복원 (히든 돌이 일반 돌로 보이는 현상 방지)
                    const hasServerHiddenMoves = next.hiddenMoves && Object.keys(next.hiddenMoves).length > 0;
                    if (!hasServerHiddenMoves && parsed.hiddenMoves && Object.keys(parsed.hiddenMoves).length > 0) {
                        next = { ...next, hiddenMoves: parsed.hiddenMoves };
                    }
                    // 히든 아이템 개수: 서버에 없으면 sessionStorage 값 사용
                    if ((next as any).hidden_stones_p1 == null && typeof parsed.hidden_stones_p1 === 'number') {
                        next = { ...next, hidden_stones_p1: parsed.hidden_stones_p1 } as any;
                    }
                    if ((next as any).hidden_stones_p2 == null && typeof parsed.hidden_stones_p2 === 'number') {
                        next = { ...next, hidden_stones_p2: parsed.hidden_stones_p2 } as any;
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
    }, [session, isSinglePlayer, isTower, hasStrategicTurnLimit, gameId]);
    
    // --- Mobile UI State (가로 모드에서는 PC와 동일 UI) ---
    const isMobile = useIsMobileLayout(1024);
    const isMobileSafeArea = useIsMobileLayout(768);
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
            case 'playing': case 'hidden_placing': case 'scanning': case 'missile_selecting': 
            case 'alkkagi_placement': case 'alkkagi_playing': case 'curling_playing':
            case 'dice_rolling': case 'dice_placing': case 'thief_rolling': case 'thief_placing':
                return myPlayerEnum !== Player.None && myPlayerEnum === currentPlayer;
            case 'base_placement': {
                 const myStones = currentUser.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
                 return (myStones?.length || 0) < (session.settings.baseStones || 4);
            }
            default: return false;
        }
    }, [myPlayerEnum, currentPlayer, gameStatus, isSpectator, session, currentUser.id, player1.id, session.settings]);
    
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

    const prevLastMove = usePrevious(session.lastMove);
    useEffect(() => {
        if (session.lastMove && session.lastMove.x !== -1 && JSON.stringify(session.lastMove) !== JSON.stringify(prevLastMove)) {
            const isGoBasedGame = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || 
                                  [GameMode.Omok, GameMode.Ttamok, GameMode.Dice, GameMode.Thief].includes(session.mode);
            if (isGoBasedGame) audioService.placeStone();
        }
    }, [session.lastMove, prevLastMove, session.mode]);
    
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
            }
        }
    }, [session.animation, session.gameStatus, prevAnimationType, justScanned]);

    useEffect(() => {
        const activeStartStatuses: GameStatus[] = [ 'playing', 'alkkagi_placement', 'alkkagi_simultaneous_placement', 'curling_playing', 'dice_rolling', 'thief_rolling' ];
        if (activeStartStatuses.includes(gameStatus) && (prevGameStatus === undefined || !activeStartStatuses.includes(prevGameStatus))) audioService.gameStart();
    }, [gameStatus, prevGameStatus]);

    useEffect(() => { return () => audioService.stopScanBgm(); }, []);

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
        if (moveIncreased || statusChanged) {
            setIsMoveInFlight(false);
        }
    }, [isMoveInFlight, session.moveHistory?.length, prevMoveCount, gameStatus, prevGameStatus]);


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

        if (isMobile && settings.features.mobileConfirm && isMyTurn && !isItemModeActive) {
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
                if (stoneAtTarget === opponentPlayerEnum) return;
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
                if (!moveResult.isValid) return;
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
                if (stoneAtTarget === opponentPlayerEnum) return;
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
                if (!moveResult.isValid) return;
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
                    // TODO: 에러 메시지를 사용자에게 표시 (코 금지, 자충수, 이미 돌이 놓인 자리 등)
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

        if (actionType) {
            console.log('[Game] Sending action:', { actionType, payload, isMyTurn, myPlayerEnum, currentPlayer, gameStatus });
            setIsMoveInFlight(true);
            handlers.handleAction({ type: actionType, payload } as ServerAction);
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
    }, [isSpectator, gameStatus, isMyTurn, gameId, handlers.handleAction, currentUser.id, player1.id, session.baseStones_p1, session.baseStones_p2, session.settings.baseStones, mode, isMobile, settings.features.mobileConfirm, pendingMove, isItemModeActive, session.isSinglePlayer, session.isAiGame, session.gameCategory, isPaused, isBoardLocked, restoredBoardState, session.boardState, session.moveHistory, isMoveInFlight, isTower, isSinglePlayer]);

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

        let actionType: ServerAction['type'] | null = null;
        let payload: any = { gameId, x, y };

        if ((mode === GameMode.Omok || mode === GameMode.Ttamok) && gameStatus === 'playing' && isMyTurn) {
            actionType = 'OMOK_PLACE_STONE';
        } else if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            actionType = 'PLACE_STONE';
            payload.isHidden = gameStatus === 'hidden_placing';
            payload.boardState = restoredBoardState || session.boardState;
            payload.moveHistory = session.moveHistory || [];
        }

        if (actionType) {
            setIsMoveInFlight(true);
            handlers.handleAction({ type: actionType, payload } as ServerAction);
        }
        setPendingMove(null);
    }, [pendingMove, gameId, handlers, gameStatus, isMyTurn, mode, session.boardState, session.moveHistory, restoredBoardState, isMoveInFlight]);

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
            // AI/일반 게임 종료 후 나가기 시 해당 종류의 대기실로 이동
            if (session.gameCategory === 'tower') {
                sessionStorage.setItem('postGameRedirect', '#/tower');
            } else if (session.isSinglePlayer) {
                sessionStorage.setItem('postGameRedirect', '#/singleplayer');
            } else {
                // 놀이바둑(컬링·알까기 등) → 놀이바둑 대기실, 전략바둑 → 전략바둑 대기실
                let waitingRoomMode: 'strategic' | 'playful' | null = null;
                if (SPECIAL_GAME_MODES.some(m => m.mode === session.mode)) {
                    waitingRoomMode = 'strategic';
                } else if (PLAYFUL_GAME_MODES.some(m => m.mode === session.mode)) {
                    waitingRoomMode = 'playful';
                }
                if (waitingRoomMode) {
                    sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
                }
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

    useEffect(() => {
        setIsPaused(false);
        setResumeCountdown(0);
        setPauseButtonCooldown(0);
        pauseStartedAtRef.current = null;
        clearPauseCountdown();
        // 게임이 변경되면 보드 잠금 상태 초기화
        setIsBoardLocked(false);
        setLastReceivedServerRevision(session.serverRevision ?? 0);
    }, [session.id, clearPauseCountdown, session.serverRevision]);

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
            
            // 보드 상태를 깊은 복사하여 계산 시점의 상태를 보존
            const boardStateToUse = restoredBoardState || session.boardState;
            const boardStateAtCalculation = JSON.parse(JSON.stringify(boardStateToUse));
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
                            
                            // 클라이언트에서 AI move 처리
                            const aiMoveResult = processMoveClient(
                                boardStateAtCalculation,
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
    }, [session.isSinglePlayer, session.gameCategory, isPaused, gameStatus, currentPlayer, session.blackPlayerId, session.whitePlayerId, restoredBoardState, session.koInfo, session.moveHistory?.length, session.settings.aiDifficulty, isBoardLocked, session.id, session.gameStatus, handlers.handleAction]);
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    
    const handleCloseResults = useCallback(() => {
        setShowResultModal(false);
        if (!session.analysisResult?.['system']) {
            setShowFinalTerritory(false);
        }
        // 도전의 탑·싱글플레이·놀이바둑 AI: "확인"은 모달만 닫고 경기장에 머물고, "나가기"에서만 퇴장 후 대기실로 이동
        const isTowerOrSingle = session.gameCategory === 'tower' || session.isSinglePlayer;
        const isPlayfulAiStayOnConfirm = session.isAiGame && PLAYFUL_GAME_MODES.some(m => m.mode === session.mode);
        if (isTowerOrSingle || isPlayfulAiStayOnConfirm) return;
        // 그 외(전략/놀이바둑 AI 대국 등): 경기 종료 후 결과 모달 "확인" 시 퇴장 + 해당 대기실로 이동
        if ((gameStatus === 'ended' || gameStatus === 'no_contest') && gameId) {
            const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const
                : PLAYFUL_GAME_MODES.some(m => m.mode === session.mode) ? 'playful' as const
                : null;
            if (waitingRoomMode) {
                sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
            }
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
    
    const gameProps: GameProps = {
        session: sessionWithRestoredBoard, onAction: handlers.handleAction, currentUser: currentUserWithStatus, waitingRoomChat: globalChat,
        gameChat: gameChat, isSpectator, onlineUsers, activeNegotiation, negotiations: Object.values(negotiations), onViewUser: handlers.openViewingUser
    };

    // AI 게임 일시 정지 관련 변수 (gameControlsProps보다 먼저 정의)
    const isPausableAiGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';

    const gameControlsProps = {
        session, isMyTurn, isSpectator, onAction: handlers.handleAction, setShowResultModal, setConfirmModalType, currentUser: currentUserWithStatus,
        onlineUsers, pendingMove, onConfirmMove: handleConfirmMove, onCancelMove: handleCancelMove, settings, isMobile,
        showResultModal,
        // AI 게임 일시 정지 관련 props
        isPaused: isPausableAiGame ? isPaused : undefined,
        resumeCountdown: isPausableAiGame ? resumeCountdown : undefined,
        pauseButtonCooldown: isPausableAiGame ? pauseButtonCooldown : undefined,
        onPauseToggle: isPausableAiGame ? handlePauseToggle : undefined,
        onOpenRematchSettings: (session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer')
            ? () => setIsAiRematchModalOpen(true)
            : undefined,
    };

    if (isSinglePlayer) {
        return (
            <div className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full bg-single-player-background text-stone-200`} style={{ height: '100dvh', maxHeight: '100dvh', paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>
                {showGameDescription && (
                    <SinglePlayerGameDescriptionModal 
                        session={sessionWithRestoredPatternStones}
                        onStart={handleStartGame}
                    />
                )}
                <Header />
                <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 overflow-hidden">
                    <main className="flex-1 flex items-center justify-center min-w-0 min-h-0">
                        <div className="w-full h-full max-h-full max-w-full lg:max-w-[calc(100vh-8rem)] flex flex-col items-center gap-1 lg:gap-2">
                            <div className="flex-shrink-0 w-full flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isSinglePlayer={true} isMobile={isMobile} />
                                </div>
                            </div>
                            <div className="flex-1 w-full relative">
                                <div className="absolute inset-0">
                                    <GameArena 
                                        {...gameProps}
                                        isMyTurn={isMyTurn} 
                                        myPlayerEnum={myPlayerEnum} 
                                        handleBoardClick={handleBoardClick} 
                                        isItemModeActive={isItemModeActive} 
                                        showTerritoryOverlay={showFinalTerritory} 
                                        isMobile={isMobile}
                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                        isSinglePlayerPaused={isPaused}
                                        resumeCountdown={resumeCountdown}
                                        isBoardLocked={isBoardLocked}
                                        isBoardRotated={isBoardRotated}
                                        onToggleBoardRotation={() => setIsBoardRotated(prev => !prev)}
                                    />
                                </div>
                            </div>
                            <div className="flex-shrink-0 w-full flex flex-col gap-1">
                                <TurnDisplay
                                    session={sessionWithRestoredPatternStones}
                                    isPaused={isPaused}
                                    isMobile={isMobile}
                                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                                    onAction={handlers.handleAction}
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
                />
            </div>
        );
    }

    if (isTower) {
        return (
            <div 
                className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full text-stone-200`}
                style={{
                    height: '100dvh',
                    maxHeight: '100dvh',
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
                <Header />
                <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 overflow-hidden">
                    <main className="flex-1 flex items-center justify-center min-w-0 min-h-0">
                        <div className="w-full h-full max-h-full max-w-full lg:max-w-[calc(100vh-8rem)] flex flex-col items-center gap-1 lg:gap-2">
                            <div className="flex-shrink-0 w-full flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isSinglePlayer={true} isMobile={isMobile} />
                                </div>
                            </div>
                            <div className="flex-1 w-full relative">
                                <div className="absolute inset-0">
                                <GameArena 
                                        {...gameProps}
                                        isMyTurn={isMyTurn} 
                                        myPlayerEnum={myPlayerEnum} 
                                        handleBoardClick={handleBoardClick} 
                                        isItemModeActive={isItemModeActive} 
                                        showTerritoryOverlay={showFinalTerritory} 
                                        isMobile={isMobile}
                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                        isSinglePlayerPaused={isPaused}
                                        resumeCountdown={resumeCountdown}
                                        isBoardLocked={isBoardLocked}
                                    />
                                </div>
                            </div>
                            <div className="flex-shrink-0 w-full flex flex-col gap-1">
                                <TurnDisplay
                                    session={sessionWithRestoredPatternStones}
                                    isPaused={isPaused}
                                    isMobile={isMobile}
                                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                                    onAction={handlers.handleAction}
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
                />
            </div>
        );
    }

    // PVP 게임 배경 이미지 결정
    const pvpBackgroundClass = useMemo(() => {
        if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
            return 'bg-strategic-background';
        }
        if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
            return 'bg-playful-background';
        }
        return 'bg-tertiary';
    }, [mode]);

    // AI 게임도 클라이언트 일시 정지 상태 사용 (싱글플레이어와 동일한 방식)
    // isPausableAiGame은 위에서 이미 정의됨
    const effectivePaused = (session.isSinglePlayer || isTower || isPausableAiGame) ? isPaused : false;

    return (
        <div className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full ${pvpBackgroundClass}`} style={{ height: '100dvh', maxHeight: '100dvh', paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>
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
            <Header />
            <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 overflow-hidden">
                <main className="flex-1 flex items-center justify-center min-w-0 min-h-0">
                    <div className="w-full h-full max-h-full max-w-full lg:max-w-[calc(100vh-8rem)] flex flex-col items-center gap-1 lg:gap-2">
                        <div className="flex-shrink-0 w-full flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isMobile={isMobile} />
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            <div className="absolute inset-0">
                                <div className={`w-full h-full transition-opacity duration-500 ${effectivePaused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                    <GameArena 
                                        {...gameProps}
                                        isMyTurn={isMyTurn} 
                                        myPlayerEnum={myPlayerEnum} 
                                        handleBoardClick={handleBoardClick} 
                                        isItemModeActive={isItemModeActive} 
                                        showTerritoryOverlay={showFinalTerritory} 
                                        isMobile={isMobile}
                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                        isBoardRotated={isBoardRotated}
                                        onToggleBoardRotation={() => setIsBoardRotated(prev => !prev)}
                                    />
                                </div>
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
                            {/* 계가 중: 바둑판 위 22초 연출만 표시 (모달 없음). 싱글/탑은 Arena에서 fullscreen 오버레이 표시 */}
                            {session.gameStatus === 'scoring' && !session.analysisResult?.['system'] && !session.isSinglePlayer && session.gameCategory !== 'tower' && (
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
                            />
                            <GameControls {...gameControlsProps} />
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
            />
        </div>
    );
};

export default Game;