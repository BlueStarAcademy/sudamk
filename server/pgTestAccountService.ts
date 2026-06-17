import type { User } from '../types/index.js';
import { CoreStat, LeagueTier } from '../types/enums.js';
import { createDefaultUser } from './initialData.ts';
import {
    ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID,
    TOWER_ENTRANCE_REQUIRED_STAGE_ID,
} from '../shared/utils/contentProgressionGates.js';
import { MAX_PLAYER_DIAMONDS, MAX_PLAYER_GOLD } from '../shared/constants/numericLimits.js';
import { DIAMOND_PACKAGE_DURATION_DAYS } from '../shared/constants/cashShopPackages.js';
import {
    PG_TEST_EMAIL,
    PG_TEST_LOGIN_USERNAME,
    PG_TEST_NICKNAME,
    PG_TEST_USER_ID,
} from '../shared/constants/pgTestAccount.js';

const PG_TEST_VIP_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function highBaseStats(): Record<CoreStat, number> {
    const value = 150;
    return {
        [CoreStat.Concentration]: value,
        [CoreStat.ThinkingSpeed]: value,
        [CoreStat.Judgment]: value,
        [CoreStat.Calculation]: value,
        [CoreStat.CombatPower]: value,
        [CoreStat.Stability]: value,
    };
}

/** PG 검수 계정에 성장·입장·유료 혜택 제한을 해제한 프로필을 적용한다. */
export function applyPgTestUserProfile(user: User): User {
    const now = Date.now();
    const far = now + PG_TEST_VIP_MS;
    const diamondPackageMs = DIAMOND_PACKAGE_DURATION_DAYS.diamond_package_3 * 24 * 60 * 60 * 1000;

    user.isAdmin = false;
    user.username = PG_TEST_LOGIN_USERNAME;
    user.nickname = PG_TEST_NICKNAME;
    (user as { email?: string | null }).email = PG_TEST_EMAIL;
    user.staffNicknameDisplayEligibility = false;

    user.userLevel = 99;
    user.userXp = 0;
    user.baseStats = highBaseStats();
    user.bonusStatPoints = 500;
    user.statAllocationResetForUserLevelStructureV1 = true;

    user.gold = MAX_PLAYER_GOLD;
    user.diamonds = MAX_PLAYER_DIAMONDS;
    user.actionPoints = { current: 999, max: 999 };
    user.lastActionPointUpdate = now;
    user.actionPointPurchasesToday = 0;
    user.lastActionPointPurchaseDate = 0;
    user.dailyShopPurchases = {};

    user.clearedSinglePlayerStages = [
        TOWER_ENTRANCE_REQUIRED_STAGE_ID,
        ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID,
    ];
    user.singlePlayerProgress = 100;
    user.towerFloor = 100;
    user.monthlyTowerFloor = 100;

    user.rewardVipExpiresAt = far;
    user.functionVipExpiresAt = far;
    user.vvipExpiresAt = far;
    user.removeAdsPurchased = true;
    user.activeDiamondPackageTier = 3;
    user.diamondPackageExpiresAt = now + diamondPackageMs;

    user.inventorySlots = {
        equipment: 100,
        consumable: 100,
        material: 100,
    };
    user.blacksmithLevel = 20;
    user.guildCoins = 999_999;
    user.champCoins = 999_999;
    user.tournamentScore = 10_000;
    user.league = LeagueTier.Master;

    user.chatBanUntil = 0;
    user.connectionBanUntil = 0;
    user.pendingPenaltyNotification = null;

    return user;
}

export function createPgTestUser(): User {
    const user = createDefaultUser(PG_TEST_USER_ID, PG_TEST_LOGIN_USERNAME, PG_TEST_NICKNAME, false);
    return applyPgTestUserProfile(user);
}
