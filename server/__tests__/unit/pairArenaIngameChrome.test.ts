import { describe, it, expect } from 'vitest';
import { sessionUsesPairArenaIngameChrome } from '../../../shared/utils/pairArenaIngameChrome.js';

const turnOrder = [
    { seatId: 'black1', participantId: 'u1', kind: 'user' as const },
    { seatId: 'white1', participantId: 'pair-opponent-ai', kind: 'ai' as const },
    { seatId: 'white2', participantId: 'pair-opponent-pet', kind: 'pet' as const },
];

describe('sessionUsesPairArenaIngameChrome', () => {
    it('enables pair chrome for pair channel', () => {
        expect(
            sessionUsesPairArenaIngameChrome({
                settings: { pairGame: { lobbyChannel: 'pair', turnOrder } },
            }),
        ).toBe(true);
    });

    it('enables pair chrome for friendly channel (training machine / home friendly pair AI)', () => {
        expect(
            sessionUsesPairArenaIngameChrome({
                settings: { pairGame: { lobbyChannel: 'friendly', pairMode: 'ai', turnOrder } },
            }),
        ).toBe(true);
    });

    it('keeps aggregate strategic lobby on standard PlayerPanel rail', () => {
        expect(
            sessionUsesPairArenaIngameChrome({
                settings: { pairGame: { lobbyChannel: 'strategic', turnOrder } },
            }),
        ).toBe(false);
    });

    it('keeps aggregate playful lobby on standard PlayerPanel rail', () => {
        expect(
            sessionUsesPairArenaIngameChrome({
                settings: { pairGame: { lobbyChannel: 'playful', turnOrder } },
            }),
        ).toBe(false);
    });

    it('returns false without pair turn order', () => {
        expect(
            sessionUsesPairArenaIngameChrome({
                settings: { pairGame: { lobbyChannel: 'pair' } },
            }),
        ).toBe(false);
    });
});
