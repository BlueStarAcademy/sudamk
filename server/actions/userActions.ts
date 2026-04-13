import * as db from '../db.js';
// FIX: Import the full namespace to access enums like CoreStat.
import * as types from '../../types/index.js';
import {
    AVATAR_POOL,
    BORDER_POOL,
    SPECIAL_GAME_MODES,
    NICKNAME_MAX_LENGTH,
    NICKNAME_MIN_LENGTH,
    DEFAULT_GAME_SETTINGS,
} from '../../constants';
import { getAdventureMonsterAttackActionPointCost } from '../../constants/adventureMonstersCodex.js';
import { containsProfanity } from '../../profanity.js';
import {
    nicknameContainsReservedStaffTerms,
    RESERVED_STAFF_NICKNAME_USER_MESSAGE,
} from '../../shared/utils/staffNicknameDisplay.js';
import {
    adventureMonsterLevelToKataProfileStep,
    KATA_SERVER_LEVEL_BY_PROFILE_STEP,
} from '../../shared/utils/strategicAiDifficulty.js';
import type { AdventureMonsterBattleModeKey } from '../../shared/utils/adventureBattleBoard.js';
import {
    applyAdventureStrategicGameSettings,
    getAdventureAllowedBattleModes,
    resolveAdventureBoardSize,
} from '../../shared/utils/adventureBattleBoard.js';
import { GameMode, UserStatus } from '../../types/enums.js';
import { broadcast } from '../socket.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';
import { generateSgfFromGame } from '../../utils/sgfGenerator.js';
import { isStrategicPvpForGameRecord, isGameStatusSaveableForRecord, isShortGameStrategicNoContest } from '../../utils/strategicPvpGameRecord.js';
import { randomUUID } from 'crypto';
import * as effectService from '../effectService.js';
import {
    adventureBattleModeToGameMode,
    getAdventureStageById,
    getAdventureStageLevelRange,
    type AdventureMonsterBattleMode,
} from '../../constants/adventureConstants.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../aiPlayer.js';
import {
    assertValidAdventureMonsterRef,
    applyAdventureMonsterDefeatToProfile,
    parseAdventureMonsterLevel,
} from '../utils/adventureMonsterDefeat.js';
import { getRegionalHiddenScanBonus, getRegionalMissileBonus } from '../../utils/adventureRegionalSpecialtyBuff.js';
import { changeAdventureRegionalSpecialtyBuffs } from '../utils/adventureRegionalBuffReroll.js';

type HandleActionResult = {
    clientResponse?: any;
    error?: string;
};

export const handleUserAction = async (volatileState: types.VolatileState, action: types.ServerAction & { userId: string }, user: types.User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch (type) {
        case 'UPDATE_AVATAR': {
            const { avatarId } = payload;
            if (AVATAR_POOL.some(a => a.id === avatarId)) {
                user.avatarId = avatarId;
            } else {
                return { error: 'Invalid avatar ID.' };
            }
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'UPDATE_AVATAR');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after UPDATE_AVATAR:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['avatarId']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'UPDATE_BORDER': {
            const { borderId } = payload;
            if (BORDER_POOL.some(b => b.id === borderId)) {
                user.borderId = borderId;
            } else {
                return { error: 'Invalid border ID.' };
            }
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'UPDATE_BORDER');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after UPDATE_BORDER:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['borderId']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'RECORD_ADVENTURE_MONSTER_DEFEAT': {
            const { codexId, stageId, battleMode } = payload as {
                codexId?: string;
                stageId?: string;
                battleMode?: string;
            };
            const refErr = assertValidAdventureMonsterRef({ codexId, stageId, battleMode });
            if (refErr) {
                return { error: refErr };
            }
            applyAdventureMonsterDefeatToProfile(user, { codexId: codexId!, stageId: stageId!, battleMode: battleMode! });

            const updatedUser = getSelectiveUserUpdate(user, 'RECORD_ADVENTURE_MONSTER_DEFEAT');

            db.updateUser(user).catch((err) => {
                console.error(`[UserAction] Failed to save user ${user.id} after RECORD_ADVENTURE_MONSTER_DEFEAT:`, err);
            });

            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['adventureProfile', 'actionPoints', 'lastActionPointUpdate']);

            return { clientResponse: { updatedUser } };
        }
        case 'START_ADVENTURE_MONSTER_BATTLE': {
            let adventureApDeducted = false;
            let adventureApCostPaid = 0;
            try {
                const { codexId, stageId, battleMode, monsterLevel: rawLevel, mapMonsterId: rawMapId } = payload as {
                    codexId?: string;
                    stageId?: string;
                    battleMode?: string;
                    monsterLevel?: number;
                    mapMonsterId?: string;
                };
                const refErr = assertValidAdventureMonsterRef({ codexId, stageId, battleMode });
                if (refErr) {
                    return { error: refErr };
                }
                const monsterLevel = parseAdventureMonsterLevel(rawLevel);
                if (monsterLevel == null) {
                    return { error: '잘못된 몬스터 레벨입니다.' };
                }
                const mapMonsterId =
                    typeof rawMapId === 'string' && rawMapId.length > 0 ? rawMapId : `${user.id}:${randomUUID()}`;
                const advStage = getAdventureStageById(stageId!);
                const { min: chapterLevelMin, max: chapterLevelMax } = getAdventureStageLevelRange(
                    advStage?.stageIndex ?? 1,
                );
                const boardSize = resolveAdventureBoardSize(stageId!, codexId!, mapMonsterId, {
                    monsterLevel,
                    chapterLevelMin,
                    chapterLevelMax,
                });
                const allowedModes = getAdventureAllowedBattleModes(boardSize);
                if (!allowedModes.includes(battleMode as AdventureMonsterBattleModeKey)) {
                    return { error: '이 판 크기에서는 선택한 룰로 대결할 수 없습니다.' };
                }

                const mode = adventureBattleModeToGameMode(battleMode as AdventureMonsterBattleMode);
                const cost = getAdventureMonsterAttackActionPointCost(advStage?.stageIndex ?? 1, codexId!);
                if (user.actionPoints.current < cost && !user.isAdmin) {
                    return { error: `액션 포인트가 부족합니다. (필요: ${cost})` };
                }
                if (!user.isAdmin) {
                    user.actionPoints.current -= cost;
                    user.lastActionPointUpdate = Date.now();
                    adventureApDeducted = true;
                    adventureApCostPaid = cost;
                }

                const settings = { ...DEFAULT_GAME_SETTINGS };
                const lv = monsterLevel;
                const kataStep = adventureMonsterLevelToKataProfileStep(lv);
                settings.kataServerLevel = KATA_SERVER_LEVEL_BY_PROFILE_STEP[kataStep];
                settings.goAiBotLevel = kataStep;
                applyAdventureStrategicGameSettings(settings, boardSize, mode);
                const scanExtra = getRegionalHiddenScanBonus(user.adventureProfile, stageId!);
                if (mode === GameMode.Hidden && scanExtra > 0) {
                    settings.scanCount = (settings.scanCount ?? 0) + scanExtra;
                }
                const missileExtra = getRegionalMissileBonus(user.adventureProfile, stageId!);
                if (mode === GameMode.Missile && missileExtra > 0) {
                    settings.missileCount = (settings.missileCount ?? 0) + missileExtra;
                }

                const negotiation: types.Negotiation = {
                    id: `neg-adv-${randomUUID()}`,
                    challenger: user,
                    opponent: getAiUser(mode),
                    mode,
                    settings,
                    proposerId: user.id,
                    status: 'pending',
                    deadline: 0,
                    isRanked: false,
                    adventureBattle: {
                        stageId: stageId!,
                        codexId: codexId!,
                        level: lv,
                        battleMode: battleMode!,
                        boardSize,
                    },
                };

                const game = await initializeGame(negotiation);
                await db.saveGame(game);

                volatileState.userStatuses[game.player1.id] = {
                    status: UserStatus.InGame,
                    mode: game.mode,
                    gameId: game.id,
                };
                volatileState.userStatuses[game.player2.id] = {
                    status: UserStatus.InGame,
                    mode: game.mode,
                    gameId: game.id,
                };

                db.updateUser(user).catch((err) => {
                    console.error(`[UserAction] Failed to save user ${user.id} after START_ADVENTURE_MONSTER_BATTLE:`, err);
                });

                const { broadcastToGameParticipants, broadcastUserUpdate } = await import('../socket.js');
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                broadcastUserUpdate(user, ['actionPoints']);
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                broadcast({
                    type: 'NEGOTIATION_UPDATE',
                    payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses },
                });

                return {
                    clientResponse: {
                        gameId: game.id,
                        game,
                    },
                };
            } catch (err: any) {
                const { codexId, stageId, battleMode, monsterLevel: rawLevel, mapMonsterId: errMapId } = (payload || {}) as {
                    codexId?: string;
                    stageId?: string;
                    battleMode?: string;
                    monsterLevel?: number;
                    mapMonsterId?: string;
                };
                if (adventureApDeducted && !user.isAdmin && adventureApCostPaid > 0) {
                    user.actionPoints.current += adventureApCostPaid;
                    user.lastActionPointUpdate = Date.now();
                }
                console.error('[START_ADVENTURE_MONSTER_BATTLE] Error:', err?.message || err, err?.stack, {
                    codexId,
                    stageId,
                    battleMode,
                    rawLevel,
                    mapMonsterId: errMapId,
                });
                return { error: err?.message || '모험 대전 생성 중 오류가 발생했습니다.' };
            }
        }
        case 'REROLL_ADVENTURE_REGIONAL_BUFF': {
            const { stageId, lockedIndices } = (payload || {}) as { stageId?: string; lockedIndices?: number[] };
            if (!stageId || typeof stageId !== 'string') {
                return { error: '스테이지가 필요합니다.' };
            }
            const rollErr = changeAdventureRegionalSpecialtyBuffs(user, stageId, Array.isArray(lockedIndices) ? lockedIndices : []);
            if (rollErr) {
                return { error: rollErr };
            }
            const updatedUser = getSelectiveUserUpdate(user, 'REROLL_ADVENTURE_REGIONAL_BUFF');
            db.updateUser(user).catch((err) => {
                console.error(`[UserAction] Failed to save user ${user.id} after REROLL_ADVENTURE_REGIONAL_BUFF`, err);
            });
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['adventureProfile', 'gold']);
            return { clientResponse: { updatedUser } };
        }
        case 'CHANGE_NICKNAME': {
            const { newNickname } = payload;
            const cost = 150;
            if (user.diamonds < cost && !user.isAdmin) return { error: '다이아가 부족합니다.' };
            if (newNickname.trim().length < NICKNAME_MIN_LENGTH || newNickname.trim().length > NICKNAME_MAX_LENGTH) return { error: `닉네임은 ${NICKNAME_MIN_LENGTH}-${NICKNAME_MAX_LENGTH}자여야 합니다.` };
            if (containsProfanity(newNickname)) return { error: "닉네임에 부적절한 단어가 포함되어 있습니다." };
            const trimmedNick = newNickname.trim();
            if (!user.isAdmin && nicknameContainsReservedStaffTerms(trimmedNick) && !user.staffNicknameDisplayEligibility) {
                return { error: RESERVED_STAFF_NICKNAME_USER_MESSAGE };
            }

            // 닉네임 중복 확인 (DB 쿼리로 최적화)
            const existingUser = await db.getUserByNickname(trimmedNick);
            if (existingUser && existingUser.id !== user.id) {
                return { error: '이미 사용 중인 닉네임입니다.' };
            }

            if (!user.isAdmin) {
                user.diamonds -= cost;
            }
            user.nickname = trimmedNick;
            if (!user.isAdmin) {
                if (!nicknameContainsReservedStaffTerms(trimmedNick)) {
                    user.staffNicknameDisplayEligibility = false;
                }
            }
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'CHANGE_NICKNAME');
            
            // DB 업데이트 시 unique 제약 조건 위반 에러 처리
            try {
                await db.updateUser(user);
            } catch (err: any) {
                // Prisma unique 제약 조건 위반 시 에러 처리
                if (err.code === 'P2002' || err.message?.includes('Unique constraint') || err.message?.includes('UNIQUE constraint')) {
                    console.error(`[UserAction] Nickname conflict detected for ${user.id}:`, err);
                    return { error: '이미 사용 중인 닉네임입니다.' };
                }
                console.error(`[UserAction] Failed to save user ${user.id} after CHANGE_NICKNAME:`, err);
                throw err;
            }
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['nickname', 'diamonds']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'UPDATE_MBTI': {
            const { mbti, isMbtiPublic, isFirstTime } = payload as { mbti: string; isMbtiPublic: boolean; isFirstTime?: boolean };
            if (mbti && (typeof mbti !== 'string' || !/^[IE][NS][TF][JP]$/.test(mbti))) {
                return { error: '유효하지 않은 MBTI 형식입니다.' };
            }
            
            const wasFirstTime = isFirstTime || !user.mbti;
            
            user.mbti = mbti || null;
            user.isMbtiPublic = true; // 무조건 공개
            
            // 첫 설정 시 다이아 100개 보상
            if (wasFirstTime && !user.isAdmin) {
                user.diamonds = (user.diamonds || 0) + 100;
            }
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'UPDATE_MBTI');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after UPDATE_MBTI:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['mbti', 'isMbtiPublic', 'diamonds']);
            
            // 첫 설정 시 다이아 100개 획득 아이템 생성
            const mbtiRewardItem = wasFirstTime ? {
                id: `mbti-reward-${Date.now()}`,
                name: '다이아',
                type: 'consumable' as const,
                grade: 'normal' as const,
                image: '/images/icon/Zem.png',
                quantity: 100,
                createdAt: Date.now(),
                isEquipped: false,
                level: 1,
                stars: 0,
            } : null;
            
            return { 
                clientResponse: { 
                    updatedUser,
                    ...(mbtiRewardItem ? { obtainedItemsBulk: [mbtiRewardItem] } : {})
                } 
            };
        }
        case 'RESET_STAT_POINTS': {
            const cost = 1000;
            const maxDailyResets = 2;
            const currentDay = new Date().toDateString();
            const lastResetDate = user.lastStatResetDate;
            const statResetCountToday = user.statResetCountToday || 0;

            // 골드 부족 확인
            if (user.gold < cost && !user.isAdmin) {
                return { error: `골드가 부족합니다. (필요: ${cost})` };
            }

            // 일일 리셋 횟수 확인
            if (lastResetDate === currentDay && statResetCountToday >= maxDailyResets && !user.isAdmin) {
                return { error: `오늘 능력치 초기화는 최대 ${maxDailyResets}번까지 가능합니다.` };
            }

            // 골드 차감
            if (!user.isAdmin) {
                user.gold -= cost;
            }

            // 리셋 횟수 업데이트
            if (lastResetDate !== currentDay) {
                // 날짜가 바뀌었으면 카운트 리셋
                user.lastStatResetDate = currentDay;
                user.statResetCountToday = 1;
            } else {
                // 같은 날이면 카운트 증가
                user.statResetCountToday = (user.statResetCountToday || 0) + 1;
            }

            // 능력치 포인트 초기화
            for (const key of Object.values(types.CoreStat)) {
                user.spentStatPoints[key] = 0;
            }
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'RESET_STAT_POINTS');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after RESET_STAT_POINTS:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['spentStatPoints', 'gold', 'lastStatResetDate', 'statResetCountToday']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'CONFIRM_STAT_ALLOCATION': {
            const { newStatPoints } = payload as { newStatPoints: Record<types.CoreStat, number> };

            const levelPoints = (user.strategyLevel - 1) * 2 + (user.playfulLevel - 1) * 2;
            const bonusPoints = user.bonusStatPoints || 0;
            const totalAvailablePoints = levelPoints + bonusPoints;

            const totalSpent = Object.values(newStatPoints).reduce((sum, points) => sum + points, 0);

            if (totalSpent > totalAvailablePoints) {
                return { error: '사용 가능한 포인트를 초과했습니다.' };
            }

            // 기존에 사용한 포인트는 유지하고, 현재 사용 가능한 보너스 포인트만 분배 가능하도록 검증
            const existingSpentPoints = user.spentStatPoints || {};
            const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, points) => sum + points, 0);
            
            // 현재 사용 가능한 포인트 계산 (전체 사용 가능 포인트 - 기존 분배 포인트)
            const availablePoints = totalAvailablePoints - existingTotalSpent;
            
            // 새로운 분배에서 기존 분배를 뺀 값이 사용 가능한 포인트를 초과하지 않는지 확인
            const newSpent = totalSpent;
            const additionalSpent = newSpent - existingTotalSpent;
            
            // 기존 분배 포인트는 고정이므로, 새로운 분배가 기존 분배보다 작을 수 없음
            if (additionalSpent < 0) {
                return { error: '기존에 분배한 포인트는 초기화를 해야만 조절할 수 있습니다.' };
            }
            
            // 추가 분배가 남은 보너스 포인트를 초과하지 않는지 확인
            if (additionalSpent > availablePoints) {
                return { error: `현재 사용 가능한 보너스 포인트(${availablePoints})를 초과하여 분배할 수 없습니다.` };
            }

            user.spentStatPoints = newStatPoints;
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'CONFIRM_STAT_ALLOCATION');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after CONFIRM_STAT_ALLOCATION:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['spentStatPoints']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'UPDATE_REJECTION_SETTINGS': {
            const { rejectedGameModes } = payload as { rejectedGameModes: types.GameMode[] };
            user.rejectedGameModes = rejectedGameModes;

            const allStrategicGameModes = SPECIAL_GAME_MODES.map(m => m.mode);
            const allRejected = allStrategicGameModes.every(mode => rejectedGameModes.includes(mode));

            if (allRejected) {
                if (volatileState.userStatuses[user.id]) {
                    volatileState.userStatuses[user.id].status = UserStatus.Resting;
                }
            }
            await db.updateUser(user);
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'UPDATE_REJECTION_SETTINGS');
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (전체 객체는 WebSocket에서만)
            const fullUserForBroadcast = JSON.parse(JSON.stringify(user));
            broadcast({ type: 'USER_UPDATE', payload: { [user.id]: fullUserForBroadcast } });
            
            return { clientResponse: { updatedUser } };
        }
        case 'SAVE_PRESET': {
            const { preset, index } = payload as { preset: types.EquipmentPreset, index: number };
            if (!user.equipmentPresets) {
                user.equipmentPresets = [];
            }
            user.equipmentPresets[index] = preset;
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'SAVE_PRESET');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after SAVE_PRESET:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['equipmentPresets']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'APPLY_PRESET': {
            const { presetName, equipment } = payload as { presetName: string, equipment?: types.Equipment };
            
            // equipment가 직접 전달된 경우 (빈 프리셋 처리용)
            let presetToApply: types.EquipmentPreset | null = null;
            if (equipment !== undefined) {
                presetToApply = { name: presetName, equipment };
            } else {
                // 기존 방식: 프리셋 이름으로 찾기
                presetToApply = user.equipmentPresets?.find(p => p.name === presetName) || null;
            }

            if (!presetToApply) {
                // 빈 프리셋인 경우 빈 장비 세트로 설정
                user.equipment = {};
            } else {
                user.equipment = { ...presetToApply.equipment };
            }

            // Unequip items that are no longer in the preset
            user.inventory.forEach(item => {
                if (item.type === 'equipment' && item.isEquipped && !Object.values(user.equipment).includes(item.id)) {
                    item.isEquipped = false;
                }
            });

            // Equip items that are in the preset but not currently equipped
            // 데이터 손실 방지를 위해 인벤토리에 없는 장비도 절대 삭제하지 않음
            for (const slot in user.equipment) {
                const itemId = user.equipment[slot as types.EquipmentSlot];
                const itemInInventory = user.inventory.find(item => item.id === itemId);
                if (itemInInventory) {
                    if (!itemInInventory.isEquipped) {
                        itemInInventory.isEquipped = true;
                    }
                } else {
                    // 인벤토리에 없어도 장비는 보존 (데이터 손실 방지)
                    // 이는 인벤토리 동기화 문제나 버그로 인한 데이터 손실을 방지하기 위함
                    console.error(`[APPLY_PRESET] CRITICAL: User ${user.id} has equipment ${itemId} in slot ${slot} but not in inventory! PRESERVING equipment to prevent data loss. DO NOT DELETE.`);
                    // 장비는 그대로 유지하여 나중에 복구 가능하도록 함
                }
            }

            // 장비 일관성 검증 및 수정
            const { validateAndFixEquipmentConsistency } = await import('./inventoryActions.js');
            validateAndFixEquipmentConsistency(user);
            effectService.syncActionPointsStateAfterEquipmentChange(user);

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'APPLY_PRESET');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after APPLY_PRESET:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['equipment', 'inventory', 'actionPoints', 'lastActionPointUpdate']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'SAVE_GAME_RECORD': {
            const { gameId } = payload as { gameId: string };
            
            // 게임 조회
            const game = await db.getLiveGame(gameId);
            if (!game) {
                return { error: '게임을 찾을 수 없습니다.' };
            }
            
            // 전략바둑 PVP만 (일반 로비는 gameCategory가 Normal일 수 있음 — truthy 체크 금지)
            if (!isStrategicPvpForGameRecord(game)) {
                return { error: '전략바둑 PVP 게임만 기보를 저장할 수 있습니다.' };
            }

            if (!isGameStatusSaveableForRecord(game.gameStatus)) {
                return { error: '게임이 아직 종료되지 않았습니다.' };
            }

            if (game.gameStatus === 'no_contest' && isShortGameStrategicNoContest(game)) {
                return { error: '10수 미만 무효 대국은 기보를 저장할 수 없습니다.' };
            }
            
            // 사용자가 게임 참가자인지 확인
            if (game.player1.id !== user.id && game.player2.id !== user.id) {
                return { error: '게임 참가자만 기보를 저장할 수 있습니다.' };
            }
            
            // 기보 개수 확인 (최대 10개)
            if (!user.savedGameRecords) {
                user.savedGameRecords = [];
            }
            
            if (user.savedGameRecords.length >= 10) {
                return { error: '기보는 최대 10개까지 저장할 수 있습니다. 기보 관리에서 예전 기보를 삭제한 뒤 다시 저장해 주세요.' };
            }
            
            // 이미 저장된 기보인지 확인
            const existingRecord = user.savedGameRecords.find(r => r.gameId === gameId);
            if (existingRecord) {
                return { error: '이미 저장된 기보입니다.' };
            }
            
            // 상대방 정보 가져오기
            const opponent = game.player1.id === user.id ? game.player2 : game.player1;
            const opponentUser = await db.getUser(opponent.id);
            if (!opponentUser) {
                return { error: '상대방 정보를 찾을 수 없습니다.' };
            }
            
            // analysisResult 가져오기 (게임 종료 시 저장된 정보 사용)
            // analysisResult는 { [playerId: string]: AnalysisResult } 형식이므로, 
            // 'system' 키로 저장된 전체 게임 분석 결과를 사용
            let analysisResult = null;
            if (game.analysisResult && game.analysisResult['system']) {
                analysisResult = game.analysisResult['system'];
            } else {
                // analysisResult가 없으면 기본 정보로 생성
                // finalizeAnalysisResult에서 계산된 보너스 정보는 게임 객체에서 추출
                analysisResult = {
                    scoreDetails: {
                        black: {
                            territory: 0,
                            captures: game.captures?.[types.Player.Black] ?? 0,
                            deadStones: 0,
                            baseStoneBonus: game.baseStoneCaptures?.[types.Player.Black] ? game.baseStoneCaptures[types.Player.Black] * 5 : 0,
                            hiddenStoneBonus: game.hiddenStoneCaptures?.[types.Player.Black] ? game.hiddenStoneCaptures[types.Player.Black] * 5 : 0,
                            timeBonus: 0, // 시간 보너스는 게임 종료 시점에만 계산 가능
                            itemBonus: 0, // 아이템 보너스는 게임 종료 시점에만 계산 가능
                            total: game.finalScores?.black ?? 0
                        },
                        white: {
                            territory: 0,
                            captures: game.captures?.[types.Player.White] ?? 0,
                            komi: game.finalKomi ?? game.settings.komi ?? 0.5,
                            deadStones: 0,
                            baseStoneBonus: game.baseStoneCaptures?.[types.Player.White] ? game.baseStoneCaptures[types.Player.White] * 5 : 0,
                            hiddenStoneBonus: game.hiddenStoneCaptures?.[types.Player.White] ? game.hiddenStoneCaptures[types.Player.White] * 5 : 0,
                            timeBonus: 0,
                            itemBonus: 0,
                            total: game.finalScores?.white ?? 0
                        }
                    }
                };
            }
            
            // SGF 생성
            const sgfContent = generateSgfFromGame(game, user, opponentUser, analysisResult);
            
            // 저장한 유저의 착색 (목록에서 내 기준 승/패 표시용)
            const playerColor = game.blackPlayerId === user.id ? types.Player.Black : types.Player.White;
            
            // 기보 저장
            const record: types.GameRecord = {
                id: randomUUID(),
                gameId: gameId,
                mode: game.mode,
                myColor: playerColor,
                opponent: {
                    id: opponentUser.id,
                    nickname: opponentUser.nickname
                },
                date: game.createdAt,
                sgfContent: sgfContent,
                gameResult: {
                    winner: game.winner ?? types.Player.None,
                    blackScore: game.finalScores?.black ?? 0,
                    whiteScore: game.finalScores?.white ?? 0,
                    scoreDetails: analysisResult?.scoreDetails
                }
            };
            
            user.savedGameRecords.push(record);
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after SAVE_GAME_RECORD:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['savedGameRecords']);
            
            const updatedUser = getSelectiveUserUpdate(user, 'SAVE_GAME_RECORD');
            return { clientResponse: { success: true, recordId: record.id, updatedUser } };
        }
        case 'DELETE_GAME_RECORD': {
            const { recordId } = payload as { recordId: string };
            
            if (!user.savedGameRecords) {
                return { error: '저장된 기보가 없습니다.' };
            }
            
            const recordIndex = user.savedGameRecords.findIndex(r => r.id === recordId);
            if (recordIndex === -1) {
                return { error: '기보를 찾을 수 없습니다.' };
            }
            
            user.savedGameRecords.splice(recordIndex, 1);
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after DELETE_GAME_RECORD:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['savedGameRecords']);
            
            const updatedUser = getSelectiveUserUpdate(user, 'DELETE_GAME_RECORD');
            return { clientResponse: { success: true, updatedUser } };
        }
        case 'CHANGE_USERNAME': {
            const { newUsername, password } = payload as { newUsername: string; password: string };
            
            if (!newUsername || !password) {
                return { error: '새 아이디와 현재 비밀번호를 입력해주세요.' };
            }
            
            const trimmedUsername = newUsername.trim().toLowerCase();
            if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
                return { error: '아이디는 3-20자여야 합니다.' };
            }
            
            // 현재 비밀번호 확인
            const credentials = await db.getUserCredentialsByUserId(user.id);
            if (!credentials || !credentials.passwordHash) {
                return { error: '비밀번호를 찾을 수 없습니다.' };
            }
            
            const { verifyPassword } = await import('../utils/passwordUtils.js');
            const isValidPassword = await verifyPassword(password, credentials.passwordHash);
            if (!isValidPassword) {
                return { error: '현재 비밀번호가 올바르지 않습니다.' };
            }
            
            // 아이디 중복 확인
            const existingCredentials = await db.getUserCredentials(trimmedUsername);
            if (existingCredentials) {
                return { error: '이미 사용 중인 아이디입니다.' };
            }
            
            // UserCredential의 username 변경
            const { updateUserCredentialUsername } = await import('../prisma/credentialService.js');
            await updateUserCredentialUsername(credentials.username, trimmedUsername);
            
            user.username = trimmedUsername;
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UserAction] Failed to save user ${user.id} after CHANGE_USERNAME:`, err);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['username']);
            
            return { clientResponse: { success: true, message: '아이디가 변경되었습니다.' } };
        }
        case 'CHANGE_PASSWORD': {
            const { currentPassword, newPassword } = payload as { currentPassword: string; newPassword: string };
            
            if (!currentPassword || !newPassword) {
                return { error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' };
            }
            
            if (newPassword.length < 6) {
                return { error: '새 비밀번호는 최소 6자 이상이어야 합니다.' };
            }
            
            // 현재 비밀번호 확인
            const credentials = await db.getUserCredentialsByUserId(user.id);
            if (!credentials || !credentials.passwordHash) {
                return { error: '비밀번호를 찾을 수 없습니다.' };
            }
            
            const { verifyPassword, hashPassword } = await import('../utils/passwordUtils.js');
            const isValidPassword = await verifyPassword(currentPassword, credentials.passwordHash);
            if (!isValidPassword) {
                return { error: '현재 비밀번호가 올바르지 않습니다.' };
            }
            
            // 새 비밀번호 해싱 및 저장
            const newPasswordHash = await hashPassword(newPassword);
            await db.updateUserCredentialPassword(user.id, { passwordHash: newPasswordHash });
            
            return { clientResponse: { success: true, message: '비밀번호가 변경되었습니다.' } };
        }
        case 'WITHDRAW_USER': {
            const { password, confirmText } = payload as { password: string; confirmText: string };
            
            if (!password) {
                return { error: '비밀번호를 입력해주세요.' };
            }
            
            if (confirmText !== '회원탈퇴') {
                return { error: '확인 문구가 올바르지 않습니다.' };
            }
            
            // 비밀번호 확인
            const credentials = await db.getUserCredentialsByUserId(user.id);
            if (!credentials || !credentials.passwordHash) {
                return { error: '비밀번호를 찾을 수 없습니다.' };
            }
            
            const { verifyPassword } = await import('../utils/passwordUtils.js');
            const isValidPassword = await verifyPassword(password, credentials.passwordHash);
            if (!isValidPassword) {
                return { error: '비밀번호가 올바르지 않습니다.' };
            }
            
            // 이메일 가져오기 (User 타입에 email 속성이 없으므로 주석 처리)
            // const userEmail = (user as any).email;
            // if (!userEmail) {
            //     return { error: '이메일 정보를 찾을 수 없습니다.' };
            // }
            
            // 회원탈퇴 처리
            // 1. 이메일을 1주일간 가입 제한 목록에 추가
            const kvRepository = await import('../repositories/kvRepository.js');
            const withdrawnEmails = await kvRepository.getKV<Record<string, number>>('withdrawnEmails') || {};
            withdrawnEmails[userEmail.toLowerCase()] = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7일 후
            await kvRepository.setKV('withdrawnEmails', withdrawnEmails);
            
            // 2. 활성 게임 종료 처리
            const { getAllActiveGames } = await import('../db.js');
            const activeGames = await getAllActiveGames();
            for (const game of activeGames) {
                if (game.player1.id === user.id || game.player2.id === user.id) {
                    if (game.gameStatus === 'playing' || game.gameStatus === 'paused') {
                        // 게임 종료 처리
                        game.gameStatus = 'ended';
                        game.winner = game.player1.id === user.id ? types.Player.White : types.Player.Black;
                        await db.saveGame(game);
                        
                        // 상대방 상태 업데이트
                        const opponentId = game.player1.id === user.id ? game.player2.id : game.player1.id;
                        if (volatileState.userStatuses[opponentId]) {
                            volatileState.userStatuses[opponentId].status = types.UserStatus.Waiting;
                            delete volatileState.userStatuses[opponentId].gameId;
                        }
                        
                        broadcast({ type: 'GAME_UPDATE', payload: { [game.id]: game } });
                    }
                }
            }
            
            // 3. 사용자 삭제
            await db.deleteUser(user.id);
            
            // 4. 연결 및 상태 정리
            delete volatileState.userConnections[user.id];
            delete volatileState.userStatuses[user.id];
            
            // 5. 상태 브로드캐스트
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            
            return { 
                clientResponse: { 
                    success: true, 
                    message: '회원탈퇴가 완료되었습니다.',
                    redirectTo: '#/login'
                } 
            };
        }
        default:
            return { error: 'Unknown user action.' };
    }
};