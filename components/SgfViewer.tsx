import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Player, Point } from '../types.js';
import {
    applyMoveToBoard,
    applySgfMoveToBoard,
    buildBoardFromMoves,
    createEmptyBoard,
    type SgfMoveLike,
} from '../utils/sgfBoardLogic.js';
import { GoStoneSvgDefs, GoStoneSvgLayers, useGoStoneSvgIds } from './game/goStoneSvgShared.js';

export type SgfMove = SgfMoveLike;
export { applyMoveToBoard, applySgfMoveToBoard, buildBoardFromMoves, createEmptyBoard } from '../utils/sgfBoardLogic.js';

export interface SgfData {
    boardSize: number;
    moves: SgfMove[];
}

interface SgfViewerProps {
    timeElapsed?: number;
    fileIndex?: number | null;
    showLastMoveOnly?: boolean;
    sgfContent?: string | null;
    isRotated?: boolean;
    /** 저장 기보 재생: 0=빈 판, N=앞에서부터 N수까지 표시. 지정 시 timeElapsed 비율 계산은 사용하지 않음 */
    replayMoveCount?: number;
    /** 인게임 GoBoard와 동일한 viewBox 크기(기본 840) */
    boardSizePx?: number;
    /** 저장 기보 재생: 바둑돌 위 수순 번호 표시 */
    showMoveNumbers?: boolean;
    /** 놓아보기: 교차점 클릭으로 돌 배치 */
    interactive?: boolean;
    onIntersectionClick?: (point: Point) => void;
    /** 바둑판 중심 기준 좌/우 클릭으로 1수 이전·다음 */
    onHalfBoardNavBack?: () => void;
    onHalfBoardNavForward?: () => void;
    /** 놓아보기로 추가한 수 (기보 수 위에 반투명 표시) */
    reviewMoves?: SgfMove[];
    /** 길드 보스 연출용: 돌 그림자·하이라이트로 입체감 강화 */
    atmosphereStones?: boolean;
}

const parseSgfCoord = (coords: string): Point => ({
    x: coords.charCodeAt(0) - 'a'.charCodeAt(0),
    y: coords.charCodeAt(1) - 'a'.charCodeAt(0),
});

export const parseSgf = (sgfText: string): SgfData | null => {
    try {
        const boardSizeMatch = sgfText.match(/SZ\[(\d+)\]/);
        const boardSize = boardSizeMatch ? parseInt(boardSizeMatch[1], 10) : 19;

        const moves: SgfMove[] = [];
        const nodeRegex = /;([BW])\[([a-s]{2})\]([^;]*)/g;
        let match;

        while ((match = nodeRegex.exec(sgfText)) !== null) {
            const player = match[1] === 'B' ? Player.Black : Player.White;
            const { x, y } = parseSgfCoord(match[2]);
            const tail = match[3] ?? '';
            const removed: Point[] = [];
            const aeRegex = /AE\[([a-s]{2})\]/g;
            let aeMatch;
            while ((aeMatch = aeRegex.exec(tail)) !== null) {
                removed.push(parseSgfCoord(aeMatch[1]));
            }
            moves.push({ player, x, y, removed: removed.length > 0 ? removed : undefined });
        }

        return { boardSize, moves };
    } catch (error) {
        console.error('Failed to parse SGF:', error);
        return null;
    }
};

const SgfViewer: React.FC<SgfViewerProps> = ({
    timeElapsed = 0,
    fileIndex,
    showLastMoveOnly,
    sgfContent,
    isRotated = false,
    replayMoveCount,
    boardSizePx = 840,
    showMoveNumbers = false,
    interactive = false,
    onIntersectionClick,
    onHalfBoardNavBack,
    onHalfBoardNavForward,
    reviewMoves = [],
    atmosphereStones = false,
}) => {
    const { t } = useTranslation('game');
    const [sgfData, setSgfData] = useState<SgfData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const stoneSvgIds = useGoStoneSvgIds();

    const totalDuration = 50;

    useEffect(() => {
        const fetchSgf = async () => {
            setLoading(true);
            setError(null);

            if (sgfContent !== null && sgfContent !== undefined) {
                try {
                    const parsed = parseSgf(sgfContent);
                    if (!parsed) throw new Error('Failed to parse SGF data.');
                    setSgfData(parsed);
                } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Parse error');
                } finally {
                    setLoading(false);
                }
                return;
            }

            if (fileIndex === null || fileIndex === undefined) {
                setSgfData({ boardSize: 19, moves: [] });
                setLoading(false);
                return;
            }

            const url = `/sgf/Gibo${fileIndex}.sgf`;
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch SGF file: ${response.statusText}`);
                const text = await response.text();
                const parsed = parseSgf(text);
                if (!parsed) throw new Error('Failed to parse SGF data.');
                setSgfData(parsed);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Fetch error');
            } finally {
                setLoading(false);
            }
        };
        fetchSgf();
    }, [fileIndex, sgfContent]);

    const currentMoveIndex = useMemo(() => {
        if (!sgfData) return 0;
        if (showLastMoveOnly) return sgfData.moves.length;
        if (replayMoveCount !== undefined) {
            const n = sgfData.moves.length;
            return Math.max(0, Math.min(replayMoveCount, n));
        }
        if (timeElapsed <= 0) return 0;
        const progress = Math.max(0, Math.min(1, timeElapsed / totalDuration));
        const moveCount = Math.max(1, Math.floor(progress * sgfData.moves.length));
        return Math.min(moveCount, sgfData.moves.length);
    }, [timeElapsed, sgfData, totalDuration, showLastMoveOnly, replayMoveCount]);

    const boardState = useMemo(() => {
        if (!sgfData) return [];
        return buildBoardFromMoves(sgfData.boardSize, sgfData.moves, currentMoveIndex);
    }, [currentMoveIndex, sgfData]);

    const displayBoard = useMemo(() => {
        if (!sgfData || reviewMoves.length === 0) return boardState;
        const b = boardState.map((row) => [...row]);
        for (const move of reviewMoves) {
            applySgfMoveToBoard(b, move, sgfData.boardSize);
        }
        return b;
    }, [boardState, reviewMoves, sgfData]);

    const starPoints = useMemo(() => {
        const boardSize = sgfData?.boardSize;
        if (!boardSize) return [];
        if (boardSize === 19)
            return [
                { x: 3, y: 3 },
                { x: 9, y: 3 },
                { x: 15, y: 3 },
                { x: 3, y: 9 },
                { x: 9, y: 9 },
                { x: 15, y: 9 },
                { x: 3, y: 15 },
                { x: 9, y: 15 },
                { x: 15, y: 15 },
            ];
        if (boardSize === 13) return [{ x: 3, y: 3 }, { x: 9, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 6, y: 6 }];
        if (boardSize === 11) return [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 8 }, { x: 8, y: 8 }];
        if (boardSize === 9) return [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 6 }, { x: 6, y: 6 }];
        return [];
    }, [sgfData]);

    const screenToBoardPoint = useCallback(
        (clientX: number, clientY: number): Point | null => {
            const svg = svgRef.current;
            const boardSize = sgfData?.boardSize;
            if (!svg || !boardSize) return null;

            const rect = svg.getBoundingClientRect();
            const W = rect.width;
            const H = rect.height;
            if (W <= 0 || H <= 0) return null;

            const vb = boardSizePx;
            const s = Math.min(W / vb, H / vb);
            const ox = rect.left + (W - vb * s) / 2;
            const oy = rect.top + (H - vb * s) / 2;
            let rootX = (clientX - ox) / s;
            let rootY = (clientY - oy) / s;

            if (isRotated) {
                const cx = vb / 2;
                const cy = vb / 2;
                rootX = 2 * cx - rootX;
                rootY = 2 * cy - rootY;
            }

            const cellSize = boardSizePx / boardSize;
            const padding = cellSize / 2;
            const fx = (rootX - padding) / cellSize;
            const fy = (rootY - padding) / cellSize;
            const x = Math.max(0, Math.min(boardSize - 1, Math.round(fx)));
            const y = Math.max(0, Math.min(boardSize - 1, Math.round(fy)));
            return { x, y };
        },
        [sgfData, boardSizePx, isRotated],
    );

    const handleBoardPointer = useCallback(
        (e: React.PointerEvent<SVGSVGElement>) => {
            const svg = svgRef.current;
            if (!svg) return;

            const rect = svg.getBoundingClientRect();
            const isLeftHalf = e.clientX < rect.left + rect.width / 2;

            if (interactive && onIntersectionClick) {
                const pt = screenToBoardPoint(e.clientX, e.clientY);
                if (pt && boardState[pt.y]?.[pt.x] === Player.None) {
                    onIntersectionClick(pt);
                    return;
                }
            }

            if (isLeftHalf) {
                onHalfBoardNavBack?.();
            } else {
                onHalfBoardNavForward?.();
            }
        },
        [interactive, onIntersectionClick, onHalfBoardNavBack, onHalfBoardNavForward, screenToBoardPoint, boardState],
    );

    const boardNavEnabled = !!(onHalfBoardNavBack || onHalfBoardNavForward);

    if (loading) return <div className="flex h-full items-center justify-center text-gray-400">{t('sgfViewer.loading')}</div>;
    if (error) return <div className="flex h-full items-center justify-center text-red-400">{t('sgfViewer.errorPrefix')} {error}</div>;
    if (!sgfData) return null;

    const { boardSize, moves } = sgfData;
    const cellSize = boardSizePx / boardSize;
    const padding = cellSize / 2;
    const stoneRadius = cellSize * 0.47;

    const toSvgCoords = (p: Point) => ({
        cx: padding + p.x * cellSize,
        cy: padding + p.y * cellSize,
    });

    const relevantMoves = moves.slice(0, currentMoveIndex);
    const reviewStoneSet = new Set(reviewMoves.map((m) => `${m.x},${m.y}`));

    return (
        <div className="relative h-full w-full overflow-hidden rounded-lg border-2 border-[#54432a]/60 bg-[#1a1510]">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${boardSizePx} ${boardSizePx}`}
                className={`h-full w-full ${interactive ? 'cursor-crosshair' : boardNavEnabled ? 'cursor-pointer' : ''}`}
                onPointerDown={boardNavEnabled || interactive ? handleBoardPointer : undefined}
            >
                <GoStoneSvgDefs ids={stoneSvgIds} />
                <g transform={isRotated ? `rotate(180 ${boardSizePx / 2} ${boardSizePx / 2})` : undefined}>
                    <rect width={boardSizePx} height={boardSizePx} fill="#e0b484" />
                    {Array.from({ length: boardSize }).map((_, i) => (
                        <g key={i}>
                            <line
                                x1={padding + i * cellSize}
                                y1={padding}
                                x2={padding + i * cellSize}
                                y2={boardSizePx - padding}
                                stroke="#54432a"
                                strokeWidth="1.5"
                            />
                            <line
                                x1={padding}
                                y1={padding + i * cellSize}
                                x2={boardSizePx - padding}
                                y2={padding + i * cellSize}
                                stroke="#54432a"
                                strokeWidth="1.5"
                            />
                        </g>
                    ))}
                    {starPoints.map((p, i) => (
                        <circle key={`star-${i}`} {...toSvgCoords(p)} r={boardSize > 9 ? 4 : 3} fill="#54432a" />
                    ))}
                    {displayBoard.map((row, y) =>
                        row.map((player, x) => {
                            if (player === Player.None) return null;
                            const { cx, cy } = toSvgCoords({ x, y });

                            let moveIndex = -1;
                            for (let i = relevantMoves.length - 1; i >= 0; i--) {
                                if (relevantMoves[i].x === x && relevantMoves[i].y === y) {
                                    moveIndex = i;
                                    break;
                                }
                            }

                            const isReviewStone = reviewStoneSet.has(`${x},${y}`) && moveIndex === -1;
                            const isLastReplayMove = moveIndex === currentMoveIndex - 1 && !isReviewStone;

                            const stoneR = atmosphereStones ? stoneRadius * 1.08 : stoneRadius;

                            return (
                                <g
                                    key={`${x}-${y}`}
                                    className={atmosphereStones ? 'sgf-atmosphere-stone' : undefined}
                                    transform={isRotated ? `rotate(180 ${cx} ${cy})` : undefined}
                                >
                                    {atmosphereStones ? (
                                        <>
                                            <ellipse
                                                cx={cx + stoneR * 0.08}
                                                cy={cy + stoneR * 0.42}
                                                rx={stoneR * 0.95}
                                                ry={stoneR * 0.42}
                                                fill="rgba(0, 0, 0, 0.48)"
                                            />
                                            <ellipse
                                                cx={cx}
                                                cy={cy + stoneR * 0.12}
                                                rx={stoneR * 0.98}
                                                ry={stoneR * 0.72}
                                                fill={
                                                    player === Player.Black
                                                        ? 'rgba(15, 23, 42, 0.55)'
                                                        : 'rgba(15, 23, 42, 0.18)'
                                                }
                                            />
                                        </>
                                    ) : null}
                                    <GoStoneSvgLayers
                                        player={player}
                                        cx={cx}
                                        cy={cy - (atmosphereStones ? stoneR * 0.08 : 0)}
                                        radius={stoneR}
                                        ids={stoneSvgIds}
                                        stroke={
                                            isReviewStone
                                                ? '#38bdf8'
                                                : atmosphereStones
                                                  ? player === Player.Black
                                                      ? 'rgba(255,255,255,0.14)'
                                                      : 'rgba(15,23,42,0.22)'
                                                  : undefined
                                        }
                                        strokeWidth={
                                            isReviewStone
                                                ? cellSize * 0.08
                                                : atmosphereStones
                                                  ? Math.max(0.8, stoneR * 0.05)
                                                  : 0
                                        }
                                        opacity={isReviewStone ? 0.92 : 1}
                                    />
                                    {atmosphereStones ? (
                                        <ellipse
                                            cx={cx - stoneR * 0.22}
                                            cy={cy - stoneR * 0.28}
                                            rx={stoneR * 0.38}
                                            ry={stoneR * 0.22}
                                            fill={
                                                player === Player.Black
                                                    ? 'rgba(255, 255, 255, 0.22)'
                                                    : 'rgba(255, 255, 255, 0.55)'
                                            }
                                            opacity={0.85}
                                        />
                                    ) : null}
                                    {showMoveNumbers && moveIndex !== -1 && (
                                        <text
                                            x={cx}
                                            y={cy}
                                            textAnchor="middle"
                                            dy=".35em"
                                            fontSize={stoneR * 1.1}
                                            fontWeight="bold"
                                            fill={player === Player.Black ? 'white' : 'black'}
                                            stroke={player === Player.Black ? '#111827' : '#f5f2e8'}
                                            strokeWidth={stoneR * 0.12}
                                            paintOrder="stroke"
                                        >
                                            {moveIndex + 1}
                                        </text>
                                    )}
                                    {isLastReplayMove && !showMoveNumbers && !atmosphereStones && (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={stoneR * 0.35}
                                            fill="rgba(239, 68, 68, 0.85)"
                                            className="animate-pulse"
                                        />
                                    )}
                                    {isLastReplayMove && !showMoveNumbers && atmosphereStones && (
                                        <ellipse
                                            cx={cx}
                                            cy={cy - stoneR * 0.08}
                                            rx={stoneR * 0.38}
                                            ry={stoneR * 0.26}
                                            fill="rgba(253, 224, 71, 0.75)"
                                            className="animate-pulse"
                                        />
                                    )}
                                </g>
                            );
                        }),
                    )}
                    {interactive &&
                        Array.from({ length: boardSize * boardSize }).map((_, idx) => {
                            const x = idx % boardSize;
                            const y = Math.floor(idx / boardSize);
                            const { cx, cy } = toSvgCoords({ x, y });
                            return (
                                <circle
                                    key={`hit-${x}-${y}`}
                                    cx={cx}
                                    cy={cy}
                                    r={cellSize * 0.48}
                                    fill="transparent"
                                    className="pointer-events-auto"
                                />
                            );
                        })}
                </g>
            </svg>
        </div>
    );
};

export default SgfViewer;
