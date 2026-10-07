/**
 * Sentry error reporting for Railway production.
 * No-op when SENTRY_DSN is unset (local/dev without monitoring).
 */
import * as Sentry from '@sentry/node';

let initialized = false;

function isHealthNoiseUrl(url: string | undefined): boolean {
    if (!url) return false;
    try {
        const pathOnly = url.includes('://') ? new URL(url).pathname : url.split('?')[0] || url;
        return pathOnly === '/api/health' || pathOnly === '/';
    } catch {
        return url.includes('/api/health');
    }
}

/** Call once after dotenv load, before other app imports that may throw. */
export function initSentry(): void {
    if (initialized) return;
    const dsn = process.env.SENTRY_DSN?.trim();
    if (!dsn) {
        console.log('[Sentry] SENTRY_DSN not set — error reporting disabled');
        initialized = true;
        return;
    }

    const environment =
        process.env.SENTRY_ENVIRONMENT?.trim() ||
        process.env.RAILWAY_ENVIRONMENT_NAME?.trim() ||
        process.env.NODE_ENV ||
        'development';

    const release =
        process.env.SENTRY_RELEASE?.trim() ||
        process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
        undefined;

    Sentry.init({
        dsn,
        environment,
        release,
        tracesSampleRate: 0,
        beforeSend(event) {
            const reqUrl = event.request?.url;
            if (isHealthNoiseUrl(reqUrl)) return null;
            const tx = event.transaction;
            if (typeof tx === 'string' && (tx.includes('/api/health') || tx === 'GET /')) {
                return null;
            }
            return event;
        },
    });

    initialized = true;
    console.log(`[Sentry] Initialized (env=${environment}${release ? `, release=${release}` : ''})`);
}

export function captureServerException(
    error: unknown,
    context?: {
        tags?: Record<string, string>;
        extra?: Record<string, unknown>;
    },
): void {
    if (!process.env.SENTRY_DSN?.trim()) return;
    Sentry.withScope((scope) => {
        if (context?.tags) {
            for (const [k, v] of Object.entries(context.tags)) {
                scope.setTag(k, v);
            }
        }
        if (context?.extra) {
            for (const [k, v] of Object.entries(context.extra)) {
                scope.setExtra(k, v);
            }
        }
        Sentry.captureException(error);
    });
}

/** Register after all routes; must run before custom Express error middleware that sends the response. */
export function setupSentryExpressErrorHandler(app: {
    use: (...args: any[]) => unknown;
}): void {
    if (!process.env.SENTRY_DSN?.trim()) return;
    Sentry.setupExpressErrorHandler(app as any);
}

export { Sentry };
