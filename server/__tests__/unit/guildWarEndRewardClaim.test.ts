import { describe, expect, it } from 'vitest';
import {
    isGuildWarEndRewardClaimable,
    isGuildWarEndRewardClaimed,
} from '../../../shared/utils/guildWarEndRewardClaim.js';

const WAR_A = 'war-a';
const WAR_B = 'war-b';
const USER = 'user-1';

describe('guild war end reward claim (once per war)', () => {
    it('treats reward as unclaimed until user id is recorded for that war', () => {
        expect(isGuildWarEndRewardClaimed({}, WAR_A, USER)).toBe(false);
        expect(
            isGuildWarEndRewardClaimed({ [WAR_A]: ['other-user'] }, WAR_A, USER),
        ).toBe(false);
        expect(
            isGuildWarEndRewardClaimed({ [WAR_A]: [USER] }, WAR_A, USER),
        ).toBe(true);
    });

    it('does not reset claim state across calendar days for the same war', () => {
        const claimed = { [WAR_A]: [USER] };
        const day1 = Date.parse('2026-08-24T12:00:00+09:00');
        const day2 = Date.parse('2026-08-25T12:00:00+09:00');
        const rewardAvailableAt = Date.parse('2026-08-24T01:00:00+09:00');

        expect(
            isGuildWarEndRewardClaimable({
                warId: WAR_A,
                claimedRewards: claimed,
                userId: USER,
                now: day1,
                rewardAvailableAt,
                participationAttempts: 6,
            }),
        ).toBe(false);
        expect(
            isGuildWarEndRewardClaimable({
                warId: WAR_A,
                claimedRewards: claimed,
                userId: USER,
                now: day2,
                rewardAvailableAt,
                participationAttempts: 6,
            }),
        ).toBe(false);
    });

    it('allows claim again only after a new war id completes', () => {
        const claimed = { [WAR_A]: [USER] };
        const rewardAvailableAt = Date.parse('2026-08-24T01:00:00+09:00');
        const now = Date.parse('2026-08-26T12:00:00+09:00');

        expect(
            isGuildWarEndRewardClaimable({
                warId: WAR_A,
                claimedRewards: claimed,
                userId: USER,
                now,
                rewardAvailableAt,
                participationAttempts: 6,
            }),
        ).toBe(false);
        expect(
            isGuildWarEndRewardClaimable({
                warId: WAR_B,
                claimedRewards: claimed,
                userId: USER,
                now,
                rewardAvailableAt,
                participationAttempts: 6,
            }),
        ).toBe(true);
    });

    it('blocks claim before rewardAvailableAt and without participation', () => {
        const rewardAvailableAt = Date.parse('2026-08-24T01:00:00+09:00');

        expect(
            isGuildWarEndRewardClaimable({
                warId: WAR_A,
                claimedRewards: {},
                userId: USER,
                now: rewardAvailableAt - 1,
                rewardAvailableAt,
                participationAttempts: 6,
            }),
        ).toBe(false);
        expect(
            isGuildWarEndRewardClaimable({
                warId: WAR_A,
                claimedRewards: {},
                userId: USER,
                now: rewardAvailableAt,
                rewardAvailableAt,
                participationAttempts: 0,
            }),
        ).toBe(false);
        expect(
            isGuildWarEndRewardClaimable({
                warId: WAR_A,
                claimedRewards: {},
                userId: USER,
                now: rewardAvailableAt,
                rewardAvailableAt,
                participationAttempts: 1,
            }),
        ).toBe(true);
    });
});
