
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AlkkagiStone, GameProps, Player, Point, GameStatus } from '../../types.js';
import AlkkagiBoard, { AlkkagiBoardHandle } from '../AlkkagiBoard.js';
import { AttackToTurnGauge } from '../AttackToTurnGauge.js';
import { ALKKAGI_PLACEMENT_TIME_LIMIT, ALKKAGI_TURN_TIME_LIMIT } from '../../constants';
import { audioService } from '../../services/audioService.js';
import { PLAYFUL_GAME_MODES } from '../../constants/gameModes';
import { useSmoothedMobileBoardPan } from '../../hooks/useSmoothedMobileBoardPan.js';
import { findAlkkagiStoneById } from '../../shared/utils/alkkagiStoneId.js';

/** 화면 좌표가 돌 중심(붉은 발사 취소 원) 안인지 — 첫 터치 위치가 아니라 돌 기준으로 판정 */
function isScreenPointInAlkkagiStoneCancelZone(
    screenX: number,
    screenY: number,
    stone: AlkkagiStone,
    svg: SVGSVGElement,
    tolerance = 1.08
): boolean {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return false;
    const scale = rect.width / 840;
    const screenRadius = stone.radius * scale;
    const pt = svg.createSVGPoint();
    pt.x = stone.x;
    pt.y = stone.y;
    const ctm = svg.getScreenCTM();
    if (!ctm) return false;
    const scr = pt.matrixTransform(ctm);
    return Math.hypot(screenX - scr.x, screenY - scr.y) <= screenRadius * tolerance;
}

interface AlkkagiArenaProps extends GameProps {
    /** GameArena에서 전달. 발사 조준 시 좌우 드래그 여유를 위해 판 폭을 줄일 때 사용 */
    isMobile?: boolean;
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const AlkkagiArena: React.FC<AlkkagiArenaProps> = (props) => {
    const { session, onAction, currentUser, isSpectator, isMobile = false } = props;
    const { id: gameId, settings, gameStatus, alkkagiStones, currentPlayer, player1, alkkagiStones_p1, alkkagiStones_p2, activeAlkkagiItems } = session;
    
    const boardRef = useRef<AlkkagiBoardHandle>(null);
    const resetBoardPanRef = useRef<() => void>(() => {});
    const onDragMovePanRef = useRef<(clientX: number, innerWidth: number) => void>(() => {});
    const animationFrameRef = useRef<number | null>(null);
    const powerGaugeAnimFrameRef = useRef<number | null>(null);
    const gaugeStartTimeRef = useRef<number | null>(null);
    const powerGaugeRef = useRef<HTMLDivElement>(null);
    const lastAnimationTimestampRef = useRef(0);
    
    const isDraggingRef = useRef(false);
    const selectedStoneRef = useRef<AlkkagiStone | null>(null);
    const dragStartPointRef = useRef<Point | null>(null);
    /** touchmove 마지막 위치 — 일부 기기에서 touchend 좌표가 어긋날 때 취소 판정 보조 */
    const lastDragEndScreenRef = useRef<Point | null>(null);
    const powerRef = useRef(0);
    
    const [selectedStoneId, setSelectedStoneId] = useState<number | null>(null);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
    const [dragEndPoint, setDragEndPoint] = useState<Point | null>(null);
    const [power, setPower] = useState(0);
    const [flickPower, setFlickPower] = useState<number | null>(null);
    const latestProps = useRef(props);
    useEffect(() => {
        latestProps.current = props;
    });
    
    const prevTurnStartTime = usePrevious(session.turnStartTime);
    const prevGameStatus = usePrevious(session.gameStatus);

    const stopPowerGauge = useCallback(() => {
        if (powerGaugeAnimFrameRef.current) {
            cancelAnimationFrame(powerGaugeAnimFrameRef.current);
            powerGaugeAnimFrameRef.current = null;
        }
        gaugeStartTimeRef.current = null;
    }, []);
    
    const cancelFlick = useCallback(() => {
        isDraggingRef.current = false;
        selectedStoneRef.current = null;
        dragStartPointRef.current = null;
        stopPowerGauge();
        setSelectedStoneId(null);
        setDragStartPoint(null);
        setDragEndPoint(null);
        setPower(0);
        powerRef.current = 0;
        lastDragEndScreenRef.current = null;
        resetBoardPanRef.current();
    }, [stopPowerGauge]);

    useEffect(() => {
        if (session.turnStartTime !== prevTurnStartTime) {
            cancelFlick();
        }
    }, [session.turnStartTime, prevTurnStartTime, cancelFlick]);
    
     useEffect(() => {
        if (prevGameStatus === 'alkkagi_animating' && session.gameStatus !== 'alkkagi_animating') {
            setFlickPower(null);
        }
    }, [session.gameStatus, prevGameStatus]);

    const myPlayerEnum = useMemo(() => (
        session.blackPlayerId === currentUser.id ? Player.Black : (session.whitePlayerId === currentUser.id ? Player.White : Player.None)
    ), [session.blackPlayerId, session.whitePlayerId, currentUser.id]);
    
    const isMyTurn = useMemo(() => {
        if (isSpectator) return false;
        if (gameStatus === 'alkkagi_simultaneous_placement') return true;
        return currentPlayer === myPlayerEnum;
    }, [gameStatus, currentPlayer, myPlayerEnum, isSpectator]);

    const alkkagiMobilePanEnabled = isMobile && gameStatus === 'alkkagi_playing' && !isSpectator && isMyTurn;
    const { panX: dragBoardPanX, onDragMoveClientX, resetPan } = useSmoothedMobileBoardPan({
        boardRef,
        enabled: alkkagiMobilePanEnabled,
    });
    resetBoardPanRef.current = resetPan;
    onDragMovePanRef.current = onDragMoveClientX;

    const shouldRotate = isSpectator ? false : (myPlayerEnum === Player.White);

    const stonesForBoard = useMemo(() => {
        if (gameStatus === 'alkkagi_simultaneous_placement' || gameStatus === 'alkkagi_placement') {
             const myStonesInPlacement = currentUser.id === player1.id ? alkkagiStones_p1 : alkkagiStones_p2;
             return [...(alkkagiStones || []), ...(myStonesInPlacement || [])];
        }
        return alkkagiStones || [];
    }, [gameStatus, alkkagiStones, alkkagiStones_p1, alkkagiStones_p2, currentUser.id, player1.id]);

    const myStonesCount = useMemo(() => {
        const stonesInMainArray = (session.alkkagiStones || []).filter(s => s.player === myPlayerEnum).length;
        if (session.gameStatus === 'alkkagi_simultaneous_placement' || session.gameStatus === 'alkkagi_placement') {
            const stonesInTempArray = (currentUser.id === session.player1.id ? session.alkkagiStones_p1 : session.alkkagiStones_p2)?.length || 0;
            return stonesInMainArray + stonesInTempArray;
        }
        return stonesInMainArray;
    }, [session, currentUser.id, myPlayerEnum]);


    const handlePlacementClick = useCallback((svgPoint: Point) => {
        const { session: currentSession, onAction: currentOnAction } = latestProps.current;
        currentOnAction({ type: 'ALKKAGI_PLACE_STONE', payload: { gameId: currentSession.id, point: svgPoint } });
    }, []);
    
    const startPowerGauge = useCallback(() => {
        stopPowerGauge();
        setFlickPower(null);
        gaugeStartTimeRef.current = performance.now();
    
        const animateGauge = (timestamp: number) => {
            if (!gaugeStartTimeRef.current) {
                gaugeStartTimeRef.current = timestamp;
            }
    
            const { session: currentSession, currentUser: user } = latestProps.current;
            const myActiveItems = currentSession.activeAlkkagiItems?.[user.id] || [];
            const isSlowActive = myActiveItems.includes('slow');
            
            const baseCycleDuration = currentSession.settings.alkkagiGaugeSpeed || 900;
            const cycleDuration = (isSlowActive ? baseCycleDuration * 2 : baseCycleDuration);
            const halfCycle = cycleDuration / 2;
    
            const elapsedTime = timestamp - gaugeStartTimeRef.current;
            const progressInCycle = (elapsedTime % cycleDuration) / halfCycle;
    
            let newPower;
            if (progressInCycle <= 1) {
                newPower = progressInCycle * 100;
            } else {
                newPower = (2 - progressInCycle) * 100;
            }
    
            if (powerGaugeRef.current) {
                powerGaugeRef.current.style.width = `${newPower}%`;
            }
            powerRef.current = newPower;
            powerGaugeAnimFrameRef.current = requestAnimationFrame(animateGauge);
        };
    
        powerGaugeAnimFrameRef.current = requestAnimationFrame(animateGauge);
    }, [stopPowerGauge]);
    
    const runClientAnimation = useCallback((stones: AlkkagiStone[], flickedStoneId: number, vx: number, vy: number) => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        let simStones: AlkkagiStone[] = JSON.parse(JSON.stringify(stones || []));
        let stoneToAnimate = findAlkkagiStoneById(simStones, flickedStoneId);
        if (stoneToAnimate) {
            stoneToAnimate.vx = vx;
            stoneToAnimate.vy = vy;
        } else { return; }

        const boardSizePx = 840;
        const friction = 0.98;
        let iterations = 0;
        const maxIterations = 1000;

        const animate = () => {
            let stonesAreMoving = false;
            
            for (const stone of simStones) {
                if (!stone.onBoard) continue;
                // Use fixed time step logic to match server simulation
                stone.x += stone.vx;
                stone.y += stone.vy;
                stone.vx *= friction;
                stone.vy *= friction;

                if (Math.abs(stone.vx) < 0.01) stone.vx = 0;
                if (Math.abs(stone.vy) < 0.01) stone.vy = 0;
                if (Math.abs(stone.vx) > 0 || Math.abs(stone.vy) > 0) stonesAreMoving = true;
                if (stone.x < 0 || stone.x > boardSizePx || stone.y < 0 || stone.y > boardSizePx) {
                    if (stone.onBoard) { 
                        stone.onBoard = false; 
                        stone.timeOffBoard = Date.now(); 
                        audioService.stoneFallOff(); 
                    }
                }
            }

            for (let i = 0; i < simStones.length; i++) {
                for (let j = i + 1; j < simStones.length; j++) {
                    const s1 = simStones[i]; const s2 = simStones[j];
                    if (!s1.onBoard || !s2.onBoard) continue;
                    const dx = s2.x - s1.x; const dy = s2.y - s1.y;
                    const distance = Math.hypot(dx,dy);
                    const radiiSum = s1.radius + s2.radius;
                    if (distance < radiiSum) {
                        audioService.stoneCollision();
                        const nx = dx / distance; const ny = dy / distance;
                        const dvx = s2.vx - s1.vx; const dvy = s2.vy - s1.vy;
                        const dot = dvx * nx + dvy * ny;
                        if (dot < 0) {
                            const impulse = dot;
                            s1.vx += impulse * nx; s1.vy += impulse * ny;
                            s2.vx -= impulse * nx; s2.vy -= impulse * ny;
                        }
                        const overlap = (radiiSum - distance) / 2;
                        s1.x -= overlap * nx; s1.y -= overlap * ny;
                        s2.x += overlap * nx; s2.y += overlap * ny;
                    }
                }
            }
            
            boardRef.current?.updateLocalStones(simStones);
            iterations++;
            if (stonesAreMoving && iterations < maxIterations) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                animationFrameRef.current = null;
            }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    }, []);


    const handleStoneInteractionStart = useCallback((stone: AlkkagiStone, e: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGGElement>) => {
        e.preventDefault();
        const { session: currentSession, currentUser: user } = latestProps.current;
        const myPlayer = currentSession.blackPlayerId === user.id ? Player.Black : (currentSession.whitePlayerId === user.id ? Player.White : Player.None);
        const currentIsMyTurn = currentSession.currentPlayer === myPlayer;
        if (!currentIsMyTurn || currentSession.gameStatus !== 'alkkagi_playing') return;

        const point = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        
        isDraggingRef.current = true;
        selectedStoneRef.current = stone;
        dragStartPointRef.current = point;
        
        setSelectedStoneId(stone.id);
        setDragStartPoint(point);
        setDragEndPoint(point);
        lastDragEndScreenRef.current = point;
        startPowerGauge();
    }, [startPowerGauge]);
    
    useEffect(() => {
        const handleInteractionMove = (e: MouseEvent | TouchEvent) => {
            if (!isDraggingRef.current) return;
            if ('preventDefault' in e) e.preventDefault();
            const point = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
            setDragEndPoint(point);
            lastDragEndScreenRef.current = point;
            const p = latestProps.current;
            if (!p.isMobile) {
                resetBoardPanRef.current();
                return;
            }
            if (p.session.gameStatus !== 'alkkagi_playing' || p.isSpectator) {
                resetBoardPanRef.current();
                return;
            }
            const myPl =
                p.session.blackPlayerId === p.currentUser.id
                    ? Player.Black
                    : p.session.whitePlayerId === p.currentUser.id
                      ? Player.White
                      : Player.None;
            if (p.session.currentPlayer !== myPl) {
                resetBoardPanRef.current();
                return;
            }
            onDragMovePanRef.current(point.x, typeof window !== 'undefined' ? window.innerWidth : 0);
        };

        const handleInteractionEnd = (e: MouseEvent | TouchEvent) => {
            if (!isDraggingRef.current) return;
            resetBoardPanRef.current();

            const { session: currentSession, onAction: currentOnAction } = latestProps.current;

            const finalSelectedStone = selectedStoneRef.current;
            const finalDragStart = dragStartPointRef.current;
            const finalDragEnd =
                'touches' in e && e.changedTouches.length > 0
                    ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
                    : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

            const svgForCancel = boardRef.current?.getSvg();
            if (finalSelectedStone && svgForCancel) {
                const releasePoints: Point[] = [finalDragEnd];
                if (lastDragEndScreenRef.current) releasePoints.push(lastDragEndScreenRef.current);
                const inCancel = releasePoints.some((p) =>
                    isScreenPointInAlkkagiStoneCancelZone(p.x, p.y, finalSelectedStone, svgForCancel)
                );
                if (inCancel) {
                    lastDragEndScreenRef.current = null;
                    cancelFlick();
                    return;
                }
            }

            stopPowerGauge();
            const finalPower = powerRef.current;
            setFlickPower(finalPower);
            
            if (finalSelectedStone && finalDragStart && finalDragEnd) {
                const svg = boardRef.current?.getSvg();
                if (!svg) {
                    cancelFlick();
                    return;
                }

                const ctm = svg.getScreenCTM()?.inverse();
                if (!ctm) {
                    cancelFlick();
                    return;
                }
                
                const pt = svg.createSVGPoint();

                pt.x = finalDragStart.x;
                pt.y = finalDragStart.y;
                const svgDragStart = pt.matrixTransform(ctm);

                pt.x = finalDragEnd.x;
                pt.y = finalDragEnd.y;
                const svgDragEnd = pt.matrixTransform(ctm);

                const dx = svgDragEnd.x - svgDragStart.x;
                const dy = svgDragEnd.y - svgDragStart.y;
                // 발사 속도: X=-dx, Y=-dy (회전 보드에서도 상하 일치)
                const velocityX = -dx;
                const velocityY = -dy;

                const launchStrength = finalPower / 100 * 25;
                const mag = Math.hypot(velocityX, velocityY);
                
                if (mag > 0) {
                    const vx = (velocityX / mag) * launchStrength;
                    const vy = (velocityY / mag) * launchStrength;
                    currentOnAction({ type: 'ALKKAGI_FLICK_STONE', payload: { gameId: currentSession.id, stoneId: finalSelectedStone.id, vx, vy } });
                }
            }
            
            isDraggingRef.current = false;
            selectedStoneRef.current = null;
            dragStartPointRef.current = null;
            setSelectedStoneId(null);
            setDragStartPoint(null);
            setDragEndPoint(null);
            setPower(0);
            powerRef.current = 0;
            lastDragEndScreenRef.current = null;
            setTimeout(() => setFlickPower(null), 1500);
        };

        const handleContextMenu = (e: MouseEvent) => {
            if (isDraggingRef.current) {
                e.preventDefault();
                cancelFlick();
            }
        };
        
        window.addEventListener('mousemove', handleInteractionMove, { passive: false });
        window.addEventListener('touchmove', handleInteractionMove, { passive: false });
        const handleTouchCancel = () => {
            if (isDraggingRef.current) cancelFlick();
        };

        window.addEventListener('mouseup', handleInteractionEnd);
        window.addEventListener('touchend', handleInteractionEnd);
        window.addEventListener('touchcancel', handleTouchCancel);
        window.addEventListener('contextmenu', handleContextMenu);
        
        return () => {
            window.removeEventListener('mousemove', handleInteractionMove);
            window.removeEventListener('touchmove', handleInteractionMove);
            window.removeEventListener('mouseup', handleInteractionEnd);
            window.removeEventListener('touchend', handleInteractionEnd);
            window.removeEventListener('touchcancel', handleTouchCancel);
            window.removeEventListener('contextmenu', handleContextMenu);
            stopPowerGauge();
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
        }, [stopPowerGauge, cancelFlick]);

    useEffect(() => {
        const { session: currentSession } = latestProps.current;
        const animation = currentSession.animation;
        if (animation?.type === 'alkkagi_flick' && animation.startTime > lastAnimationTimestampRef.current) {
            lastAnimationTimestampRef.current = animation.startTime;
            const { stoneId, vx, vy } = animation;
            runClientAnimation(currentSession.alkkagiStones || [], Number(stoneId), Number(vx), Number(vy));
        }
    }, [session.animation, runClientAnimation]);
    
    const displayedPower = flickPower !== null ? flickPower : power;
    const maxStones = session.settings.alkkagiStoneCount || 5;

    const selectedStoneForRender = useMemo(() => {
        if (selectedStoneId == null) return null;
        return findAlkkagiStoneById(alkkagiStones ?? [], selectedStoneId) ?? null;
    }, [selectedStoneId, alkkagiStones]);

    /** 손가락이 돌 중심(붉은 취소 원) 안에 있으면 발사 취소 상태 */
    const isInCancelZone = useMemo(() => {
        if (!dragEndPoint || !selectedStoneForRender) return false;
        const svg = boardRef.current?.getSvg();
        if (!svg) return false;
        return isScreenPointInAlkkagiStoneCancelZone(dragEndPoint.x, dragEndPoint.y, selectedStoneForRender, svg);
    }, [dragEndPoint, selectedStoneForRender]);

    const backgroundClass = useMemo(() => {
        if (PLAYFUL_GAME_MODES.some(m => m.mode === session.mode)) {
            return 'bg-transparent';
        }
        return 'bg-primary';
    }, [session.mode]);

    const showTurnPassGauge = gameStatus === 'alkkagi_animating' && session.animation?.type === 'alkkagi_flick' && session.animation.startTime != null && session.animation.duration != null;

    /** 모바일 비관전: playing·animating 동일 DOM 트리 유지 — 분기 시 rotate 트랜지션이 매번 재생되어 판이 도는 것처럼 보이던 문제 방지 */
    const mobileAlkkagiStableChrome =
        isMobile && !isSpectator && (gameStatus === 'alkkagi_playing' || gameStatus === 'alkkagi_animating');

    const boardNode = (
        <AlkkagiBoard
            ref={boardRef}
            stones={stonesForBoard}
            gameStatus={gameStatus}
            myPlayer={myPlayerEnum}
            isMyTurn={isMyTurn}
            settings={settings}
            onPlacementClick={handlePlacementClick}
            onStoneInteractionStart={handleStoneInteractionStart}
            isSpectator={isSpectator}
            dragStartPoint={dragStartPoint}
            dragEndPoint={dragEndPoint}
            selectedStone={selectedStoneForRender}
            isInCancelZone={isInCancelZone}
            myStonesCount={myStonesCount}
            maxStones={maxStones}
            session={session}
            currentUser={currentUser}
            isRotated={shouldRotate}
        />
    );

    return (
        <div className={`relative w-full h-full flex items-center justify-center px-4 sm:px-6 lg:px-0 ${backgroundClass}`}>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 max-w-md z-10 pointer-events-none flex flex-col items-center gap-3">
                {showTurnPassGauge && (
                    <AttackToTurnGauge
                        startTime={session.animation!.startTime}
                        durationMs={session.animation!.duration}
                        label="턴 전환까지"
                    />
                )}
                {(dragStartPoint || flickPower !== null) && (
                    <>
                        <div className={`relative w-full bg-gray-900/50 rounded-full h-6 border-2 border-gray-500 ${flickPower !== null ? 'animate-flick-power-pulse' : ''}`}>
                            <div 
                                ref={powerGaugeRef}
                                className="bg-gradient-to-r from-yellow-400 to-red-500 h-full rounded-full" 
                                style={{ width: `${displayedPower}%` }}
                            />
                            <span className="absolute inset-0 w-full h-full flex items-center justify-center text-white font-bold text-sm drop-shadow-md">
                                POWER
                            </span>
                        </div>
                    </>
                )}
            </div>

            {mobileAlkkagiStableChrome ? (
                <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-x-hidden overflow-y-hidden">
                    <div
                        className="h-full max-h-full w-full max-w-full aspect-square min-h-0 min-w-0"
                        style={{
                            transform: alkkagiMobilePanEnabled ? `translate3d(${dragBoardPanX}px,0,0)` : undefined,
                            willChange: alkkagiMobilePanEnabled ? 'transform' : undefined,
                        }}
                    >
                        {/* rotate는 트랜지션 없이 고정 — 백 시각 보정만 (재마운트 시 0→180 애니메이션 방지) */}
                        <div className={`h-full w-full ${shouldRotate ? 'rotate-180' : ''}`}>
                            {boardNode}
                        </div>
                    </div>
                </div>
            ) : (
                <div className={`h-full w-full min-h-0 min-w-0 ${shouldRotate ? 'rotate-180' : ''}`}>
                    {boardNode}
                </div>
            )}
        </div>
    );
};

export default AlkkagiArena;
