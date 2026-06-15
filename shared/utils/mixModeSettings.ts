import { GameMode, GameSettings } from '../types/index.js';
import {
    CHESS_BOARD_SIZES,
    STRATEGIC_SPECIAL_BOARD_SIZES,
    clampCastleCount,
    clampChessPieceTotalScore,
    getDefaultCastleCountByBoardSize,
    getDefaultChessKomiByBoardSize,
    getDefaultChessPieceTotalScore,
} from '../constants/gameSettings.js';

/** 믹스에서 따내기·캐슬은 동시 선택 불가 */
export function normalizeMixedModesSelection(
    mixedModes: GameMode[] | undefined,
    toggled: GameMode,
    checked: boolean,
): GameMode[] {
    let next = checked
        ? [...(mixedModes ?? []), toggled]
        : (mixedModes ?? []).filter((m) => m !== toggled);

    if (checked) {
        if (toggled === GameMode.Capture) {
            next = next.filter((m) => m !== GameMode.Castle);
        } else if (toggled === GameMode.Castle) {
            next = next.filter((m) => m !== GameMode.Capture);
        } else if (toggled === GameMode.Chess) {
            next = next.filter((m) => m !== GameMode.Base);
        } else if (toggled === GameMode.Base) {
            next = next.filter((m) => m !== GameMode.Chess);
        }
    }

    return next;
}

export function mixIncludesChess(mixedModes?: GameMode[]): boolean {
    return Boolean(mixedModes?.includes(GameMode.Chess));
}

export function mixIncludesCastle(mixedModes?: GameMode[]): boolean {
    return Boolean(mixedModes?.includes(GameMode.Castle));
}

export function getMixBoardSizeOptions(mixedModes?: GameMode[]): readonly number[] {
    if (mixIncludesChess(mixedModes)) return CHESS_BOARD_SIZES;
    return STRATEGIC_SPECIAL_BOARD_SIZES;
}

export function isMixSubModeCheckboxDisabled(mixedModes: GameMode[] | undefined, subMode: GameMode): boolean {
    const mix = mixedModes ?? [];
    if (subMode === GameMode.Capture) return mix.includes(GameMode.Castle);
    if (subMode === GameMode.Castle) return mix.includes(GameMode.Capture);
    if (subMode === GameMode.Chess) return mix.includes(GameMode.Base);
    if (subMode === GameMode.Base) return mix.includes(GameMode.Chess);
    return false;
}

/** 믹스 조합·판 크기 등 설정 일관성 보정 */
export function applyMixModeSettingsConstraints(settings: GameSettings): GameSettings {
    let next: GameSettings = { ...settings };
    let mixed = [...(next.mixedModes ?? [])];

    if (mixed.includes(GameMode.Capture) && mixed.includes(GameMode.Castle)) {
        mixed = mixed.filter((m) => m !== GameMode.Castle);
    }
    if (mixed.includes(GameMode.Chess) && mixed.includes(GameMode.Base)) {
        mixed = mixed.filter((m) => m !== GameMode.Base);
    }

    next.mixedModes = mixed;

    if (mixIncludesChess(mixed)) {
        if (!CHESS_BOARD_SIZES.includes(next.boardSize as number)) {
            next.boardSize = CHESS_BOARD_SIZES[0] as GameSettings['boardSize'];
        }
        const chessBoard = next.boardSize ?? 13;
        next.komi = getDefaultChessKomiByBoardSize(chessBoard);
        next.chessPieceTotalScore = clampChessPieceTotalScore(
            next.chessPieceTotalScore ?? getDefaultChessPieceTotalScore(chessBoard, false),
            chessBoard,
            false,
        );
    }

    const validSizes = getMixBoardSizeOptions(mixed);
    if (!validSizes.includes(next.boardSize as number)) {
        next.boardSize = validSizes[0] as GameSettings['boardSize'];
    }

    if (mixIncludesCastle(mixed)) {
        next.castleCount = clampCastleCount(
            next.castleCount ?? getDefaultCastleCountByBoardSize(next.boardSize ?? 13),
            next.boardSize ?? 13,
        );
    }

    return next;
}
