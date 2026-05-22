import { GameMode, Player } from '../types/enums.js';

/**
 * 믹스룰 바둑에서 UI·서버가 함께 허용하는 하위 규칙 집합(클래식~미사일).
 * 도둑/주사위/오목 등은 별도 세션 타입이라 여기 포함하지 않는다.
 */
export const MIX_GO_COMBINABLE_SUB_MODES: readonly GameMode[] = [
    GameMode.Standard,
    GameMode.Capture,
    GameMode.Speed,
    GameMode.Base,
    GameMode.Hidden,
    GameMode.Missile,
] as const;

const MIX_GO_COMBINABLE_SET = new Set<GameMode>(MIX_GO_COMBINABLE_SUB_MODES);

export function isMixGoMode(mode: unknown): boolean {
    return mode === GameMode.Mix;
}

/**
 * 순수 `subMode` 전용 경기이거나, 믹스룰에 해당 하위 규칙이 포함되어 있으면 true.
 */
export function mixGoOrPureModeIncludes(
    mode: unknown,
    mixedModes: readonly GameMode[] | null | undefined,
    subMode: GameMode,
): boolean {
    if (mode === subMode) return true;
    return mode === GameMode.Mix && Boolean(mixedModes?.includes?.(subMode));
}

/**
 * `mode === Mix`이고 `mixedModes`에 `required`의 모든 규칙이 포함될 때만 true.
 */
export function mixGoIsMixWithEverySubMode(
    mode: unknown,
    mixedModes: readonly GameMode[] | null | undefined,
    required: readonly GameMode[],
): boolean {
    if (mode !== GameMode.Mix || !Array.isArray(mixedModes) || required.length === 0) return false;
    return required.every((r) => mixedModes.includes(r));
}

/** `mixedModes` 안에서 믹스 조합으로 허용된 하위 규칙만, 첫 등장 순서로 중복 제거 */
export function mixGoUniqueCombinableModes(mixedModes: readonly GameMode[] | null | undefined): GameMode[] {
    if (!Array.isArray(mixedModes)) return [];
    const out: GameMode[] = [];
    for (const m of mixedModes) {
        const gm = m as GameMode;
        if (MIX_GO_COMBINABLE_SET.has(gm) && !out.includes(gm)) out.push(gm);
    }
    return out;
}

export function mixGoIsCombinableSubMode(mode: GameMode): boolean {
    return MIX_GO_COMBINABLE_SET.has(mode);
}

/** 히든·스캔 아이템 선택 UI 단계(배치/스캔 대기) */
export function mixGoIsPveHiddenItemSelectionStatus(status: unknown): boolean {
    const s = String(status ?? '');
    return s === 'hidden_placing' || s === 'scanning';
}

/** 세션에 히든 아이템(히든돌·스캔) 규칙이 적용되는지 — 순수 히든·믹스(히든 포함)·스테이지 hiddenStoneCount */
export function mixGoSessionHasHiddenItems(
    mode: unknown,
    settings: { mixedModes?: readonly GameMode[] | null; hiddenStoneCount?: number | null } | null | undefined,
): boolean {
    if (mixGoOrPureModeIncludes(mode, settings?.mixedModes, GameMode.Hidden)) return true;
    return (settings?.hiddenStoneCount ?? 0) > 0;
}

export function mixGoHiddenInventoryKeyForPlayer(
    player: Player,
): 'hidden_stones_p1' | 'hidden_stones_p2' {
    return player === Player.Black ? 'hidden_stones_p1' : 'hidden_stones_p2';
}

export function mixGoHiddenUsedKeyForPlayer(
    player: Player,
): 'hidden_stones_used_p1' | 'hidden_stones_used_p2' {
    return player === Player.Black ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
}

/** 아이템 페이즈 타이머·일시정지 필드만 정리(본경기 playing 전환은 호출측) */
export function mixGoClearHiddenItemPhaseTimers(session: {
    itemUseDeadline?: number;
    pausedTurnTimeLeft?: number;
    turnDeadline?: number;
    turnStartTime?: number;
    itemPhaseActingPlayer?: Player;
}): void {
    session.itemUseDeadline = undefined;
    session.pausedTurnTimeLeft = undefined;
    session.turnDeadline = undefined;
    session.turnStartTime = undefined;
    session.itemPhaseActingPlayer = undefined;
}

/**
 * hidden_placing/scanning인데 itemUseDeadline이 없으면 영구 고착.
 * (PVP hidden.ts와 동일 방어 — 싱글/타워 PVE 업데이트 루프에서도 필요)
 */
export function mixGoShouldUnstickHiddenItemSelectionPhase(game: {
    gameStatus?: string;
    itemUseDeadline?: number | null;
}): boolean {
    if (!mixGoIsPveHiddenItemSelectionStatus(game.gameStatus)) return false;
    return game.itemUseDeadline == null;
}

/** 착수 시 히든으로 처리할지 — hidden_placing이면 클라 isHidden 누락·타이머 경합과 무관하게 true */
export function mixGoTreatMoveAsHiddenPlacement(
    gameStatus: unknown,
    isHiddenRequested: boolean | undefined,
    isTargetPermanentlyRevealed: boolean,
): boolean {
    if (isTargetPermanentlyRevealed) return false;
    if (String(gameStatus ?? '') === 'hidden_placing') return true;
    return Boolean(isHiddenRequested);
}

type MoveLike = { x?: number; y?: number; player?: Player };

/**
 * PVE: 클라이언트가 SINGLE_PLAYER_CLIENT_MOVE로 이미 반영한 뒤 PLACE_STONE(isHidden)으로
 * board·moveHistory를 보낸 경우 — 서버가 processMove를 다시 돌리면 "이미 돌이 있음"으로 거절된다.
 */
export function mixGoPveHiddenPlacementAlreadyCommitted(
    game: {
        gameStatus?: string;
        boardState?: Player[][] | null;
        moveHistory?: readonly MoveLike[] | null;
    },
    x: number,
    y: number,
    player: Player,
): boolean {
    if (String(game.gameStatus ?? '') !== 'hidden_placing') return false;
    const board = game.boardState;
    if (!board?.[y] || board[y][x] !== player) return false;
    const mh = game.moveHistory;
    if (!mh?.length) return false;
    const last = mh[mh.length - 1];
    return last?.x === x && last?.y === y && last?.player === player;
}
