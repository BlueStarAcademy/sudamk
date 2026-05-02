const pending = new Map<string, Set<string>>();

export function pushCurrencyCapNotice(userId: string, message: string): void {
    if (!userId || !message) return;
    let set = pending.get(userId);
    if (!set) {
        set = new Set();
        pending.set(userId, set);
    }
    set.add(message);
}

export function drainCurrencyCapNotices(userId: string): string[] {
    const set = pending.get(userId);
    if (!set) return [];
    pending.delete(userId);
    return [...set];
}
