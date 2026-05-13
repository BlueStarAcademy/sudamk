import type { User } from '../types/index.js';

function ensureAchievements(user: User): void {
    if (!user.quests) return;
    if (!user.quests.achievements) {
        user.quests.achievements = { tracks: {} };
    }
}

export function recordPairPetTrainingClaimForAchievements(user: User): void {
    ensureAchievements(user);
    const ach = user.quests!.achievements!;
    ach.totalPairPetTrainingClaims = (ach.totalPairPetTrainingClaims ?? 0) + 1;
}

export function recordPairPetSoulConvertForAchievements(user: User): void {
    ensureAchievements(user);
    const ach = user.quests!.achievements!;
    ach.totalPairPetSoulConverts = (ach.totalPairPetSoulConverts ?? 0) + 1;
}
