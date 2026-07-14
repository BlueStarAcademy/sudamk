import { describe, expect, it } from 'vitest';
import {
    skillIdToFxKind,
    skillIdToSpectacle,
    fxKindToSpectacle,
    resolveGuildBossCombatFx,
} from '../../../utils/guildBossBattleFx.js';
import { GuildResearchId } from '../../../types/enums.js';

describe('guildBossBattleFx skill mapping', () => {
    it('maps 물결의 압박 to wave_crash spectacle', () => {
        expect(skillIdToFxKind('청해_물결의압박', 'boss_1')).toBe('wave');
        expect(skillIdToSpectacle('청해_물결의압박')).toBe('wave_crash');
    });

    it('keeps theme for hp_percent skills instead of crush', () => {
        expect(skillIdToFxKind('청해_심해의고요', 'boss_1', { isHpPercent: true })).toBe('wave');
        expect(skillIdToSpectacle('청해_심해의고요')).toBe('wave_crush');
        expect(skillIdToFxKind('홍염_광열의폭발', 'boss_2', { isHpPercent: true })).toBe('burn');
        expect(skillIdToFxKind('백광_심판의빛', 'boss_5', { isHpPercent: true })).toBe('radiance');
        expect(skillIdToFxKind('홍염_화상', 'boss_2', { isHpPercent: true })).toBe('burn');
    });

    it('maps all theme bosses skill families', () => {
        expect(skillIdToSpectacle('녹수_포자확산')).toBe('nature_spores');
        expect(skillIdToSpectacle('현묘_심리전')).toBe('mystery_mind');
        expect(skillIdToSpectacle('백광_천벌의일격')).toBe('radiance_strike');
        expect(fxKindToSpectacle('slash')).toBe('slash_cut');
    });

    it('resolve adds hit-guard secondary for damage reduction research', () => {
        const resolved = resolveGuildBossCombatFx(
            {
                turn: 1,
                message: '[청해]의 물결의 압박! (공격 성공) | 유저 HP -1000',
                isUserAction: false,
                damageTaken: 1000,
                fxKind: 'wave',
                skillId: '청해_물결의압박',
                researchId: GuildResearchId.boss_hit_damage_reduction,
            },
            'boss_1',
        );
        expect(resolved.spectacle).toBe('wave_crash');
        expect(resolved.direction).toBe('to-user');
        expect(resolved.secondaryFxKind).toBe('research_hit_guard');
        expect(resolved.secondarySpectacle).toBe('research_hit_guard');
    });
});
