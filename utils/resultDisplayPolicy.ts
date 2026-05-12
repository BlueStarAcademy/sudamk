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

export function shouldOpenResultModalByPolicy(params: ResultDisplayParams): boolean {
    const {
        session,
        showResultModal,
        gameHasJustEnded,
        prevGameStatus,
        hasAnalysisResult,
        playfulResultModalWaitSummary,
        hasMyGameSummary,
        playfulGameSummaryJustArrived,
    } = params;
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

    if (policy.resultDisplayModel === 'waitSummary') {
        return (
            (gameHasJustEnded &&
                !(playfulResultModalWaitSummary && session.gameStatus === 'ended' && !hasMyGameSummary)) ||
            (session.gameStatus === 'ended' && hasAnalysisResult && prevGameStatus !== 'ended') ||
            playfulGameSummaryJustArrived
        );
    }

    return showResultModal && (session.gameStatus === 'ended' || session.gameStatus === 'no_contest');
}

