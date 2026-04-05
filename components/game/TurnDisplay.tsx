import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveGameSession, Player, GameStatus, GameMode, User, ServerAction } from '../../types.js';
import { PLAYFUL_GAME_MODES, DICE_GO_MAIN_PLACE_TIME, DICE_GO_MAIN_ROLL_TIME, DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS } from '../../constants';
import { audioService } from '../../services/audioService.js';

const AI_HIDDEN_ITEM_MESSAGE = 'AI봇이 히든 아이템을 사용했습니다!';

interface TurnDisplayProps {
    session: LiveGameSession;
    isPaused?: boolean;
    isMobile?: boolean;
    onOpenSidebar?: () => void;
    sidebarNotification?: boolean;
    onAction?: (action: ServerAction) => void;
    /** 패(코) 등 규칙 안내 — 전광판 스타일로 잠시 표시 */
    boardRuleFlashMessage?: string | null;
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const getGameStatusText = (session: LiveGameSession): string => {
    const { gameStatus, currentPlayer, blackPlayerId, whitePlayerId, player1, player2, mode, settings, passCount, moveHistory, alkkagiRound } = session;

    const getPlayerByEnum = (playerEnum: Player): User | null => {
        const targetId = playerEnum === Player.Black ? blackPlayerId : whitePlayerId;
        if (!targetId) return null;
        return player1.id === targetId ? player1 : player2;
    };

    const player = getPlayerByEnum(currentPlayer);

    if (
        session.mode === GameMode.Dice &&
        session.diceGoOvershotTicker &&
        (gameStatus === 'dice_rolling' || gameStatus === 'dice_rolling_animating')
    ) {
        const { maxDice, lastCaptureBonus } = session.diceGoOvershotTicker;
        const totalRounds = settings.diceGoRounds ?? 1;
        let message =
            maxDice > 0
                ? `오버샷! 주사위가 ${maxDice} 이하여야 마지막 더미를 따낼 수 있습니다.`
                : `오버샷! 지금은 백의 유효 자리가 없어 마지막 더미를 따낼 수 없습니다. 다음 굴림을 기다려 주세요.`;
        if (session.round === totalRounds && totalRounds > 0 && lastCaptureBonus > 0) {
            message += ` (마지막 더미 보너스 +${lastCaptureBonus}점)`;
        }
        return message;
    }

    if (session.mode === GameMode.Dice && session.lastWhiteGroupInfo && session.lastWhiteGroupInfo.liberties <= 6) {
        const totalRounds = session.settings.diceGoRounds ?? 1;
        let message = `마지막 승부! 유효자리 ${session.lastWhiteGroupInfo.liberties}개`;
        if (session.round === totalRounds && totalRounds > 0) {
            const bonus = DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS[totalRounds - 1];
            if (bonus) {
                message += ` (마지막 포획 보너스 +${bonus}점)`;
            }
        }
        return message;
    }

    const lastMoveInHistory = moveHistory && moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;
    
    // 싱글플레이어 게임에서는 통과 기능이 없으므로 통과 텍스트를 표시하지 않음
    const isSinglePlayer = session.isSinglePlayer || session.gameCategory === 'singleplayer';
    
    if (!isSinglePlayer) {
        if (passCount >= 2 && lastMoveInHistory?.x === -1) {
            return "양측 모두 통과하여 계가를 시작합니다.";
        }

        if (gameStatus !== 'ended' && passCount === 1 && lastMoveInHistory?.x === -1) {
            const opponentOfCurrent = currentPlayer === Player.Black ? Player.White : Player.Black;
            const passingPlayer = getPlayerByEnum(opponentOfCurrent);
            if (passingPlayer) {
                return `${passingPlayer.nickname}님이 통과했습니다.`;
            }
        }
    }

    switch (gameStatus) {
        case 'playing':
            return player ? `${player.nickname}님의 차례입니다.` : '대국 진행 중';
        case 'nigiri_choosing':
        case 'nigiri_guessing':
        case 'nigiri_reveal':
            return '돌 가리기 진행 중...';
        case 'base_placement':
            return `베이스돌 배치 중... (${settings.baseStones}개)`;
        case 'komi_bidding':
            return '덤 설정 중...';
        case 'ended':
            return '대국 종료';
        case 'no_contest':
            return '무효 대국';
        case 'rematch_pending':
            return '재대결 대기 중...';
        case 'hidden_placing':
        case 'scanning':
        case 'missile_selecting':
            return '아이템 사용 중...';
        case 'hidden_final_reveal':
            return "모든 히든돌을 공개하고 계가를 시작합니다.";
        case 'scoring': {
            const limit = (settings as any)?.scoringTurnLimit ?? (settings as any)?.autoScoringTurns;
            const isOnlineStrategic =
                !isSinglePlayer &&
                session.gameCategory !== 'tower' &&
                mode !== GameMode.Capture &&
                typeof limit === 'number' &&
                limit > 0;
            if (isOnlineStrategic) {
                return '자동계가 수순에 도달하여 계가를 진행합니다.';
            }
            return '계가를 진행합니다.';
        }
        case 'alkkagi_placement': {
            const currentRound = alkkagiRound || 1;
            const totalRounds = settings.alkkagiRounds || 1;
            if (currentRound > 1) {
                return `돌을 다시 배치하세요. (${currentRound} / ${totalRounds} 라운드)`;
            }
            return `돌을 배치하세요. (${currentRound} / ${totalRounds} 라운드)`;
        }
        case 'alkkagi_playing': {
            const currentRound = alkkagiRound || 1;
            const totalRounds = settings.alkkagiRounds || 1;
            return `${player?.nickname}님 차례입니다. (${currentRound} / ${totalRounds} 라운드)`;
        }
        case 'alkkagi_round_end':
            return `라운드 종료! 결과를 확인하세요.`;
        case 'dice_rolling':
             return player ? `${player.nickname}님이 주사위를 굴릴 차례입니다.` : '주사위 굴릴 차례';
        case 'thief_rolling':
             return player ? `${player.nickname}님이 주사위를 굴릴 차례입니다.` : '주사위 굴릴 차례';
        case 'curling_tiebreaker_preference_selection':
        case 'curling_tiebreaker_rps':
        case 'curling_tiebreaker_rps_reveal':
            return '승부치기 순서 결정 중...';
        case 'curling_tiebreaker_playing':
            return `승부치기 진행 중... (${player?.nickname}님 차례)`;
        default:
            if (mode === GameMode.Dice) return `주사위 바둑 (${session.round} / ${session.settings.diceGoRounds} 라운드)`;
            if (mode === GameMode.Thief) return `도둑과 경찰 (${session.round} 라운드)`;
            return player ? `${player.nickname}님의 차례입니다.` : '게임 준비 중...';
    }
};

const TurnDisplay: React.FC<TurnDisplayProps> = ({
    session,
    isPaused = false,
    isMobile = false,
    onOpenSidebar,
    sidebarNotification = false,
    onAction,
    boardRuleFlashMessage = null,
}) => {
    const [timeLeft, setTimeLeft] = useState(30);
    const [percentage, setPercentage] = useState(100);
    const [foulMessage, setFoulMessage] = useState<string | null>(null);
    const prevTimeoutPlayerId = usePrevious(session.lastTimeoutPlayerId);
    const prevFoulInfoMessage = usePrevious(session.foulInfo?.message);

    /** 주사위/도둑 PVP만 전광판 하단 턴 타이머 막대 표시. AI 대국은 카운트다운·막대 없음 */
    const isPlayfulTurn = useMemo(() => {
        if (session.isAiGame && (session.mode === GameMode.Dice || session.mode === GameMode.Thief)) {
            return false;
        }
        return (
            PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode) &&
            session.turnDeadline &&
            session.turnStartTime &&
            ['dice_rolling', 'dice_placing', 'thief_rolling', 'thief_placing'].includes(session.gameStatus)
        );
    }, [session.mode, session.turnDeadline, session.turnStartTime, session.gameStatus, session.isAiGame]);

    useEffect(() => {
        if (!isPlayfulTurn) {
            setPercentage(100);
            return;
        }

        if (isPaused) {
            return;
        }

        const totalDuration = session.turnDeadline! - session.turnStartTime!;
        if (totalDuration <= 0) return;

        const updateBar = () => {
            const remaining = session.turnDeadline! - Date.now();
            const newPercentage = Math.max(0, (remaining / totalDuration) * 100);
            setPercentage(newPercentage);
        };

        updateBar();
        const interval = setInterval(updateBar, 100);
        return () => clearInterval(interval);
    }, [isPlayfulTurn, session.turnDeadline, session.turnStartTime, isPaused]);


    useEffect(() => {
        if (session.foulInfo && session.foulInfo.message !== prevFoulInfoMessage) {
            setFoulMessage(session.foulInfo.message);
            audioService.timeoutFoul();
            const timer = setTimeout(() => setFoulMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [session.foulInfo, prevFoulInfoMessage]);

    useEffect(() => {
        if (foulMessage !== AI_HIDDEN_ITEM_MESSAGE) return;
        const isUserTurnAfterAiHiddenMove = session.gameStatus === 'playing' && session.currentPlayer === Player.Black;
        if (isUserTurnAfterAiHiddenMove) {
            setFoulMessage(null);
        }
    }, [foulMessage, session.gameStatus, session.currentPlayer]);

    useEffect(() => {
        if (session.lastTimeoutPlayerId && session.lastTimeoutPlayerId !== prevTimeoutPlayerId) {
            const isFoulMode = PLAYFUL_GAME_MODES.some(m => m.mode === session.mode);
            if (isFoulMode) {
                 const foulPlayer = session.player1.id === session.lastTimeoutPlayerId ? session.player1 : session.player2;
                 setFoulMessage(`${foulPlayer.nickname}님의 타임오버 파울!`);
                 const timer = setTimeout(() => setFoulMessage(null), 5000);
                 return () => clearTimeout(timer);
            }
        }
    }, [session.lastTimeoutPlayerId, prevTimeoutPlayerId, session.mode, session.player1, session.player2]);
    
    useEffect(() => {
        // Reset foul message when moving to a new turn/phase to prevent it from persisting.
        const resetStatuses: GameStatus[] = [
            'playing', 'ended', 'no_contest', // Strategic/General
            'alkkagi_playing', 'curling_playing', 'dice_rolling', 'dice_placing', 'thief_rolling', 'thief_placing' // Playful
        ];
    
        if (resetStatuses.includes(session.gameStatus)) {
            setFoulMessage(null);
        }
    }, [session.gameStatus]);

    const isItemMode = ['hidden_placing', 'scanning', 'missile_selecting'].includes(session.gameStatus);

    const prevTimeLeft = useRef<number>(30);
    
    useEffect(() => {
        if (!isItemMode || !session.itemUseDeadline || isPaused) {
            setTimeLeft(30); // Reset to default when not in item mode
            prevTimeLeft.current = 30;
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((session.itemUseDeadline! - now) / 1000));
            const clampedRemaining = Math.min(30, Math.max(0, remaining)); // 0-30초 범위로 제한
            
            // 0초가 되면 초읽기 효과음 재생 (싱글플레이·AI 대국은 초읽기 소리 없음)
            if (clampedRemaining === 0 && prevTimeLeft.current > 0 && !session.isSinglePlayer && !session.isAiGame) {
                audioService.timerWarning();
            }
            prevTimeLeft.current = clampedRemaining;
            
            // 상태 업데이트 (항상 업데이트하여 막대그래프가 작동하도록)
            setTimeLeft(clampedRemaining);
            
            // 아이템 시간이 초과되었는데 게임 상태가 여전히 아이템 모드인 경우
            // 서버의 게임 루프가 자동으로 처리하므로 클라이언트에서 추가 통신 불필요
            // WebSocket으로 상태 업데이트가 자동으로 전파됨
        };

        updateTimer();
        const timerId = setInterval(updateTimer, 500);

        return () => clearInterval(timerId);
    }, [isItemMode, session.itemUseDeadline, isPaused, session.gameStatus, onAction, session.id]);

    const isSinglePlayer = session.isSinglePlayer;
    const baseClasses = `flex-shrink-0 rounded-lg flex flex-col items-center justify-center border shadow-inner ${
        isMobile ? 'min-h-[3.25rem] px-2 py-1.5' : 'h-12 py-1'
    }`;
    const themeClasses = isSinglePlayer 
        ? "bg-stone-800/70 backdrop-blur-sm border-stone-700/50" 
        : "bg-secondary border-color";
    const textClass = isSinglePlayer ? "text-amber-300" : "text-highlight";

    const showSidebarButton = Boolean(isMobile && onOpenSidebar);
    const paddingClass = showSidebarButton ? 'pr-[3.5rem] sm:pr-14' : '';

    const sidebarToggle = showSidebarButton ? (
        <button
            type="button"
            onClick={onOpenSidebar}
            className={`group absolute top-1/2 right-1.5 z-10 flex h-[3.375rem] w-[3rem] -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-l-2xl border border-r-0 border-white/18 bg-gradient-to-br from-white/[0.14] via-white/[0.05] to-black/45 backdrop-blur-md shadow-[0_10px_36px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.25)] transition-all duration-300 ease-out hover:scale-[1.03] hover:border-white/28 hover:shadow-[0_14px_44px_rgba(0,0,0,0.52)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                isSinglePlayer
                    ? 'hover:from-amber-400/18 hover:via-stone-900/82 hover:to-stone-950 hover:border-amber-400/35'
                    : 'hover:from-cyan-400/14 hover:via-slate-900/88 hover:to-slate-950 hover:border-cyan-400/32'
            }`}
            aria-label="메뉴 열기"
        >
            <div
                className={`flex flex-col gap-[5px] rounded-lg bg-black/40 px-2 py-1.5 ring-1 ring-inset transition-[box-shadow] duration-300 ${
                    isSinglePlayer
                        ? 'ring-amber-400/18 group-hover:ring-amber-300/40 group-hover:shadow-[0_0_16px_-4px_rgba(251,191,36,0.35)]'
                        : 'ring-cyan-400/12 group-hover:ring-cyan-300/35 group-hover:shadow-[0_0_16px_-4px_rgba(34,211,238,0.28)]'
                }`}
                aria-hidden
            >
                <span className="h-[2px] w-[1.05rem] rounded-full bg-gradient-to-r from-white to-white/55 shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
                <span className="h-[2px] w-[1.05rem] rounded-full bg-gradient-to-r from-white to-white/55 shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
                <span className="h-[2px] w-[1.05rem] rounded-full bg-gradient-to-r from-white to-white/55 shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
            </div>
            <span
                className={`text-[8px] font-bold uppercase tracking-[0.18em] text-white/50 transition-colors duration-300 ${
                    isSinglePlayer ? 'group-hover:text-amber-100/95' : 'group-hover:text-cyan-100/95'
                }`}
            >
                메뉴
            </span>
            {sidebarNotification && (
                <span className="absolute right-1 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white/90 bg-gradient-to-br from-rose-400 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.85)] ring-2 ring-red-500/40 animate-pulse" />
            )}
        </button>
    ) : null;

    const wrapContent = (containerClass: string, content: React.ReactNode) => (
        <div className="relative w-full">
            <div className={`${containerClass} ${paddingClass}`}>
                {content}
            </div>
            {sidebarToggle}
        </div>
    );

    if (boardRuleFlashMessage) {
        return wrapContent(
            `${baseClasses} ${themeClasses} px-4 gap-1.5 min-h-[3rem] border-2 border-amber-400/55`,
            <div className="w-full overflow-hidden flex-shrink-0 relative min-h-[1.5rem] flex items-center justify-center">
                <div
                    className={`font-bold tracking-wider text-[clamp(0.8rem,2.5vmin,1rem)] text-center px-1 text-amber-100`}
                    style={{
                        textShadow: '0 0 10px rgba(251, 191, 36, 0.55), 0 0 18px rgba(251, 191, 36, 0.3)',
                    }}
                >
                    {boardRuleFlashMessage}
                </div>
            </div>
        );
    }
    
    if (foulMessage) {
        return wrapContent(
            "flex-shrink-0 bg-danger rounded-lg flex items-center justify-center shadow-inner animate-pulse py-1 h-12 border-2 border-red-500",
            <p className="font-bold text-white tracking-wider text-[clamp(0.875rem,3vmin,1.125rem)]">{foulMessage}</p>
        );
    }
    
    if (session.mode === GameMode.Dice && session.gameStatus === 'dice_placing' && session.dice) {
        const diceGuidance = '상대보다 더 많은 돌을 따내기 위해 돌을 놓아보세요.';
        return wrapContent(
            `${baseClasses} ${themeClasses} px-3 gap-1.5 min-w-0 min-h-[3rem]`,
            <>
                <div className="flex w-full flex-col items-center justify-center gap-1 min-w-0">
                    <div className="w-full overflow-hidden flex-shrink-0 relative min-h-[1.35rem] flex items-center justify-center px-0.5">
                        <p
                            className={`font-bold ${textClass} text-center text-[clamp(0.68rem,1.9vmin,0.82rem)] leading-snug tracking-wide`}
                            style={{
                                textShadow: isSinglePlayer
                                    ? '0 0 8px rgba(251, 191, 36, 0.35)'
                                    : '0 0 8px rgba(255, 255, 255, 0.35), 0 0 14px rgba(255, 255, 255, 0.15)',
                            }}
                        >
                            {diceGuidance}
                        </p>
                    </div>
                </div>
                {isPlayfulTurn && (
                    <div className="w-full h-1 bg-tertiary rounded-full mt-0.5 flex-shrink-0">
                        <div className="h-1 bg-red-500 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                )}
            </>
        );
    }

    if (session.mode === GameMode.Thief && session.gameStatus === 'thief_placing' && session.dice) {
        const { dice1, dice2 } = session.dice;
        const diceDisplay = dice2 > 0 ? `${dice1}, ${dice2}` : `${dice1}`;
        return wrapContent(
            `${baseClasses} ${themeClasses} px-3 gap-1 min-w-0`,
            <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
                <span className={`font-bold text-tertiary text-[clamp(0.75rem,2.2vmin,0.95rem)] whitespace-nowrap shrink-0`}>
                    주사위: <span className={`${textClass} text-[clamp(0.85rem,2.5vmin,1rem)]`}>{diceDisplay}</span>
                </span>
                <span className={`text-tertiary/70 shrink-0 ${isSinglePlayer ? 'text-stone-500' : ''}`}>·</span>
                <span className={`font-bold text-tertiary text-[clamp(0.75rem,2.2vmin,0.95rem)] whitespace-nowrap shrink-0`}>
                    남은 착수: <span className={`${textClass} text-[clamp(0.85rem,2.5vmin,1rem)]`}>{Math.max(0, session.stonesToPlace ?? 0)}</span>
                </span>
            </div>
        );
    }

    if (isItemMode) {
        let itemText = "아이템 사용시간";
        if (session.gameStatus === 'hidden_placing') itemText = "히든 사용시간";
        if (session.gameStatus === 'scanning') itemText = "스캔 사용시간";
        if (session.gameStatus === 'missile_selecting') {
            itemText = "발사할 바둑돌을 선택하세요. 선택후 방향을 선택하면 날아갑니다.";
        }

        const percentage = Math.max(0, Math.min(100, (timeLeft / 30) * 100));
        
        // 전광판 스타일로 아이템 사용시간 표시
        const tickerText = `${itemText} ${timeLeft}초`;

        return wrapContent(
            `${baseClasses} ${themeClasses} px-4 gap-1.5 min-h-[3rem]`,
            <>
                {/* 전광판 스타일 텍스트 */}
                <div className="w-full overflow-hidden flex-shrink-0 relative h-6">
                    <div 
                        className={`font-bold ${textClass} tracking-wider text-[clamp(0.8rem,2.5vmin,1rem)] whitespace-nowrap absolute inset-0 flex items-center justify-center`}
                        style={{
                            textShadow: '0 0 8px rgba(255, 255, 255, 0.5), 0 0 16px rgba(255, 255, 255, 0.3)'
                        }}
                    >
                        <span className="inline-block">{tickerText}</span>
                    </div>
                </div>
                <div className={`w-full rounded-full h-[clamp(0.5rem,1.5vh,0.75rem)] relative overflow-hidden border-2 ${isSinglePlayer ? 'bg-stone-900/70 border-black/20' : 'bg-tertiary border-tertiary'} flex-shrink-0`}>
                    <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300"
                        style={{ width: `${percentage}%`, transition: 'width 0.5s linear' }}
                    />
                </div>
            </>
        );
    }
    
    const statusText = getGameStatusText(session);

    return wrapContent(
        `${baseClasses} ${themeClasses}`,
        <>
            <p
                className={`text-center font-bold tracking-wider ${textClass} ${
                    isMobile ? 'text-sm leading-snug sm:text-base' : 'px-2 text-[clamp(0.8rem,2.5vmin,1rem)]'
                }`}
            >
                {statusText}
            </p>
            {isPlayfulTurn && (
                <div className="w-11/12 h-1 bg-tertiary rounded-full mt-1">
                    <div className="h-1 bg-red-500 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
            )}
        </>
    );
};

export default TurnDisplay;