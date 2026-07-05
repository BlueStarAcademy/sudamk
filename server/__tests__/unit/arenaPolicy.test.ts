import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { GameSettings, LiveGameSession } from '../../../shared/types/index.js';
import {
    isPairHumanHumanPvpForTeamResign,
    resolveArenaKind,
    resolveArenaMatchAxis,
    resolveArenaSessionPolicy,
    resolvePairTeamComposition,
} from '../../../shared/utils/liveSessionArenaKind.js';
import { getAdventureDesignScoringTurnLimit } from '../../../shared/utils/adventureBattleBoard.js';
import { getArenaTurnCount, resolveArenaFixedScoringTurnLimit } from '../../utils/arenaTurnPolicy.js';

const settings = (patch: Partial<GameSettings> = {}): GameSettings =>
    ({
        boardSize: 11,
        komi: 0.5,
        timeLimit: 10,
        byoyomiTime: 0,
        byoyomiCount: 0,
        ...patch,
    }) as GameSettings;

const session = (patch: Partial<LiveGameSession> = {}): LiveGameSession =>
    ({
        id: 'arena-policy-test',
        mode: GameMode.Standard,
        gameCategory: GameCategory.Normal,
        isSinglePlayer: false,
        isAiGame: false,
        settings: settings({ scoringTurnLimit: 60 }),
        moveHistory: [],
        currentPlayer: Player.Black,
        ...patch,
    }) as LiveGameSession;

const pairSettings = (
    teamA: Array<{ id: string; kind: 'user' | 'ai' | 'pet' }>,
    teamB: Array<{ id: string; kind: 'user' | 'ai' | 'pet' }>,
    pairMode: 'ai' | 'pvp' = 'ai',
): Pick<GameSettings, 'pairGame'> => ({
    pairGame: {
        roomId: 'pair-test',
        pairMode,
        teamA: { name: 'A', members: teamA.map((m, i) => ({ ...m, name: m.id, slot: `a${i}` })) },
        teamB: { name: 'B', members: teamB.map((m, i) => ({ ...m, name: m.id, slot: `b${i}` })) },
    },
});

describe('arena policy', () => {
    it('classifies PVE, PVP, and mixed pair axes', () => {
        expect(resolveArenaMatchAxis(session({ gameCategory: GameCategory.Adventure, isAiGame: true }))).toBe('pve');
        expect(resolveArenaMatchAxis(session({ gameCategory: GameCategory.SinglePlayer, isSinglePlayer: true }))).toBe('pve');
        expect(resolveArenaMatchAxis(session({ gameCategory: GameCategory.Tower, isAiGame: true }))).toBe('pve');
        expect(resolveArenaMatchAxis(session({ gameCategory: GameCategory.GuildWar, isAiGame: false }))).toBe('pve');
        expect(resolveArenaMatchAxis(session({ gameCategory: GameCategory.Normal, isAiGame: false }))).toBe('pvp');
        expect(
            resolveArenaMatchAxis(
                session({
                    settings: settings(pairSettings([{ id: 'h1', kind: 'user' }, { id: 'ai1', kind: 'ai' }], [{ id: 'h2', kind: 'user' }, { id: 'ai2', kind: 'ai' }])),
                }),
            ),
        ).toBe('pve');
        expect(
            resolveArenaMatchAxis(
                session({
                    settings: settings(
                        pairSettings(
                            [{ id: 'h1', kind: 'user' }, { id: 'pet1', kind: 'pet' }],
                            [{ id: 'h2', kind: 'user' }, { id: 'pet2', kind: 'pet' }],
                            'pvp',
                        ),
                    ),
                }),
            ),
        ).toBe('pvp');
    });

    it('detects pair team compositions', () => {
        expect(resolvePairTeamComposition(pairSettings([{ id: 'h1', kind: 'user' }, { id: 'ai1', kind: 'ai' }], [{ id: 'h2', kind: 'user' }, { id: 'ai2', kind: 'ai' }]))).toBe(
            'human_ai_vs_human_ai',
        );
        expect(resolvePairTeamComposition(pairSettings([{ id: 'h1', kind: 'user' }, { id: 'h2', kind: 'user' }], [{ id: 'ai1', kind: 'ai' }]))).toBe(
            'human_human_vs_ai',
        );
        expect(resolvePairTeamComposition(pairSettings([{ id: 'h1', kind: 'user' }, { id: 'ai1', kind: 'ai' }], [{ id: 'ai2', kind: 'ai' }]))).toBe(
            'human_ai_vs_ai',
        );
    });

    it('detects adventure even when gameCategory is missing and applies design turn caps', () => {
        const g = session({
            gameCategory: undefined,
            adventureStageId: 'lake_park',
            adventureMonsterCodexId: 'codex-1',
            settings: settings({ boardSize: 11, scoringTurnLimit: 85 }),
        });

        expect(resolveArenaKind(g)).toBe('adventure');
        expect(resolveArenaSessionPolicy(g).usesAdventureScoringCap).toBe(true);
        expect(getAdventureDesignScoringTurnLimit(11)).toBe(60);
        expect(getAdventureDesignScoringTurnLimit(13)).toBe(80);
    });

    it('counts PASS only for normal human strategic PvP', () => {
        const moves = [
            { x: 1, y: 1, player: Player.Black },
            { x: -1, y: -1, player: Player.White },
            { x: 2, y: 2, player: Player.Black },
        ];
        expect(getArenaTurnCount(session({ moveHistory: moves }))).toBe(3);
        expect(
            getArenaTurnCount(
                session({
                    gameCategory: GameCategory.Adventure,
                    isAiGame: true,
                    moveHistory: moves,
                }),
            ),
        ).toBe(2);
        expect(
            getArenaTurnCount(
                session({
                    gameCategory: GameCategory.GuildWar,
                    settings: settings({ autoScoringTurns: 20, scoringTurnLimit: 20 } as any),
                    moveHistory: moves,
                }),
            ),
        ).toBe(2);
    });

    it('exposes unified action and result policies per arena kind', () => {
        const pve = resolveArenaSessionPolicy(session({ gameCategory: GameCategory.SinglePlayer, isSinglePlayer: true }));
        expect(pve.requiresClientSyncBeforeAction).toBe(true);
        expect(pve.resultDisplayModel).toBe('waitScoringOverlay');
        expect(pve.resultRewardModel).toBe('pveSummary');
        expect(pve.allowsResultAdGoldDouble).toBe(true);

        const pvp = resolveArenaSessionPolicy(session({ gameCategory: GameCategory.Normal, isAiGame: false }));
        expect(pvp.requiresClientSyncBeforeAction).toBe(false);
        expect(pvp.resultDisplayModel).toBe('instantEnd');
        expect(pvp.resultRewardModel).toBe('pvpSummary');
        expect(pvp.allowsResultAdGoldDouble).toBe(false);

        const pair = resolveArenaSessionPolicy(
            session({
                settings: settings(
                    pairSettings(
                        [
                            { id: 'h1', kind: 'user' },
                            { id: 'h2', kind: 'user' },
                        ],
                        [
                            { id: 'h3', kind: 'user' },
                            { id: 'h4', kind: 'user' },
                        ],
                    ),
                ),
            }),
        );
        expect(pair.isPairGame).toBe(true);
        expect(pair.resultRewardModel).toBe('pairSummary');
        expect(pair.allowsResultAdGoldDouble).toBe(true);
    });

    it('enables automatic base stone placement only for non-PvP Base-rule sessions', () => {
        const pveBase = resolveArenaSessionPolicy(session({
            mode: GameMode.Base,
            gameCategory: GameCategory.SinglePlayer,
            isSinglePlayer: true,
        }));
        const pveMixBase = resolveArenaSessionPolicy(session({
            mode: GameMode.Mix,
            gameCategory: GameCategory.SinglePlayer,
            isSinglePlayer: true,
            settings: settings({ mixedModes: [GameMode.Base, GameMode.Hidden] }),
        }));
        const pvpBase = resolveArenaSessionPolicy(session({ mode: GameMode.Base }));
        const guildWarBase = resolveArenaSessionPolicy(session({
            mode: GameMode.Base,
            gameCategory: GameCategory.GuildWar,
            isAiGame: false,
            settings: settings({ autoScoringTurns: 20, scoringTurnLimit: 20 } as any),
        }));
        const pveStandard = resolveArenaSessionPolicy(session({
            mode: GameMode.Standard,
            gameCategory: GameCategory.SinglePlayer,
            isSinglePlayer: true,
        }));

        expect(pveBase.usesAutomaticBaseStonePlacement).toBe(true);
        expect(pveMixBase.usesAutomaticBaseStonePlacement).toBe(true);
        expect(pvpBase.usesAutomaticBaseStonePlacement).toBe(false);
        expect(guildWarBase.matchAxis).toBe('pve');
        expect(guildWarBase.requiresClientSyncBeforeAction).toBe(true);
        expect(guildWarBase.usesServerKataAi).toBe(true);
        expect(guildWarBase.deferAutoScoringAfterAi).toBe(true);
        expect(guildWarBase.usesAutomaticBaseStonePlacement).toBe(true);
        expect(guildWarBase.resultRewardModel).toBe('pveSummary');
        expect(guildWarBase.turnLimitMode).toBe('autoScoringTurns');
        expect(guildWarBase.countPassAsTurn).toBe(false);
        expect(pveStandard.usesAutomaticBaseStonePlacement).toBe(false);
    });

    it('keeps pair turnLimitMode none but honors scoringTurnLimit for turn counting and auto scoring', async () => {
        const pairSession = session({
            settings: settings({
                scoringTurnLimit: 120,
                ...pairSettings(
                    [{ id: 'h1', kind: 'user' }, { id: 'pet1', kind: 'pet' }],
                    [{ id: 'ai1', kind: 'ai' }, { id: 'pet2', kind: 'pet' }],
                ),
            }),
        });
        const pairPve = resolveArenaSessionPolicy(pairSession);
        const pairPvp = resolveArenaSessionPolicy(
            session({
                settings: settings({
                    scoringTurnLimit: 120,
                    ...pairSettings(
                        [{ id: 'h1', kind: 'user' }, { id: 'pet1', kind: 'pet' }],
                        [{ id: 'h2', kind: 'user' }, { id: 'pet2', kind: 'pet' }],
                        'pvp',
                    ),
                }),
            }),
        );

        expect(pairPve.turnLimitMode).toBe('none');
        expect(pairPve.matchAxis).toBe('pve');
        expect(pairPve.countPassAsTurn).toBe(true);
        expect(pairPvp.turnLimitMode).toBe('none');
        expect(pairPvp.matchAxis).toBe('pvp');
        expect(pairPvp.countPassAsTurn).toBe(true);
        expect(await resolveArenaFixedScoringTurnLimit(pairSession)).toBe(120);

        const movesWithPass = [
            { x: 1, y: 1, player: Player.Black },
            { x: -1, y: -1, player: Player.White },
            { x: 2, y: 2, player: Player.Black },
        ];
        expect(getArenaTurnCount({ ...pairSession, moveHistory: movesWithPass })).toBe(3);
    });

    it('allows team-resign only for pair human-vs-human pvp', () => {
        const pairPvp = session({
            gameCategory: GameCategory.Normal,
            settings: settings({
                pairGame: {
                    roomId: 'pair-pvp',
                    pairMode: 'pvp',
                    teamA: {
                        name: 'A',
                        members: [
                            { id: 'h1', name: 'h1', kind: 'user', slot: 'a0' },
                            { id: 'h2', name: 'h2', kind: 'user', slot: 'a1' },
                        ],
                    },
                    teamB: {
                        name: 'B',
                        members: [
                            { id: 'h3', name: 'h3', kind: 'user', slot: 'b0' },
                            { id: 'h4', name: 'h4', kind: 'user', slot: 'b1' },
                        ],
                    },
                },
            } as any),
        });
        expect(isPairHumanHumanPvpForTeamResign(pairPvp)).toBe(true);
        expect(isPairHumanHumanPvpForTeamResign(session({ gameCategory: GameCategory.SinglePlayer, isSinglePlayer: true }))).toBe(false);
    });
});

