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

const hasOwn = (row: Record<string, unknown>, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(row, key);

const normalizeOptionalPositiveIntFromRow = (
    row: Record<string, unknown>,
    key: string,
    max: number
): number | undefined => {
    if (!hasOwn(row, key)) return undefined;
    const n = clampInt(row[key], 0, max, 0);
    return n > 0 ? n : undefined;
};

const normalizeOptionalPositiveIntList = (value: unknown, maxValue: number, maxLen: number): number[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const seen = new Set<number>();
    const out: number[] = [];
    for (const raw of value) {
        const n = clampInt(raw, 1, maxValue, 0);
        if (n <= 0 || seen.has(n)) continue;
        seen.add(n);
        out.push(n);
        if (out.length >= maxLen) break;
    }
    out.sort((a, b) => a - b);
    return out.length > 0 ? out : undefined;
};

const normalizeOptionalText = (value: unknown, fallback: string | undefined, maxLength: number): string | undefined => {
    if (value == null) return fallback;
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    return text ? text.slice(0, maxLength) : undefined;
};

const defaultSinglePlayerKataServerLevel = (level: SinglePlayerStageInfo['level']): number => {
    switch (level) {
        case '입문':
            return -31;
        case '초급':
            return -30;
        case '중급':
            return -29;
        case '고급':
            return -28;
        case '유단자':
            return -27;
        default:
            return -31;
    }
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

    const forcedAiResponsesRaw = Array.isArray(row.forcedAiResponses)
        ? (row.forcedAiResponses as unknown[])
        : [];
    const normalizePointInBoard = (value: unknown): { x: number; y: number } | null => {
        if (!value || typeof value !== 'object') return null;
        const v = value as Record<string, unknown>;
        return {
            x: clampInt(v.x, 0, boardSize - 1, 0),
            y: clampInt(v.y, 0, boardSize - 1, 0),
        };
    };
    type ForcedAiResponse = NonNullable<SinglePlayerStageInfo['forcedAiResponses']>[number];
    const forcedAiResponses: ForcedAiResponse[] = forcedAiResponsesRaw
        .map((entry): ForcedAiResponse | null => {
            if (!entry || typeof entry !== 'object') return null;
            const obj = entry as Record<string, unknown>;
            const move = normalizePointInBoard(obj.move);
            if (!move) return null;
            const whenOpponentStoneAt = normalizePointInBoard(obj.whenOpponentStoneAt);
            return whenOpponentStoneAt ? { move, whenOpponentStoneAt } : { move };
        })
        .filter((entry): entry is ForcedAiResponse => entry != null);
    const aiHiddenItemPlacementsRaw = Array.isArray(row.aiHiddenItemPlacements)
        ? (row.aiHiddenItemPlacements as unknown[])
        : [];
    const aiHiddenItemPlacements = aiHiddenItemPlacementsRaw
        .map((entry) => normalizePointInBoard(entry))
        .filter((entry): entry is { x: number; y: number } => entry != null)
        .slice(0, 12);

    const out: SinglePlayerStageInfo = {
        ...fallback,
        ...row,
        id: fallback.id,
        description: normalizeOptionalText(row.description, fallback.description, 1200),
        level: fallback.level,
        boardSize,
        actionPointCost: clampInt(row.actionPointCost, 0, 99, fallback.actionPointCost),
        targetScore: {
            black: clampInt((row.targetScore as any)?.black, 0, 999, fallback.targetScore.black),
            white: clampInt((row.targetScore as any)?.white, 0, 999, fallback.targetScore.white),
        },
        placements: normalizedPlacements,
        timeControl: normalizeTimeControl(row.timeControl, fallback.timeControl),
        blackTurnLimit: normalizeOptionalPositiveIntFromRow(row, 'blackTurnLimit', 999),
        survivalTurns: normalizeOptionalPositiveIntFromRow(row, 'survivalTurns', 999),
        hiddenCount: normalizeOptionalPositiveIntFromRow(row, 'hiddenCount', 99),
        scanCount: normalizeOptionalPositiveIntFromRow(row, 'scanCount', 99),
        aiHiddenItemTurns: normalizeOptionalPositiveIntList(row.aiHiddenItemTurns, 99, 12),
        aiHiddenItemUseWithinTurn: normalizeOptionalPositiveIntFromRow(row, 'aiHiddenItemUseWithinTurn', 99),
        aiHiddenItemUseCount: normalizeOptionalPositiveIntFromRow(row, 'aiHiddenItemUseCount', 12),
        aiHiddenItemPlacements: aiHiddenItemPlacements.length > 0 ? aiHiddenItemPlacements : undefined,
        disableAiHiddenItemUsage: row.disableAiHiddenItemUsage === true ? true : undefined,
        forceAiResponsesOnHiddenTurnsOnly: row.forceAiResponsesOnHiddenTurnsOnly === true ? true : undefined,
        missileCount: normalizeOptionalPositiveIntFromRow(row, 'missileCount', 99),
        autoScoringTurns: normalizeOptionalPositiveIntFromRow(row, 'autoScoringTurns', 999),
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
        baseStones: normalizeOptionalPositiveIntFromRow(row, 'baseStones', 20),
        fixedOpening: fixedOpening?.length ? fixedOpening : undefined,
        mergeRandomPlacementsWithFixed: Boolean(row.mergeRandomPlacementsWithFixed),
        allowPlacementRefresh: row.allowPlacementRefresh === false ? false : fallback.allowPlacementRefresh !== false,
        kataServerLevel: clampInt(
            (row as any).kataServerLevel,
            -31,
            9,
            (fallback as any).kataServerLevel ?? defaultSinglePlayerKataServerLevel(fallback.level)
        ),
        forcedAiResponses: forcedAiResponses.length > 0 ? forcedAiResponses : undefined,
        strictForcedAiResponses: row.strictForcedAiResponses === true ? true : undefined,
    };

    const presetRaw = (row as Record<string, unknown>).strategicRulePreset;
    if (typeof presetRaw === 'string' && (RULE_PRESETS as readonly string[]).includes(presetRaw)) {
        out.strategicRulePreset = presetRaw as SinglePlayerStrategicRulePreset;
    } else {
        delete (out as { strategicRulePreset?: SinglePlayerStrategicRulePreset }).strategicRulePreset;
    }
    const mixRaw = (row as Record<string, unknown>).mixedStrategicModes;
    if (Array.isArray(mixRaw) && mixRaw.length >= 2) {
        const allowed = new Set(Object.values(GameMode));
        const cleaned = mixRaw
            .map((m) => (typeof m === 'string' && allowed.has(m as GameMode) ? (m as GameMode) : null))
            .filter((m): m is GameMode => m != null);
        if (cleaned.length >= 2) {
            out.mixedStrategicModes = cleaned.slice(0, 5);
        } else {
            delete (out as { mixedStrategicModes?: GameMode[] }).mixedStrategicModes;
        }
    } else {
        delete (out as { mixedStrategicModes?: GameMode[] }).mixedStrategicModes;
    }
    if (out.strategicRulePreset === 'mix' && out.mixedStrategicModes?.includes(GameMode.Capture)) {
        delete (out as { autoScoringTurns?: number }).autoScoringTurns;
    }

    return out;
};

/** 전체 스테이지 배열이 기본 ID 집합과 1:1 대응하는 순열이면 true (관리자 순서 편집 저장) */
export const isFullSinglePlayerStagesPermutation = (raw: unknown): boolean => {
    if (!Array.isArray(raw)) return false;
    const fallbacks = DEFAULT_SINGLE_PLAYER_STAGES;
    const n = fallbacks.length;
    if (raw.length !== n) return false;
    const expected = new Set(fallbacks.map((s) => s.id));
    const seen = new Set<string>();
    for (const row of raw) {
        if (!row || typeof row !== 'object') return false;
        const id = typeof (row as { id?: unknown }).id === 'string' ? (row as { id: string }).id : '';
        if (!id || !expected.has(id) || seen.has(id)) return false;
        seen.add(id);
    }
    return seen.size === n;
};

export const normalizeSinglePlayerStagesOverride = (raw: unknown): SinglePlayerStageInfo[] => {
    if (!Array.isArray(raw)) return DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => ({ ...stage }));
    const fallbackById = new Map(DEFAULT_SINGLE_PLAYER_STAGES.map((row) => [row.id, row]));

    if (isFullSinglePlayerStagesPermutation(raw)) {
        return DEFAULT_SINGLE_PLAYER_STAGES.map((slotDefault, i) => {
            const row = raw[i] as Record<string, unknown>;
            const normalized = normalizeStage({ ...row, name: slotDefault.name }, slotDefault);
            return normalized ?? ({ ...slotDefault } as SinglePlayerStageInfo);
        });
    }

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

