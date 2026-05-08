import { describe, expect, it } from 'vitest';
import { CoreStat } from '../../../shared/types/index.js';
import {
    CHAMPIONSHIP_REAL_MATCH_RULES_19,
    championshipBestMoveChancePercent,
    championshipKataLevelFromAbilityScore,
    championshipKataLevelForPly,
    championshipMistakeChancePercent,
} from '../../../shared/constants/championshipRealMatch.js';

const statsFor = (value: number): Record<CoreStat, number> => ({
    [CoreStat.Concentration]: value,
    [CoreStat.ThinkingSpeed]: value,
    [CoreStat.Judgment]: value,
    [CoreStat.Calculation]: value,
    [CoreStat.CombatPower]: value,
    [CoreStat.Stability]: value,
});

describe('championship real match policy', () => {
    it('maps ability score boundaries without level zero', () => {
        const cases: Array<[number, number]> = [
            [219, -30],
            [220, -30],
            [250, -29],
            [1090, -1],
            [1120, 1],
            [1150, 2],
            [1240, 5],
            [1270, 6],
            [1300, 7],
        ];

        for (const [ability, level] of cases) {
            expect(championshipKataLevelFromAbilityScore(ability)).toBe(level);
        }
    });

    it('uses 19-line phase boundaries up to 150 moves', () => {
        expect(championshipKataLevelForPly(1, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('opening');
        expect(championshipKataLevelForPly(50, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('opening');
        expect(championshipKataLevelForPly(51, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('midgame');
        expect(championshipKataLevelForPly(100, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('midgame');
        expect(championshipKataLevelForPly(101, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('endgame');
        expect(championshipKataLevelForPly(150, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('endgame');
    });

    it('applies condition to mistake and best move chances', () => {
        expect(championshipMistakeChancePercent(500, 100)).toBe(15);
        expect(championshipBestMoveChancePercent(1000, 100)).toBe(40);
    });
});
