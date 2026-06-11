import { describe, expect, it } from 'vitest';
import {
    pairPetXpShareFromUserStrategyXpGain,
    userXpGainExcludingStrategyEquipmentBonus,
} from '../../effectService.js';

describe('userXpGainExcludingStrategyEquipmentBonus', () => {
    it('returns unchanged gain when strategy bonus percent is zero', () => {
        expect(userXpGainExcludingStrategyEquipmentBonus(220, 0)).toBe(220);
    });

    it('removes strategy equipment bonus from final user xp gain', () => {
        expect(userXpGainExcludingStrategyEquipmentBonus(110, 10)).toBe(100);
        expect(userXpGainExcludingStrategyEquipmentBonus(220, 10)).toBe(200);
    });
});

describe('pairPetXpShareFromUserStrategyXpGain', () => {
    it('uses half of user xp without strategy equipment bonus', () => {
        expect(pairPetXpShareFromUserStrategyXpGain(110, 10)).toBe(50);
        expect(pairPetXpShareFromUserStrategyXpGain(220, 10)).toBe(100);
    });

    it('uses half of full user xp when no strategy equipment bonus', () => {
        expect(pairPetXpShareFromUserStrategyXpGain(200, 0)).toBe(100);
    });
});
