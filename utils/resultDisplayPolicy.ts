import type { LiveGameSession } from '../shared/types/entities.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';

type ResultDisplayParams = {
    session: LiveGameSession;
    showResultModal: boolean;
    gameHasJustEnded: boolean;
    prevGameStatus?: string;
    hasAnalysisResult: boolean;
    playfulResultModalWaitSummary: boolean;
    hasMyGameSummary: boolean;
    playfulGameSummaryJustArrived: boolean;
};

function shouldOpenResultModalForSummaryLikeEnd(params: ResultDisplayParams): boolean {
    const {
        session,
        gameHasJustEnded,
        prevGameStatus,
        hasAnalysisResult,
        playfulResultModalWaitSummary,
        hasMyGameSummary,
        playfulGameSummaryJustArrived,
    } = params;
    return (
        (gameHasJustEnded &&
            !(playfulResultModalWaitSummary && session.gameStatus === 'ended' && !hasMyGameSummary)) ||
        (session.gameStatus === 'ended' && hasAnalysisResult && prevGameStatus !== 'ended') ||
        playfulGameSummaryJustArrived
    );
}

export function shouldOpenResultModalByPolicy(params: ResultDisplayParams): boolean {
    const { session, gameHasJustEnded, prevGameStatus, hasAnalysisResult } = params;
    const policy = resolveArenaSessionPolicy(session);
    const immediateEnd =
        gameHasJustEnded &&
        (session.winReason === 'resign' || session.winReason === 'disconnect' || session.winReason === 'timeout');

    if (policy.resultDisplayModel === 'waitScoringOverlay') {
        return (
            immediateEnd ||
            gameHasJustEnded ||
            (session.gameStatus === 'ended' && hasAnalysisResult && prevGameStatus !== 'ended')
        );
    }

    // 모험·길드전(waitSummary)과 일반·페어·대기실 AI(instantEnd)는 동일한 “언제 결과 모달 플래그를 올릴지” 규칙을 쓴다.
    // instantEnd에서 `showResultModal && ended`만 보면 플래그가 처음부터 false라 영원히 열리지 않는 버그가 있었다.
    if (policy.resultDisplayModel === 'waitSummary' || policy.resultDisplayModel === 'instantEnd') {
        return shouldOpenResultModalForSummaryLikeEnd(params);
    }

    return false;
}

