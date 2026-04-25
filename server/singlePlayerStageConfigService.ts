import * as db from './db.js';
import {
    DEFAULT_SINGLE_PLAYER_STAGES,
} from '../shared/constants/singlePlayerConstants.js';
import { GameMode, SinglePlayerStageInfo, SinglePlayerStrategicRulePreset } from '../types/index.js';

const SINGLE_PLAYER_STAGE_OVERRIDE_KV_KEY = 'singlePlayerStagesOverride';

type StageRow = (typeof DEFAULT_SINGLE_PLAYER_STAGES)[number];

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
};

const RULE_PRESETS: SinglePlayerStrategicRulePreset[] = [
    'auto',
    'classic',
    'capture',
    'survival',
    'speed',
    'base',
    'hidden',
    'missile',
    'mix',
];

const normalizeItemRewardList = (value: unknown): { itemId: string; quantity: number }[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const out = value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const row = entry as Record<string, unknown>;
            const itemId = typeof row.itemId === 'string' ? row.itemId.trim() : '';
            if (!itemId) return null;
            return { itemId, quantity: clampInt(row.quantity, 1, 9999, 1) };
        })
        .filter((entry): entry is { itemId: string; quantity: number } => !!entry);
    return out.length ? out : undefined;
};

const normalizeTimeControl = (
    value: unknown,
    fallback: SinglePlayerStageInfo['timeControl']
): SinglePlayerStageInfo['timeControl'] => {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const fallbackRow = (fallback && typeof fallback === 'object' ? fallback : { type: 'byoyomi' }) as Record<string, unknown>;
    const type = row.type === 'fischer' || row.type === 'byoyomi'
        ? row.type
        : (fallbackRow.type === 'fischer' || fallbackRow.type === 'byoyomi' ? fallbackRow.type : 'byoyomi');

    if (type === 'fischer') {
        return {
            type: 'fischer',
            mainTime: clampInt(row.mainTime, 0, 120, clampInt(fallbackRow.mainTime, 0, 120, 5)),
            increment: clampInt(row.increment, 0, 120, clampInt(fallbackRow.increment, 0, 120, 0)),
        };
    }

    return {
        type: 'byoyomi',
        mainTime: clampInt(row.mainTime, 0, 120, clampInt(fallbackRow.mainTime, 0, 120, 5)),
        byoyomiTime: clampInt(row.byoyomiTime, 0, 300, clampInt(fallbackRow.byoyomiTime, 0, 300, 30)),
        byoyomiCount: clampInt(row.byoyomiCount, 0, 20, clampInt(fallbackRow.byoyomiCount, 0, 20, 3)),
    };
};

const normalizeOptionalPositiveInt = (
    value: unknown,
    fallback: number | undefined,
    max: number
): number | undefined => {
    if (value == null) return fallback;
    const n = clampInt(value, 0, max, fallback ?? 0);
    return n > 0 ? n : undefined;
};

const clampPlacementsToCapacity = (
    placements: SinglePlayerStageInfo['placements'],
    capacity: number
): SinglePlayerStageInfo['placements'] => {
    let remaining = Math.max(0, capacity);
    const black = Math.min(placements.black, remaining);
    remaining -= black;
    const white = Math.min(placements.white, remaining);
    remaining -= white;
    const blackPattern = Math.min(placements.blackPattern, remaining);
    remaining -= blackPattern;
    const whitePattern = Math.min(placements.whitePattern, remaining);

    return {
        ...placements,
        black,
        white,
        blackPattern,
        whitePattern,
    };
};

const normalizeStage = (raw: unknown, fallback: StageRow): SinglePlayerStageInfo | null => {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const boardSize = [7, 9, 11, 13].includes(Number(row.boardSize))
        ? (Number(row.boardSize) as SinglePlayerStageInfo['boardSize'])
        : fallback.boardSize;
    const fixedOpeningRaw = Array.isArray(row.fixedOpening) ? row.fixedOpening : fallback.fixedOpening;
    type FixedOpeningStone = NonNullable<SinglePlayerStageInfo['fixedOpening']>[number];
    const usedFixedCells = new Set<string>();
    const fixedOpening = fixedOpeningRaw
        ?.map((entry): FixedOpeningStone | null => {
            if (!entry || typeof entry !== 'object') return null;
            const s = entry as Record<string, unknown>;
            const color = s.color === 'black' || s.color === 'white' ? s.color : null;
            if (!color) return null;
            const x = clampInt(s.x, 0, boardSize - 1, 0);
            const y = clampInt(s.y, 0, boardSize - 1, 0);
            const kind: FixedOpeningStone['kind'] = s.kind === 'pattern' ? 'pattern' : 'plain';
            return { x, y, color, kind };
        })
        .filter((entry): entry is FixedOpeningStone => {
            if (!entry) return false;
            const key = `${entry.x}:${entry.y}`;
            if (usedFixedCells.has(key)) return false;
            usedFixedCells.add(key);
            return true;
        });

    const normalizedPlacements = clampPlacementsToCapacity(
        {
            black: clampInt((row.placements as any)?.black, 0, boardSize * boardSize, fallback.placements.black),
            white: clampInt((row.placements as any)?.white, 0, boardSize * boardSize, fallback.placements.white),
            blackPattern: clampInt((row.placements as any)?.blackPattern, 0, boardSize * boardSize, fallback.placements.blackPattern),
            whitePattern: clampInt((row.placements as any)?.whitePattern, 0, boardSize * boardSize, fallback.placements.whitePattern),
            centerBlackStoneChance: clampInt(
                (row.placements as any)?.centerBlackStoneChance,
                0,
                100,
                fallback.placements.centerBlackStoneChance ?? 0
            ),
        },
        boardSize * boardSize - (Boolean(row.mergeRandomPlacementsWithFixed) ? (fixedOpening?.length ?? 0) : 0)
    );

    const out: SinglePlayerStageInfo = {
        ...fallback,
        ...row,
        id: fallback.id,
        level: fallback.level,
        boardSize,
        actionPointCost: clampInt(row.actionPointCost, 0, 99, fallback.actionPointCost),
        targetScore: {
            black: clampInt((row.targetScore as any)?.black, 0, 999, fallback.targetScore.black),
            white: clampInt((row.targetScore as any)?.white, 0, 999, fallback.targetScore.white),
        },
        placements: normalizedPlacements,
        timeControl: normalizeTimeControl(row.timeControl, fallback.timeControl),
        blackTurnLimit: normalizeOptionalPositiveInt(row.blackTurnLimit, fallback.blackTurnLimit, 999),
        survivalTurns: normalizeOptionalPositiveInt(row.survivalTurns, fallback.survivalTurns, 999),
        hiddenCount: normalizeOptionalPositiveInt(row.hiddenCount, fallback.hiddenCount, 99),
        scanCount: normalizeOptionalPositiveInt(row.scanCount, fallback.scanCount, 99),
        missileCount: normalizeOptionalPositiveInt(row.missileCount, fallback.missileCount, 99),
        autoScoringTurns: normalizeOptionalPositiveInt(row.autoScoringTurns, fallback.autoScoringTurns, 999),
        rewards: {
            firstClear: {
                gold: clampInt((row.rewards as any)?.firstClear?.gold, 0, 9999999, fallback.rewards.firstClear.gold),
                exp: clampInt((row.rewards as any)?.firstClear?.exp, 0, 9999999, fallback.rewards.firstClear.exp),
                bonus:
                    typeof (row.rewards as any)?.firstClear?.bonus === 'string'
                        ? (row.rewards as any).firstClear.bonus
                        : fallback.rewards.firstClear.bonus,
                items: normalizeItemRewardList((row.rewards as any)?.firstClear?.items) ?? fallback.rewards.firstClear.items,
            },
            repeatClear: {
                gold: clampInt((row.rewards as any)?.repeatClear?.gold, 0, 9999999, fallback.rewards.repeatClear.gold),
                exp: clampInt((row.rewards as any)?.repeatClear?.exp, 0, 9999999, fallback.rewards.repeatClear.exp),
                bonus:
                    typeof (row.rewards as any)?.repeatClear?.bonus === 'string'
                        ? (row.rewards as any).repeatClear.bonus
                        : fallback.rewards.repeatClear.bonus,
                items: normalizeItemRewardList((row.rewards as any)?.repeatClear?.items) ?? fallback.rewards.repeatClear.items,
            },
        },
        baseStones: clampInt((row as any).baseStones, 0, 20, (fallback as any).baseStones ?? 0),
        fixedOpening: fixedOpening?.length ? fixedOpening : undefined,
        mergeRandomPlacementsWithFixed: Boolean(row.mergeRandomPlacementsWithFixed),
    };

    const presetRaw = (row as Record<string, unknown>).strategicRulePreset;
    if (typeof presetRaw === 'string' && (RULE_PRESETS as readonly string[]).includes(presetRaw)) {
        out.strategicRulePreset = presetRaw as SinglePlayerStrategicRulePreset;
    }
    const mixRaw = (row as Record<string, unknown>).mixedStrategicModes;
    if (Array.isArray(mixRaw) && mixRaw.length >= 2) {
        const allowed = new Set(Object.values(GameMode));
        const cleaned = mixRaw
            .map((m) => (typeof m === 'string' && allowed.has(m as GameMode) ? (m as GameMode) : null))
            .filter((m): m is GameMode => m != null);
        if (cleaned.length >= 2) {
            out.mixedStrategicModes = cleaned.slice(0, 5);
        }
    }

    return out;
};

export const normalizeSinglePlayerStagesOverride = (raw: unknown): SinglePlayerStageInfo[] => {
    if (!Array.isArray(raw)) return DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => ({ ...stage }));
    const fallbackById = new Map(DEFAULT_SINGLE_PLAYER_STAGES.map((row) => [row.id, row]));
    const overrideById = new Map<string, unknown>();
    const used = new Set<string>();
    for (const row of raw) {
        if (!row || typeof row !== 'object') continue;
        const id = typeof (row as any).id === 'string' ? (row as any).id : '';
        const fallback = fallbackById.get(id);
        if (!fallback || used.has(id)) continue;
        used.add(id);
        overrideById.set(id, row);
    }
    return DEFAULT_SINGLE_PLAYER_STAGES.map((fallback) => {
        const normalized = normalizeStage(overrideById.get(fallback.id) ?? fallback, fallback);
        return normalized ?? ({ ...fallback } as SinglePlayerStageInfo);
    });
};

export const getEffectiveSinglePlayerStages = async (): Promise<SinglePlayerStageInfo[]> => {
    const raw = await db.getKV<unknown>(SINGLE_PLAYER_STAGE_OVERRIDE_KV_KEY);
    if (!raw) return DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => ({ ...stage }));
    return normalizeSinglePlayerStagesOverride(raw);
};

export const setSinglePlayerStagesOverride = async (stages: SinglePlayerStageInfo[]): Promise<SinglePlayerStageInfo[]> => {
    const normalized = normalizeSinglePlayerStagesOverride(stages);
    await db.setKV(SINGLE_PLAYER_STAGE_OVERRIDE_KV_KEY, normalized);
    return normalized;
};

export const resolveSinglePlayerStage = async (stageId: string): Promise<SinglePlayerStageInfo | undefined> => {
    const stages = await getEffectiveSinglePlayerStages();
    return stages.find((stage) => stage.id === stageId);
};

