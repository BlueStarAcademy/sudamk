import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, type GameSettings, Negotiation, GameMode, UserStatus, Player } from '../../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, DEFAULT_GAME_SETTINGS, OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE, getAiScoringTurnLimitByBoardSize } from '../../constants';
import { initializeGame } from '../gameModes.js';
import { aiUserId, getAiUser } from '../aiPlayer.js';
import { broadcast } from '../socket.js';
import { requireArenaEntranceOpen } from '../arenaEntranceService.js';
import { applyPassiveActionPointRegenToUser } from '../effectService.js';
import { maybeDeleteDetachedEndedPvpGame } from '../maybeDeleteDetachedEndedPvpGame.js';
import { clampAiLobbyStrategicItemCaps } from '../../shared/utils/strategicAiLobbyItemCaps.js';
import { isPairClassicGame } from '../../shared/utils/pairGameTurn.js';
import { arenaChannelForGameMode, arenaChannelForGameSession } from '../../shared/utils/arenaChannel.js';
import {
    effectiveAiLobbyApCostForUser,
    effectiveNegotiationApCostForUser,
} from '../../shared/utils/pairPetArenaApDiscount.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

function modeIncludesCaptureRule(mode: GameMode, settings: Pick<GameSettings, 'mixedModes'>): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
}

function normalizeStrategicAiScoringSettings(mode: GameMode, settings: GameSettings): GameSettings {
    if (!SPECIAL_GAME_MODES.some((m) => m.mode === mode)) return settings;
    if (modeIncludesCaptureRule(mode, settings)) {
        const next = { ...settings, scoringTurnLimit: 0 };
        delete (next as any).autoScoringTurns;
        return next;
    }
    return {
        ...settings,
        scoringTurnLimit: getAiScoringTurnLimitByBoardSize(settings.boardSize || DEFAULT_GAME_SETTINGS.boardSize),
    };
}

/** 협상 종료 후 대기실 복귀: 전략/놀이 집계 로비는 waitingLobby로 복원 */
async function restoreUserToWaitingLobby(
    volatileState: VolatileState,
    userId: string,
    gameMode: GameMode
) {
    const st = volatileState.userStatuses[userId];
    if (!st) return;
    const oldGameId = st.gameId;
    st.status = UserStatus.Waiting;
    st.gameId = undefined;
    if (SPECIAL_GAME_MODES.some((m) => m.mode === gameMode)) {
        st.waitingLobby = 'strategic';
        st.arenaChannel = 'strategic';
        delete st.mode;
    } else if (PLAYFUL_GAME_MODES.some((m) => m.mode === gameMode)) {
        st.waitingLobby = 'playful';
        st.arenaChannel = 'playful';
        delete st.mode;
    } else {
        st.mode = gameMode;
        st.arenaChannel = arenaChannelForGameMode(gameMode) ?? undefined;
        delete st.waitingLobby;
    }
    if (oldGameId) {
        await maybeDeleteDetachedEndedPvpGame(volatileState, oldGameId);
    }
}

export const handleNegotiationAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;
    const now = Date.now();

    switch (type) {
        case 'CHALLENGE_USER': {
            const { opponentId, mode, settings } = payload;
            const opponent = opponentId === aiUserId ? getAiUser(mode) : await db.getUser(opponentId);
        
            if (!opponent) return { error: 'Opponent not found.' };
            if (user.id === opponent.id) return { error: 'You cannot challenge yourself.' };

            // For real players, perform status checks
            if (opponentId !== aiUserId) {
                const pairInvolving = Object.values(volatileState.negotiations).filter(
                    (neg) =>
                        (neg.challenger.id === user.id && neg.opponent.id === opponent.id) ||
                        (neg.challenger.id === opponent.id && neg.opponent.id === user.id)
                );

                // 먼저 신청(초안/전송)한 쪽 우선: 늦게 CHALLENGE_USER 한 사람은 새 초안을 만들지 않고 작성 창만 닫음
                const theirDraftToMe = pairInvolving.find(
                    (neg) => neg.status === 'draft' && neg.challenger.id === opponent.id && neg.opponent.id === user.id
                );
                if (theirDraftToMe) {
                    return { clientResponse: { challengeComposerSuperseded: true, supersedeReason: 'opponent_composing_first' } };
                }

                const pendingFromThem = pairInvolving.find(
                    (neg) => neg.status === 'pending' && neg.challenger.id === opponent.id && neg.opponent.id === user.id
                );
                if (pendingFromThem) {
                    return { clientResponse: { challengeComposerSuperseded: true, supersedeReason: 'incoming_challenge' } };
                }

                const myDraftToThem = pairInvolving.find(
                    (neg) => neg.status === 'draft' && neg.challenger.id === user.id && neg.opponent.id === opponent.id
                );
                if (myDraftToThem) {
                    return { clientResponse: { negotiationId: myDraftToThem.id } };
                }

                const pendingFromMe = pairInvolving.find(
                    (neg) => neg.status === 'pending' && neg.challenger.id === user.id && neg.opponent.id === opponent.id
                );
                if (pendingFromMe) {
                    return { clientResponse: { challengeComposerSuperseded: true, supersedeReason: 'already_sent_challenge' } };
                }

                // 다른 상대를 향한 내 초안만 제거 (동일 상대 초안은 위에서 처리)
                for (const id of Object.keys(volatileState.negotiations)) {
                    const neg = volatileState.negotiations[id];
                    if (neg.challenger.id === user.id && neg.status === 'draft' && neg.opponent.id !== opponent.id) {
                        delete volatileState.negotiations[id];
                    }
                }

                let myStatus = volatileState.userStatuses[user.id];
                const opponentStatus = volatileState.userStatuses[opponent.id];

                if (!opponentStatus) {
                    return { error: '상대방이 오프라인 상태입니다.' };
                }
                
                // myStatus가 없거나 waiting/resting이 아니면 대기 상태로 설정
                // (대기실에 입장했지만 상태가 아직 업데이트되지 않은 경우)
                if (!myStatus || (myStatus.status !== UserStatus.Waiting && myStatus.status !== 'resting')) {
                    if (SPECIAL_GAME_MODES.some((m) => m.mode === mode)) {
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: 'strategic' };
                    } else if (PLAYFUL_GAME_MODES.some((m) => m.mode === mode)) {
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: 'playful' };
                    } else {
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode };
                    }
                    myStatus = volatileState.userStatuses[user.id];
                    broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                }
                
                // 'waiting' 또는 'resting' 상태에서 대국 신청 가능
                const canIChallenge = myStatus.status === UserStatus.Waiting || myStatus.status === 'resting';
                if (!canIChallenge) {
                    return { error: '대국 신청은 대기실에서만 가능합니다.' };
                }
                
                const canOpponentBeChallenged = opponentStatus?.status === UserStatus.Waiting || opponentStatus?.status === UserStatus.Online;
                if (!canOpponentBeChallenged) {
                    return { error: '상대방이 대국을 신청받을 수 있는 상태가 아닙니다.' };
                }

                // Check if opponent has rejected this game mode
                if (opponent.rejectedGameModes && opponent.rejectedGameModes.includes(mode)) {
                    return { error: `상대방이 ${mode} 게임 신청을 거부했습니다.` };
                }

                // 이 유저와의 쌍이 아닌, 다른 상대와 진행 중인 pending만 막음 (서로에게 신청한 경우는 위에서 처리)
                const opponentInOtherPending = Object.values(volatileState.negotiations).some((neg) => {
                    if (neg.status !== 'pending') return false;
                    const touchesOpponent = neg.challenger.id === opponent.id || neg.opponent.id === opponent.id;
                    if (!touchesOpponent) return false;
                    const samePair =
                        (neg.challenger.id === user.id && neg.opponent.id === opponent.id) ||
                        (neg.challenger.id === opponent.id && neg.opponent.id === user.id);
                    return !samePair;
                });
                if (opponentInOtherPending) {
                    return { error: '상대방이 대국 협상중입니다.' };
                }

                await applyPassiveActionPointRegenToUser(opponent, now);
                const oppNeed = effectiveNegotiationApCostForUser(opponent, mode);
                if (opponent.actionPoints.current < oppNeed && !opponent.isAdmin) {
                    return { error: OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE };
                }
            }
            
            const cost = effectiveNegotiationApCostForUser(user, mode);
            await applyPassiveActionPointRegenToUser(user, now);
            if (user.actionPoints.current < cost && !user.isAdmin) {
                return { error: `액션 포인트가 부족합니다. (필요: ${cost})` };
            }
        
            const negotiationId = `neg-${randomUUID()}`;
            const mergedSettings = settings ? { ...DEFAULT_GAME_SETTINGS, ...settings } : { ...DEFAULT_GAME_SETTINGS };
            // 1:1 대국 신청에는 페어 방 메타(`pairGame`)가 들어가면 인게임이 페어 UI로 분기할 수 있어 제거한다.
            if (opponentId !== aiUserId) {
                delete (mergedSettings as { pairGame?: unknown }).pairGame;
            }
            const newNegotiation: Negotiation = {
                id: negotiationId,
                challenger: user,
                opponent: opponent,
                mode: mode,
                settings: mergedSettings,
                proposerId: user.id,
                status: 'draft',
                turnCount: 0,
                deadline: now + 60000,
                // 랭킹전은 오직 서버 랭크 매칭(socialActions.tryMatchPlayers)에서만 isRanked: true 로 생성됨. 클라이언트 값은 무시.
                isRanked: false,
            };
        
            volatileState.negotiations[negotiationId] = newNegotiation;
            const priorEndedRoomId = volatileState.userStatuses[user.id]?.gameId;
            volatileState.userStatuses[user.id].status = UserStatus.Negotiating;
            delete volatileState.userStatuses[user.id].gameId;
            if (priorEndedRoomId) {
                await maybeDeleteDetachedEndedPvpGame(volatileState, priorEndedRoomId);
            }
            // Draft negotiation이 생성되었으므로 브로드캐스트 (challenger가 설정을 조정할 수 있도록)
            broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
            return {
                clientResponse: {
                    negotiationId: negotiationId
                }
            };
        }
        case 'SEND_CHALLENGE': {
            const { negotiationId, settings } = payload;
            const negotiation = volatileState.negotiations[negotiationId];
            if (!negotiation || negotiation.challenger.id !== user.id || negotiation.status !== 'draft') {
                return { error: 'Invalid challenge.' };
            }

            const cost = effectiveNegotiationApCostForUser(user, negotiation.mode);
            await applyPassiveActionPointRegenToUser(user, now);
            if (user.actionPoints.current < cost && !user.isAdmin) {
                return { error: `액션 포인트가 부족합니다. (필요: ${cost})` };
            }

            const opponent = negotiation.opponent;
            const isOpponentAlreadyInNegotiation = Object.values(volatileState.negotiations).some(
                neg => neg.id !== negotiationId &&
                       (neg.challenger.id === opponent.id || neg.opponent.id === opponent.id) &&
                       neg.status === 'pending'
            );

            if (isOpponentAlreadyInNegotiation) {
                delete volatileState.negotiations[negotiationId];
                await restoreUserToWaitingLobby(volatileState, user.id, negotiation.mode);
                return { error: '상대방이 대국 협상중입니다.' };
            }

            if (opponent.id !== aiUserId) {
                const freshOpponent = await db.getUser(opponent.id);
                if (!freshOpponent) {
                    delete volatileState.negotiations[negotiationId];
                    await restoreUserToWaitingLobby(volatileState, user.id, negotiation.mode);
                    broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
                    return { error: 'Opponent not found.' };
                }
                await applyPassiveActionPointRegenToUser(freshOpponent, now);
                const oppSendCost = effectiveNegotiationApCostForUser(freshOpponent, negotiation.mode);
                if (freshOpponent.actionPoints.current < oppSendCost && !freshOpponent.isAdmin) {
                    delete volatileState.negotiations[negotiationId];
                    await restoreUserToWaitingLobby(volatileState, user.id, negotiation.mode);
                    broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
                    return { error: OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE };
                }
            }

            negotiation.previousSettings = undefined; // 초기 신청이므로 이전 설정 없음
            // 재대결: draft는 `REQUEST_REMATCH` 시 원본 `pairGame`을 포함하지만, 클라이언트
            // `ChallengeSelectionModal` 설정에는 `pairGame`이 없어 덮어쓰면 페어 국이 1:1 UI로 바뀐다.
            const rematchPairGameSnapshot =
                negotiation.rematchOfGameId && negotiation.settings?.pairGame
                    ? JSON.parse(JSON.stringify(negotiation.settings.pairGame))
                    : undefined;
            // settings를 깊은 복사로 저장하여 전달
            negotiation.settings = JSON.parse(JSON.stringify(settings));
            if (rematchPairGameSnapshot) {
                negotiation.settings = { ...negotiation.settings, pairGame: rematchPairGameSnapshot };
            }
            negotiation.status = 'pending';
            negotiation.proposerId = negotiation.opponent.id;
            negotiation.turnCount = 0; // 초기 신청은 turnCount 0
            // 브로드캐스트 직전에 deadline을 다시 계산하여 정확한 시간 설정
            const broadcastTime = Date.now();
            negotiation.deadline = broadcastTime + 60000;
            
            // 상대방의 상태를 Negotiating으로 업데이트 (대국 신청을 받았으므로)
            if (volatileState.userStatuses[opponent.id]) {
                const opponentPriorGameId = volatileState.userStatuses[opponent.id].gameId;
                volatileState.userStatuses[opponent.id].status = UserStatus.Negotiating;
                delete volatileState.userStatuses[opponent.id].gameId;
                if (opponentPriorGameId) {
                    await maybeDeleteDetachedEndedPvpGame(volatileState, opponentPriorGameId);
                }
            }
            
            // negotiations를 깊은 복사하여 브로드캐스트
            const negotiationsToBroadcast = JSON.parse(JSON.stringify(volatileState.negotiations));
            broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: negotiationsToBroadcast, userStatuses: volatileState.userStatuses } });
            return {};
        }
        case 'UPDATE_NEGOTIATION': {
            const { negotiationId, settings } = payload;
            const negotiation = volatileState.negotiations[negotiationId];
            if (!negotiation || negotiation.proposerId !== user.id || negotiation.status !== 'pending') {
                return { error: 'Cannot update this negotiation now.' };
            }

            negotiation.previousSettings = { ...negotiation.settings }; // 이전 설정 저장
            const rematchPairGameSnapshot =
                negotiation.rematchOfGameId && negotiation.settings?.pairGame
                    ? JSON.parse(JSON.stringify(negotiation.settings.pairGame))
                    : undefined;
            negotiation.settings = settings;
            if (rematchPairGameSnapshot) {
                negotiation.settings = { ...negotiation.settings, pairGame: rematchPairGameSnapshot };
            }
            negotiation.proposerId = negotiation.challenger.id === user.id ? negotiation.opponent.id : negotiation.challenger.id;
            negotiation.turnCount = (negotiation.turnCount || 0) + 1;
            negotiation.deadline = now + 60000;

            if (negotiation.turnCount >= 10) {
                await restoreUserToWaitingLobby(volatileState, negotiation.challenger.id, negotiation.mode);
                await restoreUserToWaitingLobby(volatileState, negotiation.opponent.id, negotiation.mode);
                delete volatileState.negotiations[negotiationId];
                broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
                return { error: 'Negotiation failed after too many turns.' };
            }
            
            broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
            return {};
        }
        case 'ACCEPT_NEGOTIATION': {
            const { negotiationId, settings } = payload;
            const negotiation = volatileState.negotiations[negotiationId];
            if (!negotiation || negotiation.proposerId !== user.id || negotiation.status !== 'pending') {
                return { error: 'Cannot accept this negotiation now.' };
            }
            
            // challenger가 이미 대기실을 나갔는지 확인
            const challengerStatus = volatileState.userStatuses[negotiation.challenger.id];
            if (!challengerStatus || (challengerStatus.status !== UserStatus.Negotiating && challengerStatus.status !== UserStatus.Waiting)) {
                // challenger가 이미 나간 경우 negotiation 삭제 및 opponent 상태 복구
                if (volatileState.userStatuses[negotiation.opponent.id]?.status === UserStatus.Negotiating) {
                    await restoreUserToWaitingLobby(volatileState, negotiation.opponent.id, negotiation.mode);
                }
                delete volatileState.negotiations[negotiationId];
                broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
                return { error: '상대방이 대기실을 나갔습니다. 대국 신청이 취소되었습니다.' };
            }
            
            const challenger = await db.getUser(negotiation.challenger.id);
            const opponent = await db.getUser(negotiation.opponent.id);
            if (!challenger || !opponent) return { error: "One of the players could not be found." };

            const costChallenger = effectiveNegotiationApCostForUser(challenger, negotiation.mode);
            const costOpponent = effectiveNegotiationApCostForUser(opponent, negotiation.mode);
            await applyPassiveActionPointRegenToUser(challenger, now);
            await applyPassiveActionPointRegenToUser(opponent, now);
            if (
                (challenger.actionPoints.current < costChallenger && !challenger.isAdmin) ||
                (opponent.actionPoints.current < costOpponent && !opponent.isAdmin)
            ) {
                await restoreUserToWaitingLobby(volatileState, challenger.id, negotiation.mode);
                await restoreUserToWaitingLobby(volatileState, opponent.id, negotiation.mode);
                delete volatileState.negotiations[negotiationId];
                return { error: 'One of the players does not have enough action points.' };
            }

            if (!challenger.isAdmin) {
                challenger.actionPoints.current -= costChallenger;
                challenger.lastActionPointUpdate = now;
            }
            if (!opponent.isAdmin) {
                opponent.actionPoints.current -= costOpponent;
                opponent.lastActionPointUpdate = now;
            }

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(challenger).catch(err => {
                console.error(`[ACCEPT_NEGOTIATION] Failed to save challenger ${challenger.id}:`, err);
            });
            db.updateUser(opponent).catch(err => {
                console.error(`[ACCEPT_NEGOTIATION] Failed to save opponent ${opponent.id}:`, err);
            });

            // Broadcast updated action points immediately so clients reflect the deduction
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(challenger, ['actionPoints']);
            broadcastUserUpdate(opponent, ['actionPoints']);

            // 수락 시에는 원래 negotiation.settings를 사용 (발신자가 보낸 설정)
            // settings 파라미터는 UPDATE_NEGOTIATION에서만 사용
            let negForInit: Negotiation = negotiation;
            if (isPairClassicGame(negotiation.settings, negotiation.mode)) {
                const { ensureNegotiationPairPetUsers } = await import('../pairNegotiationPairPetUsers.js');
                negForInit = await ensureNegotiationPairPetUsers(negotiation);
            }
            const game = await initializeGame(negForInit);
            if (isPairClassicGame(game.settings, game.mode)) {
                const { configurePairClassicGameStart } = await import('./socialActions.js');
                const ownerId =
                    (negForInit as Negotiation & { pairPetConfigureOwnerId?: string }).pairPetConfigureOwnerId ??
                    negForInit.challenger.id;
                const statUsers =
                    (negForInit as Negotiation & { pairPetStatUsers?: User[] }).pairPetStatUsers ?? [negForInit.challenger];
                const ownerUser = statUsers.find((u) => u.id === ownerId) ?? negForInit.challenger;
                configurePairClassicGameStart(game, ownerUser, statUsers);
            }
            await db.saveGame(game);
            
            volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
            volatileState.userStatuses[game.player2.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
            
            if (negotiation.rematchOfGameId) {
                const originalGame = await db.getLiveGame(negotiation.rematchOfGameId);
                if (originalGame && originalGame.gameStatus === 'rematch_pending') {
                    originalGame.gameStatus = 'ended';
                    await db.saveGame(originalGame);
                }
            }
            
            const playerIdsInGame = new Set([game.player1.id, game.player2.id]);
            for (const negToCancel of Object.values(volatileState.negotiations)) {
                if (negToCancel.id !== negotiationId && (playerIdsInGame.has(negToCancel.challenger.id) || playerIdsInGame.has(negToCancel.opponent.id))) {
                    const challengerId = negToCancel.challenger.id;
                    if (volatileState.userStatuses[challengerId]?.status === UserStatus.Negotiating) {
                        await restoreUserToWaitingLobby(volatileState, challengerId, negToCancel.mode);
                    }
                    delete volatileState.negotiations[negToCancel.id];
                }
            }

            delete volatileState.negotiations[negotiationId];
            
            // 게임 생성 후 게임 정보를 먼저 브로드캐스트 (게임 참가자에게만 전송)
            const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            // PVP 게임이면 진행중인 대국 목록에 표시·관전 가능하도록 전체 브로드캐스트
            if (!game.isAiGame) broadcastLiveGameToList(game);
            // 그 다음 사용자 상태 브로드캐스트
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
            
            return {
                clientResponse: {
                    gameId: game.id
                }
            };
        }
        case 'DECLINE_NEGOTIATION': {
            const { negotiationId } = payload;
            const negotiation = volatileState.negotiations[negotiationId];
            if (!negotiation) return {};
            if (negotiation.challenger.id !== user.id && negotiation.opponent.id !== user.id) {
                return { error: 'You are not part of this negotiation.' };
            }
        
            const { challenger, opponent, rematchOfGameId, mode } = negotiation;
        
            if (rematchOfGameId) {
                const originalGame = await db.getLiveGame(rematchOfGameId);
                if (originalGame?.gameStatus === 'rematch_pending') {
                    originalGame.gameStatus = 'ended';
                    await db.saveGame(originalGame);
                }
                [challenger.id, opponent.id].forEach(id => {
                    const status = volatileState.userStatuses[id];
                    if (status) {
                        status.status = UserStatus.InGame;
                        status.gameId = rematchOfGameId;
                    }
                });
            } else {
                const restoreNegotiatorToWaiting = async (userId: string) => {
                    const st = volatileState.userStatuses[userId];
                    if (st?.status !== UserStatus.Negotiating) return;
                    await restoreUserToWaitingLobby(volatileState, userId, mode);
                };
                await restoreNegotiatorToWaiting(challenger.id);
                await restoreNegotiatorToWaiting(opponent.id);
            }
        
            // 거절한 사람이 opponent인 경우 challenger에게 거절 메시지 전달
            const isOpponentDeclining = negotiation.opponent.id === user.id;
            const declinedMessage = isOpponentDeclining ? {
                declinedBy: opponent.nickname,
                message: `${opponent.nickname}님이 대국 신청을 거절했습니다.`
            } : undefined;
        
            delete volatileState.negotiations[negotiationId];
            
            // 발신자(challenger)에게 거절 메시지 전달
            if (isOpponentDeclining && declinedMessage) {
                broadcast({ 
                    type: 'CHALLENGE_DECLINED', 
                    payload: { 
                        negotiationId,
                        declinedMessage,
                        challengerId: challenger.id
                    } 
                });
            }
            
            broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
            
            return {
                clientResponse: declinedMessage ? { declinedMessage } : {}
            };
        }
        case 'START_AI_GAME': {
            try {
                const { mode, settings: incomingSettings } = payload;
                const settings = SPECIAL_GAME_MODES.some((m) => m.mode === mode)
                    ? clampAiLobbyStrategicItemCaps(
                          mode,
                          normalizeStrategicAiScoringSettings(mode, {
                              ...DEFAULT_GAME_SETTINGS,
                              ...incomingSettings,
                              useClientSideAi: false,
                          }),
                      )
                    : incomingSettings;
                // 대기실 AI 대국은 페어 전용 `pairGame` 메타와 무관 — 잔존 시 인게임 분기 오류 방지
                delete (settings as { pairGame?: unknown }).pairGame;
                const cost = effectiveAiLobbyApCostForUser(user, mode, settings);
                await applyPassiveActionPointRegenToUser(user, now);
                if (user.actionPoints.current < cost && !user.isAdmin) {
                    return { error: `액션 포인트가 부족합니다. (필요: ${cost})` };
                }
                if (!user.isAdmin) {
                    user.actionPoints.current -= cost;
                    user.lastActionPointUpdate = now;
                }

                const aiLobbyKey = SPECIAL_GAME_MODES.some((m) => m.mode === mode)
                    ? 'strategicLobby'
                    : PLAYFUL_GAME_MODES.some((m) => m.mode === mode)
                      ? 'playfulLobby'
                      : null;
                if (aiLobbyKey) {
                    const aiGate = await requireArenaEntranceOpen(user.isAdmin, aiLobbyKey, user);
                    if (!aiGate.ok) {
                        if (!user.isAdmin) {
                            user.actionPoints.current += cost;
                            user.lastActionPointUpdate = now;
                        }
                        return { error: aiGate.error };
                    }
                }
            
                const negotiation: Negotiation = {
                    id: `neg-ai-${randomUUID()}`,
                    challenger: user,
                    opponent: getAiUser(mode),
                    mode, settings,
                    proposerId: user.id,
                    status: 'pending', deadline: 0,
                    isRanked: false,
                };
            
                const game = await initializeGame(negotiation);
                await db.saveGame(game);
                
                volatileState.userStatuses[game.player1.id] = {
                    status: UserStatus.InGame,
                    mode: game.mode,
                    gameId: game.id,
                    arenaChannel: arenaChannelForGameSession(game) ?? undefined,
                };
                volatileState.userStatuses[game.player2.id] = {
                    status: UserStatus.InGame,
                    mode: game.mode,
                    gameId: game.id,
                    arenaChannel: arenaChannelForGameSession(game) ?? undefined,
                };
                
                const draftNegId = Object.keys(volatileState.negotiations).find(id => {
                    const neg = volatileState.negotiations[id];
                    return neg.challenger.id === user.id && neg.opponent.id === aiUserId && neg.status === 'draft';
                });
                if (draftNegId) delete volatileState.negotiations[draftNegId];
                
                // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
                db.updateUser(user).catch(err => {
                    console.error(`[ACCEPT_NEGOTIATION] Failed to save user ${user.id}:`, err);
                });
                
                // 게임 생성 후 게임 정보를 먼저 브로드캐스트 (게임 참가자에게만 전송)
                const { broadcastToGameParticipants, broadcastUserUpdate } = await import('../socket.js');
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                // 그 다음 사용자 업데이트 브로드캐스트 (actionPoints 변경 반영)
                broadcastUserUpdate(user, ['actionPoints']);
                // 사용자 상태 브로드캐스트
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
                
                // 클라이언트가 WebSocket 도착 전에 대국실 진입할 수 있도록 game 객체 포함
                // (배포 환경에서 WS 지연 시 게임 미표시 → 프로필로 튕기는 현상 방지)
                return {
                    clientResponse: {
                        gameId: game.id,
                        game,
                    }
                };
            } catch (err: any) {
                // 실패 시 액션 포인트 복구
                if (!user.isAdmin && payload?.mode) {
                    const refundSettings = {
                        ...DEFAULT_GAME_SETTINGS,
                        ...(payload?.settings && typeof payload.settings === 'object' ? payload.settings : {}),
                    };
                    const refundAp = effectiveAiLobbyApCostForUser(
                        user,
                        payload.mode as GameMode,
                        refundSettings,
                    );
                    user.actionPoints.current += refundAp;
                    user.lastActionPointUpdate = now;
                }
                console.error('[START_AI_GAME] Error:', err?.message || err, err?.stack);
                return { error: err?.message || 'AI 게임 생성 중 오류가 발생했습니다.' };
            }
        }
        case 'REQUEST_REMATCH': {
            const { opponentId, originalGameId } = payload;
            const opponent = await db.getUser(opponentId);
            if (!opponent) return { error: 'Opponent not found.' };
        
            const originalGame = await db.getLiveGame(originalGameId);
            if (!originalGame || !['ended', 'no_contest', 'rematch_pending'].includes(originalGame.gameStatus)) {
                return { error: 'Cannot request a rematch for this game.' };
            }
        
            if (Object.values(volatileState.negotiations).some(n => n.rematchOfGameId === originalGameId)) {
                return { error: 'A rematch has already been requested.' };
            }
        
            originalGame.gameStatus = 'rematch_pending';
            await db.saveGame(originalGame);
        
            const negotiationId = `neg-${randomUUID()}`;
            const newNegotiation: Negotiation = {
                id: negotiationId,
                challenger: user,
                opponent: opponent,
                mode: originalGame.mode,
                settings: originalGame.settings,
                proposerId: user.id,
                status: 'draft',
                turnCount: 0,
                deadline: now + 60000,
                rematchOfGameId: originalGameId,
                isRanked: false,
            };
        
            volatileState.negotiations[negotiationId] = newNegotiation;
        
            if (volatileState.userStatuses[user.id]) {
                volatileState.userStatuses[user.id].status = UserStatus.Negotiating;
                volatileState.userStatuses[user.id].gameId = originalGameId;
            }
            if (volatileState.userStatuses[opponent.id]) {
                volatileState.userStatuses[opponent.id].status = UserStatus.Negotiating;
                volatileState.userStatuses[opponent.id].gameId = originalGameId;
            }
        
            return {};
        }
        default:
            return { error: 'Unknown negotiation action.' };
    }
};