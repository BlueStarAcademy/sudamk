import { randomUUID } from 'crypto';
import * as db from '../db.js';
import type { ServerAction, User, VolatileState, GameSettings, Negotiation } from '../../types/index.js';
import { GameMode } from '../../types/index.js';
import { DEFAULT_GAME_SETTINGS } from '../../constants';
import { getAiScoringTurnLimitByBoardSize } from '../../constants/gameSettings.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../aiPlayer.js';
import { broadcast, broadcastUserUpdate } from '../socket.js';
import { getCachedUser, updateUserCache } from '../gameCache.js';
import { calculateTotalStats } from '../statService.js';
import { getChampionshipAbilityKataLadder } from '../championshipAbilityKataStore.js';
import { getKataServerRuntimeSnapshot } from '../kataServerRuntimeStore.js';
import { setInGameUserStatusForArena } from './socialActions.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import {
    clampTrainingGroundBoardSize,
    isTrainingGroundKataLevel,
    normalizeTrainingGroundKataLevel,
    type TrainingGroundTrack,
} from '../../shared/constants/trainingGround.js';
import {
    getTrainingGroundTrackState,
    grantTrainingGroundAdRestore,
} from '../../shared/utils/trainingGroundDaily.js';
import {
    isTrainingGroundStageUnlocked,
    trainingGroundPetKataLevel,
    trainingGroundUserKataLevel,
} from '../../shared/utils/trainingGroundProgress.js';

type HandleResult = { clientResponse?: unknown; error?: string };

function asTrack(raw: unknown): TrainingGroundTrack | null {
    return raw === 'kata' || raw === 'pet' ? raw : null;
}

async function persistUser(user: User): Promise<void> {
    await db.updateUser(user);
    updateUserCache(user);
}

export async function handleTrainingGroundAction(
    volatileState: VolatileState,
    action: ServerAction,
    user: User,
): Promise<HandleResult> {
    const now = Date.now();
    switch (action.type) {
        case 'CLAIM_TRAINING_GROUND_AD_RESTORE': {
            const track = asTrack((action.payload as { track?: unknown } | undefined)?.track);
            if (!track) return { error: '잘못된 수련 종류입니다.' };
            const fresh = (await getCachedUser(user.id)) || (await db.getUser(user.id));
            if (!fresh) return { error: '사용자를 찾을 수 없습니다.' };
            const granted = grantTrainingGroundAdRestore(fresh, track, now);
            if (!granted.ok) return { error: '오늘은 이미 광고 회복을 사용했거나, 회복할 횟수가 없습니다.' };
            await persistUser(fresh);
            broadcastUserUpdate(fresh, ['trainingGround']);
            return { clientResponse: { updatedUser: fresh } };
        }
        case 'START_TRAINING_GROUND_GAME': {
            const payload = (action.payload || {}) as {
                track?: unknown;
                kataLevel?: unknown;
                boardSize?: unknown;
            };
            const track = asTrack(payload.track);
            if (!track) return { error: '잘못된 수련 종류입니다.' };
            const kataLevel = normalizeTrainingGroundKataLevel(Number(payload.kataLevel));
            if (!isTrainingGroundKataLevel(kataLevel)) return { error: '존재하지 않는 스테이지입니다.' };
            const boardSize = clampTrainingGroundBoardSize(payload.boardSize);

            const fresh = (await getCachedUser(user.id)) || (await db.getUser(user.id));
            if (!fresh) return { error: '사용자를 찾을 수 없습니다.' };

            const ticket = getTrainingGroundTrackState(fresh, track, now);
            if (ticket.remaining < 1) {
                return { error: '오늘 보상 횟수를 모두 사용했습니다.' };
            }

            if (track === 'kata') {
                const stats = calculateTotalStats(fresh);
                const currentKata = trainingGroundUserKataLevel(stats, getChampionshipAbilityKataLadder());
                if (!isTrainingGroundStageUnlocked(currentKata, kataLevel)) {
                    return { error: '바둑능력이 부족하여 이 스테이지를 해금할 수 없습니다.' };
                }
            } else {
                if (!getEquippedPairPetInventoryRow(fresh)) {
                    return { error: '대표펫을 장착해야 단짝 수련을 할 수 있습니다.' };
                }
                const petLadder = getKataServerRuntimeSnapshot().pairPet.abilityKataLadder;
                const petKata = trainingGroundPetKataLevel(fresh, petLadder);
                if (!isTrainingGroundStageUnlocked(petKata, kataLevel)) {
                    return { error: '대표펫의 바둑능력이 부족하여 이 스테이지를 해금할 수 없습니다.' };
                }
            }

            const settings: GameSettings = {
                ...DEFAULT_GAME_SETTINGS,
                boardSize,
                timeLimit: 0,
                byoyomiTime: 0,
                byoyomiCount: 0,
                timeIncrement: 0,
                scoringTurnLimit: getAiScoringTurnLimitByBoardSize(boardSize),
                kataServerLevel: kataLevel,
                goAiBotLevel: 5,
                useClientSideAi: false,
                trainingGround: { track, kataLevel, boardSize },
            };
            delete (settings as { pairGame?: unknown }).pairGame;

            const negotiation: Negotiation = {
                id: `neg-tg-${randomUUID()}`,
                challenger: fresh,
                opponent: getAiUser(GameMode.Standard),
                mode: GameMode.Standard,
                settings,
                proposerId: fresh.id,
                status: 'pending',
                deadline: 0,
                isRanked: false,
            };

            const game = await initializeGame(negotiation);
            await db.saveGame(game);
            setInGameUserStatusForArena(volatileState, game.player1.id, game);
            setInGameUserStatusForArena(volatileState, game.player2.id, game);
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            broadcast({
                type: 'NEGOTIATION_UPDATE',
                payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses },
            });
            return { clientResponse: { gameId: game.id, game } };
        }
        default:
            return { error: `Unknown training-ground action: ${action.type}` };
    }
}
