/**
 * Legacy compatibility wrapper.
 * GNU Go WASM integration has been removed from runtime usage.
 */

export interface WasmGnuGoRequest {
    boardState: number[][];
    boardSize: number;
    player: string;
    moveHistory: Array<{ x: number; y: number; player: number }>;
    level?: number;
}

export interface WasmGnuGoResult {
    move?: { x: number; y: number };
    error?: string;
}

declare global {
    interface Window {
        Module?: unknown;
    }
}

/** GNU Go WASM is no longer used. */
export function isAvailable(): boolean {
    return false;
}

/** Keep existing API semantics: web/electron can use client-side AI (lightGoAi). */
export function shouldUseClientSideAi(): boolean {
    if (typeof window === 'undefined') return false;
    const hasElectron = !!(window as any).electron;
    const webWantsClientAi = typeof (window as any).electron === 'undefined';
    return hasElectron || webWantsClientAi;
}

export function setWasmGnuGoReady(ready: boolean): void {
    if (typeof window !== 'undefined') (window as any).__wasmGnuGoReady = ready;
}

export function loadWasmGnuGo(): Promise<boolean> {
    setWasmGnuGoReady(false);
    return Promise.resolve(false);
}
export async function getWasmGnuGoMove(request: WasmGnuGoRequest): Promise<WasmGnuGoResult> {
    void request;
    return { error: 'WASM GnuGo disabled' };
}
