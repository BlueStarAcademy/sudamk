import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { BoardState, Point, Player, GameStatus, Move, AnalysisResult, LiveGameSession, User, AnimationData, GameMode, RecommendedMove, ServerAction } from '../types.js';
import { WHITE_BASE_STONE_IMG, BLACK_BASE_STONE_IMG, WHITE_HIDDEN_STONE_IMG, BLACK_HIDDEN_STONE_IMG } from '../assets.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';

/** 따내기/보너스 점수 플로트: mid(5~9) 기준 폰트 배율 */
const CAPTURE_SCORE_FLOAT_BASE_EM = 1.42;
const CAPTURE_SCORE_FLOAT_TIER_STANDARD_MIN = 5;
const CAPTURE_SCORE_FLOAT_TIER_CRITICAL_MIN = 10;

type CaptureScoreFloatTier = 'low' | 'mid' | 'high';

function captureScoreFloatTierFromPoints(points: number): CaptureScoreFloatTier {
    if (points >= CAPTURE_SCORE_FLOAT_TIER_CRITICAL_MIN) return 'high';
    if (points >= CAPTURE_SCORE_FLOAT_TIER_STANDARD_MIN) return 'mid';
    return 'low';
}

function parseBonusTextPoints(text: string): number | null {
    const m = /^\+(\d+)/.exec(text.trim());
    return m ? Number.parseInt(m[1], 10) : null;
}

function getCaptureScoreFloatVisual(cellSize: number, points: number) {
    const tier = captureScoreFloatTierFromPoints(points);
    const baseFs = cellSize * CAPTURE_SCORE_FLOAT_BASE_EM;
    const baseSw = Math.max(1.6, cellSize * 0.1);
    let fontSize: number;
    let strokeWidth: number;
    if (tier === 'low') {
        fontSize = baseFs * 0.82;
        strokeWidth = Math.max(1.35, cellSize * 0.085);
    } else if (tier === 'high') {
        fontSize = baseFs * 1.09;
        strokeWidth = Math.max(1.8, cellSize * 0.11);
    } else {
        fontSize = baseFs;
        strokeWidth = baseSw;
    }
    const stroke = tier === 'high' ? '#422006' : '#022c22';
    const fillUrl =
        tier === 'low'
            ? 'url(#capture-score-gradient-low)'
            : tier === 'high'
              ? 'url(#capture-score-gradient-critical)'
              : 'url(#capture-score-gradient-mid)';
    const filterUrl =
        tier === 'low'
            ? 'url(#capture-score-premium-low)'
            : tier === 'high'
              ? 'url(#capture-score-premium-critical)'
              : 'url(#capture-score-premium-mid)';
    const innerClassName =
        tier === 'low'
            ? 'capture-points-float-inner capture-points-float-inner--low'
            : tier === 'high'
              ? 'capture-points-float-inner capture-points-float-inner--critical'
              : 'capture-points-float-inner capture-points-float-inner--mid';
    return { tier, fontSize, strokeWidth, stroke, fillUrl, filterUrl, innerClassName };
}

const AnimatedBonusText: React.FC<{
    animation: Extract<AnimationData, { type: 'bonus_text' }>;
    toSvgCoords: (p: Point) => { cx: number; cy: number };
    cellSize: number;
    isRotated?: boolean;
}> = ({ animation, toSvgCoords, cellSize, isRotated }) => {
    const { text, point } = animation;
    const { cx, cy } = toSvgCoords(point);
    const parsed = parseBonusTextPoints(text);
    const vis = getCaptureScoreFloatVisual(cellSize, parsed ?? CAPTURE_SCORE_FLOAT_TIER_STANDARD_MIN);

    const durS = Math.max(1.2, (animation.duration ?? 2500) / 1000);
    return (
        <g style={{ pointerEvents: 'none' }} transform={`translate(${cx}, ${cy})`}>
            {/* 보드 180도 회전 시에도 텍스트가 좌우 반전되지 않도록 전체를 역회전 보정 */}
            <g transform={isRotated ? 'rotate(180)' : undefined}>
                <g className={vis.innerClassName} style={{ animationDuration: `${durS}s` }}>
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dy=".35em"
                        fontSize={vis.fontSize}
                        className="capture-score-float-text"
                        fill={vis.fillUrl}
                        stroke={vis.stroke}
                        strokeWidth={vis.strokeWidth}
                        paintOrder="stroke fill"
                        filter={vis.filterUrl}
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

type MissileFlightAnimation = Extract<AnimationData, { type: 'missile' }> | Extract<AnimationData, { type: 'hidden_missile' }>;

const AnimatedHiddenMissile: React.FC<{
    animation: MissileFlightAnimation;
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
    boardSizePx: number;
    padding: number;
    cellSize: number;
    /** 스캔 성공 시 해당 교차점의 돌 색 (히든 문양 오버레이용) */
    revealPlayer: Player;
}> = ({ animation, toSvgCoords, stone_radius, boardSizePx, padding, cellSize, revealPlayer }) => {
    const { point, success } = animation;
    const { cx, cy } = toSvgCoords(point);
    const size = stone_radius * 2.5;
    const durMs = animation.duration ?? 2000;
    const sweepMs = Math.round(durMs * 0.42);
    const resultMs = Math.max(80, durMs - sweepMs);

    const gridX = padding;
    const gridY = padding;
    const gridW = boardSizePx - padding * 2;
    const gridH = boardSizePx - padding * 2;
    const beamW = Math.max(cellSize * 2.4, stone_radius * 5);
    const uid = React.useId().replace(/:/g, '');
    const clipId = `scan-clip-${uid}`;
    const gradFailId = `scan-sweep-fail-${uid}`;
    const gradOkId = `scan-sweep-ok-${uid}`;

    const sweepStyle = {
        '--scan-travel': `${gridW + beamW}px`,
        animationDuration: `${sweepMs}ms`,
    } as React.CSSProperties & { '--scan-travel': string };

    const resultPhaseStyle: React.CSSProperties = {
        animationDuration: `${resultMs}ms`,
        animationDelay: `${sweepMs}ms`,
    };

    return (
        <g style={{ pointerEvents: 'none' }}>
            <defs>
                <clipPath id={clipId}>
                    <rect x={gridX} y={gridY} width={gridW} height={gridH} rx={cellSize * 0.08} />
                </clipPath>
                <linearGradient id={gradFailId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={beamW} y2={0}>
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
                    <stop offset="35%" stopColor="#fde68a" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#f8fafc" stopOpacity="0.85" />
                    <stop offset="65%" stopColor="#fde68a" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={gradOkId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={beamW} y2={0}>
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
                    <stop offset="38%" stopColor="#6ee7b7" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#ecfdf5" stopOpacity="0.72" />
                    <stop offset="62%" stopColor="#6ee7b7" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
            </defs>

            <g clipPath={`url(#${clipId})`}>
                <g transform={`translate(${gridX - beamW}, ${gridY})`}>
                    <rect
                        width={beamW}
                        height={gridH}
                        fill={success ? `url(#${gradOkId})` : `url(#${gradFailId})`}
                        className={success ? 'scan-sweep-beam scan-sweep-beam--success' : 'scan-sweep-beam scan-sweep-beam--fail'}
                        style={sweepStyle}
                    />
                </g>
            </g>

            {success ? (
                revealPlayer !== Player.None && (
                    <g transform={`translate(${cx}, ${cy})`}>
                        <g className="scan-success-stone-wrap" style={resultPhaseStyle}>
                            <g opacity={0.58}>
                                <Stone player={revealPlayer} cx={0} cy={0} isKnownHidden radius={stone_radius} />
                            </g>
                        </g>
                    </g>
                )
            ) : (
                <g transform={`translate(${cx}, ${cy})`}>
                    <g className="scan-fail-x-wrap" style={resultPhaseStyle}>
                        <line
                            x1={-size * 0.48}
                            y1={-size * 0.48}
                            x2={size * 0.48}
                            y2={size * 0.48}
                            fill="none"
                            stroke="rgba(254, 243, 199, 0.98)"
                            strokeWidth={Math.max(2.2, size * 0.1)}
                            strokeLinecap="round"
                            className="scan-fail-x-line"
                        />
                        <line
                            x1={size * 0.48}
                            y1={-size * 0.48}
                            x2={-size * 0.48}
                            y2={size * 0.48}
                            fill="none"
                            stroke="rgba(251, 191, 36, 0.92)"
                            strokeWidth={Math.max(2.2, size * 0.1)}
                            strokeLinecap="round"
                            className="scan-fail-x-line"
                        />
                    </g>
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

const Stone: React.FC<{ player: Player, cx: number, cy: number, isLastMove?: boolean, isSelectedMissile?: boolean, isHoverSelectableMissile?: boolean, isKnownHidden?: boolean, isNewlyRevealed?: boolean, animationClass?: string, isPending?: boolean, isBaseStone?: boolean, isPatternStone?: boolean, radius: number, isFaint?: boolean, keepUpright?: boolean }> = ({ player, cx, cy, isLastMove, isSelectedMissile, isHoverSelectableMissile, isKnownHidden, isNewlyRevealed, animationClass, isPending, isBaseStone, isPatternStone, radius, isFaint, keepUpright }) => {
    const specialImageSize = radius * 2 * 0.7;
    const specialImageOffset = specialImageSize / 2;

    const strokeColor = isPending ? 'rgb(34, 197, 94)'
        : isSelectedMissile ? 'rgb(239, 68, 68)'
        : 'none';
    
    const strokeWidth = isSelectedMissile || isPending ? 3.5 : 0;

    return (
        <g
            className={`${animationClass || ''} ${isHoverSelectableMissile ? 'missile-selectable-stone' : ''}`}
            opacity={isPending ? 0.6 : (isFaint ? 0.52 : 1)}
            transform={keepUpright ? `rotate(180 ${cx} ${cy})` : undefined}
        >
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

function lastMoveIndexAtForHiddenClassify(moveHistory: Move[], x: number, y: number): number {
    for (let i = moveHistory.length - 1; i >= 0; i--) {
        if (moveHistory[i].x === x && moveHistory[i].y === y) return i;
    }
    return -1;
}

/** 미사일로 움직이는 출발 칸 돌의 히든 표시 방식 (내 시점 기준 스캔 목록 사용) */
function classifyMissileFromStone(
    from: Point,
    moveHistory: Move[] | undefined,
    hiddenMoves: { [moveIndex: number]: boolean } | undefined,
    permanentlyRevealedStones: Point[] | undefined,
    myRevealedStones: Point[] | undefined,
    myRevealedMoveIndices?: readonly number[] | undefined
): 'normal' | 'unrevealed_hidden' | 'scan_only_hidden' | 'revealed_hidden' {
    if (!moveHistory?.length || !hiddenMoves) return 'normal';
    const moveIndex = lastMoveIndexAtForHiddenClassify(moveHistory, from.x, from.y);
    if (moveIndex === -1 || !hiddenMoves[moveIndex]) return 'normal';
    if (permanentlyRevealedStones?.some(p => p.x === from.x && p.y === from.y)) return 'revealed_hidden';
    const softByIndex = myRevealedMoveIndices != null && myRevealedMoveIndices.includes(moveIndex);
    const softByCoord =
        myRevealedMoveIndices === undefined && (myRevealedStones?.some(p => p.x === from.x && p.y === from.y) ?? false);
    if (softByIndex || softByCoord) return 'scan_only_hidden';
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
  /** 내가 스캔으로 몰래 본 히든 수순 인덱스. 있으면 좌표만으로는 판단하지 않아(같은 자리 재착수 시 반투명 버그 방지) */
  myRevealedMoveIndices?: readonly number[];
  allRevealedStones?: { [playerId: string]: Point[] };
  newlyRevealed?: { point: Point, player: Player }[];
  justCaptured?: { point: Point; player: Player; wasHidden: boolean; capturePoints?: number; capturerId?: string }[];
  permanentlyRevealedStones?: Point[];
  blackPatternStones?: Point[];
  whitePatternStones?: Point[];
  /** 문양이 영구 소모된 교차점 — 같은 자리에 다시 두어도 문양 표시 안 함 */
  consumedPatternIntersections?: Point[];
  /** AI 히든 아이템 직후 등: moveHistory/hiddenMoves와 한 틱 어긋나도 히든 문양이 패턴으로 깜빡이지 않게 함 */
  aiInitialHiddenStone?: Point | null;
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
  /** 모험 지역 이해도 시작 가산(캡처 점수) — 첫 수에서 이 값만 오른 따낸 점수 플로트는 표시하지 않음 */
  adventureRegionalHeadStartCaptureBonus?: number;
  /** 패·둘 수 없는 자리 등 — TurnDisplay 전광판 */
  onBoardRuleFlash?: (message: string) => void;
  /** 온보딩: 화살표 위치 측정용 투명 앵커(SVG) */
  onboardingDemoAnchorPoint?: Point | null;
  /** 온보딩: 이 교차점만 착수 허용(싱글 등) */
  onboardingForcedFirstMovePoint?: Point | null;
}

const GoBoard: React.FC<GoBoardProps> = (props) => {
    const { 
        boardState, boardSize, onBoardClick, onMissileLaunch, lastMove, lastTurnStones, isBoardDisabled, 
        stoneColor, winningLine, hiddenMoves, moveHistory, baseStones, baseStones_p1, baseStones_p2,
        myPlayerEnum,
        gameStatus,
        highlightedPoints,
        highlightStyle = 'circle',
        myRevealedStones,
        myRevealedMoveIndices,
        allRevealedStones,
        newlyRevealed,
        isSpectator,
        analysisResult, showTerritoryOverlay = false, showHintOverlay = false, currentUser, blackPlayerNickname, whitePlayerNickname,
        currentPlayer, isItemModeActive, animation, mode, mixedModes, justCaptured, permanentlyRevealedStones, onAction, gameId,
        showLastMoveMarker, blackPatternStones, whitePatternStones, consumedPatternIntersections,
        aiInitialHiddenStone = undefined,
        isSinglePlayer = false, isRotated = false, pendingMove = null,
        captureScoreFloatMinPoints = 2,
        captures,
        adventureRegionalHeadStartCaptureBonus = 0,
        onBoardRuleFlash,
        onboardingDemoAnchorPoint = null,
        onboardingForcedFirstMovePoint = null,
    } = props;
    /** playing 중에 세션에 남은 stale newlyRevealed로 스파클·가시성이 매 수 재생되는 것 방지 */
    const isHiddenRevealStatus =
        gameStatus === 'hidden_reveal_animating' || gameStatus === 'hidden_final_reveal';
    const effectiveNewlyRevealed = isHiddenRevealStatus ? newlyRevealed : undefined;
    const [captureScoreFloats, setCaptureScoreFloats] = useState<
        { id: string; point: Point; label: string; points: number }[]
    >([]);
    /** 서버는 justCaptured를 누적하므로, 이번 업데이트에서 새로 추가된 항목만 처리 */
    const processedJustCapturedCountRef = useRef<number>(0);
    /** DOM/Node 타이머 핸들 혼용 — clearTimeout 양쪽 모두 수용 */
    const captureFloatTimeoutsRef = useRef<Array<number | ReturnType<typeof setTimeout>>>([]);
    const lastMoveForFloatRef = useRef<Point | null>(null);
    lastMoveForFloatRef.current = lastMove;
    /** captures 기반: 직전 커밋한 수(moveHistory 인덱스·좌표·플레이어) — 증분·justCaptured 슬라이스 동기화용 */
    const lastFloatedMoveKeyRef = useRef<string>('');
    /** 실제 +N 플로트를 이미 띄운 수 — 동일 수에 대한 병합/연속 렌더로 이중 재생 방지 */
    const lastCaptureScoreFloatPushedMoveKeyRef = useRef<string>('');
    /** 동일 시그니처(+점수/앵커/수순)의 짧은 시간 중복 재생 방지 */
    const lastCaptureFloatSignatureRef = useRef<string>('');
    const lastCaptureFloatSignatureAtRef = useRef<number>(0);
    const prevCapturesForFloatRef = useRef<Partial<Record<Player, number>> | null>(null);
    /** 미사일 연출 중 매 프레임 착지점 (애니 종료 후 null이 되어도 여기 남음) */
    const lastMissileAnimationToRef = useRef<Point | null>(null);
    /** missile_animating → playing 직후: 따내기 점수 플로트를 이동한 내 돌 위치에서 띄우기 위한 앵커 */
    const missileCaptureScoreAnchorRef = useRef<Point | null>(null);
    const prevGameStatusForMissileFloatRef = useRef<GameStatus | undefined>(undefined);
    const isMyCaptureByPlayer = (capturer: Player): boolean =>
        myPlayerEnum !== Player.None && capturer === myPlayerEnum;

    // 대국 세션이 바뀔 때만 초기화한다. justCaptured/captures/moveHistory를 deps에 넣으면
    // 매 수마다 이 effect가 먼저 돌아 processed·prevCaptures가 최신으로 덮여,
    // 디바운스된 포톤 effect에서 증분·신규 슬라이스가 비어 애니가 아예 안 뜬다.
    useEffect(() => {
        // 새로고침/재마운트 시 서버에 남아있는 마지막 justCaptured를 "신규 캡처"로 오인해
        // 점수 플로트가 다시 재생되는 문제를 방지한다.
        processedJustCapturedCountRef.current = (justCaptured?.length ?? 0);
        lastFloatedMoveKeyRef.current = '';
        lastCaptureScoreFloatPushedMoveKeyRef.current = '';
        lastCaptureFloatSignatureRef.current = '';
        lastCaptureFloatSignatureAtRef.current = 0;
        prevCapturesForFloatRef.current = null;
        lastMissileAnimationToRef.current = null;
        missileCaptureScoreAnchorRef.current = null;
        prevGameStatusForMissileFloatRef.current = undefined;
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
        if (gameStatus === 'missile_animating' && animation && (animation.type === 'missile' || animation.type === 'hidden_missile')) {
            lastMissileAnimationToRef.current = animation.to;
        }
        if (gameStatus === 'missile_selecting') {
            missileCaptureScoreAnchorRef.current = null;
        }
        const prev = prevGameStatusForMissileFloatRef.current;
        if (prev === 'missile_animating' && gameStatus === 'playing') {
            missileCaptureScoreAnchorRef.current = lastMissileAnimationToRef.current;
        }
        prevGameStatusForMissileFloatRef.current = gameStatus;
    }, [gameStatus, animation]);

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
     *
     * 히든 공개 연출 중(animation.type === hidden_reveal)에는 플로트를 띄우지 않고,
     * 본경기로 돌아온 뒤 미공개 히든 따내기(+5 등)는 공개 애니가 끝난 다음 한 박자 늦춰 이어서 재생한다.
     */
    useEffect(() => {
        const inHiddenRevealPhase =
            gameStatus === 'hidden_reveal_animating' || gameStatus === 'hidden_final_reveal';
        if (inHiddenRevealPhase) {
            return;
        }
        const DEBOUNCE_MS = 48;
        const t = window.setTimeout(() => {
            const st = String(gameStatus);
            if (st === 'hidden_reveal_animating' || st === 'hidden_final_reveal') {
                return;
            }
            const list = justCaptured ?? [];
            const CAPTURE_FLOAT_MS = 2850;
            const minPts = captureScoreFloatMinPoints;
            /** 미공개 히든 포획(+5): 공개 연출 직후 점수 플로트를 분리 */
            const hiddenRevealScoreFloatLagMs = list.some((e) => e.wasHidden) ? 450 : 0;

            const syncJustCapturedSliceStart = () => {
                const prevCount = processedJustCapturedCountRef.current;
                if (list.length < prevCount) {
                    processedJustCapturedCountRef.current = 0;
                }
                return processedJustCapturedCountRef.current;
            };
            const newJustCapturedEntries = () => {
                const start = syncJustCapturedSliceStart();
                return list.slice(start);
            };
            const sumCapturePoints = (entries: typeof list) =>
                entries.reduce((sum, e) => sum + (e.capturePoints ?? (e.wasHidden ? 5 : 1)), 0);

            const pushFloat = (totalPts: number, anchor: Point, extraDelayMs = 0) => {
                if (totalPts < minPts) return;
                const lag = extraDelayMs + hiddenRevealScoreFloatLagMs;
                const doPush = () => {
                    const nowTs = Date.now();
                    const tailMove = moveHistory?.length ? moveHistory[moveHistory.length - 1] : null;
                    const movePart = tailMove
                        ? `${moveHistory!.length}-${tailMove.player}-${tailMove.x}-${tailMove.y}`
                        : `nomove-${gameStatus}`;
                    const sig = `${movePart}-${anchor.x}-${anchor.y}-${totalPts}`;
                    if (
                        sig === lastCaptureFloatSignatureRef.current &&
                        nowTs - lastCaptureFloatSignatureAtRef.current < 1200
                    ) {
                        return;
                    }
                    lastCaptureFloatSignatureRef.current = sig;
                    lastCaptureFloatSignatureAtRef.current = nowTs;
                    const floatId = `cap-${anchor.x}-${anchor.y}-${totalPts}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    setCaptureScoreFloats((prev) => [
                        ...prev,
                        { id: floatId, point: anchor, label: `+${totalPts}`, points: totalPts },
                    ]);
                    const clearT = window.setTimeout(() => {
                        setCaptureScoreFloats((prev) => prev.filter((x) => x.id !== floatId));
                    }, CAPTURE_FLOAT_MS);
                    captureFloatTimeoutsRef.current.push(clearT);
                };
                if (lag > 0) {
                    const tDelay = window.setTimeout(doPush, lag);
                    captureFloatTimeoutsRef.current.push(tDelay);
                } else {
                    doPush();
                }
            };

            /** 미사일로 이동한 돌(착지) 위치 — 해당 칸에 따낸 쪽 돌이 있을 때만 */
            const missileMovedStoneAnchorFor = (capturer: Player): Point | null => {
                const p = missileCaptureScoreAnchorRef.current;
                if (!p || p.x < 0 || p.y < 0) return null;
                const cell = boardState?.[p.y]?.[p.x];
                if (cell !== capturer) return null;
                return { x: p.x, y: p.y };
            };

            if (captures && moveHistory?.length) {
                const last = moveHistory[moveHistory.length - 1];
                if (!last) return;

                const moveKey = `${moveHistory.length}-${last.player}-${last.x}-${last.y}`;
                const prevSnap = prevCapturesForFloatRef.current;
                const dBlack =
                    Number(captures[Player.Black] ?? 0) - (prevSnap ? Number(prevSnap[Player.Black] ?? 0) : 0);
                const dWhite =
                    Number(captures[Player.White] ?? 0) - (prevSnap ? Number(prevSnap[Player.White] ?? 0) : 0);
                // 마지막 수를 둔 색의 증가분(일반 착점). 미사일 등 moveHistory 불변·점수만 오르는 경우는 다른 색 증가분을 사용
                let floatPlayer = last.player;
                let delta = floatPlayer === Player.Black ? dBlack : dWhite;
                if (delta < minPts && dBlack >= minPts) {
                    floatPlayer = Player.Black;
                    delta = dBlack;
                } else if (delta < minPts && dWhite >= minPts) {
                    floatPlayer = Player.White;
                    delta = dWhite;
                }

                const sliceEntries = newJustCapturedEntries();
                const slicePts = sliceEntries.length > 0 ? sumCapturePoints(sliceEntries) : 0;
                /** justCaptured만 보면 히든 5점 등이 누락될 수 있어(낙관적 갱신·슬라이스 동기), captures 증가분과 맞춤 */
                const floatPts = Math.max(slicePts, delta);
                const capturerFromSlice =
                    sliceEntries.length > 0
                        ? (sliceEntries[0].player === Player.Black ? Player.White : Player.Black)
                        : floatPlayer;

                const headStartBonus = adventureRegionalHeadStartCaptureBonus ?? 0;
                const validMovesPlaced = moveHistory.filter((m) => m && m.x >= 0 && m.y >= 0).length;
                /** 첫 착점 직후 캡처 없이 캡처 점수만 지역 가산과 동일하게 오른 경우(동기화 등) — 지역 이해도 가산 플로트 생략 */
                const lastOnBoard = last.x >= 0 && last.y >= 0;
                if (
                    headStartBonus > 0 &&
                    validMovesPlaced === 1 &&
                    sliceEntries.length === 0 &&
                    floatPts === headStartBonus &&
                    delta === headStartBonus &&
                    !lastOnBoard
                ) {
                    lastFloatedMoveKeyRef.current = moveKey;
                    prevCapturesForFloatRef.current = { ...captures };
                    processedJustCapturedCountRef.current = list.length;
                    lastCaptureScoreFloatPushedMoveKeyRef.current = moveKey;
                    return;
                }

                const commitMoveFloatState = () => {
                    lastFloatedMoveKeyRef.current = moveKey;
                    prevCapturesForFloatRef.current = { ...captures };
                    processedJustCapturedCountRef.current = list.length;
                };

                const capturerIdFromSlice = sliceEntries[0]?.capturerId;
                const isMyCapture =
                    mode === GameMode.Dice && typeof capturerIdFromSlice === 'string'
                        ? currentUser.id === capturerIdFromSlice
                        : isMyCaptureByPlayer(capturerFromSlice);
                // 내 캡처가 아니면 내 화면에서 점수 획득 플로트를 띄우지 않는다.
                if (!isMyCapture) {
                    commitMoveFloatState();
                    return;
                }

                const isPass = last.x < 0 || last.y < 0;

                if (floatPts >= minPts) {
                    if (moveKey === lastCaptureScoreFloatPushedMoveKeyRef.current) {
                        commitMoveFloatState();
                        return;
                    }
                    // justCaptured 기반 포획인데 마지막 수가 상대(예: AI) 착수면: 플로트는 실제 따낸 쪽의 마지막 착점에 붙인다
                    let anchorMove = last;
                    if (sliceEntries.length > 0) {
                        for (let i = moveHistory.length - 1; i >= 0; i--) {
                            const m = moveHistory[i];
                            if (m && m.player === capturerFromSlice && m.x >= 0 && m.y >= 0) {
                                anchorMove = m;
                                break;
                            }
                        }
                    }
                    const missileAnchor = missileMovedStoneAnchorFor(
                        sliceEntries.length > 0
                            ? sliceEntries[0].player === Player.Black
                                ? Player.White
                                : Player.Black
                            : floatPlayer
                    );
                    const anchor =
                        missileAnchor ??
                        (!isPass && anchorMove.x >= 0 && anchorMove.y >= 0
                            ? { x: anchorMove.x, y: anchorMove.y }
                            : (lastMoveForFloatRef.current ?? { x: last.x, y: last.y }));
                    if (anchor.x < 0 || anchor.y < 0) {
                        commitMoveFloatState();
                        return;
                    }
                    commitMoveFloatState();
                    if (missileAnchor) missileCaptureScoreAnchorRef.current = null;
                    lastCaptureScoreFloatPushedMoveKeyRef.current = moveKey;
                    pushFloat(floatPts, anchor, 0);
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

            const newEntries = newJustCapturedEntries();
            processedJustCapturedCountRef.current = list.length;
            if (newEntries.length === 0) return;

            const totalPts = sumCapturePoints(newEntries);
            if (totalPts < minPts) return;

            let moveKeyForSlice = '';
            if (moveHistory?.length) {
                const lm = moveHistory[moveHistory.length - 1];
                if (lm) moveKeyForSlice = `${moveHistory.length}-${lm.player}-${lm.x}-${lm.y}`;
            }
            if (moveKeyForSlice && moveKeyForSlice === lastCaptureScoreFloatPushedMoveKeyRef.current) {
                return;
            }

            const capturer =
                newEntries[0].player === Player.Black ? Player.White : Player.Black;
            const capturerIdFromEntries = newEntries[0]?.capturerId;
            const isMyCapture =
                mode === GameMode.Dice && typeof capturerIdFromEntries === 'string'
                    ? currentUser.id === capturerIdFromEntries
                    : isMyCaptureByPlayer(capturer);
            if (!isMyCapture) {
                if (captures) prevCapturesForFloatRef.current = { ...captures };
                return;
            }
            const missileAnchor = missileMovedStoneAnchorFor(capturer);
            const lm = lastMoveForFloatRef.current;
            const anchor = missileAnchor ?? (lm ? { x: lm.x, y: lm.y } : newEntries[0].point);
            if (missileAnchor) missileCaptureScoreAnchorRef.current = null;
            if (moveKeyForSlice) lastCaptureScoreFloatPushedMoveKeyRef.current = moveKeyForSlice;
            if (captures) prevCapturesForFloatRef.current = { ...captures };
            pushFloat(totalPts, anchor, 0);
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [
        justCaptured,
        captures,
        moveHistory,
        boardState,
        captureScoreFloatMinPoints,
        gameId,
        gameStatus,
        animation,
        adventureRegionalHeadStartCaptureBonus,
    ]);

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
    /** 따내기 직후 `ended`여도 +점수 플로트는 재생되게 함(`index.css` 2.85s 애니). 계가·무승부만 숨김 */
    const hideCaptureScoreFloatOverlay = gameStatus === 'scoring' || gameStatus === 'no_contest';

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
        const rect = svg.getBoundingClientRect();
        const W = rect.width;
        const H = rect.height;
        if (W <= 0 || H <= 0) return null;

        // viewBox는 정사각형(boardSizePx×boardSizePx). 기본 preserveAspectRatio(xMidYMid meet)이면
        // 비정사각 컨테이너(16:9 PC 셸, 네이티브 모바일 세로 영역 등)에서 실제 판은 가운데에 균일 스케일로 그려지고
        // 좌우 또는 상하에 레터박스가 생긴다. rect 전체를 0~boardSizePx에 선형 매핑하면 격자·hover 미리보기 돌이 어긋난다.
        const vb = boardSizePx;
        const s = Math.min(W / vb, H / vb);
        const ox = rect.left + (W - vb * s) / 2;
        const oy = rect.top + (H - vb * s) / 2;
        let rootX = (clientX - ox) / s;
        let rootY = (clientY - oy) / s;

        // 회전은 내부 <g rotate(180)> — viewBox 좌표계에서 중심 대칭과 동일
        if (isRotated) {
            const cx = vb / 2;
            const cy = vb / 2;
            rootX = 2 * cx - rootX;
            rootY = 2 * cy - rootY;
        }

        return { x: rootX, y: rootY };
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
                onBoardRuleFlash?.('둘 수 없는 자리입니다.');
                return;
            }
            
            if (stoneAtPos !== Player.None && !isOpponentHiddenStoneAtPos(boardPos)) {
                onBoardRuleFlash?.('둘 수 없는 자리입니다.');
                return;
            }

            // 주사위 바둑·도둑과 경찰: 하이라이트된 유효 착점 외 클릭 무시 (잘못된 수 전송·오류 멈춤 방지)
            if (
                (mode === GameMode.Dice && gameStatus === 'dice_placing') ||
                (mode === GameMode.Thief && gameStatus === 'thief_placing')
            ) {
                if (!isBoardDisabled) {
                    const allowed = highlightedPoints ?? [];
                    if (!allowed.some((p) => p.x === boardPos.x && p.y === boardPos.y)) return;
                }
            }

            if (
                onboardingForcedFirstMovePoint &&
                isSinglePlayer &&
                (boardPos.x !== onboardingForcedFirstMovePoint.x || boardPos.y !== onboardingForcedFirstMovePoint.y)
            ) {
                onBoardRuleFlash?.('튜토리얼: 표시된 자리에 두세요.');
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

    const findMoveIndexAt = (
        game: Pick<LiveGameSession, 'moveHistory'>,
        x: number,
        y: number,
        /** 보드에 놓인 돌 색과 일치하는 수만 본다(같은 좌표의 과거 수순 오인 방지) */
        player?: Player
    ): number => {
        const moveHistory = game.moveHistory || [];
        if (!Array.isArray(moveHistory)) {
            return -1;
        }
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const m = moveHistory[i];
            if (m.x === x && m.y === y && (player === undefined || m.player === player)) {
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
                    <linearGradient id="capture-score-gradient-mid" x1="12%" y1="0%" x2="88%" y2="100%">
                        <stop offset="0%" stopColor="#f0fdf4" />
                        <stop offset="20%" stopColor="#86efac" />
                        <stop offset="45%" stopColor="#22c55e" />
                        <stop offset="72%" stopColor="#16a34a" />
                        <stop offset="100%" stopColor="#14532d" />
                    </linearGradient>
                    <linearGradient id="capture-score-gradient-low" x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stopColor="#f0fdfa" />
                        <stop offset="28%" stopColor="#99f6e4" />
                        <stop offset="52%" stopColor="#2dd4bf" />
                        <stop offset="82%" stopColor="#0d9488" />
                        <stop offset="100%" stopColor="#115e59" />
                    </linearGradient>
                    <linearGradient id="capture-score-gradient-critical" x1="12%" y1="0%" x2="88%" y2="100%">
                        <stop offset="0%" stopColor="#fef9c3" />
                        <stop offset="22%" stopColor="#fde047" />
                        <stop offset="48%" stopColor="#facc15" />
                        <stop offset="72%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#a16207" />
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
                    <filter id="capture-score-premium-mid" x="-130%" y="-130%" width="360%" height="360%" colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="6.3" result="blurWide" />
                        <feFlood floodColor="#10b981" floodOpacity="0.5" result="colWide" />
                        <feComposite in="colWide" in2="blurWide" operator="in" result="glowWide" />
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="blurCore" />
                        <feFlood floodColor="#6ee7b7" floodOpacity="0.88" result="colCore" />
                        <feComposite in="colCore" in2="blurCore" operator="in" result="glowCore" />
                        <feMerge>
                            <feMergeNode in="glowWide" />
                            <feMergeNode in="glowCore" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="capture-score-premium-low" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="3.8" result="blurWide" />
                        <feFlood floodColor="#14b8a6" floodOpacity="0.28" result="colWide" />
                        <feComposite in="colWide" in2="blurWide" operator="in" result="glowWide" />
                        <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blurCore" />
                        <feFlood floodColor="#5eead4" floodOpacity="0.5" result="colCore" />
                        <feComposite in="colCore" in2="blurCore" operator="in" result="glowCore" />
                        <feMerge>
                            <feMergeNode in="glowWide" />
                            <feMergeNode in="glowCore" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="capture-score-premium-critical" x="-130%" y="-130%" width="360%" height="360%" colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="6.2" result="blurWide" />
                        <feFlood floodColor="#f59e0b" floodOpacity="0.55" result="colWide" />
                        <feComposite in="colWide" in2="blurWide" operator="in" result="glowWide" />
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="blurCore" />
                        <feFlood floodColor="#fde047" floodOpacity="0.85" result="colCore" />
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
                    const isScanSuccessOverlayCell =
                        animation?.type === 'scan' &&
                        animation.success &&
                        !isSpectator &&
                        animation.playerId === currentUser.id &&
                        gameStatus === 'scanning_animating' &&
                        animation.point.x === x &&
                        animation.point.y === y;
                    if (isScanSuccessOverlayCell) return null;
                    const { cx, cy } = toSvgCoords({ x, y });
                    
                    // 미사일 선택 가능 여부는 최신 boardState를 기준으로 확인 (새로 놓은 돌도 포함)
                    // displayBoardState와 동일 소스만 사용 (서버 boardState 참조가 순간적으로 어긋나면 히든 문양이 잘못 붙는 현상 방지)
                    const actualPlayer = player;
                    
                    const isSingleLastMove = showLastMoveMarker && isLastMoveMarkerEnabled && lastMove && lastMove.x === x && lastMove.y === y;
                    const isMultiLastMove = showLastMoveMarker && isLastMoveMarkerEnabled && lastTurnStones && lastTurnStones.some(p => p.x === x && p.y === y);
                    const isLast = !!(isSingleLastMove || isMultiLastMove);
                    const isMyJustPlacedStone = !!lastMove && lastMove.x === x && lastMove.y === y && actualPlayer === myPlayerEnum;
                    
                    const moveIndex = moveHistory ? findMoveIndexAt({ moveHistory } as LiveGameSession, x, y, actualPlayer) : -1;
                    const histMove = moveIndex >= 0 && moveHistory ? moveHistory[moveIndex] : undefined;
                    const isHiddenMove =
                        hiddenMoves &&
                        moveIndex !== -1 &&
                        !!hiddenMoves[moveIndex] &&
                        !!histMove &&
                        histMove.player === actualPlayer;
                    const isInRevealAnimation =
                        isHiddenRevealStatus &&
                        animation?.type === 'hidden_reveal' &&
                        animation.stones?.some((s: { point: Point }) => s.point.x === x && s.point.y === y);
                    const isPermanentlyRevealed = permanentlyRevealedStones?.some(p => p.x === x && p.y === y) || !!isInRevealAnimation;
                    const atAiInitialHiddenStone =
                        !!aiInitialHiddenStone &&
                        aiInitialHiddenStone.x === x &&
                        aiInitialHiddenStone.y === y &&
                        !isPermanentlyRevealed;
                    const softScanAtCurrentMove =
                        (moveIndex >= 0 &&
                            myRevealedMoveIndices != null &&
                            myRevealedMoveIndices.includes(moveIndex)) ||
                        (myRevealedMoveIndices === undefined &&
                            (myRevealedStones?.some((p) => p.x === x && p.y === y) ?? false)) ||
                        (moveIndex === -1 &&
                            atAiInitialHiddenStone &&
                            (myRevealedStones?.some((p) => p.x === x && p.y === y) ?? false));
                    // 유저 차례에는 AI 히든 아이템 연출용 오버레이만 남아 내가 둔 돌에 잠시 문양이 붙는 현상 방지
                    const isHiddenMoveForRender =
                        !!isHiddenMove ||
                        (!!atAiInitialHiddenStone &&
                            moveIndex === -1 &&
                            actualPlayer !== myPlayerEnum &&
                            currentPlayer !== myPlayerEnum);
                    // 방금 둔 돌 보호 로직은 "실제 히든 착수"에는 적용하지 않는다.
                    // 그래야 히든 아이템 착수 순간부터 즉시 히든 문양으로 보인다.
                    const effectiveHiddenMoveForRender =
                        isMyJustPlacedStone && !isHiddenMove ? false : isHiddenMoveForRender;
                    // 서버의 영구 공개 목록 또는 현재 히든 공개 애니메이션에 포함된 돌은 공개된 것으로 표시 (반투명 해제)
                    // 히든 돌 표시 규칙 (모든 히든 사용 경기 공통): 상대에게는 기본 비공개, 스캔 시 반투명, 착수/포착 시 전체 공개
                    let isVisible = true;
                    if (effectiveHiddenMoveForRender) {
                        if (isSpectator) {
                            isVisible = isGameFinished || !!isPermanentlyRevealed;
                        } else {
                            const isNewlyRevealed = effectiveNewlyRevealed?.some(nr => nr.point.x === x && nr.point.y === y);
                            isVisible =
                                isGameFinished ||
                                !!isPermanentlyRevealed ||
                                actualPlayer === myPlayerEnum ||
                                !!softScanAtCurrentMove ||
                                !!isNewlyRevealed;
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
                    
                    const isNewlyRevealedForAnim = effectiveNewlyRevealed?.some(nr => nr.point.x === x && nr.point.y === y);
                    // 반투명: 내가 둔 히든 돌(비공개 상태) 또는 스캔으로만 안 돌만. 영구 공개/방금 공개된 돌은 선명하게
                    const isFaint = !isSpectator && (
                        (softScanAtCurrentMove && !isPermanentlyRevealed) ||
                        (effectiveHiddenMoveForRender && actualPlayer === myPlayerEnum && !isPermanentlyRevealed && !isNewlyRevealedForAnim)
                    );

                    const hasBaseStoneHere = baseStones?.some((bs) => bs.x === x && bs.y === y) ?? false;
                    // 히든 돌은 공개되어도 히든 문양을 유지. 상대 미공개 히든은 위에서 return null.
                    // (이전: 마지막 수만 문양 제외 → 본인 히든 착수 직후·스캔 직후에도 문양이 안 보이는 버그)
                    const isKnownHidden = !!effectiveHiddenMoveForRender;
                    const isSelectedMissileForRender = selectedMissileStone?.x === x && selectedMissileStone?.y === y;
                    // 미사일 선택 가능 여부: 최신 boardState를 기준으로 확인 (새로 놓은 돌도 포함)
                    const isHoverSelectableMissile = gameStatus === 'missile_selecting' && !selectedMissileStone && actualPlayer === myPlayerEnum;
                    
                    // 문양 결정: 히든 돌이 아닌 경우에만 패턴 문양 표시
                    // 히든 돌(공개 여부와 관계없이)은 히든 문양을 우선 표시하므로 패턴 문양을 표시하지 않음
                    let isPatternStone = false;
                    if (!effectiveHiddenMoveForRender) {
                        const patternConsumedHere = consumedPatternIntersections?.some((p) => p.x === x && p.y === y);
                        if (!patternConsumedHere) {
                            isPatternStone =
                                ((actualPlayer === Player.Black && blackPatternStones?.some((p) => p.x === x && p.y === y)) ||
                                    (actualPlayer === Player.White && whitePatternStones?.some((p) => p.x === x && p.y === y))) ??
                                false;
                        }
                    }

                    const stonePlayerForRender = actualPlayer;

                    return <Stone key={`${x}-${y}`} player={stonePlayerForRender} cx={cx} cy={cy} isLastMove={isLast} isKnownHidden={isKnownHidden as boolean} isBaseStone={hasBaseStoneHere} isPatternStone={isPatternStone} isNewlyRevealed={isNewlyRevealedForAnim} animationClass={isNewlyRevealedForAnim ? 'sparkle-animation' : ''} isSelectedMissile={isSelectedMissileForRender} isHoverSelectableMissile={isHoverSelectableMissile} radius={stone_radius} isFaint={isFaint} keepUpright={!!isRotated} />;
                }))}
                {myBaseStonesForPlacement?.map((stone, i) => {
                    const { cx, cy } = toSvgCoords(stone);
                    return (
                        <g key={`my-base-${i}`} opacity={0.7} className="animate-fade-in">
                            <Stone player={myPlayerEnum} cx={cx} cy={cy} isBaseStone radius={stone_radius} />
                        </g>
                    );
                })}
                {(gameStatus === 'komi_bidding' || gameStatus === 'komi_bid_reveal') && (
                    <>
                        {baseStones_p1?.map((stone, i) => {
                            const { cx, cy } = toSvgCoords(stone);
                            return (
                                <Stone
                                    key={`komi-base-p1-${i}`}
                                    player={Player.Black}
                                    cx={cx}
                                    cy={cy}
                                    isBaseStone
                                    radius={stone_radius}
                                />
                            );
                        })}
                        {baseStones_p2?.map((stone, i) => {
                            const { cx, cy } = toSvgCoords(stone);
                            return (
                                <Stone
                                    key={`komi-base-p2-${i}`}
                                    player={Player.White}
                                    cx={cx}
                                    cy={cy}
                                    isBaseStone
                                    radius={stone_radius}
                                />
                            );
                        })}
                    </>
                )}
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

                {onboardingDemoAnchorPoint && (() => {
                    const { cx, cy } = toSvgCoords(onboardingDemoAnchorPoint);
                    return (
                        <circle
                            data-onboarding-target="onboarding-sp-ingame-demo-point"
                            cx={cx}
                            cy={cy}
                            r={Math.max(4, stone_radius * 0.45)}
                            fill="transparent"
                            style={{ pointerEvents: 'none' }}
                        />
                    );
                })()}

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
                                    myRevealedStones,
                                    myRevealedMoveIndices
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
                            {animation.type === 'scan' && !isSpectator && animation.playerId === currentUser.id && (
                                <AnimatedScanMarker
                                    animation={animation}
                                    toSvgCoords={toSvgCoords}
                                    stone_radius={stone_radius}
                                    boardSizePx={boardSizePx}
                                    padding={padding}
                                    cellSize={cell_size}
                                    revealPlayer={displayBoardState[animation.point.y]?.[animation.point.x] ?? Player.None}
                                />
                            )}
                            {isHiddenRevealStatus &&
                                animation.type === 'hidden_reveal' &&
                                animation.stones.map((s, i) => {
                                    const isAtLastPlacedPoint =
                                        !!lastMove &&
                                        lastMove.x === s.point.x &&
                                        lastMove.y === s.point.y;
                                    const isMyJustPlacedRevealPoint =
                                        isAtLastPlacedPoint && s.player === myPlayerEnum;
                                    return (
                                        <Stone
                                            key={`reveal-${i}`}
                                            player={s.player}
                                            cx={toSvgCoords(s.point).cx}
                                            cy={toSvgCoords(s.point).cy}
                                            isKnownHidden={!isMyJustPlacedRevealPoint}
                                            isNewlyRevealed
                                            animationClass="sparkle-animation"
                                            radius={stone_radius}
                                            keepUpright={!!isRotated}
                                        />
                                    );
                                })}
                            {animation.type === 'bonus_text' && <AnimatedBonusText animation={animation} toSvgCoords={toSvgCoords} cellSize={cell_size} isRotated={isRotated} />}
                        </>
                    );
                })()}
                {!hideCaptureScoreFloatOverlay &&
                    captureScoreFloats.map((f) => {
                        const { cx, cy } = toSvgCoords(f.point);
                        const vis = getCaptureScoreFloatVisual(cell_size, f.points);
                        return (
                            <g key={f.id} transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
                                <g transform={isRotated ? 'rotate(180)' : undefined}>
                                    <g className={vis.innerClassName}>
                                        <text
                                            x={0}
                                            y={0}
                                            textAnchor="middle"
                                            dy=".35em"
                                            fontSize={vis.fontSize}
                                            className="capture-score-float-text"
                                            fill={vis.fillUrl}
                                            stroke={vis.stroke}
                                            strokeWidth={vis.strokeWidth}
                                            paintOrder="stroke fill"
                                            filter={vis.filterUrl}
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