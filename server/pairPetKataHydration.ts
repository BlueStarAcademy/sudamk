import { randomUUID } from 'crypto';

import type { LiveGameSession, User, InventoryItem, ChatMessage } from '../types/index.js';

import {
    PAIR_GO_GAME_MODES,
    buildTeamPreservingPairTurnOrder,
    pairTurnSeatIdShortLabel,
    type PairGameTurnSeat,
} from '../shared/utils/pairGameTurn.js';

import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';

import { resolvePairPetMetaFromInventoryRow } from '../shared/utils/pairPetRoll.js';

import { computePairPetKataCoreStatsSixFromMeta } from '../shared/utils/pairPetKataStatsFromMeta.js';

import { effectivePairPetGradeFromRow } from '../shared/constants/pairPetGrade.js';

import { applyPairPetRpsForPairGameStart } from '../shared/utils/pairPetRps.js';

import { getPairPetDefinition, getPairPetDisplayName } from '../shared/constants/petLobby.js';

import { volatileState } from './state.js';

import { broadcastToGameParticipants } from './socket.js';



function pairPetKataStatsFromEquippedPet(user: User) {

    const row = getEquippedPairPetInventoryRow(user);

    if (!row) return null;

    const meta = resolvePairPetMetaFromInventoryRow(row as InventoryItem);

    const grade = effectivePairPetGradeFromRow(row);

    return computePairPetKataCoreStatsSixFromMeta(meta, grade);

}



function pairSeatOwnerUserForChat(session: LiveGameSession, seat: PairGameTurnSeat): User | null {

    const pid = seat.participantId;

    if (session.player1.id === pid) return session.player1;

    if (session.player2.id === pid) return session.player2;

    if (pid.startsWith('pet-ai-')) {

        const uid = pid.slice('pet-ai-'.length);

        if (session.player1.id === uid) return session.player1;

        if (session.player2.id === uid) return session.player2;

    }

    return null;

}



export function resolvePairSeatPetNicknameForChat(session: LiveGameSession, seat: PairGameTurnSeat): string {

    const owner = pairSeatOwnerUserForChat(session, seat);

    if (owner) {

        const row = getEquippedPairPetInventoryRow(owner);

        if (row && (seat.kind === 'pet' || seat.kind === 'ai')) {

            return getPairPetDisplayName(row);

        }

    }

    const fallbackIndex = seat.participantId === 'pair-opponent-pet' ? 1 : 0;

    const def = getPairPetDefinition(`pair-pet-${fallbackIndex + 1}`);

    return def?.displayName ?? seat.name ?? '펫';

}



const PAIR_RPS_DEBUFF_ABILITY_CHAT_TEXT = '속성차이에 의해 바둑능력이 감소했습니다.';



function appendGameChatAndBroadcast(game: LiveGameSession, message: ChatMessage): void {

    if (!volatileState.gameChats[game.id]) volatileState.gameChats[game.id] = [];

    volatileState.gameChats[game.id].push(message);

    if (volatileState.gameChats[game.id].length > 100) volatileState.gameChats[game.id].shift();

    broadcastToGameParticipants(

        game.id,

        {

            type: 'GAME_CHAT_UPDATE',

            payload: { [game.id]: volatileState.gameChats[game.id] },

        },

        game,

    );

}



function appendPairPetRpsDebuffChats(game: LiveGameSession, debuffedParticipantIds: string[], turnOrder: PairGameTurnSeat[]): void {

    if (debuffedParticipantIds.length === 0) return;

    const orderIndex = new Map<string, number>();

    turnOrder.forEach((s, i) => orderIndex.set(s.participantId, i));

    const sorted = [...debuffedParticipantIds].sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));

    for (const participantId of sorted) {

        const seat = turnOrder.find((s) => s.participantId === participantId);

        if (!seat) continue;

        const nickname = resolvePairSeatPetNicknameForChat(game, seat);

        const location = seat.seatId ? `[${pairTurnSeatIdShortLabel(seat.seatId)}]` : undefined;

        const message: ChatMessage = {

            id: `msg-${randomUUID()}`,

            user: { id: participantId, nickname },

            text: PAIR_RPS_DEBUFF_ABILITY_CHAT_TEXT,

            system: false,

            timestamp: Date.now(),

            ...(location ? { location } : {}),

        };

        appendGameChatAndBroadcast(game, message);

    }

}



/**

 * 페어 국: 전략 초기화·첫 착수 전에 호출되어야 KATA가 RPS 반영 6코어를 본다.

 * `pairPetRpsAttributeByParticipantId`가 이미 채워져 있으면 아무 것도 하지 않는다(인게임에서

 * `configurePairClassicGameStart` 등으로 재호출되어도 RPS가 이중 적용되지 않음).

 */

export function hydratePairGamePetKataAndRpsIfNeeded(game: LiveGameSession, ownerUser: User, petStatUsers: User[]): void {

    if (!PAIR_GO_GAME_MODES.includes(game.mode) || !game.settings?.pairGame) return;

    const pairGame = game.settings.pairGame;

    if (pairGame.pairPetRpsAttributeByParticipantId && Object.keys(pairGame.pairPetRpsAttributeByParticipantId).length > 0) {

        return;

    }

    const turnOrder =

        pairGame.turnOrder && pairGame.turnOrder.length > 0

            ? pairGame.turnOrder

            : buildTeamPreservingPairTurnOrder(pairGame);

    if (!pairGame.turnOrder?.length) {

        pairGame.turnOrder = turnOrder;

    }

    const petStatsByUserPetId = new Map<string, ReturnType<typeof pairPetKataStatsFromEquippedPet>>();

    for (const petOwner of petStatUsers) {

        const stats = pairPetKataStatsFromEquippedPet(petOwner);

        if (stats) petStatsByUserPetId.set(`pet-ai-${petOwner.id}`, stats);

    }

    pairGame.petKataStatsByParticipantId = {};

    for (const seat of turnOrder) {

        if (seat.kind === 'pet' || seat.kind === 'ai') {

            pairGame.petKataStatsByParticipantId[seat.participantId] =

                petStatsByUserPetId.get(seat.participantId) ??

                (seat.slot === 'ownerPet' ? petStatsByUserPetId.get(`pet-ai-${ownerUser.id}`) : undefined) ??

                {

                    concentration: 100,

                    thinkingSpeed: 100,

                    judgment: 100,

                    calculation: 100,

                    combatPower: 100,

                    stability: 100,

                };

        }

    }

    const debuffedIds = applyPairPetRpsForPairGameStart(pairGame, turnOrder, petStatUsers, game.id);

    if (debuffedIds.length > 0) {

        appendPairPetRpsDebuffChats(game, debuffedIds, turnOrder);

    }

}


