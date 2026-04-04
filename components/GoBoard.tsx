import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { BoardState, Point, Player, GameStatus, Move, AnalysisResult, LiveGameSession, User, AnimationData, GameMode, RecommendedMove, ServerAction } from '../types.js';
import { WHITE_BASE_STONE_IMG, BLACK_BASE_STONE_IMG, WHITE_HIDDEN_STONE_IMG, BLACK_HIDDEN_STONE_IMG } from '../assets.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';

const AnimatedBonusText: React.FC<{
    animation: Extract<AnimationData, { type: 'bonus_text' }>;
    toSvgCoords: (p: Point) => { cx: number; cy: number };
    cellSize: number;
    isRotated?: boolean;
}> = ({ animation, toSvgCoords, cellSize, isRotated }) => {
    const { text, point } = animation;
    const { cx, cy } = toSvgCoords(point);
    const fontSize = cellSize * 1.5;

    const durS = Math.max(1.2, (animation.duration ?? 2500) / 1000);
    return (
        <g style={{ pointerEvents: 'none' }} transform={`translate(${cx}, ${cy})`}>
            {/* 회전 시 클래스 전환으로 CSS 애니메이션이 재시작되지 않도록 scale로 Y만 보정 */}
            <g transform={isRotated ? 'scale(1,-1)' : undefined}>
                <g
                    className="capture-points-float-inner"
                    style={{ animationDuration: `${durS}s` }}
                >
                <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dy=".35em"
                    fontSize={fontSize}
                    className="capture-score-float-text"
                    fill="url(#capture-score-gradient)"
                    stroke="#022c22"
                    strokeWidth={Math.max(1.5, cellSize * 0.09)}
                    paintOrder="stroke fill"
                    filter="url(#capture-score-premium)"
                >
                    {text}
                </text>
                </g>
            </g>
        </g>
    );
};

// --- Animated Components ---
const AnimatedMissileStone: React.FC<{
    animation: Extract<AnimationData, { type: 'missile' }>;
    stone_radius: number;
    toSvgCoords: (p: Point) => { cx: number; cy: number };
}> = ({ animation, stone_radius, toSvgCoords }) => {
    const { from, to, player, duration } = animation;
    const fromCoords = toSvgCoords(from);
    const toCoords = toSvgCoords(to);

    const style: React.CSSProperties & {
      '--from-x': string;
      '--from-y': string;
      '--to-x': string;
      '--to-y': string;
      '--animation-duration': string;
    } = {
        '--from-x': `${fromCoords.cx}px`,
        '--from-y': `${fromCoords.cy}px`,
        '--to-x': `${toCoords.cx}px`,
        '--to-y': `${toCoords.cy}px`,
        '--animation-duration': `${duration}ms`,
        animationFillMode: 'forwards',
    };

    const angle = Math.atan2(toCoords.cy - fromCoords.cy, toCoords.cx - fromCoords.cx) * 180 / Math.PI;
    // 불꽃은 이동 방향의 반대 방향으로 나와야 함
    // 돌의 뒤쪽(이동 방향 반대)에 위치시킴
    const fireAngle = angle + 180;

    return (
        <g style={style} className="missile-flight-group">
            <g transform={`translate(0, 0)`}>
                {/* Fire Trail - 이동 방향 반대에만 꼬리 불꽃 표시 */}
                {/* 외부 불꽃 (가장 큰, 가장 흐릿한) - 돌 가장자리 밖으로 충분히 떨어진 위치 */}
                <ellipse
                    cx={0}
                    cy={0}
                    rx={stone_radius * 2.5}
                    ry={stone_radius * 1.2}
                    fill="url(#missile_fire_outer)"
                    className="missile-fire-outer"
                    transform={`translate(${-stone_radius * 3.0}, 0) rotate(${fireAngle})`}
                    opacity={0.8}
                />
                {/* 중간 불꽃 - 돌 가장자리 밖으로 충분히 떨어진 위치 */}
                <ellipse
                    cx={0}
                    cy={0}
                    rx={stone_radius * 2.0}
                    ry={stone_radius * 1.0}
                    fill="url(#missile_fire)"
                    className="missile-fire-trail"
                    transform={`translate(${-stone_radius * 2.5}, 0) rotate(${fireAngle})`}
                    opacity={1.0}
                />
                {/* 핵심 불꽃 (가장 밝고 작은) - 돌 가장자리 바로 뒤 */}
                <ellipse
                    cx={0}
                    cy={0}
                    rx={stone_radius * 1.5}
                    ry={stone_radius * 0.8}
                    fill="url(#missile_fire_core)"
                    className="missile-fire-core"
                    transform={`translate(${-stone_radius * 2.0}, 0) rotate(${fireAngle})`}
                    opacity={1}
                />
                {/* 추가 파티클 효과 (작은 불꽃 조각들) - 돌 뒤쪽에만 배치 */}
                {[0, 1, 2, 3].map((i) => (
                    <ellipse
                        key={i}
                        cx={0}
                        cy={0}
                        rx={stone_radius * (0.5 + i * 0.25)}
                        ry={stone_radius * (0.25 + i * 0.15)}
                        fill="url(#missile_fire_particle)"
                        className="missile-fire-trail"
                        transform={`translate(${-stone_radius * (2.2 + i * 0.5)}, ${(i - 1.5) * stone_radius * 0.25}) rotate(${fireAngle + (i - 1.5) * 15})`}
                        opacity={0.7 - i * 0.12}
                        style={{ animationDelay: `${i * 0.03}s` }}
                    />
                ))}
                {/* Stone with glow effect */}
                <g className="missile-stone-glow">
                    <circle
                        cx={0}
                        cy={0}
                        r={stone_radius}
                        fill={player === Player.Black ? "#111827" : "#f5f2e8"}
                    />
                    <circle 
                        cx={0} 
                        cy={0} 
                        r={stone_radius} 
                        fill={player === Player.Black ? 'url(#slate_highlight)' : 'url(#clamshell_highlight)'} 
                    />
                </g>
            </g>
        </g>
    );
};

const AnimatedHiddenMissile: React.FC<{
    animation: Extract<AnimationData, { type: 'hidden_missile' }>;
    stone_radius: number;
    toSvgCoords: (p: Point) => { cx: number; cy: number };
}> = ({ animation, stone_radius, toSvgCoords }) => {
    const { from, to, player, duration } = animation;
    const fromCoords = toSvgCoords(from);
    const toCoords = toSvgCoords(to);

    const flightStyle: React.CSSProperties & {
      '--from-x': string;
      '--from-y': string;
      '--to-x': string;
      '--to-y': string;
      '--animation-duration': string;
    } = {
        '--from-x': `${fromCoords.cx}px`,
        '--from-y': `${fromCoords.cy}px`,
        '--to-x': `${toCoords.cx}px`,
        '--to-y': `${toCoords.cy}px`,
        '--animation-duration': `${duration}ms`,
        animationFillMode: 'forwards',
    };

    const specialImageSize = stone_radius * 2 * 0.7;
    const specialImageOffset = specialImageSize / 2;
    const angle = Math.atan2(toCoords.cy - fromCoords.cy, toCoords.cx - fromCoords.cx) * 180 / Math.PI;
    // 불꽃은 이동 방향의 반대 방향으로 나와야 함
    // 돌의 뒤쪽(이동 방향 반대)에 위치시킴
    const fireAngle = angle + 180;

    const flightEffect = (
        <g style={flightStyle} className="hidden-missile-flight-group">
            <g transform={`translate(0, 0)`}>
                {/* Fire Trail - 이동 방향 반대에만 꼬리 불꽃 표시 */}
                {/* 외부 불꽃 (가장 큰, 가장 흐릿한) - 돌 가장자리 밖으로 충분히 떨어진 위치 */}
                <ellipse
                    cx={0}
                    cy={0}
                    rx={stone_radius * 2.5}
                    ry={stone_radius * 1.2}
                    fill="url(#missile_fire_outer)"
                    className="missile-fire-outer"
                    transform={`translate(${-stone_radius * 3.0}, 0) rotate(${fireAngle})`}
                    opacity={0.8}
                />
                {/* 중간 불꽃 - 돌 가장자리 밖으로 충분히 떨어진 위치 */}
                <ellipse
                    cx={0}
                    cy={0}
                    rx={stone_radius * 2.0}
                    ry={stone_radius * 1.0}
                    fill="url(#missile_fire)"
                    className="missile-fire-trail"
                    transform={`translate(${-stone_radius * 2.5}, 0) rotate(${fireAngle})`}
                    opacity={1.0}
                />
                {/* 핵심 불꽃 (가장 밝고 작은) - 돌 가장자리 바로 뒤 */}
                <ellipse
                    cx={0}
                    cy={0}
                    rx={stone_radius * 1.5}
                    ry={stone_radius * 0.8}
                    fill="url(#missile_fire_core)"
                    className="missile-fire-core"
                    transform={`translate(${-stone_radius * 2.0}, 0) rotate(${fireAngle})`}
                    opacity={1}
                />
                {/* 추가 파티클 효과 (작은 불꽃 조각들) - 돌 뒤쪽에만 배치 */}
                {[0, 1, 2, 3].map((i) => (
                    <ellipse
                        key={i}
                        cx={0}
                        cy={0}
                        rx={stone_radius * (0.5 + i * 0.25)}
                        ry={stone_radius * (0.25 + i * 0.15)}
                        fill="url(#missile_fire_particle)"
                        className="missile-fire-trail"
                        transform={`translate(${-stone_radius * (2.2 + i * 0.5)}, ${(i - 1.5) * stone_radius * 0.25}) rotate(${fireAngle + (i - 1.5) * 15})`}
                        opacity={0.7 - i * 0.12}
                        style={{ animationDelay: `${i * 0.03}s` }}
                    />
                ))}
                {/* Stone with glow effect */}
                <g className="missile-stone-glow">
                    <circle cx={0} cy={0} r={stone_radius} fill={player === Player.Black ? "#111827" : "#f5f2e8"} />
                    <circle cx={0} cy={0} r={stone_radius} fill={player === Player.Black ? 'url(#slate_highlight)' : 'url(#clamshell_highlight)'} />
                    <image href={player === Player.Black ? BLACK_HIDDEN_STONE_IMG : WHITE_HIDDEN_STONE_IMG} x={-specialImageOffset} y={-specialImageOffset} width={specialImageSize} height={specialImageSize} />
                </g>
            </g>
        </g>
    );

    return (
        <g style={{ pointerEvents: 'none' }}>
            {flightEffect}
        </g>
    );
};

const AnimatedScanMarker: React.FC<{
    animation: Extract<AnimationData, { type: 'scan' }>;
    toSvgCoords: (p: Point) => { cx: number; cy: number };
    stone_radius: number;
}> = ({ animation, toSvgCoords, stone_radius }) => {
    const { point, success } = animation;
    const { cx, cy } = toSvgCoords(point);
    const size = stone_radius * 2.5;

    return (
        <g style={{ pointerEvents: 'none' }}>
            {success ? (
                <>
                    <circle cx={cx} cy={cy} r={size * 0.2} fill="none" stroke="#34d399" className="scan-success-circle" style={{ animationDelay: '0s' }} />
                    <circle cx={cx} cy={cy} r={size * 0.2} fill="none" stroke="#34d399" className="scan-success-circle" style={{ animationDelay: '0.2s' }} />
                    <circle cx={cx} cy={cy} r={size * 0.2} fill="none" stroke="#34d399" className="scan-success-circle" style={{ animationDelay: '0.4s' }} />
                </>
            ) : (
                <g className="scan-fail-marker">
                    {/* 고급 스캔 실패 연출: 원형 배경 + 부드러운 X + 글로우 */}
                    <circle cx={cx} cy={cy} r={size * 0.65} fill="rgba(15, 23, 42, 0.85)" stroke="rgba(248, 113, 113, 0.5)" strokeWidth="1.5" className="scan-fail-bg" />
                    <circle cx={cx} cy={cy} r={size * 0.58} fill="none" stroke="rgba(248, 113, 113, 0.25)" strokeWidth="2" className="scan-fail-glow" />
                    <line x1={cx - size * 0.45} y1={cy - size * 0.45} x2={cx + size * 0.45} y2={cy + size * 0.45} stroke="rgba(251, 191, 36, 0.95)" strokeWidth="2.2" strokeLinecap="round" className="scan-fail-line" />
                    <line x1={cx + size * 0.45} y1={cy - size * 0.45} x2={cx - size * 0.45} y2={cy + size * 0.45} stroke="rgba(251, 191, 36, 0.95)" strokeWidth="2.2" strokeLinecap="round" className="scan-fail-line" style={{ animationDelay: '0.12s' }} />
                </g>
            )}
        </g>
    );
};

const RecommendedMoveMarker: React.FC<{
    move: RecommendedMove;
    toSvgCoords: (p: Point) => { cx: number; cy: number };
    cellSize: number;
    onClick: (x: number, y: number) => void;
}> = ({ move, toSvgCoords, cellSize, onClick }) => {
    const { cx, cy } = toSvgCoords({ x: move.x, y: move.y });
    const radius = cellSize * 0.45;
    const colors = ['#3b82f6', '#16a34a', '#f59e0b']; // Blue, Green, Amber for 1, 2, 3
    const color = colors[move.order - 1] || '#6b7280';

    return (
        <g
            onClick={(e) => { e.stopPropagation(); onClick(move.x, move.y); }}
            className="cursor-pointer recommended-move-marker"
        >
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={color}
                fillOpacity="0.7"
                stroke="white"
                strokeWidth="2"
            />
            <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dy=".35em"
                fontSize={radius * 1.2}
                fontWeight="bold"
                fill="white"
                style={{ pointerEvents: 'none', textShadow: '0 0 3px black' }}
            >
                {move.order}
            </text>
        </g>
    );
};

const Stone: React.FC<{ player: Player, cx: number, cy: number, isLastMove?: boolean, isSelectedMissile?: boolean, isHoverSelectableMissile?: boolean, isKnownHidden?: boolean, isNewlyRevealed?: boolean, animationClass?: string, isPending?: boolean, isBaseStone?: boolean, isPatternStone?: boolean, radius: number, isFaint?: boolean }> = ({ player, cx, cy, isLastMove, isSelectedMissile, isHoverSelectableMissile, isKnownHidden, isNewlyRevealed, animationClass, isPending, isBaseStone, isPatternStone, radius, isFaint }) => {
    const specialImageSize = radius * 2 * 0.7;
    const specialImageOffset = specialImageSize / 2;

    const strokeColor = isPending ? 'rgb(34, 197, 94)'
        : isSelectedMissile ? 'rgb(239, 68, 68)'
        : 'none';
    
    const strokeWidth = isSelectedMissile || isPending ? 3.5 : 0;

    return (
        <g className={`${animationClass || ''} ${isHoverSelectableMissile ? 'missile-selectable-stone' : ''}`} opacity={isPending ? 0.6 : (isFaint ? 0.52 : 1)}>
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={player === Player.Black ? "#111827" : "#f5f2e8"}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
            />
            {player === Player.White && <circle cx={cx} cy={cy} r={radius} fill="url(#clam_grain)" />}
            <circle cx={cx} cy={cy} r={radius} fill={player === Player.Black ? 'url(#slate_highlight)' : 'url(#clamshell_highlight)'} />
            {isBaseStone && (
                <image href={player === Player.Black ? BLACK_BASE_STONE_IMG : WHITE_BASE_STONE_IMG} x={cx - specialImageOffset} y={cy - specialImageOffset} width={specialImageSize} height={specialImageSize} />
            )}
            {isKnownHidden && (
                <image href={player === Player.Black ? BLACK_HIDDEN_STONE_IMG : WHITE_HIDDEN_STONE_IMG} x={cx - specialImageOffset} y={cy - specialImageOffset} width={specialImageSize} height={specialImageSize} />
            )}
            {isPatternStone && (
                <image href={player === Player.Black ? '/images/single/BlackDouble.png' : '/images/single/WhiteDouble.png'} x={cx - specialImageOffset} y={cy - specialImageOffset} width={specialImageSize} height={specialImageSize} />
            )}
            {isNewlyRevealed && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke="rgba(0, 255, 255, 0.8)"
                    strokeWidth="4"
                    className="sparkle-animation"
                    style={{ pointerEvents: 'none', transformOrigin: 'center' }}
                />
            )}
            {isLastMove && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius * 0.25}
                    fill="rgba(239, 68, 68, 0.9)"
                    className="animate-pulse"
                    style={{ pointerEvents: 'none' }}
                />
            )}
        </g>
    );
};

/** 미사일로 움직이는 출발 칸 돌의 히든 표시 방식 (내 시점 기준 스캔 목록 사용) */
function classifyMissileFromStone(
    from: Point,
    moveHistory: Move[] | undefined,
    hiddenMoves: { [moveIndex: number]: boolean } | undefined,
    permanentlyRevealedStones: Point[] | undefined,
    myRevealedStones: Point[] | undefined
): 'normal' | 'unrevealed_hidden' | 'scan_only_hidden' | 'revealed_hidden' {
    if (!moveHistory?.length || !hiddenMoves) return 'normal';
    const moveIndex = moveHistory.findIndex(m => m.x === from.x && m.y === from.y);
    if (moveIndex === -1 || !hiddenMoves[moveIndex]) return 'normal';
    if (permanentlyRevealedStones?.some(p => p.x === from.x && p.y === from.y)) return 'revealed_hidden';
    if (myRevealedStones?.some(p => p.x === from.x && p.y === from.y)) return 'scan_only_hidden';
    return 'unrevealed_hidden';
}

// --- Go Board Component ---
interface GoBoardProps {
  boardState: BoardState;
  boardSize: number;
  onBoardClick: (x: number, y: number) => void;
  onMissileLaunch?: (from: Point, direction: 'up' | 'down' | 'left' | 'right') => void;
  onAction?: (action: ServerAction) => void;
  gameId?: string;
  lastMove: Point | null;
  lastTurnStones?: Point[] | null;
  isBoardDisabled: boolean;
  stoneColor: Player;
  winningLine?: Point[] | null;
  moveHistory?: Move[];
  isSpectator: boolean;
  // Special mode props
  mode: GameMode;
  mixedModes?: GameMode[];
  hiddenMoves?: { [moveIndex: number]: boolean };
  baseStones?: { x: number, y: number, player: Player }[];
  baseStones_p1?: Point[];
  baseStones_p2?: Point[];
  myPlayerEnum: Player;
  gameStatus: GameStatus;
  currentPlayer: Player;
  highlightedPoints?: Point[];
  highlightStyle?: 'circle' | 'ring';
  myRevealedStones?: Point[];
  allRevealedStones?: { [playerId: string]: Point[] };
  newlyRevealed?: { point: Point, player: Player }[];
  justCaptured?: { point: Point; player: Player; wasHidden: boolean; capturePoints?: number }[];
  permanentlyRevealedStones?: Point[];
  blackPatternStones?: Point[];
  whitePatternStones?: Point[];
  /** 문양이 영구 소모된 교차점 — 같은 자리에 다시 두어도 문양 표시 안 함 */
  consumedPatternIntersections?: Point[];
  // Analysis props
  analysisResult?: AnalysisResult | null;
  showTerritoryOverlay?: boolean;
  showHintOverlay?: boolean;
  showLastMoveMarker: boolean;
  // Missile mode specific
  currentUser: User;
  blackPlayerNickname: string;
  whitePlayerNickname: string;
  animation?: AnimationData | null;
  isItemModeActive: boolean;
  sgf?: string;
  isMobile?: boolean;
  isSinglePlayer?: boolean;
  isRotated?: boolean; // 180도 회전 여부
  // 온라인 전략바둑 AI 대국용: 서버 응답 전 낙관적 표시용 임시 돌
  pendingMove?: { x: number; y: number; player: Player } | null;
  /** 플로트를 띄울 최소 점수(설정 OFF 시 2 = 기존과 동일, ON 시 1 = 일반 따내기 +1 포함) */
  captureScoreFloatMinPoints?: number;
  /** 따낸 점수 플로트(+N)를 captures 증가분으로 계산할 때 사용. 없으면 justCaptured 슬라이스만 사용(교체형 페이로드에서 오차 가능) */
  captures?: { [key in Player]?: number };
}

const GoBoard: React.FC<GoBoardProps> = (props) => {
    const { 
        boardState, boardSize, onBoardClick, onMissileLaunch, lastMove, lastTurnStones, isBoardDisabled, 
        stoneColor, winningLine, hiddenMoves, moveHistory, baseStones, baseStones_p1, baseStones_p2,
        myPlayerEnum, gameStatus, highlightedPoints, highlightStyle = 'circle', myRevealedStones, allRevealedStones, newlyRevealed, isSpectator,
        analysisResult, showTerritoryOverlay = false, showHintOverlay = false, currentUser, blackPlayerNickname, whitePlayerNickname,
        currentPlayer, isItemModeActive, animation, mode, mixedModes, justCaptured, permanentlyRevealedStones, onAction, gameId,
        showLastMoveMarker, blackPatternStones, whitePatternStones, consumedPatternIntersections, isSinglePlayer = false, isRotated = false, pendingMove = null,
        captureScoreFloatMinPoints = 2,
        captures,
    } = props;
    const [captureScoreFloats, setCaptureScoreFloats] = useState<{ id: string; point: Point; label: string }[]>([]);
    /** 서버는 justCaptured를 누적하므로, 이번 업데이트에서 새로 추가된 항목만 처리 */
    const processedJustCapturedCountRef = useRef<number>(0);
    const captureFloatTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const lastMoveForFloatRef = useRef<Point | null>(null);
    lastMoveForFloatRef.current = lastMove;
    /** captures 기반: 이미 플로트 처리한 수(moveHistory 인덱스·좌표·플레이어) */
    const lastFloatedMoveKeyRef = useRef<string>('');
    const prevCapturesForFloatRef = useRef<Partial<Record<Player, number>> | null>(null);

    useEffect(() => {
        processedJustCapturedCountRef.current = 0;
        lastFloatedMoveKeyRef.current = '';
        prevCapturesForFloatRef.current = null;
        if (captures) {
            prevCapturesForFloatRef.current = { ...captures };
            const mh = moveHistory;
            const tail = mh?.length ? mh[mh.length - 1] : null;
            if (tail && tail.x >= 0 && tail.y >= 0) {
                lastFloatedMoveKeyRef.current = `${mh!.length}-${tail.player}-${tail.x}-${tail.y}`;
            }
        }
    }, [gameId]);

    useEffect(() => {
        return () => {
            captureFloatTimeoutsRef.current.forEach(clearTimeout);
            captureFloatTimeoutsRef.current = [];
        };
    }, []);

    /**
     * 짧은 간격으로 justCaptured가 늘어날 때(동시 다발 포획) 디바운스.
     * captures가 넘어오면 이번 수의 따낸 점수는 captures[mover] 증가분으로 계산해,
     * justCaptured가 턴마다 교체되어 processed 카운트와 어긋날 때(+4 등)를 막는다.
     */
    useEffect(() => {
        const DEBOUNCE_MS = 48;
        const t = window.setTimeout(() => {
            const list = justCaptured ?? [];
            const CAPTURE_FLOAT_MS = 2800;
            const minPts = captureScoreFloatMinPoints;

            const pushFloat = (totalPts: number, anchor: Point) => {
                if (totalPts < minPts) return;
                const floatId = `cap-${anchor.x}-${anchor.y}-${totalPts}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                setCaptureScoreFloats((prev) => [
                    ...prev,
                    { id: floatId, point: anchor, label: `+${totalPts}` },
                ]);
                const clearT = setTimeout(() => {
                    setCaptureScoreFloats((prev) => prev.filter((x) => x.id !== floatId));
                }, CAPTURE_FLOAT_MS);
                captureFloatTimeoutsRef.current.push(clearT);
            };

            if (captures && moveHistory?.length) {
                const last = moveHistory[moveHistory.length - 1];
                if (!last) return;

                const moveKey = `${moveHistory.length}-${last.player}-${last.x}-${last.y}`;
                if (moveKey === lastFloatedMoveKeyRef.current) {
                    return;
                }

                const mover = last.player;
                const prevSnap = prevCapturesForFloatRef.current;
                const nowM = Number(captures[mover] ?? 0);
                const prevM = prevSnap ? Number(prevSnap[mover] ?? 0) : 0;
                const delta = nowM - prevM;

                const commitMoveFloatState = () => {
                    lastFloatedMoveKeyRef.current = moveKey;
                    prevCapturesForFloatRef.current = { ...captures };
                    processedJustCapturedCountRef.current = list.length;
                };

                const isPass = last.x < 0 || last.y < 0;

                if (delta >= minPts) {
                    const anchor =
                        !isPass ? { x: last.x, y: last.y } : (lastMoveForFloatRef.current ?? { x: last.x, y: last.y });
                    if (anchor.x < 0 || anchor.y < 0) {
                        commitMoveFloatState();
                        return;
                    }
                    commitMoveFloatState();
                    pushFloat(delta, anchor);
                    return;
                }

                if (isPass || (delta === 0 && list.length === 0) || (delta > 0 && delta < minPts)) {
                    commitMoveFloatState();
                }
                return;
            }

            if (list.length === 0) {
                processedJustCapturedCountRef.current = 0;
                return;
            }

            const prevCount = processedJustCapturedCountRef.current;

            if (list.length < prevCount) {
                processedJustCapturedCountRef.current = 0;
            }
            const start = processedJustCapturedCountRef.current;
            const newEntries = list.slice(start);
            processedJustCapturedCountRef.current = list.length;
            if (newEntries.length === 0) return;

            const totalPts = newEntries.reduce((sum, e) => sum + (e.capturePoints ?? (e.wasHidden ? 5 : 1)), 0);
            if (totalPts < minPts) return;

            const lm = lastMoveForFloatRef.current;
            const anchor = lm ? { x: lm.x, y: lm.y } : newEntries[0].point;
            pushFloat(totalPts, anchor);
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [justCaptured, captures, moveHistory, captureScoreFloatMinPoints, gameId]);

    const [hoverPos, setHoverPos] = useState<Point | null>(null);
    const [selectedMissileStone, setSelectedMissileStone] = useState<Point | null>(null);
    const [isDraggingMissile, setIsDraggingMissile] = useState(false);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
    const [dragEndPoint, setDragEndPoint] = useState<Point | null>(null);
    const isMobile = false;
    const dragStartBoardPoint = useRef<Point | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const preservedBoardStateRef = useRef<BoardState | null>(null);
    const missileAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const boardSizePx = 840;
    
    // scoring 상태일 때 boardState를 보존하여 초기화 방지
    // 유효한 boardState가 있으면 보존
    useEffect(() => {
        const isBoardStateValid = boardState && 
            Array.isArray(boardState) && 
            boardState.length > 0 && 
            boardState[0] && 
            Array.isArray(boardState[0]) && 
            boardState[0].length > 0 &&
            boardState.some((row: Player[]) => 
                row && Array.isArray(row) && row.some((cell: Player) => cell !== Player.None && cell !== null && cell !== undefined)
            );
        
        if (isBoardStateValid) {
            preservedBoardStateRef.current = boardState;
        }
    }, [boardState]);
    
    // IMPORTANT:
    // - moveHistory로 보드를 "단순 복원"하면 포획(따낸돌 제거)을 반영할 수 없어, 계가 시점에 없던 돌이 생겨나는 버그가 발생한다.
    // - 계가/종료 화면에서도 반드시 "실제 boardState(포획 반영)"를 보존/표시하고,
    //   분석 결과(ownershipMap/deadStones)는 오버레이로만 표현한다.
    const displayBoardState = useMemo(() => {
        const safeSize = boardSize > 0 ? boardSize : 19;

        const isBoardStateValid = boardState && Array.isArray(boardState) && boardState.length > 0 &&
            boardState[0] && Array.isArray(boardState[0]) && boardState[0].length > 0 &&
            boardState.some((row: Player[]) => row && Array.isArray(row) && row.some((cell: Player) => cell !== Player.None && cell !== null && cell !== undefined));

        if (gameStatus === 'scoring') {
            if (preservedBoardStateRef.current) return preservedBoardStateRef.current;
            if (isBoardStateValid) return boardState;
            return boardState || [];
        }

        const result = isBoardStateValid ? boardState : (preservedBoardStateRef.current || boardState);
        if (!result || !Array.isArray(result) || result.length === 0) {
            return Array(safeSize).fill(null).map(() => Array(safeSize).fill(Player.None));
        }
        return result;
    }, [boardState, gameStatus, boardSize, moveHistory, analysisResult]);

    const safeBoardSize = boardSize > 0 ? boardSize : 19;
    const cell_size = boardSizePx / safeBoardSize;
    const padding = cell_size / 2;
    const stone_radius = cell_size * 0.47;
    
    const isScoringOrEnded = gameStatus === 'scoring' || gameStatus === 'ended' || gameStatus === 'no_contest';

    // 미사일 애니메이션 완료 감지 및 처리
    useEffect(() => {
        // 이전 타임아웃 정리
        if (missileAnimationTimeoutRef.current) {
            clearTimeout(missileAnimationTimeoutRef.current);
            missileAnimationTimeoutRef.current = null;
        }

        // 게임 상태가 playing으로 변경되었고 애니메이션이 없으면 애니메이션 완료로 간주
        // (서버에서 GAME_UPDATE를 받아 gameStatus가 playing으로 변경되고 animation이 null이 된 경우)
        if (gameStatus === 'playing' && (!animation || (animation.type !== 'missile' && animation.type !== 'hidden_missile'))) {
            console.log(`[GoBoard] Game status changed to playing, animation cleared. Animation:`, animation);
            // 애니메이션 타임아웃이 남아있으면 정리
            if (missileAnimationTimeoutRef.current) {
                clearTimeout(missileAnimationTimeoutRef.current);
                missileAnimationTimeoutRef.current = null;
            }
            return;
        }

        // 미사일 애니메이션 완료 감지
        // - 멀티플레이: gameStatus === 'missile_animating' 인 경우에만 동작
        // - 싱글플레이/도전의 탑: 서버/클라이언트 상태가 약간 어긋나도 애니메이션이 존재하면 항상 완료 타이머를 건다
        const isMissileAnimation = animation && (animation.type === 'missile' || animation.type === 'hidden_missile');
        const shouldTrackMissileAnimation =
            !!isMissileAnimation &&
            (gameStatus === 'missile_animating' || isSinglePlayer);

        if (shouldTrackMissileAnimation) {
            const now = Date.now();
            const elapsed = now - animation.startTime;
            const remaining = Math.max(0, animation.duration - elapsed);
            const animationEndTime = animation.startTime + animation.duration;

            console.log(`[GoBoard] Missile animation detected: type=${animation.type}, startTime=${animation.startTime}, now=${now}, elapsed=${elapsed}ms, duration=${animation.duration}ms, remaining=${remaining}ms, endTime=${animationEndTime}`);

            // 싱글플레이 게임은 클라이언트에서 직접 처리
            if (isSinglePlayer) {
                // 이미 애니메이션이 완료되었으면 즉시 처리
                if (elapsed >= animation.duration) {
                    console.log(`[GoBoard] SinglePlayer missile animation already completed (elapsed=${elapsed}ms >= duration=${animation.duration}ms), triggering completion immediately`);
                    if (onAction && gameId) {
                        console.log(`[GoBoard] Sending SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE action for game ${gameId}`);
                        onAction({ 
                            type: 'SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE', 
                            payload: { gameId } 
                        } as any);
                    }
                    return;
                }

                // 애니메이션 완료 시간에 맞춰 완료 신호 전송
                const timeout = remaining + 100; // 약간의 여유 시간 추가 (100ms)
                
                missileAnimationTimeoutRef.current = setTimeout(() => {
                    const currentTime = Date.now();
                    const currentElapsed = currentTime - animation.startTime;
                    console.log(`[GoBoard] SinglePlayer missile animation timeout triggered. Expected end time: ${animationEndTime}, current time: ${currentTime}, elapsed: ${currentElapsed}ms, duration: ${animation.duration}ms`);
                    
                    if (onAction && gameId) {
                        console.log(`[GoBoard] Sending SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE action after timeout for game ${gameId}`);
                        onAction({ 
                            type: 'SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE', 
                            payload: { gameId } 
                        } as any);
                    }
                    missileAnimationTimeoutRef.current = null;
                }, timeout);
            } else {
                // 멀티플레이어 게임은 서버에 완료 신호 전송
                // 이미 애니메이션이 완료되었으면 즉시 처리
                if (elapsed >= animation.duration) {
                    console.log(`[GoBoard] Missile animation already completed (elapsed=${elapsed}ms >= duration=${animation.duration}ms), triggering completion immediately`);
                    if (onAction && gameId) {
                        console.log(`[GoBoard] Sending MISSILE_ANIMATION_COMPLETE action for game ${gameId}`);
                        onAction({ 
                            type: 'MISSILE_ANIMATION_COMPLETE', 
                            payload: { gameId } 
                        });
                    }
                    return;
                }

                // 애니메이션 완료 시간에 맞춰 완료 신호 전송
                const timeout = remaining + 100; // 약간의 여유 시간 추가 (100ms)
                
                missileAnimationTimeoutRef.current = setTimeout(() => {
                    const currentTime = Date.now();
                    const currentElapsed = currentTime - animation.startTime;
                    console.log(`[GoBoard] Missile animation timeout triggered. Expected end time: ${animationEndTime}, current time: ${currentTime}, elapsed: ${currentElapsed}ms, duration: ${animation.duration}ms`);
                    
                    if (onAction && gameId) {
                        console.log(`[GoBoard] Sending MISSILE_ANIMATION_COMPLETE action after timeout for game ${gameId}`);
                        onAction({ 
                            type: 'MISSILE_ANIMATION_COMPLETE', 
                            payload: { gameId } 
                        });
                    }
                    missileAnimationTimeoutRef.current = null;
                }, timeout);
            }
        }

        return () => {
            if (missileAnimationTimeoutRef.current) {
                clearTimeout(missileAnimationTimeoutRef.current);
                missileAnimationTimeoutRef.current = null;
            }
        };
    }, [animation, gameStatus, onAction, gameId, isSinglePlayer]);

    const isLastMoveMarkerEnabled = useMemo(() => {
        const strategicModes = SPECIAL_GAME_MODES.map(m => m.mode);
        const enabledPlayfulModes = [GameMode.Omok, GameMode.Ttamok, GameMode.Dice, GameMode.Thief];
        return strategicModes.includes(mode) || enabledPlayfulModes.includes(mode) || gameStatus.startsWith('single_player');
    }, [mode, gameStatus]);

    useEffect(() => {
        if (gameStatus !== 'missile_selecting') {
            setSelectedMissileStone(null);
        }
    }, [gameStatus]);

    const starPoints = useMemo(() => {
        if (safeBoardSize === 19) return [{ x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 }, { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 }];
        if (safeBoardSize === 15) return [{ x: 3, y: 3 }, { x: 11, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 11 }, { x: 11, y: 11 }];
        if (safeBoardSize === 13) return [{ x: 3, y: 3 }, { x: 9, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 6, y: 6 }];
        if (safeBoardSize === 11) return [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 8 }, { x: 8, y: 8 }];
        if (safeBoardSize === 9) return [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 6 }, { x: 6, y: 6 }];
        if (safeBoardSize === 7) return [{ x: 3, y: 3 }];
        return [];
    }, [safeBoardSize]);

    // 화면 좌표 → SVG 루트(viewBox) 좌표. 회전은 CSS가 아니라 <g transform="rotate(180)">로 처리하므로
    // getScreenCTM()에는 g 회전이 포함되지 않아, isRotated일 때 180° 중심 대칭을 수동 적용한다.
    const toSvgCoords = (p: Point) => ({
        cx: padding + p.x * cell_size,
        cy: padding + p.y * cell_size,
    });

    const screenToSvgRootPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
        const svg = svgRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const rootP = pt.matrixTransform(ctm.inverse());
        if (!isRotated) return { x: rootP.x, y: rootP.y };
        const cx = boardSizePx / 2;
        const cy = boardSizePx / 2;
        return { x: 2 * cx - rootP.x, y: 2 * cy - rootP.y };
    };
    
    const getBoardCoordinates = (e: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>): Point | null => {
        const sp = screenToSvgRootPoint(e.clientX, e.clientY);
        if (!sp) return null;
        const fx = (sp.x - padding) / cell_size;
        const fy = (sp.y - padding) / cell_size;
        // 가장 가까운 교차점으로 스냅 후 [0, size)로 클램프 — 모서리는 살짝 밀린 클릭이 round로 size/-1이 되어 무시되던 문제 방지
        const x = Math.min(safeBoardSize - 1, Math.max(0, Math.round(fx)));
        const y = Math.min(safeBoardSize - 1, Math.max(0, Math.round(fy)));
        const snapTol = 0.52;
        if (Math.abs(fx - x) > snapTol || Math.abs(fy - y) > snapTol) return null;

        return { x, y };
    };
    
    const getNeighbors = useCallback((p: Point): Point[] => {
        const neighbors: Point[] = [];
        if (p.x > 0) neighbors.push({ x: p.x - 1, y: p.y });
        if (p.x < safeBoardSize - 1) neighbors.push({ x: p.x + 1, y: p.y });
        if (p.y > 0) neighbors.push({ x: p.x, y: p.y - 1 });
        if (p.y < safeBoardSize - 1) neighbors.push({ x: p.x, y: p.y + 1 });
        return neighbors;
    }, [safeBoardSize]);
    
    const handleBoardPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        const boardPos = getBoardCoordinates(e);
        if (!boardPos) return;
        setHoverPos(boardPos);
    
        if (gameStatus === 'missile_selecting' && !isBoardDisabled) {
            // 최신 boardState를 기준으로 확인 (새로 놓은 돌도 포함)
            const actualPlayerAtPos = boardState?.[boardPos.y]?.[boardPos.x] ?? displayBoardState[boardPos.y]?.[boardPos.x];
            if (actualPlayerAtPos === myPlayerEnum) {
                const neighbors = getNeighbors(boardPos);
                const hasLiberty = neighbors.some(n => {
                    const neighborPlayer = boardState?.[n.y]?.[n.x] ?? displayBoardState[n.y]?.[n.x];
                    return neighborPlayer === Player.None;
                });
                if (hasLiberty) {
                    setSelectedMissileStone(boardPos);
                    setIsDraggingMissile(true);
                    setDragStartPoint({ x: e.clientX, y: e.clientY });
                    dragStartBoardPoint.current = boardPos;
                    (e.target as SVGSVGElement).setPointerCapture(e.pointerId);
                }
            }
        }
    };

    const handleBoardPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const pos = getBoardCoordinates(e);
        setHoverPos(pos);
        if (isDraggingMissile) {
            setDragEndPoint({ x: e.clientX, y: e.clientY });
        }
    };
    
    const handleBoardPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        // 우클릭 차단 (치명적 버그 방지)
        if (e.button === 2 || e.buttons === 2) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        (e.target as SVGSVGElement).releasePointerCapture(e.pointerId);
        const boardPos = getBoardCoordinates(e);

        if (isDraggingMissile) {
            const dragDistance = dragStartPoint && dragEndPoint ? Math.hypot(dragEndPoint.x - dragStartPoint.x, dragEndPoint.y - dragStartPoint.y) : 0;
            const startStone = dragStartBoardPoint.current;

            setIsDraggingMissile(false);
            setDragStartPoint(null);
            setDragEndPoint(null);

            if (!isMobile && dragDistance < 10) {
                // It's a click, leave the stone selected for the arrow-based launch.
                return;
            } else if (startStone && boardPos && onMissileLaunch) {
                const dx = boardPos.x - startStone.x;
                const dy = boardPos.y - startStone.y;

                if (dx !== 0 || dy !== 0) {
                    let direction: 'up' | 'down' | 'left' | 'right';
                    if (Math.abs(dx) > Math.abs(dy)) {
                        direction = dx > 0 ? 'right' : 'left';
                    } else {
                        direction = dy > 0 ? 'down' : 'up';
                    }
                    onMissileLaunch(startStone, direction);
                    setSelectedMissileStone(null);
                }
            }
        } else if (!isBoardDisabled && boardPos) {
            // 스캔: 교차점만 지정하면 되므로 돌이 있는 자리(구석 등)도 클릭 허용 — isOpponentHiddenStoneAtPos는 playing/hidden_placing 전용이라 여기서는 항상 false였음
            if (gameStatus === 'scanning') {
                onBoardClick(boardPos.x, boardPos.y);
                return;
            }

            // 베이스돌 배치에서는 baseStones_p1/p2가 boardState에 반영되지 않아서,
            // 같은 좌표를 다시 클릭해도 서버 오류(중복 배치)까지 기다릴 수 있음.
            // 내 베이스돌 위치는 즉시 클릭을 막아 UX를 개선.
            if (gameStatus === 'base_placement') {
                if (myBaseStonesForPlacement?.some((st) => st.x === boardPos.x && st.y === boardPos.y)) {
                    return;
                }
            }

            const stoneAtPos = displayBoardState[boardPos.y]?.[boardPos.x];
            
            if (stoneAtPos === myPlayerEnum) {
                console.error(`[GoBoard] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${boardPos.x}, ${boardPos.y}), myPlayerEnum=${myPlayerEnum}`);
                return;
            }
            
            if (stoneAtPos !== Player.None && !isOpponentHiddenStoneAtPos(boardPos)) {
                console.error(`[GoBoard] CRITICAL BUG PREVENTION: Attempted to place stone on occupied position at (${boardPos.x}, ${boardPos.y}), stoneAtPos=${stoneAtPos}`);
                return;
            }
            
            onBoardClick(boardPos.x, boardPos.y);
        }
    };
    
    // 우클릭 차단 핸들러
    const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    const myBaseStonesForPlacement = useMemo(() => {
        if (gameStatus !== 'base_placement') return null;
        return myPlayerEnum === Player.Black ? baseStones_p1 : baseStones_p2;
    }, [gameStatus, myPlayerEnum, baseStones_p1, baseStones_p2]);


    const isOpponentHiddenStoneAtPos = (pos: Point): boolean => {
        if (!hiddenMoves || !moveHistory) return false;
        if (gameStatus !== 'playing' && gameStatus !== 'hidden_placing') return false;

        const opponentPlayer = myPlayerEnum === Player.Black ? Player.White : Player.Black;
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const move = moveHistory[i];
            if (move.x === pos.x && move.y === pos.y) {
                return !!hiddenMoves[i] && move.player === opponentPlayer;
            }
        }
        return false;
    };
    
    const isGameFinished = gameStatus === 'ended' || gameStatus === 'no_contest';

    const showHoverPreview = hoverPos && !isBoardDisabled && gameStatus !== 'scanning' && gameStatus !== 'missile_selecting' && (
        displayBoardState[hoverPos.y][hoverPos.x] === Player.None || 
        isOpponentHiddenStoneAtPos(hoverPos)
    );
    
    const renderDeadStoneMarkers = () => {
        if (!showTerritoryOverlay || !analysisResult || !analysisResult.deadStones) return null;

        return (
            <g style={{ pointerEvents: 'none' }} className="animate-fade-in">
                {analysisResult.deadStones.map((p, i) => {
                    const { cx, cy } = toSvgCoords(p);
                    // 사석의 색상: 보드에 돌이 있으면 그 색(잡힌 쪽), 없으면 이미 제거된 돌이므로 잡은 쪽을 반대색으로 추정
                    const deadStonePlayer = displayBoardState[p.y]?.[p.x];
                    const capturingPlayer = deadStonePlayer === Player.Black ? Player.White : deadStonePlayer === Player.White ? Player.Black : Player.White; // None이면 기본 백(흑 사석)
                    
                    // 영토 표시 사각형 (잡은 쪽의 색상)
                    const cellSize = (boardSizePx - padding * 2) / safeBoardSize;
                    const size = cellSize * 0.38; // 돌 위에 얹는 작은 사각형
                    const opacity = 0.85;
                    const fill = capturingPlayer === Player.Black 
                        ? `rgba(0, 0, 0, ${opacity})` 
                        : `rgba(255, 255, 255, ${opacity})`;
                    const stroke = capturingPlayer === Player.Black 
                        ? `rgba(0, 0, 0, ${opacity * 0.5})` 
                        : `rgba(255, 255, 255, ${opacity * 0.5})`;

                    return (
                        <g key={`ds-${i}`} style={{ zIndex: 10 }}>
                            <rect
                                x={cx - size / 2}
                                y={cy - size / 2}
                                width={size}
                                height={size}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={size * 0.05}
                                rx={size * 0.15}
                                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
                            />
                        </g>
                    );
                })}
            </g>
        );
    };

    // 영토(빈 교차점)에 사석과 동일한 네모 표시
    // ownershipMap(KataGo) 또는 blackConfirmed/whiteConfirmed(수동 계가) 사용
    const renderTerritoryMarkers = () => {
        if (!showTerritoryOverlay || !analysisResult) return null;

        const cellSize = (boardSizePx - padding * 2) / safeBoardSize;
        const size = cellSize * 0.36;
        const opacity = 0.85;
        const TERRITORY_THRESHOLD = 7; // ownershipMap: -10~10, 7 이상이면 흑 영토, -7 이하면 백 영토

        const markers: React.ReactNode[] = [];

        if (analysisResult.ownershipMap) {
            // KataGo: ownershipMap 기반, 영향력(절대값)에 따라 사각형 크기 차이
            analysisResult.ownershipMap.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (displayBoardState[y]?.[x] !== Player.None) return;
                    if (Math.abs(value) < TERRITORY_THRESHOLD) return;

                    const { cx, cy } = toSvgCoords({ x, y });
                    const absValue = Math.abs(value);
                    const prob = absValue / 10;
                    const sizeMin = 0.14;
                    const sizeMax = 0.4;
                    const rectSize = cellSize * (sizeMin + (sizeMax - sizeMin) * prob);

                    const isBlackTerritory = value > 0;
                    const fill = isBlackTerritory ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`;
                    const stroke = isBlackTerritory ? `rgba(0, 0, 0, ${opacity * 0.5})` : `rgba(255, 255, 255, ${opacity * 0.5})`;

                    markers.push(
                        <g key={`territory-${y}-${x}`} style={{ zIndex: 10 }}>
                            <rect x={cx - rectSize / 2} y={cy - rectSize / 2} width={rectSize} height={rectSize} fill={fill} stroke={stroke} strokeWidth={rectSize * 0.05} rx={rectSize * 0.15} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }} />
                        </g>
                    );
                });
            });
        } else if (analysisResult.blackConfirmed?.length || analysisResult.whiteConfirmed?.length) {
            // 수동 계가: blackConfirmed/whiteConfirmed 기반
            const renderTerritoryPoint = (p: Point, isBlack: boolean, key: string) => {
                if (displayBoardState[p.y]?.[p.x] !== Player.None) return null;
                const { cx, cy } = toSvgCoords(p);
                const fill = isBlack ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`;
                const stroke = isBlack ? `rgba(0, 0, 0, ${opacity * 0.5})` : `rgba(255, 255, 255, ${opacity * 0.5})`;
                return (
                    <g key={key} style={{ zIndex: 10 }}>
                        <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill={fill} stroke={stroke} strokeWidth={size * 0.05} rx={size * 0.15} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }} />
                    </g>
                );
            };
            analysisResult.blackConfirmed?.forEach((p, i) => {
                const node = renderTerritoryPoint(p, true, `territory-b-${i}`);
                if (node) markers.push(node);
            });
            analysisResult.whiteConfirmed?.forEach((p, i) => {
                const node = renderTerritoryPoint(p, false, `territory-w-${i}`);
                if (node) markers.push(node);
            });
        }

        if (markers.length === 0) return null;
        return (
            <g style={{ pointerEvents: 'none' }} className="animate-fade-in">
                {markers}
            </g>
        );
    };

    const findMoveIndexAt = (game: Pick<LiveGameSession, 'moveHistory'>, x: number, y: number): number => {
        const moveHistory = game.moveHistory || [];
        if (!Array.isArray(moveHistory)) {
            return -1;
        }
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            if (moveHistory[i].x === x && moveHistory[i].y === y) {
                return i;
            }
        }
        return -1;
    };
    
    const renderMissileLaunchPreview = () => {
        if (gameStatus !== 'missile_selecting' || !selectedMissileStone || !onMissileLaunch) return null;

        if (isDraggingMissile && dragStartPoint && dragEndPoint) {
            const startCoords = toSvgCoords(selectedMissileStone);

            const svgDragEnd = screenToSvgRootPoint(dragEndPoint.x, dragEndPoint.y);
            if (!svgDragEnd) return null;
            
            const dx = svgDragEnd.x - startCoords.cx;
            const dy = svgDragEnd.y - startCoords.cy;

            let endCoords = { cx: startCoords.cx, cy: startCoords.cy };
            if (Math.abs(dx) > Math.abs(dy)) {
                endCoords.cx += Math.sign(dx) * cell_size * 2;
            } else {
                endCoords.cy += Math.sign(dy) * cell_size * 2;
            }

            return (
                 <g style={{ pointerEvents: 'none' }}>
                    <line x1={startCoords.cx} y1={startCoords.cy} x2={endCoords.cx} y2={endCoords.cy} stroke="rgba(239, 68, 68, 0.7)" strokeWidth="4" strokeDasharray="8 4" markerEnd="url(#arrowhead-missile)" />
                </g>
            );
        }

        // Existing click-based arrow logic
        const neighbors = getNeighbors(selectedMissileStone).filter(n => displayBoardState[n.y][n.x] === Player.None);
        if (neighbors.length === 0) return null;

        const arrowSize = cell_size * 0.4;
        const directions = [
            { dir: 'up', point: { x: selectedMissileStone.x, y: selectedMissileStone.y - 1 } },
            { dir: 'down', point: { x: selectedMissileStone.x, y: selectedMissileStone.y + 1 } },
            { dir: 'left', point: { x: selectedMissileStone.x - 1, y: selectedMissileStone.y } },
            { dir: 'right', point: { x: selectedMissileStone.x + 1, y: selectedMissileStone.y } },
        ];

        return (
            <g>
                {directions.map(({ dir, point }) => {
                    const isValidTarget = neighbors.some(n => n.x === point.x && n.y === point.y);
                    if (!isValidTarget) return null;
                    const { cx, cy } = toSvgCoords(point);
                    
                    // 각 방향에 맞는 화살표 경로
                    let arrowPath = '';
                    if (dir === 'up') {
                        arrowPath = `M ${cx} ${cy - arrowSize} L ${cx - arrowSize * 0.6} ${cy + arrowSize * 0.3} L ${cx - arrowSize * 0.3} ${cy} L ${cx + arrowSize * 0.3} ${cy} L ${cx + arrowSize * 0.6} ${cy + arrowSize * 0.3} Z`;
                    } else if (dir === 'down') {
                        arrowPath = `M ${cx} ${cy + arrowSize} L ${cx - arrowSize * 0.6} ${cy - arrowSize * 0.3} L ${cx - arrowSize * 0.3} ${cy} L ${cx + arrowSize * 0.3} ${cy} L ${cx + arrowSize * 0.6} ${cy - arrowSize * 0.3} Z`;
                    } else if (dir === 'left') {
                        arrowPath = `M ${cx - arrowSize} ${cy} L ${cx + arrowSize * 0.3} ${cy - arrowSize * 0.6} L ${cx} ${cy - arrowSize * 0.3} L ${cx} ${cy + arrowSize * 0.3} L ${cx + arrowSize * 0.3} ${cy + arrowSize * 0.6} Z`;
                    } else { // right
                        arrowPath = `M ${cx + arrowSize} ${cy} L ${cx - arrowSize * 0.3} ${cy - arrowSize * 0.6} L ${cx} ${cy - arrowSize * 0.3} L ${cx} ${cy + arrowSize * 0.3} L ${cx - arrowSize * 0.3} ${cy + arrowSize * 0.6} Z`;
                    }
                    
                    return (
                        <path
                            key={dir}
                            d={arrowPath}
                            fill="rgba(239, 68, 68, 0.8)"
                            stroke="white"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:opacity-100 opacity-80"
                            onClick={() => onMissileLaunch(selectedMissileStone, dir as any)}
                        />
                    );
                })}
            </g>
        );
    };

    // 놀이바둑 모드 확인
    const isPlayfulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
    
    return (
        <div 
            className={`relative w-full h-full min-h-0 shadow-2xl rounded-lg overflow-hidden p-0 border-4 bg-transparent go-board-panel ${isItemModeActive ? 'prism-border' : 'border-gray-800'} ${gameStatus === 'scanning' ? 'cursor-scan' : ''}`}
            style={{ 
                backgroundImage: 'none', 
                backgroundColor: 'transparent',
            }}
        >
            <div className="w-full h-full min-h-0">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${boardSizePx} ${boardSizePx}`}
                    className="w-full h-full touch-none block"
                    shapeRendering="geometricPrecision"
                    onPointerDown={handleBoardPointerDown}
                onPointerMove={handleBoardPointerMove}
                onPointerUp={handleBoardPointerUp}
                onPointerLeave={() => { setHoverPos(null); }}
                onContextMenu={handleContextMenu}
            >
                <defs>
                    <radialGradient id="slate_highlight" cx="35%" cy="35%" r="60%" fx="30%" fy="30%">
                        <stop offset="0%" stopColor="#6b7280" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="#111827" stopOpacity="0.2"/>
                    </radialGradient>
                    <radialGradient id="clamshell_highlight" cx="35%" cy="35%" r="60%" fx="30%" fy="30%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
                        <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.1"/>
                    </radialGradient>
                    <filter id="clam_grain_filter">
                        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.1 0" />
                    </filter>
                    <pattern id="clam_grain" patternUnits="userSpaceOnUse" width="100" height="100">
                        <rect width="100" height="100" fill="#f5f2e8"/>
                        <rect width="100" height="100" filter="url(#clam_grain_filter)"/>
                    </pattern>
                    {/* 미사일 불꽃 그라디언트 - 여러 레이어 */}
                    <radialGradient id="missile_fire_core" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                        <stop offset="20%" stopColor="#fef08a" stopOpacity="1" />
                        <stop offset="40%" stopColor="#fbbf24" stopOpacity="0.9" />
                        <stop offset="70%" stopColor="#f87171" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="missile_fire" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
                        <stop offset="30%" stopColor="#fbbf24" stopOpacity="0.8" />
                        <stop offset="60%" stopColor="#f87171" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="missile_fire_outer" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6" />
                        <stop offset="50%" stopColor="#f87171" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="missile_fire_particle" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#f87171" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="bonus-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    <linearGradient id="capture-score-gradient" x1="18%" y1="0%" x2="82%" y2="100%">
                        <stop offset="0%" stopColor="#ecfdf5" />
                        <stop offset="22%" stopColor="#a7f3d0" />
                        <stop offset="48%" stopColor="#34d399" />
                        <stop offset="78%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#064e3b" />
                    </linearGradient>
                    <filter id="capture-score-premium" x="-120%" y="-120%" width="340%" height="340%" colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="5.5" result="blurWide" />
                        <feFlood floodColor="#34d399" floodOpacity="0.42" result="colWide" />
                        <feComposite in="colWide" in2="blurWide" operator="in" result="glowWide" />
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blurCore" />
                        <feFlood floodColor="#6ee7b7" floodOpacity="0.75" result="colCore" />
                        <feComposite in="colCore" in2="blurCore" operator="in" result="glowCore" />
                        <feMerge>
                            <feMergeNode in="glowWide" />
                            <feMergeNode in="glowCore" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="blue-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                     <marker id="arrowhead-missile" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="rgba(239, 68, 68, 0.9)" /></marker>
                </defs>
                <g
                    transform={isRotated ? `rotate(180 ${boardSizePx / 2} ${boardSizePx / 2})` : undefined}
                    style={{ pointerEvents: 'auto' }}
                >
                <rect width={boardSizePx} height={boardSizePx} fill="#e0b484" />
                {Array.from({ length: safeBoardSize }).map((_, i) => (
                    <g key={i}>
                        <line x1={padding + i * cell_size} y1={padding} x2={padding + i * cell_size} y2={boardSizePx - padding} stroke="#54432a" strokeWidth="1.5" />
                        <line x1={padding} y1={padding + i * cell_size} x2={boardSizePx - padding} y2={padding + i * cell_size} stroke="#54432a" strokeWidth="1.5" />
                    </g>
                ))}
                {starPoints.map((p, i) => <circle key={i} {...toSvgCoords(p)} r={safeBoardSize > 9 ? 6 : 4} fill="#54432a" />)}
                
                {displayBoardState.map((row, y) => row.map((player, x) => {
                    if (player === Player.None) return null;
                    const { cx, cy } = toSvgCoords({ x, y });
                    
                    // 미사일 선택 가능 여부는 최신 boardState를 기준으로 확인 (새로 놓은 돌도 포함)
                    const actualPlayer = boardState?.[y]?.[x] ?? player;
                    
                    const isSingleLastMove = showLastMoveMarker && isLastMoveMarkerEnabled && lastMove && lastMove.x === x && lastMove.y === y;
                    const isMultiLastMove = showLastMoveMarker && isLastMoveMarkerEnabled && lastTurnStones && lastTurnStones.some(p => p.x === x && p.y === y);
                    const isLast = !!(isSingleLastMove || isMultiLastMove);
                    
                    const moveIndex = moveHistory ? findMoveIndexAt({ moveHistory } as LiveGameSession, x, y) : -1;
                    const isHiddenMove = hiddenMoves && moveIndex !== -1 && hiddenMoves[moveIndex];
                    // 서버의 영구 공개 목록 또는 현재 히든 공개 애니메이션에 포함된 돌은 공개된 것으로 표시 (반투명 해제)
                    const isInRevealAnimation = animation?.type === 'hidden_reveal' && animation.stones?.some((s: { point: Point }) => s.point.x === x && s.point.y === y);
                    const isPermanentlyRevealed = permanentlyRevealedStones?.some(p => p.x === x && p.y === y) || !!isInRevealAnimation;
                    // 히든 돌 표시 규칙 (모든 히든 사용 경기 공통): 상대에게는 기본 비공개, 스캔 시 반투명, 착수/포착 시 전체 공개
                    let isVisible = true;
                    if (isHiddenMove) {
                        if (isSpectator) {
                            isVisible = isGameFinished || !!isPermanentlyRevealed;
                        } else {
                            const isMyScanned = myRevealedStones?.some(p => p.x === x && p.y === y);
                            const isNewlyRevealed = newlyRevealed?.some(nr => nr.point.x === x && nr.point.y === y);
                            isVisible = isGameFinished || !!isPermanentlyRevealed || actualPlayer === myPlayerEnum || !!isMyScanned || !!isNewlyRevealed;
                        }
                    }

                    if (!isVisible) return null;
                    // 공개 애니메이션 중인 히든돌은 하단 보드에서 다시 그리지 않고
                    // 전용 오버레이만 렌더링해 중첩 표시를 막는다.
                    if (isInRevealAnimation) return null;
                    // 미사일 애니메이션 중에는 원래 자리와 목적지 자리의 돌을 숨김
                    if (animation?.type === 'missile') {
                        if (animation.from.x === x && animation.from.y === y) return null; // 원래 자리
                        if (animation.to.x === x && animation.to.y === y) return null; // 목적지 자리
                    }
                    if (animation?.type === 'hidden_missile') {
                        if (animation.from.x === x && animation.from.y === y) return null; // 원래 자리
                        if (animation.to.x === x && animation.to.y === y) return null; // 목적지 자리
                    }
                    
                    const isNewlyRevealedForAnim = newlyRevealed?.some(nr => nr.point.x === x && nr.point.y === y);
                    // 반투명: 내가 둔 히든 돌(비공개 상태) 또는 스캔으로만 안 돌만. 영구 공개/방금 공개된 돌은 선명하게
                    const isFaint = !isSpectator && (
                        (myRevealedStones?.some(p => p.x === x && p.y === y) && !isPermanentlyRevealed) ||
                        (isHiddenMove && actualPlayer === myPlayerEnum && !isPermanentlyRevealed && !isNewlyRevealedForAnim)
                    );

                    const isBaseStone = baseStones?.some(stone => stone.x === x && stone.y === y && stone.player === actualPlayer);
                    // 히든 돌은 공개되어도 히든 문양을 유지. 상대 미공개 히든은 위에서 return null.
                    // (이전: 마지막 수만 문양 제외 → 본인 히든 착수 직후·스캔 직후에도 문양이 안 보이는 버그)
                    const isKnownHidden = !!isHiddenMove;
                    const isSelectedMissileForRender = selectedMissileStone?.x === x && selectedMissileStone?.y === y;
                    // 미사일 선택 가능 여부: 최신 boardState를 기준으로 확인 (새로 놓은 돌도 포함)
                    const isHoverSelectableMissile = gameStatus === 'missile_selecting' && !selectedMissileStone && actualPlayer === myPlayerEnum;
                    
                    // 문양 결정: 히든 돌이 아닌 경우에만 패턴 문양 표시
                    // 히든 돌(공개 여부와 관계없이)은 히든 문양을 우선 표시하므로 패턴 문양을 표시하지 않음
                    let isPatternStone = false;
                    if (!isHiddenMove) {
                        const patternConsumedHere = consumedPatternIntersections?.some((p) => p.x === x && p.y === y);
                        if (!patternConsumedHere) {
                            isPatternStone =
                                ((actualPlayer === Player.Black && blackPatternStones?.some((p) => p.x === x && p.y === y)) ||
                                    (actualPlayer === Player.White && whitePatternStones?.some((p) => p.x === x && p.y === y))) ??
                                false;
                        }
                    }

                    
                    return <Stone key={`${x}-${y}`} player={actualPlayer} cx={cx} cy={cy} isLastMove={isLast} isKnownHidden={isKnownHidden as boolean} isBaseStone={isBaseStone} isPatternStone={isPatternStone} isNewlyRevealed={isNewlyRevealedForAnim} animationClass={isNewlyRevealedForAnim ? 'sparkle-animation' : ''} isSelectedMissile={isSelectedMissileForRender} isHoverSelectableMissile={isHoverSelectableMissile} radius={stone_radius} isFaint={isFaint} />;
                }))}
                {myBaseStonesForPlacement?.map((stone, i) => {
                    const { cx, cy } = toSvgCoords(stone);
                    return (
                        <g key={`my-base-${i}`} opacity={0.7} className="animate-fade-in">
                            <Stone player={myPlayerEnum} cx={cx} cy={cy} isBaseStone radius={stone_radius} />
                        </g>
                    );
                })}
                {winningLine && winningLine.length > 0 && ( <path d={`M ${toSvgCoords(winningLine[0]).cx} ${toSvgCoords(winningLine[0]).cy} L ${toSvgCoords(winningLine[winningLine.length - 1]).cx} ${toSvgCoords(winningLine[winningLine.length - 1]).cy}`} stroke="rgba(239, 68, 68, 0.8)" strokeWidth="10" strokeLinecap="round" className="animate-fade-in" /> )}
                
                {/* 착수 버튼 모드/AI 낙관 표시용 임시 돌 (예상착점) */}
                {pendingMove && (() => {
                    const { cx, cy } = toSvgCoords({ x: pendingMove.x, y: pendingMove.y });
                    return (
                        <g opacity={0.45} style={{ pointerEvents: 'none' }}>
                            <Stone
                                player={pendingMove.player}
                                cx={cx}
                                cy={cy}
                                radius={stone_radius}
                                isLastMove={false}
                                isPending={true}
                            />
                        </g>
                    );
                })()}
                
                {highlightedPoints && highlightedPoints.map((p, i) => {
                    const { cx, cy } = toSvgCoords(p);
                    if (highlightStyle === 'ring') {
                        return (
                            <circle
                                key={`highlight-ring-${i}`}
                                cx={cx}
                                cy={cy}
                                r={stone_radius * 0.9}
                                fill="none"
                                stroke="#0ea5e9"
                                strokeWidth="3"
                                strokeDasharray="5 3"
                                className="animate-pulse"
                                style={{ pointerEvents: 'none' }}
                            />
                        );
                    }
                    return (
                        <circle
                            key={`highlight-circle-${i}`}
                            cx={cx}
                            cy={cy}
                            r={stone_radius * 0.3}
                            fill={currentPlayer === Player.Black ? "black" : "white"}
                            opacity="0.3"
                        />
                    );
                })}

                {showHoverPreview && hoverPos && ( <g opacity="0.5"> <Stone player={stoneColor} cx={toSvgCoords(hoverPos).cx} cy={toSvgCoords(hoverPos).cy} radius={stone_radius} /> </g> )}
                {renderMissileLaunchPreview()}
                {/* 계가/결과 모달 중에는 미사일 등 애니메이션 미표시 — 최종 보드만 표시 */}
                {animation && !isScoringOrEnded && (() => {
                    return (
                        <>
                            {(animation.type === 'missile' || animation.type === 'hidden_missile') && (() => {
                                const fromKind = classifyMissileFromStone(
                                    animation.from,
                                    moveHistory,
                                    hiddenMoves,
                                    permanentlyRevealedStones,
                                    myRevealedStones
                                );
                                // 완전 비공개 히든: 날아가는 돌·불꽃 없음 (발사음은 Game.tsx에서 1회)
                                if (fromKind === 'unrevealed_hidden') {
                                    return null;
                                }
                                const animKey = `missile-flight-${animation.from.x}-${animation.from.y}-${animation.to.x}-${animation.to.y}-${animation.startTime}`;
                                if (fromKind === 'scan_only_hidden') {
                                    return (
                                        <g key={animKey} opacity={0.52} style={{ pointerEvents: 'none' }}>
                                            <AnimatedHiddenMissile
                                                animation={animation}
                                                stone_radius={stone_radius}
                                                toSvgCoords={toSvgCoords}
                                            />
                                        </g>
                                    );
                                }
                                if (fromKind === 'revealed_hidden') {
                                    return (
                                        <AnimatedHiddenMissile
                                            key={animKey}
                                            animation={animation}
                                            stone_radius={stone_radius}
                                            toSvgCoords={toSvgCoords}
                                        />
                                    );
                                }
                                // 일반 돌 (서버가 상대 히든 공개 등으로 hidden_missile 타입을 쓴 경우 포함)
                                const asMissile = { ...animation, type: 'missile' as const };
                                return (
                                    <AnimatedMissileStone
                                        key={animKey}
                                        animation={asMissile}
                                        stone_radius={stone_radius}
                                        toSvgCoords={toSvgCoords}
                                    />
                                );
                            })()}
                            {animation.type === 'scan' && !isSpectator && animation.playerId === currentUser.id && <AnimatedScanMarker animation={animation} toSvgCoords={toSvgCoords} stone_radius={stone_radius} />}
                            {animation.type === 'hidden_reveal' && animation.stones.map((s, i) => ( <Stone key={`reveal-${i}`} player={s.player} cx={toSvgCoords(s.point).cx} cy={toSvgCoords(s.point).cy} isKnownHidden isNewlyRevealed animationClass="sparkle-animation" radius={stone_radius} /> ))}
                            {animation.type === 'bonus_text' && <AnimatedBonusText animation={animation} toSvgCoords={toSvgCoords} cellSize={cell_size} isRotated={isRotated} />}
                        </>
                    );
                })()}
                {!isScoringOrEnded &&
                    captureScoreFloats.map((f) => {
                        const { cx, cy } = toSvgCoords(f.point);
                        const fs = cell_size * 1.42;
                        const sw = Math.max(1.6, cell_size * 0.1);
                        return (
                            <g key={f.id} transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
                                <g transform={isRotated ? 'scale(1,-1)' : undefined}>
                                <g className="capture-points-float-inner">
                                    <text
                                        x={0}
                                        y={0}
                                        textAnchor="middle"
                                        dy=".35em"
                                        fontSize={fs}
                                        className="capture-score-float-text"
                                        fill="url(#capture-score-gradient)"
                                        stroke="#022c22"
                                        strokeWidth={sw}
                                        paintOrder="stroke fill"
                                        filter="url(#capture-score-premium)"
                                    >
                                        {f.label}
                                    </text>
                                </g>
                                </g>
                            </g>
                        );
                    })}
                {renderTerritoryMarkers()}
                {renderDeadStoneMarkers()}
                {showHintOverlay && !isBoardDisabled && analysisResult?.recommendedMoves?.map(move => ( <RecommendedMoveMarker key={`rec-${move.order}`} move={move} toSvgCoords={toSvgCoords} cellSize={cell_size} onClick={onBoardClick} /> ))}
                </g>
            </svg>
            </div>
        </div>
    );
};

export default GoBoard;