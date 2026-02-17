
import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef, useMemo, ReactNode, useCallback } from 'react';
import { AlkkagiStone, GameStatus, Player, Point, LiveGameSession, UserWithStatus, GameProps } from '../../types.js';
import CurlingBoard, { CurlingBoardHandle } from '../CurlingBoard.js';
import { CURLING_TURN_TIME_LIMIT } from '../../constants';
import { audioService } from '../../services/audioService.js';
import { PLAYFUL_GAME_MODES } from '../../constants/gameModes';

interface CurlingArenaProps extends GameProps {}

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

const CurlingArena = forwardRef<CurlingBoardHandle, CurlingArenaProps>((props, ref) => {
    const { session, onAction, currentUser, isSpectator } = props;
    const { id: gameId, settings, gameStatus, curlingStones, currentPlayer, activeCurlingItems } = session;

    const boardRef = useRef<CurlingBoardHandle>(null);
    const animationFrameRef = useRef<number | null>(null);
    const powerGaugeAnimFrameRef = useRef<number | null>(null);
    const gaugeStartTimeRef = useRef<number | null>(null);
    const powerGaugeRef = useRef<HTMLDivElement>(null);
    const lastAnimationTimestampRef = useRef(0);
    const powerRef = useRef(0);

    const isDraggingRef = useRef(false);
    const selectedStoneRef = useRef<AlkkagiStone | null>(null);
    const dragStartPointRef = useRef<Point | null>(null);
    const flickInProgressRef = useRef(false);
    const flickFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const [simStones, setSimStones] = useState<AlkkagiStone[] | null>(null);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
    const [dragEndPoint, setDragEndPoint] = useState<Point | null>(null);
    const [power, setPower] = useState(0);
    const [flickPower, setFlickPower] = useState<number | null>(null);
    const [isRenderingPreviewStone, setIsRenderingPreviewStone] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    // 각 플레이어의 마지막 발사 파워 저장 (애니메이션 중에도 표시하기 위해)
    const lastFlickPowerRef = useRef<{ [playerId: string]: number }>({});

    const latestProps = useRef(props);
    useEffect(() => {
        latestProps.current = props;
    });

    const myPlayerEnum = useMemo(() => (
        session.blackPlayerId === currentUser.id ? Player.Black : (session.whitePlayerId === currentUser.id ? Player.White : Player.None)
    ), [session.blackPlayerId, session.whitePlayerId, currentUser.id]);
    
    const isMyTurn = useMemo(() => {
        if (isSpectator) return false;
        return currentPlayer === myPlayerEnum;
    }, [currentPlayer, myPlayerEnum, isSpectator]);

    // 바둑판은 회전하지 않고, 각 플레이어의 돌 위치만 조정
    const shouldRotate = false;
    
    const prevGameStatus = usePrevious(session.gameStatus);
    const prevTurnStartTime = usePrevious(session.turnStartTime);

    // stopPowerGauge를 먼저 정의 (useEffect에서 사용하기 전에)
    const stopPowerGauge = useCallback(() => {
        if (powerGaugeAnimFrameRef.current) {
            cancelAnimationFrame(powerGaugeAnimFrameRef.current);
            powerGaugeAnimFrameRef.current = null;
        }
        gaugeStartTimeRef.current = null;
    }, []);

    useEffect(() => {
        if (session.turnStartTime !== prevTurnStartTime && prevTurnStartTime !== undefined) {
            // 턴이 바뀔 때 파워게이지 완전히 초기화
            stopPowerGauge();
            setFlickPower(null);
            setPower(0);
            powerRef.current = 0;
            setDragStartPoint(null);
            setDragEndPoint(null);
            isDraggingRef.current = false;
            selectedStoneRef.current = null;
            dragStartPointRef.current = null;
            setIsRenderingPreviewStone(false);
        }
    }, [session.turnStartTime, prevTurnStartTime, stopPowerGauge]);

    useEffect(() => {
        if (prevGameStatus === 'curling_animating' && session.gameStatus !== 'curling_animating') {
            setSimStones(null);
            flickInProgressRef.current = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            // 애니메이션이 끝나면 파워게이지 초기화 (턴이 바뀌기 전까지는 유지하지 않음)
            // 턴이 바뀌면 위의 useEffect에서 초기화됨
        }
        // 공격 전송 후 curling_animating 수신 시 flick 잠금 해제
        if (session.gameStatus === 'curling_animating') {
            flickInProgressRef.current = false;
            if (flickFallbackTimerRef.current) {
                clearTimeout(flickFallbackTimerRef.current);
                flickFallbackTimerRef.current = null;
            }
        }
    }, [session.gameStatus, prevGameStatus]);

    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);
    
    const cancelFlick = useCallback(() => {
        isDraggingRef.current = false;
        selectedStoneRef.current = null;
        dragStartPointRef.current = null;
        stopPowerGauge();
        setDragStartPoint(null);
        setDragEndPoint(null);
        setPower(0);
        setFlickPower(null);
        setIsRenderingPreviewStone(false);
        powerRef.current = 0;
    }, [stopPowerGauge]);

    const startPowerGauge = useCallback(() => {
        stopPowerGauge();
        setFlickPower(null);
        setPower(0);
        powerRef.current = 0;
        gaugeStartTimeRef.current = performance.now();
    
        const animateGauge = (timestamp: number) => {
            if (!gaugeStartTimeRef.current) {
                gaugeStartTimeRef.current = timestamp;
            }
    
            const { session: currentSession, currentUser: user } = latestProps.current;
            const myActiveItems = currentSession.activeCurlingItems?.[user.id] || [];
            const isSlowActive = myActiveItems.includes('slow');
            
            const baseCycleDuration = currentSession.settings.curlingGaugeSpeed || 700;
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
    
            // 상태 업데이트를 통해 React가 렌더링하도록 함
            setPower(newPower);
            powerRef.current = newPower;
            powerGaugeAnimFrameRef.current = requestAnimationFrame(animateGauge);
        };
    
        powerGaugeAnimFrameRef.current = requestAnimationFrame(animateGauge);
    }, [stopPowerGauge]);
    
    const runClientAnimation = useCallback((initialStones: AlkkagiStone[], stoneToLaunch: AlkkagiStone, velocity: Point) => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        let simStones: AlkkagiStone[] = JSON.parse(JSON.stringify(initialStones || []));
        let stoneToAnimate = { ...stoneToLaunch, vx: velocity.x, vy: velocity.y, onBoard: true };
        simStones.push(stoneToAnimate);
        setSimStones(simStones);

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
                if (Math.abs(stone.vx) > 0 || Math.abs(stone.vy) > 0) {
                    stonesAreMoving = true;
                }

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
                            s1.vx += impulse * nx;
                            s1.vy += impulse * ny;
                            s2.vx -= impulse * nx;
                            s2.vy -= impulse * ny;
                        }
                        const overlap = (radiiSum - distance) / 2;
                        s1.x -= overlap * nx;
                        s1.y -= overlap * ny;
                        s2.x += overlap * nx;
                        s2.y += overlap * ny;
                    }
                }
            }
            
            setSimStones([...simStones]);
            
            iterations++;
            if (stonesAreMoving && iterations < maxIterations) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                animationFrameRef.current = null;
                // Animation finished client-side, wait for server confirmation to clear simStones
            }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    }, []);
    
    const handleLaunchAreaInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent, area: { x: number; y: number; player: Player; }) => {
        const { session: currentSession, currentUser: user } = latestProps.current;
        const myPlayer = currentSession.blackPlayerId === user.id ? Player.Black : (currentSession.whitePlayerId === user.id ? Player.White : Player.None);
        const currentIsMyTurn = currentSession.currentPlayer === myPlayer;
        if (!currentIsMyTurn || currentSession.gameStatus !== 'curling_playing' || flickInProgressRef.current) return;

        isDraggingRef.current = true;
        const stoneRadius = (840 / 19) * 0.47;
        const boardSizePx = 840;
        
        // 바둑판이 회전하지 않으므로, 발사 위치를 서버 좌표계로 변환
        // 각 플레이어의 발사 영역은 화면 하단에 있지만, 서버 좌표계에서는:
        // - 흑 플레이어: 화면 하단 = 서버 좌표계 하단 (그대로)
        // - 백 플레이어: 화면 하단 = 서버 좌표계 상단 (y축만 반전, x축은 그대로)
        // 화면에서 오른쪽 아래 클릭 = 서버 좌표계에서 오른쪽 위
        const serverX = area.x + stoneRadius; // x축은 그대로
        const serverY = myPlayerEnum === Player.White ? boardSizePx - (area.y + stoneRadius) : (area.y + stoneRadius);
        
        const newStone: AlkkagiStone = {
            id: Date.now(),
            player: myPlayer,
            x: serverX,
            y: serverY,
            vx: 0, vy: 0,
            radius: stoneRadius,
            onBoard: false 
        };
        selectedStoneRef.current = newStone;

        const point = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        dragStartPointRef.current = point;

        setDragStartPoint(point);
        setDragEndPoint(point);
        setIsRenderingPreviewStone(true);
        startPowerGauge();
    }, [startPowerGauge, myPlayerEnum]);
    
    useEffect(() => {
        const handleInteractionMove = (e: MouseEvent | TouchEvent) => {
            if (!isDraggingRef.current) return;
            if ('touches' in e) e.preventDefault();
            const point = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
            setDragEndPoint(point);
        };

            const handleInteractionEnd = () => {
            if (!isDraggingRef.current) return;
    
            const { session: currentSession, onAction: currentOnAction, currentUser: user } = latestProps.current;
            const currentMyPlayerEnum = currentSession.blackPlayerId === user.id ? Player.Black : (currentSession.whitePlayerId === user.id ? Player.White : Player.None);

            // 애니메이션 중이거나 이미 전송 대기 중이면 전송 방지 (중복/400 에러 방지)
            if (currentSession.gameStatus !== 'curling_playing' || flickInProgressRef.current) {
                cancelFlick();
                return;
            }

            const finalSelectedStone = selectedStoneRef.current;
            const finalDragStart = dragStartPointRef.current;
            
            stopPowerGauge();
            const finalPower = powerRef.current;
            setFlickPower(finalPower);
            // 현재 플레이어의 마지막 발사 파워 저장
            lastFlickPowerRef.current[currentUser.id] = finalPower;

            setDragEndPoint(currentDragEnd => {
                if (finalSelectedStone && finalDragStart && currentDragEnd) {
                    if (flickInProgressRef.current) return null;
                    const svg = boardRef.current?.getSvg();
                    if (!svg) {
                        console.error("SVG element not found for coordinate conversion.");
                        cancelFlick();
                        return null;
                    }
    
                    const ctm = svg.getScreenCTM()?.inverse();
                    if (!ctm) {
                        console.error("Could not get CTM for coordinate conversion.");
                        cancelFlick();
                        return null;
                    }
                    
                    const pt = svg.createSVGPoint();
    
                    pt.x = finalDragStart.x;
                    pt.y = finalDragStart.y;
                    const svgDragStart = pt.matrixTransform(ctm);
    
                    pt.x = currentDragEnd.x;
                    pt.y = currentDragEnd.y;
                    const svgDragEnd = pt.matrixTransform(ctm);
    
                    const dx = svgDragEnd.x - svgDragStart.x;
                    const dy = svgDragEnd.y - svgDragStart.y;
                    
                    // 바둑판이 회전하지 않으므로, 속도 벡터 변환:
                    // 화살표 방향과 일치하도록 속도 벡터 설정
                    // CurlingBoard.tsx의 adjustedDy 로직과 일치해야 함
                    const velocityX = -dx; // 항상 반대 방향
                    const velocityY = currentMyPlayerEnum === Player.White ? dy : -dy; // 화살표 방향과 일치
    
                    const launchStrength = finalPower / 100 * 25;
                    const mag = Math.hypot(velocityX, velocityY);
                    
                    if (mag > 0) {
                        flickInProgressRef.current = true;
                        if (flickFallbackTimerRef.current) clearTimeout(flickFallbackTimerRef.current);
                        flickFallbackTimerRef.current = setTimeout(() => {
                            flickFallbackTimerRef.current = null;
                            flickInProgressRef.current = false;
                        }, 3000);
                        const vx = (velocityX / mag) * launchStrength;
                        const vy = (velocityY / mag) * launchStrength;
                        currentOnAction({ type: 'CURLING_FLICK_STONE', payload: { gameId: currentSession.id, launchPosition: { x: finalSelectedStone.x, y: finalSelectedStone.y }, velocity: { x: vx, y: vy } } });
                    }
                }
    
                // Reset
                isDraggingRef.current = false;
                selectedStoneRef.current = null;
                dragStartPointRef.current = null;
                setDragStartPoint(null);
                setIsRenderingPreviewStone(false);
                return null; // Reset drag end point state
            });
            setPower(0);
            powerRef.current = 0;
            // flickPower는 애니메이션 중에도 유지되도록 setTimeout 제거
        };

        const handleContextMenu = (e: MouseEvent) => {
            if (isDraggingRef.current) {
                e.preventDefault();
                cancelFlick();
            }
        };
        
        window.addEventListener('mousemove', handleInteractionMove);
        window.addEventListener('touchmove', handleInteractionMove, { passive: false });
        window.addEventListener('mouseup', handleInteractionEnd);
        window.addEventListener('touchend', handleInteractionEnd);
        window.addEventListener('contextmenu', handleContextMenu);
        
        return () => {
            window.removeEventListener('mousemove', handleInteractionMove);
            window.removeEventListener('touchmove', handleInteractionMove);
            window.removeEventListener('mouseup', handleInteractionEnd);
            window.removeEventListener('touchend', handleInteractionEnd);
            window.removeEventListener('contextmenu', handleContextMenu);
            stopPowerGauge();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (flickFallbackTimerRef.current) {
                clearTimeout(flickFallbackTimerRef.current);
                flickFallbackTimerRef.current = null;
            }
        };
    }, [stopPowerGauge, cancelFlick, myPlayerEnum]);

    useEffect(() => {
        const { session: currentSession } = latestProps.current;
        const animation = currentSession.animation;
        if (animation?.type === 'curling_flick' && animation.startTime > lastAnimationTimestampRef.current) {
            lastAnimationTimestampRef.current = animation.startTime;
            const { stone, velocity } = animation;
            runClientAnimation(currentSession.curlingStones || [], stone, velocity);
            
            // 애니메이션이 시작되면 해당 플레이어의 파워게이지를 표시
            const flickingPlayerId = stone.player === Player.Black 
                ? currentSession.blackPlayerId 
                : currentSession.whitePlayerId;
            if (flickingPlayerId && lastFlickPowerRef.current[flickingPlayerId]) {
                // 애니메이션 중에는 해당 플레이어의 파워게이지 표시
                if (flickingPlayerId === currentUser.id) {
                    setFlickPower(lastFlickPowerRef.current[flickingPlayerId]);
                }
            }
        }
    }, [session.animation, runClientAnimation, currentUser.id]);

    // 현재 턴의 플레이어 ID 확인
    const currentTurnPlayerId = useMemo(() => {
        if (currentPlayer === Player.Black) return session.blackPlayerId;
        if (currentPlayer === Player.White) return session.whitePlayerId;
        return null;
    }, [currentPlayer, session.blackPlayerId, session.whitePlayerId]);

    // 표시할 파워 결정: 드래그 중이면 현재 파워, 아니면 마지막 발사 파워
    const displayedPower = useMemo(() => {
        // 드래그 중이면 현재 파워 표시
        if (power > 0) return power;
        if (flickPower !== null) return flickPower;
        
        // 애니메이션 중일 때만 해당 플레이어의 마지막 발사 파워 표시
        if (session.gameStatus === 'curling_animating' && session.animation?.type === 'curling_flick') {
            const animStone = session.animation.stone;
            const animPlayerId = animStone.player === Player.Black 
                ? session.blackPlayerId 
                : session.whitePlayerId;
            if (animPlayerId && lastFlickPowerRef.current[animPlayerId]) {
                return lastFlickPowerRef.current[animPlayerId];
            }
        }
        
        return 0;
    }, [flickPower, power, session.gameStatus, session.animation]);

    // 파워게이지 표시 여부 결정
    const shouldShowPowerGauge = useMemo(() => {
        // 드래그 중이면 표시
        if (dragStartPoint) return true;
        
        // 발사된 파워가 있으면 표시
        if (flickPower !== null) return true;
        
        // 애니메이션 중일 때만 표시
        if (session.gameStatus === 'curling_animating' && session.animation?.type === 'curling_flick') {
            const animStone = session.animation.stone;
            const animPlayerId = animStone.player === Player.Black 
                ? session.blackPlayerId 
                : session.whitePlayerId;
            if (animPlayerId && lastFlickPowerRef.current[animPlayerId]) {
                return true;
            }
        }
        
        return false;
    }, [dragStartPoint, flickPower, session.gameStatus, session.animation]);

    // 놀이바둑 모드에서는 배경을 투명하게
    const backgroundClass = useMemo(() => {
        if (PLAYFUL_GAME_MODES.some(m => m.mode === session.mode)) {
            return 'bg-transparent';
        }
        return 'bg-primary';
    }, [session.mode]);

    return (
        <div className={`relative w-full h-full flex items-center justify-center px-4 sm:px-6 lg:px-0 ${backgroundClass}`}>
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 max-w-md z-10 pointer-events-none">
                {shouldShowPowerGauge && (
                    <div className={`bg-gray-900/50 rounded-full h-6 border-2 border-gray-500 ${flickPower !== null || (session.gameStatus === 'curling_animating' && session.animation?.type === 'curling_flick') ? 'animate-flick-power-pulse' : ''}`}>
                        <div 
                            className="bg-gradient-to-r from-yellow-400 to-red-500 h-full rounded-full" 
                            style={{ width: `${displayedPower}%` }}
                        />
                        <span className="absolute inset-0 w-full h-full flex items-center justify-center text-white font-bold text-sm drop-shadow-md">
                            POWER
                        </span>
                    </div>
                )}
            </div>
            <div className="w-full h-full">
                <CurlingBoard
                    ref={boardRef}
                    stones={simStones ?? curlingStones ?? []}
                    gameStatus={gameStatus}
                    myPlayer={myPlayerEnum}
                    currentPlayer={currentPlayer}
                    onLaunchAreaInteractionStart={handleLaunchAreaInteractionStart}
                    isSpectator={isSpectator}
                    dragStartPoint={dragStartPoint}
                    dragEndPoint={dragEndPoint}
                    selectedStone={isRenderingPreviewStone ? selectedStoneRef.current : null}
                    activeCurlingItems={session.activeCurlingItems}
                    currentUser={currentUser}
                    session={session}
                    isRotated={false}
                    myPlayerEnum={myPlayerEnum}
                />
            </div>
        </div>
    );
});

export default CurlingArena;
