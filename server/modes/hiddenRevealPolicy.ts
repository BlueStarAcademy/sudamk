import * as types from '../../types/index.js';
import { aiUserId } from '../aiPlayer.js';

/** 전략바둑 대기실 vs AI (모험/탑/싱글/길드전 제외) */
export const isStrategicAiLobbyGo = (game: types.LiveGameSession): boolean =>
    !!game.isAiGame &&
    !game.isSinglePlayer &&
    game.gameCategory !== 'tower' &&
    game.gameCategory !== 'singleplayer' &&
    game.gameCategory !== 'guildwar';

export const isAdventureCategory = (game: types.LiveGameSession): boolean =>
    game.gameCategory === types.GameCategory.Adventure;

/**
 * 상대 히든 칸 착수 시뮬에 processMove의 PVE 플래그로 쓸 값.
 * 모험·싱글·탑·길드전·AI 대국을 동일 축으로 맞춘다.
 */
export const treatAsPveLikeForHiddenOpponentReveal = (game: types.LiveGameSession): boolean =>
    !!game.isSinglePlayer ||
    game.gameCategory === 'tower' ||
    (game as any).gameCategory === 'guildwar' ||
    !!game.isAiGame;

/** 모험: 히든 위 착수는 포획·수순 반영 없이 공개 연출만 */
export const skipPendingCaptureForAdventureHiddenReveal = (game: types.LiveGameSession): boolean =>
    isAdventureCategory(game);

/**
 * 히든 공개 연출 후 실제 착수를 되돌리고 발견한 쪽 턴을 유지할지.
 * 모험 제외 — 싱글/탑/길드전/전략 AI 대국 동일.
 */
export const shouldPreserveDiscovererTurnAfterOpponentHiddenReveal = (game: types.LiveGameSession): boolean => {
    if (isAdventureCategory(game)) return false;
    return (
        !!game.isSinglePlayer ||
        game.gameCategory === 'tower' ||
        (game as any).gameCategory === 'guildwar' ||
        !!game.isAiGame
    );
};

/** aiInitialHiddenStone 좌표 추적(히든 분기 진입) */
export const useAiInitialHiddenCellTracking = (game: types.LiveGameSession): boolean =>
    !!game.isSinglePlayer ||
    game.gameCategory === 'tower' ||
    game.gameCategory === 'adventure' ||
    (game as any).gameCategory === 'guildwar' ||
    isStrategicAiLobbyGo(game);

/** AI 초기 히든용 가짜 수순 삽입 허용(전략 로비 AI는 제외 — 수순에 이미 AI 수가 있음) */
export const useAiInitialHiddenSyntheticCaptureHistory = (game: types.LiveGameSession): boolean =>
    !!game.isSinglePlayer ||
    game.gameCategory === 'tower' ||
    game.gameCategory === 'adventure' ||
    (game as any).gameCategory === 'guildwar';

export const gameSessionIncludesAiPlayer = (game: types.LiveGameSession): boolean =>
    game.blackPlayerId === aiUserId || game.whitePlayerId === aiUserId;

/**
 * `hidden_reveal_animating` 종료 시 도전의 탑과 동일한 정산 경로를 쓸지.
 * (전략 PVP 등 인간 대 인간은 제외)
 */
export const useTowerStyleHiddenRevealAnimatingResolution = (game: types.LiveGameSession): boolean => {
    if (game.isSinglePlayer) return true;
    if (game.gameCategory === 'tower') return true;
    if (game.isAiGame) return true;
    if ((game as any).gameCategory === 'guildwar' && gameSessionIncludesAiPlayer(game)) return true;
    if (isAdventureCategory(game) && gameSessionIncludesAiPlayer(game)) return true;
    return false;
};
