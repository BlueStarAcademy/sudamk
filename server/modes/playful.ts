import * as types from '../../types/index.js';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul } from './shared.js';
import { initializeAlkkagi, updateAlkkagiState, handleAlkkagiAction } from './alkkagi.js';
import { initializeCurling, updateCurlingState, handleCurlingAction } from './curling.js';
import { initializeDiceGo, updateDiceGoState, handleDiceGoAction } from './diceGo.js';
import { initializeOmok, updateOmokState, handleOmokAction } from './omok.js';
import { initializeThief, updateThiefState, handleThiefAction } from './thief.js';
import { ALKKAGI_TURN_TIME_LIMIT, ALKKAGI_PLACEMENT_TIME_LIMIT, CURLING_TURN_TIME_LIMIT, DICE_GO_MAIN_ROLL_TIME } from '../../constants/index.js';
export const initializePlayfulGame = async (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;

    switch (game.mode) {
        case types.GameMode.Dice:
            game.blackTimeLeft = DICE_GO_MAIN_ROLL_TIME;
            game.whiteTimeLeft = DICE_GO_MAIN_ROLL_TIME;
            initializeDiceGo(game, neg, now);
            break;
        case types.GameMode.Thief:
            game.blackTimeLeft = DICE_GO_MAIN_ROLL_TIME;
            game.whiteTimeLeft = DICE_GO_MAIN_ROLL_TIME;
            initializeThief(game, neg, now);
            break;
        case types.GameMode.Alkkagi:
            game.blackTimeLeft = ALKKAGI_TURN_TIME_LIMIT;
            game.whiteTimeLeft = ALKKAGI_TURN_TIME_LIMIT;
            game.blackByoyomiPeriodsLeft = game.blackByoyomiPeriodsLeft ?? Math.max(1, game.settings.byoyomiCount ?? 3);
            game.whiteByoyomiPeriodsLeft = game.whiteByoyomiPeriodsLeft ?? Math.max(1, game.settings.byoyomiCount ?? 3);

            // Comprehensive initialization to prevent null values on DB load
            game.alkkagiStones = [];
            game.alkkagiStones_p1 = [];
            game.alkkagiStones_p2 = [];
            game.alkkagiStonesPlacedThisRound = { [p1.id]: 0, [p2.id]: 0 };
            game.alkkagiRound = 1;
            game.activeAlkkagiItems = {};
            game.alkkagiRefillsUsed = { [p1.id]: 0, [p2.id]: 0 };
            game.alkkagiRoundSummary = undefined;
            game.timeoutFouls = { [p1.id]: 0, [p2.id]: 0 };
            
            const p1SlowBonus = 0;
            const p1AimBonus = 0;
            const p2SlowBonus = 0;
            const p2AimBonus = 0;

            game.alkkagiItemUses = {
                [p1.id]: { slow: (game.settings.alkkagiSlowItemCount || 0) + p1SlowBonus, aimingLine: (game.settings.alkkagiAimingLineItemCount || 0) + p1AimBonus },
                [p2.id]: { slow: (game.settings.alkkagiSlowItemCount || 0) + p2SlowBonus, aimingLine: (game.settings.alkkagiAimingLineItemCount || 0) + p2AimBonus }
            };

            initializeAlkkagi(game, neg, now);
            break;
        case types.GameMode.Curling:
            game.blackTimeLeft = CURLING_TURN_TIME_LIMIT;
            game.whiteTimeLeft = CURLING_TURN_TIME_LIMIT;
            game.blackByoyomiPeriodsLeft = game.blackByoyomiPeriodsLeft ?? Math.max(1, game.settings.byoyomiCount ?? 3);
            game.whiteByoyomiPeriodsLeft = game.whiteByoyomiPeriodsLeft ?? Math.max(1, game.settings.byoyomiCount ?? 3);
            initializeCurling(game, neg, now);
            break;
        case types.GameMode.Omok:
        case types.GameMode.Ttamok:
            initializeOmok(game, neg, now);
            break;
    }
};

export const updatePlayfulGameState = async (game: types.LiveGameSession, now: number) => {
    switch (game.mode) {
        case types.GameMode.Dice:
            updateDiceGoState(game, now);
            break;
        case types.GameMode.Thief:
            updateThiefState(game, now);
            break;
        case types.GameMode.Alkkagi:
            updateAlkkagiState(game, now);
            break;
        case types.GameMode.Curling:
            updateCurlingState(game, now);
            break;
        case types.GameMode.Omok:
        case types.GameMode.Ttamok:
            updateOmokState(game, now);
            break;
    }

};

export const handlePlayfulGameAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult | undefined> => {
    switch (game.mode) {
        case types.GameMode.Dice:
            return handleDiceGoAction(volatileState, game, action, user);
        case types.GameMode.Thief:
            return handleThiefAction(volatileState, game, action, user);
        case types.GameMode.Alkkagi:
            return handleAlkkagiAction(volatileState, game, action, user);
        case types.GameMode.Curling:
            return handleCurlingAction(volatileState, game, action, user);
        case types.GameMode.Omok:
        case types.GameMode.Ttamok:
            return handleOmokAction(volatileState, game, action, user);
        default:
             // Handle shared actions like resign, chat, etc. that might apply to all playful modes
            const result = await handleSharedAction(volatileState, game, action, user);
            return result ?? undefined;
    }
};
