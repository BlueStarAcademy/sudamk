import { GameMode, Player } from '../types/enums.js';
import type { LiveGameSession } from '../types/entities.js';
import { mixGoOrPureModeIncludes } from './mixGoRules.js';

export const UNIFORM_COLOR_ROULETTE_MS = 4200;

export function sessionUsesUniformStoneDisplay(
    mode: unknown,
    settings: { mixedModes?: readonly GameMode[] | null } | null | undefined,
): boolean {
    return mixGoOrPureModeIncludes(mode, settings?.mixedModes, GameMode.Uniform);
}

export function assignRandomUniformDisplayColor(game: LiveGameSession): void {
    game.uniformStoneDisplayColor = Math.random() < 0.5 ? Player.Black : Player.White;
}

/** 실제 돌 색 → 일색 바둑 표시 색 */
export function mapStoneToUniformDisplay(actual: Player, uniform?: Player | null): Player {
    if (
        uniform != null &&
        (uniform === Player.Black || uniform === Player.White) &&
        (actual === Player.Black || actual === Player.White)
    ) {
        return uniform;
    }
    return actual;
}

/** 계가·종료·무승부에서는 실제 흑/백 색, 그 외 일색 바둑이면 uniform 색 */
export function resolveUniformStoneDisplayColorForBoard(
    gameStatus: string | undefined,
    uniformStoneDisplayColor?: Player | null,
): Player | null {
    if (gameStatus === 'scoring' || gameStatus === 'ended' || gameStatus === 'no_contest') {
        return null;
    }
    return uniformStoneDisplayColor ?? null;
}

/** 영토·사석 네모 표시 색 — 계가·종료 시 실제 흑/백, 대국 중 일색 바둑이면 단일색 */
export function resolveTerritoryMarkerDisplayPlayer(
    actualPlayer: Player.Black | Player.White,
    gameStatus: string | undefined,
    uniformStoneDisplayColor?: Player | null,
): Player.Black | Player.White {
    const uniform = resolveUniformStoneDisplayColorForBoard(gameStatus, uniformStoneDisplayColor);
    if (uniform == null) return actualPlayer;
    return uniform === Player.Black ? Player.Black : Player.White;
}

export function territoryMarkerRgba(
    displayPlayer: Player.Black | Player.White,
    opacity: number,
    options?: { emphasizeActualColors?: boolean },
): { fill: string; stroke: string } {
    const isBlack = displayPlayer === Player.Black;
    if (isBlack) {
        return {
            fill: `rgba(0, 0, 0, ${opacity})`,
            stroke: `rgba(0, 0, 0, ${opacity * 0.5})`,
        };
    }
    return {
        fill: `rgba(255, 255, 255, ${opacity})`,
        stroke: options?.emphasizeActualColors
            ? `rgba(55, 65, 81, ${Math.min(1, opacity * 0.85)})`
            : `rgba(255, 255, 255, ${opacity * 0.5})`,
    };
}
