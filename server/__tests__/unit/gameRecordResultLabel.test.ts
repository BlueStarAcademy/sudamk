import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import type { GameRecord } from '../../../types/index.js';
import { formatGameRecordResultLabel } from '../../../utils/gameRecordResultLabel.js';

const baseRecord = (overrides: Partial<GameRecord['gameResult']> & { myColor?: Player }): GameRecord => ({
    id: '1',
    gameId: 'g1',
    mode: 'standard' as GameRecord['mode'],
    myColor: overrides.myColor ?? Player.Black,
    opponent: { id: 'o1', nickname: '상대' },
    date: Date.now(),
    sgfContent: '',
    gameResult: {
        winner: Player.Black,
        blackScore: 100,
        whiteScore: 95,
        ...overrides,
    },
});

describe('formatGameRecordResultLabel', () => {
    it('shows resignation win for black player', () => {
        const r = baseRecord({ winReason: 'resign', winner: Player.Black, myColor: Player.Black });
        expect(formatGameRecordResultLabel(r).text).toBe('기권승');
    });

    it('shows time loss for white player', () => {
        const r = baseRecord({ winReason: 'timeout', winner: Player.Black, myColor: Player.White });
        expect(formatGameRecordResultLabel(r).text).toBe('시간패');
    });

    it('shows score margin win', () => {
        const r = baseRecord({
            winReason: 'score',
            scoreMargin: 3.5,
            winner: Player.Black,
            myColor: Player.Black,
        });
        expect(formatGameRecordResultLabel(r).text).toBe('3.5집승');
    });

    it('infers score margin from final scores for legacy records', () => {
        const r = baseRecord({
            winner: Player.White,
            myColor: Player.White,
            blackScore: 50,
            whiteScore: 54,
        });
        expect(formatGameRecordResultLabel(r).text).toBe('4집승');
    });
});
