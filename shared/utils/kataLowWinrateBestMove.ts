import type { LiveGameSession } from '../types/entities.js';
import { isTrainingGroundSession } from '../constants/trainingGround.js';
import { resolveArenaSessionPolicy } from './liveSessionArenaKind.js';

/** Kata `/move` 응답 승률이 이 값 미만이면 bestMove 우선, 이상이면 move 우선. */
export const KATA_LOW_WINRATE_BEST_MOVE_THRESHOLD = 0.1;

/**
 * 저승률 bestMove 전환은 전략 로비 AI(`normal`)에만 적용.
 * 탐험·탑·바둑학원·훈련장·길드전은 levelbot `move`로 약함을 표현해야 하므로 bestMove 폴백을 쓰지 않는다.
 */
export function shouldApplyKataLowWinrateBestMovePreference(
    game: Pick<LiveGameSession, 'gameCategory' | 'isSinglePlayer' | 'settings'> | null | undefined,
): boolean {
    if (!game) return true;
    if (isTrainingGroundSession(game)) return false;
    const kind = resolveArenaSessionPolicy(game as LiveGameSession).kind;
    if (kind === 'adventure' || kind === 'tower' || kind === 'singleplayer' || kind === 'guildwar') {
        return false;
    }
    return kind === 'normal';
}

export function clearKataLowWinrateBestMovePreference(game: { kataPreferBestMoveLowWinrate?: boolean } | null | undefined): void {
    if (!game) return;
    delete game.kataPreferBestMoveLowWinrate;
}

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
    options?: { enabled?: boolean },
): boolean {
    if (options?.enabled === false) {
        clearKataLowWinrateBestMovePreference(game);
        return false;
    }
    const preferThisTurn = resolveKataPreferBestMoveLowWinrate(readKataPreferBestMoveLowWinrate(game), winrate);
    game.kataPreferBestMoveLowWinrate = preferThisTurn;
    return preferThisTurn;
}
