import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { BoardState, Point, Player, GameStatus, Move, AnalysisResult, LiveGameSession, User, AnimationData, GameMode, RecommendedMove, ServerAction } from '../types.js';
import { WHITE_BASE_STONE_IMG, BLACK_BASE_STONE_IMG, WHITE_HIDDEN_STONE_IMG, BLACK_HIDDEN_STONE_IMG } from '../assets.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';
import { modeIncludesBaseCaptureMix, modeIncludesMissileRule } from '../shared/utils/liveSessionArenaKind.js';
import {
    BOARD_CAPTURE_FLOAT_DEBOUNCE_MS,
    BOARD_CAPTURE_FLOAT_HIDDEN_EXTRA_LAG_MS,
    BOARD_CAPTURE_SCORE_FLOAT_MS,
} from '../shared/constants/boardSettleTiming.js';
import {
    findLatestMoveIndexAtExcludingRecordedBaseStones,
    type BaseStoneOverlayContext,
} from '../shared/utils/baseHiddenMoveIndex.js';
import { mapStoneToUniformDisplay, resolveTerritoryMarkerDisplayPlayer, resolveUniformStoneDisplayColorForBoard, territoryMarkerRgba } from '../shared/utils/uniformGoRules.js';
import { detectAndConfirmTerritories } from '../shared/utils/castleGoRules.js';
import type { ChessPieceState, ChessPieceType, ChessLastMoveMarker } from '../shared/types/entities.js';
import { CHESS_GO_BOARD_SIZE, normalizeChessGoSession } from '../shared/utils/chessGoRules.js';
import { buildBoardCellStoneLookup } from '../utils/boardCellLookup.js';

/** 따내기/보너스 점수 플로트: mid(5~9) 기준 폰트 배율 */
const CAPTURE_SCORE_FLOAT_BASE_EM = 0.92;
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

/** 도둑/주사위: 라운드·역할 전환 직후 서버가 보내는 의도적 빈 판(전부 빈칸). 이 경우 보존 ref의 전판을 쓰면 안 됨 */
function isPlayfulEmptyBoardSnapshot(boardState: BoardState | undefined, boardSize: number): boolean {
    if (!boardState || !Array.isArray(boardState) || boardState.length !== boardSize) return false;
    for (let y = 0; y < boardSize; y++) {
        const row = boardState[y];
        if (!Array.isArray(row) || row.length !== boardSize) return false;
        for (let x = 0; x < boardSize; x++) {
            const c = row[x];
            if (c !== Player.None && c != null) return false;
        }
    }
    return true;
}

function getCaptureScoreFloatVisual(cellSize: number, points: number) {
    const tier = captureScoreFloatTierFromPoints(points);
    const baseFs = cellSize * CAPTURE_SCORE_FLOAT_BASE_EM;
    const baseSw = Math.max(1.2, cellSize * 0.075);
    let fontSize: number;
    let strokeWidth: number;
    if (tier === 'low') {
        fontSize = baseFs * 0.78;
        strokeWidth = Math.max(1.05, cellSize * 0.065);
    } else if (tier === 'high') {
        fontSize = baseFs * 0.96;
        strokeWidth = Math.max(1.3, cellSize * 0.082);
    } else {
        fontSize = baseFs;
        strokeWidth = baseSw;
    }
    const stroke = tier === 'high' ? '#422006' : '#022c22';
    const fill =
        tier === 'low'
            ? '#5eead4'
            : tier === 'high'
              ? '#fde047'
              : '#6ee7b7';
    const innerClassName =
        tier === 'low'
            ? 'capture-points-float-inner capture-points-float-inner--low'
            : tier === 'high'
              ? 'capture-points-float-inner capture-points-float-inner--critical'
              : 'capture-points-float-inner capture-points-float-inner--mid';
    return { tier, fontSize, strokeWidth, stroke, fill, innerClassName };
}

/** 캐슬 바둑 중립 캐슬 마커 — 흑백 태극형 바둑돌 토큰 + 성(城) 실루엣 */
const CastleStoneMarker: React.FC<{ cx: number; cy: number; radius: number }> = ({ cx, cy, radius }) => {
    const r = radius;
    const ringStroke = Math.max(1.1, r * 0.055);
    const icon = r * 0.98;
    const bx = -icon / 2;
    const by = -icon * 0.54;
    const iw = icon;
    const ih = icon * 1.08;
    const detailStroke = '#2d2418';
    const detailSw = Math.max(0.7, icon * 0.04);
    const battlement = (leftRatio: number, topRatio: number, key: string) => (
        <g key={key}>
            <rect x={bx + iw * leftRatio} y={by + ih * topRatio} width={iw * 0.1} height={ih * 0.1} fill="url(#castle_tower_light)" stroke={detailStroke} strokeWidth={detailSw * 0.8} rx={icon * 0.015} />
            <rect x={bx + iw * (leftRatio + 0.12)} y={by + ih * topRatio} width={iw * 0.1} height={ih * 0.1} fill="url(#castle_tower_light)" stroke={detailStroke} strokeWidth={detailSw * 0.8} rx={icon * 0.015} />
        </g>
    );
    return (
        <g pointerEvents="none" transform={`translate(${cx}, ${cy})`} filter="url(#castle_marker_shadow)">
            <circle cx={0} cy={0} r={r * 1.28} fill="url(#castle_marker_aura)" opacity={0.55} />
            <circle cx={0} cy={0} r={r * 1.08} fill="none" stroke="#f6d46f" strokeWidth={ringStroke * 0.9} opacity={0.68} />
            <circle cx={0} cy={0} r={r} fill="url(#castle_white_half)" stroke="#b89245" strokeWidth={ringStroke} />
            <path
                d={`M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${r * 0.5} ${r * 0.5} 0 0 0 0 0 A ${r * 0.5} ${r * 0.5} 0 0 1 0 ${-r} Z`}
                fill="url(#castle_black_half)"
            />
            <circle cx={0} cy={-r * 0.5} r={r * 0.5} fill="url(#castle_white_half)" opacity={0.96} />
            <circle cx={0} cy={r * 0.5} r={r * 0.5} fill="url(#castle_black_half)" opacity={0.96} />
            <circle cx={0} cy={0} r={r} fill="url(#castle_stone_highlight)" opacity={0.32} />
            <circle cx={0} cy={0} r={r * 0.9} fill="none" stroke="#f5cc63" strokeWidth={ringStroke * 0.9} opacity={0.96} />
            <g transform={`translate(0, ${r * 0.02})`}>
                <rect x={bx + iw * 0.14} y={by + ih * 0.48} width={iw * 0.72} height={ih * 0.4} fill="url(#castle_wall)" stroke={detailStroke} strokeWidth={detailSw} rx={icon * 0.04} />
                <rect x={bx + iw * 0.1} y={by + ih * 0.24} width={iw * 0.24} height={ih * 0.34} fill="url(#castle_tower)" stroke={detailStroke} strokeWidth={detailSw * 0.9} rx={icon * 0.035} />
                <rect x={bx + iw * 0.66} y={by + ih * 0.24} width={iw * 0.24} height={ih * 0.34} fill="url(#castle_tower)" stroke={detailStroke} strokeWidth={detailSw * 0.9} rx={icon * 0.035} />
                <rect x={bx + iw * 0.34} y={by + ih * 0.14} width={iw * 0.32} height={ih * 0.52} fill="url(#castle_keep)" stroke={detailStroke} strokeWidth={detailSw} rx={icon * 0.04} />
                {battlement(0.1, 0.08, 'bl')}
                {battlement(0.34, 0.0, 'bc')}
                {battlement(0.66, 0.08, 'br')}
                <rect x={bx + iw * 0.43} y={by + ih * 0.58} width={iw * 0.14} height={ih * 0.18} fill="#4a3f35" stroke={detailStroke} strokeWidth={detailSw * 0.65} rx={icon * 0.025} />
            </g>
        </g>
    );
};

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
                        fill={vis.fill}
                        stroke={vis.stroke}
                        strokeWidth={vis.strokeWidth}
                        paintOrder="stroke fill"
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

const CHESS_PIECE_GLYPHS: Record<ChessPieceType, string> = {
    pawn: '♟',
    rook: '♜',
    knight: '♞',
    bishop: '♝',
    queen: '♛',
};

const Stone: React.FC<{ player: Player, cx: number, cy: number, isLastMove?: boolean, isSelectedMissile?: boolean, isHoverSelectableMissile?: boolean, isKnownHidden?: boolean, isNewlyRevealed?: boolean, animationClass?: string, isBaseStone?: boolean, isPatternStone?: boolean, chessPieceType?: ChessPieceType, chessRemainingMoves?: number, chessPieceSelected?: boolean, isChessLastMoveTo?: boolean, radius: number, isFaint?: boolean, keepUpright?: boolean, isPlacementPreview?: boolean, uniformDisplayColor?: Player | null }> = ({ player, cx, cy, isLastMove, isSelectedMissile, isHoverSelectableMissile, isKnownHidden, isNewlyRevealed, animationClass, isBaseStone, isPatternStone, chessPieceType, chessRemainingMoves, chessPieceSelected, isChessLastMoveTo, radius, isFaint, keepUpright, isPlacementPreview, uniformDisplayColor }) => {
    const visualPlayer = mapStoneToUniformDisplay(player, uniformDisplayColor);
    const specialImageSize = radius * 2 * 0.7;
    const specialImageOffset = specialImageSize / 2;

    const strokeColor = isSelectedMissile
        ? 'rgb(239, 68, 68)'
        : chessPieceSelected
          ? 'rgb(250, 204, 21)'
        : isPlacementPreview
          ? 'rgb(34, 197, 94)'
          : 'none';
    
    const strokeWidth = isSelectedMissile || isPlacementPreview || chessPieceSelected ? 3.5 : 0;

    return (
        <g
            className={`${animationClass || ''} ${isHoverSelectableMissile ? 'missile-selectable-stone' : ''}`}
            opacity={isFaint ? 0.52 : isPlacementPreview ? 0.5 : 1}
            transform={keepUpright ? `rotate(180 ${cx} ${cy})` : undefined}
        >
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={visualPlayer === Player.Black ? "#111827" : "#f5f2e8"}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
            />
            {visualPlayer === Player.White && <circle cx={cx} cy={cy} r={radius} fill="url(#clam_grain)" />}
            <circle cx={cx} cy={cy} r={radius} fill={visualPlayer === Player.Black ? 'url(#slate_highlight)' : 'url(#clamshell_highlight)'} />
            {isBaseStone && (
                <image href={visualPlayer === Player.Black ? BLACK_BASE_STONE_IMG : WHITE_BASE_STONE_IMG} x={cx - specialImageOffset} y={cy - specialImageOffset} width={specialImageSize} height={specialImageSize} />
            )}
            {isKnownHidden && (
                <image href={visualPlayer === Player.Black ? BLACK_HIDDEN_STONE_IMG : WHITE_HIDDEN_STONE_IMG} x={cx - specialImageOffset} y={cy - specialImageOffset} width={specialImageSize} height={specialImageSize} />
            )}
            {isPatternStone && (
                <image href={visualPlayer === Player.Black ? '/images/single/BlackDouble.webp' : '/images/single/WhiteDouble.webp'} x={cx - specialImageOffset} y={cy - specialImageOffset} width={specialImageSize} height={specialImageSize} />
            )}
            {chessPieceType && (
                <>
                    <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={radius * 1.15}
                        fill={visualPlayer === Player.Black ? '#f8fafc' : '#1e293b'}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                        {CHESS_PIECE_GLYPHS[chessPieceType]}
                    </text>
                    {typeof chessRemainingMoves === 'number' && (
                        <g style={{ pointerEvents: 'none' }}>
                            <circle cx={cx + radius * 0.55} cy={cy + radius * 0.55} r={radius * 0.32} fill="rgba(15, 23, 42, 0.85)" stroke="rgba(248, 250, 252, 0.9)" strokeWidth={1} />
                            <text
                                x={cx + radius * 0.55}
                                y={cy + radius * 0.55}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={radius * 0.38}
                                fill="#f8fafc"
                                fontWeight="700"
                            >
                                {chessRemainingMoves}
                            </text>
                        </g>
                    )}
                </>
            )}
            {isChessLastMoveTo && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke="rgb(239, 68, 68)"
                    strokeWidth={3.5}
                    style={{ pointerEvents: 'none' }}
                />
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

const MemoStone = memo(Stone);

function classifyMissileFromStone(
    from: Point,
    moveHistory: Move[] | undefined,
    hiddenMoves: { [moveIndex: number]: boolean } | undefined,
    permanentlyRevealedStones: Point[] | undefined,
    myRevealedStones: Point[] | undefined,
    myRevealedMoveIndices: readonly number[] | undefined,
    stonePlayer?: Player,
    /** LAUNCH 직후 from 칸이 비어 있어도, 본인이 쏜 내 히든돌 비행은 항상 보이게 한다 */
    viewerPlayer?: Player,
    baseHiddenCtx?: BaseStoneOverlayContext | null,
): 'normal' | 'unrevealed_hidden' | 'scan_only_hidden' | 'revealed_hidden' {
    if (!moveHistory?.length || !hiddenMoves) return 'normal';
    const moveIndex = findLatestMoveIndexAtExcludingRecordedBaseStones(
        moveHistory,
        from.x,
        from.y,
        stonePlayer,
        baseHiddenCtx,
    );
    if (
        viewerPlayer !== undefined &&
        stonePlayer !== undefined &&
        stonePlayer === viewerPlayer &&
        moveIndex !== -1 &&
        hiddenMoves[moveIndex]
    ) {
        return 'revealed_hidden';
    }
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
  /** PVE 탑/싱글에서 유저 히든 좌표를 인덱스와 별도로 고정 */
  humanHiddenStonePoints?: Array<Point & { player?: Player }>;
  baseStones?: { x: number, y: number, player: Player }[];
  baseStones_p1?: Point[];
  baseStones_p2?: Point[];
  castleStonePoints?: Point[];
  confirmedTerritoryOwnerByPoint?: Record<string, Player.Black | Player.White>;
  chessPieces?: ChessPieceState[];
  /** 체스 바둑: moveHistory 재생 시 제외할 따낸 바둑돌 좌표 — 없으면 normalize가 포획을 되살림 */
  chessGoRemovedPoints?: Point[];
  chessPieceMovedThisTurn?: boolean;
  selectedChessPieceId?: string | null;
  /** 체스 바둑: 상대 직전 기물 이동(from·to) 표시 */
  chessLastMove?: ChessLastMoveMarker | null;
  myPlayerEnum: Player;
  gameStatus: GameStatus;
  currentPlayer: Player;
  highlightedPoints?: Point[];
  highlightStyle?: 'circle' | 'ring' | 'green-dot';
  myRevealedStones?: Point[];
  /** 내가 스캔으로 몰래 본 히든 수순 인덱스. 있으면 좌표만으로는 판단하지 않아(같은 자리 재착수 시 반투명 버그 방지) */
  myRevealedMoveIndices?: readonly number[];
  allRevealedStones?: { [playerId: string]: Point[] };
  newlyRevealed?: { point: Point, player: Player }[];
  justCaptured?: {
    point: Point;
    player: Player;
    wasHidden: boolean;
    capturePoints?: number;
    wasBaseStone?: boolean;
    capturerId?: string;
  }[];
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
  /** AI 히든 연출 등: prism과 별도로 황금 테두리 글로우(레이아웃에 영향 없는 오버레이) */
  showBoardGlow?: boolean;
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
  /** 스피드 시간 압박으로 captures에 반영된 점수(따낸 돌 플로트에서 제외) */
  speedTimePressureGranted?: { black?: number; white?: number };
  /** 모험 지역 이해도 시작 가산(캡처 점수) — 첫 수에서 이 값만 오른 따낸 점수 플로트는 표시하지 않음 */
  adventureRegionalHeadStartCaptureBonus?: number;
  /** 패·둘 수 없는 자리 등 — TurnDisplay 전광판 */
  onBoardRuleFlash?: (message: string) => void;
  /** 전략바둑 대표펫 힌트: 좌표 점만(말풍선은 푸터) */
  strategicPetHintOverlay?: { x: number; y: number } | null;
  /** 펫 힌트 보너스 획득: 해당 좌표에서 아이콘이 위로 떠오르는 1회성 연출 */
  strategicPetHintRewardAnimation?: { id: string; x: number; y: number; iconSrc: string; quantityLabel: string } | null;
  /** 페어 방장: 양측 베이스돌을 모두 직접 배치할 때 오버레이·중복클릭 방지에 p1+p2를 함께 사용 */
  isPairBasePlacementHost?: boolean;
  baseStonesP1Player?: Player;
  baseStonesP2Player?: Player;
  /** `base_placement`에서 아직 놓을 베이스돌이 있을 때만 교차점 호버 미리보기. 미전달이면 기존과 동일 */
  canPlaceMoreBaseStones?: boolean;
  /** 아이템 안내 등 바둑판 중앙 오버레이 문구 */
  boardRuleFlashMessage?: string | null;
  /** 일색 바둑: 모든 돌을 이 색으로 표시(실제 흑/백 규칙과 별개) */
  uniformStoneDisplayColor?: Player | null;
  /** @deprecated 낙관적 보드 반영으로 대체됨 — 하위 호환용, 렌더에 사용하지 않음 */
  isMoveSubmitting?: boolean;
}

const GoBoard: React.FC<GoBoardProps> = (props) => {
    const { 
        boardState: boardStateProp, boardSize: boardSizeProp, onBoardClick, onMissileLaunch, lastMove, lastTurnStones, isBoardDisabled, 
        stoneColor, winningLine, hiddenMoves, humanHiddenStonePoints, moveHistory, baseStones, baseStones_p1, baseStones_p2,
        castleStonePoints, confirmedTerritoryOwnerByPoint,
        chessPieces: chessPiecesProp = [],
        chessGoRemovedPoints: chessGoRemovedPointsProp,
        chessPieceMovedThisTurn: chessPieceMovedThisTurnProp,
        selectedChessPieceId = null,
        chessLastMove = null,
        baseStonesP1Player = Player.Black,
        baseStonesP2Player = Player.White,
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
        currentPlayer, isItemModeActive, showBoardGlow = false, animation, mode, mixedModes, justCaptured, permanentlyRevealedStones, onAction, gameId,
        showLastMoveMarker, blackPatternStones, whitePatternStones, consumedPatternIntersections,
        aiInitialHiddenStone = undefined,
        isSinglePlayer = false, isRotated = false, pendingMove = null,
        captureScoreFloatMinPoints = 2,
        captures,
        speedTimePressureGranted,
        adventureRegionalHeadStartCaptureBonus = 0,
        onBoardRuleFlash,
        strategicPetHintOverlay = null,
        strategicPetHintRewardAnimation = null,
        isPairBasePlacementHost = false,
        canPlaceMoreBaseStones,
        boardRuleFlashMessage = null,
        uniformStoneDisplayColor = null,
    } = props;

    /** 체스 바둑: 레거시 측면 폰·y=0/12 배치가 props로 들어와도 렌더 직전 표준 28기물로 교정 */
    const chessNormalizedSlice = useMemo(() => {
        if (mode !== GameMode.Chess) return null;
        return normalizeChessGoSession({
            mode: GameMode.Chess,
            settings: { boardSize: boardSizeProp } as LiveGameSession['settings'],
            moveHistory: moveHistory ?? [],
            boardState: boardStateProp,
            chessPieces: chessPiecesProp,
            chessGoRemovedPoints: chessGoRemovedPointsProp,
            chessCaptureScore: undefined,
            chessPieceMovedThisTurn: chessPieceMovedThisTurnProp,
        });
    }, [
        mode,
        boardSizeProp,
        moveHistory,
        boardStateProp,
        chessPiecesProp,
        chessGoRemovedPointsProp,
        chessPieceMovedThisTurnProp,
    ]);

    const boardState = chessNormalizedSlice?.boardState ?? boardStateProp;
    const chessPieces = chessNormalizedSlice?.chessPieces ?? chessPiecesProp;
    const boardSize = mode === GameMode.Chess ? CHESS_GO_BOARD_SIZE : boardSizeProp;

    const baseHiddenMoveCtx = useMemo<BaseStoneOverlayContext>(
        () => ({ baseStones, baseStones_p1, baseStones_p2, gameStatus }),
        [baseStones, baseStones_p1, baseStones_p2, gameStatus],
    );
    /** 미사일 완료 타이머: 부모가 자주 리렌더되어도 setTimeout이 매번 취소되지 않도록 onAction은 ref로만 읽는다. */
    const onActionRef = useRef(onAction);
    onActionRef.current = onAction;
    /** playing 중에 세션에 남은 stale newlyRevealed로 스파클·가시성이 매 수 재생되는 것 방지 */
    const isHiddenRevealStatus =
        gameStatus === 'hidden_reveal_animating' || gameStatus === 'hidden_final_reveal';
    const effectiveNewlyRevealed = isHiddenRevealStatus ? newlyRevealed : undefined;
    const isMissileSupportedMode = modeIncludesMissileRule(mode, { mixedModes });
    const isMissileSelectingActive = isMissileSupportedMode && gameStatus === 'missile_selecting';
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
    const reservedCaptureFloatSignaturesRef = useRef<Set<string>>(new Set());
    const prevCapturesForFloatRef = useRef<Partial<Record<Player, number>> | null>(null);
    const prevSpeedTimePressureGrantedForFloatRef = useRef<{ black: number; white: number } | null>(null);
    /** 미사일 연출 중 매 프레임 착지점 (애니 종료 후 null이 되어도 여기 남음) */
    const lastMissileAnimationToRef = useRef<Point | null>(null);
    /** missile_animating → playing 직후: 따내기 점수 플로트를 이동한 내 돌 위치에서 띄우기 위한 앵커 */
    const missileCaptureScoreAnchorRef = useRef<Point | null>(null);
    /** 미사일 앵커는 생성 당시 moveHistory 길이의 "같은 턴" 캡처에만 1회 사용 */
    const missileCaptureScoreAnchorMoveCountRef = useRef<number | null>(null);
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
        reservedCaptureFloatSignaturesRef.current.clear();
        prevCapturesForFloatRef.current = null;
        prevSpeedTimePressureGrantedForFloatRef.current = speedTimePressureGranted
            ? {
                  black: Math.max(0, Number(speedTimePressureGranted.black ?? 0)),
                  white: Math.max(0, Number(speedTimePressureGranted.white ?? 0)),
              }
            : null;
        lastMissileAnimationToRef.current = null;
        missileCaptureScoreAnchorRef.current = null;
        missileCaptureScoreAnchorMoveCountRef.current = null;
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
        if (isMissileSelectingActive) {
            missileCaptureScoreAnchorRef.current = null;
            missileCaptureScoreAnchorMoveCountRef.current = null;
        }
        const prev = prevGameStatusForMissileFloatRef.current;
        if (prev === 'missile_animating' && gameStatus === 'playing') {
            missileCaptureScoreAnchorRef.current = lastMissileAnimationToRef.current;
            missileCaptureScoreAnchorMoveCountRef.current = moveHistory?.length ?? null;
        }
        prevGameStatusForMissileFloatRef.current = gameStatus;
    }, [gameStatus, animation, moveHistory]);

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
            const DEBOUNCE_MS = BOARD_CAPTURE_FLOAT_DEBOUNCE_MS;
        const t = window.setTimeout(() => {
            const st = String(gameStatus);
            if (st === 'hidden_reveal_animating' || st === 'hidden_final_reveal') {
                return;
            }
            const list = justCaptured ?? [];
            const CAPTURE_FLOAT_MS = BOARD_CAPTURE_SCORE_FLOAT_MS;
            const minPts = captureScoreFloatMinPoints;
            /** 미공개 히든 포획(+5): 공개 연출 직후 점수 플로트를 분리 */
            const hiddenRevealScoreFloatLagMs = list.some((e) => e.wasHidden)
                ? BOARD_CAPTURE_FLOAT_HIDDEN_EXTRA_LAG_MS
                : 0;

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
                entries.reduce((sum, e) => {
                    if (typeof e.capturePoints === 'number' && Number.isFinite(e.capturePoints)) {
                        return sum + e.capturePoints;
                    }
                    const capturedP = e.player;
                    const patternList =
                        capturedP === Player.Black ? blackPatternStones : whitePatternStones;
                    if (patternList?.some((p) => p.x === e.point.x && p.y === e.point.y)) {
                        return sum + 2;
                    }
                    return sum + (e.wasHidden || e.wasBaseStone ? 5 : 1);
                }, 0);

            const pushFloat = (totalPts: number, anchor: Point, extraDelayMs = 0) => {
                if (totalPts < minPts) return;
                const lag = extraDelayMs + hiddenRevealScoreFloatLagMs;
                const tailMove = moveHistory?.length ? moveHistory[moveHistory.length - 1] : null;
                const movePart = tailMove
                    ? `${moveHistory!.length}-${tailMove.player}-${tailMove.x}-${tailMove.y}`
                    : `nomove-${gameStatus}`;
                const sig = `${movePart}-${anchor.x}-${anchor.y}-${totalPts}`;
                const nowTs = Date.now();
                if (
                    reservedCaptureFloatSignaturesRef.current.has(sig) ||
                    (sig === lastCaptureFloatSignatureRef.current &&
                        nowTs - lastCaptureFloatSignatureAtRef.current < 3000)
                ) {
                    return;
                }
                reservedCaptureFloatSignaturesRef.current.add(sig);
                lastCaptureFloatSignatureRef.current = sig;
                lastCaptureFloatSignatureAtRef.current = nowTs;
                const releaseSigT = window.setTimeout(() => {
                    reservedCaptureFloatSignaturesRef.current.delete(sig);
                }, Math.max(3000, CAPTURE_FLOAT_MS + lag + 250));
                captureFloatTimeoutsRef.current.push(releaseSigT);

                const doPush = () => {
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
                const anchorMoveCount = missileCaptureScoreAnchorMoveCountRef.current;
                if (!p || p.x < 0 || p.y < 0) return null;
                // 미사일 직후 캡처(동일 moveHistory 길이)에서만 유효. 이후 일반 착수가 생기면 앵커 폐기.
                if (anchorMoveCount == null || (moveHistory?.length ?? 0) !== anchorMoveCount) {
                    missileCaptureScoreAnchorRef.current = null;
                    missileCaptureScoreAnchorMoveCountRef.current = null;
                    return null;
                }
                const cell = boardState?.[p.y]?.[p.x];
                if (cell !== capturer) return null;
                return { x: p.x, y: p.y };
            };

            const grantBlackNow = Math.max(0, Number(speedTimePressureGranted?.black ?? 0));
            const grantWhiteNow = Math.max(0, Number(speedTimePressureGranted?.white ?? 0));
            const prevGrantSnap = prevSpeedTimePressureGrantedForFloatRef.current;
            const dGrantBlack = grantBlackNow - (prevGrantSnap ? prevGrantSnap.black : 0);
            const dGrantWhite = grantWhiteNow - (prevGrantSnap ? prevGrantSnap.white : 0);
            const syncGrantedSnapshot = () => {
                prevSpeedTimePressureGrantedForFloatRef.current = {
                    black: grantBlackNow,
                    white: grantWhiteNow,
                };
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
                const stoneDBlack = dBlack - Math.max(0, dGrantBlack);
                const stoneDWhite = dWhite - Math.max(0, dGrantWhite);
                // 마지막 수를 둔 색의 증가분(일반 착점). 미사일 등 moveHistory 불변·점수만 오르는 경우는 다른 색 증가분을 사용
                let floatPlayer = last.player;
                let delta = floatPlayer === Player.Black ? stoneDBlack : stoneDWhite;
                if (delta < minPts && stoneDBlack >= minPts) {
                    floatPlayer = Player.Black;
                    delta = stoneDBlack;
                } else if (delta < minPts && stoneDWhite >= minPts) {
                    floatPlayer = Player.White;
                    delta = stoneDWhite;
                }

                const sliceEntries = newJustCapturedEntries();
                // justCaptured가 없는 상태에서 "마지막 착수자"가 아닌 쪽의 captures 증가분이 보이면
                // 이전 턴 포획 점수를 늦은 GAME_UPDATE에서 다시 본 것이다. 다음 AI 착수에 +5가 재생되는 버그 방지.
                if (sliceEntries.length === 0 && delta >= minPts && floatPlayer !== last.player) {
                    prevCapturesForFloatRef.current = { ...captures };
                    syncGrantedSnapshot();
                    processedJustCapturedCountRef.current = list.length;
                    lastFloatedMoveKeyRef.current = moveKey;
                    return;
                }
                // 스피드 시간 압박(+1)만 captures에 반영된 경우 — 따낸 돌 플로트 생략
                if (sliceEntries.length === 0 && delta <= 0 && (dGrantBlack > 0 || dGrantWhite > 0)) {
                    prevCapturesForFloatRef.current = { ...captures };
                    syncGrantedSnapshot();
                    processedJustCapturedCountRef.current = list.length;
                    return;
                }
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
                    syncGrantedSnapshot();
                    processedJustCapturedCountRef.current = list.length;
                    lastCaptureScoreFloatPushedMoveKeyRef.current = moveKey;
                    return;
                }

                const commitMoveFloatState = () => {
                    lastFloatedMoveKeyRef.current = moveKey;
                    prevCapturesForFloatRef.current = { ...captures };
                    syncGrantedSnapshot();
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
                    if (missileAnchor) {
                        missileCaptureScoreAnchorRef.current = null;
                        missileCaptureScoreAnchorMoveCountRef.current = null;
                    }
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
                syncGrantedSnapshot();
                return;
            }
            const missileAnchor = missileMovedStoneAnchorFor(capturer);
            const lm = lastMoveForFloatRef.current;
            const anchor = missileAnchor ?? (lm ? { x: lm.x, y: lm.y } : newEntries[0].point);
            if (missileAnchor) {
                missileCaptureScoreAnchorRef.current = null;
                missileCaptureScoreAnchorMoveCountRef.current = null;
            }
            if (moveKeyForSlice) lastCaptureScoreFloatPushedMoveKeyRef.current = moveKeyForSlice;
            if (captures) prevCapturesForFloatRef.current = { ...captures };
            syncGrantedSnapshot();
            pushFloat(totalPts, anchor, 0);
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [
        justCaptured,
        captures,
        speedTimePressureGranted,
        moveHistory,
        boardState,
        captureScoreFloatMinPoints,
        gameId,
        gameStatus,
        animation,
        adventureRegionalHeadStartCaptureBonus,
        blackPatternStones,
        whitePatternStones,
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
    const lastMissileCompletionSignalKeyRef = useRef<string>('');
    const missileCompletionInFlightRef = useRef<string>('');
    const boardSizePx = 840;
    
    // scoring 상태일 때 boardState를 보존하여 초기화 방지
    // 유효한 boardState가 있으면 보존
    useEffect(() => {
        if ((mode === GameMode.Thief || mode === GameMode.Dice) && isPlayfulEmptyBoardSnapshot(boardState, boardSize)) {
            preservedBoardStateRef.current = null;
            return;
        }
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
    }, [boardState, boardSize, mode]);
    
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

        if (
            (mode === GameMode.Thief || mode === GameMode.Dice) &&
            isPlayfulEmptyBoardSnapshot(boardState, safeSize)
        ) {
            return boardState as BoardState;
        }

        const result = isBoardStateValid ? boardState : (preservedBoardStateRef.current || boardState);
        if (!result || !Array.isArray(result) || result.length === 0) {
            return Array(safeSize).fill(null).map(() => Array(safeSize).fill(Player.None));
        }
        return result;
    }, [boardState, gameStatus, boardSize, moveHistory, analysisResult, mode]);

    const revealAnimationStonePoints = useMemo(() => {
        if (animation?.type !== 'hidden_reveal' || !animation.stones?.length) return undefined;
        return animation.stones.map((s: { point: Point }) => s.point);
    }, [animation]);

    const boardCellLookup = useMemo(
        () =>
            buildBoardCellStoneLookup(displayBoardState, {
                moveHistory,
                hiddenMoves,
                baseHiddenMoveCtx,
                baseStones,
                consumedPatternIntersections,
                humanHiddenStonePoints,
                aiInitialHiddenStone,
                permanentlyRevealedStones,
                myRevealedMoveIndices,
                myRevealedStones,
                myPlayerEnum,
                blackPatternStones,
                whitePatternStones,
                revealAnimationStones: revealAnimationStonePoints,
            }),
        [
            displayBoardState,
            moveHistory,
            hiddenMoves,
            baseHiddenMoveCtx,
            baseStones,
            consumedPatternIntersections,
            humanHiddenStonePoints,
            aiInitialHiddenStone,
            permanentlyRevealedStones,
            myRevealedMoveIndices,
            myRevealedStones,
            myPlayerEnum,
            blackPatternStones,
            whitePatternStones,
            revealAnimationStonePoints,
        ],
    );

    /** 캐슬 바둑: 현재 보드 기준 확정 영토를 즉시 계산해 마커를 바로 표시한다. */
    const liveCastleConfirmedTerritory = useMemo(() => {
        if (!castleStonePoints?.length) return confirmedTerritoryOwnerByPoint;
        if (gameStatus !== 'playing' && gameStatus !== 'ended' && gameStatus !== 'scoring') {
            return confirmedTerritoryOwnerByPoint;
        }
        const slice = {
            castleStonePoints,
            confirmedTerritoryOwnerByPoint: confirmedTerritoryOwnerByPoint ?? {},
            boardState: displayBoardState,
            settings: { komi: 0 },
        };
        return detectAndConfirmTerritories(slice, displayBoardState as BoardState);
    }, [castleStonePoints, confirmedTerritoryOwnerByPoint, displayBoardState, gameStatus]);

    const safeBoardSize = boardSize > 0 ? boardSize : 19;
    const cell_size = boardSizePx / safeBoardSize;
    const padding = cell_size / 2;
    const stone_radius = cell_size * 0.47;
    
    const isScoringOrEnded = gameStatus === 'scoring' || gameStatus === 'ended' || gameStatus === 'no_contest';
    const activeUniformStoneDisplayColor = resolveUniformStoneDisplayColorForBoard(
        gameStatus,
        uniformStoneDisplayColor,
    );
    const territoryMarkersUseActualColors = activeUniformStoneDisplayColor == null;
    /** 따내기 직후 `ended`여도 +점수 플로트는 재생되게 함(`index.css` 2.85s 애니). 계가·무승부만 숨김 */
    const hideCaptureScoreFloatOverlay = gameStatus === 'scoring' || gameStatus === 'no_contest';

    const missileAnimType = animation?.type;
    const missileAnimStartTime = animation?.startTime;
    const missileAnimDuration = animation?.duration;
    const isMissileFlightAnimation =
        missileAnimType === 'missile' || missileAnimType === 'hidden_missile';

    // 미사일 애니메이션 완료 감지 및 처리
    useEffect(() => {
        const makeMissileCompletionSignalKey = () => {
            if (!gameId || !isMissileFlightAnimation || missileAnimStartTime == null) {
                return '';
            }
            return `${gameId}:${missileAnimType}:${missileAnimStartTime}`;
        };
        const sendMissileCompletionOnce = (singlePlayer: boolean) => {
            void (async () => {
                const dispatch = onActionRef.current;
                if (!dispatch || !gameId) return;
                const signalKey = makeMissileCompletionSignalKey();
                if (!signalKey) return;
                if (lastMissileCompletionSignalKeyRef.current === signalKey) {
                    return;
                }
                if (missileCompletionInFlightRef.current === signalKey) {
                    return;
                }

                missileCompletionInFlightRef.current = signalKey;
                try {
                    const result = singlePlayer
                        ? await dispatch({
                              type: 'SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE',
                              payload: { gameId },
                          } as any)
                        : await dispatch({
                              type: 'MISSILE_ANIMATION_COMPLETE',
                              payload: { gameId },
                          });
                    if (result && typeof result === 'object' && 'error' in result && (result as { error?: unknown }).error) {
                        throw new Error(String((result as { error?: unknown }).error));
                    }
                    lastMissileCompletionSignalKeyRef.current = signalKey;
                } catch (err) {
                    console.warn('[GoBoard] Missile completion dispatch failed, retry allowed:', err);
                } finally {
                    if (missileCompletionInFlightRef.current === signalKey) {
                        missileCompletionInFlightRef.current = '';
                    }
                }
            })();
        };

        // 이전 타임아웃 정리
        if (missileAnimationTimeoutRef.current) {
            clearTimeout(missileAnimationTimeoutRef.current);
            missileAnimationTimeoutRef.current = null;
        }

        // 게임 상태가 playing으로 변경되었고 애니메이션이 없으면 애니메이션 완료로 간주
        // (서버에서 GAME_UPDATE를 받아 gameStatus가 playing으로 변경되고 animation이 null이 된 경우)
        if (gameStatus === 'playing' && !isMissileFlightAnimation) {
            console.log(`[GoBoard] Game status changed to playing, animation cleared. Animation:`, animation);
            lastMissileCompletionSignalKeyRef.current = '';
            // 애니메이션 타임아웃이 남아있으면 정리
            if (missileAnimationTimeoutRef.current) {
                clearTimeout(missileAnimationTimeoutRef.current);
                missileAnimationTimeoutRef.current = null;
            }
            return;
        }

        // 미사일 애니메이션 완료 감지
        // - 멀티플레이: 기본은 missile_animating. 다만 병합 버그로 playing인데 미사일 애니만 남은 경우도 타이머를 걸어
        //   MISSILE_ANIMATION_COMPLETE를 보내 서버·다른 클라와 맞춘다(슬림 WS에서 animation 필드 생략 시).
        // - 싱글플레이/도전의 탑: 서버/클라이언트 상태가 약간 어긋나도 애니메이션이 존재하면 항상 완료 타이머를 건다
        const shouldTrackMissileAnimation =
            isMissileFlightAnimation &&
            missileAnimStartTime != null &&
            missileAnimDuration != null &&
            (gameStatus === 'missile_animating' || gameStatus === 'playing' || isSinglePlayer);

        if (shouldTrackMissileAnimation) {
            const startTime = missileAnimStartTime;
            const duration = missileAnimDuration;
            const now = Date.now();
            const elapsed = now - startTime;
            const remaining = Math.max(0, duration - elapsed);
            const animationEndTime = startTime + duration;

            console.log(`[GoBoard] Missile animation detected: type=${missileAnimType}, startTime=${startTime}, now=${now}, elapsed=${elapsed}ms, duration=${duration}ms, remaining=${remaining}ms, endTime=${animationEndTime}`);

            // 싱글플레이 게임은 클라이언트에서 직접 처리
            if (isSinglePlayer) {
                // 이미 애니메이션이 완료되었으면 즉시 처리
                if (elapsed >= duration) {
                    console.log(`[GoBoard] SinglePlayer missile animation already completed (elapsed=${elapsed}ms >= duration=${duration}ms), triggering completion immediately`);
                    sendMissileCompletionOnce(true);
                    return;
                }

                // 애니메이션 완료 시간에 맞춰 완료 신호 전송
                const timeout = remaining + 100; // 약간의 여유 시간 추가 (100ms)
                
                missileAnimationTimeoutRef.current = setTimeout(() => {
                    const currentTime = Date.now();
                    const currentElapsed = currentTime - startTime;
                    console.log(`[GoBoard] SinglePlayer missile animation timeout triggered. Expected end time: ${animationEndTime}, current time: ${currentTime}, elapsed: ${currentElapsed}ms, duration: ${duration}ms`);
                    
                    sendMissileCompletionOnce(true);
                    missileAnimationTimeoutRef.current = null;
                }, timeout);
            } else {
                // 멀티플레이어 게임은 서버에 완료 신호 전송
                // 이미 애니메이션이 완료되었으면 즉시 처리
                if (elapsed >= duration) {
                    console.log(`[GoBoard] Missile animation already completed (elapsed=${elapsed}ms >= duration=${duration}ms), triggering completion immediately`);
                    sendMissileCompletionOnce(false);
                    return;
                }

                // 애니메이션 완료 시간에 맞춰 완료 신호 전송
                const timeout = remaining + 100; // 약간의 여유 시간 추가 (100ms)
                
                missileAnimationTimeoutRef.current = setTimeout(() => {
                    const currentTime = Date.now();
                    const currentElapsed = currentTime - startTime;
                    console.log(`[GoBoard] Missile animation timeout triggered. Expected end time: ${animationEndTime}, current time: ${currentTime}, elapsed: ${currentElapsed}ms, duration: ${duration}ms`);
                    
                    sendMissileCompletionOnce(false);
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
    }, [
        missileAnimType,
        missileAnimStartTime,
        missileAnimDuration,
        isMissileFlightAnimation,
        gameStatus,
        gameId,
        isSinglePlayer,
    ]);

    const isLastMoveMarkerEnabled = useMemo(() => {
        const strategicModes = SPECIAL_GAME_MODES.map(m => m.mode);
        const enabledPlayfulModes = [GameMode.Omok, GameMode.Ttamok, GameMode.Dice, GameMode.Thief];
        return strategicModes.includes(mode) || enabledPlayfulModes.includes(mode) || gameStatus.startsWith('single_player');
    }, [mode, gameStatus]);

    useEffect(() => {
        if (!isMissileSelectingActive) {
            setSelectedMissileStone(null);
        }
    }, [isMissileSelectingActive]);

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

    /** 드래그 끝점(보드 격자 밖·레터박스 포함) 기준 미사일 방향 — `getBoardCoordinates`는 판 밖에서 null */
    const resolveMissileDirectionFromScreenPoint = (
        startStone: Point,
        clientX: number,
        clientY: number,
    ): 'up' | 'down' | 'left' | 'right' | null => {
        const svgEnd = screenToSvgRootPoint(clientX, clientY);
        if (!svgEnd) return null;
        const { cx, cy } = toSvgCoords(startStone);
        const dx = svgEnd.x - cx;
        const dy = svgEnd.y - cy;
        if (Math.hypot(dx, dy) < 8) return null;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        return dy > 0 ? 'down' : 'up';
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
    
        if (isMissileSelectingActive && !isBoardDisabled) {
            // 미사일은 "이동 자체"를 수행하므로 인접 liberty 조건에 묶지 않는다.
            // (서버는 미사일 경로 규칙으로 검증하고, hidden/표시 미스매치 케이스에서도 UX를 맞추기 위함)
            const actualPlayerAtPos = boardState?.[boardPos.y]?.[boardPos.x] ?? displayBoardState[boardPos.y]?.[boardPos.x];
            if (actualPlayerAtPos === myPlayerEnum) {
                setSelectedMissileStone(boardPos);
                setIsDraggingMissile(true);
                setDragStartPoint({ x: e.clientX, y: e.clientY });
                dragStartBoardPoint.current = boardPos;
                (e.target as SVGSVGElement).setPointerCapture(e.pointerId);
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
            } else if (startStone && onMissileLaunch) {
                const releaseClient = dragEndPoint ?? { x: e.clientX, y: e.clientY };
                const direction = resolveMissileDirectionFromScreenPoint(
                    startStone,
                    releaseClient.x,
                    releaseClient.y,
                );
                if (direction) {
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
                const atP1 = baseStones_p1?.some((st) => st.x === boardPos.x && st.y === boardPos.y);
                const atP2 = baseStones_p2?.some((st) => st.x === boardPos.x && st.y === boardPos.y);
                if (isPairBasePlacementHost ? atP1 || atP2 : myBaseStonesForPlacement?.some((st) => st.x === boardPos.x && st.y === boardPos.y)) {
                    return;
                }
                onBoardClick(boardPos.x, boardPos.y);
                return;
            }

            // 체스 바둑: 자기 기물 선택·이동은 바둑 착수 검사를 건너뛰고 Game.tsx에서 처리
            if (mode === GameMode.Chess && gameStatus === 'playing' && !isBoardDisabled) {
                onBoardClick(boardPos.x, boardPos.y);
                return;
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
        if (baseStonesP1Player === myPlayerEnum) return baseStones_p1;
        if (baseStonesP2Player === myPlayerEnum) return baseStones_p2;
        return null;
    }, [gameStatus, myPlayerEnum, baseStones_p1, baseStones_p2, baseStonesP1Player, baseStonesP2Player]);


    const isOpponentHiddenStoneAtPos = (pos: Point): boolean => {
        if (!hiddenMoves || !moveHistory) return false;
        if (gameStatus !== 'playing' && gameStatus !== 'hidden_placing') return false;

        const opponentPlayer = myPlayerEnum === Player.Black ? Player.White : Player.Black;
        const cell = displayBoardState[pos.y]?.[pos.x];
        if (cell === myPlayerEnum) return false;

        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const move = moveHistory[i];
            if (move.x === pos.x && move.y === pos.y && move.player === opponentPlayer) {
                return !!hiddenMoves[i];
            }
        }
        return false;
    };
    
    const isGameFinished = gameStatus === 'ended' || gameStatus === 'no_contest';

    const basePlacementHoverAllowed =
        gameStatus !== 'base_placement' ||
        canPlaceMoreBaseStones === undefined ||
        canPlaceMoreBaseStones === true;

    const showHoverPreview =
        basePlacementHoverAllowed &&
        hoverPos &&
        !isBoardDisabled &&
        gameStatus !== 'scanning' &&
        !isMissileSelectingActive &&
        (displayBoardState[hoverPos.y][hoverPos.x] === Player.None || isOpponentHiddenStoneAtPos(hoverPos));
    
    const renderCastleConfirmedTerritoryMarkers = () => {
        if (!liveCastleConfirmedTerritory) return null;
        const cellSize = (boardSizePx - padding * 2) / safeBoardSize;
        const size = cellSize * 0.38;
        const opacity = 0.9;
        const castleKeys = new Set((castleStonePoints ?? []).map((p) => `${p.x},${p.y}`));

        return (
            <g style={{ pointerEvents: 'none' }}>
                {Object.entries(liveCastleConfirmedTerritory).map(([key, owner]) => {
                    const [tx, ty] = key.split(',').map(Number);
                    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
                    const onBoard = displayBoardState[ty]?.[tx];
                    const isCastleCell = castleKeys.has(key);
                    if (onBoard !== Player.None && !isCastleCell) return null;
                    const { cx, cy } = toSvgCoords({ x: tx, y: ty });
                    const markerDisplayPlayer = resolveTerritoryMarkerDisplayPlayer(
                        owner,
                        gameStatus,
                        uniformStoneDisplayColor,
                    );
                    const { fill, stroke } = territoryMarkerRgba(markerDisplayPlayer, opacity, {
                        emphasizeActualColors: territoryMarkersUseActualColors,
                    });
                    return (
                        <rect
                            key={`castle-territory-${key}`}
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
                    );
                })}
            </g>
        );
    };

    const renderDeadStoneMarkers = () => {
        if (!showTerritoryOverlay || !analysisResult || !analysisResult.deadStones) return null;

        return (
            <g style={{ pointerEvents: 'none' }} className="animate-fade-in">
                {analysisResult.deadStones.map((p, i) => {
                    const { cx, cy } = toSvgCoords(p);
                    const deadStonePlayer = displayBoardState[p.y]?.[p.x];
                    const capturingPlayer: Player.Black | Player.White =
                        deadStonePlayer === Player.Black
                            ? Player.White
                            : deadStonePlayer === Player.White
                              ? Player.Black
                              : Player.White;
                    const markerDisplayPlayer = resolveTerritoryMarkerDisplayPlayer(
                        capturingPlayer,
                        gameStatus,
                        uniformStoneDisplayColor,
                    );

                    const cellSize = (boardSizePx - padding * 2) / safeBoardSize;
                    const size = cellSize * 0.38;
                    const opacity = 0.85;
                    const { fill, stroke } = territoryMarkerRgba(markerDisplayPlayer, opacity, {
                        emphasizeActualColors: territoryMarkersUseActualColors,
                    });

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
            const deadSet = new Set(
                (analysisResult.deadStones ?? []).map((d) => `${d.x},${d.y}`)
            );
            analysisResult.ownershipMap.forEach((row, y) => {
                row.forEach((value, x) => {
                    const onBoard = displayBoardState[y]?.[x];
                    const isDeadMarked = deadSet.has(`${x},${y}`);
                    if (onBoard !== Player.None && !isDeadMarked) return;
                    if (Math.abs(value) < TERRITORY_THRESHOLD) return;

                    const { cx, cy } = toSvgCoords({ x, y });
                    const absValue = Math.abs(value);
                    const prob = absValue / 10;
                    const sizeMin = 0.14;
                    const sizeMax = 0.4;
                    const rectSize = cellSize * (sizeMin + (sizeMax - sizeMin) * prob);

                    const isBlackTerritory = value > 0;
                    const markerDisplayPlayer = resolveTerritoryMarkerDisplayPlayer(
                        isBlackTerritory ? Player.Black : Player.White,
                        gameStatus,
                        uniformStoneDisplayColor,
                    );
                    const { fill, stroke } = territoryMarkerRgba(markerDisplayPlayer, opacity, {
                        emphasizeActualColors: territoryMarkersUseActualColors,
                    });

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
                const markerDisplayPlayer = resolveTerritoryMarkerDisplayPlayer(
                    isBlack ? Player.Black : Player.White,
                    gameStatus,
                    uniformStoneDisplayColor,
                );
                const { fill, stroke } = territoryMarkerRgba(markerDisplayPlayer, opacity, {
                    emphasizeActualColors: territoryMarkersUseActualColors,
                });
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
        if (!isMissileSelectingActive || !selectedMissileStone || !onMissileLaunch) return null;

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
            className={`relative z-20 w-full h-full min-h-0 shadow-2xl rounded-lg overflow-hidden p-0 border-4 border-gray-800 bg-transparent go-board-panel ${gameStatus === 'scanning' ? 'cursor-scan' : ''}`}
            style={{ 
                backgroundImage: 'none', 
                backgroundColor: 'transparent',
            }}
        >
            {isItemModeActive && (
                <div className="go-board-panel-fx go-board-panel-fx--prism" aria-hidden />
            )}
            {showBoardGlow && !isItemModeActive && (
                <div className="go-board-panel-fx go-board-panel-fx--glow" aria-hidden />
            )}
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
                    <radialGradient id="castle_stone_highlight" cx="32%" cy="30%" r="68%" fx="28%" fy="26%">
                        <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.95" />
                        <stop offset="45%" stopColor="#e8dcc8" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#b8a88c" stopOpacity="0.15" />
                    </radialGradient>
                    <radialGradient id="castle_marker_aura" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
                        <stop offset="58%" stopColor="#f59e0b" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#92400e" stopOpacity="0" />
                    </radialGradient>
                    <filter id="castle_marker_shadow" x="-55%" y="-55%" width="210%" height="210%">
                        <feDropShadow dx="0" dy="1.4" stdDeviation="1.8" floodColor="#000000" floodOpacity="0.55" />
                        <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#facc15" floodOpacity="0.45" />
                    </filter>
                    <linearGradient id="castle_black_half" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#36322b" />
                        <stop offset="55%" stopColor="#111111" />
                        <stop offset="100%" stopColor="#050505" />
                    </linearGradient>
                    <linearGradient id="castle_white_half" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fff8e8" />
                        <stop offset="52%" stopColor="#e4dccd" />
                        <stop offset="100%" stopColor="#b9aa91" />
                    </linearGradient>
                    <linearGradient id="castle_keep" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fff2b8" />
                        <stop offset="55%" stopColor="#d4a84f" />
                        <stop offset="100%" stopColor="#8f6428" />
                    </linearGradient>
                    <linearGradient id="castle_tower" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f6d982" />
                        <stop offset="100%" stopColor="#9d7132" />
                    </linearGradient>
                    <linearGradient id="castle_tower_light" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fff4c7" />
                        <stop offset="100%" stopColor="#d7ad5a" />
                    </linearGradient>
                    <linearGradient id="castle_wall" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#7d6952" />
                        <stop offset="100%" stopColor="#3f342a" />
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

                {renderCastleConfirmedTerritoryMarkers()}

                {castleStonePoints?.map((stone, i) => {
                    const { cx, cy } = toSvgCoords(stone);
                    return <CastleStoneMarker key={`castle-stone-${i}`} cx={cx} cy={cy} radius={stone_radius * 1.08} />;
                })}
                
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
                    const cellFlags = boardCellLookup.get(`${x},${y}`);
                    const isPlainStoneReuseIntersection = cellFlags?.isPlainStoneReuseIntersection ?? false;
                    const atAiInitialHiddenStone = cellFlags?.atAiInitialHiddenStone ?? false;
                    const isHiddenMove = cellFlags?.isHiddenMove ?? false;
                    const isInRevealAnimation = cellFlags?.isInRevealAnimation ?? false;
                    const isPermanentlyRevealed = cellFlags?.isPermanentlyRevealed ?? false;
                    const softScanAtCurrentMove = cellFlags?.softScanAtCurrentMove ?? false;

                    const isSingleLastMove = showLastMoveMarker && isLastMoveMarkerEnabled && lastMove && lastMove.x === x && lastMove.y === y;
                    const isMultiLastMove = showLastMoveMarker && isLastMoveMarkerEnabled && lastTurnStones && lastTurnStones.some(p => p.x === x && p.y === y);
                    const isLast = !!(isSingleLastMove || isMultiLastMove);
                    const isMyJustPlacedStone = !!lastMove && lastMove.x === x && lastMove.y === y && actualPlayer === myPlayerEnum;
                    // 유저 차례에는 AI 히든 아이템 연출용 오버레이만 남아 내가 둔 돌에 잠시 문양이 붙는 현상 방지
                    const isHiddenMoveForRender =
                        !!isHiddenMove ||
                        (!!atAiInitialHiddenStone &&
                            actualPlayer !== myPlayerEnum &&
                            // AI 히든 아이템 좌표는 `moveHistory/hiddenMoves` 동기화가 어긋나도
                            // 기본 렌더 규칙(상대 비공개)로 즉시 히든처럼 보이도록 처리한다.
                            true);
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
                    // 방어 로직: AI 히든 좌표는 내 돌 색 판정이 잠깐 어긋나도 기본 비공개를 강제한다.
                    // (스캔으로 찾은 경우/영구 공개/게임 종료는 예외)
                    if (
                        atAiInitialHiddenStone &&
                        !isGameFinished &&
                        !isPermanentlyRevealed &&
                        !softScanAtCurrentMove
                    ) {
                        isVisible = false;
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

                    const hasBaseStoneHere = cellFlags?.hasBaseStoneHere ?? false;
                    const isKnownHidden = !!effectiveHiddenMoveForRender;
                    const isSelectedMissileForRender = selectedMissileStone?.x === x && selectedMissileStone?.y === y;
                    const isHoverSelectableMissile =
                        isMissileSelectingActive && !selectedMissileStone && actualPlayer === myPlayerEnum;
                    const isPatternStone = effectiveHiddenMoveForRender
                        ? false
                        : (cellFlags?.isPatternStone ?? false);

                    const stonePlayerForRender = actualPlayer;
                    const isChessLastMoveTo =
                        !!chessLastMove && chessLastMove.to.x === x && chessLastMove.to.y === y;

                    return <MemoStone key={`${x}-${y}`} player={stonePlayerForRender} uniformDisplayColor={activeUniformStoneDisplayColor} cx={cx} cy={cy} isLastMove={isLast} isKnownHidden={isKnownHidden as boolean} isBaseStone={hasBaseStoneHere} isPatternStone={isPatternStone} chessPieceType={chessPieces.find((p) => p.x === x && p.y === y)?.type} chessRemainingMoves={chessPieces.find((p) => p.x === x && p.y === y)?.remainingMoves} chessPieceSelected={chessPieces.some((p) => p.id === selectedChessPieceId && p.x === x && p.y === y)} isChessLastMoveTo={isChessLastMoveTo} isNewlyRevealed={isNewlyRevealedForAnim} animationClass={isNewlyRevealedForAnim ? 'sparkle-animation' : ''} isSelectedMissile={isSelectedMissileForRender} isHoverSelectableMissile={isHoverSelectableMissile} radius={stone_radius} isFaint={isFaint} keepUpright={!!isRotated} />;
                }))}
                {isPairBasePlacementHost ? (
                    <>
                        {baseStones_p1?.map((stone, i) => {
                            const { cx, cy } = toSvgCoords(stone);
                            return (
                                <g key={`my-base-p1-${i}`} opacity={0.7} className="animate-fade-in">
                                    <Stone player={baseStonesP1Player} cx={cx} cy={cy} isBaseStone radius={stone_radius} />
                                </g>
                            );
                        })}
                        {baseStones_p2?.map((stone, i) => {
                            const { cx, cy } = toSvgCoords(stone);
                            return (
                                <g key={`my-base-p2-${i}`} opacity={0.7} className="animate-fade-in">
                                    <Stone player={baseStonesP2Player} cx={cx} cy={cy} isBaseStone radius={stone_radius} />
                                </g>
                            );
                        })}
                    </>
                ) : (
                    myBaseStonesForPlacement?.map((stone, i) => {
                        const { cx, cy } = toSvgCoords(stone);
                        return (
                            <g key={`my-base-${i}`} opacity={0.7} className="animate-fade-in">
                                <Stone player={myPlayerEnum} cx={cx} cy={cy} isBaseStone radius={stone_radius} />
                            </g>
                        );
                    })
                )}
                {(gameStatus === 'base_stone_color_choice' ||
                    gameStatus === 'base_same_color_points_bid' ||
                    (gameStatus === 'capture_bidding' && modeIncludesBaseCaptureMix(mode, { mixedModes }))) && (
                    <>
                        {baseStones_p1?.map((stone, i) => {
                            const { cx, cy } = toSvgCoords(stone);
                            return (
                                <Stone
                                    key={`komi-base-p1-${i}`}
                                    player={baseStonesP1Player}
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
                                    player={baseStonesP2Player}
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
                        <g style={{ pointerEvents: 'none' }}>
                            <Stone
                                player={pendingMove.player}
                                uniformDisplayColor={activeUniformStoneDisplayColor}
                                cx={cx}
                                cy={cy}
                                radius={stone_radius}
                                isPlacementPreview
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
                    if (highlightStyle === 'green-dot') {
                        return (
                            <circle
                                key={`highlight-green-${i}`}
                                cx={cx}
                                cy={cy}
                                r={stone_radius * 0.24}
                                fill="rgb(34, 197, 94)"
                                stroke="rgb(21, 128, 61)"
                                strokeWidth={Math.max(1, stone_radius * 0.04)}
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

                {showHoverPreview && hoverPos && (
                    <g style={{ pointerEvents: 'none' }}>
                        <Stone
                            player={stoneColor}
                            uniformDisplayColor={activeUniformStoneDisplayColor}
                            cx={toSvgCoords(hoverPos).cx}
                            cy={toSvgCoords(hoverPos).cy}
                            radius={stone_radius}
                            isPlacementPreview
                        />
                    </g>
                )}
                {renderMissileLaunchPreview()}
                {/* 계가/결과 모달 중에는 미사일 등 애니메이션 미표시 — 최종 보드만 표시 */}
                {animation && !isScoringOrEnded && (() => {
                    return (
                        <>
                            {(animation.type === 'missile' || animation.type === 'hidden_missile') && (() => {
                                const fromCell =
                                    displayBoardState[animation.from.y]?.[animation.from.x] ?? Player.None;
                                const fromStonePlayer =
                                    fromCell !== Player.None ? fromCell : animation.player;
                                const fromKind = classifyMissileFromStone(
                                    animation.from,
                                    moveHistory,
                                    hiddenMoves,
                                    permanentlyRevealedStones,
                                    myRevealedStones,
                                    myRevealedMoveIndices,
                                    fromStonePlayer,
                                    isSpectator ? undefined : myPlayerEnum,
                                    baseHiddenMoveCtx,
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
                                            key={`reveal-${s.point.x}-${s.point.y}-${s.player}`}
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
                                            fill={vis.fill}
                                            stroke={vis.stroke}
                                            strokeWidth={vis.strokeWidth}
                                            paintOrder="stroke fill"
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
                {strategicPetHintOverlay &&
                    strategicPetHintOverlay.x >= 0 &&
                    strategicPetHintOverlay.y >= 0 &&
                    (() => {
                        const { cx, cy } = toSvgCoords({
                            x: strategicPetHintOverlay.x,
                            y: strategicPetHintOverlay.y,
                        });
                        const r = Math.max(cell_size * 0.12, 3);
                        return (
                            <g key="strategic-pet-hint" style={{ pointerEvents: 'none' }}>
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={r}
                                    fill="#38bdf8"
                                    stroke="#0c4a6e"
                                    strokeWidth={Math.max(1, cell_size * 0.02)}
                                    opacity={0.92}
                                />
                            </g>
                        );
                    })()}
                {strategicPetHintRewardAnimation &&
                    strategicPetHintRewardAnimation.x >= 0 &&
                    strategicPetHintRewardAnimation.y >= 0 &&
                    (strategicPetHintRewardAnimation.iconSrc || strategicPetHintRewardAnimation.quantityLabel) &&
                    (() => {
                        const { cx, cy } = toSvgCoords({
                            x: strategicPetHintRewardAnimation.x,
                            y: strategicPetHintRewardAnimation.y,
                        });
                        const size = Math.max(cell_size * 0.76, 18);
                        const animationDelay = undefined;
                        const hasIcon = Boolean(strategicPetHintRewardAnimation.iconSrc);
                        const quantityY = hasIcon ? size * 0.52 : -size * 0.1;
                        const quantityFont = hasIcon
                            ? Math.max(11, cell_size * 0.36)
                            : Math.max(13, cell_size * 0.42);
                        return (
                            <g
                                key={strategicPetHintRewardAnimation.id}
                                transform={`translate(${cx}, ${cy})`}
                                style={{ pointerEvents: 'none' }}
                            >
                                {/* 보드 180° 회전 시에도 아이콘·수량·상승 연출이 화면 기준 정방향(아래→위)으로 보이도록 역회전 */}
                                <g transform={isRotated ? 'rotate(180)' : undefined}>
                                    <g
                                        className="pet-hint-reward-float"
                                        style={animationDelay ? { animationDelay } : undefined}
                                    >
                                        <circle
                                            cx={0}
                                            cy={-size * 0.1}
                                            r={size * 0.46}
                                            fill="rgba(255,255,255,0.72)"
                                            stroke="#facc15"
                                            strokeWidth={Math.max(1.4, cell_size * 0.035)}
                                        />
                                        {hasIcon ? (
                                            <image
                                                href={strategicPetHintRewardAnimation.iconSrc}
                                                x={-size / 2}
                                                y={-size * 0.6}
                                                width={size}
                                                height={size}
                                                preserveAspectRatio="xMidYMid meet"
                                            />
                                        ) : null}
                                        <text
                                            x={0}
                                            y={quantityY}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            className="pet-hint-reward-quantity"
                                            fontSize={quantityFont}
                                            strokeWidth={Math.max(2.2, cell_size * 0.06)}
                                        >
                                            {strategicPetHintRewardAnimation.quantityLabel}
                                        </text>
                                    </g>
                                </g>
                            </g>
                        );
                    })()}
                </g>
            </svg>
            {boardRuleFlashMessage && (
                <div className="pointer-events-none absolute inset-0 z-[35] flex items-center justify-center px-4">
                    <div className="max-w-[92%] rounded-xl border border-amber-300/60 bg-black/65 px-4 py-2 text-center text-sm font-bold leading-snug text-amber-100 shadow-[0_0_16px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
                        {boardRuleFlashMessage}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

function areGoBoardPropsEqual(prev: GoBoardProps, next: GoBoardProps): boolean {
    return (
        prev.boardState === next.boardState &&
        prev.moveHistory === next.moveHistory &&
        prev.gameStatus === next.gameStatus &&
        prev.currentPlayer === next.currentPlayer &&
        prev.lastMove === next.lastMove &&
        prev.lastTurnStones === next.lastTurnStones &&
        prev.animation === next.animation &&
        prev.pendingMove === next.pendingMove &&
        prev.selectedChessPieceId === next.selectedChessPieceId &&
        prev.chessLastMove === next.chessLastMove &&
        prev.justCaptured === next.justCaptured &&
        prev.newlyRevealed === next.newlyRevealed &&
        prev.permanentlyRevealedStones === next.permanentlyRevealedStones &&
        prev.hiddenMoves === next.hiddenMoves &&
        prev.baseStones === next.baseStones &&
        prev.isBoardDisabled === next.isBoardDisabled &&
        prev.showTerritoryOverlay === next.showTerritoryOverlay &&
        prev.showHintOverlay === next.showHintOverlay &&
        prev.strategicPetHintOverlay === next.strategicPetHintOverlay &&
        prev.strategicPetHintRewardAnimation === next.strategicPetHintRewardAnimation &&
        prev.boardRuleFlashMessage === next.boardRuleFlashMessage &&
        prev.uniformStoneDisplayColor === next.uniformStoneDisplayColor
    );
}

const MemoGoBoard = memo(GoBoard, areGoBoardPropsEqual);
MemoGoBoard.displayName = 'GoBoard';

export default MemoGoBoard;