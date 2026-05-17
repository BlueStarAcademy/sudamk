import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import { formatPairTurnTickerMessage } from '../../../shared/utils/pairTurnTickerDisplay.js';

describe('pairTurnTickerDisplay', () => {
    it('formats synthetic opponent pet seat with level and pet name', () => {
        const session = {
            id: 'g-test',
            player1: { id: 'u1', nickname: '유저' } as any,
            player2: { id: 'ai', nickname: 'AI' } as any,
            settings: {
                pairGame: {
                    pairOpponentPetDisplayLevelByParticipantId: { 'pair-opponent-pet': 15 },
                },
            },
        };
        const msg = formatPairTurnTickerMessage(session, {
            seatId: 'white2',
            player: Player.White,
            order: 2,
            participantId: 'pair-opponent-pet',
            name: '상대 펫',
            kind: 'pet',
            teamId: 'teamB',
            slot: 'opponentPet',
        });
        expect(msg).toMatch(/^\[백2\] Lv\.15 .+ 님의 차례입니다\.$/);
        expect(msg).not.toContain('상대 AI');
    });
});
