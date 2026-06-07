import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../shared/types/index.js';
import {
    buildPairLobbySettingChangeDiffRows,
    stripPairLobbyGuestProposableSettings,
} from '../../../shared/utils/pairLobbyGameSettingRows.js';

describe('pair lobby setting change diff', () => {
    it('returns empty diff when proposed settings match current room', () => {
        const rows = buildPairLobbySettingChangeDiffRows(
            {
                selectedGameMode: GameMode.Standard,
                settings: { boardSize: 19, timeLimit: 10 },
                roomKind: 'duo_match',
                lobbyChannel: 'strategic',
            },
            { boardSize: 19, timeLimit: 10 },
            { lobbyChannelFallback: 'strategic' },
        );
        expect(rows).toEqual([]);
    });

    it('detects changed display rows for guests', () => {
        const rows = buildPairLobbySettingChangeDiffRows(
            {
                selectedGameMode: GameMode.Standard,
                settings: { boardSize: 19, timeLimit: 10, byoyomiTime: 30, byoyomiCount: 3 },
                roomKind: 'duo_match',
                lobbyChannel: 'strategic',
            },
            { boardSize: 13, timeLimit: 10, byoyomiTime: 30, byoyomiCount: 3 },
            { lobbyChannelFallback: 'strategic' },
        );
        expect(rows.some((row) => row.label === '판 크기' && row.before === '19×19' && row.after === '13×13')).toBe(true);
    });

    it('ignores guest-forbidden fields when comparing', () => {
        const stripped = stripPairLobbyGuestProposableSettings({
            boardSize: 19,
            komi: 7.5,
            baseStones: 4,
            captureTarget: 5,
        });
        expect(stripped.komi).toBeUndefined();
        expect(stripped.baseStones).toBeUndefined();
        expect(stripped.captureTarget).toBeUndefined();
        expect(stripped.boardSize).toBe(19);
    });
});
