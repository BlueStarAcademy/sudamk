import { Player, type BoardState, type LiveGameSession, type Point } from '../../types/index.js';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from './baseHiddenMoveIndex.js';

export type PlacementOccupancySession = Pick<
    LiveGameSession,
    'moveHistory' | 'hiddenMoves' | 'permanentlyRevealedStones' | 'baseStones' | 'baseStones_p1' | 'baseStones_p2' | 'gameStatus'
> & {
    aiInitialHiddenStone?: Point | null;
    aiHiddenStonePoints?: Array<Point & { player?: Player }> | null;
    humanHiddenStonePoints?: Array<Point & { player?: Player }> | null;
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

/** PVE·온라인 공통: 상대 히든 돌(미공개) 교차점을 유저가 착수하려 할 때 공개 연출을 트리거해야 하는지 */
export function isUnrevealedOpponentHiddenStoneAt(
    boardState: BoardState,
    session: PlacementOccupancySession,
    x: number,
    y: number,
    myPlayer: Player,
): boolean {
    if (myPlayer !== Player.Black && myPlayer !== Player.White) return false;
    if (isPermanentlyRevealedAt(session.permanentlyRevealedStones, x, y)) return false;

    const opponent = myPlayer === Player.Black ? Player.White : Player.Black;
    if (isUnrevealedAiInitialHiddenAt(session, x, y)) return true;

    const aiHiddenPoints = session.aiHiddenStonePoints;
    if (
        Array.isArray(aiHiddenPoints) &&
        aiHiddenPoints.some(
            (p) => p.x === x && p.y === y && (p.player === undefined || p.player === opponent),
        ) &&
        boardState[y]?.[x] === opponent
    ) {
        return true;
    }

    if (!session.moveHistory?.length || !session.hiddenMoves) return false;
    const moveIndex = findLatestMoveIndexAtExcludingRecordedBaseStones(
        session.moveHistory,
        x,
        y,
        opponent,
        session,
    );
    if (moveIndex === -1 || !session.hiddenMoves[moveIndex]) return false;
    return boardState[y]?.[x] === opponent;
}
