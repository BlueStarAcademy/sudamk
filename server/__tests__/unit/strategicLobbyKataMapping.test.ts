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
        // 단독 5는 대기실 10단계 Kata 값으로 유지(표시 Lv 5와 겹침 — 단계는 sync가 복구)
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(5)).toBe(5);
    });

    it('maps mistaken display levels (Lv.50) to lobby kata instead of clamping to kata 10', () => {
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(50)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[10]);
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(15)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[5]);
        expect(normalizeStrategicLobbyKataServerLevelForLobbyAi(99)).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[5]);
    });

    it('prefers goAiBotLevel when display Lv 3/5 was stored as kataServerLevel (step 2/3)', () => {
        const step2: {
            kataServerLevel?: number;
            goAiBotLevel?: number;
            aiDifficulty?: number;
        } = { kataServerLevel: 3, goAiBotLevel: 2, aiDifficulty: 2 };
        syncStrategicLobbyAiSettingsFromKataAuthority(step2);
        expect(step2.kataServerLevel).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[2]);
        expect(step2.goAiBotLevel).toBe(2);

        const step3 = { kataServerLevel: 5, goAiBotLevel: 3, aiDifficulty: 3 };
        syncStrategicLobbyAiSettingsFromKataAuthority(step3);
        expect(step3.kataServerLevel).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[3]);
        expect(step3.goAiBotLevel).toBe(3);
    });

    it('keeps step 9/10 when goAiBotLevel matches legitimate kata 3/5', () => {
        const step9 = { kataServerLevel: 3, goAiBotLevel: 9, aiDifficulty: 9 };
        syncStrategicLobbyAiSettingsFromKataAuthority(step9);
        expect(step9.kataServerLevel).toBe(3);
        expect(step9.goAiBotLevel).toBe(9);

        const step10 = { kataServerLevel: 5, goAiBotLevel: 10, aiDifficulty: 10 };
        syncStrategicLobbyAiSettingsFromKataAuthority(step10);
        expect(step10.kataServerLevel).toBe(5);
        expect(step10.goAiBotLevel).toBe(10);
    });

    it('maps every profile step 1~10 to the fixed lobby kata table', () => {
        for (let step = 1; step <= 10; step++) {
            const settings = {
                goAiBotLevel: step,
                aiDifficulty: step,
                kataServerLevel: 99 as number,
            };
            syncStrategicLobbyAiSettingsFromKataAuthority(settings);
            expect(settings.kataServerLevel).toBe(KATA_SERVER_LEVEL_BY_PROFILE_STEP[step]);
            expect(settings.goAiBotLevel).toBe(step);
            expect(resolveAiLobbyProfileStepFromSettings(settings)).toBe(step);
        }
    });

    it('treats kata step-number leak (1) over stale goAiBotLevel 10', () => {
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
