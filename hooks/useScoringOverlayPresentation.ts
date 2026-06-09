import { useEffect, useRef, useState } from 'react';
import { BOARD_SETTLE_BEFORE_SCORING_MS } from '../shared/constants/boardSettleTiming.js';
import {
    SCORING_OVERLAY_MAX_WAIT_MS,
    SCORING_PROGRESS_DURATION_MS,
} from '../shared/constants/scoringOverlayTiming.js';
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
 * 계가 중 스캔 오버레이를 재생하고, 최소 연출 시간(7초)과 결과 데이터 준비가
 * 모두 충족된 뒤에만 결과 모달·영토 표시를 허용한다.
 */
export function useScoringOverlayPresentation(params: {
    gameId: string;
    gameStatus: string;
    prevGameStatus: string | undefined;
    winReason: string | undefined;
    resultContentReady?: boolean;
}): {
    showScoringOverlay: boolean;
    scoringOverlayCompleted: boolean;
    isScoreBasedPresentation: boolean;
} {
    const { gameId, gameStatus, prevGameStatus, winReason, resultContentReady = false } = params;
    const [showScoringOverlay, setShowScoringOverlay] = useState(false);
    const [scoringOverlayCompleted, setScoringOverlayCompleted] = useState(false);
    const sequenceStartedRef = useRef(false);
    const overlayShownAtRef = useRef<number | null>(null);
    const resultContentReadyRef = useRef(resultContentReady);
    const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    resultContentReadyRef.current = resultContentReady;

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

    const completeOverlay = () => {
        clearTimers();
        setShowScoringOverlay(false);
        setScoringOverlayCompleted(true);
    };

    useEffect(() => {
        sequenceStartedRef.current = false;
        overlayShownAtRef.current = null;
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

        const tryCompleteOverlay = () => {
            const shownAt = overlayShownAtRef.current;
            if (shownAt == null) return;
            const elapsed = Date.now() - shownAt;
            if (elapsed >= SCORING_PROGRESS_DURATION_MS && resultContentReadyRef.current) {
                completeOverlay();
            }
        };

        const showTimer = setTimeout(() => {
            overlayShownAtRef.current = Date.now();
            setShowScoringOverlay(true);
            const minDurationTimer = setTimeout(tryCompleteOverlay, SCORING_PROGRESS_DURATION_MS);
            const maxWaitTimer = setTimeout(completeOverlay, SCORING_OVERLAY_MAX_WAIT_MS);
            timerIdsRef.current.push(minDurationTimer, maxWaitTimer);
        }, settleMs);
        timerIdsRef.current.push(showTimer);
    }, [
        gameId,
        gameStatus,
        prevGameStatus,
        winReason,
        isScoreBasedPresentation,
    ]);

    useEffect(() => {
        if (!showScoringOverlay || scoringOverlayCompleted) return;
        const shownAt = overlayShownAtRef.current;
        if (shownAt == null) return;
        const elapsed = Date.now() - shownAt;
        if (elapsed >= SCORING_PROGRESS_DURATION_MS && resultContentReady) {
            completeOverlay();
            return;
        }
        if (!resultContentReady) return;
        const remaining = Math.max(0, SCORING_PROGRESS_DURATION_MS - elapsed);
        const waitTimer = setTimeout(() => {
            if (resultContentReadyRef.current) {
                completeOverlay();
            }
        }, remaining);
        timerIdsRef.current.push(waitTimer);
        return () => clearTimeout(waitTimer);
    }, [resultContentReady, showScoringOverlay, scoringOverlayCompleted]);

    return { showScoringOverlay, scoringOverlayCompleted, isScoreBasedPresentation };
}
