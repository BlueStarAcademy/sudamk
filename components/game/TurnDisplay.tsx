import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveGameSession, Player, GameStatus, GameMode, User, ServerAction, AlkkagiStone } from '../../types.js';
import {
    PLAYFUL_GAME_MODES,
    DICE_GO_MAIN_PLACE_TIME,
    DICE_GO_MAIN_ROLL_TIME,
    DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS,
    ALKKAGI_PLACEMENT_TIME_LIMIT,
    ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT,
} from '../../constants';
import { audioService } from '../../services/audioService.js';
import { arenaGameRoomTurnDisplayBgClass } from './arenaGameRoomStyles.js';
import { getSessionPlayerDisplayName } from '../../utils/gameDisplayNames.js';
import { adventureEncounterCountdownUiActive } from '../../shared/utils/adventureEncounterUi.js';

const AI_HIDDEN_ITEM_MESSAGE = 'AI봇이 히든 아이템을 사용했습니다!';
const MONSTER_HIDDEN_ITEM_MESSAGE = '몬스터가 히든 아이템을 사용했습니다!';

function isAiOpponentHiddenNoticeMessage(msg: string | undefined): boolean {
    if (!msg) return false;
    return msg === AI_HIDDEN_ITEM_MESSAGE || msg === MONSTER_HIDDEN_ITEM_MESSAGE;
}

const BASE_PLACEMENT_TIME_LIMIT_SEC = 30;

interface TurnDisplayProps {
    session: LiveGameSession;
    isPaused?: boolean;
    isMobile?: boolean;
    onOpenSidebar?: () => void;
    sidebarNotification?: boolean;
    onAction?: (action: ServerAction) => void;
    /** 패(코) 등 규칙 안내 — 전광판 스타일로 잠시 표시 */
    boardRuleFlashMessage?: string | null;
    /** 알까기 배치 단계에서 (n/목표) 표시용 */
    viewerUserId?: string;
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
                return `${getSessionPlayerDisplayName(session, passingPlayer)}님이 통과했습니다.`;
            }
        }
    }

    switch (gameStatus) {
        case 'playing':
            return player ? `${getSessionPlayerDisplayName(session, player)}님의 차례입니다.` : '대국 진행 중';
        case 'nigiri_choosing':
        case 'nigiri_guessing':
        case 'nigiri_reveal':
            return '돌 가리기 진행 중...';
        case 'base_placement':
            return `베이스돌을 바둑판에 배치하세요. (각 ${settings.baseStones ?? 4}개)`;
        case 'komi_bidding':
            return '덤 설정 중...';
        case 'base_color_roulette':
            return '흑·백 룰렛으로 선공을 정하는 중입니다…';
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
            return `${getSessionPlayerDisplayName(session, player)}님 차례입니다. (${currentRound} / ${totalRounds} 라운드)`;
        }
        case 'alkkagi_round_end':
            return `라운드 종료 — 아래 전광판에서 확인·진행하세요.`;
        case 'dice_rolling':
             return player ? `${getSessionPlayerDisplayName(session, player)}님이 주사위를 굴릴 차례입니다.` : '주사위 굴릴 차례';
        case 'thief_rolling':
             return player ? `${getSessionPlayerDisplayName(session, player)}님이 주사위를 굴릴 차례입니다.` : '주사위 굴릴 차례';
        case 'curling_tiebreaker_preference_selection':
        case 'curling_tiebreaker_rps':
        case 'curling_tiebreaker_rps_reveal':
            return '승부치기 순서 결정 중...';
        case 'curling_tiebreaker_playing':
            return `승부치기 진행 중... (${getSessionPlayerDisplayName(session, player)}님 차례)`;
        default:
            if (mode === GameMode.Dice) return `주사위 바둑 (${session.round} / ${session.settings.diceGoRounds} 라운드)`;
            if (mode === GameMode.Thief) return `도둑과 경찰 (${session.round} 라운드)`;
            return player ? `${getSessionPlayerDisplayName(session, player)}님의 차례입니다.` : '게임 준비 중...';
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
    viewerUserId,
}) => {
    const [timeLeft, setTimeLeft] = useState(30);
    const [alkkagiPlacementSecondsLeft, setAlkkagiPlacementSecondsLeft] = useState(() =>
        session.mode === GameMode.Alkkagi &&
        (session.gameStatus === 'alkkagi_placement' || session.gameStatus === 'alkkagi_simultaneous_placement') &&
        session.alkkagiPlacementDeadline
            ? Math.max(0, Math.ceil((session.alkkagiPlacementDeadline - Date.now()) / 1000))
            : 0
    );
    const [alkkagiRoundEndSecLeft, setAlkkagiRoundEndSecLeft] = useState(0);
    const [percentage, setPercentage] = useState(100);
    const [foulMessage, setFoulMessage] = useState<string | null>(null);
    const [opponentHiddenTickerPulse, setOpponentHiddenTickerPulse] = useState(0);
    const prevTimeoutPlayerId = usePrevious(session.lastTimeoutPlayerId);
    const prevFoulInfoMessage = usePrevious(session.foulInfo?.message);
    const prevGameStatus = usePrevious(session.gameStatus);
    const [adventureEncSecLeft, setAdventureEncSecLeft] = useState<number | null>(null);

    useEffect(() => {
        const deadline = session.adventureEncounterDeadlineMs;
        if (!deadline || !adventureEncounterCountdownUiActive(session.gameCategory, session.gameStatus)) {
            setAdventureEncSecLeft(null);
            return;
        }
        const tick = () => {
            setAdventureEncSecLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        };
        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [session.gameCategory, session.gameStatus, session.adventureEncounterDeadlineMs, session.id]);

    const opponentAiHiddenTickerEnd = useMemo(() => {
        const aiHiddenAnimEnd = (session as any).aiHiddenItemAnimationEndTime as number | undefined;
        const hiddenNoticeFromFoul = isAiOpponentHiddenNoticeMessage(session.foulInfo?.message);
        if (session.animation?.type === 'ai_thinking' && aiHiddenAnimEnd != null) {
            return aiHiddenAnimEnd;
        }
        if (hiddenNoticeFromFoul && session.foulInfo?.expiry != null) {
            return session.foulInfo.expiry;
        }
        return null;
    }, [
        session.animation?.type,
        (session as any).aiHiddenItemAnimationEndTime,
        session.foulInfo?.message,
        session.foulInfo?.expiry,
    ]);

    const wantsOpponentHiddenTicker = useMemo(() => {
        const hiddenNoticeFromFoul = isAiOpponentHiddenNoticeMessage(session.foulInfo?.message);
        return (
            session.gameStatus === 'playing' &&
            opponentAiHiddenTickerEnd != null &&
            (session.animation?.type === 'ai_thinking' || hiddenNoticeFromFoul)
        );
    }, [session.gameStatus, opponentAiHiddenTickerEnd, session.animation?.type, session.foulInfo?.message]);

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
        const inAlkkagiPlacement =
            session.mode === GameMode.Alkkagi &&
            (session.gameStatus === 'alkkagi_placement' || session.gameStatus === 'alkkagi_simultaneous_placement') &&
            session.alkkagiPlacementDeadline;
        if (!inAlkkagiPlacement) {
            setAlkkagiPlacementSecondsLeft(0);
            return;
        }
        const tick = () => {
            const sec = Math.max(0, Math.ceil((session.alkkagiPlacementDeadline! - Date.now()) / 1000));
            setAlkkagiPlacementSecondsLeft(sec);
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [session.mode, session.gameStatus, session.alkkagiPlacementDeadline]);

    useEffect(() => {
        if (session.mode !== GameMode.Alkkagi || session.gameStatus !== 'alkkagi_round_end' || !session.revealEndTime) {
            setAlkkagiRoundEndSecLeft(0);
            return;
        }
        const tick = () => {
            setAlkkagiRoundEndSecLeft(Math.max(0, Math.ceil((session.revealEndTime! - Date.now()) / 1000)));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [session.mode, session.gameStatus, session.revealEndTime]);

    const isBasePlacementScoreboard =
        session.gameStatus === 'base_placement' &&
        (session.mode === GameMode.Base ||
            (session.mode === GameMode.Mix && Boolean(session.settings.mixedModes?.includes(GameMode.Base))));

    const [basePlacementSecondsLeft, setBasePlacementSecondsLeft] = useState(0);

    useEffect(() => {
        if (!isBasePlacementScoreboard || !session.basePlacementDeadline) {
            setBasePlacementSecondsLeft(0);
            return;
        }
        const tick = () => {
            setBasePlacementSecondsLeft(Math.max(0, Math.ceil((session.basePlacementDeadline! - Date.now()) / 1000)));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [isBasePlacementScoreboard, session.basePlacementDeadline]);

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
        if (!session.foulInfo || session.foulInfo.message === prevFoulInfoMessage) return;
        const msg = session.foulInfo.message;
        if (isAiOpponentHiddenNoticeMessage(msg)) {
            return;
        }
        setFoulMessage(msg);
        audioService.timeoutFoul();
        const timer = setTimeout(() => setFoulMessage(null), 5000);
        return () => clearTimeout(timer);
    }, [session.foulInfo, prevFoulInfoMessage]);

    useEffect(() => {
        if (session.lastTimeoutPlayerId && session.lastTimeoutPlayerId !== prevTimeoutPlayerId) {
            const isFoulMode = PLAYFUL_GAME_MODES.some(m => m.mode === session.mode);
            if (isFoulMode) {
                 const foulPlayer = session.player1.id === session.lastTimeoutPlayerId ? session.player1 : session.player2;
                 setFoulMessage(`${getSessionPlayerDisplayName(session, foulPlayer)}님의 타임오버 파울!`);
                 const timer = setTimeout(() => setFoulMessage(null), 5000);
                 return () => clearTimeout(timer);
            }
        }
    }, [
        session.lastTimeoutPlayerId,
        prevTimeoutPlayerId,
        session.mode,
        session.player1,
        session.player2,
        session.gameCategory,
        session.isAiGame,
        session.adventureMonsterCodexId,
    ]);
    
    useEffect(() => {
        const resetStatuses: GameStatus[] = [
            'playing',
            'ended',
            'no_contest',
            'alkkagi_playing',
            'curling_playing',
            'dice_rolling',
            'dice_placing',
            'thief_rolling',
            'thief_placing',
        ];
        if (prevGameStatus === undefined || prevGameStatus === session.gameStatus) return;
        if (resetStatuses.includes(session.gameStatus)) {
            setFoulMessage(null);
        }
    }, [session.gameStatus, prevGameStatus]);

    useEffect(() => {
        if (!wantsOpponentHiddenTicker) return;
        const id = setInterval(() => setOpponentHiddenTickerPulse((n) => n + 1), 250);
        return () => clearInterval(id);
    }, [wantsOpponentHiddenTicker, opponentAiHiddenTickerEnd]);

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
        isMobile ? 'min-h-[2.6rem] px-1.5 py-1' : 'min-h-[3.25rem] py-2 px-3 min-[1025px]:min-h-[3.5rem] min-[1025px]:px-4'
    }`;
    const themeClasses = isSinglePlayer
        ? 'bg-stone-800/85 backdrop-blur-sm border-stone-600/55'
        : `${arenaGameRoomTurnDisplayBgClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_28px_-14px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-amber-500/15`;
    const textClass = isSinglePlayer
        ? 'text-amber-100'
        : 'text-amber-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]';

    const showSidebarButton = Boolean(isMobile && onOpenSidebar);
    const paddingClass = showSidebarButton ? 'pr-[2.85rem] sm:pr-[3.5rem] md:pr-14' : '';

    const sidebarToggle = showSidebarButton ? (
        <button
            type="button"
            onClick={onOpenSidebar}
            className={`group absolute top-1/2 right-1.5 z-10 flex h-[2.85rem] w-[2.65rem] -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-l-2xl border border-r-0 border-white/18 bg-gradient-to-br from-white/[0.14] via-white/[0.05] to-black/45 backdrop-blur-md shadow-[0_10px_36px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.25)] transition-all duration-300 ease-out hover:scale-[1.03] hover:border-white/28 hover:shadow-[0_14px_44px_rgba(0,0,0,0.52)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:hover:scale-100 sm:h-[3.375rem] sm:w-[3rem] sm:gap-1 ${
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

    void opponentHiddenTickerPulse;
    const showOpponentAiHiddenMarquee =
        wantsOpponentHiddenTicker &&
        opponentAiHiddenTickerEnd != null &&
        Date.now() < opponentAiHiddenTickerEnd;

    if (boardRuleFlashMessage) {
        return wrapContent(
            `${baseClasses} ${themeClasses} ${isMobile ? 'gap-1 px-2 min-h-[2.5rem]' : 'gap-1.5 px-4 min-h-[3rem]'} border-2 border-amber-400/55`,
            <div
                className={`w-full overflow-hidden flex-shrink-0 relative flex items-center justify-center ${isMobile ? 'min-h-[1.15rem]' : 'min-h-[1.5rem]'}`}
            >
                <div
                    className={`font-bold tracking-wider text-center px-1 text-amber-100 ${
                        isMobile ? 'text-[clamp(0.62rem,2vmin,0.72rem)] leading-tight' : 'text-[clamp(0.8rem,2.5vmin,1rem)]'
                    }`}
                    style={{
                        textShadow: '0 0 10px rgba(251, 191, 36, 0.55), 0 0 18px rgba(251, 191, 36, 0.3)',
                    }}
                >
                    {boardRuleFlashMessage}
                </div>
            </div>
        );
    }

    if (showOpponentAiHiddenMarquee) {
        const hiddenNoticeFromFoul = isAiOpponentHiddenNoticeMessage(session.foulInfo?.message);
        const headline =
            hiddenNoticeFromFoul && session.foulInfo?.message
                ? session.foulInfo.message
                : session.gameCategory === 'adventure' || session.adventureMonsterCodexId
                  ? MONSTER_HIDDEN_ITEM_MESSAGE
                  : AI_HIDDEN_ITEM_MESSAGE;
        // AI/몬스터 히든 연출: 전광판은 카운트다운·막대 없이 안내만 (연출 시간은 바둑판 패널 테두리로 표시)
        return wrapContent(
            `${baseClasses} ${themeClasses} border-2 border-amber-400/50 ${isMobile ? 'gap-1 px-2 min-h-[2.45rem]' : 'gap-1.5 px-4 min-h-[3rem]'}`,
            <div
                className={`w-full flex-shrink-0 overflow-hidden flex items-center justify-center ${
                    isMobile ? 'min-h-[1.15rem] py-0.5' : 'min-h-[1.5rem]'
                }`}
            >
                <div
                    className={`flex items-center justify-center text-center font-bold ${textClass} tracking-wider ${
                        isMobile
                            ? 'px-0.5 text-[clamp(0.58rem,1.85vmin,0.68rem)] leading-tight whitespace-normal'
                            : 'text-[clamp(0.8rem,2.5vmin,1rem)]'
                    }`}
                    style={{
                        textShadow: '0 0 8px rgba(255, 255, 255, 0.5), 0 0 16px rgba(255, 255, 255, 0.3)',
                    }}
                >
                    {headline}
                </div>
            </div>
        );
    }

    if (foulMessage) {
        return wrapContent(
            `flex-shrink-0 bg-danger rounded-lg flex items-center justify-center shadow-inner animate-pulse border-2 border-red-500 ${
                isMobile ? 'py-0.5 min-h-[2.25rem]' : 'py-1 h-12'
            }`,
            <p
                className={`px-1 text-center font-bold text-white tracking-wider ${
                    isMobile ? 'text-[clamp(0.65rem,2.2vmin,0.8rem)] leading-tight' : 'text-[clamp(0.875rem,3vmin,1.125rem)]'
                }`}
            >
                {foulMessage}
            </p>
        );
    }
    
    if (
        session.mode === GameMode.Alkkagi &&
        (session.gameStatus === 'alkkagi_placement' || session.gameStatus === 'alkkagi_simultaneous_placement')
    ) {
        const target = session.settings.alkkagiStoneCount || 5;
        const round = session.alkkagiRound || 1;
        const totalRounds = session.settings.alkkagiRounds || 1;
        const isSimultaneous = session.gameStatus === 'alkkagi_simultaneous_placement';
        const guidance = isSimultaneous
            ? round > 1
                ? `부족한 돌을 배치하세요. (${round} / ${totalRounds} 라운드)`
                : `상대에게 보이지 않게 돌을 배치하세요. (${round} / ${totalRounds} 라운드)`
            : round > 1
              ? `돌을 다시 배치하세요. (${round} / ${totalRounds} 라운드)`
              : `돌을 배치하세요. (${round} / ${totalRounds} 라운드)`;
        const placed =
            viewerUserId && session.alkkagiStonesPlacedThisRound
                ? session.alkkagiStonesPlacedThisRound[viewerUserId] ?? 0
                : null;
        const limitSec = isSimultaneous ? ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT : ALKKAGI_PLACEMENT_TIME_LIMIT;
        const hasDeadline = Boolean(session.alkkagiPlacementDeadline);
        const secLeft = hasDeadline ? alkkagiPlacementSecondsLeft : null;
        const barPct =
            hasDeadline && secLeft !== null ? Math.min(100, Math.max(0, (secLeft / limitSec) * 100)) : null;
        const subLine =
            placed !== null
                ? `배치 ${placed}/${target}${hasDeadline && secLeft !== null ? ` · 남은 시간 ${secLeft}초` : ''}`
                : hasDeadline && secLeft !== null
                  ? `남은 시간 ${secLeft}초`
                  : null;

        return wrapContent(
            `${baseClasses} ${themeClasses} min-w-0 ${isMobile ? 'gap-1 px-2 min-h-[2.5rem]' : 'gap-1.5 px-3 min-h-[3rem]'}`,
            <>
                <div className="flex w-full flex-col items-center justify-center gap-0.5 min-w-0 sm:gap-1">
                    <div
                        className={`w-full overflow-hidden flex-shrink-0 relative flex items-center justify-center px-0.5 ${isMobile ? 'min-h-[1.1rem]' : 'min-h-[1.35rem]'}`}
                    >
                        <p
                            className={`font-bold ${textClass} text-center leading-snug tracking-wide ${
                                isMobile ? 'text-[clamp(0.58rem,1.65vmin,0.68rem)]' : 'text-[clamp(0.68rem,1.9vmin,0.82rem)]'
                            }`}
                            style={{
                                textShadow: isSinglePlayer
                                    ? '0 0 8px rgba(251, 191, 36, 0.35)'
                                    : '0 0 8px rgba(255, 255, 255, 0.35), 0 0 14px rgba(255, 255, 255, 0.15)',
                            }}
                        >
                            {guidance}
                        </p>
                    </div>
                    {subLine && (
                        <p
                            className={`text-center font-semibold text-amber-200/90 ${
                                isMobile ? 'text-[clamp(0.55rem,1.5vmin,0.65rem)]' : 'text-[clamp(0.62rem,1.7vmin,0.75rem)]'
                            }`}
                        >
                            {subLine}
                        </p>
                    )}
                </div>
                {barPct !== null && (
                    <div
                        className={`relative mt-0.5 w-full flex-shrink-0 overflow-hidden rounded-full border-2 ${
                            isSinglePlayer ? 'border-black/20 bg-stone-900/70' : 'border-tertiary bg-tertiary'
                        } ${isMobile ? 'h-1 border' : 'h-[clamp(0.5rem,1.5vh,0.75rem)] border-2'}`}
                    >
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300"
                            style={{ width: `${barPct}%`, transition: 'width 0.35s linear' }}
                        />
                    </div>
                )}
            </>
        );
    }

    if (session.mode === GameMode.Alkkagi && session.gameStatus === 'alkkagi_round_end' && session.alkkagiRoundSummary) {
        const summary = session.alkkagiRoundSummary;
        const { player1, player2, blackPlayerId, whitePlayerId, id: gameId, alkkagiStones, roundEndConfirmations, settings } = session;
        const winnerUser = player1.id === summary.winnerId ? player1 : player2;
        const p1Enum = player1.id === blackPlayerId ? Player.Black : Player.White;
        const p2Enum = player2.id === blackPlayerId ? Player.Black : Player.White;
        const p1StonesLeft =
            alkkagiStones?.filter((s: AlkkagiStone) => s.player === p1Enum && s.onBoard).length ?? 0;
        const p2StonesLeft =
            alkkagiStones?.filter((s: AlkkagiStone) => s.player === p2Enum && s.onBoard).length ?? 0;
        const hasConfirmed = viewerUserId ? !!roundEndConfirmations?.[viewerUserId] : false;
        const nextRound = summary.round + 1;
        const totalRounds = settings?.alkkagiRounds || 1;
        const barPct =
            session.revealEndTime != null
                ? Math.min(100, Math.max(0, (alkkagiRoundEndSecLeft / 30) * 100))
                : null;
        const autoHint =
            nextRound > totalRounds
                ? `최종 결과 자동 표시까지 ${alkkagiRoundEndSecLeft}초`
                : `다음 라운드 자동 시작까지 ${alkkagiRoundEndSecLeft}초`;

        return wrapContent(
            `${baseClasses} ${themeClasses} min-w-0 ${isMobile ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-3 py-2'}`,
            <>
                <div className="flex w-full min-w-0 flex-col items-center gap-1">
                    <p
                        className={`text-center font-bold leading-snug ${textClass} ${
                            isMobile ? 'text-[clamp(0.6rem,1.7vmin,0.78rem)]' : 'text-sm min-[1025px]:text-base'
                        }`}
                        style={{
                            textShadow: isSinglePlayer
                                ? '0 0 8px rgba(251, 191, 36, 0.35)'
                                : '0 0 8px rgba(255, 255, 255, 0.35), 0 0 14px rgba(255, 255, 255, 0.15)',
                        }}
                    >
                        {summary.round}라운드 — {getSessionPlayerDisplayName(session, winnerUser)}님 승리
                    </p>
                    <p
                        className={`w-full text-center font-semibold leading-snug text-amber-200/90 [overflow-wrap:anywhere] ${
                            isMobile ? 'text-[clamp(0.55rem,1.55vmin,0.72rem)]' : 'text-xs min-[1025px]:text-sm'
                        }`}
                    >
                        {getSessionPlayerDisplayName(session, player1)} 남은 돌 {p1StonesLeft}개 ·{' '}
                        {getSessionPlayerDisplayName(session, player2)} 남은 돌 {p2StonesLeft}개
                    </p>
                    {viewerUserId && onAction && (
                        <button
                            type="button"
                            onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId } })}
                            disabled={hasConfirmed}
                            className={`mt-0.5 w-full max-w-sm rounded-lg border font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-55 ${
                                isSinglePlayer
                                    ? 'border-amber-500/45 bg-amber-700/35 px-2 py-1.5 text-amber-50 hover:bg-amber-600/35'
                                    : 'border-cyan-400/40 bg-cyan-900/40 px-2 py-1.5 text-cyan-50 hover:bg-cyan-800/45'
                            } ${isMobile ? 'text-[11px]' : 'text-sm'}`}
                        >
                            {hasConfirmed
                                ? '상대방 확인 대기 중…'
                                : nextRound > totalRounds
                                  ? '최종 결과 확인'
                                  : '다음 라운드 시작'}
                        </button>
                    )}
                    {session.revealEndTime != null && (
                        <p
                            className={`text-center font-medium text-slate-400 ${
                                isMobile ? 'text-[10px]' : 'text-[11px]'
                            }`}
                        >
                            {autoHint}
                        </p>
                    )}
                </div>
                {barPct !== null && (
                    <div
                        className={`relative mt-0.5 w-full flex-shrink-0 overflow-hidden rounded-full border-2 ${
                            isSinglePlayer ? 'border-black/20 bg-stone-900/70' : 'border-tertiary bg-tertiary'
                        } ${isMobile ? 'h-1 border' : 'h-[clamp(0.45rem,1.4vh,0.65rem)] border-2'}`}
                    >
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-lime-400"
                            style={{ width: `${barPct}%`, transition: 'width 0.35s linear' }}
                        />
                    </div>
                )}
            </>
        );
    }

    if (session.mode === GameMode.Dice && session.gameStatus === 'dice_placing' && session.dice) {
        const diceGuidance = '상대보다 더 많은 돌을 따내기 위해 돌을 놓아보세요.';
        return wrapContent(
            `${baseClasses} ${themeClasses} min-w-0 ${isMobile ? 'gap-1 px-2 min-h-[2.5rem]' : 'gap-1.5 px-3 min-h-[3rem]'}`,
            <>
                <div className="flex w-full flex-col items-center justify-center gap-0.5 min-w-0 sm:gap-1">
                    <div
                        className={`w-full overflow-hidden flex-shrink-0 relative flex items-center justify-center px-0.5 ${isMobile ? 'min-h-[1.1rem]' : 'min-h-[1.35rem]'}`}
                    >
                        <p
                            className={`font-bold ${textClass} text-center leading-snug tracking-wide ${
                                isMobile ? 'text-[clamp(0.58rem,1.65vmin,0.68rem)]' : 'text-[clamp(0.68rem,1.9vmin,0.82rem)]'
                            }`}
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
                    <div className="mt-0.5 h-0.5 w-full flex-shrink-0 rounded-full bg-tertiary sm:h-1">
                        <div className="h-full rounded-full bg-red-500" style={{ width: `${percentage}%` }} />
                    </div>
                )}
            </>
        );
    }

    if (session.mode === GameMode.Thief && session.gameStatus === 'thief_placing' && session.dice) {
        const { dice1, dice2 } = session.dice;
        const diceDisplay = dice2 > 0 ? `${dice1}, ${dice2}` : `${dice1}`;
        const thiefLabel = isMobile ? 'text-[clamp(0.62rem,1.9vmin,0.72rem)]' : 'text-[clamp(0.75rem,2.2vmin,0.95rem)]';
        const thiefValue = isMobile ? 'text-[clamp(0.68rem,2vmin,0.78rem)]' : 'text-[clamp(0.85rem,2.5vmin,1rem)]';
        return wrapContent(
            `${baseClasses} ${themeClasses} min-w-0 ${isMobile ? 'gap-0.5 px-2' : 'gap-1 px-3'}`,
            <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden sm:gap-1.5">
                <span className={`shrink-0 whitespace-nowrap font-bold text-tertiary ${thiefLabel}`}>
                    주사위: <span className={`${textClass} ${thiefValue}`}>{diceDisplay}</span>
                </span>
                <span className={`text-tertiary/70 shrink-0 ${isSinglePlayer ? 'text-stone-500' : ''}`}>·</span>
                <span className={`shrink-0 whitespace-nowrap font-bold text-tertiary ${thiefLabel}`}>
                    남은 착수: <span className={`${textClass} ${thiefValue}`}>{Math.max(0, session.stonesToPlace ?? 0)}</span>
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
            `${baseClasses} ${themeClasses} ${isMobile ? 'gap-1 px-2 min-h-[2.45rem]' : 'gap-1.5 px-4 min-h-[3rem]'}`,
            <>
                {/* 전광판 스타일 텍스트 */}
                <div
                    className={`w-full flex-shrink-0 overflow-hidden ${
                        isMobile
                            ? 'flex min-h-[1.15rem] items-center justify-center py-0.5'
                            : 'relative h-6'
                    }`}
                >
                    <div
                        className={`flex items-center justify-center text-center font-bold ${textClass} tracking-wider ${
                            isMobile
                                ? 'px-0.5 text-[clamp(0.58rem,1.85vmin,0.68rem)] leading-tight whitespace-normal'
                                : 'absolute inset-0 whitespace-nowrap text-[clamp(0.8rem,2.5vmin,1rem)]'
                        }`}
                        style={{
                            textShadow: '0 0 8px rgba(255, 255, 255, 0.5), 0 0 16px rgba(255, 255, 255, 0.3)',
                        }}
                    >
                        <span className={isMobile ? 'inline' : 'inline-block'}>{tickerText}</span>
                    </div>
                </div>
                <div
                    className={`relative w-full flex-shrink-0 overflow-hidden rounded-full border-2 ${isSinglePlayer ? 'border-black/20 bg-stone-900/70' : 'border-tertiary bg-tertiary'} ${
                        isMobile ? 'h-1 border' : 'h-[clamp(0.5rem,1.5vh,0.75rem)] border-2'
                    }`}
                >
                    <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300"
                        style={{ width: `${percentage}%`, transition: 'width 0.5s linear' }}
                    />
                </div>
            </>
        );
    }

    if (isBasePlacementScoreboard) {
        const baseStoneCount = session.settings.baseStones ?? 4;
        const { player1, player2 } = session;
        const myPlacements =
            viewerUserId === player1.id
                ? session.baseStones_p1?.length ?? 0
                : viewerUserId === player2.id
                  ? session.baseStones_p2?.length ?? 0
                  : null;
        const isDonePlacing = myPlacements !== null && myPlacements >= baseStoneCount;
        const hasDeadline = Boolean(session.basePlacementDeadline);
        const secLeft = hasDeadline ? basePlacementSecondsLeft : null;
        const barPct =
            hasDeadline && secLeft !== null
                ? Math.min(100, Math.max(0, (secLeft / BASE_PLACEMENT_TIME_LIMIT_SEC) * 100))
                : null;
        const isAdventureVsAi = session.gameCategory === 'adventure' && session.isAiGame;

        let primaryLine: string;
        if (viewerUserId == null) {
            primaryLine = '플레이어들이 베이스돌을 배치하고 있습니다.';
        } else if (isDonePlacing) {
            primaryLine = '배치 완료 · 상대 배치 대기 중…';
        } else if (myPlacements !== null) {
            const hint = isAdventureVsAi
                ? '베이스돌을 바둑판에 놓으세요'
                : '상대에게 보이지 않게 베이스돌을 바둑판에 놓으세요';
            const parts = [hint, `배치 ${myPlacements}/${baseStoneCount}`];
            if (hasDeadline && secLeft !== null) parts.push(`남은 시간 ${secLeft}초`);
            primaryLine = parts.join(' · ');
        } else {
            primaryLine = '플레이어들이 베이스돌을 배치하고 있습니다.';
        }

        const showPlacementTools = Boolean(viewerUserId && onAction && myPlacements !== null);
        const canRandomFill = showPlacementTools && myPlacements! < baseStoneCount;
        const canResetOrUndo = showPlacementTools && myPlacements! > 0;
        const btnBase = `flex-1 min-w-[5.25rem] rounded-lg border px-1.5 py-1.5 text-center text-[10px] font-bold transition-colors sm:min-w-0 sm:px-2 sm:text-xs ${
            isSinglePlayer
                ? 'border-amber-500/50 bg-amber-900/40 text-amber-50 hover:bg-amber-800/45'
                : 'border-cyan-400/45 bg-cyan-950/50 text-cyan-50 hover:bg-cyan-900/45'
        }`;

        return wrapContent(
            `${baseClasses} ${themeClasses} min-w-0 ${isMobile ? 'gap-1 px-2 min-h-[2.5rem]' : 'gap-1.5 px-3 min-h-[3rem]'}`,
            <>
                <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 sm:gap-1">
                    <div
                        className={`w-full min-w-0 overflow-x-auto overflow-y-hidden flex-shrink-0 [scrollbar-width:thin] ${isMobile ? 'min-h-[1.15rem]' : 'min-h-[1.35rem]'}`}
                    >
                        <p
                            className={`whitespace-nowrap text-center font-bold tracking-wide ${textClass} ${
                                isMobile ? 'text-[clamp(0.58rem,1.65vmin,0.68rem)]' : 'text-[clamp(0.68rem,1.9vmin,0.82rem)]'
                            }`}
                            style={{
                                textShadow: isSinglePlayer
                                    ? '0 0 8px rgba(251, 191, 36, 0.35)'
                                    : '0 0 8px rgba(255, 255, 255, 0.35), 0 0 14px rgba(255, 255, 255, 0.15)',
                            }}
                        >
                            {primaryLine}
                        </p>
                    </div>
                </div>
                {barPct !== null && (
                    <div
                        className={`relative mt-0.5 w-full flex-shrink-0 overflow-hidden rounded-full border-2 ${
                            isSinglePlayer ? 'border-black/20 bg-stone-900/70' : 'border-tertiary bg-tertiary'
                        } ${isMobile ? 'h-1 border' : 'h-[clamp(0.5rem,1.5vh,0.75rem)] border-2'}`}
                    >
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300"
                            style={{ width: `${barPct}%`, transition: 'width 0.35s linear' }}
                        />
                    </div>
                )}
                {showPlacementTools && (canRandomFill || canResetOrUndo) && (
                    <div className="mt-1 flex w-full max-w-lg flex-wrap items-stretch justify-center gap-1 self-center">
                        {canRandomFill && (
                            <button
                                type="button"
                                onClick={() =>
                                    onAction!({ type: 'PLACE_REMAINING_BASE_STONES_RANDOMLY', payload: { gameId: session.id } })
                                }
                                className={btnBase}
                            >
                                남은 돌 무작위 배치
                            </button>
                        )}
                        {canResetOrUndo && (
                            <>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onAction!({ type: 'RESET_MY_BASE_STONE_PLACEMENTS', payload: { gameId: session.id } })
                                    }
                                    className={btnBase}
                                >
                                    재배치
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onAction!({ type: 'UNDO_LAST_BASE_STONE_PLACEMENT', payload: { gameId: session.id } })
                                    }
                                    className={btnBase}
                                >
                                    마지막 취소
                                </button>
                            </>
                        )}
                    </div>
                )}
            </>
        );
    }
    
    const statusText = getGameStatusText(session);

    const statusTextShadow = isSinglePlayer
        ? { textShadow: '0 0 12px rgba(251, 191, 36, 0.35), 0 1px 2px rgba(0,0,0,0.85)' }
        : { textShadow: '0 0 14px rgba(251, 191, 36, 0.45), 0 1px 3px rgba(0,0,0,0.95)' };

    const advEncLine = null;

    return wrapContent(
        `${baseClasses} ${themeClasses}`,
        <>
            {advEncLine && (
                <p
                    className={`text-center font-extrabold tracking-wide text-rose-200/95 ${
                        isMobile
                            ? 'px-0.5 text-[0.625rem] leading-tight sm:text-xs'
                            : 'px-2 text-[clamp(0.78rem,2.3vmin,0.95rem)] min-[1025px]:text-[clamp(0.85rem,2vmin,1.02rem)]'
                    }`}
                    style={{ textShadow: '0 0 10px rgba(251,113,133,0.45), 0 1px 2px rgba(0,0,0,0.9)' }}
                >
                    {advEncLine}
                </p>
            )}
            <p
                className={`text-center font-bold tracking-wider ${textClass} ${
                    isMobile
                        ? 'px-0.5 text-[0.6875rem] leading-tight sm:text-sm sm:leading-snug'
                        : 'px-2 text-[clamp(0.88rem,2.7vmin,1.08rem)] min-[1025px]:text-[clamp(0.95rem,2.2vmin,1.15rem)]'
                }`}
                style={statusTextShadow}
            >
                {statusText}
            </p>
            {isPlayfulTurn && (
                <div className="mt-0.5 h-0.5 w-11/12 rounded-full bg-tertiary sm:mt-1 sm:h-1">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${percentage}%` }} />
                </div>
            )}
        </>
    );
};

export default TurnDisplay;