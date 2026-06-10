import { describe, expect, it } from 'vitest';
import {
    isMailRewardsClaimExpired,
    isMailRewardSettledForDeletion,
} from '../../../shared/utils/mailRewardsExpiry.js';

describe('mailRewardsExpiry', () => {
    const now = 1_000_000;

    it('detects expired claim window', () => {
        expect(isMailRewardsClaimExpired({ expiresAt: now - 1 }, now)).toBe(true);
        expect(isMailRewardsClaimExpired({ expiresAt: now + 1 }, now)).toBe(false);
    });

    it('treats claimed and expired attachment mails as settled for deletion', () => {
        expect(
            isMailRewardSettledForDeletion(
                { attachments: { gold: 100 }, attachmentsClaimed: true },
                now,
            ),
        ).toBe(true);
        expect(
            isMailRewardSettledForDeletion(
                { attachments: { gold: 100 }, attachmentsClaimed: false, expiresAt: now - 1 },
                now,
            ),
        ).toBe(true);
        expect(
            isMailRewardSettledForDeletion(
                { attachments: { gold: 100 }, attachmentsClaimed: false, expiresAt: now + 1 },
                now,
            ),
        ).toBe(false);
        expect(isMailRewardSettledForDeletion({ attachments: undefined }, now)).toBe(false);
    });
});
