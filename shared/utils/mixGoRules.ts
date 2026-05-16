import { GameMode } from '../types/enums.js';

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
