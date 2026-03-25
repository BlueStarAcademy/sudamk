import { useState, useEffect, useRef } from 'react';
// FIX: Import missing types from the centralized types file.
import { LiveGameSession, Player } from '../types/index.js';
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

        if (options.isPaused) {
            // Keep the current displayed times while paused
            return;
        }

        // 애니메이션 중에는 시간이 멈춰있어야 함 (애니메이션 종료 후에 시간이 흘러가도록)
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

        // pending 상태의 게임은 시간이 흐르지 않도록 함
        if (session.gameStatus === 'pending') {
            // pending 상태에서는 설정에서 기본값 사용
            const defaultTime = session.settings?.timeLimit ? session.settings.timeLimit * 60 : 0;
            const blackTime = session.blackTimeLeft ? coerce(session.blackTimeLeft) : defaultTime;
            const whiteTime = session.whiteTimeLeft ? coerce(session.whiteTimeLeft) : defaultTime;
            setClientTimes({ black: blackTime, white: whiteTime });
            return;
        }

        // 아이템 사용시간은 선수패널에 표시하지 않음 (헷갈리지 않도록)
        let baseDeadline = session.turnDeadline
            || session.alkkagiTurnDeadline
            || session.curlingTurnDeadline
            || session.alkkagiPlacementDeadline
            || session.turnChoiceDeadline
            || session.guessDeadline
            || session.basePlacementDeadline
            || session.captureBidDeadline;
            // || session.itemUseDeadline; // 아이템 사용시간은 선수패널에 표시하지 않음

        const playingStatuses = ['playing', 'hidden_placing'];
        const now = Date.now();
        const curPlayer = session.currentPlayer;

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
            'komi_bidding',
            'capture_bidding',
            'alkkagi_simultaneous_placement'
        ].includes(session.gameStatus);
        
        let animationFrameId: number;

        const updateTimer = () => {
            const nowInLoop = Date.now();
            let newTimeLeft = Math.max(0, (baseDeadline - nowInLoop) / 1000);

            // 제한시간이 0이 된 직후: 서버 업데이트 없이 즉시 초읽기 마감으로 이어서 카운트다운
            if (newTimeLeft <= 0 && hasByoyomi && (curPlayer === Player.Black || curPlayer === Player.White)) {
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
        options.isPaused,
    ]);

    return { clientTimes };
};
