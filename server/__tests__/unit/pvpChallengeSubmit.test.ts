import { describe, it, expect, vi } from 'vitest';
import { submitPvpChallengeFromLobby } from '../../../utils/pvpChallengeSubmit.js';
import { GameMode } from '../../../shared/types/enums.js';
import type { Negotiation } from '../../../shared/types/index.js';

const settings = { boardSize: 9, komi: 6.5, timeLimit: 5, byoyomiCount: 3, byoyomiTime: 30 };

function draftNegotiation(id: string): Negotiation {
    return {
        id,
        challenger: { id: 'challenger-id' } as Negotiation['challenger'],
        opponent: { id: 'opponent-id' } as Negotiation['opponent'],
        mode: GameMode.Standard,
        settings,
        proposerId: 'challenger-id',
        status: 'draft',
        turnCount: 0,
        deadline: Date.now() + 60000,
        isRanked: false,
    };
}

describe('submitPvpChallengeFromLobby', () => {
    it('SEND_CHALLENGE only when draft already exists in negotiations', async () => {
        const handleAction = vi.fn().mockResolvedValue(undefined);
        const negotiations = { 'neg-1': draftNegotiation('neg-1') };

        await submitPvpChallengeFromLobby(
            handleAction,
            negotiations,
            'opponent-id',
            'challenger-id',
            GameMode.Standard,
            settings,
        );

        expect(handleAction).toHaveBeenCalledTimes(1);
        expect(handleAction).toHaveBeenCalledWith({
            type: 'SEND_CHALLENGE',
            payload: { negotiationId: 'neg-1', settings },
        });
    });

    it('uses negotiationId from CHALLENGE_USER HTTP response when negotiations snapshot is stale', async () => {
        const handleAction = vi
            .fn()
            .mockResolvedValueOnce({ negotiationId: 'neg-from-response' })
            .mockResolvedValueOnce(undefined);

        await submitPvpChallengeFromLobby(
            handleAction,
            {},
            'opponent-id',
            'challenger-id',
            GameMode.Standard,
            settings,
        );

        expect(handleAction).toHaveBeenNthCalledWith(1, {
            type: 'CHALLENGE_USER',
            payload: { opponentId: 'opponent-id', mode: GameMode.Standard, settings },
        });
        expect(handleAction).toHaveBeenNthCalledWith(2, {
            type: 'SEND_CHALLENGE',
            payload: { negotiationId: 'neg-from-response', settings },
        });
    });

    it('throws when CHALLENGE_USER returns an error', async () => {
        const handleAction = vi.fn().mockResolvedValue({ error: '액션 포인트가 부족합니다.' });

        await expect(
            submitPvpChallengeFromLobby(
                handleAction,
                {},
                'opponent-id',
                'challenger-id',
                GameMode.Standard,
                settings,
            ),
        ).rejects.toThrow('액션 포인트가 부족합니다.');
    });

    it('throws when SEND_CHALLENGE returns an error', async () => {
        const handleAction = vi
            .fn()
            .mockResolvedValueOnce({ negotiationId: 'neg-1' })
            .mockResolvedValueOnce({ message: 'Invalid challenge.' });

        await expect(
            submitPvpChallengeFromLobby(
                handleAction,
                {},
                'opponent-id',
                'challenger-id',
                GameMode.Standard,
                settings,
            ),
        ).rejects.toThrow('Invalid challenge.');
    });
});
