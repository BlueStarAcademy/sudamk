import { describe, expect, it } from 'vitest';
import {
    isPveTutorialKindDismissed,
    pveTutorialGuideId,
} from '../../../shared/constants/pveTutorials.js';

describe('isPveTutorialKindDismissed', () => {
    it('is false when guides are empty', () => {
        expect(isPveTutorialKindDismissed('sp_capture_basics', undefined)).toBe(false);
        expect(isPveTutorialKindDismissed('sp_capture_basics', [])).toBe(false);
    });

    it('is true only for the matching tutorial guide id', () => {
        const guide = pveTutorialGuideId('sp_capture_basics');
        expect(isPveTutorialKindDismissed('sp_capture_basics', [guide])).toBe(true);
        expect(isPveTutorialKindDismissed('sp_survival', [guide])).toBe(false);
        expect(isPveTutorialKindDismissed('sp_missile', ['sp_tutorial_missile'])).toBe(true);
    });

    it('does not reopen the same kind after dismiss (stage progression)', () => {
        const seen = [pveTutorialGuideId('sp_speed')];
        expect(isPveTutorialKindDismissed('sp_speed', seen)).toBe(true);
        expect(isPveTutorialKindDismissed('sp_auto_scoring', seen)).toBe(false);
    });
});
