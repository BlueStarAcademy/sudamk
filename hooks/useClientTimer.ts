import { useState, useEffect, useRef } from 'react';
// FIX: Import missing types from the centralized types file.
import { LiveGameSession, Player, GameCategory } from '../types/index.js';
import { aiUserId } from '../constants/index.js';
import { isFischerStyleTimeControl } from '../shared/utils/gameTimeControl.js';

interface ClientTimerOptions {
    isPaused?: boolean;
}

export const useClientTimer = (session: LiveGameSession, options: ClientTimerOptions = {}) => {
    const coerce = (v: any) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
    // 게임이 pending 상태이고 시간이 없으면 설정에서 기본값 가져오기
    const defaultTime = session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0;
    const initialBlackTime = session.gameStatus === 'pending' && !session.blackTimeLeft ? defaultTime : coerce(session.blackTimeLeft);
    const initialWhiteTime = session.gameStatus === 'pending' && !session.whiteTimeLeft ? defaultTime : coerce(session.whiteTimeLeft);
    const [clientTimes, setClientTimes] = useState({ black: initialBlackTime, white: initialWhiteTime });
    /** 현재 턴에서 사용 중인 마감 시각(ms). 서버 timeLeft가 더 작게 와도 뒤로 점프하지 않도록 유지 */
    const deadlineRef = useRef<{ deadline: number; player: Player; gameId: string } | null>(null);
    /** 제한시간 0 직후 클라이언트에서 즉시 쓰는 초읽기 마감 시각(ms). 서버 GAME_UPDATE 전에 카운트다운이 이어지도록 */
    const byoyomiDeadlineRef = useRef<{ deadline: number; player: Player; gameId: string } | null>(null);

    useEffect(() => {
        const isGameEnded = ['ended', 'no_contest', 'scoring'].includes(session.gameStatus);
        if (isGameEnded) {
            setClientTimes({ black: coerce(session.blackTimeLeft), white: coerce(session.whiteTimeLeft) });
            return;
        }

        const isAnimating = session.animation !== null && session.animation !== undefined;
        const isAnimationStatus = ['missile_animating', 'scanning_animating', 'hidden_reveal_animating', 'curling_animating', 'alkkagi_animating'].includes(session.gameStatus);
        
        if (isAnimating || isAnimationStatus) {
            // 애니메이션 중에는 pausedTurnTimeLeft를 사용하여 시간을 멈춤
            // pausedTurnTimeLeft가 있으면 그 값을 사용, 없으면 현재 시간 유지
            if (session.pausedTurnTimeLeft !== undefined) {
                const currentPlayer = session.currentPlayer;
                if (currentPlayer === Player.Black) {
                    setClientTimes(prev => ({
                        black: session.pausedTurnTimeLeft!,
                        white: prev.white
                    }));
                } else if (currentPlayer === Player.White) {
                    setClientTimes(prev => ({
                        black: prev.black,
                        white: session.pausedTurnTimeLeft!
                    }));
                }
            }
            // 애니메이션 중에는 시간 업데이트를 하지 않음 (현재 시간 유지)
            return;
        }

        const playingStatuses = ['playing', 'hidden_placing'];
        const now = Date.now();

        // 대국 시작 전(베이스·덤·니기리 등): 서버 값으로만 표시. 싱글/탑 일시정지(isPaused)보다 먼저 동기화
        const preStartStatuses = [
            'pending',
            'base_placement',
            'base_game_start_confirmation',
            'nigiri_reveal',
            'color_start_confirmation',
        ];
        if (preStartStatuses.includes(session.gameStatus)) {
            // 이전 턴의 deadline 문맥이 남아 있으면 카운트다운이 재개될 수 있어 초기화
            deadlineRef.current = null;
            byoyomiDeadlineRef.current = null;
            // 서버 시간이 있으면 그대로, 없으면 설정 기본값 사용
            const defaultTime = session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0;
            const blackTime = session.blackTimeLeft ? coerce(session.blackTimeLeft) : defaultTime;
            const whiteTime = session.whiteTimeLeft ? coerce(session.whiteTimeLeft) : defaultTime;
            setClientTimes({ black: blackTime, white: whiteTime });
            return;
        }

        if (options.isPaused) {
            // 수동 일시정지(싱글/탑/모험·로비 AI 등 UI 플래그)에서는 클라이언트 타이머를 완전히 멈춘다.
            const cp = session.currentPlayer;
            if (cp === Player.Black || cp === Player.White) {
                const fromServerPause =
                    session.pausedTurnTimeLeft !== undefined ? coerce(session.pausedTurnTimeLeft) : undefined;
                const frozen =
                    fromServerPause !== undefined
                        ? fromServerPause
                        : cp === Player.Black
                          ? coerce(session.blackTimeLeft)
                          : coerce(session.whiteTimeLeft);
                setClientTimes((prev) =>
                    cp === Player.Black ? { black: frozen, white: prev.white } : { black: prev.black, white: frozen },
                );
            }
            return;
        }

        // 수동 일시정지(일반 AI 대국 포함): 서버가 turnDeadline을 비운 상태에서
        // 클라이언트가 가상 deadline을 생성해 시간을 계속 깎는 것을 방지한다.
        const isManuallyPaused =
            session.pausedTurnTimeLeft !== undefined &&
            !session.turnDeadline &&
            !session.itemUseDeadline &&
            playingStatuses.includes(session.gameStatus) &&
            (session.currentPlayer === Player.Black || session.currentPlayer === Player.White);
        if (isManuallyPaused) {
            deadlineRef.current = null;
            byoyomiDeadlineRef.current = null;
            setClientTimes(prev => session.currentPlayer === Player.Black
                ? { black: session.pausedTurnTimeLeft!, white: prev.white }
                : { black: prev.black, white: session.pausedTurnTimeLeft! });
            return;
        }

        // 히든/미사일 등 아이템 사용 시간은 유저 시간에서 제외한다.
        // (스피드+믹스에서 아이템 사용 중 AI 시간보너스 추정치가 오르지 않도록 정지)
        const isItemTimerPaused =
            session.pausedTurnTimeLeft !== undefined &&
            !session.turnDeadline &&
            typeof session.itemUseDeadline === 'number' &&
            session.itemUseDeadline > now &&
            (session.currentPlayer === Player.Black || session.currentPlayer === Player.White);
        if (isItemTimerPaused) {
            deadlineRef.current = null;
            byoyomiDeadlineRef.current = null;
            setClientTimes(prev => session.currentPlayer === Player.Black
                ? { black: session.pausedTurnTimeLeft!, white: prev.white }
                : { black: prev.black, white: session.pausedTurnTimeLeft! });
            return;
        }

        let baseDeadline = session.turnDeadline
            || session.alkkagiTurnDeadline
            || session.curlingTurnDeadline
            || session.alkkagiPlacementDeadline
            || session.turnChoiceDeadline
            || session.guessDeadline
            || session.basePlacementDeadline
            || session.baseColorChoiceDeadline
            || session.komiBiddingDeadline
            || session.captureBidDeadline;
            // || session.itemUseDeadline; // 아이템 사용시간은 선수패널에 표시하지 않음

        const curPlayer = session.currentPlayer;

        // 모험 AI 대국: 턴당 마감은 유저에게만 적용 — 클라이언트에서 몬스터 턴에도 카운트다운하지 않음
        if (
            session.isAiGame &&
            session.gameCategory === GameCategory.Adventure &&
            playingStatuses.includes(session.gameStatus)
        ) {
            deadlineRef.current = null;
            byoyomiDeadlineRef.current = null;
            setClientTimes({
                black: coerce(session.blackTimeLeft),
                white: coerce(session.whiteTimeLeft),
            });
            return;
        }

        // AI 대국(대기실·길드전·싱글/탑 등 전부): AI 차례에는 클라이언트 데드라인으로 유저 시간이 줄어들지 않도록 서버 값만 표시
        const hasAiPlayer =
            session.blackPlayerId === aiUserId || session.whitePlayerId === aiUserId;
        const aiIsBlack = session.blackPlayerId === aiUserId;
        const aiIsWhite = session.whitePlayerId === aiUserId;
        const isAiTurnNow =
            (session.currentPlayer === Player.Black && aiIsBlack) ||
            (session.currentPlayer === Player.White && aiIsWhite);
        if (playingStatuses.includes(session.gameStatus) && hasAiPlayer && isAiTurnNow) {
            deadlineRef.current = null;
            byoyomiDeadlineRef.current = null;
            setClientTimes({
                black: coerce(session.blackTimeLeft),
                white: coerce(session.whiteTimeLeft),
            });
            return;
        }

        // 턴/게임이 바뀌면 이전 턴 기준 마감 ref·초읽기 ref 초기화
        if (deadlineRef.current && (deadlineRef.current.gameId !== session.id || deadlineRef.current.player !== curPlayer)) {
            deadlineRef.current = null;
        }
        if (byoyomiDeadlineRef.current && (byoyomiDeadlineRef.current.gameId !== session.id || byoyomiDeadlineRef.current.player !== curPlayer)) {
            byoyomiDeadlineRef.current = null;
        }

        const defaultTimeForTurn = session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0;
        const serverTimeLeft = curPlayer === Player.Black
            ? (session.blackTimeLeft != null ? coerce(session.blackTimeLeft) : defaultTimeForTurn)
            : (session.whiteTimeLeft != null ? coerce(session.whiteTimeLeft) : defaultTimeForTurn);

        const isFischer = isFischerStyleTimeControl(session as any);
        const byoyomiTimeSec = (session.settings?.byoyomiTime ?? 0) as number;
        const byoyomiPeriodsLeft = curPlayer === Player.Black
            ? (session.blackByoyomiPeriodsLeft ?? session.settings?.byoyomiCount ?? 0)
            : (session.whiteByoyomiPeriodsLeft ?? session.settings?.byoyomiCount ?? 0);
        const hasByoyomi = !isFischer && byoyomiTimeSec > 0 && byoyomiPeriodsLeft > 0;

        // turnDeadline이 없을 때: 서버 timeLeft로 마감 시각 생성. 단, 이미 더 여유 있는 ref가 있으면 뒤로 점프하지 않음
        if (!baseDeadline && playingStatuses.includes(session.gameStatus) && (curPlayer === Player.Black || curPlayer === Player.White)) {
            if (serverTimeLeft > 0) {
                const fromRef = deadlineRef.current?.gameId === session.id && deadlineRef.current?.player === curPlayer
                    ? deadlineRef.current.deadline
                    : null;
                const refRemaining = fromRef != null && fromRef > now ? (fromRef - now) / 1000 : 0;
                if (fromRef != null && fromRef > now && refRemaining > serverTimeLeft) {
                    baseDeadline = fromRef; // 서버가 더 작게 와도 표시만 연속 유지
                } else {
                    baseDeadline = now + serverTimeLeft * 1000;
                    deadlineRef.current = { deadline: baseDeadline, player: curPlayer, gameId: session.id };
                }
            } else if (hasByoyomi) {
                // 제한시간이 0이 된 직후: 서버 업데이트를 기다리지 않고 즉시 초읽기 마감 시각 설정 → 카운트다운 연속 표시
                baseDeadline = now + byoyomiTimeSec * 1000;
                deadlineRef.current = { deadline: baseDeadline, player: curPlayer, gameId: session.id };
            }
        }
        // turnDeadline이 이미 지났을 때: 서버 timeLeft로 보정. 마찬가지로 뒤로 점프 방지
        if (baseDeadline && baseDeadline < now && playingStatuses.includes(session.gameStatus) && (curPlayer === Player.Black || curPlayer === Player.White)) {
            if (serverTimeLeft > 0) {
                const fromRef = deadlineRef.current?.gameId === session.id && deadlineRef.current?.player === curPlayer
                    ? deadlineRef.current.deadline
                    : null;
                const refRemaining = fromRef != null && fromRef > now ? (fromRef - now) / 1000 : 0;
                if (fromRef != null && fromRef > now && refRemaining > serverTimeLeft) {
                    baseDeadline = fromRef;
                } else {
                    baseDeadline = now + serverTimeLeft * 1000;
                    deadlineRef.current = { deadline: baseDeadline, player: curPlayer, gameId: session.id };
                }
            } else if (hasByoyomi) {
                // 제한시간 0 → 초읽기 전환: 마감이 지났고 메인도 0이면 즉시 초읽기 구간으로 이어서 카운트다운
                baseDeadline = now + byoyomiTimeSec * 1000;
                deadlineRef.current = { deadline: baseDeadline, player: curPlayer, gameId: session.id };
            }
        }

        // 서버에서 내려준 미래 turnDeadline이 있으면 그걸 기준으로 하고 ref 갱신 (풀 시간 반영)
        if (baseDeadline && baseDeadline > now && (curPlayer === Player.Black || curPlayer === Player.White)) {
            deadlineRef.current = { deadline: baseDeadline, player: curPlayer, gameId: session.id };
        }

        if (!baseDeadline) {
            // deadline이 없으면 서버 시간 사용, 없으면 설정에서 기본값 사용
            // 단, 현재 클라이언트 시간이 서버 시간보다 작으면 클라이언트 시간 유지 (제한시간 모드)
            const defaultTime = session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0;
            const serverBlackTime = session.blackTimeLeft ? coerce(session.blackTimeLeft) : defaultTime;
            const serverWhiteTime = session.whiteTimeLeft ? coerce(session.whiteTimeLeft) : defaultTime;
            
            // 클라이언트 시간이 서버 시간보다 작으면 클라이언트 시간 유지 (시간이 흐르고 있는 중)
            setClientTimes(prev => ({
                black: serverBlackTime > 0 && prev.black > 0 && prev.black < serverBlackTime ? prev.black : serverBlackTime,
                white: serverWhiteTime > 0 && prev.white > 0 && prev.white < serverWhiteTime ? prev.white : serverWhiteTime
            }));
            return;
        }

        const isSharedDeadlinePhase = [
            'base_placement',
            'base_stone_color_choice',
            'base_same_color_points_bid',
            'capture_bidding',
            'alkkagi_simultaneous_placement'
        ].includes(session.gameStatus);
        
        let animationFrameId: number;

        const updateTimer = () => {
            const nowInLoop = Date.now();
            let newTimeLeft = Math.max(0, (baseDeadline - nowInLoop) / 1000);

            // 제한시간이 0이 된 직후: 서버 업데이트 없이 즉시 초읽기 마감으로 이어서 카운트다운 (베이스·덤 등 공유 마감 단계는 제외)
            if (
                newTimeLeft <= 0 &&
                hasByoyomi &&
                !isSharedDeadlinePhase &&
                (curPlayer === Player.Black || curPlayer === Player.White)
            ) {
                const existing = byoyomiDeadlineRef.current?.gameId === session.id && byoyomiDeadlineRef.current?.player === curPlayer
                    ? byoyomiDeadlineRef.current
                    : null;
                if (!existing) {
                    const byoyomiDeadline = nowInLoop + byoyomiTimeSec * 1000;
                    byoyomiDeadlineRef.current = { deadline: byoyomiDeadline, player: curPlayer, gameId: session.id };
                    newTimeLeft = byoyomiTimeSec;
                } else {
                    newTimeLeft = Math.max(0, (existing.deadline - nowInLoop) / 1000);
                }
            }

            // 피셔 방식 확인
            const isFischer = isFischerStyleTimeControl(session as any);
            
            if (isSharedDeadlinePhase) {
                setClientTimes({ black: newTimeLeft, white: newTimeLeft });
            } else if (session.currentPlayer === Player.Black) {
                // 흑의 턴: 흑은 deadline 기반, 백은 서버 시간 사용
                const serverWhiteTime = session.whiteTimeLeft ? coerce(session.whiteTimeLeft) : (session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0);
                // 피셔 방식이면 백의 시간도 서버 시간 직접 사용 (수를 두지 않았으므로)
                // 피셔 방식이 아니면 백의 시간도 서버 시간 직접 사용 (턴이 바뀌었으므로)
                setClientTimes(prev => ({
                    black: newTimeLeft,
                    white: serverWhiteTime
                }));
            } else if (session.currentPlayer === Player.White) {
                // 백의 턴: 백은 deadline 기반, 흑은 서버 시간 사용
                const serverBlackTime = session.blackTimeLeft ? coerce(session.blackTimeLeft) : (session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0);
                // 피셔 방식이면 흑의 시간도 서버 시간 직접 사용 (수를 두지 않았으므로)
                // 피셔 방식이 아니면 흑의 시간도 서버 시간 직접 사용 (턴이 바뀌었으므로)
                setClientTimes(prev => ({
                    black: serverBlackTime,
                    white: newTimeLeft
                }));
            } else {
                // 턴이 없는 경우: 서버 시간 사용 (피셔 방식이면 직접 사용)
                const defaultTime = session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0;
                const serverBlackTime = session.blackTimeLeft ? coerce(session.blackTimeLeft) : defaultTime;
                const serverWhiteTime = session.whiteTimeLeft ? coerce(session.whiteTimeLeft) : defaultTime;
                setClientTimes(prev => ({
                    black: isFischer ? serverBlackTime : (serverBlackTime > 0 && prev.black > 0 && prev.black < serverBlackTime ? prev.black : serverBlackTime),
                    white: isFischer ? serverWhiteTime : (serverWhiteTime > 0 && prev.white > 0 && prev.white < serverWhiteTime ? prev.white : serverWhiteTime)
                }));
            }
            animationFrameId = requestAnimationFrame(updateTimer);
        };

        animationFrameId = requestAnimationFrame(updateTimer);
        return () => cancelAnimationFrame(animationFrameId);
    }, [
        session.turnDeadline,
        session.alkkagiTurnDeadline,
        session.curlingTurnDeadline,
        session.alkkagiPlacementDeadline,
        session.turnChoiceDeadline,
        session.guessDeadline,
        session.basePlacementDeadline,
        session.baseColorChoiceDeadline,
        session.komiBiddingDeadline,
        session.captureBidDeadline,
        session.itemUseDeadline,
        session.currentPlayer,
        session.blackTimeLeft,
        session.whiteTimeLeft,
        session.blackByoyomiPeriodsLeft,
        session.whiteByoyomiPeriodsLeft,
        session.gameStatus,
        session.animation,
        session.pausedTurnTimeLeft,
        session.id,
        session.settings?.timeLimit,
        session.settings?.byoyomiTime,
        session.settings?.byoyomiCount,
        session.mode,
        session.settings?.mixedModes,
        session.isSinglePlayer,
        session.gameCategory,
        session.blackPlayerId,
        session.whitePlayerId,
        options.isPaused,
    ]);

    return { clientTimes };
};
