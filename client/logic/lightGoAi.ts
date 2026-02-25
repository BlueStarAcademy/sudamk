import type { LiveGameSession, Point } from '../../shared/types/index.js';
import { Player } from '../../shared/types/enums.js';
import { processMove } from '../../shared/logic/processMove.js';
import { getGoLogic } from './goLogic.js';

type ScoredMove = { move: Point; score: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function uniqKey(x: number, y: number) {
  return `${x},${y}`;
}

function isOnBoard(x: number, y: number, size: number) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getAllStones(board: number[][]): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board.length; x++) {
      if (board[y][x] !== Player.None) out.push({ x, y });
    }
  }
  return out;
}

// --- Level 10 focus memory (very small, per-game) ---
// 목적: 레벨10에서 "끊은 뒤 공격 지속(약점 추적)"을 다음 2~3수까지 유지.
type FocusMemory = {
  /** Inclusive upper bound of moveIndex (valid-move count) */
  untilMoveIndex: number;
  /** Stored focus centers (typically opponent weak-group liberties) */
  centers: Point[];
  /** last seen moveIndex to detect rewinds/new games */
  lastSeenMoveIndex: number;
};

const focusMemoryByGameId = new Map<string, FocusMemory>();

function dedupePoints(points: Point[], limit: number): Point[] {
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const p of points) {
    const k = uniqKey(p.x, p.y);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

type LightAiProfile = {
  level: number;
  /** Candidate generation around stones. */
  candidateRadius: number;
  candidateManhattanLimit: number;
  /** Cap for generated candidates (before legality filtering). */
  maxCandidates: number;
  /** Ensure at least this many candidates (adds coarse grid if below). */
  minCandidates: number;
  /** Opening: include star points or not. */
  openingSeed: boolean;

  /** Randomness/choice shaping. */
  jitterSigma: number;
  softmaxTemperature: number;
  pickTopN: number;
  blunderRate: number;
  blunderBucket: 'mid' | 'bad';

  /** Weights for scoring. */
  wSaveAtari: number;
  wCapture: number;
  wCreateAtari: number;
  wLiberty: number;
  wPositional: number;
  wConnect: number;
  wCut: number;
  selfAtariPenalty: number;

  /** 1-ply response suppression. */
  lookahead: {
    enabled: boolean;
    K: number;
    replyPenaltyWeight: number;
  };

  /** Very limited 2-ply for high levels: (my move) -> (opponent greedy reply) -> (my best continuation). */
  twoPly: {
    enabled: boolean;
    /** How many of the top moves to run 2-ply on. */
    K: number;
    /** How many continuation candidates to evaluate (focused locally). */
    continuationMaxCandidates: number;
    /** Radius around opponent reply/capture points to consider. */
    focusRadius: number;
    focusManhattanLimit: number;
    /** Reward weight for "attack continues" after opponent reply. */
    continuationWeight: number;
    /** Extra bonus when the first move was a cut and we can keep pressing. */
    cutChaseBonus: number;
  };

  /** Level 10 only: bias candidate generation toward opponent weaknesses. */
  focus: {
    enabled: boolean;
    /** Add extra candidates around focus centers. */
    radius: number;
    manhattanLimit: number;
    maxExtraCandidates: number;
    /** When capping candidates, how strongly to prefer closeness to focus. */
    capFocusWeight: number;
    /** Keep focus for N additional plies after creating weakness. */
    persistPlies: number;
  };
};

function getLightAiProfile(levelRaw: number, boardSize: number, moveIndex: number): LightAiProfile {
  const level = clamp(levelRaw || 5, 1, 10);

  // Keep these values small enough to run on mobile while still scaling smoothly.
  const candidateRadius = level <= 2 ? 1 : level <= 5 ? 2 : 3;
  const candidateManhattanLimit = level <= 2 ? 2 : level <= 6 ? 3 : 4;

  const openingSeed = true;

  const maxCandidates = clamp(
    (boardSize >= 19 ? 70 : boardSize >= 13 ? 55 : 45) + level * (boardSize >= 19 ? 20 : 16),
    60,
    260
  );
  const minCandidates = level <= 2 ? 14 : level <= 5 ? 18 : 22;

  // Randomness: low levels explore a lot; high levels are very stable.
  const jitterSigma = clamp(42 - level * 4, 4, 42);
  const softmaxTemperature = clamp(2.4 - level * 0.22, 0.18, 2.4);
  const pickTopN = clamp(3 + level, 4, 16);

  // Intentional "human-like" mistakes.
  const blunderRate = clamp(0.38 - level * 0.035, 0.03, 0.38);
  const blunderBucket: LightAiProfile['blunderBucket'] = level <= 4 ? 'bad' : 'mid';

  // Tactical weights scale with level.
  // Low levels: "capture-obsessed, weak connection"
  // High levels: more balanced, with stronger connection/cut instincts.
  const wSaveAtari = level <= 3 ? (700 + level * 120) : (1200 + level * 220);
  const wCapture = level <= 3 ? (1250 + level * 140) : (900 + level * 120);
  const wCreateAtari = level <= 3 ? (260 + level * 40) : (160 + level * 24);
  const wLiberty = 10 + level * 2;
  const wPositional = level <= 3 ? 0.6 : level <= 6 ? 0.9 : 1.1;

  // At low levels, self-atari is discouraged but not absolutely forbidden.
  const selfAtariPenalty = -(1200 + level * level * 320);

  // Connection / cut weights.
  // 1~3: basically ignore connection, don't value cutting much either.
  // 8~10: strongly value connecting own groups and splitting opponent groups.
  const wConnect = level <= 3 ? 40 : level <= 7 ? 160 : 420;
  const wCut = level <= 3 ? 60 : level <= 7 ? 190 : 520;

  const lookaheadEnabled = level >= 4 && moveIndex >= 2;
  const lookaheadK = clamp(level + 1, 5, 12);
  const replyPenaltyWeight = clamp(0.25 + level * 0.045, 0.35, 0.78);

  const twoPlyEnabled = level >= 8 && moveIndex >= 6;
  const twoPlyK = clamp(level - 1, 6, 10);
  const continuationMaxCandidates = clamp(35 + level * 7, 60, 110);
  const focusRadius = level >= 10 ? 3 : 2;
  const focusManhattanLimit = level >= 10 ? 4 : 3;
  const continuationWeight = clamp(0.25 + (level - 8) * 0.12, 0.25, 0.55);
  const cutChaseBonus = level >= 10 ? 280 : level >= 9 ? 200 : 140;

  const focusEnabled = level >= 10 && moveIndex >= 4;

  return {
    level,
    candidateRadius,
    candidateManhattanLimit,
    maxCandidates,
    minCandidates,
    openingSeed,
    jitterSigma,
    softmaxTemperature,
    pickTopN,
    blunderRate,
    blunderBucket,
    wSaveAtari,
    wCapture,
    wCreateAtari,
    wLiberty,
    wPositional,
    wConnect,
    wCut,
    selfAtariPenalty,
    lookahead: {
      enabled: lookaheadEnabled,
      K: lookaheadK,
      replyPenaltyWeight,
    },
    twoPly: {
      enabled: twoPlyEnabled,
      K: twoPlyK,
      continuationMaxCandidates,
      focusRadius,
      focusManhattanLimit,
      continuationWeight,
      cutChaseBonus,
    },
    focus: {
      enabled: focusEnabled,
      radius: 3,
      manhattanLimit: 4,
      maxExtraCandidates: 120,
      capFocusWeight: 0.55,
      persistPlies: 3,
    },
  };
}

function deriveWeakLibertyCenters(
  game: LiveGameSession,
  boardState: number[][],
  opponent: Player,
  maxGroups: number,
  maxCenters: number
): Point[] {
  const tmpGame: LiveGameSession = { ...game, boardState } as any;
  const logic = getGoLogic(tmpGame);
  const groups = logic.getAllGroups(opponent as any, boardState as any) as any[];
  const weakGroups = (groups || [])
    .filter((g) => (g.libertyPoints?.size ?? 99) <= 2)
    .sort((a, b) => {
      const al = a.libertyPoints?.size ?? 99;
      const bl = b.libertyPoints?.size ?? 99;
      if (al !== bl) return al - bl;
      const asz = a.stones?.length ?? 0;
      const bsz = b.stones?.length ?? 0;
      return bsz - asz;
    })
    .slice(0, maxGroups);

  const centers: Point[] = [];
  for (const g of weakGroups) {
    for (const key of Array.from(g.libertyPoints || [])) {
      const [x, y] = String(key).split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      centers.push({ x, y });
      if (centers.length >= maxCenters) break;
    }
    if (centers.length >= maxCenters) break;
  }
  return dedupePoints(centers, maxCenters);
}

function getCandidatePoints(game: LiveGameSession, profile: LightAiProfile, moveIndex: number, focusCenters?: Point[]): Point[] {
  const size = game.settings.boardSize ?? game.boardState.length;
  const board = game.boardState;
  const stones = getAllStones(board);
  const set = new Set<string>();
  const out: Point[] = [];

  const add = (x: number, y: number) => {
    if (!isOnBoard(x, y, size)) return;
    if (board[y][x] !== Player.None) return;
    const k = uniqKey(x, y);
    if (set.has(k)) return;
    set.add(k);
    out.push({ x, y });
  };

  // Opening: seed with a few standard points (3-4, 4-4-ish)
  if (profile.openingSeed && stones.length < 2) {
    const pts = size === 9 ? [2, 6] : size === 13 ? [3, 9] : [3, 9, 15];
    for (const x of pts) for (const y of pts) add(x, y);
  }

  // Midgame: focus around existing stones (radius N)
  for (const s of stones) {
    for (let dy = -profile.candidateRadius; dy <= profile.candidateRadius; dy++) {
      for (let dx = -profile.candidateRadius; dx <= profile.candidateRadius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > profile.candidateManhattanLimit) continue;
        add(s.x + dx, s.y + dy);
      }
    }
  }

  // Level 10: shift candidate center toward weaknesses (opponent atari / low-liberty groups).
  if (profile.focus.enabled && focusCenters && focusCenters.length > 0) {
    let added = 0;
    for (const c of focusCenters) {
      for (let dy = -profile.focus.radius; dy <= profile.focus.radius; dy++) {
        for (let dx = -profile.focus.radius; dx <= profile.focus.radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > profile.focus.manhattanLimit) continue;
          const before = out.length;
          add(c.x + dx, c.y + dy);
          if (out.length > before) {
            added++;
            if (added >= profile.focus.maxExtraCandidates) break;
          }
        }
        if (added >= profile.focus.maxExtraCandidates) break;
      }
      if (added >= profile.focus.maxExtraCandidates) break;
    }
  }

  // If still too few (very empty or weird state), just add a coarse grid.
  if (out.length < profile.minCandidates) {
    const step = size >= 19 ? (moveIndex < 8 ? 4 : 3) : 2;
    for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) add(x, y);
  }

  // Cap candidates (prefer closer to existing stones for tactical realism).
  if (stones.length > 0 && out.length > profile.maxCandidates) {
    const withDist = out.map((p) => {
      let best = Infinity;
      for (const s of stones) {
        const d = manhattan(p, s);
        if (d < best) best = d;
      }
      let focusBest = Infinity;
      if (profile.focus.enabled && focusCenters && focusCenters.length > 0) {
        for (const c of focusCenters) {
          const d = manhattan(p, c);
          if (d < focusBest) focusBest = d;
        }
      }
      // Lower is better. Blend distances so that level 10 prefers focus areas more.
      const blended = profile.focus.enabled && focusCenters && focusCenters.length > 0
        ? best * (1 - profile.focus.capFocusWeight) + focusBest * profile.focus.capFocusWeight
        : best;
      return { p, d: blended };
    });
    withDist.sort((a, b) => a.d - b.d);
    return withDist.slice(0, profile.maxCandidates).map((x) => x.p);
  }
  if (out.length > profile.maxCandidates) {
    return out.slice(0, profile.maxCandidates);
  }

  return out;
}

function getLegalMoves(
  game: LiveGameSession,
  aiPlayer: Player,
  profile: LightAiProfile,
  moveIndex: number,
  focusCenters?: Point[]
): { legal: Point[]; byKey: Map<string, ReturnType<typeof processMove>> } {
  const legal: Point[] = [];
  const byKey = new Map<string, ReturnType<typeof processMove>>();
  const size = game.settings.boardSize ?? game.boardState.length;
  const candidates = getCandidatePoints(game, profile, moveIndex, focusCenters);

  for (const p of candidates) {
    if (!isOnBoard(p.x, p.y, size)) continue;
    if (game.boardState[p.y]?.[p.x] !== Player.None) continue;
    const res = processMove(game.boardState, { x: p.x, y: p.y, player: aiPlayer }, game.koInfo, game.moveHistory.length, { ignoreSuicide: false });
    if (res.isValid) {
      legal.push(p);
      byKey.set(uniqKey(p.x, p.y), res);
    }
  }

  // Fallback: if no legal moves found in local candidates, expand to whole board (rare).
  if (legal.length === 0) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (game.boardState[y][x] !== Player.None) continue;
        const res = processMove(game.boardState, { x, y, player: aiPlayer }, game.koInfo, game.moveHistory.length, { ignoreSuicide: false });
        if (res.isValid) {
          legal.push({ x, y });
          byKey.set(uniqKey(x, y), res);
        }
      }
    }
  }

  return { legal, byKey };
}

function countLibertiesOfPlacedStone(game: LiveGameSession, boardAfter: number[][], aiPlayer: Player, placed: Point): number {
  const tmpGame: LiveGameSession = { ...game, boardState: boardAfter } as any;
  const logic = getGoLogic(tmpGame);
  const groups = logic.getAllGroups(aiPlayer as any, boardAfter as any);
  const g = groups.find((gr: any) => gr.stones?.some((s: Point) => s.x === placed.x && s.y === placed.y));
  return g?.libertyPoints?.size ?? 0;
}

function createsAtari(game: LiveGameSession, boardAfter: number[][], opponent: Player): number {
  const tmpGame: LiveGameSession = { ...game, boardState: boardAfter } as any;
  const logic = getGoLogic(tmpGame);
  const groups = logic.getAllGroups(opponent as any, boardAfter as any);
  let threatened = 0;
  for (const g of groups as any[]) {
    if ((g.libertyPoints?.size ?? 99) === 1) threatened++;
  }
  return threatened;
}

function savesOwnAtari(game: LiveGameSession, boardAfter: number[][], aiPlayer: Player): number {
  const logicBefore = getGoLogic(game);
  const groupsBefore = logicBefore.getAllGroups(aiPlayer as any, game.boardState as any) as any[];
  const beforeAtari = groupsBefore.filter((g) => (g.libertyPoints?.size ?? 99) === 1);
  if (beforeAtari.length === 0) return 0;

  const tmpGame: LiveGameSession = { ...game, boardState: boardAfter } as any;
  const logicAfter = getGoLogic(tmpGame);
  const groupsAfter = logicAfter.getAllGroups(aiPlayer as any, boardAfter as any) as any[];

  let saved = 0;
  for (const gb of beforeAtari) {
    const after = groupsAfter.find((ga) =>
      ga.stones?.some((s: Point) => gb.stones?.some((t: Point) => t.x === s.x && t.y === s.y))
    );
    if (after && (after.libertyPoints?.size ?? 0) > 1) saved++;
  }
  return saved;
}

function groupCount(game: LiveGameSession, board: number[][], player: Player): number {
  const tmpGame: LiveGameSession = { ...game, boardState: board } as any;
  const logic = getGoLogic(tmpGame);
  const groups = logic.getAllGroups(player as any, board as any) as any[];
  return groups?.length ?? 0;
}

function connectivityDelta(game: LiveGameSession, boardAfter: number[][], aiPlayer: Player, opponentPlayer: Player): { connect: number; cut: number } {
  // Positive connect: we merged our own groups (group count decreases)
  // Positive cut: we split opponent groups (group count increases)
  const myBefore = groupCount(game, game.boardState as any, aiPlayer);
  const oppBefore = groupCount(game, game.boardState as any, opponentPlayer);
  const myAfter = groupCount(game, boardAfter as any, aiPlayer);
  const oppAfter = groupCount(game, boardAfter as any, opponentPlayer);
  return {
    connect: clamp(myBefore - myAfter, -3, 3),
    cut: clamp(oppAfter - oppBefore, -3, 3),
  };
}

function connectivityDeltaBoards(game: LiveGameSession, boardBefore: number[][], boardAfter: number[][], aiPlayer: Player, opponentPlayer: Player): { connect: number; cut: number } {
  const myBefore = groupCount(game, boardBefore as any, aiPlayer);
  const oppBefore = groupCount(game, boardBefore as any, opponentPlayer);
  const myAfter = groupCount(game, boardAfter as any, aiPlayer);
  const oppAfter = groupCount(game, boardAfter as any, opponentPlayer);
  return {
    connect: clamp(myBefore - myAfter, -3, 3),
    cut: clamp(oppAfter - oppBefore, -3, 3),
  };
}

function positionalBias(game: LiveGameSession, p: Point, moveIndex: number): number {
  const size = game.settings.boardSize ?? game.boardState.length;
  // Early: prefer 3-4 / 4-4-ish; later: prefer flexibility (avoid first line unless needed)
  const edgeDist = Math.min(p.x, p.y, size - 1 - p.x, size - 1 - p.y);
  if (moveIndex < 10) {
    // Slight preference for 3rd/4th line over center in opening for human-like play.
    const target = size >= 19 ? 3 : size >= 13 ? 2 : 2;
    return -Math.abs(edgeDist - target) * 15;
  }
  // Mid/Late: first line is usually low value unless tactical.
  if (edgeDist === 0) return -40;
  if (edgeDist === 1) return -15;
  return 0;
}

function jitter(profile: LightAiProfile): number {
  const sigma = profile.jitterSigma;
  return (Math.random() - 0.5) * 2 * sigma;
}

function opponentGreedyReplyScore(game: LiveGameSession, boardAfterMyMove: number[][], koInfoAfter: LiveGameSession['koInfo'], opponent: Player, myPlayer: Player): number {
  const size = game.settings.boardSize ?? boardAfterMyMove.length;
  let best = -Infinity;

  // Evaluate only near stones for speed
  const tmpGame: LiveGameSession = { ...game, boardState: boardAfterMyMove, koInfo: koInfoAfter } as any;
  const moveIndex = (game.moveHistory || []).filter((m: any) => m.x >= 0 && m.y >= 0).length;
  const profile = getLightAiProfile(7, size, moveIndex); // fixed "tactical" lens for opponent greedy eval
  const candidates = getCandidatePoints(tmpGame, profile, moveIndex + 1);

  for (const p of candidates) {
    if (!isOnBoard(p.x, p.y, size)) continue;
    if (boardAfterMyMove[p.y]?.[p.x] !== Player.None) continue;
    const res = processMove(boardAfterMyMove as any, { x: p.x, y: p.y, player: opponent }, koInfoAfter, game.moveHistory.length + 1, { ignoreSuicide: false });
    if (!res.isValid) continue;

    const capture = res.capturedStones.length;
    const atari = createsAtari(game, res.newBoardState as any, myPlayer);
    const libs = countLibertiesOfPlacedStone(game, res.newBoardState as any, opponent, p);
    const selfAtari = libs === 1 && capture === 0;

    let score = 0;
    score += capture * 900;
    score += atari * 250;
    if (selfAtari) score -= 2000;
    score += positionalBias(tmpGame, p, game.moveHistory.length + 1) * 0.2;
    best = Math.max(best, score);
  }

  if (best === -Infinity) return 0;
  return best;
}

function opponentGreedyReplyMove(
  game: LiveGameSession,
  boardAfterMyMove: number[][],
  koInfoAfter: LiveGameSession['koInfo'],
  opponent: Player,
  myPlayer: Player
): { move: Point; result: ReturnType<typeof processMove> } | null {
  const size = game.settings.boardSize ?? boardAfterMyMove.length;
  let best: { move: Point; result: ReturnType<typeof processMove>; score: number } | null = null;

  const tmpGame: LiveGameSession = { ...game, boardState: boardAfterMyMove, koInfo: koInfoAfter } as any;
  const moveIndex = (game.moveHistory || []).filter((m: any) => m.x >= 0 && m.y >= 0).length;
  const profile = getLightAiProfile(7, size, moveIndex);
  const candidates = getCandidatePoints(tmpGame, profile, moveIndex + 1);

  for (const p of candidates) {
    if (!isOnBoard(p.x, p.y, size)) continue;
    if (boardAfterMyMove[p.y]?.[p.x] !== Player.None) continue;
    const res = processMove(boardAfterMyMove as any, { x: p.x, y: p.y, player: opponent }, koInfoAfter, game.moveHistory.length + 1, { ignoreSuicide: false });
    if (!res.isValid) continue;

    const capture = res.capturedStones.length;
    const atari = createsAtari(game, res.newBoardState as any, myPlayer);
    const libs = countLibertiesOfPlacedStone(game, res.newBoardState as any, opponent, p);
    const selfAtari = libs === 1 && capture === 0;

    let score = 0;
    score += capture * 900;
    score += atari * 250;
    if (selfAtari) score -= 2000;
    score += positionalBias(tmpGame, p, game.moveHistory.length + 1) * 0.2;

    if (!best || score > best.score) {
      best = { move: { x: p.x, y: p.y }, result: res, score };
    }
  }

  return best ? { move: best.move, result: best.result } : null;
}

function focusedCandidatePoints(
  board: number[][],
  boardSize: number,
  centers: Point[],
  radius: number,
  manhattanLimit: number,
  maxCandidates: number
): Point[] {
  const set = new Set<string>();
  const out: Point[] = [];

  const add = (x: number, y: number) => {
    if (!isOnBoard(x, y, boardSize)) return;
    if (board[y][x] !== Player.None) return;
    const k = uniqKey(x, y);
    if (set.has(k)) return;
    set.add(k);
    out.push({ x, y });
  };

  for (const c of centers) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > manhattanLimit) continue;
        add(c.x + dx, c.y + dy);
      }
    }
  }

  if (out.length > maxCandidates) return out.slice(0, maxCandidates);
  return out;
}

function bestContinuationScoreAfterReply(
  game: LiveGameSession,
  boardBeforeContinuation: number[][],
  koInfoBeforeContinuation: LiveGameSession['koInfo'],
  aiPlayer: Player,
  opponent: Player,
  profile: LightAiProfile,
  focusCenters: Point[]
): number {
  const size = game.settings.boardSize ?? boardBeforeContinuation.length;
  const candidates = focusedCandidatePoints(
    boardBeforeContinuation,
    size,
    focusCenters,
    profile.twoPly.focusRadius,
    profile.twoPly.focusManhattanLimit,
    profile.twoPly.continuationMaxCandidates
  );

  let best = -Infinity;
  for (const p of candidates) {
    const res = processMove(boardBeforeContinuation as any, { x: p.x, y: p.y, player: aiPlayer }, koInfoBeforeContinuation, game.moveHistory.length + 2, { ignoreSuicide: false });
    if (!res.isValid) continue;

    const capture = res.capturedStones.length;
    const libs = countLibertiesOfPlacedStone(game, res.newBoardState as any, aiPlayer, p);
    const selfAtari = libs === 1 && capture === 0;
    const threats = createsAtari(game, res.newBoardState as any, opponent);
    const cc = connectivityDeltaBoards(game, boardBeforeContinuation as any, res.newBoardState as any, aiPlayer, opponent);

    let score = 0;
    score += capture * (profile.wCapture * 0.85);
    score += threats * (profile.wCreateAtari * 0.75);
    score += cc.cut * (profile.wCut * 0.7);
    score += cc.connect * (profile.wConnect * 0.5);
    if (selfAtari) score += profile.selfAtariPenalty * 0.8;
    else score += clamp(libs, 0, 6) * (profile.wLiberty * 0.8);

    best = Math.max(best, score);
  }

  if (best === -Infinity) return 0;
  return best;
}

function softmaxPick(scored: ScoredMove[], temperature: number): ScoredMove {
  if (scored.length === 1) return scored[0];
  const t = Math.max(1e-6, temperature);
  const max = scored[0].score;
  // Normalize for numerical stability
  const exps = scored.map((s) => Math.exp((s.score - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < scored.length; i++) {
    r -= exps[i];
    if (r <= 0) return scored[i];
  }
  return scored[0];
}

function pickMoveByProfile(scoredSorted: ScoredMove[], profile: LightAiProfile): ScoredMove {
  if (scoredSorted.length === 1) return scoredSorted[0];

  // Blunder mode: choose from mid/bad bucket (still legal).
  if (Math.random() < profile.blunderRate) {
    if (profile.blunderBucket === 'bad') {
      const start = Math.floor(scoredSorted.length * 0.7);
      const bucket = scoredSorted.slice(start);
      return bucket[Math.floor(Math.random() * bucket.length)];
    }
    const start = Math.floor(scoredSorted.length * 0.3);
    const end = Math.floor(scoredSorted.length * 0.7);
    const bucket = scoredSorted.slice(start, Math.max(start + 1, end));
    return bucket[Math.floor(Math.random() * bucket.length)];
  }

  const top = scoredSorted.slice(0, Math.min(profile.pickTopN, scoredSorted.length));
  // High levels: temperature is tiny -> almost always best; low levels explore.
  return softmaxPick(top, profile.softmaxTemperature);
}

export function getLightGoAiMove(game: LiveGameSession, aiLevel: number): { move: Point; debug?: { top: ScoredMove[] } } {
  const aiPlayer = game.currentPlayer as Player;
  const opponent = aiPlayer === Player.Black ? Player.White : Player.Black;

  const moveIndex = (game.moveHistory || []).filter((m: any) => m.x >= 0 && m.y >= 0).length;
  const profile = getLightAiProfile(aiLevel, game.settings.boardSize ?? game.boardState.length, moveIndex);

  // Level 10: derive focus centers from opponent weak groups + persist them for a few plies after a successful cut/pressure.
  let focusCenters: Point[] | undefined = undefined;
  const gameId = (game as any).id as string | undefined;
  if (profile.focus.enabled && gameId) {
    const mem = focusMemoryByGameId.get(gameId);
    if (mem && moveIndex < mem.lastSeenMoveIndex) {
      // Game rewound/new session reused same id; drop memory.
      focusMemoryByGameId.delete(gameId);
    } else if (mem) {
      mem.lastSeenMoveIndex = moveIndex;
    }

    const fromBoard = deriveWeakLibertyCenters(game, game.boardState as any, opponent, 8, 14);
    const stillValidMem =
      mem && moveIndex <= mem.untilMoveIndex && Array.isArray(mem.centers) && mem.centers.length > 0;

    const combined = [
      ...(stillValidMem ? mem!.centers : []),
      ...fromBoard,
    ];
    const filtered = combined.filter((p) => game.boardState[p.y]?.[p.x] === Player.None);
    if (filtered.length > 0) focusCenters = dedupePoints(filtered, 18);
  }

  const { legal, byKey } = getLegalMoves(game, aiPlayer, profile, moveIndex, focusCenters);
  if (legal.length === 0) {
    return { move: { x: -1, y: -1 } };
  }

  const scored: ScoredMove[] = [];

  for (const p of legal) {
    const res = byKey.get(uniqKey(p.x, p.y))!;
    const capture = res.capturedStones.length;
    const libs = countLibertiesOfPlacedStone(game, res.newBoardState as any, aiPlayer, p);
    const selfAtari = libs === 1 && capture === 0;

    let score = 0;

    // 0) Save own atari groups (very important, often gnugo-like)
    const saved = savesOwnAtari(game, res.newBoardState as any, aiPlayer);
    score += saved * profile.wSaveAtari;

    // 1) Captures
    score += capture * profile.wCapture;

    // 2) Create atari threats
    const threats = createsAtari(game, res.newBoardState as any, opponent);
    score += threats * profile.wCreateAtari;

    // 3) Avoid self-atari unless it captures
    if (selfAtari) score += profile.selfAtariPenalty;
    else score += clamp(libs, 0, 6) * profile.wLiberty;

    // 4) Position bias (opening preference)
    score += positionalBias(game, p, moveIndex) * profile.wPositional;

    // 4-1) Connection / cut heuristics (high levels care a lot)
    const cc = connectivityDelta(game, res.newBoardState as any, aiPlayer, opponent);
    score += cc.connect * profile.wConnect;
    score += cc.cut * profile.wCut;

    // 5) Small randomization tied to level
    score += jitter(profile);

    scored.push({ move: p, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Optional 1-ply tactical lookahead for mid+ levels (keep cheap by limiting to top-K)
  if (profile.lookahead.enabled && scored.length > 1) {
    const consider = scored.slice(0, Math.min(profile.lookahead.K, scored.length));
    const reevaluated: ScoredMove[] = [];

    for (const sm of consider) {
      const res = byKey.get(uniqKey(sm.move.x, sm.move.y))!;
      const reply = opponentGreedyReplyScore(game, res.newBoardState as any, res.newKoInfo, opponent, aiPlayer);
      // Prefer moves that reduce opponent's immediate tactical gains
      const score = sm.score - reply * profile.lookahead.replyPenaltyWeight;
      reevaluated.push({ move: sm.move, score });
    }
    reevaluated.sort((a, b) => b.score - a.score);

    // Very limited 2-ply for high levels: chase weakness after opponent's greedy reply.
    if (profile.twoPly.enabled && reevaluated.length > 1) {
      const consider2 = reevaluated.slice(0, Math.min(profile.twoPly.K, reevaluated.length));
      const refined: ScoredMove[] = [];

      for (const sm of consider2) {
        const myRes = byKey.get(uniqKey(sm.move.x, sm.move.y))!;
        const oppReply = opponentGreedyReplyMove(game, myRes.newBoardState as any, myRes.newKoInfo, opponent, aiPlayer);
        if (!oppReply) {
          refined.push(sm);
          continue;
        }

        const afterOppBoard = oppReply.result.newBoardState as any as number[][];
        const afterOppKo = oppReply.result.newKoInfo;

        // Focus around opponent reply point and any stones they captured (weakness appears here).
        const centers: Point[] = [{ x: oppReply.move.x, y: oppReply.move.y }, ...oppReply.result.capturedStones];

        const cont = bestContinuationScoreAfterReply(game, afterOppBoard, afterOppKo, aiPlayer, opponent, profile, centers);
        const firstCut = connectivityDelta(game, myRes.newBoardState as any, aiPlayer, opponent).cut;

        let score = sm.score + cont * profile.twoPly.continuationWeight;
        if (firstCut > 0 && cont > 0) score += profile.twoPly.cutChaseBonus;
        refined.push({ move: sm.move, score });
      }

      // Keep the original rest behind; choose from refined by profile randomness.
      refined.sort((a, b) => b.score - a.score);
      const picked2 = pickMoveByProfile(refined, profile);
      // Update level10 focus memory after final selection.
      if (profile.focus.enabled && gameId) {
        const myRes = byKey.get(uniqKey(picked2.move.x, picked2.move.y));
        if (myRes?.isValid) {
          const cut = connectivityDelta(game, myRes.newBoardState as any, aiPlayer, opponent).cut;
          const threats = createsAtari(game, myRes.newBoardState as any, opponent);
          if (cut > 0 || threats > 0 || myRes.capturedStones.length > 0) {
            const centers = deriveWeakLibertyCenters(game, myRes.newBoardState as any, opponent, 10, 16);
            if (centers.length > 0) {
              focusMemoryByGameId.set(gameId, {
                untilMoveIndex: moveIndex + profile.focus.persistPlies,
                centers,
                lastSeenMoveIndex: moveIndex,
              });
            }
          }
        }
      }
      return { move: picked2.move, debug: { top: refined.slice(0, 5) } };
    }

    const picked = pickMoveByProfile(reevaluated, profile);
    if (profile.focus.enabled && gameId) {
      const myRes = byKey.get(uniqKey(picked.move.x, picked.move.y));
      if (myRes?.isValid) {
        const cut = connectivityDelta(game, myRes.newBoardState as any, aiPlayer, opponent).cut;
        const threats = createsAtari(game, myRes.newBoardState as any, opponent);
        if (cut > 0 || threats > 0 || myRes.capturedStones.length > 0) {
          const centers = deriveWeakLibertyCenters(game, myRes.newBoardState as any, opponent, 10, 16);
          if (centers.length > 0) {
            focusMemoryByGameId.set(gameId, {
              untilMoveIndex: moveIndex + profile.focus.persistPlies,
              centers,
              lastSeenMoveIndex: moveIndex,
            });
          }
        }
      }
    }
    return { move: picked.move, debug: { top: reevaluated.slice(0, 5) } };
  }

  const picked = pickMoveByProfile(scored, profile);
  if (profile.focus.enabled && gameId) {
    const myRes = byKey.get(uniqKey(picked.move.x, picked.move.y));
    if (myRes?.isValid) {
      const cut = connectivityDelta(game, myRes.newBoardState as any, aiPlayer, opponent).cut;
      const threats = createsAtari(game, myRes.newBoardState as any, opponent);
      if (cut > 0 || threats > 0 || myRes.capturedStones.length > 0) {
        const centers = deriveWeakLibertyCenters(game, myRes.newBoardState as any, opponent, 10, 16);
        if (centers.length > 0) {
          focusMemoryByGameId.set(gameId, {
            untilMoveIndex: moveIndex + profile.focus.persistPlies,
            centers,
            lastSeenMoveIndex: moveIndex,
          });
        }
      }
    }
  }
  return { move: picked.move, debug: { top: scored.slice(0, 5) } };
}

