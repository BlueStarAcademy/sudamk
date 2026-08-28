import type { LiveGameSession } from '../types/entities.js';
import { resolveArenaSessionPolicy } from './liveSessionArenaKind.js';
import { adventureMonsterLevelToKataServerLevel } from './strategicAiDifficulty.js';

export function resolveAdventureMonsterLevelFromSession(
    game: Pick<LiveGameSession, 'adventureMonsterLevel' | 'settings'> | null | undefined,
): number | undefined {
    if (!game) return undefined;
    const top = game.adventureMonsterLevel;
    if (typeof top === 'number' && Number.isFinite(top) && top >= 1) {
        return Math.max(1, Math.min(50, Math.floor(top)));
    }
    const settingsLv = (game.settings as { adventureMonsterLevel?: unknown } | undefined)?.adventureMonsterLevel;
    if (typeof settingsLv === 'number' && Number.isFinite(settingsLv) && settingsLv >= 1) {
        return Math.max(1, Math.min(50, Math.floor(settingsLv)));
    }
    return undefined;
}

/** 탐험 몬스터 레벨 → Kata `/move.level` (코드 기획표 권위) */
export function adventureKataLevelForMonsterLevel(monsterLevel: number): number {
    return adventureMonsterLevelToKataServerLevel(monsterLevel);
}

/**
 * 탐험: 몬스터 레벨 기준 KATA를 매 턴·CONFIRM 시 settings에 복원한다.
 * 런타임 KV에 예전 기본표 전체가 저장돼 있으면 merge 스냅샷이 코드 기획표를 덮어쓸 수 있다.
 */
export function refreshAdventureKataServerLevelOnSession(
    game: Pick<LiveGameSession, 'adventureMonsterLevel' | 'settings'> | null | undefined,
): number | undefined {
    if (!game || resolveArenaSessionPolicy(game as LiveGameSession).kind !== 'adventure') {
        return undefined;
    }
    const lv = resolveAdventureMonsterLevelFromSession(game);
    if (lv === undefined) return undefined;
    const kataLevel = adventureMonsterLevelToKataServerLevel(lv);
    if (game.settings && typeof game.settings === 'object') {
        (game.settings as { kataServerLevel?: number }).kataServerLevel = kataLevel;
        (game.settings as { adventureMonsterLevel?: number }).adventureMonsterLevel = lv;
    }
    (game as { adventureMonsterLevel?: number }).adventureMonsterLevel = lv;
    return kataLevel;
}
