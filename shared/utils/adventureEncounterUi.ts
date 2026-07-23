import type { GameStatus } from '../types/enums.js';
import { Player } from '../types/enums.js';

/** 모험 인카운터 전체 제한시간(남은 시간) UI를 표시하는 상태 — 히든/미사일 아이템 페이즈 포함 */
const ADVENTURE_ENCOUNTER_COUNTDOWN_STATUSES: ReadonlySet<GameStatus> = new Set([
    'playing',
    'hidden_placing',
    'scanning',
    'scanning_animating',
    'hidden_reveal_animating',
    'hidden_final_reveal',
    'missile_selecting',
    'missile_animating',
]);

export const ADVENTURE_ENCOUNTER_FROZEN_MS_KEY = 'adventureEncounterFrozenHumanMsRemaining' as const;

export function adventureEncounterCountdownUiActive(
    gameCategory: string | undefined,
    gameStatus: GameStatus | undefined
): boolean {
    return gameCategory === 'adventure' && gameStatus != null && ADVENTURE_ENCOUNTER_COUNTDOWN_STATUSES.has(gameStatus);
}

const DEFAULT_AI_USER_ID = 'ai-player-01';

export function isAdventureAiSeatId(playerId: string | null | undefined, aiUserId: string = DEFAULT_AI_USER_ID): boolean {
    if (playerId == null || playerId === '') return false;
    const id = String(playerId);
    return id === aiUserId || id.startsWith('dungeon-bot-');
}

/**
 * 모험 인카운터에서 도전자(인간) 색.
 * AI 좌석 id 판별 실패 시 player1(도전자) 좌석으로 폴백한다.
 */
export function resolveAdventureEncounterHumanPlayerEnum(
    session: {
        blackPlayerId?: string | null;
        whitePlayerId?: string | null;
        player1?: { id?: string } | null;
        isAiGame?: boolean;
    },
    aiUserId: string = DEFAULT_AI_USER_ID,
): Player {
    const blackIsAi = isAdventureAiSeatId(session.blackPlayerId, aiUserId);
    const whiteIsAi = isAdventureAiSeatId(session.whitePlayerId, aiUserId);
    if (blackIsAi && !whiteIsAi) return Player.White;
    if (whiteIsAi && !blackIsAi) return Player.Black;

    const challengerId = session.player1?.id;
    if (challengerId) {
        if (session.blackPlayerId === challengerId) return Player.Black;
        if (session.whitePlayerId === challengerId) return Player.White;
    }
    // 최후: 백이 AI가 아니면 흑을 인간으로 가정
    return whiteIsAi ? Player.Black : Player.White;
}

export function isAdventureEncounterMonsterTurn(
    session: {
        gameCategory?: string;
        gameStatus?: GameStatus;
        currentPlayer?: Player | null;
        blackPlayerId?: string | null;
        whitePlayerId?: string | null;
        player1?: { id?: string } | null;
        isAiGame?: boolean;
    },
    aiUserId: string = DEFAULT_AI_USER_ID,
): boolean {
    if (!adventureEncounterCountdownUiActive(session.gameCategory, session.gameStatus)) return false;
    const cur = session.currentPlayer;
    if (cur !== Player.Black && cur !== Player.White) return false;
    return cur !== resolveAdventureEncounterHumanPlayerEnum(session, aiUserId);
}

/**
 * 인카운터 남은 ms — 몬스터 턴이면 서버가 고정한 frozen 값(없으면 deadline 기준 스냅샷),
 * 도전자 턴이면 `deadline - now`.
 */
export function resolveAdventureEncounterRemainingMs(
    session: {
        gameCategory?: string;
        gameStatus?: GameStatus;
        currentPlayer?: Player | null;
        blackPlayerId?: string | null;
        whitePlayerId?: string | null;
        player1?: { id?: string } | null;
        adventureEncounterDeadlineMs?: number;
        adventureEncounterFrozenHumanMsRemaining?: number;
    },
    nowMs: number,
    aiUserId: string = DEFAULT_AI_USER_ID,
): number | null {
    const deadline = session.adventureEncounterDeadlineMs;
    if (typeof deadline !== 'number' || !Number.isFinite(deadline)) return null;
    if (!adventureEncounterCountdownUiActive(session.gameCategory, session.gameStatus)) return null;

    if (isAdventureEncounterMonsterTurn(session, aiUserId)) {
        const frozen = session.adventureEncounterFrozenHumanMsRemaining;
        if (typeof frozen === 'number' && Number.isFinite(frozen) && frozen > 0) {
            return frozen;
        }
        // frozen 미수신 시 마지막 deadline 스냅샷을 고정값처럼 사용(벽시계로 더 깎지 않음)
        return Math.max(0, deadline - nowMs);
    }
    return Math.max(0, deadline - nowMs);
}
