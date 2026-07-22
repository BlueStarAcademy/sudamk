import { describe, expect, it } from 'vitest';
import type { User } from '../../../types/index.js';
import {
    changeSingleRegionalSlotBuff,
    enhanceSingleRegionalSlotBuff,
    resetSingleRegionalSlotBuff,
} from '../../utils/adventureRegionalBuffReroll.js';

const STAGE = 'neighborhood_hill';

function makeUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u1',
        nickname: 'tester',
        gold: 50,
        diamonds: 0,
        userLevel: 50,
        isAdmin: true,
        adventureProfile: {
            understandingXpByStage: { [STAGE]: 1_000_000 },
            regionalSpecialtyBuffsByStageId: {
                [STAGE]: [{ kind: 'regional_win_gold_10pct', stacks: 1 }],
            },
            regionalBuffEnhancePointsByStageId: { [STAGE]: 3 },
        },
        ...overrides,
    } as User;
}

describe('adventure regional buff enhance/reset', () => {
    it('enhances for free when enhance points remain (no gold spent)', () => {
        const user = makeUser({ gold: 50 });
        const err = enhanceSingleRegionalSlotBuff(user, STAGE, 0);
        expect(err).toBeNull();
        expect(user.gold).toBe(50);
        expect(user.adventureProfile?.regionalSpecialtyBuffsByStageId?.[STAGE]?.[0]?.stacks).toBe(2);
        expect(user.adventureProfile?.regionalBuffEnhancePointsByStageId?.[STAGE]).toBe(2);
    });

    it('refuses enhance without points even if gold is plenty', () => {
        const user = makeUser({
            gold: 10_000,
            adventureProfile: {
                understandingXpByStage: { [STAGE]: 1_000_000 },
                regionalSpecialtyBuffsByStageId: {
                    [STAGE]: [{ kind: 'regional_win_gold_10pct', stacks: 1 }],
                },
                regionalBuffEnhancePointsByStageId: { [STAGE]: 0 },
            },
        } as Partial<User>);
        const err = enhanceSingleRegionalSlotBuff(user, STAGE, 0);
        expect(err).toMatch(/강화 포인트/);
        expect(user.gold).toBe(10_000);
    });

    it('resets enhanced stacks to 1 and refunds points for free', () => {
        const user = makeUser({
            adventureProfile: {
                understandingXpByStage: { [STAGE]: 1_000_000 },
                regionalSpecialtyBuffsByStageId: {
                    [STAGE]: [{ kind: 'regional_win_gold_10pct', stacks: 3 }],
                },
                regionalBuffEnhancePointsByStageId: { [STAGE]: 1 },
            },
        } as Partial<User>);
        const err = resetSingleRegionalSlotBuff(user, STAGE, 0);
        expect(err).toBeNull();
        expect(user.adventureProfile?.regionalSpecialtyBuffsByStageId?.[STAGE]?.[0]?.stacks).toBe(1);
        expect(user.adventureProfile?.regionalSpecialtyBuffsByStageId?.[STAGE]?.[0]?.kind).toBe(
            'regional_win_gold_10pct',
        );
        expect(user.adventureProfile?.regionalBuffEnhancePointsByStageId?.[STAGE]).toBe(3);
    });

    it('change still costs gold and can refund enhance points', () => {
        const user = makeUser({
            gold: 1500,
            adventureProfile: {
                understandingXpByStage: { [STAGE]: 1_000_000 },
                regionalSpecialtyBuffsByStageId: {
                    [STAGE]: [{ kind: 'regional_win_gold_10pct', stacks: 2 }],
                },
                regionalBuffEnhancePointsByStageId: { [STAGE]: 1 },
            },
        } as Partial<User>);
        const err = changeSingleRegionalSlotBuff(user, STAGE, 0);
        expect(err).toBeNull();
        expect(user.gold).toBe(500);
        expect(user.adventureProfile?.regionalSpecialtyBuffsByStageId?.[STAGE]?.[0]?.stacks).toBe(1);
        expect(user.adventureProfile?.regionalBuffEnhancePointsByStageId?.[STAGE]).toBe(2);
    });
});
