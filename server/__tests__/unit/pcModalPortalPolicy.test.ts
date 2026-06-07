import { describe, expect, it } from 'vitest';
import { resolvePcModalPortalPolicy } from '../../../utils/pcModalPortalPolicy.js';

const pcCanvasBase = {
    appModalLayerUsesDesignPixels: true,
    preferInCanvasModalPortal: true,
    disableSmallPcViewportPortal: true,
    isNativeMobile: false,
    isCompactViewport: false,
    ingameBoardFrame: false,
    isSmallPcViewport: true,
    isScrollableDesignFrameCandidate: false,
    viewportPortal: false,
    autoViewportPortalOnSmallDesktop: false,
};

describe('resolvePcModalPortalPolicy', () => {
    it('keeps lobby modals in design-pixel canvas on PC', () => {
        const result = resolvePcModalPortalPolicy(pcCanvasBase);
        expect(result.effectiveViewportPortal).toBe(false);
        expect(result.modalLayerUsesDesignPixels).toBe(true);
        expect(result.useReadableSmallPcViewportPortal).toBe(false);
    });

    it('honors explicit viewportPortal on PC', () => {
        const result = resolvePcModalPortalPolicy({
            ...pcCanvasBase,
            viewportPortal: true,
        });
        expect(result.effectiveViewportPortal).toBe(true);
        expect(result.modalLayerUsesDesignPixels).toBe(false);
    });

    it('uses body portal for lobby when not preferring in-canvas (mobile shell)', () => {
        const result = resolvePcModalPortalPolicy({
            ...pcCanvasBase,
            appModalLayerUsesDesignPixels: false,
            preferInCanvasModalPortal: false,
            disableSmallPcViewportPortal: false,
            ingameBoardFrame: false,
        });
        expect(result.effectiveViewportPortal).toBe(true);
    });

    it('keeps in-game modals in canvas when ingameBoardFrame', () => {
        const result = resolvePcModalPortalPolicy({
            ...pcCanvasBase,
            ingameBoardFrame: true,
        });
        expect(result.effectiveViewportPortal).toBe(false);
        expect(result.modalLayerUsesDesignPixels).toBe(true);
    });
});
