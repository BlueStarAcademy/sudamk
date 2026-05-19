import { describe, expect, it } from 'vitest';
import {
    PAIR_EGG_MATERIAL_NAME,
    PAIR_EGG_TEMPLATE_ID,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_TEMPLATE_ID,
    pairEggTemplateIdForHatch,
} from '../../../shared/constants/petLobby.js';

describe('pair egg hatch template resolution', () => {
    it('treats welcome eggs identified by name as welcome template eggs', () => {
        expect(
            pairEggTemplateIdForHatch({
                name: PAIR_WELCOME_EGG_MATERIAL_NAME,
                templateId: undefined,
            }),
        ).toBe(PAIR_WELCOME_EGG_TEMPLATE_ID);
    });

    it('falls back regular mystery eggs without template id to the regular egg template', () => {
        expect(
            pairEggTemplateIdForHatch({
                name: PAIR_EGG_MATERIAL_NAME,
                templateId: undefined,
            }),
        ).toBe(PAIR_EGG_TEMPLATE_ID);
    });
});
