/**
 * Centralized Error Handling Utilities
 * 
 * This module provides standardized error handling, logging, and error classification
 * to improve code maintainability and debugging.
 */

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum ErrorCategory {
    DATABASE = 'database',
    NETWORK = 'network',
    VALIDATION = 'validation',
    GAME_LOGIC = 'game_logic',
    AI = 'ai',
    AUTH = 'auth',
    SYSTEM = 'system',
    UNKNOWN = 'unknown'
}

export interface ErrorContext {
    gameId?: string;
    userId?: string;
    action?: string;
    [key: string]: any;
}

export interface ErrorInfo {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    context?: ErrorContext;
    timestamp: string;
    isFatal: boolean;
}

/**
 * Classify error severity based on error type and message
 */
export function classifyErrorSeverity(error: Error | any): ErrorSeverity {
    const errorCode = error?.code;
    const errorName = error?.name;
    const errorMessage = error?.message || '';

    // Critical errors
    if (
        errorCode === 'ENOMEM' ||
        errorMessage.includes('out of memory') ||
        errorName === 'ReferenceError' ||
        errorName === 'SyntaxError'
    ) {
        return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (
        errorCode === 'EADDRINUSE' ||
        errorCode === 'EACCES' ||
        errorMessage.includes('ECONNREFUSED') ||
        errorName === 'TypeError'
    ) {
        return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (
        errorCode?.startsWith('P') || // Prisma errors
        errorMessage.includes('database') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout')
    ) {
        return ErrorSeverity.MEDIUM;
    }

    // Low severity (default)
    return ErrorSeverity.LOW;
}

/**
 * Classify error category
 */
export function classifyErrorCategory(error: Error | any): ErrorCategory {
    const errorCode = error?.code || '';
    const errorMessage = (error?.message || '').toLowerCase();

    if (errorCode.startsWith('P') || errorMessage.includes('database') || errorMessage.includes('prisma')) {
        return ErrorCategory.DATABASE;
    }
    if (errorMessage.includes('network') || errorMessage.includes('econnrefused') || errorMessage.includes('timeout')) {
        return ErrorCategory.NETWORK;
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
        return ErrorCategory.VALIDATION;
    }
    if (errorMessage.includes('game') || errorMessage.includes('move') || errorMessage.includes('board')) {
        return ErrorCategory.GAME_LOGIC;
    }
    if (errorMessage.includes('ai') || errorMessage.includes('katago') || errorMessage.includes('gnugo')) {
        return ErrorCategory.AI;
    }
    if (errorMessage.includes('auth') || errorMessage.includes('login') || errorMessage.includes('permission')) {
        return ErrorCategory.AUTH;
    }
    if (errorMessage.includes('system') || errorMessage.includes('memory') || errorMessage.includes('process')) {
        return ErrorCategory.SYSTEM;
    }

    return ErrorCategory.UNKNOWN;
}

/**
 * Check if error is fatal (should exit process)
 */
export function isFatalError(error: Error | any): boolean {
    const severity = classifyErrorSeverity(error);
    const errorName = error?.name || '';
    const errorMessage = error?.message || '';
    const errorCode = error?.code;

    // Critical errors are always fatal
    if (severity === ErrorSeverity.CRITICAL) {
        return true;
    }

    // High severity errors that are fatal
    if (
        errorName === 'ReferenceError' ||
        errorName === 'SyntaxError' ||
        errorCode === 'EADDRINUSE' ||
        errorCode === 'EACCES' ||
        (errorName === 'TypeError' && errorMessage.includes('Cannot read property'))
    ) {
        return true;
    }

    // Database errors are not fatal (connection can be retried)
    if (errorCode?.startsWith('P') || errorMessage.includes('database')) {
        return false;
    }

    return false;
}

/**
 * Create structured error info
 */
export function createErrorInfo(error: Error | any, context?: ErrorContext): ErrorInfo {
    return {
        name: error?.name || 'UnknownError',
        message: error?.message || 'Unknown error occurred',
        stack: error?.stack,
        code: error?.code,
        severity: classifyErrorSeverity(error),
        category: classifyErrorCategory(error),
        context,
        timestamp: new Date().toISOString(),
        isFatal: isFatalError(error)
    };
}

/**
 * Log error with standardized format
 */
export function logError(error: Error | any, context?: ErrorContext, level: 'error' | 'warn' = 'error'): void {
    const errorInfo = createErrorInfo(error, context);
    const logPrefix = `[${errorInfo.category.toUpperCase()}]`;
    
    const logData = {
        severity: errorInfo.severity,
        category: errorInfo.category,
        name: errorInfo.name,
        message: errorInfo.message,
        code: errorInfo.code,
        context: errorInfo.context,
        timestamp: errorInfo.timestamp
    };

    if (level === 'error') {
        console.error(`${logPrefix} ${errorInfo.name}: ${errorInfo.message}`, logData);
        if (errorInfo.stack) {
            console.error(`${logPrefix} Stack:`, errorInfo.stack);
        }
    } else {
        console.warn(`${logPrefix} ${errorInfo.name}: ${errorInfo.message}`, logData);
    }

    // Also write to stderr for Railway logging
    if (errorInfo.severity === ErrorSeverity.CRITICAL || errorInfo.isFatal) {
        process.stderr.write(`[CRITICAL] ${errorInfo.name}: ${errorInfo.message}\n`);
        if (errorInfo.stack) {
            process.stderr.write(`Stack: ${errorInfo.stack.substring(0, 500)}\n`);
        }
    }
}

/**
 * Handle game logic validation errors (replaces CRITICAL BUG PREVENTION logs)
 */
export function handleGameLogicError(
    message: string,
    context: ErrorContext
): { error: string; logged: boolean } {
    const errorContext: ErrorContext = {
        ...context,
        errorType: 'game_logic_validation'
    };

    logError(
        new Error(message),
        errorContext,
        'warn' // Game logic errors are warnings, not critical errors
    );

    return {
        error: message,
        logged: true
    };
}

/**
 * Handle uncaught exception with proper logging and exit logic
 */
export function handleUncaughtException(error: Error): void {
    const errorInfo = createErrorInfo(error);
    
    // Log detailed error information
    console.error('[Server] ========== UNCAUGHT EXCEPTION ==========');
    console.error('[Server] Timestamp:', errorInfo.timestamp);
    console.error('[Server] Category:', errorInfo.category);
    console.error('[Server] Severity:', errorInfo.severity);
    console.error('[Server] Error name:', errorInfo.name);
    console.error('[Server] Error message:', errorInfo.message);
    console.error('[Server] Error code:', errorInfo.code);
    if (errorInfo.stack) {
        console.error('[Server] Stack trace:', errorInfo.stack);
    }
    console.error('[Server] =========================================');

    // Memory info
    const memory = process.memoryUsage();
    const memMB = {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
    };
    process.stderr.write(`[CRITICAL] UNCAUGHT EXCEPTION at ${errorInfo.timestamp}\n`);
    process.stderr.write(`Name: ${errorInfo.name}\n`);
    process.stderr.write(`Message: ${errorInfo.message}\n`);
    process.stderr.write(`Memory: RSS=${memMB.rss}MB, Heap=${memMB.heapUsed}/${memMB.heapTotal}MB\n`);

    // Handle out of memory
    if (errorInfo.code === 'ENOMEM' || errorInfo.message.includes('out of memory')) {
        console.error('[Server] Out of memory error detected. Exiting for Railway restart.');
        process.stderr.write('[CRITICAL] Out of memory - exiting\n');
        try {
            if (global.gc) {
                global.gc();
            }
        } catch (gcError) {
            // Ignore
        }
        process.exit(1);
    }

    // Database errors are not fatal
    if (errorInfo.category === ErrorCategory.DATABASE) {
        console.warn('[Server] Database error in uncaught exception (non-fatal). Server will continue.');
        return;
    }

    // Fatal errors exit process
    if (errorInfo.isFatal) {
        console.error('[Server] Fatal error detected. Exiting for Railway restart.');
        process.stderr.write('[CRITICAL] Fatal error - exiting for restart\n');
        try {
            if (global.gc) {
                global.gc();
            }
        } catch (gcError) {
            // Ignore
        }
        process.exit(1);
    }

    // Track repeated errors
    const errorKey = `${errorInfo.name}:${errorInfo.message.substring(0, 100)}`;
    (global as any).uncaughtExceptionCount = (global as any).uncaughtExceptionCount || {};
    (global as any).uncaughtExceptionCount[errorKey] = ((global as any).uncaughtExceptionCount[errorKey] || 0) + 1;

    if ((global as any).uncaughtExceptionCount[errorKey] >= 5) {
        console.error(`[Server] Same error occurred 5 times consecutively. Exiting for Railway restart.`);
        process.stderr.write(`[CRITICAL] Repeated error (5x) - exiting for restart\n`);
        process.exit(1);
    }

    // Reset counter after 1 minute
    setTimeout(() => {
        if ((global as any).uncaughtExceptionCount) {
            (global as any).uncaughtExceptionCount[errorKey] = 0;
        }
    }, 60000);

    // Non-fatal errors: continue execution
    console.error('[Server] Attempting to continue despite error...');
}

/**
 * Safe error wrapper for async functions
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    context?: ErrorContext,
    fallback?: T
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (error: any) {
        logError(error, context);
        return fallback;
    }
}

