import { randomBytes } from 'node:crypto';
import type { User } from '../../types/index.js';
import type { InventoryItem } from '../../types/index.js';
import { getAdventureStageById } from '../../constants/adventureConstants.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';
import {
    adventureTreasureChestEquipmentImageForStageIndex,
    getAdventureTreasureChestWindowMeta,
} from '../../shared/utils/adventureMapTreasureSchedule.js';
import {
    ADVENTURE_MAP_KEY_CHAPTER_CONFIG,
    adventureTreasureEquipmentBoxName,
    adventureTreasureMaterialBoxName,
    formatKstYmd,
    rollAdventureTreasureChestReward,
    type AdventureMapTreasurePickSession,
    type AdventureTreasureRollResult,
} from '../../shared/utils/adventureMapTreasureRewards.js';
import { fnv1a32 } from '../../shared/utils/adventureMapSchedule.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import { createConsumableItemInstance } from '../summaryService.js';
import { isRewardVipActive } from '../../shared/utils/rewardVip.js';
import { isRecognizedAdminUser } from '../../shared/utils/adminRecognition.js';

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 몬스터 처치 1회마다 호출 — 열쇠 진행·획득(KST 일일·최대 보유) */
export function bumpAdventureMapKeyProgressOnMonsterDefeat(
    user: User,
    stageId: string,
    opts: { isBoss: boolean },
): void {
    const stage = getAdventureStageById(stageId);
    if (!stage) return;
    const chapterIdx = Math.max(1, Math.min(5, Math.floor(stage.stageIndex)));
    const cfg = ADVENTURE_MAP_KEY_CHAPTER_CONFIG[chapterIdx];
    if (!cfg) return;

    const required = Math.max(1, Math.floor(cfg.keyXpRequired));
    const keyXpGain = opts.isBoss ? 2 : 1;

    const now = Date.now();
    const today = formatKstYmd(now);
    const prev = normalizeAdventureProfile(user.adventureProfile);

    const keysHeld = { ...(prev.adventureMapKeysHeldByStageId ?? {}) } as Record<string, number>;
    const killProg = { ...(prev.adventureMapKeyKillProgressByStageId ?? {}) } as Record<string, number>;
    const earnedToday = { ...(prev.adventureMapKeysEarnedTodayByStageId ?? {}) } as Record<string, number>;

    let dateKey = prev.adventureMapKeyEarnedKstDate;
    if (dateKey !== today) {
        for (const k of Object.keys(earnedToday)) delete earnedToday[k];
        dateKey = today;
    }

    let prog = Math.max(0, Math.floor(killProg[stageId] ?? 0));
    prog = Math.min(prog, required - 1);
    prog += keyXpGain;

    while (prog >= required) {
        const heldNow = Math.max(0, Math.floor(keysHeld[stageId] ?? 0));
        const earnedNow = Math.max(0, Math.floor(earnedToday[stageId] ?? 0));
        // 관리자: 보유 열쇠는 항상 1개만 유지 — 이미 1개면 추가 지급·일일 카운트만 막고 진행도는 상한까지만 쌓임
        if (isRecognizedAdminUser(user) && heldNow >= 1) {
            prog = required - 1;
            break;
        }
        if (heldNow < cfg.maxHeld && earnedNow < cfg.dailyEarnCap) {
            keysHeld[stageId] = heldNow + 1;
            earnedToday[stageId] = earnedNow + 1;
            prog -= required;
        } else {
            prog = required - 1;
            break;
        }
    }

    killProg[stageId] = prog;

    if (isRecognizedAdminUser(user)) {
        keysHeld[stageId] = 1;
    }

    user.adventureProfile = {
        ...prev,
        adventureMapKeyEarnedKstDate: dateKey,
        adventureMapKeysHeldByStageId: keysHeld,
        adventureMapKeyKillProgressByStageId: killProg,
        adventureMapKeysEarnedTodayByStageId: earnedToday,
    };
}

const PICK_SESSION_TTL_MS = 15 * 60 * 1000;

export type PrepareAdventureTreasureResult =
    | {
          ok: true;
          rolls: [AdventureTreasureRollResult, AdventureTreasureRollResult, AdventureTreasureRollResult];
          nonce: string;
          pickSlots: 1 | 2;
          equipmentBoxImage: string;
      }
    | { ok: false; error: string };

export type ConfirmAdventureTreasureResult =
    | { ok: true; grantedRolls: AdventureTreasureRollResult[] }
    | { ok: false; error: string };

function buildPickSession(
    stageId: string,
    windowStartMs: number,
    chapterIdx: number,
    userId: string,
    nonce: string,
    pickSlots: 1 | 2,
): AdventureMapTreasurePickSession {
    const rng = mulberry32(fnv1a32(`advTreasurePrep|${userId}|${stageId}|${windowStartMs}|${nonce}`));
    const r0 = rollAdventureTreasureChestReward(chapterIdx, rng);
    const r1 = rollAdventureTreasureChestReward(chapterIdx, rng);
    const r2 = rollAdventureTreasureChestReward(chapterIdx, rng);
    return {
        stageId,
        windowStartMs,
        nonce,
        rolls: [r0, r1, r2],
        pickSlots,
        expiresAtMs: Date.now() + PICK_SESSION_TTL_MS,
    };
}

/** 선택 UI만 닫을 때 — 열쇠 유지, 이번 출현 보물은 더 이상 표시·재도전 불가 */
export function abandonAdventureMapTreasurePick(
    user: User,
    stageId: string,
    nowMs: number = Date.now(),
): { ok: true } | { ok: false; error: string } {
    const stage = getAdventureStageById(stageId);
    if (!stage) return { ok: false, error: '스테이지를 찾을 수 없습니다.' };
    const meta = getAdventureTreasureChestWindowMeta(stageId, nowMs);
    if (!meta) return { ok: false, error: '보물상자가 출현 중이 아닙니다.' };

    const prev = normalizeAdventureProfile(user.adventureProfile);
    const claimed = prev.adventureMapTreasureClaimedWindowStartByStageId?.[stageId];
    if (claimed === meta.windowStartMs) {
        return { ok: false, error: '이번 출현에서 이미 보상을 받았습니다.' };
    }

    const dismissedMap = { ...(prev.adventureMapTreasureDismissedWindowStartByStageId ?? {}) } as Record<string, number>;
    dismissedMap[stageId] = meta.windowStartMs;
    user.adventureProfile = {
        ...prev,
        adventureMapTreasurePickSession: undefined,
        adventureMapTreasureDismissedWindowStartByStageId: dismissedMap,
    };
    return { ok: true };
}

/** 열쇠는 아직 소모하지 않음 — 3개 보상 미리 굴리고 세션 저장 */
export function prepareAdventureMapTreasureChest(user: User, stageId: string, nowMs: number = Date.now()): PrepareAdventureTreasureResult {
    const stage = getAdventureStageById(stageId);
    if (!stage) return { ok: false, error: '스테이지를 찾을 수 없습니다.' };

    let prev = normalizeAdventureProfile(user.adventureProfile);
    const meta = getAdventureTreasureChestWindowMeta(stageId, nowMs);
    const existing = prev.adventureMapTreasurePickSession;

    /** 맵 출현 시간이 끝난 뒤에도, 이미 연 픽 세션(TTL)이 있으면 그대로 반환(선택 모달 유지) */
    if (
        existing &&
        existing.stageId === stageId &&
        existing.expiresAtMs > nowMs &&
        (!meta || existing.windowStartMs === meta.windowStartMs)
    ) {
        const claimedEx = prev.adventureMapTreasureClaimedWindowStartByStageId?.[stageId];
        if (claimedEx === existing.windowStartMs) {
            return { ok: false, error: '이번 출현에서 이미 보물을 수령했습니다.' };
        }
        const dismissedEx = prev.adventureMapTreasureDismissedWindowStartByStageId?.[stageId];
        if (dismissedEx === existing.windowStartMs) {
            return { ok: false, error: '이번 출현에서 보물상자를 건너뛰었습니다.' };
        }
        return {
            ok: true,
            rolls: existing.rolls,
            nonce: existing.nonce,
            pickSlots: existing.pickSlots,
            equipmentBoxImage: adventureTreasureChestEquipmentImageForStageIndex(stage.stageIndex),
        };
    }

    if (!meta) return { ok: false, error: '보물상자가 출현 중이 아닙니다.' };

    const claimed = prev.adventureMapTreasureClaimedWindowStartByStageId?.[stageId];
    if (claimed === meta.windowStartMs) {
        return { ok: false, error: '이번 출현에서 이미 보물을 수령했습니다.' };
    }

    const dismissed = prev.adventureMapTreasureDismissedWindowStartByStageId?.[stageId];
    if (dismissed === meta.windowStartMs) {
        return { ok: false, error: '이번 출현에서 보물상자를 건너뛰었습니다.' };
    }

    if (isRecognizedAdminUser(user)) {
        const keysHeld = { ...(prev.adventureMapKeysHeldByStageId ?? {}) } as Record<string, number>;
        keysHeld[stageId] = 1;
        prev = { ...prev, adventureMapKeysHeldByStageId: keysHeld };
        user.adventureProfile = prev;
    }

    const held = Math.max(0, Math.floor(prev.adventureMapKeysHeldByStageId?.[stageId] ?? 0));
    if (held < 1) return { ok: false, error: '열쇠가 부족합니다.' };

    const chapterIdx = Math.max(1, Math.min(5, Math.floor(stage.stageIndex)));
    const nonce = randomBytes(12).toString('hex');
    const pickSlots: 1 | 2 = isRewardVipActive(user, nowMs) ? 2 : 1;
    const session = buildPickSession(stageId, meta.windowStartMs, chapterIdx, user.id, nonce, pickSlots);

    user.adventureProfile = {
        ...prev,
        adventureMapTreasurePickSession: session,
    };

    return {
        ok: true,
        rolls: session.rolls,
        nonce: session.nonce,
        pickSlots: session.pickSlots,
        equipmentBoxImage: adventureTreasureChestEquipmentImageForStageIndex(stage.stageIndex),
    };
}

function collectItemsFromRolls(rolls: AdventureTreasureRollResult[]) {
    const items: InventoryItem[] = [];
    for (const roll of rolls) {
        if (roll.category === 'equipment' || roll.category === 'material') {
            const name =
                roll.category === 'equipment'
                    ? adventureTreasureEquipmentBoxName(roll.boxRoman)
                    : adventureTreasureMaterialBoxName(roll.boxRoman);
            const item = createConsumableItemInstance(name, 1);
            if (!item) return { ok: false as const, error: '보상 아이템을 생성하지 못했습니다.' };
            items.push(item);
        }
    }
    return { ok: true as const, items };
}

/** 선택 확정 — 열쇠 1 소모, 보상 지급, 출현 창 수령 처리 */
export async function confirmAdventureMapTreasureChest(
    user: User,
    stageId: string,
    payload: { nonce: string; selectedSlots: number[] },
): Promise<ConfirmAdventureTreasureResult> {
    const { nonce, selectedSlots } = payload;
    const stage = getAdventureStageById(stageId);
    if (!stage) return { ok: false, error: '스테이지를 찾을 수 없습니다.' };

    const now = Date.now();

    const prev = normalizeAdventureProfile(user.adventureProfile);
    const sess = prev.adventureMapTreasurePickSession;
    if (!sess) return { ok: false, error: '보물상자 선택 세션이 없습니다. 다시 시도해 주세요.' };
    if (sess.expiresAtMs <= now) {
        user.adventureProfile = { ...prev, adventureMapTreasurePickSession: undefined };
        return { ok: false, error: '선택 시간이 만료되었습니다.' };
    }
    if (sess.stageId !== stageId || sess.nonce !== nonce) {
        return { ok: false, error: '보물상자 정보가 일치하지 않습니다.' };
    }
    if (sess.pickSlots !== selectedSlots.length) {
        return { ok: false, error: '선택 개수가 올바르지 않습니다.' };
    }
    const uniq = new Set(selectedSlots);
    if (uniq.size !== selectedSlots.length) return { ok: false, error: '서로 다른 상자를 선택해 주세요.' };
    for (const s of selectedSlots) {
        if (!Number.isInteger(s) || s < 0 || s > 2) return { ok: false, error: '잘못된 선택입니다.' };
    }

    const claimed = prev.adventureMapTreasureClaimedWindowStartByStageId?.[stageId];
    if (claimed === sess.windowStartMs) {
        return { ok: false, error: '이번 출현에서 이미 보물을 수령했습니다.' };
    }
    const dismissedPick = prev.adventureMapTreasureDismissedWindowStartByStageId?.[stageId];
    if (dismissedPick === sess.windowStartMs) {
        return { ok: false, error: '이번 출현에서 보물상자를 건너뛰었습니다.' };
    }

    const held = Math.max(0, Math.floor(prev.adventureMapKeysHeldByStageId?.[stageId] ?? 0));
    const spendBase = isRecognizedAdminUser(user) ? Math.max(1, held) : held;
    if (spendBase < 1) return { ok: false, error: '열쇠가 부족합니다.' };

    const grants = selectedSlots.map((i) => sess.rolls[i]!);
    /** 보물 수령 중 effect 동기화를 하지 않으므로, 회복 상한은 이 시점의 저장 max (절대 올리지 않음) */
    const treasureActionPointsMaxSnapshot =
        user.actionPoints != null ? Math.max(1, Math.floor(user.actionPoints.max)) : null;
    const boxItems = collectItemsFromRolls(grants);
    if (!boxItems.ok) return { ok: false, error: boxItems.error };

    if (!user.inventory) user.inventory = [];
    if (!user.inventorySlots) user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };

    if (boxItems.items.length > 0) {
        const { success, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, boxItems.items);
        if (!success || !updatedInventory) {
            return { ok: false, error: '인벤토리 공간이 부족합니다.' };
        }
        user.inventory = updatedInventory;
    }

    let gold = Math.max(0, Math.floor(user.gold ?? 0));
    for (const roll of grants) {
        if (roll.category === 'gold') gold += roll.gold;
    }
    user.gold = gold;

    const apGainTotal = grants
        .filter((r): r is Extract<AdventureTreasureRollResult, { category: 'actionPoints' }> => r.category === 'actionPoints')
        .reduce((sum, r) => sum + Math.max(0, Math.floor(r.actionPoints)), 0);
    if (apGainTotal > 0) {
        if (!user.actionPoints) {
            user.actionPoints = { current: 0, max: 1 };
        }
        const cap =
            treasureActionPointsMaxSnapshot != null
                ? treasureActionPointsMaxSnapshot
                : Math.max(1, Math.floor(user.actionPoints.max));
        const cur0 = Math.max(0, Math.floor(user.actionPoints.current));
        user.actionPoints.current = Math.min(cap, cur0 + apGainTotal);
    }

    const keysHeld = { ...(prev.adventureMapKeysHeldByStageId ?? {}) };
    const afterSpend = spendBase - 1;
    keysHeld[stageId] = isRecognizedAdminUser(user) ? 1 : afterSpend;
    const claimedMap = { ...(prev.adventureMapTreasureClaimedWindowStartByStageId ?? {}) } as Record<string, number>;
    claimedMap[stageId] = sess.windowStartMs;

    user.adventureProfile = {
        ...prev,
        adventureMapKeysHeldByStageId: keysHeld,
        adventureMapTreasureClaimedWindowStartByStageId: claimedMap,
        adventureMapTreasurePickSession: undefined,
    };

    if (apGainTotal > 0 && user.actionPoints) {
        if (user.actionPoints.current >= user.actionPoints.max) {
            user.lastActionPointUpdate = 0;
        } else {
            const lu = user.lastActionPointUpdate;
            if (lu === 0 || lu === undefined || lu === null || (typeof lu === 'number' && Number.isNaN(lu))) {
                user.lastActionPointUpdate = Date.now();
            }
        }
    }

    return { ok: true, grantedRolls: grants };
}
