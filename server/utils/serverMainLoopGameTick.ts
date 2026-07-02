import type { LiveGameSession } from '../../types/index.js';
import * as types from '../../types/index.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { isSessionSpeedTimePressureMode } from './speedTimePressureLiveCaptures.js';
import { needsPveAiWatchdogTick } from './pveAiTurnWatchdog.js';
import { aiUserId } from '../aiPlayer.js';

/** updateGameStates 필터와 동일 — id·policy 기준 PVE 세션 판별 */
export function isPveSessionForMainLoop(game: LiveGameSession): boolean {
    const policy = resolveArenaSessionPolicy(game);
    return (
        policy.kind === 'singleplayer' ||
        policy.kind === 'tower' ||
        policy.kind === 'adventure' ||
        policy.kind === 'guildwar' ||
        Boolean(game.isSinglePlayer)
    );
}

/**
 * PVE 게임이 메인 루프(updateGameStates)에서 서버 틱이 필요한지.
 * false면 클라이언트 주도(유저 턴 본대국 등)로 루프에서 제외해도 된다.
 */
export function needsPveMainLoopProcessing(game: LiveGameSession, now: number = Date.now()): boolean {
    if (!game?.id || !isPveSessionForMainLoop(game)) return false;

    const isPVEGame = true;
    const needsRevealTransition =
        isPVEGame && (game.gameStatus === 'hidden_final_reveal' || game.gameStatus === 'hidden_reveal_animating');
    const needsItemModeTransition =
        isPVEGame &&
        (game.gameStatus === 'missile_animating' ||
            game.gameStatus === 'scanning_animating' ||
            game.gameStatus === 'hidden_placing' ||
            game.gameStatus === 'scanning' ||
            game.gameStatus === 'missile_selecting');
    const arenaPolicy = resolveArenaSessionPolicy(game);
    const needsPveServerGoAiTick =
        arenaPolicy.usesServerKataAi &&
        (arenaPolicy.kind === 'adventure' || arenaPolicy.kind === 'guildwar') &&
        (game.gameStatus === 'playing' ||
            game.gameStatus === 'hidden_placing' ||
            game.gameStatus === 'scanning' ||
            game.gameStatus === 'missile_selecting' ||
            game.gameStatus === 'base_placement' ||
            game.gameStatus === 'base_stone_color_choice' ||
            game.gameStatus === 'base_same_color_points_bid' ||
            game.gameStatus === 'base_game_start_confirmation' ||
            game.gameStatus === 'nigiri_choosing' ||
            game.gameStatus === 'nigiri_guessing' ||
            game.gameStatus === 'nigiri_reveal' ||
            game.gameStatus === 'uniform_color_roulette' ||
            game.gameStatus === 'capture_bidding' ||
            game.gameStatus === 'capture_reveal' ||
            game.gameStatus === 'capture_tiebreaker');
    const needsSinglePlayerBasePrePlayTick =
        isPVEGame &&
        (game.mode === types.GameMode.Base ||
            (game.mode === types.GameMode.Mix &&
                Boolean((game.settings as { mixedModes?: types.GameMode[] } | undefined)?.mixedModes?.includes(types.GameMode.Base)))) &&
        [
            'base_placement',
            'base_stone_color_choice',
            'base_same_color_points_bid',
            'base_game_start_confirmation',
            'capture_bidding',
            'capture_reveal',
            'capture_tiebreaker',
        ].includes(game.gameStatus);
    const pveDiceThiefCurrentPid =
        game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
    const pveDiceThiefIsAiTurn =
        pveDiceThiefCurrentPid === aiUserId ||
        (!!pveDiceThiefCurrentPid && String(pveDiceThiefCurrentPid).startsWith('dungeon-bot-'));
    const needsPveSpeedPlayingTick =
        isPVEGame && game.gameStatus === 'playing' && isSessionSpeedTimePressureMode(game);
    const needsPveDiceThiefPlayfulTick =
        isPVEGame &&
        ((game.mode === types.GameMode.Dice &&
            (game.gameStatus === 'dice_rolling_animating' ||
                game.gameStatus === 'dice_turn_rolling_animating' ||
                game.gameStatus === 'dice_turn_rolling' ||
                game.gameStatus === 'dice_turn_choice' ||
                game.gameStatus === 'dice_start_confirmation' ||
                (pveDiceThiefIsAiTurn &&
                    (game.gameStatus === 'dice_rolling' || game.gameStatus === 'dice_placing')))) ||
            (game.mode === types.GameMode.Thief &&
                (game.gameStatus === 'thief_rolling_animating' ||
                    (pveDiceThiefIsAiTurn &&
                        (game.gameStatus === 'thief_rolling' || game.gameStatus === 'thief_placing')))));
    const needsPveAiWatchdogLoopTick = needsPveAiWatchdogTick(game);

    return (
        needsRevealTransition ||
        needsItemModeTransition ||
        needsPveServerGoAiTick ||
        needsSinglePlayerBasePrePlayTick ||
        needsPveSpeedPlayingTick ||
        needsPveDiceThiefPlayfulTick ||
        needsPveAiWatchdogLoopTick
    );
}

/** 싱글/탑 클라이언트 주도 본대국 — AI 워치독만 필요한 경량 틱 */
export function isClientAuthPveWatchdogOnlyTick(game: LiveGameSession): boolean {
    const policy = resolveArenaSessionPolicy(game);
    if (!policy.usesServerKataAi || (policy.kind !== 'singleplayer' && policy.kind !== 'tower')) {
        return false;
    }
    if (!needsPveAiWatchdogTick(game)) return false;
    const pveDiceThiefCurrentPid =
        game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
    const pveDiceThiefIsAiTurn =
        pveDiceThiefCurrentPid === aiUserId ||
        (!!pveDiceThiefCurrentPid && String(pveDiceThiefCurrentPid).startsWith('dungeon-bot-'));
    const hasNonWatchdogReason =
        game.gameStatus === 'hidden_final_reveal' ||
        game.gameStatus === 'hidden_reveal_animating' ||
        game.gameStatus === 'missile_animating' ||
        game.gameStatus === 'scanning_animating' ||
        game.gameStatus === 'hidden_placing' ||
        game.gameStatus === 'scanning' ||
        game.gameStatus === 'missile_selecting' ||
        (game.gameStatus === 'playing' && isSessionSpeedTimePressureMode(game)) ||
        (game.mode === types.GameMode.Dice &&
            (game.gameStatus === 'dice_rolling_animating' ||
                game.gameStatus === 'dice_turn_rolling_animating' ||
                game.gameStatus === 'dice_turn_rolling' ||
                game.gameStatus === 'dice_turn_choice' ||
                game.gameStatus === 'dice_start_confirmation' ||
                (pveDiceThiefIsAiTurn &&
                    (game.gameStatus === 'dice_rolling' || game.gameStatus === 'dice_placing')))) ||
        (game.mode === types.GameMode.Thief &&
            (game.gameStatus === 'thief_rolling_animating' ||
                (pveDiceThiefIsAiTurn &&
                    (game.gameStatus === 'thief_rolling' || game.gameStatus === 'thief_placing')))) ||
        (game.mode === types.GameMode.Base ||
            (game.mode === types.GameMode.Mix &&
                Boolean((game.settings as { mixedModes?: types.GameMode[] } | undefined)?.mixedModes?.includes(types.GameMode.Base)))) &&
            [
                'base_placement',
                'base_stone_color_choice',
                'base_same_color_points_bid',
                'base_game_start_confirmation',
                'capture_bidding',
                'capture_reveal',
                'capture_tiebreaker',
            ].includes(game.gameStatus);
    return !hasNonWatchdogReason;
}
