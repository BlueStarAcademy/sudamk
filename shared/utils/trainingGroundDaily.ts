import type { User } from '../types/entities.js';
import {
    type TrainingGroundDailyTrackRecord,
    type TrainingGroundTrack,
    type TrainingGroundUserState,
} from '../constants/trainingGround.js';
import { getTodayKSTDateString } from './timeUtils.js';

const EMPTY_TRACK = (dayKST: string): TrainingGroundDailyTrackRecord => ({
    dayKST,
    rewardsClaimed: 0,
    adRestored: false,
});

function coerceClaimed(raw: unknown): 0 | 1 | 2 {
    const n = Math.round(Number(raw) || 0);
    if (n >= 2) return 2;
    if (n >= 1) return 1;
    return 0;
}

function normalizeTrack(
    raw: TrainingGroundDailyTrackRecord | undefined,
    today: string,
): TrainingGroundDailyTrackRecord {
    if (!raw || raw.dayKST !== today) return EMPTY_TRACK(today);
    return {
        dayKST: today,
        rewardsClaimed: coerceClaimed(raw.rewardsClaimed),
        adRestored: Boolean(raw.adRestored),
    };
}

export function resolveTrainingGroundState(user: Pick<User, 'trainingGround'>, now: number = Date.now()): TrainingGroundUserState {
    const today = getTodayKSTDateString(now);
    const stored = user.trainingGround;
    return {
        kata: normalizeTrack(stored?.kata, today),
        pet: normalizeTrack(stored?.pet, today),
        kataClearedLevels: Array.isArray(stored?.kataClearedLevels)
            ? stored!.kataClearedLevels!.filter((n) => Number.isFinite(n))
            : [],
        petClearedLevels: Array.isArray(stored?.petClearedLevels)
            ? stored!.petClearedLevels!.filter((n) => Number.isFinite(n))
            : [],
    };
}

export function trainingGroundRemaining(record: TrainingGroundDailyTrackRecord): 0 | 1 {
    if (record.rewardsClaimed === 0) return 1;
    if (record.adRestored && record.rewardsClaimed === 1) return 1;
    return 0;
}

export function getTrainingGroundTrackState(
    user: Pick<User, 'trainingGround'>,
    track: TrainingGroundTrack,
    now: number = Date.now(),
): {
    remaining: 0 | 1;
    max: 1;
    rewardsClaimed: 0 | 1 | 2;
    adRestored: boolean;
    canWatchAd: boolean;
    record: TrainingGroundDailyTrackRecord;
} {
    const state = resolveTrainingGroundState(user, now);
    const record = state[track];
    const remaining = trainingGroundRemaining(record);
    return {
        remaining,
        max: 1,
        rewardsClaimed: record.rewardsClaimed,
        adRestored: record.adRestored,
        canWatchAd: remaining === 0 && !record.adRestored,
        record,
    };
}

export function writeTrainingGroundState(user: User, next: TrainingGroundUserState): void {
    user.trainingGround = next;
}

export function claimTrainingGroundWin(
    user: User,
    track: TrainingGroundTrack,
    kataLevel: number,
    now: number = Date.now(),
): { ok: true; remaining: 0 | 1 } | { ok: false; error: string } {
    const state = resolveTrainingGroundState(user, now);
    const record = state[track];
    if (trainingGroundRemaining(record) < 1) {
        return { ok: false, error: 'TRAINING_GROUND_NO_TICKET' };
    }
    const claimed = (record.rewardsClaimed + 1) as 1 | 2;
    const nextRecord: TrainingGroundDailyTrackRecord = {
        ...record,
        rewardsClaimed: claimed,
    };
    const clearedKey = track === 'kata' ? 'kataClearedLevels' : 'petClearedLevels';
    const cleared = new Set(state[clearedKey] ?? []);
    cleared.add(kataLevel);
    writeTrainingGroundState(user, {
        ...state,
        [track]: nextRecord,
        [clearedKey]: [...cleared],
    });
    return { ok: true, remaining: trainingGroundRemaining(nextRecord) };
}

export function grantTrainingGroundAdRestore(
    user: User,
    track: TrainingGroundTrack,
    now: number = Date.now(),
): { ok: true; remaining: 1 } | { ok: false; error: string } {
    const view = getTrainingGroundTrackState(user, track, now);
    if (!view.canWatchAd) {
        return { ok: false, error: 'TRAINING_GROUND_AD_UNAVAILABLE' };
    }
    const state = resolveTrainingGroundState(user, now);
    const nextRecord: TrainingGroundDailyTrackRecord = {
        ...state[track],
        adRestored: true,
    };
    writeTrainingGroundState(user, {
        ...state,
        [track]: nextRecord,
    });
    return { ok: true, remaining: 1 };
}
