import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { GameSettings, LiveGameSession } from '../../../shared/types/index.js';
import {
    getArenaStateBucket,
    isPairHumanHumanPvpForTeamResign,
    resolveArenaKind,
    resolveArenaMatchAxis,
    resolveArenaSessionPolicy,
    resolvePairTeamComposition,
} from '../../../shared/utils/liveSessionArenaKind.js';
import { getAdventureDesignScoringTurnLimit } from '../../../shared/utils/adventureBattleBoard.js';
import { coerceAdventureLiveGameScoringTurnLimit } from '../../../utils/clientGameMergePolicy.js';
import {
    getArenaTurnCount,
    resolveArenaConfiguredTurnLimit,
    resolveArenaFixedScoringTurnLimit,
} from '../../utils/arenaTurnPolicy.js';

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

    it('prefers adventure markers over a stale normal gameCategory', () => {
        const g = session({
            gameCategory: GameCategory.Normal,
            adventureStageId: 'lake_park',
            isAiGame: true,
        });
        expect(resolveArenaKind(g)).toBe('adventure');
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

    it('exposes pair turnLimitMode as scoringTurnLimit (policy is authoritative)', async () => {
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

        expect(pairPve.turnLimitMode).toBe('scoringTurnLimit');
        expect(pairPve.matchAxis).toBe('pve');
        expect(pairPve.countPassAsTurn).toBe(true);
        expect(pairPvp.turnLimitMode).toBe('scoringTurnLimit');
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

    it('does not count PASS for capture PvP, singleplayer/tower, or normal AI lobby', () => {
        const moves = [
            { x: 1, y: 1, player: Player.Black },
            { x: -1, y: -1, player: Player.White },
            { x: 2, y: 2, player: Player.Black },
        ];
        expect(getArenaTurnCount(session({ mode: GameMode.Capture, moveHistory: moves }))).toBe(2);
        expect(resolveArenaSessionPolicy(session({ mode: GameMode.Capture })).countPassAsTurn).toBe(false);
        expect(
            getArenaTurnCount(session({ gameCategory: GameCategory.SinglePlayer, isSinglePlayer: true, moveHistory: moves })),
        ).toBe(2);
        expect(getArenaTurnCount(session({ gameCategory: GameCategory.Tower, moveHistory: moves }))).toBe(2);
        expect(getArenaTurnCount(session({ gameCategory: GameCategory.Normal, isAiGame: true, moveHistory: moves }))).toBe(2);
        expect(resolveArenaConfiguredTurnLimit(session({ mode: GameMode.Capture }))).toBe(0);
    });

    it('covers adventure board caps for all sizes and capture exclusion', () => {
        expect(getAdventureDesignScoringTurnLimit(7)).toBe(30);
        expect(getAdventureDesignScoringTurnLimit(9)).toBe(40);
        expect(getAdventureDesignScoringTurnLimit(19)).toBe(200);
        const captureAdventure = session({
            gameCategory: GameCategory.Adventure,
            mode: GameMode.Capture,
            isAiGame: true,
        });
        expect(resolveArenaSessionPolicy(captureAdventure).usesAdventureScoringCap).toBe(false);
        const wrong = session({
            gameCategory: GameCategory.Adventure,
            isAiGame: true,
            settings: settings({ boardSize: 11, scoringTurnLimit: 85 }),
        });
        expect((coerceAdventureLiveGameScoringTurnLimit(wrong as any).settings as any).scoringTurnLimit).toBe(60);
        const already = session({
            gameCategory: GameCategory.Adventure,
            isAiGame: true,
            settings: settings({ boardSize: 11, scoringTurnLimit: 60 }),
        });
        expect(coerceAdventureLiveGameScoringTurnLimit(already as any)).toBe(already);
    });

    it('classifies kind fallbacks and state buckets', () => {
        expect(resolveArenaKind(null)).toBe('normal');
        expect(resolveArenaKind({ id: 'sp-game-1' } as any)).toBe('singleplayer');
        expect(resolveArenaKind({ id: 'x', towerFloor: 3 } as any)).toBe('tower');
        expect(resolveArenaKind({ id: 'x', guildWarBoardId: 'board-1' } as any)).toBe('guildwar');
        expect(getArenaStateBucket(session({ gameCategory: GameCategory.SinglePlayer }))).toBe('singlePlayerGames');
        expect(getArenaStateBucket(session({ gameCategory: GameCategory.Tower }))).toBe('towerGames');
        expect(getArenaStateBucket(session({ gameCategory: GameCategory.Adventure }))).toBe('liveGames');
    });

    it('covers pair compositions incl. human-human, ai-vs-ai, unknown and mixed axis without pairMode', () => {
        expect(
            resolvePairTeamComposition(
                pairSettings(
                    [
                        { id: 'h1', kind: 'user' },
                        { id: 'h2', kind: 'user' },
                    ],
                    [
                        { id: 'h3', kind: 'user' },
                        { id: 'h4', kind: 'user' },
                    ],
                    'pvp',
                ),
            ),
        ).toBe('human_human_vs_human_human');
        expect(resolvePairTeamComposition(pairSettings([{ id: 'a1', kind: 'ai' }], [{ id: 'a2', kind: 'ai' }]))).toBe('ai_vs_ai');
        expect(resolvePairTeamComposition(undefined)).toBe('unknown');
        expect(resolvePairTeamComposition(pairSettings([{ id: 'h1', kind: 'user' }], [{ id: 'h2', kind: 'user' }]))).toBe('unknown');

        const noMode = pairSettings(
            [
                { id: 'h1', kind: 'user' },
                { id: 'pet1', kind: 'pet' },
            ],
            [
                { id: 'h2', kind: 'user' },
                { id: 'pet2', kind: 'pet' },
            ],
        );
        (noMode.pairGame as any).pairMode = undefined;
        const mixed = session({ settings: settings(noMode as any) });
        expect(resolveArenaMatchAxis(mixed)).toBe('mixed_pair');
        const mixedPolicy = resolveArenaSessionPolicy(mixed);
        expect(mixedPolicy.compositionMatchAxis).toBe('mixed_pair');
        expect(mixedPolicy.hasMixedPairComposition).toBe(true);
        expect(mixedPolicy.isPveLike).toBe(true);

        // pairMode declares pvp, but composition stays visible via compositionMatchAxis
        const declaredPvp = resolveArenaSessionPolicy(
            session({
                settings: settings(
                    pairSettings(
                        [
                            { id: 'h1', kind: 'user' },
                            { id: 'pet1', kind: 'pet' },
                        ],
                        [
                            { id: 'h2', kind: 'user' },
                            { id: 'pet2', kind: 'pet' },
                        ],
                        'pvp',
                    ) as any,
                ),
            }),
        );
        expect(declaredPvp.matchAxis).toBe('pvp');
        expect(declaredPvp.compositionMatchAxis).toBe('mixed_pair');
    });

    it('exposes aiDispatchMode, scoringAuthority, isPveLike and hidden masking per axis', () => {
        const sp = resolveArenaSessionPolicy(session({ gameCategory: GameCategory.SinglePlayer, isSinglePlayer: true }));
        expect(sp.aiDispatchMode).toBe('clientKick');
        expect(sp.scoringAuthority).toBe('clientSnapshot');
        expect(sp.isPveLike).toBe(true);
        const adv = resolveArenaSessionPolicy(session({ gameCategory: GameCategory.Adventure, isAiGame: true }));
        expect(adv.aiDispatchMode).toBe('serverQueue');
        expect(adv.scoringAuthority).toBe('server');
        const pvp = resolveArenaSessionPolicy(session({ gameCategory: GameCategory.Normal, isAiGame: false }));
        expect(pvp.aiDispatchMode).toBe('none');
        expect(pvp.isPveLike).toBe(false);
        const hiddenMixed = resolveArenaSessionPolicy(
            session({
                mode: GameMode.Hidden,
                settings: settings({
                    scoringTurnLimit: 60,
                    ...(pairSettings(
                        [
                            { id: 'h1', kind: 'user' },
                            { id: 'pet1', kind: 'pet' },
                        ],
                        [{ id: 'ai1', kind: 'ai' }],
                    ) as any),
                }),
            }),
        );
        expect(hiddenMixed.masksHumanHiddenFromAi).toBe(true);
    });

    it('resolves guildwar mirrored turn limit preferring autoScoringTurns', async () => {
        const gw = session({
            gameCategory: GameCategory.GuildWar,
            isAiGame: false,
            settings: settings({ autoScoringTurns: 20, scoringTurnLimit: 99 } as any),
        });
        expect(await resolveArenaFixedScoringTurnLimit(gw)).toBe(20);
        const gwNoAuto = session({
            gameCategory: GameCategory.GuildWar,
            isAiGame: false,
            settings: settings({ scoringTurnLimit: 99 } as any),
        });
        expect(await resolveArenaFixedScoringTurnLimit(gwNoAuto)).toBeUndefined();
    });
});

