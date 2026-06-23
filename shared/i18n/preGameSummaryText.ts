import { tx, translateGameMode } from './runtimeText.js';
import { SPEED_PER_MOVE_SECONDS } from '../constants/speedTimePressure.js';

export function pg(key: string, opts?: Record<string, unknown>): string {
    return tx(`game:preGame.summary.${key}`, opts ?? {});
}

export function pgItem(key: string, opts?: Record<string, unknown>): string {
    return tx(`game:preGame.itemSlot.${key}`, opts ?? {});
}

export function pgNone(): string {
    return tx('game:preGame.none');
}

export function pgSpeedPvpHighlight(): string {
    return pg('speedPvpHighlight', {
        sec: SPEED_PER_MOVE_SECONDS,
        defaultValue: `수당 ${SPEED_PER_MOVE_SECONDS}초 초읽기 · ${SPEED_PER_MOVE_SECONDS}초 초과마다 상대 +1점 · 메인 시간 소진 시 시간패`,
    });
}

export function pgJoin(parts: string[], sep = ' · '): string {
    return parts.filter(Boolean).join(sep);
}

export { translateGameMode };
