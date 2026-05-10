import { GameCategory, GameMode } from '../types/enums.js';
import type { GameSettings, LiveGameSession } from '../types/entities.js';
import { aiUserId } from '../constants/auth.js';

export type ArenaKind = 'normal' | 'singleplayer' | 'tower' | 'adventure' | 'guildwar';
export type ArenaStateBucket = 'liveGames' | 'singlePlayerGames' | 'towerGames';
export type ArenaMatchAxis = 'pve' | 'pvp' | 'mixed_pair';
export type PairTeamComposition =
    | 'human_ai_vs_human_ai'
    | 'human_human_vs_ai'
    | 'human_ai_vs_ai'
    | 'human_human_vs_human_human'
    | 'unknown';
export type ArenaTurnLimitMode = 'none' | 'scoringTurnLimit' | 'autoScoringTurns' | 'stageAutoScoring';

type SessionLike = Partial<LiveGameSession> & {
    id?: string;
    settings?: Partial<GameSettings> | null;
    gameCategory?: GameCategory | `${GameCategory}` | string;
    guildWarBoardId?: string;
    guildWarId?: string;
};

export type ArenaSessionPolicy = {
    kind: ArenaKind;
    matchAxis: ArenaMatchAxis;
    stateBucket: ArenaStateBucket;
    isPairGame: boolean;
    pairLobbyChannel?: 'pair' | 'strategic' | 'playful';
    pairTeamComposition: PairTeamComposition;
    isStrategicAiLike: boolean;
    turnLimitMode: ArenaTurnLimitMode;
    countPassAsTurn: boolean;
    usesAdventureScoringCap: boolean;
    isClientAuthoritativeForScoringSnapshot: boolean;
    deferAutoScoringAfterAi: boolean;
};

const hasNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export function modeIncludesCaptureRule(mode: unknown, settings: Pick<GameSettings, 'mixedModes'> | null | undefined): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings?.mixedModes?.includes?.(GameMode.Capture)));
}

export function modeIncludesBaseRule(mode: unknown, settings: Pick<GameSettings, 'mixedModes'> | null | undefined): boolean {
    return mode === GameMode.Base || (mode === GameMode.Mix && Boolean(settings?.mixedModes?.includes?.(GameMode.Base)));
}

export function modeIncludesBaseCaptureMix(mode: unknown, settings: Pick<GameSettings, 'mixedModes'> | null | undefined): boolean {
    return mode === GameMode.Mix &&
        Boolean(settings?.mixedModes?.includes?.(GameMode.Base)) &&
        Boolean(settings?.mixedModes?.includes?.(GameMode.Capture));
}

export function isAdventureSessionLike(session: SessionLike | null | undefined): boolean {
    if (!session) return false;
    const gc = String(session.gameCategory ?? '');
    return (
        gc === GameCategory.Adventure ||
        hasNonEmptyString(session.adventureStageId) ||
        hasNonEmptyString(session.adventureMonsterCodexId) ||
        typeof session.adventureEncounterDeadlineMs === 'number'
    );
}

export function isGuildWarSessionLike(session: SessionLike | null | undefined): boolean {
    if (!session) return false;
    const gc = String(session.gameCategory ?? '');
    return gc === GameCategory.GuildWar || hasNonEmptyString(session.guildWarBoardId) || hasNonEmptyString(session.guildWarId);
}

export function isPairSessionLike(session: SessionLike | null | undefined): boolean {
    return Boolean(session?.settings?.pairGame);
}

export function resolveArenaKind(session: SessionLike | null | undefined): ArenaKind {
    if (!session) return GameCategory.Normal;

    const gc = String(session.gameCategory ?? '');
    if (
        gc === GameCategory.Normal ||
        gc === GameCategory.SinglePlayer ||
        gc === GameCategory.Tower ||
        gc === GameCategory.Adventure ||
        gc === GameCategory.GuildWar
    ) {
        return gc as ArenaKind;
    }

    if (isAdventureSessionLike(session)) return GameCategory.Adventure;
    if (isGuildWarSessionLike(session)) return GameCategory.GuildWar;
    if (session.isSinglePlayer || String(session.id ?? '').startsWith('sp-game-')) return GameCategory.SinglePlayer;
    if (session.towerFloor != null || (gc === '' && hasNonEmptyString(session.stageId) && String(session.id ?? '').startsWith('tower-'))) {
        return GameCategory.Tower;
    }
    if (gc === GameCategory.Tower || session.towerFloor != null) return GameCategory.Tower;

    return GameCategory.Normal;
}

export function getArenaStateBucket(kindOrSession: ArenaKind | SessionLike | null | undefined): ArenaStateBucket {
    const kind = typeof kindOrSession === 'string' ? kindOrSession : resolveArenaKind(kindOrSession);
    if (kind === GameCategory.SinglePlayer) return 'singlePlayerGames';
    if (kind === GameCategory.Tower) return 'towerGames';
    return 'liveGames';
}

type PairMemberKind = 'user' | 'ai' | 'pet';

function memberIsHuman(kind: PairMemberKind | undefined): boolean {
    return kind === 'user';
}

function memberIsAiLike(kind: PairMemberKind | undefined, id: unknown): boolean {
    return kind === 'ai' || kind === 'pet' || id === aiUserId;
}

function teamKinds(members: Array<{ id?: string; kind?: PairMemberKind }> | undefined): { humans: number; aiLike: number } {
    const rows = Array.isArray(members) ? members : [];
    return rows.reduce(
        (acc, member) => {
            if (memberIsHuman(member.kind)) acc.humans += 1;
            else if (memberIsAiLike(member.kind, member.id)) acc.aiLike += 1;
            return acc;
        },
        { humans: 0, aiLike: 0 },
    );
}

function normalizeTeamShape(team: { humans: number; aiLike: number }): 'human_human' | 'human_ai' | 'ai' | 'unknown' {
    if (team.humans >= 2 && team.aiLike === 0) return 'human_human';
    if (team.humans >= 1 && team.aiLike >= 1) return 'human_ai';
    if (team.humans === 0 && team.aiLike >= 1) return 'ai';
    return 'unknown';
}

export function resolvePairTeamComposition(settings: Pick<GameSettings, 'pairGame'> | null | undefined): PairTeamComposition {
    const pairGame = settings?.pairGame;
    if (!pairGame) return 'unknown';

    const teamA = normalizeTeamShape(teamKinds(pairGame.teamA?.members));
    const teamB = normalizeTeamShape(teamKinds(pairGame.teamB?.members));
    const ordered = [teamA, teamB].sort().join('_vs_');

    if (teamA === 'human_ai' && teamB === 'human_ai') return 'human_ai_vs_human_ai';
    if (ordered === 'ai_vs_human_human') return 'human_human_vs_ai';
    if (ordered === 'ai_vs_human_ai') return 'human_ai_vs_ai';
    if (teamA === 'human_human' && teamB === 'human_human') return 'human_human_vs_human_human';
    return 'unknown';
}

export function resolveArenaMatchAxis(session: SessionLike | null | undefined): ArenaMatchAxis {
    const pairComposition = resolvePairTeamComposition(session?.settings);
    if (pairComposition === 'human_ai_vs_human_ai' || pairComposition === 'human_human_vs_ai' || pairComposition === 'human_ai_vs_ai') {
        return 'mixed_pair';
    }
    if (isPairSessionLike(session)) {
        return pairComposition === 'human_human_vs_human_human' ? 'pvp' : 'mixed_pair';
    }

    const kind = resolveArenaKind(session);
    if (
        kind === GameCategory.SinglePlayer ||
        kind === GameCategory.Tower ||
        kind === GameCategory.Adventure ||
        Boolean(session?.isAiGame)
    ) {
        return 'pve';
    }
    return 'pvp';
}

export function resolveArenaSessionPolicy(session: SessionLike | null | undefined): ArenaSessionPolicy {
    const kind = resolveArenaKind(session);
    const settings = session?.settings ?? undefined;
    const isPairGame = isPairSessionLike(session);
    const pairTeamComposition = resolvePairTeamComposition(settings);
    const matchAxis = resolveArenaMatchAxis(session);
    const captureRule = modeIncludesCaptureRule(session?.mode, settings);

    const usesAdventureScoringCap = kind === GameCategory.Adventure && !captureRule;
    const countPassAsTurn =
        !captureRule &&
        !isPairGame &&
        matchAxis === 'pvp' &&
        kind === GameCategory.Normal &&
        !session?.isSinglePlayer &&
        !session?.isAiGame &&
        Number(settings?.scoringTurnLimit ?? 0) > 0;

    const turnLimitMode: ArenaTurnLimitMode = captureRule
        ? 'none'
        : kind === GameCategory.SinglePlayer
          ? 'stageAutoScoring'
          : kind === GameCategory.Tower || kind === GameCategory.GuildWar
            ? 'autoScoringTurns'
              : Number((settings as any)?.autoScoringTurns ?? 0) > 0
              ? 'autoScoringTurns'
              : Number(settings?.scoringTurnLimit ?? 0) > 0
                ? 'scoringTurnLimit'
                : 'none';

    const isStrategicAiLike = Boolean(session?.isAiGame) && kind !== GameCategory.SinglePlayer && kind !== GameCategory.Tower;

    return {
        kind,
        matchAxis,
        stateBucket: getArenaStateBucket(kind),
        isPairGame,
        pairLobbyChannel: settings?.pairGame?.lobbyChannel,
        pairTeamComposition,
        isStrategicAiLike,
        turnLimitMode,
        countPassAsTurn,
        usesAdventureScoringCap,
        isClientAuthoritativeForScoringSnapshot: kind === GameCategory.SinglePlayer || kind === GameCategory.Tower,
        deferAutoScoringAfterAi: kind === GameCategory.SinglePlayer || kind === GameCategory.Tower || isStrategicAiLike,
    };
}
