import type { LiveGameSession, Point } from '../types/entities.js';
import { Player, AlkkagiLayoutType } from '../types/enums.js';
import { BATTLE_PLACEMENT_ZONES } from '../constants/gameSettings.js';
import { nextAlkkagiStoneId } from './alkkagiStoneId.js';

export const ALKKAGI_BOARD_SIZE_PX = 840;
export const ALKKAGI_STONE_RADIUS = (840 / 19) * 0.47;

export function isAlkkagiPlacementValid(
    game: LiveGameSession,
    point: Point,
    player: Player,
): boolean {
    if (player === Player.None) return false;

    const { settings } = game;
    const boardSizePx = ALKKAGI_BOARD_SIZE_PX;
    const stoneRadius = ALKKAGI_STONE_RADIUS;
    const { x: svgX, y: svgY } = point;

    if (svgX < stoneRadius || svgX > boardSizePx - stoneRadius || svgY < stoneRadius || svgY > boardSizePx - stoneRadius) {
        return false;
    }

    let inZone = false;
    if (settings.alkkagiLayout === AlkkagiLayoutType.Battle) {
        const zones = BATTLE_PLACEMENT_ZONES[player as keyof typeof BATTLE_PLACEMENT_ZONES];
        inZone = zones.some((zone) => {
            const cellSize = boardSizePx / 19;
            const padding = cellSize / 2;
            const zoneXStart = padding + (zone.x - 0.5) * cellSize;
            const zoneYStart = padding + (zone.y - 0.5) * cellSize;
            const zoneXEnd = zoneXStart + zone.width * cellSize;
            const zoneYEnd = zoneYStart + zone.height * cellSize;
            return svgX >= zoneXStart && svgX <= zoneXEnd && svgY >= zoneYStart && svgY <= zoneYEnd;
        });
    } else {
        const whiteZoneMinY = boardSizePx * 0.15;
        const whiteZoneMaxY = boardSizePx * 0.35;
        const blackZoneMinY = boardSizePx * 0.65;
        const blackZoneMaxY = boardSizePx * 0.85;

        if (player === Player.White) {
            if (svgY >= whiteZoneMinY && svgY <= whiteZoneMaxY) inZone = true;
        } else if (svgY >= blackZoneMinY && svgY <= blackZoneMaxY) {
            inZone = true;
        }
    }
    if (!inZone) return false;

    const allStones = [
        ...(game.alkkagiStones || []),
        ...(game.alkkagiStones_p1 || []),
        ...(game.alkkagiStones_p2 || []),
    ];
    for (const stone of allStones) {
        if (Math.hypot(svgX - stone.x, svgY - stone.y) < stoneRadius * 2) {
            return false;
        }
    }
    return true;
}

export function alkkagiPlacedCountForUser(game: LiveGameSession, userId: string): number {
    return game.alkkagiStonesPlacedThisRound?.[userId] ?? 0;
}

/** 클라이언트 낙관적 배치 — 서버 ALKKAGI_PLACE_STONE과 동일한 필드 갱신 */
export function applyOptimisticAlkkagiPlaceStone(
    game: LiveGameSession,
    userId: string,
    point: Point,
): LiveGameSession | null {
    const myPlayerEnum =
        userId === game.blackPlayerId
            ? Player.Black
            : userId === game.whitePlayerId
              ? Player.White
              : Player.None;
    if (myPlayerEnum === Player.None) return null;

    const isSimultaneous = game.gameStatus === 'alkkagi_simultaneous_placement';
    if (game.gameStatus !== 'alkkagi_placement' && !isSimultaneous) return null;
    if (!isSimultaneous && game.currentPlayer !== myPlayerEnum) return null;

    const targetPlacements = game.settings.alkkagiStoneCount || 5;
    const newPlacedThisPhase = alkkagiPlacedCountForUser(game, userId);
    if (newPlacedThisPhase >= targetPlacements) return null;
    if (!isAlkkagiPlacementValid(game, point, myPlayerEnum)) return null;

    const newStone = {
        id: nextAlkkagiStoneId(game),
        player: myPlayerEnum,
        x: point.x,
        y: point.y,
        vx: 0,
        vy: 0,
        radius: ALKKAGI_STONE_RADIUS,
        onBoard: true as const,
    };

    const next: LiveGameSession = { ...game };
    if (isSimultaneous) {
        const playerStonesKey = userId === game.player1.id ? 'alkkagiStones_p1' : 'alkkagiStones_p2';
        next[playerStonesKey] = [...(game[playerStonesKey] || []), newStone];
    } else {
        next.alkkagiStones = [...(game.alkkagiStones || []), newStone];
        next.currentPlayer = myPlayerEnum === Player.Black ? Player.White : Player.Black;
    }
    next.alkkagiStonesPlacedThisRound = {
        ...(game.alkkagiStonesPlacedThisRound || {}),
        [userId]: newPlacedThisPhase + 1,
    };
    return next;
}
