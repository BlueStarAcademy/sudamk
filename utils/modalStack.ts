/**
 * 전역 모달 z-index 스택.
 * 나중에 마운트(또는 bringToFront)된 창이 항상 이전 창 위에 보이도록 한다.
 */

let zCounter = 10_000;
const stackOrder: string[] = [];
const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((fn) => fn());
}

export function subscribeModalStack(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function registerModalStackEntry(entryId: string, zIndexFloor?: number): number {
    const existing = stackOrder.indexOf(entryId);
    if (existing >= 0) stackOrder.splice(existing, 1);
    stackOrder.push(entryId);
    const floor = Number.isFinite(zIndexFloor as number) ? Number(zIndexFloor) : 0;
    zCounter = Math.max(zCounter, floor) + 1;
    notify();
    return zCounter;
}

export function unregisterModalStackEntry(entryId: string): void {
    const idx = stackOrder.indexOf(entryId);
    if (idx < 0) return;
    stackOrder.splice(idx, 1);
    notify();
}

export function bringModalStackEntryToFront(entryId: string, zIndexFloor?: number): number {
    return registerModalStackEntry(entryId, zIndexFloor);
}

export function isModalStackEntryTop(entryId: string): boolean {
    return stackOrder.length > 0 && stackOrder[stackOrder.length - 1] === entryId;
}

/** 테스트·디버그용 */
export function resetModalStackForTests(): void {
    zCounter = 10_000;
    stackOrder.length = 0;
    listeners.clear();
}

export function getModalStackDepth(): number {
    return stackOrder.length;
}
