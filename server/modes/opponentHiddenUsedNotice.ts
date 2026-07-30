import type { LiveGameSession } from '../../types/index.js';
import { AI_HIDDEN_ITEM_THINKING_DURATION_MS } from '../../shared/constants/gameSettings.js';
import {
    OPPONENT_HIDDEN_USED_FOUL_KIND,
    OPPONENT_HIDDEN_USED_NOTICE_KO,
} from '../../shared/constants/opponentHiddenUsedNotice.js';

/** 히든 착수 성공 후 상대에게 "사용 사실"만 알린다 (위치·색 비공개). */
export function setOpponentHiddenUsedNotice(game: LiveGameSession, now: number): void {
    game.foulInfo = {
        message: OPPONENT_HIDDEN_USED_NOTICE_KO,
        expiry: now + AI_HIDDEN_ITEM_THINKING_DURATION_MS,
        kind: OPPONENT_HIDDEN_USED_FOUL_KIND,
    };
}
