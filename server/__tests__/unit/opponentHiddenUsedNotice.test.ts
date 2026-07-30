import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { getRankedGameSettings } from '../../../shared/constants/rankedGameSettings.js';
import {
    OPPONENT_HIDDEN_USED_FOUL_KIND,
    OPPONENT_HIDDEN_USED_NOTICE_KO,
} from '../../../shared/constants/opponentHiddenUsedNotice.js';
import { setOpponentHiddenUsedNotice } from '../../modes/opponentHiddenUsedNotice.js';

describe('ranked Hidden settings', () => {
    it('uses hidden 1 / scan 1', () => {
        const settings = getRankedGameSettings(GameMode.Hidden);
        expect(settings.hiddenStoneCount).toBe(1);
        expect(settings.scanCount).toBe(1);
    });
});

describe('setOpponentHiddenUsedNotice', () => {
    it('sets foulInfo with kind and no coordinates', () => {
        const game = { foulInfo: null } as LiveGameSession;
        const now = 1_000_000;
        setOpponentHiddenUsedNotice(game, now);
        expect(game.foulInfo?.kind).toBe(OPPONENT_HIDDEN_USED_FOUL_KIND);
        expect(game.foulInfo?.message).toBe(OPPONENT_HIDDEN_USED_NOTICE_KO);
        expect(game.foulInfo?.message).not.toMatch(/\d+\s*,\s*\d+/);
        expect(game.foulInfo?.expiry).toBeGreaterThan(now);
    });
});
