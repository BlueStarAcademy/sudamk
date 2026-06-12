import { describe, expect, it } from 'vitest';
import { CoreStat } from '../../../shared/types/enums.js';
import {
    applyUserProgressionArenaLocks,
    getBadukAbilitySnapshotFromStats,
    PVP_LOBBIES_MIN_COMBINED_LEVEL,
} from '../../../shared/utils/contentProgressionGates.js';
import type { User } from '../../../shared/types/index.js';

const allOpen = {
    singleplayer: true,
    tower: true,
    strategicLobby: true,
    playfulLobby: true,
    pairLobby: true,
    championship: true,
    adventure: true,
};

const zeroStats = {
    [CoreStat.Concentration]: 0,
    [CoreStat.ThinkingSpeed]: 0,
    [CoreStat.Judgment]: 0,
    [CoreStat.Calculation]: 0,
    [CoreStat.CombatPower]: 0,
    [CoreStat.Stability]: 0,
};

describe('content progression gates', () => {
    it('allows level 1 users into PVP and AI arena lobbies', () => {
        const user = {
            id: 'level-1-user',
            userLevel: 1,
            clearedSinglePlayerStages: [],
        } as User;
        const snap = getBadukAbilitySnapshotFromStats(user, zeroStats);

        const gated = applyUserProgressionArenaLocks(allOpen, snap);

        expect(PVP_LOBBIES_MIN_COMBINED_LEVEL).toBe(1);
        expect(gated.strategicLobby).toBe(true);
        expect(gated.playfulLobby).toBe(true);
    });
});
