import { GuildResearchId } from '../types/enums.js';
import { Player } from '../types/index.js';

/** Client presentation phases for guild boss arena polish */
export type GuildBossPresentationPhase = 'idle' | 'engage' | 'combat' | 'finale' | 'result';

export type GuildBossBoardTheme = 'wave' | 'burn' | 'nature' | 'mystery' | 'radiance';

export type GuildBossBoardStoneMove = {
    player: Player.Black | Player.White;
    x: number;
    y: number;
};

export type GuildBossBattleBoardConfig = {
    bossId: string;
    theme: GuildBossBoardTheme;
    boardSize: 9;
    sgfContent: string;
    moves: GuildBossBoardStoneMove[];
    moveCount: number;
};

/** Attack research shown under the user portrait */
export const GUILD_BOSS_ATTACK_RESEARCH_IDS: readonly GuildResearchId[] = [
    GuildResearchId.boss_skill_heal_block,
    GuildResearchId.boss_skill_regen,
    GuildResearchId.boss_skill_ignite,
];

/** Support research shown between user panel and damage ranking */
export const GUILD_BOSS_SUPPORT_RESEARCH_IDS: readonly GuildResearchId[] = [
    GuildResearchId.boss_hp_increase,
    GuildResearchId.boss_damage_increase,
    GuildResearchId.boss_attack_evasion,
    GuildResearchId.boss_hit_damage_reduction,
];

export const GUILD_BOSS_ENGAGE_MS = 1400;
export const GUILD_BOSS_FINALE_MS = 1000;
export const GUILD_BOSS_AMBIENT_MOVE_MS = 900;
export const GUILD_BOSS_OPENING_HP_BUFF_MS = 1400;
/** Stones placed during engage intro before combat logs advance the board */
export const GUILD_BOSS_ENGAGE_STONE_COUNT = 6;
export const GUILD_BOSS_ENGAGE_MOVE_MS = 200;

const coordToPoint = (coord: string): { x: number; y: number } => ({
    x: coord.charCodeAt(0) - 97,
    y: coord.charCodeAt(1) - 97,
});

/** Build SGF + move list from alternating B/W coords (cols/rows a–i). */
function buildBoardSequence(pairs: ReadonlyArray<readonly [string, string]>): {
    sgfContent: string;
    moves: GuildBossBoardStoneMove[];
} {
    const moves: GuildBossBoardStoneMove[] = [];
    let sgf = '(;SZ[9]';
    for (const [b, w] of pairs) {
        const bp = coordToPoint(b);
        moves.push({ player: Player.Black, x: bp.x, y: bp.y });
        sgf += `;B[${b}]`;
        if (w) {
            const wp = coordToPoint(w);
            moves.push({ player: Player.White, x: wp.x, y: wp.y });
            sgf += `;W[${w}]`;
        }
    }
    sgf += ')';
    return { sgfContent: sgf, moves };
}

const BOSS_SEQUENCES: Record<string, ReturnType<typeof buildBoardSequence>> = {
    boss_1: buildBoardSequence([
        ['cc', 'gg'],
        ['gc', 'cg'],
        ['ee', 'ef'],
        ['fe', 'df'],
        ['de', 'eg'],
        ['fg', 'cf'],
        ['cd', 'gh'],
        ['hc', 'bg'],
        ['bb', 'hh'],
        ['ib', 'bi'],
        ['dc', 'gd'],
        ['fd', 'ce'],
    ]),
    boss_2: buildBoardSequence([
        ['ee', 'cc'],
        ['gg', 'cg'],
        ['gc', 'ef'],
        ['fe', 'df'],
        ['eg', 'fg'],
        ['ff', 'dd'],
        ['cd', 'gf'],
        ['fc', 'dg'],
        ['ce', 'ge'],
        ['hd', 'bh'],
        ['hb', 'bi'],
        ['ii', 'aa'],
    ]),
    boss_3: buildBoardSequence([
        ['cf', 'gc'],
        ['fg', 'cd'],
        ['ee', 'gg'],
        ['cc', 'eg'],
        ['ge', 'df'],
        ['fd', 'de'],
        ['ef', 'fe'],
        ['dg', 'fc'],
        ['bc', 'hg'],
        ['hb', 'bi'],
        ['ib', 'hh'],
        ['ci', 'ic'],
    ]),
    boss_4: buildBoardSequence([
        ['dd', 'ff'],
        ['ce', 'ge'],
        ['eg', 'gc'],
        ['cg', 'ec'],
        ['ee', 'ef'],
        ['fe', 'df'],
        ['fc', 'fg'],
        ['bb', 'hh'],
        ['ih', 'bi'],
        ['gb', 'ci'],
        ['hd', 'db'],
        ['af', 'fa'],
    ]),
    boss_5: buildBoardSequence([
        ['ee', 'cc'],
        ['gg', 'cg'],
        ['gc', 'eg'],
        ['ce', 'ge'],
        ['ef', 'fe'],
        ['df', 'fd'],
        ['de', 'fg'],
        ['gf', 'cd'],
        ['bb', 'ii'],
        ['ib', 'bi'],
        ['hc', 'bh'],
        ['ah', 'ha'],
    ]),
};

const BOSS_THEME: Record<string, GuildBossBoardTheme> = {
    boss_1: 'wave',
    boss_2: 'burn',
    boss_3: 'nature',
    boss_4: 'mystery',
    boss_5: 'radiance',
};

export function getGuildBossBattleBoardConfig(bossId: string): GuildBossBattleBoardConfig {
    const id = BOSS_SEQUENCES[bossId] ? bossId : 'boss_1';
    const seq = BOSS_SEQUENCES[id];
    return {
        bossId: id,
        theme: BOSS_THEME[id] ?? 'wave',
        boardSize: 9,
        sgfContent: seq.sgfContent,
        moves: seq.moves,
        moveCount: seq.moves.length,
    };
}

export function getGuildBossBoardMoveAt(bossId: string, moveIndexZeroBased: number): GuildBossBoardStoneMove | null {
    const config = getGuildBossBattleBoardConfig(bossId);
    if (config.moves.length === 0) return null;
    const idx = ((moveIndexZeroBased % config.moves.length) + config.moves.length) % config.moves.length;
    return config.moves[idx] ?? null;
}

/** Convert board intersection to percent for FX anchoring (center of stone). */
export function guildBossBoardPointToPercent(
    x: number,
    y: number,
    boardSize = 9,
): { left: string; top: string } {
    return {
        left: `${((x + 0.5) / boardSize) * 100}%`,
        top: `${((y + 0.5) / boardSize) * 100}%`,
    };
}

/**
 * Combat playback places stones from the boss sequence in order.
 * `placedCount` maps 1:1 to SgfViewer `replayMoveCount`.
 */
export function resolveGuildBossCombatReplayCount(bossId: string, placedCount: number): number {
    const config = getGuildBossBattleBoardConfig(bossId);
    if (config.moveCount <= 0) return 0;
    if (placedCount <= 0) return 0;
    // Wrap visually by clamping within sequence length for board fill stability
    return Math.min(placedCount, config.moveCount);
}
