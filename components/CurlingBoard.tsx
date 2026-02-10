import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { AlkkagiStone, GameStatus, Player, Point, LiveGameSession, UserWithStatus } from '../types.js';
import { PLAYFUL_GAME_MODES } from '../constants/gameModes';

export interface CurlingBoardHandle {
    updateLocalStones: (newStones: AlkkagiStone[]) => void;
    getSvg: () => SVGSVGElement | null;
}

interface CurlingBoardProps {
    stones: AlkkagiStone[];
    gameStatus: GameStatus;
    myPlayer: Player;
    currentPlayer: Player;
    onLaunchAreaInteractionStart: (e: React.MouseEvent | React.TouchEvent, area: { x: number; y: number; player: Player; }) => void;
    isSpectator: boolean;
    dragStartPoint: Point | null; // Screen coordinates
    dragEndPoint: Point | null; // Screen coordinates
    selectedStone: AlkkagiStone | null;
    activeCurlingItems: LiveGameSession['activeCurlingItems'];
    currentUser: UserWithStatus;
    session: LiveGameSession; // Added for active items
    isRotated?: boolean; // Whether the board is rotated 180 degrees
}


const CurlingBoard = forwardRef<CurlingBoardHandle, CurlingBoardProps>((props, ref) => {
    const { stones, gameStatus, myPlayer, currentPlayer, onLaunchAreaInteractionStart, isSpectator, dragStartPoint, dragEndPoint, selectedStone, currentUser, session, isRotated = false } = props;
    const [localStones, setLocalStones] = useState(stones);
    const svgRef = useRef<SVGSVGElement>(null);

    const boardSizePx = 840;
    const safeBoardSize = 19;
    const cellSize = boardSizePx / safeBoardSize;
    const padding = cellSize / 2;
    const center = { x: boardSizePx / 2, y: boardSizePx / 2 };

    useEffect(() => {
        setLocalStones(stones);
    }, [stones]);

    useImperativeHandle(ref, () => ({
        updateLocalStones: (newStones) => {
            setLocalStones([...newStones]);
        },
        getSvg: () => svgRef.current,
    }));
    
    const starPoints = useMemo(() => {
        if (safeBoardSize === 19) return [{ x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 }, { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 }];
        if (safeBoardSize === 13) return [{ x: 3, y: 3 }, { x: 9, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 6, y: 6 }];
        if (safeBoardSize === 11) return [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 2, y: 8 }, { x: 8, y: 8 }, { x: 5, y: 5 }];
        if (safeBoardSize === 9) return [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 4, y: 4 }];
        return [];
    }, [safeBoardSize]);

    const toSvgCoords = (p: Point) => ({
      cx: padding + p.x * cellSize,
      cy: padding + p.y * cellSize,
    });
    
    const dragLine = useMemo(() => {
        if (!dragStartPoint || !dragEndPoint || !selectedStone || !svgRef.current) return null;
        const svg = svgRef.current;
        const ctm = svg.getScreenCTM()?.inverse();
        if (!ctm) return null;
        
        const pt = svg.createSVGPoint();
        pt.x = dragStartPoint.x;
        pt.y = dragStartPoint.y;
        const svgDragStart = pt.matrixTransform(ctm);

        pt.x = dragEndPoint.x;
        pt.y = dragEndPoint.y;
        const svgDragEnd = pt.matrixTransform(ctm);

        const dx = svgDragEnd.x - svgDragStart.x;
        const dy = svgDragEnd.y - svgDragStart.y;
        
        const currentStone = selectedStone;
        
        // 회전된 보드에서는 화살표 방향도 반대로 표시해야 함
        // 화면에서 위로 드래그 (dy < 0) = 서버 좌표계에서 아래로 발사 (vy > 0)
        // 화면에서 아래로 드래그 (dy > 0) = 서버 좌표계에서 위로 발사 (vy < 0)
        // 따라서 회전된 보드에서는 dx와 dy의 부호를 반대로 해야 함
        const adjustedDx = isRotated ? -dx : dx;
        const adjustedDy = isRotated ? -dy : dy;
        
        const svgStart = { x: currentStone.x, y: currentStone.y };
        let svgEnd = { x: svgStart.x - adjustedDx, y: svgStart.y - adjustedDy };
        
        const myActiveItems = session.activeCurlingItems?.[currentUser.id] || [];
        const isAimingLineActive = myActiveItems.includes('aimingLine');
        const baseArrowLength = 80 * 0.2;
        const maxArrowLength = isAimingLineActive ? baseArrowLength * 11 : baseArrowLength;

        const vectorX = svgEnd.x - svgStart.x;
        const vectorY = svgEnd.y - svgStart.y;
        const magnitude = Math.hypot(vectorX, vectorY);

        if (magnitude > maxArrowLength) {
            svgEnd.x = svgStart.x + (vectorX / magnitude) * maxArrowLength;
            svgEnd.y = svgStart.y + (vectorY / magnitude) * maxArrowLength;
        }
        
        return { start: svgStart, end: svgEnd };
    }, [dragStartPoint, dragEndPoint, selectedStone, session.activeCurlingItems, currentUser.id, isRotated]);


    const renderHouse = () => {
        const radii = [cellSize * 6, cellSize * 4, cellSize * 2, cellSize * 0.5];
        const colors = ['rgba(0, 100, 255, 0.2)', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 0, 0, 0.2)', 'white'];
        return (
            <g>
                {radii.map((r, i) => (
                    <circle key={i} cx={center.x} cy={center.y} r={r} fill={colors[i]} />
                ))}
                <line x1={0} y1={center.y} x2={boardSizePx} y2={center.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <line x1={center.x} y1={0} x2={center.x} y2={boardSizePx} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            </g>
        );
    }
    
    const canLaunch = !isSpectator && gameStatus === 'curling_playing' && myPlayer === currentPlayer;
    const launchAreaCellSize = 1;
    const launchAreaPx = launchAreaCellSize * cellSize;
    
    // 백 플레이어가 보드를 180도 회전해서 보면, 백 플레이어의 발사 영역이 화면 상단에 보이도록 함
    const launchAreas = useMemo(() => {
        if (isRotated && myPlayer === Player.White) {
            // 백 플레이어가 회전된 보드를 볼 때: 백 플레이어의 발사 영역을 상단에 표시
            return [
                { x: padding, y: padding, player: Player.White }, // Top-left (화면 상단)
                { x: boardSizePx - padding - launchAreaPx, y: padding, player: Player.White }, // Top-right (화면 상단)
                { x: padding, y: boardSizePx - padding - launchAreaPx, player: Player.Black }, // Bottom-left
                { x: boardSizePx - padding - launchAreaPx, y: boardSizePx - padding - launchAreaPx, player: Player.Black }, // Bottom-right
            ];
        } else {
            // 기본 배치: 백 플레이어는 상단, 흑 플레이어는 하단
            return [
                { x: padding, y: padding, player: Player.White }, // Top-left
                { x: boardSizePx - padding - launchAreaPx, y: padding, player: Player.White }, // Top-right
                { x: padding, y: boardSizePx - padding - launchAreaPx, player: Player.Black }, // Bottom-left
                { x: boardSizePx - padding - launchAreaPx, y: boardSizePx - padding - launchAreaPx, player: Player.Black }, // Bottom-right
            ];
        }
    }, [isRotated, myPlayer, padding, launchAreaPx, boardSizePx]);

    return (
        <div
            className={`relative w-full h-full shadow-2xl rounded-lg overflow-hidden border-4 border-gray-800`}
        >
            <svg
                ref={svgRef}
                viewBox={`0 0 ${boardSizePx} ${boardSizePx}`}
                className="w-full h-full"
            >
                <defs>
                    <radialGradient id={`gloss-curling-1`}><stop offset="10%" stopColor="#333"/><stop offset="95%" stopColor="#000"/></radialGradient>
                    <radialGradient id={`gloss-curling-2`}><stop offset="10%" stopColor="#fff"/><stop offset="95%" stopColor="#ccc"/></radialGradient>
                    <marker id="arrowhead-curling" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="rgba(239, 68, 68, 0.9)" /></marker>
                </defs>
                
                 {/* 바둑판 배경은 항상 노란색으로 표시 */}
                 <rect width={boardSizePx} height={boardSizePx} fill="#DDAA77" />

                 {Array.from({ length: safeBoardSize }).map((_, i) => (
                    <g key={i}>
                        <line x1={padding + i * cellSize} y1={padding} x2={padding + i * cellSize} y2={boardSizePx - padding} stroke="#54432a" strokeWidth="1.5" />
                        <line x1={padding} y1={padding + i * cellSize} x2={boardSizePx - padding} y2={padding + i * cellSize} stroke="#54432a" strokeWidth="1.5" />
                    </g>
                ))}
                {starPoints.map((p, i) => <circle key={i} {...toSvgCoords(p)} r={safeBoardSize > 9 ? 5 : 4} fill="#54432a" />)}

                {renderHouse()}
                
                {launchAreas.map((area, i) => {
                    const isMyArea = canLaunch && area.player === myPlayer;
                    const classNames = [
                        isMyArea ? 'cursor-pointer' : 'cursor-default',
                        isMyArea ? 'animate-pulse-white' : ''
                    ].filter(Boolean).join(' ');

                    return (
                        <rect
                            key={`launch-area-${i}`}
                            x={area.x}
                            y={area.y}
                            width={launchAreaPx}
                            height={launchAreaPx}
                            fill={isMyArea ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)'}
                            stroke={isMyArea ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.1)'}
                            strokeWidth={isMyArea ? 3 : 2}
                            rx="5"
                            className={classNames}
                            onMouseDown={isMyArea ? (e) => onLaunchAreaInteractionStart(e, area) : undefined}
                            onTouchStart={isMyArea ? (e) => { e.preventDefault(); onLaunchAreaInteractionStart(e, area); } : undefined}
                        />
                    )
                })}


                {localStones.map(stone => {
                    if (!stone.onBoard) return null;
                    // 회전된 보드에서는 돌 위치를 변환
                    const displayX = isRotated ? boardSizePx - stone.x : stone.x;
                    const displayY = isRotated ? boardSizePx - stone.y : stone.y;
                    return (
                        <g key={stone.id}>
                            <circle cx={displayX} cy={displayY} r={stone.radius} fill={stone.player === Player.Black ? "#111827" : "#f9fafb"} />
                            <circle cx={displayX} cy={displayY} r={stone.radius} fill={`url(#gloss-curling-${stone.player})`} />
                        </g>
                    );
                })}
                
                 {selectedStone && dragLine && (
                    <g opacity="0.7">
                        {/* 회전된 보드에서는 선택된 돌 위치를 변환 */}
                        {(() => {
                            const displayX = isRotated ? boardSizePx - selectedStone.x : selectedStone.x;
                            const displayY = isRotated ? boardSizePx - selectedStone.y : selectedStone.y;
                            return (
                                <>
                                    <circle cx={displayX} cy={displayY} r={selectedStone.radius} fill={selectedStone.player === Player.Black ? "#111827" : "#f9fafb"} />
                                    <circle cx={displayX} cy={displayY} r={selectedStone.radius} fill={`url(#gloss-curling-${selectedStone.player})`} />
                                </>
                            );
                        })()}
                    </g>
                )}


                {dragLine && (
                     <g style={{ pointerEvents: 'none' }}>
                        {/* 회전된 보드에서는 드래그 라인 위치를 변환 */}
                        {(() => {
                            const startX = isRotated ? boardSizePx - dragLine.start.x : dragLine.start.x;
                            const startY = isRotated ? boardSizePx - dragLine.start.y : dragLine.start.y;
                            const endX = isRotated ? boardSizePx - dragLine.end.x : dragLine.end.x;
                            const endY = isRotated ? boardSizePx - dragLine.end.y : dragLine.end.y;
                            return (
                                <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="rgba(239, 68, 68, 0.7)" strokeWidth="4" strokeDasharray="8 4" markerEnd="url(#arrowhead-curling)" />
                            );
                        })()}
                    </g>
                )}
            </svg>
        </div>
    );
});

export default CurlingBoard;