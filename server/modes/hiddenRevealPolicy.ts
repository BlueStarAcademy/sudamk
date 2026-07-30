import * as types from '../../types/index.js';
import { aiUserId } from '../aiPlayer.js';
import { resolveArenaSessionPolicy, type ArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

function policyOf(game: types.LiveGameSession): ArenaSessionPolicy {
    return resolveArenaSessionPolicy(game as any);
}

/** 전략바둑 대기실 vs AI (모험/탑/싱글/길드전 제외) */
export const isStrategicAiLobbyGo = (game: types.LiveGameSession): boolean => {
    const p = policyOf(game);
    return p.isStrategicAiLike && p.kind === 'normal';
};

export const isAdventureCategory = (game: types.LiveGameSession): boolean =>
    policyOf(game).kind === 'adventure';

/**
 * 상대 히든 칸 착수 시뮬에 processMove의 PVE 플래그로 쓸 값.
 * 모험·싱글·탑·길드전·AI 대국을 동일 축으로 맞춘다.
 */
export const treatAsPveLikeForHiddenOpponentReveal = (game: types.LiveGameSession): boolean => {
    const p = policyOf(game);
    return p.matchAxis === 'pve' || p.matchAxis === 'mixed_pair' || !!game.isAiGame;
};

/** 모험: 히든 위 착수는 포획·수순 반영 없이 공개 연출만 */
export const skipPendingCaptureForAdventureHiddenReveal = (game: types.LiveGameSession): boolean =>
    isAdventureCategory(game);

/**
 * 히든 공개 연출 후 실제 착수를 되돌리고 발견한 쪽 턴을 유지할지.
 * 모험 제외 — 싱글/탑만 (온라인 대국은 실제 포획·착수 반영).
 */
export const shouldPreserveDiscovererTurnAfterOpponentHiddenReveal = (game: types.LiveGameSession): boolean => {
    if (isAdventureCategory(game)) return false;
    const kind = policyOf(game).kind;
    return kind === 'singleplayer' || kind === 'tower';
};

/**
 * 인간 PVP: 상대 히든 칸 착수 시도는 공개 연출만 — 내 돌을 두거나 따내지 않고 턴 유지.
 */
export const isPvpRevealOnlyOpponentHiddenAttack = (game: types.LiveGameSession): boolean => {
    const p = policyOf(game);
    return p.matchAxis === 'pvp' && p.kind === 'normal' && !game.isAiGame;
};

/**
 * 서버 권위 공개 연출(착수 없이 상대 히든 공개)을 허용하는 세션.
 */
export const allowsServerRevealOnlyOpponentHiddenAttack = (game: types.LiveGameSession): boolean => {
    if (isPvpRevealOnlyOpponentHiddenAttack(game)) return true;
    const p = policyOf(game);
    if (p.kind === 'singleplayer' || p.kind === 'tower') return true;
    if (p.kind === 'adventure' && (!!game.isAiGame || gameSessionIncludesAiPlayer(game))) return true;
    if (p.kind === 'guildwar' && gameSessionIncludesAiPlayer(game)) return true;
    if (isStrategicAiLobbyGo(game)) return true;
    return false;
};

/**
 * 전략 로비 AI·길드전(AI): 봇이 유저 미공개 히든 칸을 찍어 공개할 때는 착수·수순·계가 턴 카운트에 반영하지 않고
 * 연출 후 같은 턴에서 다른 좌표로 두게 한다.
 */
export const shouldPreserveDiscovererTurnWhenAiRevealsUserHiddenStone = (
    game: types.LiveGameSession,
    discovererPlayerEnum: types.Player,
    isAiInitialHiddenStoneReveal: boolean
): boolean => {
    if (isAiInitialHiddenStoneReveal) return false;
    const discovererId =
        discovererPlayerEnum === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
    if (discovererId !== aiUserId) return false;
    const p = policyOf(game);
    return isStrategicAiLobbyGo(game) || (p.kind === 'guildwar' && gameSessionIncludesAiPlayer(game));
};

/** aiInitialHiddenStone 좌표 추적(히든 분기 진입) */
export const useAiInitialHiddenCellTracking = (game: types.LiveGameSession): boolean => {
    const p = policyOf(game);
    return (
        p.kind === 'singleplayer' ||
        p.kind === 'tower' ||
        p.kind === 'adventure' ||
        p.kind === 'guildwar' ||
        isStrategicAiLobbyGo(game)
    );
};

/** AI 초기 히든용 가짜 수순 삽입 허용(전략 로비 AI는 제외 — 수순에 이미 AI 수가 있음) */
export const useAiInitialHiddenSyntheticCaptureHistory = (game: types.LiveGameSession): boolean => {
    const p = policyOf(game);
    return (
        p.kind === 'singleplayer' ||
        p.kind === 'tower' ||
        p.kind === 'adventure' ||
        p.kind === 'guildwar'
    );
};

export const gameSessionIncludesAiPlayer = (game: types.LiveGameSession): boolean =>
    game.blackPlayerId === aiUserId || game.whitePlayerId === aiUserId;

/**
 * `hidden_reveal_animating` 종료 시 도전의 탑과 동일한 정산 경로를 쓸지.
 * (전략 PVP 등 인간 대 인간은 제외)
 */
export const useTowerStyleHiddenRevealAnimatingResolution = (game: types.LiveGameSession): boolean => {
    const p = policyOf(game);
    if (p.kind === 'singleplayer' || p.kind === 'tower') return true;
    if (p.usesServerKataAi) return true;
    if (p.kind === 'guildwar' && gameSessionIncludesAiPlayer(game)) return true;
    if (p.kind === 'adventure' && gameSessionIncludesAiPlayer(game)) return true;
    if (game.isAiGame) return true;
    return false;
};
