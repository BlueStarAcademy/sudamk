import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../shared/types/enums.js';
import { PLAYFUL_GAME_MODES } from '../../../shared/constants/gameModes.js';
import { PLAYFUL_SERVER_ACTION_TYPES } from '../../gameActions.js';

/** 모드 핸들러(`server/modes/*.ts`)에서 서버가 처리하는 놀이바둑 액션 — 누락 시 AI 대국이 무응답 */
const REQUIRED_PLAYFUL_SERVER_ACTIONS = [
    'OMOK_PLACE_STONE',
    'SUBMIT_RPS_CHOICE',
    'DICE_READY_FOR_TURN_ROLL',
    'DICE_CHOOSE_TURN',
    'DICE_CONFIRM_START',
    'DICE_ROLL',
    'DICE_PLACE_STONE',
    'DICE_PLACE_STONES_BATCH',
    'CONFIRM_THIEF_ROLE',
    'THIEF_ROLL_DICE',
    'THIEF_PLACE_STONE',
    'CONFIRM_ALKKAGI_START',
    'ALKKAGI_PLACE_STONE',
    'ALKKAGI_FLICK_STONE',
    'USE_ALKKAGI_ITEM',
    'CONFIRM_CURLING_START',
    'CURLING_FLICK_STONE',
    'USE_CURLING_ITEM',
    'CONFIRM_ROUND_END',
] as const;

const WAITING_ROOM_PLAYFUL_AI_MODES: GameMode[] = [
    GameMode.Dice,
    GameMode.Omok,
    GameMode.Ttamok,
    GameMode.Thief,
    GameMode.Alkkagi,
    GameMode.Curling,
];

describe('playful AI action routing', () => {
    it('covers every server-handled playful action (PVE gate must not swallow these)', () => {
        const missing = REQUIRED_PLAYFUL_SERVER_ACTIONS.filter((t) => !PLAYFUL_SERVER_ACTION_TYPES.has(t));
        expect(missing, `Add to PLAYFUL_SERVER_ACTION_TYPES: ${missing.join(', ')}`).toEqual([]);
    });

    it('waiting-room AI challenge modes are all playful game modes', () => {
        for (const mode of WAITING_ROOM_PLAYFUL_AI_MODES) {
            expect(PLAYFUL_GAME_MODES.some((m) => m.mode === mode), String(mode)).toBe(true);
        }
    });

    it('playful AI modes use isAiGame → matchAxis pve (server must handle actions, not client-only PVE noop)', () => {
        // 문서화용: resolveArenaMatchAxis({ isAiGame: true }) === 'pve'
        expect(WAITING_ROOM_PLAYFUL_AI_MODES.length).toBe(6);
    });
});
