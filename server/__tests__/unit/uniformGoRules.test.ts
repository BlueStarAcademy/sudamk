import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import {
    assignRandomUniformDisplayColor,
    mapStoneToUniformDisplay,
    resolveTerritoryMarkerDisplayPlayer,
    resolveUniformStoneDisplayColorForBoard,
    sessionUsesUniformStoneDisplay,
    territoryMarkerRgba,
} from '../../../shared/utils/uniformGoRules.js';

describe('uniformGoRules', () => {
    it('sessionUsesUniformStoneDisplay: pure or mix member', () => {
        expect(sessionUsesUniformStoneDisplay(GameMode.Uniform, {})).toBe(true);
        expect(sessionUsesUniformStoneDisplay(GameMode.Mix, { mixedModes: [GameMode.Uniform, GameMode.Hidden] })).toBe(true);
        expect(sessionUsesUniformStoneDisplay(GameMode.Mix, { mixedModes: [GameMode.Hidden] })).toBe(false);
        expect(sessionUsesUniformStoneDisplay(GameMode.Standard, {})).toBe(false);
    });

    it('mapStoneToUniformDisplay remaps black and white only', () => {
        expect(mapStoneToUniformDisplay(Player.Black, Player.White)).toBe(Player.White);
        expect(mapStoneToUniformDisplay(Player.White, Player.Black)).toBe(Player.Black);
        expect(mapStoneToUniformDisplay(Player.None, Player.Black)).toBe(Player.None);
        expect(mapStoneToUniformDisplay(Player.Black, null)).toBe(Player.Black);
    });

    it('assignRandomUniformDisplayColor sets black or white', () => {
        const game = { uniformStoneDisplayColor: undefined } as { uniformStoneDisplayColor?: Player };
        assignRandomUniformDisplayColor(game as any);
        expect([Player.Black, Player.White]).toContain(game.uniformStoneDisplayColor);
    });

    it('resolveUniformStoneDisplayColorForBoard reveals actual colors during scoring', () => {
        expect(resolveUniformStoneDisplayColorForBoard('playing', Player.Black)).toBe(Player.Black);
        expect(resolveUniformStoneDisplayColorForBoard('scoring', Player.Black)).toBeNull();
        expect(resolveUniformStoneDisplayColorForBoard('ended', Player.White)).toBeNull();
        expect(resolveUniformStoneDisplayColorForBoard('no_contest', Player.White)).toBeNull();
    });

    it('resolveTerritoryMarkerDisplayPlayer uses actual B/W during scoring', () => {
        expect(resolveTerritoryMarkerDisplayPlayer(Player.Black, 'playing', Player.White)).toBe(Player.White);
        expect(resolveTerritoryMarkerDisplayPlayer(Player.White, 'playing', Player.White)).toBe(Player.White);
        expect(resolveTerritoryMarkerDisplayPlayer(Player.Black, 'scoring', Player.White)).toBe(Player.Black);
        expect(resolveTerritoryMarkerDisplayPlayer(Player.White, 'ended', Player.Black)).toBe(Player.White);
    });

    it('territoryMarkerRgba returns black or white rgba', () => {
        expect(territoryMarkerRgba(Player.Black, 0.85).fill).toContain('0, 0, 0');
        expect(territoryMarkerRgba(Player.White, 0.85).fill).toContain('255, 255, 255');
        expect(territoryMarkerRgba(Player.White, 0.85, { emphasizeActualColors: true }).stroke).toContain('55, 65, 81');
    });
});
