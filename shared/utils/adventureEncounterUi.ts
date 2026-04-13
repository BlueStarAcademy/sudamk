import type { GameStatus } from '../types/enums.js';

/** 모험 인카운터 전체 제한시간(남은 시간) UI를 표시하는 상태 — 히든/미사일 아이템 페이즈 포함 */
const ADVENTURE_ENCOUNTER_COUNTDOWN_STATUSES: ReadonlySet<GameStatus> = new Set([
    'playing',
    'hidden_placing',
    'scanning',
    'scanning_animating',
    'hidden_reveal_animating',
    'hidden_final_reveal',
    'missile_selecting',
    'missile_animating',
]);

export function adventureEncounterCountdownUiActive(
    gameCategory: string | undefined,
    gameStatus: GameStatus | undefined
): boolean {
    return gameCategory === 'adventure' && gameStatus != null && ADVENTURE_ENCOUNTER_COUNTDOWN_STATUSES.has(gameStatus);
}
