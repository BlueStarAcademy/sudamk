import { describe, expect, it } from 'vitest';
import {
    MOBILE_KEYBOARD_INSET_THRESHOLD_PX,
    measureMobileKeyboardBottomInset,
    measureVisualViewportHeight,
} from '../../../shared/utils/mobileKeyboardInset.js';

describe('mobileKeyboardInset', () => {
    it('returns 0 when visualViewport is missing or full height', () => {
        expect(measureMobileKeyboardBottomInset({ innerHeight: 800, visualViewport: null })).toBe(0);
        expect(
            measureMobileKeyboardBottomInset({
                innerHeight: 800,
                visualViewport: { height: 800, offsetTop: 0 },
            }),
        ).toBe(0);
    });

    it('ignores small chrome jitter below threshold', () => {
        expect(
            measureMobileKeyboardBottomInset({
                innerHeight: 800,
                visualViewport: { height: 800 - (MOBILE_KEYBOARD_INSET_THRESHOLD_PX - 1), offsetTop: 0 },
            }),
        ).toBe(0);
    });

    it('reports keyboard inset when visualViewport shrinks from the bottom', () => {
        expect(
            measureMobileKeyboardBottomInset({
                innerHeight: 800,
                visualViewport: { height: 480, offsetTop: 0 },
            }),
        ).toBe(320);
    });

    it('accounts for visualViewport offsetTop (iOS scroll)', () => {
        expect(
            measureMobileKeyboardBottomInset({
                innerHeight: 800,
                visualViewport: { height: 480, offsetTop: 40 },
            }),
        ).toBe(280);
    });

    it('reads visual viewport height with fallback', () => {
        expect(
            measureVisualViewportHeight({
                visualViewport: { height: 512.4, offsetTop: 0 },
            }),
        ).toBe(512);
        expect(measureVisualViewportHeight({ visualViewport: null, fallbackHeight: 900 })).toBe(900);
    });
});
