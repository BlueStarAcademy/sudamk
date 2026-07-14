import type { AnalysisResult } from '../shared/types/index.js';
import type { LiveGameSession } from '../shared/types/entities.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
type ResultDisplayParams = {
    session: LiveGameSession;
    showResultModal: boolean;
    gameHasJustEnded: boolean;
    prevGameStatus?: string;
    hasAnalysisResult: boolean;
    /** instantEnd 참가자: 보상·XP·랭킹 행(`session.summary`)이 붙은 뒤에만 결과 모달을 연다 */
    resultModalWaitSummary: boolean;
    hasMyGameSummary: boolean;
    gameSummaryJustArrived: boolean;
    postGameSummaryAcknowledged?: boolean;
};

function shouldOpenResultModalForSummaryLikeEnd(params: ResultDisplayParams): boolean {
    const {
        session,
        gameHasJustEnded,
        prevGameStatus,
        hasAnalysisResult,
        resultModalWaitSummary,
        hasMyGameSummary,
        gameSummaryJustArrived,
        postGameSummaryAcknowledged = false,
    } = params;
    const scoreEndNeedsAnalysis = session.winReason === 'score' && !hasAnalysisResult;
    const summaryNotReady = resultModalWaitSummary && !hasMyGameSummary;
    const summaryReadyTerminal =
        resultModalWaitSummary &&
        session.gameStatus === 'ended' &&
        hasMyGameSummary &&
        !postGameSummaryAcknowledged &&
        !scoreEndNeedsAnalysis;
    return (
        (gameHasJustEnded &&
            !scoreEndNeedsAnalysis &&
            !(resultModalWaitSummary && session.gameStatus === 'ended' && !hasMyGameSummary)) ||
        (session.gameStatus === 'ended' &&
            hasAnalysisResult &&
            prevGameStatus !== 'ended' &&
            !summaryNotReady) ||
        summaryReadyTerminal ||
        gameSummaryJustArrived
    );
}

/** 계가 결과 모달에 필요한 데이터(ended·점수·보상 summary)가 모두 준비됐는지 */
export function isScoringResultContentReady(params: {
    gameStatus: string;
    winReason?: string | null;
    analysisResult?: AnalysisResult | null;
    resultModalWaitSummary: boolean;
    hasMyGameSummary: boolean;
}): boolean {
    const { gameStatus, winReason, analysisResult, resultModalWaitSummary, hasMyGameSummary } = params;
    if (gameStatus !== 'ended' && gameStatus !== 'scoring') return false;
    if (resultModalWaitSummary && !hasMyGameSummary) return false;
    if (winReason === 'score' || gameStatus === 'scoring') {
        return Boolean(analysisResult);
    }
    return true;
}

/** 계가(집) 연출이 끝날 때까지 결과 모달·영토 표시를 지연한다. 기권/접속끊김/시간패는 즉시 허용. */
export function shouldWaitForScoreBasedScoringOverlay(params: {
    isScoreBasedPresentation: boolean;
    scoringOverlayCompleted: boolean;
    winReason?: string | null;
}): boolean {
    const { isScoreBasedPresentation, scoringOverlayCompleted, winReason } = params;
    const immediateEnd =
        winReason === 'resign' || winReason === 'disconnect' || winReason === 'timeout';
    return isScoreBasedPresentation && !scoringOverlayCompleted && !immediateEnd;
}

/** PVP 등 instantEnd: gameHasJustEnded를 놓쳐도 연출 완료 후 ended면 결과 모달을 연다. */
export function shouldOpenResultModalAfterScoringOverlay(params: {
    isScoreBasedPresentation: boolean;
    scoringOverlayCompleted: boolean;
    gameStatus: string;
    postGameSummaryAcknowledged: boolean;
    hasAnalysisResult?: boolean;
    resultModalWaitSummary?: boolean;
    hasMyGameSummary?: boolean;
}): boolean {
    const {
        isScoreBasedPresentation,
        scoringOverlayCompleted,
        gameStatus,
        postGameSummaryAcknowledged,
        hasAnalysisResult = false,
        resultModalWaitSummary = false,
        hasMyGameSummary = false,
    } = params;
    const summaryReady = !resultModalWaitSummary || hasMyGameSummary;
    return (
        isScoreBasedPresentation &&
        scoringOverlayCompleted &&
        !postGameSummaryAcknowledged &&
        hasAnalysisResult &&
        summaryReady &&
        (gameStatus === 'ended' || gameStatus === 'scoring')
    );
}

export function shouldOpenResultModalByPolicy(params: ResultDisplayParams): boolean {
    const { session } = params;
    const policy = resolveArenaSessionPolicy(session);

    // 학원/탑(waitScoringOverlay)·모험/길드전(waitSummary)·전략 instantEnd: summary 준비 후 오픈.
    // Game.tsx의 resultModalWaitSummary와 짝을 이뤄 빈 “보상 정보가 없습니다.” 깜빡임을 막는다.
    if (
        policy.resultDisplayModel === 'waitScoringOverlay' ||
        policy.resultDisplayModel === 'waitSummary' ||
        policy.resultDisplayModel === 'instantEnd'
    ) {
        return shouldOpenResultModalForSummaryLikeEnd(params);
    }

    return false;
}

