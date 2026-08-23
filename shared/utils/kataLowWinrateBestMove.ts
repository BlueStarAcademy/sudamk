/** Kata `/move` 응답 승률이 이 값 미만이면 bestMove 우선, 이상이면 move 우선. */
export const KATA_LOW_WINRATE_BEST_MOVE_THRESHOLD = 0.1;

export function resolveKataPreferBestMoveLowWinrate(
    previouslyActive: boolean,
    winrate: number | undefined | null,
): boolean {
    if (typeof winrate !== 'number' || !Number.isFinite(winrate)) {
        return previouslyActive;
    }
    if (winrate < KATA_LOW_WINRATE_BEST_MOVE_THRESHOLD) return true;
    return false;
}

export function readKataPreferBestMoveLowWinrate(game: { kataPreferBestMoveLowWinrate?: unknown } | null | undefined): boolean {
    return Boolean(game?.kataPreferBestMoveLowWinrate);
}

/** 이번 응답 승률로 모드를 갱신하고, 이번 착수에 쓸 모드를 반환한다. */
export function applyKataWinrateBestMovePreference(
    game: { kataPreferBestMoveLowWinrate?: boolean },
    winrate: number | undefined | null,
): boolean {
    const preferThisTurn = resolveKataPreferBestMoveLowWinrate(readKataPreferBestMoveLowWinrate(game), winrate);
    game.kataPreferBestMoveLowWinrate = preferThisTurn;
    return preferThisTurn;
}
