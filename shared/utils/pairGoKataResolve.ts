import type { GameSettings, LiveGameSession, User } from '../types/entities.js';
import type { KataServerRuntimeSnapshot } from '../types/kataServerRuntime.js';
import {
    pairPetKataLevelForTotalPly,
    type PairPetCoreStatsSix,
} from '../constants/pairArena.js';
import { strategicKataLevelFromSnapshot } from './kataServerRuntimeResolvers.js';
import { pairPetKataStatsSixFromEquippedUser } from './pairPetKataStatsFromEquippedUser.js';
import type { PairGameTurnSeat } from './pairGameTurn.js';

const DEFAULT_PET_KATA_SIX: PairPetCoreStatsSix = {
    concentration: 100,
    thinkingSpeed: 100,
    judgment: 100,
    calculation: 100,
    combatPower: 100,
    stability: 100,
};

/** 페어 인게임 KATA — 펫 좌석(`kind === 'pet'` 또는 `pet-ai-*`) */
export function isPairGoPetKataSeat(seat: Pick<PairGameTurnSeat, 'kind' | 'participantId'>): boolean {
    return seat.kind === 'pet' || seat.participantId.startsWith('pet-ai-');
}

export function resolvePairSeatOwnerUser(
    session: Pick<LiveGameSession, 'player1' | 'player2'>,
    seat: Pick<PairGameTurnSeat, 'participantId'>,
): User | null {
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

/** `petKataStatsByParticipantId` 스냅샷 → 없으면 장착 펫 메타로 재산출(유저 6코어 아님) */
export function resolvePairGoPetKataStatsSixForSeat(
    settings: Pick<GameSettings, 'pairGame'>,
    seat: Pick<PairGameTurnSeat, 'participantId' | 'kind'>,
    session?: Pick<LiveGameSession, 'player1' | 'player2'>,
): PairPetCoreStatsSix {
    const stored = settings.pairGame?.petKataStatsByParticipantId?.[seat.participantId];
    if (stored) return stored;

    if (session && isPairGoPetKataSeat(seat)) {
        const owner = resolvePairSeatOwnerUser(session, seat);
        if (owner) {
            const recomputed = pairPetKataStatsSixFromEquippedUser(owner);
            if (recomputed) return recomputed;
        }
    }

    return { ...DEFAULT_PET_KATA_SIX };
}

/**
 * 페어 바둑 AI/펫 좌석의 KataServer `level`.
 * - 펫 좌석: 펫 6코어 + 페어 펫 ability→KATA 사다리
 * - `pairKataFixedLevelByParticipantId`: 고정 레벨(AI 대전 상대 등)
 * - 그 외 AI 좌석: 전략 로비 단계(`goAiProfileLevel`) — 유저 6코어 챔피언십 KATA 아님
 */
export function resolvePairGoKataLevelForSeat(params: {
    settings: GameSettings;
    seat: PairGameTurnSeat;
    totalPly: number;
    goAiProfileLevel: number;
    kataRuntime: KataServerRuntimeSnapshot;
    configuredKataLevel?: number;
    session?: Pick<LiveGameSession, 'player1' | 'player2'>;
}): number {
    const { settings, seat, totalPly, goAiProfileLevel, kataRuntime, configuredKataLevel, session } = params;
    const strategicFallback =
        configuredKataLevel ?? strategicKataLevelFromSnapshot(kataRuntime, goAiProfileLevel);

    const pairGame = settings.pairGame;
    if (!pairGame) return strategicFallback;

    const fixed = pairGame.pairKataFixedLevelByParticipantId?.[seat.participantId];
    if (Number.isFinite(fixed)) return Number(fixed);

    if (isPairGoPetKataSeat(seat)) {
        const stats = resolvePairGoPetKataStatsSixForSeat(settings, seat, session);
        return pairPetKataLevelForTotalPly(
            settings.boardSize || 19,
            totalPly,
            stats,
            kataRuntime.pairPet,
        );
    }

    return strategicFallback;
}
