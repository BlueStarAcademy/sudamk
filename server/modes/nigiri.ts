
import * as types from '../../types/index.js';
import { transitionToPlaying } from './shared.js';

export const initializeNigiri = (game: types.LiveGameSession, now: number) => {
    const blackPlayer = Math.random() < 0.5 ? game.player1 : game.player2;
    const whitePlayer = blackPlayer.id === game.player1.id ? game.player2 : game.player1;

    game.blackPlayerId = blackPlayer.id;
    game.whitePlayerId = whitePlayer.id;
    enterNigiriRevealWithAssignedColors(game, now);
};

/** `blackPlayerId` / `whitePlayerId`가 이미 정해진 경우(모험 AI 랜덤 흑백 등) 룰렛·확인 단계만 시작 */
export const enterNigiriRevealWithAssignedColors = (game: types.LiveGameSession, now: number) => {
    if (!game.blackPlayerId || !game.whitePlayerId) return;
    game.nigiri = {
        holderId: game.blackPlayerId,
        guesserId: game.whitePlayerId,
        stones: null,
        guess: null,
        result: null,
    };
    game.gameStatus = 'nigiri_reveal';
    // 자동 카운트다운 없이 유저가 원할 때 시작 버튼으로 진행
    game.revealEndTime = undefined;
    game.preGameConfirmations = {
        [game.player1.id]: false,
        [game.player2.id]: false,
    };
    game.guessDeadline = undefined;
    game.nigiriStartTime = now;
};

export const updateNigiriState = (game: types.LiveGameSession, now: number) => {
    if (game.gameStatus === 'nigiri_reveal') {
        const bothConfirmed = game.preGameConfirmations?.[game.player1.id] && game.preGameConfirmations?.[game.player2.id];
        if (bothConfirmed) {
            if (game.nigiri) game.nigiri.processed = true;
            game.preGameConfirmations = {};
            game.revealEndTime = undefined;
            transitionToPlaying(game, now);
        }
    }
};

export const handleNigiriAction = (game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): types.HandleActionResult | null => {
    const { type } = action as any; // Cast to any to access payload without TS complaining before the switch

    if (type === 'CONFIRM_COLOR_START') {
        if (game.gameStatus !== 'nigiri_reveal') {
            return { error: "Not in confirmation phase." };
        }
        if (!game.preGameConfirmations) game.preGameConfirmations = {};
        game.preGameConfirmations[user.id] = true;
        return {};
    }

    return null;
};
