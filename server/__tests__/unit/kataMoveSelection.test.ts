import { describe, expect, it } from 'vitest';
import { selectKataMoveWithoutPass } from '../../kataMoveSelection.js';

describe('selectKataMoveWithoutPass', () => {
    it('keeps Kata top move when it is a board coordinate', () => {
        const selected = selectKataMoveWithoutPass(
            [
                { move: 'D4', winrate: 0.52 },
                { move: 'PASS', winrate: 0.6 },
            ],
            9,
            false,
        );

        expect(selected?.move).toBe('D4');
        expect(selected?.point).toEqual({ x: 3, y: 5 });
        expect(selected?.source).toBe('topMove');
    });

    it('uses the best non-pass Kata candidate when top move is PASS', () => {
        const selected = selectKataMoveWithoutPass(
            [
                { move: 'PASS', winrate: 0.8 },
                { move: 'G8', winrate: 0.76 },
                { move: 'E4', winrate: 0.7 },
            ],
            9,
            false,
        );

        expect(selected?.move).toBe('G8');
        expect(selected?.point).toEqual({ x: 6, y: 1 });
        expect(selected?.source).toBe('nonPassFallback');
    });

    it('allows PASS only when the caller explicitly permits it', () => {
        const selected = selectKataMoveWithoutPass([{ move: 'PASS', winrate: 0.8 }], 9, true);

        expect(selected?.move).toBe('PASS');
        expect(selected?.point).toEqual({ x: -1, y: -1 });
        expect(selected?.source).toBe('passAllowed');
    });
});
