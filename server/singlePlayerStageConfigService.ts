import * as db from './db.js';
import {
    DEFAULT_SINGLE_PLAYER_STAGES,
} from '../shared/constants/singlePlayerConstants.js';
import { SinglePlayerStageInfo } from '../types/index.js';

const SINGLE_PLAYER_STAGE_OVERRIDE_KV_KEY = 'singlePlayerStagesOverride';

type StageRow = (typeof DEFAULT_SINGLE_PLAYER_STAGES)[number];

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
};

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

const normalizeStage = (raw: unknown, fallback: StageRow): SinglePlayerStageInfo | null => {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const boardSize = [7, 9, 11, 13].includes(Number(row.boardSize))
        ? (Number(row.boardSize) as SinglePlayerStageInfo['boardSize'])
        : fallback.boardSize;
    const fixedOpeningRaw = Array.isArray(row.fixedOpening) ? row.fixedOpening : fallback.fixedOpening;
    const fixedOpening = fixedOpeningRaw
        ?.map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const s = entry as Record<string, unknown>;
            const color = s.color === 'black' || s.color === 'white' ? s.color : null;
            if (!color) return null;
            const x = clampInt(s.x, 0, boardSize - 1, 0);
            const y = clampInt(s.y, 0, boardSize - 1, 0);
            const kind = s.kind === 'pattern' ? 'pattern' : 'plain';
            return { x, y, color, kind };
        })
        .filter((entry): entry is NonNullable<typeof entry> => !!entry);

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
        placements: {
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
        fixedOpening: fixedOpening?.length ? fixedOpening : undefined,
        mergeRandomPlacementsWithFixed: Boolean(row.mergeRandomPlacementsWithFixed),
    };
    return out;
};

export const normalizeSinglePlayerStagesOverride = (raw: unknown): SinglePlayerStageInfo[] => {
    if (!Array.isArray(raw)) return [];
    const fallbackById = new Map(DEFAULT_SINGLE_PLAYER_STAGES.map((row) => [row.id, row]));
    const out: SinglePlayerStageInfo[] = [];
    const used = new Set<string>();
    for (const row of raw) {
        if (!row || typeof row !== 'object') continue;
        const id = typeof (row as any).id === 'string' ? (row as any).id : '';
        const fallback = fallbackById.get(id);
        if (!fallback || used.has(id)) continue;
        const normalized = normalizeStage(row, fallback);
        if (!normalized) continue;
        used.add(id);
        out.push(normalized);
    }
    return out.length ? out : DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => ({ ...stage }));
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

