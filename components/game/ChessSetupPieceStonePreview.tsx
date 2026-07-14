import React, { useId } from 'react';
import type { ChessPieceType } from '../../types.js';
import { Player } from '../../types/enums.js';
import { getChessPieceCaptureValue, getInitialRemainingMoves } from '../../shared/utils/chessGoRules.js';

const CHESS_PIECE_GLYPHS: Record<ChessPieceType, string> = {
    pawn: '♟',
    rook: '♜',
    knight: '♞',
    bishop: '♝',
    queen: '♛',
    king: '♚',
};

interface ChessSetupPieceStonePreviewProps {
    pieceType: Exclude<ChessPieceType, 'king'>;
    stoneColor: Player.Black | Player.White;
    size?: number;
    selected?: boolean;
}

const ChessSetupPieceStonePreview: React.FC<ChessSetupPieceStonePreviewProps> = ({
    pieceType,
    stoneColor,
    size = 52,
    selected = false,
}) => {
    const uid = useId().replace(/:/g, '');
    const isBlack = stoneColor === Player.Black;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const moves = getInitialRemainingMoves(pieceType);
    const glyph = CHESS_PIECE_GLYPHS[pieceType];

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className={`block shrink-0 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] ${selected ? 'drop-shadow-[0_0_14px_rgba(251,191,36,0.35)]' : ''}`}
            aria-hidden
        >
            <defs>
                <radialGradient id={`${uid}-slate`} cx="32%" cy="30%" r="72%" fx="28%" fy="26%">
                    <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.85" />
                    <stop offset="42%" stopColor="#374151" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#020617" stopOpacity="0.55" />
                </radialGradient>
                <radialGradient id={`${uid}-clam`} cx="32%" cy="28%" r="74%" fx="30%" fy="26%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="28%" stopColor="#f8f5ec" />
                    <stop offset="62%" stopColor="#d9d2c4" />
                    <stop offset="100%" stopColor="#8f8778" />
                </radialGradient>
                <filter id={`${uid}-grain`} x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.08 0" />
                </filter>
                <pattern id={`${uid}-pattern`} patternUnits="userSpaceOnUse" width="100" height="100">
                    <rect width="100" height="100" fill="#f5f2e8" fillOpacity="0" />
                    <rect width="100" height="100" filter={`url(#${uid}-grain)`} />
                </pattern>
            </defs>
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={isBlack ? '#111827' : `url(#${uid}-clam)`}
                stroke={selected ? 'rgb(251, 191, 36)' : isBlack ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.18)'}
                strokeWidth={selected ? 2.8 : isBlack ? 1.2 : Math.max(0.8, radius * 0.05)}
            />
            {selected && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 2.5}
                    fill="none"
                    stroke="rgba(251, 191, 36, 0.35)"
                    strokeWidth={1.5}
                />
            )}
            {!isBlack && <circle cx={cx} cy={cy} r={radius} fill={`url(#${uid}-pattern)`} opacity={0.45} />}
            {isBlack && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={`url(#${uid}-slate)`}
                />
            )}
            <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={radius * 1.15}
                fill={isBlack ? '#f8fafc' : '#1e293b'}
            >
                {glyph}
            </text>
            <circle
                cx={cx + radius * 0.55}
                cy={cy + radius * 0.55}
                r={radius * 0.32}
                fill="rgba(15, 23, 42, 0.92)"
                stroke={selected ? 'rgba(251, 191, 36, 0.85)' : 'rgba(248, 250, 252, 0.9)'}
                strokeWidth={1.2}
            />
            <text
                x={cx + radius * 0.55}
                y={cy + radius * 0.55}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={radius * 0.38}
                fill="#f8fafc"
                fontWeight={700}
            >
                {moves}
            </text>
        </svg>
    );
};

export { getChessPieceCaptureValue, getInitialRemainingMoves };
export default ChessSetupPieceStonePreview;
