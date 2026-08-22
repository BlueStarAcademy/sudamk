import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import { generateStrategicRandomBoard } from '../../strategicInitialBoard.js';
import {
    appendPassesUntilSideToMove,
    attachKataOpeningSnapshotToSession,
    doesKataCombinedMovesReplayToBoard,
    encodeBoardStateAsKataSetupMovesFromEmpty,
    readKataOpeningBoardSnapshotFromSession,
} from '../../kataCaptureSetupEncoding.js';

/** 천상의 탑(유단자) 5관문 기본 배치 */
const YUDANJA_5_PLACEMENTS = {
    black: 4,
    white: 18,
    blackPattern: 8,
    whitePattern: 2,
};

describe('encodeBoardStateAsKataSetupMovesFromEmpty', () => {
    it('replays 유단자-5 style 13x13 capture openings without illegal moves', () => {
        let failures = 0;
        const samples = 40;
        for (let i = 0; i < samples; i++) {
            const { board } = generateStrategicRandomBoard(13, YUDANJA_5_PLACEMENTS, { maxAttempts: 80 });
            const setup = encodeBoardStateAsKataSetupMovesFromEmpty(board);
            const aligned = appendPassesUntilSideToMove(setup, Player.Black);
            if (!doesKataCombinedMovesReplayToBoard(13, aligned, board)) {
                failures += 1;
            }
        }
        expect(failures).toBe(0);
    });

    it('replays a white-to-move board-only encoding after the first black stone', () => {
        const { board } = generateStrategicRandomBoard(13, YUDANJA_5_PLACEMENTS, { maxAttempts: 80 });
        let placed: { x: number; y: number } | null = null;
        outer: for (let y = 0; y < 13; y++) {
            for (let x = 0; x < 13; x++) {
                if (board[y]![x] === Player.None) {
                    board[y]![x] = Player.Black;
                    placed = { x, y };
                    break outer;
                }
            }
        }
        expect(placed).not.toBeNull();
        const setup = encodeBoardStateAsKataSetupMovesFromEmpty(board);
        const aligned = appendPassesUntilSideToMove(setup, Player.White);
        expect(doesKataCombinedMovesReplayToBoard(13, aligned, board)).toBe(true);
    });

    it('persists the opening snapshot on settings so SQLite reload can restore Kata prefix', () => {
        const { board } = generateStrategicRandomBoard(13, YUDANJA_5_PLACEMENTS, { maxAttempts: 80 });
        const game: { settings: Record<string, unknown> } = { settings: {} };
        attachKataOpeningSnapshotToSession(game, board);
        const snap = readKataOpeningBoardSnapshotFromSession(game);
        expect(snap?.length).toBe(13);
        expect(game.settings.kataStrategicOpeningBoardState).toBe(snap);
        expect(Array.isArray(game.settings.kataCaptureSetupMoves)).toBe(true);
        expect((game.settings.kataCaptureSetupMoves as unknown[]).length).toBeGreaterThan(0);
    });
});
