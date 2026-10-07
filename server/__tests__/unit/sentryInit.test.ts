import { describe, expect, it, afterEach, vi } from 'vitest';

describe('server/sentry', () => {
    const originalDsn = process.env.SENTRY_DSN;

    afterEach(() => {
        if (originalDsn === undefined) delete process.env.SENTRY_DSN;
        else process.env.SENTRY_DSN = originalDsn;
        vi.resetModules();
    });

    it('initSentry is a no-op without SENTRY_DSN', async () => {
        delete process.env.SENTRY_DSN;
        const { initSentry, captureServerException } = await import('../../sentry.js');
        expect(() => initSentry()).not.toThrow();
        expect(() => captureServerException(new Error('test'))).not.toThrow();
    });

    it('setupSentryExpressErrorHandler is a no-op without SENTRY_DSN', async () => {
        delete process.env.SENTRY_DSN;
        const { setupSentryExpressErrorHandler } = await import('../../sentry.js');
        const app = { use: vi.fn() };
        expect(() => setupSentryExpressErrorHandler(app)).not.toThrow();
        expect(app.use).not.toHaveBeenCalled();
    });
});
