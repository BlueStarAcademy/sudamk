import type { LiveGameSession } from '../types/index.js';
import type { Point } from '../types/index.js';
import { Player } from '../types/index.js';
import { isIntersectionRecordedAsBaseStone } from './removeCapturedBaseStoneMarkers.js';

export type WeightedJustCapturedEntry = {
    point: Point;
    player: Player;
    wasHidden: boolean;
    capturePoints: number;
    wasBaseStone?: true;
};

/**
 * 서버 `standard.ts` / `strategic.ts` 따내기 가중치와 동일 순서:
 * 배치돌(5) → 상대 문양(2) → 히든·AI초기히든·공개 히든(5) → 일반(1).
 * 낙관적 UI 갱신용 — 세션의 패턴 목록은 읽기만 하고 변경하지 않는다.
 */
export function buildWeightedJustCapturedForStones(
    game: LiveGameSession,
    capturedStones: Point[],
    movePlayer: Player
): { totalPoints: number; entries: WeightedJustCapturedEntry[] } {
    const opponent = movePlayer === Player.Black ? Player.White : Player.Black;
    const cat = String((game as any).gameCategory ?? '');
    const useWeighted =
        !!game.isSinglePlayer ||
        cat === 'guildwar' ||
        cat === 'tower' ||
        cat === 'adventure';

    const entries: WeightedJustCapturedEntry[] = [];
    let totalPoints = 0;

    for (const stone of capturedStones) {
        if (!useWeighted) {
            totalPoints += 1;
            entries.push({
                point: stone,
                player: opponent,
                wasHidden: false,
                capturePoints: 1,
            });
            continue;
        }

        let points = 1;
        let wasHidden = false;
        let wasBaseStone = false;

        if (isIntersectionRecordedAsBaseStone(game, stone.x, stone.y)) {
            wasBaseStone = true;
            points = 5;
        } else {
            const patternList = opponent === Player.Black ? game.blackPatternStones : game.whitePatternStones;
            const isPattern = !!patternList?.some((p) => p.x === stone.x && p.y === stone.y);
            if (isPattern) {
                points = 2;
            } else {
                let moveIndex = -1;
                for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
                    const m = game.moveHistory![i];
                    if (m.x === stone.x && m.y === stone.y && m.player === opponent) {
                        moveIndex = i;
                        break;
                    }
                }
                const wasHiddenMove = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                const wasAiInitialHidden =
                    !!(game as any).aiInitialHiddenStone &&
                    (game as any).aiInitialHiddenStone.x === stone.x &&
                    (game as any).aiInitialHiddenStone.y === stone.y;
                const wasRevealedHidden = !!game.permanentlyRevealedStones?.some(
                    (p) => p.x === stone.x && p.y === stone.y
                );
                wasHidden = wasHiddenMove || wasAiInitialHidden || wasRevealedHidden;
                if (wasHiddenMove || wasAiInitialHidden || wasRevealedHidden) {
                    points = 5;
                }
            }
        }

        totalPoints += points;
        entries.push({
            point: stone,
            player: opponent,
            wasHidden,
            capturePoints: points,
            ...(wasBaseStone ? { wasBaseStone: true as const } : {}),
        });
    }

    return { totalPoints, entries };
}
