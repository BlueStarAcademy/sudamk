import { LiveGameSession, Player, Point } from '../types/index.js';

export function isHiddenMoveIndexSoftRevealedByAnyPlayer(
    game: LiveGameSession,
    moveIndex: number
): boolean {
    const rhm = game.revealedHiddenMoves;
    if (!rhm) return false;
    for (const idxs of Object.values(rhm)) {
        if (Array.isArray(idxs) && idxs.includes(moveIndex)) return true;
    }
    return false;
}

export type HiddenRevealStone = { point: Point; player: Player };

/**
 * 시드 좌표에 연관된 플레이어의 미공개 히든을 전부 포함해 전체공개 연출 목록을 만든다.
 */
export function expandToAllUnrevealedHiddenStonesForPlayers(
    game: LiveGameSession,
    seedStones: HiddenRevealStone[],
    options?: {
        aiPlayerEnum?: Player;
        isHiddenMoveIndexSoftRevealed?: (game: LiveGameSession, moveIndex: number) => boolean;
    }
): HiddenRevealStone[] {
    if (!seedStones.length) return seedStones;

    const revealByPoint = new Map<string, HiddenRevealStone>();
    for (const stone of seedStones) {
        revealByPoint.set(`${stone.point.x},${stone.point.y}`, stone);
    }
    const targetPlayers = new Set<Player>(seedStones.map((s) => s.player));
    const revealedPoints = new Set<string>(
        (game.permanentlyRevealedStones || []).map((p) => `${p.x},${p.y}`)
    );
    const softRevealed =
        options?.isHiddenMoveIndexSoftRevealed ?? isHiddenMoveIndexSoftRevealedByAnyPlayer;

    if (game.hiddenMoves && game.moveHistory) {
        for (const moveIndexStr of Object.keys(game.hiddenMoves)) {
            const moveIndex = Number.parseInt(moveIndexStr, 10);
            if (!game.hiddenMoves[moveIndex]) continue;
            const move = game.moveHistory[moveIndex];
            if (!move || move.x < 0 || move.y < 0 || !targetPlayers.has(move.player)) continue;
            if (game.boardState[move.y]?.[move.x] !== move.player) continue;
            if (revealedPoints.has(`${move.x},${move.y}`)) continue;
            if (softRevealed(game, moveIndex)) continue;
            revealByPoint.set(`${move.x},${move.y}`, { point: { x: move.x, y: move.y }, player: move.player });
        }
    }

    const mergeStonePointsIntoReveal = (
        points: Array<Point & { player?: Player }> | undefined,
    ) => {
        if (!Array.isArray(points) || points.length === 0) return;
        for (const point of points) {
            const player = point.player ?? Player.None;
            if (player === Player.None || !targetPlayers.has(player)) continue;
            if (game.boardState[point.y]?.[point.x] !== player) continue;
            if (revealedPoints.has(`${point.x},${point.y}`)) continue;
            revealByPoint.set(`${point.x},${point.y}`, { point: { x: point.x, y: point.y }, player });
        }
    };

    mergeStonePointsIntoReveal(
        (game as { humanHiddenStonePoints?: Array<Point & { player?: Player }> }).humanHiddenStonePoints,
    );
    mergeStonePointsIntoReveal(
        (game as { aiHiddenStonePoints?: Array<Point & { player?: Player }> }).aiHiddenStonePoints,
    );

    const aiHidden = (game as { aiInitialHiddenStone?: Point }).aiInitialHiddenStone;
    const aiPlayer = options?.aiPlayerEnum ?? Player.None;
    if (
        aiHidden &&
        aiPlayer !== Player.None &&
        targetPlayers.has(aiPlayer) &&
        !revealedPoints.has(`${aiHidden.x},${aiHidden.y}`) &&
        game.boardState[aiHidden.y]?.[aiHidden.x] !== Player.None
    ) {
        revealByPoint.set(`${aiHidden.x},${aiHidden.y}`, {
            point: { x: aiHidden.x, y: aiHidden.y },
            player: aiPlayer,
        });
    }

    return Array.from(revealByPoint.values());
}
