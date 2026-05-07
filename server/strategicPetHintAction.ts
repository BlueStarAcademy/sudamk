import * as db from './db.js';
import * as types from '../types/index.js';
import { SPECIAL_GAME_MODES } from '../shared/constants/index.js';
import {
    pairPetKataLevelForTotalPly,
    pairPetKataPhaseFromTotalPly,
    type PairPetKataPhase,
} from '../shared/constants/pairArena.js';
import { getKataServerRuntimeSnapshot } from './kataServerRuntimeStore.js';
import { pairPetKataStatsSixFromEquippedUser } from '../shared/utils/pairPetKataStatsFromEquippedUser.js';
import { pickStrategicPetHintLine } from '../shared/utils/strategicPetHintDialogue.js';
import { computeStrategicPetKataHintMove } from './goAiBot.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';

type HintPhaseState = { opening?: boolean; midgame?: boolean; endgame?: boolean };

function readHintUsage(game: types.LiveGameSession, userId: string): HintPhaseState {
    const bag = (game.settings as any)?.strategicPetHintByUserId as Record<string, HintPhaseState> | undefined;
    return bag?.[userId] ?? {};
}

function markHintPhaseUsed(game: types.LiveGameSession, userId: string, phase: PairPetKataPhase): void {
    const s = game.settings as any;
    if (!s.strategicPetHintByUserId) s.strategicPetHintByUserId = {};
    const cur = s.strategicPetHintByUserId[userId] ?? {};
    cur[phase] = true;
    s.strategicPetHintByUserId[userId] = cur;
}

function isStrategicPetHintContext(game: types.LiveGameSession): boolean {
    if (!SPECIAL_GAME_MODES.some((m) => m.mode === game.mode)) return false;
    const policy = resolveArenaSessionPolicy(game as any);
    if (policy.isPairGame) return false;
    return true;
}

/**
 * 전략바둑 대표펫 힌트 요청 — 게임 설정에 페이즈별 1회 사용 기록을 남긴다.
 */
export async function handleStrategicPetHintRequest(
    game: types.LiveGameSession,
    user: types.User,
    ctx: {
        pairClassicGame: boolean;
        isMyTurn: boolean;
        myPlayerEnum: types.Player;
    },
): Promise<types.HandleActionResult> {
    if (!isStrategicPetHintContext(game)) {
        return { error: '이 경기에서는 펫 힌트를 쓸 수 없습니다.' };
    }
    if (game.gameStatus !== 'playing') {
        return { error: '지금은 펫 힌트를 쓸 수 없습니다.' };
    }
    if (!ctx.isMyTurn || ctx.myPlayerEnum === types.Player.None) {
        return { error: '내 차례에만 펫 힌트를 쓸 수 있어요.' };
    }
    if (ctx.pairClassicGame) {
        return { error: '페어 경기장에서는 이 힌트를 사용할 수 없습니다.' };
    }

    const freshUser = await db.getUser(user.id);
    if (!freshUser) {
        return { error: '유저 정보를 불러오지 못했습니다.' };
    }
    const petRow = getEquippedPairPetInventoryRow(freshUser);
    if (!petRow) {
        return { error: '대표 펫이 있을 때만 힌트를 쓸 수 있어요.' };
    }
    const stats = pairPetKataStatsSixFromEquippedUser(freshUser);
    if (!stats) {
        return { error: '펫 정보를 불러오지 못했습니다.' };
    }

    const boardSize = game.settings.boardSize || 19;
    const totalPly =
        (game.moveHistory || []).filter((m) => m && m.x !== -1 && m.y !== -1).length + 1;
    const phase = pairPetKataPhaseFromTotalPly(boardSize, totalPly);
    const used = readHintUsage(game, user.id);
    if (used[phase]) {
        return { error: '이 국면 구간에서는 이미 펫 힌트를 썼어요.' };
    }

    const kataRuntime = getKataServerRuntimeSnapshot().pairPet;
    const kataLevel = pairPetKataLevelForTotalPly(boardSize, totalPly, stats, kataRuntime);
    const pt = await computeStrategicPetKataHintMove(game, ctx.myPlayerEnum, kataLevel);
    if (!pt || !Number.isInteger(pt.x) || !Number.isInteger(pt.y)) {
        return { error: '지금은 추천 수를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }

    markHintPhaseUsed(game, user.id, phase);
    const message = pickStrategicPetHintLine({
        phase,
        petTemplateId: petRow.templateId,
        gameId: game.id,
        moveCount: game.moveHistory?.length ?? 0,
    });

    return {
        clientResponse: {
            strategicPetHint: {
                x: pt.x,
                y: pt.y,
                message,
                phase,
            },
        },
    };
}
