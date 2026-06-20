import { Player, type BoardState, type LiveGameSession, type Point } from '../../types/index.js';

export type PlacementOccupancySession = Pick<
    LiveGameSession,
    'moveHistory' | 'hiddenMoves' | 'permanentlyRevealedStones' | 'baseStones' | 'baseStones_p1' | 'baseStones_p2' | 'gameStatus'
> & {
    aiInitialHiddenStone?: Point | null;
};

export function isPermanentlyRevealedAt(
    permanentlyRevealedStones: Point[] | undefined,
    x: number,
    y: number,
): boolean {
    return !!permanentlyRevealedStones?.some((p) => p.x === x && p.y === y);
}

/** aiInitialHiddenStone 좌표가 아직 공개되지 않았으면 해당 칸은 상대 돌이 있는 것으로 본다. */
export function isUnrevealedAiInitialHiddenAt(session: PlacementOccupancySession, x: number, y: number): boolean {
    const aiHidden = session.aiInitialHiddenStone;
    if (!aiHidden || aiHidden.x !== x || aiHidden.y !== y) return false;
    return !isPermanentlyRevealedAt(session.permanentlyRevealedStones, x, y);
}

/**
 * 착수 검증용 실제 점유 색.
 * 히든 돌도 boardState에 존재하는 일반 돌과 동일하게 취급한다(상대에게만 안 보일 뿐).
 */
export function getPlacementOccupant(
    boardState: BoardState,
    session: PlacementOccupancySession,
    x: number,
    y: number,
    opponentPlayer: Player,
): Player {
    const onBoard = boardState[y]?.[x] ?? Player.None;
    if (onBoard !== Player.None) return onBoard;
    if (isUnrevealedAiInitialHiddenAt(session, x, y)) return opponentPlayer;
    return Player.None;
}

export function getPlacementOccupancyBlockReason(
    boardState: BoardState,
    session: PlacementOccupancySession,
    x: number,
    y: number,
    myPlayer: Player,
): 'own' | 'opponent' | null {
    const opponent = myPlayer === Player.Black ? Player.White : Player.Black;
    const occupant = getPlacementOccupant(boardState, session, x, y, opponent);
    if (occupant === myPlayer) return 'own';
    if (occupant === opponent) return 'opponent';
    return null;
}
