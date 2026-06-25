import { GameMode, Player, type GameSettings, type LiveGameSession } from '../types/index.js';
import { getEffectivePairLobbyOwnerId } from './effectivePairLobbyOwnerId.js';
import { isPairClassicGame, pairTeamIdForUserId } from './pairGameTurn.js';

type PairChessSetupSession = Pick<
    LiveGameSession,
    'player1' | 'player2' | 'blackPlayerId' | 'whitePlayerId' | 'isAiGame' | 'mode' | 'settings'
>;

function pairTeamOwnerUserId(
    pairGame: NonNullable<GameSettings['pairGame']>,
    teamId: 'teamA' | 'teamB',
): string | null {
    const team = teamId === 'teamA' ? pairGame.teamA : pairGame.teamB;
    const owner = team.members.find((m) => m.kind === 'user' && m.slot === 'owner');
    if (owner?.id) return owner.id;
    const firstUser = team.members.find((m) => m.kind === 'user');
    return firstUser?.id ?? null;
}

function teamHasHumanMember(
    pairGame: NonNullable<GameSettings['pairGame']>,
    teamId: 'teamA' | 'teamB',
): boolean {
    const team = teamId === 'teamA' ? pairGame.teamA : pairGame.teamB;
    return team.members.some((m) => m.kind === 'user');
}

function teamDraftKeyForColor(
    session: PairChessSetupSession,
    teamId: 'teamA' | 'teamB',
): string | null {
    const pairGame = session.settings?.pairGame;
    if (!pairGame) return null;

    if (teamHasHumanMember(pairGame, teamId)) {
        if (isPairCooperativeChessSetup(session)) {
            const owner = getEffectivePairLobbyOwnerId(session);
            if (owner && pairTeamIdForUserId(session.settings, owner) === teamId) {
                return owner;
            }
        }
        return pairTeamOwnerUserId(pairGame, teamId);
    }

    const black1 = pairGame.turnOrder?.find((s) => s.seatId === 'black1');
    const white1 = pairGame.turnOrder?.find((s) => s.seatId === 'white1');
    if (black1?.teamId === teamId && session.blackPlayerId) return session.blackPlayerId;
    if (white1?.teamId === teamId && session.whitePlayerId) return session.whitePlayerId;
    return null;
}

/** 페어 체스바둑: 흑·백 진영별 draft 맵 키 (인간 팀은 유저 id, AI/펫 팀은 black1/white1 좌석 id) */
export function resolvePairChessSideDraftKeys(
    session: PairChessSetupSession,
): { blackKey: string; whiteKey: string } | null {
    if (!isPairClassicGame(session.settings, session.mode)) return null;
    const pairGame = session.settings?.pairGame;
    if (!pairGame) return null;
    const black1 = pairGame.turnOrder?.find((s) => s.seatId === 'black1');
    const white1 = pairGame.turnOrder?.find((s) => s.seatId === 'white1');
    if (!black1?.teamId || !white1?.teamId) return null;
    const blackKey = teamDraftKeyForColor(session, black1.teamId);
    const whiteKey = teamDraftKeyForColor(session, white1.teamId);
    if (!blackKey || !whiteKey) return null;
    return { blackKey, whiteKey };
}

/** 페어 AI 협동전: 방장만 팀 기물을 배치하고 팀원은 대기 */
function isPairCooperativeChessSetup(session: PairChessSetupSession): boolean {
    const pairMode = session.settings?.pairGame?.pairMode;
    return pairMode === 'ai' || Boolean(session.isAiGame);
}

/**
 * 체스 바둑 배치 단계에서 상대 진영 반쪽 마스크(「상대 배치 중」) 표시 여부.
 * 인간 상대와 동시 배치하는 PVP에서만 사용 — AI·페어 AI는 서버가 상대 진영을 자동 채운다.
 */
export function shouldMaskChessPlacementOpponentHalf(session: PairChessSetupSession): boolean {
    if (session.isAiGame) return false;
    if (isPairCooperativeChessSetup(session)) return false;
    return true;
}

/**
 * 페어 체스바둑 기물 배치 — 이 유저가 조작할 draft 키(`blackPlayerId`/`whitePlayerId`).
 * 방장(또는 PVP 팀 방장)만 팀 색 기물을 설정하고, 팀원은 null(대기).
 */
export function resolvePairChessSetupDraftKey(
    session: PairChessSetupSession,
    userId: string,
): string | null {
    if (!isPairClassicGame(session.settings, session.mode)) return null;
    const pairGame = session.settings?.pairGame;
    if (!pairGame) return null;

    const effectiveLobbyOwner = getEffectivePairLobbyOwnerId(session);
    if (effectiveLobbyOwner && isPairCooperativeChessSetup(session)) {
        if (userId !== effectiveLobbyOwner) return null;
        const hostTeam = pairTeamIdForUserId(session.settings, userId);
        if (!hostTeam) return null;
        return teamDraftKeyForColor(session, hostTeam);
    }

    for (const teamId of ['teamA', 'teamB'] as const) {
        if (pairTeamOwnerUserId(pairGame, teamId) !== userId) continue;
        const draftKey = teamDraftKeyForColor(session, teamId);
        if (draftKey) return draftKey;
    }

    if (userId === session.player1.id || userId === session.player2.id) {
        const teamId = pairTeamIdForUserId(session.settings, userId);
        if (teamId) return teamDraftKeyForColor(session, teamId);
    }

    return null;
}

export function resolvePairChessSetupPlayerColor(
    session: PairChessSetupSession,
    userId: string,
): Player.Black | Player.White | null {
    const draftKey = resolvePairChessSetupDraftKey(session, userId);
    if (!draftKey) return null;
    const sides = resolvePairChessSideDraftKeys(session);
    if (!sides) return null;
    if (draftKey === sides.blackKey) return Player.Black;
    if (draftKey === sides.whiteKey) return Player.White;
    return null;
}

/** 페어 체스바둑 배치 단계에서 팀원(비방장) 대기 UI */
export function isPairChessSetupWaitingGuest(
    session: PairChessSetupSession,
    userId: string,
): boolean {
    if (session.mode !== GameMode.Chess) return false;
    if (!isPairClassicGame(session.settings, session.mode)) return false;
    const humans =
        session.settings?.pairGame?.turnOrder?.filter((s) => s.kind === 'user').map((s) => s.participantId) ?? [];
    if (!humans.includes(userId)) return false;
    return resolvePairChessSetupDraftKey(session, userId) == null;
}
