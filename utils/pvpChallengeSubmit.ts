import type { GameMode, GameSettings, Negotiation, ServerAction } from '../types.js';

type HandleActionFn = (action: ServerAction) => Promise<unknown> | unknown;

type HandleActionResult = {
    negotiationId?: string;
    clientResponse?: { negotiationId?: string };
    error?: string;
    message?: string;
};

function negotiationsList(source: Record<string, Negotiation> | Negotiation[]): Negotiation[] {
    return Array.isArray(source) ? source : Object.values(source || {});
}

function negotiationIdFromResult(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const r = result as HandleActionResult;
    return r.negotiationId ?? r.clientResponse?.negotiationId;
}

function errorFromResult(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const r = result as HandleActionResult;
    return r.error ?? r.message;
}

/** 대기실에서 친선 PVP 대국 신청: CHALLENGE_USER → SEND_CHALLENGE */
export async function submitPvpChallengeFromLobby(
    handleAction: HandleActionFn,
    negotiations: Record<string, Negotiation> | Negotiation[],
    opponentId: string,
    challengerId: string,
    gameMode: GameMode,
    settings: GameSettings,
): Promise<void> {
    const findDraft = (source: Record<string, Negotiation> | Negotiation[]) =>
        negotiationsList(source).find(
            (n) =>
                n?.challenger?.id === challengerId &&
                n?.opponent?.id === opponentId &&
                n?.status === 'draft' &&
                !n?.rematchOfGameId,
        );

    let negotiationId = findDraft(negotiations)?.id;

    if (!negotiationId) {
        const challengeResult = await Promise.resolve(
            handleAction({
                type: 'CHALLENGE_USER',
                payload: { opponentId, mode: gameMode, settings },
            } as ServerAction),
        );
        const challengeError = errorFromResult(challengeResult);
        if (challengeError) {
            throw new Error(challengeError);
        }
        negotiationId = negotiationIdFromResult(challengeResult) ?? findDraft(negotiations)?.id;
    }

    if (!negotiationId) {
        throw new Error('PVP challenge draft was not created');
    }

    const sendResult = await Promise.resolve(
        handleAction({
            type: 'SEND_CHALLENGE',
            payload: { negotiationId, settings },
        } as ServerAction),
    );
    const sendError = errorFromResult(sendResult);
    if (sendError) {
        throw new Error(sendError);
    }
}
