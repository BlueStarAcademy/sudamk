import { GameMode, Player, type GameSettings } from '../types/index.js';

/** 페어 PVP 휴먼 팀에서 같은 팀 유저(본인 제외) id — 팀당 유저 2명일 때만 */
export function getPairPvpHumanTeammateUserId(
    settings: Pick<GameSettings, 'pairGame'> | undefined,
    userId: string,
): string | null {
    const pg = settings?.pairGame;
    if (!pg || pg.pairMode !== 'pvp') return null;
    for (const team of [pg.teamA, pg.teamB] as const) {
        const userMembers = (team.members ?? []).filter((m) => m.kind === 'user' && m.id);
        if (userMembers.length !== 2) continue;
        if (!userMembers.some((m) => m.id === userId)) continue;
        const other = userMembers.find((m) => m.id !== userId);
        return other?.id ?? null;
    }
    return null;
}

export function pairTeamIdForUserId(
    settings: Pick<GameSettings, 'pairGame'> | undefined,
    userId: string,
): 'teamA' | 'teamB' | null {
    const pg = settings?.pairGame;
    if (!pg) return null;
    if (pg.teamA.members.some((m) => m.id === userId)) return 'teamA';
    if (pg.teamB.members.some((m) => m.id === userId)) return 'teamB';
    return null;
}

/** 팀 전체 기권 시 승리 색(팀 단위 색 고정 수순에서 상대 팀 색) */
export function pairWinningPlayerWhenTeamResigns(
    settings: Pick<GameSettings, 'pairGame'> | undefined,
    resigningTeamId: 'teamA' | 'teamB',
): Player.Black | Player.White {
    const seat = settings?.pairGame?.turnOrder?.find((s) => s.teamId !== resigningTeamId);
    if (seat?.player === Player.Black || seat?.player === Player.White) return seat.player;
    return resigningTeamId === 'teamA' ? Player.White : Player.Black;
}

export type PairGameTurnSeatId = 'black1' | 'white1' | 'black2' | 'white2';
export type PairGameSeatKind = 'user' | 'ai' | 'pet';

export const PAIR_GO_GAME_MODES: readonly GameMode[] = [
    GameMode.Standard,
    GameMode.Capture,
    GameMode.Speed,
    GameMode.Base,
    GameMode.Hidden,
    GameMode.Missile,
    GameMode.Uniform,
    GameMode.Castle,
    GameMode.Chess,
    GameMode.Mix,
];

export type PairGameTurnSeat = {
    seatId: PairGameTurnSeatId;
    player: Player.Black | Player.White;
    order: 1 | 2;
    participantId: string;
    name: string;
    kind: PairGameSeatKind;
    teamId: 'teamA' | 'teamB';
    slot: string;
};

type PairParticipantLike = {
    id: string;
    name: string;
    kind: PairGameSeatKind;
    slot: string;
};

export const PAIR_TURN_SEAT_IDS: PairGameTurnSeatId[] = ['black1', 'white1', 'black2', 'white2'];

/**
 * 장내 페어 챔피언십 실대국(`generateChampionshipRealMatch`)용 4인 수순.
 * 팀 보존 수순(`buildTeamPreservingPairTurnOrder`)과 동일하게 흑1·백1·흑2·백2로 두며,
 * 각 팀 내에서 유저·펫의 1·2번 자리만 무작위로 섞는다.
 */
export function buildChampionshipVersusPetPairTurnOrder(params: {
    blackUser: { id: string; nickname: string };
    whiteUser: { id: string; nickname: string };
    blackPet: { participantId: string; displayName: string };
    whitePet: { participantId: string; displayName: string };
    rng?: () => number;
}): PairGameTurnSeat[] {
    const rng = params.rng ?? Math.random;
    const shuffled = <T,>(items: T[]): T[] => {
        const out = [...items];
        for (let i = out.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [out[i], out[j]] = [out[j]!, out[i]!];
        }
        return out;
    };

    type M = { id: string; name: string; kind: PairGameSeatKind; slot: string; teamId: 'teamA' | 'teamB' };
    const blackMembers = shuffled<M>([
        { id: params.blackUser.id, name: params.blackUser.nickname, kind: 'user', slot: 'user', teamId: 'teamA' },
        { id: params.blackPet.participantId, name: params.blackPet.displayName, kind: 'pet', slot: 'pet', teamId: 'teamA' },
    ]);
    const whiteMembers = shuffled<M>([
        { id: params.whiteUser.id, name: params.whiteUser.nickname, kind: 'user', slot: 'user', teamId: 'teamB' },
        { id: params.whitePet.participantId, name: params.whitePet.displayName, kind: 'pet', slot: 'pet', teamId: 'teamB' },
    ]);

    const toSeat = (seatId: PairGameTurnSeatId, p: M): PairGameTurnSeat => {
        const player = seatId.startsWith('black') ? Player.Black : Player.White;
        const order = seatId.endsWith('1') ? 1 : 2;
        return {
            seatId,
            player,
            order,
            participantId: p.id,
            name: p.name,
            kind: p.kind,
            teamId: p.teamId,
            slot: p.slot,
        };
    };

    return [
        toSeat('black1', blackMembers[0]!),
        toSeat('white1', whiteMembers[0]!),
        toSeat('black2', blackMembers[1]!),
        toSeat('white2', whiteMembers[1]!),
    ];
}

/** 대국실 채팅 등: 페어 좌석 ID를 짧은 한글 라벨로 */
export function pairTurnSeatIdShortLabel(seatId: string): string {
    return seatId === 'black1'
        ? '흑1'
        : seatId === 'black2'
          ? '흑2'
          : seatId === 'white1'
            ? '백1'
            : seatId === 'white2'
              ? '백2'
              : seatId;
}

export function isPairClassicGame(settings: Pick<GameSettings, 'pairGame'> | undefined, mode?: GameMode): boolean {
    return Boolean(settings?.pairGame && (mode == null || PAIR_GO_GAME_MODES.includes(mode)));
}

/**
 * 2인이 같은 팀(팀 A)으로 AI 팀만 상대하는 페어 협동전(`pairMode === 'ai'` + 유저 2명).
 * 매너 액션은 팀 간 경쟁(PvP)에서만 사용한다.
 */
export function isPairCooperativeTwoHumansVsAi(settings: Pick<GameSettings, 'pairGame'> | undefined): boolean {
    const pg = settings?.pairGame;
    if (!pg || pg.pairMode !== 'ai') return false;
    const usersOnTeamA = (pg.teamA?.members ?? []).filter((m) => m.kind === 'user').length;
    return usersOnTeamA >= 2;
}

function shuffled<T>(items: T[], rng: () => number = Math.random): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
}

export function buildRandomPairTurnOrder(
    pairGame: NonNullable<GameSettings['pairGame']>,
    rng: () => number = Math.random
): PairGameTurnSeat[] {
    const participants: Array<PairParticipantLike & { teamId: 'teamA' | 'teamB' }> = [
        ...pairGame.teamA.members.map((m) => ({ ...m, teamId: 'teamA' as const })),
        ...pairGame.teamB.members.map((m) => ({ ...m, teamId: 'teamB' as const })),
    ].filter((m) => Boolean(m.id));

    const picked = shuffled(participants, rng).slice(0, 4);
    if (picked.length < 4) {
        throw new Error('페어 대국에는 4명의 참가자가 필요합니다.');
    }

    return picked.map((p, index) => {
        const seatId = PAIR_TURN_SEAT_IDS[index]!;
        const player = seatId.startsWith('black') ? Player.Black : Player.White;
        const order = seatId.endsWith('1') ? 1 : 2;
        return {
            seatId,
            player,
            order,
            participantId: p.id,
            name: p.name,
            kind: p.kind,
            teamId: p.teamId,
            slot: p.slot,
        };
    });
}

/**
 * 팀 A/B가 각각 흑·백 두 자리에 붙어 있도록 수순을 만든다.
 * (팀원끼리 서로 다른 색으로 갈라지는 `buildRandomPairTurnOrder`와 달리 팀 단위로만 색이 나뉜다.)
 * 어느 팀이 흑인지는 무작위이며, 팀 내 1·2번 자리 순서만 섞는다.
 */
export function buildTeamPreservingPairTurnOrder(
    pairGame: NonNullable<GameSettings['pairGame']>,
    rng: () => number = Math.random
): PairGameTurnSeat[] {
    const teamA = pairGame.teamA.members
        .map((m) => ({ ...m, teamId: 'teamA' as const }))
        .filter((m): m is PairParticipantLike & { teamId: 'teamA' } => Boolean(m.id));
    const teamB = pairGame.teamB.members
        .map((m) => ({ ...m, teamId: 'teamB' as const }))
        .filter((m): m is PairParticipantLike & { teamId: 'teamB' } => Boolean(m.id));
    if (teamA.length < 2 || teamB.length < 2) {
        throw new Error('페어 대국에는 팀당 2명의 참가자가 필요합니다.');
    }
    const teamAOrdered = shuffled(teamA, rng).slice(0, 2);
    const teamBOrdered = shuffled(teamB, rng).slice(0, 2);
    const teamAIsBlack = rng() < 0.5;
    const blackTeam = teamAIsBlack ? teamAOrdered : teamBOrdered;
    const whiteTeam = teamAIsBlack ? teamBOrdered : teamAOrdered;

    const toSeat = (
        seatId: PairGameTurnSeatId,
        p: PairParticipantLike & { teamId: 'teamA' | 'teamB' }
    ): PairGameTurnSeat => {
        const player = seatId.startsWith('black') ? Player.Black : Player.White;
        const order = seatId.endsWith('1') ? 1 : 2;
        return {
            seatId,
            player,
            order,
            participantId: p.id,
            name: p.name,
            kind: p.kind,
            teamId: p.teamId,
            slot: p.slot,
        };
    };

    return [
        toSeat('black1', blackTeam[0]!),
        toSeat('white1', whiteTeam[0]!),
        toSeat('black2', blackTeam[1]!),
        toSeat('white2', whiteTeam[1]!),
    ];
}

export function syncPairTurnOrderWithAssignedColors(
    pairGame: NonNullable<GameSettings['pairGame']>,
    blackAnchorParticipantId: string | null | undefined,
    whiteAnchorParticipantId: string | null | undefined
): void {
    const teamFor = (participantId: string | null | undefined): 'teamA' | 'teamB' | null => {
        if (!participantId) return null;
        if (pairGame.teamA.members.some((m) => m.id === participantId)) return 'teamA';
        if (pairGame.teamB.members.some((m) => m.id === participantId)) return 'teamB';
        return null;
    };

    let blackTeamId = teamFor(blackAnchorParticipantId);
    let whiteTeamId = teamFor(whiteAnchorParticipantId);
    // 펫 페어 AI 대전의 실제 game.player2는 공용 AI 계정이지만, 페어 좌석은 pair-opponent-*로 표현된다.
    // 색 결정 단계(따내기/베이스)에서 공용 AI 계정이 흑/백으로 배정되면 남은 팀으로 보정한다.
    if (pairGame.pairMode === 'ai') {
        if (!blackTeamId && whiteTeamId) blackTeamId = whiteTeamId === 'teamA' ? 'teamB' : 'teamA';
        if (!whiteTeamId && blackTeamId) whiteTeamId = blackTeamId === 'teamA' ? 'teamB' : 'teamA';
    }
    if (!blackTeamId || !whiteTeamId || blackTeamId === whiteTeamId) return;

    const existing = pairGame.turnOrder ?? [];
    const orderedMembers = (teamId: 'teamA' | 'teamB') => {
        const sourceMembers = teamId === 'teamA' ? pairGame.teamA.members : pairGame.teamB.members;
        const byId = new Map(sourceMembers.map((m) => [m.id, { ...m, teamId }]));
        const fromExisting = existing
            .filter((seat) => seat.teamId === teamId)
            .sort((a, b) => a.order - b.order)
            .map((seat) => byId.get(seat.participantId))
            .filter((m): m is PairParticipantLike & { teamId: 'teamA' | 'teamB' } => Boolean(m));
        const seen = new Set(fromExisting.map((m) => m.id));
        const rest = sourceMembers
            .filter((m) => Boolean(m.id) && !seen.has(m.id))
            .map((m) => ({ ...m, teamId }));
        return [...fromExisting, ...rest].slice(0, 2);
    };

    const blackMembers = orderedMembers(blackTeamId);
    const whiteMembers = orderedMembers(whiteTeamId);
    if (blackMembers.length < 2 || whiteMembers.length < 2) return;

    const toSeat = (
        seatId: PairGameTurnSeatId,
        p: PairParticipantLike & { teamId: 'teamA' | 'teamB' }
    ): PairGameTurnSeat => {
        const player = seatId.startsWith('black') ? Player.Black : Player.White;
        const order = seatId.endsWith('1') ? 1 : 2;
        return {
            seatId,
            player,
            order,
            participantId: p.id,
            name: p.name,
            kind: p.kind,
            teamId: p.teamId,
            slot: p.slot,
        };
    };

    pairGame.turnOrder = [
        toSeat('black1', blackMembers[0]!),
        toSeat('white1', whiteMembers[0]!),
        toSeat('black2', blackMembers[1]!),
        toSeat('white2', whiteMembers[1]!),
    ];
    pairGame.currentTurnIndex = normalizePairTurnIndex(pairGame);
}

export function normalizePairTurnIndex(pairGame: NonNullable<GameSettings['pairGame']>): number {
    const len = pairGame.turnOrder?.length ?? 0;
    if (len <= 0) return 0;
    const raw = Number(pairGame.currentTurnIndex ?? 0);
    const n = Number.isFinite(raw) ? Math.floor(raw) : 0;
    return ((n % len) + len) % len;
}

export function getCurrentPairTurnSeat(settings: Pick<GameSettings, 'pairGame'> | undefined): PairGameTurnSeat | null {
    const pairGame = settings?.pairGame;
    const order = pairGame?.turnOrder;
    if (!pairGame || !Array.isArray(order) || order.length === 0) return null;
    return order[normalizePairTurnIndex(pairGame)] ?? null;
}

/**
 * 페어 AI 세션 중복 방지용 키 — moveHistory 길이만으로는 4인 수순(흑1→백1→흑2→백2)에서 다음 AI 좌석을 구분할 수 없다.
 */
export function buildPairAiSchedulingKey(
    settings: Pick<GameSettings, 'pairGame'> | undefined,
    moveCount: number,
    turnIndexOverride?: number,
): string | null {
    const pairGame = settings?.pairGame;
    const order = pairGame?.turnOrder;
    if (!pairGame || !order?.length) return null;
    const len = order.length;
    const raw =
        turnIndexOverride != null && Number.isFinite(turnIndexOverride)
            ? Math.floor(turnIndexOverride)
            : normalizePairTurnIndex(pairGame);
    const idx = ((raw % len) + len) % len;
    const seat = order[idx];
    if (!seat) return null;
    return `${moveCount}:${idx}:${seat.participantId}`;
}

export function getPairTurnSeatByParticipantId(
    settings: Pick<GameSettings, 'pairGame'> | undefined,
    participantId: string
): PairGameTurnSeat | null {
    return settings?.pairGame?.turnOrder?.find((s) => s.participantId === participantId) ?? null;
}

export function isPairAiSeat(seat: PairGameTurnSeat | null | undefined): boolean {
    return Boolean(seat && (seat.kind === 'ai' || seat.kind === 'pet' || seat.participantId.startsWith('pair-') || seat.participantId.startsWith('pet-ai-')));
}

export function advancePairTurn(settings: Pick<GameSettings, 'pairGame'> | undefined): PairGameTurnSeat | null {
    const pairGame = settings?.pairGame;
    if (!pairGame?.turnOrder?.length) return null;
    pairGame.currentTurnIndex = (normalizePairTurnIndex(pairGame) + 1) % pairGame.turnOrder.length;
    return getCurrentPairTurnSeat(settings);
}

export function resetPairPasses(settings: Pick<GameSettings, 'pairGame'> | undefined): void {
    if (settings?.pairGame) settings.pairGame.passSeatIds = [];
}

export function markPairSeatPassed(settings: Pick<GameSettings, 'pairGame'> | undefined, seat: PairGameTurnSeat): boolean {
    const pairGame = settings?.pairGame;
    if (!pairGame?.turnOrder?.length) return false;
    const prev = new Set(pairGame.passSeatIds ?? []);
    prev.add(seat.seatId);
    pairGame.passSeatIds = [...prev];
    return pairGame.turnOrder.every((s) => prev.has(s.seatId));
}

export function getPairHumanParticipantIds(pairGame: NonNullable<GameSettings['pairGame']>): string[] {
    return (pairGame.turnOrder ?? [])
        .filter((s) => s.kind === 'user')
        .map((s) => s.participantId);
}

/** 페어 좌석이 해당 유저(본인 펫 슬롯 `pet-ai-{id}` 포함)인지 — `Game.tsx`·컨트롤 아이템 표시와 동일 */
export function pairSeatMatchesViewerUser(seat: PairGameTurnSeat, userId: string): boolean {
    if (seat.kind === 'user') return seat.participantId === userId;
    if (seat.participantId.startsWith('pet-ai-')) {
        return seat.participantId.slice('pet-ai-'.length) === userId;
    }
    return false;
}

/** 페어 4인 수순에서 유저(본인 펫 슬롯 포함)의 흑/백 — `blackPlayerId`는 흑1 좌석만 가리킨다 */
export function resolvePairUserPlayerEnum(
    settings: Pick<GameSettings, 'pairGame'> | undefined,
    userId: string,
): Player.Black | Player.White | null {
    const order = settings?.pairGame?.turnOrder;
    if (!order?.length) return null;
    for (const seat of order) {
        if (pairSeatMatchesViewerUser(seat, userId)) {
            return seat.player;
        }
    }
    return null;
}

export function pairOrderRevealNeedsConfirmation(settings: Pick<GameSettings, 'pairGame'> | undefined): boolean {
    const pairGame = settings?.pairGame;
    if (!pairGame?.turnOrder?.length) return false;
    const humans = getPairHumanParticipantIds(pairGame);
    if (humans.length === 0) return false;
    return humans.some((id) => !pairGame.orderRevealConfirmed?.[id]);
}

export function confirmPairOrderReveal(
    settings: Pick<GameSettings, 'pairGame'> | undefined,
    participantId: string
): boolean {
    const pairGame = settings?.pairGame;
    if (!pairGame) return false;
    const humans = new Set(getPairHumanParticipantIds(pairGame));
    if (!humans.has(participantId)) return false;
    pairGame.orderRevealConfirmed = { ...(pairGame.orderRevealConfirmed ?? {}), [participantId]: true };
    return !pairOrderRevealNeedsConfirmation(settings);
}
