import { describe, expect, it } from 'vitest';
import {
    KATA_SERVER_LEVEL_BY_PROFILE_STEP,
    normalizeStrategicLobbyKataServerLevelForLobbyAi,
    resolveAiLobbyProfileStepFromSettings,
    syncStrategicLobbyAiSettingsFromKataAuthority,
} from '../../../shared/utils/strategicAiDifficulty.js';

describe('strategic lobby kata mapping', () => {
    it('maps UI step numbers mistaken as kataServerLevel to lobby kata table', () => {
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(1)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[1]);
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(10)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[10]);
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(-31)).toBe(-31);
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(5)).toBe(5);
    });

    it('maps mistaken display levels (Lv.50) to lobby kata instead of clamping to kata 10', () => {
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(50)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[10]);
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(15)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[5]);
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(99)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[5]);
    });

    it('syncs goAiBotLevel from authoritative kataServerLevel', () => {
        const settings: {
            kataServerLevel?: number;
            goAiBotLevel?: number;
            aiDifficulty?: number;
        } = { kataServerLevel: 1, goAiBotLevel: 10, aiDifficulty: 10 };
        syncStrategicLobbyAiSettingsFromKataAuthority(settings);
        expect(settings.kataServerLevel).toBe(-31);
        expect(settings.goAiBotLevel).toBe(1);
        expect(settings.aiDifficulty).toBe(1);
    });

    it('does not treat kata level 1 as profile step 1 in resolveAiLobbyProfileStepFromSettings', () => {
        const step = resolveAiLobbyProfileStepFromSettings({ kataServerLevel: 1 });
        expect(step).toBe(1);
        const synced = { kataServerLevel: 1 as number, goAiBotLevel: 10, aiDifficulty: 10 };
        syncStrategicLobbyAiSettingsFromKataAuthority(synced);
        expect(synced.kataServerLevel).toBe(-31);
        expect(resolveAiLobbyProfileStepFromSettings(synced)).toBe(1);
    });
});
