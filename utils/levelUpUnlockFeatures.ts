import type { LevelUpCelebrationPayload } from '../types/levelUpModal.js';
import {
    PVP_LOBBIES_MIN_COMBINED_LEVEL,
    QUEST_MIN_STRATEGY_LEVEL,
    TOWER_ADVENTURE_MIN_STRATEGY_LEVEL,
} from '../shared/utils/contentProgressionGates.js';
import { MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES } from '../shared/constants/guildConstants.js';
import { BORDER_POOL } from '../constants/ui.js';
import { getAdventureChapterStrategyUnlockHintsBetweenLevels } from './adventureChapterUnlock.js';

type LevelSnap = { from: number; to: number };

function branchSnap(payload: LevelUpCelebrationPayload, key: 'strategy' | 'playful', currentLevel: number): LevelSnap {
    const b = payload[key];
    if (b) return { from: b.from, to: b.to };
    return { from: currentLevel, to: currentLevel };
}

function crossedLevel(prev: number, next: number, threshold: number): boolean {
    return prev < threshold && next >= threshold;
}

function pushUnique(out: string[], line: string) {
    if (!out.includes(line)) out.push(line);
}

/**
 * 레벨업 직후(모달 표시 시점) 사용자 레벨과 payload.from/to를 사용해,
 * 이번 상승으로 새로 열리는 기능 문구를 모은다.
 */
export function getLevelUpFeatureUnlockLines(
    payload: LevelUpCelebrationPayload,
    user: { strategyLevel?: number; playfulLevel?: number },
): { strategy: string[]; combined: string[] } {
    const curS = Math.max(1, Math.floor(Number(user.strategyLevel) || 1));
    const curP = Math.max(1, Math.floor(Number(user.playfulLevel) || 1));
    const strat = branchSnap(payload, 'strategy', curS);
    const play = branchSnap(payload, 'playful', curP);

    const strategy: string[] = [];
    const combined: string[] = [];

    if (crossedLevel(strat.from, strat.to, QUEST_MIN_STRATEGY_LEVEL)) {
        pushUnique(strategy, `퀵 메뉴 · 퀘스트 이용 (전략 Lv.${QUEST_MIN_STRATEGY_LEVEL} 이상)`);
    }
    if (crossedLevel(strat.from, strat.to, TOWER_ADVENTURE_MIN_STRATEGY_LEVEL)) {
        pushUnique(strategy, `도전의 탑 · 모험 입장 (전략 Lv.${TOWER_ADVENTURE_MIN_STRATEGY_LEVEL} 이상)`);
    }
    for (const line of getAdventureChapterStrategyUnlockHintsBetweenLevels(strat.from, strat.to)) {
        pushUnique(strategy, line);
    }

    const sumFrom = strat.from + play.from;
    const sumTo = strat.to + play.to;
    const crossedSum = (t: number) => sumFrom < t && sumTo >= t;

    if (crossedSum(PVP_LOBBIES_MIN_COMBINED_LEVEL)) {
        pushUnique(
            combined,
            `전략·놀이 PVP 대기실 입장 (통합 레벨 ${PVP_LOBBIES_MIN_COMBINED_LEVEL} 이상, 전략+놀이 레벨 합)`,
        );
    }
    if (crossedSum(MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES)) {
        pushUnique(
            combined,
            `길드 기능 이용 (통합 레벨 ${MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES} 이상, 전략+놀이 레벨 합)`,
        );
    }

    for (const b of BORDER_POOL) {
        const need = b.requiredLevelSum;
        if (typeof need !== 'number' || !Number.isFinite(need)) continue;
        if (crossedSum(need)) {
            pushUnique(combined, `프로필 테두리 「${b.name}」 사용 가능`);
        }
    }

    return { strategy, combined };
}
