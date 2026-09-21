import { GameMode, Player } from '../types/enums.js';
import type { Move, Point } from '../types/enums.js';
import type {
    GameRecordBoardExtras,
    GameRecordMissileEvent,
    GameRecordSetupStone,
    LiveGameSession,
} from '../types/entities.js';
import { mixGoOrPureModeIncludes, mixGoUniqueCombinableModes } from './mixGoRules.js';
import { countNonPassMoves, isPassMove } from './gameRecordSessionEvents.js';

export type UniformKifuViewMode = 'black' | 'white' | 'actual';

export function gameRecordUsesUniformView(
    mode: unknown,
    extras?: Pick<GameRecordBoardExtras, 'uniformStoneDisplayColor' | 'mixedModes'> | null,
): boolean {
    if (
        extras?.uniformStoneDisplayColor === Player.Black ||
        extras?.uniformStoneDisplayColor === Player.White
    ) {
        return true;
    }
    return mixGoOrPureModeIncludes(mode, extras?.mixedModes, GameMode.Uniform);
}

export function defaultUniformKifuView(
    extras?: Pick<GameRecordBoardExtras, 'uniformStoneDisplayColor'> | null,
): UniformKifuViewMode {
    return extras?.uniformStoneDisplayColor === Player.White ? 'white' : 'black';
}

export function applyUniformKifuViewToExtras(
    extras: GameRecordBoardExtras | undefined,
    view: UniformKifuViewMode,
): GameRecordBoardExtras | undefined {
    const uniformStoneDisplayColor =
        view === 'actual' ? undefined : view === 'white' ? Player.White : Player.Black;
    if (!extras && uniformStoneDisplayColor === undefined) return extras;
    return {
        ...(extras ?? {}),
        uniformStoneDisplayColor,
    };
}

function clonePoint(p: Point): Point {
    return { x: p.x, y: p.y };
}

export function restoreMoveHistoryCoordsFromMissileEvents(
    moveHistory: Move[] | null | undefined,
    missileEvents: GameRecordMissileEvent[] | null | undefined,
): Move[] {
    const history = (moveHistory ?? []).map((m) => ({ ...m }));
    if (!missileEvents?.length) return history;
    for (let i = missileEvents.length - 1; i >= 0; i--) {
        const ev = missileEvents[i]!;
        if (ev.moveIndex < 0 || !history[ev.moveIndex]) continue;
        history[ev.moveIndex] = {
            ...history[ev.moveIndex]!,
            x: ev.from.x,
            y: ev.from.y,
        };
    }
    return history;
}

export function restoreBaseStonesFromMissileEvents(
    baseStones: LiveGameSession['baseStones'] | null | undefined,
    missileEvents: GameRecordMissileEvent[] | null | undefined,
): NonNullable<LiveGameSession['baseStones']> {
    const stones = (baseStones ?? []).map((s) => ({ ...s }));
    if (!missileEvents?.length) return stones;
    for (let i = missileEvents.length - 1; i >= 0; i--) {
        const ev = missileEvents[i]!;
        const idx = stones.findIndex((s) => s.x === ev.to.x && s.y === ev.to.y && s.player === ev.player);
        if (idx === -1) continue;
        stones[idx] = { ...stones[idx]!, x: ev.from.x, y: ev.from.y };
    }
    return stones;
}

function mapHiddenMovesToSgfIndices(
    moveHistory: Move[],
    hiddenMoves: LiveGameSession['hiddenMoves'] | null | undefined,
): number[] {
    if (!hiddenMoves) return [];
    const indices: number[] = [];
    let sgfIndex = 0;
    for (let i = 0; i < moveHistory.length; i++) {
        const move = moveHistory[i]!;
        if (isPassMove(move)) continue;
        if (hiddenMoves[i] || hiddenMoves[String(i) as unknown as number]) {
            indices.push(sgfIndex);
        }
        sgfIndex += 1;
    }
    return indices;
}

export function buildGameRecordBoardExtras(game: LiveGameSession): GameRecordBoardExtras | undefined {
    const restoredHistory = restoreMoveHistoryCoordsFromMissileEvents(game.moveHistory, game.missileEvents);
    const originBaseStones = restoreBaseStonesFromMissileEvents(game.baseStones, game.missileEvents);
    const setupStones: GameRecordSetupStone[] = originBaseStones.map((s) => ({
        x: s.x,
        y: s.y,
        player: s.player,
        isBase: true,
    }));
    const mixedModes = mixGoUniqueCombinableModes(game.settings?.mixedModes);
    const hiddenMoveIndices = mapHiddenMovesToSgfIndices(restoredHistory, game.hiddenMoves);
    const extras: GameRecordBoardExtras = {};

    if (mixedModes.length > 0) extras.mixedModes = mixedModes;
    if (game.uniformStoneDisplayColor === Player.Black || game.uniformStoneDisplayColor === Player.White) {
        extras.uniformStoneDisplayColor = game.uniformStoneDisplayColor;
    }
    if (setupStones.length > 0) extras.setupStones = setupStones;
    if (hiddenMoveIndices.length > 0) extras.hiddenMoveIndices = hiddenMoveIndices;
    if (game.missileEvents?.length) {
        extras.missileEvents = game.missileEvents.map((ev) => ({
            ...ev,
            from: clonePoint(ev.from),
            to: clonePoint(ev.to),
            captured: ev.captured?.map(clonePoint),
        }));
    }
    if (game.scanEvents?.length) {
        extras.scanEvents = game.scanEvents.map((ev) => ({ ...ev }));
    }
    if (game.castleStonePoints?.length) {
        extras.castleStonePoints = game.castleStonePoints.map(clonePoint);
    }
    if (game.chessSetup?.length) {
        extras.chessSetup = game.chessSetup.map((p) => ({ ...p }));
    }
    if (game.chessEvents?.length) {
        extras.chessEvents = game.chessEvents.map((ev) => ({
            ...ev,
            from: clonePoint(ev.from),
            to: clonePoint(ev.to),
        }));
    }

    if (Object.keys(extras).length === 0) return undefined;
    return extras;
}

export function historyNonPassCountAtIndex(moveHistory: Move[], indexInclusive: number): number {
    let n = 0;
    const end = Math.min(indexInclusive + 1, moveHistory.length);
    for (let i = 0; i < end; i++) {
        if (!isPassMove(moveHistory[i])) n += 1;
    }
    return n;
}

export { countNonPassMoves, isPassMove };
