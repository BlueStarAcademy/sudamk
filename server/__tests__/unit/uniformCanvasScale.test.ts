import { describe, expect, it } from 'vitest';
import {
    PC_DESIGN_CANVAS_HEIGHT,
    PC_DESIGN_CANVAS_WIDTH,
} from '../../../shared/constants/viewportDesign.js';
import { computeUniformFitScale, snapUniformCanvasScale } from '../../../utils/uniformCanvasScale.js';

describe('snapUniformCanvasScale', () => {
    it('returns 1 when viewport fits design canvas', () => {
        expect(snapUniformCanvasScale(1920, 1080)).toBe(1);
        expect(snapUniformCanvasScale(2560, 1440)).toBe(1);
    });

    it('scales down uniformly for smaller viewports', () => {
        const scale = snapUniformCanvasScale(1366, 768);
        expect(scale).toBeLessThan(1);
        expect(scale).toBeGreaterThan(0.65);
        expect(PC_DESIGN_CANVAS_WIDTH * scale).toBeLessThanOrEqual(1366 + 1);
        expect(PC_DESIGN_CANVAS_HEIGHT * scale).toBeLessThanOrEqual(768 + 1);
    });

    it('never exceeds 1', () => {
        expect(snapUniformCanvasScale(800, 600, PC_DESIGN_CANVAS_WIDTH, PC_DESIGN_CANVAS_HEIGHT)).toBeLessThanOrEqual(1);
    });
});

describe('computeUniformFitScale', () => {
    it('fits design frame inside available area', () => {
        const s = computeUniformFitScale(900, 750, 900, 750);
        expect(s).toBe(1);

        const s2 = computeUniformFitScale(450, 375, 900, 750);
        expect(s2).toBeCloseTo(0.5, 1);
    });

    it('respects minScale floor', () => {
        const s = computeUniformFitScale(10, 10, 900, 750, { minScale: 0.2 });
        expect(s).toBe(0.2);
    });
});
