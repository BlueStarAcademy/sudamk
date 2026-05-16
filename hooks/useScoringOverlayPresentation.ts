import { useEffect, useRef, useState } from 'react';
import { BOARD_SETTLE_BEFORE_SCORING_MS } from '../shared/constants/boardSettleTiming.js';
import { SCORING_PROGRESS_DURATION_MS } from '../shared/constants/scoringOverlayTiming.js';
import { consumePveBoardSettledForScoring } from '../shared/utils/pveScoringBoardSettleSignal.js';

/** 계가(집 계산) 종료·연출 대상인지 — 따내기·기권·시간패 등은 제외 */
export function isScoreBasedScoringPresentation(
    gameStatus: string,
    winReason: string | undefined,
    prevGameStatus: string | undefined,
): boolean {
    if (gameStatus === 'scoring' || gameStatus === 'hidden_final_reveal') return true;
    if (winReason === 'score') return true;
    if (prevGameStatus === 'scoring' || prevGameStatus === 'hidden_final_reveal') return true;
    return false;
}

/**
 * 계가 중 5초 스캔 오버레이를 한 번 재생하고, 완료 후에만 결과 모달·영토 표시를 허용한다.
 * - `scoring` 진입 또는 서버가 `ended`(score)로 바로 넘어와도 동일하게 5초 연출을 보장한다.
 */
export function useScoringOverlayPresentation(params: {
    gameId: string;
    gameStatus: string;
    prevGameStatus: string | undefined;
    winReason: string | undefined;
}): {
    showScoringOverlay: boolean;
    scoringOverlayCompleted: boolean;
    isScoreBasedPresentation: boolean;
} {
    const { gameId, gameStatus, prevGameStatus, winReason } = params;
    const [showScoringOverlay, setShowScoringOverlay] = useState(false);
    const [scoringOverlayCompleted, setScoringOverlayCompleted] = useState(false);
    const sequenceStartedRef = useRef(false);
    const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const isScoreBasedPresentation = isScoreBasedScoringPresentation(
        gameStatus,
        winReason,
        prevGameStatus,
    );

    const clearTimers = () => {
        for (const id of timerIdsRef.current) {
            clearTimeout(id);
        }
        timerIdsRef.current = [];
    };

    useEffect(() => {
        sequenceStartedRef.current = false;
        setShowScoringOverlay(false);
        setScoringOverlayCompleted(false);
        clearTimers();
    }, [gameId]);

    useEffect(() => {
        if (!isScoreBasedPresentation) return;
        if (gameStatus === 'hidden_final_reveal') return;
        if (sequenceStartedRef.current) return;

        const shouldStart =
            gameStatus === 'scoring' ||
            (gameStatus === 'ended' &&
                (winReason === 'score' || prevGameStatus === 'scoring'));

        if (!shouldStart) return;

        sequenceStartedRef.current = true;

        const boardAlreadySettled =
            gameStatus === 'scoring' &&
            (prevGameStatus === 'playing' || prevGameStatus === 'hidden_final_reveal') &&
            consumePveBoardSettledForScoring(gameId);
        const settleMs =
            boardAlreadySettled
                ? 0
                : prevGameStatus === 'playing' || prevGameStatus === 'hidden_final_reveal'
                  ? BOARD_SETTLE_BEFORE_SCORING_MS
                  : 0;

        const showTimer = setTimeout(() => {
            setShowScoringOverlay(true);
            const hideTimer = setTimeout(() => {
                setShowScoringOverlay(false);
                setScoringOverlayCompleted(true);
            }, SCORING_PROGRESS_DURATION_MS);
            timerIdsRef.current.push(hideTimer);
        }, settleMs);
        timerIdsRef.current.push(showTimer);
    }, [
        gameId,
        gameStatus,
        prevGameStatus,
        winReason,
        isScoreBasedPresentation,
    ]);

    return { showScoringOverlay, scoringOverlayCompleted, isScoreBasedPresentation };
}
